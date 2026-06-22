// Defines what each provider supports for Image and Video generation.
// Providers not listed here (or with empty arrays) do not support that modality.

export interface ImageModel {
  id: string
  label: string
  tag: string
  description: string
}

export interface VideoModel {
  id: string
  label: string
  badge: string
}

export interface ProviderCapabilities {
  image: ImageModel[]
  video: VideoModel[]
  videoAspectRatios?: string[]
}

export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  // ── Google ────────────────────────────────────────────────────────────────
  google: {
    image: [
      {
        id: "imagen-4.0-generate-001",
        label: "Imagen 4",
        tag: "Imagen 4",
        description: "Google's best photorealistic image generation model",
      },
      {
        id: "gemini-2.0-flash-preview-image-generation",
        label: "Gemini 2.0 Flash",
        tag: "Image Gen",
        description: "Fast creative workflows, native image generation & editing",
      },
      {
        id: "imagen-3.0-generate-002",
        label: "Imagen 3",
        tag: "Imagen 3",
        description: "High-quality photorealistic images with natural language",
      },
    ],
    video: [
      { id: "veo-3.1-generate-preview", label: "Veo 3.1 (Latest)", badge: "NEW" },
      { id: "veo-3.1-lite-generate-preview", label: "Veo 3.1 Lite", badge: "FAST" },
      { id: "veo-2.0-generate-001", label: "Veo 2.0", badge: "STABLE" },
    ],
    videoAspectRatios: ["16:9", "9:16"],
  },

  // ── OpenAI ────────────────────────────────────────────────────────────────
  openai: {
    image: [
      {
        id: "gpt-image-1",
        label: "GPT Image 1",
        tag: "gpt-image-1",
        description: "OpenAI's latest image generation model with high accuracy",
      },
      {
        id: "dall-e-3",
        label: "DALL-E 3",
        tag: "dall-e-3",
        description: "High-quality detailed images with prompt adherence",
      },
      {
        id: "dall-e-2",
        label: "DALL-E 2",
        tag: "dall-e-2",
        description: "Fast and cost-effective image generation",
      },
    ],
    video: [],
  },

  // ── Together AI ───────────────────────────────────────────────────────────
  together: {
    image: [
      {
        id: "black-forest-labs/FLUX.1.1-pro",
        label: "FLUX.1.1 Pro",
        tag: "FLUX",
        description: "Highest quality FLUX model, state-of-the-art photorealism",
      },
      {
        id: "black-forest-labs/FLUX.1-schnell",
        label: "FLUX.1 Schnell",
        tag: "FLUX FAST",
        description: "Fastest FLUX model, great for real-time generation",
      },
      {
        id: "stabilityai/stable-diffusion-xl-base-1.0",
        label: "Stable Diffusion XL",
        tag: "SDXL",
        description: "High-resolution creative image synthesis",
      },
    ],
    video: [
      { id: "Wan-AI/wan2.7-t2v", label: "Wan 2.7 T2V", badge: "NEW" },
      { id: "Wan-AI/wan2.7-i2v", label: "Wan 2.7 I2V", badge: "NEW" },
    ],
    videoAspectRatios: ["16:9", "9:16"],
  },

  // ── Fireworks AI ──────────────────────────────────────────────────────────
  fireworks: {
    image: [
      {
        id: "accounts/fireworks/models/flux-1-schnell-fp8",
        label: "FLUX.1 Schnell FP8",
        tag: "FLUX FAST",
        description: "Ultra-fast 4-step FLUX generation, optimized for speed",
      },
      {
        id: "accounts/fireworks/models/flux-1-dev-fp8",
        label: "FLUX.1 Dev FP8",
        tag: "FLUX",
        description: "High-quality FLUX development model",
      },
      {
        id: "accounts/fireworks/models/playground-v2-5-1024px-aesthetic",
        label: "Playground v2.5",
        tag: "PLAYGROUND",
        description: "Aesthetic-focused, excellent for art and illustrations",
      },
    ],
    video: [],
  },

  // ── Novita AI ─────────────────────────────────────────────────────────────
  novita: {
    image: [
      {
        id: "seedream-5-0-lite",
        label: "Seedream 5.0 Lite",
        tag: "NEW",
        description: "Latest Seedream model — fast, high-quality text-to-image",
      },
      {
        id: "seedream-4-5",
        label: "Seedream 4.5",
        tag: "Seedream",
        description: "High-quality Seedream generation",
      },
      {
        id: "seedream-4-0",
        label: "Seedream 4.0",
        tag: "Seedream",
        description: "Seedream 4.0 text-to-image",
      },
      {
        id: "flux-2-dev",
        label: "FLUX.2 Dev",
        tag: "FLUX",
        description: "Fast studio-quality generation from BFL via Novita",
      },
      {
        id: "flux-1-kontext-pro",
        label: "FLUX.1 Kontext Pro",
        tag: "FLUX",
        description: "FLUX Kontext Pro — native editing and generation",
      },
      {
        id: "flux-2-pro",
        label: "FLUX.2 Pro",
        tag: "FLUX",
        description: "FLUX.2 Pro — premium quality via Novita",
      },
    ],
    video: [],
  },

  // ── HuggingFace ───────────────────────────────────────────────────────────
  huggingface: {
    image: [
      {
        id: "black-forest-labs/FLUX.1-schnell",
        label: "FLUX.1 Schnell",
        tag: "FLUX",
        description: "State-of-the-art image generation via HuggingFace",
      },
      {
        id: "stabilityai/stable-diffusion-xl-base-1.0",
        label: "Stable Diffusion XL",
        tag: "SDXL",
        description: "Versatile high-resolution image generation",
      },
      {
        id: "stabilityai/stable-diffusion-2-1",
        label: "Stable Diffusion 2.1",
        tag: "SD 2.1",
        description: "Reliable general-purpose image synthesis",
      },
    ],
    video: [],
  },

  // ── Replicate ─────────────────────────────────────────────────────────────
  replicate: {
    image: [
      {
        id: "black-forest-labs/flux-1.1-pro",
        label: "FLUX.1.1 Pro",
        tag: "FLUX PRO",
        description: "Professional-grade image generation via Replicate",
      },
      {
        id: "black-forest-labs/flux-schnell",
        label: "FLUX Schnell",
        tag: "FLUX FAST",
        description: "4-step fast generation",
      },
      {
        id: "stability-ai/sdxl",
        label: "Stable Diffusion XL",
        tag: "SDXL",
        description: "High-resolution creative images",
      },
    ],
    video: [],
  },

  // ── MiniMax ───────────────────────────────────────────────────────────────
  minimax: {
    image: [
      {
        id: "image-01",
        label: "Hailuo Image 01",
        tag: "MiniMax",
        description: "MiniMax photorealistic image generation",
      },
    ],
    video: [
      { id: "video-01-live2", label: "Hailuo Video 01 Live", badge: "LIVE" },
      { id: "video-01", label: "Hailuo Video 01", badge: "STABLE" },
    ],
    videoAspectRatios: ["16:9", "9:16"],
  },

  // ── xAI Aurora ───────────────────────────────────────────────────────────
  xai: {
    image: [
      {
        id: "grok-imagine-image-quality",
        label: "Aurora (Quality)",
        tag: "Aurora",
        description: "xAI Aurora high-quality image generation",
      },
      {
        id: "grok-imagine-image-fast",
        label: "Aurora (Fast)",
        tag: "Aurora Fast",
        description: "xAI Aurora fast image generation",
      },
    ],
    video: [],
  },

  // ── Zhipu CogView / CogVideoX ─────────────────────────────────────────────
  zhipu: {
    image: [
      {
        id: "cogview-4",
        label: "CogView-4",
        tag: "CogView",
        description: "Zhipu AI high-quality image generation",
      },
      {
        id: "cogview-4-250304",
        label: "CogView-4 Enhanced",
        tag: "CogView Pro",
        description: "Enhanced CogView-4 with richer detail",
      },
    ],
    video: [
      { id: "cogvideox-2", label: "CogVideoX-2", badge: "NEW" },
      { id: "cogvideox", label: "CogVideoX", badge: "STABLE" },
    ],
    videoAspectRatios: ["16:9", "9:16"],
  },

  // ── Qwen / Wanx (Alibaba DashScope) ───────────────────────────────────────
  qwen: {
    image: [
      {
        id: "qwen-image-2512",
        label: "Qwen Image 2512",
        tag: "Qwen Image",
        description: "Qwen's latest highest-quality image generation model",
      },
      {
        id: "wan2.7-image-pro",
        label: "Wan 2.7 Pro",
        tag: "Wanx",
        description: "Professional-grade Wan 2.7 text-to-image",
      },
      {
        id: "wan2.7-image",
        label: "Wan 2.7",
        tag: "Wanx",
        description: "Wan 2.7 high-quality text-to-image",
      },
      {
        id: "wan2.5-t2i-preview",
        label: "Wan 2.5 T2I",
        tag: "Wanx",
        description: "Wan 2.5 fast text-to-image preview",
      },
    ],
    video: [],
  },

  // ── Stepfun ───────────────────────────────────────────────────────────────
  stepfun: {
    image: [
      {
        id: "step-image-edit-2",
        label: "Step Image Edit 2",
        tag: "Stepfun",
        description: "Stepfun high-quality image generation and editing",
      },
    ],
    video: [],
  },

  // ── Tencent Hunyuan ────────────────────────────────────────────────────────
  hunyuan: {
    image: [
      {
        id: "hunyuan-image-3.0-instruct",
        label: "Hunyuan Image 3.0",
        tag: "Hunyuan",
        description: "Tencent Hunyuan latest photorealistic image generation",
      },
      {
        id: "hunyuan-image",
        label: "Hunyuan Image",
        tag: "Hunyuan",
        description: "Tencent Hunyuan text-to-image generation",
      },
    ],
    video: [],
  },

  // ── Black Forest Labs (FLUX native API) ───────────────────────────────────
  bfl: {
    image: [
      {
        id: "flux-2-pro",
        label: "FLUX 2 Pro",
        tag: "FLUX 2",
        description: "Black Forest Labs newest top-tier FLUX model",
      },
      {
        id: "flux-2-dev",
        label: "FLUX 2 Dev",
        tag: "FLUX 2",
        description: "FLUX 2 development model for open use",
      },
      {
        id: "flux-1.1-pro",
        label: "FLUX 1.1 Pro",
        tag: "FLUX 1.1",
        description: "State-of-the-art photorealism with superior detail",
      },
      {
        id: "flux-1-kontext-pro",
        label: "FLUX Kontext Pro",
        tag: "FLUX EDIT",
        description: "Context-aware image editing and generation",
      },
    ],
    video: [],
  },

  // ── Bytedance (SeedDream) ─────────────────────────────────────────────────
  bytedance: {
    image: [
      {
        id: "seedream-4.5",
        label: "SeedDream 4.5",
        tag: "SeedDream",
        description: "Bytedance's latest flagship image generation model",
      },
      {
        id: "seedream-5.0-lite",
        label: "SeedDream 5.0 Lite",
        tag: "SeedDream",
        description: "Fast lightweight SeedDream generation",
      },
      {
        id: "seedream-3",
        label: "SeedDream 3",
        tag: "SeedDream",
        description: "High-quality creative image synthesis",
      },
    ],
    video: [],
  },

  // ── Recraft ───────────────────────────────────────────────────────────────
  recraft: {
    image: [
      {
        id: "recraftv3",
        label: "Recraft V4",
        tag: "Recraft",
        description: "Recraft's state-of-the-art design-focused image generation",
      },
      {
        id: "recraft20b",
        label: "Recraft V3",
        tag: "Recraft",
        description: "High-quality vector-style and raster image generation",
      },
    ],
    video: [],
  },

  // ── Ideogram ─────────────────────────────────────────────────────────────
  ideogram: {
    image: [
      {
        id: "V_3",
        label: "Ideogram V3 Quality",
        tag: "Ideogram",
        description: "Ideogram's best model with excellent text rendering",
      },
      {
        id: "V_3_TURBO",
        label: "Ideogram V3 Turbo",
        tag: "Ideogram Fast",
        description: "Fast Ideogram V3 generation",
      },
    ],
    video: [],
  },

  // ── Luma (Photon) ─────────────────────────────────────────────────────────
  luma: {
    image: [
      {
        id: "photon-1",
        label: "Photon 1",
        tag: "Luma",
        description: "Luma Photon high-quality image generation",
      },
      {
        id: "photon-flash-1",
        label: "Photon Flash",
        tag: "Luma Fast",
        description: "Fast Luma Photon image generation",
      },
    ],
    video: [],
  },

}

// Providers that support image generation
export function getImageCapabilities(providerId: string): ImageModel[] {
  return PROVIDER_CAPABILITIES[providerId]?.image ?? []
}

// Providers that support video generation
export function getVideoCapabilities(providerId: string): { models: VideoModel[]; aspectRatios: string[] } {
  const cap = PROVIDER_CAPABILITIES[providerId]
  return {
    models: cap?.video ?? [],
    aspectRatios: cap?.videoAspectRatios ?? ["16:9", "9:16"],
  }
}

export const IMAGE_ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3"]
