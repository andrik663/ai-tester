import { createHmac } from "crypto"

const COOKIE_NAME = "dev_session"

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex")
}

/**
 * Verifies the dev_session cookie.
 * Returns true if the token is valid and not expired (< 24h).
 */
export function verifySession(cookieValue: string | undefined): boolean {
  const secret = process.env.DEV_PASSWORD
  if (!secret || !cookieValue) return false

  try {
    const raw = Buffer.from(cookieValue, "base64url").toString("utf8")
    const lastDot = raw.lastIndexOf(".")
    if (lastDot === -1) return false

    const payload = raw.slice(0, lastDot)
    const sig = raw.slice(lastDot + 1)

    // Verify HMAC
    const expected = sign(payload, secret)
    if (sig !== expected) return false

    // Verify age
    const parts = payload.split(":")
    const ts = parseInt(parts[1] ?? "0", 10)
    const age = Date.now() - ts
    if (age > 1000 * 60 * 60 * 24) return false // 24h

    return true
  } catch {
    return false
  }
}

export { COOKIE_NAME }
