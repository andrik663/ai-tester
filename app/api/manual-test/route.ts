import { NextRequest, NextResponse } from "next/server"
import type { LogEntry } from "@/app/api/test-key/route"

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ManualTestRequest {
  provider: string
  apiKey: string
  endpoint: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  headers: Record<string, string>
  body?: string        // raw JSON string from user (optional)
  prompt?: string      // chat message to inject into body template
  testMode?: "chat" | "vision" | "ocr"
  imageData?: { base64: string; mimeType: string }
}

export interface ManualTestResult {
  ok: boolean
  status: number
  statusText: string
  responseBody: string
  chatReply?: string    // extracted assistant message if applicable
  logs: LogEntry[]
  curlCommand: string      // masked — safe for display
  curlFull: string         // real key — for user copy-paste (they own the key)
  requestBodySent: string
  durationMs: number
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  responseHeaders?: Record<string, string>
}

// ── Logger helper ─────────────────────────────────────────────────────────────

function makeLogger() {
  const start = Date.now()
  const logs: LogEntry[] = []
  function log(level: LogEntry["level"], text: string) {
    logs.push({ ts: Date.now() - start, level, text })
  }
  return { log, logs, start }
}

// ── cURL builder ──────────────────────────────────────────────────────────────

function buildCurl(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string,
  maskKey = false
): string {
  const parts: string[] = [`curl -X ${method} '${url}'`]
  for (const [k, v] of Object.entries(headers)) {
    const display =
      maskKey && (k.toLowerCase() === "authorization" || k.toLowerCase() === "x-api-key")
        ? v.slice(0, 14) + "..."
        : v
    parts.push(`  -H '${k}: ${display}'`)
  }
  if (body) parts.push(`  -d '${body.replace(/'/g, "'\\''")}'`)
  return parts.join(" \\\n")
}

// ── Token usage extractor ─────────────────────────────────────────────────────
function extractTokenUsage(data: unknown): ManualTestResult["tokenUsage"] {
  if (!data || typeof data !== "object") return undefined
  const d = data as Record<string, unknown>
  if (d.usage && typeof d.usage === "object") {
    const u = d.usage as Record<string, unknown>
    const result: ManualTestResult["tokenUsage"] = {}
    if (typeof u.prompt_tokens === "number") result.promptTokens = u.prompt_tokens
    else if (typeof u.input_tokens === "number") result.promptTokens = u.input_tokens
    if (typeof u.completion_tokens === "number") result.completionTokens = u.completion_tokens
    else if (typeof u.output_tokens === "number") result.completionTokens = u.output_tokens
    if (typeof u.total_tokens === "number") result.totalTokens = u.total_tokens
    return Object.keys(result).length > 0 ? result : undefined
  }
  return undefined
}

// ── Response headers capture ──────────────────────────────────────────────────
const IMPORTANT_RESPONSE_HEADERS = [
  "x-ratelimit-limit-requests",
  "x-ratelimit-remaining-requests",
  "x-ratelimit-reset-requests",
  "x-ratelimit-limit-tokens",
  "x-ratelimit-remaining-tokens",
  "x-request-id",
  "cf-ray",
  "openai-processing-ms",
  "anthropic-ratelimit-requests-remaining",
  "retry-after",
  "server",
  "content-type",
]

function captureResponseHeaders(res: Response): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of IMPORTANT_RESPONSE_HEADERS) {
    const v = res.headers.get(k)
    if (v) out[k] = v
  }
  return out
}

// ── Body builder: inject prompt into provider templates ───────────────────────

