"use client"

// ── Model capability tags ─────────────────────────────────────────────────────

export type CapabilityTag = "coding" | "text" | "image" | "video" | "flagship"

// Flagship model substrings — if modelId contains any of these it gets the flagship badge
const FLAGSHIP_SUBSTRINGS = [
  "gpt-4o", "gpt-4.1", "gpt-4-turbo", "o1", "o3", "o4",
  "claude-3-5", "claude-3-7", "claude-opus", "claude-sonnet",
  "gemini-2.0-pro", "gemini-2.5-pro", "gemini-ultra",
  "llama-3.3", "llama-4", "llama-3.1-405",
  "deepseek-r1", "deepseek-v3",
  "grok-3", "grok-2",
  "qwen-max", "qwen2.5-72",
  "mistral-large", "mistral-medium", "pixtral-large",
  "command-r-plus",
  "yi-large", "yi-34b",
  "nova-pro", "nova-lite",
  "sonar-pro",
]

// Image-generation model substrings
const IMAGE_SUBSTRINGS = [
  "flux", "dall-e", "imagen", "sdxl", "stable-diffusion",
  "cogview", "seedream", "wan2", "hunyuan-image", "recraft",
  "ideogram", "photon", "aurora", "gpt-image",
  "image-01", "step-image", "image-gen",
]

// Video-generation model substrings
const VIDEO_SUBSTRINGS = [
  "veo", "video-01", "cogvideox", "wan2.7-t2v", "wan2.7-i2v", "hailuo",
  "video-gen", "kling", "sora", "runway",
]

// Coding-oriented model substrings
const CODING_SUBSTRINGS = [
  "code", "coder", "starcoder", "codestral", "deepseek-coder",
  "qwen-coder", "o1", "o3", "o4", "claude-3-5", "claude-3-7",
  "gpt-4o", "gpt-4.1", "claude-sonnet", "deepseek-r1",
  "gemini-2.5", "llama-3.1-405",
]

export function inferCapabilities(modelId: string): CapabilityTag[] {
  const id = modelId.toLowerCase()
  const tags: CapabilityTag[] = []

  const isImage = IMAGE_SUBSTRINGS.some((s) => id.includes(s))
  const isVideo = VIDEO_SUBSTRINGS.some((s) => id.includes(s))

  if (isImage) tags.push("image")
  if (isVideo) tags.push("video")

  // Only tag as text/coding if not image/video only
  if (!isImage && !isVideo) {
    tags.push("text")
    if (CODING_SUBSTRINGS.some((s) => id.includes(s))) tags.push("coding")
  }

  if (FLAGSHIP_SUBSTRINGS.some((s) => id.includes(s))) tags.push("flagship")

  return tags
}

// ── Screener result store (localStorage) ─────────────────────────────────────

export interface ScreenerModelResult {
  /** Composite key: "{providerId}::{modelId}::{maskedKey}" */
  id: string
  providerId: string
  providerName: string
  modelId: string
  apiKeyMasked: string
  /** true = responded OK in latest probe */
  isOn: boolean
  latencyMs: number | null
  /** ISO string of last probe */
  lastCheckedAt: string
  /** Error message if off */
  error?: string
  /** Inferred capability tags */
  tags: CapabilityTag[]
  /** Next scheduled auto-refresh (ISO string) */
  nextRefreshAt: string
}

const SCREENER_STORAGE_KEY = "ai_tester_screener_v1"
const SCREENER_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 h

export function loadScreenerResults(): ScreenerModelResult[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SCREENER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ScreenerModelResult[]) : []
  } catch { return [] }
}

export function saveScreenerResults(results: ScreenerModelResult[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SCREENER_STORAGE_KEY, JSON.stringify(results))
  } catch {}
}

export function mergeScreenerResult(incoming: ScreenerModelResult): void {
  const existing = loadScreenerResults()
  const idx = existing.findIndex((r) => r.id === incoming.id)
  if (idx >= 0) existing[idx] = incoming
  else existing.push(incoming)
  saveScreenerResults(existing)
}

export function clearScreenerResults(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(SCREENER_STORAGE_KEY)
}

/** Returns items whose nextRefreshAt is in the past (needs re-probe) */
export function getDueForRefresh(results: ScreenerModelResult[]): ScreenerModelResult[] {
  const now = Date.now()
  return results.filter((r) => new Date(r.nextRefreshAt).getTime() <= now)
}

/** Build next refresh time */
export function nextRefreshIso(from = Date.now()): string {
  return new Date(from + SCREENER_INTERVAL_MS).toISOString()
}

/**
 * Mask an API key the same way the screener does when storing results.
 * Format: first-6-chars + "••••••" + last-4-chars
 * Used to match WorkingKeyRecord.apiKey against ScreenerModelResult.apiKeyMasked.
 */
export function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return "••••••••"
  return key.slice(0, 6) + "••••••" + key.slice(-4)
}
