/**
 * lib/provider-info.ts
 *
 * Static pricing, metadata, and promo flags for every provider in PROVIDER_CONFIGS.
 * Prices are in USD per 1M tokens (input / output) sourced from each provider's
 * public pricing page as of June 2026. Set to null when not publicly listed.
 *
 * "promo" flags mark: free tiers, launch-week discounts, or featured new models.
 * "live" flag means a modelsEndpoint exists — the UI will auto-refresh that list.
 */

export interface ModelPricing {
  id: string
  inputPer1M: number | null         // USD per 1M input tokens  (null = not listed / free)
  outputPer1M: number | null        // USD per 1M output tokens
  contextK: number | null           // context window in thousands of tokens
  promo?: boolean                   // launch discount / featured / free-tier
  promoLabel?: string               // e.g. "Free", "50% off", "New"
  promoLink?: string                // direct link to blog post, docs, or pricing for this model
  promoOriginalInputPer1M?: number  // full price before promo (null means no discount — just featured)
  promoOriginalOutputPer1M?: number // full output price before promo
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
  opts?: {
    promo?: boolean
    promoLabel?: string
    promoLink?: string
    promoOriginalInputPer1M?: number
    promoOriginalOutputPer1M?: number
    deprecated?: boolean
  },
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
    description: "Safety-focused AI lab. Claude 4 family — Fable 5, Opus 4.8, Sonnet 4.6, Haiku 4.5 — 1M context, vision, tool use, and coding.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      m("claude-fable-5",            10.00, 50.00, 1000, { promo: true, promoLabel: "Newest",   promoLink: "https://www.anthropic.com/news/claude-fable-5" }),
      m("claude-opus-4-8",            5.00, 25.00, 1000, { promo: true, promoLabel: "Flagship",  promoLink: "https://www.anthropic.com/claude/opus" }),
      m("claude-opus-4-7",            5.00, 25.00, 1000),
      m("claude-opus-4-6",            5.00, 25.00, 1000),
      m("claude-sonnet-4-6",          3.00, 15.00, 1000, { promo: true, promoLabel: "Popular",   promoLink: "https://www.anthropic.com/claude/sonnet" }),
      m("claude-sonnet-4-5",          3.00, 15.00,  200),
      m("claude-opus-4-5",            5.00, 25.00,  200),
      m("claude-haiku-4-5",           1.00,  5.00,  200, { promo: true, promoLabel: "Fastest",   promoLink: "https://www.anthropic.com/claude/haiku" }),
      m("claude-3-5-sonnet-20241022", 3.00, 15.00,  200, { deprecated: true }),
      m("claude-3-5-haiku-20241022",  0.80,  4.00,  200, { deprecated: true }),
      m("claude-3-opus-20240229",    15.00, 75.00,  200, { deprecated: true }),
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
    description: "Creator of GPT-5.6, GPT-5.5, o-series reasoning, image gen, and realtime voice models. Leads in multimodal, coding, and long-context tasks.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2026-07-11",
    models: [
      // ── GPT-5.6 (July 9, 2026 GA) ──────────────────────────────────────────
      m("gpt-5.6-sol",        5.00,  30.00, 1000, { promo: true, promoLabel: "New · Flagship",  promoLink: "https://openai.com/blog/gpt-5-6/" }),
      m("gpt-5.6-terra-pro",  2.50,  15.00, 1000, { promo: true, promoLabel: "New · Balanced",  promoLink: "https://openai.com/blog/gpt-5-6/" }),
      m("gpt-5.6-luna",       1.00,   6.00, 1000, { promo: true, promoLabel: "New · Fast",      promoLink: "https://openai.com/blog/gpt-5-6/" }),
      m("gpt-5.6",            5.00,  30.00, 1000),
      // ── GPT-5.x (previous) ─────────────────────────────────────────────────
      m("gpt-5.5",            5.00,  30.00, 1000, { promo: true, promoLabel: "Flagship" }),
      m("gpt-5.4",            2.50,  15.00, 1000, { promo: true, promoLabel: "Balanced" }),
      m("gpt-5.4-mini",       0.75,   4.50,  400, { promo: true, promoLabel: "Best value" }),
      m("gpt-5",             10.00,  40.00, 1000),
      m("gpt-5-mini",         0.40,   1.60, 1000),
      m("gpt-5-nano",         0.10,   0.40, 1000),
      m("gpt-5-pro",         75.00, 300.00, 1000),
      m("o3-pro",            20.00,  80.00, 1000, { promo: true, promoLabel: "Reasoning",  promoLink: "https://openai.com/index/o3-pro/" }),
      m("o3",                 2.00,   8.00, 1000),
      m("o4-mini",            1.10,   4.40, 1000),
      m("gpt-4.1",            2.00,   8.00, 1000),
      m("gpt-4.1-mini",       0.40,   1.60, 1000),
      m("gpt-4.1-nano",       0.10,   0.40, 1000),
      m("gpt-4o",             2.50,  10.00,  128),
      m("gpt-4o-mini",        0.15,   0.60,  128),
      m("openai/gpt-oss-120b",0.15,   0.60,  128, { promo: true, promoLabel: "Open weight",promoLink: "https://openai.com/index/gpt-oss-120b/" }),
      m("openai/gpt-oss-20b", 0.075,  0.30,  128, { promo: true, promoLabel: "Open fast",  promoLink: "https://openai.com/index/gpt-oss-20b/" }),
      m("gpt-3.5-turbo",      0.50,   1.50,   16, { deprecated: true }),
    ],
  },

  // ── Google Gemini ───────────────────�����������������─────────────────────────────────────
  google: {
    id: "google",
    name: "Google Gemini",
    website: "https://ai.google.dev",
    pricingUrl: "https://ai.google.dev/pricing",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    statusUrl: "https://status.ai.google.dev",
    changelogUrl: "https://ai.google.dev/gemini-api/docs/changelog",
    description: "Google DeepMind's Gemini 3.x family + image/video gen (Veo 3.1, Nano Banana). Multimodal, long context, free tier.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      // ── Gemini 4.x ─────────────────────────────────────────────────────────
      m("gemini-4-argon",              null,  null, 1000, { promo: true, promoLabel: "New" }),
      // ── Gemini 3.x ─────────────────────────────────────────────────────────
      m("gemini-3.5-flash",           null,  null, 1000, { promo: true, promoLabel: "Newest",    promoLink: "https://ai.google.dev/gemini-api/docs/models/gemini#gemini-3.5-flash" }),
      m("gemini-3.1-pro",             null,  null, 1000, { promo: true, promoLabel: "Pro",        promoLink: "https://ai.google.dev/gemini-api/docs/models/gemini#gemini-3.1-pro" }),
      m("gemini-3-flash",             null,  null, 1000, { promo: true, promoLabel: "Popular",    promoLink: "https://ai.google.dev/gemini-api/docs/models/gemini#gemini-3-flash" }),
      m("gemini-3.1-flash-lite",      null,  null, 1000, { promo: true, promoLabel: "Cheapest",   promoLink: "https://ai.google.dev/pricing" }),
      // ── Gemini 2.5.x ───────────────────────────────────────────────────────
      m("gemini-2.5-pro",             1.25, 10.00, 1000, { promo: true, promoLabel: "Best value", promoLink: "https://ai.google.dev/gemini-api/docs/models/gemini#gemini-2.5-pro", promoOriginalInputPer1M: 3.50, promoOriginalOutputPer1M: 10.50 }),
      m("gemini-2.5-flash",           0.30,  2.50, 1000),
      m("gemini-2.5-flash-lite",      0.10,  0.40, 1000, { promo: true, promoLabel: "Free tier",  promoLink: "https://ai.google.dev/pricing", promoOriginalInputPer1M: 0.30, promoOriginalOutputPer1M: 2.50 }),
      // ── Generative media ───────────────────────────────────────────────────
      m("veo-3.1-preview",            null,  null, null,  { promo: true, promoLabel: "Video gen",  promoLink: "https://ai.google.dev/gemini-api/docs/models/gemini#veo" }),
      m("veo-3.0",                    null,  null, null),
      m("imagen-4",                   null,  null, null,  { promo: true, promoLabel: "Image gen" }),
      // ── Audio / TTS ────────────────────────────────────────────────────────
      m("gemini-2.5-flash-tts-preview",null, null, null,  { promo: true, promoLabel: "TTS",        promoLink: "https://ai.google.dev/gemini-api/docs/models/gemini#tts" }),
      // ── Embedding ──────────────────────────────────────────────────────────
      m("gemini-embedding-2",         null,  null, null,  { promo: true, promoLabel: "Embedding",  promoLink: "https://ai.google.dev/gemini-api/docs/models/gemini#embedding" }),
      // ── Deprecated ─────────────────────────────────────────────────────────
      m("gemini-2.0-flash",           0.10,  0.40, 1000,  { deprecated: true }),
      m("gemini-1.5-pro",             1.25,  5.00,  128,  { deprecated: true }),
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
    description: "Elon Musk's xAI lab. Grok-4 family with real-time web knowledge, vision, image/video gen (Imagine API), and voice.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2026-06-23",
    models: [
      // ── Chat ───────────────────────────────────────────────────────────────
      m("grok-4.3",                   1.25,  2.50, 1000, { promo: true, promoLabel: "Flagship",   promoLink: "https://x.ai/blog/grok-4" }),
      m("grok-4.20-0309-reasoning",   1.25,  2.50, 1000, { promo: true, promoLabel: "Reasoning",  promoLink: "https://docs.x.ai/docs/models" }),
      m("grok-4.20-0309-non-reasoning",1.25, 2.50, 1000),
      m("grok-build-0.1",             1.00,  2.00,  256, { promo: true, promoLabel: "Coding",     promoLink: "https://docs.x.ai/docs/models" }),
      // ── Image/Video (Imagine API) ──────────────────────────────────────────
      m("grok-imagine-image",         null,  null, null,  { promo: true, promoLabel: "Image gen",  promoLink: "https://docs.x.ai/docs/models#imagine-pricing" }),
      m("grok-imagine-image-quality", null,  null, null),
      m("grok-imagine-video-1.5",     null,  null, null,  { promo: true, promoLabel: "Video gen",  promoLink: "https://docs.x.ai/docs/models#imagine-pricing" }),
      // ── Deprecated ─────────────────────────────────────────────────────────
      m("grok-3",                     3.00, 15.00,  131,  { deprecated: true }),
      m("grok-2-1212",                2.00, 10.00,  131,  { deprecated: true }),
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
    description: "Chinese frontier lab. DeepSeek-V4 (Flash/Pro) with 1M context, thinking mode. 10-100x cheaper than US providers.",
    hq: "CN",
    tier: "budget",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2026-06-23",
    models: [
      m("deepseek-v4-flash", 0.14,  0.28, 1000, { promo: true, promoLabel: "Best price", promoLink: "https://api-docs.deepseek.com/quick_start/pricing", promoOriginalInputPer1M: 0.27, promoOriginalOutputPer1M: 1.10 }),
      m("deepseek-v4-pro",   0.435, 0.87, 1000, { promo: true, promoLabel: "Reasoning",  promoLink: "https://api-docs.deepseek.com/quick_start/pricing", promoOriginalInputPer1M: 0.55, promoOriginalOutputPer1M: 2.19 }),
      // Aliases (deprecated July 2026)
      m("deepseek-chat",     0.14,  0.28,   64, { deprecated: true }),
      m("deepseek-reasoner", 0.55,  2.19,   64, { deprecated: true }),
    ],
  },

  // ── Groq ─────────────────────────────────────────�������───────────────────────
  groq: {
    id: "groq",
    name: "Groq",
    website: "https://groq.com",
    pricingUrl: "https://groq.com/pricing/",
    docsUrl: "https://console.groq.com/docs",
    statusUrl: "https://groqstatus.com",
    changelogUrl: "https://console.groq.com/docs/changelog",
    description: "LPU hardware company. 500–1000 tok/s on Llama 3.3, Qwen3, and OpenAI GPT-OSS — fastest publicly available inference.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2026-06-23",
    models: [
      // ── Production ─────────────────────────────────────────────────────────
      m("openai/gpt-oss-120b",                           0.15, 0.60, 131, { promo: true, promoLabel: "OpenAI OSS", promoLink: "https://console.groq.com/docs/models" }),
      m("openai/gpt-oss-20b",                            0.075,0.30, 131, { promo: true, promoLabel: "Fast OSS",   promoLink: "https://console.groq.com/docs/models" }),
      m("llama-3.3-70b-versatile",                       0.59, 0.79, 131),
      m("llama-3.1-8b-instant",                          0.05, 0.08, 131, { promo: true, promoLabel: "Cheapest",   promoLink: "https://groq.com/pricing/", promoOriginalInputPer1M: 0.20, promoOriginalOutputPer1M: 0.20 }),
      // ── Preview ────────────────────────────────────────────────────────────
      m("meta-llama/llama-4-scout-17b-16e-instruct",     0.11, 0.34, 131, { promo: true, promoLabel: "Free tier",  promoLink: "https://groq.com/pricing/" }),
      m("qwen/qwen3-32b",                                0.29, 0.59, 131, { promo: true, promoLabel: "Reasoning",  promoLink: "https://console.groq.com/docs/models" }),
      m("qwen/qwen3.6-27b",                              0.60, 3.00, 131),
      // ── Systems ────────────────────────────────────────────────────────────
      m("groq/compound",                                  null, null, 131, { promo: true, promoLabel: "Web search",  promoLink: "https://console.groq.com/docs/agentic-tooling" }),
      m("groq/compound-mini",                             null, null, 131),
      // ── Audio (Speech-to-Text) ─────────────────────────────────────────────
      m("whisper-large-v3",                               null, null, null, { promo: true, promoLabel: "STT",        promoLink: "https://console.groq.com/docs/speech-text" }),
      m("whisper-large-v3-turbo",                         null, null, null),
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
    description: "European frontier lab. Mistral Medium 3.5, Small 4, Devstral 2, Voxtral TTS, and OCR 3 for agentic and multimodal tasks.",
    hq: "FR",
    tier: "mid",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2026-06-23",
    models: [
      // ── Frontier ───────────────────────────────────────────────────────────
      m("mistral-medium-2604",    null,  null, 128, { promo: true, promoLabel: "Newest",    promoLink: "https://mistral.ai/news/mistral-medium-3-5/" }),
      m("mistral-small-2503",     null,  null, 128, { promo: true, promoLabel: "Hybrid",    promoLink: "https://mistral.ai/news/mistral-small-4/" }),
      m("mistral-large-2512",     null,  null, 128, { promo: true, promoLabel: "Flagship",  promoLink: "https://mistral.ai/news/mistral-large-3/" }),
      // ── Ministral 3.x ──────────────────────────────────────────────────────
      m("ministral-3-14b-2512",   null,  null, 256, { promo: true, promoLabel: "14B Vision",promoLink: "https://docs.mistral.ai/getting-started/models/models_overview/" }),
      m("ministral-3-8b-2512",    null,  null, 256),
      m("ministral-3-3b-2512",    null,  null, 256),
      // ── Specialist ─────────────────────────────────────────────────────────
      m("codestral-2508",         0.30,  0.90, 256, { promo: true, promoLabel: "Coding",    promoLink: "https://mistral.ai/news/codestral/" }),
      m("devstral-2512",          null,  null, 128, { promo: true, promoLabel: "Code agent",promoLink: "https://docs.mistral.ai/getting-started/models/models_overview/" }),
      m("mistral-ocr-2512",       null,  null,  32, { promo: true, promoLabel: "OCR",       promoLink: "https://docs.mistral.ai/capabilities/document/" }),
      m("voxtral-mini-2602",      null,  null, null, { promo: true, promoLabel: "STT",      promoLink: "https://docs.mistral.ai/getting-started/models/models_overview/" }),
      m("voxtral-tts-2603",       null,  null, null, { promo: true, promoLabel: "TTS",      promoLink: "https://docs.mistral.ai/getting-started/models/models_overview/" }),
      // ── Legacy ─────────────────────────────────────────────────────────────
      m("mistral-large-latest",   2.00,  6.00, 128, { deprecated: true }),
      m("open-mistral-7b",        0.25,  0.25,  32, { deprecated: true }),
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
    description: "Enterprise NLP platform. Command A family — vision, reasoning, translation. Aya multilingual + audio transcription.",
    hq: "CA",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      // ── Command A ──────────────────────────────────────────────────────────
      m("command-a-03-2025",               2.50, 10.00, 256, { promo: true, promoLabel: "Flagship",   promoLink: "https://cohere.com/blog/command-a" }),
      m("command-a-vision-07-2025",        null,  null, 128, { promo: true, promoLabel: "Vision",     promoLink: "https://docs.cohere.com/v2/docs/models" }),
      m("command-a-reasoning-08-2025",     null,  null, 256, { promo: true, promoLabel: "Reasoning",  promoLink: "https://docs.cohere.com/v2/docs/models" }),
      m("command-a-translate-08-2025",     null,  null,   8, { promo: true, promoLabel: "Translate",  promoLink: "https://docs.cohere.com/v2/docs/models" }),
      m("command-r-plus-08-2024",          2.50, 10.00, 128),
      m("command-r7b-12-2024",             0.04,  0.15, 128, { promo: true, promoLabel: "Cheapest",   promoLink: "https://cohere.com/pricing", promoOriginalInputPer1M: 0.15, promoOriginalOutputPer1M: 0.60 }),
      // ── Aya multilingual ─────��─────────��───────────────────────────────────
      m("c4ai-aya-expanse-32b",            null,  null, 128, { promo: true, promoLabel: "23 langs",   promoLink: "https://docs.cohere.com/v2/docs/models#aya" }),
      m("c4ai-aya-vision-32b",             null,  null,  16, { promo: true, promoLabel: "Multimodal", promoLink: "https://docs.cohere.com/v2/docs/models#aya" }),
      m("tiny-aya-global",                 null,  null,   8, { promo: true, promoLabel: "70 langs" }),
      // ── Audio (Transcription) ──────────────────────────────────────────────
      m("cohere-transcribe-03-2026",       null,  null, null, { promo: true, promoLabel: "STT",       promoLink: "https://docs.cohere.com/v2/docs/models#audio" }),
      // ── Deprecated ─────────────────────────────────────────────────────────
      m("command-r-08-2024",               0.15,  0.60, 128, { deprecated: true }),
      m("command",                         1.00,  2.00,   4, { deprecated: true }),
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
    description: "AI-powered search and answer engine. Sonar Pro/Deep Research with live web citations, grounding, and reasoning.",
    hq: "US",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      m("sonar-deep-research",  2.00, 10.00, 127, { promo: true, promoLabel: "Deep search",promoLink: "https://docs.perplexity.ai/guides/model-cards" }),
      m("sonar-pro",            3.00, 15.00, 200, { promo: true, promoLabel: "Web search",  promoLink: "https://docs.perplexity.ai/guides/model-cards" }),
      m("sonar-reasoning-pro",  3.00, 15.00, 127, { promo: true, promoLabel: "Reasoning",   promoLink: "https://docs.perplexity.ai/guides/model-cards" }),
      m("sonar-reasoning",      1.00,  5.00, 127),
      m("sonar",                1.00,  1.00, 127),
      m("r1-1776",              1.00,  5.00, 128, { promo: true, promoLabel: "Offline R1",  promoLink: "https://docs.perplexity.ai/guides/model-cards" }),
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
    description: "Open-model cloud with 300+ models including chat, image, video, audio, and embeddings. Pay-per-token with fine-tuning.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2026-06-23",
    models: [
      // ── Chat ───────────────────────────────────────────────────────────────
      m("MiniMaxAI/MiniMax-M3",                          0.30, 1.20,  512, { promo: true, promoLabel: "New",        promoLink: "https://docs.together.ai/docs/inference-models" }),
      m("deepseek-ai/DeepSeek-V4-Pro",                  1.74, 3.48,  512, { promo: true, promoLabel: "DeepSeek V4",promoLink: "https://docs.together.ai/docs/inference-models" }),
      m("Qwen/Qwen3.5-9B",                               0.17, 0.25,  262, { promo: true, promoLabel: "Vision",     promoLink: "https://docs.together.ai/docs/inference-models" }),
      m("meta-llama/Llama-3.3-70B-Instruct-Turbo",      1.04, 1.04,  131, { promo: true, promoLabel: "Popular",    promoLink: "https://www.together.ai/pricing" }),
      m("meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",  0.18, 0.18,  131, { promo: true, promoLabel: "Cheapest",   promoLink: "https://www.together.ai/pricing" }),
      m("Qwen/Qwen3-235B-A22B-Instruct-2507-tput",       0.20, 0.60,  262),
      m("openai/gpt-oss-120b",                           0.15, 0.60,  128, { promo: true, promoLabel: "OpenAI OSS",promoLink: "https://docs.together.ai/docs/inference-models" }),
      m("moonshotai/Kimi-K2.6",                          1.20, 4.50,  262, { promo: true, promoLabel: "New",        promoLink: "https://docs.together.ai/docs/inference-models" }),
      // ── Image gen ──────────────────────────────────────────────────────────
      m("black-forest-labs/FLUX.1.1-pro",                null, null, null, { promo: true, promoLabel: "Image gen",  promoLink: "https://docs.together.ai/docs/inference-models#image-models" }),
      m("black-forest-labs/FLUX.2-pro",                  null, null, null),
      m("google/imagen-4.0-preview",                     null, null, null, { promo: true, promoLabel: "Imagen 4",   promoLink: "https://docs.together.ai/docs/inference-models#image-models" }),
      // ── Video gen ──────────────────────────────────────────────────────────
      m("google/veo-3.0-audio",                          null, null, null, { promo: true, promoLabel: "Video+Audio",promoLink: "https://docs.together.ai/docs/inference-models#video-models" }),
      m("ByteDance/Seedance-1.0-pro",                    null, null, null),
      m("openai/sora-2",                                 null, null, null, { promo: true, promoLabel: "Sora 2",     promoLink: "https://docs.together.ai/docs/inference-models#video-models" }),
      // ── Audio ──────────────────────────────────────────────────────────────
      m("canopylabs/orpheus-3b-0.1-ft",                  null, null, null, { promo: true, promoLabel: "TTS",        promoLink: "https://docs.together.ai/docs/inference-models#audio-models" }),
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
    lastUpdated: "2026-06-23",
    models: [
      m("meta-llama/Llama-3.3-70B-Instruct",             null, null, 131, { promo: true, promoLabel: "Free tier",  promoLink: "https://huggingface.co/pricing" }),
      m("meta-llama/Llama-4-Scout-17B-16E-Instruct",     null, null, 131, { promo: true, promoLabel: "New",        promoLink: "https://huggingface.co/blog/llama4-release" }),
      m("Qwen/Qwen3-235B-A22B",                          null, null, 262, { promo: true, promoLabel: "Free tier",  promoLink: "https://huggingface.co/Qwen/Qwen3-235B-A22B" }),
      m("google/gemma-4-31B-it",                         null, null, 262, { promo: true, promoLabel: "Vision",     promoLink: "https://huggingface.co/google/gemma-4-31B-it" }),
      m("mistralai/Mistral-Large-Instruct-2512",          null, null, 128, { promo: true, promoLabel: "Mistral",    promoLink: "https://huggingface.co/mistralai" }),
      m("meta-llama/Llama-3.1-8B-Instruct",              null, null, 128, { promo: true, promoLabel: "Free tier" }),
      m("mistralai/Mistral-7B-Instruct-v0.3",             null, null,  32),
    ],
  },

  // ── OpenRouter ───────────────────────────────────────────────────────���────
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    website: "https://openrouter.ai",
    pricingUrl: "https://openrouter.ai/models",
    docsUrl: "https://openrouter.ai/docs",
    changelogUrl: "https://openrouter.ai/changelog",
    description: "Unified gateway to 300+ models from every major provider. Free models available; auto-routes to fastest/cheapest provider.",
    hq: "US",
    tier: "gateway",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      m("anthropic/claude-fable-5",               10.00, 50.00, 1000, { promo: true, promoLabel: "Newest",     promoLink: "https://openrouter.ai/anthropic/claude-fable-5" }),
      m("openai/gpt-5.5",                          5.00, 30.00, 1000, { promo: true, promoLabel: "GPT-5.5",    promoLink: "https://openrouter.ai/openai/gpt-5-5" }),
      m("anthropic/claude-sonnet-4-6",             3.00, 15.00, 1000, { promo: true, promoLabel: "Popular",    promoLink: "https://openrouter.ai/anthropic/claude-sonnet-4-6" }),
      m("google/gemini-3.5-flash",                 1.50,  9.00, 1000, { promo: true, promoLabel: "Gemini 3.5", promoLink: "https://openrouter.ai/google/gemini-3.5-flash" }),
      m("x-ai/grok-4.3",                           1.25,  2.50, 1000, { promo: true, promoLabel: "Grok 4.3",   promoLink: "https://openrouter.ai/x-ai/grok-4-3" }),
      m("deepseek/deepseek-v4-flash",              0.10,  0.20, 1000, { promo: true, promoLabel: "Best price",  promoLink: "https://openrouter.ai/deepseek/deepseek-v4-flash" }),
      m("meta-llama/llama-3.3-70b-instruct:free",  null,  null,  128, { promo: true, promoLabel: "Free",        promoLink: "https://openrouter.ai/models?q=free" }),
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
    lastUpdated: "2026-06-23",
    models: [
      m("accounts/fireworks/models/glm-5-2",                1.40, 4.40, 1000, { promo: true, promoLabel: "New",        promoLink: "https://fireworks.ai/models" }),
      m("accounts/fireworks/models/deepseek-v4-pro",        1.74, 3.48, 1000, { promo: true, promoLabel: "DeepSeek V4",promoLink: "https://fireworks.ai/models" }),
      m("accounts/fireworks/models/kimi-k2-6",              0.95, 4.00,  262, { promo: true, promoLabel: "New",        promoLink: "https://fireworks.ai/models" }),
      m("accounts/fireworks/models/minimax-m3",             0.30, 1.20,  512),
      m("accounts/fireworks/models/qwen3-235b-a22b",        0.90, 0.90,  262, { promo: true, promoLabel: "MoE",        promoLink: "https://fireworks.ai/models" }),
      m("accounts/fireworks/models/deepseek-r1-0528",       0.70, 2.50,  163, { promo: true, promoLabel: "Reasoning",  promoLink: "https://fireworks.ai/models" }),
      m("accounts/fireworks/models/llama-v3p3-70b-instruct",0.59, 0.79,  131),
      m("accounts/fireworks/models/llama-v3p1-8b-instruct", 0.10, 0.10,  131, { promo: true, promoLabel: "Free tier",  promoLink: "https://fireworks.ai/pricing" }),
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
    description: "NVIDIA NIM microservices on H100/H200. Nemotron 3 Ultra 550B, Qwen3, DeepSeek. Free trial credits.",
    hq: "US",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      m("nvidia/nemotron-3-ultra-550b-a55b",         0.60, 3.60,  512, { promo: true, promoLabel: "New 550B",   promoLink: "https://build.nvidia.com/nvidia/nemotron-3-ultra-550b" }),
      m("nvidia/nemotron-3-super-120b-a12b",         0.30, 1.20,  262, { promo: true, promoLabel: "120B MoE",   promoLink: "https://build.nvidia.com/nvidia/nemotron-3-super-120b" }),
      m("qwen/qwen3-235b-a22b",                      0.60, 0.80,  131, { promo: true, promoLabel: "Popular",    promoLink: "https://build.nvidia.com/qwen/qwen3-235b-a22b" }),
      m("deepseek-ai/deepseek-r1",                   0.80, 1.80,  128),
      m("meta/llama-3.3-70b-instruct",               0.25, 0.30,  128, { promo: true, promoLabel: "Free tier",  promoLink: "https://build.nvidia.com/meta/llama-3_3-70b-instruct" }),
      m("meta/llama-3.1-8b-instruct",                0.10, 0.10,  128, { promo: true, promoLabel: "Free tier" }),
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
    description: "Wafer-scale chip startup. 1000+ tok/s on Kimi K2.6, GLM-5.1, Gemma 4, Qwen3 — world's fastest public inference.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2026-06-23",
    models: [
      m("kimi-k2.6",    null, null, 262, { promo: true, promoLabel: "Fastest",    promoLink: "https://cerebras.ai/inference" }),
      m("glm-5.1",      null, null, 200, { promo: true, promoLabel: "New",        promoLink: "https://cerebras.ai/blog/" }),
      m("qwen3-32b",    0.30, 0.40, 131, { promo: true, promoLabel: "Reasoning",  promoLink: "https://cerebras.ai/blog/qwen3-on-cerebras" }),
      m("gemma-4-31b",  null, null, 262, { promo: true, promoLabel: "Vision",     promoLink: "https://cerebras.ai/inference" }),
      m("llama-3.3-70b",0.85, 1.20, 128),
      m("llama3.1-8b",  0.10, 0.10, 128, { promo: true, promoLabel: "2000+ tok/s" }),
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
    description: "SN40L dataflow chip. Sub-millisecond TTFT on 405B-class models with free tier. Supports Qwen3, DeepSeek, and Llama.",
    hq: "US",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      m("Qwen3-235B-A22B",              1.20,  2.80, 262, { promo: true, promoLabel: "MoE",     promoLink: "https://sambanova.ai/blog" }),
      m("Meta-Llama-3.3-70B-Instruct",  0.60,  1.20, 128, { promo: true, promoLabel: "Fast",    promoLink: "https://cloud.sambanova.ai" }),
      m("Meta-Llama-3.1-405B-Instruct", 5.00, 10.00, 128),
      m("DeepSeek-R1",                  5.00,  7.00, 128),
      m("DeepSeek-V3",                  0.90,  1.20, 128),
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
    description: "Decentralised GPU marketplace. Competitive pricing on DeepSeek V4, Qwen3.7, Kimi K2, and Llama 4 open models.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      m("deepseek-ai/DeepSeek-V4-Pro",            1.20, 2.40, 1024, { promo: true, promoLabel: "DeepSeek V4",promoLink: "https://app.hyperbolic.xyz/models" }),
      m("Qwen/Qwen3.7-Max",                       2.50, 7.50, 1000, { promo: true, promoLabel: "Qwen3.7",    promoLink: "https://app.hyperbolic.xyz/models" }),
      m("moonshotai/Kimi-K2.6",                   0.80, 3.40,  262, { promo: true, promoLabel: "Kimi K2.6",  promoLink: "https://app.hyperbolic.xyz/models" }),
      m("Qwen/Qwen3-235B-A22B",                   0.60, 0.80,  262),
      m("deepseek-ai/DeepSeek-R1-0528",           0.50, 2.15,  160, { promo: true, promoLabel: "Reasoning",  promoLink: "https://app.hyperbolic.xyz/models" }),
      m("meta-llama/Llama-4-Maverick-17B-128E",   0.15, 0.60, 1024),
      m("meta-llama/Llama-3.3-70B-Instruct",      0.40, 0.40,  128),
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
    description: "GPU cloud for 200+ LLM, image, video, and audio models. Competitive per-token pricing; Kimi K2.7, Qwen3.7, DeepSeek V4.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2026-06-23",
    models: [
      // ── Chat ───────────────────────────────────────────────────────────────
      m("deepseek/deepseek-v4-pro",               1.60, 3.20, 1048, { promo: true, promoLabel: "DeepSeek V4",promoLink: "https://novita.ai/model-api/pricing" }),
      m("deepseek/deepseek-v4-flash",             0.14, 0.28, 1048, { promo: true, promoLabel: "Best price", promoLink: "https://novita.ai/model-api/pricing" }),
      m("qwen/qwen3.7-max",                       1.25, 3.75, 1000, { promo: true, promoLabel: "Qwen3.7",    promoLink: "https://novita.ai/model-api/pricing" }),
      m("moonshotai/kimi-k2.7-code",              0.95, 4.00,  262, { promo: true, promoLabel: "Kimi K2.7",  promoLink: "https://novita.ai/model-api/pricing" }),
      m("meta-llama/llama-4-maverick-17b-128e-instruct-fp8", 0.27, 0.85, 1048),
      m("deepseek/deepseek-r1-0528",              0.70, 2.50,  163),
      // ── Image gen ──────────────────────────────────────────────────────────
      m("flux-1-context-pro",                     null, null, null, { promo: true, promoLabel: "Image gen",   promoLink: "https://novita.ai/model-api/pricing" }),
      m("seedream-4.0",                           null, null, null),
      // ── Video gen ──────────────────────────────────────────────────────────
      m("kling-v3.0-pro",                         null, null, null, { promo: true, promoLabel: "Video gen",   promoLink: "https://novita.ai/model-api/pricing" }),
      m("minimax-hailuo-2.3",                     null, null, null),
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
    description: "Run AI at the Cloudflare edge. 80+ models (Kimi K2.7, GLM-5.2, GPT-OSS, Llama 4). Free tier on 10k neurons/day.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      m("@cf/moonshot/kimi-k2.7-code",                     null, null, 262, { promo: true, promoLabel: "New",      promoLink: "https://developers.cloudflare.com/workers-ai/models/" }),
      m("@cf/openai/gpt-oss-120b",                         null, null, 131, { promo: true, promoLabel: "OpenAI OSS",promoLink: "https://developers.cloudflare.com/workers-ai/models/" }),
      m("@cf/zai-org/glm-5.2",                             null, null, 200, { promo: true, promoLabel: "GLM-5.2",  promoLink: "https://developers.cloudflare.com/workers-ai/models/" }),
      m("@cf/meta/llama-4-scout-17b-16e-instruct",         null, null, 262, { promo: true, promoLabel: "Llama 4",  promoLink: "https://developers.cloudflare.com/workers-ai/models/" }),
      m("@cf/google/gemma-4-26b-a4b-it",                   null, null, 256, { promo: true, promoLabel: "Vision",   promoLink: "https://developers.cloudflare.com/workers-ai/models/" }),
      m("@cf/nvidia/nemotron-3-120b-a12b",                 null, null, 256),
      m("@cf/moonshot/kimi-k2.6",                          null, null, 262),
      m("@cf/meta/llama-3.3-70b-instruct-fp8-fast",        null, null, 128, { promo: true, promoLabel: "Free tier", promoLink: "https://developers.cloudflare.com/workers-ai/platform/pricing" }),
      m("@cf/meta/llama-3.1-8b-instruct",                  null, null, 128, { promo: true, promoLabel: "Free tier" }),
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
    description: "Alibaba DAMO Academy. Qwen3.7-Max and Qwen3-Coder lead Chinese benchmarks. Free tier on Turbo. VL vision models.",
    hq: "CN",
    tier: "budget",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2026-06-23",
    models: [
      // ── Qwen3.x ───────────��─���─���─��────���─����─��─���───────────────────────────────
      m("qwen3.7-max",              1.25, 3.75, 1000, { promo: true, promoLabel: "Flagship",   promoLink: "https://qwenlm.github.io/blog/qwen3-7-max/", promoOriginalInputPer1M: 3.50, promoOriginalOutputPer1M: 10.50 }),
      m("qwen3.6-plus",             0.50, 3.00, 1000, { promo: true, promoLabel: "New",        promoLink: "https://qwenlm.github.io/blog/" }),
      m("qwen3-coder-480b-a35b",    0.38, 1.55,  262, { promo: true, promoLabel: "Coder",      promoLink: "https://qwenlm.github.io/blog/qwen3-coder/" }),
      m("qwen3-235b-a22b",          0.22, 0.88, 1000, { promo: true, promoLabel: "MoE 235B",   promoLink: "https://qwenlm.github.io/blog/qwen3/" }),
      m("qwen3.5-9b",               0.17, 0.25,  262, { promo: true, promoLabel: "Vision",     promoLink: "https://qwenlm.github.io/blog/" }),
      m("qwen3-32b",                0.14, 0.28,  131, { promo: true, promoLabel: "Popular",    promoLink: "https://qwenlm.github.io/blog/qwen3/" }),
      m("qwen3-8b",                 0.035,0.07,  131, { promo: true, promoLabel: "Cheapest" }),
      // ── Qwen VL (Vision-Language) ────────────────────────────��─────────────
      m("qwen3-vl-32b-instruct",    null, null,  131, { promo: true, promoLabel: "Vision LLM", promoLink: "https://qwenlm.github.io/blog/" }),
      m("qwen2.5-vl-72b-instruct",  0.38, 0.40,   32),
      // ── Embedding / TTS ────────────────────────────────────────────────────
      m("qwen3-embedding-8b",       null, null, null, { promo: true, promoLabel: "Embedding",  promoLink: "https://qwenlm.github.io/blog/" }),
      // ── Legacy ─────────────────────────────────────────────────────────────
      m("qwen-turbo",               0.05, 0.15, 1000, { promo: true, promoLabel: "Free tier",  promoLink: "https://help.aliyun.com/zh/model-studio/getting-started/models" }),
      m("qwen-max",                 1.60, 6.40,   32),
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
    description: "Tsinghua / Zhipu AI joint lab. GLM-5.x family (now Zai-org) with vision, fast flash, and CogView image generation.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      m("glm-5v-turbo",  null, null, 200, { promo: true, promoLabel: "Vision",   promoLink: "https://open.bigmodel.cn/pricing" }),
      m("glm-5.2",       1.40, 4.40, 1000, { promo: true, promoLabel: "Newest",  promoLink: "https://open.bigmodel.cn/pricing" }),
      m("glm-5.1",       1.40, 4.40,  200, { promo: true, promoLabel: "Popular", promoLink: "https://open.bigmodel.cn/pricing" }),
      m("glm-4.7-flash", 0.07, 0.40,  200, { promo: true, promoLabel: "Fast",    promoLink: "https://open.bigmodel.cn/pricing" }),
      m("glm-4.5",       0.60, 2.20,  131),
      m("glm-4-flash",   null, null,  128, { promo: true, promoLabel: "Free",    promoLink: "https://open.bigmodel.cn/pricing" }),
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
    description: "Shanghai AI. MiniMax-M3 / M2.7 are MoE reasoning models with 512K-1M context, vision, and speech generation.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      m("MiniMax-M3",            0.30, 1.20,  512, { promo: true, promoLabel: "New",       promoLink: "https://platform.minimax.io/docs/guides/models-intro" }),
      m("MiniMax-M2.7",          0.30, 1.20,  200, { promo: true, promoLabel: "Fast",      promoLink: "https://platform.minimax.io/docs/guides/models-intro" }),
      m("MiniMax-M2.7-highspeed",0.60, 2.40,  200, { promo: true, promoLabel: "Highspeed", promoLink: "https://platform.minimax.io/docs/guides/models-intro" }),
      m("MiniMax-M1",            0.55, 2.20, 1000),
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
    description: "Beijing AI. Kimi K2.7-Code (1T params, reasoning+vision), K2.6 (262K ctx), moonshot-v1 long-context series.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      m("kimi-k2.7-code",            0.95, 4.00,  262, { promo: true, promoLabel: "New",      promoLink: "https://platform.kimi.com/docs/models" }),
      m("kimi-k2.7-code-highspeed",  0.95, 4.00,  262, { promo: true, promoLabel: "Fast",     promoLink: "https://platform.kimi.com/docs/models" }),
      m("kimi-k2.6",                 0.80, 3.40,  262, { promo: true, promoLabel: "Flagship",  promoLink: "https://platform.kimi.com/docs/models" }),
      m("kimi-k2.5",                 0.60, 3.00,  262),
      m("moonshot-v1-128k",          0.75, 0.75,  128, { promo: true, promoLabel: "Long ctx",  promoLink: "https://platform.moonshot.cn/docs/pricing/chat" }),
      m("moonshot-v1-32k",           0.38, 0.38,   32),
      m("moonshot-v1-8k",            0.19, 0.19,    8),
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
    description: "Baidu's ERNIE 4.5 VL family. Free lite tier, MoE variants, and vision-language models for Chinese enterprise.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      m("ernie-4.5-vl-424b-a47b",0.42, 1.25, 123, { promo: true, promoLabel: "VL MoE",   promoLink: "https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Blfmc9dlf" }),
      m("ernie-4.5-vl-28b-a3b",  0.14, 0.56,  30, { promo: true, promoLabel: "Vision",   promoLink: "https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Blfmc9dlf" }),
      m("ernie-4.5-21b-a3b",     0.07, 0.28, 120, { promo: true, promoLabel: "New",      promoLink: "https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Blfmc9dlf" }),
      m("ernie-4.5-turbo-128k",  0.42, 1.40, 128),
      m("ernie-4.5-8k",          0.28, 0.28,   8, { promo: true, promoLabel: "Popular",  promoLink: "https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Blfmc9dlf" }),
      m("ernie-lite-8k",         null, null,   8, { promo: true, promoLabel: "Free tier" }),
    ],
  },

  // ── Yi (01.AI) ────────────────────────���───────────────────────────────────
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
    lastUpdated: "2026-06-23",
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
    description: "Chinese AI startup. Step 3.7 Flash (262K, MoE reasoning) and Step-2 long-context models.",
    hq: "CN",
    tier: "budget",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      m("step-3.7-flash",  0.20, 1.15, 262, { promo: true, promoLabel: "New",      promoLink: "https://platform.stepfun.com/docs/pricing/step-price" }),
      m("step-2-16k",      0.38, 0.38,  16, { promo: true, promoLabel: "Popular",  promoLink: "https://platform.stepfun.com/docs/pricing/step-price" }),
      m("step-flash",      0.08, 0.08,  32, { promo: true, promoLabel: "Cheapest" }),
      m("step-2",          0.90, 0.90, 512),
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
    description: "Tencent's LLM platform. HY3 is a 295B MoE reasoning model (July 2026, 256K ctx, Apache 2.0). Endpoint: Tencent TokenHub. Supports fast/slow thinking modes.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2026-07-11",
    models: [
      // ── HY3 (latest, July 2026) ──────────────────────────────────────────
      m("hy3",              null, null, 256, { promo: true, promoLabel: "New · 295B MoE" }),
      // ── Legacy Hunyuan ───────────────────────────────────────────────────
      m("hunyuan-turbo-s",  null, null, 256, { promo: true, promoLabel: "Free tier", promoLink: "https://cloud.tencent.com/document/product/1729/97731" }),
      m("hunyuan-turbos",   0.07, 0.14, 256, { promo: true, promoLabel: "Popular" }),
      m("hunyuan-lite",     null, null, 256, { promo: true, promoLabel: "Free" }),
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
    lastUpdated: "2026-06-23",
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
    lastUpdated: "2026-06-23",
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
    lastUpdated: "2026-06-23",
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
    description: "Developer cloud for open-model inference and fine-tuning. Kimi K2.6, DeepSeek V4, Qwen3. Free credits on sign-up.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      m("kimi-k2.6",                         0.80, 3.40,  262, { promo: true, promoLabel: "Kimi K2.6",  promoLink: "https://www.lepton.ai/docs" }),
      m("deepseek-v4-flash",                 0.14, 0.28, 1024, { promo: true, promoLabel: "Best price",  promoLink: "https://www.lepton.ai/pricing" }),
      m("qwen3-235b-a22b",                   0.60, 0.80,  262, { promo: true, promoLabel: "MoE",         promoLink: "https://www.lepton.ai/docs" }),
      m("llama3.3-70b",                      0.80, 0.80,  128),
      m("llama3.1-8b",                       0.07, 0.07,  128, { promo: true, promoLabel: "Free tier" }),
    ],
  },

  // ── Deep Infra ────────────────────────────────────────────��──��──����──����──��──
  deepinfra: {
    id: "deepinfra",
    name: "Deep Infra",
    website: "https://deepinfra.com",
    pricingUrl: "https://deepinfra.com/pricing",
    docsUrl: "https://deepinfra.com/docs",
    changelogUrl: "https://deepinfra.com/blog",
    description: "Serverless GPU cloud. 100+ models across DeepSeek V4, Qwen3, Gemini 3.x, and Llama 4. Pay-per-token, no idle costs.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      // ��─ DeepSeek ───────────────────────────────────────────────────────────
      m("deepseek-ai/DeepSeek-V4-Pro",                      1.30, 2.60, 1024, { promo: true, promoLabel: "Flagship",  promoLink: "https://deepinfra.com/pricing" }),
      m("deepseek-ai/DeepSeek-V4-Flash",                    0.10, 0.20, 1024, { promo: true, promoLabel: "Cheapest",  promoLink: "https://deepinfra.com/pricing", promoOriginalInputPer1M: 0.27, promoOriginalOutputPer1M: 1.10 }),
      m("deepseek-ai/DeepSeek-V3.2",                        0.26, 0.38,  160),
      m("deepseek-ai/DeepSeek-R1-0528",                     0.50, 2.15,  160),
      // ── Qwen3 ──────────────────────────────────────��──────────────────────
      m("Qwen/Qwen3.7-Max",                                 2.50, 7.50,  250, { promo: true, promoLabel: "Qwen3.7",   promoLink: "https://deepinfra.com/pricing" }),
      m("Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo",        0.30, 1.00,  256, { promo: true, promoLabel: "Coder",     promoLink: "https://deepinfra.com/pricing" }),
      m("Qwen/Qwen3-235B-A22B-Instruct-2507",               0.09, 0.10,  256),
      m("Qwen/Qwen3-VL-235B-A22B-Instruct",                 0.20, 0.88,  256, { promo: true, promoLabel: "Vision",    promoLink: "https://deepinfra.com/pricing" }),
      // ── Gemini (via DeepInfra) ─────────────────────────────────────────────
      m("google/gemini-3.5-flash",                          1.50, 9.00,  976, { promo: true, promoLabel: "Gemini 3.5",promoLink: "https://deepinfra.com/pricing" }),
      m("google/gemini-3.1-pro",                            2.00,12.00,  976),
      m("google/gemini-2.5-flash",                          0.30, 2.50,  976),
      // ── Llama 4 ────────────────────────────────────────────────────────────
      m("meta-llama/Llama-4-Maverick-17B-128E",             0.15, 0.60, 1024, { promo: true, promoLabel: "Llama 4",   promoLink: "https://deepinfra.com/pricing" }),
      m("meta-llama/Llama-4-Scout-17B-16E",                 0.10, 0.30,  320),
      // ── Llama 3 ────────────────────����───��──��──��───��─��───��───��────��──��───��──
      m("meta-llama/Llama-3.3-70B-Instruct-Turbo",          0.10, 0.32,  128),
      m("meta-llama/Meta-Llama-3.1-8B-Instruct",            0.02, 0.05,  128, { promo: true, promoLabel: "Ultra-cheap",promoLink: "https://deepinfra.com/pricing" }),
      // ── Gemma 4 ────────────────────────────────────────────────────────────
      m("google/gemma-4-31B-it-turbo",                      0.12, 0.37,  256, { promo: true, promoLabel: "Vision",    promoLink: "https://deepinfra.com/pricing" }),
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
    lastUpdated: "2026-06-23",
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
    lastUpdated: "2026-06-23",
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
    lastUpdated: "2026-06-23",
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
    lastUpdated: "2026-06-23",
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
    lastUpdated: "2026-06-23",
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
    description: "Run open-source ML models via API. Best known for FLUX image gen, video gen, and 10k+ community models.",
    hq: "US",
    tier: "mid",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2026-06-23",
    models: [
      // ── Chat ───────────────────────────────────────────────────────────────
      m("meta/llama-4-maverick-17b-128e-instruct",  0.15, 0.60, 1024, { promo: true, promoLabel: "Llama 4",    promoLink: "https://replicate.com/meta/llama-4-maverick-17b-128e-instruct" }),
      m("deepseek-ai/deepseek-r1-0528",             0.50, 2.15,  160, { promo: true, promoLabel: "Reasoning",  promoLink: "https://replicate.com/deepseek-ai/deepseek-r1" }),
      m("meta/meta-llama-3.1-405b-instruct",        9.50, 9.50,  128),
      // ── Image gen ──────────────────────────────────────────────────────────
      m("black-forest-labs/flux-1.1-pro-ultra",     null, null, null, { promo: true, promoLabel: "Image gen",  promoLink: "https://replicate.com/black-forest-labs/flux-1.1-pro-ultra" }),
      m("black-forest-labs/flux-kontext-pro",       null, null, null, { promo: true, promoLabel: "Edit images",promoLink: "https://replicate.com/black-forest-labs/flux-kontext-pro" }),
      // ── Video gen ──────────────────────────────────────────────────────────
      m("minimax/video-02",                         null, null, null, { promo: true, promoLabel: "Video gen",  promoLink: "https://replicate.com/minimax/video-02" }),
    ],
  },

  // ── Dahono Labs Gateway ────��──────────────────────────────────────────────
  dahono: {
    id: "dahono",
    name: "Dahono Router",
    website: "https://router.dahono.com",
    pricingUrl: "https://router.dahono.com/models",
    docsUrl: "https://router.dahono.com",
    changelogUrl: "https://router.dahono.com",
    description: "Indonesian AI gateway. 15+ models from OpenAI, DeepSeek, Moonshot, GLM, and more — free and paid tiers.",
    hq: "ID",
    tier: "gateway",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2026-07-19",
    models: [
      m("dahono/ai-chat",                  null, null, null, { promo: true, promoLabel: "Free", promoLink: "https://router.dahono.com/models" }),
      m("dahono/deepseek-v4-flash",        null, null, null, { promo: true, promoLabel: "Free" }),
      m("dahono/deepseek-v4-pro",          null, null, null, { promo: true, promoLabel: "Free · Starter" }),
      m("dahono/auto",                     null, null, null, { promo: true, promoLabel: "Free" }),
      m("dahono/glm-5.2",                  null, null, null, { promo: true, promoLabel: "Free · Pro" }),
      m("dahono/kimi-k2.7-code",           null, null, null, { promo: true, promoLabel: "Free · Pro" }),
      m("dahono/kimi-k2.7-code-highspeed", null, null, null, { promo: true, promoLabel: "Free · Pro" }),
      m("dahono/kimi-k3",                  null, null, null, { promo: true, promoLabel: "Free · Pro" }),
      m("dahono/gpt-5.5",                  null, null, null),
      m("dahono/gpt-5.6-luna",             null, null, null),
      m("dahono/gpt-5.6-sol",              null, null, null),
      m("dahono/gpt-5.6-terra",            null, null, null),
      m("dahono/minimax-m3",               null, null, null),
      m("dahono/hy3",                      null, null, null, { promo: true, promoLabel: "Free · Starter" }),
      m("dahono/laguna-xs-2.1",            null, null, null, { promo: true, promoLabel: "Free · Starter" }),
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
    lastUpdated: "2026-06-23",
    models: [
      m("gpt-5.5",      5.00, 30.00, 1000, { promo: true, promoLabel: "New",      promoLink: "https://learn.microsoft.com/en-us/azure/ai-services/openai/whats-new" }),
      m("gpt-5.4",      2.50, 15.00, 1000, { promo: true, promoLabel: "Balanced", promoLink: "https://learn.microsoft.com/en-us/azure/ai-services/openai/whats-new" }),
      m("gpt-5",       10.00, 40.00, 1000),
      m("gpt-4.1",      2.00,  8.00, 1000),
      m("gpt-4.1-mini", 0.40,  1.60, 1000, { promo: true, promoLabel: "Best value",promoLink: "https://learn.microsoft.com/en-us/azure/ai-services/openai/whats-new" }),
      m("gpt-4o",       2.50, 10.00,  128),
      m("gpt-4o-mini",  0.15,  0.60,  128),
    ],
  },

  // ── New providers added 2026-06-24 (from OpenRouter catalog) ─────────────────

  // ── Arcee AI ──────────────────────────────────────────────────────────────────
  "arcee-ai": {
    id: "arcee-ai", name: "Arcee AI",
    website: "https://arcee.ai", pricingUrl: "https://arcee.ai/pricing",
    docsUrl: "https://docs.arcee.ai",
    description: "Specialised in small, efficient models via Mixture-of-Experts. Focuses on enterprise fine-tuning and on-device deployment.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("arcee-blaze", null, null, 128, { promo: true, promoLabel: "MoE" }), m("arcee-lite", null, null, 32) ],
  },

  // ── AionLabs ─────────────────────────────────────────────────────────────────
  "aion-labs": {
    id: "aion-labs", name: "AionLabs",
    website: "https://aionlabs.net", pricingUrl: "https://aionlabs.net",
    description: "Israeli AI lab. Aion-1 series models for reasoning and instruction following.",
    hq: "IL", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("aion-1", null, null, 128, { promo: true, promoLabel: "Flagship" }), m("aion-1-mini", null, null, 32) ],
  },

  // ── AkashML ───────────����──────────────────────────────────────────────────────
  akashml: {
    id: "akashml", name: "AkashML",
    website: "https://akash.network", pricingUrl: "https://console.akash.network",
    docsUrl: "https://docs.akash.network",
    description: "Decentralised cloud GPU marketplace. Runs open-source models on permissionless compute.",
    hq: "US", tier: "budget", hasFreeTier: true, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("meta-llama/llama-3.3-70b-instruct", 0.10, 0.20, 128, { promo: true, promoLabel: "Decentralised" }) ],
  },

  // ── Amazon Bedrock ────────────────────────────────────────────────────────────
  "amazon-bedrock": {
    id: "amazon-bedrock", name: "Amazon Bedrock",
    website: "https://aws.amazon.com/bedrock", pricingUrl: "https://aws.amazon.com/bedrock/pricing",
    docsUrl: "https://docs.aws.amazon.com/bedrock",
    statusUrl: "https://health.aws.amazon.com/health/status",
    description: "AWS managed service hosting 30+ foundation models including Claude, Llama, Titan, Mistral, and Stable Diffusion.",
    hq: "US", tier: "gateway", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [
      m("anthropic.claude-opus-4-5-20251101-v1:0", null, null, 200, { promo: true, promoLabel: "Claude" }),
      m("meta.llama4-scout-17b-16e-instruct-v1:0", null, null, 512, { promo: true, promoLabel: "Llama 4" }),
      m("amazon.titan-text-express-v1", null, null, 8),
    ],
  },

  // ── AtlasCloud ────────────────────────────────────────────────────────────────
  "atlas-cloud": {
    id: "atlas-cloud", name: "AtlasCloud",
    website: "https://atlascloud.ai", pricingUrl: "https://atlascloud.ai/pricing",
    description: "GPU cloud for AI inference. Serves open-source models with competitive pricing.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("llama-3.3-70b", 0.09, 0.18, 128, { promo: true, promoLabel: "Fast" }) ],
  },

  // ── BaseTen ───────────────────────────────────────────────────────────────────
  baseten: {
    id: "baseten", name: "BaseTen",
    website: "https://baseten.co", pricingUrl: "https://baseten.co/pricing",
    docsUrl: "https://docs.baseten.co",
    description: "ML deployment platform for custom model serving. Deploy and scale any Hugging Face model instantly.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("llama-3-70b-instruct", null, null, 8, { promo: true, promoLabel: "Custom deploy" }) ],
  },

  // ── Black Forest Labs ─────────────────────────────────────────────────────────
  "black-forest-labs": {
    id: "black-forest-labs", name: "Black Forest Labs",
    website: "https://blackforestlabs.ai", pricingUrl: "https://docs.bfl.ml/pricing",
    docsUrl: "https://docs.bfl.ml",
    description: "Creators of FLUX image generation models. FLUX.1 Pro/Dev/Schnell lead image-gen benchmarks.",
    hq: "DE", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [
      m("flux-1.1-pro-ultra", null, null, null, { promo: true, promoLabel: "Ultra" }),
      m("flux-1.1-pro",       null, null, null, { promo: true, promoLabel: "Pro" }),
      m("flux-1-dev",         null, null, null),
      m("flux-1-schnell",     null, null, null, { promo: true, promoLabel: "Fastest" }),
    ],
  },

  // ── Cerebras ───────────���────���─────���───���────��───��─────────────────────────────
  // Already exists — overriding with extended info if missing
  // ── Chutes ───────────────────────────────────────────────────────────────────
  chutes: {
    id: "chutes", name: "Chutes",
    website: "https://chutes.ai", pricingUrl: "https://chutes.ai/pricing",
    description: "Decentralised AI inference marketplace on bittensor subnet. Run open-source models competitively.",
    hq: "US", tier: "budget", hasFreeTier: true, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("deepseek-v3", 0.14, 0.28, 128, { promo: true, promoLabel: "Low cost" }) ],
  },

  // ── Clarifai ─────────────────────────────────────────────────────────────────
  clarifai: {
    id: "clarifai", name: "Clarifai",
    website: "https://clarifai.com", pricingUrl: "https://clarifai.com/pricing",
    docsUrl: "https://docs.clarifai.com/compute/inference/api/openai",
    description: "AI platform with an OpenAI-compatible compute layer. Routes to GPT, Claude, DeepSeek, Llama, Gemini, and Mistral models via a single PAT.",
    hq: "US", tier: "gateway", hasFreeTier: true, liveModels: false, lastUpdated: "2026-07-19",
    models: [
      m("openai/chat-completion/models/gpt-4o",        null, null, 128, { promo: true, promoLabel: "Free tier" }),
      m("openai/chat-completion/models/gpt-4o-mini",   null, null, 128),
      m("deepseek-ai/deepseek-chat/models/DeepSeek-R1", null, null, 128, { promo: true, promoLabel: "Reasoning" }),
      m("meta/Llama-3/models/Llama-3_3-70B-Instruct",   null, null, 128),
      m("mistral-ai/completion/models/mistral-large",   null, null, 128),
      m("gcp/generate/models/gemini-2_5-flash",         null, null, 1000),
    ],
  },

  // ── Crusoe Cloud ──────────────────────────────────────────────────────────────
  crusoe: {
    id: "crusoe", name: "Crusoe Cloud",
    website: "https://www.crusoe.ai", pricingUrl: "https://www.crusoe.ai/products/inference",
    docsUrl: "https://docs.crusoecloud.com",
    description: "Vertically-integrated AI cloud running on stranded and clean energy. Managed inference with an OpenAI-compatible endpoint for open models.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-08-15",
    models: [
      m("meta-llama/Llama-3.3-70B-Instruct", 0.60, 0.60, 128, { promo: true, promoLabel: "Popular" }),
      m("meta-llama/Llama-3.1-8B-Instruct",  0.10, 0.10, 128),
      m("deepseek-ai/DeepSeek-R1",           2.00, 6.00, 128),
      m("Qwen/Qwen2.5-72B-Instruct",         0.60, 0.60, 128),
    ],
  },

  // ── DeepInfra ─────────────────────────────────────────────────────────────────
  // Already exists

  // ── DigitalOcean Gradient AI ──────────────────────────────────────────────────
  digitalocean: {
    id: "digitalocean", name: "DigitalOcean Gradient AI",
    website: "https://www.digitalocean.com/products/gradient/platform", pricingUrl: "https://www.digitalocean.com/pricing/gradient-ai-platform",
    docsUrl: "https://docs.digitalocean.com/products/gradient-ai-platform/",
    description: "Serverless inference platform on the developer cloud. OpenAI-compatible endpoint for open-weight models, billed per token.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: true, lastUpdated: "2026-07-19",
    models: [
      m("meta-llama/Llama-3.3-70B-Instruct",     0.65, 0.65, 128, { promo: true, promoLabel: "Popular", promoLink: "https://www.digitalocean.com/pricing/gradient-ai-platform" }),
      m("meta-llama/Meta-Llama-3.1-8B-Instruct", 0.10, 0.10, 128),
      m("openai-gpt-oss-120b",                    0.15, 0.60, 131),
      m("openai-gpt-oss-20b",                     0.07, 0.30, 131),
      m("deepseek-r1-distill-llama-70b",          0.60, 0.60, 128),
      m("mistral-nemo-instruct-2407",             0.15, 0.15, 128),
    ],
  },

  // ── Featherless ───────────────────────────────────────────────────────────────
  featherless: {
    id: "featherless", name: "Featherless",
    website: "https://featherless.ai", pricingUrl: "https://featherless.ai/pricing",
    description: "Serverless fine-tuned model hosting. Deploy any HuggingFace model as an API instantly.",
    hq: "US", tier: "specialised", hasFreeTier: true, liveModels: true, lastUpdated: "2026-06-24",
    models: [ m("qwen2.5-72b-instruct", null, null, 128, { promo: true, promoLabel: "Serverless" }) ],
  },

  // ── Fireworks AI ─────────────────────────────────────────────────────────────
  // Already exists

  // ── Friendli ─────────────────────────────────────────────────────────────────
  friendli: {
    id: "friendli", name: "Friendli",
    website: "https://friendli.ai", pricingUrl: "https://friendli.ai/pricing",
    docsUrl: "https://docs.friendli.ai",
    description: "Korean AI serving platform. Llama, DeepSeek, Qwen with GPU-optimised inference at scale.",
    hq: "KR", tier: "mid", hasFreeTier: false, liveModels: true, lastUpdated: "2026-06-24",
    models: [
      m("meta-llama-3.3-70b-instruct", 0.15, 0.30, 128, { promo: true, promoLabel: "Fast" }),
      m("deepseek-v3", 0.14, 0.28, 128),
    ],
  },

  // ── GMICloud ─────────────────────────────────────────────────────────────────
  gmicloud: {
    id: "gmicloud", name: "GMICloud",
    website: "https://gmicloud.ai", pricingUrl: "https://gmicloud.ai/pricing",
    description: "GPU marketplace for AI inference. On-demand and spot GPU clusters.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("llama-3.3-70b", 0.09, 0.18, 128, { promo: true, promoLabel: "Spot" }) ],
  },

  // ── Google AI Studio ─────────────────────────────────────────────────────────
  "google-ai-studio": {
    id: "google-ai-studio", name: "Google AI Studio",
    website: "https://aistudio.google.com", pricingUrl: "https://ai.google.dev/pricing",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    description: "Free Gemini API access via AI Studio. 2M context. Free tier available with rate limits.",
    hq: "US", tier: "gateway", hasFreeTier: true, liveModels: false, lastUpdated: "2026-06-24",
    models: [
      m("gemini-3-flash", null, null, 1000, { promo: true, promoLabel: "Free" }),
      m("gemini-2.5-flash", null, null, 1000, { promo: true, promoLabel: "Free tier" }),
    ],
  },

  // ── Google Vertex ─────────────────────────────────────────────────────────────
  "google-vertex": {
    id: "google-vertex", name: "Google Vertex AI",
    website: "https://cloud.google.com/vertex-ai", pricingUrl: "https://cloud.google.com/vertex-ai/pricing",
    docsUrl: "https://cloud.google.com/vertex-ai/docs",
    description: "Enterprise Gemini and PaLM via Google Cloud. IAM-secured, private, and enterprise-ready.",
    hq: "US", tier: "gateway", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [
      m("gemini-3-flash", 0.30, 2.50, 1000, { promo: true, promoLabel: "Enterprise" }),
      m("gemini-2.5-pro", 1.25, 10.00, 1000),
    ],
  },

  // ── Inception ─────────────────────────────────────────────────────────────────
  // Already exists

  // ── Inceptron ─────────────────────────────────────────────────────────────────
  inceptron: {
    id: "inceptron", name: "Inceptron",
    website: "https://inceptron.se", pricingUrl: "https://inceptron.se/pricing",
    description: "Swedish AI inference provider. European data residency for GDPR-compliant AI.",
    hq: "SE", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("llama-3.3-70b-instruct", null, null, 128, { promo: true, promoLabel: "EU" }) ],
  },

  // ── Infermatic ────────────────────────────────────────────────────────────────
  infermatic: {
    id: "infermatic", name: "Infermatic",
    website: "https://infermatic.ai", pricingUrl: "https://infermatic.ai/pricing",
    description: "High-performance serverless AI inference. 1000+ tok/s on popular open-source models.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("llama-3.3-70b-instruct", 0.07, 0.14, 128, { promo: true, promoLabel: "Ultra-fast" }) ],
  },

  // ── Inflection ───────────────────────────────────────────────────────────────
  inflection: {
    id: "inflection", name: "Inflection AI",
    website: "https://inflection.ai", pricingUrl: "https://developers.inflection.ai",
    docsUrl: "https://developers.inflection.ai",
    description: "Maker of Pi personal AI. Inflection-3.5 with empathetic conversational capabilities.",
    hq: "US", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [
      m("inflection-3.5", null, null, 128, { promo: true, promoLabel: "Flagship" }),
      m("inflection-3-pi", null, null, 32),
    ],
  },

  // ── io.net ────────────────────────────────────────────────────────────────────
  "io-net": {
    id: "io-net", name: "io.net",
    website: "https://io.net", pricingUrl: "https://io.net/pricing",
    docsUrl: "https://docs.io.net",
    description: "Decentralised GPU cloud. Cost-effective inference powered by distributed idle GPUs.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("llama-3.1-70b-instruct", 0.06, 0.12, 128, { promo: true, promoLabel: "DePIN" }) ],
  },

  // ── Liquid ────────────────────────────────────────────────────────────────────
  liquid: {
    id: "liquid", name: "Liquid AI",
    website: "https://liquid.ai", pricingUrl: "https://liquid.ai/api",
    docsUrl: "https://docs.liquid.ai",
    description: "Liquid Foundation Models (LFM). Novel liquid neural networks for edge and cloud deployment.",
    hq: "US", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [
      m("lfm-7b",  null, null, 32, { promo: true, promoLabel: "Novel arch" }),
      m("lfm-40b", null, null, 128, { promo: true, promoLabel: "Flagship" }),
    ],
  },

  // ── Mancer ────────────────────────────────────────────────────────────────────
  mancer: {
    id: "mancer", name: "Mancer",
    website: "https://mancer.tech", pricingUrl: "https://mancer.tech/pricing",
    description: "Uncensored AI inference provider. Hosts permissive open-source models with no content filters.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("weaver-alpha", null, null, 8, { promo: true, promoLabel: "Permissive" }) ],
  },

  // ── Moonshot AI ───────────────────────────────────────────────────────────────
  moonshotai: {
    id: "moonshotai", name: "Moonshot AI",
    website: "https://moonshot.ai", pricingUrl: "https://platform.moonshot.ai/pricing",
    docsUrl: "https://platform.moonshot.ai/docs",
    description: "Chinese AI lab, makers of Kimi. Kimi K2 and K1.5 with 1M context and coding focus.",
    hq: "CN", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [
      m("kimi-k2.7-code", null, null, 128, { promo: true, promoLabel: "Coding" }),
      m("kimi-k2.6",      null, null, 1000, { promo: true, promoLabel: "1M ctx" }),
      m("moonshot-v1-128k", null, null, 128),
    ],
  },

  // ── Morph ─────────────────────────────────────────────────────────────────────
  morph: {
    id: "morph", name: "Morph",
    website: "https://morphllm.com", pricingUrl: "https://morphllm.com/pricing",
    docsUrl: "https://docs.morphllm.com",
    description: "Specialises in fast code editing and diff-application models for developer tools.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("morph-v3", null, null, 32, { promo: true, promoLabel: "Code edit" }) ],
  },

  // ── Nebius ───────────────────────────────────────────────────────────��───���────
  nebius: {
    id: "nebius", name: "Nebius",
    website: "https://nebius.com", pricingUrl: "https://nebius.com/prices",
    docsUrl: "https://docs.nebius.com",
    description: "Yandex spinout. European GPU cloud with open-source model hosting and fine-tuning.",
    hq: "NL", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [
      m("meta-llama/llama-3.3-70b-instruct", 0.13, 0.40, 128, { promo: true, promoLabel: "EU" }),
      m("deepseek-v3", 0.14, 0.28, 128),
    ],
  },

  // ── Nex AGI ───────────────────────────────────────────────────────────────────
  "nex-agi": {
    id: "nex-agi", name: "Nex AGI",
    website: "https://nexagi.com", pricingUrl: "https://nexagi.com/pricing",
    description: "Chinese AI lab focused on reasoning and agentic models. Nex-1 with chain-of-thought.",
    hq: "CN", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("nex-1-reasoning", null, null, 128, { promo: true, promoLabel: "Reasoning" }) ],
  },

  // ── NextBit ───────────────────────────────────────────────────────────────────
  nextbit: {
    id: "nextbit", name: "NextBit",
    website: "https://nextbit.ai", pricingUrl: "https://nextbit.ai/pricing",
    description: "Spanish AI startup. Efficient LLMs for European enterprise customers.",
    hq: "ES", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("nextbit-7b", null, null, 32, { promo: true, promoLabel: "EU" }) ],
  },

  // ── Nous Research ─────────────────────────────────────────────────────────────
  nousresearch: {
    id: "nousresearch", name: "Nous Research",
    website: "https://portal.nousresearch.com", pricingUrl: "https://portal.nousresearch.com/pricing",
    docsUrl: "https://docs.nousresearch.com",
    description: "Open model lab behind the Hermes series. Nous Portal subscription unlocks Hermes 4 and DeepHermes via a single API key.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-07-19",
    models: [
      m("hermes-4-405b",                  null, null, 128, { promo: true, promoLabel: "Flagship" }),
      m("hermes-4-70b",                    null, null, 128),
      m("hermes-3-llama-3.1-70b",          null, null, 128),
      m("deephermes-3-llama-3-8b-preview", null, null, 128),
    ],
  },

  // ── Perceptron ───────────────────────────────────────────────────────────────
  perceptron: {
    id: "perceptron", name: "Perceptron",
    website: "https://perceptron.ai", pricingUrl: "https://perceptron.ai/pricing",
    description: "Fast and cheap inference for open-source LLMs with OpenAI-compatible API.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("llama-3.3-70b-instruct", 0.05, 0.10, 128, { promo: true, promoLabel: "Cheapest" }) ],
  },

  // ── Phala ─────────────────────────────────────────────────────────────────────
  phala: {
    id: "phala", name: "Phala Network",
    website: "https://phala.network", pricingUrl: "https://red-pill.ai",
    docsUrl: "https://docs.phala.network",
    description: "Confidential AI inference with TEE (Trusted Execution Environment). Privacy-preserving compute.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("llama-3.3-70b-instruct", null, null, 128, { promo: true, promoLabel: "Confidential" }) ],
  },

  // ── Poolside ─────────────────────────────────────────────────────────────────
  poolside: {
    id: "poolside", name: "Poolside",
    website: "https://poolside.ai", pricingUrl: "https://poolside.ai",
    description: "Specialised code generation AI. Malibu model trained on synthetic code execution data.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("malibu", null, null, 64, { promo: true, promoLabel: "Code" }) ],
  },

  // ── Reka ──────────────────────────────────────────────────────────────────────
  reka: {
    id: "reka", name: "Reka AI",
    website: "https://reka.ai", pricingUrl: "https://reka.ai/pricing",
    docsUrl: "https://docs.reka.ai",
    description: "Multimodal frontier lab. Reka Core and Flash handle text, vision, and video understanding with a lean OpenAI-style API.",
    hq: "US", tier: "mid", hasFreeTier: false, liveModels: true, lastUpdated: "2026-07-19",
    models: [
      m("reka-core",           2.00, 6.00, 128, { promo: true, promoLabel: "Flagship" }),
      m("reka-flash",          0.80, 2.00, 128, { promo: true, promoLabel: "Fast" }),
      m("reka-flash-research", null, null, 128),
      m("reka-edge",           0.40, 1.00,  32),
    ],
  },

  // ── Relace ────────────────────────────────────────────────────────────────────
  relace: {
    id: "relace", name: "Relace",
    website: "https://relace.ai", pricingUrl: "https://relace.ai/pricing",
    description: "Real-time code editing specialised model. Instant-fill code completions with <1s latency.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("instant-apply", null, null, 8, { promo: true, promoLabel: "Code edit" }) ],
  },

  // ── SambaNova ─────────────────────────────────────────────────────────────────
  // Already exists

  // ── Seed ──────────────────────────────────────────────────────────────────────
  seed: {
    id: "seed", name: "Seed",
    website: "https://seed.sg", pricingUrl: "https://seed.sg/pricing",
    description: "Singapore AI lab. Seed-X series with multilingual and code capabilities.",
    hq: "SG", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("seed-x-7b", null, null, 128, { promo: true, promoLabel: "Multilingual" }) ],
  },

  // ── SiliconFlow ───────────────────────────────────────────────────────────────
  siliconflow: {
    id: "siliconflow", name: "SiliconFlow",
    website: "https://siliconflow.cn", pricingUrl: "https://siliconflow.cn/pricing",
    docsUrl: "https://docs.siliconflow.cn",
    description: "Chinese AI inference platform. 60+ open-source models at competitive prices with free tier.",
    hq: "CN", tier: "budget", hasFreeTier: true, liveModels: true, lastUpdated: "2026-06-24",
    models: [
      m("deepseek-v3",         0.14, 0.28, 64, { promo: true, promoLabel: "Best price" }),
      m("qwen2.5-72b-instruct",0.12, 0.24, 128, { promo: true, promoLabel: "Free tier" }),
      m("llama-3.3-70b-instruct",0.10, 0.20, 128),
    ],
  },

  // ── Switchpoint ─��─────���───────────────────────────────────────────────────────
  switchpoint: {
    id: "switchpoint", name: "Switchpoint",
    website: "https://switchpoint.ai", pricingUrl: "https://switchpoint.ai/pricing",
    description: "AI routing and inference aggregator. Automatically routes requests to optimal providers.",
    hq: "US", tier: "gateway", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("auto", null, null, null, { promo: true, promoLabel: "Auto-route" }) ],
  },

  // ── Together AI ───────────────────────────────────────────────────────────────
  // Already exists

  // ── Upstage ───────────────────────────────────────────────────────────────────
  // Already exists

  // ── Venice ────────────────────────────────────────────────────────────────────
  venice: {
    id: "venice", name: "Venice AI",
    website: "https://venice.ai", pricingUrl: "https://venice.ai/pricing",
    docsUrl: "https://docs.venice.ai",
    description: "Privacy-first AI inference. No logs, no training on prompts. Runs Llama, Mistral on private nodes.",
    hq: "US", tier: "specialised", hasFreeTier: true, liveModels: false, lastUpdated: "2026-06-24",
    models: [
      m("llama-3.3-70b-instruct", null, null, 128, { promo: true, promoLabel: "Private" }),
      m("mistral-31-24b",         null, null, 128),
    ],
  },

  // ── WandB (Weave) ─────────────────────────────────────────────────────────────
  wandb: {
    id: "wandb", name: "Weights & Biases",
    website: "https://wandb.ai", pricingUrl: "https://wandb.ai/pricing",
    docsUrl: "https://docs.wandb.ai",
    description: "MLOps platform with hosted model inference via Weave. Track experiments and deploy models.",
    hq: "US", tier: "specialised", hasFreeTier: true, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("llama-3.3-70b-instruct", null, null, 128, { promo: true, promoLabel: "MLOps" }) ],
  },

  // ── Xiaomi (MiMo) ─────────────────────────────────────────────────────────────
  xiaomi: {
    id: "xiaomi", name: "Xiaomi",
    website: "https://xiaomimimo.com", pricingUrl: "https://xiaomimimo.com/pricing",
    docsUrl: "https://xiaomimimo.com/docs",
    description: "Xiaomi's MiMo model family. OpenAI-compatible endpoint for its reasoning-tuned LLMs, built for on-device and cloud deployment.",
    hq: "CN", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-08-15",
    models: [
      m("mimo-v2.5-pro",   1.00, 3.00, 128, { promo: true, promoLabel: "Flagship" }),
      m("mimo-v2.5-flash", 0.20, 0.60, 128),
      m("mimo-7b-rl",      null, null,  32),
    ],
  },

  // ── Marketku Router ───────────────────────────────────────────────────────────
  marketku: {
    id: "marketku",
    name: "Marketku Router",
    website: "https://router.marketku.id",
    pricingUrl: "https://router.marketku.id",
    docsUrl: "https://router.marketku.id",
    description: "Indonesian AI gateway. 69+ models via the mk/ namespace — Claude, DeepSeek, Qwen, GLM, MiniMax, and more. OpenAI-compatible endpoint.",
    hq: "ID",
    tier: "gateway",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2026-06-28",
    models: [
      m("mk/auto",                         null, null, null, { promo: true, promoLabel: "Auto-route", promoLink: "https://router.marketku.id/models" }),
      m("mk/auto-thinking",                null, null, null),
      m("mk/sonnet-4.5-thinking",          null, null, null, { promo: true, promoLabel: "Best coding" }),
      m("mk/sonnet-4.5",                   null, null, null, { promo: true, promoLabel: "Claude" }),
      m("mk/sonnet-4.5-thinking-agentic",  null, null, null),
      m("mk/deepseek-3.2",                 null, null, null, { promo: true, promoLabel: "DeepSeek" }),
      m("mk/deepseek-3.2-thinking",        null, null, null),
      m("mk/deepseek-3.2-agentic",         null, null, null),
      m("mk/deepseek-3.2-thinking-agentic",null, null, null),
      m("mk/deepseek-v3.2",                null, null, null),
      m("mk/deepseek-v4-flash",            null, null, null),
      m("mk/deepseek-v4-pro",              null, null, null),
      m("mk/glm-5",                        null, null, null, { promo: true, promoLabel: "GLM" }),
      m("mk/glm-5-thinking",               null, null, null),
      m("mk/glm-5-agentic",                null, null, null),
      m("mk/glm-5-thinking-agentic",       null, null, null),
      m("mk/glm-5.1",                      null, null, null),
      m("mk/glm-5.2",                      null, null, null),
      m("mk/minimax-m2.5",                 null, null, null, { promo: true, promoLabel: "MiniMax" }),
      m("mk/minimax-m2.1-agentic",         null, null, null),
      m("mk/minimax-m2.5-thinking-agentic",null, null, null),
      m("mk/kimi-k2.7-code",               null, null, null),
      m("mk/qwen3-coder-next",             null, null, null, { promo: true, promoLabel: "Coder" }),
      m("mk/qwen3-coder-next-thinking",    null, null, null),
      m("mk/qwen3-coder-plus",             null, null, null),
      m("mk/qwen3-coder-flash",            null, null, null),
      m("mk/qwen3-235b-a22b",              null, null, null),
      m("mk/qwen3-max",                    null, null, null),
      m("mk/qwen3-32b",                    null, null, null),
      m("mk/qwen3-14b",                    null, null, null),
      m("mk/qwen3.5-flash",                null, null, null),
      m("mk/qwen3.6-flash",                null, null, null),
      m("mk/qwen3.6-plus",                 null, null, null),
      m("mk/qwen3.7-max",                  null, null, null),
      m("mk/qwen-max",                     null, null, null),
      m("mk/qwen-plus",                    null, null, null),
      m("mk/qwen-turbo",                   null, null, null),
      m("mk/qwen-flash",                   null, null, null),
      m("mk/qwq-plus",                     null, null, null),
      m("mk/ccai-pro",                     null, null, null),
    ],
  },

  // ── OpenModel ─────────────────────────────────────────────────────────────────
  openmodel: {
    id: "openmodel",
    name: "OpenModel",
    website: "https://openmodel.ai",
    pricingUrl: "https://openmodel.ai/pricing",
    docsUrl: "https://docs.openmodel.ai",
    description: "Multi-model LLM gateway and ops console. One API key, access all major providers — OpenAI, Anthropic, Google, DeepSeek — at official pass-through rates.",
    hq: "US",
    tier: "gateway",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2026-06-28",
    models: [
      m("deepseek-v4-flash",          0.00, 0.00, 1000, { promo: true, promoLabel: "Free now!", promoLink: "https://openmodel.ai" }),
      m("gpt-4o",                     2.50,10.00,  128),
      m("gpt-4o-mini",                0.15, 0.60,  128),
      m("gpt-4.1",                    2.00, 8.00,  128, { promo: true, promoLabel: "GPT-4.1" }),
      m("gpt-4.1-mini",               0.40, 1.60,  128),
      m("gpt-4.1-nano",               0.10, 0.40,  128),
      m("o4-mini",                    1.10, 4.40,  128),
      m("o3",                        10.00,40.00,  128),
      m("claude-opus-4-6",            4.75,23.75, 1000),
      m("claude-sonnet-4-5-20251001", 3.00,15.00,  200, { promo: true, promoLabel: "Popular" }),
      m("claude-haiku-4-5-20251001",  0.95, 4.75,  200),
      m("claude-3-5-sonnet-20241022", 3.00,15.00,  200),
      m("claude-3-5-haiku-20241022",  0.80, 4.00,  200),
      m("gemini-2.5-pro",             1.25,10.00, 1000),
      m("gemini-2.5-flash",           0.30, 2.50, 1000),
      m("gemini-2.0-flash",           0.10, 0.40, 1000),
      m("deepseek-v3",                0.27, 1.10, null),
      m("deepseek-r1",                0.55, 2.19, null),
      m("kimi-k2.5",                  0.48, 2.40, null),
      m("glm-4.7",                    0.57, 2.09,  128),
      m("glm-z1-flash",               0.10, 0.40,  128),
      m("qwen-plus",                  0.50, 2.00, null),
      m("qwen-turbo",                 0.05, 0.20, null),
    ],
  },

  // ── Miuclaw Gateway ───────────────────────────────────────────────────────────
  miuclaw: {
    id: "miuclaw",
    name: "Miuclaw Gateway",
    website: "https://www.miuclaw.my.id",
    pricingUrl: "https://www.miuclaw.my.id",
    docsUrl: "https://www.miuclaw.my.id/api/v1/models",
    description: "Self-hosted AI gateway at miuclaw.my.id — aggregates all synced working keys from every provider into one OpenAI-compatible endpoint. Automatic key rotation, fastest-first selection, and zero extra cost. Requires EXPORT_API_TOKEN.",
    hq: "ID",
    tier: "gateway",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2026-06-28",
    models: [
      m("miuclaw/auto", null, null, 0, { promo: true, promoLabel: "Auto-route", promoLink: "https://www.miuclaw.my.id" }),
    ],
  },

  // ── Avian ───────────────────────────────────────────���─���───────────────────────
  avian: {
    id: "avian",
    name: "Avian",
    website: "https://avian.io",
    pricingUrl: "https://avian.io/pricing",
    docsUrl: "https://docs.avian.io",
    description: "Inference API aggregator with live pricing. Focuses on the latest frontier open-source models — DeepSeek V4, Kimi K2, GLM-5, MiniMax M2 — at competitive rates with a single API key.",
    hq: "EU",
    tier: "gateway",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2026-06-28",
    models: [
      m("deepseek/deepseek-v4-flash",  0.105, 0.21,  1000, { promo: true, promoLabel: "Cheapest" }),
      m("deepseek/deepseek-v4-pro",    1.305, 2.61,  1000),
      m("deepseek/deepseek-v3.2",      0.23,  0.33,  163),
      m("minimax/minimax-m2.5",        0.27,  1.08,  196),
      m("z-ai/glm-5",                  0.95,  2.55,  200),
      m("z-ai/glm-5.1",                1.00,  3.20,  202),
      m("moonshotai/kimi-k2.5",        0.45,  2.20,  262, { promo: true, promoLabel: "Popular" }),
      m("moonshotai/kimi-k2.6",        0.95,  4.00,  262),
    ],
  },

  // ── Parasail ─────────────────────��────────────────────────────────────────────
  parasail: {
    id: "parasail",
    name: "Parasail",
    website: "https://parasail.io",
    pricingUrl: "https://parasail.io/pricing",
    docsUrl: "https://docs.parasail.io",
    description: "Cost-effective cloud GPU inference aggregator. Aggregates top AI hardware providers under one OpenAI-compatible API — on-demand serverless, dedicated, and batch jobs for Llama, Qwen, DeepSeek, and more.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2026-06-28",
    models: [
      m("meta-llama/Meta-Llama-3.3-70B-Instruct",  null, null, 128, { promo: true, promoLabel: "Popular" }),
      m("meta-llama/Meta-Llama-3.1-405B-Instruct",  null, null, 128),
      m("meta-llama/Meta-Llama-3.1-70B-Instruct",   null, null, 128),
      m("meta-llama/Meta-Llama-3.1-8B-Instruct",    null, null, 128),
      m("Qwen/Qwen2.5-72B-Instruct",                null, null, 128),
      m("deepseek-ai/DeepSeek-R1",                  null, null, 128, { promo: true, promoLabel: "Reasoning" }),
      m("deepseek-ai/DeepSeek-V3",                  null, null, 128),
      m("mistralai/Mistral-7B-Instruct-v0.3",       null, null, 32),
      m("google/gemma-3-27b-it",                    null, null, 128),
    ],
  },

  // ── Telnyx AI ─────────────────────────────────────────────────────────────────
  telnyx: {
    id: "telnyx",
    name: "Telnyx AI",
    website: "https://telnyx.com/ai",
    pricingUrl: "https://telnyx.com/pricing/inference",
    docsUrl: "https://developers.telnyx.com/docs/inference",
    description: "Telecom-grade AI inference from Telnyx. OpenAI-compatible endpoint powered by a private fiber network for low latency. Supports latest frontier open models including Kimi K2, GLM-5, MiniMax M2, and Llama.",
    hq: "US",
    tier: "mid",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2026-06-28",
    models: [
      m("moonshotai/Kimi-K2.6",                 null, null, 262, { promo: true, promoLabel: "Newest Kimi" }),
      m("moonshotai/Kimi-K2.5",                 null, null, 262),
      m("zai-org/GLM-5.1-FP8",                  null, null, 200, { promo: true, promoLabel: "GLM-5.1" }),
      m("MiniMaxAI/MiniMax-M2.7",               null, null, 196, { promo: true, promoLabel: "MiniMax" }),
      m("MiniMaxAI/MiniMax-M2.5",               null, null, 196),
      m("meta-llama/Meta-Llama-3.1-70B-Instruct", null, null, 128),
      m("meta-llama/Meta-Llama-3.1-8B-Instruct",  null, null, 128),
    ],
  },

  // ── Targon ────────────────────────────────────────────────────────────────────
  targon: {
    id: "targon",
    name: "Targon (Bittensor)",
    website: "https://targon.com",
    pricingUrl: "https://targon.com/models",
    docsUrl: "https://docs.targon.com",
    description: "Decentralized confidential AI inference marketplace on Bittensor Subnet 4. 500+ open-source models running inside Intel TDX & NVIDIA Hopper TEEs — neither the host nor provider can see your prompts.",
    hq: "US",
    tier: "budget",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2026-06-28",
    models: [
      m("NousResearch/Hermes-3-Llama-3.1-70B",           null, null, 128, { promo: true, promoLabel: "Top rated" }),
      m("NousResearch/Meta-Llama-3.1-8B-Instruct",        null, null, 128),
      m("meta-llama/Llama-3.3-70B-Instruct",              null, null, 128),
      m("deepseek-ai/DeepSeek-R1",                        null, null, 128, { promo: true, promoLabel: "Reasoning" }),
      m("Qwen/Qwen2.5-72B-Instruct",                      null, null, 128),
      m("mistralai/Mistral-7B-Instruct-v0.3",             null, null, 32),
    ],
  },

  // ── Sakana AI — Fugu ───────────��──────────────────────────────────────────────
  sakana: {
    id: "sakana",
    name: "Sakana AI (Fugu)",
    website: "https://sakana.ai/fugu/",
    pricingUrl: "https://sakana.ai/fugu/#pricing",
    docsUrl: "https://api.fugu.sakana.ai/docs",
    description: "Multi-agent system delivered as one OpenAI-compatible API. Fugu dynamically orchestrates frontier models for complex coding, reasoning, and agentic tasks. Frontier-level performance without single-vendor dependency.",
    hq: "JP",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2026-06-28",
    models: [
      m("fugu-20260615",       null, null, 128, { promo: true, promoLabel: "Multi-agent", promoLink: "https://sakana.ai/fugu/" }),
      m("fugu-ultra-20260615",  5.00, 30.00, 272, { promo: true, promoLabel: "Max quality" }),
    ],
  },

  // ── Conduit Gateway ──────────────────────────────────────────────────────
  conduit: {
    id: "conduit",
    name: "Conduit",
    website: "https://conduit.ozdoev.net",
    pricingUrl: "https://conduit.ozdoev.net/#pricing",
    docsUrl: "https://conduit.ozdoev.net",
    description: "\"One key, every model\" — flat $20/mo unlimited gateway. OpenAI-compatible endpoint covering GPT-5, Claude, Gemini, Grok, DeepSeek, Llama, and more. Auth via Telegram, no password.",
    hq: "US",
    tier: "gateway",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2026-06-29",
    models: [
      m("gpt-5",            null, null, 128,  { promo: true, promoLabel: "OpenAI" }),
      m("gpt-5-mini",       null, null, 128),
      m("gpt-4o",           null, null, 128),
      m("gpt-4.1",          null, null, 128),
      m("o4",               null, null, 200,  { promo: true, promoLabel: "Reasoning" }),
      m("claude-opus-4-8",  null, null, 200,  { promo: true, promoLabel: "Claude" }),
      m("claude-sonnet-4-6",null, null, 200,  { promo: true, promoLabel: "Popular" }),
      m("claude-haiku-4-5", null, null, 200),
      m("gemini-3-pro",     null, null, 1000, { promo: true, promoLabel: "Gemini" }),
      m("gemini-2.5-pro",   null, null, 1000),
      m("gemini-2.5-flash", null, null, 1000),
      m("grok-4",           null, null, 256,  { promo: true, promoLabel: "xAI" }),
      m("grok-3",           null, null, 131),
      m("grok-3-mini",      null, null, 131),
      m("deepseek-v4-flash",null, null, 1000, { promo: true, promoLabel: "DeepSeek" }),
      m("deepseek-v3.2",    null, null, 1000),
      m("deepseek-r1",      null, null, 1000),
      m("llama-4-maverick", null, null, 1000, { promo: true, promoLabel: "Meta" }),
      m("llama-4-scout",    null, null, 1000),
      m("llama-3.3-70b",    null, null, 128),
      m("qwen3-coder",      null, null, 131),
      m("mistral-large-3",  null, null, 131),
      m("codestral",        null, null, 256),
    ],
  },

  // ── ZenMux Gateway ───────────────────────────────────────────────────────
  zenmux: {
    id: "zenmux",
    name: "ZenMux",
    website: "https://zenmux.ai",
    pricingUrl: "https://zenmux.ai/pricing",
    docsUrl: "https://docs.zenmux.ai",
    description: "Enterprise LLM aggregator with 200+ models, intelligent routing, and AI Model Insurance. OpenAI-, Anthropic-, and Vertex AI-compatible APIs.",
    hq: "US",
    tier: "gateway",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2026-06-29",
    models: [
      // New models (requested additions)
      m("moonshotai/kimi-k2.7-code",      null, null, 131,  { promo: true, promoLabel: "Kimi" }),
      m("qwen/qwen3.7-plus",              null, null, 131),
      m("minimax/minimax-m3",             null, null, 131,  { promo: true, promoLabel: "MiniMax" }),
      m("stepfun/step-3.7-flash",         null, null, 256),
      m("stepfun/step-3.7-flash-free",    null, null, 256,  { promo: true, promoLabel: "Free" }),
      m("inclusionai/ring-2.6-1t",        null, null, 131),
      m("deepseek/deepseek-v4-flash",     null, null, 1000, { promo: true, promoLabel: "DeepSeek" }),
      m("deepseek/deepseek-v4-pro",       null, null, 1000),
      m("inclusionai/ling-2.6-1t",        null, null, 131),
      m("google/gemini-3.1-pro-preview",  null, null, 1000, { promo: true, promoLabel: "Gemini" }),
      m("stepfun/step-3.5-flash",         null, null, 256),
      m("z-ai/glm-4.7-flash-free",        null, null, 128,  { promo: true, promoLabel: "Free" }),
      m("z-ai/glm-4.7",                   null, null, 128),
      m("minimax/minimax-m2.1",           null, null, 131),
      m("z-ai/glm-4.6v-flash-free",       null, null, 128),
      m("z-ai/glm-4.6v-flash",            null, null, 128),
      m("deepseek/deepseek-chat",         null, null, 1000),
      m("deepseek/deepseek-reasoner",     null, null, 1000, { promo: true, promoLabel: "Reasoning" }),
      m("stepfun/step-3",                 null, null, 256),
      // Existing models
      m("anthropic/claude-opus-4-5",     null, null, 200, { promo: true, promoLabel: "Claude",   promoLink: "https://zenmux.ai/models" }),
      m("anthropic/claude-sonnet-4-5",   null, null, 200, { promo: true, promoLabel: "Popular" }),
      m("anthropic/claude-haiku-4-5",    null, null, 200),
      m("openai/gpt-4o",                 null, null, 128, { promo: true, promoLabel: "OpenAI" }),
      m("openai/gpt-4o-mini",            null, null, 128),
      m("openai/o3",                     null, null, 200, { promo: true, promoLabel: "Reasoning" }),
      m("openai/o4-mini",                null, null, 200),
      m("google/gemini-2.5-pro",         null, null, 1000),
      m("google/gemini-2.5-flash",       null, null, 1000),
      m("meta/llama-3.3-70b-instruct",   null, null, 131),
      m("qwen/qwen3-235b-a22b",          null, null, 131),
      m("mistral/mistral-large-latest",  null, null, 128),
    ],
  },

  // ── Z.AI ──────────────────────────────────────────────────────────────────────
  "z-ai": {
    id: "z-ai", name: "Z.AI (Zhipu)",
    website: "https://z.ai", pricingUrl: "https://open.bigmodel.cn/pricing",
    docsUrl: "https://open.bigmodel.cn/dev/api",
    description: "Zhipu AI's global brand. GLM-5.x family with vision, code, and long-context capabilities.",
    hq: "CN", tier: "mid", hasFreeTier: true, liveModels: false, lastUpdated: "2026-06-24",
    models: [
      m("glm-5.2",       null, null, 128, { promo: true, promoLabel: "Newest" }),
      m("glm-5.1",       null, null, 128, { promo: true, promoLabel: "Flagship" }),
      m("glm-z1-flash",  null, null, 64,  { promo: true, promoLabel: "Free" }),
    ],
  },

  // ── Direct-API image / video / specialised providers ──────────────────────

  bfl: {
    id: "bfl", name: "Black Forest Labs (FLUX)",
    website: "https://blackforestlabs.ai", pricingUrl: "https://api.bfl.ai/pricing",
    docsUrl: "https://api.bfl.ai/docs",
    description: "FLUX image-generation models (FLUX.1 Pro, Dev, Schnell). State-of-the-art text-to-image from German AI lab.",
    hq: "DE", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("flux-pro-1.1-ultra", 0.06,  null, null, { promo: true, promoLabel: "Flagship" }),
      m("flux-pro-1.1",       0.04,  null, null),
      m("flux-dev",           0.025, null, null),
      m("flux-schnell",       0.003, null, null, { promo: true, promoLabel: "Cheapest" }),
    ],
  },

  bytedance: {
    id: "bytedance", name: "Bytedance (SeedDream)",
    website: "https://www.volcengine.com", pricingUrl: "https://www.volcengine.com/pricing",
    docsUrl: "https://www.volcengine.com/docs/82379",
    description: "ByteDance Ark platform — SeedDream image generation and Doubao LLM family via Ark API.",
    hq: "CN", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("seeddream-3-t2i", null, null, null, { promo: true, promoLabel: "New" }),
      m("doubao-pro-32k",  null, null, 32),
    ],
  },

  recraft: {
    id: "recraft", name: "Recraft AI",
    website: "https://www.recraft.ai", pricingUrl: "https://www.recraft.ai/pricing",
    docsUrl: "https://www.recraft.ai/docs",
    description: "Recraft V3 — professional-grade vector and raster image generation with brand style control.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("recraftv3",            0.04, null, null, { promo: true, promoLabel: "Flagship" }),
      m("recraft20b",           0.02, null, null),
    ],
  },

  ideogram: {
    id: "ideogram", name: "Ideogram AI",
    website: "https://ideogram.ai", pricingUrl: "https://ideogram.ai/pricing",
    docsUrl: "https://developer.ideogram.ai",
    description: "Ideogram 3.0 — text-rendering image generation with best-in-class typography accuracy.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("V_3",     0.08, null, null, { promo: true, promoLabel: "Flagship" }),
      m("V_2_TURBO", 0.05, null, null, { promo: true, promoLabel: "Fast" }),
    ],
  },

  luma: {
    id: "luma", name: "Luma AI (Photon)",
    website: "https://lumalabs.ai", pricingUrl: "https://lumalabs.ai/api/pricing",
    docsUrl: "https://docs.lumalabs.ai",
    description: "Photon and Dream Machine models for image and video generation from Luma AI.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("photon-1",         0.08,  null, null, { promo: true, promoLabel: "Flagship" }),
      m("photon-flash-1",   0.04,  null, null, { promo: true, promoLabel: "Fast" }),
    ],
  },

  stability: {
    id: "stability", name: "Stability AI",
    website: "https://stability.ai", pricingUrl: "https://platform.stability.ai/pricing",
    docsUrl: "https://platform.stability.ai/docs",
    description: "Stable Diffusion 3.5 and Stable Image Ultra — open-weight and API image generation.",
    hq: "GB", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("stable-image-ultra",  0.14, null, null, { promo: true, promoLabel: "Best value" }),
      m("sd3.5-large",         0.065, null, null),
      m("sd3.5-large-turbo",   0.04,  null, null, { promo: true, promoLabel: "Fast" }),
    ],
  },

  runway: {
    id: "runway", name: "Runway",
    website: "https://runwayml.com", pricingUrl: "https://runwayml.com/pricing",
    docsUrl: "https://docs.runwayml.com",
    description: "Gen-4 video and image generation for creatives — industry-leading video AI.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("gen4_turbo",  null, null, null, { promo: true, promoLabel: "Flagship" }),
      m("gen4_image",  null, null, null),
    ],
  },

  pika: {
    id: "pika", name: "Pika Labs",
    website: "https://pika.art", pricingUrl: "https://pika.art/pricing",
    docsUrl: "https://pika.art/api",
    description: "Pika 2.2 — video generation with lip-sync, scene and object manipulation.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("pika-2.2", null, null, null, { promo: true, promoLabel: "New" }),
      m("pika-2.1", null, null, null),
    ],
  },

  fal: {
    id: "fal", name: "Fal.ai",
    website: "https://fal.ai", pricingUrl: "https://fal.ai/pricing",
    docsUrl: "https://docs.fal.ai",
    description: "Serverless GPU inference for image, video, audio and LLM models. Host for FLUX, AniPortrait, and more.",
    hq: "US", tier: "gateway", hasFreeTier: true, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("fal-ai/flux-pro/v1.1-ultra", 0.06, null, null, { promo: true, promoLabel: "Flagship" }),
      m("fal-ai/flux/dev",            0.025, null, null),
      m("fal-ai/flux/schnell",        0.003, null, null, { promo: true, promoLabel: "Cheapest" }),
    ],
  },

  amazon: {
    id: "amazon", name: "Amazon Nova (Bedrock)",
    website: "https://aws.amazon.com/bedrock", pricingUrl: "https://aws.amazon.com/bedrock/pricing",
    docsUrl: "https://docs.aws.amazon.com/bedrock",
    description: "Amazon Nova Pro, Lite and Micro LLMs on AWS Bedrock — low-latency multimodal models.",
    hq: "US", tier: "frontier", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("amazon.nova-pro-v1:0",   0.8,   3.2,  300, { promo: true, promoLabel: "Flagship" }),
      m("amazon.nova-lite-v1:0",  0.06,  0.24, 300, { promo: true, promoLabel: "Best value" }),
      m("amazon.nova-micro-v1:0", 0.035, 0.14, 128, { promo: true, promoLabel: "Cheapest" }),
    ],
  },

  jempol: {
    id: "jempol", name: "Jempol.in",
    website: "https://jempol.in", pricingUrl: "https://jempol.in/pricing",
    description: "Indonesian AI gateway providing access to multiple frontier models with local pricing.",
    hq: "ID", tier: "gateway", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("gpt-4o",         null, null, 128),
      m("claude-3-5-sonnet", null, null, 200),
    ],
  },

  // ── OpenRouter-routed community / fine-tune providers ─────────────────────

  alfredpros: {
    id: "alfredpros", name: "AlfredPros",
    website: "https://openrouter.ai", pricingUrl: "https://openrouter.ai/models?q=alfredpros",
    description: "Codette-3 coding-focused model via OpenRouter.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("alfredpros/codette-3-7b-instruct", null, null, 32) ],
  },

  allenai: {
    id: "allenai", name: "Allen AI",
    website: "https://allenai.org", pricingUrl: "https://openrouter.ai/models?q=allenai",
    docsUrl: "https://openrouter.ai/docs",
    description: "OLMo open-source LLMs from the Allen Institute for AI, available via OpenRouter.",
    hq: "US", tier: "budget", hasFreeTier: true, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("allenai/olmo-2-0325-32b-instruct", 0.1, 0.1, 4, { promo: true, promoLabel: "Free" }),
    ],
  },

  alpindale: {
    id: "alpindale", name: "Alpindale",
    website: "https://openrouter.ai", pricingUrl: "https://openrouter.ai/models?q=alpindale",
    description: "WizardLM-2 8x22B and Goliath-120B fine-tunes via OpenRouter.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("alpindale/goliath-120b",     null, null, 6),
      m("alpindale/magnum-72b",       null, null, 4),
    ],
  },

  "anthracite-org": {
    id: "anthracite-org", name: "Anthracite",
    website: "https://openrouter.ai", pricingUrl: "https://openrouter.ai/models?q=anthracite-org",
    description: "Magnum creative writing models fine-tuned on curated literary data via OpenRouter.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("anthracite-org/magnum-v4-72b", null, null, 128) ],
  },

  arizeai: {
    id: "arizeai", name: "Arize AI",
    website: "https://arize.com", pricingUrl: "https://openrouter.ai/models?q=arizeai",
    description: "OpenInference and observability-optimised models for ML monitoring via OpenRouter.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("arizeai/openinference-llama-3-70b", null, null, 8) ],
  },

  cognitivecomputations: {
    id: "cognitivecomputations", name: "Cognitive Computations",
    website: "https://huggingface.co/cognitivecomputations", pricingUrl: "https://openrouter.ai/models?q=cognitivecomputations",
    description: "Dolphin uncensored fine-tunes of Llama and Mistral, via OpenRouter.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("cognitivecomputations/dolphin3.0-r1-mistral-24b", null, null, 32),
      m("cognitivecomputations/dolphin-mixtral-8x22b",     null, null, 64),
    ],
  },

  deepcogito: {
    id: "deepcogito", name: "Deep Cogito",
    website: "https://deepcogito.com", pricingUrl: "https://openrouter.ai/models?q=deepcogito",
    description: "Cogito-v1 hybrid-reasoning models on OpenRouter — fast chain-of-thought inference.",
    hq: "US", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("deepcogito/cogito-v1-preview-llama-70b", null, null, 128, { promo: true, promoLabel: "Reasoning" }),
    ],
  },

  eleutherai: {
    id: "eleutherai", name: "EleutherAI",
    website: "https://www.eleuther.ai", pricingUrl: "https://openrouter.ai/models?q=eleutherai",
    description: "Open-source LLMs including Llemma math and GPT-NeoX family via OpenRouter.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("eleutherai/llemma_7b", null, null, 4) ],
  },

  essentialai: {
    id: "essentialai", name: "Essential AI",
    website: "https://essential.ai", pricingUrl: "https://openrouter.ai/models?q=essentialai",
    description: "Mistral-based enterprise fine-tunes optimised for instruction following.",
    hq: "US", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("essentialai/mistral-large-2-moe", null, null, 32) ],
  },

  gryphe: {
    id: "gryphe", name: "Gryphe",
    website: "https://openrouter.ai", pricingUrl: "https://openrouter.ai/models?q=gryphe",
    description: "MythoMax and MythoMist creative roleplay fine-tunes via OpenRouter.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("gryphe/mythomax-l2-13b",  null, null, 4),
      m("gryphe/mythistral-7b",    null, null, 8),
    ],
  },

  hidream: {
    id: "hidream", name: "HiDream",
    website: "https://hidreamai.com", pricingUrl: "https://openrouter.ai/models?q=hidream",
    description: "HiDream-I1 full and fast — 17B parameter text-to-image model from China.",
    hq: "CN", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("hidream-ai/hidream-i1-full",  null, null, null, { promo: true, promoLabel: "New" }),
      m("hidream-ai/hidream-i1-fast",  null, null, null, { promo: true, promoLabel: "Fast" }),
    ],
  },

  // ── InclusionAI (Ant Ling) ───────────────────────────────────────────────────
  inclusionai: {
    id: "inclusionai", name: "InclusionAI",
    website: "https://www.inclusionai.ai", pricingUrl: "https://www.inclusionai.ai",
    docsUrl: "https://api.ant-ling.com",
    description: "Ant Group's open-model research org. Ling and Ring MoE model families, OpenAI-compatible endpoint for the native API.",
    hq: "CN", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-08-15",
    models: [
      m("Ling-2.6-1T",    null, null, 128, { promo: true, promoLabel: "Flagship" }),
      m("Ling-flash-2.0", null, null, 128),
      m("Ling-mini-2.0",  null, null, 128),
      m("Ring-1T",        null, null, 128, { promo: true, promoLabel: "Reasoning" }),
    ],
  },

  kling: {
    id: "kling", name: "Kling AI (Kuaishou)",
    website: "https://klingai.com", pricingUrl: "https://klingai.com/pricing",
    docsUrl: "https://docs.klingai.com",
    description: "Kling 1.6 Pro video and image generation from Kuaishou — top-tier Chinese video AI.",
    hq: "CN", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("kling-v1-6-pro",    null, null, null, { promo: true, promoLabel: "Flagship" }),
      m("kling-v1-6-standard", null, null, null),
    ],
  },

  kwaipilot: {
    id: "kwaipilot", name: "Kwaipilot",
    website: "https://openrouter.ai", pricingUrl: "https://openrouter.ai/models?q=kwaipilot",
    description: "Kwai-produced Kwaipilot coding and instruction models via OpenRouter.",
    hq: "CN", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("kwaipilot/oasis-code-7b-instruct", null, null, 8) ],
  },

  leonardoai: {
    id: "leonardoai", name: "Leonardo.Ai",
    website: "https://leonardo.ai", pricingUrl: "https://leonardo.ai/pricing",
    docsUrl: "https://docs.leonardo.ai",
    description: "Phoenix and Kino-XL image generation models from Leonardo.Ai — built for game assets.",
    hq: "AU", tier: "specialised", hasFreeTier: true, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("phoenix",         null, null, null, { promo: true, promoLabel: "Flagship" }),
      m("kino-xl",         null, null, null),
      m("lightning-xl",    null, null, null, { promo: true, promoLabel: "Fast" }),
    ],
  },

  lykon: {
    id: "lykon", name: "Lykon",
    website: "https://openrouter.ai", pricingUrl: "https://openrouter.ai/models?q=lykon",
    description: "DarkIdol and NeverSleep fine-tunes for creative writing via OpenRouter.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("lykon/darkidol-l2-13b", null, null, 4) ],
  },

  meituan: {
    id: "meituan", name: "Meituan",
    website: "https://www.meituan.com", pricingUrl: "https://openrouter.ai/models?q=meituan",
    description: "Meituan's Codestral-based finance and e-commerce instruction models via OpenRouter.",
    hq: "CN", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("meituan/meituan-llm-7b", null, null, 8) ],
  },

  meta: {
    id: "meta", name: "Meta AI",
    website: "https://ai.meta.com", pricingUrl: "https://openrouter.ai/models?q=meta-llama",
    docsUrl: "https://llama.meta.com",
    description: "Meta Llama 4 Scout, Maverick and Llama 3.x family — leading open-weight models.",
    hq: "US", tier: "frontier", hasFreeTier: true, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("meta-llama/llama-4-maverick",     0.2,   0.6,  1000, { promo: true, promoLabel: "Flagship" }),
      m("meta-llama/llama-4-scout",        0.1,   0.3,  512,  { promo: true, promoLabel: "Fast" }),
      m("meta-llama/llama-3.3-70b-instruct", 0.12, 0.3, 128),
      m("meta-llama/llama-3.1-405b-instruct",0.8,  0.8, 128),
    ],
  },

  microsoft: {
    id: "microsoft", name: "Microsoft Phi",
    website: "https://azure.microsoft.com/en-us/products/phi", pricingUrl: "https://github.com/marketplace/models",
    docsUrl: "https://github.com/marketplace/models",
    description: "Phi-4 family of small language models — efficient, open-weight SLMs from Microsoft.",
    hq: "US", tier: "mid", hasFreeTier: true, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("microsoft/phi-4",              0.07, 0.14, 16, { promo: true, promoLabel: "Flagship" }),
      m("microsoft/phi-4-mini",         0.025, 0.05, 16, { promo: true, promoLabel: "Cheapest" }),
      m("microsoft/phi-3.5-moe-instruct",0.1,  0.1, 128),
    ],
  },

  neversleep: {
    id: "neversleep", name: "NeverSleep",
    website: "https://openrouter.ai", pricingUrl: "https://openrouter.ai/models?q=neversleep",
    description: "Noromaid and Lumi creative fiction fine-tunes via OpenRouter.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("neversleep/llama-3.1-lumimaid-70b", null, null, 128),
      m("neversleep/noromaid-20b",           null, null, 4),
    ],
  },

  opengvlab: {
    id: "opengvlab", name: "OpenGVLab",
    website: "https://github.com/OpenGVLab", pricingUrl: "https://openrouter.ai/models?q=opengvlab",
    description: "InternVL-3 multimodal vision-language models from Shanghai AI Lab via OpenRouter.",
    hq: "CN", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("opengvlab/internvl3-14b",  null, null, 8),
      m("opengvlab/internvl2-40b",  null, null, 8),
    ],
  },

  pearlresearch: {
    id: "pearlresearch", name: "Pearl Research Labs",
    website: "https://openrouter.ai", pricingUrl: "https://openrouter.ai/models?q=pearl",
    description: "Experimental research LLMs from Pearl Research Labs via OpenRouter.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("pearl-research-labs/rodin-l3.3-70b-hanzo", null, null, 128) ],
  },

  pixverse: {
    id: "pixverse", name: "PixVerse",
    website: "https://pixverse.ai", pricingUrl: "https://pixverse.ai/pricing",
    docsUrl: "https://docs.pixverse.ai",
    description: "PixVerse v4 — high-quality video generation from text or image prompts.",
    hq: "CN", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("pixverse-v4", null, null, null, { promo: true, promoLabel: "New" }) ],
  },

  primeintellect: {
    id: "primeintellect", name: "Prime Intellect",
    website: "https://primeintellect.ai", pricingUrl: "https://openrouter.ai/models?q=primeintellect",
    description: "INTELLECT-2 decentralised training model via OpenRouter.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("primeintellect/intellect-2", null, null, 32, { promo: true, promoLabel: "New" }) ],
  },

  raifle: {
    id: "raifle", name: "Raifle",
    website: "https://openrouter.ai", pricingUrl: "https://openrouter.ai/models?q=raifle",
    description: "Sorcererlm roleplay fine-tunes via OpenRouter.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("raifle/sorcererlm-8x22b", null, null, 64) ],
  },

  rekaai: {
    id: "rekaai", name: "Reka AI (via OpenRouter)",
    website: "https://reka.ai", pricingUrl: "https://reka.ai/pricing",
    docsUrl: "https://docs.reka.ai",
    description: "Reka Core and Flash — multimodal models with video, image, and audio understanding.",
    hq: "US", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("reka-core-20240904",  0.1,  0.4,  128, { promo: true, promoLabel: "Flagship" }),
      m("reka-flash-20240226", 0.02, 0.08, 128),
    ],
  },

  rundiffusion: {
    id: "rundiffusion", name: "RunDiffusion",
    website: "https://rundiffusion.com", pricingUrl: "https://openrouter.ai/models?q=rundiffusion",
    description: "RunDiffusion Photo and FX models for photorealistic image generation via OpenRouter.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("rundiffusion/juggernaut-flux-v2", null, null, null) ],
  },

  sao10k: {
    id: "sao10k", name: "Sao10k",
    website: "https://openrouter.ai", pricingUrl: "https://openrouter.ai/models?q=sao10k",
    description: "L3 Euryale and Soliloquy creative writing fine-tunes via OpenRouter.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("sao10k/l3-euryale-70b",   null, null, 128),
      m("sao10k/l3.1-euryale-70b", null, null, 128),
    ],
  },

  stabilityai: {
    id: "stabilityai", name: "Stability AI (StableLM)",
    website: "https://stability.ai", pricingUrl: "https://openrouter.ai/models?q=stabilityai",
    description: "StableLM open-weight language models from Stability AI via OpenRouter.",
    hq: "GB", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("stabilityai/stablelm-2-1_6b", null, null, 4) ],
  },

  thedrummer: {
    id: "thedrummer", name: "The Drummer",
    website: "https://openrouter.ai", pricingUrl: "https://openrouter.ai/models?q=thedrummer",
    description: "Rocinante and UnslopNemo fine-tunes for creative narrative writing via OpenRouter.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("thedrummer/rocinante-12b",   null, null, 32),
      m("thedrummer/unslopnemo-12b",  null, null, 32),
    ],
  },

  tngtech: {
    id: "tngtech", name: "TNG Technology",
    website: "https://www.tngtech.com", pricingUrl: "https://openrouter.ai/models?q=tngtech",
    description: "DeepSeek-R1T experimental distilled reasoning model from TNG Tech via OpenRouter.",
    hq: "DE", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("tngtech/deepseek-r1t-chimera", null, null, 128, { promo: true, promoLabel: "Reasoning" }) ],
  },

  undi95: {
    id: "undi95", name: "Undi95",
    website: "https://openrouter.ai", pricingUrl: "https://openrouter.ai/models?q=undi95",
    description: "Toppy and MXLewd creative roleplay fine-tunes via OpenRouter.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("undi95/toppy-m-7b",    null, null, 4),
      m("undi95/remm-slerp-l2", null, null, 4),
    ],
  },

  vidu: {
    id: "vidu", name: "Vidu AI",
    website: "https://www.vidu.io", pricingUrl: "https://www.vidu.io/pricing",
    docsUrl: "https://docs.vidu.io",
    description: "Vidu Q1 and S2 video generation models — high-fidelity cinematic video from China.",
    hq: "CN", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [
      m("vidu-q1",  null, null, null, { promo: true, promoLabel: "New" }),
      m("vidu-s2",  null, null, null),
    ],
  },

  wanai: {
    id: "wanai", name: "Wan AI",
    website: "https://openrouter.ai", pricingUrl: "https://openrouter.ai/models?q=wan",
    description: "Wan 2.1-I2V video generation model via OpenRouter.",
    hq: "CN", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-30",
    models: [ m("wan-ai/wan2.1-i2v-720p", null, null, null, { promo: true, promoLabel: "New" }) ],
  },

  // ── CEOWeb3 Gateway ──────────────────────────────────────────────────────
  ceoweb3: {
    id: "ceoweb3",
    name: "CEOWeb3",
    website: "https://ceoweb3.dev",
    pricingUrl: "https://dashboard.ceoweb3.dev/models",
    docsUrl: "https://dashboard.ceoweb3.dev",
    description: "Multi-model AI gateway. 29 models — GLM, Kimi, DeepSeek, Gemini, GPT-5 codex, MiniMax, HunyuanHY3 preview, and Muse Spark. Credit-based, OpenAI-compatible API.",
    hq: "ID",
    tier: "gateway",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2026-07-22",
    models: [
      // ── DeepSeek ──────────────────────────────────────────────────────────
      m("deepseek-v3-2-volc",    0.30, 1.20, 128, { promo: true, promoLabel: "Reasoning",   promoLink: "https://dashboard.ceoweb3.dev/models" }),
      m("deepseek-v4-flash",     0.30, 1.20, 128),
      m("deepseek-v4-pro",       0.50, 2.00, 128),
      // ── Google Gemini ──��───────────────────────────────────────────────────
      m("gemini-2.5-flash",      0.50, 2.00, 128),
      m("gemini-2.5-pro",        0.50, 2.00, 128),
      m("gemini-3.0-flash",      0.50, 2.00, 128),
      m("gemini-3.1-flash-lite", 0.50, 2.00, 128),
      m("gemini-3.1-pro",        0.50, 2.00, 128),
      m("gemini-3.5-flash",      0.50, 2.00, 128, { promo: true, promoLabel: "New" }),
      // ── GLM (Zhipu AI) ────────────────────────────────────────────────────
      m("glm-4.7",               0.25, 1.00, 128, { promo: true, promoLabel: "Reasoning" }),
      m("glm-5.0",               0.30, 1.50, 128, { promo: true, promoLabel: "Reasoning" }),
      m("glm-5.0-turbo",         0.15, 0.60, 128, { promo: true, promoLabel: "Cheapest" }),
      m("glm-5.1",               0.30, 1.50, 128),
      m("glm-5.2",               0.30, 1.50, 128),
      m("glm-5v-turbo",          0.20, 0.80, 128, { promo: true, promoLabel: "Vision" }),
      // ── OpenAI GPT ────────────────────────────────────────────────────────
      m("gpt-5.1-codex",         0.50, 2.00, 128, { promo: true, promoLabel: "Coding" }),
      m("gpt-5.1-codex-mini",    0.50, 2.00, 128),
      m("gpt-5.3-codex",         0.50, 2.00, 128),
      m("gpt-5.4",               0.50, 2.00, 128),
      m("gpt-5.5",               0.50, 2.00, 128, { promo: true, promoLabel: "Flagship" }),
      // ── Tencent HY3 ───────────────────────────────────────────────────────
      m("hy3-preview",           0.30, 1.20, 128, { promo: true, promoLabel: "Reasoning" }),
      // ── Kimi (Moonshot) ───────────────────────────────────────────────────
      m("kimi-k2.5",             0.30, 1.20, 128, { promo: true, promoLabel: "Vision" }),
      m("kimi-k2.6",             0.40, 1.50, 128, { promo: true, promoLabel: "Vision" }),
      m("kimi-k2.7",             0.50, 2.00, 128, { promo: true, promoLabel: "Vision" }),
      m("kimi-k3",               0.50, 2.00, 128),
      // ── MiniMax ──────────────────────────────────────────────��────────────
      m("minimax-m2.7",          0.30, 1.20, 128, { promo: true, promoLabel: "Reasoning" }),
      m("minimax-m3",            0.40, 1.60, 128, { promo: true, promoLabel: "Vision" }),
      // ── Muse ──────────────────────────────────────────────────────────────
      m("muse-spark-1.1",        0.50, 2.00, 128),
      // ── Default ───────────────────────────────────────────────────────────
      m("default-model",         0.50, 2.00, 128),
    ],
  },

  // ── Free Token Faucet ─────────────────────────────────────────────────────
  freetoken: {
    id: "freetoken",
    name: "Free Token",
    website: "https://freetokenfaucet.com",
    pricingUrl: "https://freetokenfaucet.com",
    docsUrl: "https://freetokenfaucet.com",
    description: "Free Token Faucet — daily free quota for GPT-5.6, DeepSeek V4 Flash, Mimo, and Qwen models. OpenAI-compatible API.",
    hq: "US",
    tier: "budget",
    hasFreeTier: true,
    liveModels: true,
    lastUpdated: "2026-07-19",
    models: [
      m("gpt-5.6-luna",     null, null, null, { promo: true, promoLabel: "Free · 90% off", promoLink: "https://freetokenfaucet.com" }),
      m("gpt-5.6-terra",    null, null, null, { promo: true, promoLabel: "Free · 90% off", promoLink: "https://freetokenfaucet.com" }),
      m("deepseek-v4-flash",null, null, null, { promo: true, promoLabel: "Free · 2% off",  promoLink: "https://freetokenfaucet.com" }),
      m("mimo-v2.5",        null, null, null, { promo: true, promoLabel: "Free",            promoLink: "https://freetokenfaucet.com" }),
      m("mimo-v2.5-pro",    null, null, null, { promo: true, promoLabel: "Free",            promoLink: "https://freetokenfaucet.com" }),
      m("qwen3.6-flash",    null, null, null, { promo: true, promoLabel: "Free",            promoLink: "https://freetokenfaucet.com" }),
    ],
  },

  // ── Amazon Bedrock ──────────────────────────────────────────────────────────
  bedrock: {
    id: "bedrock",
    name: "Amazon Bedrock",
    website: "https://aws.amazon.com/bedrock",
    pricingUrl: "https://aws.amazon.com/bedrock/pricing/",
    docsUrl: "https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html",
    statusUrl: "https://health.aws.amazon.com/health/status",
    description: "AWS managed model hub. Claude, Nova, Llama, and Mistral behind a single OpenAI-compatible endpoint using Bedrock API keys.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: false,
    lastUpdated: "2026-07-19",
    models: [
      m("anthropic.claude-3-5-sonnet-20241022-v2:0", 3.00, 15.00, 200, { promo: true, promoLabel: "Claude", promoLink: "https://aws.amazon.com/bedrock/pricing/" }),
      m("anthropic.claude-3-5-haiku-20241022-v1:0",  0.80,  4.00, 200),
      m("amazon.nova-pro-v1:0",                       0.80,  3.20, 300, { promo: true, promoLabel: "Amazon Nova", promoLink: "https://aws.amazon.com/bedrock/pricing/" }),
      m("amazon.nova-lite-v1:0",                      0.06,  0.24, 300),
      m("amazon.nova-micro-v1:0",                     0.035, 0.14, 128),
      m("openai.gpt-oss-120b-1:0",                    0.15,  0.60, 131, { promo: true, promoLabel: "OpenAI OSS", promoLink: "https://aws.amazon.com/bedrock/pricing/" }),
      m("openai.gpt-oss-20b-1:0",                     0.07,  0.30, 131),
      m("meta.llama3-1-70b-instruct-v1:0",            0.99,  0.99, 128),
      m("mistral.mistral-large-2407-v1:0",            2.00,  6.00, 128),
    ],
  },

  // ── GitHub Models ────────────────────────────────────────────────────────────
  github: {
    id: "github",
    name: "GitHub Models",
    website: "https://github.com/marketplace/models",
    pricingUrl: "https://docs.github.com/en/github-models/prototyping-with-ai-models#rate-limits",
    docsUrl: "https://docs.github.com/en/github-models",
    description: "Microsoft/GitHub's model playground. Free-tier rate-limited access to GPT, Llama, DeepSeek, Mistral, Phi, and Grok using a GitHub PAT.",
    hq: "US",
    tier: "gateway",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2026-07-19",
    models: [
      m("openai/gpt-4o",                 null, null, 128, { promo: true, promoLabel: "Free tier", promoLink: "https://docs.github.com/en/github-models" }),
      m("openai/gpt-4o-mini",            null, null, 128, { promo: true, promoLabel: "Free tier", promoLink: "https://docs.github.com/en/github-models" }),
      m("meta/Llama-3.3-70B-Instruct",   null, null, 128),
      m("deepseek/DeepSeek-R1",          null, null, 128),
      m("mistral-ai/Mistral-Large-2411", null, null, 128),
      m("microsoft/Phi-4",               null, null,  16),
      m("xai/grok-3",                    null, null, 128),
    ],
  },

  // ── Scaleway (Generative APIs) ──────────────────────────────────────────────
  scaleway: {
    id: "scaleway", name: "Scaleway",
    website: "https://www.scaleway.com/en/generative-apis/", pricingUrl: "https://www.scaleway.com/en/pricing/generative-apis/",
    docsUrl: "https://www.scaleway.com/en/docs/generative-apis/",
    description: "French cloud provider's serverless GenAI endpoint. OpenAI-compatible access to open-weight Llama, Qwen, Mistral, and Gemma models, EU-hosted.",
    hq: "FR", tier: "budget", hasFreeTier: true, liveModels: true, lastUpdated: "2026-08-15",
    models: [
      m("llama-3.3-70b-instruct",         0.90, 0.90, 128, { promo: true, promoLabel: "Popular" }),
      m("llama-3.1-8b-instruct",          0.20, 0.20, 128, { promo: true, promoLabel: "Free tier" }),
      m("qwen2.5-coder-32b-instruct",      0.90, 0.90,  32),
      m("deepseek-r1-distill-llama-70b",   0.90, 0.90, 128),
      m("mistral-nemo-instruct-2407",      0.20, 0.20, 128),
      m("gemma-3-27b-it",                  0.35, 0.35, 128),
      m("pixtral-12b-2409",                0.30, 0.30, 128),
    ],
  },

  // ── Arcee AI (Conductor, native API) ─────────────────────────────────────────
  arceeai: {
    id: "arceeai", name: "Arcee AI (Conductor)",
    website: "https://www.arcee.ai", pricingUrl: "https://www.arcee.ai/pricing",
    docsUrl: "https://docs.arcee.ai",
    description: "Small-language-model lab and router. Conductor auto-routes prompts across its own Virtuoso/Maestro models and third-party frontier models.",
    hq: "US", tier: "mid", hasFreeTier: true, liveModels: false, lastUpdated: "2026-08-15",
    models: [
      m("auto",                    null, null, 128, { promo: true, promoLabel: "Smart routing" }),
      m("auto-tool",                null, null, 128),
      m("auto-reasoning",           null, null, 128),
      m("trinity-large-thinking",   null, null, 128, { promo: true, promoLabel: "Thinking" }),
      m("virtuoso-large",     0.75, 1.20, 128),
      m("coder-large",        0.50, 0.80,  64),
      m("maestro-reasoning",  2.00, 4.00, 128),
      m("spotlight",          0.15, 0.20,  32),
    ],
  },

  // ── Alibaba Cloud (Model Studio) ──────────────────────────────────────────────
  alibabacloud: {
    id: "alibabacloud", name: "Alibaba Cloud",
    website: "https://www.alibabacloud.com/en/product/modelstudio", pricingUrl: "https://www.alibabacloud.com/en/product/modelstudio/pricing",
    docsUrl: "https://www.alibabacloud.com/help/en/model-studio/",
    description: "Alibaba's enterprise AI cloud (Model Studio / DashScope). OpenAI-compatible endpoint for Qwen3 flagship and vision-language models.",
    hq: "CN", tier: "mid", hasFreeTier: true, liveModels: true, lastUpdated: "2026-08-15",
    models: [
      m("qwen3-max",         1.20, 6.00, 256, { promo: true, promoLabel: "Flagship" }),
      m("qwen-max",          1.60, 6.40, 32),
      m("qwen-plus",         0.40, 1.20, 128),
      m("qwen-turbo",        0.05, 0.20, 128, { promo: true, promoLabel: "Free tier" }),
      m("qwen3-coder-plus",  1.00, 5.00, 256),
      m("qwen-vl-max",       1.60, 6.40,  32),
    ],
  },

  // ── Thinking Machines Lab (Tinker) ───────────────────────────────────────────
  thinkingmachines: {
    id: "thinkingmachines", name: "Thinking Machines",
    website: "https://thinkingmachines.ai", pricingUrl: "https://tinker-docs.thinkingmachines.ai/pricing",
    docsUrl: "https://tinker-docs.thinkingmachines.ai",
    description: "Mira Murati's frontier AI lab. Tinker is its low-level fine-tuning and inference API, serving custom-trained model checkpoints via an OpenAI-style endpoint.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-08-15",
    models: [
      m("tinker://meta-llama/Llama-3.1-8B-Instruct", null, null, 128, { promo: true, promoLabel: "Fine-tuned" }),
      m("tinker://Qwen/Qwen3-8B",                     null, null, 128),
    ],
  },

  // ── Blackbox AI ───────────────────────────────────────────────────────────────
  blackboxai: {
    id: "blackboxai", name: "Blackbox AI",
    website: "https://www.blackbox.ai", pricingUrl: "https://www.blackbox.ai/pricing",
    docsUrl: "https://docs.blackbox.ai",
    description: "AI coding assistant platform with a unified API gateway. Routes model IDs across GPT, Claude, DeepSeek, and Gemini behind one key.",
    hq: "US", tier: "gateway", hasFreeTier: true, liveModels: false, lastUpdated: "2026-08-15",
    models: [
      m("blackboxai/openai/gpt-5.1",            null, null, 128, { promo: true, promoLabel: "Free tier" }),
      m("blackboxai/anthropic/claude-opus-4.5", null, null, 200),
      m("blackboxai/deepseek/deepseek-chat",    null, null, 128),
      m("blackboxai/google/gemini-2.5-pro",     null, null, 1000),
    ],
  },

  // ── Public AI ─────────────────────────────────────────────────────────────────
  publicai: {
    id: "publicai", name: "Public AI",
    website: "https://www.publicai.co", pricingUrl: "https://www.publicai.co",
    docsUrl: "https://docs.publicai.co",
    description: "Nonprofit inference utility for public and sovereign open-weight models (e.g. Swiss AI's Apertus), free to use via an OpenAI-compatible API.",
    hq: "CH", tier: "specialised", hasFreeTier: true, liveModels: false, lastUpdated: "2026-08-15",
    models: [
      m("swiss-ai/apertus-70b-instruct",       null, null, 64, { promo: true, promoLabel: "Free" }),
      m("swiss-ai/apertus-v1.5-8b",             null, null, 64, { promo: true, promoLabel: "Free" }),
      m("meta-llama/llama-3.3-70b-instruct",    null, null, 128, { promo: true, promoLabel: "Free" }),
    ],
  },

}

