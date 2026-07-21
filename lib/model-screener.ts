"use client"

// ── Model capability tags ─────────────────────────────────────────────────────

export type CapabilityTag = "coding" | "text" | "image" | "video" | "flagship" | "agent" | "document"

// Flagship model substrings — if modelId contains any of these it gets the flagship badge
const FLAGSHIP_SUBSTRINGS = [
  // OpenAI
  "gpt-4o", "gpt-4.1", "gpt-4-turbo", "gpt-5", "o1", "o3", "o4",
  // Anthropic
  "claude-3-5", "claude-3-7", "claude-opus", "claude-sonnet", "claude-fable",
  // Google
  "gemini-2.0-pro", "gemini-2.5-pro", "gemini-3-pro", "gemini-3.5", "gemini-3.6", "gemini-ultra",
  // Meta / Llama
  "llama-3.3", "llama-4", "llama-3.1-405",
  // DeepSeek
  "deepseek-r1", "deepseek-v3", "deepseek-v4",
  // xAI Grok
  "grok-3", "grok-4", "grok-2",
  // Qwen / Alibaba
  "qwen-max", "qwen2.5-72", "qwen3-coder",
  // Mistral
  "mistral-large", "mistral-medium", "pixtral-large",
  // Cohere
  "command-r-plus",
  // Yi
  "yi-large", "yi-34b",
  // Amazon
  "nova-pro", "nova-lite",
  // Perplexity
  "sonar-pro",
  // Arena Code top models (Z.ai GLM, Kimi, Muse Spark, HY3)
  "glm-5.2", "glm-5.1", "kimi-k3", "muse-spark", "hy3",
  // ByteDance Seed
  "seed-2.1-pro",
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
// Source: Arena AI Code Leaderboard (arena.ai/leaderboard/code) — 101 models, updated Jul 21 2026
// Criteria: any model whose ID matches these substrings ranks in the Code arena.
const CODING_SUBSTRINGS = [
  // ── Exact/prefix matches from top-ranked Code arena models ────────────────
  // #1  kimi-k3                (Moonshot)
  "kimi-k3",
  // #2  claude-fable-5         (Anthropic)
  "claude-fable",
  // #3  gpt-5.6-sol-xhigh / gpt-5.x codex-harness variants
  "gpt-5.6", "codex-harness", "sol-xhigh",
  // #4  glm-5.2 (max)          (Z.ai)
  "glm-5.2",
  // #5  claude-opus-4-8-thinking
  // #6  claude-opus-4-7-thinking
  // #8  claude-opus-4-7
  // #10 claude-opus-4-6-thinking
  // #13 claude-opus-4-6
  // #14 claude-opus-4-8
  "claude-opus-4",
  // #7  grok-4.5               (xAI)
  "grok-4",
  // #9  claude-sonnet-5-high
  "claude-sonnet-5",
  // #11 muse-spark-1.1         (Meta)
  "muse-spark",
  // #12 gemini-3.6-flash
  "gemini-3.6",
  // #15 seed-2.1-pro-preview   (ByteDance)
  "seed-2.1-pro",
  // #16 hy3                    (Tencent)
  "hy3",
  // #17 glm-5.1
  "glm-5.1",
  // ── Broader family matches that appear throughout the Code leaderboard ────
  // Claude 3.x / 4.x coding-capable families
  "claude-3-5", "claude-3-7", "claude-sonnet",
  // GPT coding families
  "gpt-4o", "gpt-4.1", "gpt-5.4", "gpt-5.5",
  // Codex / code-specific suffixes (CEOWeb3 GPT-5 codex series + OpenAI)
  "codex",
  // DeepSeek coding families
  "deepseek-r1", "deepseek-v3", "deepseek-coder", "deepseek-v4",
  // Qwen coding families
  "qwen-coder", "qwen3-coder", "qwen2.5-coder",
  // StarCoder / Codestral
  "starcoder", "codestral",
  // Generic "code" / "coder" in model name
  "code", "coder",
  // Gemini coding-capable
  "gemini-2.5", "gemini-3-pro", "gemini-3.5",
  // Llama large coding
  "llama-3.1-405", "llama-3.3",
  // Kimi coding family
  "kimi-k2",
  // GLM general coding family
  "glm-5", "glm-4.7",
  // o1 / o3 / o4 reasoning-coding OpenAI
  "o1", "o3", "o4",
]

// Agentic / tool-use model substrings
const AGENT_SUBSTRINGS = [
  "agent", "tool", "function", "browse", "computer-use", "operator",
  "claude-opus", "claude-sonnet", "gpt-4o", "gpt-4.1",
  "llama-3.3", "llama-4", "mistral-large",
  "command-r", "qwen-max", "deepseek-r1",
  "kimi-k2", "kimi-k3",
  "glm-5", "glm-4",
  "grok-3",
]

// Document / long-context model substrings
const DOCUMENT_SUBSTRINGS = [
  "doc", "pdf", "ocr", "vision", "vl", "vlm", "multimodal",
  "gemini", "claude", "pixtral", "minicpm-v", "internvl",
  "qwen-vl", "qwen2-vl", "llava", "yi-vl",
  // CEOWeb3 vision models
  "glm-5v", "kimi", "minimax", "muse", "hy3",
]

/**
 * Infer capability tags for a model based on its id string.
 *
 * Uses substring matching against curated lists:
 *   - `IMAGE_SUBSTRINGS`    → `"image"` tag
 *   - `VIDEO_SUBSTRINGS`    → `"video"` tag
 *   - `CODING_SUBSTRINGS`   → `"coding"` tag (only for non-image/video models)
 *   - `AGENT_SUBSTRINGS`    → `"agent"` tag (only for non-image/video models)
 *   - `DOCUMENT_SUBSTRINGS` → `"document"` tag (only for non-image/video models)
 *   - `FLAGSHIP_SUBSTRINGS` → `"flagship"` tag (applied regardless of other tags)
 *   - All non-image/video models also receive the baseline `"text"` tag.
 *
 * Matching is case-insensitive (modelId is lower-cased before comparison).
 *
 * @param modelId - Provider model identifier, e.g. `"gpt-4o"` or `"dall-e-3"`.
 * @returns Array of {@link CapabilityTag} strings (may be empty for unknown models).
 *
 * @example
 * inferCapabilities("gpt-4o")       // → ["text", "coding", "agent", "document", "flagship"]
 * inferCapabilities("dall-e-3")     // → ["image", "flagship"]
 * inferCapabilities("cogvideox-5b") // → ["video"]
 */
export function inferCapabilities(modelId: string): CapabilityTag[] {
  const id = modelId.toLowerCase()
  const tags: CapabilityTag[] = []

  const isImage = IMAGE_SUBSTRINGS.some((s) => id.includes(s))
  const isVideo = VIDEO_SUBSTRINGS.some((s) => id.includes(s))

  if (isImage) tags.push("image")
  if (isVideo) tags.push("video")

  // Only tag as text/coding/agent/document if not image/video only
  if (!isImage && !isVideo) {
    tags.push("text")
    if (CODING_SUBSTRINGS.some((s) => id.includes(s))) tags.push("coding")
    if (AGENT_SUBSTRINGS.some((s) => id.includes(s)))  tags.push("agent")
    if (DOCUMENT_SUBSTRINGS.some((s) => id.includes(s))) tags.push("document")
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

/**
 * Load all screener probe results from localStorage.
 *
 * Returns `[]` when called server-side or when storage is empty/corrupt.
 *
 * @returns Array of `ScreenerModelResult` objects, or `[]`.
 */
export function loadScreenerResults(): ScreenerModelResult[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SCREENER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ScreenerModelResult[]) : []
  } catch { return [] }
}

/**
 * Persist the full screener results array to localStorage.
 * Silently no-ops server-side and on quota errors.
 *
 * @param results - The complete result set to persist.
 */
export function saveScreenerResults(results: ScreenerModelResult[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SCREENER_STORAGE_KEY, JSON.stringify(results))
  } catch {}
}

