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

async function testDahono(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const modelsUrl = "https://gateway.dahono.com/v1/models"
  const chatUrl = "https://gateway.dahono.com/v1/chat/completions"
  const headers = { Authorization: `Bearer ${key.slice(0, 14)}...` }

  log("info", "Provider: Dahono Labs Gateway (OpenAI-compatible)")
  log("info", "Step 1 — GET /v1/models to verify key and list models")
  log("curl", buildCurl({ method: "GET", url: modelsUrl, headers }))
  log("req",  `GET ${modelsUrl} — Authorization: Bearer ${key.slice(0, 14)}...`)

  const modelsRes = await fetch(modelsUrl, {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(12_000),
  })

  log("res", `HTTP ${modelsRes.status} ${modelsRes.statusText}`)

  if (modelsRes.status === 401 || modelsRes.status === 403) {
    const body = await modelsRes.json().catch(() => ({}))
    const err = body?.error?.message ?? body?.message ?? "Unauthorized"
    log("err", `${modelsRes.status}: ${err}`)
    return { valid: false, provider: "Dahono", message: "Invalid — key rejected by gateway", detail: err, logs }
  }

  if (!modelsRes.ok) {
    log("err", `Unexpected HTTP ${modelsRes.status}`)
    return { valid: false, provider: "Dahono", message: `Unexpected HTTP ${modelsRes.status}`, detail: `HTTP ${modelsRes.status}`, logs }
  }

  const modelsData = await modelsRes.json().catch(() => ({ data: [] }))
  const modelList: string[] = (modelsData?.data ?? []).map((m: Record<string, unknown>) => String(m.id))
  const freeModels = (modelsData?.data ?? []).filter((m: Record<string, unknown>) => m.free).map((m: Record<string, unknown>) => String(m.id))
  log("ok", `Key accepted — ${modelList.length} models found (${freeModels.length} free)`)
  log("info", `Free models: ${freeModels.slice(0, 5).join(", ")}${freeModels.length > 5 ? `... +${freeModels.length - 5} more` : ""}`)

  // Step 2: send a real chat request with a free model
  const testModel = freeModels.find((id: string) => id.includes("flash") || id.includes("haiku")) ?? freeModels[0] ?? "dahono/deepseek-v4-flash"
  const chatBody = {
    model: testModel,
    max_tokens: 32,
    messages: [{ role: "user", content: "Say hello in one word." }],
  }

  log("info", `Step 2 — POST /v1/chat/completions with model: ${testModel}`)
  log("curl", buildCurl({ method: "POST", url: chatUrl, headers, body: chatBody }))
  log("req",  `POST ${chatUrl} → model: ${testModel}`)

  const chatRes = await fetch(chatUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(chatBody),
    signal: AbortSignal.timeout(15_000),
  })

  log("res", `HTTP ${chatRes.status} ${chatRes.statusText}`)

  if (chatRes.ok) {
    const chatData = await chatRes.json().catch(() => ({}))
    const reply = chatData?.choices?.[0]?.message?.content ?? "no reply"
    log("ok", `Chat reply: "${reply.trim()}"`)
    return {
      valid: true,
      provider: "Dahono",
      message: `Valid — ${modelList.length} models accessible, chat works`,
      detail: `Model: ${testModel} | Reply: "${reply.trim()}"`,
      logs,
    }
  }

  const chatErr = await chatRes.json().catch(() => ({}))
  const errMsg = chatErr?.error?.message ?? `HTTP ${chatRes.status}`
  log("err", `Chat failed: ${errMsg}`)
  return {
    valid: true, // key was still valid (models endpoint passed)
    provider: "Dahono",
    message: `Key valid (${modelList.length} models), but chat request failed`,
    detail: errMsg,
    logs,
  }
}

