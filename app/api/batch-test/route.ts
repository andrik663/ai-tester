import { NextRequest, NextResponse } from "next/server"
import {
  PROVIDER_CONFIGS as SHARED_PROVIDER_CONFIGS,
  DEFAULT_PROMPT,
  BATCH_MAX_TOKENS,
  fetchLiveModels,
  normalizeCustomChatEndpoint,
  normalizeCustomModelsEndpoint,
  type ProviderConfig,
} from "@/lib/providers"

/**
 * Build a generic OpenAI-compatible config for a user-created custom provider.
 * Accepts a base URL (https://api.example.com), a /v1 base, or a full chat URL.
 */
function buildCustomProviderConfig(chatEndpoint: string, customHeaders?: Record<string, string>): ProviderConfig {
  return {
    id: "custom",
    models: [],
    endpoint: chatEndpoint,
    authHeader: (key: string) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: customHeaders,
    buildBody: (modelId: string, maxTokens?: number) => ({
      model: modelId,
      max_tokens: maxTokens ?? BATCH_MAX_TOKENS,
      messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: (parsed) => {
      const choices = (parsed as { choices?: Array<{ message?: { content?: string } }> }).choices
      return choices?.[0]?.message?.content
    },
  }
}

/** Fetch the live model list for a custom provider from its /models endpoint. */
async function fetchCustomLiveModels(
  modelsEndpoint: string,
  apiKey: string,
  timeoutMs = 10_000,
): Promise<string[]> {
  try {
    const res = await fetch(modelsEndpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { data?: { id?: string }[]; models?: { id?: string }[] }
    const entries = data?.data ?? data?.models ?? []
    return entries
      .map((m) => (typeof m?.id === "string" ? m.id : ""))
      .filter((id) => id && id !== "unknown")
  } catch {
    return []
  }
}

// Re-export so existing component imports still compile
export { SHARED_PROVIDER_CONFIGS as PROVIDER_CONFIGS }
export type { ProviderConfig }

// ── Shared types ──────────────────────────────────────────────────────────────

export interface BatchModelResult {
  modelId: string
  ok: boolean
  status: number
  latencyMs: number
  reply?: string
  errorMsg?: string
  tokenUsage?: { prompt?: number; completion?: number; total?: number }
  curlFull: string
}

export interface BatchTestResponse {
  provider: string
  total: number
  passed: number
  failed: number
  results: BatchModelResult[]
  durationMs: number
}

const MAX_TOKENS = 64

// ── Token usage extractor (OpenAI + Anthropic + Gemini) ───────────────────────

function extractTokenUsage(p: Record<string, unknown>): BatchModelResult["tokenUsage"] {
  if (!p.usage || typeof p.usage !== "object") return undefined
  const u = p.usage as Record<string, unknown>
  return {
    prompt:     typeof u.prompt_tokens     === "number" ? u.prompt_tokens     :
                typeof u.input_tokens      === "number" ? u.input_tokens      : undefined,
    completion: typeof u.completion_tokens === "number" ? u.completion_tokens :
                typeof u.output_tokens     === "number" ? u.output_tokens     : undefined,
    total:      typeof u.total_tokens      === "number" ? u.total_tokens      : undefined,
  }
}

// ── cURL builder ──────────────────────────────────────────────────────────────

function buildCurlFull(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): string {
  const bodyStr = JSON.stringify(body)
  const parts = [`curl -X POST '${url}'`]
  for (const [k, v] of Object.entries(headers)) {
    parts.push(`  -H '${k}: ${v}'`)
  }
  parts.push(`  -d '${bodyStr.replace(/'/g, "'\\''")}'`)
  return parts.join(" \\\n")
}

// ── Model tester ──────────────────────────────────────────────────────────────

async function testModel(
  modelId: string,
  cfg: ProviderConfig,
  apiKey: string,
): Promise<BatchModelResult> {
  // Build URL (handle {{MODEL}}, {{ACCOUNT_ID}} templates and keyInUrl)
  const accountId = apiKey.includes("|") ? apiKey.split("|")[0] : ""
  let url = cfg.endpoint
    .replace("{{MODEL}}", encodeURIComponent(modelId))
    .replace("{{ACCOUNT_ID}}", encodeURIComponent(accountId))
  if (cfg.keyInUrl) {
    url += `?key=${encodeURIComponent(apiKey)}`
  }

  const authHdrs  = cfg.authHeader(apiKey)
  const extraHdrs = cfg.extraHeaders ?? {}
  const allHeaders: Record<string, string> = { ...extraHdrs, ...authHdrs }
  if (!("Content-Type" in allHeaders)) allHeaders["Content-Type"] = "application/json"

  // Use provider's buildBody with batch MAX_TOKENS
  const bodyObj = cfg.buildBody(modelId, MAX_TOKENS)
  const curlFull = buildCurlFull(url, allHeaders, bodyObj)

  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: allHeaders,
      body: JSON.stringify(bodyObj),
      signal: AbortSignal.timeout(20_000),
    })
    const latencyMs = Date.now() - start

    let parsed: Record<string, unknown> | null = null
    try { parsed = await res.json() } catch { /* non-json body */ }

    const reply      = parsed ? cfg.extractReply?.(parsed) : undefined
    const tokenUsage = parsed ? extractTokenUsage(parsed)  : undefined

    let errorMsg: string | undefined
    if (!res.ok && parsed) {
      const err = parsed.error
      if (typeof err === "string") errorMsg = err
      else if (err && typeof err === "object") {
        const e = err as Record<string, unknown>
        errorMsg = String(e.message ?? e.code ?? JSON.stringify(err))
      } else {
        errorMsg = `HTTP ${res.status} ${res.statusText}`
      }
    } else if (!res.ok) {
      errorMsg = `HTTP ${res.status} ${res.statusText}`
    }

    return { modelId, ok: res.ok, status: res.status, latencyMs, reply, errorMsg, tokenUsage, curlFull }
  } catch (err) {
    return {
      modelId,
      ok: false,
      status: 0,
      latencyMs: Date.now() - start,
      errorMsg: err instanceof Error ? err.message : "Unknown error",
      curlFull,
    }
  }
}

