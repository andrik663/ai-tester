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
import { getInternalToken, pickAnyKey, pickKey, getGatewayStore, GatewayKey } from "@/lib/gateway-cache"
import { PROVIDER_CONFIGS, resolveProviderEndpoint, buildProviderHeaders } from "@/lib/providers"
import { writeGatewayLog } from "@/lib/gateway-logs"

// Status codes that should trigger fallback to another key
const FALLBACK_STATUS_CODES = new Set([401, 403, 429, 500, 502, 503, 504])

/**
 * Default max_tokens when the caller does not specify one.
 * 16 384 is a safe high default — enough for full web page / code generation
 * without hitting any provider's hard cap on the common models.
 */
const DEFAULT_MAX_TOKENS = 16_384

/**
 * Hard cap per provider — prevents sending a value the provider will reject.
 * Values are based on each provider's latest documented output-token limits
 * (verified June 2025).
 *
 * Rules:
 *  - If a provider raises its limit in the future, update only this map.
 *  - resolveMaxTokens() clamps the caller's value to this cap automatically.
 */
const PROVIDER_MAX_TOKENS: Record<string, number> = {
  // ── Major cloud / frontier providers ───────────────────────────────────────
  openai:       16_384,  // GPT-4o, o-series: 16 384 output tokens (OpenAI docs 2025)
  anthropic:   128_000,  // Claude Sonnet 4.x / Claude 4 Opus: up to 128k output tokens
  google:       65_535,  // Gemini 2.5 Pro/Flash: 65 535 max output tokens
  xai:          32_768,  // Grok-3 / Grok-3 Mini: 32k output (field not sent to Responses API)

  // ── Specialised inference / routing providers ───────────────────────────────
  groq:          8_192,  // Groq hard-caps most models at 8 192 output tokens
  mistral:      32_768,  // Mistral Large 3 (675B): 32k output
  cohere:        8_000,  // Command A-03-2025: 8 000 output tokens
  perplexity:  128_000,  // Sonar Pro/Reasoning: up to 128k via max_tokens param
  deepseek:     32_768,  // DeepSeek V3 / R1: max generation length 32 768
  qwen:         32_768,  // Qwen3 235B supports 32 768 output tokens
  zhipu:         8_192,  // GLM-4 series: 8 192 output tokens
  minimax:       8_192,  // MiniMax Text 01: 8 192 output tokens
  cerebras:     32_768,  // Qwen3-235B on Cerebras: 32 768; GPT-OSS 120B: 16 384
  fireworks:    32_768,  // Fireworks: varies; Llama-4 Scout/Maverick support 32k+
  together:     32_768,  // Together AI: 32k for large Llama / Qwen models
  huggingface:   8_192,  // HuggingFace Inference API: model-dependent, 8k safe max
  sambanova:    16_000,  // SambaNova Llama 3.1 405B: 16 000 output tokens
  nvidia:       32_768,  // NVIDIA NIM (Llama 3.1 70B+): 32k
  deepinfra:    32_768,  // DeepInfra (Llama / Mistral): 32k output
  hyperbolic:   32_768,  // Hyperbolic: 32k for large models
  siliconflow:  32_768,  // SiliconFlow (Qwen / Llama): 32k
  novita:       32_768,  // Novita AI: 32k output
  nebius:       32_768,  // Nebius AI Studio: 32k
  featherless:  32_768,  // Featherless (OSS models): 32k
  lepton:       32_768,  // Lepton AI: 32k
  friendli:     32_768,  // Friendli AI: 32k

  // ── Gateways (routes to underlying models — use a generous but safe cap) ────
  dahono:       65_535,  // Dahono/Miuclaw gateway — cap matches the highest underlying model (Gemini)
  openrouter:   65_535,  // OpenRouter: routes to any provider, allow up to 65k
  bynara:       32_768,  // NaraRouter — routes Claude, Gemini, DeepSeek, Qwen; 32k safe cap
  marketku:     65_535,  // Marketku router — 65k (highest underlying model)
  conduit:      65_535,  // Conduit gateway — 65k
  zenmux:       65_535,  // ZenMux gateway — 65k
  miuclaw:      65_535,  // Miuclaw self-hosted gateway — 65k
  openmodel:    65_535,  // OpenModel gateway — 65k
  avian:        65_535,  // Avian gateway — 65k
}

/** Resolve effective max_tokens: clamp user value to provider cap, or use default. */
function resolveMaxTokens(providerId: string, requested?: number): number {
  const cap = PROVIDER_MAX_TOKENS[providerId] ?? DEFAULT_MAX_TOKENS
  if (requested && requested > 0) {
    return Math.min(requested, cap)
  }
  return Math.min(DEFAULT_MAX_TOKENS, cap)
}

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

/**
 * Find which provider owns the requested model.
 * First checks the gateway cache (working keys), then falls back to PROVIDER_CONFIGS.
 */
