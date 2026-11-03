import { NextRequest, NextResponse } from "next/server"
import { PUBLIC_GATEWAY_KEY } from "@/lib/gateway-cache"
import { authenticateGatewayRequest } from "@/lib/gateway-auth"

export const runtime = "nodejs"

/**
 * GET /api/v1/keys/info
 * Returns the public shared API key and registration instructions for
 * personal msaku.id user keys.
 *
 * POST /api/v1/keys/info
 * Validates a supplied API key (`Authorization: Bearer <key>` or `{ key: "..." }`)
 * and returns its tier (`public`, `msaku_user`, `api_key`, `admin`) and rate limit.
 */
export async function GET() {
  return NextResponse.json({
    gateway: "Msaku Gateway",
    baseUrl: "https://gateway.msaku.id/api/v1",
    publicKey: {
      key: PUBLIC_GATEWAY_KEY,
      tier: "public",
      rateLimitPerMinute: 20,
      description: "API Key publik gratis (shared rate limit 20 req/menit per IP).",
    },
    registeredUserKey: {
      prefix: "msk_",
      tier: "msaku_user",
      rateLimitPerMinute: 120,
      registerUrl: "https://msaku.id/profil/api-key",
      gatewayPageUrl: "https://msaku.id/gateway",
      description: "API Key khusus user terdaftar di msaku.id (120 req/menit per key).",
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
