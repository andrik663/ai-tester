/**
 * lib/gateway-cache.ts
 *
 * Persistent gateway key store backed by Neon (PostgreSQL).
 * An in-process memory cache is layered on top to avoid hitting the DB
 * on every request — cache TTL is 30 seconds.
 *
 * Security model:
 *   - Raw API keys are stored encrypted-at-rest by Neon's managed infra.
 *   - Keys are NEVER logged, NEVER returned to external callers.
 *   - Only /api/v1/chat/completions reads the raw keys server-side.
 *   - OWNER ISOLATION: every synced provider key belongs to exactly one
 *     owner (gateway_keys.owner_user_id). An msk_ caller only ever sees
 *     rows owned by their own user_id, so one msk_ user can never spend
 *     another user's synced provider key, and a scoped prune can never
 *     delete another user's rows. Rows with owner_user_id NULL are the
 *     legacy/admin pool: they are served to admin and atk_ callers only,
 *     never to an msk_ user. The in-memory cache is keyed per scope for
 *     the same reason — a shared cache entry would leak across owners.
 */

import { pool, db } from "@/lib/db"
import { gatewayKeys as gatewayKeysTable } from "@/lib/db/gateway-schema"
import { and, eq, isNull, notInArray } from "drizzle-orm"


export interface GatewayKey {
  providerId: string
  providerName: string
  /** Raw (unmasked) API key — server-side only, never returned to clients */
  apiKey: string
  modelIds: string[]
  avgLatencyMs: number
  pushedAt: number
  /** msaku.id user_id that synced this key, or null for the legacy/admin pool */
  ownerUserId: number | null
}

export interface GatewayStore {
  keys: GatewayKey[]
  lastPushedAt: number
  pushCount: number
}

/**
 * Which slice of gateway_keys a caller may see.
 * - number: an msk_ user — only rows owned by that user_id.
 * - null: the legacy/admin pool — only rows with owner_user_id IS NULL.
 * - "all": admin — every row (operator maintenance only; routes must
 *   never pass "all" for an ordinary msk_/atk_ caller).
 */
export type GatewayKeyScope = number | "all" | null

/** Derive the read scope from an authenticated gateway request result. */
export function scopeForAuth(auth: { tier?: string; userId?: number }): GatewayKeyScope {
  if (auth.tier === "msaku_user" && typeof auth.userId === "number" && auth.userId > 0) {
    return auth.userId
  }
  if (auth.tier === "admin") {
    return "all"
  }
  // atk_ callers (and anything else authenticated without a user_id) may
  // only use the legacy pool — never another msk_ user's private rows.
  return null
}

function scopeKey(scope: GatewayKeyScope): string {
  return scope === "all" ? "all" : scope === null ? "legacy" : `msk:${scope}`
}

// ── In-memory cache layer (avoids DB round-trip on every chat request) ────────
// Per-scope entries: a single shared entry would hand one owner's keys to
// another owner on the next request within the TTL window.
interface CacheEntry {
  store: GatewayStore
  at: number
}
const memCaches = new Map<string, CacheEntry>()
const MEM_TTL_MS = 30_000 // 30 seconds

// Round-robin index per (scope, providerId) for key rotation
const rrIndex = new Map<string, number>()

