import { NextRequest, NextResponse } from "next/server"

export interface BatchModelResult {
  modelId: string
  tier: string
  free: boolean
  ok: boolean
  status: number
  latencyMs: number
  reply?: string
  errorMsg?: string
  tokenUsage?: { prompt?: number; completion?: number; total?: number }
  curlFull: string
}

export interface DahnoBatchTestResponse {
  total: number
  passed: number
  failed: number
  results: BatchModelResult[]
  durationMs: number
}

const GATEWAY_URL = "https://gateway.dahono.com/v1"
const TEST_PROMPT  = "halo"
const MAX_TOKENS   = 64 // keep it cheap — we only need a short reply
const CONCURRENCY  = 8  // run at most 8 requests in parallel

function buildCurlFull(modelId: string, apiKey: string): string {
  const bodyObj = {
    model: modelId,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: TEST_PROMPT }],
  }
  const bodyStr = JSON.stringify(bodyObj)
  return [
    `curl -X POST '${GATEWAY_URL}/chat/completions'`,
    `  -H 'Authorization: Bearer ${apiKey}'`,
    `  -H 'Content-Type: application/json'`,
    `  -d '${bodyStr.replace(/'/g, "'\\''")}'`,
  ].join(" \\\n")
}

async function testModel(
  modelId: string,
  tier: string,
  free: boolean,
  apiKey: string,
): Promise<BatchModelResult> {
  const curlFull = buildCurlFull(modelId, apiKey)

  const body = JSON.stringify({
    model: modelId,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: TEST_PROMPT }],
  })

  const start = Date.now()
  try {
    const res = await fetch(`${GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(20_000),
    })

    const latencyMs = Date.now() - start

    let parsed: unknown = null
    try { parsed = await res.json() } catch { /* streaming or non-json */ }

    const p = parsed as Record<string, unknown> | null

    // Extract reply
    let reply: string | undefined
    try {
      const choices = (p?.choices as Record<string, unknown>[]) ?? []
      reply = (choices[0]?.message as Record<string, unknown>)?.content as string
    } catch { /* ignore */ }

    // Extract token usage
    let tokenUsage: BatchModelResult["tokenUsage"] | undefined
    if (p?.usage && typeof p.usage === "object") {
      const u = p.usage as Record<string, unknown>
      tokenUsage = {
        prompt:     typeof u.prompt_tokens     === "number" ? u.prompt_tokens     : undefined,
        completion: typeof u.completion_tokens === "number" ? u.completion_tokens : undefined,
        total:      typeof u.total_tokens      === "number" ? u.total_tokens      : undefined,
      }
    }

    // Extract error message
    let errorMsg: string | undefined
    if (!res.ok) {
      try {
        const err = (p as Record<string, unknown> | null)?.error
        if (typeof err === "string") errorMsg = err
        else if (err && typeof err === "object") {
          const e = err as Record<string, unknown>
          errorMsg = (e.message ?? e.code ?? JSON.stringify(err)) as string
        } else {
          errorMsg = `HTTP ${res.status} ${res.statusText}`
        }
      } catch {
        errorMsg = `HTTP ${res.status}`
      }
    }

    return { modelId, tier, free, ok: res.ok, status: res.status, latencyMs, reply, errorMsg, tokenUsage, curlFull }
  } catch (err) {
    const latencyMs = Date.now() - start
    const msg = err instanceof Error ? err.message : "Unknown error"
    return { modelId, tier, free, ok: false, status: 0, latencyMs, errorMsg: msg, curlFull }
  }
}

// Run an array of tasks with a concurrency cap
async function pLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIdx = 0

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++
      results[idx] = await tasks[idx]()
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export async function POST(req: NextRequest) {
  let apiKey = ""
  try {
    const body = await req.json()
    apiKey = String(body.apiKey ?? "").trim()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!apiKey || apiKey.length < 8) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 })
  }

  // 1. Fetch model list
  let models: { id: string; tier: string; free: boolean }[] = []
  try {
    const modRes = await fetch(`${GATEWAY_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
    })
    if (!modRes.ok) {
      return NextResponse.json({ error: `Could not fetch models: HTTP ${modRes.status}` }, { status: modRes.status })
    }
    const modData = await modRes.json()
    models = (modData?.data ?? []).map((m: Record<string, unknown>) => ({
      id:   String(m.id),
      tier: String(m.tier ?? "free"),
      free: Boolean(m.free),
    }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Failed to fetch model list: ${msg}` }, { status: 502 })
  }

  if (models.length === 0) {
    return NextResponse.json({ error: "No models found for this API key" }, { status: 404 })
  }

  // 2. Test all models in parallel (capped concurrency)
  const start = Date.now()
  const tasks = models.map(
    (m) => () => testModel(m.id, m.tier, m.free, apiKey)
  )

  const results = await pLimit(tasks, CONCURRENCY)
  const durationMs = Date.now() - start
  const passed = results.filter((r) => r.ok).length

  return NextResponse.json({
    total:     results.length,
    passed,
    failed:    results.length - passed,
    results,
    durationMs,
  } satisfies DahnoBatchTestResponse)
}