/**
 * Upsert a single screener result into the persisted list.
 *
 * If a result with the same `id` already exists it is replaced in-place;
 * otherwise the new result is appended. The updated list is immediately
 * saved back to localStorage.
 *
 * @param incoming - The new or updated `ScreenerModelResult` to merge in.
 */
export function mergeScreenerResult(incoming: ScreenerModelResult): void {
  const existing = loadScreenerResults()
  const idx = existing.findIndex((r) => r.id === incoming.id)
  if (idx >= 0) existing[idx] = incoming
  else existing.push(incoming)
  saveScreenerResults(existing)
}

/**
 * Remove all screener results from localStorage.
 * Safe to call server-side (no-op).
 */
export function clearScreenerResults(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(SCREENER_STORAGE_KEY)
}

/**
 * Filter a results list to only those that are due for re-probing.
 *
 * A result is considered "due" when its `nextRefreshAt` ISO timestamp is in
 * the past. The screener interval is `SCREENER_INTERVAL_MS` (24 hours).
 *
 * @param results - Full list of `ScreenerModelResult` objects to inspect.
 * @returns The subset whose `nextRefreshAt` has elapsed.
 */
export function getDueForRefresh(results: ScreenerModelResult[]): ScreenerModelResult[] {
  const now = Date.now()
  return results.filter((r) => new Date(r.nextRefreshAt).getTime() <= now)
}

/**
 * Compute the ISO timestamp for the next automatic refresh.
 *
 * Adds `SCREENER_INTERVAL_MS` (24 h) to the given base time. This value is
 * stored in `ScreenerModelResult.nextRefreshAt` after each successful probe.
 *
 * @param from - Base epoch-ms timestamp (defaults to `Date.now()`).
 * @returns ISO 8601 string representing the next refresh time.
 */
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
