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
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 })
  }

  // Use a fixed sentinel value — validation happens only at login time,
  // not by comparing raw token in every middleware invocation.
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, "dev_authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
  return res
}
