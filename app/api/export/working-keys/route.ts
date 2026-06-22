/**
 * GET /api/export/working-keys
 *
 * Called by external services (SBG, other apps) to retrieve the latest
 * synced working keys. Only returns masked API keys — raw keys are never
 * exposed.
 *
 * Auth: Authorization: Bearer <EXPORT_API_TOKEN>
 *
 * Query params (all optional):
 *   ?provider=mistral          filter by providerId
 *   ?min_latency=0             filter by minimum latency ms
 *   ?max_latency=2000          filter by maximum latency ms
 *   ?limit=100                 max records returned (default 500)
 *   ?since=1719100000000       only records savedAt >= this unix ms
 */

import { NextRequest, NextResponse } from "next/server"
import { validateToken, getCacheForToken } from "@/lib/export-cache"

export const runtime = "nodejs"

// Rate limiting — simple in-memory per IP counter
const rateMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 60        // requests
const RATE_WINDOW = 60_000   // per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export async function GET(req: NextRequest) {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 60 requests/minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    )
  }

  // ── Auth: Bearer token ─────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : (req.nextUrl.searchParams.get("token") ?? "")

  if (!token) {
    return NextResponse.json(
      { error: "Missing Authorization header. Use: Authorization: Bearer <token>" },
      { status: 401 },
    )
  }
  if (!validateToken(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  // ── Retrieve cache ─────────────────────────────────────────────────────────
  const store = getCacheForToken(token)
  if (!store) {
    return NextResponse.json(
      {
        ok: true,
        keys: [],
        total: 0,
        lastSyncAt: null,
        syncCount: 0,
        message: "No data synced yet. Call POST /api/export/push from the browser first.",
      },
      { status: 200 },
    )
  }

  // ── Query filters ──────────────────────────────────────────────────────────
  const params = req.nextUrl.searchParams
  const providerFilter = params.get("provider")
  const minLatency = params.has("min_latency") ? Number(params.get("min_latency")) : undefined
  const maxLatency = params.has("max_latency") ? Number(params.get("max_latency")) : undefined
  const since = params.has("since") ? Number(params.get("since")) : undefined
  const limit = Math.min(Number(params.get("limit") ?? 500), 1000)

  let keys = store.keys

  if (providerFilter) {
    keys = keys.filter((k) =>
      k.providerId.toLowerCase() === providerFilter.toLowerCase()
    )
  }
  if (minLatency !== undefined) keys = keys.filter((k) => k.latencyMs >= minLatency)
  if (maxLatency !== undefined) keys = keys.filter((k) => k.latencyMs <= maxLatency)
  if (since !== undefined) keys = keys.filter((k) => k.savedAt >= since)

  keys = keys.slice(0, limit)

  // ── Response ───────────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      ok: true,
      keys,
      total: keys.length,
      lastSyncAt: store.lastSyncAt,
      syncCount: store.syncCount,
    },
    {
      status: 200,
      headers: {
        // Prevent caching — always fresh data
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    },
  )
}
