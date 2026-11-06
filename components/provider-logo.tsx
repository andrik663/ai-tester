"use client"

import React, { useState, useEffect } from "react"

// ── Provider website domain map (for high-res favicon fallback) ───────────────
export const PROVIDER_DOMAIN: Record<string, string> = {
  // Frontier
  anthropic:          "anthropic.com",
  openai:             "openai.com",
  google:             "google.com",
  xai:                "x.ai",
  deepseek:           "deepseek.com",
  meta:               "meta.ai",
  // Chinese & Asian providers
  qwen:               "alibabacloud.com",
  alibabacloud:       "alibabacloud.com",
  zhipu:              "zhipuai.cn",
  minimax:            "minimax.io",
  moonshot:           "moonshot.ai",
  moonshotai:         "moonshot.ai",
  baidu:              "cloud.baidu.com",
  yi:                 "01.ai",
  hunyuan:            "cloud.tencent.com",
  stepfun:            "stepfun.com",
  bytedance:          "volcengine.com",
  "bytedance-seed":   "volcengine.com",
  xiaomi:             "mi.com",
  "z-ai":             "zhipuai.cn",
  "nex-agi":          "nexagi.com",
  kwaipilot:          "kwai.com",
  siliconflow:        "siliconflow.cn",
  seed:               "seed.sg",
  inclusionai:        "inclusionai.ai",
  meituan:            "meituan.com",
  // American & global cloud / inference providers
  groq:               "groq.com",
  cerebras:           "cerebras.ai",
  fireworks:          "fireworks.ai",
  together:           "together.ai",
  sambanova:          "sambanova.ai",
  nvidia:             "nvidia.com",
  perplexity:         "perplexity.ai",
  cohere:             "cohere.com",
  ai21:               "ai21.com",
  replicate:          "replicate.com",
  huggingface:        "huggingface.co",
  cloudflare:         "cloudflare.com",
  deepinfra:          "deepinfra.com",
  novita:             "novita.ai",
  upstage:            "upstage.ai",
  inception:          "inceptionlabs.ai",
  ibm:                "ibm.com",
  anyscale:           "anyscale.com",
  recraft:            "recraft.ai",
  luma:               "lumalabs.ai",
  writer:             "writer.com",
  hyperbolic:         "hyperbolic.xyz",
  lepton:             "lepton.ai",
  bfl:                "blackforestlabs.ai",
  "black-forest-labs":"blackforestlabs.ai",
  ideogram:           "ideogram.ai",
  amazon:             "aws.amazon.com",
  "amazon-bedrock":   "aws.amazon.com",
  azure:              "azure.microsoft.com",
  microsoft:          "microsoft.com",
  github:             "github.com",
  "google-ai-studio": "ai.google.dev",
  "google-vertex":    "cloud.google.com",
  openrouter:         "openrouter.ai",
  inflection:         "inflection.ai",
  "arcee-ai":         "arcee.ai",
  arceeai:            "arcee.ai",
  mancer:             "mancer.tech",
  liquid:             "liquid.ai",
  morph:              "morphllm.com",
  poolside:           "poolside.ai",
  relace:             "relace.ai",
  venice:             "venice.ai",
  baseten:            "baseten.co",
  wandb:              "wandb.ai",
  featherless:        "featherless.ai",
  friendli:           "friendli.ai",
  nebius:             "nebius.com",
  crusoe:             "crusoe.ai",
  clarifai:           "clarifai.com",
  digitalocean:       "digitalocean.com",
  scaleway:           "scaleway.com",
  gmicloud:           "gmicloud.ai",
  chutes:             "chutes.ai",
  phala:              "phala.network",
  switchpoint:        "switchpoint.ai",
  inceptron:          "inceptron.se",
  infermatic:         "infermatic.ai",
  perceptron:         "perceptron.ai",
  akashml:            "akash.network",
  "atlas-cloud":      "atlascloud.ai",
  "io-net":           "io.net",
  nousresearch:       "nousresearch.com",
  reka:               "reka.ai",
  rekaai:             "reka.ai",
  "aion-labs":        "aionlabs.net",
  mistral:            "mistral.ai",
  openmodel:          "openmodel.ai",
  avian:              "avian.io",
  parasail:           "parasail.io",
  telnyx:             "telnyx.com",
  targon:             "targon.com",
  sakana:             "sakana.ai",
  conduit:            "conduit.ozdoev.net",
  zenmux:             "zenmux.ai",
  // Indonesian & Specialized Routers
  msaku:              "msaku.id",
  miuclaw:            "msaku.id",
  dahono:             "router.dahono.com",
  marketku:           "router.marketku.id",
  bynara:             "router.bynara.id",
  meongtopup:         "ai.meongtopup.my.id",
  unlirouter:         "unli.meongtopup.my.id",
  jempol:             "jempol.in",
  // Image / Video / Community
  stability:          "stability.ai",
  stabilityai:        "stability.ai",
  runway:             "runwayml.com",
  pika:               "pika.art",
  fal:                "fal.ai",
  kling:              "klingai.com",
  "kling-or":         "klingai.com",
  leonardoai:         "leonardo.ai",
  vidu:               "vidu.com",
  pixverse:           "pixverse.ai",
  hidream:            "hidreamai.com",
  rundiffusion:       "rundiffusion.com",
  allenai:            "allenai.org",
  eleutherai:         "eleuther.ai",
  essentialai:        "essential.ai",
  arizeai:            "arize.com",
  primeintellect:     "primeintellect.ai",
  tngtech:            "tngtech.com",
  deepcogito:         "deepcogito.com",
  thinkingmachines:   "thinkingmachines.ai",
  blackboxai:         "blackbox.ai",
  publicai:           "publicai.co",
  neets:              "neets.ai",
  lamini:             "lamini.ai",
  freetoken:          "freetokenfaucet.com",
  ceoweb3:            "ceoweb3.dev",
  alfredpros:         "openrouter.ai",
  alpindale:          "openrouter.ai",
  "anthracite-org":   "openrouter.ai",
  cognitivecomputations: "openrouter.ai",
  gryphe:             "openrouter.ai",
  lykon:              "openrouter.ai",
  neversleep:         "openrouter.ai",
  opengvlab:          "openrouter.ai",
  pearlresearch:      "openrouter.ai",
  raifle:             "openrouter.ai",
  sao10k:             "openrouter.ai",
  thedrummer:         "openrouter.ai",
  undi95:             "openrouter.ai",
  wanai:              "openrouter.ai",
}

