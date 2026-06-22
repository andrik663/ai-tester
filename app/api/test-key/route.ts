import { NextRequest, NextResponse } from "next/server"

export interface LogEntry {
  ts: number
  level: "info" | "req" | "res" | "ok" | "err" | "curl"
  text: string
}

export interface TokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export type ErrorReason = "expired" | "wrong_key" | "rate_limited" | "no_credits" | "network" | "insufficient_permissions" | null

export interface TestKeyResult {
  valid: boolean | null
  provider: string
  message: string
  detail?: string
  logs: LogEntry[]
  latencyMs?: number
  tokenUsage?: TokenUsage
  responseHeaders?: Record<string, string>
  curlFull?: string          // full key — only sent when valid, for copy-paste
  curlDisplay?: string       // masked key — always safe to display in logs
  // enriched fields
  modelCount?: number        // number of accessible models
  modelList?: string[]       // first few model IDs (max 8)
  balance?: string           // formatted credit balance e.g. "$12.45" or "2,000 tokens"
  username?: string          // authenticated user/account name
  errorReason?: ErrorReason  // structured error classification
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

function buildCurl(opts: {
  method: string
  url: string
  headers: Record<string, string>
  body?: object
  maskKey?: boolean
}): string {
  const headerParts = Object.entries(opts.headers).map(([k, v]) => {
    const displayVal = opts.maskKey && (k.toLowerCase() === "x-api-key" || k.toLowerCase() === "authorization")
      ? v.slice(0, 14) + "..."
      : v
    return `  -H '${k}: ${displayVal}'`
  }).join(" \\\n")
  const bodyPart = opts.body
    ? ` \\\n  -d '${JSON.stringify(opts.body, null, 2).replace(/'/g, "'\\''")}' `
    : ""
  return `curl -X ${opts.method} '${opts.url}' \\\n${headerParts}${bodyPart}`
}

// ── Response header extractor ─────────────────────────────────────────────────

function captureHeaders(res: Response, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of keys) {
    const v = res.headers.get(k)
    if (v) out[k] = v
  }
  return out
}

const IMPORTANT_HEADERS = [
  "x-ratelimit-limit-requests",
  "x-ratelimit-remaining-requests",
  "x-ratelimit-reset-requests",
  "x-ratelimit-limit-tokens",
  "x-ratelimit-remaining-tokens",
  "x-request-id",
  "cf-ray",
  "x-envoy-upstream-service-time",
  "openai-processing-ms",
  "openai-version",
  "anthropic-ratelimit-requests-limit",
  "anthropic-ratelimit-requests-remaining",
  "x-kong-request-id",
  "retry-after",
  "server",
]

// ── Token usage extractor ─────────────────────────────────────────────────────

function extractTokenUsage(data: unknown): TokenUsage | undefined {
  if (!data || typeof data !== "object") return undefined
  const d = data as Record<string, unknown>
  // OpenAI-compatible
  if (d.usage && typeof d.usage === "object") {
    const u = d.usage as Record<string, unknown>
    return {
      promptTokens: typeof u.prompt_tokens === "number" ? u.prompt_tokens : undefined,
      completionTokens: typeof u.completion_tokens === "number" ? u.completion_tokens : undefined,
      totalTokens: typeof u.total_tokens === "number" ? u.total_tokens : undefined,
    }
  }
  // Anthropic Messages API
  if (d.usage && typeof d.usage === "object") {
    const u = d.usage as Record<string, unknown>
    return {
      promptTokens: typeof u.input_tokens === "number" ? u.input_tokens : undefined,
      completionTokens: typeof u.output_tokens === "number" ? u.output_tokens : undefined,
    }
  }
  return undefined
}

// ── Provider testers ──────────────────────────────────────────────────────────

