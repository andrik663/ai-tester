/**
 * lib/provider-info.ts
 *
 * Static pricing, metadata, and promo flags for every provider in PROVIDER_CONFIGS.
 * Prices are in USD per 1M tokens (input / output) sourced from each provider's
 * public pricing page as of June 2025. Set to null when not publicly listed.
 *
 * "promo" flags mark: free tiers, launch-week discounts, or featured new models.
 * "live" flag means a modelsEndpoint exists — the UI will auto-refresh that list.
 */

export interface ModelPricing {
  id: string
  inputPer1M: number | null   // USD per 1M input tokens  (null = not listed / free)
  outputPer1M: number | null  // USD per 1M output tokens
  contextK: number | null     // context window in thousands of tokens
  promo?: boolean             // launch discount / featured / free-tier
  promoLabel?: string         // e.g. "Free", "50% off", "New"
  deprecated?: boolean
}

export interface ProviderInfo {
  id: string
  name: string
  website: string
  pricingUrl: string
  description: string
  hq: string                  // country / region
  tier: "frontier" | "mid" | "budget" | "gateway" | "specialised"
  hasFreeTier: boolean
  liveModels: boolean         // has modelsEndpoint
  lastUpdated: string         // YYYY-MM-DD — when this entry was last verified
  models: ModelPricing[]
}

// ────────────────────────────────────────────────────────────────────────────
// Helper — build a simple "all null pricing" entry for models without
// published prices (e.g. gateway aggregators or private-beta models)
// ────────────────────────────────────────────────────────────────────────────
function m(
  id: string,
  inputPer1M: number | null,
  outputPer1M: number | null,
  contextK: number | null,
  opts?: { promo?: boolean; promoLabel?: string; deprecated?: boolean },
): ModelPricing {
  return { id, inputPer1M, outputPer1M, contextK, ...opts }
}

