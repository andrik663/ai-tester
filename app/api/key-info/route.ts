import { NextRequest, NextResponse } from "next/server"

/**
 * /api/key-info — Enriched key intelligence endpoint.
 *
 * Called after a successful chat or when a key + provider is known.
 * Returns: balance, model count, rate limits, username, plan tier, etc.
 * All fetches are best-effort — partial results are fine.
 */

export interface KeyInfoResult {
  provider: string
  balance?: string          // "$12.45" or "2,000 tokens"
  balanceRaw?: number       // raw numeric USD amount
  modelCount?: number
  modelList?: string[]      // first 10 model IDs
  username?: string
  plan?: string             // "free", "pro", "pay-as-you-go", etc.
  rateLimit?: {
    reqLimit?: string
    reqRemaining?: string
    reqReset?: string
    tokLimit?: string
    tokRemaining?: string
  }
  org?: string
  fetchedAt: number         // unix ms
}

export interface KeyInfoRequest {
  provider: string
  apiKey: string
  responseHeaders?: Record<string, string>  // pass-through from last chat response
}

// ── Provider-specific enrichers ────────────────────────────────────────────────

async function enrichOpenAI(key: string, rl?: Record<string, string>): Promise<Partial<KeyInfoResult>> {
  const headers = { Authorization: `Bearer ${key}` }
  const out: Partial<KeyInfoResult> = { provider: "OpenAI" }

  // Models
  try {
    const r = await fetch("https://api.openai.com/v1/models", { headers, signal: AbortSignal.timeout(8_000) })
    if (r.ok) {
      const d = await r.json()
      const models: string[] = (d?.data ?? []).map((m: { id: string }) => m.id)
      out.modelCount = models.length
      out.modelList = models.slice(0, 10)
    }
  } catch { /* best-effort */ }

  // User info
  try {
    const r = await fetch("https://api.openai.com/v1/me", { headers, signal: AbortSignal.timeout(6_000) })
    if (r.ok) {
      const d = await r.json()
      out.username = d?.email ?? d?.name ?? undefined
      out.org = d?.orgs?.data?.[0]?.name ?? undefined
    }
  } catch { /* best-effort */ }

  // Rate limits from response headers
  if (rl) {
    out.rateLimit = {
      reqLimit: rl["x-ratelimit-limit-requests"],
      reqRemaining: rl["x-ratelimit-remaining-requests"],
      reqReset: rl["x-ratelimit-reset-requests"],
      tokLimit: rl["x-ratelimit-limit-tokens"],
      tokRemaining: rl["x-ratelimit-remaining-tokens"],
    }
  }

  return out
}

async function enrichAnthropic(key: string, rl?: Record<string, string>): Promise<Partial<KeyInfoResult>> {
  const out: Partial<KeyInfoResult> = { provider: "Anthropic" }
  // Anthropic doesn't have a /models or /me endpoint with balance.
  // We can get rate limit info from headers.
  if (rl) {
    out.rateLimit = {
      reqLimit: rl["anthropic-ratelimit-requests-limit"],
      reqRemaining: rl["anthropic-ratelimit-requests-remaining"],
      reqReset: rl["anthropic-ratelimit-requests-reset"],
      tokLimit: rl["anthropic-ratelimit-tokens-limit"],
      tokRemaining: rl["anthropic-ratelimit-tokens-remaining"],
    }
  }

  // Try to get model list via /v1/models
  try {
    const r = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(8_000),
    })
    if (r.ok) {
      const d = await r.json()
      const models: string[] = (d?.data ?? []).map((m: { id: string }) => m.id)
      out.modelCount = models.length
      out.modelList = models.slice(0, 10)
    }
  } catch { /* best-effort */ }

  return out
}

async function enrichGoogle(key: string): Promise<Partial<KeyInfoResult>> {
  const out: Partial<KeyInfoResult> = { provider: "Google Gemini" }
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
      signal: AbortSignal.timeout(8_000),
    })
    if (r.ok) {
      const d = await r.json()
      const models: string[] = (d?.models ?? []).map((m: { name: string }) => m.name)
      out.modelCount = models.length
      out.modelList = models.slice(0, 10)
    }
  } catch { /* best-effort */ }
  return out
}