// ── Crisp inline SVG brand marks for top AI providers ─────────────────────────
function BrandSvgMark({ id, className }: { id: string; className: string }) {
  switch (id) {
    case "msaku":
    case "miuclaw":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="Msaku">
          <rect width="28" height="28" rx="6.5" fill="#2962FF" />
          <path
            d="M6.2 20.5V7.8l7.8 7.8 7.8-7.8v12.7"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case "openai":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="OpenAI">
          <rect width="28" height="28" rx="6.5" fill="#10a37f" />
          <g fill="none" stroke="#ffffff" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 6.2c2.1 0 3.9 1.3 4.5 3.3.3-.1.7-.1 1-.1 2.4 0 4.3 1.9 4.3 4.3 0 1.6-.9 3.1-2.3 3.8.1.4.1.7.1 1.1 0 2.4-1.9 4.3-4.3 4.3-1.1 0-2.1-.4-2.9-1.1-.8.7-1.8 1.1-2.9 1.1-2.1 0-3.9-1.3-4.5-3.3-.3.1-.7.1-1 .1-2.4 0-4.3-1.9-4.3-4.3 0-1.6.9-3.1 2.3-3.8-.1-.4-.1-.7-.1-1.1 0-2.4 1.9-4.3 4.3-4.3 1.1 0 2.1.4 2.9 1.1.8-.7 1.8-1.1 2.9-1.1z" />
            <polygon points="14,10.5 17,12.2 17,15.8 14,17.5 11,15.8 11,12.2" />
          </g>
        </svg>
      )
    case "anthropic":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="Anthropic">
          <rect width="28" height="28" rx="6.5" fill="#d97757" />
          <path
            d="M16.4 7.5h2.7L23.5 20.5h-2.8l-.9-2.8h-4.6l-.9 2.8h-2.7L16.4 7.5zm-.6 7.7h3.3l-1.65-5.1-1.65 5.1zM8.8 7.5h2.8l4.4 13h-2.8L10.2 11l-3 9.5H4.5l4.3-13z"
            fill="#ffffff"
          />
        </svg>
      )
    case "google":
    case "google-ai-studio":
    case "google-vertex":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="Google Gemini">
          <defs>
            <linearGradient id="geminiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1d4ed8" />
              <stop offset="50%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          <rect width="28" height="28" rx="6.5" fill="url(#geminiGrad)" />
          <path
            d="M14 4.8C14 10.2 17.8 14 23.2 14 17.8 14 14 17.8 14 23.2 14 17.8 10.2 14 4.8 14 10.2 14 14 10.2 14 4.8Z"
            fill="#ffffff"
          />
        </svg>
      )
    case "deepseek":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="DeepSeek">
          <rect width="28" height="28" rx="6.5" fill="#4d6bfe" />
          <path
            d="M6.5 15.2c0-4.2 3.4-7.4 7.8-7.4 3.3 0 6.1 1.8 7.2 4.6.8-.3 1.8-.9 2.3-1.7.1 2.2-.8 4.1-2.3 5.2-.7 3.1-3.5 5.3-7.2 5.3-4.4 0-7.8-2.6-7.8-6z"
            fill="#ffffff"
          />
          <circle cx="16.2" cy="12.8" r="1.2" fill="#4d6bfe" />
        </svg>
      )
    case "xai":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="xAI Grok">
          <rect width="28" height="28" rx="6.5" fill="#111318" stroke="#3f3f46" strokeWidth="1.5" />
          <path
            d="M7.5 7.5h3.2l3.3 4.8 3.3-4.8h3.2L15.6 14l4.9 6.5h-3.2L14 15.6l-3.3 4.9H7.5L12.4 14 7.5 7.5z"
            fill="#ffffff"
          />
        </svg>
      )
    case "groq":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="Groq">
          <rect width="28" height="28" rx="6.5" fill="#f55036" />
          <path
            d="M14 7.2a6.8 6.8 0 1 0 0 13.6h4.2a2.6 2.6 0 0 0 2.6-2.6V14h-6.8v2.6h4.2v1.6H14a4.2 4.2 0 1 1 0-8.4 4.1 4.1 0 0 1 3 1.3l1.8-1.8A6.7 6.7 0 0 0 14 7.2z"
            fill="#ffffff"
          />
        </svg>
      )
    case "meta":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="Meta AI">
          <rect width="28" height="28" rx="6.5" fill="#0668E1" />
          <path
            d="M6.2 16.5c0-3.2 2-5.7 4.3-5.7 1.5 0 2.7.9 3.8 2.6 1.1-1.7 2.3-2.6 3.8-2.6 2.3 0 4.1 2.5 4.1 5.7 0 2.1-1.1 3.5-2.6 3.5-1.3 0-2.3-.9-3.6-3l-.9-1.5-.9 1.5c-1.3 2.1-2.3 3-3.6 3-1.5 0-2.4-1.4-2.4-3.5zm2.4-.1c0 .9.4 1.4 1 1.4.6 0 1.2-.6 2.1-2.1l.4-.7-.4-.7c-.9-1.4-1.5-2-2.1-2-.6 0-1 .9-1 2.1zm11.2 0c0-1.2-.4-2.1-1-2.1-.6 0-1.2.6-2.1 2l-.4.7.4.7c.9 1.5 1.5 2.1 2.1 2.1.6 0 1-.5 1-1.4z"
            fill="#ffffff"
          />
        </svg>
      )
    case "mistral":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="Mistral AI">
          <rect width="28" height="28" rx="6.5" fill="#ff7000" />
          <path
            d="M6.5 7.5h3.2v3.2h3.1v3.2h2.4v-3.2h3.1V7.5h3.2v13h-3.2v-6.5h-2.3v3.3h-4v-3.3H9.7v6.5H6.5v-13z"
            fill="#ffffff"
          />
        </svg>
      )
    case "openrouter":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="OpenRouter">
          <rect width="28" height="28" rx="6.5" fill="#6366f1" />
          <path
            d="M6.5 14h5l3-4.5h7M18.5 7l3 2.5-3 2.5M11.5 14l3 4.5h7M18.5 16l3 2.5-3 2.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case "cloudflare":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="Cloudflare">
          <rect width="28" height="28" rx="6.5" fill="#f38020" />
          <path
            d="M19.5 17.8H8.8a3.2 3.2 0 0 1-.4-6.3 4.8 4.8 0 0 1 9.2-1.4 3.5 3.5 0 0 1 1.9 6.7z"
            fill="#ffffff"
          />
        </svg>
      )
    case "nvidia":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="NVIDIA">
          <rect width="28" height="28" rx="6.5" fill="#76b900" />
          <path
            d="M7 14c2.4-3.8 6.4-5.5 10.5-4.2 2.4.8 4 2.5 4.5 4.2-1.8 3.2-5.6 5.2-9.5 4.4-2.8-.5-4.5-2.3-5.5-4.4zm4.8 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0z"
            fill="#ffffff"
          />
        </svg>
      )
    case "qwen":
    case "alibabacloud":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="Qwen">
          <rect width="28" height="28" rx="6.5" fill="#615ced" />
          <circle cx="13.5" cy="13.5" r="5.5" fill="none" stroke="#ffffff" strokeWidth="2.5" />
          <path d="M17.2 17.2L21 21" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )
    case "perplexity":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="Perplexity">
          <rect width="28" height="28" rx="6.5" fill="#20808d" />
          <path
            d="M14 6v16M8 9l12 10M20 9L8 19M8 14h12"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )
    case "huggingface":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="HuggingFace">
          <rect width="28" height="28" rx="6.5" fill="#eab308" />
          <circle cx="14" cy="14" r="7.5" fill="#fef08a" />
          <circle cx="11.5" cy="12.5" r="1.2" fill="#1e293b" />
          <circle cx="16.5" cy="12.5" r="1.2" fill="#1e293b" />
          <path d="M10.8 16c1 1.4 2.2 2 3.2 2s2.2-.6 3.2-2" fill="none" stroke="#1e293b" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case "github":
      return (
        <svg viewBox="0 0 28 28" className={`${className} flex-shrink-0 rounded-md`} role="img" aria-label="GitHub">
          <rect width="28" height="28" rx="6.5" fill="#24292f" />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M14 6.2a7.8 7.8 0 0 0-2.5 15.2c.4.1.5-.2.5-.4v-1.4c-2.2.5-2.6-1-2.6-1-.3-.9-.8-1.1-.8-1.1-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.8.8 2.3.6.1-.5.3-.8.5-1-1.7-.2-3.5-.9-3.5-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.5 7.5 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.5 3.9.3.2.5.7.5 1.4v2.1c0 .2.1.5.5.4A7.8 7.8 0 0 0 14 6.2z"
            fill="#ffffff"
          />
        </svg>
      )
    default:
      return null
  }
}