// ────────────────────────────────────────────────────────────────────────────
export const PROVIDER_INFO: Record<string, ProviderInfo> = {

  // ── Anthropic ─────────────────────────────────────────────────────────────
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    website: "https://anthropic.com",
    pricingUrl: "https://www.anthropic.com/pricing",
    description: "Safety-focused AI lab. Claude family of models known for long context, instruction following, and coding.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("claude-opus-4-5",              15.00,  75.00,   200,  { promo: true, promoLabel: "New" }),
      m("claude-opus-4-5-20251101",     15.00,  75.00,   200),
      m("claude-sonnet-4-5",             3.00,  15.00,   200,  { promo: true, promoLabel: "New" }),
      m("claude-sonnet-4-5-20251022",    3.00,  15.00,   200),
      m("claude-haiku-4-5",              0.80,   4.00,   200,  { promo: true, promoLabel: "New" }),
      m("claude-haiku-4-5-20251022",     0.80,   4.00,   200),
      m("claude-3-5-sonnet-20241022",    3.00,  15.00,   200),
      m("claude-3-5-haiku-20241022",     0.80,   4.00,   200),
      m("claude-3-opus-20240229",       15.00,  75.00,   200,  { deprecated: true }),
      m("claude-3-haiku-20240307",       0.25,   1.25,   200,  { deprecated: true }),
    ],
  },

  // ── OpenAI ────────────────────────────────────────────────────────────────
  openai: {
    id: "openai",
    name: "OpenAI",
    website: "https://openai.com",
    pricingUrl: "https://platform.openai.com/docs/pricing",
    description: "Creator of GPT and o-series models. Leads in reasoning, coding, and multimodal tasks.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2025-06-01",
    models: [
      m("gpt-5",                       10.00,  40.00, 1000,  { promo: true, promoLabel: "Flagship" }),
      m("gpt-5-mini",                   0.40,   1.60, 1000,  { promo: true, promoLabel: "New" }),
      m("gpt-5-pro",                   75.00, 300.00, 1000),
      m("gpt-5-nano",                   0.10,   0.40, 1000,  { promo: true, promoLabel: "Cheapest" }),
      m("o3-pro",                      20.00,  80.00, 1000),
      m("o3",                           2.00,   8.00, 1000),
      m("o4-mini",                      1.10,   4.40, 1000),
      m("gpt-4.1",                      2.00,   8.00, 1000),
      m("gpt-4.1-mini",                 0.40,   1.60, 1000),
      m("gpt-4.1-nano",                 0.10,   0.40, 1000),
      m("gpt-4o",                       2.50,  10.00,  128),
      m("gpt-4o-mini",                  0.15,   0.60,  128),
      m("gpt-4-turbo",                 10.00,  30.00,  128),
      m("gpt-3.5-turbo",                0.50,   1.50,   16,  { deprecated: true }),
    ],
  },

  // ── Google Gemini ─────────────────────────────────────────────────────────
  google: {
    id: "google",
    name: "Google Gemini",
    website: "https://ai.google.dev",
    pricingUrl: "https://ai.google.dev/pricing",
    description: "Google DeepMind's Gemini family. Excels at multimodal tasks, long context, and grounding.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("gemini-2.5-pro",               1.25,  10.00, 1000,  { promo: true, promoLabel: "Best value" }),
      m("gemini-2.5-flash",             0.30,   2.50, 1000,  { promo: true, promoLabel: "Popular" }),
      m("gemini-2.5-flash-lite",        0.10,   0.40, 1000,  { promo: true, promoLabel: "Free tier" }),
      m("gemini-3-flash",               0.30,   2.50, 1000,  { promo: true, promoLabel: "New" }),
      m("gemini-3.1-pro",               1.25,  10.00, 1000,  { promo: true, promoLabel: "New" }),
      m("gemini-3.5-flash",             0.15,   0.60, 1000,  { promo: true, promoLabel: "New" }),
    ],
  },

  // ── xAI (Grok) ───────────────────────────────────────────────────────────
  xai: {
    id: "xai",
    name: "xAI (Grok)",
    website: "https://x.ai",
    pricingUrl: "https://x.ai/api",
    description: "Elon Musk's xAI lab. Grok models strong at real-time web knowledge and reasoning.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2025-06-01",
    models: [
      m("grok-4.3",                    null,   null,  131,  { promo: true, promoLabel: "New" }),
      m("grok-3",                      3.00,  15.00,  131),
      m("grok-3-fast",                 5.00,  25.00,  131),
      m("grok-3-mini",                 0.30,   0.50,  131),
      m("grok-3-mini-fast",            0.60,   4.00,  131),
    ],
  },

  // ── DeepSeek ─────────────────────────────────────────────────────────────
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    website: "https://deepseek.com",
    pricingUrl: "https://platform.deepseek.com/docs/pricing",
    description: "Chinese frontier lab. DeepSeek models excel at coding and math at extremely low prices.",
    hq: "CN",
    tier: "budget",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2025-06-01",
    models: [
      m("deepseek-chat",               0.27,   1.10, 1000,  { promo: true, promoLabel: "Best price" }),
      m("deepseek-reasoner",           0.55,   2.19, 1000,  { promo: true, promoLabel: "Reasoning" }),
      m("deepseek-v4-flash",           0.14,   0.28, 1000,  { promo: true, promoLabel: "New" }),
      m("deepseek-v4-pro",             0.27,   1.10, 1000,  { promo: true, promoLabel: "New" }),
    ],
  },

  // ── Groq ─────────────────────────────────────────────────────────────────
  groq: {
    id: "groq",
    name: "Groq",
    website: "https://groq.com",
    pricingUrl: "https://console.groq.com/docs/openai",
    description: "Hardware inference company. LPU chips deliver 500–1000 tokens/sec — fastest inference available.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2025-06-01",
    models: [
      m("meta-llama/llama-4-scout-17b-16e-instruct",    0.11,  0.34,  128, { promo: true, promoLabel: "Free tier" }),
      m("meta-llama/llama-4-maverick-17b-128e-instruct",0.20,  0.60,  128, { promo: true, promoLabel: "Free tier" }),
      m("llama-3.3-70b-versatile",                      0.59,  0.79,  128),
      m("llama-3.1-8b-instant",                         0.05,  0.08,  128, { promo: true, promoLabel: "Cheapest" }),
      m("qwen-qwq-32b",                                 0.29,  0.39,  128),
      m("gemma2-9b-it",                                 0.20,  0.20,  128),
      m("deepseek-r1-distill-llama-70b",                0.75,  0.99,  128),
    ],
  },

  // ── Mistral ───────────────────────────────────────────────────────────────
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    website: "https://mistral.ai",
    pricingUrl: "https://mistral.ai/technology/#models",
    description: "European frontier lab. Strong open-weight and API models for code and multilingual tasks.",
    hq: "FR",
    tier: "mid",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2025-06-01",
    models: [
      m("mistral-large-latest",         2.00,   6.00,  128, { promo: true, promoLabel: "Flagship" }),
      m("mistral-medium-latest",        0.40,   2.00,  128),
      m("mistral-small-latest",         0.10,   0.30,  128, { promo: true, promoLabel: "Best value" }),
      m("codestral-latest",             0.30,   0.90,  256),
      m("mistral-nemo",                 0.15,   0.15,  128, { promo: true, promoLabel: "Free tier" }),
      m("open-mistral-7b",              0.25,   0.25,   32),
      m("open-mixtral-8x7b",            0.70,   0.70,   32),
      m("open-mixtral-8x22b",           2.00,   6.00,   64),
    ],
  },

  // ── Cohere ────────────────────────────────────────────────────────────────
  cohere: {
    id: "cohere",
    name: "Cohere",
    website: "https://cohere.com",
    pricingUrl: "https://cohere.com/pricing",
    description: "Enterprise NLP platform. Command family strong at RAG, search, and structured data extraction.",
    hq: "CA",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("command-a-plus-05-2026",       2.50,  10.00,  256, { promo: true, promoLabel: "New" }),
      m("command-r-plus",               2.50,  10.00,  128),
      m("command-r",                    0.15,   0.60,  128),
      m("command-r7b-12-2024",          0.0375, 0.15,  128, { promo: true, promoLabel: "Cheapest" }),
      m("command",                      1.00,   2.00,    4),
      m("command-light",                0.30,   0.60,    4),
    ],
  },

  // ── Perplexity ────────────────────────────────────────────────────────────
  perplexity: {
    id: "perplexity",
    name: "Perplexity",
    website: "https://perplexity.ai",
    pricingUrl: "https://docs.perplexity.ai/docs/pricing",
    description: "AI-powered search and answer engine. Sonar models include live web citations.",
    hq: "US",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("sonar-pro",                    3.00,  15.00,  200, { promo: true, promoLabel: "Web search" }),
      m("sonar",                        1.00,   1.00,  127),
      m("sonar-reasoning-pro",          3.00,  15.00,  127, { promo: true, promoLabel: "Reasoning" }),
      m("sonar-reasoning",              1.00,   5.00,  127),
      m("r1-1776",                      1.00,   5.00,  128),
    ],
  },

  // ── Together AI ───────────────────────────────────────────────────────────
  together: {
    id: "together",
    name: "Together AI",
    website: "https://together.ai",
    pricingUrl: "https://www.together.ai/pricing",
    description: "Open-model cloud. 200+ models at competitive prices with custom fine-tuning support.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2025-06-01",
    models: [
      m("meta-llama/Llama-3.3-70B-Instruct-Turbo",    0.88,  0.88,  131, { promo: true, promoLabel: "Popular" }),
      m("meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",0.18,  0.18,  131, { promo: true, promoLabel: "Cheapest" }),
      m("Qwen/Qwen3-235B-A22B-Instruct-2507-tput",    0.90,  0.90,  256),
      m("deepseek-ai/DeepSeek-V4-Pro",                1.20,  1.20,  128, { promo: true, promoLabel: "New" }),
      m("google/gemma-4-31B-it",                      0.90,  0.90,   32),
    ],
  },

  // ── HuggingFace ───────────────────────────────────────────────────────────
  huggingface: {
    id: "huggingface",
    name: "HuggingFace",
    website: "https://huggingface.co",
    pricingUrl: "https://huggingface.co/pricing",
    description: "Open-source AI hub. Inference API runs 100k+ community models. Free tier available.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("meta-llama/Llama-3.3-70B-Instruct",        null, null,  128, { promo: true, promoLabel: "Free tier" }),
      m("meta-llama/Llama-3.1-8B-Instruct",         null, null,  128, { promo: true, promoLabel: "Free tier" }),
      m("meta-llama/Llama-4-Scout-17B-16E-Instruct",null, null,  128, { promo: true, promoLabel: "New" }),
      m("Qwen/Qwen3-235B-A22B",                      null, null,  128, { promo: true, promoLabel: "Free tier" }),
      m("Qwen/Qwen2.5-72B-Instruct",                 null, null,  128),
      m("mistralai/Mistral-7B-Instruct-v0.3",        null, null,   32),
      m("google/gemma-2-9b-it",                      null, null,    8),
      m("deepseek-ai/DeepSeek-R1-Distill-Llama-70B", null, null,  128),
    ],
  },

  // ── OpenRouter ────────────────────────────────────────────────────────────
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    website: "https://openrouter.ai",
    pricingUrl: "https://openrouter.ai/models",
    description: "Model gateway aggregating 300+ models from all major providers with unified billing.",
    hq: "US",
    tier: "gateway",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("deepseek/deepseek-v4-flash",    0.14,  0.28, 1000, { promo: true, promoLabel: "Cheapest" }),
      m("anthropic/claude-opus-4.7",    15.00, 75.00,  200, { promo: true, promoLabel: "New" }),
      m("google/gemini-2.5-flash",       0.30,  2.50, 1000, { promo: true, promoLabel: "Popular" }),
      m("openai/gpt-5-mini",             0.40,  1.60, 1000),
      m("openai/gpt-oss-120b",          null,  null,  128, { promo: true, promoLabel: "New" }),
      m("mistralai/mistral-nemo",        0.13,  0.13,  128, { promo: true, promoLabel: "Free" }),
    ],
  },

  // ── Fireworks AI ──────────────────────────────────────────────────────────
  fireworks: {
    id: "fireworks",
    name: "Fireworks AI",
    website: "https://fireworks.ai",
    pricingUrl: "https://fireworks.ai/pricing",
    description: "Inference cloud optimised for speed and throughput. Supports PEFT + LoRA fine-tuning.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2025-06-01",
    models: [
      m("accounts/fireworks/models/llama-v3p1-8b-instruct",     0.10, 0.10, 131, { promo: true, promoLabel: "Free tier" }),
      m("accounts/fireworks/models/llama-v3p3-70b-instruct",    0.90, 0.90, 131),
      m("accounts/fireworks/models/deepseek-v4-flash",          0.14, 0.28, 1000, { promo: true, promoLabel: "New" }),
      m("accounts/fireworks/models/deepseek-v4-pro",            0.27, 1.10, 1000),
      m("accounts/fireworks/models/qwen3-235b-a22b",            0.90, 0.90, 128),
      m("accounts/fireworks/models/deepseek-r1",                3.00, 7.00, 128),
    ],
  },

  // ── NVIDIA NIM ────────────────────────────────────────────────────────────
  nvidia: {
    id: "nvidia",
    name: "NVIDIA NIM",
    website: "https://build.nvidia.com",
    pricingUrl: "https://build.nvidia.com/pricing",
    description: "NVIDIA inference microservices. Optimised for NVIDIA hardware with enterprise SLA.",
    hq: "US",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("meta/llama-3.3-70b-instruct",                    0.25, 0.30,  128, { promo: true, promoLabel: "Free tier" }),
      m("meta/llama-3.1-8b-instruct",                     0.10, 0.10,  128, { promo: true, promoLabel: "Free tier" }),
      m("nvidia/llama-3.1-nemotron-70b-instruct",         0.20, 0.20,  128, { promo: true, promoLabel: "NVIDIA" }),
      m("qwen/qwen3-235b-a22b",                           0.60, 0.80,  128),
      m("deepseek-ai/deepseek-r1",                        0.80, 1.80,  128),
      m("mistralai/mistral-7b-instruct-v0.3",             0.10, 0.10,   32),
    ],
  },

  // ── Cerebras ─────────────────────────────────────────────────────────────
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    website: "https://cerebras.ai",
    pricingUrl: "https://cerebras.ai/inference",
    description: "Wafer-scale chip startup. Delivers 2000+ tok/s on Llama — fastest inference for supported models.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("llama3.1-8b",   0.10, 0.10, 128, { promo: true, promoLabel: "2000 tok/s" }),
      m("llama3.3-70b",  0.85, 1.20, 128, { promo: true, promoLabel: "Ultra-fast" }),
      m("qwen3-32b",     0.30, 0.40, 128, { promo: true, promoLabel: "New" }),
    ],
  },

  // ── SambaNova ─────────────────────────────────────────────────────────────
  sambanova: {
    id: "sambanova",
    name: "SambaNova",
    website: "https://sambanova.ai",
    pricingUrl: "https://cloud.sambanova.ai",
    description: "Dataflow architecture for AI. Sub-millisecond latency on large MoE models.",
    hq: "US",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("Meta-Llama-3.3-70B-Instruct",   0.60,  1.20, 128, { promo: true, promoLabel: "Fast" }),
      m("Meta-Llama-3.1-405B-Instruct",  5.00, 10.00, 128),
      m("Qwen3-235B-A22B",               1.20,  2.80, 128, { promo: true, promoLabel: "New" }),
      m("DeepSeek-R1",                   5.00,  7.00, 128),
    ],
  },

  // ── Hyperbolic ────────────────────────────────────────────────────────────
  hyperbolic: {
    id: "hyperbolic",
    name: "Hyperbolic",
    website: "https://hyperbolic.xyz",
    pricingUrl: "https://app.hyperbolic.xyz/models",
    description: "Decentralised GPU marketplace. Competitive pricing on frontier open models.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("meta-llama/Llama-3.3-70B-Instruct",   0.40, 0.40, 128),
      m("meta-llama/Meta-Llama-3.1-70B-Instruct",0.40,0.40, 128),
      m("Qwen/Qwen3-235B-A22B",                 0.60, 0.80, 128, { promo: true, promoLabel: "New" }),
      m("deepseek-ai/DeepSeek-R1",              0.80, 2.40, 128),
    ],
  },

  // ── Novita AI ─────────────────────────────────────────────────────────────
  novita: {
    id: "novita",
    name: "Novita AI",
    website: "https://novita.ai",
    pricingUrl: "https://novita.ai/model-api/pricing",
    description: "GPU cloud for LLM, image, and audio. Competitive pricing with Bytedance SeedDream integration.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2025-06-01",
    models: [
      m("deepseek/deepseek-v4-flash",                0.14, 0.28, 1000, { promo: true, promoLabel: "Cheapest" }),
      m("deepseek/deepseek-v4-pro",                  0.27, 1.10, 1000, { promo: true, promoLabel: "New" }),
      m("meta-llama/llama-4-maverick-17b-128e-instruct-fp8", 0.20, 0.60, 128),
      m("minimax/minimax-m3",                        null, null, 128, { promo: true, promoLabel: "New" }),
    ],
  },

  // ── Cloudflare Workers AI ─────────────────────────────────────────────────
  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    website: "https://developers.cloudflare.com/workers-ai",
    pricingUrl: "https://developers.cloudflare.com/workers-ai/platform/pricing",
    description: "Run AI at the Cloudflare edge — 300+ global PoPs, free Workers AI tier.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("@cf/meta/llama-3.3-70b-instruct-fp8-fast", null, null, 128, { promo: true, promoLabel: "Free tier" }),
      m("@cf/meta/llama-3.1-8b-instruct",           null, null, 128, { promo: true, promoLabel: "Free tier" }),
      m("@cf/qwen/qwen2.5-72b-instruct",            null, null, 128),
      m("@cf/deepseek-ai/deepseek-r1-distill-llama-70b", null, null, 128),
    ],
  },

  // ── Qwen ─────────────────────────────────────────────────────────────────
  qwen: {
    id: "qwen",
    name: "Qwen (Alibaba)",
    website: "https://dashscope.aliyuncs.com",
    pricingUrl: "https://www.alibabacloud.com/en/price/product?spm=a3c0i.11167637.0.0.70403e75VcE2BF#/modelstudio/product",
    description: "Alibaba DAMO Academy. Qwen3 family excels at multilingual, math, and code tasks.",
    hq: "CN",
    tier: "budget",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2025-06-01",
    models: [
      m("qwen3-235b-a22b",         0.22,  0.88, 1000, { promo: true, promoLabel: "MoE flagship" }),
      m("qwen3-32b",               0.14,  0.28,  128, { promo: true, promoLabel: "Popular" }),
      m("qwen3-14b",               0.07,  0.14,  128),
      m("qwen3-8b",                0.035, 0.07,  128, { promo: true, promoLabel: "Cheapest" }),
      m("qwen-max",                1.60,  6.40,   32),
      m("qwen-plus",               0.40,  1.20,  128),
      m("qwen-turbo",              0.05,  0.15,  1000, { promo: true, promoLabel: "Free tier" }),
      m("qwen2.5-72b-instruct",    0.40,  1.20,  128),
    ],
  },

  // ── Zhipu / GLM ───────────────────────────────────────────────────────────
  zhipu: {
    id: "zhipu",
    name: "Zhipu AI (GLM)",
    website: "https://open.bigmodel.cn",
    pricingUrl: "https://open.bigmodel.cn/pricing",
    description: "Tsinghua / Zhipu AI joint lab. GLM-Z1 reasoning models and CogView image generation.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("glm-5.1",       0.30,  0.60, 128, { promo: true, promoLabel: "New" }),
      m("glm-z1-flash",  null,  null, 128, { promo: true, promoLabel: "Free" }),
      m("glm-4-flash",   null,  null, 128, { promo: true, promoLabel: "Free" }),
      m("glm-4-air",     0.14,  0.14, 128),
      m("glm-4-plus",    0.28,  0.28, 128),
    ],
  },

  // ── MiniMax ───────────────────────────────────────────────────────────────
  minimax: {
    id: "minimax",
    name: "MiniMax",
    website: "https://minimax.io",
    pricingUrl: "https://platform.minimaxi.com/document/chatcompletion?key=66701c8f1d57f38758d5818b",
    description: "Shanghai AI. MiniMax-M3 is a state-of-the-art reasoning + multimodal model.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("MiniMax-M3",               0.80, 2.20, 1000, { promo: true, promoLabel: "Flagship" }),
      m("MiniMax-M2.7",             0.60, 2.00,  200, { promo: true, promoLabel: "New" }),
      m("MiniMax-M2.7-highspeed",   0.30, 1.00,  200),
      m("MiniMax-M2.5",             0.30, 1.60,  200),
    ],
  },

  // ── Moonshot (Kimi) ───────────────────────────────────────────────────────
  moonshot: {
    id: "moonshot",
    name: "Moonshot AI (Kimi)",
    website: "https://moonshot.cn",
    pricingUrl: "https://platform.moonshot.cn/docs/pricing/chat",
    description: "Beijing AI. Kimi models specialise in ultra-long context (1M tokens) and coding.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("moonshot-v1-8k",    0.19, 0.19,   8),
      m("moonshot-v1-32k",   0.38, 0.38,  32),
      m("moonshot-v1-128k",  0.75, 0.75, 128, { promo: true, promoLabel: "Long ctx" }),
    ],
  },

  // ── Baidu ERNIE ───────────────────────────────────────────────────────────
  baidu: {
    id: "baidu",
    name: "Baidu ERNIE",
    website: "https://qianfan.cloud.baidu.com",
    pricingUrl: "https://qianfan.cloud.baidu.com/doc/ai-cloud-native/introduction#2",
    description: "Baidu's ERNIE family, widely used across Chinese enterprise applications.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("ernie-4.5-8k",         0.28, 0.28,  8, { promo: true, promoLabel: "New" }),
      m("ernie-4.5-turbo-128k", 0.42, 1.40, 128),
      m("ernie-4.0-8k",         0.42, 1.40,   8),
    ],
  },

  // ── Yi (01.AI) ────────────────────────────────────────────────────────────
  yi: {
    id: "yi",
    name: "01.AI (Yi)",
    website: "https://01.ai",
    pricingUrl: "https://platform.lingyiwanwu.com/docs/api-reference/pricing",
    description: "Kai-Fu Lee's startup. Yi-Lightning is one of the fastest Chinese frontier models.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("yi-lightning",    0.14, 0.14, 16, { promo: true, promoLabel: "Fastest" }),
      m("yi-large",        3.00, 3.00, 32),
      m("yi-large-turbo",  0.12, 0.12, 16),
    ],
  },

  // ── Stepfun ───────────────────────────────────────────────────────────────
  stepfun: {
    id: "stepfun",
    name: "Stepfun",
    website: "https://stepfun.ai",
    pricingUrl: "https://platform.stepfun.com/docs/pricing/step-price",
    description: "Chinese AI startup. Step-3.7-Flash delivers GPT-4-level quality at low cost.",
    hq: "CN",
    tier: "budget",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("step-3.7-flash", 0.14, 0.28, 128, { promo: true, promoLabel: "New" }),
      m("step-2-mini",    0.08, 0.08,  32),
      m("step-2",         0.90, 0.90, 512),
      m("step-1v-32k",    0.38, 0.38,  32),
    ],
  },

  // ── Tencent Hunyuan ───────────────────────────────────────────────────────
  hunyuan: {
    id: "hunyuan",
    name: "Tencent Hunyuan",
    website: "https://hunyuan.tencent.com",
    pricingUrl: "https://cloud.tencent.com/document/product/1729/97731",
    description: "Tencent's LLM platform. Hunyuan-Turbo is a strong all-rounder for Chinese language tasks.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("hunyuan-turbos", 0.07, 0.14,  256, { promo: true, promoLabel: "Free tier" }),
      m("hunyuan-lite",   null, null,   256, { promo: true, promoLabel: "Free" }),
      m("hunyuan-standard",0.07, 0.28, 256),
    ],
  },

  // ── Upstage ───────────────────────────────────────────────────────────────
  upstage: {
    id: "upstage",
    name: "Upstage Solar",
    website: "https://upstage.ai",
    pricingUrl: "https://upstage.ai/solar-llm",
    description: "Korean AI startup. Solar-Pro is a compact high-performance instruction model.",
    hq: "KR",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("solar-pro",  0.20, 0.20, 32),
      m("solar-mini", 0.08, 0.08,  4),
    ],
  },

  // ── Writer ────────────────────────────────────────────────────────────────
  writer: {
    id: "writer",
    name: "Writer (Palmyra)",
    website: "https://writer.com",
    pricingUrl: "https://writer.com/pricing",
    description: "Enterprise writing platform. Palmyra-X5 is optimised for business document tasks.",
    hq: "US",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("palmyra-x5",      0.50, 2.50, 128, { promo: true, promoLabel: "Flagship" }),
      m("palmyra-x5-mini", 0.10, 0.50, 128),
    ],
  },

  // ── AI21 Labs ─────────────────────────────────────────────────────────────
  ai21: {
    id: "ai21",
    name: "AI21 Labs",
    website: "https://ai21.com",
    pricingUrl: "https://www.ai21.com/pricing",
    description: "Israeli AI lab. Jamba is an SSM-Transformer hybrid with 256K context and low latency.",
    hq: "IL",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("jamba-1.6-large", 2.00, 8.00, 256, { promo: true, promoLabel: "256K ctx" }),
      m("jamba-1.6-mini",  0.20, 0.40, 256),
    ],
  },

  // ── Lepton AI ─────────────────────────────────────────────────────────────
  lepton: {
    id: "lepton",
    name: "LeptonAI",
    website: "https://lepton.ai",
    pricingUrl: "https://www.lepton.ai/pricing",
    description: "Developer cloud for open-model inference and fine-tuning.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("llama3.1-8b",  0.07, 0.07, 128, { promo: true, promoLabel: "Free tier" }),
      m("llama3.3-70b", 0.80, 0.80, 128),
    ],
  },

  // ── Deep Infra ────────────────────────────────────────────────────────────
  deepinfra: {
    id: "deepinfra",
    name: "Deep Infra",
    website: "https://deepinfra.com",
    pricingUrl: "https://deepinfra.com/pricing",
    description: "Serverless GPU cloud. Pays-per-token on 50+ open models, no idle costs.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("meta-llama/Meta-Llama-3.1-8B-Instruct",  0.055, 0.055, 128, { promo: true, promoLabel: "Cheapest" }),
      m("meta-llama/Llama-3.3-70B-Instruct-Turbo",0.23,  0.40,  128),
    ],
  },

  // ── Inception Labs (Mercury) ──────────────────────────────────────────────
  inception: {
    id: "inception",
    name: "Inception Labs",
    website: "https://inceptionlabs.ai",
    pricingUrl: "https://inceptionlabs.ai/mercury",
    description: "Diffusion-based LLM startup. Mercury models run in parallel for ultra-low latency coding.",
    hq: "US",
    tier: "specialised",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("mercury-coder",       0.25, 1.00, 32, { promo: true, promoLabel: "Diffusion LLM" }),
      m("mercury-coder-small", 0.06, 0.25, 32),
    ],
  },

  // ── IBM WatsonX ───────────────────────────────────────────────────────────
  ibm: {
    id: "ibm",
    name: "IBM WatsonX",
    website: "https://ibm.com/watsonx",
    pricingUrl: "https://www.ibm.com/products/watsonx-ai/pricing",
    description: "Enterprise AI platform. Granite models are open-weight, safety-tuned for business.",
    hq: "US",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("ibm/granite-3.3-8b-instruct", 0.10, 0.10, 128, { promo: true, promoLabel: "New" }),
      m("ibm/granite-3-8b-instruct",   0.10, 0.10, 128),
    ],
  },

  // ── Anyscale ─────────────────────────────────────────────────────────────
  anyscale: {
    id: "anyscale",
    name: "Anyscale",
    website: "https://anyscale.com",
    pricingUrl: "https://www.anyscale.com/endpoints",
    description: "Ray distributed computing company. Private inference for open models with enterprise SLA.",
    hq: "US",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("meta-llama/Meta-Llama-3.1-8B-Instruct", 0.15, 0.15, 128),
    ],
  },

  // ── Neets AI ─────────────────────────────────────────────────────────────
  neets: {
    id: "neets",
    name: "Neets AI",
    website: "https://neets.ai",
    pricingUrl: "https://neets.ai/pricing",
    description: "Small inference provider with competitive per-token pricing on Llama models.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("meta-llama/Meta-Llama-3-8B-Instruct", 0.10, 0.10, 8),
    ],
  },

  // ── Lamini ───────────────────────────────────────────────────────────────
  lamini: {
    id: "lamini",
    name: "Lamini AI",
    website: "https://lamini.ai",
    pricingUrl: "https://lamini.ai/pricing",
    description: "Fine-tuning-first AI platform. Specialises in memory tuning and private model training.",
    hq: "US",
    tier: "specialised",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("meta-llama/Meta-Llama-3-8B-Instruct", null, null, 8, { promo: true, promoLabel: "Free tier" }),
    ],
  },

  // ── Replicate ─────────────────────────────────────────────────────────────
  replicate: {
    id: "replicate",
    name: "Replicate",
    website: "https://replicate.com",
    pricingUrl: "https://replicate.com/pricing",
    description: "Run open-source ML models via API. Best for image/video gen and niche community models.",
    hq: "US",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("meta/meta-llama-3-8b-instruct", 0.05, 0.25, 8),
    ],
  },

  // ── Dahono Labs Gateway ───────────────────────────────────────────────────
  dahono: {
    id: "dahono",
    name: "Dahono Labs Gateway",
    website: "https://gateway.dahono.com",
    pricingUrl: "https://gateway.dahono.com",
    description: "Indonesian AI gateway aggregating 70+ models from major providers with unified billing and free tier.",
    hq: "ID",
    tier: "gateway",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2025-06-01",
    models: [
      m("dahono/deepseek-v4-flash",   null, null, 1000, { promo: true, promoLabel: "Free" }),
      m("dahono/gemini-2.5-flash",    null, null, 1000, { promo: true, promoLabel: "Free" }),
      m("dahono/gpt-4o-mini",         null, null,  128, { promo: true, promoLabel: "Free" }),
      m("dahono/claude-haiku-4-5",    null, null,  200, { promo: true, promoLabel: "Free" }),
    ],
  },

  // ── Azure OpenAI ─────────────────────────────────────────────────────────
  azure: {
    id: "azure",
    name: "Azure OpenAI",
    website: "https://azure.microsoft.com/en-us/products/ai-services/openai-service",
    pricingUrl: "https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service",
    description: "OpenAI models hosted on Azure with enterprise compliance, VNet, and regional deployments.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-01",
    models: [
      m("gpt-4o",      2.50, 10.00, 128),
      m("gpt-4o-mini", 0.15,  0.60, 128),
    ],
  },
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/** All providers sorted: frontier → mid → budget → gateway → specialised, then alpha */
export const PROVIDER_INFO_LIST: ProviderInfo[] = (() => {
  const tierOrder = { frontier: 0, mid: 1, budget: 2, gateway: 3, specialised: 4 }
  return Object.values(PROVIDER_INFO).sort((a, b) => {
    const td = tierOrder[a.tier] - tierOrder[b.tier]
    if (td !== 0) return td
    return a.name.localeCompare(b.name)
  })
})()