async function enrichGroq(key: string, rl?: Record<string, string>): Promise<Partial<KeyInfoResult>> {
  const headers = { Authorization: `Bearer ${key}` }
  const out: Partial<KeyInfoResult> = { provider: "Groq" }

  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers, signal: AbortSignal.timeout(8_000) })
    if (r.ok) {
      const d = await r.json()
      const models: string[] = (d?.data ?? []).map((m: { id: string }) => m.id)
      out.modelCount = models.length
      out.modelList = models.slice(0, 10)
    }
  } catch { /* best-effort */ }

  if (rl) {
    out.rateLimit = {
      reqLimit: rl["x-ratelimit-limit-requests"],
      reqRemaining: rl["x-ratelimit-remaining-requests"],
      reqReset: rl["x-ratelimit-reset-requests"],
      tokLimit: rl["x-ratelimit-limit-tokens"],
      tokRemaining: rl["x-ratelimit-remaining-tokens"],
    }
  }

  return out
}

async function enrichDeepSeek(key: string): Promise<Partial<KeyInfoResult>> {
  const headers = { Authorization: `Bearer ${key}` }
  const out: Partial<KeyInfoResult> = { provider: "DeepSeek" }

  try {
    const [modelsRes, balRes] = await Promise.allSettled([
      fetch("https://api.deepseek.com/models", { headers, signal: AbortSignal.timeout(8_000) }),
      fetch("https://api.deepseek.com/user/balance", { headers, signal: AbortSignal.timeout(6_000) }),
    ])

    if (modelsRes.status === "fulfilled" && modelsRes.value.ok) {
      const d = await modelsRes.value.json()
      const models: string[] = (d?.data ?? []).map((m: { id: string }) => m.id)
      out.modelCount = models.length
      out.modelList = models.slice(0, 10)
    }

    if (balRes.status === "fulfilled" && balRes.value.ok) {
      const d = await balRes.value.json()
      const info = d?.balance_infos?.[0]
      if (info) {
        const total = parseFloat(info.total_balance ?? "0")
        const topped = parseFloat(info.topped_up_balance ?? "0")
        const granted = parseFloat(info.granted_balance ?? "0")
        out.balance = `$${total.toFixed(4)}`
        out.balanceRaw = total
        if (topped > 0 || granted > 0) {
          out.plan = topped > 0 ? "pay-as-you-go" : "free-tier"
        }
      }
    }
  } catch { /* best-effort */ }

  return out
}

async function enrichXAI(key: string): Promise<Partial<KeyInfoResult>> {
  const headers = { Authorization: `Bearer ${key}` }
  const out: Partial<KeyInfoResult> = { provider: "xAI/Grok" }
  try {
    const r = await fetch("https://api.x.ai/v1/models", { headers, signal: AbortSignal.timeout(8_000) })
    if (r.ok) {
      const d = await r.json()
      const models: string[] = (d?.data ?? []).map((m: { id: string }) => m.id)
      out.modelCount = models.length
      out.modelList = models.slice(0, 10)
    }
  } catch { /* best-effort */ }
  return out
}

async function enrichMistral(key: string): Promise<Partial<KeyInfoResult>> {
  const headers = { Authorization: `Bearer ${key}` }
  const out: Partial<KeyInfoResult> = { provider: "Mistral" }
  try {
    const r = await fetch("https://api.mistral.ai/v1/models", { headers, signal: AbortSignal.timeout(8_000) })
    if (r.ok) {
      const d = await r.json()
      const models: string[] = (d?.data ?? []).map((m: { id: string }) => m.id)
      out.modelCount = models.length
      out.modelList = models.slice(0, 10)
    }
  } catch { /* best-effort */ }
  return out
}

async function enrichCohere(key: string): Promise<Partial<KeyInfoResult>> {
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
  const out: Partial<KeyInfoResult> = { provider: "Cohere" }
  try {
    const r = await fetch("https://api.cohere.com/v1/models", { headers, signal: AbortSignal.timeout(8_000) })
    if (r.ok) {
      const d = await r.json()
      const models: string[] = (d?.models ?? []).map((m: { name: string }) => m.name)
      out.modelCount = models.length
      out.modelList = models.slice(0, 10)
    }
  } catch { /* best-effort */ }
  return out
}

