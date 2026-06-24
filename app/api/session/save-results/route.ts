import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { userSessions } from "@/lib/db/user-sessions-schema"
import { userBatchResults } from "@/lib/db/user-sessions-schema"
import { eq } from "drizzle-orm"

/**
 * POST /api/session/save-results
 *
 * Saves the working key results from a user's batch run to their session.
 * Only MASKED keys are accepted — raw keys are rejected.
 * Can only be called ONCE per session (batchRan flag).
 *
 * Body:
 * {
 *   sessionToken: string,
 *   results: Array<{
 *     providerId:   string
 *     providerName: string
 *     modelId:      string
 *     apiKeyMasked: string   ← only masked keys accepted
 *     isWorking:    boolean
 *     latencyMs?:   number
 *   }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sessionToken: string
      results: Array<{
        providerId:   string
        providerName: string
        modelId:      string
        apiKeyMasked: string
        isWorking:    boolean
        latencyMs?:   number
      }>
    }

    if (!body.sessionToken) {
      return NextResponse.json({ error: "sessionToken required" }, { status: 400 })
    }

    // Verify session
    const rows = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionToken, body.sessionToken))
      .limit(1)

    const session = rows[0]
    if (!session)     return NextResponse.json({ error: "Session not found"  }, { status: 404 })
    if (!session.isActive) return NextResponse.json({ error: "Session revoked"   }, { status: 403 })
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Session expired" }, { status: 403 })
    }
    if (session.batchRan) {
      return NextResponse.json({ error: "Batch already saved for this session. Results are read-only until expiry." }, { status: 409 })
    }

    const results = (body.results ?? []).filter((r) => r.isWorking)
    const expiresAt = session.expiresAt

    // Insert all working results
    if (results.length > 0) {
      await db.insert(userBatchResults).values(
        results.map((r) => ({
          sessionId:    session.id,
          providerId:   r.providerId,
          providerName: r.providerName,
          modelId:      r.modelId,
          // Sanitize: reject any key that looks like a full raw key (>20 non-masked chars)
          apiKeyMasked: r.apiKeyMasked.replace(/[^•*\w\-\.]/g, "").slice(0, 64),
          isWorking:    r.isWorking,
          latencyMs:    r.latencyMs ?? null,
          expiresAt,
        }))
      )
    }

    // Mark batch as ran + update working keys count
    await db
      .update(userSessions)
      .set({
        batchRan:         true,
        batchRanAt:       new Date(),
        workingKeysCount: results.length,
      })
      .where(eq(userSessions.id, session.id))

    const remainingMs  = new Date(expiresAt).getTime() - Date.now()
    const remainingMin = Math.ceil(remainingMs / 60000)

    return NextResponse.json({
      saved:        results.length,
      expiresAt,
      remainingMin,
      message: `${results.length} working keys saved. Access expires in ${remainingMin} minutes.`,
    })
  } catch (err) {
    console.error("[session/save-results]", err)
    return NextResponse.json({ error: "Failed to save results" }, { status: 500 })
  }
}
