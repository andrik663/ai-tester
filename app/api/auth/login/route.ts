import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"

const COOKIE_NAME = "dev_session"
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex")
}

function makeToken(secret: string): string {
  const payload = `dev:${Date.now()}`
  const sig = sign(payload, secret)
  return Buffer.from(`${payload}.${sig}`).toString("base64url")
}

export async function POST(req: NextRequest) {
  const secret = process.env.DEV_PASSWORD
  if (!secret) {
    return NextResponse.json({ error: "DEV_PASSWORD not configured" }, { status: 500 })
  }

  let password: string
  try {
    const body = await req.json()
    password = body.password ?? ""
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  // Timing-safe comparison
  const a = Buffer.from(password)
  const b = Buffer.from(secret)
  const match =
    a.length === b.length &&
    timingSafeEqual(a, b)

  if (!match) {
    // Artificial delay to slow brute-force
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 200))
    return NextResponse.json({ error: "Invalid password" }, { status: 401 })
  }

  const token = makeToken(secret)
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