const BODY_TEMPLATES: Record<string, (prompt: string) => object> = {
  // Anthropic Messages API — unique format
  anthropic: (prompt) => ({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  // OpenAI Responses API (gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.4-nano, gpt-4o, o-series)
  openai: (prompt) => ({
    model: "gpt-5.5",
    input: prompt,
  }),
  // Google Gemini — unique contents/parts format
  google: (prompt) => ({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 1024 },
  }),
  // xAI Grok — Responses API (chat: grok-4.3, coding: grok-build-0.1)
  xai: (prompt) => ({
    model: "grok-4.3",
    input: [
      { role: "system", content: "You are Grok, a highly intelligent, helpful AI assistant." },
      { role: "user", content: prompt },
    ],
  }),
  // DeepSeek — OpenAI-compatible
  deepseek: (prompt) => ({
    model: "deepseek-chat",
    max_tokens: 1024,
    stream: false,
    messages: [{ role: "user", content: prompt }],
  }),
  // Qwen / Alibaba DashScope — OpenAI-compatible (intl endpoint)
  qwen: (prompt) => ({
    model: "qwen-plus",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  // Zhipu GLM — OpenAI-compatible
  zhipu: (prompt) => ({
    model: "glm-4-flash",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  // MiniMax — OpenAI-compatible endpoint api.minimax.io/v1/chat/completions
  minimax: (prompt) => ({
    model: "MiniMax-M3",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  // Groq — OpenAI-compatible
  groq: (prompt) => ({
    model: "llama-3.1-8b-instant",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  // Together AI — OpenAI-compatible (default: MiniMaxAI/MiniMax-M3)
  together: (prompt) => ({
    model: "MiniMaxAI/MiniMax-M3",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  // Mistral — OpenAI-compatible
  mistral: (prompt) => ({
    model: "mistral-small-latest",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  // Cohere v2 chat — messages array (not message string in v2)
  cohere: (prompt) => ({
    model: "command-r-plus",
    messages: [{ role: "user", content: prompt }],
  }),
  // Perplexity — OpenAI-compatible
  perplexity: (prompt) => ({
    model: "sonar",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  // HuggingFace Inference API — OpenAI-compatible
  huggingface: (prompt) => ({
    model: "meta-llama/Llama-3.3-70B-Instruct",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  // Replicate — predictions input format
  replicate: (prompt) => ({
    input: {
      prompt,
      max_new_tokens: 512,
    },
  }),
  // ── Cerebras (public models: kimi-k2.6, glm-5.1, minimax-m2.5, zai-glm-4.7, gpt-oss-120b, gemma-4-31b, qwen3-32b)
  cerebras: (prompt) => ({
    model: "kimi-k2.6",
    max_completion_tokens: 1024,
    temperature: 0.2,
    top_p: 1,
    stream: false,
    reasoning_effort: "medium",
    messages: [{ role: "user", content: prompt }],
  }),
  fireworks: (prompt) => ({
    model: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  novita: (prompt) => ({
    model: "deepseek/deepseek-r1-0528",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  cloudflare: (prompt) => ({
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1024,
  }),
  openrouter: (prompt) => ({
    model: "google/gemini-2.5-flash",   // popular free-tier model; any openrouter model id works
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  sambanova: (prompt) => ({
    model: "Meta-Llama-3.3-70B-Instruct",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  nvidia: (prompt) => ({
    model: "meta/llama-3.3-70b-instruct",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  hyperbolic: (prompt) => ({
    model: "meta-llama/Llama-3.3-70B-Instruct",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  ai21: (prompt) => ({
    model: "jamba-1.6-large",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  // Dahono gateway — OpenAI-compatible
  dahono: (prompt) => ({
    model: "dahono/deepseek-v4-flash",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
}

// ── Vision body builders ──────────────────────────────────────────────────────
// Builds the request body with image content for vision requests.

type VisionBodyFn = (prompt: string, base64: string, mimeType: string) => object

const VISION_BODY_BUILDERS: Record<string, VisionBodyFn> = {
  // OpenAI-compatible: image_url with base64 data URI
  _openai_compat: (prompt, base64, mimeType) => ({
    model: "gpt-4o",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  openai: (prompt, base64, mimeType) => ({
    model: "gpt-4o",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Anthropic Messages API — base64 source block
  anthropic: (prompt, base64, mimeType) => ({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Google Gemini — inline_data
  google: (prompt, base64, mimeType) => ({
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: prompt },
      ],
    }],
    generationConfig: { maxOutputTokens: 2048 },
  }),
  // xAI Grok — Responses API with vision (grok-4.3 supports multimodal)
  xai: (prompt, base64, mimeType) => ({
    model: "grok-4.3",
    input: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Fireworks AI — OpenAI-compatible vision
  fireworks: (prompt, base64, mimeType) => ({
    model: "accounts/fireworks/models/llama-v3p2-11b-vision-instruct",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // OpenRouter — OpenAI-compatible
  openrouter: (prompt, base64, mimeType) => ({
    model: "meta-llama/llama-3.2-11b-vision-instruct",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // NVIDIA NIM — OpenAI-compatible vision
  nvidia: (prompt, base64, mimeType) => ({
    model: "meta/llama-3.2-90b-vision-instruct",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Hyperbolic — OpenAI-compatible
  hyperbolic: (prompt, base64, mimeType) => ({
    model: "Qwen/Qwen2-VL-72B-Instruct",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Moonshot Kimi — OpenAI-compatible vision
  moonshot: (prompt, base64, mimeType) => ({
    model: "kimi-k2.6",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Qwen VL — OpenAI-compatible vision (DashScope international)
  qwen: (prompt, base64, mimeType) => ({
    model: "qwen-vl-max",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Zhipu GLM-4V — OpenAI-compatible vision
  zhipu: (prompt, base64, mimeType) => ({
    model: "glm-4v-plus-0111",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Groq — supports vision via Llama 3.2 Vision (llama-3.2-11b-vision-preview)
  groq: (prompt, base64, mimeType) => ({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Together AI — vision via Llama-3.2-Vision
  together: (prompt, base64, mimeType) => ({
    model: "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Mistral Pixtral — vision via pixtral-12b-2409
  mistral: (prompt, base64, mimeType) => ({
    model: "pixtral-12b-2409",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // DeepSeek — vision via deepseek-vl2
  deepseek: (prompt, base64, mimeType) => ({
    model: "deepseek-vl2",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // MiniMax — vision via MiniMax-M3 (frontier multimodal model)
  minimax: (prompt, base64, mimeType) => ({
    model: "MiniMax-M3",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Stepfun — vision via step-1v-32k
  stepfun: (prompt, base64, mimeType) => ({
    model: "step-1v-32k",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Tencent Hunyuan — vision via hunyuan-vision
  hunyuan: (prompt, base64, mimeType) => ({
    model: "hunyuan-vision",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Cerebras — vision via kimi-k2.6 (multimodal per official Cerebras model guide)
  cerebras: (prompt, base64, mimeType) => ({
    model: "kimi-k2.6",
    max_completion_tokens: 2048,
    temperature: 0.2,
    top_p: 1,
    stream: false,
    reasoning_effort: "medium",
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // SambaNova — vision via Llama-3.2-11B-Vision-Instruct
  sambanova: (prompt, base64, mimeType) => ({
    model: "Llama-3.2-11B-Vision-Instruct",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // Novita AI — vision via Qwen2.5-VL-72B
  novita: (prompt, base64, mimeType) => ({
    model: "qwen/qwen2.5-vl-72b-instruct",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // HuggingFace — vision via Llama-3.2-11B-Vision
  huggingface: (prompt, base64, mimeType) => ({
    model: "meta-llama/Llama-3.2-11B-Vision-Instruct",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
  // 01.AI (Yi) — vision via yi-vision-plus
  yi: (prompt, base64, mimeType) => ({
    model: "yi-vision-plus",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: prompt },
      ],
    }],
  }),
}

// ── Chat reply extractor ──────────────────────────────────────────────────────

function extractChatReply(providerKey: string, data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const d = data as Record<string, unknown>

  // OpenAI-compatible: OpenAI, Groq, Mistral, Perplexity, MiniMax, DeepSeek,
  // OpenAI Responses API — output[].content[].text (output_text type)
  if (Array.isArray(d?.output)) {
    const output = d.output as Array<{ content?: Array<{ type: string; text: string }> }>
    const text = output?.[0]?.content?.find((c) => c.type === "output_text")?.text
    if (typeof text === "string") return text
    // fallback: output_text at top level
    const flat = output?.[0] as unknown as Record<string, unknown>
    if (typeof flat?.text === "string") return flat.text as string
  }

  //                    Qwen, Zhipu GLM, xAI Grok, Together AI, HuggingFace
  if (Array.isArray(d?.choices)) {
    const choices = d.choices as Array<Record<string, unknown>>
    const msg = choices[0]?.message as Record<string, unknown> | undefined
    if (typeof msg?.content === "string") return msg.content
    // delta for streaming (shouldn't happen but handle gracefully)
    const delta = choices[0]?.delta as Record<string, unknown> | undefined
    if (typeof delta?.content === "string") return delta.content
  }

  // Anthropic Messages API
  if (Array.isArray(d?.content)) {
    const content = d.content as Array<Record<string, unknown>>
    const block = content.find((b) => b.type === "text")
    if (typeof block?.text === "string") return block.text
  }

  // Google Gemini generateContent
  if (Array.isArray(d?.candidates)) {
    const cands = d.candidates as Array<Record<string, unknown>>
    const parts = (cands[0]?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>>
    if (Array.isArray(parts) && typeof parts[0]?.text === "string") return parts[0].text
  }

  // Cohere v2 chat — message.content[].text or message.content (string)
  const cohereMsg = d?.message as Record<string, unknown> | undefined
  if (cohereMsg) {
    if (typeof cohereMsg.content === "string") return cohereMsg.content
    if (Array.isArray(cohereMsg.content)) {
      const block = (cohereMsg.content as Array<Record<string, unknown>>).find((b) => b.type === "text")
      if (typeof block?.text === "string") return block.text
    }
  }
  // Cohere v1 (legacy)
  if (typeof d?.text === "string") return d.text

  // Replicate predictions — output is array of strings or a string
  if (providerKey === "replicate") {
    if (Array.isArray(d?.output)) {
      return (d.output as string[]).join("")
    }
    if (typeof d?.output === "string") return d.output
  }

  return undefined
}

// ── Inject API key into headers ───────────────────────────────────────────────

function injectAuth(
  headers: Record<string, string>,
  providerKey: string,
  apiKey: string
): Record<string, string> {
  const out = { ...headers }
  // Replace placeholder tokens
  for (const [k, v] of Object.entries(out)) {
    out[k] = v
      .replace(/\{\{API_KEY\}\}/g, apiKey)
      .replace(/\{\{KEY\}\}/g, apiKey)
  }

  // If no auth header was set, inject a sensible default per provider
  const hasAuth = Object.keys(out).some(
    (k) => k.toLowerCase() === "authorization" || k.toLowerCase() === "x-api-key"
  )
  if (!hasAuth) {
    if (providerKey === "anthropic") {
      out["x-api-key"] = apiKey
      if (!out["anthropic-version"]) out["anthropic-version"] = "2023-06-01"
    } else {
      // All other providers use Bearer token
      out["Authorization"] = `Bearer ${apiKey}`
    }
  }
  // Replicate needs Prefer: wait for synchronous response
  if (providerKey === "replicate" && !out["Prefer"]) {
    out["Prefer"] = "wait"
  }
  // OpenRouter needs HTTP-Referer for policy
  if (providerKey === "openrouter" && !out["HTTP-Referer"]) {
    out["HTTP-Referer"] = "https://ai-tester.vercel.app"
  }
  return out
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: ManualTestRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { provider, apiKey, endpoint, method, prompt, testMode, imageData } = body
  let { headers, body: rawBody } = body

  if (!apiKey?.trim()) return NextResponse.json({ error: "API key is required" }, { status: 400 })
  if (!endpoint?.trim()) return NextResponse.json({ error: "Endpoint URL is required" }, { status: 400 })

  const { log, logs, start } = makeLogger()
  const providerKey = provider.toLowerCase()
  const isVisionMode = (testMode === "vision" || testMode === "ocr") && !!imageData

  log("info", `Provider: ${provider}`)
  log("info", `Method:   ${method} ${endpoint}`)
  if (isVisionMode) log("info", `Mode: vision (image: ${imageData?.mimeType}, ${Math.round((imageData?.base64.length ?? 0) * 0.75 / 1024)}KB)`)

  // ── Build request body ────────────────────────────────────────────────────

  let requestBodySent = ""
  let finalBody: string | undefined

  if (method !== "GET" && method !== "DELETE") {
    if (isVisionMode && imageData) {
      // Vision mode — use provider-specific vision body builder
      const visionFn =
        VISION_BODY_BUILDERS[providerKey] ??
        VISION_BODY_BUILDERS["openai"] // fallback to OpenAI-compat format
      const builtBody = visionFn(
        prompt || "Describe this image in detail.",
        imageData.base64,
        imageData.mimeType
      )
      finalBody = JSON.stringify(builtBody)
      requestBodySent = JSON.stringify(builtBody, null, 2)
    } else if (rawBody && rawBody.trim()) {
      // User provided raw JSON — substitute {{PROMPT}} placeholder
      const resolved = rawBody.replace(/\{\{PROMPT\}\}/g, prompt ?? "Hello, say hi back in one sentence.")
      finalBody = resolved
      requestBodySent = resolved
    } else if (prompt !== undefined) {
      // Auto-build from template
      const templateFn = BODY_TEMPLATES[providerKey]
      const builtBody = templateFn
        ? templateFn(prompt || "Hello, say hi back in one sentence.")
        : { messages: [{ role: "user", content: prompt || "Hello" }] }
      finalBody = JSON.stringify(builtBody)
      requestBodySent = JSON.stringify(builtBody, null, 2)
    }
  }

  // ── Inject auth into headers ──────────────────────────────────────────────

  const finalHeaders = injectAuth(
    { "Content-Type": "application/json", ...headers },
    providerKey,
    apiKey.trim()
  )

  // ── Build cURL ────────────────────────────────────────────────────────────

  const curlCommand = buildCurl(method, endpoint, finalHeaders, finalBody, true)  // masked
  const curlFull    = buildCurl(method, endpoint, finalHeaders, finalBody, false) // full key
  log("curl", curlCommand)
  log("req", `Sending ${method} → ${endpoint}`)
  if (finalBody) {
    log("req", `Body: ${finalBody.length > 200 ? finalBody.slice(0, 200) + "…" : finalBody}`)
  }

  // ── Execute request ───────────────────────────────────────────────────────

  let res: Response
  try {
    res = await fetch(endpoint, {
      method,
      headers: finalHeaders,
      body: finalBody,
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log("err", `Fetch failed: ${msg}`)
  return NextResponse.json({
    ok: false,
    status: 0,
    statusText: "Network Error",
    responseBody: msg,
    logs,
    curlCommand,
    curlFull,
    requestBodySent,
    durationMs: Date.now() - start,
  } satisfies ManualTestResult)
  }

  const durationMs = Date.now() - start
  log("res", `HTTP ${res.status} ${res.statusText}  (${durationMs}ms)`)

  // ── Parse response ────────────────────────────────────────────────────────

  const contentType = res.headers.get("content-type") ?? ""
  let responseBody: string
  let parsedData: unknown

  if (contentType.includes("application/json")) {
    parsedData = await res.json().catch(() => null)
    responseBody = JSON.stringify(parsedData, null, 2)
  } else {
    responseBody = await res.text().catch(() => "(unreadable)")
  }

  const chatReply = parsedData ? extractChatReply(providerKey, parsedData) : undefined
  const tokenUsage = parsedData ? extractTokenUsage(parsedData) : undefined
  const responseHeaders = captureResponseHeaders(res)

  if (res.ok) {
    if (chatReply) {
      log("ok", `Reply received (${chatReply.length} chars)`)
    } else {
      log("ok", `Success — HTTP ${res.status}`)
    }
    if (tokenUsage?.totalTokens) {
      log("info", `Tokens used — prompt: ${tokenUsage.promptTokens ?? "?"}, completion: ${tokenUsage.completionTokens ?? "?"}, total: ${tokenUsage.totalTokens}`)
    }
    const rl = responseHeaders["x-ratelimit-remaining-requests"] ?? responseHeaders["anthropic-ratelimit-requests-remaining"]
    if (rl) log("info", `Rate limit remaining: ${rl} requests`)
  } else {
    const errMsg =
      (parsedData as Record<string, unknown>)?.error?.toString?.() ??
      responseBody.slice(0, 200)
    log("err", `HTTP ${res.status}: ${errMsg}`)
  }

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    responseBody,
    chatReply,
    logs,
    curlCommand,
    curlFull,
    requestBodySent,
    durationMs,
    tokenUsage,
    responseHeaders,
  } satisfies ManualTestResult)
}
