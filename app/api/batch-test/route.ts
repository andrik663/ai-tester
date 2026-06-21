import { NextRequest, NextResponse } from "next/server"

// ── Shared types (exported so the component can import them) ──────────────────

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

// ── Per-provider model list + endpoint config ─────────────────────────────────
// Each entry describes how to build a request for that provider.

export interface ProviderConfig {
  id: string
  /** List of model IDs to test */
  models: string[]
  /** OpenAI-compatible endpoint */
  endpoint: string
  /** How to build the Authorization / API-key header */
  authHeader: (key: string) => Record<string, string>
  /** Extra static headers */
  extraHeaders?: Record<string, string>
  /** How to build the request body (JSON-serialisable) */
  buildBody: (modelId: string) => Record<string, unknown>
  /** Where to find the assistant text in the response */
  extractReply?: (parsed: Record<string, unknown>) => string | undefined
  /** Whether to append ?key=... to the URL instead of using a header */
  keyInUrl?: boolean
}

const TEST_PROMPT = "halo"
const MAX_TOKENS  = 64

// Standard OpenAI-style reply extractor
function openaiReply(p: Record<string, unknown>): string | undefined {
  try {
    const choices = p.choices as Record<string, unknown>[]
    return (choices[0]?.message as Record<string, unknown>)?.content as string
  } catch { return undefined }
}

// Anthropic reply extractor
function anthropicReply(p: Record<string, unknown>): string | undefined {
  try {
    const content = p.content as Record<string, unknown>[]
    return content[0]?.text as string
  } catch { return undefined }
}

// Google Gemini reply extractor
function geminiReply(p: Record<string, unknown>): string | undefined {
  try {
    const candidates = p.candidates as Record<string, unknown>[]
    const content = candidates[0]?.content as Record<string, unknown>
    const parts = content?.parts as Record<string, unknown>[]
    return parts[0]?.text as string
  } catch { return undefined }
}

