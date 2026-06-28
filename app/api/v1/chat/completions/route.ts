/**
 * POST /api/v1/chat/completions
 *
 * Miuclaw Gateway — OpenAI-compatible chat completions proxy.
 *
 * Accepts a standard OpenAI chat request, picks the best working key for the
 * requested model (round-robin across providers), forwards the request to that
 * provider, and streams the response back to the caller.
 *
 * Auth: Authorization: Bearer <EXPORT_API_TOKEN>
 *
 * Supports: streaming (stream: true) and non-streaming
 * Key selection: fastest-first + round-robin rotation per provider
 * Fallback: if primary key fails (429/401/503), tries next available key
 */

import { NextRequest, NextResponse } from "next/server"
import { validateGatewayToken, pickAnyKey, pickKey, getGatewayStore, GatewayKey } from "@/lib/gateway-cache"
import { PROVIDER_CONFIGS, resolveProviderEndpoint, buildProviderHeaders } from "@/lib/providers"

// Status codes that should trigger fallback to another key
const FALLBACK_STATUS_CODES = new Set([401, 403, 429, 500, 502, 503, 504])

export const runtime = "nodejs"
export const maxDuration = 60

interface ChatMessage {
  role: string
  content: string | unknown
}

interface ChatRequest {
  model: string
  messages: ChatMessage[]
  stream?: boolean
  max_tokens?: number
  temperature?: number
  [key: string]: unknown
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getToken(req: NextRequest): string {
  const auth = req.headers.get("authorization") ?? ""
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""
}

/**
 * Find which provider owns the requested model.
 * First checks the gateway cache (working keys), then falls back to PROVIDER_CONFIGS.
 */
function resolveProvider(token: string, modelId: string): GatewayKey | null {
  // 1. Try to find a key that has this exact model confirmed working
  const byModel = pickAnyKey(token, modelId)
  if (byModel) return byModel

  // 2. Infer provider from model ID prefix (e.g. "gpt-4o" → openai, "claude" → anthropic)
  // Then pick the fastest key for that provider
  const store = getGatewayStore(token)
  if (!store) return null

  const lower = modelId.toLowerCase()
  const providerHints: [string, string[]][] = [
    ["openai",    ["gpt-", "o1", "o3", "o4"]],
    ["anthropic", ["claude"]],
    ["google",    ["gemini"]],
    ["groq",      ["llama", "mixtral", "gemma", "whisper"]],
    ["mistral",   ["mistral", "codestral", "pixtral"]],
    ["cohere",    ["command"]],
    ["fireworks", ["firefunction", "fw-"]],
    ["xai",       ["grok"]],
    ["deepseek",  ["deepseek"]],
    ["cerebras",  ["cerebras"]],
    ["dahono",    ["dahono/"]],
    ["sakana",    ["fugu"]],
  ]

  for (const [providerId, prefixes] of providerHints) {
    if (prefixes.some((p) => lower.startsWith(p) || lower.includes(p))) {
      const key = pickKey(token, providerId)
      if (key) return key
    }
  }

  // 3. Last resort: pick any key with lowest latency
  if (store.keys.length > 0) {
    const sorted = [...store.keys].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)
    return sorted[0]
  }

  return null
}

/**
 * Build the provider-specific request body.
 * For most providers: pass the original request through as-is.
 * For Anthropic: reformat to Anthropic Messages API format.
 * For Google: reformat to Gemini generateContent format.
 */
function buildForwardBody(
  providerId: string,
  body: ChatRequest,
): Record<string, unknown> {
  if (providerId === "anthropic") {
    return {
      model: body.model,
      max_tokens: body.max_tokens ?? 1024,
      messages: body.messages,
      stream: body.stream ?? false,
    }
  }

  if (providerId === "google") {
    // Google Gemini generateContent — non-streaming for simplicity
    const userMsg = body.messages[body.messages.length - 1]
    return {
      contents: [{
        parts: [{ text: typeof userMsg?.content === "string" ? userMsg.content : JSON.stringify(userMsg?.content) }],
      }],
      generationConfig: {
        maxOutputTokens: body.max_tokens ?? 1024,
      },
    }
  }

  // OpenAI-compatible (default for all other providers)
  return {
    model: body.model,
    messages: body.messages,
    max_tokens: body.max_tokens ?? 1024,
    temperature: body.temperature,
    stream: body.stream ?? false,
  }
}

