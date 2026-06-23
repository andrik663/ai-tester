/**
 * GET /api/provider-models?provider=<id>&key=<optional>
 *
 * Returns the live model list for a provider that has a modelsEndpoint.
 * Falls back to the static PROVIDER_CONFIGS models array if:
 *   - The provider has no modelsEndpoint
 *   - The live fetch fails (no key, rate limit, etc.)
 *
 * Response shape:
 *   { source: "live" | "static", models: string[], fetchedAt: string }
 *
 * In-memory cache: 5 minutes per provider (keyed by provider id).
 * The key is only used if the provider requires auth to GET /models
 * (e.g. OpenAI, Groq). Google / Cloudflare / others are key-less.
 */

import { NextRequest, NextResponse } from "next/server"
import { PROVIDER_CONFIGS } from "@/lib/providers"

// ── In-memory cache (edge-compatible, resets on cold start) ──────────────────
interface CacheEntry {
  models: string[]
  fetchedAt: string
  expiresAt: number
}
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const providerId = searchParams.get("provider")?.toLowerCase()
  const apiKey     = searchParams.get("key") ?? ""

  if (!providerId) {
    return NextResponse.json({ error: "provider param required" }, { status: 400 })
  }

  const cfg = PROVIDER_CONFIGS[providerId]
  if (!cfg) {
    return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 404 })
  }

  // ── Check cache ───────────────────────────────────────────────────────────
  const cacheKey = `${providerId}:${apiKey ? "authed" : "anon"}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({
      source: "live",
      models: cached.models,
      fetchedAt: cached.fetchedAt,
      cached: true,
    })
  }

  // ── No modelsEndpoint — return static list ────────────────────────────────
  if (!cfg.modelsEndpoint) {
    return NextResponse.json({
      source: "static",
      models: cfg.models,
      fetchedAt: new Date().toISOString(),
      cached: false,
    })
  }

  // ── Attempt live fetch ────────────────────────────────────────────────────
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (apiKey) {
      const authHeaders = cfg.authHeader(apiKey)
      Object.assign(headers, authHeaders)
    }

    // Google puts the key in the URL, not a header
    let url = cfg.modelsEndpoint
    if (providerId === "google" && apiKey) {
      url = `${url}?key=${encodeURIComponent(apiKey)}`
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data: unknown = await res.json()

    // Parse the model list using the provider's custom parser or the default OpenAI style
    let models: string[] = []
    if (cfg.parseModels) {
      models = cfg.parseModels(data)
    } else {
      // Default: OpenAI-style { data: [{ id }] }
      const d = data as { data?: { id: string }[]; models?: { name: string }[] }
      if (Array.isArray(d.data)) {
        models = d.data.map((m) => m.id).filter(Boolean)
      } else if (Array.isArray(d.models)) {
        // Google-style { models: [{ name: "models/gemini-2.5-flash" }] }
        models = d.models
          .map((m) => m.name?.replace(/^models\//, "") ?? "")
          .filter(Boolean)
      } else if (Array.isArray(data)) {
        models = (data as { id: string }[]).map((m) => m.id).filter(Boolean)
      }
    }

    if (models.length === 0) {
      throw new Error("Empty model list returned")
    }

    // Filter out non-chat models for OpenAI (embeddings, tts, whisper, etc.)
    if (providerId === "openai") {
      models = models.filter((id) =>
        !id.includes("embedding") &&
        !id.includes("tts") &&
        !id.includes("whisper") &&
        !id.includes("dall-e") &&
        !id.includes("davinci-002") &&
        !id.includes("babbage-002") &&
        !id.startsWith("ft:"),
      )
    }

    const fetchedAt = new Date().toISOString()
    cache.set(cacheKey, { models, fetchedAt, expiresAt: Date.now() + CACHE_TTL_MS })

    return NextResponse.json({ source: "live", models, fetchedAt, cached: false })

  } catch (err) {
    // Fall back to static list on any error
    const staticModels = cfg.models
    return NextResponse.json({
      source: "static",
      models: staticModels,
      fetchedAt: new Date().toISOString(),
      cached: false,
      fallback: true,
      error: err instanceof Error ? err.message : "Unknown error",
    })
  }
}
