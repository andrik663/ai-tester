/**
 * lib/providers.ts — SINGLE SOURCE OF TRUTH for all AI provider configurations.
 *
 * Every route that needs provider endpoints, models, request bodies, or auth headers
 * MUST import from here. Do NOT duplicate these values in individual route files.
 *
 * Consumers:
 *   - app/api/batch-test/route.ts     (PROVIDER_CONFIGS — full per-model batch tester)
 *   - app/api/multi-key-test/route.ts (PROVIDER_MODELS, buildProviderBody, resolveProviderEndpoint, buildProviderHeaders)
 *   - app/api/manual-test/route.ts    (BODY_TEMPLATES, VISION_BODY_BUILDERS)
 */

// ── Shared constants ──────────────────────────────────────────────────────────

export const DEFAULT_PROMPT    = "halo"
export const BATCH_MAX_TOKENS  = 64       // per-model batch test — keep low for speed
export const SINGLE_MAX_TOKENS = 256      // single-key multi-key test
export const MANUAL_MAX_TOKENS = 1024     // manual tester — full responses

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProviderModelEntry {
  id: string
  label: string
  default?: true
}

/** Full config used by batch-test and buildProviderBody */
export interface ProviderConfig {
  id: string
  /**
   * Static fallback model list used when no live fetch is available.
   * For providers with modelsEndpoint, this acts as a fallback only.
   */
  models: string[]
  /** Chat completion endpoint. May contain {{MODEL}} or {{ACCOUNT_ID}} placeholders. */
  endpoint: string
  authHeader: (key: string) => Record<string, string>
  extraHeaders?: Record<string, string>
  buildBody: (modelId: string, maxTokens?: number) => Record<string, unknown>
  extractReply?: (parsed: Record<string, unknown>) => string | undefined
  keyInUrl?: boolean
  concurrencyLimit?: number
  /**
   * If set, this endpoint is called (GET, with the provider's authHeader) to
   * fetch the live model list at runtime. The response must be either:
   *   - OpenAI-style: { data: [{ id: string }] }
   *   - Array: [{ id: string }]
   *   - Google-style: { models: [{ name: string }] }
   *   - Dahono-style: { data: [{ id: string, free?: boolean, tier?: string }] }
   * When present, batch-test uses the live list instead of `models`.
   */
  modelsEndpoint?: string
  /**
   * How to extract model IDs from the live /models response.
   * Defaults to OpenAI-style { data: [{ id }] } if not specified.
   */
  parseModels?: (data: unknown) => string[]
}

// ── Reply extractors ─────────────────────────────────────────────────────────

export function openaiReply(p: Record<string, unknown>): string | undefined {
  try {
    const choices = p.choices as Record<string, unknown>[]
    return (choices[0]?.message as Record<string, unknown>)?.content as string
  } catch { return undefined }
}

export function responsesApiReply(p: Record<string, unknown>): string | undefined {
  try {
    const output = p.output as Array<{ content?: Array<{ type: string; text: string }> }>
    return output?.[0]?.content?.find((c) => c.type === "output_text")?.text
  } catch { return undefined }
}

export function anthropicReply(p: Record<string, unknown>): string | undefined {
  try {
    const content = p.content as Record<string, unknown>[]
    return content[0]?.text as string
  } catch { return undefined }
}

export function geminiReply(p: Record<string, unknown>): string | undefined {
  try {
    const candidates = p.candidates as Record<string, unknown>[]
    const content = candidates[0]?.content as Record<string, unknown>
    const parts = content?.parts as Record<string, unknown>[]
    return parts[0]?.text as string
  } catch { return undefined }
}

export function cohereV2Reply(p: Record<string, unknown>): string | undefined {
  try {
    const msg = p.message as Record<string, unknown>
    const content = msg?.content as Record<string, unknown>[]
    return content?.[0]?.text as string
  } catch { return undefined }
}

