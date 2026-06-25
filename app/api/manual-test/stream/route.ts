import { NextRequest } from "next/server"
import { PROVIDER_CONFIGS, MANUAL_MAX_TOKENS } from "@/lib/providers"

export const runtime = "nodejs"
export const maxDuration = 60

// ── SSE event helpers ─────────────────────────────────────────────────────────

function sseChunk(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// ── Build streaming body ──────────────────────────────────────────────────────

function buildStreamBody(
  providerKey: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string,
  rawBody?: string
): { body: object; isStreamingSupported: boolean } {
  // If user provided raw body, parse and inject stream: true
  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>
      // Inject messages if placeholder present
      if (Array.isArray(parsed.messages)) {
        parsed.messages = messages
      }
      parsed.stream = true
      return { body: parsed, isStreamingSupported: true }
    } catch {
      // fall through to template
    }
  }

  const cfg = PROVIDER_CONFIGS[providerKey]
  if (!cfg) {
    const body: Record<string, unknown> = {
      model: "gpt-4o-mini",
      max_tokens: MANUAL_MAX_TOKENS,
      messages,
      stream: true,
    }
    if (systemPrompt) body.messages = [{ role: "system", content: systemPrompt }, ...messages]
    return { body, isStreamingSupported: true }
  }

  const base = cfg.buildBody(cfg.models[0], MANUAL_MAX_TOKENS) as Record<string, unknown>

  // Anthropic uses different stream approach
  const isAnthropic = providerKey === "anthropic"
  const isGemini    = providerKey === "google"
  const isXAI       = providerKey === "xai"

  if (isAnthropic) {
    const bodyMsgs = systemPrompt
      ? messages  // Anthropic takes system separately
      : messages
    const body: Record<string, unknown> = {
      model: base.model ?? cfg.models[0],
      max_tokens: MANUAL_MAX_TOKENS,
      messages: bodyMsgs,
      stream: true,
    }
    if (systemPrompt) body.system = systemPrompt
    return { body, isStreamingSupported: true }
  }

  if (isGemini) {
    // Gemini uses generateContentStream endpoint, but we can use alt=sse
    const contents = systemPrompt
      ? [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + (messages.at(-1)?.content ?? "") }] }]
      : messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }))
    return {
      body: {
        contents,
        generationConfig: { maxOutputTokens: MANUAL_MAX_TOKENS },
      },
      isStreamingSupported: true,
    }
  }

  if (isXAI) {
    const inputMsgs = systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages
    return {
      body: {
        model: base.model ?? cfg.models[0],
        max_tokens: MANUAL_MAX_TOKENS,
        input: inputMsgs,
        stream: true,
      },
      isStreamingSupported: true,
    }
  }

  // OpenAI-compatible (default)
  const chatMessages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages
  return {
    body: {
      ...base,
      messages: chatMessages,
      stream: true,
      stream_options: { include_usage: true },
    },
    isStreamingSupported: true,
  }
}

// ── Token extractor for streaming delta ──────────────────────────────────────

