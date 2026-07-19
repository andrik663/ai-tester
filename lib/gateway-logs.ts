/**
 * lib/gateway-logs.ts
 *
 * Write + read helpers for gateway_logs table.
 * Auto-creates the table on first write (catches missing-table errors and
 * retries once — handles cold-start on a fresh Neon project).
 */

import { pool } from "@/lib/db/index"

export interface GatewayLogEntry {
  model:            string
  providerId:       string
  providerName:     string
  success:          boolean
  statusCode:       number
  latencyMs:        number
  errorMessage?:    string | null
  streaming:        boolean
  fallbackUsed:     boolean
  attemptCount:     number
  promptTokens?:    number
  completionTokens?: number
}

export interface GatewayLogRow extends GatewayLogEntry {
  id:        number
  tsMs:      number
  createdAt: string
}

// ── Auto-create DDL ───────────────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS gateway_logs (
  id                SERIAL PRIMARY KEY,
  model             TEXT        NOT NULL,
  provider_id       TEXT        NOT NULL,
  provider_name     TEXT        NOT NULL,
  success           BOOLEAN     NOT NULL DEFAULT FALSE,
  status_code       INTEGER     NOT NULL DEFAULT 200,
  latency_ms        INTEGER     NOT NULL DEFAULT 0,
  error_message     TEXT,
  streaming         BOOLEAN     NOT NULL DEFAULT FALSE,
  fallback_used     BOOLEAN     NOT NULL DEFAULT FALSE,
  attempt_count     INTEGER     NOT NULL DEFAULT 1,
  prompt_tokens     INTEGER     NOT NULL DEFAULT 0,
  completion_tokens INTEGER     NOT NULL DEFAULT 0,
  ts_ms             BIGINT      NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gateway_logs_ts_ms_idx      ON gateway_logs (ts_ms DESC);
