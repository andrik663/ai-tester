import { NextRequest, NextResponse } from "next/server"
import { fetchLiveModels, PROVIDER_CONFIGS } from "@/lib/providers"

/**
 * POST /api/fetch-models
 * Body: { provider: string; apiKey: string }
 *
 * Returns the live model list for a provider using their own API key.
 * Falls back to the static list from lib/providers.ts if the provider
 * does not expose a /models endpoint or the request fails.
 *
 * Response: { models: LiveModelEntry[], total: number, source: "live" | "static" }
 */
export async function POST(req: NextRequest) {
  let provider = ""
  let apiKey = ""
  try {
    const body = await req.json()
    provider = String(body.provider ?? "").trim().toLowerCase()
    apiKey   = String(body.apiKey   ?? "").trim()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!provider) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 })
  }
  if (!apiKey || apiKey.length < 4) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 })
  }
  if (!PROVIDER_CONFIGS[provider]) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
  }

  const { models, source } = await fetchLiveModels(provider, apiKey)
  return NextResponse.json({ models, total: models.length, source })
}