async function testAnthropic(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.anthropic.com/v1/messages"
  const headers = { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }
  const body = { model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }

  log("info", "Provider: Anthropic (claude-3-haiku-20240307)")
  log("info", "Endpoint: POST /v1/messages")
  log("curl", buildCurl({ method: "POST", url, headers, body, maskKey: true }))
  log("req",  `Sending request... x-api-key: ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  // Log rate limit headers if present
  const rl = responseHeaders["anthropic-ratelimit-requests-remaining"]
  if (rl) log("info", `Rate limit remaining: ${rl} requests`)

  if (res.status === 200 || res.status === 429) {
    const data = await res.json().catch(() => ({}))
    const tokenUsage = extractTokenUsage(data)
    const rateLimited = res.status === 429
    const msg = rateLimited ? "Valid — key accepted (rate limited)" : "Valid — key accepted by Anthropic"
    log("ok", msg)
    if (tokenUsage?.totalTokens) log("info", `Tokens: ${tokenUsage.totalTokens}`)
    return {
      valid: true, provider: "Anthropic", message: msg, detail: `HTTP ${res.status}`,
      logs, latencyMs, tokenUsage, responseHeaders,
      errorReason: rateLimited ? "rate_limited" : null,
      curlDisplay: buildCurl({ method: "POST", url, headers, body, maskKey: true }),
      curlFull: buildCurl({ method: "POST", url, headers, body, maskKey: false }),
    }
  }
  if (res.status === 401) {
    const body2 = await res.json().catch(() => ({}))
    const err = body2?.error?.message ?? "authentication_error"
    const isExpired = /expired|invalid_api_key/i.test(err)
    log("err", `401 Unauthorized: ${err}`)
    return { valid: false, provider: "Anthropic", message: "Invalid — authentication failed", detail: err, logs, latencyMs, responseHeaders, errorReason: isExpired ? "expired" : "wrong_key" }
  }
  if (res.status === 403) {
    const body2 = await res.json().catch(() => ({}))
    const err = body2?.error?.message ?? "Permission denied"
    log("err", `403 Forbidden: ${err}`)
    return { valid: false, provider: "Anthropic", message: "Invalid — permission denied", detail: err, logs, latencyMs, responseHeaders, errorReason: "insufficient_permissions" }
  }
  const rawBody = await res.json().catch(() => ({}))
  const errMsg = rawBody?.error?.message ?? JSON.stringify(rawBody).slice(0, 120)
  log("err", `Unexpected status ${res.status}: ${errMsg}`)
  return { valid: false, provider: "Anthropic", message: `Unexpected HTTP ${res.status}`, detail: errMsg, logs, latencyMs, responseHeaders, errorReason: null }
}

async function testOpenAI(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.openai.com/v1/models"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: OpenAI")
  log("info", "Endpoint: GET /v1/models")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  const rl = responseHeaders["x-ratelimit-remaining-requests"]
  if (rl) log("info", `Rate limit remaining: ${rl} requests`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const models: string[] = Array.isArray(data?.data) ? data.data.map((m: Record<string, unknown>) => String(m.id)) : []
    const count = models.length || "?"
    // Show GPT-4 family first, then sort rest
    const sorted = [...models].sort((a, b) => {
      const aGpt4 = a.startsWith("gpt-4"), bGpt4 = b.startsWith("gpt-4")
      if (aGpt4 && !bGpt4) return -1; if (bGpt4 && !aGpt4) return 1
      return a.localeCompare(b)
    })
    log("ok", `Valid — ${count} models accessible`)

    // Fetch subscription / credit info
    let balance: string | undefined
    try {
      const today = new Date()
      const yyyyMm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
      const subRes = await fetch("https://api.openai.com/v1/me", { headers, signal: AbortSignal.timeout(6_000) })
      if (subRes.ok) {
        const subData = await subRes.json().catch(() => ({}))
        if (subData?.name || subData?.email) {
          balance = subData.name ? `Account: ${subData.name}` : `Email: ${subData.email}`
          log("info", `Account: ${balance}`)
        }
      }
      // Try usage endpoint for current month
      const usageRes = await fetch(`https://api.openai.com/v1/usage?date=${yyyyMm}-01`, { headers, signal: AbortSignal.timeout(6_000) })
      if (usageRes.ok) {
        const usageData = await usageRes.json().catch(() => ({}))
        const totalTokens = (usageData?.data ?? []).reduce((sum: number, d: Record<string, unknown>) => sum + (Number(d.n_context_tokens_total ?? 0) + Number(d.n_generated_tokens_total ?? 0)), 0)
        if (totalTokens > 0) {
          balance = (balance ? balance + " | " : "") + `Usage this month: ${totalTokens.toLocaleString()} tokens`
          log("info", `Usage: ${totalTokens.toLocaleString()} tokens this month`)
        }
      }
    } catch { /* best-effort */ }

    return {
      valid: true, provider: "OpenAI", message: `Valid — ${count} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders, modelCount: models.length, modelList: sorted.slice(0, 8), errorReason: null, balance,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 429) {
    log("ok", "Valid — key accepted (rate limited)")
    return {
      valid: true, provider: "OpenAI", message: "Valid (rate limited)", detail: "HTTP 429",
      logs, latencyMs, responseHeaders, errorReason: "rate_limited",
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Incorrect API key"
    const isExpired = /expired/i.test(err)
    log("err", `401 Unauthorized: ${err}`)
    return { valid: false, provider: "OpenAI", message: "Invalid — authentication failed", detail: err, logs, latencyMs, responseHeaders, errorReason: isExpired ? "expired" : "wrong_key" }
  }
  const body = await res.json().catch(() => ({}))
  const errMsg = body?.error?.message ?? JSON.stringify(body).slice(0, 120)
  log("err", `Unexpected ${res.status}: ${errMsg}`)
  return { valid: false, provider: "OpenAI", message: `Unexpected HTTP ${res.status}`, detail: errMsg, logs, latencyMs, responseHeaders, errorReason: null }
}

async function testGoogle(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
  const displayUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key.slice(0, 8)}...`

  log("info", "Provider: Google Gemini (Generative Language API)")
  log("info", "Endpoint: GET /v1beta/models")
  log("curl", `curl '${displayUrl}'`)
  log("req",  `Sending request... key: ${key.slice(0, 10)}...`)

  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const models: string[] = Array.isArray(data?.models) ? data.models.map((m: Record<string, unknown>) => String(m.name ?? m.displayName ?? "")).filter(Boolean) : []
    const count = models.length || "?"
    log("ok", `Valid — ${count} Gemini models accessible`)
    return {
      valid: true, provider: "Google/Gemini", message: `Valid — ${count} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders, modelCount: models.length, modelList: models.slice(0, 8), errorReason: null,
      curlDisplay: `curl '${displayUrl}'`,
      curlFull: `curl '${url}'`,
    }
  }
  if (res.status === 400 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "API key invalid"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "Google/Gemini", message: "Invalid — API key rejected", detail: err, logs, latencyMs, responseHeaders, errorReason: "wrong_key" }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Google/Gemini", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders, errorReason: null }
}

async function testHuggingFace(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://huggingface.co/api/whoami"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: HuggingFace")
  log("info", "Endpoint: GET /api/whoami")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... token: ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const body = await res.json().catch(() => ({}))
    const user = body?.name ?? body?.login ?? "unknown"
    const email = body?.email ?? undefined
    log("ok", `Valid — authenticated as ${user}`)
    return {
      valid: true, provider: "HuggingFace", message: `Valid — authenticated as ${user}`, detail: email ? `Email: ${email}` : "HTTP 200",
      logs, latencyMs, responseHeaders, username: user, errorReason: null,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401) {
    log("err", "401 Unauthorized — token rejected")
    return { valid: false, provider: "HuggingFace", message: "Invalid — token rejected", detail: "HTTP 401", logs, latencyMs, responseHeaders, errorReason: "wrong_key" }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "HuggingFace", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders, errorReason: null }
}

async function testGroq(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.groq.com/openai/v1/models"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: Groq (OpenAI-compatible)")
  log("info", "Endpoint: GET /openai/v1/models")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const models: string[] = Array.isArray(data?.data) ? data.data.map((m: Record<string, unknown>) => String(m.id)) : []
    const count = models.length || "?"
    log("ok", `Valid — ${count} Groq models accessible`)
    return {
      valid: true, provider: "Groq", message: `Valid — ${count} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders, modelCount: models.length, modelList: models.slice(0, 8), errorReason: null,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 429) {
    log("ok", "Valid — key accepted (rate limited)")
    return {
      valid: true, provider: "Groq", message: "Valid (rate limited)", detail: "HTTP 429",
      logs, latencyMs, responseHeaders, errorReason: "rate_limited",
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    log("err", `401: ${body?.error?.message ?? "Invalid API key"}`)
    return { valid: false, provider: "Groq", message: "Invalid — authentication failed", detail: "HTTP 401", logs, latencyMs, responseHeaders, errorReason: "wrong_key" }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Groq", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders, errorReason: null }
}

async function testGitHub(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.github.com/user"
  const headers = { Authorization: `Bearer ${key}`, "User-Agent": "APIKeyTester/1.0" }

  log("info", "Provider: GitHub")
  log("info", "Endpoint: GET /user")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... token: ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const body = await res.json().catch(() => ({}))
    log("ok", `Valid — authenticated as @${body.login ?? "unknown"}`)
    return {
      valid: true, provider: "GitHub", message: `Valid — authenticated as @${body.login ?? "unknown"}`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401) {
    log("err", "401 — token invalid or expired")
    return { valid: false, provider: "GitHub", message: "Invalid — token rejected", detail: "HTTP 401", logs, latencyMs, responseHeaders }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "GitHub", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders }
}

async function testStripe(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.stripe.com/v1/balance"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: Stripe")
  log("info", "Endpoint: GET /v1/balance")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    log("ok", "Valid — Stripe balance endpoint accessible")
    return {
      valid: true, provider: "Stripe", message: "Valid — key accepted by Stripe", detail: "HTTP 200",
      logs, latencyMs, responseHeaders,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "No such API key"
    log("err", `401: ${err}`)
    return { valid: false, provider: "Stripe", message: "Invalid — key rejected", detail: err, logs, latencyMs, responseHeaders }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Stripe", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders }
}

async function testMistral(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.mistral.ai/v1/models"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: Mistral AI")
  log("info", "Endpoint: GET /v1/models")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const count = Array.isArray(data?.data) ? data.data.length : "?"
    log("ok", `Valid — ${count} Mistral models accessible`)
    return {
      valid: true, provider: "Mistral", message: `Valid — ${count} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401) {
    log("err", "401 — unauthorized")
    return { valid: false, provider: "Mistral", message: "Invalid — authentication failed", detail: "HTTP 401", logs, latencyMs, responseHeaders }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Mistral", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders }
}

async function testCohere(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.cohere.com/v1/models"
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }

  log("info", "Provider: Cohere")
  log("info", "Endpoint: GET /v1/models")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const count = Array.isArray(data?.models) ? data.models.length : "?"
    log("ok", `Valid — ${count} Cohere models accessible`)
    return {
      valid: true, provider: "Cohere", message: `Valid — ${count} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401) {
    log("err", "401 — API key invalid")
    return { valid: false, provider: "Cohere", message: "Invalid — API key rejected", detail: "HTTP 401", logs, latencyMs, responseHeaders }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Cohere", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders }
}

async function testPerplexity(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.perplexity.ai/chat/completions"
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
  const body = { model: "llama-3.1-sonar-small-128k-online", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }

  log("info", "Provider: Perplexity AI")
  log("info", "Endpoint: POST /chat/completions")
  log("curl", buildCurl({ method: "POST", url, headers, body, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200 || res.status === 429) {
    const data = await res.json().catch(() => ({}))
    const tokenUsage = extractTokenUsage(data)
    const msg = res.status === 429 ? "Valid (rate limited)" : "Valid — key accepted by Perplexity"
    log("ok", msg)
    return {
      valid: true, provider: "Perplexity", message: msg, detail: `HTTP ${res.status}`,
      logs, latencyMs, tokenUsage, responseHeaders,
      curlDisplay: buildCurl({ method: "POST", url, headers, body, maskKey: true }),
      curlFull: buildCurl({ method: "POST", url, headers, body, maskKey: false }),
    }
  }
  if (res.status === 401) {
    log("err", "401 — API key invalid")
    return { valid: false, provider: "Perplexity", message: "Invalid — authentication failed", detail: "HTTP 401", logs, latencyMs, responseHeaders }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Perplexity", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders }
}

async function testReplicate(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.replicate.com/v1/account"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: Replicate")
  log("info", "Endpoint: GET /v1/account")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const body = await res.json().catch(() => ({}))
    log("ok", `Valid — account: ${body?.username ?? "unknown"}`)
    return {
      valid: true, provider: "Replicate", message: `Valid — account: ${body?.username ?? "unknown"}`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401) {
    log("err", "401 — token invalid")
    return { valid: false, provider: "Replicate", message: "Invalid — token rejected", detail: "HTTP 401", logs, latencyMs, responseHeaders }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Replicate", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders }
}

async function testMinimax(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.minimax.io/v1/chat/completions"
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
  const body = { model: "MiniMax-M3", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }

  log("info", "Provider: MiniMax")
  log("info", "Endpoint: POST https://api.minimax.io/v1/chat/completions")
  log("curl", buildCurl({ method: "POST", url, headers, body, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    log("ok", "Valid — MiniMax key accepted")
    return {
      valid: true, provider: "MiniMax", message: "Valid — key accepted by MiniMax", detail: "HTTP 200",
      logs, latencyMs, responseHeaders,
      curlDisplay: buildCurl({ method: "POST", url, headers, body, maskKey: true }),
      curlFull: buildCurl({ method: "POST", url, headers, body, maskKey: false }),
    }
  }
  if (res.status === 401 || res.status === 403) {
    const body2 = await res.json().catch(() => ({}))
    const err = body2?.base_resp?.status_msg ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "MiniMax", message: "Invalid — key rejected", detail: err, logs, latencyMs, responseHeaders }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "MiniMax", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders }
}

async function testDahono(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const modelsUrl = "https://gateway.dahono.com/v1/models"
  const chatUrl = "https://gateway.dahono.com/v1/chat/completions"
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }

  log("info", "Provider: Dahono Labs Gateway (OpenAI-compatible)")
  log("info", "Step 1 — GET /v1/models to verify key and list models")
  log("curl", buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: true }))
  log("req",  `GET ${modelsUrl} — Authorization: Bearer ${key.slice(0, 14)}...`)

  const modelsRes = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs1 = Date.now() - start
  const responseHeaders = captureHeaders(modelsRes, IMPORTANT_HEADERS)

  log("res", `HTTP ${modelsRes.status} ${modelsRes.statusText} (${latencyMs1}ms)`)

  if (modelsRes.status === 401 || modelsRes.status === 403) {
    const body = await modelsRes.json().catch(() => ({}))
    const err = body?.error?.message ?? body?.message ?? "Unauthorized"
    log("err", `${modelsRes.status}: ${err}`)
    return { valid: false, provider: "Dahono", message: "Invalid — key rejected by gateway", detail: err, logs, latencyMs: latencyMs1, responseHeaders }
  }

  if (!modelsRes.ok) {
    log("err", `Unexpected HTTP ${modelsRes.status}`)
    return { valid: false, provider: "Dahono", message: `Unexpected HTTP ${modelsRes.status}`, detail: `HTTP ${modelsRes.status}`, logs, latencyMs: latencyMs1, responseHeaders }
  }

  const modelsData = await modelsRes.json().catch(() => ({ data: [] }))
  const modelList: string[] = (modelsData?.data ?? []).map((m: Record<string, unknown>) => String(m.id))
  const freeModels = (modelsData?.data ?? []).filter((m: Record<string, unknown>) => m.free).map((m: Record<string, unknown>) => String(m.id))
  log("ok", `Key accepted — ${modelList.length} models found (${freeModels.length} free)`)
  log("info", `Free models: ${freeModels.slice(0, 5).join(", ")}${freeModels.length > 5 ? ` +${freeModels.length - 5} more` : ""}`)

  const testModel = freeModels.find((id: string) => id.includes("flash") || id.includes("haiku")) ?? freeModels[0] ?? "dahono/deepseek-v4-flash"
  const chatBody = { model: testModel, max_tokens: 32, messages: [{ role: "user", content: "Say hello in one word." }] }

  log("info", `Step 2 — POST /v1/chat/completions with model: ${testModel}`)
  log("curl", buildCurl({ method: "POST", url: chatUrl, headers, body: chatBody, maskKey: true }))
  log("req",  `POST ${chatUrl} → model: ${testModel}`)

  const chatRes = await fetch(chatUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(chatBody),
    signal: AbortSignal.timeout(15_000),
  })
  const totalLatency = Date.now() - start

  log("res", `HTTP ${chatRes.status} ${chatRes.statusText}`)

  if (chatRes.ok) {
    const chatData = await chatRes.json().catch(() => ({}))
    const reply = chatData?.choices?.[0]?.message?.content ?? "no reply"
    const tokenUsage = extractTokenUsage(chatData)
    log("ok", `Chat reply: "${reply.trim()}"`)
    if (tokenUsage?.totalTokens) log("info", `Tokens used: ${tokenUsage.totalTokens}`)
    return {
      valid: true, provider: "Dahono",
      message: `Valid — ${modelList.length} models accessible, chat works`,
      detail: `Model: ${testModel} | Reply: "${reply.trim()}"`,
      logs, latencyMs: totalLatency, tokenUsage, responseHeaders,
      curlDisplay: buildCurl({ method: "POST", url: chatUrl, headers, body: chatBody, maskKey: true }),
      curlFull: buildCurl({ method: "POST", url: chatUrl, headers, body: chatBody, maskKey: false }),
    }
  }

  const chatErr = await chatRes.json().catch(() => ({}))
  const errMsg = chatErr?.error?.message ?? `HTTP ${chatRes.status}`
  log("err", `Chat failed: ${errMsg}`)
  return {
    valid: true,
    provider: "Dahono",
    message: `Key valid (${modelList.length} models), but chat request failed`,
    detail: errMsg,
    logs, latencyMs: totalLatency, responseHeaders,
    curlDisplay: buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: true }),
    curlFull: buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: false }),
  }
}

