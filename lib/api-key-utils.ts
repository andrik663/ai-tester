/**
 * lib/api-key-utils.ts — Cryptographic helpers for the AI Tester API key system.
 *
 * All keys follow the format:  `atk_<64-hex-chars>`
 *   - Prefix `atk_` makes keys identifiable in logs and prevents accidental use
 *     of other credential types.
 *   - 32 random bytes encoded as 64 hex characters gives 256 bits of entropy.
 *
 * Keys are NEVER stored in plain text. Only SHA-256 hashes are written to the
 * database. The raw key is shown to the user exactly once at creation time.
 */
import crypto from "crypto"

/** Prefix that identifies AI Tester API keys in logs and headers. */
const API_KEY_PREFIX = "atk_"

/** Number of random bytes in the key body (produces 64 hex chars). */
const API_KEY_LENGTH = 32

/**
 * Generate a new API key pair.
 *
 * Produces `API_KEY_LENGTH` cryptographically-random bytes, hex-encodes them,
 * prepends the `atk_` prefix to form the raw key, then SHA-256-hashes the raw
 * key to produce the storage hash.
 *
 * @returns `{ rawKey, keyHash }` — show `rawKey` to the user once, store only
 *   `keyHash` in the database.
 *
 * @example
 * const { rawKey, keyHash } = generateApiKey()
 * await db.insert(apiKeys).values({ keyHash, name, createdBy })
 */
export function generateApiKey(): { rawKey: string; keyHash: string } {
  const rawKey = API_KEY_PREFIX + crypto.randomBytes(API_KEY_LENGTH).toString("hex")
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")
  return { rawKey, keyHash }
}

/**
 * Compute the SHA-256 hash of an API key for database lookup.
 *
 * Call this on every inbound request to convert the Bearer token into the
 * hash used as the primary lookup value in the `api_keys` table.
 *
 * @param key - Raw API key string (including `atk_` prefix).
 * @returns Lowercase hex SHA-256 digest (64 chars).
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex")
}

/**
 * Return `true` if `key` matches the expected `atk_<64-hex>` format.
 *
 * Use before hashing to avoid unnecessary database queries for clearly
 * invalid inputs (e.g. wrong prefix, truncated keys).
 *
 * @param key - Candidate key string to validate.
 * @returns `true` if the key format is valid.
 */
export function isValidApiKeyFormat(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX) && key.length === API_KEY_PREFIX.length + API_KEY_LENGTH * 2
}

/**
 * Mask an API key for safe display in the UI.
 *
 * Shows the prefix plus the first 4 hex chars and the last 8 hex chars,
 * replacing the middle with `...`. Invalid keys return `"invalid"`.
 *
 * @param key - Raw API key (must pass `isValidApiKeyFormat`).
 * @returns Masked string, e.g. `"atk_dead...cafebabe"`.
 *
 * @example
 * maskApiKey("atk_deadbeef...cafebabe")
 * // → "atk_dead...cafebabe"
 */
export function maskApiKey(key: string): string {
  if (!isValidApiKeyFormat(key)) return "invalid"
  return key.slice(0, API_KEY_PREFIX.length + 4) + "..." + key.slice(-8)
}

/**
 * Compute an HMAC-SHA-256 signature for a webhook payload.
 *
 * The signature is returned as a lowercase hex string and should be sent
 * in a custom header (e.g. `X-Signature-256`) alongside the raw payload body.
 *
 * @param payload - Raw request body string to sign.
 * @param secret  - Shared webhook secret known only to server and recipient.
 * @returns Lowercase hex HMAC-SHA-256 digest.
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
}

/**
 * Verify an inbound webhook signature in constant time.
 *
 * Uses `crypto.timingSafeEqual` to prevent timing-oracle attacks. Returns
 * `false` if the signature lengths differ (avoids the `timingSafeEqual`
 * length assertion that would throw instead of returning false).
 *
 * @param payload   - Raw request body string that was signed.
 * @param signature - Hex signature from the inbound `X-Signature-256` header.
 * @param secret    - Shared webhook secret used during signing.
 * @returns `true` if the signature is valid.
 */
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = generateWebhookSignature(payload, secret)
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

/**
 * Extract a raw API key from a `Bearer` Authorization header.
 *
 * Validates that the header has the format `Bearer atk_<hex>` and that the
 * extracted key passes `isValidApiKeyFormat`. Returns `null` for anything
 * malformed so callers can return a 401 immediately.
 *
 * @param authHeader - Value of the `Authorization` HTTP header, or `undefined`.
 * @returns The raw API key string, or `null` if missing / malformed / invalid format.
 *
 * @example
 * const key = extractApiKey(req.headers.get("authorization"))
 * if (!key) return new Response("Unauthorized", { status: 401 })
 */
export function extractApiKey(authHeader?: string): string | null {
  if (!authHeader) return null
  const parts = authHeader.split(" ")
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null
  const key = parts[1]
  return isValidApiKeyFormat(key) ? key : null
}
