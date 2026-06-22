import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

// ── Shared key-masking helper (single source of truth) ───────────────────────
// Exposes exactly 8 chars of prefix + 6 mask dots. Used by both route and UI.
export function maskApiKey(apiKey: string): string {
  const prefix = apiKey.slice(0, 8)
  const dots = "•".repeat(Math.min(6, Math.max(0, apiKey.length - 8)))
  return `${prefix}${dots}`
}

// ── Exported types ────────────────────────────────────────────────────────────

export interface MultiKeyEntry {
  provider: string
  apiKey: string
  label?: string
}

export interface TokenUsage {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

export interface MultiKeyResult {
  provider: string
  apiKeyMasked: string
  label: string
  ok: boolean
  status: number
  statusText: string
  chatReply?: string
  durationMs: number
  error?: string
  modelUsed?: string
  tokenUsage?: TokenUsage
}

export interface MultiKeyTestResponse {
  results: MultiKeyResult[]
  totalMs: number
  passed: number
  failed: number
}

// ── Provider endpoint map ─────────────────────────────────────────────────────

const ENDPOINTS: Record<string, string> = {
  dahono:      "https://gateway.dahono.com/v1/chat/completions",
  anthropic:   "https://api.anthropic.com/v1/messages",
  openai:      "https://api.openai.com/v1/chat/completions",
  google:      "", // handled specially — key appended to URL
  xai:         "https://api.x.ai/v1/chat/completions",
  deepseek:    "https://api.deepseek.com/chat/completions",
  qwen:        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
  zhipu:       "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  minimax:     "https://api.minimax.io/v1/chat/completions",
  cerebras:    "https://api.cerebras.ai/v1/chat/completions",
  fireworks:   "https://api.fireworks.ai/inference/v1/chat/completions",
  novita:      "https://api.novita.ai/openai/v1/chat/completions",
  cloudflare:  "", // handled specially — needs account ID
  openrouter:  "https://openrouter.ai/api/v1/chat/completions",
  sambanova:   "https://api.sambanova.ai/v1/chat/completions",
  nvidia:      "https://integrate.api.nvidia.com/v1/chat/completions",
  hyperbolic:  "https://api.hyperbolic.xyz/v1/chat/completions",
  ai21:        "https://api.ai21.com/studio/v1/chat/completions",
  groq:        "https://api.groq.com/openai/v1/chat/completions",
  together:    "https://api.together.ai/v1/chat/completions",
  mistral:     "https://api.mistral.ai/v1/chat/completions",
  cohere:      "https://api.cohere.com/v2/chat",
  perplexity:  "https://api.perplexity.ai/chat/completions",
  huggingface: "https://api-inference.huggingface.co/models/meta-llama/Llama-3.3-70B-Instruct/v1/chat/completions",
  replicate:   "https://api.replicate.com/v1/models/meta/meta-llama-3-8b-instruct/predictions",
  moonshot:    "https://api.moonshot.cn/v1/chat/completions",
  baidu:       "https://qianfan.baidubce.com/v2/chat/completions",
  yi:          "https://api.lingyiwanwu.com/v1/chat/completions",
  stepfun:     "https://api.stepfun.ai/v1/chat/completions",
  hunyuan:     "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
  azure:       "", // needs resource name
  upstage:     "https://api.upstage.ai/v1/chat/completions",
  writer:      "https://api.writer.com/v1/chat",
  lepton:      "https://api.lepton.ai/v1/chat/completions",
  inception:   "https://api.inceptionlabs.ai/v1/chat/completions",
  ibm:         "https://us-south.ml.cloud.ibm.com/ml/v1/text/chat?version=2023-05-29",
  deepinfra:   "https://api.deepinfra.com/v1/openai/chat/completions",
  anyscale:    "https://api.endpoints.anyscale.com/v1/chat/completions",
  neets:       "https://api.neets.ai/v1/chat/completions",
  lamini:      "https://api.lamini.ai/v1/completions",
}

// ── Model catalogue per provider ──────────────────────────────────────────────

export const PROVIDER_MODELS: Record<string, { id: string; label: string; default?: true }[]> = {
  dahono:      [{ id: "dahono/deepseek-v4-flash", label: "DeepSeek V4 Flash", default: true }, { id: "dahono/gemini-2.5-flash", label: "Gemini 2.5 Flash" }, { id: "dahono/gpt-4o-mini", label: "GPT-4o Mini" }],
  anthropic:   [{ id: "claude-haiku-4-5", label: "Claude Haiku 4.5", default: true }, { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" }, { id: "claude-opus-4-5", label: "Claude Opus 4.5" }],
  openai:      [{ id: "gpt-4o-mini", label: "GPT-4o Mini", default: true }, { id: "gpt-4o", label: "GPT-4o" }, { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" }, { id: "o3-mini", label: "o3-mini" }],
  google:      [{ id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", default: true }, { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }, { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" }],
  xai:         [{ id: "grok-3-mini", label: "Grok 3 Mini", default: true }, { id: "grok-3", label: "Grok 3" }, { id: "grok-2-1212", label: "Grok 2" }],
  deepseek:    [{ id: "deepseek-chat", label: "DeepSeek Chat", default: true }, { id: "deepseek-reasoner", label: "DeepSeek Reasoner" }],
  qwen:        [{ id: "qwen-plus", label: "Qwen Plus", default: true }, { id: "qwen-turbo", label: "Qwen Turbo" }, { id: "qwen-max", label: "Qwen Max" }],
  zhipu:       [{ id: "glm-4-flash", label: "GLM-4 Flash", default: true }, { id: "glm-4-plus", label: "GLM-4 Plus" }],
  minimax:     [{ id: "MiniMax-M1-mini", label: "MiniMax M1 Mini", default: true }, { id: "MiniMax-Text-01", label: "MiniMax Text 01" }],
  cerebras:    [{ id: "llama3.1-8b", label: "Llama 3.1 8B", default: true }, { id: "llama3.3-70b", label: "Llama 3.3 70B" }],
  fireworks:   [{ id: "accounts/fireworks/models/llama-v3p1-8b-instruct", label: "Llama 3.1 8B", default: true }, { id: "accounts/fireworks/models/llama-v3p3-70b-instruct", label: "Llama 3.3 70B" }],
  novita:      [{ id: "meta-llama/llama-3.1-8b-instruct", label: "Llama 3.1 8B", default: true }, { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" }],
  openrouter:  [{ id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", default: true }, { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5" }, { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" }],
  sambanova:   [{ id: "Meta-Llama-3.1-8B-Instruct", label: "Llama 3.1 8B", default: true }, { id: "Meta-Llama-3.3-70B-Instruct", label: "Llama 3.3 70B" }],
  nvidia:      [{ id: "meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B", default: true }, { id: "nvidia/llama-3.1-nemotron-70b-instruct", label: "Nemotron 70B" }],
  hyperbolic:  [{ id: "meta-llama/Llama-3.2-3B-Instruct", label: "Llama 3.2 3B", default: true }, { id: "meta-llama/Meta-Llama-3.1-70B-Instruct", label: "Llama 3.1 70B" }],
  ai21:        [{ id: "jamba-mini-1.6", label: "Jamba Mini 1.6", default: true }, { id: "jamba-large-1.6", label: "Jamba Large 1.6" }],
  groq:        [{ id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", default: true }, { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" }, { id: "gemma2-9b-it", label: "Gemma 2 9B" }],
  together:    [{ id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", label: "Llama 3.1 8B Turbo", default: true }, { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo" }],
  mistral:     [{ id: "mistral-small-latest", label: "Mistral Small", default: true }, { id: "mistral-medium-latest", label: "Mistral Medium" }, { id: "mistral-large-latest", label: "Mistral Large" }],
  cohere:      [{ id: "command-r7b-12-2024", label: "Command R7B", default: true }, { id: "command-r-plus-08-2024", label: "Command R+" }],
  perplexity:  [{ id: "sonar", label: "Sonar", default: true }, { id: "sonar-pro", label: "Sonar Pro" }],
  huggingface: [{ id: "meta-llama/Llama-3.1-8B-Instruct", label: "Llama 3.1 8B", default: true }],
  replicate:   [{ id: "meta/meta-llama-3-8b-instruct", label: "Llama 3 8B", default: true }],
  moonshot:    [{ id: "moonshot-v1-8k", label: "Moonshot v1 8K", default: true }, { id: "moonshot-v1-32k", label: "Moonshot v1 32K" }],
  baidu:       [{ id: "ernie-4.5-8k", label: "ERNIE 4.5 8K", default: true }, { id: "ernie-4.5-turbo-128k", label: "ERNIE 4.5 Turbo 128K" }],
  yi:          [{ id: "yi-lightning", label: "Yi Lightning", default: true }, { id: "yi-large", label: "Yi Large" }],
  stepfun:     [{ id: "step-2-mini", label: "Step 2 Mini", default: true }, { id: "step-2", label: "Step 2" }],
  hunyuan:     [{ id: "hunyuan-lite", label: "Hunyuan Lite", default: true }, { id: "hunyuan-standard", label: "Hunyuan Standard" }],
  upstage:     [{ id: "solar-mini", label: "Solar Mini", default: true }, { id: "solar-pro", label: "Solar Pro" }],
  writer:      [{ id: "palmyra-x5-mini", label: "Palmyra X5 Mini", default: true }],
  lepton:      [{ id: "llama3.1-8b", label: "Llama 3.1 8B", default: true }],
  inception:   [{ id: "mercury-coder-small", label: "Mercury Coder Small", default: true }],
  ibm:         [{ id: "ibm/granite-3-8b-instruct", label: "Granite 3 8B", default: true }, { id: "ibm/granite-3.3-8b-instruct", label: "Granite 3.3 8B" }],
  deepinfra:   [{ id: "meta-llama/Meta-Llama-3.1-8B-Instruct", label: "Llama 3.1 8B", default: true }, { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B" }],
  anyscale:    [{ id: "meta-llama/Meta-Llama-3.1-8B-Instruct", label: "Llama 3.1 8B", default: true }],
  neets:       [{ id: "meta-llama/Meta-Llama-3-8B-Instruct", label: "Llama 3 8B", default: true }],
  lamini:      [{ id: "meta-llama/Meta-Llama-3-8B-Instruct", label: "Llama 3 8B", default: true }],
  // Issue 6 fix: cloudflare + azure exist in PROVIDER_FORMATS but need PROVIDER_MODELS entries
  // so the guide renders models and the dev-time warning is silenced. They are still "Skipped"
  // at runtime (resolveEndpoint returns null) until account-ID config is added.
  cloudflare:  [{ id: "@cf/meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B", default: true }, { id: "@cf/mistral/mistral-7b-instruct-v0.1", label: "Mistral 7B" }],
  azure:       [{ id: "gpt-4o-mini", label: "GPT-4o Mini", default: true }, { id: "gpt-4o", label: "GPT-4o" }],
}

// ── Body builders ─────────────────────────────────────────────────────────────

function buildBody(provider: string, prompt: string, modelOverride?: string): object {
  // Single source of truth: always derive default model from PROVIDER_MODELS catalogue.
  // The hardcoded string in each case has been removed — model() resolves it automatically.
  const models = PROVIDER_MODELS[provider] ?? []
  const defaultModelId = models.find((m) => m.default)?.id ?? models[0]?.id ?? ""
  const m = modelOverride ?? defaultModelId

  switch (provider) {
    case "anthropic":
      return { model: m, max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "google":
      return { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 256 } }
    case "cerebras":
      return { model: m, max_completion_tokens: 256, stream: false, messages: [{ role: "user", content: prompt }] }
    case "deepseek":
      return { model: m, max_tokens: 256, stream: false, messages: [{ role: "user", content: prompt }] }
    case "replicate":
      return { input: { prompt, max_new_tokens: 256 } }
    case "cloudflare":
      return { messages: [{ role: "user", content: prompt }], max_tokens: 256 }
    case "cohere":
      return { model: m, messages: [{ role: "user", content: prompt }] }
    case "baidu":
      return { model: m, max_output_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "ibm":
      return { model_id: m, messages: [{ role: "user", content: prompt }], parameters: { max_new_tokens: 256 } }
    case "lamini":
      return { model_name: m, prompt, max_new_tokens: 256 }
    default:
      // Standard OpenAI-compatible: openai, xai, groq, mistral, together, novita,
      // fireworks, openrouter, sambanova, nvidia, hyperbolic, ai21, qwen, zhipu,
      // minimax, perplexity, huggingface, moonshot, yi, stepfun, hunyuan, upstage,
      // writer, lepton, inception, deepinfra, anyscale, neets, dahono, etc.
      return { model: m, max_tokens: 256, messages: [{ role: "user", content: prompt }] }
  }
}

// ── Auth header builder ───────────────────────────────────────────────────────

function buildHeaders(provider: string, apiKey: string): Record<string, string> {
  const base: Record<string, string> = { "Content-Type": "application/json" }
  if (provider === "anthropic") {
    base["x-api-key"] = apiKey
    base["anthropic-version"] = "2023-06-01"
  } else if (provider === "openrouter") {
    base["Authorization"] = `Bearer ${apiKey}`
    base["HTTP-Referer"] = "https://ai-tester.vercel.app"
    base["X-Title"] = "AI Tester"
  } else if (provider === "replicate") {
    base["Authorization"] = `Token ${apiKey}`
    base["Prefer"] = "wait"
  } else if (provider === "neets") {
    base["Authorization"] = `Bearer ${apiKey}`
    base["X-API-Key"] = apiKey
  } else {
    base["Authorization"] = `Bearer ${apiKey}`
  }
  return base
}

// ── Chat reply + model + token extractor ──────────────────────────────────────

interface ExtractedResponse {
  reply?: string
  modelUsed?: string
  tokenUsage?: TokenUsage
}

function extractResponse(provider: string, data: unknown): ExtractedResponse {
  if (!data || typeof data !== "object") return {}
  const d = data as Record<string, unknown>

  let reply: string | undefined
  let modelUsed: string | undefined
  let tokenUsage: TokenUsage | undefined

  // Model field (standard)
  if (typeof d.model === "string") modelUsed = d.model

  // OpenAI-compatible choices
  if (Array.isArray(d.choices)) {
    const msg = (d.choices as Array<Record<string, unknown>>)[0]?.message as Record<string, unknown> | undefined
    if (typeof msg?.content === "string") reply = msg.content
  }

  // Anthropic
  if (Array.isArray(d.content)) {
    const block = (d.content as Array<Record<string, unknown>>).find((b) => b.type === "text")
    if (typeof block?.text === "string") reply = block.text
    if (typeof d.model === "string") modelUsed = d.model
  }

  // Google Gemini
  if (Array.isArray(d.candidates)) {
    const parts = ((d.candidates as Array<Record<string, unknown>>)[0]?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>> | undefined
    if (Array.isArray(parts) && typeof parts[0]?.text === "string") reply = parts[0].text
    // Gemini usage
    const gUsage = d.usageMetadata as Record<string, unknown> | undefined
    if (gUsage) {
      tokenUsage = {
        promptTokens: typeof gUsage.promptTokenCount === "number" ? gUsage.promptTokenCount : null,
        completionTokens: typeof gUsage.candidatesTokenCount === "number" ? gUsage.candidatesTokenCount : null,
        totalTokens: typeof gUsage.totalTokenCount === "number" ? gUsage.totalTokenCount : null,
      }
    }
  }

  // Cohere v2
  const cohereMsg = d.message as Record<string, unknown> | undefined
  if (cohereMsg) {
    if (typeof cohereMsg.content === "string") reply = cohereMsg.content
    if (Array.isArray(cohereMsg.content)) {
      const b = (cohereMsg.content as Array<Record<string, unknown>>).find((x) => x.type === "text")
      if (typeof b?.text === "string") reply = b.text
    }
  }

  // Anthropic usage
  const anthropicUsage = d.usage as Record<string, unknown> | undefined
  if (anthropicUsage && typeof anthropicUsage.input_tokens === "number") {
    tokenUsage = {
      promptTokens: anthropicUsage.input_tokens as number,
      completionTokens: typeof anthropicUsage.output_tokens === "number" ? anthropicUsage.output_tokens : null,
      totalTokens: typeof anthropicUsage.input_tokens === "number" && typeof anthropicUsage.output_tokens === "number"
        ? (anthropicUsage.input_tokens as number) + (anthropicUsage.output_tokens as number)
        : null,
    }
  }

  // OpenAI-compatible usage
  const oaiUsage = d.usage as Record<string, unknown> | undefined
  if (oaiUsage && typeof oaiUsage.prompt_tokens === "number" && !tokenUsage) {
    tokenUsage = {
      promptTokens: oaiUsage.prompt_tokens as number,
      completionTokens: typeof oaiUsage.completion_tokens === "number" ? oaiUsage.completion_tokens : null,
      totalTokens: typeof oaiUsage.total_tokens === "number" ? oaiUsage.total_tokens : null,
    }
  }

  // IBM WatsonX
  if (Array.isArray(d.results)) {
    const r = (d.results as Array<Record<string, unknown>>)[0]
    if (typeof r?.generated_text === "string") reply = r.generated_text
    if (typeof r?.input_token_count === "number") {
      tokenUsage = {
        promptTokens: r.input_token_count as number,
        completionTokens: typeof r.generated_token_count === "number" ? r.generated_token_count : null,
        totalTokens: typeof r.input_token_count === "number" && typeof r.generated_token_count === "number"
          ? (r.input_token_count as number) + (r.generated_token_count as number)
          : null,
      }
    }
  }

  // Replicate
  if (provider === "replicate") {
    if (Array.isArray(d.output)) reply = (d.output as string[]).join("")
    if (typeof d.output === "string") reply = d.output
  }

  // Lamini
  if (typeof d.output === "string") reply = d.output
  if (typeof d.text === "string") reply = d.text

  return { reply, modelUsed, tokenUsage }
}

// ── Resolve endpoint for a provider + key ────────────────────────────────────

function resolveEndpoint(provider: string, apiKey: string): string | null {
  if (provider === "google") {
    return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
  }
  if (provider === "cloudflare") return null
  if (provider === "azure") return null
  return ENDPOINTS[provider] || null
}

// ── Test a single entry ───────────────────────────────────────────────────────

// ── Nested error message extractor ───────────────────────────────────────────
// Handles { error: "string" }, { error: { message: "string" } }, and plain strings.
function extractErrorMessage(raw: unknown, httpStatus: number): string {
  if (!raw || typeof raw !== "object") return `HTTP ${httpStatus}`
  const d = raw as Record<string, unknown>
  const err = d.error
  if (typeof err === "string") return err
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>
    if (typeof e.message === "string") return e.message
    if (typeof e.description === "string") return e.description
  }
  if (typeof d.message === "string") return d.message
  if (typeof d.detail === "string") return d.detail
  return `HTTP ${httpStatus}`
}

async function testOne(entry: MultiKeyEntry, prompt: string, modelOverride?: string): Promise<MultiKeyResult> {
  const start = Date.now()
  const provider = entry.provider.toLowerCase()
  const label = entry.label ?? provider
  // Issue 2 fix: use shared maskApiKey so backend and frontend masks are identical
  const masked = maskApiKey(entry.apiKey)

  const endpoint = resolveEndpoint(provider, entry.apiKey)
  if (!endpoint) {
    return { provider, apiKeyMasked: masked, label, ok: false, status: 0, statusText: "Skipped", durationMs: 0, error: `Provider "${provider}" requires additional config (account ID / resource name)` }
  }

  const headers = buildHeaders(provider, entry.apiKey)
  const bodyObj = buildBody(provider, prompt, modelOverride)

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyObj),
      signal: AbortSignal.timeout(25_000),
    })

    let parsedData: unknown = null
    const ct = res.headers.get("content-type") ?? ""
    if (ct.includes("application/json")) {
      parsedData = await res.json().catch(() => null)
    } else {
      await res.text().catch(() => null)
    }

    const extracted = parsedData ? extractResponse(provider, parsedData) : {}
    // Issue 8 fix: properly parse nested error objects instead of .toString()
    const errMsg = !res.ok ? extractErrorMessage(parsedData, res.status) : undefined

    return {
      provider,
      apiKeyMasked: masked,
      label,
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      chatReply: extracted.reply,
      durationMs: Date.now() - start,
      error: errMsg,
      modelUsed: extracted.modelUsed,
      tokenUsage: extracted.tokenUsage,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error"
    return { provider, apiKeyMasked: masked, label, ok: false, status: 0, statusText: "Error", durationMs: Date.now() - start, error: msg }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const entries: MultiKeyEntry[] = body.entries ?? []
  // Issue 7 fix: single default prompt "halo" consistent with client-side useState default
  const prompt: string = body.prompt?.trim() || "halo"
  const modelOverride: string | undefined = body.modelOverride

  if (!entries.length) {
    return NextResponse.json({ error: "No entries provided" }, { status: 400 })
  }

  const capped = entries.slice(0, 100)
  const overallStart = Date.now()

  const settled = await Promise.allSettled(capped.map((e) => testOne(e, prompt, modelOverride)))

  const results: MultiKeyResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value
    return {
      provider: capped[i].provider,
      apiKeyMasked: maskApiKey(capped[i].apiKey),
      label: capped[i].label ?? capped[i].provider,
      ok: false,
      status: 0,
      statusText: "Promise rejected",
      durationMs: 0,
      error: s.reason instanceof Error ? s.reason.message : "Unknown",
    }
  })

  const passed = results.filter((r) => r.ok).length

  return NextResponse.json({
    results,
    totalMs: Date.now() - overallStart,
    passed,
    failed: results.length - passed,
  } satisfies MultiKeyTestResponse)
}
