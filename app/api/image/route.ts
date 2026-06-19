export const maxDuration = 60

interface GeminiPart {
  text?: string
  inlineData?: {
    mimeType: string
    data: string
  }
}

interface GeminiCandidate {
  content: {
    parts: GeminiPart[]
  }
}

interface GeminiResponse {
  candidates?: GeminiCandidate[]
  error?: { code: number; message: string; status: string }
}

export async function POST(req: Request) {
  const { prompt, model = "gemini-3-pro-image", aspectRatio = "1:1" } =
    await req.json()

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY not set" }, { status: 500 })
  }

  // Map aspect ratio to size hint in prompt
  const sizeHint =
    aspectRatio === "16:9"
      ? "landscape, wide format (16:9)"
      : aspectRatio === "9:16"
        ? "portrait, vertical format (9:16)"
        : aspectRatio === "4:3"
          ? "standard format (4:3)"
          : "square format (1:1)"

  const enhancedPrompt = `${prompt}. Image orientation: ${sizeHint}.`

  const requestBody = {
    contents: [
      {
        parts: [{ text: enhancedPrompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  }

  const startTime = Date.now()

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
      }
    )

    const duration = Date.now() - startTime
    const data: GeminiResponse = await res.json()

    if (!res.ok || data.error) {
      return Response.json(
        {
          error: data.error?.message ?? `HTTP ${res.status}`,
          errorCode: data.error?.code ?? res.status,
          errorStatus: data.error?.status ?? "UNKNOWN",
          rawResponse: data,
          duration,
        },
        { status: res.status }
      )
    }

    // Extract image and text parts from candidates
    const parts = data.candidates?.[0]?.content?.parts ?? []
    let imageData: string | null = null
    let imageMimeType = "image/png"
    let textContent = ""

    for (const part of parts) {
      if (part.inlineData) {
        imageData = part.inlineData.data
        imageMimeType = part.inlineData.mimeType
      } else if (part.text) {
        textContent += part.text
      }
    }

    return Response.json({
      imageData,
      imageMimeType,
      textContent,
      rawRequest: requestBody,
      rawResponse: data,
      duration,
      model,
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
