/**
 * POST /api/v1/gateway/push
 *
 * Called by the browser (WorkingKeysPanel) to sync raw working keys into the
 * Miuclaw Gateway cache so /api/v1/chat/completions can forward requests.
 *
 * Auth: Authorization: Bearer <EXPORT_API_TOKEN>
 * Body: { keys: GatewayKeyInput[] }
 *
 * SECURITY: Raw API keys are stored in server-side memory only.
 * They are NEVER returned to any external client and NEVER logged.
 */

import { NextRequest, NextResponse } from "next/server"
import { validateGatewayToken, setGatewayKeys, GatewayKey } from "@/lib/gateway-cache"

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
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""

  if (!token) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 })
  }
  if (!validateGatewayToken(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
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

  setGatewayKeys(token, sanitized)

  const providerCount = new Set(sanitized.map((k) => k.providerId)).size
  const modelCount = sanitized.reduce((acc, k) => acc + k.modelIds.length, 0)

  return NextResponse.json({
    ok: true,
    synced: sanitized.length,
    providers: providerCount,
    models: modelCount,
  })
}
