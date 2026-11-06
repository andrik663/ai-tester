/**
 * GET /api/analytics?window=24h|7d|30d
 *
 * Gateway usage analytics, aggregated from gateway_logs.
 *
 * Auth: Authorization: Bearer <msk_ / atk_ / admin token> (same gate as
 * /api/v1/*). Anonymous callers get 401 — never global data. Scope:
 *   - msaku_user → only the caller's own rows (caller_user_id = userId)
 *   - admin / atk_ → global, plus a per-user top list
 *
 * NOTE: do NOT pass allowAnonymousRead=true here (unlike /api/v1/logs):
 * an anonymous caller has no userId, so the "own rows" filter would be
 * empty and the query would silently fall through to GLOBAL analytics.
 *
 * Returns only aggregates — no key values, no message content.
 */

import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db/index"
import { authenticateGatewayRequest } from "@/lib/gateway-auth"

export const runtime = "nodejs"

const WINDOWS: Record<string, number> = {
  "24h": 24 * 3_600_000,
  "7d": 7 * 24 * 3_600_000,
  "30d": 30 * 24 * 3_600_000,
}

export async function GET(req: NextRequest) {
  // allowAnonymousRead=false: anonymous callers must get 401, not data.
  const auth = await authenticateGatewayRequest(req.headers, "/api/analytics", false)
  if (!auth.valid || auth.tier === "anonymous_read") {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 })
  }

  const sp = req.nextUrl.searchParams
  const windowKey = WINDOWS[sp.get("window") ?? ""] ? (sp.get("window") as string) : "7d"
  const windowMs = WINDOWS[windowKey]
  const since = Date.now() - windowMs

  // admin (internal token) and api_key (atk_ operator key) see global usage.
  const isGlobal = auth.tier === "admin" || auth.tier === "api_key"
  const userId = typeof auth.userId === "number" && auth.userId > 0 ? auth.userId : null
  // A non-global caller without a userId must never see global rows.
  if (!isGlobal && userId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const where = isGlobal
    ? "WHERE ts_ms > $1"
    : "WHERE ts_ms > $1 AND caller_user_id = $2"
  const params: (number)[] = isGlobal ? [since] : [since, userId as number]

  try {
    const client = await pool.connect()
    try {
      const { rows: totalRows } = await client.query(
        `SELECT COUNT(*)::int AS total,
                SUM(CASE WHEN success THEN 1 ELSE 0 END)::int AS ok_count,
                SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::int AS fail_count,
                COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS tokens,
                COALESCE(SUM(prompt_tokens), 0)::int AS prompt_tokens,
                COALESCE(SUM(completion_tokens), 0)::int AS completion_tokens,
                COALESCE(ROUND(AVG(latency_ms))::int, 0) AS avg_latency_ms,
                COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::int, 0) AS p95_latency_ms
         FROM gateway_logs ${where}`,
        params,
      )
      const t = totalRows[0] ?? {}

      const { rows: dailyRows } = await client.query(
        `SELECT to_char(created_at, 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS requests,
                SUM(CASE WHEN success THEN 1 ELSE 0 END)::int AS ok_count,
                COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS tokens
         FROM gateway_logs ${where}
         GROUP BY day ORDER BY day`,
        params,
      )

      const { rows: provRows } = await client.query(
        `SELECT provider_id, provider_name,
                COUNT(*)::int AS requests,
                COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS tokens,
                ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS success_rate,
                COALESCE(ROUND(AVG(latency_ms))::int, 0) AS avg_latency_ms
         FROM gateway_logs ${where}
         GROUP BY provider_id, provider_name ORDER BY requests DESC LIMIT 10`,
        params,
      )

      const { rows: modelRows } = await client.query(
        `SELECT model,
                COUNT(*)::int AS requests,
                COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS tokens
         FROM gateway_logs ${where}
         GROUP BY model ORDER BY requests DESC LIMIT 10`,
        params,
      )

      const { rows: sharedRows } = await client.query(
        `SELECT is_shared_key,
                COUNT(*)::int AS requests,
                COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS tokens
         FROM gateway_logs ${where}
         GROUP BY is_shared_key`,
        params,
      )

      let topUsers: Array<{ userId: number | null; requests: number; tokens: number }> = []
      if (isGlobal) {
        const { rows: userRows } = await client.query(
          `SELECT caller_user_id,
                  COUNT(*)::int AS requests,
                  COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS tokens
           FROM gateway_logs ${where}
           GROUP BY caller_user_id ORDER BY requests DESC LIMIT 10`,
          params,
        )
        topUsers = userRows.map((r) => ({
          userId: r.caller_user_id ?? null,
          requests: Number(r.requests ?? 0),
          tokens: Number(r.tokens ?? 0),
        }))
      }

      return NextResponse.json(
        {
          window: windowKey,
          scope: isGlobal ? "global" : "own",
          generatedAt: new Date().toISOString(),
          totals: {
            requests: Number(t.total ?? 0),
            success: Number(t.ok_count ?? 0),
            failed: Number(t.fail_count ?? 0),
            successRate:
              Number(t.total ?? 0) > 0
                ? Math.round((Number(t.ok_count ?? 0) / Number(t.total)) * 1000) / 10
                : 100,
            tokens: Number(t.tokens ?? 0),
            promptTokens: Number(t.prompt_tokens ?? 0),
            completionTokens: Number(t.completion_tokens ?? 0),
            avgLatencyMs: Number(t.avg_latency_ms ?? 0),
            p95LatencyMs: Number(t.p95_latency_ms ?? 0),
          },
          daily: dailyRows.map((r) => ({
            day: r.day,
            requests: Number(r.requests ?? 0),
            success: Number(r.ok_count ?? 0),
            tokens: Number(r.tokens ?? 0),
          })),
          topProviders: provRows.map((r) => ({
            providerId: r.provider_id,
            providerName: r.provider_name ?? r.provider_id,
            requests: Number(r.requests ?? 0),
            tokens: Number(r.tokens ?? 0),
            successRate: Number(r.success_rate ?? 0),
            avgLatencyMs: Number(r.avg_latency_ms ?? 0),
          })),
          topModels: modelRows.map((r) => ({
            model: r.model,
            requests: Number(r.requests ?? 0),
            tokens: Number(r.tokens ?? 0),
          })),
          sharedSplit: sharedRows.map((r) => ({
            shared: r.is_shared_key === true,
            requests: Number(r.requests ?? 0),
            tokens: Number(r.tokens ?? 0),
          })),
          ...(isGlobal ? { topUsers } : {}),
        },
        { headers: { "Cache-Control": "no-store" } },
      )
    } finally {
      client.release()
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Analytics query failed: ${msg}` }, { status: 500 })
  }
}