// Token usage extractor (standard OpenAI)
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

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  // ── Anthropic ─────────────────────────────────────────────────────────────
  anthropic: {
    id: "anthropic",
    models: [
      "claude-opus-4-5",
      "claude-opus-4-0",
      "claude-sonnet-4-5",
      "claude-sonnet-4-0",
      "claude-haiku-4-5",
      "claude-3-5-haiku-20241022",
      "claude-3-5-sonnet-20241022",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307",
    ],
    endpoint: "https://api.anthropic.com/v1/messages",
    authHeader: (key) => ({ "x-api-key": key }),
    extraHeaders: { "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: anthropicReply,
  },

  // ── OpenAI ────────────────────────────────────────────────────────────────
  openai: {
    id: "openai",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-4",
      "gpt-3.5-turbo",
      "gpt-3.5-turbo-16k",
      "o1",
      "o1-mini",
      "o3-mini",
      "o4-mini",
    ],
    endpoint: "https://api.openai.com/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Google Gemini ─────────────────────────────────────────────────────────
  google: {
    id: "google",
    models: [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
    ],
    // URL built dynamically per model — endpoint is a template
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{{MODEL}}:generateContent",
    authHeader: () => ({ "Content-Type": "application/json" }),
    keyInUrl: true,
    buildBody: () => ({
      contents: [{ parts: [{ text: TEST_PROMPT }] }],
      generationConfig: { maxOutputTokens: MAX_TOKENS },
    }),
    extractReply: geminiReply,
  },

  // ── xAI (Grok) ───────────────────────────────────────────────────────────
  xai: {
    id: "xai",
    models: [
      "grok-3",
      "grok-3-fast",
      "grok-3-mini",
      "grok-3-mini-fast",
      "grok-2",
      "grok-2-mini",
      "grok-beta",
    ],
    endpoint: "https://api.x.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── DeepSeek ──────────────────────────────────────────────────────────────
  deepseek: {
    id: "deepseek",
    models: [
      "deepseek-chat",
      "deepseek-reasoner",
    ],
    endpoint: "https://api.deepseek.com/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      stream: false,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Qwen (Alibaba) ────────────────────────────────────────────────────────
  qwen: {
    id: "qwen",
    models: [
      "qwen-plus",
      "qwen-turbo",
      "qwen-long",
      "qwen-max",
      "qwen2.5-72b-instruct",
      "qwen2.5-32b-instruct",
      "qwen2.5-14b-instruct",
      "qwen2.5-7b-instruct",
      "qwen3-235b-a22b",
      "qwen3-32b",
      "qwen3-8b",
    ],
    endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Zhipu / GLM ───────────────────────────────────────────────────────────
  zhipu: {
    id: "zhipu",
    models: [
      "glm-4-flash",
      "glm-4-air",
      "glm-4-airx",
      "glm-4-plus",
      "glm-4",
      "glm-z1-flash",
      "glm-z1-air",
      "glm-z1-airx",
    ],
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── MiniMax ───────────────────────────────────────────────────────────────
  minimax: {
    id: "minimax",
    models: [
      "MiniMax-Text-01",
      "MiniMax-M1",
      "abab6.5s-chat",
      "abab6.5g-chat",
      "abab6.5t-chat",
    ],
    endpoint: "https://api.minimaxi.chat/v1/text/chatcompletion_v2",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Groq ──────────────────────────────────────────────────────────────────
  groq: {
    id: "groq",
    models: [
      "llama-3.1-8b-instant",
      "llama-3.3-70b-versatile",
      "llama-3.1-70b-versatile",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
      "gemma-7b-it",
      "qwen-qwq-32b",
      "deepseek-r1-distill-llama-70b",
      "compound-beta",
    ],
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Together AI ───────────────────────────────────────────────────────────
  together: {
    id: "together",
    models: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "mistralai/Mistral-7B-Instruct-v0.3",
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
      "deepseek-ai/DeepSeek-R1",
      "deepseek-ai/DeepSeek-V3",
      "google/gemma-2-9b-it",
    ],
    endpoint: "https://api.together.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Mistral ───────────────────────────────────────────────────────────────
  mistral: {
    id: "mistral",
    models: [
      "mistral-small-latest",
      "mistral-medium-latest",
      "mistral-large-latest",
      "open-mistral-7b",
      "open-mixtral-8x7b",
      "open-mixtral-8x22b",
      "codestral-latest",
      "mistral-nemo",
    ],
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Cohere ────────────────────────────────────────────────────────────────
  cohere: {
    id: "cohere",
    models: [
      "command-r-plus",
      "command-r",
      "command",
      "command-light",
      "command-r7b-12-2024",
    ],
    endpoint: "https://api.cohere.ai/v2/chat",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: (p) => {
      try {
        const msg = (p.message as Record<string, unknown>)
        const content = msg?.content as Record<string, unknown>[]
        return content?.[0]?.text as string
      } catch { return undefined }
    },
  },

  // ── Perplexity ────────────────────────────────────────────────────────────
  perplexity: {
    id: "perplexity",
    models: [
      "sonar",
      "sonar-pro",
      "sonar-reasoning",
      "sonar-reasoning-pro",
      "r1-1776",
    ],
    endpoint: "https://api.perplexity.ai/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── HuggingFace ───────────────────────────────────────────────────────────
  huggingface: {
    id: "huggingface",
    models: [
      "meta-llama/Llama-3.3-70B-Instruct",
      "meta-llama/Llama-3.1-8B-Instruct",
      "mistralai/Mistral-7B-Instruct-v0.3",
      "Qwen/Qwen2.5-72B-Instruct",
      "google/gemma-2-9b-it",
      "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
    ],
    endpoint: "https://api-inference.huggingface.co/models/{{MODEL}}/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },
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
  // Build URL (handle {{MODEL}} templates and keyInUrl)
  let url = cfg.endpoint.replace("{{MODEL}}", encodeURIComponent(modelId))
  if (cfg.keyInUrl) {
    url += `?key=${encodeURIComponent(apiKey)}`
  }

  const authHdrs = cfg.authHeader(apiKey)
  const extraHdrs = cfg.extraHeaders ?? {}
  const allHeaders: Record<string, string> = { ...authHdrs, ...extraHdrs }
  if (!("Content-Type" in allHeaders)) allHeaders["Content-Type"] = "application/json"

  const bodyObj = cfg.buildBody(modelId)
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
    try { parsed = await res.json() } catch { /* non-json */ }

    const reply = parsed ? cfg.extractReply?.(parsed) : undefined
    const tokenUsage = parsed ? extractTokenUsage(parsed) : undefined

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
  try {
    const body = await req.json()
    providerId = String(body.providerId ?? "").trim()
    apiKey     = String(body.apiKey     ?? "").trim()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!apiKey || apiKey.length < 4) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 })
  }

  // ── Dahono: fetch live model list from gateway ────────────────────────────
  if (providerId === "dahono") {
    const GATEWAY = "https://gateway.dahono.com/v1"
    let models: { id: string; tier: string; free: boolean }[] = []
    try {
      const r = await fetch(`${GATEWAY}/models`, {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(12_000),
      })
      if (!r.ok) return NextResponse.json({ error: `Could not fetch Dahono models: HTTP ${r.status}` }, { status: r.status })
      const d = await r.json()
      models = (d?.data ?? []).map((m: Record<string, unknown>) => ({
        id: String(m.id), tier: String(m.tier ?? "free"), free: Boolean(m.free),
      }))
    } catch (err) {
      return NextResponse.json({ error: `Dahono model list error: ${err instanceof Error ? err.message : "unknown"}` }, { status: 502 })
    }
    if (models.length === 0) return NextResponse.json({ error: "No models found" }, { status: 404 })

    const dahonoEndpoint = `${GATEWAY}/chat/completions`
    const start = Date.now()
    const tasks = models.map((m) => () => testModel(m.id, {
      id: "dahono",
      models: [],
      endpoint: dahonoEndpoint,
      authHeader: (k) => ({ Authorization: `Bearer ${k}` }),
      extraHeaders: { "Content-Type": "application/json" },
      buildBody: (modelId) => ({ model: modelId, max_tokens: MAX_TOKENS, messages: [{ role: "user", content: TEST_PROMPT }] }),
      extractReply: openaiReply,
    }, apiKey))
    const results = await pLimit(tasks, 8)
    const durationMs = Date.now() - start
    const passed = results.filter((r) => r.ok).length
    return NextResponse.json({ provider: "dahono", total: results.length, passed, failed: results.length - passed, results, durationMs } satisfies BatchTestResponse)
  }

  // ── Static model list providers ───────────────────────────────────────────
  const cfg = PROVIDER_CONFIGS[providerId]
  if (!cfg) {
    return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 })
  }

  const start = Date.now()
  const tasks = cfg.models.map((modelId) => () => testModel(modelId, cfg, apiKey))
  const results = await pLimit(tasks, 6)
  const durationMs = Date.now() - start
  const passed = results.filter((r) => r.ok).length

  return NextResponse.json({
    provider: providerId,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
    durationMs,
  } satisfies BatchTestResponse)
}