// ── PROVIDER_CONFIGS — authoritative model + endpoint + body definitions ──────
// batch-test/route.ts imports this directly.
// multi-key-test/route.ts imports PROVIDER_MODELS + helpers derived from this.

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {

  // ── Dahono Gateway ────────────────────────────────────────────────────────
  dahono: {
    id: "dahono",
    // Static fallback — overridden at runtime via modelsEndpoint
    models: [
      "dahono/deepseek-v4-flash",
      "dahono/gemini-2.5-flash",
      "dahono/gpt-4o-mini",
      "dahono/claude-haiku-4-5",
    ],
    endpoint: "https://gateway.dahono.com/v1/chat/completions",
    // Live model list — same API the single-key tester uses, returns all 70+ models
    modelsEndpoint: "https://gateway.dahono.com/v1/models",
    parseModels: (data) => {
      const d = data as { data?: { id: string; free?: boolean }[] }
      return (d?.data ?? []).map((m) => m.id)
    },
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Anthropic ─────────────────────────────────────────────────────────────
  anthropic: {
    id: "anthropic",
    models: [
      "claude-opus-4-5",
      "claude-opus-4-5-20251101",
      "claude-sonnet-4-5",
      "claude-sonnet-4-5-20251022",
      "claude-haiku-4-5",
      "claude-haiku-4-5-20251022",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307",
    ],
    endpoint: "https://api.anthropic.com/v1/messages",
    authHeader: (key) => ({ "x-api-key": key }),
    extraHeaders: { "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: anthropicReply,
  },

  // ── OpenAI — Responses API ────────────────────────────────────────────────
  openai: {
    id: "openai",
    modelsEndpoint: "https://api.openai.com/v1/models",
    models: [
      "gpt-5.3-codex",
      "gpt-5.2",
      "gpt-5.2-pro",
      "gpt-5.1",
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-5-pro",
      "o3-pro",
      "o3",
      "gpt-4.1",
      "gpt-4.1-mini",
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
    ],
    // Responses API — replaces /v1/chat/completions for GPT-5+
    endpoint: "https://api.openai.com/v1/responses",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({ model, input: DEFAULT_PROMPT }),
    extractReply: responsesApiReply,
  },

  // ── Google Gemini ─────────────────────────────────────────────────────────
  google: {
    id: "google",
    concurrencyLimit: 2,
    models: [
      "gemini-3.5-flash",
      "gemini-3-flash",
      "gemini-3.1-pro",
      "gemini-3.1-flash-lite",
      "gemini-3.1-flash-live",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ],
    // {{MODEL}} replaced at request time; key appended as ?key=
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{{MODEL}}:generateContent",
    authHeader: () => ({ "Content-Type": "application/json" }),
    keyInUrl: true,
    buildBody: (_model, maxTokens = BATCH_MAX_TOKENS) => ({
      contents: [{ parts: [{ text: DEFAULT_PROMPT }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
    extractReply: geminiReply,
  },

  // ── xAI (Grok) — Responses API ───────────────────────────────────────────
  xai: {
    id: "xai",
    modelsEndpoint: "https://api.x.ai/v1/models",
    models: [
      "grok-4.3",
      "grok-4.20-0309-reasoning",
      "grok-4.20-0309-non-reasoning",
      "grok-build-0.1",
      "grok-3",
      "grok-3-fast",
      "grok-3-mini",
      "grok-3-mini-fast",
    ],
    // Responses API (same as OpenAI)
    endpoint: "https://api.x.ai/v1/responses",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model) => ({
      model,
      input: [
        { role: "system", content: "You are Grok, a highly intelligent, helpful AI assistant." },
        { role: "user", content: DEFAULT_PROMPT },
      ],
    }),
    extractReply: responsesApiReply,
  },

  // ── DeepSeek ──────────────────────────────────────────────────────────────
  deepseek: {
    id: "deepseek",
    modelsEndpoint: "https://api.deepseek.com/models",
    models: [
      "deepseek-v4-flash",
      "deepseek-v4-flash:thinking",
      "deepseek-v4-pro",
      "deepseek-chat",
      "deepseek-reasoner",
      "deepseek-coder",
      "deepseek-coder-v2",
      "deepseek-coder-v2-instruct",
    ],
    endpoint: "https://api.deepseek.com/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, stream: false, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Qwen (Alibaba DashScope) ──────────────────────────────────────────────
  qwen: {
    id: "qwen",
    modelsEndpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models",
    models: [
      "qwen3-235b-a22b",
      "qwen3-30b-a3b",
      "qwen3-32b",
      "qwen3-14b",
      "qwen3-8b",
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
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Zhipu / GLM ───────────────────────────────────────────────────────────
  zhipu: {
    id: "zhipu",
    models: [
      "glm-5.1",
      "glm-5.1-air",
      "glm-z1-flash",
      "glm-z1-air",
      "glm-z1-airx",
      "glm-z1-plus",
      "glm-4-flash",
      "glm-4-air",
      "glm-4-plus",
      "glm-4",
    ],
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── MiniMax ───────────────────────────────────────────────────────────────
  minimax: {
    id: "minimax",
    models: [
      "MiniMax-M3",
      "MiniMax-M2.7",
      "MiniMax-M2.7-highspeed",
      "MiniMax-M2.5",
      "MiniMax-M2.5-highspeed",
      "MiniMax-M2.1",
      "MiniMax-M2.1-highspeed",
      "MiniMax-M2",
    ],
    endpoint: "https://api.minimax.io/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Groq ──────────────────────────────────────────────────────────────────
  groq: {
    id: "groq",
    modelsEndpoint: "https://api.groq.com/openai/v1/models",
    models: [
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3-32b",
      "gemma2-9b-it",
      "qwen-qwq-32b",
      "deepseek-r1-distill-llama-70b",
      "compound-beta",
    ],
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Together AI ───────────────────────────────────────────────────────────
  together: {
    id: "together",
    modelsEndpoint: "https://api.together.ai/v1/models",
    parseModels: (data) => {
      // Together returns a plain array, not { data: [] }
      if (Array.isArray(data)) return (data as { id: string }[]).map((m) => m.id)
      const d = data as { data?: { id: string }[] }
      return (d?.data ?? []).map((m) => m.id)
    },
    models: [
      "MiniMaxAI/MiniMax-M3",
      "MiniMaxAI/MiniMax-M2.7",
      "moonshotai/Kimi-K2.7-Code",
      "moonshotai/Kimi-K2.6",
      "zai-org/GLM-5.2",
      "zai-org/GLM-5.1",
      "zai-org/GLM-5",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "deepseek-ai/DeepSeek-V4-Pro",
      "nvidia/nemotron-3-ultra-550b-a55b",
      "Qwen/Qwen3.7-Max",
      "Qwen/Qwen3.7-Plus",
      "Qwen/Qwen3.6-Plus",
      "Qwen/Qwen3.5-9B",
      "Qwen/Qwen3.5-397B-A17B",
      "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
      "Qwen/Qwen2.5-7B-Instruct-Turbo",
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      "meta-llama/Meta-Llama-3-8B-Instruct-Lite",
      "google/gemma-4-31B-it",
      "google/gemma-3n-E4B-it",
      "essentialai/rnj-1-instruct",
      "deepcogito/cogito-v2-1-671b",
      "LiquidAI/LFM2-24B-A2B",
    ],
    endpoint: "https://api.together.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Mistral ───────────────────────────────────────────────────────────────
  mistral: {
    id: "mistral",
    modelsEndpoint: "https://api.mistral.ai/v1/models",
    models: [
      "mistral-large-latest",
      "mistral-medium-latest",
      "mistral-small-latest",
      "codestral-latest",
      "mistral-nemo",
      "open-mistral-7b",
      "open-mixtral-8x7b",
      "open-mixtral-8x22b",
    ],
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Cohere v2 ─────────────────────────────────────────────────────────────
  cohere: {
    id: "cohere",
    models: [
      "command-a-plus-05-2026",
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
      model, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: cohereV2Reply,
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
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── HuggingFace ({{MODEL}} replaced per request) ──────────────────────────
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
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
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
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model,
      max_completion_tokens: maxTokens,
      temperature: 0.2,
      top_p: 1,
      stream: false,
      reasoning_effort: "medium",
      messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Fireworks AI ──────────────────────────────────────────────────────────
  fireworks: {
    id: "fireworks",
    modelsEndpoint: "https://api.fireworks.ai/inference/v1/models",
    models: [
      "accounts/fireworks/models/glm-5-2",
      "accounts/fireworks/models/kimi-k2-7-code",
      "accounts/fireworks/models/minimax-m3",
      "accounts/fireworks/models/qwen3-7-plus",
      "accounts/fireworks/models/deepseek-v4-pro",
      "accounts/fireworks/models/kimi-k2-6",
      "accounts/fireworks/models/minimax-m2-7",
      "accounts/fireworks/models/glm-5-1",
      "accounts/fireworks/models/deepseek-v4-flash",
      "accounts/fireworks/models/llama-v3p3-70b-instruct",
      "accounts/fireworks/models/llama4-maverick-instruct-basic",
      "accounts/fireworks/models/llama4-scout-instruct-basic",
      "accounts/fireworks/models/qwen3-235b-a22b",
      "accounts/fireworks/models/qwen3-30b-a3b",
      "accounts/fireworks/models/deepseek-r1",
      "accounts/fireworks/models/deepseek-r1-0528",
      "accounts/fireworks/models/openai-gpt-oss-120b",
      "accounts/fireworks/models/openai-gpt-oss-20b",
      "accounts/fireworks/models/gemma4-31b-it",
      "accounts/fireworks/models/llama-v3p1-8b-instruct",
    ],
    endpoint: "https://api.fireworks.ai/inference/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Novita AI ─────────────────────────────────────────────────────────────
  novita: {
    id: "novita",
    modelsEndpoint: "https://api.novita.ai/openai/v1/models",
    models: [
      "zai-org/glm-5-2",
      "moonshotai/kimi-k2-7-code",
      "minimax/minimax-m3",
      "deepseek/deepseek-v4-pro",
      "deepseek/deepseek-v4-flash",
      "stepfun/step-3-7-flash",
      "nvidia/nemotron-3-nano-30b-a3b",
      "deepseek/deepseek-v3-2",
      "deepseek/deepseek-r1-0528",
      "qwen/qwen3-7-max",
      "qwen/qwen3-235b-a22b",
      "qwen/qwen3-32b",
      "zai-org/glm-5-1",
      "minimax/minimax-m2-7",
      "moonshotai/kimi-k2-6",
      "meta-llama/llama-4-maverick-17b-128e-instruct-fp8",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "meta-llama/llama-3.3-70b-instruct",
      "meta-llama/llama-3.1-8b-instruct",
      "google/gemma-4-31b",
      "deepseek/deepseek-r1",
      "deepseek/deepseek-v3",
      "openai/openai-gpt-oss-120b",
    ],
    endpoint: "https://api.novita.ai/openai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Cloudflare Workers AI (key format: "accountId|apiToken") ─────────────
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
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── OpenRouter ────────────────────────────────────────────────────────────
  openrouter: {
    id: "openrouter",
    models: [
      "deepseek/deepseek-v4-flash",
      "minimax/minimax-m3",
      "anthropic/claude-opus-4.7",
      "openrouter/owl-alpha",
      "deepseek/deepseek-v4-pro",
      "anthropic/claude-opus-4.8",
      "anthropic/claude-sonnet-4.6",
      "z-ai/glm-5.2",
      "google/gemini-3-flash-preview",
      "openai/gpt-5.5",
      "google/gemini-2.5-flash",
      "moonshotai/kimi-k2.6",
      "openai/gpt-4o-mini",
      "google/gemini-2.5-flash-lite",
      "openai/gpt-oss-120b",
      "openai/gpt-5.4",
      "anthropic/claude-opus-4.6",
      "anthropic/claude-haiku-4.5",
      "moonshotai/kimi-k2.7-code",
      "minimax/minimax-m2.7",
      "mistralai/mistral-nemo",
      "openai/gpt-5.4-mini",
      "openai/gpt-5-mini",
    ],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://ai-tester.vercel.app",
      "X-Title": "AI Tester",
    }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── SambaNova ─────────────────────────────────────────────────────────────
  sambanova: {
    id: "sambanova",
    models: [
      "Meta-Llama-3.3-70B-Instruct",
      "Meta-Llama-3.1-405B-Instruct",
      "Meta-Llama-3.1-8B-Instruct",
      "Qwen3-235B-A22B",
      "Qwen3-32B",
      "DeepSeek-R1",
      "DeepSeek-R1-Distill-Llama-70B",
    ],
    endpoint: "https://api.sambanova.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── NVIDIA NIM ────────────────────────────────────────────────────────────
  nvidia: {
    id: "nvidia",
    models: [
      "meta/llama-3.3-70b-instruct",
      "meta/llama-3.1-8b-instruct",
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "qwen/qwen3-235b-a22b",
      "deepseek-ai/deepseek-r1",
      "mistralai/mistral-7b-instruct-v0.3",
    ],
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Hyperbolic ────────────────────────────────────────────────────────────
  hyperbolic: {
    id: "hyperbolic",
    models: [
      "meta-llama/Llama-3.3-70B-Instruct",
      "meta-llama/Llama-3.2-3B-Instruct",
      "meta-llama/Meta-Llama-3.1-70B-Instruct",
      "Qwen/Qwen3-235B-A22B",
      "deepseek-ai/DeepSeek-R1",
    ],
    endpoint: "https://api.hyperbolic.xyz/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── AI21 Labs ─────────────────────────────────────────────────────────────
  ai21: {
    id: "ai21",
    models: [
      "jamba-1.6-large",
      "jamba-1.6-mini",
      "jamba-mini-1.6",
    ],
    endpoint: "https://api.ai21.com/studio/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Moonshot (Kimi) ───────────────────────────────────────────────────────
  moonshot: {
    id: "moonshot",
    models: [
      "moonshot-v1-8k",
      "moonshot-v1-32k",
      "moonshot-v1-128k",
    ],
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Baidu ERNIE ───────────────────────────────────────────────────────────
  baidu: {
    id: "baidu",
    models: [
      "ernie-4.5-8k",
      "ernie-4.5-turbo-128k",
      "ernie-4.0-8k",
    ],
    endpoint: "https://qianfan.baidubce.com/v2/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_output_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Yi (01.AI) ────────────────────────────────────────────────────────────
  yi: {
    id: "yi",
    models: [
      "yi-lightning",
      "yi-large",
      "yi-large-turbo",
    ],
    endpoint: "https://api.lingyiwanwu.com/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Stepfun ───────────────────────────────────────────────────────────────
  stepfun: {
    id: "stepfun",
    models: [
      "step-3.7-flash",
      "step-2-mini",
      "step-2",
      "step-1v-32k",
    ],
    endpoint: "https://api.stepfun.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Tencent Hunyuan ───────────────────────────────────────────────────────
  hunyuan: {
    id: "hunyuan",
    models: [
      "hunyuan-turbos",
      "hunyuan-lite",
      "hunyuan-standard",
    ],
    endpoint: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Upstage ───────────────────────────────────────────────────────────────
  upstage: {
    id: "upstage",
    models: [
      "solar-pro",
      "solar-mini",
    ],
    endpoint: "https://api.upstage.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Writer ────────────────────────────────────────────────────────────────
  writer: {
    id: "writer",
    models: [
      "palmyra-x5-mini",
      "palmyra-x5",
    ],
    endpoint: "https://api.writer.com/v1/chat",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Lepton AI ─────────────────────────────────────────────────────────────
  lepton: {
    id: "lepton",
    models: [
      "llama3.1-8b",
      "llama3.3-70b",
    ],
    endpoint: "https://api.lepton.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Inception Labs ────────────────────────────────────────────────────────
  inception: {
    id: "inception",
    models: [
      "mercury-coder-small",
      "mercury-coder",
    ],
    endpoint: "https://api.inceptionlabs.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── IBM WatsonX ───────────────────────────────────────────────────────────
  ibm: {
    id: "ibm",
    models: [
      "ibm/granite-3-8b-instruct",
      "ibm/granite-3.3-8b-instruct",
    ],
    endpoint: "https://us-south.ml.cloud.ibm.com/ml/v1/text/chat?version=2023-05-29",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model_id: model, messages: [{ role: "user", content: DEFAULT_PROMPT }], parameters: { max_new_tokens: maxTokens },
    }),
    extractReply: (p) => {
      try {
        return (p.results as Record<string, unknown>[])[0]?.generated_text as string
      } catch { return undefined }
    },
  },

  // ── DeepInfra ─────────────────────────────────────────────────────────────
  deepinfra: {
    id: "deepinfra",
    models: [
      "meta-llama/Meta-Llama-3.1-8B-Instruct",
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    ],
    endpoint: "https://api.deepinfra.com/v1/openai/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Anyscale ──────────────────────────────────────────────────────────────
  anyscale: {
    id: "anyscale",
    models: [
      "meta-llama/Meta-Llama-3.1-8B-Instruct",
    ],
    endpoint: "https://api.endpoints.anyscale.com/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Neets AI ──────────────────────────────────────────────────────────────
  neets: {
    id: "neets",
    models: [
      "meta-llama/Meta-Llama-3-8B-Instruct",
    ],
    endpoint: "https://api.neets.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "X-API-Key": key }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Lamini ────────────────────────────────────────────────────────────────
  lamini: {
    id: "lamini",
    models: [
      "meta-llama/Meta-Llama-3-8B-Instruct",
    ],
    endpoint: "https://api.lamini.ai/v1/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model_name: model, prompt: DEFAULT_PROMPT, max_new_tokens: maxTokens,
    }),
    extractReply: (p) => typeof p.output === "string" ? p.output : undefined,
  },

  // ── Replicate ─────────────────────────────────────────────────────────────
  replicate: {
    id: "replicate",
    models: [
      "meta/meta-llama-3-8b-instruct",
    ],
    endpoint: "https://api.replicate.com/v1/models/meta/meta-llama-3-8b-instruct/predictions",
    authHeader: (key) => ({ Authorization: `Token ${key}`, Prefer: "wait" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (_model, maxTokens = BATCH_MAX_TOKENS) => ({
      input: { prompt: DEFAULT_PROMPT, max_new_tokens: maxTokens },
    }),
    extractReply: (p) => {
      if (Array.isArray(p.output)) return (p.output as string[]).join("")
      if (typeof p.output === "string") return p.output
      return undefined
    },
  },

  // ── Meta AI (llama.com) ───────────────────────────────────────────────────
  meta: {
    id: "meta",
    models: [
      "Llama-4-Maverick-17B-128E-Instruct-FP8",
      "Llama-4-Scout-17B-16E-Instruct",
      "Llama-3.3-70B-Instruct",
      "Llama-3.1-70B-Instruct",
      "Llama-3.1-8B-Instruct",
    ],
    endpoint: "https://api.llama.com/compat/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Azure OpenAI (requires resource name — skipped without config) ─────────
  azure: {
    id: "azure",
    models: ["gpt-4o-mini", "gpt-4o"],
    endpoint: "", // populated at runtime via AZURE_RESOURCE_NAME env or key prefix
    authHeader: (key) => ({ "api-key": key }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── SiliconFlow ───────────────────────────────────────────────────────────
  siliconflow: {
    id: "siliconflow",
    modelsEndpoint: "https://api.siliconflow.cn/v1/models",
    models: [
      "deepseek-ai/DeepSeek-V3",
      "deepseek-ai/DeepSeek-R1",
      "Qwen/Qwen3-235B-A22B",
      "meta-llama/Meta-Llama-3.1-8B-Instruct",
    ],
    endpoint: "https://api.siliconflow.cn/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Nebius AI (ex-Yandex) ─────────────────────────────────────────────────
  nebius: {
    id: "nebius",
    modelsEndpoint: "https://api.studio.nebius.com/v1/models",
    models: ["meta-llama/Llama-3.3-70B-Instruct", "deepseek-ai/DeepSeek-R1", "Qwen/Qwen3-235B-A22B-Instruct"],
    endpoint: "https://api.studio.nebius.com/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Featherless AI ────────────────────────────────────────────────────────
  featherless: {
    id: "featherless",
    modelsEndpoint: "https://api.featherless.ai/v1/models",
    models: ["meta-llama/Llama-3.3-70B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"],
    endpoint: "https://api.featherless.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Friendli AI ───────────────────────────────────────────────────────────
  friendli: {
    id: "friendli",
    models: ["meta-llama-3-70b-instruct", "mistral-7b-instruct-v0-3"],
    endpoint: "https://inference.friendli.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Marketku Router ───────────────────────────────────────────────────────
  // Static list = full 69-model catalog as of 2026-06-28.
  // Live fetch via modelsEndpoint (requires API key) always takes priority.
  marketku: {
    id: "marketku",
    models: [
      // ── Featured / auto ──────────────────────────────────────────────────
      "mk/auto",
      "mk/auto-thinking",
      // ── Claude (Anthropic via Marketku) ──────────────────────────────────
      "mk/sonnet-4.5",
      "mk/sonnet-4.5-thinking",
      "mk/sonnet-4.5-thinking-agentic",
      // ── DeepSeek ─────────────────────────────────────────────────────────
      "mk/deepseek-3.2",
      "mk/deepseek-3.2-thinking",
      "mk/deepseek-3.2-agentic",
      "mk/deepseek-3.2-thinking-agentic",
      "mk/deepseek-v3.2",
      "mk/deepseek-v4-flash",
      "mk/deepseek-v4-pro",
      // ── GLM (Zhipu) ───────────────────────────────────────────────────────
      "mk/glm-5",
      "mk/glm-5-thinking",
      "mk/glm-5-agentic",
      "mk/glm-5-thinking-agentic",
      "mk/glm-5.1",
      "mk/glm-5.2",
      // ── MiniMax �����������──────────────────────────────────────────────────────────
      "mk/minimax-m2.1-agentic",
      "mk/minimax-m2.5",
      "mk/minimax-m2.5-thinking-agentic",
      // ── Kimi ──────────────────────────────────────────────────────────────
      "mk/kimi-k2.7-code",
      // ── Qwen3-coder ───────────────────────────────────────────────────────
      "mk/qwen3-coder-next",
      "mk/qwen3-coder-next-thinking",
      "mk/qwen3-coder-next-agentic",
      "mk/qwen3-coder-next-thinking-agentic",
      "mk/qwen3-coder-plus",
      "mk/qwen3-coder-flash",
      "mk/qwen3-coder-480b-a35b-instruct",
      // ── Qwen3 ─────────────────────────────────────────────────────────────
      "mk/qwen3-235b-a22b",
      "mk/qwen3-235b-a22b-instruct-2507",
      "mk/qwen3-235b-a22b-thinking-2507",
      "mk/qwen3-next-80b-a3b-instruct",
      "mk/qwen3-next-80b-a3b-thinking",
      "mk/qwen3-32b",
      "mk/qwen3-30b-a3b",
      "mk/qwen3-30b-a3b-instruct-2507",
      "mk/qwen3-30b-a3b-thinking-2507",
      "mk/qwen3-14b",
      "mk/qwen3-8b",
      "mk/qwen3-max",
      // ── Qwen3.5 ───────────────────────────────────────────────────────────
      "mk/qwen3.5-flash",
      "mk/qwen3.5-27b",
      "mk/qwen3.5-35b-a3b",
      "mk/qwen3.5-122b-a10b",
      "mk/qwen3.5-397b-a17b",
      "mk/qwen3.5-plus",
      // ── Qwen3.6 ───────────────────────────────────────────────────────────
      "mk/qwen3.6-flash",
      "mk/qwen3.6-27b",
      "mk/qwen3.6-35b-a3b",
      "mk/qwen3.6-plus",
      // ── Qwen3.7 ───────────────────────────────────────────────────────────
      "mk/qwen3.7-max",
      "mk/qwen3.7-plus",
      // ── Qwen legacy ───────────────────────────────────────────────────────
      "mk/qwen-max",
      "mk/qwen-plus",
      "mk/qwen-plus-latest",
      "mk/qwen-turbo",
      "mk/qwen-flash",
      "mk/qwen-plus-character",
      "mk/qwen-flash-character",
      "mk/qwen-coder-plus",
      "mk/qwq-plus",
      "mk/qvq-max",
      "mk/qwen2-7b-instruct",
      // ── Qwen MT ───────────────────────────────────────────────────────────
      "mk/qwen-mt-lite",
      "mk/qwen-mt-flash",
      "mk/qwen-mt-turbo",
      "mk/qwen-mt-plus",
      // ── CCAI ──────────────────────────────────────────────────────────────
      "mk/ccai-pro",
    ],
    modelsEndpoint: "https://router.marketku.id/v1/models",
    endpoint: "https://router.marketku.id/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    // Run 4 models at a time — Marketku is a gateway and can handle concurrency
    // but keep it modest to avoid rate-limit responses on large batches.
    concurrencyLimit: 4,
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── OpenModel ─────────────────────────────────────────────────────────────
  // Base URL: https://api.openmodel.app/v1  (OpenAI-compatible)
  // API key prefix: om_*
  // Static list used when /v1/models fetch fails (auth required).
  openmodel: {
    id: "openmodel",
    models: [
      // OpenAI
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "o4-mini",
      "o3",
      "o3-mini",
      // Anthropic
      "claude-opus-4-6",
      "claude-sonnet-4-5-20251001",
      "claude-haiku-4-5-20251001",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      // Google
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      // DeepSeek
      "deepseek-v4-flash",
      "deepseek-v3",
      "deepseek-r1",
      // Kimi / Moonshot
      "kimi-k2.5",
      "moonshot-v1-8k",
      // GLM / Zhipu
      "glm-4.7",
      "glm-z1-flash",
      // Qwen (via OpenModel routing)
      "qwen-plus",
      "qwen-turbo",
    ],
    modelsEndpoint: "https://api.openmodel.app/v1/models",
    endpoint: "https://api.openmodel.app/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    concurrencyLimit: 5,
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Avian ─────────────────────────────────────────────────────────────────
  // OpenAI-compatible. Base URL: https://api.avian.io/v1
  // Live /v1/models returns pricing + context length. No auth needed for list.
  avian: {
    id: "avian",
    models: [
      "deepseek/deepseek-v4-flash",
      "deepseek/deepseek-v4-pro",
      "deepseek/deepseek-v3.2",
      "minimax/minimax-m2.5",
      "z-ai/glm-5",
      "z-ai/glm-5.1",
      "moonshotai/kimi-k2.5",
      "moonshotai/kimi-k2.6",
    ],
    modelsEndpoint: "https://api.avian.io/v1/models",
    endpoint: "https://api.avian.io/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    concurrencyLimit: 4,
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Parasail ──────────────────────────────────────────────────────────────
  // OpenAI-compatible serverless inference. Base URL: https://api.parasail.io/v1
  // Aggregates GPU providers; supports Llama, Qwen, Mixtral, Gemma, etc.
  parasail: {
    id: "parasail",
    models: [
      "meta-llama/Meta-Llama-3.3-70B-Instruct",
      "meta-llama/Meta-Llama-3.1-405B-Instruct",
      "meta-llama/Meta-Llama-3.1-70B-Instruct",
      "meta-llama/Meta-Llama-3.1-8B-Instruct",
      "Qwen/Qwen2.5-72B-Instruct",
      "Qwen/Qwen2.5-7B-Instruct",
      "deepseek-ai/DeepSeek-R1",
      "deepseek-ai/DeepSeek-V3",
      "mistralai/Mistral-7B-Instruct-v0.3",
      "google/gemma-3-27b-it",
    ],
    modelsEndpoint: "https://api.parasail.io/v1/models",
    endpoint: "https://api.parasail.io/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    concurrencyLimit: 4,
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Telnyx AI ─────────────────────────────────────────────────────────────
  // OpenAI-compatible. Base URL: https://api.telnyx.com/v2/ai/openai
  // Focused on open-source frontier models (Kimi, GLM, MiniMax, Llama).
  telnyx: {
    id: "telnyx",
    models: [
      "moonshotai/Kimi-K2.6",
      "moonshotai/Kimi-K2.5",
      "zai-org/GLM-5.1-FP8",
      "MiniMaxAI/MiniMax-M2.7",
      "MiniMaxAI/MiniMax-M2.5",
      "meta-llama/Meta-Llama-3.1-70B-Instruct",
      "meta-llama/Meta-Llama-3.1-8B-Instruct",
    ],
    modelsEndpoint: "https://api.telnyx.com/v2/ai/openai/models",
    endpoint: "https://api.telnyx.com/v2/ai/openai/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    concurrencyLimit: 4,
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Targon (Bittensor Subnet 4) ───────────────────────────────────────────
  // Decentralized confidential inference marketplace. 500+ models.
  // OpenAI-compatible. Base URL: https://api.targon.com/v1
  targon: {
    id: "targon",
    models: [
      "NousResearch/Meta-Llama-3.1-8B-Instruct",
      "NousResearch/Hermes-3-Llama-3.1-70B",
      "meta-llama/Llama-3.3-70B-Instruct",
      "deepseek-ai/DeepSeek-R1",
      "Qwen/Qwen2.5-72B-Instruct",
      "mistralai/Mistral-7B-Instruct-v0.3",
    ],
    modelsEndpoint: "https://api.targon.com/v1/models",
    endpoint: "https://api.targon.com/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    concurrencyLimit: 3,
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Miuclaw Gateway ───────────────────────────────────────────────────────
  // Self-hosted gateway at https://www.miuclaw.my.id — routes requests to all
  // synced working keys with automatic key rotation.
  // Auth: EXPORT_API_TOKEN (same token as the export API).
  // Models: dynamically fetched from /api/v1/models (reflects synced keys).
  miuclaw: {
    id: "miuclaw",
    models: [
      "miuclaw/auto",
    ],
    modelsEndpoint: "https://www.miuclaw.my.id/api/v1/models",
    endpoint: "https://www.miuclaw.my.id/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    concurrencyLimit: 10,
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Conduit Gateway ───────────────────────────────────────────────────────
  // "One key, every model" — flat $20/mo unlimited plan. OpenAI-compatible.
  // Base URL: https://conduit.ozdoev.net/v1  Auth: Bearer token.
  // Live /v1/models returns full catalogue. Auth via Telegram, no password.
  conduit: {
    id: "conduit",
    models: [
      "gpt-5",
      "gpt-5-mini",
      "gpt-4o",
      "gpt-4.1",
      "o4",
      "claude-opus-4-8",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
      "gemini-3-pro",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "grok-4",
      "grok-3",
      "grok-3-mini",
      "deepseek-v4-flash",
      "deepseek-v3.2",
      "deepseek-r1",
      "llama-4-maverick",
      "llama-4-scout",
      "llama-3.3-70b",
      "qwen3-coder",
      "mistral-large-3",
      "codestral",
    ],
    modelsEndpoint: "https://conduit.ozdoev.net/v1/models",
    endpoint: "https://conduit.ozdoev.net/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    concurrencyLimit: 5,
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── ZenMux Gateway ────────────────────────────────────────────────────────
  // Unified API aggregator — 200+ LLM models with intelligent routing and
  // AI Model Insurance. OpenAI-compatible. Base URL: https://zenmux.ai/api/v1
  // Auth: Bearer token. Live /v1/models endpoint returns full model catalog.
  zenmux: {
    id: "zenmux",
    models: [
      // New models (requested additions)
      "moonshotai/kimi-k2.7-code",
      "qwen/qwen3.7-plus",
      "minimax/minimax-m3",
      "stepfun/step-3.7-flash",
      "stepfun/step-3.7-flash-free",
      "inclusionai/ring-2.6-1t",
      "deepseek/deepseek-v4-flash",
      "deepseek/deepseek-v4-pro",
      "inclusionai/ling-2.6-1t",
      "google/gemini-3.1-pro-preview",
      "stepfun/step-3.5-flash",
      "z-ai/glm-4.7-flash-free",
      "z-ai/glm-4.7",
      "minimax/minimax-m2.1",
      "z-ai/glm-4.6v-flash-free",
      "z-ai/glm-4.6v-flash",
      "deepseek/deepseek-chat",
      "deepseek/deepseek-reasoner",
      "stepfun/step-3",
      // Existing models
      "anthropic/claude-opus-4-5",
      "anthropic/claude-sonnet-4-5",
      "anthropic/claude-haiku-4-5",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "openai/o3",
      "openai/o4-mini",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "meta/llama-3.3-70b-instruct",
      "qwen/qwen3-235b-a22b",
      "mistral/mistral-large-latest",
    ],
    modelsEndpoint: "https://zenmux.ai/api/v1/models",
    endpoint: "https://zenmux.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    concurrencyLimit: 5,
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Bynara (NaraRouter) ───────────────────────────────────────────────────
  // OpenAI-compatible gateway. Base URL: https://router.bynara.id/v1
  // Auth: Bearer sk-nry-*  (key prefix sk-nry-)
  // Supports: chat completions, streaming SSE, reasoning_effort (low/medium/high)
  // Live /v1/models returns models entitled to the caller's plan.
  // Static list = all models visible on the public pricing page (June 2025).
  bynara: {
    id: "bynara",
    models: [
      // ── Free tier ────────────────────────────────────────────────────────
      "mimo-v2.5-free",
      "mimo-v2.5-pro-free",
      "mistral-large",
      "mistral-medium-3-5",
      // ── Lite / Lite Mocin ────────────────────────────────────────────────
      "claude-sonnet-4.6",
      "gemini-3-flash",
      "glm-5.1",
      "deepseek-v4-flash",
      "deepseek-v4-pro",
      "mimo-v2.5",
      "mimo-v2.5-pro-ultraspeed",
      // ── Pro ───────────────────────────────────────────────────────────────
      "claude-opus-4.7",
      // ── Hermes / Mimo ─────────────────────────────────────────────────────
      "mimo-v2.5-hermes",
      "mimo-v2.5-pro-hermes",
      // ── DeepSeek plan ─────────────────────────────────────────────────────
      "deepseek-v4-flash-bynara",
      "deepseek-v4-pro-bynara",
      // ── Kimi ──────────────────────────────────────────────────────────────
      "kimi-k2.6",
      "kimi-k2.7-code",
      "kimi-k2.7-code-bynara",
      // ── Qwen ──────────────────────────────────────────────────────────────
      "qwen3.7-max-bynara",
      "qwen3.7-plus",
      "qwen3.7-plus-1m",
      "qwen3.7-max",
      // ── Auto routing ──────────────────────────────────────────────────────
      "auto/bynara",
    ],
    modelsEndpoint: "https://router.bynara.id/v1/models",
    endpoint: "https://router.bynara.id/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    // Rate limit: 10–60 req/min depending on plan; keep concurrency modest
    concurrencyLimit: 4,
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Sakana AI — Fugu ──────────────────────────────────────────────────────
  // OpenAI-compatible. Base URL: https://api.fugu.sakana.ai/v1
  // Two models: fugu-20260615 (balanced) and fugu-ultra-20260615 (max quality).
  // fugu-ultra pricing: $5/$30 per 1M tokens input/output.
  sakana: {
    id: "sakana",
    models: [
      "fugu-20260615",
      "fugu-ultra-20260615",
    ],
    modelsEndpoint: "https://api.fugu.sakana.ai/v1/models",
    endpoint: "https://api.fugu.sakana.ai/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    concurrencyLimit: 2,
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Providers routed via OpenRouter ──────────────────────────────────────
  // All entries below share the same OpenRouter endpoint/auth/body shape.
  // Keys match the `id` field used in manual-key-tester.tsx PRESETS.

  alfredpros: {
    id: "alfredpros",
    models: ["alfredpros/codellama-7b-instruct-solidity"],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  alpindale: {
    id: "alpindale",
    models: ["alpindale/goliath-120b"],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  arizeai: {
    id: "arizeai",
    models: ["arize-ai/qwen-2-1.5b-instruct"],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  "bytedance-seed": {
    id: "bytedance-seed",
    models: [
      "bytedance-seed/seed-2.0-lite",
      "bytedance-seed/seed-2.0-mini",
      "bytedance-seed/seed-1.6",
      "bytedance-seed/seed-1.6-flash",
      "bytedance-seed/seedream-4.0",
      "bytedance-seed/seedream-3.0",
    ],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  eleutherai: {
    id: "eleutherai",
    models: ["eleutherai/llemma_7b"],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  essentialai: {
    id: "essentialai",
    models: ["essentialai/rnj-1-instruct"],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  hidream: {
    id: "hidream",
    models: [
      "hidream-ai/hidream-i1-full",
      "hidream-ai/hidream-i1-dev",
      "hidream-ai/hidream-i1-fast",
    ],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  // ── Kling AI direct (klingai.com) — video / image generation ───────────────
  kling: {
    id: "kling",
    models: [
      "kling-v2.1",
      "kling-v2.0",
      "kling-v1.6",
      "kling-v2-0-image",
    ],
    endpoint: "https://api.klingai.com/v1/videos/text2video",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model = "kling-v2.1") => ({
      model_name: model,
      prompt: DEFAULT_PROMPT,
      aspect_ratio: "16:9",
      duration: "5",
    }),
    extractReply: (data) => {
      const d = data as { data?: { task_id?: string } }
      return d?.data?.task_id ? `task_id: ${d.data.task_id}` : JSON.stringify(data).slice(0, 120)
    },
  },

  // ── Kling via OpenRouter ─────────────────────────────────────────────────────
  "kling-or": {
    id: "kling-or",
    models: [
      "kwaivgi/kling-2.1-master",
      "kwaivgi/kling-2.1-pro",
      "kwaivgi/kling-2.1-standard",
      "kwaivgi/kling-2.0-master",
      "kwaivgi/kling-1.6-pro",
      "kwaivgi/kling-1.6-standard",
    ],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  leonardoai: {
    id: "leonardoai",
    models: [
      "leonardoai/phoenix-1.0",
      "leonardoai/lucid-origin",
    ],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  lykon: {
    id: "lykon",
    models: ["lykon/dreamshaper"],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  meituan: {
    id: "meituan",
    models: ["meituan/longcat-flash-chat"],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  neversleep: {
    id: "neversleep",
    models: [
      "neversleep/llama-3.1-lumimaid-8b",
      "neversleep/noromaid-20b",
    ],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  opengvlab: {
    id: "opengvlab",
    models: ["opengvlab/internvl3-78b"],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  pearlresearch: {
    id: "pearlresearch",
    models: ["pearl-ai/gemma-4-31b-it"],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  pixverse: {
    id: "pixverse",
    models: ["pixverse/pixverse-v5"],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  primeintellect: {
    id: "primeintellect",
    models: ["prime-intellect/intellect-3"],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  raifle: {
    id: "raifle",
    models: ["raifle/sorcererlm-8x22b"],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  rundiffusion: {
    id: "rundiffusion",
    models: [
      "rundiffusion/juggernaut-pro-flux",
      "rundiffusion/juggernaut-lightning-flux",
    ],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  stabilityai: {
    id: "stabilityai",
    models: [
      "stabilityai/stable-diffusion-3-medium",
      "stabilityai/stable-diffusion-xl-base-1.0",
    ],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  tngtech: {
    id: "tngtech",
    models: [
      "tngtech/deepseek-r1t2-chimera",
      "tngtech/tng-r1t-chimera",
      "tngtech/deepseek-r1t-chimera",
    ],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  vidu: {
    id: "vidu",
    models: [
      "vidu/vidu-q1",
      "vidu/vidu-2.0",
    ],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },

  wanai: {
    id: "wanai",
    models: [
      "wan-ai/wan2.7-t2v",
      "wan-ai/wan2.6-image",
      "wan-ai/wan2.2-t2v-a14b",
      "wan-ai/wan2.2-i2v-a14b",
    ],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, "HTTP-Referer": "https://ai-tester.vercel.app", "X-Title": "AI Tester" }),
    extraHeaders: { "Content-Type": "application/json" },
    buildBody: (model, maxTokens = BATCH_MAX_TOKENS) => ({
      model, max_tokens: maxTokens, messages: [{ role: "user", content: DEFAULT_PROMPT }],
    }),
    extractReply: openaiReply,
  },
}

// ── PROVIDER_MODELS — derived from PROVIDER_CONFIGS (single source) ───────────
// Used by multi-key-test/route.ts and the batch UI for the default model display.
// The first model in each provider's array is always the default.

export const PROVIDER_MODELS: Record<string, { id: string; label: string; default?: true }[]> = (() => {
  const result: Record<string, { id: string; label: string; default?: true }[]> = {}
  for (const [id, cfg] of Object.entries(PROVIDER_CONFIGS)) {
    result[id] = cfg.models.map((modelId, idx) => ({
      id: modelId,
      label: modelId.split("/").pop() ?? modelId, // friendly label = last path segment
      ...(idx === 0 ? { default: true as const } : {}),
    }))
  }
  return result
})()

/**
 * Set of provider IDs that expose a live GET /models endpoint.
 * The batch tester uses this to fetch the real model list at runtime
 * instead of the static fallback. The UI uses it to show a "live" badge.
 */
export const PROVIDERS_WITH_LIVE_MODELS: ReadonlySet<string> = new Set(
  Object.entries(PROVIDER_CONFIGS)
    .filter(([, cfg]) => Boolean(cfg.modelsEndpoint))
    .map(([id]) => id),
)

// ── Helpers used by multi-key-test/route.ts ───────────────────────────────────

/** Build the POST body for a single-key multi-key test (uses SINGLE_MAX_TOKENS). */
export function buildProviderBody(provider: string, prompt: string, modelOverride?: string): object {
  const cfg = PROVIDER_CONFIGS[provider]
  if (!cfg) {
    // Unknown provider — generic OpenAI-compat fallback
    return { model: modelOverride ?? "gpt-4o-mini", max_tokens: SINGLE_MAX_TOKENS, messages: [{ role: "user", content: prompt }] }
  }
  const defaultModel = cfg.models[0]
  const model = modelOverride ?? defaultModel
  // Re-use the config's buildBody but with the user's actual prompt and SINGLE_MAX_TOKENS
  const body = cfg.buildBody(model, SINGLE_MAX_TOKENS) as Record<string, unknown>
  // Swap in the real prompt (buildBody uses DEFAULT_PROMPT internally)
  if (Array.isArray(body.messages)) {
    body.messages = [{ role: "user", content: prompt }]
  }
  if (body.input !== undefined) {
    // Responses API (openai, xai)
    if (Array.isArray(body.input)) {
      body.input = [
        ...(body.input as Record<string, unknown>[]).filter((m) => (m as Record<string,unknown>).role === "system"),
        { role: "user", content: prompt },
      ]
    } else {
      body.input = prompt
    }
  }
  if (body.contents !== undefined) {
    // Google Gemini
    body.contents = [{ parts: [{ text: prompt }] }]
  }
  if (body.input && typeof (body as Record<string, unknown>).input === "object" && !Array.isArray((body as Record<string, unknown>).input)) {
    // Replicate
    (body.input as Record<string, unknown>).prompt = prompt
  }
  // IBM uses model_id not model
  if (body.model_id !== undefined) {
    body.model_id = model
    delete body.model
  }
  // Lamini uses model_name + prompt at top level
  if (body.model_name !== undefined) {
    body.model_name = model
    body.prompt = prompt
  }
  return body
}

/** Build auth + content-type headers for a provider. */
export function buildProviderHeaders(provider: string, apiKey: string): Record<string, string> {
  const cfg = PROVIDER_CONFIGS[provider]
  if (!cfg) {
    return { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }
  }
  return {
    ...(cfg.extraHeaders ?? {}),
    ...cfg.authHeader(apiKey),
  }
}

/** Resolve the POST endpoint for a provider + key.
 *  Returns null for providers that need extra config (Cloudflare account ID, Azure resource name).
 */
export function resolveProviderEndpoint(provider: string, apiKey: string): string | null {
  if (provider === "google") {
    const defaultModel = PROVIDER_CONFIGS.google?.models[0] ?? "gemini-2.5-flash"
    return `https://generativelanguage.googleapis.com/v1beta/models/${defaultModel}:generateContent?key=${apiKey}`
  }
  if (provider === "cloudflare") return null // needs account ID
  if (provider === "azure") return null       // needs resource name
  if (provider === "huggingface") {
    const defaultModel = PROVIDER_CONFIGS.huggingface?.models[0] ?? "meta-llama/Llama-3.3-70B-Instruct"
    return `https://api-inference.huggingface.co/models/${defaultModel}/v1/chat/completions`
  }
  const cfg = PROVIDER_CONFIGS[provider]
  if (!cfg || !cfg.endpoint) return null
  return cfg.endpoint
}

// ── Live model fetcher ────────────────────────────────────────────────────────
// Used by /api/fetch-models and batch-test to get the real model list from
// providers that expose a GET /v1/models endpoint (Dahono, OpenAI, Groq, etc.)

export interface LiveModelEntry {
  id: string
  free?: boolean
  tier?: string
}

/**
 * Fetch the live model list for a provider using that provider's own API key.
 * Falls back to the static `cfg.models` list on any error.
 * Returns { models, source: "live" | "static" }.
 */
export async function fetchLiveModels(
  provider: string,
  apiKey: string,
  timeoutMs = 10_000,
): Promise<{ models: LiveModelEntry[]; source: "live" | "static" }> {
  const cfg = PROVIDER_CONFIGS[provider]
  if (!cfg) {
    return { models: [], source: "static" }
  }
  if (!cfg.modelsEndpoint) {
    return {
      models: cfg.models.map((id) => ({ id })),
      source: "static",
    }
  }
  try {
    const headers = { ...cfg.authHeader(apiKey) }
    const res = await fetch(cfg.modelsEndpoint, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    // Parse IDs using provider-specific or default parser
    let ids: string[]
    if (cfg.parseModels) {
      ids = cfg.parseModels(data)
    } else {
      // Default: OpenAI-style { data: [{ id }] }
      // Also handle { object: "list", data: [...] } and { models: [...] }
      const d = data as { data?: { id?: string; object?: string }[]; models?: { id?: string }[] }
      const entries = d?.data ?? d?.models ?? []
      ids = entries
        .map((m) => m.id)
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0 && id !== "unknown")
    }

    // For Dahono, also preserve free/tier metadata
    const dahono = provider === "dahono"
      ? ((data as { data?: { id: string; free?: boolean; tier?: string }[] })?.data ?? [])
      : []

    const models: LiveModelEntry[] = ids.map((id) => {
      if (dahono.length > 0) {
        const meta = dahono.find((m) => m.id === id)
        return { id, free: meta?.free, tier: meta?.tier }
      }
      return { id }
    })

    return { models, source: "live" }
  } catch {
    // Fall back to static list silently
    return {
      models: cfg.models.map((id) => ({ id })),
      source: "static",
    }
  }
}
