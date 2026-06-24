import { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "dev_session"

export async function GET(req: NextRequest) {
  const token = process.env.EXPORT_API_TOKEN
  const cookie = req.cookies.get(COOKIE_NAME)?.value

  const isDev = Boolean(token && cookie && cookie === token)
  return NextResponse.json({ isDev })
}
