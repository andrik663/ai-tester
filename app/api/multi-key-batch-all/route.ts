import { NextRequest, NextResponse } from "next/server"
import {
  PROVIDER_CONFIGS,
  fetchLiveModels,
  DEFAULT_PROMPT,
  type ProviderConfig,
} from "@/lib/providers"

export const maxDuration = 60

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModelTestResult {
  modelId: string
  ok: boolean
  status: number
  latencyMs: number
  reply?: string
  errorMsg?: string
  tokenUsage?: { prompt?: number; completion?: number; total?: number }
  curlPreview: string
  curlFull: string
}

export interface KeyAllModelsResult {
  provider: string
  apiKeyMasked: string
  label: string
  total: number
  passed: number
  failed: number
  durationMs: number
  modelSource: "live" | "static"
  models: ModelTestResult[]
  fetchError?: string
}

export interface MultiKeyAllResponse {
  results: KeyAllModelsResult[]
  totalMs: number
  totalPassed: number
  totalFailed: number
  totalModels: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskApiKey(apiKey: string): string {
  const prefix = apiKey.slice(0, 8)
  const dots = "•".repeat(Math.min(6, Math.max(0, apiKey.length - 8)))
  return `${prefix}${dots}`
}

function buildCurl(url: string, headers: Record<string, string>, body: Record<string, unknown>): string {
  const bodyStr = JSON.stringify(body)
  const parts = [`curl -X POST '${url}'`]
  for (const [k, v] of Object.entries(headers)) {
    const maskedV = k.toLowerCase().includes("authorization") || k.toLowerCase().includes("x-api-key")
      ? v.replace(/(?<=.{12}).+(?=.{4})/, "****")
      : v
    parts.push(`  -H '${k}: ${maskedV}'`)
  }
  parts.push(`  -d '${bodyStr.replace(/'/g, "'\\''")}'`)
  return parts.join(" \\\n")
}

function extractErrorMsg(parsed: Record<string, unknown> | null, status: number): string {
  if (!parsed) return `HTTP ${status}`
  const err = parsed.error
  if (typeof err === "string") return err
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>
    if (typeof e.message === "string") return e.message
  }
  if (typeof parsed.message === "string") return parsed.message
  return `HTTP ${status}`
}

function extractTokens(parsed: Record<string, unknown>): ModelTestResult["tokenUsage"] {
  const u = (parsed.usage ?? parsed.usageMetadata) as Record<string, unknown> | undefined
  if (!u) return undefined
  return {
    prompt:     (u.prompt_tokens     ?? u.input_tokens   ?? u.promptTokenCount)   as number | undefined,
    completion: (u.completion_tokens ?? u.output_tokens  ?? u.candidatesTokenCount) as number | undefined,
    total:      (u.total_tokens      ?? u.totalTokenCount) as number | undefined,
  }
}

function extractReply(cfg: ProviderConfig, parsed: Record<string, unknown>): string | undefined {
  if (cfg.extractReply) return cfg.extractReply(parsed)
  // Fallback: OpenAI choices
  if (Array.isArray(parsed.choices)) {
    const msg = (parsed.choices as Array<Record<string, unknown>>)[0]?.message as Record<string, unknown> | undefined
    if (typeof msg?.content === "string") return msg.content
  }
  // Responses API
  if (Array.isArray(parsed.output)) {
    const out = parsed.output as Array<{ content?: Array<{ type: string; text: string }> }>
    return out[0]?.content?.find((c) => c.type === "output_text")?.text
  }
  return undefined
}

