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
    description: "Creator of GPT-5.5, o-series reasoning, image gen, and realtime voice models. Leads in multimodal, coding, and long-context tasks.",
    hq: "US",
    tier: "frontier",
    hasFreeTier: false,
    liveModels: true,
    lastUpdated: "2026-06-23",
    models: [
      m("gpt-5.5",            5.00,  30.00, 1000, { promo: true, promoLabel: "Flagship",   promoLink: "https://openai.com/index/gpt-5-5/" }),
      m("gpt-5.4",            2.50,  15.00, 1000, { promo: true, promoLabel: "Balanced",   promoLink: "https://openai.com/index/gpt-5-4/" }),
      m("gpt-5.4-mini",       0.75,   4.50,  400, { promo: true, promoLabel: "Best value", promoLink: "https://openai.com/index/gpt-5-4-mini/", promoOriginalInputPer1M: 2.50, promoOriginalOutputPer1M: 10.00 }),
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

  // ── Google Gemini ───────────────────���─────────────────────────────────────
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

  // ── Groq ─────────────────────────────────────────────────────────────────
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
      // ── Aya multilingual ───────────────────────────────────────────────────
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
      // ── Qwen3.x ────────────────────────────���───────────────────────────────
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
    description: "Tencent's LLM. Hunyuan-Turbo-S free tier; strong for Chinese language, code, and math.",
    hq: "CN",
    tier: "mid",
    hasFreeTier: true,
    liveModels: false,
    lastUpdated: "2026-06-23",
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

  // ── Deep Infra ────────────────────────────────────────────────────────────
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
      // ── DeepSeek ───────────────────────────────────────────────────────────
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
      // ── Llama 3 ────────────────────────────────────────────────────────────
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
    lastUpdated: "2026-06-23",
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

  // ── AkashML ───────────────────────────────────────────────────────────────────
  akashml: {
    id: "akashml", name: "AkashML",
    website: "https://akash.network", pricingUrl: "https://console.akash.network",
    docsUrl: "https://docs.akash.network",
    description: "Decentralised cloud GPU marketplace. Runs open-source models on permissionless compute.",
    hq: "US", tier: "budget", hasFreeTier: true, liveModels: true, lastUpdated: "2026-06-24",
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

  // ── Cerebras ───────────────────────────────────��─────────────────────────────
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
    docsUrl: "https://docs.clarifai.com",
    description: "AI platform for computer vision, NLP, and audio. 80+ hosted models including Llama, GPT, Claude.",
    hq: "US", tier: "gateway", hasFreeTier: true, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("llama-3.3-70b-instruct", null, null, 128, { promo: true, promoLabel: "Free tier" }) ],
  },

  // ── Crusoe ────────────────────────────────────────────────────────────────────
  crusoe: {
    id: "crusoe", name: "Crusoe",
    website: "https://crusoe.ai", pricingUrl: "https://crusoe.ai/cloud/pricing",
    docsUrl: "https://docs.crusoe.ai",
    description: "Carbon-neutral GPU cloud. Runs sustainable AI workloads on stranded energy.",
    hq: "US", tier: "budget", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("llama-3.1-405b-instruct", null, null, 128, { promo: true, promoLabel: "Eco" }) ],
  },

  // ── DeepInfra ─────────────────────────────────────────────────────────────────
  // Already exists

  // ── DigitalOcean ──────────────────────────────────────────────────────────────
  digitalocean: {
    id: "digitalocean", name: "DigitalOcean",
    website: "https://www.digitalocean.com/products/ai-ml", pricingUrl: "https://www.digitalocean.com/pricing/ai-ml",
    docsUrl: "https://docs.digitalocean.com/products/ai-ml",
    description: "Developer cloud with GenAI models on managed GPU droplets. Llama, Mistral, and more.",
    hq: "US", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [
      m("llama3-8b-instruct", null, null, 8),
      m("llama3-70b-instruct", null, null, 8, { promo: true, promoLabel: "Popular" }),
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
    hq: "CN", tier: "mid", hasFreeTier: false, liveModels: true, lastUpdated: "2026-06-24",
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

  // ── Nebius ────────────────────────────────────────────────────────────────────
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
    website: "https://nousresearch.com", pricingUrl: "https://nousresearch.com",
    description: "Open-source AI research lab. Hermes, Capybara fine-tunes for advanced instruction following.",
    hq: "US", tier: "specialised", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [
      m("hermes-3-405b-instruct", null, null, 128, { promo: true, promoLabel: "Hermes" }),
      m("hermes-3-70b-instruct",  null, null, 128),
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
    website: "https://reka.ai", pricingUrl: "https://platform.reka.ai/pricing",
    docsUrl: "https://platform.reka.ai/docs",
    description: "Multimodal frontier models trained from scratch. Reka Core, Flash, Edge for vision + text.",
    hq: "US", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [
      m("reka-core",  null, null, 128, { promo: true, promoLabel: "Multimodal" }),
      m("reka-flash", null, null, 128, { promo: true, promoLabel: "Fast" }),
      m("reka-edge",  null, null, 128),
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

  // ── Switchpoint ───────────────────────────────────────────────────────────────
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

  // ── Xiaomi ────────────────────────────────────────────────────────────────────
  xiaomi: {
    id: "xiaomi", name: "Xiaomi AI",
    website: "https://ai.xiaomi.com", pricingUrl: "https://ai.xiaomi.com/api",
    description: "Xiaomi's AI research arm. MiMo series of reasoning models trained on math and code.",
    hq: "CN", tier: "mid", hasFreeTier: false, liveModels: false, lastUpdated: "2026-06-24",
    models: [ m("mimo-7b", null, null, 128, { promo: true, promoLabel: "Reasoning" }) ],
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
      m("mk/auto",                   null, null, null, { promo: true, promoLabel: "Auto-route", promoLink: "https://router.marketku.id/models" }),
      m("mk/sonnet-4.5-thinking",    null, null, null, { promo: true, promoLabel: "Best coding" }),
      m("mk/sonnet-4.5",             null, null, null, { promo: true, promoLabel: "Claude" }),
      m("mk/deepseek-3.2",           null, null, null, { promo: true, promoLabel: "DeepSeek" }),
      m("mk/deepseek-3.2-thinking",  null, null, null),
      m("mk/glm-5",                  null, null, null, { promo: true, promoLabel: "GLM" }),
      m("mk/minimax-m2.5",           null, null, null, { promo: true, promoLabel: "MiniMax" }),
      m("mk/qwen3-235b-a22b",        null, null, null),
      m("mk/qwen3-coder-plus",       null, null, null, { promo: true, promoLabel: "Coder" }),
      m("mk/qwen3-max",              null, null, null),
      m("mk/qwen3.5-flash",          null, null, null),
      m("mk/qwen-plus",              null, null, null),
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
      m("deepseek-v4-flash",              0.00, 0.00, 1000, { promo: true, promoLabel: "Free now!", promoLink: "https://openmodel.ai" }),
      m("claude-haiku-4-5-20251001",      0.95, 4.75,  200, { promo: true, promoLabel: "Popular" }),
      m("claude-opus-4-6",                4.75,23.75, 1000),
      m("kimi-k2.5",                      0.48, 2.40, null),
      m("gpt-5.3-codex",                  1.23, 9.80, 1000, { promo: true, promoLabel: "GPT-5" }),
      m("glm-4.7",                        0.57, 2.09,  128),
      m("gpt-4o",                         2.50,10.00,  128),
      m("gpt-4o-mini",                    0.15, 0.60,  128),
      m("claude-3-5-sonnet-20241022",     3.00,15.00,  200),
      m("gemini-2.5-flash",               0.30, 2.50, 1000),
    ],
  },

  // ── Z.AI ──────────────────────────────────────────────────────────────────────
  "z-ai": {
    id: "z-ai", name: "Z.AI (Zhipu)",
    website: "https://z.ai", pricingUrl: "https://open.bigmodel.cn/pricing",
    docsUrl: "https://open.bigmodel.cn/dev/api",
    description: "Zhipu AI's global brand. GLM-5.x family with vision, code, and long-context capabilities.",
    hq: "CN", tier: "mid", hasFreeTier: true, liveModels: true, lastUpdated: "2026-06-24",
    models: [
      m("glm-5.2",       null, null, 128, { promo: true, promoLabel: "Newest" }),
      m("glm-5.1",       null, null, 128, { promo: true, promoLabel: "Flagship" }),
      m("glm-z1-flash",  null, null, 64,  { promo: true, promoLabel: "Free" }),
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
