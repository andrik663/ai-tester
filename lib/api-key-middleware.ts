import { db } from "@/lib/db"
import { apiKeys, apiUsageLogs } from "@/lib/db/api-key-schema"
import { eq, and, gt, isNull } from "drizzle-orm"
import { extractApiKey, hashApiKey } from "@/lib/api-key-utils"
import type { NextRequest } from "next/server"

export interface ValidatedApiKey {
  id: string
  name: string
  createdBy: string
  allowedEndpoints: string[]
  rateLimitPerHour: number
  metadata: Record<string, any>
}

export interface ApiKeyValidationError {
  status: number
  message: string
  code: string
}

/**
 * Validate an API key extracted from the `Authorization: Bearer` header.
 *
 * Performs the full validation pipeline in order:
 *   1. Extract and format-check the raw key from `authHeader`.
 *   2. Hash the key and look it up in the `api_keys` table (active, not expired).
 *   3. Check endpoint permissions against `allowedEndpoints` (supports `"*"` wildcard).
 *   4. Count recent requests (last hour) and enforce `rateLimitPerHour`.
 *   5. Update `last_used_at` on the key row (best-effort, errors ignored).
 *
 * @param authHeader - Value of the `Authorization` HTTP request header.
 *   Expected format: `"Bearer atk_<hex>"`.
 * @param endpoint   - The API path being accessed (e.g. `"/api/v1/chat/completions"`).
 *   Pass `undefined` to skip endpoint-permission checking.
 * @returns A `ValidatedApiKey` on success, or an `ApiKeyValidationError` with
 *   `status`, `message`, and `code` fields on any failure.
 *
 * @example
 * const result = await validateApiKey(req.headers.get("authorization"), "/api/v1/chat/completions")
 * if ("status" in result) return new Response(result.message, { status: result.status })
 */
export async function validateApiKey(
  authHeader?: string,
  endpoint?: string
): Promise<ValidatedApiKey | ApiKeyValidationError> {
  try {
    // Extract key from header
    const rawKey = extractApiKey(authHeader)
    if (!rawKey) {
      return {
        status: 401,
        message: "Invalid or missing Authorization header. Use: Authorization: Bearer atk_...",
        code: "INVALID_KEY_FORMAT",
      }
    }

    // Hash the key for database lookup
    const keyHash = hashApiKey(rawKey)

    // Find the API key in database
    const apiKey = await db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.isActive, true),
        isNull(apiKeys.expiresAt) // or expiresAt > now
      ),
    })

    if (!apiKey) {
      return {
        status: 401,
        message: "Invalid API key",
        code: "INVALID_KEY",
      }
    }

    // Check if key is expired
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return {
        status: 401,
        message: "API key has expired",
        code: "KEY_EXPIRED",
      }
    }

    // Check endpoint permissions
    if (endpoint && apiKey.allowedEndpoints && !apiKey.allowedEndpoints.includes("*")) {
      if (!apiKey.allowedEndpoints.includes(endpoint)) {
        return {
          status: 403,
          message: `API key does not have access to endpoint: ${endpoint}`,
          code: "ENDPOINT_NOT_ALLOWED",
        }
      }
    }

    // Check rate limit (requests in the last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentRequests = await db.query.apiUsageLogs.findMany({
      where: and(
        eq(apiUsageLogs.apiKeyId, apiKey.id),
        gt(apiUsageLogs.requestAt, oneHourAgo)
      ),
      limit: 1,
    })

    if (recentRequests.length >= (apiKey.rateLimitPerHour || 100)) {
      return {
        status: 429,
        message: `Rate limit exceeded. Limit: ${apiKey.rateLimitPerHour} requests per hour`,
        code: "RATE_LIMIT_EXCEEDED",
      }
    }

    // Update last_used_at
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id))
      .catch(() => {}) // Ignore update errors

    return {
      id: apiKey.id,
      name: apiKey.name,
      createdBy: apiKey.createdBy,
      allowedEndpoints: apiKey.allowedEndpoints || ["*"],
      rateLimitPerHour: apiKey.rateLimitPerHour || 100,
      metadata: (apiKey.metadata as Record<string, any>) || {},
    }
  } catch (error) {
    console.error("[API Key Validation Error]", error)
    return {
      status: 500,
      message: "Internal server error during key validation",
      code: "VALIDATION_ERROR",
    }
  }
}

/**
 * Write one API-usage log row to the `api_usage_logs` table.
 *
 * Called after every request handled by a gateway route to record usage
 * metrics for billing, auditing, and rate-limit enforcement. Errors are
 * logged to the console but never rethrown — a logging failure must never
 * break the primary request flow.
 *
 * @param apiKeyId      - The `api_keys.id` UUID of the authenticated key.
 * @param req           - The incoming `NextRequest` (used for method, UA, IP).
 * @param endpoint      - API path string, e.g. `"/api/v1/chat/completions"`.
 * @param statusCode    - HTTP status code of the outbound response.
 * @param responseTimeMs - Total wall-clock time from request receipt to response send (ms).
 * @param errorMessage  - Optional error description if the request failed.
 */
export async function logApiUsage(
  apiKeyId: string,
  req: NextRequest,
  endpoint: string,
  statusCode: number,
  responseTimeMs: number,
  errorMessage?: string
) {
  try {
    await db.insert(apiUsageLogs).values({
      apiKeyId,
      endpoint,
      method: req.method,
      statusCode,
      responseTimeMs,
      errorMessage,
      userAgent: req.headers.get("user-agent") || "",
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown",
      metadata: {
        pathname: new URL(req.url).pathname,
      },
    })
  } catch (error) {
    console.error("[Log API Usage Error]", error)
  }
}

/**
 * Resolve a minimal key identity object from an Authorization header.
 *
 * Used in logging contexts where only the key `id` and `name` are needed
 * (not the full validation pipeline). Does NOT check expiry, rate limits,
 * or endpoint permissions.
 *
 * @param authHeader - Value of the `Authorization` HTTP header, or `undefined`.
 * @returns `{ id, name }` if the key exists in the database, otherwise `null`.
 */
export async function getApiKeyInfo(authHeader?: string) {
  if (!authHeader) return null

  const rawKey = extractApiKey(authHeader)
  if (!rawKey) return null

  const keyHash = hashApiKey(rawKey)
  const apiKey = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, keyHash),
  })

  return apiKey ? { id: apiKey.id, name: apiKey.name } : null
}
