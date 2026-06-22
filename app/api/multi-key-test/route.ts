import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

// ── Exported types ────────────────────────────────────────────────────────────

export interface MultiKeyEntry {
  provider: string
  apiKey: string
  label?: string
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

// ── Body builders ─────────────────────────────────────────────────────────────

function buildBody(provider: string, prompt: string): object {
  switch (provider) {
    case "anthropic":
      return { model: "claude-haiku-4-5", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "openai":
      return { model: "gpt-4o-mini", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "google":
      return { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 256 } }
    case "xai":
      return { model: "grok-3-mini", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "deepseek":
      return { model: "deepseek-chat", max_tokens: 256, stream: false, messages: [{ role: "user", content: prompt }] }
    case "qwen":
      return { model: "qwen-plus", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "zhipu":
      return { model: "glm-4-flash", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "minimax":
      return { model: "MiniMax-M1-mini", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "cerebras":
      return { model: "llama3.1-8b", max_completion_tokens: 256, stream: false, messages: [{ role: "user", content: prompt }] }
    case "fireworks":
      return { model: "accounts/fireworks/models/llama-v3p1-8b-instruct", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "novita":
      return { model: "meta-llama/llama-3.1-8b-instruct", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "cloudflare":
      return { messages: [{ role: "user", content: prompt }], max_tokens: 256 }
    case "openrouter":
      return { model: "google/gemini-2.5-flash-lite", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "sambanova":
      return { model: "Meta-Llama-3.1-8B-Instruct", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "nvidia":
      return { model: "meta/llama-3.1-8b-instruct", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "hyperbolic":
      return { model: "meta-llama/Llama-3.2-3B-Instruct", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "ai21":
      return { model: "jamba-mini-1.6", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "groq":
      return { model: "llama-3.1-8b-instant", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "together":
      return { model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "mistral":
      return { model: "mistral-small-latest", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "cohere":
      return { model: "command-r7b-12-2024", messages: [{ role: "user", content: prompt }] }
    case "perplexity":
      return { model: "sonar", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "huggingface":
      return { model: "meta-llama/Llama-3.1-8B-Instruct", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "replicate":
      return { input: { prompt, max_new_tokens: 256 } }
    case "moonshot":
      return { model: "moonshot-v1-8k", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "baidu":
      return { model: "ernie-4.5-8k", max_output_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "yi":
      return { model: "yi-lightning", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "stepfun":
      return { model: "step-2-mini", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "hunyuan":
      return { model: "hunyuan-lite", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "upstage":
      return { model: "solar-mini", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "writer":
      return { model: "palmyra-x5-mini", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "lepton":
      return { model: "llama3.1-8b", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "inception":
      return { model: "mercury-coder-small", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "ibm":
      return { model_id: "ibm/granite-3-8b-instruct", messages: [{ role: "user", content: prompt }], parameters: { max_new_tokens: 256 } }
    case "deepinfra":
      return { model: "meta-llama/Meta-Llama-3.1-8B-Instruct", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "anyscale":
      return { model: "meta-llama/Meta-Llama-3.1-8B-Instruct", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "neets":
      return { model: "meta-llama/Meta-Llama-3-8B-Instruct", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
    case "lamini":
      return { model_name: "meta-llama/Meta-Llama-3-8B-Instruct", prompt, max_new_tokens: 256 }
    default: // dahono + fallback
      return { model: "dahono/deepseek-v4-flash", max_tokens: 256, messages: [{ role: "user", content: prompt }] }
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

// ── Chat reply extractor ──────────────────────────────────────────────────────

function extractReply(provider: string, data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const d = data as Record<string, unknown>

  // OpenAI-compatible choices
  if (Array.isArray(d.choices)) {
    const msg = (d.choices as Array<Record<string, unknown>>)[0]?.message as Record<string, unknown> | undefined
    if (typeof msg?.content === "string") return msg.content
  }
  // Anthropic
  if (Array.isArray(d.content)) {
    const block = (d.content as Array<Record<string, unknown>>).find((b) => b.type === "text")
    if (typeof block?.text === "string") return block.text
  }
  // Google Gemini
  if (Array.isArray(d.candidates)) {
    const parts = ((d.candidates as Array<Record<string, unknown>>)[0]?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>> | undefined
    if (Array.isArray(parts) && typeof parts[0]?.text === "string") return parts[0].text
  }
  // Cohere v2
  const cohereMsg = d.message as Record<string, unknown> | undefined
  if (cohereMsg) {
    if (typeof cohereMsg.content === "string") return cohereMsg.content
    if (Array.isArray(cohereMsg.content)) {
      const b = (cohereMsg.content as Array<Record<string, unknown>>).find((x) => x.type === "text")
      if (typeof b?.text === "string") return b.text
    }
  }
  // IBM WatsonX
  if (Array.isArray(d.results)) {
    const r = (d.results as Array<Record<string, unknown>>)[0]
    if (typeof r?.generated_text === "string") return r.generated_text
  }
  // Replicate
  if (provider === "replicate") {
    if (Array.isArray(d.output)) return (d.output as string[]).join("")
    if (typeof d.output === "string") return d.output
  }
  // Lamini
  if (typeof d.output === "string") return d.output
  if (typeof d.text === "string") return d.text
  return undefined
}

// ── Resolve endpoint for a provider + key ────────────────────────────────────

function resolveEndpoint(provider: string, apiKey: string): string | null {
  if (provider === "google") {
    return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
  }
  if (provider === "cloudflare") {
    // Without account ID we can't call CF — skip
    return null
  }
  if (provider === "azure") {
    // Without resource name we can't call Azure — skip
    return null
  }
  return ENDPOINTS[provider] || null
}

// ── Test a single entry ───────────────────────────────────────────────────────

async function testOne(entry: MultiKeyEntry, prompt: string): Promise<MultiKeyResult> {
  const start = Date.now()
  const provider = entry.provider.toLowerCase()
  const label = entry.label ?? provider
  const masked = entry.apiKey.slice(0, 8) + "••••"

  const endpoint = resolveEndpoint(provider, entry.apiKey)
  if (!endpoint) {
    return { provider, apiKeyMasked: masked, label, ok: false, status: 0, statusText: "Skipped", durationMs: 0, error: `Provider "${provider}" requires additional config (account ID / resource name)` }
  }

  const headers = buildHeaders(provider, entry.apiKey)
  const bodyObj = buildBody(provider, prompt)

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

    const chatReply = parsedData ? extractReply(provider, parsedData) : undefined
    const errMsg = !res.ok
      ? (parsedData as Record<string, unknown>)?.error?.toString?.() ?? `HTTP ${res.status}`
      : undefined

    return {
      provider,
      apiKeyMasked: masked,
      label,
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      chatReply,
      durationMs: Date.now() - start,
      error: errMsg,
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
  const prompt: string = body.prompt?.trim() || "Reply with one short sentence."

  if (!entries.length) {
    return NextResponse.json({ error: "No entries provided" }, { status: 400 })
  }

  const capped = entries.slice(0, 100)
  const overallStart = Date.now()

  const settled = await Promise.allSettled(capped.map((e) => testOne(e, prompt)))

  const results: MultiKeyResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value
    return {
      provider: capped[i].provider,
      apiKeyMasked: capped[i].apiKey.slice(0, 8) + "••••",
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
