// Edge-compatible auth helpers — uses only Web Crypto (crypto.subtle) and
// btoa/atob, NO Node.js-only APIs (no Buffer, no require('crypto')).

export const COOKIE_NAME = "dev_session"

// ── internal helpers ──────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return arr
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** base64url encode without Buffer */
function toBase64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/** base64url decode without Buffer */
function fromBase64url(b64: string): string {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/")
  const pad = (4 - (padded.length % 4)) % 4
  return decodeURIComponent(escape(atob(padded + "=".repeat(pad))))
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await importKey(secret)
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  return bytesToHex(new Uint8Array(sig))
}

// ── public API ────────────────────────────────────────────────────────────────

/** Build a signed session token — call from Node.js login route. */
export async function makeToken(secret: string): Promise<string> {
  const payload = `dev:${Date.now()}`
  const sig = await signPayload(payload, secret)
  return toBase64url(`${payload}.${sig}`)
}

/**
 * Verify a dev_session cookie.
 * Works in Edge Runtime and Node.js (uses crypto.subtle only).
 */
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
    const sigBytes = hexToBytes(sigHex)
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(payload)
    )
    if (!valid) return false

    // Verify age (24h)
    const ts = parseInt(payload.split(":")[1] ?? "0", 10)
    if (Date.now() - ts > 1000 * 60 * 60 * 24) return false

    return true
  } catch {
    return false
  }
}
