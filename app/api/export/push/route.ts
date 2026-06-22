/**
 * POST /api/export/push
 *
 * Called by the browser (WorkingKeysPanel) to sync localStorage keys to
 * the server cache so external clients (SBG) can fetch them via GET
 * /api/export/working-keys.
 *
 * Body: { token: string, keys: WorkingKeyRecord[] }
 * Response: { ok: true, synced: number, syncCount: number }
 */

import { NextRequest, NextResponse } from "next/server"
import { validateToken, setCacheForToken } from "@/lib/export-cache"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { token?: string; keys?: unknown[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { token, keys } = body

  // ── Auth ───────────────────────────────────────────────────────────────────
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 401 })
  }
  if (!validateToken(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  // ── Validate keys array ────────────────────────────────────────────────────
  if (!Array.isArray(keys)) {
    return NextResponse.json({ error: "keys must be an array" }, { status: 400 })
  }

  // Whitelist fields — never store anything extra
  const sanitized = keys
    .filter(
      (k): k is Record<string, unknown> =>
        typeof k === "object" && k !== null,
    )
    .map((k) => ({
      providerId: String(k.providerId ?? ""),
      providerName: String(k.providerName ?? ""),
      apiKey: String(k.apiKey ?? ""),
      modelId: String(k.modelId ?? ""),
      latencyMs: Number(k.latencyMs ?? 0),
      tokenUsage:
        k.tokenUsage && typeof k.tokenUsage === "object"
          ? {
              prompt: Number((k.tokenUsage as Record<string, unknown>).prompt ?? 0) || undefined,
              completion: Number((k.tokenUsage as Record<string, unknown>).completion ?? 0) || undefined,
              total: Number((k.tokenUsage as Record<string, unknown>).total ?? 0) || undefined,
            }
          : undefined,
      savedAt: Number(k.savedAt ?? Date.now()),
    }))
    .filter((k) => k.providerId && k.apiKey && k.modelId)

  setCacheForToken(token, sanitized)

  return NextResponse.json({
    ok: true,
    synced: sanitized.length,
  })
}