async function testDeepSeek(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.deepseek.com/models"
  const balanceUrl = "https://api.deepseek.com/user/balance"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: DeepSeek")
  log("info", "Endpoint: GET /models (OpenAI-compatible)")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const count = Array.isArray(data?.data) ? data.data.length : "?"
    log("ok", `Valid — ${count} DeepSeek models accessible`)

    // Fetch credit balance
    let balance: string | undefined
    try {
      const balRes = await fetch(balanceUrl, { headers, signal: AbortSignal.timeout(6_000) })
      if (balRes.ok) {
        const balData = await balRes.json().catch(() => ({}))
        const info = balData?.balance_infos?.[0]
        if (info) {
          const total = parseFloat(info.total_balance ?? "0")
          const granted = parseFloat(info.granted_balance ?? "0")
          const topped = parseFloat(info.topped_up_balance ?? "0")
          balance = `$${total.toFixed(4)} (topped-up: $${topped.toFixed(4)}, granted: $${granted.toFixed(4)})`
          log("info", `Balance: ${balance}`)
        }
      }
    } catch { /* balance fetch is best-effort */ }

    return {
      valid: true, provider: "DeepSeek", message: `Valid — ${count} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders, balance,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Invalid API key"
    log("err", `401: ${err}`)
    return { valid: false, provider: "DeepSeek", message: "Invalid — authentication failed", detail: err, logs, latencyMs, responseHeaders }
  }
  if (res.status === 402) {
    log("ok", "Valid — key accepted (insufficient balance)")

    // Still try to get balance info even on 402
    let balance: string | undefined
    try {
      const balRes = await fetch(balanceUrl, { headers, signal: AbortSignal.timeout(6_000) })
      if (balRes.ok) {
        const balData = await balRes.json().catch(() => ({}))
        const info = balData?.balance_infos?.[0]
        if (info) {
          const total = parseFloat(info.total_balance ?? "0")
          balance = `$${total.toFixed(4)} (insufficient)`
          log("info", `Balance: ${balance}`)
        }
      }
    } catch { /* best-effort */ }

    return {
      valid: true, provider: "DeepSeek", message: "Valid (insufficient balance)", detail: "HTTP 402",
      logs, latencyMs, responseHeaders, balance,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "DeepSeek", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders }
}

async function testXAI(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.x.ai/v1/models"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: xAI (Grok)")
  log("info", "Endpoint: GET /v1/models (OpenAI-compatible)")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const count = Array.isArray(data?.data) ? data.data.length : "?"
    log("ok", `Valid — ${count} xAI models accessible`)
    return {
      valid: true, provider: "xAI/Grok", message: `Valid — ${count} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "xAI/Grok", message: "Invalid — authentication failed", detail: err, logs, latencyMs, responseHeaders }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "xAI/Grok", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders }
}

