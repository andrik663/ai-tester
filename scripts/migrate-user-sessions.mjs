import pg from "pg"
const { Pool } = pg

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        session_token    TEXT NOT NULL UNIQUE,
        fingerprint      TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at       TIMESTAMPTZ NOT NULL,
        ttl_minutes      INTEGER NOT NULL DEFAULT 60,
        batch_ran        BOOLEAN NOT NULL DEFAULT false,
        batch_ran_at     TIMESTAMPTZ,
        working_keys_count INTEGER DEFAULT 0,
        is_active        BOOLEAN NOT NULL DEFAULT true
      )
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token
        ON user_sessions (session_token)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at
        ON user_sessions (expires_at)
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_batch_results (
        id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        session_id    TEXT NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
        provider_id   TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        model_id      TEXT NOT NULL,
        api_key_masked TEXT NOT NULL,
        is_working    BOOLEAN NOT NULL DEFAULT true,
        latency_ms    INTEGER,
        tested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at    TIMESTAMPTZ NOT NULL
      )
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_batch_results_session_id
        ON user_batch_results (session_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_batch_results_expires_at
        ON user_batch_results (expires_at)
    `)

    await client.query("COMMIT")
    console.log("Migration complete: user_sessions + user_batch_results created.")
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("Migration failed:", err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
