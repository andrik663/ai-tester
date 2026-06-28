/**
 * POST /api/v1/gateway/push
 *
 * Called by the browser (WorkingKeysPanel → ExportApiPanel) to sync raw working
 * keys into the Miuclaw Gateway in-memory cache so /api/v1/chat/completions can
 * forward requests to the correct provider automatically.
 *
 * Auth: none required from the browser — keys are stored under the server-side
 *       EXPORT_API_TOKEN so /api/v1/chat/completions can look them up.
 *
 * SECURITY: Raw API keys are persisted in Neon (server-side only).
 * They are NEVER returned to any external client and NEVER logged.
 */

import { NextRequest, NextResponse } from "next/server"
import { getInternalToken, setGatewayKeys, GatewayKey } from "@/lib/gateway-cache"

export const runtime = "nodejs"

interface GatewayKeyInput {
  providerId: string
  providerName: string
  apiKey: string
  modelIds: string[]
  avgLatencyMs?: number
  pushedAt?: number
}

export async function POST(req: NextRequest) {
  // ── Resolve the internal cache key from env ─────────────────────────────────
  const internalToken = getInternalToken()
  if (!internalToken) {
    return NextResponse.json(
      { error: "Server misconfiguration: EXPORT_API_TOKEN env var not set" },
      { status: 503 },
    )
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { keys?: unknown[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(body.keys)) {
    return NextResponse.json({ error: "keys must be an array" }, { status: 400 })
  }

  // ── Sanitize ────────────────────────────────────────────────────────────────
  const sanitized: GatewayKey[] = (body.keys as unknown[])
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

  // Store under the internal server token — no client token needed
  await setGatewayKeys(internalToken, sanitized)

  const providerCount = new Set(sanitized.map((k) => k.providerId)).size
  const modelCount = sanitized.reduce((acc, k) => acc + k.modelIds.length, 0)

  return NextResponse.json({
    ok: true,
    synced: sanitized.length,
    providers: providerCount,
    models: modelCount,
  })
}
