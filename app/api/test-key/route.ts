import { NextRequest, NextResponse } from "next/server"

export interface TestKeyResult {
  valid: boolean
  provider: string
  message: string
  detail?: string
}

// ── Provider testers ──────────────────────────────────────────────────────────

async function testAnthropic(key: string): Promise<TestKeyResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    }),
    signal: AbortSignal.timeout(10_000),
  })

  if (res.status === 200 || res.status === 429) {
    // 429 = rate limited but key is valid
    return {
      valid: true,
      provider: "Anthropic",
      message: res.status === 429 ? "Valid (rate limited)" : "Valid — key accepted by Anthropic API",
      detail: `HTTP ${res.status}`,
    }
  }

  if (res.status === 401) {
    return { valid: false, provider: "Anthropic", message: "Invalid — authentication failed", detail: "HTTP 401" }
  }

  const body = await res.json().catch(() => ({}))
  return {
    valid: false,
    provider: "Anthropic",
    message: `Unexpected response: HTTP ${res.status}`,
    detail: body?.error?.message ?? JSON.stringify(body).slice(0, 120),
  }
}

async function testOpenAI(key: string): Promise<TestKeyResult> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  })

  if (res.status === 200) {
    return { valid: true, provider: "OpenAI", message: "Valid — key accepted by OpenAI API", detail: "HTTP 200" }
  }
  if (res.status === 429) {
    return { valid: true, provider: "OpenAI", message: "Valid (rate limited)", detail: "HTTP 429" }
  }
  if (res.status === 401) {
    return { valid: false, provider: "OpenAI", message: "Invalid — authentication failed", detail: "HTTP 401" }
  }
  const body = await res.json().catch(() => ({}))
  return {
    valid: false,
    provider: "OpenAI",
    message: `Unexpected response: HTTP ${res.status}`,
    detail: body?.error?.message ?? JSON.stringify(body).slice(0, 120),
  }
}

async function testGoogle(key: string): Promise<TestKeyResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
    { signal: AbortSignal.timeout(10_000) }
  )
  if (res.status === 200) {
    return { valid: true, provider: "Google", message: "Valid — key accepted by Google Generative Language API", detail: "HTTP 200" }
  }
  if (res.status === 403 || res.status === 400) {
    return { valid: false, provider: "Google", message: "Invalid — API key rejected", detail: `HTTP ${res.status}` }
  }
  return {
    valid: false,
    provider: "Google",
    message: `Unexpected response: HTTP ${res.status}`,
    detail: `HTTP ${res.status}`,
  }
}

async function testHuggingFace(key: string): Promise<TestKeyResult> {
  const res = await fetch("https://huggingface.co/api/whoami", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (res.status === 200) {
    const body = await res.json().catch(() => ({}))
    return { valid: true, provider: "HuggingFace", message: `Valid — logged in as ${body.name ?? "unknown"}`, detail: "HTTP 200" }
  }
  if (res.status === 401) {
    return { valid: false, provider: "HuggingFace", message: "Invalid — token rejected", detail: "HTTP 401" }
  }
  return { valid: false, provider: "HuggingFace", message: `Unexpected response: HTTP ${res.status}`, detail: `HTTP ${res.status}` }
}

async function testGroq(key: string): Promise<TestKeyResult> {
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (res.status === 200) {
    return { valid: true, provider: "Groq", message: "Valid — key accepted by Groq API", detail: "HTTP 200" }
  }
  if (res.status === 429) {
    return { valid: true, provider: "Groq", message: "Valid (rate limited)", detail: "HTTP 429" }
  }
  if (res.status === 401) {
    return { valid: false, provider: "Groq", message: "Invalid — authentication failed", detail: "HTTP 401" }
  }
  return { valid: false, provider: "Groq", message: `Unexpected response: HTTP ${res.status}`, detail: `HTTP ${res.status}` }
}

async function testGitHub(key: string): Promise<TestKeyResult> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${key}`, "User-Agent": "APIKeyTester/1.0" },
    signal: AbortSignal.timeout(10_000),
  })
  if (res.status === 200) {
    const body = await res.json().catch(() => ({}))
    return { valid: true, provider: "GitHub", message: `Valid — authenticated as @${body.login ?? "unknown"}`, detail: "HTTP 200" }
  }
  if (res.status === 401) {
    return { valid: false, provider: "GitHub", message: "Invalid — token rejected", detail: "HTTP 401" }
  }
  return { valid: false, provider: "GitHub", message: `Unexpected response: HTTP ${res.status}`, detail: `HTTP ${res.status}` }
}

async function testStripe(key: string): Promise<TestKeyResult> {
  const res = await fetch("https://api.stripe.com/v1/balance", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (res.status === 200) {
    return { valid: true, provider: "Stripe", message: "Valid — key accepted by Stripe API", detail: "HTTP 200" }
  }
  if (res.status === 401) {
    return { valid: false, provider: "Stripe", message: "Invalid — key rejected", detail: "HTTP 401" }
  }
  return { valid: false, provider: "Stripe", message: `Unexpected response: HTTP ${res.status}`, detail: `HTTP ${res.status}` }
}

// ── Label → tester map ────────────────────────────────────────────────────────

type Tester = (key: string) => Promise<TestKeyResult>

const TESTERS: Record<string, Tester> = {
  "Anthropic API Key": testAnthropic,
  "OpenAI API Key": testOpenAI,
  "OpenAI Project Key": testOpenAI,
  "Google API Key": testGoogle,
  "HuggingFace Token": testHuggingFace,
  "Groq API Key": testGroq,
  "GitHub Token": testGitHub,
  "GitHub Fine-grained Token": testGitHub,
  "Stripe Secret Key": testStripe,
  "Stripe Publishable Key": testStripe,
  "Stripe Test Key": testStripe,
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
    return NextResponse.json(
      {
        valid: null,
        provider: label,
        message: "No live test available for this key type",
        detail: "Unsupported provider",
      },
      { status: 200 }
    )
  }

  try {
    const result = await tester(value)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { valid: false, provider: label, message: `Test failed: ${msg}`, detail: msg },
      { status: 200 }
    )
  }
}
