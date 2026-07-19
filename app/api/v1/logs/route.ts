/**
 * GET /api/v1/logs
 *
 * Miuclaw Gateway — real-time request log reader.
 *
 * Query params:
 *   limit       - max rows (default 100, max 500)
 *   since       - tsMs epoch; only rows newer than this (for polling)
 *   provider    - filter by provider ID
 *   model       - filter by model ID
 *   failed      - "1" to show only failed requests
 *   summary     - "1" to return analytics summary instead of rows
 *   window      - summary window in ms (default 3600000 = 1 h)
 *
 * Auth: Authorization: Bearer <EXPORT_API_TOKEN>
 */

import { NextRequest, NextResponse } from "next/server"
import { validateGatewayToken } from "@/lib/gateway-cache"
import { readGatewayLogs, getLogsSummary } from "@/lib/gateway-logs"

export const runtime = "nodejs"

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!token || !validateGatewayToken(token)) return unauthorized()

  const sp = req.nextUrl.searchParams

  // ── Summary mode ────────────────────────────────────────────────────────────
  if (sp.get("summary") === "1") {
    const windowMs = Number(sp.get("window") ?? 3_600_000)
    const summary = await getLogsSummary(windowMs)
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } })
  }

  // ── Log rows ────────────────────────────────────────────────────────────────
  const rows = await readGatewayLogs({
    limit:      sp.get("limit")    ? Number(sp.get("limit"))  : 100,
    since:      sp.get("since")    ? Number(sp.get("since"))  : undefined,
    providerId: sp.get("provider") ?? undefined,
    model:      sp.get("model")    ?? undefined,
    failedOnly: sp.get("failed")   === "1",
  })

  return NextResponse.json(
    { rows, total: rows.length },
    { headers: { "Cache-Control": "no-store" } },
  )
}
