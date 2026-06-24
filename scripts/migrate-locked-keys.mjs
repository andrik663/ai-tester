// Run: node --env-file-if-exists=/vercel/share/.env.project scripts/migrate-locked-keys.mjs
import pg from "pg"

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const sql = `
  -- locked_working_keys
  CREATE TABLE IF NOT EXISTS locked_working_keys (
    id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    provider_id           TEXT NOT NULL,
    provider_name         TEXT NOT NULL,
    model_id              TEXT NOT NULL,
    api_key_encrypted     TEXT NOT NULL,
    api_key_masked        TEXT NOT NULL,
    is_working            BOOLEAN NOT NULL DEFAULT true,
    latency_ms            INTEGER,
    last_tested_at        TIMESTAMPTZ DEFAULT now(),
    locked_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_refresh_at       TIMESTAMPTZ NOT NULL,
    refresh_interval_hours INTEGER NOT NULL DEFAULT 24,
    last_error            TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_locked_keys_provider
    ON locked_working_keys (provider_id);
  CREATE INDEX IF NOT EXISTS idx_locked_keys_next_refresh
    ON locked_working_keys (next_refresh_at);
  CREATE INDEX IF NOT EXISTS idx_locked_keys_working
    ON locked_working_keys (is_working);

  -- locked_key_refresh_log
  CREATE TABLE IF NOT EXISTS locked_key_refresh_log (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    locked_key_id  TEXT NOT NULL REFERENCES locked_working_keys(id) ON DELETE CASCADE,
    tested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    was_working    BOOLEAN NOT NULL,
    latency_ms     INTEGER,
    error_message  TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_refresh_log_locked_key_id
    ON locked_key_refresh_log (locked_key_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_log_tested_at
    ON locked_key_refresh_log (tested_at);
`

try {
  await pool.query(sql)
  console.log("Migration complete: locked_working_keys + locked_key_refresh_log created.")
} catch (e) {
  console.error("Migration failed:", e.message)
  process.exit(1)
} finally {
  await pool.end()
}
