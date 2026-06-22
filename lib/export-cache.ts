/**
 * Server-side in-memory cache for exported working keys.
 * Lives in the Node.js module scope — persists across requests within the same
 * serverless instance. For production use with multiple instances, replace
 * `tokenStore` with a Redis / KV store.
 */

export interface ExportedKey {
  providerId: string
  providerName: string
  /** Masked API key — never expose the raw key over the API */
  apiKeyMasked: string
  modelId: string
  latencyMs: number
  tokenUsage?: { prompt?: number; completion?: number; total?: number }
  savedAt: number // Unix ms timestamp
}

export interface TokenStore {
  keys: ExportedKey[]
  lastSyncAt: number
  syncCount: number
}

// Module-level map: token hash → store
const cache = new Map<string, TokenStore>()

// Simple constant-time string compare to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/** Mask an API key — show first 4 + last 4 chars */
export function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••"
  return key.slice(0, 4) + "••••" + key.slice(-4)
}

/**
 * Validate the bearer token against EXPORT_API_TOKEN env var.
 * Returns true if valid.
 */
export function validateToken(token: string): boolean {
  const expected = process.env.EXPORT_API_TOKEN
  if (!expected) return false
  return safeCompare(token.trim(), expected.trim())
}

/** Upsert the cache for a given token (stores masked keys only) */
export function setCacheForToken(
  token: string,
  rawKeys: Array<{
    providerId: string
    providerName: string
    apiKey: string
    modelId: string
    latencyMs: number
    tokenUsage?: { prompt?: number; completion?: number; total?: number }
    savedAt: number
  }>,
): void {
  const masked: ExportedKey[] = rawKeys.map((k) => ({
    providerId: k.providerId,
    providerName: k.providerName,
    apiKeyMasked: maskKey(k.apiKey),
    modelId: k.modelId,
    latencyMs: k.latencyMs,
    tokenUsage: k.tokenUsage,
    savedAt: k.savedAt,
  }))

  const existing = cache.get(token)
  cache.set(token, {
    keys: masked,
    lastSyncAt: Date.now(),
    syncCount: (existing?.syncCount ?? 0) + 1,
  })
}

/** Retrieve cached data for a token */
export function getCacheForToken(token: string): TokenStore | null {
  return cache.get(token) ?? null
}
