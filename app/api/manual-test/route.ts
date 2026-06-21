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
}

export interface ManualTestResult {
  ok: boolean
  status: number
  statusText: string
  responseBody: string
  chatReply?: string    // extracted assistant message if applicable
  logs: LogEntry[]
  curlCommand: string
  requestBodySent: string
  durationMs: number
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
  body?: string
): string {
  const parts: string[] = [`curl -X ${method} '${url}'`]
  for (const [k, v] of Object.entries(headers)) {
    // Mask Authorization header values
    const display = k.toLowerCase() === "authorization" || k.toLowerCase() === "x-api-key"
      ? v.slice(0, 14) + "..."
      : v
    parts.push(`  -H '${k}: ${display}'`)
  }
  if (body) parts.push(`  -d '${body.replace(/'/g, "'\\''")}'`)
  return parts.join(" \\\n")
}

// ── Body builder: inject prompt into provider templates ───────────────────────

const BODY_TEMPLATES: Record<string, (prompt: string) => object> = {
  anthropic: (prompt) => ({
    model: "claude-3-haiku-20240307",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  openai: (prompt) => ({
    model: "gpt-4o-mini",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  google: (prompt) => ({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 1024 },
  }),
  groq: (prompt) => ({
    model: "llama-3.1-8b-instant",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  mistral: (prompt) => ({
    model: "mistral-small-latest",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  cohere: (prompt) => ({
    model: "command-r",
    max_tokens: 1024,
    message: prompt,
  }),
  perplexity: (prompt) => ({
    model: "llama-3.1-sonar-small-128k-online",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
  minimax: (prompt) => ({
    model: "abab6.5s-chat",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  }),
}

// ── Chat reply extractor ──────────────────────────────────────────────────────

function extractChatReply(providerKey: string, data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const d = data as Record<string, unknown>

  // OpenAI-compatible (OpenAI, Groq, Mistral, Perplexity, MiniMax)
  if (Array.isArray((d?.choices as unknown[]))) {
    const choices = d.choices as Array<Record<string, unknown>>
    const msg = choices[0]?.message as Record<string, unknown> | undefined
    if (typeof msg?.content === "string") return msg.content
  }

  // Anthropic
  if (Array.isArray((d?.content as unknown[]))) {
    const content = d.content as Array<Record<string, unknown>>
    const block = content.find((b) => b.type === "text")
    if (typeof block?.text === "string") return block.text
  }

  // Google Gemini
  if (Array.isArray((d?.candidates as unknown[]))) {
    const cands = d.candidates as Array<Record<string, unknown>>
    const parts = (cands[0]?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>>
    if (Array.isArray(parts) && typeof parts[0]?.text === "string") return parts[0].text
  }

  // Cohere
  if (typeof d?.text === "string") return d.text

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

  // If no auth header was set, inject a sensible default
  const hasAuth = Object.keys(out).some(
    (k) => k.toLowerCase() === "authorization" || k.toLowerCase() === "x-api-key"
  )
  if (!hasAuth) {
    if (providerKey === "anthropic") {
      out["x-api-key"] = apiKey
      out["anthropic-version"] = "2023-06-01"
    } else {
      out["Authorization"] = `Bearer ${apiKey}`
    }
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

  const { provider, apiKey, endpoint, method, prompt } = body
  let { headers, body: rawBody } = body

  if (!apiKey?.trim()) return NextResponse.json({ error: "API key is required" }, { status: 400 })
  if (!endpoint?.trim()) return NextResponse.json({ error: "Endpoint URL is required" }, { status: 400 })

  const { log, logs, start } = makeLogger()
  const providerKey = provider.toLowerCase()

  log("info", `Provider: ${provider}`)
  log("info", `Method:   ${method} ${endpoint}`)

  // ── Build request body ────────────────────────────────────────────────────

  let requestBodySent = ""
  let finalBody: string | undefined

  if (method !== "GET" && method !== "DELETE") {
    if (rawBody && rawBody.trim()) {
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

  const curlCommand = buildCurl(method, endpoint, finalHeaders, finalBody)
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

  if (res.ok) {
    if (chatReply) {
      log("ok", `Reply received (${chatReply.length} chars)`)
    } else {
      log("ok", `Success — HTTP ${res.status}`)
    }
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
    requestBodySent,
    durationMs,
  } satisfies ManualTestResult)
}
