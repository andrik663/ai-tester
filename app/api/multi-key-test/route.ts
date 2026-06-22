import { NextRequest, NextResponse } from "next/server"
import type { ManualTestResult } from "@/app/api/manual-test/route"

export const maxDuration = 60

export interface MultiKeyEntry {
  provider: string
  apiKey: string
  /** Optional label shown in results (defaults to provider) */
  label?: string
}

export interface MultiKeyResult {
  provider: string
  apiKey: string   // masked for display
  label: string
  ok: boolean
  status: number
  statusText: string
  chatReply?: string
  durationMs: number
  tokenUsage?: ManualTestResult["tokenUsage"]
  error?: string
}

export interface MultiKeyTestResponse {
  results: MultiKeyResult[]
  totalMs: number
  passed: number
  failed: number
}

// ── Run a single provider/key pair ───────────────────────────────────────────

async function testOne(
  entry: MultiKeyEntry,
  prompt: string,
  baseUrl: string
): Promise<MultiKeyResult> {
  const start = Date.now()
  const label = entry.label ?? entry.provider

  try {
    const res = await fetch(`${baseUrl}/api/manual-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: entry.provider,
        apiKey: entry.apiKey,
        // endpoint / headers / body are resolved server-side from provider id
        prompt,
      }),
    })

    const data: ManualTestResult = await res.json()
    return {
      provider: entry.provider,
      apiKey: entry.apiKey.slice(0, 8) + "••••",
      label,
      ok: data.ok,
      status: data.status,
      statusText: data.statusText,
      chatReply: data.chatReply,
      durationMs: data.durationMs,
      tokenUsage: data.tokenUsage,
    }
  } catch (err) {
    return {
      provider: entry.provider,
      apiKey: entry.apiKey.slice(0, 8) + "••••",
      label,
      ok: false,
      status: 0,
      statusText: "Network error",
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const entries: MultiKeyEntry[] = body.entries ?? []
  const prompt: string = body.prompt ?? "halo"

  if (!entries.length) {
    return NextResponse.json({ error: "No entries provided" }, { status: 400 })
  }

  // Clamp to 100 entries max to avoid abuse
  const capped = entries.slice(0, 100)

  // Build base URL from request for internal fetch
  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`

  const overallStart = Date.now()

  // Run ALL entries in parallel
  const settled = await Promise.allSettled(
    capped.map((entry) => testOne(entry, prompt, baseUrl))
  )

  const results: MultiKeyResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value
    return {
      provider: capped[i].provider,
      apiKey: capped[i].apiKey.slice(0, 8) + "••••",
      label: capped[i].label ?? capped[i].provider,
      ok: false,
      status: 0,
      statusText: "Promise rejected",
      durationMs: 0,
      error: s.reason instanceof Error ? s.reason.message : "Unknown",
    }
  })

  const passed = results.filter((r) => r.ok).length

  return NextResponse.json({
    results,
    totalMs: Date.now() - overallStart,
    passed,
    failed: results.length - passed,
  } satisfies MultiKeyTestResponse)
}