function extractDeltaToken(
  providerKey: string,
  parsed: Record<string, unknown>
): string | null {
  const isAnthropic = providerKey === "anthropic"
  const isGemini    = providerKey === "google"
  const isXAI       = providerKey === "xai"

  if (isAnthropic) {
    const delta = parsed.delta as Record<string, unknown> | undefined
    if (delta?.type === "text_delta") return delta.text as string
    return null
  }

  if (isGemini) {
    try {
      const candidates = parsed.candidates as Array<Record<string, unknown>>
      const parts = (candidates?.[0]?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>>
      return (parts?.[0]?.text as string) ?? null
    } catch { return null }
  }

  if (isXAI) {
    // Responses API streaming
    try {
      if (parsed.type === "response.output_text.delta") {
        return (parsed as Record<string, unknown>).delta as string
      }
      // OpenAI compat fallback
      const choices = parsed.choices as Array<Record<string, unknown>>
      const delta = choices?.[0]?.delta as Record<string, unknown>
      return (delta?.content as string) ?? null
    } catch { return null }
  }

  // OpenAI-compatible
  try {
    const choices = parsed.choices as Array<Record<string, unknown>>
    const delta = choices?.[0]?.delta as Record<string, unknown>
    return (delta?.content as string) ?? null
  } catch { return null }
}

// ── Extract usage from final chunk ───────────────────────────────────────────

function extractUsageFromChunk(
  providerKey: string,
  parsed: Record<string, unknown>
): { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null {
  const isAnthropic = providerKey === "anthropic"
  if (isAnthropic) {
    if (parsed.type === "message_delta") {
      const usage = parsed.usage as Record<string, unknown> | undefined
      if (usage) {
        return { completionTokens: usage.output_tokens as number }
      }
    }
    if (parsed.type === "message_start") {
      const msg = parsed.message as Record<string, unknown>
      const usage = msg?.usage as Record<string, unknown>
      if (usage) {
        return { promptTokens: usage.input_tokens as number }
      }
    }
    return null
  }
  // OpenAI-compatible
  const usage = parsed.usage as Record<string, unknown> | undefined
  if (!usage) return null
  return {
    promptTokens: usage.prompt_tokens as number,
    completionTokens: usage.completion_tokens as number,
    totalTokens: usage.total_tokens as number,
  }
}

// ── Build endpoint (Gemini needs alt=sse) ────────────────────────────────────

function buildStreamEndpoint(providerKey: string, apiKey: string, baseEndpoint: string): string {
  if (providerKey === "google") {
    // Swap generateContent → streamGenerateContent?alt=sse
    const url = baseEndpoint
      .replace("generateContent", "streamGenerateContent")
      .replace(/[?&]key=[^&]*/, "")
    const sep = url.includes("?") ? "&" : "?"
    return `${url}${sep}key=${apiKey}&alt=sse`
  }
  return baseEndpoint
}

// ── Capture important response headers ───────────────────────────────────────

const RATE_LIMIT_HEADERS = [
  "x-ratelimit-limit-requests",
  "x-ratelimit-remaining-requests",
  "x-ratelimit-reset-requests",
  "x-ratelimit-limit-tokens",
  "x-ratelimit-remaining-tokens",
  "anthropic-ratelimit-requests-remaining",
  "anthropic-ratelimit-requests-limit",
  "anthropic-ratelimit-requests-reset",
  "anthropic-ratelimit-tokens-remaining",
  "anthropic-ratelimit-tokens-limit",
  "retry-after",
  "x-request-id",
  "openai-processing-ms",
]

function captureRateLimitHeaders(res: Response): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of RATE_LIMIT_HEADERS) {
    const v = res.headers.get(k)
    if (v) out[k] = v
  }
  return out
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    provider: string
    apiKey: string
    endpoint: string
    headers: Record<string, string>
    messages: Array<{ role: string; content: string }>
    systemPrompt?: string
    rawBody?: string
    model?: string
  }

  const { provider, apiKey, endpoint, headers, messages, systemPrompt, rawBody, model } = body

  const cfg = PROVIDER_CONFIGS[provider]
  const authHeaders = cfg ? cfg.authHeader(apiKey) : { Authorization: `Bearer ${apiKey}` }
  const extraHeaders = cfg?.extraHeaders ?? { "Content-Type": "application/json" }

  const { body: streamBodyRaw } = buildStreamBody(provider, messages, systemPrompt, rawBody)
  // Override model if caller specified one explicitly
  const streamBody = model
    ? { ...(streamBodyRaw as Record<string, unknown>), model }
    : streamBodyRaw

  const streamEndpoint = buildStreamEndpoint(provider, apiKey, endpoint)

  const reqHeaders: Record<string, string> = {
    ...extraHeaders,
    ...authHeaders,
    ...headers,
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  }
  // Gemini uses key in URL — don't send auth header
  if (provider === "google") {
    delete reqHeaders["Authorization"]
    delete reqHeaders["x-goog-api-key"]
  }

  const startMs = Date.now()
  let ttftMs: number | null = null
  let promptTokens: number | undefined
  let completionTokens: number | undefined
  let totalTokens: number | undefined

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let upstreamRes: Response

      try {
        upstreamRes = await fetch(streamEndpoint, {
          method: "POST",
          headers: reqHeaders,
          body: JSON.stringify(streamBody),
        })
      } catch (err) {
        controller.enqueue(encoder.encode(sseChunk("error", { message: err instanceof Error ? err.message : "Fetch failed" })))
        controller.close()
        return
      }

      const rateLimitHeaders = captureRateLimitHeaders(upstreamRes)

      if (!upstreamRes.ok) {
        const errBody = await upstreamRes.text()
        controller.enqueue(encoder.encode(sseChunk("error", {
          status: upstreamRes.status,
          statusText: upstreamRes.statusText,
          body: errBody,
          responseHeaders: rateLimitHeaders,
        })))
        controller.close()
        return
      }

      // Send response headers immediately so client can show rate limit info
      controller.enqueue(encoder.encode(sseChunk("response_headers", rateLimitHeaders)))

      const reader = upstreamRes.body?.getReader()
      if (!reader) {
        controller.enqueue(encoder.encode(sseChunk("error", { message: "No response body" })))
        controller.close()
        return
      }

      const dec = new TextDecoder()
      let buffer = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += dec.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const raw of lines) {
            const line = raw.trim()
            if (!line || line === "data: [DONE]" || line === "[DONE]") continue

            const dataStr = line.startsWith("data: ") ? line.slice(6) : line
            if (!dataStr.startsWith("{")) continue

            let parsed: Record<string, unknown>
            try { parsed = JSON.parse(dataStr) }
            catch { continue }

            // Extract text token
            const token = extractDeltaToken(provider, parsed)
            if (token) {
              if (ttftMs === null) {
                ttftMs = Date.now() - startMs
                controller.enqueue(encoder.encode(sseChunk("ttft", { ms: ttftMs })))
              }
              controller.enqueue(encoder.encode(sseChunk("token", { text: token })))
            }

            // Extract usage
            const usage = extractUsageFromChunk(provider, parsed)
            if (usage) {
              if (usage.promptTokens) promptTokens = (promptTokens ?? 0) + usage.promptTokens
              if (usage.completionTokens) completionTokens = (completionTokens ?? 0) + usage.completionTokens
              if (usage.totalTokens) totalTokens = usage.totalTokens
            }
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode(sseChunk("error", { message: err instanceof Error ? err.message : "Stream read error" })))
      } finally {
        reader.releaseLock()
      }

      const totalMs = Date.now() - startMs
      controller.enqueue(encoder.encode(sseChunk("done", {
        durationMs: totalMs,
        ttftMs,
        tokenUsage: { promptTokens, completionTokens, totalTokens },
        responseHeaders: rateLimitHeaders,
      })))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
