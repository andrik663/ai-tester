import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { userSessions } from "@/lib/db/user-sessions-schema"
import { eq } from "drizzle-orm"

/**
 * GET /api/session/verify?token=<sessionToken>
 *
 * Verifies a session token and returns its status.
 * Used by the UI to check if the session is still valid before showing data.
 *
 * Returns:
 *   { valid: true,  sessionId, expiresAt, ttlMinutes, batchRan, workingKeysCount, remainingMs }
 *   { valid: false, reason: "expired" | "revoked" | "not_found" }
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token) {
    return NextResponse.json({ valid: false, reason: "no_token" }, { status: 400 })
  }

  try {
    const rows = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionToken, token))
      .limit(1)

    const session = rows[0]

    if (!session) {
      return NextResponse.json({ valid: false, reason: "not_found" })
    }
    if (!session.isActive) {
      return NextResponse.json({ valid: false, reason: "revoked" })
    }
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json({ valid: false, reason: "expired" })
    }

    const remainingMs = new Date(session.expiresAt).getTime() - Date.now()

    return NextResponse.json({
      valid: true,
      sessionId:        session.id,
      expiresAt:        session.expiresAt,
      ttlMinutes:       session.ttlMinutes,
      batchRan:         session.batchRan,
      batchRanAt:       session.batchRanAt,
      workingKeysCount: session.workingKeysCount,
      remainingMs,
      remainingMin:     Math.ceil(remainingMs / 60000),
    })
  } catch (err) {
    console.error("[session/verify]", err)
    return NextResponse.json({ valid: false, reason: "error" }, { status: 500 })
  }
}
