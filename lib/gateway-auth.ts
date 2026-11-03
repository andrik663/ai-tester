import { createHash } from "crypto"
import { pool } from "@/lib/db"
import { validateGatewayToken } from "@/lib/gateway-cache"
import { validateApiKey } from "@/lib/api-key-middleware"

export type GatewayKeyTier = "msaku_user" | "api_key" | "admin" | "anonymous_read"

export interface GatewayAuthResult {
  valid: boolean
  tier?: GatewayKeyTier
  userId?: number
  keyPrefix?: string
  keyLabel?: string | null
  rateLimitPerMinute?: number
  error?: string
  status?: number
}

// Simple edge in-memory rate limiter per key/IP (window: 60 seconds)
const rateWindows = new Map<string, { count: number; resetAt: number }>()
const MSAKU_USER_RPM = 120

function checkRateWindow(bucketKey: string, maxPerMinute: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const existing = rateWindows.get(bucketKey)
  if (!existing || now > existing.resetAt) {
    rateWindows.set(bucketKey, { count: 1, resetAt: now + 60_000 })
    return { allowed: true, remaining: maxPerMinute - 1 }
  }
  if (existing.count >= maxPerMinute) {
    return { allowed: false, remaining: 0 }
  }
  existing.count += 1
  return { allowed: true, remaining: maxPerMinute - existing.count }
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export function extractBearerOrHeaderKey(headers: Headers): string {
  const auth = headers.get("authorization") || ""
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim()
  }
  const xKey = headers.get("x-msaku-key") || headers.get("x-api-key") || ""
  return xKey.trim()
}

/**
 * Validate a Msaku Gateway credential (`gateway.msaku.id`):
 * 1. Registered msaku.id user API key (`msk_...` stored hashed in `mcp_api_keys`) -> 120 RPM
 * 2. Custom `atk_...` key stored in `api_keys`
 * - Internal token (fixed constant, no env var needed)
 */
export async function authenticateGatewayRequest(
  headers: Headers,
  endpoint = "/api/v1/chat/completions",
  allowAnonymousRead = false,
): Promise<GatewayAuthResult> {
  const rawKey = extractBearerOrHeaderKey(headers)

  if (!rawKey) {
    if (allowAnonymousRead) {
      return {
        valid: true,
        tier: "anonymous_read",
        keyPrefix: "read",
        keyLabel: "Read-Only Discovery",
        rateLimitPerMinute: 60,
      }
    }
    return {
      valid: false,
      status: 401,
      error: "API Key User wajib diisi. Buat API Key User pribadi Anda (msk_...) di https://msaku.id/gateway.",
    }
  }

  // 1. Registered msaku.id user key (`msk_...`)
  if (rawKey.startsWith("msk_")) {
    const keyHash = sha256Hex(rawKey)
    try {
      const client = await pool.connect()
      try {
        const { rows } = await client.query(
          `SELECT id, user_id, label, key_prefix
           FROM mcp_api_keys
           WHERE key_hash = $1 AND revoked_at IS NULL
           LIMIT 1`,
          [keyHash],
        )
        const row = rows[0]
        if (row && Number(row.user_id) > 0) {
          // Best-effort update last_used_at
          client
            .query(`UPDATE mcp_api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id])
            .catch(() => {})

          const rl = checkRateWindow(`msk:${row.id}`, MSAKU_USER_RPM)
          if (!rl.allowed) {
            return {
              valid: false,
              status: 429,
              error: `Rate limit tercapai (${MSAKU_USER_RPM} req/menit). Tunggu sebentar lalu coba lagi.`,
            }
          }

          return {
            valid: true,
            tier: "msaku_user",
            userId: Number(row.user_id),
            keyPrefix: String(row.key_prefix || rawKey.slice(0, 12)),
            keyLabel: row.label ? String(row.label) : "MSAKU User Key",
            rateLimitPerMinute: MSAKU_USER_RPM,
          }
        }
      } finally {
        client.release()
      }
    } catch {
      // If mcp_api_keys table does not exist in this DB or DB is unreachable,
      // still allow valid-format msk_ keys (36+ chars) with per-key rate limit
      // so cross-DB deployments remain functional while surfacing DB-verified keys first.
      if (rawKey.length >= 36) {
        const rl = checkRateWindow(`msk-stateless:${keyHash.slice(0, 16)}`, MSAKU_USER_RPM)
        if (!rl.allowed) {
          return {
            valid: false,
            status: 429,
            error: `Rate limit tercapai (${MSAKU_USER_RPM} req/menit).`,
          }
        }
        return {
          valid: true,
          tier: "msaku_user",
          keyPrefix: rawKey.slice(0, 12),
          keyLabel: "MSAKU User Key",
          rateLimitPerMinute: MSAKU_USER_RPM,
        }
      }
    }

    return {
      valid: false,
      status: 401,
      error: "API key MSAKU (msk_...) tidak valid atau sudah dicabut. Buat key baru di https://msaku.id/profil/api-key",
    }
  }

  // 2. AI Tester custom key (`atk_...`)
  if (rawKey.startsWith("atk_")) {
    const res = await validateApiKey(`Bearer ${rawKey}`, endpoint)
    if ("status" in res) {
      return {
        valid: false,
        status: res.status,
        error: res.message,
      }
    }
    return {
      valid: true,
      tier: "api_key",
      keyPrefix: rawKey.slice(0, 12),
      keyLabel: res.name,
      rateLimitPerMinute: Math.max(10, Math.round((res.rateLimitPerHour || 100) / 60)),
    }
  }

  // 3. Internal token (fixed constant)
  if (validateGatewayToken(rawKey)) {
    return {
      valid: true,
      tier: "admin",
      keyPrefix: "admin",
      keyLabel: "Internal / Admin Token",
      rateLimitPerMinute: 600,
    }
  }

  return {
    valid: false,
    status: 401,
    error: "API key tidak dikenali. Gunakan API Key User MSAKU (msk_...) yang dibuat di https://msaku.id/gateway.",
  }
}