// ── Concurrency limiter ───────────────────────────────────────────────────────

async function pLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIdx = 0
  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++
      results[idx] = await tasks[idx]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let providerId = ""
  let apiKey = ""
  let customEndpoint = ""
  let customModels: string[] = []
  try {
    const body = await req.json()
    providerId = String(body.providerId ?? "").trim()
    apiKey     = String(body.apiKey     ?? "").trim()
    customEndpoint = String(body.customEndpoint ?? "").trim()
    if (Array.isArray(body.customModels)) {
      customModels = body.customModels.map((m: unknown) => String(m).trim()).filter(Boolean)
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!apiKey || apiKey.length < 4) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 })
  }

  // ── Custom provider path: requires a customEndpoint (base or full chat URL) ──
  const isCustom = !SHARED_PROVIDER_CONFIGS[providerId]
  if (isCustom) {
    const chatEndpoint = normalizeCustomChatEndpoint(customEndpoint)
    if (!chatEndpoint) {
      return NextResponse.json(
        { error: `Provider kustom "${providerId}" membutuhkan Endpoint URL (https://domain.com, https://domain.com/v1, atau URL lengkap /chat/completions)` },
        { status: 400 },
      )
    }
    const cfg = buildCustomProviderConfig(chatEndpoint)

    // Model list: user-typed models first, else live /v1/models fetch.
    let modelIds = customModels
    let modelSource: string = "custom"
    if (modelIds.length === 0) {
      const modelsUrl = normalizeCustomModelsEndpoint(customEndpoint)
      if (modelsUrl) {
        const live = await fetchCustomLiveModels(modelsUrl, apiKey)
        if (live.length > 0) {
          modelIds = live
          modelSource = "live"
        }
      }
    }
    if (modelIds.length === 0) {
      return NextResponse.json(
        { error: `Tidak ada model untuk "${providerId}". Isi daftar model di konfigurasi atau pastikan GET ${normalizeCustomModelsEndpoint(customEndpoint)} merespons.` },
        { status: 404 },
      )
    }

    const start = Date.now()
    const tasks = modelIds.map((modelId) => () => testModel(modelId, cfg, apiKey))
    const results = await pLimit(tasks, cfg.concurrencyLimit ?? 6)
    const durationMs = Date.now() - start
    return NextResponse.json({
      provider: providerId,
      total: results.length,
      passed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
      durationMs,
      modelSource,
    } satisfies BatchTestResponse & { modelSource: string })
  }

  const cfg = SHARED_PROVIDER_CONFIGS[providerId]

  // ── Resolve model list: live fetch if provider supports it, else static ────
  // This makes Dahono (and any other provider with modelsEndpoint) always use
  // the same live model list as the single-key tester — no more hardcoded subset.
  const { models: liveModels, source } = await fetchLiveModels(providerId, apiKey, 12_000)
  const modelIds = liveModels.map((m) => m.id)

  if (modelIds.length === 0) {
    return NextResponse.json({
      error: `No models available for provider "${providerId}" (source: ${source})`,
    }, { status: 404 })
  }

  const start = Date.now()
  const tasks = modelIds.map((modelId) => () => testModel(modelId, cfg, apiKey))
  const results = await pLimit(tasks, cfg.concurrencyLimit ?? 6)
  const durationMs = Date.now() - start
  const passed = results.filter((r) => r.ok).length

  return NextResponse.json({
    provider: providerId,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
    durationMs,
    // Include source so the UI can show "70 models (live)" vs "8 models (static)"
    modelSource: source,
  } satisfies BatchTestResponse & { modelSource: string })
}
