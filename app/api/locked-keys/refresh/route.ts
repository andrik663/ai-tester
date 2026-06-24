/**
 * POST /api/locked-keys/refresh
 *
 * Auto-batch re-verification of all locked keys whose nextRefreshAt <= now.
 * Call this from a Vercel Cron Job (vercel.json) every hour — it only
 * processes keys that are actually due.
 *
 * Auth: Authorization: Bearer <EXPORT_API_TOKEN>
 *
 * Also accepts ?force=true to re-test ALL locked keys regardless of schedule.
 *
 * Returns a summary of what was tested and what changed.
 */
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { lockedWorkingKeys, lockedKeyRefreshLog } from "@/lib/db/locked-keys-schema"
import { decrypt } from "@/lib/crypto"
import { validateToken } from "@/lib/export-cache"
import {
  PROVIDER_CONFIGS,
  buildProviderHeaders,
  resolveProviderEndpoint,
  DEFAULT_PROMPT,
} from "@/lib/providers"
import { lte, or, eq } from "drizzle-orm"

export const runtime = "nodejs"
export const maxDuration = 300 // 5 min — enough for large batches

interface RefreshResult {
  id: string
  providerId: string
  modelId: string
  apiKeyMasked: string
  wasWorking: boolean
  isNowWorking: boolean
  latencyMs?: number
  error?: string
  changed: boolean
}

async function testKey(
  providerId: string,
  apiKey: string,
  modelId: string,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const config = PROVIDER_CONFIGS[providerId as keyof typeof PROVIDER_CONFIGS]
  if (!config) {
    return { ok: false, latencyMs: 0, error: `Unknown provider: ${providerId}` }
  }

  const endpoint = resolveProviderEndpoint(providerId, apiKey)
  if (!endpoint) {
    return { ok: false, latencyMs: 0, error: "Cannot resolve endpoint (needs account ID)" }
  }

  const resolvedEndpoint = endpoint.includes("{{MODEL}}")
    ? endpoint.replace("{{MODEL}}", modelId)
    : endpoint

  const headers = buildProviderHeaders(providerId, apiKey)
  const body    = config.buildBody(modelId, 32) // tiny token count for fast re-verify

  const start = Date.now()
  try {
    const res = await fetch(resolvedEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
    const latencyMs = Date.now() - start
    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      return { ok: false, latencyMs, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` }
    }
    return { ok: true, latencyMs }
  } catch (err) {
    const latencyMs = Date.now() - start
    return { ok: false, latencyMs, error: String(err) }
  }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (!validateToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const force = req.nextUrl.searchParams.get("force") === "true"
  const now   = new Date()

  try {
    // Fetch keys that are due for refresh (or all if ?force=true)
    const due = force
      ? await db.query.lockedWorkingKeys.findMany()
      : await db.query.lockedWorkingKeys.findMany({
          where: lte(lockedWorkingKeys.nextRefreshAt, now),
        })

    if (due.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No keys due for refresh",
        tested: 0,
        results: [],
      })
    }

    const results: RefreshResult[] = []

    // Process keys concurrently but cap at 10 at a time to avoid rate-limits
    const CONCURRENCY = 10
    for (let i = 0; i < due.length; i += CONCURRENCY) {
      const batch = due.slice(i, i + CONCURRENCY)
      const settled = await Promise.allSettled(
        batch.map(async (row) => {
          let rawKey: string
          try {
            rawKey = decrypt(row.apiKeyEncrypted)
          } catch {
            return {
              id: row.id,
              providerId: row.providerId,
              modelId: row.modelId,
              apiKeyMasked: row.apiKeyMasked,
              wasWorking: row.isWorking,
              isNowWorking: false,
              error: "Decryption failed (EXPORT_API_TOKEN changed?)",
              changed: row.isWorking !== false,
            } satisfies RefreshResult
          }

          const { ok, latencyMs, error } = await testKey(row.providerId, rawKey, row.modelId)
          const nextRefreshAt = new Date(now.getTime() + row.refreshIntervalHours * 60 * 60 * 1000)

          // Update DB record
          await db
            .update(lockedWorkingKeys)
            .set({
              isWorking:   ok,
              latencyMs:   latencyMs || null,
              lastTestedAt: now,
              nextRefreshAt,
              lastError:   error ?? null,
            })
            .where(eq(lockedWorkingKeys.id, row.id))

          // Write refresh log entry
          await db.insert(lockedKeyRefreshLog).values({
            lockedKeyId:  row.id,
            testedAt:     now,
            wasWorking:   ok,
            latencyMs:    latencyMs || null,
            errorMessage: error ?? null,
          })

          return {
            id: row.id,
            providerId: row.providerId,
            modelId: row.modelId,
            apiKeyMasked: row.apiKeyMasked,
            wasWorking: row.isWorking,
            isNowWorking: ok,
            latencyMs,
            error,
            changed: row.isWorking !== ok,
          } satisfies RefreshResult
        }),
      )

      for (const s of settled) {
        if (s.status === "fulfilled") results.push(s.value)
        else results.push({
          id: "?", providerId: "?", modelId: "?", apiKeyMasked: "?",
          wasWorking: false, isNowWorking: false,
          error: String(s.reason), changed: false,
        })
      }
    }

    const nowWorking = results.filter((r) => r.isNowWorking).length
    const broken     = results.filter((r) => !r.isNowWorking).length
    const changed    = results.filter((r) => r.changed).length

    return NextResponse.json({
      success: true,
      tested: results.length,
      nowWorking,
      broken,
      changed,
      refreshedAt: now.toISOString(),
      results,
    })
  } catch (err) {
    console.error("[locked-keys/refresh]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Also support GET so Vercel Cron (which sends GET) can trigger it
export async function GET(req: NextRequest) {
  return POST(req)
}