async function resolveProvider(token: string, modelId: string): Promise<GatewayKey | null> {
  // 1. Try to find a key that has this exact model confirmed working
  const byModel = await pickAnyKey(token, modelId)
  if (byModel) return byModel

  // 1.5. "miuclaw/auto" is the virtual router model — it always means "pick
  // whatever working key is fastest", regardless of what that key's actual
  // provider/model is. It must be resolved here, before the provider-prefix
  // heuristics below, because "miuclaw/auto" itself contains a "/" and would
  // otherwise be (wrongly) treated as an explicit "provider/model" reference
  // with no matching provider hint — which made auto-routing always fail
  // with "No working key available" even when keys were synced.
  if (modelId.toLowerCase() === "miuclaw/auto") {
    const store = await getGatewayStore(token)
    if (!store || store.keys.length === 0) return null
    const sorted = [...store.keys].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)
    return sorted[0]
  }

  // 2. Infer provider from model ID prefix (e.g. "gpt-4o" → openai, "claude" → anthropic)
  // Then pick the fastest key for that provider
  const store = await getGatewayStore(token)
  if (!store) return null

  const lower = modelId.toLowerCase()
  const providerHints: [string, string[]][] = [
    // Major western providers
    ["openai",      ["gpt-", "o1", "o3", "o4", "chatgpt"]],
    ["anthropic",   ["claude"]],
    ["google",      ["gemini", "palm"]],
    ["groq",        ["llama", "mixtral", "gemma", "whisper", "guard"]],
    ["mistral",     ["mistral", "codestral", "pixtral", "magistral", "devstral"]],
    ["cohere",      ["command", "embed-", "rerank"]],
    ["fireworks",   ["firefunction", "fw-", "accounts/fireworks"]],
    ["xai",         ["grok"]],
    ["deepseek",    ["deepseek"]],
    ["cerebras",    ["cerebras", "zai-glm", "zai-"]],
    ["together",    ["togethercomputer", "zai-org/", "meta-llama", "mistralai/", "togetherapi"]],
    // Chinese providers
    ["zhipu",       ["glm-", "cogview", "cogvideo", "embedding-"]],
    ["qwen",        ["qwen", "qwq", "qvq"]],
    ["moonshot",    ["moonshot", "kimi"]],
    ["baidu",       ["ernie", "wenxin", "baidu"]],
    ["yi",          ["yi-", "01-ai"]],
    ["minimax",     ["minimax", "abab"]],
    ["stepfun",     ["step-"]],
    ["hunyuan",     ["hunyuan"]],
    // Infrastructure / routing providers
    ["openrouter",  ["openrouter/", "anthropic/", "x-ai/", "nousresearch/", "nvidia/"]],
    ["siliconflow", ["siliconflow", "pro/", "free/"]],
    ["novita",      ["novita", "meta/llama", "microsoft/phi"]],
    ["nebius",      ["nebius"]],
    ["hyperbolic",  ["hyperbolic", "meta-llama/", "Qwen/"]],
    ["sambanova",   ["sambanova", "samba"]],
    ["nvidia",      ["nvidia/", "nv-"]],
    ["perplexity",  ["pplx-", "sonar", "llama-3.1-sonar"]],
    ["deepinfra",   ["deepinfra", "Phind/", "lizpreciatior/"]],
    ["featherless", ["featherless"]],
    ["lepton",      ["lepton"]],
    ["friendli",    ["friendli"]],
    // Other / self-hosted
    ["dahono",      ["dahono/"]],
    ["sakana",      ["fugu"]],
    ["telnyx",      ["telnyx"]],
    ["parasail",    ["parasail"]],
    ["marketku",    ["marketku"]],
    ["openmodel",   ["openmodel"]],
  ]

  for (const [providerId, prefixes] of providerHints) {
    if (prefixes.some((p) => lower.startsWith(p) || lower.includes(p))) {
      const key = await pickKey(token, providerId)
      if (key) return key
    }
  }

  // 3. Last resort: if the model has no provider/ prefix and no hint matched,
  //    try picking from any key (lowest latency). This handles new/unknown models
  //    that may just work on a general-purpose provider.
  const hasProviderPrefix = lower.includes("/")
  if (!hasProviderPrefix && store.keys.length > 0) {
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
/**
 * Strip provider-prefix from model ID if present (e.g. "dahono/deepseek-v3.2" → "deepseek-v3.2").
 * Some providers store model IDs with their own prefix which must be removed when forwarding.
 */
function stripProviderPrefix(modelId: string, providerId: string): string {
  const prefix = `${providerId}/`
  return modelId.startsWith(prefix) ? modelId.slice(prefix.length) : modelId
}

function buildForwardBody(
  providerId: string,
  body: ChatRequest,
): Record<string, unknown> {
  // Strip provider prefix from model before forwarding (e.g. "dahono/deepseek-v3.2" → "deepseek-v3.2")
  const model = stripProviderPrefix(body.model, providerId)

  // Resolve effective max_tokens: respect caller's value but clamp to provider cap
  const maxTokens = resolveMaxTokens(providerId, body.max_tokens)

  if (providerId === "anthropic") {
    return {
      model,
      max_tokens: maxTokens,
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
        maxOutputTokens: maxTokens,
      },
    }
  }

  // xAI Responses API — does not accept max_tokens field
  if (providerId === "xai") {
    return {
      model,
      input: body.messages,
      stream: body.stream ?? false,
    }
  }

  // OpenAI-compatible (default for all other providers)
  return {
    model,
    messages: body.messages,
    max_tokens: maxTokens,
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
  // ── Resolve internal gateway token from server env ──────────────────────────
  const token = getInternalToken()
  if (!token) {
    return NextResponse.json(
      { error: "Server misconfiguration: EXPORT_API_TOKEN env var not set" },
      { status: 503 },
    )
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
  const primaryKey = await resolveProvider(token, body.model)
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
  const store = await getGatewayStore(token)
  const otherKeys: GatewayKey[] = store
    ? store.keys.filter((k) => k.apiKey !== primaryKey.apiKey && k.providerId !== primaryKey.providerId)
    : []
  const candidates = [primaryKey, ...otherKeys]

  // ── Try each candidate key in order ──────────────────────────────────────────
  let lastError = ""
  let lastStatus = 502
  let lastProvider = primaryKey.providerId
  let attemptCount = 0

  const isAutoModel = body.model.toLowerCase() === "miuclaw/auto"

  for (const key of candidates) {
    // "miuclaw/auto" is a virtual router model with no meaning to the actual
    // upstream provider — each candidate key must forward its own real model
    // (the one it was confirmed working with) instead of the literal string
    // "miuclaw/auto", or the provider will reject the request outright.
    const requestModel = isAutoModel ? key.modelIds[0] ?? body.model : body.model
    const forwardRequest = isAutoModel ? { ...body, model: requestModel } : body

    const endpoint = buildEndpoint(key.providerId, requestModel, key.apiKey)
    if (!endpoint) continue // skip providers needing extra config

    const headers = buildProviderHeaders(key.providerId, key.apiKey)
    const forwardBody = buildForwardBody(key.providerId, forwardRequest)
    attemptCount++
    const t0 = Date.now()

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
      // fire-and-forget log write
      writeGatewayLog({
        model: body.model, providerId: key.providerId, providerName: key.providerName,
        success: false, statusCode: 502, latencyMs: Date.now() - t0,
        errorMessage: lastError.slice(0, 200), streaming: !!body.stream,
        fallbackUsed: attemptCount > 1, attemptCount,
      }).catch(() => {})
      continue // network error — try next key
    }

    if (!upstreamRes.ok && FALLBACK_STATUS_CODES.has(upstreamRes.status)) {
      // Retriable error — record and try next key
      const errText = await upstreamRes.text().catch(() => `HTTP ${upstreamRes.status}`)
      lastError = `Provider '${key.providerId}' returned ${upstreamRes.status}: ${errText.slice(0, 200)}`
      lastProvider = key.providerId
      lastStatus = upstreamRes.status
      writeGatewayLog({
        model: body.model, providerId: key.providerId, providerName: key.providerName,
        success: false, statusCode: upstreamRes.status, latencyMs: Date.now() - t0,
        errorMessage: lastError.slice(0, 200), streaming: !!body.stream,
        fallbackUsed: attemptCount > 1, attemptCount,
      }).catch(() => {})
      continue
    }

    if (!upstreamRes.ok) {
      // Non-retriable error (e.g. 400 bad request) — return immediately
      const errText = await upstreamRes.text().catch(() => `HTTP ${upstreamRes.status}`)
      writeGatewayLog({
        model: body.model, providerId: key.providerId, providerName: key.providerName,
        success: false, statusCode: upstreamRes.status, latencyMs: Date.now() - t0,
        errorMessage: errText.slice(0, 200), streaming: !!body.stream,
        fallbackUsed: attemptCount > 1, attemptCount,
      }).catch(() => {})
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
    const latencyMs = Date.now() - t0

    if (body.stream && upstreamRes.body) {
      writeGatewayLog({
        model: body.model, providerId: key.providerId, providerName: key.providerName,
        success: true, statusCode: 200, latencyMs,
        streaming: true, fallbackUsed: attemptCount > 1, attemptCount,
      }).catch(() => {})
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
    const usage = (data as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage
    writeGatewayLog({
      model: body.model, providerId: key.providerId, providerName: key.providerName,
      success: true, statusCode: 200, latencyMs,
      streaming: false, fallbackUsed: attemptCount > 1, attemptCount,
      promptTokens:     usage?.prompt_tokens     ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
    }).catch(() => {})
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "X-Miuclaw-Provider": key.providerId,
        "X-Miuclaw-Model": body.model,
        "Content-Type": contentType,
      },
    })
  }

  // ── All candidates failed ─────────────────────────────────────────────────
  writeGatewayLog({
    model: body.model, providerId: lastProvider, providerName: lastProvider,
    success: false, statusCode: lastStatus, latencyMs: 0,
    errorMessage: `All keys failed: ${lastError.slice(0, 200)}`,
    streaming: !!body.stream, fallbackUsed: true, attemptCount,
  }).catch(() => {})
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