async function testQwen(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: Qwen / Alibaba DashScope (intl)")
  log("info", "Endpoint: GET /compatible-mode/v1/models")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const count = Array.isArray(data?.data) ? data.data.length : "?"
    log("ok", `Valid — ${count} Qwen models accessible`)
    return {
      valid: true, provider: "Qwen/Alibaba", message: `Valid — ${count} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.message ?? body?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "Qwen/Alibaba", message: "Invalid — authentication failed", detail: err, logs, latencyMs, responseHeaders }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Qwen/Alibaba", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders }
}

async function testZhipu(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
  const body = { model: "glm-4-flash", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }

  log("info", "Provider: Zhipu AI (GLM)")
  log("info", "Endpoint: POST /api/paas/v4/chat/completions (model: glm-4-flash)")
  log("curl", buildCurl({ method: "POST", url, headers, body, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200 || res.status === 429) {
    const data = await res.json().catch(() => ({}))
    const tokenUsage = extractTokenUsage(data)
    const msg = res.status === 429 ? "Valid (rate limited)" : "Valid — GLM key accepted"
    log("ok", msg)

    // Fetch quota/balance
    let balance: string | undefined
    try {
      const quotaRes = await fetch("https://open.bigmodel.cn/api/monitor/usage/quota/limit", {
        headers: { Authorization: key },
        signal: AbortSignal.timeout(6_000),
      })
      if (quotaRes.ok) {
        const qd = await quotaRes.json().catch(() => ({}))
        const remaining = qd?.data?.remaining_quota ?? qd?.remaining_quota
        const total = qd?.data?.total_quota ?? qd?.total_quota
        if (remaining !== undefined) {
          balance = `Quota: ${remaining}${total ? ` / ${total}` : ""} tokens remaining`
          log("info", `Quota: ${balance}`)
        }
      }
    } catch { /* best-effort */ }

    return {
      valid: true, provider: "Zhipu/GLM", message: msg, detail: `HTTP ${res.status}`,
      logs, latencyMs, tokenUsage, responseHeaders, balance,
      curlDisplay: buildCurl({ method: "POST", url, headers, body, maskKey: true }),
      curlFull: buildCurl({ method: "POST", url, headers, body, maskKey: false }),
    }
  }
  if (res.status === 401 || res.status === 403) {
    const body2 = await res.json().catch(() => ({}))
    const err = body2?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "Zhipu/GLM", message: "Invalid — key rejected", detail: err, logs, latencyMs, responseHeaders }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Zhipu/GLM", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders }
}

async function testTogether(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.together.ai/v1/models"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: Together AI")
  log("info", "Endpoint: GET /v1/models (OpenAI-compatible)")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const count = Array.isArray(data) ? data.length : "?"
    log("ok", `Valid — ${count} Together AI models accessible`)
    return {
      valid: true, provider: "Together AI", message: `Valid — ${count} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401) {
    log("err", "401 — API key invalid")
    return { valid: false, provider: "Together AI", message: "Invalid — authentication failed", detail: "HTTP 401", logs, latencyMs, responseHeaders }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Together AI", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders }
}

async function testFirebase(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${key}`
  const headers = { "Content-Type": "application/json" }

  log("info", "Provider: Google / Firebase (Web API Key)")
  log("info", "Endpoint: GET identitytoolkit/v3/relyingparty/getProjectConfig")
  log("info", "Note: Firebase Web API keys are designed to be public. This confirms the key is real and shows project info.")
  log("curl", buildCurl({ method: "GET", url: url.replace(key, key.slice(0, 8) + "..."), headers, maskKey: false }))
  log("req",  `GET getProjectConfig?key=${key.slice(0, 8)}...`)

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.ok) {
    const data = await res.json().catch(() => ({}))
    const projectId = data?.projectId ?? "unknown"
    const domains: string[] = data?.authorizedDomains ?? []
    log("ok", `Valid — Firebase project: ${projectId}`)
    log("info", `Authorized domains: ${domains.join(", ")}`)
    return {
      valid: true, provider: "Google / Firebase",
      message: `Valid Firebase key — project: ${projectId}`,
      detail: `Authorized domains: ${domains.slice(0, 3).join(", ")}${domains.length > 3 ? ` +${domains.length - 3} more` : ""}`,
      logs, latencyMs, responseHeaders,
      curlDisplay: `curl '${url.replace(key, key.slice(0, 8) + "...")}'`,
      curlFull: `curl '${url}'`,
    }
  }

  const errBody = await res.json().catch(() => ({}))
  const errMsg = errBody?.error?.message ?? `HTTP ${res.status}`
  log("err", `${res.status}: ${errMsg}`)
  return { valid: false, provider: "Google / Firebase", message: "Invalid or restricted key", detail: errMsg, logs, latencyMs, responseHeaders }
}

async function testOpenRouter(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const modelsUrl = "https://openrouter.ai/api/v1/models"
  const creditsUrl = "https://openrouter.ai/api/v1/credits"
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }

  log("info", "Provider: OpenRouter")
  log("info", "Endpoint: GET /api/v1/models")
  log("curl", buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const models: string[] = Array.isArray(data?.data) ? data.data.map((m: Record<string, unknown>) => String(m.id)) : []
    const count = models.length || "?"
    log("ok", `Valid — ${count} models accessible`)

    // Fetch credits
    let balance: string | undefined
    try {
      const credRes = await fetch(creditsUrl, { headers, signal: AbortSignal.timeout(6_000) })
      if (credRes.ok) {
        const credData = await credRes.json().catch(() => ({}))
        const totalCredits = credData?.data?.total_credits
        const totalUsage = credData?.data?.total_usage
        if (totalCredits !== undefined) {
          const remaining = totalCredits - (totalUsage ?? 0)
          balance = `$${remaining.toFixed(4)} remaining ($${totalCredits.toFixed(4)} total, $${(totalUsage ?? 0).toFixed(4)} used)`
          log("info", `Credits: ${balance}`)
        }
      }
    } catch { /* best-effort */ }

    return {
      valid: true, provider: "OpenRouter", message: `Valid — ${count} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders, modelCount: models.length, modelList: models.slice(0, 8), balance, errorReason: null,
      curlDisplay: buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: false }),
    }
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "OpenRouter", message: "Invalid — authentication failed", detail: err, logs, latencyMs, responseHeaders, errorReason: "wrong_key" }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "OpenRouter", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders, errorReason: null }
}

