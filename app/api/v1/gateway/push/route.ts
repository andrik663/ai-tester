/**
 * POST /api/v1/gateway/push
 *
 * Supports two modes:
 *
 * 1. Single-shot (legacy): send all keys at once. Works fine for ≤ 10 keys.
 *    Body: { keys: GatewayKeyInput[] }
 *
 * 2. Chunked (recommended for many keys): send in small batches.
 *    Body: {
 *      keys: GatewayKeyInput[],      // this chunk
 *      chunkIndex: number,           // 0-based index of this chunk
 *      totalChunks: number,          // total number of chunks
 *      allApiKeys?: string[],        // full list of api_keys in the sync (sent on last chunk)
 *    }
 *    On the final chunk (chunkIndex === totalChunks - 1), the server prunes
 *    any gateway_keys row whose api_key is NOT in allApiKeys.
 *
 * SECURITY: Raw API keys are persisted server-side in Neon only.
 * They are NEVER returned to any external client and NEVER logged.
 */

import { NextRequest, NextResponse } from "next/server"
import { getInternalToken, upsertGatewayKeyChunk, pruneStaleGatewayKeys, GatewayKey, dbLoadKeyCount } from "@/lib/gateway-cache"

export const runtime = "nodejs"
export const maxDuration = 60

interface GatewayKeyInput {
  providerId: string
  providerName: string
  apiKey: string
  modelIds: string[]
  avgLatencyMs?: number
  pushedAt?: number
}

interface PushBody {
  keys?: unknown[]
  chunkIndex?: number
  totalChunks?: number
  allApiKeys?: string[]
}

function sanitize(raw: unknown[]): GatewayKey[] {
  const cleaned = (raw as unknown[])
    .filter((k): k is GatewayKeyInput =>
      typeof k === "object" && k !== null &&
      typeof (k as GatewayKeyInput).providerId === "string" &&
      typeof (k as GatewayKeyInput).apiKey === "string" &&
      Array.isArray((k as GatewayKeyInput).modelIds),
    )
    .map((k) => ({
      providerId: k.providerId.trim(),
      providerName: k.providerName?.trim() ?? k.providerId,
      apiKey: k.apiKey.trim(),
      modelIds: k.modelIds.filter((m) => typeof m === "string" && m.trim().length > 0),
      avgLatencyMs: Number(k.avgLatencyMs ?? 0),
      pushedAt: Number(k.pushedAt ?? Date.now()),
    }))
    .filter((k) => k.providerId && k.apiKey && k.modelIds.length > 0)

  // Dedupe by (providerId, apiKey) WITHIN this chunk — merging modelIds.
  // Postgres' ON CONFLICT DO UPDATE cannot touch the same row twice in one
  // INSERT, so duplicate pairs in a single chunk would otherwise cause a 500.
  const merged = new Map<string, GatewayKey>()
  for (const k of cleaned) {
    const mapKey = `${k.providerId}::${k.apiKey}`
    const existing = merged.get(mapKey)
    if (existing) {
      const modelSet = new Set([...existing.modelIds, ...k.modelIds])
      existing.modelIds = Array.from(modelSet)
      existing.avgLatencyMs = Math.round((existing.avgLatencyMs + k.avgLatencyMs) / 2)
      existing.pushedAt = Math.max(existing.pushedAt, k.pushedAt)
    } else {
      merged.set(mapKey, { ...k })
    }
  }
  return Array.from(merged.values())
}

export async function POST(req: NextRequest) {
  // ── Guard: env check ────────────────────────────────────────────────────────
  const internalToken = getInternalToken()
  if (!internalToken) {
    return NextResponse.json(
      { error: "Server misconfiguration: EXPORT_API_TOKEN env var not set" },
      { status: 503 },
    )
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: PushBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(body.keys)) {
    return NextResponse.json({ error: "keys must be an array" }, { status: 400 })
  }

  const sanitized = sanitize(body.keys)

  // ── Determine mode ──────────────────────────────────────────────────────────
  const chunkIndex  = typeof body.chunkIndex  === "number" ? body.chunkIndex  : 0
  const totalChunks = typeof body.totalChunks === "number" ? body.totalChunks : 1
  const isLastChunk = chunkIndex === totalChunks - 1
  const isChunked   = totalChunks > 1

  // ── DB writes — wrapped so ANY failure returns JSON (never an HTML 500) ──────
  try {
    // UPSERT this chunk
    await upsertGatewayKeyChunk(sanitized)

    let pruned = 0

    // On final chunk: prune stale keys
    if (isLastChunk) {
      const allApiKeys = Array.isArray(body.allApiKeys)
        ? body.allApiKeys.filter((k) => typeof k === "string" && k.trim().length > 0)
        : sanitized.map((k) => k.apiKey)        // single-shot: keep only what was sent
      pruned = await pruneStaleGatewayKeys(allApiKeys)
    }

    // Build response
    const providerCount = new Set(sanitized.map((k) => k.providerId)).size
    const modelCount    = sanitized.reduce((acc, k) => acc + k.modelIds.length, 0)
    const totalInDb     = isLastChunk ? await dbLoadKeyCount() : null

    return NextResponse.json({
      ok: true,
      chunkIndex,
      totalChunks,
      synced:    sanitized.length,
      providers: providerCount,
      models:    modelCount,
      pruned,
      ...(totalInDb !== null ? { totalInDb } : {}),
      ...(isChunked ? { isLastChunk } : {}),
    })
  } catch (err) {
    // Surface the real DB error as JSON so the client shows a useful message
    const message = err instanceof Error ? err.message : String(err)
    console.error("[v0] gateway push DB error:", message)
    return NextResponse.json(
      { error: `Database error while saving keys: ${message}`, chunkIndex, totalChunks },
      { status: 500 },
    )
  }
}
