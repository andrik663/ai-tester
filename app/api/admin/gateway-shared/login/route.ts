/**
 * /api/admin/gateway-shared/login — issue / revoke the panel session.
 *
 * POST { password } → verifies the password against the server-only
 * GATEWAY_SHARED_ADMIN_TOKEN with a constant-time comparison, then sets
 * a signed, httpOnly gateway_admin_session cookie. The token itself is
 * never sent back to the browser and never stored in client code.
 * POST { logout: true } → clears the cookie.
 * If the env secret is unset, login is refused (503, fail closed).
 */

import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { GATEWAY_ADMIN_COOKIE, makeAdminToken } from "@/lib/gateway-admin-session"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const secret = process.env.GATEWAY_SHARED_ADMIN_TOKEN
  if (!secret) {
    return NextResponse.json(
      { error: "Panel admin shared belum diaktifkan: set env GATEWAY_SHARED_ADMIN_TOKEN di environment deployment." },
      { status: 503 },
    )
  }
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (body.logout === true) {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(GATEWAY_ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 })
    return res
  }

  const presented = typeof body.password === "string" ? body.password : ""
  const a = Buffer.from(presented)
  const b = Buffer.from(secret)
  const match = a.length === b.length && timingSafeEqual(a, b)
  if (!match) {
    return NextResponse.json({ error: "Token admin shared salah." }, { status: 403 })
  }
  const token = await makeAdminToken(secret)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(GATEWAY_ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  })
  return res
}