async function testMoonshot(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const modelsUrl = "https://api.moonshot.cn/v1/models"
  const balanceUrl = "https://api.moonshot.cn/v1/users/me/balance"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: Moonshot AI (Kimi)")
  log("info", "Endpoint: GET /v1/models")
  log("curl", buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const models: string[] = Array.isArray(data?.data) ? data.data.map((m: Record<string, unknown>) => String(m.id)) : []
    log("ok", `Valid — ${models.length} Moonshot models accessible`)

    // Fetch balance
    let balance: string | undefined
    try {
      const balRes = await fetch(balanceUrl, { headers, signal: AbortSignal.timeout(6_000) })
      if (balRes.ok) {
        const balData = await balRes.json().catch(() => ({}))
        const avail = balData?.data?.available_balance
        const voucher = balData?.data?.voucher_balance
        const cash = balData?.data?.cash_balance
        if (avail !== undefined) {
          balance = `¥${parseFloat(avail).toFixed(4)} available (cash: ¥${parseFloat(cash ?? 0).toFixed(2)}, voucher: ¥${parseFloat(voucher ?? 0).toFixed(2)})`
          log("info", `Balance: ${balance}`)
        }
      }
    } catch { /* best-effort */ }

    return {
      valid: true, provider: "Moonshot/Kimi", message: `Valid — ${models.length} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders, modelCount: models.length, modelList: models.slice(0, 8), balance, errorReason: null,
      curlDisplay: buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: false }),
    }
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "Moonshot/Kimi", message: "Invalid — key rejected", detail: err, logs, latencyMs, responseHeaders, errorReason: "wrong_key" }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Moonshot/Kimi", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders, errorReason: null }
}

async function testNovita(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const modelsUrl = "https://api.novita.ai/openai/v1/models"
  const balanceUrl = "https://api.novita.ai/openapi/v1/billing/balance/detail"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: Novita AI")
  log("info", "Endpoint: GET /openai/v1/models")
  log("curl", buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const models: string[] = Array.isArray(data?.data) ? data.data.map((m: Record<string, unknown>) => String(m.id)) : []
    log("ok", `Valid — ${models.length} Novita models accessible`)

    // Fetch credit balance
    let balance: string | undefined
    try {
      const balRes = await fetch(balanceUrl, { headers, signal: AbortSignal.timeout(6_000) })
      if (balRes.ok) {
        const balData = await balRes.json().catch(() => ({}))
        const bal = balData?.data?.balance ?? balData?.balance
        const currency = balData?.data?.currency ?? "USD"
        if (bal !== undefined) {
          balance = `$${parseFloat(bal).toFixed(4)} ${currency}`
          log("info", `Balance: ${balance}`)
        }
      }
    } catch { /* best-effort */ }

    return {
      valid: true, provider: "Novita AI", message: `Valid — ${models.length} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders, modelCount: models.length, modelList: models.slice(0, 8), balance, errorReason: null,
      curlDisplay: buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: false }),
    }
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "Novita AI", message: "Invalid — key rejected", detail: err, logs, latencyMs, responseHeaders, errorReason: "wrong_key" }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Novita AI", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders, errorReason: null }
}

