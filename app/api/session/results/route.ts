import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { userSessions, userBatchResults } from "@/lib/db/user-sessions-schema"
import { eq, and } from "drizzle-orm"

/**
 * GET /api/session/results?token=<sessionToken>
 *
 * Returns the working key results for an active session.
 * Only returns MASKED keys and provider/model metadata — never raw keys.
 * Returns 403 if session is expired or revoked.
 *
 * This endpoint is safe to call from any client — it only exposes
 * masked key data that is already visible in the batch UI.
 *
 * Returns:
 * {
 *   results:      Array<{ providerId, providerName, modelId, apiKeyMasked, latencyMs, testedAt }>
 *   expiresAt:    string (ISO)
 *   remainingMin: number
 *   count:        number
 * }
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 })
  }

  try {
    // Verify session
    const sessionRows = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionToken, token))
      .limit(1)

    const session = sessionRows[0]
    if (!session)          return NextResponse.json({ error: "Session not found" }, { status: 404 })
    if (!session.isActive) return NextResponse.json({ error: "Session revoked"  }, { status: 403 })
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Session expired. Results are no longer available." }, { status: 403 })
    }

    // Fetch results
    const rows = await db
      .select({
        providerId:   userBatchResults.providerId,
        providerName: userBatchResults.providerName,
        modelId:      userBatchResults.modelId,
        apiKeyMasked: userBatchResults.apiKeyMasked,
        latencyMs:    userBatchResults.latencyMs,
        testedAt:     userBatchResults.testedAt,
      })
      .from(userBatchResults)
      .where(
        and(
          eq(userBatchResults.sessionId, session.id),
          eq(userBatchResults.isWorking, true),
        )
      )

    const remainingMs  = new Date(session.expiresAt).getTime() - Date.now()
    const remainingMin = Math.ceil(remainingMs / 60000)

    return NextResponse.json({
      results:      rows,
      count:        rows.length,
      expiresAt:    session.expiresAt,
      remainingMin,
      batchRanAt:   session.batchRanAt,
    })
  } catch (err) {
    console.error("[session/results]", err)
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 })
  }
}
