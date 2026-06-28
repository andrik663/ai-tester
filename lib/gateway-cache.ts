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
 */

import { pool, db } from "@/lib/db"
import { gatewayKeys as gatewayKeysTable } from "@/lib/db/gateway-schema"

export interface GatewayKey {
  providerId: string
  providerName: string
  /** Raw (unmasked) API key — server-side only, never returned to clients */
  apiKey: string
  modelIds: string[]
  avgLatencyMs: number
  pushedAt: number
}

export interface GatewayStore {
  keys: GatewayKey[]
  lastPushedAt: number
  pushCount: number
}

// ── In-memory cache layer (avoids DB round-trip on every chat request) ────────
let memCache: GatewayStore | null = null
let memCacheAt = 0
const MEM_TTL_MS = 30_000 // 30 seconds

// Round-robin index per providerId for key rotation
const rrIndex = new Map<string, number>()

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripQuotes(s: string): string {
  const t = s.trim()
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1)
  }
  return t
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export function validateGatewayToken(token: string): boolean {
  const raw = process.env.EXPORT_API_TOKEN
  if (!raw) return false
  return safeCompare(token.trim(), stripQuotes(raw))
}

export function getInternalToken(): string | null {
  const raw = process.env.EXPORT_API_TOKEN
  if (!raw) return null
  return stripQuotes(raw)
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function dbLoadKeys(): Promise<GatewayKey[]> {
  try {
    const rows = await db
      .select({
        providerId: gatewayKeysTable.providerId,
        providerName: gatewayKeysTable.providerName,
        apiKey: gatewayKeysTable.apiKey,
        modelIds: gatewayKeysTable.modelIds,
        avgLatencyMs: gatewayKeysTable.avgLatencyMs,
        pushedAt: gatewayKeysTable.pushedAt,
      })
      .from(gatewayKeysTable)
      .orderBy(gatewayKeysTable.avgLatencyMs)
    return rows.map((r) => ({
      providerId: r.providerId,
      providerName: r.providerName,
      apiKey: r.apiKey,
      modelIds: r.modelIds ?? [],
      avgLatencyMs: r.avgLatencyMs,
      pushedAt: Number(r.pushedAt),
    }))
  } catch {
    return []
  }
}

async function dbSaveKeys(keys: GatewayKey[]): Promise<void> {
  // Use a raw client transaction for the DELETE, then Drizzle for INSERT so
  // that text[] arrays are serialised correctly by drizzle-orm/pg-core.
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("DELETE FROM gateway_keys")
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }

  if (keys.length === 0) return

  // Drizzle handles text[] serialisation properly — avoids the pg driver bug
  // where passing a JS array as a positional parameter inserts a plain string
  // instead of a properly-typed PostgreSQL array.
  await db.insert(gatewayKeysTable).values(
    keys.map((k) => ({
      providerId: k.providerId,
      providerName: k.providerName,
      apiKey: k.apiKey,
      modelIds: k.modelIds,
      avgLatencyMs: k.avgLatencyMs,
      pushedAt: k.pushedAt,
    })),
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Load keys — from memory cache if fresh, otherwise from DB */
async function getStore(): Promise<GatewayStore> {
  const now = Date.now()
  if (memCache && now - memCacheAt < MEM_TTL_MS) {
    return memCache
  }
  const keys = await dbLoadKeys()
  const store: GatewayStore = {
    keys,
    lastPushedAt: keys.length > 0 ? Math.max(...keys.map((k) => k.pushedAt)) : 0,
    pushCount: 0,
  }
  memCache = store
  memCacheAt = now
  return store
}

/** Upsert all keys — writes to DB and updates memory cache immediately */
export async function setGatewayKeys(_token: string, keys: GatewayKey[]): Promise<void> {
  await dbSaveKeys(keys)
  memCache = {
    keys,
    lastPushedAt: Date.now(),
    pushCount: (memCache?.pushCount ?? 0) + 1,
  }
  memCacheAt = Date.now()
  rrIndex.clear()
}

/** Synchronous wrapper used by routes that already have keys loaded */
export function setGatewayKeysSync(_token: string, keys: GatewayKey[]): void {
  // Fire-and-forget DB write; update memory immediately
  dbSaveKeys(keys).catch(() => {/* ignore — mem cache is still updated */})
  memCache = {
    keys,
    lastPushedAt: Date.now(),
    pushCount: (memCache?.pushCount ?? 0) + 1,
  }
  memCacheAt = Date.now()
  rrIndex.clear()
}

export async function getGatewayStore(_token: string): Promise<GatewayStore | null> {
  const store = await getStore()
  return store.keys.length > 0 ? store : null
}

export async function pickKey(_token: string, providerId: string): Promise<GatewayKey | null> {
  const store = await getStore()
  const candidates = store.keys.filter((k) => k.providerId === providerId)
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)
  const idx = rrIndex.get(providerId) ?? 0
  const key = candidates[idx % candidates.length]
  rrIndex.set(providerId, idx + 1)
  return key
}

export async function pickAnyKey(_token: string, modelId: string): Promise<GatewayKey | null> {
  const store = await getStore()
  const candidates = store.keys.filter((k) => k.modelIds.includes(modelId))
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)
  return candidates[0]
}

export async function getAllModels(_token: string): Promise<Array<{ id: string; providerId: string; providerName: string }>> {
  const store = await getStore()
  const seen = new Set<string>()
  const result: Array<{ id: string; providerId: string; providerName: string }> = []
  const sorted = [...store.keys].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)
  for (const key of sorted) {
    for (const modelId of key.modelIds) {
      if (!seen.has(modelId)) {
        seen.add(modelId)
        result.push({ id: modelId, providerId: key.providerId, providerName: key.providerName })
      }
    }
  }
  return result
}

export async function getGatewayStats(_token: string) {
  const store = await getStore()
  if (store.keys.length === 0) return null
  const providerCounts = new Map<string, number>()
  let totalModels = 0
  for (const key of store.keys) {
    providerCounts.set(key.providerId, (providerCounts.get(key.providerId) ?? 0) + 1)
    totalModels += key.modelIds.length
  }
  return {
    totalKeys: store.keys.length,
    totalModels,
    providers: Object.fromEntries(providerCounts),
    lastPushedAt: store.lastPushedAt,
    pushCount: store.pushCount,
  }
}
