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
  google: {
    image: [
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
    video: [],
  },

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

  novita: {
    image: [
      {
        id: "black-forest-labs/FLUX.1-schnell",
        label: "FLUX.1 Schnell",
        tag: "FLUX",
        description: "Fast high-quality generation via Novita",
      },
      {
        id: "dreamshaper_8",
        label: "DreamShaper 8",
        tag: "SDXL",
        description: "Artistic and creative image synthesis",
      },
      {
        id: "realvisxl-v4.0",
        label: "RealVisXL v4",
        tag: "SDXL",
        description: "Photorealistic image generation",
      },
    ],
    video: [],
  },

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