CREATE INDEX IF NOT EXISTS gateway_logs_provider_idx   ON gateway_logs (provider_id, ts_ms DESC);
`

async function ensureTable(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query(CREATE_TABLE_SQL)
  } finally {
    client.release()
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Insert one log entry. Fire-and-forget: never throws to the caller.
 * If the table doesn't exist yet, creates it and retries once.
 */
export async function writeGatewayLog(entry: GatewayLogEntry): Promise<void> {
  const tsMs = Date.now()
  const INSERT = `
    INSERT INTO gateway_logs
      (model, provider_id, provider_name, success, status_code, latency_ms,
       error_message, streaming, fallback_used, attempt_count,
       prompt_tokens, completion_tokens, ts_ms)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
  `
  const values = [
    entry.model,
    entry.providerId,
    entry.providerName,
    entry.success,
    entry.statusCode,
    entry.latencyMs,
    entry.errorMessage ?? null,
    entry.streaming,
    entry.fallbackUsed,
    entry.attemptCount,
    entry.promptTokens ?? 0,
    entry.completionTokens ?? 0,
    tsMs,
  ]

  const client = await pool.connect()
  try {
    await client.query(INSERT, values)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("does not exist")) {
      // Table not yet created — auto-migrate and retry
      await ensureTable()
      await client.query(INSERT, values)
    }
    // Silently swallow other write errors to avoid breaking the gateway
  } finally {
    client.release()
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export interface LogsQueryOptions {
  limit?:      number   // default 100, max 500
  since?:      number   // tsMs — only rows after this timestamp
  providerId?: string   // filter by provider
  model?:      string   // filter by model
  failedOnly?: boolean  // only rows where success = false
}

export async function readGatewayLogs(opts: LogsQueryOptions = {}): Promise<GatewayLogRow[]> {
  const limit  = Math.min(opts.limit ?? 100, 500)
  const params: unknown[] = []
  const where:  string[]  = []

  if (opts.since) {
    params.push(opts.since)
    where.push(`ts_ms > $${params.length}`)
  }
  if (opts.providerId) {
    params.push(opts.providerId)
    where.push(`provider_id = $${params.length}`)
  }
  if (opts.model) {
    params.push(opts.model)
    where.push(`model = $${params.length}`)
  }
  if (opts.failedOnly) {
    where.push(`success = FALSE`)
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : ""
  params.push(limit)

  const SQL = `
    SELECT id, model, provider_id, provider_name, success, status_code,
           latency_ms, error_message, streaming, fallback_used, attempt_count,
           prompt_tokens, completion_tokens, ts_ms,
           created_at::text AS created_at
    FROM gateway_logs
    ${whereClause}
    ORDER BY ts_ms DESC
    LIMIT $${params.length}
  `

  const client = await pool.connect()
  try {
    const { rows } = await client.query(SQL, params)
    return rows.map((r) => ({
      id:               r.id,
      model:            r.model,
      providerId:       r.provider_id,
      providerName:     r.provider_name,
      success:          r.success,
      statusCode:       r.status_code,
      latencyMs:        r.latency_ms,
      errorMessage:     r.error_message,
      streaming:        r.streaming,
      fallbackUsed:     r.fallback_used,
      attemptCount:     r.attempt_count,
      promptTokens:     r.prompt_tokens,
      completionTokens: r.completion_tokens,
      tsMs:             Number(r.ts_ms),
      createdAt:        r.created_at,
    }))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("does not exist")) {
      await ensureTable()
      return []
    }
    return []
  } finally {
    client.release()
  }
}

// ── Analytics summary ─────────────────────────────────────────────────────────

export interface LogsSummary {
  total:         number
  successCount:  number
  failCount:     number
  avgLatencyMs:  number
  p95LatencyMs:  number
  topModels:     Array<{ model: string; count: number }>
  topProviders:  Array<{ providerId: string; count: number; avgLatencyMs: number }>
  rps:           number   // requests per minute over last 60 s
}

export async function getLogsSummary(windowMs = 3_600_000): Promise<LogsSummary> {
  const since = Date.now() - windowMs
  const client = await pool.connect()
  try {
    const { rows } = await client.query(
      `SELECT
        COUNT(*)::int                                         AS total,
        SUM(CASE WHEN success THEN 1 ELSE 0 END)::int        AS success_count,
        SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::int    AS fail_count,
        ROUND(AVG(latency_ms))::int                          AS avg_latency_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::int AS p95_latency_ms
       FROM gateway_logs
       WHERE ts_ms > $1`,
      [since],
    )
    const base = rows[0] ?? {}

    const { rows: modelRows } = await client.query(
      `SELECT model, COUNT(*)::int AS count
       FROM gateway_logs WHERE ts_ms > $1
       GROUP BY model ORDER BY count DESC LIMIT 5`,
      [since],
    )

    const { rows: provRows } = await client.query(
      `SELECT provider_id, COUNT(*)::int AS count,
              ROUND(AVG(latency_ms))::int AS avg_latency_ms
       FROM gateway_logs WHERE ts_ms > $1
       GROUP BY provider_id ORDER BY count DESC LIMIT 10`,
      [since],
    )

    // rps over last 60 s
    const since60 = Date.now() - 60_000
    const { rows: rpsRows } = await client.query(
      `SELECT COUNT(*)::int AS count FROM gateway_logs WHERE ts_ms > $1`,
      [since60],
    )

    return {
      total:        base.total ?? 0,
      successCount: base.success_count ?? 0,
      failCount:    base.fail_count ?? 0,
      avgLatencyMs: base.avg_latency_ms ?? 0,
      p95LatencyMs: base.p95_latency_ms ?? 0,
      topModels:    modelRows.map((r) => ({ model: r.model, count: r.count })),
      topProviders: provRows.map((r) => ({ providerId: r.provider_id, count: r.count, avgLatencyMs: r.avg_latency_ms })),
      rps:          rpsRows[0]?.count ?? 0,
    }
  } catch {
    return { total: 0, successCount: 0, failCount: 0, avgLatencyMs: 0, p95LatencyMs: 0, topModels: [], topProviders: [], rps: 0 }
  } finally {
    client.release()
  }
}
