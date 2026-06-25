import { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "dev_session"

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value
  const isDev = cookie === "dev_authenticated"
  return NextResponse.json({ isDev })
}
