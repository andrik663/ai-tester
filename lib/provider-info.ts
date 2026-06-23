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
  promoLink?: string          // direct link to blog post, docs, or pricing for this model
  deprecated?: boolean
}

export interface ProviderInfo {
  id: string
  name: string
  website: string
  pricingUrl: string
  docsUrl?: string            // API docs link
  statusUrl?: string          // status page / uptime link
  changelogUrl?: string       // release notes / model release blog
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
  opts?: { promo?: boolean; promoLabel?: string; promoLink?: string; deprecated?: boolean },
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
    docsUrl: "https://docs.anthropic.com",
    statusUrl: "https://status.anthropic.com",
    changelogUrl: "https://docs.anthropic.com/en/release-notes/api",
    description: "Safety-focused AI lab. Claude 4 family — Opus, Sonnet, Haiku — known for long context, instruction following, and coding.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("claude-opus-4-5",           15.00, 75.00, 200, { promo: true, promoLabel: "Flagship", promoLink: "https://www.anthropic.com/claude/opus" }),
      m("claude-sonnet-4-5",          3.00, 15.00, 200, { promo: true, promoLabel: "Popular",  promoLink: "https://www.anthropic.com/claude/sonnet" }),
      m("claude-haiku-4-5",           0.80,  4.00, 200, { promo: true, promoLabel: "Fastest",  promoLink: "https://www.anthropic.com/claude/haiku" }),
      m("claude-3-5-sonnet-20241022", 3.00, 15.00, 200),
      m("claude-3-5-haiku-20241022",  0.80,  4.00, 200),
      m("claude-3-opus-20240229",    15.00, 75.00, 200, { deprecated: true }),
      m("claude-3-haiku-20240307",    0.25,  1.25, 200, { deprecated: true }),
    ],
  },

  // ── OpenAI ────────────────────────────────────────────────────────────────
  openai: {
    id: "openai",
    name: "OpenAI",
    website: "https://openai.com",
    pricingUrl: "https://platform.openai.com/docs/pricing",
    docsUrl: "https://platform.openai.com/docs",
    statusUrl: "https://status.openai.com",
    changelogUrl: "https://platform.openai.com/docs/changelog",
    description: "Creator of GPT-5 and o-series reasoning models. Leads in coding, multimodal, and long-context tasks.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2025-06-23",
    models: [
      m("gpt-5",        10.00,  40.00, 1000, { promo: true, promoLabel: "Flagship", promoLink: "https://openai.com/index/gpt-5/" }),
      m("gpt-5-mini",    0.40,   1.60, 1000, { promo: true, promoLabel: "Best value", promoLink: "https://openai.com/index/gpt-5-mini/" }),
      m("gpt-5-nano",    0.10,   0.40, 1000, { promo: true, promoLabel: "Cheapest",   promoLink: "https://platform.openai.com/docs/pricing" }),
      m("gpt-5-pro",    75.00, 300.00, 1000),
      m("o3-pro",       20.00,  80.00, 1000, { promo: true, promoLabel: "Reasoning",  promoLink: "https://openai.com/index/o3-and-o4-mini/" }),
      m("o3",            2.00,   8.00, 1000),
      m("o4-mini",       1.10,   4.40, 1000),
      m("gpt-4.1",       2.00,   8.00, 1000),
      m("gpt-4.1-mini",  0.40,   1.60, 1000),
      m("gpt-4.1-nano",  0.10,   0.40, 1000),
      m("gpt-4o",        2.50,  10.00,  128),
      m("gpt-4o-mini",   0.15,   0.60,  128),
      m("gpt-3.5-turbo", 0.50,   1.50,   16, { deprecated: true }),
    ],
  },

  // ── Google Gemini ─────────────────────────────────────────────────────────
  google: {
    id: "google",
    name: "Google Gemini",
    website: "https://ai.google.dev",
    pricingUrl: "https://ai.google.dev/pricing",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    statusUrl: "https://status.ai.google.dev",
    changelogUrl: "https://ai.google.dev/gemini-api/docs/changelog",
    description: "Google DeepMind's Gemini 2.5 family. Excels at multimodal tasks, long context, and grounding with free tier.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("gemini-2.5-pro",        1.25, 10.00, 1000, { promo: true, promoLabel: "Best value", promoLink: "https://ai.google.dev/gemini-api/docs/models/gemini#gemini-2.5-pro" }),
      m("gemini-2.5-flash",      0.30,  2.50, 1000, { promo: true, promoLabel: "Popular",    promoLink: "https://ai.google.dev/gemini-api/docs/models/gemini#gemini-2.5-flash" }),
      m("gemini-2.5-flash-lite", 0.10,  0.40, 1000, { promo: true, promoLabel: "Free tier",  promoLink: "https://ai.google.dev/pricing" }),
      m("gemini-2.0-flash",      0.10,  0.40, 1000),
      m("gemini-1.5-pro",        1.25,  5.00,  128),
      m("gemini-1.5-flash",      0.075, 0.30,  128, { deprecated: true }),
    ],
  },

  // ── xAI (Grok) ───────────────────────────────────────────────────────────
  xai: {
    id: "xai",
    name: "xAI (Grok)",
    website: "https://x.ai",
    pricingUrl: "https://x.ai/api",
    docsUrl: "https://docs.x.ai",
    changelogUrl: "https://x.ai/blog",
    description: "Elon Musk's xAI lab. Grok-3 family strong at real-time web knowledge, vision, and reasoning.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2025-06-23",
    models: [
      m("grok-3",          3.00, 15.00, 131, { promo: true, promoLabel: "Flagship",  promoLink: "https://x.ai/blog/grok-3" }),
      m("grok-3-mini",     0.30,  0.50, 131, { promo: true, promoLabel: "Best value",promoLink: "https://x.ai/blog/grok-3" }),
      m("grok-3-fast",     5.00, 25.00, 131),
      m("grok-3-mini-fast",0.60,  4.00, 131),
      m("grok-2-1212",     2.00, 10.00, 131),
    ],
  },

  // ── DeepSeek ─────────────────────────────────────────────────────────────
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    website: "https://deepseek.com",
    pricingUrl: "https://platform.deepseek.com/docs/pricing",
    docsUrl: "https://platform.deepseek.com/docs",
    changelogUrl: "https://api-docs.deepseek.com/news/",
    description: "Chinese frontier lab. DeepSeek-V3 and R1 excel at coding and math at 10-100x lower price than US providers.",
    hq: "CN",
    tier: "budget",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2025-06-23",
    models: [
      m("deepseek-chat",     0.27, 1.10, 64, { promo: true, promoLabel: "Best price", promoLink: "https://platform.deepseek.com/docs/pricing" }),
      m("deepseek-reasoner", 0.55, 2.19, 64, { promo: true, promoLabel: "Reasoning",  promoLink: "https://api-docs.deepseek.com/news/news1120" }),
    ],
  },

  // ── Groq ─────────────────────────────────────────────────────────────────
  groq: {
    id: "groq",
    name: "Groq",
    website: "https://groq.com",
    pricingUrl: "https://groq.com/pricing/",
    docsUrl: "https://console.groq.com/docs",
    statusUrl: "https://groqstatus.com",
    changelogUrl: "https://console.groq.com/docs/changelog",
    description: "LPU hardware company. 500–1500 tok/s on Llama 4 and Qwen3 — fastest publicly available inference.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2025-06-23",
    models: [
      m("meta-llama/llama-4-scout-17b-16e-instruct",     0.11, 0.34, 128, { promo: true, promoLabel: "Free tier",  promoLink: "https://groq.com/pricing/" }),
      m("meta-llama/llama-4-maverick-17b-128e-instruct", 0.20, 0.60, 128, { promo: true, promoLabel: "Free tier",  promoLink: "https://groq.com/pricing/" }),
      m("llama-3.3-70b-versatile",                       0.59, 0.79, 128),
      m("llama-3.1-8b-instant",                          0.05, 0.08, 128, { promo: true, promoLabel: "Cheapest",   promoLink: "https://groq.com/pricing/" }),
      m("qwen-qwq-32b",                                  0.29, 0.39, 128, { promo: true, promoLabel: "Reasoning",  promoLink: "https://console.groq.com/docs/openai" }),
      m("compound-beta",                                  null, null, 128, { promo: true, promoLabel: "Web search",  promoLink: "https://console.groq.com/docs/agentic-tooling" }),
      m("deepseek-r1-distill-llama-70b",                 0.75, 0.99, 128),
    ],
  },

  // ── Mistral ───────────────────────────────────────────────────────────────
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    website: "https://mistral.ai",
    pricingUrl: "https://mistral.ai/technology/#models",
    docsUrl: "https://docs.mistral.ai",
    statusUrl: "https://status.mistral.ai",
    changelogUrl: "https://mistral.ai/news/",
    description: "European frontier lab. Mistral Large 2, Codestral, and Mistral Nemo (free tier) for code and multilingual.",
    hq: "FR",
    tier: "mid",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2025-06-23",
    models: [
      m("mistral-large-latest",   2.00, 6.00, 128, { promo: true, promoLabel: "Flagship",   promoLink: "https://mistral.ai/news/mistral-large-2407/" }),
      m("mistral-small-latest",   0.10, 0.30, 128, { promo: true, promoLabel: "Best value", promoLink: "https://mistral.ai/technology/#models" }),
      m("codestral-latest",       0.30, 0.90, 256, { promo: true, promoLabel: "Coding",     promoLink: "https://mistral.ai/news/codestral/" }),
      m("mistral-medium-latest",  0.40, 2.00, 128),
      m("mistral-nemo",           0.15, 0.15, 128, { promo: true, promoLabel: "Free tier",  promoLink: "https://mistral.ai/news/mistral-nemo/" }),
      m("open-mistral-7b",        0.25, 0.25,  32),
      m("open-mixtral-8x22b",     2.00, 6.00,  64),
    ],
  },

  // ── Cohere ────────────────────────────────────────────────────────────────
  cohere: {
    id: "cohere",
    name: "Cohere",
    website: "https://cohere.com",
    pricingUrl: "https://cohere.com/pricing",
    docsUrl: "https://docs.cohere.com",
    changelogUrl: "https://docs.cohere.com/changelog",
    description: "Enterprise NLP platform. Command R+ strong at RAG, search, and structured data extraction.",
    hq: "CA",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("command-r-plus-08-2024",  2.50, 10.00, 128, { promo: true, promoLabel: "Flagship",  promoLink: "https://docs.cohere.com/docs/command-r-plus" }),
      m("command-r-08-2024",       0.15,  0.60, 128, { promo: true, promoLabel: "Best value",promoLink: "https://docs.cohere.com/docs/command-r" }),
      m("command-r7b-12-2024",     0.04,  0.15, 128, { promo: true, promoLabel: "Cheapest",  promoLink: "https://cohere.com/pricing" }),
      m("command-a-03-2025",       2.50, 10.00, 256, { promo: true, promoLabel: "New",       promoLink: "https://cohere.com/blog/command-a" }),
      m("command",                 1.00,  2.00,   4),
    ],
  },

  // ── Perplexity ────────────────────────────────────────────────────────────
  perplexity: {
    id: "perplexity",
    name: "Perplexity",
    website: "https://perplexity.ai",
    pricingUrl: "https://docs.perplexity.ai/docs/pricing",
    docsUrl: "https://docs.perplexity.ai",
    changelogUrl: "https://docs.perplexity.ai/changelog",
    description: "AI-powered search and answer engine. Sonar models include live web citations and grounding.",
    hq: "US",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("sonar-pro",            3.00, 15.00, 200, { promo: true, promoLabel: "Web search", promoLink: "https://docs.perplexity.ai/docs/sonar-pro" }),
      m("sonar-reasoning-pro",  3.00, 15.00, 127, { promo: true, promoLabel: "Reasoning",  promoLink: "https://docs.perplexity.ai/docs/sonar-reasoning-pro" }),
      m("sonar-reasoning",      1.00,  5.00, 127),
      m("sonar",                1.00,  1.00, 127),
      m("r1-1776",              1.00,  5.00, 128),
    ],
  },

  // ── Together AI ───────────────────────────────────────────────────────────
  together: {
    id: "together",
    name: "Together AI",
    website: "https://together.ai",
    pricingUrl: "https://www.together.ai/pricing",
    docsUrl: "https://docs.together.ai",
    changelogUrl: "https://www.together.ai/blog",
    description: "Open-model cloud with 200+ models. Competitive pay-per-token pricing with fine-tuning support.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2025-06-23",
    models: [
      m("meta-llama/Llama-3.3-70B-Instruct-Turbo",     0.88, 0.88, 131, { promo: true, promoLabel: "Popular",    promoLink: "https://www.together.ai/pricing" }),
      m("meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", 0.18, 0.18, 131, { promo: true, promoLabel: "Cheapest",   promoLink: "https://www.together.ai/pricing" }),
      m("Qwen/Qwen3-235B-A22B",                         0.90, 0.90, 256, { promo: true, promoLabel: "New",        promoLink: "https://www.together.ai/blog/qwen3" }),
      m("deepseek-ai/DeepSeek-V3",                      0.90, 0.90, 128),
      m("meta-llama/Llama-4-Scout-17B-16E-Instruct",    0.18, 0.18, 128),
    ],
  },

  // ── HuggingFace ───────────────────────────────────────────────────────────
  huggingface: {
    id: "huggingface",
    name: "HuggingFace",
    website: "https://huggingface.co",
    pricingUrl: "https://huggingface.co/pricing",
    docsUrl: "https://huggingface.co/docs/inference-providers",
    changelogUrl: "https://huggingface.co/blog",
    description: "Open-source AI hub. Inference Providers API runs 100k+ community models with a generous free tier.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("meta-llama/Llama-3.3-70B-Instruct",         null, null, 128, { promo: true, promoLabel: "Free tier",  promoLink: "https://huggingface.co/pricing" }),
      m("meta-llama/Llama-4-Scout-17B-16E-Instruct",  null, null, 128, { promo: true, promoLabel: "New",        promoLink: "https://huggingface.co/blog/llama4-release" }),
      m("Qwen/Qwen3-235B-A22B",                       null, null, 128, { promo: true, promoLabel: "Free tier",  promoLink: "https://huggingface.co/Qwen/Qwen3-235B-A22B" }),
      m("meta-llama/Llama-3.1-8B-Instruct",           null, null, 128, { promo: true, promoLabel: "Free tier" }),
      m("mistralai/Mistral-7B-Instruct-v0.3",          null, null,  32),
      m("google/gemma-2-9b-it",                        null, null,   8),
    ],
  },

  // ── OpenRouter ────────────────────────────────────────────────────────────
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    website: "https://openrouter.ai",
    pricingUrl: "https://openrouter.ai/models",
    docsUrl: "https://openrouter.ai/docs",
    changelogUrl: "https://openrouter.ai/changelog",
    description: "Unified gateway to 300+ models from every major provider. Free models available, track spend per model.",
    hq: "US",
    tier: "gateway",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("deepseek/deepseek-chat-v3-0324",  0.27, 1.10, 64,   { promo: true, promoLabel: "Best price", promoLink: "https://openrouter.ai/deepseek/deepseek-chat-v3-0324" }),
      m("anthropic/claude-sonnet-4-5",     3.00, 15.00, 200,  { promo: true, promoLabel: "Popular",    promoLink: "https://openrouter.ai/anthropic/claude-sonnet-4-5" }),
      m("google/gemini-2.5-flash",         0.30,  2.50, 1000, { promo: true, promoLabel: "Fast",       promoLink: "https://openrouter.ai/google/gemini-2.5-flash" }),
      m("openai/gpt-5",                   10.00, 40.00, 1000, { promo: true, promoLabel: "New",        promoLink: "https://openrouter.ai/openai/gpt-5" }),
      m("meta-llama/llama-3.3-70b-instruct:free", null, null, 128, { promo: true, promoLabel: "Free",  promoLink: "https://openrouter.ai/models?q=free" }),
      m("mistralai/mistral-nemo",          0.13,  0.13, 128),
    ],
  },

  // ── Fireworks AI ──────────────────────────────────────────────────────────
  fireworks: {
    id: "fireworks",
    name: "Fireworks AI",
    website: "https://fireworks.ai",
    pricingUrl: "https://fireworks.ai/pricing",
    docsUrl: "https://docs.fireworks.ai",
    changelogUrl: "https://fireworks.ai/blog",
    description: "Inference cloud for open models. Optimised for throughput; supports PEFT + LoRA fine-tuning.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2025-06-23",
    models: [
      m("accounts/fireworks/models/llama4-scout-instruct-basic",  0.15, 0.60, 128, { promo: true, promoLabel: "New",      promoLink: "https://fireworks.ai/blog/llama4" }),
      m("accounts/fireworks/models/llama-v3p1-8b-instruct",       0.10, 0.10, 131, { promo: true, promoLabel: "Free tier",promoLink: "https://fireworks.ai/pricing" }),
      m("accounts/fireworks/models/deepseek-v3",                  0.90, 0.90, 128),
      m("accounts/fireworks/models/qwen3-235b-a22b",              0.90, 0.90, 128),
      m("accounts/fireworks/models/deepseek-r1",                  3.00, 7.00, 128),
    ],
  },

  // ── NVIDIA NIM ────────────────────────────────────────────────────────────
  nvidia: {
    id: "nvidia",
    name: "NVIDIA NIM",
    website: "https://build.nvidia.com",
    pricingUrl: "https://build.nvidia.com/pricing",
    docsUrl: "https://docs.nvidia.com/nim/",
    changelogUrl: "https://developer.nvidia.com/blog/tag/nim/",
    description: "NVIDIA inference microservices. Optimised for H100/H200, enterprise SLA, free trial credits.",
    hq: "US",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("meta/llama-3.3-70b-instruct",               0.25, 0.30, 128, { promo: true, promoLabel: "Free tier",  promoLink: "https://build.nvidia.com/meta/llama-3_3-70b-instruct" }),
      m("nvidia/llama-3.1-nemotron-ultra-253b-v1",   0.75, 0.75, 128, { promo: true, promoLabel: "New",        promoLink: "https://build.nvidia.com/nvidia/llama-3_1-nemotron-ultra-253b-v1" }),
      m("qwen/qwen3-235b-a22b",                      0.60, 0.80, 128, { promo: true, promoLabel: "Popular",    promoLink: "https://build.nvidia.com/qwen/qwen3-235b-a22b" }),
      m("deepseek-ai/deepseek-r1",                   0.80, 1.80, 128),
      m("meta/llama-3.1-8b-instruct",                0.10, 0.10, 128, { promo: true, promoLabel: "Free tier" }),
    ],
  },

  // ── Cerebras ─────────────────────────────────────────────────────────────
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    website: "https://cerebras.ai",
    pricingUrl: "https://cerebras.ai/inference",
    docsUrl: "https://inference-docs.cerebras.ai",
    changelogUrl: "https://cerebras.ai/blog/",
    description: "Wafer-scale chip startup. 2000+ tok/s on Llama 3.3 and Qwen3 — world's fastest public inference.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("llama-3.3-70b", 0.85, 1.20, 128, { promo: true, promoLabel: "Ultra-fast",  promoLink: "https://cerebras.ai/inference" }),
      m("qwen3-32b",     0.30, 0.40, 128, { promo: true, promoLabel: "New",         promoLink: "https://cerebras.ai/blog/qwen3-on-cerebras" }),
      m("llama3.1-8b",   0.10, 0.10, 128, { promo: true, promoLabel: "2000+ tok/s" }),
    ],
  },

  // ── SambaNova ─────────────────────────────────────────────────────────────
  sambanova: {
    id: "sambanova",
    name: "SambaNova",
    website: "https://sambanova.ai",
    pricingUrl: "https://cloud.sambanova.ai",
    docsUrl: "https://docs.sambanova.ai",
    changelogUrl: "https://sambanova.ai/blog",
    description: "SN40L dataflow chip. Sub-millisecond TTFT on 405B-class models with free tier.",
    hq: "US",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("Meta-Llama-3.3-70B-Instruct",  0.60,  1.20, 128, { promo: true, promoLabel: "Fast",   promoLink: "https://cloud.sambanova.ai" }),
      m("Qwen3-235B-A22B",              1.20,  2.80, 128, { promo: true, promoLabel: "New",    promoLink: "https://sambanova.ai/blog" }),
      m("Meta-Llama-3.1-405B-Instruct", 5.00, 10.00, 128),
      m("DeepSeek-R1",                  5.00,  7.00, 128),
    ],
  },

  // ── Hyperbolic ────────────────────────────────────────────────────────────
  hyperbolic: {
    id: "hyperbolic",
    name: "Hyperbolic",
    website: "https://hyperbolic.xyz",
    pricingUrl: "https://app.hyperbolic.xyz/models",
    docsUrl: "https://docs.hyperbolic.xyz",
    changelogUrl: "https://hyperbolic.xyz/blog",
    description: "Decentralised GPU marketplace. Competitive pricing on DeepSeek, Qwen3, and Llama open models.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("Qwen/Qwen3-235B-A22B",                   0.60, 0.80, 128, { promo: true, promoLabel: "New",    promoLink: "https://app.hyperbolic.xyz/models" }),
      m("deepseek-ai/DeepSeek-R1",                0.80, 2.40, 128, { promo: true, promoLabel: "Popular",promoLink: "https://app.hyperbolic.xyz/models/deepseek-r1" }),
      m("meta-llama/Llama-3.3-70B-Instruct",      0.40, 0.40, 128),
      m("meta-llama/Meta-Llama-3.1-70B-Instruct", 0.40, 0.40, 128),
    ],
  },

  // ── Novita AI ─────────────────────────────────────────────────────────────
  novita: {
    id: "novita",
    name: "Novita AI",
    website: "https://novita.ai",
    pricingUrl: "https://novita.ai/model-api/pricing",
    docsUrl: "https://novita.ai/docs",
    changelogUrl: "https://novita.ai/blog",
    description: "GPU cloud for LLM, image, and audio inference. Balance API included; competitive per-token pricing.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2025-06-23",
    models: [
      m("deepseek/deepseek-v3-0324",                          0.38, 0.88, 64,  { promo: true, promoLabel: "Best price",promoLink: "https://novita.ai/model-api/pricing" }),
      m("meta-llama/llama-4-maverick-17b-128e-instruct-fp8",  0.20, 0.60, 128, { promo: true, promoLabel: "New",       promoLink: "https://novita.ai/blog" }),
      m("deepseek/deepseek-r1",                               0.55, 2.19, 64),
    ],
  },

  // ── Cloudflare Workers AI ─────────────────────────────────────────────────
  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    website: "https://developers.cloudflare.com/workers-ai",
    pricingUrl: "https://developers.cloudflare.com/workers-ai/platform/pricing",
    docsUrl: "https://developers.cloudflare.com/workers-ai/",
    changelogUrl: "https://developers.cloudflare.com/workers-ai/changelog/",
    description: "Run AI at the Cloudflare edge. 300+ global PoPs, free tier on 10k neurons/day.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("@cf/meta/llama-3.3-70b-instruct-fp8-fast",        null, null, 128, { promo: true, promoLabel: "Free tier", promoLink: "https://developers.cloudflare.com/workers-ai/platform/pricing" }),
      m("@cf/meta/llama-3.1-8b-instruct",                  null, null, 128, { promo: true, promoLabel: "Free tier" }),
      m("@cf/deepseek-ai/deepseek-r1-distill-llama-70b",   null, null, 128),
      m("@cf/qwen/qwen2.5-72b-instruct",                   null, null, 128),
    ],
  },

  // ── Qwen ─────────────────────────────────────────────────────────────────
  qwen: {
    id: "qwen",
    name: "Qwen (Alibaba)",
    website: "https://dashscope.aliyuncs.com",
    pricingUrl: "https://help.aliyun.com/zh/model-studio/getting-started/models",
    docsUrl: "https://help.aliyun.com/zh/model-studio/",
    changelogUrl: "https://qwenlm.github.io/blog/",
    description: "Alibaba DAMO Academy. Qwen3 (235B MoE) leads Chinese open-model benchmarks. Free tier on Turbo.",
    hq: "CN",
    tier: "budget",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2025-06-23",
    models: [
      m("qwen3-235b-a22b",   0.22, 0.88, 1000, { promo: true, promoLabel: "MoE flagship", promoLink: "https://qwenlm.github.io/blog/qwen3/" }),
      m("qwen3-32b",         0.14, 0.28,  128, { promo: true, promoLabel: "Popular",      promoLink: "https://qwenlm.github.io/blog/qwen3/" }),
      m("qwen3-8b",          0.035,0.07,  128, { promo: true, promoLabel: "Cheapest" }),
      m("qwen-turbo",        0.05, 0.15, 1000, { promo: true, promoLabel: "Free tier",    promoLink: "https://help.aliyun.com/zh/model-studio/getting-started/models" }),
      m("qwen-max",          1.60, 6.40,   32),
      m("qwen-plus",         0.40, 1.20,  128),
      m("qwen2.5-72b-instruct",0.40,1.20,  128),
    ],
  },

  // ── Zhipu / GLM ───────────────────────────────────────────────────────────
  zhipu: {
    id: "zhipu",
    name: "Zhipu AI (GLM)",
    website: "https://open.bigmodel.cn",
    pricingUrl: "https://open.bigmodel.cn/pricing",
    docsUrl: "https://open.bigmodel.cn/dev/api",
    changelogUrl: "https://open.bigmodel.cn/news",
    description: "Tsinghua / Zhipu AI joint lab. GLM-4 family with free Flash tier and CogView image generation.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("glm-4-plus",   0.28, 0.28, 128, { promo: true, promoLabel: "Flagship",  promoLink: "https://open.bigmodel.cn/pricing" }),
      m("glm-4-flash",  null, null, 128, { promo: true, promoLabel: "Free",      promoLink: "https://open.bigmodel.cn/pricing" }),
      m("glm-4-air",    0.14, 0.14, 128),
      m("glm-z1-flash", null, null, 128, { promo: true, promoLabel: "Reasoning", promoLink: "https://open.bigmodel.cn/pricing" }),
    ],
  },

  // ── MiniMax ───────────────────────────────────────────────────────────────
  minimax: {
    id: "minimax",
    name: "MiniMax",
    website: "https://minimax.io",
    pricingUrl: "https://platform.minimaxi.com/document/Announcement",
    docsUrl: "https://platform.minimaxi.com/document/ChatCompletion%20v2",
    changelogUrl: "https://platform.minimaxi.com/document/Announcement",
    description: "Shanghai AI. MiniMax-M1 is a reasoning + multimodal MoE model with 1M context.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("MiniMax-M1",            0.80, 2.20, 1000, { promo: true, promoLabel: "Flagship", promoLink: "https://platform.minimaxi.com/document/Announcement" }),
      m("MiniMax-Text-01",       0.30, 1.60,  256, { promo: true, promoLabel: "Long ctx", promoLink: "https://platform.minimaxi.com/document/Announcement" }),
      m("abab6.5s-chat",         0.10, 0.10,  245),
    ],
  },

  // ── Moonshot (Kimi) ───────────────────────────────────────────────────────
  moonshot: {
    id: "moonshot",
    name: "Moonshot AI (Kimi)",
    website: "https://moonshot.cn",
    pricingUrl: "https://platform.moonshot.cn/docs/pricing/chat",
    docsUrl: "https://platform.moonshot.cn/docs",
    changelogUrl: "https://moonshot.cn/news",
    description: "Beijing AI. Kimi models specialise in ultra-long context (1M tokens), coding, and vision.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("moonshot-v1-128k", 0.75, 0.75, 128, { promo: true, promoLabel: "Long ctx", promoLink: "https://platform.moonshot.cn/docs/pricing/chat" }),
      m("moonshot-v1-32k",  0.38, 0.38,  32),
      m("moonshot-v1-8k",   0.19, 0.19,   8),
    ],
  },

  // ── Baidu ERNIE ───────────────────────────────────────────────────────────
  baidu: {
    id: "baidu",
    name: "Baidu ERNIE",
    website: "https://qianfan.cloud.baidu.com",
    pricingUrl: "https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Blfmc9dlf",
    docsUrl: "https://cloud.baidu.com/doc/WENXINWORKSHOP/index.html",
    changelogUrl: "https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Zm2jvzmqf",
    description: "Baidu's ERNIE 4.5 family. Free lite tier, widely used in Chinese enterprise applications.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("ernie-4.5-turbo-128k", 0.42, 1.40, 128, { promo: true, promoLabel: "New",      promoLink: "https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Blfmc9dlf" }),
      m("ernie-4.5-8k",         0.28, 0.28,   8, { promo: true, promoLabel: "Popular",  promoLink: "https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Blfmc9dlf" }),
      m("ernie-lite-8k",        null, null,   8, { promo: true, promoLabel: "Free tier" }),
    ],
  },

  // ── Yi (01.AI) ────────────────────────────────────────────────────────────
  yi: {
    id: "yi",
    name: "01.AI (Yi)",
    website: "https://01.ai",
    pricingUrl: "https://platform.lingyiwanwu.com/docs/api-reference/pricing",
    docsUrl: "https://platform.lingyiwanwu.com/docs",
    changelogUrl: "https://01.ai/blog",
    description: "Kai-Fu Lee's startup. Yi-Lightning is one of the fastest and cheapest Chinese frontier models.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("yi-lightning", 0.14, 0.14, 16, { promo: true, promoLabel: "Fastest",   promoLink: "https://platform.lingyiwanwu.com/docs/api-reference/pricing" }),
      m("yi-large",     3.00, 3.00, 32),
    ],
  },

  // ── Stepfun ───────────────────────────────────────────────────────────────
  stepfun: {
    id: "stepfun",
    name: "Stepfun",
    website: "https://stepfun.ai",
    pricingUrl: "https://platform.stepfun.com/docs/pricing/step-price",
    docsUrl: "https://platform.stepfun.com/docs",
    changelogUrl: "https://stepfun.ai/blog",
    description: "Chinese AI startup. Step-2-16K long-context and Step-Flash low-cost models.",
    hq: "CN",
    tier: "budget",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("step-2-16k",  0.38, 0.38, 16, { promo: true, promoLabel: "Popular", promoLink: "https://platform.stepfun.com/docs/pricing/step-price" }),
      m("step-flash",  0.08, 0.08, 32, { promo: true, promoLabel: "Cheapest" }),
      m("step-2",      0.90, 0.90, 512),
    ],
  },

  // ── Tencent Hunyuan ───────────────────────────────────────────────────────
  hunyuan: {
    id: "hunyuan",
    name: "Tencent Hunyuan",
    website: "https://hunyuan.tencent.com",
    pricingUrl: "https://cloud.tencent.com/document/product/1729/97731",
    docsUrl: "https://cloud.tencent.com/document/product/1729",
    changelogUrl: "https://cloud.tencent.com/document/product/1729/112892",
    description: "Tencent's LLM. Hunyuan-Turbo-S free tier; strong for Chinese language, code, and math.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("hunyuan-turbo-s", null, null, 256, { promo: true, promoLabel: "Free tier", promoLink: "https://cloud.tencent.com/document/product/1729/97731" }),
      m("hunyuan-turbos",  0.07, 0.14, 256, { promo: true, promoLabel: "Popular" }),
      m("hunyuan-lite",    null, null, 256, { promo: true, promoLabel: "Free" }),
    ],
  },

  // ── Upstage ───────────────────────────────────────────────────────────────
  upstage: {
    id: "upstage",
    name: "Upstage Solar",
    website: "https://upstage.ai",
    pricingUrl: "https://console.upstage.ai/docs/pricing",
    docsUrl: "https://console.upstage.ai/docs/capabilities/chat",
    changelogUrl: "https://upstage.ai/blog",
    description: "Korean AI startup. Solar-Pro2 is a compact 22B instruction model outperforming its weight class.",
    hq: "KR",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("solar-pro2",  0.20, 0.80, 32, { promo: true, promoLabel: "New",    promoLink: "https://upstage.ai/blog/solar-pro2" }),
      m("solar-pro",   0.20, 0.20, 32),
      m("solar-mini",  0.08, 0.08,  4),
    ],
  },

  // ── Writer ────────────────────────────────────────────────────────────────
  writer: {
    id: "writer",
    name: "Writer (Palmyra)",
    website: "https://writer.com",
    pricingUrl: "https://writer.com/pricing",
    docsUrl: "https://dev.writer.com/docs/quickstart",
    changelogUrl: "https://writer.com/blog/",
    description: "Enterprise writing platform. Palmyra X5 optimised for business documents, RAG, and agents.",
    hq: "US",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("palmyra-x5",      0.50, 2.50, 128, { promo: true, promoLabel: "Flagship",   promoLink: "https://writer.com/blog/palmyra-x5/" }),
      m("palmyra-x5-mini", 0.10, 0.50, 128),
    ],
  },

  // ── AI21 Labs ─────────────────────────────────────────────────────────────
  ai21: {
    id: "ai21",
    name: "AI21 Labs",
    website: "https://ai21.com",
    pricingUrl: "https://www.ai21.com/pricing",
    docsUrl: "https://docs.ai21.com",
    changelogUrl: "https://docs.ai21.com/changelog",
    description: "Israeli AI lab. Jamba 2.0 is an SSM-Transformer hybrid with 256K context and low latency.",
    hq: "IL",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("jamba-2.0",       2.00,  8.00, 256, { promo: true, promoLabel: "New",     promoLink: "https://www.ai21.com/blog/jamba-2" }),
      m("jamba-1.6-large", 2.00,  8.00, 256, { promo: true, promoLabel: "256K ctx",promoLink: "https://docs.ai21.com/docs/jamba-1.6" }),
      m("jamba-1.6-mini",  0.20,  0.40, 256),
    ],
  },

  // ── Lepton AI ─────────────────────────────────────────────────────────────
  lepton: {
    id: "lepton",
    name: "LeptonAI",
    website: "https://lepton.ai",
    pricingUrl: "https://www.lepton.ai/pricing",
    docsUrl: "https://www.lepton.ai/docs",
    changelogUrl: "https://www.lepton.ai/blog",
    description: "Developer cloud for open-model inference and fine-tuning. Free credits on sign-up.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("llama3.3-70b",                      0.80, 0.80, 128, { promo: true, promoLabel: "Popular" }),
      m("llama3.1-8b",                       0.07, 0.07, 128, { promo: true, promoLabel: "Free tier" }),
      m("deepseek-r1",                       0.55, 2.19, 128),
    ],
  },

  // ── Deep Infra ────────────────────────────────────────────────────────────
  deepinfra: {
    id: "deepinfra",
    name: "Deep Infra",
    website: "https://deepinfra.com",
    pricingUrl: "https://deepinfra.com/pricing",
    docsUrl: "https://deepinfra.com/docs",
    changelogUrl: "https://deepinfra.com/blog",
    description: "Serverless GPU cloud. 50+ open models, pay-per-token with no idle costs.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("meta-llama/Meta-Llama-3.1-8B-Instruct",   0.055, 0.055, 128, { promo: true, promoLabel: "Cheapest", promoLink: "https://deepinfra.com/pricing" }),
      m("meta-llama/Llama-3.3-70B-Instruct-Turbo",  0.23,  0.40,  128),
      m("deepseek-ai/DeepSeek-V3",                  0.49,  0.89,   64),
    ],
  },

  // ── Inception Labs (Mercury) ──────────────────────────────────────────────
  inception: {
    id: "inception",
    name: "Inception Labs",
    website: "https://inceptionlabs.ai",
    pricingUrl: "https://inceptionlabs.ai/mercury",
    docsUrl: "https://docs.inceptionlabs.ai",
    changelogUrl: "https://inceptionlabs.ai/blog",
    description: "Diffusion LLM startup. Mercury runs tokens in parallel for 10x faster coding inference.",
    hq: "US",
    tier: "specialised",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("mercury-coder",       0.25, 1.00, 32, { promo: true, promoLabel: "Diffusion LLM", promoLink: "https://inceptionlabs.ai/mercury" }),
      m("mercury-coder-small", 0.06, 0.25, 32),
    ],
  },

  // ── IBM WatsonX ───────────────────────────────────────────────────────────
  ibm: {
    id: "ibm",
    name: "IBM WatsonX",
    website: "https://ibm.com/watsonx",
    pricingUrl: "https://www.ibm.com/products/watsonx-ai/pricing",
    docsUrl: "https://www.ibm.com/docs/en/watsonx-as-a-service",
    changelogUrl: "https://www.ibm.com/docs/en/watsonx-as-a-service?topic=overview-whats-new",
    description: "Enterprise AI platform with governance. Granite 3.3 open-weight models for business.",
    hq: "US",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("ibm/granite-3.3-8b-instruct",  0.10, 0.10, 128, { promo: true, promoLabel: "New",      promoLink: "https://www.ibm.com/products/watsonx-ai/foundation-models" }),
      m("ibm/granite-3.3-2b-instruct",  0.05, 0.05, 128, { promo: true, promoLabel: "Cheapest" }),
    ],
  },

  // ── Anyscale ─────────────────────────────────────────────────────────────
  anyscale: {
    id: "anyscale",
    name: "Anyscale",
    website: "https://anyscale.com",
    pricingUrl: "https://www.anyscale.com/endpoints",
    docsUrl: "https://docs.anyscale.com",
    changelogUrl: "https://www.anyscale.com/blog",
    description: "Ray computing platform. Private inference and fine-tuning with enterprise SLA.",
    hq: "US",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("meta-llama/Meta-Llama-3.1-70B-Instruct", 1.00, 1.00, 128),
      m("meta-llama/Meta-Llama-3.1-8B-Instruct",  0.15, 0.15, 128),
    ],
  },

  // ── Neets AI ─────────────────────────────────────────────────────────────
  neets: {
    id: "neets",
    name: "Neets AI",
    website: "https://neets.ai",
    pricingUrl: "https://neets.ai/pricing",
    docsUrl: "https://neets.ai/docs",
    changelogUrl: "https://neets.ai/blog",
    description: "Small inference provider with competitive per-token pricing on Llama and Mistral models.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
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
    docsUrl: "https://lamini.ai/docs",
    changelogUrl: "https://lamini.ai/blog",
    description: "Fine-tuning-first platform. Memory tuning trains models to memorise enterprise facts.",
    hq: "US",
    tier: "specialised",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("meta-llama/Meta-Llama-3.1-8B-Instruct", null, null, 8, { promo: true, promoLabel: "Free tier", promoLink: "https://lamini.ai/pricing" }),
    ],
  },

  // ── Replicate ─────────────────────────────────────────────────────────────
  replicate: {
    id: "replicate",
    name: "Replicate",
    website: "https://replicate.com",
    pricingUrl: "https://replicate.com/pricing",
    docsUrl: "https://replicate.com/docs",
    changelogUrl: "https://replicate.com/changelog",
    description: "Run open-source ML models via API. Best known for image/video gen and community models.",
    hq: "US",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("meta/meta-llama-3-8b-instruct",         0.05, 0.25,   8),
      m("meta/meta-llama-3.1-405b-instruct",     9.50, 9.50, 128),
    ],
  },

  // ── Dahono Labs Gateway ───────────────────────────────────────────────────
  dahono: {
    id: "dahono",
    name: "Dahono Labs Gateway",
    website: "https://gateway.dahono.com",
    pricingUrl: "https://gateway.dahono.com",
    docsUrl: "https://gateway.dahono.com/docs",
    changelogUrl: "https://gateway.dahono.com/changelog",
    description: "Indonesian AI gateway. 70+ models from all major providers, unified billing, and generous free tier.",
    hq: "ID",
    tier: "gateway",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2025-06-23",
    models: [
      m("dahono/deepseek-chat",   null, null, 64,   { promo: true, promoLabel: "Free", promoLink: "https://gateway.dahono.com" }),
      m("dahono/gemini-2.5-flash",null, null, 1000, { promo: true, promoLabel: "Free" }),
      m("dahono/gpt-4o-mini",     null, null,  128, { promo: true, promoLabel: "Free" }),
      m("dahono/claude-haiku-4-5",null, null,  200, { promo: true, promoLabel: "Free" }),
    ],
  },

  // ── Azure OpenAI ─────────────────────────────────────────────────────────
  azure: {
    id: "azure",
    name: "Azure OpenAI",
    website: "https://azure.microsoft.com/en-us/products/ai-services/openai-service",
    pricingUrl: "https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service",
    docsUrl: "https://learn.microsoft.com/en-us/azure/ai-services/openai/",
    statusUrl: "https://azure.status.microsoft.com/en-us/status",
    changelogUrl: "https://learn.microsoft.com/en-us/azure/ai-services/openai/whats-new",
    description: "OpenAI models on Azure. Enterprise compliance, VNet, private endpoints, and regional deployments.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2025-06-23",
    models: [
      m("gpt-4.1",     2.00,  8.00, 1000, { promo: true, promoLabel: "New",    promoLink: "https://learn.microsoft.com/en-us/azure/ai-services/openai/whats-new" }),
      m("gpt-5",      10.00, 40.00, 1000, { promo: true, promoLabel: "New",    promoLink: "https://learn.microsoft.com/en-us/azure/ai-services/openai/whats-new" }),
      m("gpt-4o",      2.50, 10.00,  128),
      m("gpt-4o-mini", 0.15,  0.60,  128),
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