const BUILTIN_SVG_IDS = new Set([
  "msaku",
  "miuclaw",
  "openai",
  "anthropic",
  "google",
  "google-ai-studio",
  "google-vertex",
  "deepseek",
  "xai",
  "groq",
  "meta",
  "mistral",
  "openrouter",
  "cloudflare",
  "nvidia",
  "qwen",
  "alibabacloud",
  "perplexity",
  "huggingface",
  "github",
])

/** Google faviconV2 — returns 64 px PNG, works cross-origin, no auth needed. */
export function getLogoUrl(domain: string): string {
  return `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`
}

/** DuckDuckGo favicon fallback */
export function getDDGLogoUrl(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`
}

/** Deterministic brand color from name — used for initials badge */
export function providerColor(name: string): string {
  const colors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
    "#eab308", "#22c55e", "#14b8a6", "#0ea5e9", "#3b82f6",
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return colors[Math.abs(h) % colors.length]
}

export function ProviderLogo({
  providerId,
  providerName = "",
  className = "w-4 h-4",
}: {
  providerId: string
  providerName?: string
  className?: string
}) {
  const [stage, setStage] = useState<"primary" | "fallback" | "initials">("primary")
  useEffect(() => {
    setStage("primary")
  }, [providerId])

  if (BUILTIN_SVG_IDS.has(providerId)) {
    return <BrandSvgMark id={providerId} className={className} />
  }

  const domain = PROVIDER_DOMAIN[providerId]
  const displayName = providerName || providerId
  const initials =
    displayName
      .replace(/[^A-Za-z0-9]/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  const bg = providerId === "dahono" ? "#8b5cf6" : providerColor(displayName)

  if (!domain || stage === "initials") {
    return (
      <span
        aria-hidden
        className={`${className} flex-shrink-0 rounded-md flex items-center justify-center text-white font-bold leading-none shadow-inner`}
        style={{ background: bg, fontSize: "42%", letterSpacing: "-0.02em" }}
      >
        {initials}
      </span>
    )
  }

  const src = stage === "primary" ? getLogoUrl(domain) : getDDGLogoUrl(domain)

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      className={`${className} object-contain flex-shrink-0 rounded-md bg-slate-900/40`}
      onError={() => setStage((s) => (s === "primary" ? "fallback" : "initials"))}
    />
  )
}

export default ProviderLogo