async function testOneModel(
  modelId: string,
  cfg: ProviderConfig,
  apiKey: string,
  prompt: string,
): Promise<ModelTestResult> {
  const accountId = apiKey.includes("|") ? apiKey.split("|")[0] : ""
  let url = cfg.endpoint
    .replace("{{MODEL}}", encodeURIComponent(modelId))
    .replace("{{ACCOUNT_ID}}", encodeURIComponent(accountId))
  if (cfg.keyInUrl) url += `?key=${encodeURIComponent(apiKey)}`

  const authHdrs  = cfg.authHeader(apiKey)
  const extraHdrs = cfg.extraHeaders ?? {}
  const allHeaders: Record<string, string> = { "Content-Type": "application/json", ...extraHdrs, ...authHdrs }

  const bodyObj = { ...cfg.buildBody(modelId, 64) } as Record<string, unknown>
  // Inject actual test prompt
  if (Array.isArray(bodyObj.messages)) {
    bodyObj.messages = [{ role: "user", content: prompt }]
  } else if (Array.isArray(bodyObj.input)) {
    bodyObj.input = [...(bodyObj.input as Record<string, unknown>[]).filter((m) => m.role === "system"), { role: "user", content: prompt }]
  } else if (typeof bodyObj.input === "string") {
    bodyObj.input = prompt
  } else if (Array.isArray(bodyObj.contents)) {
    bodyObj.contents = [{ parts: [{ text: prompt }] }]
  }

  const curlFull    = buildCurl(url, allHeaders, bodyObj)
  const curlPreview = curlFull.split("\n")[0]

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
    try { parsed = await res.json() } catch { /* non-json */ }

    return {
      modelId,
      ok: res.ok,
      status: res.status,
      latencyMs,
      reply: parsed ? extractReply(cfg, parsed) : undefined,
      errorMsg: !res.ok ? extractErrorMsg(parsed, res.status) : undefined,
      tokenUsage: parsed ? extractTokens(parsed) : undefined,
      curlPreview,
      curlFull,
    }
  } catch (err) {
    return {
      modelId,
      ok: false,
      status: 0,
      latencyMs: Date.now() - start,
      errorMsg: err instanceof Error ? err.message : "Network error",
      curlPreview,
      curlFull,
    }
  }
}

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
  let entries: { provider: string; apiKey: string; label?: string }[] = []
  let prompt = DEFAULT_PROMPT
  try {
    const body = await req.json()
    entries = body.entries ?? []
    prompt  = body.prompt?.trim() || DEFAULT_PROMPT
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!entries.length) {
    return NextResponse.json({ error: "No entries provided" }, { status: 400 })
  }

  const overallStart = Date.now()

  // Run all keys in parallel — each key gets its own full model test
  const keyResults = await Promise.all(
    entries.slice(0, 50).map(async (entry): Promise<KeyAllModelsResult> => {
      const provider = entry.provider.toLowerCase()
      const masked   = maskApiKey(entry.apiKey)
      const label    = entry.label ?? provider
      const cfg      = PROVIDER_CONFIGS[provider]

      if (!cfg) {
        return {
          provider, apiKeyMasked: masked, label,
          total: 0, passed: 0, failed: 0, durationMs: 0,
          modelSource: "static", models: [],
          fetchError: `Unknown provider: ${provider}`,
        }
      }

      // Fetch live model list (or fall back to static)
      const { models: liveModels, source } = await fetchLiveModels(provider, entry.apiKey, 10_000)
      const modelIds = liveModels.map((m) => m.id)

      if (modelIds.length === 0) {
        return {
          provider, apiKeyMasked: masked, label,
          total: 0, passed: 0, failed: 0, durationMs: 0,
          modelSource: source, models: [],
          fetchError: "No models available",
        }
      }

      const keyStart = Date.now()
      const concurrency = cfg.concurrencyLimit ?? 6
      const tasks = modelIds.map((modelId) => () => testOneModel(modelId, cfg, entry.apiKey, prompt))
      const modelResults = await pLimit(tasks, concurrency)
      const durationMs = Date.now() - keyStart

      const passed = modelResults.filter((r) => r.ok).length
      return {
        provider, apiKeyMasked: masked, label,
        total: modelResults.length,
        passed,
        failed: modelResults.length - passed,
        durationMs,
        modelSource: source,
        models: modelResults,
      }
    })
  )

  const totalPassed = keyResults.reduce((s, r) => s + r.passed, 0)
  const totalFailed = keyResults.reduce((s, r) => s + r.failed, 0)
  const totalModels = keyResults.reduce((s, r) => s + r.total, 0)

  return NextResponse.json({
    results: keyResults,
    totalMs: Date.now() - overallStart,
    totalPassed,
    totalFailed,
    totalModels,
  } satisfies MultiKeyAllResponse)
}
