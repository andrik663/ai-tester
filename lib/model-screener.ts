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
// Source: Arena AI Code Leaderboard (arena.ai/leaderboard/code) — 101 models, Jul 2026
// + cross-referenced against every provider model in lib/providers.ts.
// Any model whose lowercased ID includes one of these strings gets the "coding" tag.
const CODING_SUBSTRINGS = [

  // ── Anthropic ─────────────────────────────────────────────────────────────
  // All Claude 3.x and 4.x variants are strong coders (Arena top-10 confirmed)
  "claude-3-5", "claude-3-7",        // claude-3-5-*, claude-3-7-*
  "claude-opus",                      // claude-opus-4-5/4-6/4-7/4-8 + 3-opus
  "claude-sonnet",                    // claude-sonnet-4-5/4-6 + 3-5-sonnet
  "claude-fable",                     // #2 Arena Code
  "claude-haiku",                     // claude-haiku-4-5 (capable coder)

  // ── OpenAI ────────────────────────────────────────────────────────────────
  "codex",                            // codex-mini-latest, gpt-5.x-codex, codex-harness
  "gpt-4",                            // gpt-4, gpt-4-turbo, gpt-4.1, gpt-4o, gpt-4.5
  "gpt-5",                            // gpt-5, gpt-5.1 through gpt-5.6 all variants
  "o1", "o3", "o4",                   // OpenAI reasoning series
  "chatgpt-4o",                       // chatgpt-4o-latest

  // ── Google ────────────────────────────────────────────────────────────────
  "gemini-2.0",                       // gemini-2.0-flash
  "gemini-2.5",                       // gemini-2.5-flash/pro  (#Arena top)
  "gemini-3",                         // gemini-3-flash/pro, gemini-3.0/3.1/3.5/3.6
  // Note: gemma is excluded — small base models, not coding-optimised

  // ── xAI ───────────────────────────────────────────────────────────────────
  "grok-3",                           // grok-3, grok-3-fast, grok-3-mini
  "grok-4",                           // grok-4, grok-4.3, grok-4.20 (#7 Arena Code)

  // ── DeepSeek ──────────────────────────────────────────────────────────────
  "deepseek-r1",                      // deepseek-r1, deepseek-r1-distill-*
  "deepseek-reasoner",                // deepseek-reasoner
  "deepseek-coder",                   // deepseek-coder, deepseek-coder-v2
  "deepseek-v3",                      // deepseek-v3, deepseek-v3.2, deepseek-v3-2-volc
  "deepseek-v4",                      // deepseek-v4-flash, deepseek-v4-pro
  "deepseek-chat",                    // deepseek-chat (V2/V3 backed)

  // ── Z.ai / GLM ────────────────────────────────────────────────────────────
  "glm-4.7",                          // glm-4.7
  "glm-5",                            // glm-5.0/5.1/5.2 and sub-variants
  "glm-z1",                           // glm-z1-air/airx/flash/plus (reasoning models)

  // ── Kimi / Moonshot ───────────────────────────────────────────────────────
  "kimi-k2",                          // kimi-k2.5/k2.6/k2.7/k2.7-code
  "kimi-k3",                          // #1 Arena Code

  // ── HunyuanHY3 / Tencent ─────────────────────────────────────────────────
  "hy3",                              // hy3, hy3-preview, hunyuan-hy3 (#16 Arena Code)

  // ── Muse Spark ────────────────────────────────────────────────────────────
  "muse-spark",                       // muse-spark-1.1 (#11 Arena Code)

  // ── Qwen / Alibaba ────────────────────────────────────────────────────────
  "qwen-coder", "qwen2.5-coder", "qwen3-coder",  // explicit coder variants
  "qwen2.5-72",                       // qwen2.5-72b-instruct (general but strong)
  "qwen3-235",                        // qwen3-235b-a22b (MoE flagship)
  "qwen3-30",                         // qwen3-30b-a3b

  // ── Mistral ───────────────────────────────────────────────────────────────
  "codestral",                        // codestral, codestral-latest
  "mistral-large", "mistral-medium",  // strong coding-capable Mistral models
  "starcoder",                        // StarCoder family

  // ── Meta / Llama ──────────────────────────────────────────────────────────
  "llama-3.1-405",                    // Meta-Llama-3.1-405B
  "llama-3.3",                        // llama-3.3-70b
  "llama-4",                          // llama-4-maverick, llama-4-scout

  // ── Inception / Mercury Coder ─────────────────────────────────────────────
  "mercury-coder",                    // mercury-coder, mercury-coder-small

  // ── ByteDance Seed ────────────────────────────────────────────────────────
  "seed-2.1-pro",                     // seed-2.1-pro-preview (#15 Arena Code)

  // ── Fugu (special frontier models) ───────────────────────────────────────
  "fugu",                             // fugu-20260615, fugu-ultra-20260615

  // ── Cohere ────────────────────────────────────────────────────────────────
  "command-r",                        // command-r, command-r-plus, command-r7b
  "command-a-plus",                   // command-a-plus-05-2026

  // ── Generic substrings (catch-all for any provider) ──────────────────────
  "code", "coder",                    // any model with "code"/"coder" in name
  "cogito",                           // deepcogito/cogito-v2-1-671b

  // ── Dahono gateway models (specific to that provider's catalogue) ─────────
  "laguna-xs",                        // dahono/laguna-xs-2.1
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
