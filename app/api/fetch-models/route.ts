import { NextRequest, NextResponse } from "next/server"
import { fetchLiveModels, PROVIDER_CONFIGS, normalizeCustomModelsEndpoint } from "@/lib/providers"

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
  let customEndpoint = ""
  try {
    const body = await req.json()
    provider = String(body.provider ?? "").trim().toLowerCase()
    apiKey   = String(body.apiKey   ?? "").trim()
    customEndpoint = String(body.customEndpoint ?? "").trim()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!provider) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 })
  }
  if (!apiKey || apiKey.length < 4) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 })
  }

  // Custom provider: fetch models live from its own /models endpoint.
  if (!PROVIDER_CONFIGS[provider]) {
    const modelsUrl = normalizeCustomModelsEndpoint(customEndpoint)
    if (!modelsUrl) {
      return NextResponse.json(
        { error: `Provider kustom "${provider}" membutuhkan Endpoint URL (https://domain.com atau https://domain.com/v1)` },
        { status: 400 },
      )
    }
    try {
      const res = await fetch(modelsUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        return NextResponse.json({ models: [], total: 0, source: "live", error: `HTTP ${res.status} dari ${modelsUrl}` })
      }
      const data = (await res.json()) as { data?: { id?: string }[]; models?: { id?: string }[] }
      const entries = data?.data ?? data?.models ?? []
      const models = entries
        .map((m) => (typeof m?.id === "string" ? { id: m.id } : null))
        .filter((m): m is { id: string } => Boolean(m?.id) && m!.id !== "unknown")
      return NextResponse.json({ models, total: models.length, source: "live" })
    } catch (err) {
      return NextResponse.json({
        models: [],
        total: 0,
        source: "live",
        error: err instanceof Error ? err.message : `Gagal fetch ${modelsUrl}`,
      })
    }
  }

  const { models, source } = await fetchLiveModels(provider, apiKey)
  return NextResponse.json({ models, total: models.length, source })
}