/** All promo models across all providers, most recently updated first */
export const ALL_PROMO_MODELS: Array<{ provider: ProviderInfo; model: ModelPricing }> = (() => {
  const result: Array<{ provider: ProviderInfo; model: ModelPricing }> = []
  for (const provider of PROVIDER_INFO_LIST) {
    for (const model of provider.models) {
      if (model.promo && !model.deprecated) {
        result.push({ provider, model })
      }
    }
  }
  return result
})()

/** Tier badge colours for use in components */
export const TIER_META: Record<ProviderInfo["tier"], { label: string; className: string }> = {
  frontier:   { label: "Frontier",   className: "text-violet-400 bg-violet-400/10 border-violet-400/20" },
  mid:        { label: "Mid-tier",   className: "text-sky-400 bg-sky-400/10 border-sky-400/20" },
  budget:     { label: "Budget",     className: "text-green-400 bg-green-400/10 border-green-400/20" },
  gateway:    { label: "Gateway",    className: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  specialised:{ label: "Specialised",className: "text-rose-400 bg-rose-400/10 border-rose-400/20" },
}

/** Format price: "$0.27" or "Free" */
export function formatPrice(price: number | null): string {
  if (price === null) return "—"
  if (price === 0) return "Free"
  if (price < 0.01) return `$${(price * 1000).toFixed(2)}/B`
  return `$${price.toFixed(price < 1 ? 3 : 2)}`
}
