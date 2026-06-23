import crypto from "crypto"

const API_KEY_PREFIX = "atk_" // AI Tester Key
const API_KEY_LENGTH = 32

/**
 * Generate a new API key pair: (raw key for display, hash for storage)
 */
export function generateApiKey(): { rawKey: string; keyHash: string } {
  const rawKey = API_KEY_PREFIX + crypto.randomBytes(API_KEY_LENGTH).toString("hex")
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")

  return { rawKey, keyHash }
}

/**
 * Hash an API key for comparison
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex")
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX) && key.length === API_KEY_PREFIX.length + API_KEY_LENGTH * 2
}

/**
 * Mask API key for display (show only last 8 chars)
 */
export function maskApiKey(key: string): string {
  if (!isValidApiKeyFormat(key)) return "invalid"
  return key.slice(0, API_KEY_PREFIX.length + 4) + "..." + key.slice(-8)
}

/**
 * Generate webhook signature for security verification
 */
export function generateWebhookSignature(
  payload: string,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = generateWebhookSignature(payload, secret)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Extract API key from Authorization header
 */
export function extractApiKey(authHeader?: string): string | null {
  if (!authHeader) return null

  const parts = authHeader.split(" ")
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null
  }

  const key = parts[1]
  return isValidApiKeyFormat(key) ? key : null
}