async function testDeepSeek(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://api.deepseek.com/models"
  const headers = { Authorization: `Bearer ${key.slice(0, 8)}...` }

  log("info", "Provider: DeepSeek")
  log("info", "Endpoint: GET /models (OpenAI-compatible)")
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
    log("ok", `Valid — ${count} DeepSeek models accessible`)
    return { valid: true, provider: "DeepSeek", message: `Valid — ${count} models accessible`, detail: "HTTP 200", logs }
  }
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Invalid API key"
    log("err", `401: ${err}`)
    return { valid: false, provider: "DeepSeek", message: "Invalid — authentication failed", detail: err, logs }
  }
  if (res.status === 402) {
    log("ok", "Valid — key accepted (insufficient balance)")
    return { valid: true, provider: "DeepSeek", message: "Valid (insufficient balance)", detail: "HTTP 402", logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "DeepSeek", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testXAI(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://api.x.ai/v1/models"
  const headers = { Authorization: `Bearer ${key.slice(0, 8)}...` }

  log("info", "Provider: xAI (Grok)")
  log("info", "Endpoint: GET /v1/models (OpenAI-compatible)")
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
    log("ok", `Valid — ${count} xAI models accessible`)
    return { valid: true, provider: "xAI/Grok", message: `Valid — ${count} models accessible`, detail: "HTTP 200", logs }
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "xAI/Grok", message: "Invalid — authentication failed", detail: err, logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "xAI/Grok", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testQwen(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  // DashScope international endpoint
  const url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models"
  const headers = { Authorization: `Bearer ${key.slice(0, 8)}...` }

  log("info", "Provider: Qwen / Alibaba DashScope (intl)")
  log("info", "Endpoint: GET /compatible-mode/v1/models")
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
    log("ok", `Valid — ${count} Qwen models accessible`)
    return { valid: true, provider: "Qwen/Alibaba", message: `Valid — ${count} models accessible`, detail: "HTTP 200", logs }
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = body?.message ?? body?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "Qwen/Alibaba", message: "Invalid — authentication failed", detail: err, logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Qwen/Alibaba", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testZhipu(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  // Zhipu GLM — POST a cheap chat request (no dedicated validation endpoint)
  const url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
  const headers = {
    Authorization: `Bearer ${key.slice(0, 8)}...`,
    "Content-Type": "application/json",
  }
  const body = {
    model: "glm-4-flash",
    max_tokens: 1,
    messages: [{ role: "user", content: "hi" }],
  }

  log("info", "Provider: Zhipu AI (GLM)")
  log("info", "Endpoint: POST /api/paas/v4/chat/completions (model: glm-4-flash)")
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
    const msg = res.status === 429 ? "Valid (rate limited)" : "Valid — GLM key accepted"
    log("ok", msg)
    return { valid: true, provider: "Zhipu/GLM", message: msg, detail: `HTTP ${res.status}`, logs }
  }
  if (res.status === 401 || res.status === 403) {
    const body2 = await res.json().catch(() => ({}))
    const err = body2?.error?.message ?? "Unauthorized"
    log("err", `${res.status}: ${err}`)
    return { valid: false, provider: "Zhipu/GLM", message: "Invalid — key rejected", detail: err, logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Zhipu/GLM", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testTogether(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  const url = "https://api.together.ai/v1/models"
  const headers = { Authorization: `Bearer ${key.slice(0, 8)}...` }

  log("info", "Provider: Together AI")
  log("info", "Endpoint: GET /v1/models (OpenAI-compatible)")
  log("curl", buildCurl({ method: "GET", url, headers }))
  log("req",  `Sending request... Authorization: Bearer ${key.slice(0, 12)}...`)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(12_000),
  })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.status === 200) {
    const data = await res.json().catch(() => ({}))
    const count = Array.isArray(data) ? data.length : "?"
    log("ok", `Valid — ${count} Together AI models accessible`)
    return { valid: true, provider: "Together AI", message: `Valid — ${count} models accessible`, detail: "HTTP 200", logs }
  }
  if (res.status === 401) {
    log("err", "401 — API key invalid")
    return { valid: false, provider: "Together AI", message: "Invalid — authentication failed", detail: "HTTP 401", logs }
  }
  log("err", `Unexpected HTTP ${res.status}`)
  return { valid: false, provider: "Together AI", message: `Unexpected HTTP ${res.status}`, detail: `HTTP ${res.status}`, logs }
}

async function testFirebase(key: string): Promise<TestKeyResult> {
  const { log, logs } = makeLogger()
  // Use the Firebase Identity Toolkit public project config endpoint — no OAuth needed
  const url = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${key}`
  const headers = { "Content-Type": "application/json" }

  log("info", "Provider: Google / Firebase (Web API Key)")
  log("info", "Endpoint: GET identitytoolkit/v3/relyingparty/getProjectConfig")
  log("info", "Note: Firebase Web API keys are designed to be public. This confirms the key is real and shows the project info.")
  log("curl", buildCurl({ method: "GET", url: url.replace(key, key.slice(0, 8) + "..."), headers }))
  log("req",  `GET getProjectConfig?key=${key.slice(0, 8)}...`)

  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
  })

  log("res", `HTTP ${res.status} ${res.statusText}`)

  if (res.ok) {
    const data = await res.json().catch(() => ({}))
    const projectId = data?.projectId ?? "unknown"
    const domains: string[] = data?.authorizedDomains ?? []
    log("ok", `Valid — Firebase project: ${projectId}`)
    log("info", `Authorized domains: ${domains.join(", ")}`)
    return {
      valid: true,
      provider: "Google / Firebase",
      message: `Valid Firebase key — project: ${projectId}`,
      detail: `Authorized domains: ${domains.slice(0, 3).join(", ")}${domains.length > 3 ? ` +${domains.length - 3} more` : ""}`,
      logs,
    }
  }

  const errBody = await res.json().catch(() => ({}))
  const errMsg = errBody?.error?.message ?? `HTTP ${res.status}`
  log("err", `${res.status}: ${errMsg}`)
  return { valid: false, provider: "Google / Firebase", message: "Invalid or restricted key", detail: errMsg, logs }
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
  // New providers
  "Dahono API Key": testDahono,
  "DeepSeek API Key": testDeepSeek,
  "xAI API Key": testXAI,
  "Qwen API Key": testQwen,
  "Zhipu API Key": testZhipu,
  "Together AI Key": testTogether,
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

  // Google Analytics IDs (G-XXXXXXXX) are public tracking codes, not secret keys
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