async function testHyperbolic(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const modelsUrl = "https://api.hyperbolic.xyz/v1/models"
  const balanceUrl = "https://api.hyperbolic.xyz/billing/get_current_balance"
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }

  log("info", "Provider: Hyperbolic")
  log("info", "Endpoint: GET /v1/models")
  log("curl", buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const models: string[] = Array.isArray(data?.data) ? data.data.map((m: Record<string, unknown>) => String(m.id)) : []
    log("ok", `Valid — ${models.length} Hyperbolic models accessible`)

    // Fetch credit balance
    let balance: string | undefined
    try {
      const balRes = await fetch(balanceUrl, { headers, signal: AbortSignal.timeout(6_000) })
      if (balRes.ok) {
        const balData = await balRes.json().catch(() => ({}))
        const credits = balData?.credits ?? balData?.balance
        if (credits !== undefined) {
          balance = `$${parseFloat(credits).toFixed(4)} credits`
          log("info", `Balance: ${balance}`)
        }
      }
    } catch { /* best-effort */ }

    return {
      valid: true, provider: "Hyperbolic", message: `Valid — ${models.length} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders, modelCount: models.length, modelList: models.slice(0, 8), balance, errorReason: null,
      curlDisplay: buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url: modelsUrl, headers, maskKey: false }),
    }
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "Hyperbolic", message: "Invalid — key rejected", detail: err, logs, latencyMs, responseHeaders, errorReason: "wrong_key" }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Hyperbolic", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders, errorReason: null }
}

async function testCerebras(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.cerebras.ai/v1/models"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: Cerebras")
  log("info", "Endpoint: GET /v1/models")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const models: string[] = Array.isArray(data?.data) ? data.data.map((m: Record<string, unknown>) => String(m.id)) : []
    log("ok", `Valid — ${models.length} Cerebras models accessible`)
    return {
      valid: true, provider: "Cerebras", message: `Valid — ${models.length} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders, modelCount: models.length, modelList: models.slice(0, 8), errorReason: null,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "Cerebras", message: "Invalid — key rejected", detail: err, logs, latencyMs, responseHeaders, errorReason: "wrong_key" }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Cerebras", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders, errorReason: null }
}

