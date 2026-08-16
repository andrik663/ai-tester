/**
 * GET  /api/comments        — latest public feedback (for the header ticker)
 * POST /api/comments        — submit a new public comment { name?, message }
 *
 * Public, unauthenticated (see middleware.ts PUBLIC_PREFIXES). Basic
 * in-memory per-IP rate limiting keeps the ticker from being spammed; it is
 * best-effort only (resets on redeploy / cold start) and intentionally
 * simple since this is a low-stakes feedback widget, not an account system.
 */

import { NextRequest, NextResponse } from "next/server"
import { insertComment, listRecentComments, MAX_MESSAGE_LENGTH, MAX_NAME_LENGTH } from "@/lib/comments"

export const runtime = "nodejs"

const RATE_LIMIT_WINDOW_MS = 30_000 // one comment per IP every 30s
const lastPostByIp = new Map<string, number>()

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const limit = sp.get("limit") ? Number(sp.get("limit")) : 20
  const rows = await listRecentComments(limit)
  return NextResponse.json(
    { comments: rows },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function POST(req: NextRequest) {
  let body: { name?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const message = typeof body.message === "string" ? body.message : ""
  const name = typeof body.name === "string" ? body.name : ""

  if (!message.trim()) {
    return NextResponse.json({ error: "Komentar tidak boleh kosong" }, { status: 400 })
  }
  if (message.length > MAX_MESSAGE_LENGTH * 4) {
    // Generous pre-check before server-side truncation in insertComment
    return NextResponse.json({ error: `Komentar terlalu panjang (maks ${MAX_MESSAGE_LENGTH} karakter)` }, { status: 400 })
  }
  if (name.length > MAX_NAME_LENGTH * 4) {
    return NextResponse.json({ error: `Nama terlalu panjang (maks ${MAX_NAME_LENGTH} karakter)` }, { status: 400 })
  }

  const ip = getClientIp(req)
  const last = lastPostByIp.get(ip)
  const now = Date.now()
  if (last && now - last < RATE_LIMIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "Tunggu sebentar sebelum mengirim komentar lagi" },
      { status: 429 },
    )
  }

  const comment = await insertComment(name, message)
  if (!comment) {
    return NextResponse.json({ error: "Komentar tidak boleh kosong" }, { status: 400 })
  }

  lastPostByIp.set(ip, now)
  // Best-effort cleanup so the map doesn't grow unbounded over a long-lived process
  if (lastPostByIp.size > 5_000) {
    for (const [key, ts] of lastPostByIp) {
      if (now - ts > RATE_LIMIT_WINDOW_MS) lastPostByIp.delete(key)
    }
  }

  return NextResponse.json({ comment }, { status: 201 })
}
