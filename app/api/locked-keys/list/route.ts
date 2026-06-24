/**
 * GET /api/locked-keys/list
 *
 * Returns all locked keys (masked only — no raw keys ever returned).
 * Auth: Authorization: Bearer <EXPORT_API_TOKEN>
 *
 * Query params (optional):
 *   ?provider=anthropic     filter by providerId
 *   ?working=true|false     filter by isWorking
 */
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { lockedWorkingKeys, lockedKeyRefreshLog } from "@/lib/db/locked-keys-schema"
import { validateToken } from "@/lib/export-cache"
import { eq, desc } from "drizzle-orm"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (!validateToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const providerFilter = req.nextUrl.searchParams.get("provider")
  const workingFilter  = req.nextUrl.searchParams.get("working")

  try {
    let rows = await db.query.lockedWorkingKeys.findMany({
      orderBy: [desc(lockedWorkingKeys.lockedAt)],
    })

    if (providerFilter) {
      rows = rows.filter((r) => r.providerId === providerFilter)
    }
    if (workingFilter !== null) {
      const wantWorking = workingFilter === "true"
      rows = rows.filter((r) => r.isWorking === wantWorking)
    }

    // Strip encrypted key — never return it
    const safe = rows.map(({ apiKeyEncrypted: _enc, ...rest }) => rest)

    return NextResponse.json({
      success: true,
      total: safe.length,
      working: safe.filter((r) => r.isWorking).length,
      failed: safe.filter((r) => !r.isWorking).length,
      keys: safe,
    })
  } catch (err) {
    console.error("[locked-keys/list]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