/**
 * Build the endpoint URL for a specific provider + model.
 * Google requires the model in the URL path.
 */
function buildEndpoint(providerId: string, modelId: string, apiKey: string): string | null {
  if (providerId === "google") {
    return `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`
  }
  if (providerId === "huggingface") {
    return `https://api-inference.huggingface.co/models/${modelId}/v1/chat/completions`
  }
  return resolveProviderEndpoint(providerId, apiKey)
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const token = getToken(req)
  if (!token) {
    return NextResponse.json({ error: "Missing Authorization header. Use: Authorization: Bearer <EXPORT_API_TOKEN>" }, { status: 401 })
  }
  if (!validateGatewayToken(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  // ── Parse request ───────────────────────────────────────────────────────────
  let body: ChatRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.model) {
    return NextResponse.json({ error: "model is required" }, { status: 400 })
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 })
  }

  // ── Key selection: build ordered candidate list with fallback ─────────────────
  const primaryKey = resolveProvider(token, body.model)
  if (!primaryKey) {
    return NextResponse.json(
      {
        error: "No working key available for this model. Sync working keys first via POST /api/v1/gateway/push.",
        model: body.model,
      },
      { status: 503 },
    )
  }

  // Build candidate list: primary key first, then all other keys (for fallback)
  const store = getGatewayStore(token)
  const otherKeys: GatewayKey[] = store
    ? store.keys.filter((k) => k.apiKey !== primaryKey.apiKey && k.providerId !== primaryKey.providerId)
    : []
  const candidates = [primaryKey, ...otherKeys]

  // ── Try each candidate key in order ──────────────────────────────────────────
  let lastError = ""
  let lastStatus = 502
  let lastProvider = primaryKey.providerId

  for (const key of candidates) {
    const endpoint = buildEndpoint(key.providerId, body.model, key.apiKey)
    if (!endpoint) continue // skip providers needing extra config

    const headers = buildProviderHeaders(key.providerId, key.apiKey)
    const forwardBody = buildForwardBody(key.providerId, body)

    let upstreamRes: Response
    try {
      upstreamRes = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(forwardBody),
        signal: AbortSignal.timeout(55_000),
      })
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Upstream request failed"
      lastProvider = key.providerId
      lastStatus = 502
      continue // network error — try next key
    }

    if (!upstreamRes.ok && FALLBACK_STATUS_CODES.has(upstreamRes.status)) {
      // Retriable error — record and try next key
      const errText = await upstreamRes.text().catch(() => `HTTP ${upstreamRes.status}`)
      lastError = `Provider '${key.providerId}' returned ${upstreamRes.status}: ${errText.slice(0, 200)}`
      lastProvider = key.providerId
      lastStatus = upstreamRes.status
      continue
    }

    if (!upstreamRes.ok) {
      // Non-retriable error (e.g. 400 bad request) — return immediately
      const errText = await upstreamRes.text().catch(() => `HTTP ${upstreamRes.status}`)
      return NextResponse.json(
        {
          error: `Provider '${key.providerId}' returned ${upstreamRes.status}`,
          upstream_error: errText.slice(0, 500),
          model: body.model,
          provider: key.providerId,
        },
        { status: upstreamRes.status },
      )
    }

    // ── Success: stream or JSON passthrough ─────────────────────────────────
    const contentType = upstreamRes.headers.get("content-type") ?? "application/json"

    if (body.stream && upstreamRes.body) {
      return new NextResponse(upstreamRes.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Miuclaw-Provider": key.providerId,
          "X-Miuclaw-Model": body.model,
        },
      })
    }

    const data = await upstreamRes.json().catch(() => ({}))
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "X-Miuclaw-Provider": key.providerId,
        "X-Miuclaw-Model": body.model,
        "Content-Type": contentType,
      },
    })
  }

  // ── All candidates failed ──────────────────────────────────────────────────
  return NextResponse.json(
    {
      error: `All available keys failed. Last error from '${lastProvider}': ${lastError}`,
      model: body.model,
      provider: lastProvider,
      hint: "Sync fresh working keys via the Keys tab → Export to Miuclaw Gateway.",
    },
    { status: lastStatus },
  )
}