async function testFireworks(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.fireworks.ai/inference/v1/models"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: Fireworks AI")
  log("info", "Endpoint: GET /inference/v1/models")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const models: string[] = Array.isArray(data?.data) ? data.data.map((m: Record<string, unknown>) => String(m.id)) : []
    log("ok", `Valid — ${models.length} Fireworks models accessible`)
    return {
      valid: true, provider: "Fireworks AI", message: `Valid — ${models.length} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders, modelCount: models.length, modelList: models.slice(0, 8), errorReason: null,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "Fireworks AI", message: "Invalid — key rejected", detail: err, logs, latencyMs, responseHeaders, errorReason: "wrong_key" }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Fireworks AI", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders, errorReason: null }
}

async function testSambaNova(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://api.sambanova.ai/v1/models"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: SambaNova")
  log("info", "Endpoint: GET /v1/models")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const models: string[] = Array.isArray(data?.data) ? data.data.map((m: Record<string, unknown>) => String(m.id)) : []
    log("ok", `Valid — ${models.length} SambaNova models accessible`)
    return {
      valid: true, provider: "SambaNova", message: `Valid — ${models.length} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders, modelCount: models.length, modelList: models.slice(0, 8), errorReason: null,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "SambaNova", message: "Invalid — key rejected", detail: err, logs, latencyMs, responseHeaders, errorReason: "wrong_key" }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "SambaNova", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders, errorReason: null }
}

