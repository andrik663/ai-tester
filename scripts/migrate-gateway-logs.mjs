/**
 * scripts/migrate-gateway-logs.mjs
 * Creates the gateway_logs table if it does not exist.
 *
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/migrate-gateway-logs.mjs
 */

import pg from "pg"

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const SQL = `
CREATE TABLE IF NOT EXISTS gateway_logs (
  id               SERIAL PRIMARY KEY,
  model            TEXT        NOT NULL,
  provider_id      TEXT        NOT NULL,
  provider_name    TEXT        NOT NULL,
  success          BOOLEAN     NOT NULL DEFAULT FALSE,
  status_code      INTEGER     NOT NULL DEFAULT 200,
  latency_ms       INTEGER     NOT NULL DEFAULT 0,
  error_message    TEXT,
  streaming        BOOLEAN     NOT NULL DEFAULT FALSE,
  fallback_used    BOOLEAN     NOT NULL DEFAULT FALSE,
  attempt_count    INTEGER     NOT NULL DEFAULT 1,
  prompt_tokens    INTEGER     NOT NULL DEFAULT 0,
  completion_tokens INTEGER    NOT NULL DEFAULT 0,
  ts_ms            BIGINT      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast tail queries (latest rows)
CREATE INDEX IF NOT EXISTS gateway_logs_ts_ms_idx ON gateway_logs (ts_ms DESC);

-- Index for analytics by provider
CREATE INDEX IF NOT EXISTS gateway_logs_provider_idx ON gateway_logs (provider_id, ts_ms DESC);
`

const client = await pool.connect()
try {
  await client.query(SQL)
  console.log("gateway_logs table created / already exists.")
} finally {
  client.release()
  await pool.end()
}