async function enrichHuggingFace(key: string): Promise<Partial<KeyInfoResult>> {
  const headers = { Authorization: `Bearer ${key}` }
  const out: Partial<KeyInfoResult> = { provider: "HuggingFace" }
  try {
    const r = await fetch("https://huggingface.co/api/whoami", { headers, signal: AbortSignal.timeout(8_000) })
    if (r.ok) {
      const d = await r.json()
      out.username = d?.name ?? d?.login ?? undefined
      out.plan = d?.isPro ? "pro" : "free"
    }
  } catch { /* best-effort */ }
  return out
}

async function enrichTogether(key: string): Promise<Partial<KeyInfoResult>> {
  const headers = { Authorization: `Bearer ${key}` }
  const out: Partial<KeyInfoResult> = { provider: "Together AI" }
  try {
    const r = await fetch("https://api.together.ai/v1/models", { headers, signal: AbortSignal.timeout(8_000) })
    if (r.ok) {
      const d = await r.json()
      const models: string[] = Array.isArray(d) ? (d as { id: string }[]).map(m => m.id) : (d?.data ?? []).map((m: { id: string }) => m.id)
      out.modelCount = models.length
      out.modelList = models.slice(0, 10)
    }
  } catch { /* best-effort */ }
  return out
}

async function enrichQwen(key: string): Promise<Partial<KeyInfoResult>> {
  const headers = { Authorization: `Bearer ${key}` }
  const out: Partial<KeyInfoResult> = { provider: "Qwen / Alibaba" }
  try {
    const r = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models", { headers, signal: AbortSignal.timeout(8_000) })
    if (r.ok) {
      const d = await r.json()
      const models: string[] = (d?.data ?? []).map((m: { id: string }) => m.id)
      out.modelCount = models.length
      out.modelList = models.slice(0, 10)
    }
  } catch { /* best-effort */ }
  return out
}

async function enrichDahono(key: string): Promise<Partial<KeyInfoResult>> {
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
  const out: Partial<KeyInfoResult> = { provider: "Dahono" }
  try {
    const r = await fetch("https://gateway.dahono.com/v1/models", { headers, signal: AbortSignal.timeout(8_000) })
    if (r.ok) {
      const d = await r.json()
      const all: { id: string; free?: boolean; tier?: string }[] = d?.data ?? []
      const models: string[] = all.map(m => m.id)
      const freeCount = all.filter(m => m.free).length
      out.modelCount = models.length
      out.modelList = models.slice(0, 10)
      out.plan = `${freeCount} free models`
    }
  } catch { /* best-effort */ }
  return out
}

async function enrichOpenRouter(key: string): Promise<Partial<KeyInfoResult>> {
  const headers = { Authorization: `Bearer ${key}` }
  const out: Partial<KeyInfoResult> = { provider: "OpenRouter" }
  try {
    // OpenRouter auth info endpoint
    const r = await fetch("https://openrouter.ai/api/v1/auth/key", { headers, signal: AbortSignal.timeout(8_000) })
    if (r.ok) {
      const d = await r.json()
      const data = d?.data ?? {}
      const credits = data?.limit_remaining ?? data?.credit_balance ?? undefined
      if (credits !== undefined) {
        out.balance = `$${Number(credits).toFixed(4)}`
        out.balanceRaw = Number(credits)
      }
      out.username = data?.label ?? undefined
      out.plan = data?.is_free_tier ? "free" : "paid"
    }
  } catch { /* best-effort */ }
  return out
}

async function enrichFireworks(key: string): Promise<Partial<KeyInfoResult>> {
  const headers = { Authorization: `Bearer ${key}` }
  const out: Partial<KeyInfoResult> = { provider: "Fireworks AI" }
  try {
    const r = await fetch("https://api.fireworks.ai/inference/v1/models", { headers, signal: AbortSignal.timeout(8_000) })
    if (r.ok) {
      const d = await r.json()
      const models: string[] = (d?.data ?? []).map((m: { id: string }) => m.id)
      out.modelCount = models.length
      out.modelList = models.slice(0, 10)
    }
  } catch { /* best-effort */ }
  return out
}