async function testNVIDIA(key: string): Promise<TestKeyResult> {
  const { log, logs, start } = makeLogger()
  const url = "https://integrate.api.nvidia.com/v1/models"
  const headers = { Authorization: `Bearer ${key}` }

  log("info", "Provider: NVIDIA NIM")
  log("info", "Endpoint: GET /v1/models")
  log("curl", buildCurl({ method: "GET", url, headers, maskKey: true }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) })
  const latencyMs = Date.now() - start
  const responseHeaders = captureHeaders(res, IMPORTANT_HEADERS)

  log("res", `HTTP ${res.status} ${res.statusText} (${latencyMs}ms)`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const models: string[] = Array.isArray(data?.data) ? data.data.map((m: Record<string, unknown>) => String(m.id)) : []
    log("ok", `Valid — ${models.length} NVIDIA NIM models accessible`)
    return {
      valid: true, provider: "NVIDIA NIM", message: `Valid — ${models.length} models accessible`, detail: "HTTP 200",
      logs, latencyMs, responseHeaders, modelCount: models.length, modelList: models.slice(0, 8), errorReason: null,
      curlDisplay: buildCurl({ method: "GET", url, headers, maskKey: true }),
      curlFull: buildCurl({ method: "GET", url, headers, maskKey: false }),
    }
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "NVIDIA NIM", message: "Invalid — key rejected", detail: err, logs, latencyMs, responseHeaders, errorReason: "wrong_key" }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "NVIDIA NIM", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs, latencyMs, responseHeaders, errorReason: null }
}

// ── Label → tester map ────────────────────────────────────────────────────────

type Tester = (key: string) => Promise<TestKeyResult>

const TESTERS: Record<string, Tester> = {
  "Anthropic API Key": testAnthropic,
  "OpenAI API Key": testOpenAI,
  "OpenAI Project Key": testOpenAI,
  "Google API Key": testGoogle,
  "Google Gemini Key": testGoogle,
  "Google / Firebase API Key": testFirebase,
  "HuggingFace Token": testHuggingFace,
  "Groq API Key": testGroq,
  "GitHub Token": testGitHub,
  "GitHub Fine-grained Token": testGitHub,
  "Stripe Secret Key": testStripe,
  "Stripe Publishable Key": testStripe,
  "Stripe Test Key": testStripe,
  "Mistral API Key": testMistral,
  "Cohere API Key": testCohere,
  "Perplexity API Key": testPerplexity,
  "Replicate API Token": testReplicate,
  "MiniMax API Key": testMinimax,
  "Dahono API Key": testDahono,
  "DeepSeek API Key": testDeepSeek,
  "xAI API Key": testXAI,
  "Qwen API Key": testQwen,
  "Zhipu API Key": testZhipu,
  "Together AI Key": testTogether,
  // Newly added providers with balance/credit support
  "OpenRouter API Key": testOpenRouter,
  "Moonshot API Key": testMoonshot,
  "Kimi API Key": testMoonshot,
  "Novita AI API Key": testNovita,
  "Hyperbolic API Key": testHyperbolic,
  "Cerebras API Key": testCerebras,
  "Fireworks API Key": testFireworks,
  "Fireworks AI API Key": testFireworks,
  "SambaNova API Key": testSambaNova,
  "NVIDIA API Key": testNVIDIA,
  "NVIDIA NIM API Key": testNVIDIA,
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let label: string, value: string
  try {
    const body = await req.json()
    label = body.label
    value = body.value
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!label || !value) {
    return NextResponse.json({ error: "Missing label or value" }, { status: 400 })
  }

  if (label === "Google Analytics ID") {
    const { log, logs } = makeLogger()
    log("info", "Provider: Google Analytics")
    log("info", `Measurement ID: ${value}`)
    log("info", "Note: Google Analytics IDs (G-XXXXXXXX) are PUBLIC tracking codes embedded in frontend code intentionally.")
    log("info", "They are not secret — anyone visiting the site can see them.")
    log("ok", `ID format valid: ${value}`)
    return NextResponse.json({
      valid: null,
      provider: "Google Analytics",
      message: "Public tracking ID — not a secret (by design)",
      detail: `${value} is a standard Google Analytics Measurement ID`,
      logs,
    })
  }

  const tester = TESTERS[label]
  if (!tester) {
    const { log, logs } = makeLogger()
    log("info", `Provider: ${label}`)
    log("info", "No live test available for this key type")
    return NextResponse.json(
      { valid: null, provider: label, message: "No live test available for this key type", detail: "Unsupported provider", logs },
      { status: 200 }
    )
  }

  try {
    const result = await tester(value)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { valid: false, provider: label, message: `Test failed: ${msg}`, detail: msg, logs: [] },
      { status: 200 }
    )
  }
}
