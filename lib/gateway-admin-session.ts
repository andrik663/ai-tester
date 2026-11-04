/**
 * lib/gateway-admin-session.ts
 *
 * Session for the admin shared-key panel (/admin/gateway-shared).
 *
 * DESIGN (why this is safe to put in front of shared-key writes):
 * - The panel login credential IS the server-only GATEWAY_SHARED_ADMIN_TOKEN
 *   (the same secret that authorises API shared pushes). Reusing it adds no
 *   privilege: a panel session can only do what an API shared push can do
 *   (mark keys shared, list shared rows, delete shared rows).
 * - The secret is NEVER embedded in client code. The login form sends it
 *   once over HTTPS to the login route, which verifies it server-side and
 *   issues a signed session cookie. Client components only ever see the
 *   cookie name, never the secret.
 * - The session token is HMAC-SHA-256 signed with the secret itself, using
 *   Web Crypto only (Edge-compatible, same pattern as lib/auth.ts).
 *   Forging a session without the secret is infeasible, and rotating the
 *   env secret instantly invalidates every outstanding session.
 * - Cookie is httpOnly (JS on the page cannot read it), SameSite=lax,
 *   Secure, 24 h TTL.
 * - If the env secret is unset, everything fails closed: no login, no
 *   panel, no shared writes through this route.
 */

export const GATEWAY_ADMIN_COOKIE = "gateway_admin_session"
const TTL_MS = 1000 * 60 * 60 * 24 // 24 hours

function toBase64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function fromBase64url(b64: string): string {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/")
  const pad = (4 - (padded.length % 4)) % 4
  return decodeURIComponent(escape(atob(padded + "=".repeat(pad))))
}

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

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

/** Build a signed session token for a verified admin login. */
export async function makeAdminToken(secret: string): Promise<string> {
  const payload = `gwadmin:${Date.now()}`
  const key = await importKey(secret)
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  return toBase64url(`${payload}.${bytesToHex(new Uint8Array(sig))}`)
}

/** Verify a gateway_admin_session cookie value against the env secret. */
export async function verifyAdminSession(
  secret: string | undefined,
  cookieValue: string | undefined,
): Promise<boolean> {
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
