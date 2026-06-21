import { NextRequest, NextResponse } from "next/server"

// ── Shared types (exported so the component can import them) ──────────────────

export interface BatchModelResult {
  modelId: string
  ok: boolean
  status: number
  latencyMs: number
  reply?: string
  errorMsg?: string
  tokenUsage?: { prompt?: number; completion?: number; total?: number }
  curlFull: string
}

export interface BatchTestResponse {
  provider: string
  total: number
  passed: number
  failed: number
  results: BatchModelResult[]
  durationMs: number
}

// ── Per-provider model list + endpoint config ─────────────────────────────────
// Each entry describes how to build a request for that provider.

export interface ProviderConfig {
  id: string
  /** List of model IDs to test */
  models: string[]
  /** OpenAI-compatible endpoint */
  endpoint: string
  /** How to build the Authorization / API-key header */
  authHeader: (key: string) => Record<string, string>
  /** Extra static headers */
  extraHeaders?: Record<string, string>
  /** How to build the request body (JSON-serialisable) */
  buildBody: (modelId: string) => Record<string, unknown>
  /** Where to find the assistant text in the response */
  extractReply?: (parsed: Record<string, unknown>) => string | undefined
  /** Whether to append ?key=... to the URL instead of using a header */
  keyInUrl?: boolean
  /** Max concurrent requests for rate-limited providers */
  concurrencyLimit?: number
}

const TEST_PROMPT       = "halo"
const MAX_TOKENS        = 64
const DEFAULT_TIMEOUT_MS = 8_000   // per-model timeout — reduced from 20s to prevent hangs

// Standard OpenAI-style reply extractor
function openaiReply(p: Record<string, unknown>): string | undefined {
  try {
    const choices = p.choices as Record<string, unknown>[]
    return (choices[0]?.message as Record<string, unknown>)?.content as string
  } catch { return undefined }
}

// Anthropic reply extractor
function anthropicReply(p: Record<string, unknown>): string | undefined {
  try {
    const content = p.content as Record<string, unknown>[]
    return content[0]?.text as string
  } catch { return undefined }
}

// Google Gemini reply extractor
function geminiReply(p: Record<string, unknown>): string | undefined {
  try {
    const candidates = p.candidates as Record<string, unknown>[]
    const content = candidates[0]?.content as Record<string, unknown>
    const parts = content?.parts as Record<string, unknown>[]
    return parts[0]?.text as string
  } catch { return undefined }
}

