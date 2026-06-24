import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { userSessions, userBatchResults } from "@/lib/db/user-sessions-schema"
import { lt } from "drizzle-orm"

/**
 * POST /api/session/cleanup  (called by Vercel Cron every hour)
 * GET  /api/session/cleanup  (manual trigger, requires EXPORT_API_TOKEN)
 *
 * Purges all expired sessions and their associated batch results.
 * user_batch_results rows are cascade-deleted via FK when sessions are removed.
 */

const TOKEN = process.env.EXPORT_API_TOKEN ?? ""

function authorized(req: NextRequest): boolean {
  if (!TOKEN) return true // no token set → open (dev mode)
  const auth = req.headers.get("authorization") ?? ""
  return auth === `Bearer ${TOKEN}`
}

async function runCleanup() {
  const now = new Date()

  // Delete expired batch results directly (belt + suspenders alongside CASCADE)
  const batchDel = await db
    .delete(userBatchResults)
    .where(lt(userBatchResults.expiresAt, now))

  // Delete expired sessions (CASCADE deletes their results too)
  const sessionDel = await db
    .delete(userSessions)
    .where(lt(userSessions.expiresAt, now))

  return {
    deletedSessions: (sessionDel as unknown as { rowCount?: number }).rowCount ?? 0,
    deletedResults:  (batchDel   as unknown as { rowCount?: number }).rowCount ?? 0,
    ranAt: now.toISOString(),
  }
}

export async function POST(req: NextRequest) {
  // Cron calls come without auth header on Vercel; check cron secret if set
  const cronSecret = req.headers.get("x-vercel-cron-signature") ?? ""
  const isVercelCron = cronSecret.length > 0 || req.headers.get("user-agent")?.includes("vercel-cron")
  if (!isVercelCron && !authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await runCleanup()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[session/cleanup]", err)
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await runCleanup()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[session/cleanup]", err)
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 })
  }
}
