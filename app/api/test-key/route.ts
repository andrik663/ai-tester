import { NextRequest, NextResponse } from "next/server"

export interface LogEntry {
  ts: number          // ms offset from start
  level: "info" | "req" | "res" | "ok" | "err" | "curl"
  text: string
}

export interface TestKeyResult {
  valid: boolean | null
  provider: string
  message: string
  detail?: string
  logs: LogEntry[]
}

// ── Logger helper ─────────────────────────────────────────────────────────────

function makeLogger() {
  const start = Date.now()
  const logs: LogEntry[] = []
  function log(level: LogEntry["level"], text: string) {
    logs.push({ ts: Date.now() - start, level, text })
  }
  return { log, logs }
}

// ── cURL builder ──────────────────────────────────────────────────────────────

function buildCurl(opts: {
  method: string
  url: string
  headers: Record<string, string>
  body?: object
}): string {
  const headerParts = Object.entries(opts.headers)
    .map(([k, v]) => `  -H '${k}: ${v}'`)
    .join(" \\\n")
  const bodyPart = opts.body
    ? ` \\\n  -d '${JSON.stringify(opts.body, null, 2).replace(/'/g, "'\\''")}' `
    : ""
  return `curl -X ${opts.method} '${opts.url}' \\\n${headerParts}${bodyPart}`
}

// ── Provider testers ──────────────────────────────────────────────────────────

async function testAnthropic(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://api.anthropic.com/v1/messages"
  const headers = {
    "x-api-key": key.slice(0, 8) + "...",
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  }
  const body = {
    model: "claude-3-haiku-20240307",
    max_tokens: 1,
    messages: [{ role: "user", content: "hi" }],
  }

  log("info", "Provider: Anthropic (claude-3-haiku-20240307)")
  log("info", "Endpoint: POST /v1/messages")
  log("curl", buildCurl({ method: "POST", url, headers, body }))
  log("req",  `Sending request... x-api-key: ${key.slice(0, 12)}...`)

  const res = await fetch(url.replace("x-api-key", "x-api-key"), {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.status === 200 || res.status === 429) {
    const msg = res.status === 429 ? "Valid — key accepted (rate limited)" : "Valid — key accepted by Anthropic"
    log("ok", msg)
    return { valid: true, provider: "Anthropic", message: msg, detail: `HTTP ${res.status}`, logs }
  }

  if (res.status === 401) {
    const body2 = await res.json().catch(() => ({}))
    const err = body2?.error?.message ?? "authentication_error"
    log("err", `401 Unauthorized: ${err}`)
    return { valid: false, provider: "Anthropic", message: "Invalid — authentication failed", detail: err, logs }
  }

  const rawBody = await res.json().catch(() => ({}))
  const errMsg = rawBody?.error?.message ?? JSON.stringify(rawBody).slice(0, 120)
  log("err", `Unexpected status ${res.status}: ${errMsg}`)
  return { valid: false, provider: "Anthropic", message: `Unexpected HTTP ${res.status}`, detail: errMsg, logs }
}

async function testOpenAI(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://api.openai.com/v1/models"
  const headers = { "Authorization": `Bearer ${key.slice(0, 8)}...` }

  log("info", "Provider: OpenAI")
  log("info", "Endpoint: GET /v1/models")
  log("curl", buildCurl({ method: "GET", url, headers }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(12_000),
  })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const count = Array.isArray(data?.data) ? data.data.length : "?"
    log("ok", `Valid — ${count} models accessible`)
    return { valid: true, provider: "OpenAI", message: `Valid — ${count} models accessible`, detail: "HTTP 200", logs }
  }
  if (res.status === 429) {
    log("ok", "Valid — key accepted (rate limited)")
    return { valid: true, provider: "OpenAI", message: "Valid (rate limited)", detail: "HTTP 429", logs }
  }
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Incorrect API key"
    log("err", `401 Unauthorized: ${err}`)
    return { valid: false, provider: "OpenAI", message: "Invalid — authentication failed", detail: err, logs }
  }
  const body = await res.json().catch(() => ({}))
  const errMsg = body?.error?.message ?? JSON.stringify(body).slice(0, 120)
  log("err", `Unexpected ${res.status}: ${errMsg}`)
  return { valid: false, provider: "OpenAI", message: `Unexpected HTTP ${res.status}`, detail: errMsg, logs }
}

