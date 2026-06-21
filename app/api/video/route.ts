const BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

export async function POST(req: Request) {
  const { prompt, model, aspectRatio, apiKey: bodyApiKey, providerId = "google" } = await req.json()
  const apiKey = bodyApiKey?.trim() || process.env.GEMINI_API_KEY || ""

  if (!apiKey) {
    return Response.json({ error: "No API key provided. Enter your API key in the left panel." }, { status: 400 })
  }

  // ── MiniMax (Hailuo) video ─────────────────────────────────────────────────
  if (providerId === "minimax") {
    const selectedModel = model ?? "video-01-live2"
    const res = await fetch("https://api.minimaxi.chat/v1/video_generation", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel, prompt }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { base_resp?: { status_msg?: string } }
      return Response.json({ error: err.base_resp?.status_msg ?? `HTTP ${res.status}` }, { status: res.status })
    }
    const data = await res.json() as { task_id?: string; base_resp?: { status_code?: number; status_msg?: string } }
    if (!data.task_id) {
      return Response.json({ error: data.base_resp?.status_msg ?? "No task_id returned" }, { status: 500 })
    }
    return Response.json({ operationName: `minimax:${data.task_id}`, provider: "minimax" })
  }

  // ── Together AI Wan 2.7 video ──────────────────────────────────────────────
  if (providerId === "together") {
    const selectedModel = model ?? "Wan-AI/wan2.7-t2v"
    const res = await fetch("https://api.together.ai/v2/videos", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel, prompt, resolution: "720P", ratio: aspectRatio ?? "16:9", seconds: "5" }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      return Response.json({ error: err.error?.message ?? `HTTP ${res.status}` }, { status: res.status })
    }
    const data = await res.json() as { id?: string; error?: string }
    if (!data.id) return Response.json({ error: data.error ?? "No job ID returned" }, { status: 500 })
    return Response.json({ operationName: `together:${data.id}`, provider: "together" })
  }

  // ── Zhipu CogVideoX video ──────────────────────────────────────────────────
  if (providerId === "zhipu") {
    const selectedModel = model ?? "cogvideox-2"
    const res = await fetch("https://open.bigmodel.cn/api/paas/v4/videos/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel, prompt }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      return Response.json({ error: err.error?.message ?? `HTTP ${res.status}` }, { status: res.status })
    }
    const data = await res.json() as { id?: string; error?: { message?: string } }
    if (!data.id) return Response.json({ error: data.error?.message ?? "No task ID returned" }, { status: 500 })
    return Response.json({ operationName: `zhipu:${data.id}`, provider: "zhipu" })
  }

  // ── Google Veo (default) ───────────────────────────────────────────────────
  const selectedModel = model ?? "veo-3.1-generate-preview"
  const response = await fetch(
    `${BASE_URL}/models/${selectedModel}:predictLongRunning`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { aspectRatio: aspectRatio ?? "16:9", sampleCount: 1 },
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

  const operation = await response.json() as { name?: string }
  return Response.json({ operationName: operation.name, provider: "google" })
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

  // ── Together AI polling ───────────────────────────────────────────────────
  if (operationName.startsWith("together:")) {
    const jobId = operationName.slice("together:".length)
    const res = await fetch(`https://api.together.ai/v2/videos/${jobId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    })
    if (!res.ok) return Response.json({ done: true, error: `HTTP ${res.status}` })
    const data = await res.json() as { status?: string; output?: { url?: string }; error?: string }
    if (data.status === "error" || data.error) return Response.json({ done: true, error: data.error ?? "Generation failed" })
    if (data.status !== "completed" || !data.output?.url) return Response.json({ done: false })
    // Download and base64-encode
    const videoRes = await fetch(data.output.url)
    if (!videoRes.ok) return Response.json({ done: true, error: "Failed to download video" })
    const buf = await videoRes.arrayBuffer()
    const base64 = Buffer.from(buf).toString("base64")
    return Response.json({ done: true, videoBase64: base64, mimeType: "video/mp4" })
  }

  // ── Zhipu CogVideoX polling ────────────────────────────────────────────────
  if (operationName.startsWith("zhipu:")) {
    const taskId = operationName.slice("zhipu:".length)
    const res = await fetch(`https://open.bigmodel.cn/api/paas/v4/async-result/${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    })
    if (!res.ok) return Response.json({ done: true, error: `HTTP ${res.status}` })
    const data = await res.json() as {
      task_status?: string
      video_result?: Array<{ url?: string; cover_image_url?: string }>
      error?: { message?: string }
    }
    if (data.task_status === "FAIL") return Response.json({ done: true, error: data.error?.message ?? "Generation failed" })
    if (data.task_status !== "SUCCESS" || !data.video_result?.[0]?.url) return Response.json({ done: false })
    const videoUrl = data.video_result[0].url!
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) return Response.json({ done: true, error: "Failed to download video" })
    const buf = await videoRes.arrayBuffer()
    const base64 = Buffer.from(buf).toString("base64")
    return Response.json({ done: true, videoBase64: base64, mimeType: "video/mp4" })
  }

  // ── MiniMax polling ────────────────────────────────────────────────────────
  if (operationName.startsWith("minimax:")) {
    const taskId = operationName.slice("minimax:".length)
    const res = await fetch(`https://api.minimaxi.chat/v1/query/video_generation?task_id=${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      return Response.json({ error: `HTTP ${res.status}` })
    }
    const data = await res.json() as { status?: string; file_id?: string; base_resp?: { status_msg?: string } }
    if (data.status === "Fail") {
      return Response.json({ done: true, error: data.base_resp?.status_msg ?? "Generation failed" })
    }
    if (data.status !== "Success" || !data.file_id) {
      return Response.json({ done: false })
    }
    // Fetch download URL
    const fileRes = await fetch(`https://api.minimaxi.chat/v1/files/retrieve?GroupId=${taskId}&file_id=${data.file_id}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    })
    if (!fileRes.ok) return Response.json({ done: true, error: "Failed to retrieve file" })
    const fileData = await fileRes.json() as { file?: { download_url?: string } }
    const downloadUrl = fileData.file?.download_url
    if (!downloadUrl) return Response.json({ done: true, error: "No download URL" })
    // Download + base64
    const videoRes = await fetch(downloadUrl)
    if (!videoRes.ok) return Response.json({ done: true, error: "Failed to download video" })
    const buf = await videoRes.arrayBuffer()
    const base64 = Buffer.from(buf).toString("base64")
    return Response.json({ done: true, videoBase64: base64, mimeType: "video/mp4" })
  }

  // ── Google Veo polling ─────────────────────────────────────────────────────
  const response = await fetch(`${BASE_URL}/${operationName}`, {
    headers: { "x-goog-api-key": apiKey },
  })

  if (!response.ok) {
    const error = await response.text()
    return new Response(JSON.stringify({ error }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    })
  }

  const data = await response.json() as {
    done?: boolean
    response?: { generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> } }
  }

  if (!data.done) return Response.json({ done: false })

  const videoUri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ?? null
  if (!videoUri) return Response.json({ done: true, error: "No video URI in response", raw: data })

  const videoRes = await fetch(videoUri, { headers: { "x-goog-api-key": apiKey } })
  if (!videoRes.ok) return Response.json({ done: true, error: "Failed to download video", videoUri })

  const buffer = await videoRes.arrayBuffer()
  const base64 = Buffer.from(buffer).toString("base64")
  return Response.json({ done: true, videoBase64: base64, mimeType: "video/mp4", videoUri })
}