function bustCache(): void {
  memCaches.clear()
  rrIndex.clear()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/** Internal token used by the gateway cache / server-side helpers. */
export const DEFAULT_GATEWAY_TOKEN = "msaku_gw_internal_2026"

/**
 * Validate a gateway Bearer credential (sync path, internal/admin only).
 * Personal msk_... keys are verified asynchronously in lib/gateway-auth.ts.
 */
export function validateGatewayToken(token: string): boolean {
  const trimmed = token.trim()
  return safeCompare(trimmed, DEFAULT_GATEWAY_TOKEN)
}

export function getInternalToken(): string {
  return DEFAULT_GATEWAY_TOKEN
}

// ── DB helpers ────────────────────────────────────────────────────────────────

/** Drizzle WHERE clause for a scope, or undefined for the admin "all" scope. */
function scopeWhere(scope: GatewayKeyScope) {
  if (scope === "all") return undefined
  if (scope === null) return isNull(gatewayKeysTable.ownerUserId)
  return eq(gatewayKeysTable.ownerUserId, scope)
}

// ── Lazy owner-column migration ─────────────────────────────────────────────
// Same pattern as lib/gateway-logs.ts ensureTable(): the first gateway
// read/write in a process adds the owner column + indexes if they are not
// there yet, so deploying this code is enough — no manual migration run
// is required. scripts/migrate-gateway-owner.mjs does the same thing
// standalone for operators who prefer to run it explicitly. If the DDL
// fails (e.g. DB unreachable), reads below still fail closed via their
// catch blocks instead of falling back to the global pool.
let ownerColumnEnsured = false
async function ensureOwnerColumn(): Promise<void> {
  if (ownerColumnEnsured) return
  ownerColumnEnsured = true
  try {
    const client = await pool.connect()
    try {
      await client.query(`ALTER TABLE gateway_keys ADD COLUMN IF NOT EXISTS owner_user_id INTEGER`)
      await client.query(`CREATE INDEX IF NOT EXISTS gateway_keys_owner_idx ON gateway_keys (owner_user_id)`)
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS gateway_keys_provider_key_owner_unique ON gateway_keys (provider_id, api_key, owner_user_id)`,
      )
    } finally {
      client.release()
    }
  } catch {
    // Swallowed on purpose: dbLoadKeys/dbLoadKeyCount fail closed, and
    // upsert/prune surface a 500 from the push route instead of leaking.
  }
}

export async function dbLoadKeyCount(scope: GatewayKeyScope = null): Promise<number> {
  await ensureOwnerColumn()
  try {
    const where = scopeWhere(scope)
    const query = db.select({ id: gatewayKeysTable.id }).from(gatewayKeysTable)
    const rows = where ? await query.where(where) : await query
    return rows.length
  } catch {
    return 0
  }
}

async function dbLoadKeys(scope: GatewayKeyScope): Promise<GatewayKey[]> {
  await ensureOwnerColumn()
  try {
    const where = scopeWhere(scope)
    const base = db
      .select({
        providerId: gatewayKeysTable.providerId,
        providerName: gatewayKeysTable.providerName,
        apiKey: gatewayKeysTable.apiKey,
        modelIds: gatewayKeysTable.modelIds,
        avgLatencyMs: gatewayKeysTable.avgLatencyMs,
        pushedAt: gatewayKeysTable.pushedAt,
        ownerUserId: gatewayKeysTable.ownerUserId,
      })
      .from(gatewayKeysTable)
    const rows = where ? await base.where(where) : await base
    // Sorted in memory: the conditional where makes a typed orderBy chain
    // awkward here, and these row counts are small.
    rows.sort((a, b) => (a.avgLatencyMs ?? 0) - (b.avgLatencyMs ?? 0))
    return rows.map((r) => ({
      providerId: r.providerId,
      providerName: r.providerName,
      apiKey: r.apiKey,
      modelIds: r.modelIds ?? [],
      avgLatencyMs: r.avgLatencyMs,
      pushedAt: Number(r.pushedAt),
      ownerUserId: r.ownerUserId ?? null,
    }))
  } catch {
    // Fail closed: if the owner_user_id column does not exist yet (the
    // migration has not run), return no keys rather than the global pool.
    return []
  }
}

/**
 * Convert a JS string[] to the PostgreSQL wire format for text[]:
 *   ["a","b"] → '{"a","b"}'
 * The pg driver accepts this string for a text[] column parameter ($N)
 * without needing ARRAY[...]::text[] literals or sql.raw(), which fail
 * when mixed with positional params on the Neon serverless driver.
 */
function toPgArray(arr: string[]): string {
  const escaped = arr.map((s) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
  return `{${escaped.join(",")}}`
}

/**
 * UPSERT one key at a time using pool.query() with native pg parameter
 * binding. model_ids is passed as a single $4 parameter in pg-array wire
 * format ("{m1,m2,...}") — no ARRAY[] literals, no sql.raw(), no Drizzle
 * template expansion. This is the only approach that works reliably on both
 * local pg and the Neon serverless driver.
 */
export async function upsertGatewayKeyChunk(
  keys: GatewayKey[],
  ownerUserId: number | null = null,
): Promise<void> {
  if (keys.length === 0) return

  await ensureOwnerColumn()
  const client = await pool.connect()
  try {
    for (const k of keys) {
      // The owner comes from server-side auth (push route), never from the
      // client body: a caller can only write rows stamped with their own
      // user_id, or with NULL for the legacy/admin pool.
      const owner = k.ownerUserId ?? ownerUserId
      if (owner === null) {
        // Legacy pool: keep the original (provider_id, api_key) conflict target.
        await client.query(
          `INSERT INTO gateway_keys
             (provider_id, provider_name, api_key, model_ids, avg_latency_ms, pushed_at, owner_user_id)
           VALUES ($1, $2, $3, $4, $5, $6, NULL)
           ON CONFLICT (provider_id, api_key) DO UPDATE SET
             provider_name  = EXCLUDED.provider_name,
             model_ids      = EXCLUDED.model_ids,
             avg_latency_ms = EXCLUDED.avg_latency_ms,
             pushed_at      = EXCLUDED.pushed_at,
             updated_at     = now()`,
          [
            k.providerId,
            k.providerName,
            k.apiKey,
            toPgArray(k.modelIds),        // single string param, pg casts to text[]
            Math.round(k.avgLatencyMs),  // column is INTEGER — round float averages
            k.pushedAt,
          ],
        )
      } else {
        // Owned row: conflict target includes the owner, so the same
        // provider key synced by a second user becomes a second row owned
        // by that user instead of overwriting (stealing) the first row.
        await client.query(
          `INSERT INTO gateway_keys
             (provider_id, provider_name, api_key, model_ids, avg_latency_ms, pushed_at, owner_user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (provider_id, api_key, owner_user_id) DO UPDATE SET
             provider_name  = EXCLUDED.provider_name,
             model_ids      = EXCLUDED.model_ids,
             avg_latency_ms = EXCLUDED.avg_latency_ms,
             pushed_at      = EXCLUDED.pushed_at,
             updated_at     = now()`,
          [
            k.providerId,
            k.providerName,
            k.apiKey,
            toPgArray(k.modelIds),
            Math.round(k.avgLatencyMs),
            k.pushedAt,
            owner,
          ],
        )
      }
    }
  } finally {
    client.release()
  }

  // Bust the in-memory cache so the next read picks up fresh DB state.
  bustCache()
}

/**
 * After all chunks are sent, delete rows whose api_key is NOT in the
 * current full set — this removes keys that were revoked or re-tested away.
 */
export async function pruneStaleGatewayKeys(
  currentApiKeys: string[],
  scope: GatewayKeyScope,
): Promise<number> {
  // Scoped prune: this is the fix for "one user's sync deleted another
  // user's keys". Only rows in the caller's own scope are ever deleted.
  // The admin "all" scope is the only one that may prune globally, and
  // routes must never pass it for an ordinary caller.
  await ensureOwnerColumn()
  const scopeClause = scopeWhere(scope)
  const where =
    currentApiKeys.length === 0
      ? scopeClause
      : scopeClause
        ? and(scopeClause, notInArray(gatewayKeysTable.apiKey, currentApiKeys))
        : notInArray(gatewayKeysTable.apiKey, currentApiKeys)
  const deleted = where
    ? await db.delete(gatewayKeysTable).where(where).returning({ id: gatewayKeysTable.id })
    : await db.delete(gatewayKeysTable).returning({ id: gatewayKeysTable.id })
  bustCache()
  return deleted.length
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Load keys for one scope — from that scope's cache if fresh, else from DB */
async function getStore(scope: GatewayKeyScope): Promise<GatewayStore> {
  const key = scopeKey(scope)
  const now = Date.now()
  const cached = memCaches.get(key)
  if (cached && now - cached.at < MEM_TTL_MS) {
    return cached.store
  }
  const keys = await dbLoadKeys(scope)
  const store: GatewayStore = {
    keys,
    lastPushedAt: keys.length > 0 ? Math.max(...keys.map((k) => k.pushedAt)) : 0,
    pushCount: 0,
  }
  memCaches.set(key, { store, at: now })
  return store
}

/**
 * Replace all keys atomically (single-call path, used by legacy callers).
 * For large key sets prefer the chunked path: upsertGatewayKeyChunk + pruneStaleGatewayKeys.
 * The ownerUserId stamps the replacement rows; pass null only for the
 * legacy/admin pool — never for an msk_ user's keys.
 */
export async function setGatewayKeys(
  _token: string,
  keys: GatewayKey[],
  ownerUserId: number | null = null,
): Promise<void> {
  await upsertGatewayKeyChunk(keys, ownerUserId)
  const currentApiKeys = keys.map((k) => k.apiKey)
  await pruneStaleGatewayKeys(currentApiKeys, ownerUserId)
  bustCache()
}

/** Synchronous wrapper used by routes that already have keys loaded */
export function setGatewayKeysSync(
  _token: string,
  keys: GatewayKey[],
  ownerUserId: number | null = null,
): void {
  // Fire-and-forget; bust cache immediately
  upsertGatewayKeyChunk(keys, ownerUserId)
    .then(() => pruneStaleGatewayKeys(keys.map((k) => k.apiKey), ownerUserId))
    .catch(() => { /* ignore — cache already busted */ })
  bustCache()
}

export async function getGatewayStore(
  _token: string,
  scope: GatewayKeyScope = null,
): Promise<GatewayStore | null> {
  const store = await getStore(scope)
  return store.keys.length > 0 ? store : null
}

export async function pickKey(
  _token: string,
  providerId: string,
  scope: GatewayKeyScope = null,
): Promise<GatewayKey | null> {
  const store = await getStore(scope)
  const candidates = store.keys.filter((k) => k.providerId === providerId)
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)
  const rrKey = `${scopeKey(scope)}:${providerId}`
  const idx = rrIndex.get(rrKey) ?? 0
  const key = candidates[idx % candidates.length]
  rrIndex.set(rrKey, idx + 1)
  return key
}

export async function pickAnyKey(
  _token: string,
  modelId: string,
  scope: GatewayKeyScope = null,
): Promise<GatewayKey | null> {
  // msaku/auto & miuclaw/auto are permanently deleted — reject at resolution
  if (modelId === "msaku/auto" || modelId === "miuclaw/auto") return null
  const store = await getStore(scope)
  const candidates = store.keys.filter((k) => k.modelIds.includes(modelId))
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)
  return candidates[0]
}

export async function getAllModels(
  _token: string,
  scope: GatewayKeyScope = null,
): Promise<Array<{ id: string; providerId: string; providerName: string }>> {
  const store = await getStore(scope)
  const seen = new Set<string>()
  const result: Array<{ id: string; providerId: string; providerName: string }> = []
  const sorted = [...store.keys].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)
  for (const key of sorted) {
    for (const modelId of key.modelIds) {
      // msaku/auto & miuclaw/auto are permanently deleted — never resurface
      if (modelId === "msaku/auto" || modelId === "miuclaw/auto") continue
      if (!seen.has(modelId)) {
        seen.add(modelId)
        result.push({ id: modelId, providerId: key.providerId, providerName: key.providerName })
      }
    }
  }
  return result
}

export async function getGatewayStats(_token: string, scope: GatewayKeyScope = null) {
  const store = await getStore(scope)
  if (store.keys.length === 0) return null
  const providerCounts = new Map<string, number>()
  const providerDetails = new Map<
    string,
    { providerId: string; providerName: string; keyCount: number; models: Set<string>; latencies: number[] }
  >()
  let totalModels = 0
  let latencySum = 0
  for (const key of store.keys) {
    providerCounts.set(key.providerId, (providerCounts.get(key.providerId) ?? 0) + 1)
    totalModels += key.modelIds.length
    latencySum += key.avgLatencyMs || 0
    const existing = providerDetails.get(key.providerId)
    if (existing) {
      existing.keyCount += 1
      for (const m of key.modelIds) existing.models.add(m)
      if (key.avgLatencyMs > 0) existing.latencies.push(key.avgLatencyMs)
    } else {
      providerDetails.set(key.providerId, {
        providerId: key.providerId,
        providerName: key.providerName || key.providerId,
        keyCount: 1,
        models: new Set(key.modelIds),
        latencies: key.avgLatencyMs > 0 ? [key.avgLatencyMs] : [],
      })
    }
  }
  const providerNodes = Array.from(providerDetails.values()).map((p) => ({
    providerId: p.providerId,
    providerName: p.providerName,
    keyCount: p.keyCount,
    modelCount: p.models.size,
    avgLatencyMs:
      p.latencies.length > 0
        ? Math.round(p.latencies.reduce((a, b) => a + b, 0) / p.latencies.length)
        : 0,
  }))
  return {
    totalKeys: store.keys.length,
    totalModels,
    avgLatencyMs: store.keys.length > 0 ? Math.round(latencySum / store.keys.length) : 0,
    providers: Object.fromEntries(providerCounts),
    providerNodes,
    lastPushedAt: store.lastPushedAt,
    pushCount: store.pushCount,
  }
}
