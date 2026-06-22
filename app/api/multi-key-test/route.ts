import { NextRequest, NextResponse } from "next/server"
import {
  PROVIDER_MODELS,
  buildProviderBody,
  buildProviderHeaders,
  resolveProviderEndpoint,
  DEFAULT_PROMPT,
} from "@/lib/providers"

export const maxDuration = 60

// ── Shared key-masking helper (single source of truth) ───────────────────────
// Exposes exactly 8 chars of prefix + 6 mask dots. Used by both route and UI.
export function maskApiKey(apiKey: string): string {
  const prefix = apiKey.slice(0, 8)
  const dots = "•".repeat(Math.min(6, Math.max(0, apiKey.length - 8)))
  return `${prefix}${dots}`
}

// ── Re-export PROVIDER_MODELS so the component can import it from here ────────
export { PROVIDER_MODELS }

// ── Exported types ────────────────────────────────────────────────────────────

export interface MultiKeyEntry {
  provider: string
  apiKey: string
  label?: string
}

export interface TokenUsage {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

export interface MultiKeyResult {
  provider: string
  apiKeyMasked: string
  label: string
  ok: boolean
  status: number
  statusText: string
  chatReply?: string
  durationMs: number
  error?: string
  modelUsed?: string
  tokenUsage?: TokenUsage
}

export interface MultiKeyTestResponse {
  results: MultiKeyResult[]
  totalMs: number
  passed: number
  failed: number
}

// ── Chat reply + model + token extractor ──────────────────────────────────────

interface ExtractedResponse {
  reply?: string
  modelUsed?: string
  tokenUsage?: TokenUsage
}

function extractResponse(provider: string, data: unknown): ExtractedResponse {
  if (!data || typeof data !== "object") return {}
  const d = data as Record<string, unknown>

  let reply: string | undefined
  let modelUsed: string | undefined
  let tokenUsage: TokenUsage | undefined

  // Model field (standard)
  if (typeof d.model === "string") modelUsed = d.model

  // OpenAI Responses API (openai, xai)
  if (Array.isArray(d.output)) {
    const output = d.output as Array<{ content?: Array<{ type: string; text: string }> }>
    const text = output?.[0]?.content?.find((c) => c.type === "output_text")?.text
    if (typeof text === "string") reply = text
    // Responses API usage
    const oaiUsage = d.usage as Record<string, unknown> | undefined
    if (oaiUsage && typeof oaiUsage.input_tokens === "number") {
      tokenUsage = {
        promptTokens: oaiUsage.input_tokens as number,
        completionTokens: typeof oaiUsage.output_tokens === "number" ? oaiUsage.output_tokens : null,
        totalTokens: typeof oaiUsage.total_tokens === "number" ? oaiUsage.total_tokens : null,
      }
    }
  }

  // OpenAI-compatible choices (most providers)
  if (!reply && Array.isArray(d.choices)) {
    const msg = (d.choices as Array<Record<string, unknown>>)[0]?.message as Record<string, unknown> | undefined
    if (typeof msg?.content === "string") reply = msg.content
  }

  // Anthropic Messages API
  if (Array.isArray(d.content)) {
    const block = (d.content as Array<Record<string, unknown>>).find((b) => b.type === "text")
    if (typeof block?.text === "string") reply = block.text
    if (typeof d.model === "string") modelUsed = d.model
  }

  // Google Gemini generateContent
  if (Array.isArray(d.candidates)) {
    const parts = ((d.candidates as Array<Record<string, unknown>>)[0]?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>> | undefined
    if (Array.isArray(parts) && typeof parts[0]?.text === "string") reply = parts[0].text
    const gUsage = d.usageMetadata as Record<string, unknown> | undefined
    if (gUsage) {
      tokenUsage = {
        promptTokens: typeof gUsage.promptTokenCount === "number" ? gUsage.promptTokenCount : null,
        completionTokens: typeof gUsage.candidatesTokenCount === "number" ? gUsage.candidatesTokenCount : null,
        totalTokens: typeof gUsage.totalTokenCount === "number" ? gUsage.totalTokenCount : null,
      }
    }
  }

  // Cohere v2
  const cohereMsg = d.message as Record<string, unknown> | undefined
  if (cohereMsg) {
    if (typeof cohereMsg.content === "string") reply = cohereMsg.content
    if (Array.isArray(cohereMsg.content)) {
      const b = (cohereMsg.content as Array<Record<string, unknown>>).find((x) => x.type === "text")
      if (typeof b?.text === "string") reply = b.text
    }
  }

  // Anthropic usage (input_tokens / output_tokens)
  if (!tokenUsage) {
    const anthropicUsage = d.usage as Record<string, unknown> | undefined
    if (anthropicUsage && typeof anthropicUsage.input_tokens === "number") {
      tokenUsage = {
        promptTokens: anthropicUsage.input_tokens as number,
        completionTokens: typeof anthropicUsage.output_tokens === "number" ? anthropicUsage.output_tokens : null,
        totalTokens: typeof anthropicUsage.input_tokens === "number" && typeof anthropicUsage.output_tokens === "number"
          ? (anthropicUsage.input_tokens as number) + (anthropicUsage.output_tokens as number)
          : null,
      }
    }
  }

  // OpenAI-compatible usage (prompt_tokens / completion_tokens)
  if (!tokenUsage) {
    const oaiUsage = d.usage as Record<string, unknown> | undefined
    if (oaiUsage && typeof oaiUsage.prompt_tokens === "number") {
      tokenUsage = {
        promptTokens: oaiUsage.prompt_tokens as number,
        completionTokens: typeof oaiUsage.completion_tokens === "number" ? oaiUsage.completion_tokens : null,
        totalTokens: typeof oaiUsage.total_tokens === "number" ? oaiUsage.total_tokens : null,
      }
    }
  }

  // IBM WatsonX
  if (Array.isArray(d.results)) {
    const r = (d.results as Array<Record<string, unknown>>)[0]
    if (typeof r?.generated_text === "string") reply = r.generated_text
    if (typeof r?.input_token_count === "number") {
      tokenUsage = {
        promptTokens: r.input_token_count as number,
        completionTokens: typeof r.generated_token_count === "number" ? r.generated_token_count : null,
        totalTokens: typeof r.input_token_count === "number" && typeof r.generated_token_count === "number"
          ? (r.input_token_count as number) + (r.generated_token_count as number)
          : null,
      }
    }
  }

  // Replicate
  if (provider === "replicate") {
    if (Array.isArray(d.output)) reply = (d.output as string[]).join("")
    else if (typeof d.output === "string") reply = d.output
  }

  // Lamini / generic text field
  if (!reply && typeof d.output === "string") reply = d.output
  if (!reply && typeof d.text === "string") reply = d.text

  return { reply, modelUsed, tokenUsage }
}

// ── Nested error message extractor ───────────────────────────────────────────

function extractErrorMessage(raw: unknown, httpStatus: number): string {
  if (!raw || typeof raw !== "object") return `HTTP ${httpStatus}`
  const d = raw as Record<string, unknown>
  const err = d.error
  if (typeof err === "string") return err
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>
    if (typeof e.message === "string") return e.message
    if (typeof e.description === "string") return e.description
  }
  if (typeof d.message === "string") return d.message
  if (typeof d.detail === "string") return d.detail
  return `HTTP ${httpStatus}`
}

// ── Test a single entry ───────────────────────────────────────────────────────

async function testOne(entry: MultiKeyEntry, prompt: string, modelOverride?: string): Promise<MultiKeyResult> {
  const start = Date.now()
  const provider = entry.provider.toLowerCase()
  const label = entry.label ?? provider
  const masked = maskApiKey(entry.apiKey)

  const endpoint = resolveProviderEndpoint(provider, entry.apiKey)
  if (!endpoint) {
    return {
      provider, apiKeyMasked: masked, label,
      ok: false, status: 0, statusText: "Skipped", durationMs: 0,
      error: `Provider "${provider}" requires additional config (account ID / resource name)`,
    }
  }

  // Build headers and body from shared lib/providers.ts — same as batch-test
  const headers = buildProviderHeaders(provider, entry.apiKey)
  const bodyObj = buildProviderBody(provider, prompt, modelOverride)

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyObj),
      signal: AbortSignal.timeout(25_000),
    })

    let parsedData: unknown = null
    const ct = res.headers.get("content-type") ?? ""
    if (ct.includes("application/json")) {
      parsedData = await res.json().catch(() => null)
    } else {
      await res.text().catch(() => null)
    }

    const extracted = parsedData ? extractResponse(provider, parsedData) : {}
    const errMsg = !res.ok ? extractErrorMessage(parsedData, res.status) : undefined

    return {
      provider,
      apiKeyMasked: masked,
      label,
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      chatReply: extracted.reply,
      durationMs: Date.now() - start,
      error: errMsg,
      modelUsed: extracted.modelUsed,
      tokenUsage: extracted.tokenUsage,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error"
    return { provider, apiKeyMasked: masked, label, ok: false, status: 0, statusText: "Error", durationMs: Date.now() - start, error: msg }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const entries: MultiKeyEntry[] = body.entries ?? []
  // Single default prompt — consistent with DEFAULT_PROMPT in lib/providers.ts
  const prompt: string = body.prompt?.trim() || DEFAULT_PROMPT
  const modelOverride: string | undefined = body.modelOverride

  if (!entries.length) {
    return NextResponse.json({ error: "No entries provided" }, { status: 400 })
  }

  const capped = entries.slice(0, 100)
  const overallStart = Date.now()

  const settled = await Promise.allSettled(capped.map((e) => testOne(e, prompt, modelOverride)))

  const results: MultiKeyResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value
    return {
      provider: capped[i].provider,
      apiKeyMasked: maskApiKey(capped[i].apiKey),
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
