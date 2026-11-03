import { NextRequest, NextResponse } from "next/server"
import { authenticateGatewayRequest } from "@/lib/gateway-auth"

export const runtime = "nodejs"

/**
 * GET /api/v1/keys/info
 * Returns registration instructions for personal msaku.id user keys (msk_...).
 *
 * POST /api/v1/keys/info
 * Validates a supplied API key (`Authorization: Bearer <key>` or `{ key: "..." }`)
 * and returns its tier (`msaku_user`, `api_key`, `admin`) and rate limit.
 */
export async function GET() {
  return NextResponse.json({
    gateway: "Msaku Gateway",
    baseUrl: "https://gateway.msaku.id/api/v1",
    registeredUserKey: {
      prefix: "msk_",
      tier: "msaku_user",
      targetGateway: "https://gateway.msaku.id/api/v1",
      rateLimitPerMinute: 120,
      registerUrl: "https://msaku.id/profil/api-key",
      gatewayPageUrl: "https://msaku.id/gateway",
      description:
        "API Key User terdaftar MSAKU.id (msk_...) khusus untuk mengakses https://gateway.msaku.id dan MCP Server Msaku (120 req/menit).",
    },
  })
}

export async function POST(req: NextRequest) {
  let bodyKey = ""
  try {
    const body = await req.json()
    if (typeof body?.key === "string") bodyKey = body.key.trim()
  } catch {
    // optional JSON body
  }

  const headers = new Headers(req.headers)
  if (bodyKey && !headers.get("authorization")) {
    headers.set("authorization", `Bearer ${bodyKey}`)
  }

  const res = await authenticateGatewayRequest(headers, "/api/v1/keys/info", false)
  if (!res.valid) {
    return NextResponse.json(
      { valid: false, error: res.error || "Invalid API key" },
      { status: res.status || 401 },
    )
  }

  return NextResponse.json({
    valid: true,
    tier: res.tier,
    keyPrefix: res.keyPrefix,
    keyLabel: res.keyLabel,
    userId: res.userId ?? null,
    rateLimitPerMinute: res.rateLimitPerMinute,
  })
}
