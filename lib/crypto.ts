/**
 * AES-256-GCM encrypt/decrypt using EXPORT_API_TOKEN as key material.
 * Raw API keys are encrypted before storing in DB and decrypted only
 * server-side when running the auto-refresh batch.
 *
 * Uses Node.js built-in `crypto` — no extra dependency needed.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

const ALGO = "aes-256-gcm"

/** Derive a 32-byte key from any string via SHA-256 */
function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest()
}

/**
 * Encrypt a plaintext string.
 * Returns hex: <12-byte IV><16-byte auth tag><ciphertext>
 */
export function encrypt(plaintext: string): string {
  const secret = process.env.EXPORT_API_TOKEN
  if (!secret) throw new Error("EXPORT_API_TOKEN not set — cannot encrypt key")
  const key  = deriveKey(secret)
  const iv   = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc  = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag  = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("hex")
}

/**
 * Decrypt a hex string produced by `encrypt`.
 */
export function decrypt(hex: string): string {
  const secret = process.env.EXPORT_API_TOKEN
  if (!secret) throw new Error("EXPORT_API_TOKEN not set — cannot decrypt key")
  const key  = deriveKey(secret)
  const buf  = Buffer.from(hex, "hex")
  const iv   = buf.subarray(0, 12)
  const tag  = buf.subarray(12, 28)
  const enc  = buf.subarray(28)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8")
}
