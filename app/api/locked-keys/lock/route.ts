/**
 * POST /api/locked-keys/lock
 *
 * Locks a working key permanently into the DB.
 * Auth: Authorization: Bearer <EXPORT_API_TOKEN>
 *
 * Body: {
 *   providerId: string
 *   providerName: string
 *   modelId: string
 *   apiKey: string          — raw key, encrypted before storing
 *   latencyMs?: number
 *   refreshIntervalHours?: number   default 24
 * }
 */
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { lockedWorkingKeys } from "@/lib/db/locked-keys-schema"
import { encrypt } from "@/lib/crypto"
import { validateToken } from "@/lib/export-cache"
import { eq, and } from "drizzle-orm"

export const runtime = "nodejs"

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••"
  return key.slice(0, 4) + "••••" + key.slice(-4)
}

export async function POST(req: NextRequest) {
  // Auth
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (!validateToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    providerId: string
    providerName: string
    modelId: string
    apiKey: string
    latencyMs?: number
    refreshIntervalHours?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { providerId, providerName, modelId, apiKey, latencyMs, refreshIntervalHours = 24 } = body

  if (!providerId || !providerName || !modelId || !apiKey) {
    return NextResponse.json(
      { error: "Missing required fields: providerId, providerName, modelId, apiKey" },
      { status: 400 },
    )
  }

  try {
    const apiKeyEncrypted = encrypt(apiKey)
    const apiKeyMasked    = maskKey(apiKey)
    const now             = new Date()
    const nextRefreshAt   = new Date(now.getTime() + refreshIntervalHours * 60 * 60 * 1000)

    // Upsert: if same provider+model+maskedKey already locked, replace it
    const existing = await db.query.lockedWorkingKeys.findFirst({
      where: and(
        eq(lockedWorkingKeys.providerId, providerId),
        eq(lockedWorkingKeys.modelId, modelId),
        eq(lockedWorkingKeys.apiKeyMasked, apiKeyMasked),
      ),
    })

    if (existing) {
      await db
        .update(lockedWorkingKeys)
        .set({
          apiKeyEncrypted,
          providerName,
          isWorking: true,
          latencyMs: latencyMs ?? existing.latencyMs,
          lastTestedAt: now,
          lockedAt: now,
          nextRefreshAt,
          refreshIntervalHours,
          lastError: null,
        })
        .where(eq(lockedWorkingKeys.id, existing.id))

      return NextResponse.json({ success: true, action: "updated", id: existing.id, apiKeyMasked })
    }

    const [inserted] = await db
      .insert(lockedWorkingKeys)
      .values({
        providerId,
        providerName,
        modelId,
        apiKeyEncrypted,
        apiKeyMasked,
        isWorking: true,
        latencyMs,
        lastTestedAt: now,
        lockedAt: now,
        nextRefreshAt,
        refreshIntervalHours,
      })
      .returning({ id: lockedWorkingKeys.id })

    return NextResponse.json({ success: true, action: "locked", id: inserted.id, apiKeyMasked })
  } catch (err) {
    console.error("[locked-keys/lock]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