async function enrichNovita(key: string): Promise<Partial<KeyInfoResult>> {
  const headers = { Authorization: `Bearer ${key}` }
  const out: Partial<KeyInfoResult> = { provider: "Novita AI" }
  try {
    const [modelsRes, balRes] = await Promise.allSettled([
      fetch("https://api.novita.ai/openai/v1/models", { headers, signal: AbortSignal.timeout(8_000) }),
      fetch("https://api.novita.ai/v3/billing/account", { headers, signal: AbortSignal.timeout(6_000) }),
    ])

    if (modelsRes.status === "fulfilled" && modelsRes.value.ok) {
      const d = await modelsRes.value.json()
      const models: string[] = (d?.data ?? []).map((m: { id: string }) => m.id)
      out.modelCount = models.length
      out.modelList = models.slice(0, 10)
    }

    if (balRes.status === "fulfilled" && balRes.value.ok) {
      const d = await balRes.value.json()
      const credits = d?.balance ?? d?.credit_balance ?? undefined
      if (credits !== undefined) {
        const amount = Number(credits) / 100  // Novita uses cents
        out.balance = `$${amount.toFixed(4)}`
        out.balanceRaw = amount
      }
    }
  } catch { /* best-effort */ }
  return out
}

// ── PROVIDER dispatch map ──────────────────────────────────────────────────────

const ENRICHERS: Record<string, (key: string, rl?: Record<string, string>) => Promise<Partial<KeyInfoResult>>> = {
  openai:      enrichOpenAI,
  anthropic:   enrichAnthropic,
  google:      (k) => enrichGoogle(k),
  groq:        enrichGroq,
  deepseek:    (k) => enrichDeepSeek(k),
  xai:         (k) => enrichXAI(k),
  mistral:     (k) => enrichMistral(k),
  cohere:      (k) => enrichCohere(k),
  huggingface: (k) => enrichHuggingFace(k),
  together:    (k) => enrichTogether(k),
  qwen:        (k) => enrichQwen(k),
  dahono:      (k) => enrichDahono(k),
  openrouter:  (k) => enrichOpenRouter(k),
  fireworks:   (k) => enrichFireworks(k),
  novita:      (k) => enrichNovita(k),
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: KeyInfoRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { provider, apiKey, responseHeaders } = body
  if (!provider || !apiKey?.trim()) {
    return NextResponse.json({ error: "provider and apiKey required" }, { status: 400 })
  }

  const providerKey = provider.toLowerCase().replace(/[^a-z0-9]/g, "")
  const enricher = ENRICHERS[providerKey]

  let result: KeyInfoResult = {
    provider,
    fetchedAt: Date.now(),
  }

  // Extract rate limit from passed-through response headers
  const rl: Record<string, string> = {}
  if (responseHeaders) {
    const RL_KEYS = [
      "x-ratelimit-limit-requests", "x-ratelimit-remaining-requests", "x-ratelimit-reset-requests",
      "x-ratelimit-limit-tokens", "x-ratelimit-remaining-tokens",
      "anthropic-ratelimit-requests-limit", "anthropic-ratelimit-requests-remaining",
      "anthropic-ratelimit-requests-reset", "anthropic-ratelimit-tokens-limit",
      "anthropic-ratelimit-tokens-remaining",
    ]
    for (const k of RL_KEYS) {
      if (responseHeaders[k]) rl[k] = responseHeaders[k]
    }
    if (Object.keys(rl).length) result.rateLimit = {
      reqLimit: rl["x-ratelimit-limit-requests"] ?? rl["anthropic-ratelimit-requests-limit"],
      reqRemaining: rl["x-ratelimit-remaining-requests"] ?? rl["anthropic-ratelimit-requests-remaining"],
      reqReset: rl["x-ratelimit-reset-requests"] ?? rl["anthropic-ratelimit-requests-reset"],
      tokLimit: rl["x-ratelimit-limit-tokens"] ?? rl["anthropic-ratelimit-tokens-limit"],
      tokRemaining: rl["x-ratelimit-remaining-tokens"] ?? rl["anthropic-ratelimit-tokens-remaining"],
    }
  }

  if (enricher) {
    try {
      const enriched = await enricher(apiKey.trim(), Object.keys(rl).length ? rl : undefined)
      result = { ...result, ...enriched }
    } catch { /* enrichment failed — return partial */ }
  }

  return NextResponse.json(result)
}
