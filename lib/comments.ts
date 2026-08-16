/**
 * lib/comments.ts
 *
 * Write + read helpers for the public `comments` table — feedback shown as
 * a live ticker in the header. Auto-creates the table on first write
 * (catches missing-table errors and retries once, same pattern as
 * gateway-logs.ts) so it works on a fresh Neon project with no manual
 * migration step required.
 */

import { pool } from "@/lib/db/index"

export interface CommentRow {
  id:         number
  name:       string
  message:    string
  avatarSeed: string
  tsMs:       number
  createdAt:  string
}

export const MAX_NAME_LENGTH = 24
export const MAX_MESSAGE_LENGTH = 140

// ── Auto-create DDL ───────────────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS comments (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL DEFAULT 'Anonim',
  message     TEXT        NOT NULL,
  avatar_seed TEXT        NOT NULL,
  ts_ms       BIGINT      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comments_ts_ms_idx ON comments (ts_ms DESC);
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

/** Basic server-side sanitation: trim, collapse whitespace, hard-cap length. */
function clean(input: string, maxLen: number): string {
  return input.replace(/\s+/g, " ").trim().slice(0, maxLen)
}

export async function insertComment(rawName: string, rawMessage: string): Promise<CommentRow | null> {
  const message = clean(rawMessage, MAX_MESSAGE_LENGTH)
  if (!message) return null

  const name = clean(rawName, MAX_NAME_LENGTH) || "Anonim"
  // Random seed drives a deterministic-per-comment identicon on the client
  // (e.g. DiceBear) — no account/avatar upload needed for public feedback.
  const avatarSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const tsMs = Date.now()

  const INSERT = `
    INSERT INTO comments (name, message, avatar_seed, ts_ms)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, message, avatar_seed, ts_ms, created_at::text AS created_at
  `
  const values = [name, message, avatarSeed, tsMs]

  const client = await pool.connect()
  try {
    const { rows } = await client.query(INSERT, values)
    return rowToComment(rows[0])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("does not exist")) {
      await ensureTable()
      const { rows } = await client.query(INSERT, values)
      return rowToComment(rows[0])
    }
    throw err
  } finally {
    client.release()
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function listRecentComments(limit = 20): Promise<CommentRow[]> {
  const cappedLimit = Math.min(Math.max(limit, 1), 100)
  const SQL = `
    SELECT id, name, message, avatar_seed, ts_ms, created_at::text AS created_at
    FROM comments
    ORDER BY ts_ms DESC
    LIMIT $1
  `
  const client = await pool.connect()
  try {
    const { rows } = await client.query(SQL, [cappedLimit])
    return rows.map(rowToComment)
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

function rowToComment(r: {
  id: number
  name: string
  message: string
  avatar_seed: string
  ts_ms: string | number
  created_at: string
}): CommentRow {
  return {
    id:         r.id,
    name:       r.name,
    message:    r.message,
    avatarSeed: r.avatar_seed,
    tsMs:       Number(r.ts_ms),
    createdAt:  r.created_at,
  }
}
