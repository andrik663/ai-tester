const BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

export async function POST(req: Request) {
  const { prompt, model, aspectRatio, apiKey: bodyApiKey } = await req.json()
  const selectedModel = model ?? "veo-3.1-generate-preview"
  const apiKey = bodyApiKey?.trim() || process.env.GEMINI_API_KEY || ""

  // Initiate long-running video generation — mirrors the cURL exactly
  const response = await fetch(
    `${BASE_URL}/models/${selectedModel}:predictLongRunning`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          aspectRatio: aspectRatio ?? "16:9",
          sampleCount: 1,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    return new Response(JSON.stringify({ error }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    })
  }

  const operation = await response.json()
  // Return the operation name so the client can poll for status
  return Response.json({ operationName: operation.name })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const operationName = searchParams.get("operation")
  const queryApiKey = searchParams.get("apiKey")
  const apiKey = queryApiKey?.trim() || process.env.GEMINI_API_KEY || ""

  if (!operationName) {
    return new Response(JSON.stringify({ error: "Missing operation name" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Poll the operation status
  const response = await fetch(`${BASE_URL}/${operationName}`, {
    headers: {
      "x-goog-api-key": apiKey,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    return new Response(JSON.stringify({ error }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    })
  }

  const data = await response.json()

  if (!data.done) {
    return Response.json({ done: false })
  }

  // Extract video URI from the completed operation
  const videoUri =
    data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ??
    null

  if (!videoUri) {
    return Response.json({
      done: true,
      error: "No video URI in response",
      raw: data,
    })
  }

  // Fetch the video bytes and return as base64 so the browser can play it
  const videoRes = await fetch(videoUri, {
    headers: { "x-goog-api-key": apiKey },
  })

  if (!videoRes.ok) {
    return Response.json({ done: true, error: "Failed to download video", videoUri })
  }

  const buffer = await videoRes.arrayBuffer()
  const base64 = Buffer.from(buffer).toString("base64")

  return Response.json({
    done: true,
    videoBase64: base64,
    mimeType: "video/mp4",
    videoUri,
  })
}
