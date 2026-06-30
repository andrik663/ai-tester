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

  // ── Luma Dream Machine video ──────────────────────────────────────────────
  if (providerId === "luma") {
    const selectedModel = model ?? "luma-dream-machine-v1.6"
    const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selectedModel,
        prompt,
        aspect_ratio: aspectRatio ?? "16:9",
        loop: false,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { detail?: string; message?: string }
      return Response.json({ error: err.detail ?? err.message ?? `HTTP ${res.status}` }, { status: res.status })
    }
    const data = await res.json() as { id?: string; error?: string }
    if (!data.id) return Response.json({ error: data.error ?? "No generation ID returned" }, { status: 500 })
    return Response.json({ operationName: `luma:${data.id}`, provider: "luma" })
  }

  // ── Runway Gen-4 video ────────────────────────────────────────────────────
  if (providerId === "runway") {
    const selectedModel = model ?? "gen4_turbo"
    const res = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model: selectedModel,
        promptText: prompt,
        ratio: aspectRatio === "9:16" ? "720:1280" : aspectRatio === "1:1" ? "1280:1280" : "1280:720",
        duration: 5,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string; error?: string }
      return Response.json({ error: err.message ?? err.error ?? `HTTP ${res.status}` }, { status: res.status })
    }
    const data = await res.json() as { id?: string; error?: string }
    if (!data.id) return Response.json({ error: data.error ?? "No task ID returned" }, { status: 500 })
    return Response.json({ operationName: `runway:${data.id}`, provider: "runway" })
  }

  // ── Pika Labs video ───────────────────────────────────────────────────────
  if (providerId === "pika") {
    const selectedModel = model ?? "pika-2.2"
    const res = await fetch("https://api.pika.art/v2/generate", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        promptText: prompt,
        model: selectedModel,
        options: {
          aspectRatio: aspectRatio ?? "16:9",
          frameRate: 24,
          duration: 5,
        },
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string; error?: string }
      return Response.json({ error: err.message ?? err.error ?? `HTTP ${res.status}` }, { status: res.status })
    }
    const data = await res.json() as { id?: string; taskId?: string; error?: string }
    const taskId = data.id ?? data.taskId
    if (!taskId) return Response.json({ error: data.error ?? "No task ID returned" }, { status: 500 })
    return Response.json({ operationName: `pika:${taskId}`, provider: "pika" })
  }

  // ── Kling (Kuaishou) video ─────────────────────────────────────────────────
  if (providerId === "kling") {
    const selectedModel = model ?? "kling-v2.1"
    const res = await fetch("https://api.klingai.com/v1/videos/text2video", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model_name: selectedModel,
        prompt,
        cfg_scale: 0.5,
        aspect_ratio: aspectRatio ?? "16:9",
        duration: "5",
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string; error?: string }
      return Response.json({ error: err.message ?? err.error ?? `HTTP ${res.status}` }, { status: res.status })
    }
    const data = await res.json() as { data?: { task_id?: string }; message?: string }
    const taskId = data.data?.task_id
    if (!taskId) return Response.json({ error: data.message ?? "No task ID returned" }, { status: 500 })
    return Response.json({ operationName: `kling:${taskId}`, provider: "kling" })
  }

  // ── Jempol.in video ──────────────────────────────────────────────────────
  if (providerId === "jempol") {
    const selectedModel = model ?? "grok-premium-video"
    const body: Record<string, string> = {
      model: selectedModel,
      prompt,
      aspectRatio: aspectRatio ?? "16:9",
    }
    const res = await fetch("https://jempol.in/v1/videos/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string; error?: string }
      return Response.json({ error: err.message ?? err.error ?? `HTTP ${res.status}` }, { status: res.status })
    }
    const data = await res.json() as {
      success?: boolean
      job_id?: string
      status?: string
      message?: string
    }
    if (!data.success || !data.job_id) {
      return Response.json({ error: data.message ?? "No job_id returned" }, { status: 500 })
    }
    return Response.json({ operationName: `jempol:${data.job_id}`, provider: "jempol" })
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

  // ── Luma Dream Machine polling ────────────────────────────────────────────
  if (operationName.startsWith("luma:")) {
    const genId = operationName.slice("luma:".length)
    const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${genId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    })
    if (!res.ok) return Response.json({ done: true, error: `HTTP ${res.status}` })
    const data = await res.json() as {
      state?: string
      failure_reason?: string
      assets?: { video?: string }
    }
    if (data.state === "failed") return Response.json({ done: true, error: data.failure_reason ?? "Generation failed" })
    if (data.state !== "completed" || !data.assets?.video) return Response.json({ done: false })
    const videoRes = await fetch(data.assets.video)
    if (!videoRes.ok) return Response.json({ done: true, error: "Failed to download video" })
    const buf = await videoRes.arrayBuffer()
    const base64 = Buffer.from(buf).toString("base64")
    return Response.json({ done: true, videoBase64: base64, mimeType: "video/mp4" })
  }

  // ── Runway polling ────────────────────────────────────────────────────────
  if (operationName.startsWith("runway:")) {
    const taskId = operationName.slice("runway:".length)
    const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "X-Runway-Version": "2024-11-06",
      },
    })
    if (!res.ok) return Response.json({ done: true, error: `HTTP ${res.status}` })
    const data = await res.json() as {
      status?: string
      failure?: string
      output?: string[]
    }
    if (data.status === "FAILED") return Response.json({ done: true, error: data.failure ?? "Generation failed" })
    if (data.status !== "SUCCEEDED" || !data.output?.[0]) return Response.json({ done: false })
    const videoRes = await fetch(data.output[0])
    if (!videoRes.ok) return Response.json({ done: true, error: "Failed to download video" })
    const buf = await videoRes.arrayBuffer()
    const base64 = Buffer.from(buf).toString("base64")
    return Response.json({ done: true, videoBase64: base64, mimeType: "video/mp4" })
  }

  // ── Pika Labs polling ─────────────────────────────────────────────────────
  if (operationName.startsWith("pika:")) {
    const taskId = operationName.slice("pika:".length)
    const res = await fetch(`https://api.pika.art/v2/tasks/${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    })
    if (!res.ok) return Response.json({ done: true, error: `HTTP ${res.status}` })
    const data = await res.json() as {
      status?: string
      videos?: Array<{ url?: string }>
      error?: string
    }
    if (data.status === "failed") return Response.json({ done: true, error: data.error ?? "Generation failed" })
    if (data.status !== "completed" || !data.videos?.[0]?.url) return Response.json({ done: false })
    const videoRes = await fetch(data.videos[0].url!)
    if (!videoRes.ok) return Response.json({ done: true, error: "Failed to download video" })
    const buf = await videoRes.arrayBuffer()
    const base64 = Buffer.from(buf).toString("base64")
    return Response.json({ done: true, videoBase64: base64, mimeType: "video/mp4" })
  }

  // ── Kling polling ─────────────────────────────────────────────────────────
  if (operationName.startsWith("kling:")) {
    const taskId = operationName.slice("kling:".length)
    const res = await fetch(`https://api.klingai.com/v1/videos/text2video/${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    })
    if (!res.ok) return Response.json({ done: true, error: `HTTP ${res.status}` })
    const data = await res.json() as {
      data?: {
        task_status?: string
        task_result?: {
          videos?: Array<{ url?: string }>
        }
      }
      message?: string
    }
    const task = data.data
    if (task?.task_status === "failed") return Response.json({ done: true, error: data.message ?? "Generation failed" })
    if (task?.task_status !== "succeed" || !task.task_result?.videos?.[0]?.url) return Response.json({ done: false })
    const videoUrl = task.task_result.videos[0].url!
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) return Response.json({ done: true, error: "Failed to download video" })
    const buf = await videoRes.arrayBuffer()
    const base64 = Buffer.from(buf).toString("base64")
    return Response.json({ done: true, videoBase64: base64, mimeType: "video/mp4" })
  }

  // ── Jempol.in polling ────────────────────────────────────────────────────
  // Poll GET /v1/jobs/{job_id} every 5 s until success:true or status:failed.
  // 503 + transient:true → retry, not a hard failure.
  if (operationName.startsWith("jempol:")) {
    const jobId = operationName.slice("jempol:".length)
    const res = await fetch(`https://jempol.in/v1/jobs/${jobId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    })
    // Transient 503 → keep polling
    if (res.status === 503) {
      const body = await res.json().catch(() => ({})) as { transient?: boolean }
      if (body.transient) return Response.json({ done: false })
      return Response.json({ done: true, error: "Service unavailable (503)" })
    }
    if (!res.ok) return Response.json({ done: true, error: `HTTP ${res.status}` })
    const data = await res.json() as {
      success?: boolean
      status?: string
      credits_released?: number
      data?: Array<{ url?: string }>
      message?: string
    }
    // Still queued / processing (success:false and not failed)
    if (!data.success && data.status !== "failed") return Response.json({ done: false })
    // Failed
    if (data.status === "failed") {
      return Response.json({ done: true, error: data.message ?? "Generation failed" })
    }
    // Succeeded — return the CDN URL directly; client <video> plays it without a server download
    const videoUrl = data.data?.[0]?.url
    if (!videoUrl) return Response.json({ done: true, error: "No video URL in response" })
    return Response.json({ done: true, videoUrl, mimeType: "video/mp4" })
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
