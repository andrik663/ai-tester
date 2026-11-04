/**
 * scripts/migrate-gateway-owner.mjs
 * Adds per-owner isolation to the synced gateway key pool.
 *
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/migrate-gateway-owner.mjs
 *
 * WHAT IT DOES (all idempotent, safe to re-run):
 *   1. Adds gateway_keys.owner_user_id (INTEGER, NULL by default).
 *   2. Adds an index on owner_user_id for the scoped reads.
 *   3. Adds a unique index on (provider_id, api_key, owner_user_id) so
 *      the same provider key synced by two different msk_ users becomes
 *      two separate rows instead of one overwriting the other.
 *
 * WHAT IT DOES NOT DO:
 *   - It does NOT backfill owner_user_id. Rows synced before this change
 *     keep owner_user_id NULL, which is the legacy/admin pool: those rows
 *     are served to admin and atk_ callers only, and are NEVER served to
 *     an msk_ user. An msk_ user whose keys are still legacy must re-sync
 *     once with their msk_ key saved in the tester (the sync panel sends
 *     the stored msk_ key as Authorization) to get private owned rows.
 *
 * NOTE: running this script is OPTIONAL. The deployed code self-applies
 * the same DDL on its first gateway read/write (see ensureOwnerColumn()
 * in lib/gateway-cache.ts, same pattern as lib/gateway-logs.ts). This
 * script exists for operators who prefer to apply the migration explicitly
 * before deploying, or to verify row counts afterwards. If it has not run
 * and the code has not self-applied yet, scoped reads fail closed (no
 * keys) rather than falling back to the old global pool.
 */

import pg from "pg"

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const SQL = `
ALTER TABLE gateway_keys
  ADD COLUMN IF NOT EXISTS owner_user_id INTEGER;

CREATE INDEX IF NOT EXISTS gateway_keys_owner_idx
  ON gateway_keys (owner_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS gateway_keys_provider_key_owner_unique
  ON gateway_keys (provider_id, api_key, owner_user_id);
`

const client = await pool.connect()
try {
  await client.query(SQL)
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE owner_user_id IS NOT NULL)::int AS owned,
            COUNT(*) FILTER (WHERE owner_user_id IS NULL)::int AS legacy
     FROM gateway_keys`,
  )
  console.log(
    `gateway_keys owner column ready. total=${rows[0].total} owned=${rows[0].owned} legacy=${rows[0].legacy}`,
  )
  console.log(
    "Legacy rows (owner NULL) stay usable by admin/atk_ only; msk_ users must re-sync to get private rows.",
  )
} finally {
  client.release()
  await pool.end()
}
