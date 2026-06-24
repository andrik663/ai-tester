import { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "dev_session"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export async function POST(req: NextRequest) {
  const token = process.env.EXPORT_API_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: "Dev login is not configured on this server." },
      { status: 503 },
    )
  }

  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  if (!body.password || body.password !== token) {
    // Constant-time comparison would be better but token comparison via === is
    // acceptable here since the risk of timing attacks on a dev tool is low.
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
  return res
}
