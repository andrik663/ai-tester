export const maxDuration = 60

// ── Provider routing ────────────────────────────────────────────────────────
// Each entry describes how to call the provider's image generation endpoint.

interface ImageProviderConfig {
  buildUrl: (model: string) => string
  buildHeaders: (apiKey: string) => Record<string, string>
  buildBody: (prompt: string, model: string, aspectRatio: string) => unknown
  extractImage: (data: unknown) => { imageData: string | null; imageMimeType: string; textContent: string }
  extractError: (data: unknown, status: number) => { error: string; errorCode: number; errorStatus: string }
}

const PROVIDER_CONFIGS: Record<string, ImageProviderConfig> = {
  // ── Google Gemini ──────────────────────────────────────────────────────────
  google: {
    buildUrl: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    buildHeaders: (apiKey) => ({ "Content-Type": "application/json", "x-goog-api-key": apiKey }),
    buildBody: (prompt, _model, aspectRatio) => {
      const sizeHint =
        aspectRatio === "16:9" ? "landscape wide format (16:9)" :
        aspectRatio === "9:16" ? "portrait vertical format (9:16)" :
        aspectRatio === "4:3"  ? "standard format (4:3)" : "square format (1:1)"
      return {
        contents: [{ parts: [{ text: `${prompt}. Image orientation: ${sizeHint}.` }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }
    },
    extractImage: (data: unknown) => {
      const d = data as { candidates?: Array<{ content: { parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> } }> }
      const parts = d.candidates?.[0]?.content?.parts ?? []
      let imageData: string | null = null
      let imageMimeType = "image/png"
      let textContent = ""
      for (const p of parts) {
        if (p.inlineData) { imageData = p.inlineData.data; imageMimeType = p.inlineData.mimeType }
        else if (p.text) textContent += p.text
      }
      return { imageData, imageMimeType, textContent }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { error?: { code?: number; message?: string; status?: string } }
      return {
        error: d.error?.message ?? `HTTP ${status}`,
        errorCode: d.error?.code ?? status,
        errorStatus: d.error?.status ?? "UNKNOWN",
      }
    },
  },

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  openai: {
    buildUrl: (model) =>
      model === "gpt-image-1"
        ? "https://api.openai.com/v1/images/generations"
        : "https://api.openai.com/v1/images/generations",
    buildHeaders: (apiKey) => ({ "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }),
    buildBody: (prompt, model, aspectRatio) => {
      const sizeMap: Record<string, string> = { "1:1": "1024x1024", "16:9": "1792x1024", "9:16": "1024x1792" }
      const size = sizeMap[aspectRatio] ?? "1024x1024"
      return { model, prompt, n: 1, size, response_format: model === "gpt-image-1" ? "b64_json" : "b64_json" }
    },
    extractImage: (data: unknown) => {
      const d = data as { data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }> }
      const item = d.data?.[0]
      return {
        imageData: item?.b64_json ?? null,
        imageMimeType: "image/png",
        textContent: item?.revised_prompt ?? "",
      }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { error?: { message?: string; code?: string; type?: string } }
      return {
        error: d.error?.message ?? `HTTP ${status}`,
        errorCode: status,
        errorStatus: d.error?.type ?? d.error?.code ?? "UNKNOWN",
      }
    },
  },

  // ── Together AI ────────────────────────────────────────────────────────────
  together: {
    buildUrl: () => "https://api.together.xyz/v1/images/generations",
    buildHeaders: (apiKey) => ({ "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }),
    buildBody: (prompt, model, aspectRatio) => {
      const wMap: Record<string, number> = { "1:1": 1024, "16:9": 1344, "9:16": 768, "4:3": 1152 }
      const hMap: Record<string, number> = { "1:1": 1024, "16:9": 768, "9:16": 1344, "4:3": 896 }
      return { model, prompt, width: wMap[aspectRatio] ?? 1024, height: hMap[aspectRatio] ?? 1024, steps: 4, n: 1 }
    },
    extractImage: (data: unknown) => {
      const d = data as { data?: Array<{ b64_json?: string; url?: string }> }
      const item = d.data?.[0]
      return { imageData: item?.b64_json ?? null, imageMimeType: "image/jpeg", textContent: "" }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { error?: { message?: string }; message?: string }
      return { error: d.error?.message ?? d.message ?? `HTTP ${status}`, errorCode: status, errorStatus: "ERROR" }
    },
  },

  // ── Fireworks AI ───────────────────────────────────────────────────────────
  fireworks: {
    buildUrl: () => "https://api.fireworks.ai/inference/v1/image_generation/accounts/fireworks/models/flux-1-schnell-fp8",
    buildHeaders: (apiKey) => ({ "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }),
    buildBody: (prompt, model, aspectRatio) => {
      const wMap: Record<string, number> = { "1:1": 1024, "16:9": 1344, "9:16": 768 }
      const hMap: Record<string, number> = { "1:1": 1024, "16:9": 768, "9:16": 1344 }
      return { prompt, width: wMap[aspectRatio] ?? 1024, height: hMap[aspectRatio] ?? 1024, num_inference_steps: 4 }
    },
    extractImage: (data: unknown) => {
      const d = data as { images?: string[]; output?: string[] }
      const raw = (d.images ?? d.output ?? [])[0] ?? null
      // Fireworks returns raw base64 or data URI
      const imageData = raw?.startsWith("data:") ? raw.split(",")[1] : raw
      return { imageData, imageMimeType: "image/jpeg", textContent: "" }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { error?: string; message?: string }
      return { error: d.error ?? d.message ?? `HTTP ${status}`, errorCode: status, errorStatus: "ERROR" }
    },
  },

  // ── Novita AI ──────────────────────────────────────────────────────────────
  novita: {
    buildUrl: () => "https://api.novita.ai/v3/async/txt2img",
    buildHeaders: (apiKey) => ({ "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }),
    buildBody: (prompt, model, aspectRatio) => {
      const wMap: Record<string, number> = { "1:1": 1024, "16:9": 1344, "9:16": 768 }
      const hMap: Record<string, number> = { "1:1": 1024, "16:9": 768, "9:16": 1344 }
      return {
        request: {
          model_name: model,
          prompt,
          width: wMap[aspectRatio] ?? 1024,
          height: hMap[aspectRatio] ?? 1024,
          image_num: 1,
          steps: 20,
          guidance_scale: 7.5,
          sampler_name: "Euler a",
        },
      }
    },
    extractImage: (data: unknown) => {
      const d = data as { data?: { imgs?: Array<{ image_url?: string }> }; imgs?: Array<{ image_url?: string }> }
      const imgs = d.data?.imgs ?? d.imgs ?? []
      // Novita returns URLs; we can't inline base64 easily, return null and URL separately
      return { imageData: null, imageMimeType: "image/png", textContent: imgs[0]?.image_url ?? "" }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { reason?: string; message?: string }
      return { error: d.reason ?? d.message ?? `HTTP ${status}`, errorCode: status, errorStatus: "ERROR" }
    },
  },

  // ── HuggingFace ────────────────────────────────────────────────────────────
  huggingface: {
    buildUrl: (model) => `https://api-inference.huggingface.co/models/${model}`,
    buildHeaders: (apiKey) => ({ "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "Accept": "image/png" }),
    buildBody: (prompt) => ({ inputs: prompt }),
    extractImage: (data: unknown) => {
      // HuggingFace returns raw image bytes — handled specially in the route
      return { imageData: data as string, imageMimeType: "image/png", textContent: "" }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { error?: string }
      return { error: d.error ?? `HTTP ${status}`, errorCode: status, errorStatus: "ERROR" }
    },
  },

  // ── Replicate ──────────────────────────────────────────────────────────────
  replicate: {
    buildUrl: (model) => `https://api.replicate.com/v1/models/${model}/predictions`,
    buildHeaders: (apiKey) => ({ "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "Prefer": "wait" }),
    buildBody: (prompt, _model, aspectRatio) => ({
      input: { prompt, aspect_ratio: aspectRatio, output_format: "webp", go_fast: true }
    }),
    extractImage: (data: unknown) => {
      const d = data as { output?: string | string[] }
      const url = Array.isArray(d.output) ? d.output[0] : d.output
      return { imageData: null, imageMimeType: "image/webp", textContent: url ?? "" }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { detail?: string; error?: string }
      return { error: d.detail ?? d.error ?? `HTTP ${status}`, errorCode: status, errorStatus: "ERROR" }
    },
  },

  // ── xAI Aurora ────────────────────────────────────────────────────────────
  xai: {
    buildUrl: () => "https://api.x.ai/v1/images/generations",
    buildHeaders: (apiKey) => ({ "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }),
    buildBody: (prompt, model, aspectRatio) => ({
      model,
      prompt,
      n: 1,
      aspect_ratio: aspectRatio,
      response_format: "b64_json",
    }),
    extractImage: (data: unknown) => {
      const d = data as { data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }> }
      const item = d.data?.[0]
      return {
        imageData: item?.b64_json ?? null,
        imageMimeType: "image/png",
        textContent: item?.revised_prompt ?? "",
      }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { error?: { message?: string; type?: string } }
      return { error: d.error?.message ?? `HTTP ${status}`, errorCode: status, errorStatus: d.error?.type ?? "ERROR" }
    },
  },

  // ── Zhipu CogView ─────────────────────────────────────────────────────────
  zhipu: {
    buildUrl: () => "https://open.bigmodel.cn/api/paas/v4/images/generations",
    buildHeaders: (apiKey) => ({ "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }),
    buildBody: (prompt, model) => ({ model, prompt }),
    extractImage: (data: unknown) => {
      const d = data as { data?: Array<{ url?: string; b64_json?: string }> }
      const item = d.data?.[0]
      return {
        imageData: item?.b64_json ?? null,
        imageMimeType: "image/png",
        textContent: item?.url ?? "",
      }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { error?: { message?: string; code?: string } }
      return { error: d.error?.message ?? `HTTP ${status}`, errorCode: status, errorStatus: d.error?.code ?? "ERROR" }
    },
  },

  // ── Qwen Wanx (DashScope) ────────────────────────────────────────────────
  // Wanx uses the multimodal-generation endpoint with async task pattern
  qwen: {
    buildUrl: () => "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis",
    buildHeaders: (apiKey) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "X-DashScope-Async": "enable",
    }),
    buildBody: (prompt, model, aspectRatio) => {
      const sizeMap: Record<string, string> = { "1:1": "1024*1024", "16:9": "1792*1024", "9:16": "1024*1792", "4:3": "1024*768" }
      return {
        model,
        input: { prompt },
        parameters: { size: sizeMap[aspectRatio] ?? "1024*1024", n: 1 },
      }
    },
    extractImage: (data: unknown) => {
      // Async: returns task_id — client will see URL in textContent
      const d = data as {
        output?: { task_id?: string; results?: Array<{ url?: string }>; task_status?: string }
        request_id?: string
      }
      const url = d.output?.results?.[0]?.url ?? ""
      return { imageData: null, imageMimeType: "image/png", textContent: url }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { message?: string; code?: string }
      return { error: d.message ?? `HTTP ${status}`, errorCode: status, errorStatus: d.code ?? "ERROR" }
    },
  },

  // ── Stepfun image generation ──────────────────────────────────────────────
  stepfun: {
    buildUrl: () => "https://api.stepfun.ai/v1/images/generations",
    buildHeaders: (apiKey) => ({ "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }),
    buildBody: (prompt, model, aspectRatio) => {
      const sizeMap: Record<string, string> = { "1:1": "1024x1024", "16:9": "1920x1080", "9:16": "1080x1920", "4:3": "1024x768" }
      return { model, prompt, n: 1, size: sizeMap[aspectRatio] ?? "1024x1024" }
    },
    extractImage: (data: unknown) => {
      const d = data as { data?: Array<{ b64_json?: string; url?: string }> }
      const item = d.data?.[0]
      return { imageData: item?.b64_json ?? null, imageMimeType: "image/png", textContent: item?.url ?? "" }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { error?: { message?: string } }
      return { error: d.error?.message ?? `HTTP ${status}`, errorCode: status, errorStatus: "ERROR" }
    },
  },

  // ── Black Forest Labs (native FLUX API) ──────────────────────────────────
  bfl: {
    buildUrl: (model) => {
      const modelPath = model === "flux-2-pro" ? "flux-pro-2" :
                        model === "flux-2-dev" ? "flux-dev-2" :
                        model === "flux-1-kontext-pro" ? "flux-kontext-pro" :
                        "flux-pro-1.1"
      return `https://api.bfl.ai/v1/${modelPath}`
    },
    buildHeaders: (apiKey) => ({ "x-key": apiKey, "Content-Type": "application/json" }),
    buildBody: (prompt, _model, aspectRatio) => {
      const [w, h] = aspectRatio === "16:9" ? [1440, 816] : aspectRatio === "9:16" ? [816, 1440] : aspectRatio === "4:3" ? [1248, 936] : [1024, 1024]
      return { prompt, width: w, height: h }
    },
    extractImage: (data: unknown) => {
      // BFL returns a polling ID first; for simplicity we surface the result URL as textContent
      const d = data as { id?: string; result?: { sample?: string }; status?: string }
      return {
        imageData: null,
        imageMimeType: "image/jpeg",
        textContent: d.result?.sample ?? d.id ?? JSON.stringify(d),
      }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { detail?: string; message?: string }
      return { error: d.detail ?? d.message ?? `HTTP ${status}`, errorCode: status, errorStatus: "ERROR" }
    },
  },

  // ── Bytedance SeedDream (Volcengine Ark) ──────────────────────────────────
  bytedance: {
    buildUrl: () => "https://ark.cn-beijing.volces.com/api/v3/images/generations",
    buildHeaders: (apiKey) => ({ "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }),
    buildBody: (prompt, model, aspectRatio) => {
      const sizeMap: Record<string, string> = { "1:1": "1024x1024", "16:9": "1792x1024", "9:16": "1024x1792", "4:3": "1024x768" }
      return { model: model ?? "doubao-seedream-4.5", prompt, size: sizeMap[aspectRatio] ?? "1024x1024" }
    },
    extractImage: (data: unknown) => {
      const d = data as { data?: Array<{ url?: string; b64_json?: string }> }
      const item = d.data?.[0]
      return { imageData: item?.b64_json ?? null, imageMimeType: "image/png", textContent: item?.url ?? "" }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { error?: { message?: string } }
      return { error: d.error?.message ?? `HTTP ${status}`, errorCode: status, errorStatus: "ERROR" }
    },
  },

  // ── Recraft ───────────────────────────────────────────────────────────────
  recraft: {
    buildUrl: () => "https://external.api.recraft.ai/v1/images/generations",
    buildHeaders: (apiKey) => ({ "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }),
    buildBody: (prompt, model, aspectRatio) => {
      const sizeMap: Record<string, string> = { "1:1": "1024x1024", "16:9": "1820x1024", "9:16": "1024x1820", "4:3": "1365x1024" }
      return { model: model ?? "recraftv3", prompt, n: 1, size: sizeMap[aspectRatio] ?? "1024x1024" }
    },
    extractImage: (data: unknown) => {
      const d = data as { data?: Array<{ url?: string; b64_json?: string }> }
      const item = d.data?.[0]
      return { imageData: item?.b64_json ?? null, imageMimeType: "image/png", textContent: item?.url ?? "" }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { error?: { message?: string } }
      return { error: d.error?.message ?? `HTTP ${status}`, errorCode: status, errorStatus: "ERROR" }
    },
  },

  // ── Ideogram ─────────────────────────────────────────────────────────────
  ideogram: {
    buildUrl: () => "https://api.ideogram.ai/v1/ideogram-v3/generate",
    buildHeaders: (apiKey) => ({ "Api-Key": apiKey, "Content-Type": "application/json" }),
    buildBody: (prompt, model, aspectRatio) => {
      const arMap: Record<string, string> = { "1:1": "ASPECT_1_1", "16:9": "ASPECT_16_9", "9:16": "ASPECT_9_16", "4:3": "ASPECT_4_3" }
      return { image_request: { prompt, model: model ?? "V_3", aspect_ratio: arMap[aspectRatio] ?? "ASPECT_1_1" } }
    },
    extractImage: (data: unknown) => {
      const d = data as { data?: Array<{ url?: string }> }
      return { imageData: null, imageMimeType: "image/png", textContent: d.data?.[0]?.url ?? "" }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { error?: string; message?: string }
      return { error: d.error ?? d.message ?? `HTTP ${status}`, errorCode: status, errorStatus: "ERROR" }
    },
  },

  // ── Luma Photon ───────────────────────────────────────────────────────────
  luma: {
    buildUrl: () => "https://api.lumalabs.ai/dream-machine/v1/generations/image",
    buildHeaders: (apiKey) => ({ "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }),
    buildBody: (prompt, model, aspectRatio) => {
      const arMap: Record<string, string> = { "1:1": "1:1", "16:9": "16:9", "9:16": "9:16", "4:3": "4:3" }
      return { model: model ?? "photon-1", prompt, aspect_ratio: arMap[aspectRatio] ?? "1:1" }
    },
    extractImage: (data: unknown) => {
      const d = data as { assets?: { image?: string }; id?: string }
      return { imageData: null, imageMimeType: "image/jpeg", textContent: d.assets?.image ?? d.id ?? "" }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { detail?: Array<{ msg?: string }> | string; message?: string }
      const msg = Array.isArray(d.detail) ? d.detail[0]?.msg : (d.detail as string) ?? d.message
      return { error: msg ?? `HTTP ${status}`, errorCode: status, errorStatus: "ERROR" }
    },
  },

  // ── Tencent Hunyuan image ─────────────────────────────────────────────────
  hunyuan: {
    buildUrl: () => "https://api.hunyuan.cloud.tencent.com/v1/images/generations",
    buildHeaders: (apiKey) => ({ "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }),
    buildBody: (prompt, model, aspectRatio) => {
      const sizeMap: Record<string, string> = { "1:1": "1024x1024", "16:9": "1792x1024", "9:16": "1024x1792", "4:3": "1024x768" }
      return { model: model ?? "hunyuan-image-3.0-instruct", prompt, n: 1, size: sizeMap[aspectRatio] ?? "1024x1024" }
    },
    extractImage: (data: unknown) => {
      const d = data as { data?: Array<{ url?: string; b64_json?: string }> }
      const item = d.data?.[0]
      return { imageData: item?.b64_json ?? null, imageMimeType: "image/png", textContent: item?.url ?? "" }
    },
    extractError: (data: unknown, status: number) => {
      const d = data as { error?: { message?: string } }
      return { error: d.error?.message ?? `HTTP ${status}`, errorCode: status, errorStatus: "ERROR" }
    },
  },
}

// Alias: dahono uses openai-compatible image API

PROVIDER_CONFIGS.dahono = {
  ...PROVIDER_CONFIGS.openai,
  buildUrl: () => "https://gateway.dahono.com/v1/images/generations",
  buildHeaders: (apiKey) => ({ "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }),
}

// ── Main route ─────────────────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{ content: { parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> } }>
  error?: { code: number; message: string; status: string }
}

export async function POST(req: Request) {
  const {
    prompt,
    model,
    aspectRatio = "1:1",
    apiKey: bodyApiKey,
    providerId = "google",
  } = await req.json()

  const apiKey = bodyApiKey?.trim() || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
  if (!apiKey) {
    return Response.json({ error: "No API key provided. Enter your API key in the left panel." }, { status: 400 })
  }

  const config = PROVIDER_CONFIGS[providerId]
  if (!config) {
    return Response.json({ error: `Provider "${providerId}" does not support image generation.` }, { status: 400 })
  }

  const url = config.buildUrl(model)
  const headers = config.buildHeaders(apiKey)
  const body = config.buildBody(prompt, model, aspectRatio)

  const startTime = Date.now()

  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) })
    const duration = Date.now() - startTime

    // HuggingFace: may return raw image bytes
    if (providerId === "huggingface") {
      const contentType = res.headers.get("content-type") ?? ""
      if (contentType.startsWith("image/")) {
        const buf = await res.arrayBuffer()
        const base64 = Buffer.from(buf).toString("base64")
        return Response.json({ imageData: base64, imageMimeType: contentType, textContent: "", rawRequest: body, rawResponse: null, duration, model })
      }
    }

    const data = await res.json() as GeminiResponse

    if (!res.ok) {
      const { error: errMsg, errorCode, errorStatus } = config.extractError(data, res.status)
      return Response.json({ error: errMsg, errorCode, errorStatus, rawRequest: body, rawResponse: data, duration, model }, { status: res.status })
    }

    const { imageData, imageMimeType, textContent } = config.extractImage(data)

    // For providers that return URLs instead of base64 (Novita, Replicate)
    // we pass the URL as textContent and null imageData — client renders <img src>
    return Response.json({ imageData, imageMimeType, textContent, rawRequest: body, rawResponse: data, duration, model })

  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
