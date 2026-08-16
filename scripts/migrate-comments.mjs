/**
 * scripts/migrate-comments.mjs
 * Creates the comments table if it does not exist.
 *
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/migrate-comments.mjs
 */

import pg from "pg"

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const SQL = `
CREATE TABLE IF NOT EXISTS comments (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL DEFAULT 'Anonim',
  message     TEXT        NOT NULL,
  avatar_seed TEXT        NOT NULL,
  ts_ms       BIGINT      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast "latest first" ticker queries
CREATE INDEX IF NOT EXISTS comments_ts_ms_idx ON comments (ts_ms DESC);
`

const client = await pool.connect()
try {
  await client.query(SQL)
  console.log("comments table created / already exists.")
} finally {
  client.release()
  await pool.end()
}