// ── Convenience helpers ────────────────────────────────────────��──────────────

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

/** Format price: "$0.270" or "Free" or "—" */
export function formatPrice(price: number | null): string {
  if (price === null) return "—"
  if (price === 0) return "Free"
  if (price < 0.01) return `$${(price * 1000).toFixed(2)}/B`
  return `$${price.toFixed(price < 1 ? 3 : 2)}`
}

/** Calculate discount percentage from original → promo price (0–100) */
export function calcDiscount(original: number, promo: number): number {
  if (original <= 0) return 0
  return Math.round(((original - promo) / original) * 100)
}

/** All models that have real promo discounts (promoOriginalInputPer1M is set) */
export const DISCOUNTED_MODELS: Array<{ provider: ProviderInfo; model: ModelPricing; discountPct: number }> = (() => {
  const result: Array<{ provider: ProviderInfo; model: ModelPricing; discountPct: number }> = []
  for (const provider of PROVIDER_INFO_LIST) {
    for (const model of provider.models) {
      if (model.promo && !model.deprecated && model.promoOriginalInputPer1M !== undefined && model.inputPer1M !== null) {
        result.push({
          provider,
          model,
          discountPct: calcDiscount(model.promoOriginalInputPer1M, model.inputPer1M),
        })
      }
    }
  }
  return result.sort((a, b) => b.discountPct - a.discountPct)
})()

/** ISO date string of today in YYYY-MM-DD */
export const TODAY_DATE = new Date().toISOString().slice(0, 10)
