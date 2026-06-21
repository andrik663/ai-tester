export async function POST(req: Request) {
  const { messages, model, temperature, maxOutputTokens, systemPrompt, apiKey: bodyApiKey } = await req.json()

  const selectedModel = model ?? "gemini-2.5-flash"
  const apiKey = bodyApiKey?.trim() || process.env.GEMINI_API_KEY || ""

  // Build the contents array matching the cURL structure exactly
  const contents = messages.map((msg: { role: string; content: string }) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }))

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: temperature ?? 1.0,
      maxOutputTokens: maxOutputTokens ?? 2048,
    },
  }

  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    return new Response(JSON.stringify({ error }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Stream the SSE response back to the client, forwarding text + token usage
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) {
        controller.close()
        return
      }

      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("data:")) continue
          const data = trimmed.slice(5).trim()
          if (!data || data === "[DONE]") continue

          try {
            const parsed = JSON.parse(data)
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
            const inputTokens = parsed.usageMetadata?.promptTokenCount ?? 0
            const outputTokens = parsed.usageMetadata?.candidatesTokenCount ?? 0

            const payload: Record<string, unknown> = {}
            if (text) payload.text = text
            if (inputTokens) payload.inputTokens = inputTokens
            if (outputTokens) payload.outputTokens = outputTokens

            if (Object.keys(payload).length > 0) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
              )
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
