// Edge-compatible auth helpers — uses only Web Crypto (crypto.subtle) and
// btoa/atob. No Node.js-only APIs (no Buffer, no require('crypto')).
// DO NOT add "use server" — this file exports constants and async functions
// used by both middleware (Edge Runtime) and API routes (Node.js).

export const COOKIE_NAME = "dev_session"
const TTL_MS = 1000 * 60 * 60 * 24 // 24 hours

// ── internal helpers ──────────────────────────────────────────────────────────

/**
 * Convert a hex-encoded string to a Uint8Array of raw bytes.
 * Used internally to parse the HMAC signature stored in the session token.
 *
 * @param hex - Lowercase hex string (e.g. "deadbeef").
 * @returns Raw byte array.
 */
function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return arr
}

/**
 * Convert a Uint8Array to a lowercase hex string.
 * Used internally to serialise the HMAC signature into the session token.
 *
 * @param bytes - Raw byte array.
 * @returns Lowercase hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Encode a UTF-8 string to URL-safe Base64 (no padding, `+` → `-`, `/` → `_`).
 * Required because cookie values must not contain `+`, `/`, or `=`.
 *
 * @param str - Plain UTF-8 string to encode.
 * @returns URL-safe Base64 string.
 */
function toBase64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/**
 * Decode a URL-safe Base64 string back to a UTF-8 string.
 * Inverse of `toBase64url`. Re-adds padding before calling `atob`.
 *
 * @param b64 - URL-safe Base64 string (no padding required).
 * @returns Decoded UTF-8 string.
 */
function fromBase64url(b64: string): string {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/")
  const pad = (4 - (padded.length % 4)) % 4
  return decodeURIComponent(escape(atob(padded + "=".repeat(pad))))
}

/**
 * Import a raw secret string as a Web Crypto `CryptoKey` for HMAC-SHA-256.
 * The resulting key can be used with `crypto.subtle.sign` and
 * `crypto.subtle.verify`. Works in both Edge Runtime and Node.js.
 *
 * @param secret - The `DEV_PASSWORD` environment variable value.
 * @returns A non-extractable `CryptoKey` configured for sign + verify.
 */
async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

// ── public API ────────────────────────────────────────────────────────────────

/** Build a signed session token. */
export async function makeToken(secret: string): Promise<string> {
  const payload = `dev:${Date.now()}`
  const key = await importKey(secret)
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  return toBase64url(`${payload}.${bytesToHex(new Uint8Array(sig))}`)
}

/** Verify a dev_session cookie value. Works in Edge Runtime and Node.js. */
export async function verifySession(cookieValue: string | undefined): Promise<boolean> {
  const secret = process.env.DEV_PASSWORD
  if (!secret || !cookieValue) return false

  try {
    const raw = fromBase64url(cookieValue)
    const lastDot = raw.lastIndexOf(".")
    if (lastDot === -1) return false

    const payload = raw.slice(0, lastDot)
    const sigHex = raw.slice(lastDot + 1)

    const key = await importKey(secret)
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      hexToBytes(sigHex),
      new TextEncoder().encode(payload),
    )
    if (!valid) return false

    const ts = parseInt(payload.split(":")[1] ?? "0", 10)
    return Date.now() - ts <= TTL_MS
  } catch {
    return false
  }
}
