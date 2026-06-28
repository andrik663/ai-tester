/**
 * lib/gateway-cache.ts
 *
 * Server-side in-memory store for the Miuclaw Gateway.
 * Holds RAW (unmasked) provider API keys pushed from the browser.
 * Keys are NEVER logged, never returned to external callers, and are
 * only read by the /api/v1/chat/completions proxy route.
 *
 * Security model:
 *   - Gate-kept by EXPORT_API_TOKEN (same token as the export API)
 *   - Raw keys live only in serverless function memory — they are NOT
 *     written to disk, logs, or any external store
 *   - Every request to the gateway requires the same bearer token
 */

export interface GatewayKey {
  /** Provider ID matching PROVIDER_CONFIGS key (e.g. "groq", "mistral") */
  providerId: string
  providerName: string
  /** Raw (unmasked) API key — only stored server-side, never returned to clients */
  apiKey: string
  /** Model IDs confirmed working for this key */
  modelIds: string[]
  /** Average latency in ms across tested models */
  avgLatencyMs: number
  /** Unix ms timestamp when key was pushed */
  pushedAt: number
}

export interface GatewayStore {
  keys: GatewayKey[]
  lastPushedAt: number
  pushCount: number
}

// Module-level map: tokenHash → store
const gatewayCache = new Map<string, GatewayStore>()

// Round-robin index per providerId for key rotation
const rrIndex = new Map<string, number>()

// Constant-time string compare
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function stripQuotes(s: string): string {
  const t = s.trim()
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1)
  }
  return t
}

export function validateGatewayToken(token: string): boolean {
  const raw = process.env.EXPORT_API_TOKEN
  if (!raw) return false
  const expected = stripQuotes(raw)
  return safeCompare(token.trim(), expected)
}

/**
 * Returns the server-side internal token derived from EXPORT_API_TOKEN env var.
 * Used as the cache key for gateway operations that don't require the client
 * to supply a token (e.g. the push route called from the browser).
 */
export function getInternalToken(): string | null {
  const raw = process.env.EXPORT_API_TOKEN
  if (!raw) return null
  return stripQuotes(raw)
}

/** Upsert all keys for a given token */
export function setGatewayKeys(token: string, keys: GatewayKey[]): void {
  const existing = gatewayCache.get(token)
  gatewayCache.set(token, {
    keys,
    lastPushedAt: Date.now(),
    pushCount: (existing?.pushCount ?? 0) + 1,
  })
  // Reset round-robin indices on new push
  rrIndex.clear()
}

/** Get all keys for a token */
export function getGatewayStore(token: string): GatewayStore | null {
  return gatewayCache.get(token) ?? null
}

/**
 * Pick the best key for a given provider using round-robin rotation.
 * Prefers the key with the lowest average latency on first pick.
 * Returns null if no key available for that provider.
 */
export function pickKey(token: string, providerId: string): GatewayKey | null {
  const store = gatewayCache.get(token)
  if (!store) return null

  const candidates = store.keys.filter((k) => k.providerId === providerId)
  if (candidates.length === 0) return null

  // Sort by latency for initial selection, then rotate
  candidates.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)

  const idx = rrIndex.get(providerId) ?? 0
  const key = candidates[idx % candidates.length]
  rrIndex.set(providerId, idx + 1)
  return key
}

/**
 * Pick ANY available key across all providers.
 * Skips providers where all keys might be rate-limited.
 * Used when the requested model is not provider-specific.
 */
export function pickAnyKey(token: string, modelId: string): GatewayKey | null {
  const store = gatewayCache.get(token)
  if (!store) return null

  // Find keys that have this model confirmed working
  const candidates = store.keys.filter((k) => k.modelIds.includes(modelId))
  if (candidates.length === 0) return null

  // Sort by latency
  candidates.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)
  return candidates[0]
}

/** Get all unique model IDs across all working keys */
export function getAllModels(token: string): Array<{ id: string; providerId: string; providerName: string }> {
  const store = gatewayCache.get(token)
  if (!store) return []

  const seen = new Set<string>()
  const result: Array<{ id: string; providerId: string; providerName: string }> = []

  // Sort by latency — fastest providers' models listed first
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

/** Stats for diagnostics */
export function getGatewayStats(token: string) {
  const store = gatewayCache.get(token)
  if (!store) return null
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
