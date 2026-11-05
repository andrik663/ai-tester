/**
 * GET /api/status — public gateway status page data.
 *
 * No auth: a status page must be readable without a key (same as any
 * public status page). Returns ONLY aggregates — no key values, no user
 * data, no per-user breakdowns.
 *
 * Response:
 *   {
 *     status: "operational" | "degraded" | "down",
 *     generatedAt: string, dbOk: boolean,
 *     totals: { requests24h, successRate, avgLatencyMs,
 *               totalKeys, totalProviders, totalModelsStatic },
 *     providers: [{ providerId, providerName, total, successRate,
 *                    avgLatencyMs, lastRequestAt, lastSuccessAt, status }]
 *   }
 *
 * In-memory cache: 60 s (status pages are polled often; do not hammer Neon).
 */

import { NextResponse } from "next/server"
import { pool } from "@/lib/db/index"
import { PROVIDER_CONFIGS } from "@/lib/providers"

export const runtime = "nodejs"

type Health = "operational" | "degraded" | "down" | "no_data"

interface ProviderHealth {
  providerId: string
  providerName: string
  total: number
  successRate: number
  avgLatencyMs: number
  lastRequestAt: string | null
  lastSuccessAt: string | null
  status: Health
}

let cached: { at: number; body: unknown } | null = null
const CACHE_TTL_MS = 60_000
const DAY_MS = 24 * 3_600_000

function healthOf(total: number, successRate: number): Health {
  if (total === 0) return "no_data"
  if (successRate >= 99) return "operational"
  if (successRate >= 90) return "degraded"
  return "down"
}

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.body, {
      headers: { "Cache-Control": "public, max-age=60" },
    })
  }

  const since = Date.now() - DAY_MS
  let dbOk = true
  let totalKeys = 0
  let total24h = 0
  let ok24h = 0
  let avgLatencyMs = 0
  const providers: ProviderHealth[] = []

  try {
    const client = await pool.connect()
    try {
      await client.query("SELECT 1")

      const { rows: keyRows } = await client.query(
        "SELECT COUNT(*)::int AS n FROM gateway_keys",
      )
      totalKeys = keyRows[0]?.n ?? 0

      const { rows: totalRows } = await client.query(
        `SELECT COUNT(*)::int AS total,
                SUM(CASE WHEN success THEN 1 ELSE 0 END)::int AS ok_count,
                COALESCE(ROUND(AVG(latency_ms))::int, 0) AS avg_latency_ms
         FROM gateway_logs WHERE ts_ms > $1`,
        [since],
      )
      total24h = totalRows[0]?.total ?? 0
      ok24h = totalRows[0]?.ok_count ?? 0
      avgLatencyMs = totalRows[0]?.avg_latency_ms ?? 0

      const { rows: provRows } = await client.query(
        `SELECT provider_id, provider_name,
                COUNT(*)::int AS total,
                SUM(CASE WHEN success THEN 1 ELSE 0 END)::int AS ok_count,
                COALESCE(ROUND(AVG(latency_ms))::int, 0) AS avg_latency_ms,
                MAX(created_at)::text AS last_request_at,
                MAX(created_at) FILTER (WHERE success)::text AS last_success_at
         FROM gateway_logs WHERE ts_ms > $1
         GROUP BY provider_id, provider_name ORDER BY total DESC`,
        [since],
      )
      for (const r of provRows) {
        const total = Number(r.total ?? 0)
        const ok = Number(r.ok_count ?? 0)
        const rate = total > 0 ? Math.round((ok / total) * 1000) / 10 : 0
        providers.push({
          providerId: r.provider_id,
          providerName: r.provider_name ?? r.provider_id,
          total,
          successRate: rate,
          avgLatencyMs: Number(r.avg_latency_ms ?? 0),
          lastRequestAt: r.last_request_at ?? null,
          lastSuccessAt: r.last_success_at ?? null,
          status: healthOf(total, rate),
        })
      }
    } finally {
      client.release()
    }
  } catch {
    dbOk = false
  }

  const successRate =
    total24h > 0 ? Math.round((ok24h / total24h) * 1000) / 10 : 100
  const anyBad = providers.some((p) => p.status === "down" || p.status === "degraded")
  const status: "operational" | "degraded" | "down" = !dbOk
    ? "down"
    : anyBad || (total24h > 0 && successRate < 95)
      ? "degraded"
      : "operational"

  const totalModelsStatic = Object.values(PROVIDER_CONFIGS).reduce(
    (sum, cfg) => sum + (cfg.models?.length ?? 0),
    0,
  )

  const body = {
    status,
    generatedAt: new Date().toISOString(),
    dbOk,
    totals: {
      requests24h: total24h,
      successRate,
      avgLatencyMs,
      totalKeys,
      totalProviders: Object.keys(PROVIDER_CONFIGS).length,
      totalModelsStatic,
    },
    providers,
  }

  cached = { at: Date.now(), body }
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=60" },
  })
}
