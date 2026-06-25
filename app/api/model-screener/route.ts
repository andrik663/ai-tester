import { NextRequest, NextResponse } from "next/server"
import { PROVIDER_CONFIGS, BATCH_MAX_TOKENS } from "@/lib/providers"

/**
 * POST /api/model-screener
 *
 * Body:
 *   probes: Array<{ providerId: string; modelId: string; apiKey: string }>
 *
 * For each probe, fires a minimal chat completion and returns whether it
 * succeeded (isOn), latency, and any error message.
 * All probes run in parallel with a 12 s timeout each.
 *
 * Response:
 *   results: Array<{ id; providerId; modelId; isOn; latencyMs; error? }>
 */

interface Probe {
  providerId: string
  modelId: string
  apiKey: string
}

async function probeModel(probe: Probe): Promise<{
  providerId: string
  modelId: string
  isOn: boolean
  latencyMs: number | null
  error?: string
}> {
  const cfg = PROVIDER_CONFIGS[probe.providerId]
  if (!cfg) {
    return { providerId: probe.providerId, modelId: probe.modelId, isOn: false, latencyMs: null, error: "Unknown provider" }
  }

  const start = Date.now()
  try {
    const headers = { "Content-Type": "application/json", ...cfg.authHeader(probe.apiKey), ...(cfg.extraHeaders ?? {}) }
    const body = cfg.buildBody(probe.modelId, BATCH_MAX_TOKENS)
    let url = cfg.endpoint
      .replace("{{MODEL}}", probe.modelId)
      .replace("{{API_KEY}}", probe.apiKey)

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    })
    const latencyMs = Date.now() - start

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      let errMsg = `HTTP ${res.status}`
      try { const j = JSON.parse(text); errMsg = j?.error?.message ?? j?.message ?? j?.detail ?? errMsg } catch {}
      return { providerId: probe.providerId, modelId: probe.modelId, isOn: false, latencyMs, error: errMsg }
    }

    // Quick parse to confirm a reply came back
    const data = await res.json().catch(() => null)
    const hasReply = cfg.extractReply ? Boolean(cfg.extractReply(data)) : Boolean(data)

    return { providerId: probe.providerId, modelId: probe.modelId, isOn: hasReply, latencyMs }
  } catch (err) {
    const latencyMs = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    return { providerId: probe.providerId, modelId: probe.modelId, isOn: false, latencyMs, error: msg }
  }
}

export async function POST(req: NextRequest) {
  let probes: Probe[] = []
  try {
    const body = await req.json()
    probes = Array.isArray(body.probes) ? body.probes as Probe[] : []
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  if (probes.length === 0) {
    return NextResponse.json({ results: [] })
  }

  // Cap at 50 probes per call to avoid extreme parallelism
  const capped = probes.slice(0, 50)

  const results = await Promise.all(capped.map(probeModel))
  return NextResponse.json({ results })
}
