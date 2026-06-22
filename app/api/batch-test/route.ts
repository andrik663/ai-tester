import { NextRequest, NextResponse } from "next/server"
import {
  PROVIDER_CONFIGS,
  DEFAULT_PROMPT,
  type ProviderConfig,
} from "@/lib/providers"

// Re-export so existing component imports still compile
export { PROVIDER_CONFIGS }
export type { ProviderConfig }

// ── Shared types ──────────────────────────────────────────────────────────────

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

const MAX_TOKENS = 64

// ── Token usage extractor (OpenAI + Anthropic + Gemini) ───────────────────────

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
  // Build URL (handle {{MODEL}}, {{ACCOUNT_ID}} templates and keyInUrl)
  const accountId = apiKey.includes("|") ? apiKey.split("|")[0] : ""
  let url = cfg.endpoint
    .replace("{{MODEL}}", encodeURIComponent(modelId))
    .replace("{{ACCOUNT_ID}}", encodeURIComponent(accountId))
  if (cfg.keyInUrl) {
    url += `?key=${encodeURIComponent(apiKey)}`
  }

  const authHdrs  = cfg.authHeader(apiKey)
  const extraHdrs = cfg.extraHeaders ?? {}
  const allHeaders: Record<string, string> = { ...extraHdrs, ...authHdrs }
  if (!("Content-Type" in allHeaders)) allHeaders["Content-Type"] = "application/json"

  // Use provider's buildBody with batch MAX_TOKENS
  const bodyObj = cfg.buildBody(modelId, MAX_TOKENS)
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
    try { parsed = await res.json() } catch { /* non-json body */ }

    const reply      = parsed ? cfg.extractReply?.(parsed) : undefined
    const tokenUsage = parsed ? extractTokenUsage(parsed)  : undefined

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
      buildBody: (modelId, maxTok = MAX_TOKENS) => ({
        model: modelId, max_tokens: maxTok, messages: [{ role: "user", content: DEFAULT_PROMPT }],
      }),
      extractReply: (p) => {
        try {
          const choices = p.choices as Record<string, unknown>[]
          return (choices[0]?.message as Record<string, unknown>)?.content as string
        } catch { return undefined }
      },
    }, apiKey))
    const results = await pLimit(tasks, 8)
    const durationMs = Date.now() - start
    const passed = results.filter((r) => r.ok).length
    return NextResponse.json({
      provider: "dahono", total: results.length, passed,
      failed: results.length - passed, results, durationMs,
    } satisfies BatchTestResponse)
  }

  // ── Static model list providers ───────────────────────────────────────────
  const cfg = PROVIDER_CONFIGS[providerId]
  if (!cfg) {
    return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 })
  }

  const start = Date.now()
  const tasks = cfg.models.map((modelId) => () => testModel(modelId, cfg, apiKey))
  const results = await pLimit(tasks, cfg.concurrencyLimit ?? 6)
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
