import { NextRequest, NextResponse } from "next/server"
import { makeToken, COOKIE_NAME } from "@/lib/auth"

const COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

export async function POST(req: NextRequest) {
  const secret = process.env.DEV_PASSWORD
  if (!secret) {
    return NextResponse.json({ error: "DEV_PASSWORD not configured" }, { status: 500 })
  }

  let password: string
  try {
    const body = await req.json()
    password = String(body.password ?? "")
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  // Simple equality — timing attack on a single shared secret is acceptable
  // (no user enumeration, no account lockout concern). Add brute-force delay.
  const match = password === secret

  if (!match) {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 200))
    return NextResponse.json({ error: "Invalid password" }, { status: 401 })
  }

  const token = await makeToken(secret)
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