// Token usage extractor (standard OpenAI)
function extractTokenUsage(p: Record<string, unknown>): BatchModelResult["tokenUsage"] {
  if (!p.usage || typeof p.usage !== "object") return undefined
  const u = p.usage as Record<string, unknown>
  return {
    prompt:     typeof u.prompt_tokens     === "number" ? u.prompt_tokens     :
                typeof u.input_tokens      === "number" ? u.input_tokens      : undefined,
    completion: typeof u.completion_tokens === "number" ? u.completion_tokens :
                typeof u.output_tokens     === "number" ? u.output_tokens     : undefined,
    total:      typeof u.total_tokens      === "number" ? u.total_tokens      : undefined,
  }
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  // ── Anthropic ─────────────────────────────────────────────────────────────
  anthropic: {
    id: "anthropic",
    models: [
      // Claude 4 — confirmed dated snapshot IDs (from Anthropic docs)
      "claude-opus-4-5",
      "claude-opus-4-5-20251101",
      "claude-sonnet-4-5",
      "claude-sonnet-4-5-20251022",
      "claude-haiku-4-5",
      "claude-haiku-4-5-20251022",
      // Claude 3.x — still widely supported
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307",
    ],
    endpoint: "https://api.anthropic.com/v1/messages",
    authHeader: (key) => ({ "x-api-key": key }),
    extraHeaders: { "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: anthropicReply,
  },

  // ── OpenAI ────────────────────────────────────────────────────────────────
  openai: {
    id: "openai",
    models: [
      // ── Active models ──────────────────────────────────────
      "gpt-5.3-codex",      // Most capable agentic coding model
      "gpt-5.2",            // Previous frontier for professional work
      "gpt-5.2-pro",        // Previous pro model
      "gpt-5.1",            // Best for coding & agentic tasks
      "gpt-5",              // Previous intelligent reasoning model
      "gpt-5-mini",         // Near-frontier, low latency, high volume
      "gpt-5-nano",         // Fastest, most cost-efficient
      "gpt-5-pro",          // Smarter and more precise responses
      "o3-pro",             // o3 with more compute
      "o3",                 // Reasoning model for complex tasks
      "gpt-4.1",            // Smartest non-reasoning model
      "gpt-4.1-mini",       // Smaller, faster version of GPT-4.1
      // ── Deprecated (still callable) ──────────────────────
      "gpt-5.3-chat",
      "gpt-5.2-chat",
      "gpt-5.2-codex",
      "gpt-5.1-codex",
      "gpt-5.1-codex-max",
      "gpt-5.1-codex-mini",
      "gpt-5.1-chat",
      "gpt-5-codex",
      "gpt-5-chat",
      "gpt-4.1-nano",
      "o4-mini",
      "o4-mini-deep-research",
      "o3-deep-research",
      "o3-mini",
      "o1-pro",
      "o1",
      "o1-mini",
      "o1-preview",
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4o-mini-search-preview",
      "gpt-4o-search-preview",
      "gpt-4.5-preview",
      "gpt-4-turbo",
      "gpt-4-turbo-preview",
      "gpt-4",
      "gpt-3.5-turbo",
      "chatgpt-4o-latest",
      "codex-mini-latest",
      "computer-use-preview",
      "babbage-002",
      "davinci-002",
      "omni-moderation-latest",
      "text-moderation-latest",
    ],
    // OpenAI Responses API (replaces /v1/chat/completions for GPT-5+)
    endpoint: "https://api.openai.com/v1/responses",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      input: TEST_PROMPT,
    }),
    extractReply: (p) => {
      try {
        // Responses API: output[].content[].text
        const output = p.output as Array<{ content?: Array<{ type: string; text: string }> }>
        return output?.[0]?.content?.find((c) => c.type === "output_text")?.text
      } catch { return undefined }
    },
  },

  // ── Google Gemini ────────────────────────────────────────────────���������────────
  google: {
    id: "google",
    // concurrencyLimit 2 — Gemini free-tier rate-limits aggressively
    concurrencyLimit: 2,
    models: [
      // ── Gemini 3.x (latest, 2026) ─────────────────────────
      "gemini-3.5-flash",           // Stable — frontier-class, cost-efficient
      "gemini-3-flash",             // Stable — high performance, lower cost
      "gemini-3.1-pro",             // Preview — most advanced reasoning + coding
      "gemini-3.1-flash-lite",      // Preview — fastest, budget-friendly
      "gemini-3.1-flash-live",      // Preview — realtime audio/dialog
      // ── Gemini 2.5.x (stable, still active) ─────────────
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      // NOTE: gemini-2.0-* and gemini-1.5-* are sunset — removed to prevent 404s
    ],
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{{MODEL}}:generateContent",
    authHeader: () => ({ "Content-Type": "application/json" }),
    keyInUrl: true,
    buildBody: () => ({
      contents: [{ parts: [{ text: TEST_PROMPT }] }],
      generationConfig: { maxOutputTokens: MAX_TOKENS },
    }),
    extractReply: geminiReply,
  },

  // ── xAI (Grok) — Responses API ───────────────────────────────────────────
  xai: {
    id: "xai",
    models: [
      // Chat models (Responses API)
      "grok-4.3",
      "grok-4.20-0309-reasoning",
      "grok-4.20-0309-non-reasoning",
      // Coding model (Responses API)
      "grok-build-0.1",
      // Prior generation chat
      "grok-3",
      "grok-3-fast",
      "grok-3-mini",
      "grok-3-mini-fast",
    ],
    endpoint: "https://api.x.ai/v1/responses",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      input: [
        { role: "system", content: "You are Grok, a highly intelligent, helpful AI assistant." },
        { role: "user", content: TEST_PROMPT },
      ],
    }),
    // Responses API: output[].content[].text (output_text type)
    extractReply: (p) => {
      try {
        const output = p.output as Array<{ content?: Array<{ type: string; text: string }> }>
        return output?.[0]?.content?.find((c) => c.type === "output_text")?.text
      } catch { return undefined }
    },
  },

  // ── DeepSeek ──────────────────────────────────────────────────────────────
  deepseek: {
    id: "deepseek",
    models: [
      // V4 — current production models (as of June 2026)
      // Note: deepseek-chat / deepseek-reasoner are aliases deprecated on 2026-07-24
      "deepseek-v4-flash",       // non-thinking mode (formerly deepseek-chat)
      "deepseek-v4-flash:thinking", // thinking mode (formerly deepseek-reasoner)
      "deepseek-v4-pro",         // flagship multi-step reasoning
      // V3 — previous generation (still accessible)
      "deepseek-chat",           // alias → deepseek-v4-flash (deprecated 2026-07-24)
      "deepseek-reasoner",       // alias → deepseek-v4-flash thinking (deprecated 2026-07-24)
      // Coder & specialised
      "deepseek-coder",
      "deepseek-coder-v2",
      "deepseek-coder-v2-instruct",
    ],
    endpoint: "https://api.deepseek.com/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      stream: false,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Qwen (Alibaba) ────────────────────────────────────────────────────────
  qwen: {
    id: "qwen",
    models: [
      // Qwen3 flagship (latest 2025)
      "qwen3-235b-a22b",
      "qwen3-30b-a3b",
      "qwen3-32b",
      "qwen3-14b",
      "qwen3-8b",
      // Qwen2.5 stable
      "qwen-max",
      "qwen-plus",
      "qwen-turbo",
      "qwen-long",
      "qwen2.5-72b-instruct",
      "qwen2.5-32b-instruct",
      "qwen2.5-14b-instruct",
      "qwen2.5-7b-instruct",
    ],
    endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Zhipu / GLM ───────────────────────────────────────────────────────────
  zhipu: {
    id: "zhipu",
    models: [
      // GLM 5 (2025)
      "glm-5.1",
      "glm-5.1-air",
      // GLM Z1 reasoning
      "glm-z1-flash",
      "glm-z1-air",
      "glm-z1-airx",
      "glm-z1-plus",
      // GLM 4 legacy
      "glm-4-flash",
      "glm-4-air",
      "glm-4-plus",
      "glm-4",
    ],
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── MiniMax ───────────────────────────────────────────────────────────────
  minimax: {
    id: "minimax",
    models: [
      // ── Active models ─────────────────────────────────────
      "MiniMax-M3",             // Frontier multimodal coding, 1M context
      "MiniMax-M2.7",           // Recursive self-improvement
      "MiniMax-M2.7-highspeed", // Same quality as M2.7, faster
      // ── Legacy (still callable) ───────────────────────────
      "MiniMax-M2.5",
      "MiniMax-M2.5-highspeed",
      "MiniMax-M2.1",
      "MiniMax-M2.1-highspeed",
      "MiniMax-M2",
    ],
    endpoint: "https://api.minimax.io/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Groq ──────────────────────────────────────────────────────────────────
  groq: {
    id: "groq",
    models: [
      // Llama 4 (2025)
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      // Llama 3.x
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      // OpenAI OSS via Groq
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      // Qwen3 via Groq
      "qwen/qwen3-32b",
      // Other
      "gemma2-9b-it",
      "qwen-qwq-32b",
      "deepseek-r1-distill-llama-70b",
      "compound-beta",
    ],
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Together AI ─────────────────────────────────────────────���─���─���─────────
  together: {
    id: "together",
    models: [
      // ── MiniMax ───────────────────────────────────────────
      "MiniMaxAI/MiniMax-M3",
      "MiniMaxAI/MiniMax-M2.7",
      // ── Moonshot (Kimi) ───────────────────────────────────
      "moonshotai/Kimi-K2.7-Code",
      "moonshotai/Kimi-K2.6",
      // ── Z.ai (GLM) ────────────────────────────────────────
      "zai-org/GLM-5.2",
      "zai-org/GLM-5.1",
      "zai-org/GLM-5",
      // ── OpenAI OSS ────────────────────────────────────────
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      // ── DeepSeek ──────────────────────────────────────────
      "deepseek-ai/DeepSeek-V4-Pro",
      // ── NVIDIA ────────────────────────────────────────────
      "nvidia/nemotron-3-ultra-550b-a55b",
      // ── Qwen ──────────────────────────────────────────────
      "Qwen/Qwen3.7-Max",
      "Qwen/Qwen3.7-Plus",
      "Qwen/Qwen3.6-Plus",
      "Qwen/Qwen3.5-9B",
      "Qwen/Qwen3.5-397B-A17B",
      "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
      "Qwen/Qwen2.5-7B-Instruct-Turbo",
      // ── Meta Llama ────────────────────────────────────────
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      "meta-llama/Meta-Llama-3-8B-Instruct-Lite",
      // ── Google ────────────────────────────────────────────
      "google/gemma-4-31B-it",
      "google/gemma-3n-E4B-it",
      // ── Other ─────────────────────────────────────────────
      "essentialai/rnj-1-instruct",
      "deepcogito/cogito-v2-1-671b",
      "LiquidAI/LFM2-24B-A2B",
      "pearl-ai/gemma-4-31b-it",
      "meta-llama/Llama-Guard-4-12B",
    ],
    endpoint: "https://api.together.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Mistral ───────────────────────────────────────────────────────────────
  mistral: {
    id: "mistral",
    models: [
      // Latest 2025
      "mistral-large-latest",
      "mistral-medium-latest",   // mistral-medium-3 (2025)
      "mistral-small-latest",    // mistral-small-3.1 (25.03)
      "codestral-latest",
      "mistral-nemo",
      // Legacy open weights
      "open-mistral-7b",
      "open-mixtral-8x7b",
      "open-mixtral-8x22b",
    ],
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Cohere ────────────────────────────────────────────────────────────────
  cohere: {
    id: "cohere",
    models: [
      "command-a-plus-05-2026",  // Latest 2026 flagship
      "command-r-plus",
      "command-r",
      "command-r7b-12-2024",
      "command",
      "command-light",
    ],
    endpoint: "https://api.cohere.com/v2/chat",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: (p) => {
      try {
        const msg = (p.message as Record<string, unknown>)
        const content = msg?.content as Record<string, unknown>[]
        return content?.[0]?.text as string
      } catch { return undefined }
    },
  },

  // ── Perplexity ────────────────────────────────────────────────────────────
  perplexity: {
    id: "perplexity",
    models: [
      "sonar-pro",
      "sonar",
      "sonar-reasoning-pro",
      "sonar-reasoning",
      "r1-1776",
    ],
    endpoint: "https://api.perplexity.ai/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── HuggingFace ───────────────────────────────────────────────────────────
  huggingface: {
    id: "huggingface",
    models: [
      "meta-llama/Llama-3.3-70B-Instruct",
      "meta-llama/Llama-3.1-8B-Instruct",
      "meta-llama/Llama-4-Scout-17B-16E-Instruct",
      "Qwen/Qwen3-235B-A22B",
      "Qwen/Qwen2.5-72B-Instruct",
      "mistralai/Mistral-7B-Instruct-v0.3",
      "google/gemma-2-9b-it",
      "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
    ],
    endpoint: "https://api-inference.huggingface.co/models/{{MODEL}}/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Cerebras ──────────────────────────────────────────────────────────────
  cerebras: {
    id: "cerebras",
    models: [
      "kimi-k2.6",
      "glm-5.1",
      "minimax-m2.5",
      "zai-glm-4.7",
      "gpt-oss-120b",
      "gemma-4-31b",
      "qwen3-32b",
    ],
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_completion_tokens: MAX_TOKENS,
      temperature: 0.2,
      top_p: 1,
      stream: false,
      reasoning_effort: "medium",
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Fireworks AI ──────────────────────────────────────────────────────────
  fireworks: {
    id: "fireworks",
    models: [
      // ── Newest / Trending (Serverless) ────────────────────────────────────
      "accounts/fireworks/models/glm-5-2",                          // NEW — GLM 5.2, 1M ctx
      "accounts/fireworks/models/kimi-k2-7-code",                   // NEW — Kimi K2.7 Code
      "accounts/fireworks/models/minimax-m3",                       // NEW — MiniMax M3
      "accounts/fireworks/models/qwen3-7-plus",                     // NEW — Qwen3.7 Plus
      "accounts/fireworks/models/deepseek-v4-pro",                  // TRENDING — DeepSeek-V4-Pro
      "accounts/fireworks/models/kimi-k2-6",                        // TRENDING — Kimi K2.6
      "accounts/fireworks/models/minimax-m2-7",                     // TRENDING — MiniMax M2.7
      "accounts/fireworks/models/glm-5-1",                          // TRENDING — GLM 5.1
      "accounts/fireworks/models/deepseek-v4-flash",                // TRENDING — DeepSeek-V4-Flash
      // ── Stable Serverless ────────────────────────────────────────────────
      "accounts/fireworks/models/llama-v3p3-70b-instruct",          // Llama 3.3 70B
      "accounts/fireworks/models/llama4-maverick-instruct-basic",   // Llama 4 Maverick (Basic)
      "accounts/fireworks/models/llama4-scout-instruct-basic",      // Llama 4 Scout (Basic)
      "accounts/fireworks/models/qwen3-235b-a22b",                  // Qwen3 235B A22B
      "accounts/fireworks/models/qwen3-30b-a3b",                    // Qwen3 30B A3B
      "accounts/fireworks/models/deepseek-r1",                      // DeepSeek R1 (Basic)
      "accounts/fireworks/models/deepseek-r1-0528",                 // DeepSeek R1 05/28
      "accounts/fireworks/models/openai-gpt-oss-120b",              // OpenAI gpt-oss-120b
      "accounts/fireworks/models/openai-gpt-oss-20b",               // OpenAI gpt-oss-20b
      "accounts/fireworks/models/gemma4-31b-it",                    // Gemma 4 31B IT
      "accounts/fireworks/models/llama-v3p1-8b-instruct",           // Llama 3.1 8B
    ],
    endpoint: "https://api.fireworks.ai/inference/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Novita AI (105 LLM models) ────────────────────────────────────────────
  // Correct endpoint: https://api.novita.ai/openai/v1/chat/completions
  novita: {
    id: "novita",
    models: [
      // ── NEW (Jun 2026) ────────────────────────────────────────────────────
      "zai-org/glm-5-2",                                   // GLM 5.2 — NEW  $1.4/$4.4/Mt  1M ctx 128K out
      "moonshotai/kimi-k2-7-code",                         // Kimi K2.7 Code — HOT  $0.95/$4/Mt  256K ctx
      "minimax/minimax-m3",                                // MiniMax M3 — NEW  $0.3/$1.2/Mt  977K ctx 128K out
      "deepseek/deepseek-v4-pro",                          // DeepSeek V4 Pro — HOT  $1.6/$3.2/Mt  1M ctx 384K out
      "deepseek/deepseek-v4-flash",                        // DeepSeek V4 Flash — HOT  $0.14/$0.28/Mt  1M ctx 384K out
      "stepfun/step-3-7-flash",                            // Step 3.7 Flash — NEW  $0.2/$1.15/Mt  256K ctx 250K out
      "nvidia/nemotron-3-nano-30b-a3b",                    // Nemotron 3 Nano 30B A3B — NEW  $0.05/$0.2/Mt  256K ctx
      "baidu/cobuddy",                                     // CoBuddy — NEW  $0.29/$1.13/Mt  128K ctx
      "xiaomi/mimo-v2-5",                                  // XiaomiMiMo/MiMo-V2.5 — NEW  $0.168/$0.336/Mt  1M ctx
      "xiaomi/mimo-v2-5-pro",                              // XiaomiMiMo/MiMo-V2.5-Pro — NEW  $0.522/$1.044/Mt  1M ctx
      // ── HOT / Recommended ────────────────────────────────────────────────
      "deepseek/deepseek-v3-2",                            // DeepSeek V3.2 — HOT  $0.269/$0.4/Mt  160K ctx 64K out
      "deepseek/deepseek-r1-0528",                         // DeepSeek R1 0528  $0.7/$2.5/Mt  160K ctx
      "deepseek/deepseek-v3-0324",                         // DeepSeek V3 0324  $0.27/$1.12/Mt  160K ctx
      // ── Qwen3 Family ─────────────────────────────────────────────────────
      "qwen/qwen3-7-max",                                  // Qwen3.7-Max  $1.25/$3.75/Mt  977K ctx 64K out
      "qwen/qwen3-6-27b",                                  // Qwen3.6-27B  $0.6/$3.6/Mt  256K ctx 64K out
      "qwen/qwen3-5-27b",                                  // Qwen3.5-27B  $0.3/$2.4/Mt  256K ctx 64K out
      "qwen/qwen3-5-122b-a10b",                            // Qwen3.5-122B A10B  $0.4/$3.2/Mt  256K ctx
      "qwen/qwen3-5-35b-a3b",                              // Qwen3.5-35B A3B  $0.25/$2/Mt  256K ctx
      "qwen/qwen3-5-397b-a17b",                            // Qwen3.5-397B A17B  $0.6/$3.6/Mt  256K ctx
      "qwen/qwen3-coder-480b-a35b-instruct",               // Qwen3-Coder 480B A35B  $0.38/$1.55/Mt  256K ctx
      "qwen/qwen3-coder-30b-a3b-instruct",                 // Qwen3-Coder 30B A3B  $0.07/$0.27/Mt  160K ctx
      "qwen/qwen3-235b-a22b-instruct-2507",                // Qwen3-235B A22B 2507 Thinking  $0.3/$3/Mt
      "qwen/qwen3-235b-a22b-fp8",                          // Qwen3-235B A22B FP8  $0.09/$0.58/Mt
      "qwen/qwen3-235b-a22b",                              // Qwen3-235B A22B  $0.2/$0.8/Mt  40K ctx
      "qwen/qwen3-32b",                                    // Qwen3-32B  $0.1/$0.45/Mt  40K ctx
      "qwen/qwen3-30b-a3b",                                // Qwen3-30B A3B  $0.15/$1.5/Mt  131K ctx
      "qwen/qwen3-next-80b-a3b-instruct",                  // Qwen3 Next 80B A3B Instruct  $0.15/$1.5/Mt
      "qwen/qwen3-next-80b-a3b-thinking",                  // Qwen3 Next 80B A3B Thinking  $0.15/$1.5/Mt
      "qwen/qwen3-8b",                                     // Qwen3-8B  $0.035/$0.138/Mt  128K ctx
      "qwen/qwen3-coder-next",                             // Qwen3 Coder Next  $0.2/$1.5/Mt  256K ctx
      // ── Qwen VL (Vision) ─────────────────────────────────────────────────
      "qwen/qwen3-vl-235b-a22b-instruct",                  // Qwen3 VL 235B Instruct  $0.3/$1.5/Mt
      "qwen/qwen3-vl-235b-a22b-thinking",                  // Qwen3 VL 235B Thinking  $0.98/$3.95/Mt
      "qwen/qwen3-vl-30b-a3b-instruct",                    // Qwen3 VL 30B Instruct  $0.2/$0.7/Mt
      "qwen/qwen3-vl-30b-a3b-thinking",                    // Qwen3 VL 30B Thinking  $0.2/$1/Mt
      "qwen/qwen3-vl-8b-instruct",                         // Qwen3 VL 8B Instruct  $0.08/$0.5/Mt
      "qwen/qwen2.5-vl-72b-instruct",                      // Qwen2.5-VL 72B  $0.38/$0.4/Mt  32K ctx
      "qwen/qwen-mt-plus",                                 // Qwen MT Plus  $0.25/$0.75/Mt  16K ctx
      // ── GLM / Zai-org Family ─────────────────────────────────────────────
      "zai-org/glm-5-1",                                   // GLM-5.1  $1.38/$4.4/Mt  200K ctx 128K out
      "zai-org/glm-5",                                     // GLM-5  $1/$3.2/Mt  202K ctx
      "zai-org/glm-4-7-flash",                             // GLM-4.7-Flash  $0.07/$0.4/Mt  200K ctx
      "zai-org/glm-4-7",                                   // GLM-4.7  $0.6/$2.2/Mt  204K ctx
      "zai-org/glm-4-6v",                                  // GLM 4.6V  $0.3/$0.9/Mt  131K ctx
      "zai-org/glm-4-6",                                   // GLM 4.6  $0.55/$2.2/Mt  204K ctx
      "zai-org/glm-4-5v",                                  // GLM-4.5V  $0.6/$1.8/Mt  64K ctx
      "zai-org/glm-4-5",                                   // GLM-4.5  $0.6/$2.2/Mt  131K ctx
      "zai-org/glm-4-5-air",                               // GLM-4.5 Air  $0.13/$0.85/Mt  131K ctx
      "zai-org/autoglm-phone-9b-multilingual",             // AutoGLM Phone 9B Multilingual  $0.035/$0.138/Mt
      // ── MiniMax Family ───────────────────────────────────────────────────
      "minimax/minimax-m2-7",                              // MiniMax M2.7 — HOT  $0.3/$1.2/Mt  200K ctx
      "minimax/minimax-m2-5-highspeed",                    // MiniMax M2.5-highspeed  $0.6/$2.4/Mt  200K ctx
      "minimax/minimax-m2-5",                              // MiniMax M2.5  $0.3/$1.2/Mt  200K ctx
      "minimax/minimax-m2-1",                              // MiniMax M2.1  $0.3/$1.2/Mt  200K ctx
      "minimax/minimax-m2",                                // MiniMax M2  $0.3/$1.2/Mt  200K ctx
      "minimax/minimax-m1",                                // MiniMax M1  $0.55/$2.2/Mt  1M ctx 40K out
      // ── Kimi / MoonshotAI Family ─────────────────────────────────────────
      "moonshotai/kimi-k2-6",                              // Kimi K2.6 — NEW  $0.8/$3.4/Mt  256K ctx
      "moonshotai/kimi-k2-5",                              // Kimi K2.5  $0.6/$3/Mt  256K ctx
      "moonshotai/kimi-k2-0905",                           // Kimi K2 0905  $0.6/$2.5/Mt  256K ctx
      "moonshotai/kimi-k2-instruct",                       // Kimi K2 Instruct  $0.57/$2.3/Mt  131K ctx
      "moonshotai/kimi-k2-thinking",                       // Kimi K2 Thinking  $0.6/$2.5/Mt  256K ctx
      // ── Google Gemma Family ──────────────────────────────────────────────
      "google/gemma-4-26b-a4b",                            // Gemma 4 26B A4B  $0.13/$0.4/Mt  256K ctx
      "google/gemma-4-31b",                                // Gemma 4 31B  $0.14/$0.4/Mt  256K ctx
      "google/gemma-3-27b",                                // Gemma 3 27B  $0.119/$0.2/Mt  98K ctx
      "google/gemma3-12b",                                 // Gemma3 12B  $0.05/$0.1/Mt  131K ctx
      // ── Meta Llama Family ────────────────────────────────────────────────
      "meta-llama/llama-4-maverick-17b-128e-instruct-fp8", // Llama 4 Maverick FP8  $0.27/$0.85/Mt  1M ctx
      "meta-llama/llama-4-maverick-instruct",              // Llama 4 Maverick Instruct  $0.27/$0.85/Mt
      "meta-llama/llama-4-scout-17b-16e-instruct",         // Llama 4 Scout  $0.18/$0.59/Mt  131K ctx
      "meta-llama/llama-4-scout-instruct",                 // Llama 4 Scout Instruct  $0.18/$0.59/Mt
      "meta-llama/llama-3.3-70b-instruct",                 // Llama 3.3 70B  $0.135/$0.4/Mt  131K ctx
      "meta-llama/llama-3.1-8b-instruct",                  // Llama 3.1 8B  $0.02/$0.05/Mt
      "meta-llama/llama-3-8b-instruct",                    // Llama 3 8B  $0.04/$0.04/Mt
      "meta-llama/llama-3-70b-instruct",                   // Llama 3 70B  $0.51/$0.74/Mt
      "meta-llama/llama-3.2-3b-instruct",                  // Llama 3.2 3B  $0.03/$0.05/Mt
      // ── DeepSeek Family ──────────────────────────────────────────────────
      "deepseek/deepseek-r1",                              // DeepSeek R1  $0.7/$2.5/Mt  64K ctx
      "deepseek/deepseek-r1-0528-qwen3-8b",                // DeepSeek R1 0528 Qwen3 8B  $0.06/$0.09/Mt
      "deepseek/deepseek-v3",                              // DeepSeek V3 (Turbo)  $0.4/$1.3/Mt  64K ctx
      "deepseek/deepseek-v3-0324",                         // DeepSeek V3 0324  $0.27/$1.12/Mt
      "deepseek/deepseek-v3-1",                            // DeepSeek V3.1  $0.27/$1/Mt  131K ctx
      "deepseek/deepseek-v3-1-terminus",                   // DeepSeek V3.1 Terminus  $0.27/$1/Mt
      "deepseek/deepseek-v3-2-exp",                        // DeepSeek V3.2 Exp  $0.27/$0.41/Mt
      "deepseek/deepseek-prover-v2-671b",                  // DeepSeek Prover V2 671B  $0.7/$2.5/Mt  160K ctx
      "deepseek/deepseek-ocr-2",                           // DeepSeek-OCR 2  $0.03/$0.03/Mt  8K ctx
      // ── OpenAI OSS ───────────────────────────────────────────────────────
      "openai/openai-gpt-oss-120b",                        // OpenAI GPT OSS 120B  $0.05/$0.25/Mt  131K ctx
      "openai/openai-gpt-oss-20b",                         // OpenAI GPT OSS 20B  $0.04/$0.15/Mt  131K ctx
      // ── ERNIE (Baidu) ────────────────────────────────────────────────────
      "baidu/ernie-4-5-vl-424b-a47b",                      // ERNIE 4.5 VL 424B A47B  $0.42/$1.25/Mt  123K ctx
      "baidu/ernie-4-5-vl-28b-a3b",                        // ERNIE 4.5 VL 28B A3B  $0.14/$0.56/Mt  30K ctx
      "baidu/ernie-4-5-21b-a3b",                           // ERNIE 4.5 21B A3B  $0.07/$0.28/Mt  120K ctx
      // ── Ling / Nex ───────────────────────────────────────────────────────
      "ling-2-6-1t",                                       // Ling-2.6-1T  $0.3/$2.5/Mt  256K ctx
      "ling-2-6-flash",                                    // Ling-2.6-flash  $0.1/$0.3/Mt  256K ctx
      "nex-n2-pro",                                        // Nex-N2-Pro — FREE  $0/Mt  256K ctx
      // ── Mistral ──────────────────────────────────────────────────────────
      "mistralai/mistral-nemo",                            // Mistral Nemo  $0.04/$0.17/Mt  60K ctx
      // ── Misc / Roleplay / Specialty ──────────────────────────────────────
      "hermes-2-pro-llama-3-8b",                           // Hermes 2 Pro Llama 3 8B  $0.14/$0.14/Mt
      "l3-70b-euryale-v2-1",                               // L3 70B Euryale V2.1  $1.48/$1.48/Mt
      "l31-70b-euryale-v2-2",                              // L31 70B Euryale V2.2  $1.48/$1.48/Mt
      "sao10k/l3-8b-stheno-v3-2",                          // L3 8B Stheno V3.2  $0.05/$0.05/Mt
      "sao10k/l3-8b-lunaris",                              // L3 8B Lunaris  $0.05/$0.05/Mt
      "mythomaxl2-13b",                                    // MythoMax L2 13B  $0.09/$0.09/Mt
      "wizardlm-2-8x22b",                                  // WizardLM 2 8×22B  $0.62/$0.62/Mt
      "baichuan-m2-32b",                                   // BaiChuan M2 32B  $0.07/$0.07/Mt  131K ctx
      "paddleocr-vl",                                      // PaddleOCR-VL  $0.02/$0.02/Mt
      "kat-coder-pro",                                     // Kat Coder Pro  $0.3/$1.2/Mt  256K ctx
      "ring-2-6-1t",                                       // Ring-2.6-1T  $0.3/$2.5/Mt  256K ctx
      "qwen3-omni-30b-a3b-thinking",                       // Qwen3 Omni 30B A3B Thinking  $0.25/$0.97/Mt
      "qwen3-omni-30b-a3b-instruct",                       // Qwen3 Omni 30B A3B Instruct  $0.25/$0.97/Mt
    ],
    endpoint: "https://api.novita.ai/openai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Cloudflare Workers AI ─────────────────────────────────────────────────
  // Key format: "accountId|apiToken" — endpoint uses {{ACCOUNT_ID}} replaced in route handler
  cloudflare: {
    id: "cloudflare",
    models: [
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "@cf/meta/llama-3.1-8b-instruct",
      "@cf/meta/llama-4-scout-17b-16e-instruct-fp8",
      "@cf/qwen/qwen2.5-72b-instruct",
      "@cf/deepseek-ai/deepseek-r1-distill-llama-70b",
      "@cf/mistral/mistral-7b-instruct-v0.2-lora",
      "@cf/google/gemma-3-12b-it",
      "@hf/mistralai/mistral-7b-instruct-v0.2",
    ],
    endpoint: "https://api.cloudflare.com/client/v4/accounts/{{ACCOUNT_ID}}/ai/v1/chat/completions",
    authHeader: (key) => {
      const token = key.includes("|") ? key.split("|")[1] : key
      return { Authorization: `Bearer ${token}` }
    },
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── OpenRouter ────────────────────────────────────────────────────────────
  openrouter: {
    id: "openrouter",
    models: [
      "anthropic/claude-opus-4",
      "anthropic/claude-sonnet-4",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "meta-llama/llama-4-maverick",
      "meta-llama/llama-4-scout",
      "deepseek/deepseek-v3",
      "deepseek/deepseek-r1",
      "qwen/qwen3-235b-a22b",
      "mistralai/mistral-large",
      "x-ai/grok-3",
    ],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ai-tester.vercel.app",
      "X-Title": "AI Tester",
    },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── SambaNova ────────────────────────────────────────���────────────────────
  sambanova: {
    id: "sambanova",
    models: [
      "Meta-Llama-3.3-70B-Instruct",
      "Meta-Llama-3.1-8B-Instruct",
      "Meta-Llama-3.2-3B-Instruct",
      "Qwen3-32B",
      "Qwen2.5-72B-Instruct",
      "DeepSeek-R1",
      "DeepSeek-V3-0324",
      "Llama-4-Scout-17B-16E-Instruct",
      "Llama-4-Maverick-17B-128E-Instruct",
    ],
    endpoint: "https://api.sambanova.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── NVIDIA NIM ────────────────────────────────────────────────────────────
  nvidia: {
    id: "nvidia",
    models: [
      "meta/llama-4-scout-17b-16e-instruct",
      "meta/llama-4-maverick-17b-128e-instruct",
      "meta/llama-3.3-70b-instruct",
      "meta/llama-3.1-8b-instruct",
      "qwen/qwen3-235b-a22b",
      "deepseek-ai/deepseek-r1",
      "deepseek-ai/deepseek-v3",
      "microsoft/phi-4",
      "mistralai/mistral-large-2-instruct",
      "google/gemma-3-27b-it",
    ],
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Hyperbolic ────────────────────────────────────────────────────────────
  hyperbolic: {
    id: "hyperbolic",
    models: [
      "meta-llama/Llama-3.3-70B-Instruct",
      "meta-llama/Llama-3.1-8B-Instruct",
      "Qwen/Qwen3-235B-A22B",
      "Qwen/Qwen2.5-72B-Instruct",
      "deepseek-ai/DeepSeek-V3",
      "deepseek-ai/DeepSeek-R1",
      "mistralai/Mistral-7B-Instruct-v0.3",
      "NovaSky-AI/Sky-T1-32B-Preview",
    ],
    endpoint: "https://api.hyperbolic.xyz/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── AI21 Labs (Jamba) ──────────────────────────────────────────────────────
  ai21: {
    id: "ai21",
    models: [
      "jamba-large",
      "jamba-mini",
    ],
    endpoint: "https://api.ai21.com/studio/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Moonshot (Kimi) ───────────────────────────────────────────────────────
  moonshot: {
    id: "moonshot",
    models: [
      "kimi-k2",
      "moonshot-v1-8k",
      "moonshot-v1-32k",
      "moonshot-v1-128k",
    ],
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Baidu ERNIE ───────────────────────────────────────────────────────────
  baidu: {
    id: "baidu",
    models: [
      "ernie-4.5-8k",
      "ernie-4.0-8k",
      "ernie-speed-128k",
      "ernie-lite-8k",
      "ernie-tiny-8k",
    ],
    endpoint: "https://qianfan.baidubce.com/v2/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── 01.AI (Yi) ────────────────────────────────────────────────────────────
  yi: {
    id: "yi",
    models: [
      "yi-large",
      "yi-medium",
      "yi-large-turbo",
      "yi-spark",
      "yi-large-rag",
    ],
    endpoint: "https://api.lingyiwanwu.com/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Stepfun ───────────────────────────────────────────────────────────────
  stepfun: {
    id: "stepfun",
    models: [
      "step-3",
      "step-3.7-flash",
      "step-2-16k",
      "step-1-8k",
      "step-1v-8k",
    ],
    endpoint: "https://api.stepfun.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ─�� Tencent Hunyuan ───────────────────────────────────────────────────────
  hunyuan: {
    id: "hunyuan",
    models: [
      "hunyuan-turbos-latest",
      "hunyuan-turbo",
      "hunyuan-large",
      "hunyuan-standard",
      "hunyuan-lite",
    ],
    endpoint: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Upstage Solar ─────────────────────────────────────────────────────────
  upstage: {
    id: "upstage",
    models: [
      "solar-pro",
      "solar-mini",
    ],
    endpoint: "https://api.upstage.ai/v1/solar/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Writer (Palmyra) ──────────────────────────────────────────────────────
  writer: {
    id: "writer",
    models: [
      "palmyra-x5",
      "palmyra-x4",
      "palmyra-med",
      "palmyra-fin",
    ],
    endpoint: "https://api.writer.com/v1/chat",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── LeptonAI ──────────────────────────────────────────────────────────────
  lepton: {
    id: "lepton",
    models: [
      "llama3-3-70b",
      "llama3-1-405b",
      "llama3-1-70b",
      "qwen3-235b-a22b",
      "deepseek-v3",
      "deepseek-r1",
      "mistral-7b",
    ],
    endpoint: "https://{{MODEL}}.lepton.run/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: TEST_PROMPT }],
    }),
    extractReply: openaiReply,
  },
}

// ── cURL builder ──────────────────────────────────────────────────────────────

function buildCurlFull(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): string {
  const bodyStr = JSON.stringify(body)
  const parts = [`curl -X POST '${url}'`]
  for (const [k, v] of Object.entries(headers)) {
    parts.push(`  -H '${k}: ${v}'`)
  }
  parts.push(`  -d '${bodyStr.replace(/'/g, "'\\''")}'`)
  return parts.join(" \\\n")
}

// ── Model tester ─────────────────────────────────────��────────────────────────

async function testModel(
  modelId: string,
  cfg: ProviderConfig,
  apiKey: string,
): Promise<BatchModelResult> {
  // Build URL (handle {{MODEL}}, {{ACCOUNT_ID}} templates and keyInUrl)
  const accountId = apiKey.includes("|") ? apiKey.split("|")[0] : ""
  let url = cfg.endpoint
    .replace("{{MODEL}}", encodeURIComponent(modelId))
    .replace("{{ACCOUNT_ID}}", encodeURIComponent(accountId))
  if (cfg.keyInUrl) {
    url += `?key=${encodeURIComponent(apiKey)}`
  }

  const authHdrs = cfg.authHeader(apiKey)
  const extraHdrs = cfg.extraHeaders ?? {}
  const allHeaders: Record<string, string> = { ...authHdrs, ...extraHdrs }
  if (!("Content-Type" in allHeaders)) allHeaders["Content-Type"] = "application/json"

  const bodyObj = cfg.buildBody(modelId)
  const curlFull = buildCurlFull(url, allHeaders, bodyObj)

  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: allHeaders,
      body: JSON.stringify(bodyObj),
      signal: AbortSignal.timeout(20_000),
    })
    const latencyMs = Date.now() - start

    let parsed: Record<string, unknown> | null = null
    try { parsed = await res.json() } catch { /* non-json */ }

    const reply = parsed ? cfg.extractReply?.(parsed) : undefined
    const tokenUsage = parsed ? extractTokenUsage(parsed) : undefined

    let errorMsg: string | undefined
    if (!res.ok && parsed) {
      const err = parsed.error
      if (typeof err === "string") errorMsg = err
      else if (err && typeof err === "object") {
        const e = err as Record<string, unknown>
        errorMsg = String(e.message ?? e.code ?? JSON.stringify(err))
      } else {
        errorMsg = `HTTP ${res.status} ${res.statusText}`
      }
    } else if (!res.ok) {
      errorMsg = `HTTP ${res.status} ${res.statusText}`
    }

    return { modelId, ok: res.ok, status: res.status, latencyMs, reply, errorMsg, tokenUsage, curlFull }
  } catch (err) {
    return {
      modelId,
      ok: false,
      status: 0,
      latencyMs: Date.now() - start,
      errorMsg: err instanceof Error ? err.message : "Unknown error",
      curlFull,
    }
  }
}

// ── Concurrency limiter ───────────────────────────────────────────────────────

async function pLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIdx = 0
  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++
      results[idx] = await tasks[idx]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let providerId = ""
  let apiKey = ""
  try {
    const body = await req.json()
    providerId = String(body.providerId ?? "").trim()
    apiKey     = String(body.apiKey     ?? "").trim()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!apiKey || apiKey.length < 4) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 })
  }

  // ── Dahono: fetch live model list from gateway ────────────────────────────
  if (providerId === "dahono") {
    const GATEWAY = "https://gateway.dahono.com/v1"
    let models: { id: string; tier: string; free: boolean }[] = []
    try {
      const r = await fetch(`${GATEWAY}/models`, {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(12_000),
      })
      if (!r.ok) return NextResponse.json({ error: `Could not fetch Dahono models: HTTP ${r.status}` }, { status: r.status })
      const d = await r.json()
      models = (d?.data ?? []).map((m: Record<string, unknown>) => ({
        id: String(m.id), tier: String(m.tier ?? "free"), free: Boolean(m.free),
      }))
    } catch (err) {
      return NextResponse.json({ error: `Dahono model list error: ${err instanceof Error ? err.message : "unknown"}` }, { status: 502 })
    }
    if (models.length === 0) return NextResponse.json({ error: "No models found" }, { status: 404 })

    const dahonoEndpoint = `${GATEWAY}/chat/completions`
    const start = Date.now()
    const tasks = models.map((m) => () => testModel(m.id, {
      id: "dahono",
      models: [],
      endpoint: dahonoEndpoint,
      authHeader: (k) => ({ Authorization: `Bearer ${k}` }),
      extraHeaders: { "Content-Type": "application/json" },
      buildBody: (modelId) => ({ model: modelId, max_tokens: MAX_TOKENS, messages: [{ role: "user", content: TEST_PROMPT }] }),
      extractReply: openaiReply,
    }, apiKey))
    const results = await pLimit(tasks, 8)
    const durationMs = Date.now() - start
    const passed = results.filter((r) => r.ok).length
    return NextResponse.json({ provider: "dahono", total: results.length, passed, failed: results.length - passed, results, durationMs } satisfies BatchTestResponse)
  }

  // ── Static model list providers ───────────────────────────────────────────
  const cfg = PROVIDER_CONFIGS[providerId]
  if (!cfg) {
    return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 })
  }

  const start = Date.now()
  const tasks = cfg.models.map((modelId) => () => testModel(modelId, cfg, apiKey))
  const results = await pLimit(tasks, 6)
  const durationMs = Date.now() - start
  const passed = results.filter((r) => r.ok).length

  return NextResponse.json({
    provider: providerId,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
    durationMs,
  } satisfies BatchTestResponse)
}