async function testGoogle(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
  const displayUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key.slice(0, 8)}...`

  log("info", "Provider: Google Gemini (Generative Language API)")
  log("info", "Endpoint: GET /v1beta/models")
  log("curl", `curl '${displayUrl}'`)
  log("req",  `Sending request... key: ${key.slice(0, 10)}...`)

  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const count = Array.isArray(data?.models) ? data.models.length : "?"
    log("ok", `Valid — ${count} Gemini models accessible`)
    return { valid: true, provider: "Google/Gemini", message: `Valid — ${count} models accessible`, detail: "HTTP 200", logs }
  }
  if (res.status === 400 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "API key invalid"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "Google/Gemini", message: "Invalid — API key rejected", detail: err, logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Google/Gemini", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testHuggingFace(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://huggingface.co/api/whoami"
  const headers = { Authorization: `Bearer ${key.slice(0, 8)}...` }

  log("info", "Provider: HuggingFace")
  log("info", "Endpoint: GET /api/whoami")
  log("curl", buildCurl({ method: "GET", url, headers }))
  log("req",  `Sending request... token: ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(12_000),
  })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.status === 200) {
    const body = await res.json().catch(() => ({}))
    const user = body?.name ?? "unknown"
    log("ok", `Valid — authenticated as ${user}`)
    return { valid: true, provider: "HuggingFace", message: `Valid — authenticated as ${user}`, detail: "HTTP 200", logs }
  }
  if (res.status === 401) {
    log("err", "401 Unauthorized — token rejected")
    return { valid: false, provider: "HuggingFace", message: "Invalid — token rejected", detail: "HTTP 401", logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "HuggingFace", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testGroq(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://api.groq.com/openai/v1/models"
  const headers = { Authorization: `Bearer ${key.slice(0, 8)}...` }

  log("info", "Provider: Groq (OpenAI-compatible)")
  log("info", "Endpoint: GET /openai/v1/models")
  log("curl", buildCurl({ method: "GET", url, headers }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(12_000),
  })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const count = Array.isArray(data?.data) ? data.data.length : "?"
    log("ok", `Valid — ${count} Groq models accessible`)
    return { valid: true, provider: "Groq", message: `Valid — ${count} models accessible`, detail: "HTTP 200", logs }
  }
  if (res.status === 429) {
    log("ok", "Valid — key accepted (rate limited)")
    return { valid: true, provider: "Groq", message: "Valid (rate limited)", detail: "HTTP 429", logs }
  }
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    log("err", `401: ${body?.error?.message ?? "Invalid API key"}`)
    return { valid: false, provider: "Groq", message: "Invalid — authentication failed", detail: `HTTP 401`, logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Groq", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testGitHub(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://api.github.com/user"
  const headers = { Authorization: `Bearer ${key.slice(0, 8)}...`, "User-Agent": "APIKeyTester/1.0" }

  log("info", "Provider: GitHub")
  log("info", "Endpoint: GET /user")
  log("curl", buildCurl({ method: "GET", url, headers }))
  log("req",  `Sending request... token: ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, "User-Agent": "APIKeyTester/1.0" },
    signal: AbortSignal.timeout(12_000),
  })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.status === 200) {
    const body = await res.json().catch(() => ({}))
    log("ok", `Valid — authenticated as @${body.login ?? "unknown"}`)
    return { valid: true, provider: "GitHub", message: `Valid — authenticated as @${body.login ?? "unknown"}`, detail: "HTTP 200", logs }
  }
  if (res.status === 401) {
    log("err", "401 — token invalid or expired")
    return { valid: false, provider: "GitHub", message: "Invalid — token rejected", detail: "HTTP 401", logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "GitHub", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testStripe(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://api.stripe.com/v1/balance"
  const headers = { Authorization: `Bearer ${key.slice(0, 8)}...` }

  log("info", "Provider: Stripe")
  log("info", "Endpoint: GET /v1/balance")
  log("curl", buildCurl({ method: "GET", url, headers }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(12_000),
  })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.status === 200) {
    log("ok", "Valid — Stripe balance endpoint accessible")
    return { valid: true, provider: "Stripe", message: "Valid — key accepted by Stripe", detail: "HTTP 200", logs }
  }
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "No such API key"
    log("err", `401: ${err}`)
    return { valid: false, provider: "Stripe", message: "Invalid — key rejected", detail: err, logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Stripe", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testMistral(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://api.mistral.ai/v1/models"
  const headers = { Authorization: `Bearer ${key.slice(0, 8)}...` }

  log("info", "Provider: Mistral AI")
  log("info", "Endpoint: GET /v1/models")
  log("curl", buildCurl({ method: "GET", url, headers }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(12_000),
  })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const count = Array.isArray(data?.data) ? data.data.length : "?"
    log("ok", `Valid — ${count} Mistral models accessible`)
    return { valid: true, provider: "Mistral", message: `Valid — ${count} models accessible`, detail: "HTTP 200", logs }
  }
  if (res.status === 401) {
    log("err", "401 — unauthorized")
    return { valid: false, provider: "Mistral", message: "Invalid — authentication failed", detail: "HTTP 401", logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Mistral", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testCohere(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://api.cohere.com/v1/models"
  const headers = { Authorization: `Bearer ${key.slice(0, 8)}...`, "Content-Type": "application/json" }

  log("info", "Provider: Cohere")
  log("info", "Endpoint: GET /v1/models")
  log("curl", buildCurl({ method: "GET", url, headers }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(12_000),
  })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const count = Array.isArray(data?.models) ? data.models.length : "?"
    log("ok", `Valid — ${count} Cohere models accessible`)
    return { valid: true, provider: "Cohere", message: `Valid — ${count} models accessible`, detail: "HTTP 200", logs }
  }
  if (res.status === 401) {
    log("err", "401 — API key invalid")
    return { valid: false, provider: "Cohere", message: "Invalid — API key rejected", detail: "HTTP 401", logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Cohere", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testPerplexity(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://api.perplexity.ai/chat/completions"
  const headers = {
    Authorization: `Bearer ${key.slice(0, 8)}...`,
    "Content-Type": "application/json",
  }
  const body = {
    model: "llama-3.1-sonar-small-128k-online",
    max_tokens: 1,
    messages: [{ role: "user", content: "hi" }],
  }

  log("info", "Provider: Perplexity AI")
  log("info", "Endpoint: POST /chat/completions")
  log("curl", buildCurl({ method: "POST", url, headers, body }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.status === 200 || res.status === 429) {
    const msg = res.status === 429 ? "Valid (rate limited)" : "Valid — key accepted by Perplexity"
    log("ok", msg)
    return { valid: true, provider: "Perplexity", message: msg, detail: `HTTP ${res.status}`, logs }
  }
  if (res.status === 401) {
    log("err", "401 — API key invalid")
    return { valid: false, provider: "Perplexity", message: "Invalid — authentication failed", detail: "HTTP 401", logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Perplexity", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testReplicate(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://api.replicate.com/v1/account"
  const headers = { Authorization: `Bearer ${key.slice(0, 8)}...` }

  log("info", "Provider: Replicate")
  log("info", "Endpoint: GET /v1/account")
  log("curl", buildCurl({ method: "GET", url, headers }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(12_000),
  })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.status === 200) {
    const body = await res.json().catch(() => ({}))
    log("ok", `Valid — account: ${body?.username ?? "unknown"}`)
    return { valid: true, provider: "Replicate", message: `Valid — account: ${body?.username ?? "unknown"}`, detail: "HTTP 200", logs }
  }
  if (res.status === 401) {
    log("err", "401 — token invalid")
    return { valid: false, provider: "Replicate", message: "Invalid — token rejected", detail: "HTTP 401", logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Replicate", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testMinimax(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://api.minimax.chat/v1/text/chatcompletion_v2"
  const headers = {
    Authorization: `Bearer ${key.slice(0, 8)}...`,
    "Content-Type": "application/json",
  }
  const body = {
    model: "abab6.5s-chat",
    max_tokens: 1,
    messages: [{ role: "user", content: "hi" }],
  }

  log("info", "Provider: MiniMax")
  log("info", "Endpoint: POST /v1/text/chatcompletion_v2")
  log("curl", buildCurl({ method: "POST", url, headers, body }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.status === 200) {
    log("ok", "Valid — MiniMax key accepted")
    return { valid: true, provider: "MiniMax", message: "Valid — key accepted by MiniMax", detail: "HTTP 200", logs }
  }
  if (res.status === 401 || res.status === 403) {
    const body2 = await res.json().catch(() => ({}))
    const err = body2?.base_resp?.status_msg ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "MiniMax", message: "Invalid — key rejected", detail: err, logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "MiniMax", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

// ── Label → tester map ────────────────────────────────────────────────────────

type Tester = (key: string) => Promise<TestKeyResult>

const TESTERS: Record<string, Tester> = {
  "Anthropic API Key": testAnthropic,
  "OpenAI API Key": testOpenAI,
  "OpenAI Project Key": testOpenAI,
  "Google API Key": testGoogle,
  "Google Gemini Key": testGoogle,
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
