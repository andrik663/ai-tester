import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { userSessions } from "@/lib/db/user-sessions-schema"
import crypto from "crypto"

/**
 * POST /api/session/start
 *
 * Creates a new temporary user session.
 * Call this before starting a batch run.
 *
 * Body (optional):
 *   { ttlMinutes?: number }   — default 60, max 480 (8h), min 5
 *
 * Returns:
 *   { sessionToken: string, expiresAt: string, ttlMinutes: number }
 *
 * The sessionToken should be stored in the browser's sessionStorage
 * (not localStorage) so it is cleared when the tab is closed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { ttlMinutes?: number }

    const ttlMinutes = Math.min(480, Math.max(5, body.ttlMinutes ?? 60))
    const expiresAt  = new Date(Date.now() + ttlMinutes * 60 * 1000)
    const sessionToken = crypto.randomUUID()

    // Fingerprint: hash of IP + user-agent for abuse detection
    const ip        = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const ua        = req.headers.get("user-agent") ?? ""
    const fingerprint = crypto.createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 16)

    await db.insert(userSessions).values({
      sessionToken,
      fingerprint,
      expiresAt,
      ttlMinutes,
    })

    return NextResponse.json({
      sessionToken,
      expiresAt:  expiresAt.toISOString(),
      ttlMinutes,
      message: `Session active for ${ttlMinutes} minutes. Store the token in sessionStorage.`,
    })
  } catch (err) {
    console.error("[session/start]", err)
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }
}
