"use client"

/**
 * ProviderInfoPanel — fully responsive Info tab.
 *
 * Layout:
 *   - Mobile  (<640px): single column, collapsible cards, horizontal-scroll table
 *   - Tablet  (640–1023px): 2-column card grid in providers view
 *   - Desktop (≥1024px): 3-column card grid + sticky filter sidebar
 *
 * Features:
 *   - Search, tier/region/free-tier filters
 *   - Promo links on featured models
 *   - Docs / Changelog / Status quick links per provider
 *   - Live model count badge (auto-refresh)
 *   - Promos feed view with direct links
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  PROVIDER_INFO_LIST,
  ALL_PROMO_MODELS,
  DISCOUNTED_MODELS,
  TIER_META,
  formatPrice,
  calcDiscount,
  TODAY_DATE,
  type ProviderInfo,
  type ModelPricing,
} from "@/lib/provider-info"

// ── Types ─────────────────────────────────────────────────────────────────────
interface LiveModelData {
  source: "live" | "static"
  models: string[]
  fetchedAt: string
  cached?: boolean
  fallback?: boolean
}
type TierFilter   = "all" | ProviderInfo["tier"]
type RegionFilter = "all" | "US" | "CN" | "EU/KR/IL" | "Other"
type PriceSort    = "none" | "free" | "cheapest" | "expensive"
type PromoView    = "all" | "discounted"

// ── Provider logos (gstatic favicon — 64 px PNG, CORS-safe) ──────────────────
const PROVIDER_DOMAIN_MAP: Record<string, string> = {
  anthropic:"anthropic.com", openai:"openai.com", google:"google.com",
  xai:"x.ai", deepseek:"deepseek.com", meta:"meta.ai",
  qwen:"alibabacloud.com", zhipu:"zhipuai.cn", minimax:"minimax.io",
  moonshot:"moonshot.ai", moonshotai:"moonshot.ai", baidu:"cloud.baidu.com",
  hunyuan:"cloud.tencent.com", stepfun:"stepfun.com", bytedance:"volcengine.com",
  xiaomi:"mi.com", "z-ai":"zhipuai.cn", "nex-agi":"nexagi.com",
  siliconflow:"siliconflow.cn", seed:"seed.sg",
  groq:"groq.com", cerebras:"cerebras.ai", fireworks:"fireworks.ai",
  together:"together.xyz", sambanova:"sambanova.ai", nvidia:"nvidia.com",
  perplexity:"perplexity.ai", cohere:"cohere.com", ai21:"ai21.com",
  replicate:"replicate.com", huggingface:"huggingface.co",
  cloudflare:"cloudflare.com", deepinfra:"deepinfra.com", novita:"novita.ai",
  upstage:"upstage.ai", inception:"inceptionlabs.ai", ibm:"ibm.com",
  anyscale:"anyscale.com", recraft:"recraft.ai", luma:"lumalabs.ai",
  writer:"writer.com", hyperbolic:"hyperbolic.xyz", lepton:"lepton.ai",
  bfl:"blackforestlabs.ai", "black-forest-labs":"blackforestlabs.ai",
  amazon:"aws.amazon.com", "amazon-bedrock":"aws.amazon.com",
  azure:"azure.microsoft.com", "google-ai-studio":"ai.google.dev",
  "google-vertex":"cloud.google.com", openrouter:"openrouter.ai",
  inflection:"inflection.ai", "arcee-ai":"arcee.ai", mancer:"mancer.tech",
  liquid:"liquid.ai", morph:"morphllm.com", poolside:"poolside.ai",
  relace:"relace.ai", venice:"venice.ai", baseten:"baseten.co",
  wandb:"wandb.ai", featherless:"featherless.ai", friendli:"friendli.ai",
  marketku:"router.marketku.id", openmodel:"openmodel.ai",
  nebius:"nebius.com", crusoe:"crusoe.ai", clarifai:"clarifai.com",
  digitalocean:"digitalocean.com", gmicloud:"gmicloud.ai", chutes:"chutes.ai",
  phala:"phala.network", switchpoint:"switchpoint.ai", inceptron:"inceptron.se",
  infermatic:"infermatic.ai", perceptron:"perceptron.ai",
  akashml:"akash.network", "atlas-cloud":"atlascloud.ai", "io-net":"io.net",
  nousresearch:"nousresearch.com", reka:"reka.ai", rekaai:"reka.ai",
  "aion-labs":"aionlabs.net", mistral:"mistral.ai",
  // new providers added to catalog
  ideogram:"ideogram.ai", stability:"stability.ai",
  stabilityai:"stability.ai", runway:"runwayml.com", pika:"pika.art",
  fal:"fal.ai", jempol:"jempol.in", kling:"klingai.com",
  leonardoai:"leonardo.ai", vidu:"vidu.io", pixverse:"pixverse.ai",
  microsoft:"microsoft.com", hidream:"hidreamai.com",
  "anthracite-org":"openrouter.ai", "cognitivecomputations":"openrouter.ai",
  deepcogito:"deepcogito.com", primeintellect:"primeintellect.ai",
  tngtech:"tngtech.com", opengvlab:"openrouter.ai",
  wanai:"openrouter.ai", rundiffusion:"rundiffusion.com",
  bedrock:"aws.amazon.com", github:"github.com",
  scaleway:"scaleway.com", arceeai:"arcee.ai", alibabacloud:"alibabacloud.com",
  thinkingmachines:"thinkingmachines.ai", blackboxai:"blackbox.ai",
  publicai:"publicai.co", inclusionai:"inclusionai.ai",
}

function providerBgColor(name: string): string {
  const palette = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316","#eab308","#22c55e","#14b8a6","#0ea5e9","#3b82f6"]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

function ProviderLogo({ id, name, className = "w-8 h-8" }: { id: string; name: string; className?: string }) {
  const [stage, setStage] = useState<"primary"|"fallback"|"initials">("primary")
  const domain = PROVIDER_DOMAIN_MAP[id]
  const initials = name.replace(/[^A-Za-z0-9]/g, " ").trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()??"").join("") || "?"
  if (!domain || stage === "initials") {
    return (
      <span aria-hidden className={`${className} flex-shrink-0 rounded-lg flex items-center justify-center text-white font-bold leading-none`}
        style={{ background: providerBgColor(name), fontSize: "35%" }}>
        {initials}
      </span>
    )
  }
  const src = stage === "primary"
    ? `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=32`
    : `https://icons.duckduckgo.com/ip3/${domain}.ico`
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden width={32} height={32}
    className={`${className} object-contain rounded-lg flex-shrink-0 overflow-hidden`}
    style={{ maxWidth: "100%", maxHeight: "100%" }}
    onError={() => setStage(s => s === "primary" ? "fallback" : "initials")} />
}

// ── Small icons ───────────────────────────────────────────────────────────────
function Icon({ d, className = "w-3 h-3" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  )
}

function ExternalLinkIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      className={`w-3 h-3 ${spinning ? "animate-spin" : ""}`} aria-hidden>
      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  )
}

// ── HQ flag ───────────────────────────────────────────────────────────────────
function HQFlag({ code }: { code: string }) {
  const flags: Record<string, string> = {
    US: "🇺🇸", CN: "🇨🇳", FR: "🇫🇷", CA: "🇨🇦",
    KR: "🇰🇷", IL: "🇮🇱", ID: "🇮🇩", EU: "🇪🇺",
  }
  return <span className="text-sm" aria-label={code}>{flags[code] ?? code}</span>
}

// ── Promo badge ───────────────────────────────────��───────────────────────────
const PROMO_COLOR: Record<string, string> = {
  "New":           "text-info bg-info/10 border-info/20",
  "Free":          "text-success bg-success/10 border-success/20",
  "Free tier":     "text-success bg-success/10 border-success/20",
  "Flagship":      "text-foreground bg-secondary/10 border-border",
  "Popular":       "text-warning bg-warning/10 border-warning/20",
  "Cheapest":      "text-success bg-success/10 border-success/20",
  "Best value":    "text-success bg-success/10 border-success/20",
  "Best price":    "text-success bg-success/10 border-success/20",
  "Reasoning":     "text-destructive bg-destructive/10 border-destructive/20",
  "Fastest":       "text-warning bg-warning/10 border-warning/20",
  "Ultra-fast":    "text-warning bg-warning/10 border-warning/20",
  "2000+ tok/s":   "text-warning bg-warning/10 border-warning/20",
  "Fast":          "text-warning bg-warning/10 border-warning/20",
  "Web search":    "text-info bg-info/10 border-info/20",
  "Long ctx":      "text-info bg-info/10 border-info/20",
  "256K ctx":      "text-info bg-info/10 border-info/20",
  "MoE flagship":  "text-foreground bg-secondary/10 border-border",
  "Diffusion LLM": "text-foreground bg-secondary/10 border-border",
  "Coding":        "text-info bg-info/10 border-info/20",
}

function PromoBadge({ label, link }: { label?: string; link?: string }) {
  if (!label) return null
  const cls = PROMO_COLOR[label] ?? "text-muted-foreground bg-secondary/60 border-border"
  const badge = (
    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${cls} ${link ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-2.5 h-2.5" aria-hidden>
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
      {label}
      {link && <ExternalLinkIcon className="w-2 h-2 opacity-60" />}
    </span>
  )
  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`${label} — learn more`}>
        {badge}
      </a>
    )
  }
  return badge
}

// ── Quick link ────────────────────────────────────────────────────────────────
function QuickLink({ href, label }: { href?: string; label: string }) {
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors">
      <ExternalLinkIcon />
      {label}
    </a>
  )
}

// ── Model pricing row ─────────────────────────────────────────────────────────
function ModelRow({ model }: { model: ModelPricing }) {
  const shortId = model.id.split("/").pop() ?? model.id
  return (
    <tr className={`border-b border-border/30 last:border-0 transition-colors ${
      model.deprecated ? "opacity-40" : "hover:bg-secondary/20"
    }`}>
      <td className="px-3 py-2 max-w-[180px]">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <code className="text-xs font-mono font-semibold text-foreground truncate max-w-[150px]" title={model.id}>
            {shortId}
          </code>
          {model.deprecated && (
            <span className="text-xs text-muted-foreground flex-shrink-0">deprecated</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <span className={`text-sm font-mono font-semibold ${model.inputPer1M === null ? "text-muted-foreground/70" : "text-foreground"}`}>
          {formatPrice(model.inputPer1M)}
        </span>
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <span className={`text-sm font-mono font-semibold ${model.outputPer1M === null ? "text-muted-foreground/70" : "text-foreground"}`}>
          {formatPrice(model.outputPer1M)}
        </span>
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <span className="text-xs text-muted-foreground font-mono">
          {model.contextK ? `${model.contextK}K` : "—"}
        </span>
      </td>
      <td className="px-3 py-2">
        {model.promo && <PromoBadge label={model.promoLabel} link={model.promoLink} />}
      </td>
    </tr>
  )
}

// ── Live model badge ───────────────────────────────────────────────────────────
function LiveModelBadge({ providerId, apiKey }: { providerId: string; apiKey?: string }) {
  const [data, setData] = useState<LiveModelData | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ provider: providerId })
      if (apiKey) params.set("key", apiKey)
      const res = await fetch(`/api/provider-models?${params}`)
      if (res.ok) setData(await res.json())
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [providerId, apiKey])

  useEffect(() => { refresh() }, [refresh])

  if (!data) return (
    <span className="text-[9px] text-muted-foreground/60 font-mono">{loading ? "loading…" : ""}</span>
  )

  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[10px] font-mono font-semibold ${data.source === "live" ? "text-info" : "text-muted-foreground/70"}`}>
        {data.models.length} models
      </span>
      {data.source === "live" && !data.fallback && (
        <span className="text-[8px] text-info/60 bg-info/8 px-1 rounded">live</span>
      )}
      {data.fallback && (
        <span className="text-[8px] text-warning/60 bg-warning/8 px-1 rounded">static</span>
      )}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); refresh() }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); refresh() } }}
        aria-label="Refresh model count"
        aria-disabled={loading}
        className="text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
      >
        <RefreshIcon spinning={loading} />
      </span>
    </div>
  )
}

// ── Provider card ─────────���───────────────────────────────────────────────────
function ProviderCard({ provider, apiKey, defaultExpanded }: {
  provider: ProviderInfo
  apiKey?: string
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const tierMeta = TIER_META[provider.tier]
  const promoModels = provider.models.filter((m) => m.promo && !m.deprecated)

  return (
    <article className={`rounded-lg border transition-all ${
      expanded
        ? "border-border bg-secondary/10"
        : "border-border/50 bg-transparent hover:border-border hover:bg-secondary/5"
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        {/* Provider logo */}
        <ProviderLogo id={provider.id} name={provider.name} className="w-8 h-8 mt-0.5" />

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-foreground">{provider.name}</span>
            <HQFlag code={provider.hq} />
            <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${tierMeta.className}`}>
              {tierMeta.label}
            </span>
            {provider.hasFreeTier && (
              <span className="text-xs font-semibold text-success bg-success/10 border border-success/20 px-2 py-1 rounded-full">
                Free tier
              </span>
            )}
            {provider.liveModels && (
              <span className="text-xs text-info/70 bg-info/8 border border-info/15 px-2 py-1 rounded-full">
                live
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-2">
            {provider.description}
          </p>
        </div>

        {/* Right: model count */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5 min-w-[100px]">
          {provider.liveModels
            ? <LiveModelBadge providerId={provider.id} apiKey={apiKey} />
            : <span className="text-sm font-semibold text-foreground">{provider.models.length} models</span>
          }
          <span className="text-xs text-muted-foreground font-mono">{provider.lastUpdated}</span>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-border/40 pt-3">

          {/* Quick links — responsive wrap */}
          <div className="flex items-center gap-3 flex-wrap">
            <QuickLink href={provider.website}      label="Website" />
            <QuickLink href={provider.pricingUrl}   label="Pricing" />
            <QuickLink href={provider.docsUrl}      label="Docs" />
            <QuickLink href={provider.changelogUrl} label="Changelog" />
            <QuickLink href={provider.statusUrl}    label="Status" />
            <span className="text-[10px] text-muted-foreground/55 font-mono ml-auto hidden sm:block">
              HQ: {provider.hq}
            </span>
          </div>

          {/* Promo model chips */}
          {promoModels.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold uppercase tracking-wide text-foreground">
                Featured models
              </span>
              <div className="flex flex-wrap gap-2">
                {promoModels.map((pm) => (
                  <div key={pm.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-secondary/40 border border-border/50">
                    <code className="text-xs font-mono font-semibold text-foreground max-w-[160px] truncate" title={pm.id}>
                      {pm.id.split("/").pop() ?? pm.id}
                    </code>
                    <PromoBadge label={pm.promoLabel} link={pm.promoLink} />
                    {pm.inputPer1M !== null && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatPrice(pm.inputPer1M)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model pricing table — horizontal scroll on mobile */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold uppercase tracking-wide text-foreground">
              All models — price per 1M tokens
            </span>
            <div className="rounded-md border border-border/50 overflow-x-auto">
              <table className="w-full text-sm min-w-[440px]">
                <thead>
                  <tr className="bg-secondary/30 border-b border-border/50">
                    <th className="text-left px-3 py-2.5 font-bold text-foreground text-xs uppercase tracking-wider">Model</th>
                    <th className="text-right px-3 py-2.5 font-bold text-foreground text-xs uppercase tracking-wider">In /1M</th>
                    <th className="text-right px-3 py-2.5 font-bold text-foreground text-xs uppercase tracking-wider">Out /1M</th>
                    <th className="text-right px-3 py-2.5 font-bold text-foreground text-xs uppercase tracking-wider">Ctx</th>
                    <th className="px-3 py-2.5 text-xs uppercase tracking-wider text-foreground font-bold">Tag</th>
                  </tr>
                </thead>
                <tbody>
                  {provider.models.map((model) => (
                    <ModelRow key={model.id} model={model} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </article>
  )
}

// ── Region helper ─────────────────────────────────────────────────────────────
function matchRegion(hq: string, filter: RegionFilter): boolean {
  if (filter === "all") return true
  if (filter === "US") return hq === "US"
  if (filter === "CN") return hq === "CN"
  if (filter === "EU/KR/IL") return ["FR", "DE", "KR", "IL"].includes(hq)
  return !["US", "CN", "FR", "DE", "KR", "IL"].includes(hq)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProviderInfoPanel({ apiKey }: { apiKey?: string }) {
  const [search, setSearch]             = useState("")
  const [tierFilter, setTierFilter]     = useState<TierFilter>("all")
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all")
  const [freeOnly, setFreeOnly]         = useState(false)
  const [priceSort, setPriceSort]       = useState<PriceSort>("none")
  const [promoView, setPromoView]       = useState<PromoView>("all")
  const [view, setView]                 = useState<"providers" | "promos">("providers")
  const [expandAll, setExpandAll]       = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<string>("")

  // Daily auto-refresh: track last refresh date in localStorage
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("providerCatalogRefreshedAt") : null
    if (stored !== TODAY_DATE) {
      // New day — trigger a visual refresh indicator and update stored date
      localStorage.setItem("providerCatalogRefreshedAt", TODAY_DATE)
      setLastRefreshed(TODAY_DATE)
    } else {
      setLastRefreshed(stored ?? TODAY_DATE)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let list = PROVIDER_INFO_LIST.filter((p) => {
      if (tierFilter !== "all" && p.tier !== tierFilter) return false
      if (!matchRegion(p.hq, regionFilter)) return false
      if (freeOnly && !p.hasFreeTier) return false
      if (priceSort === "free" && !p.hasFreeTier) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.models.some((m) => m.id.toLowerCase().includes(q))
      )
    })
    // Price sort
    if (priceSort === "cheapest") {
      list = [...list].sort((a, b) => {
        const aMin = Math.min(...a.models.filter(m => m.inputPer1M !== null && !m.deprecated).map(m => m.inputPer1M as number))
        const bMin = Math.min(...b.models.filter(m => m.inputPer1M !== null && !m.deprecated).map(m => m.inputPer1M as number))
        const aVal = isFinite(aMin) ? aMin : Infinity
        const bVal = isFinite(bMin) ? bMin : Infinity
        return aVal - bVal
      })
    } else if (priceSort === "expensive") {
      list = [...list].sort((a, b) => {
        const aMax = Math.max(...a.models.filter(m => m.inputPer1M !== null && !m.deprecated).map(m => m.inputPer1M as number))
        const bMax = Math.max(...b.models.filter(m => m.inputPer1M !== null && !m.deprecated).map(m => m.inputPer1M as number))
        const aVal = isFinite(aMax) ? aMax : -Infinity
        const bVal = isFinite(bMax) ? bMax : -Infinity
        return bVal - aVal
      })
    }
    return list
  }, [search, tierFilter, regionFilter, freeOnly, priceSort])

  const promoCount = ALL_PROMO_MODELS.length
  const freeCount  = PROVIDER_INFO_LIST.filter((p) => p.hasFreeTier).length

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">

      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-3 flex flex-col gap-3">

        {/* Title row + view switcher */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">Provider Catalog</h2>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{PROVIDER_INFO_LIST.length}</span> providers &middot; <span className="font-semibold text-foreground">{freeCount}</span> free tiers &middot; <span className="font-semibold text-foreground">{promoCount}</span> featured models
              </p>
              {lastRefreshed && (
                <span className="text-[9px] text-info/60 bg-info/8 border border-info/15 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-2 h-2" aria-hidden>
                    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                  Updated {lastRefreshed}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 bg-secondary/40 rounded-md p-0.5 border border-border/50 flex-shrink-0">
            {(["providers", "promos"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                  view === v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v === "providers" ? `Providers (${filtered.length})` : `Promos (${promoCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" aria-hidden>
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search providers, models…"
            className="w-full bg-secondary/40 border border-border rounded-md pl-9 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              aria-label="Clear search">
              <Icon d="M18 6L6 18M6 6l12 12" className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter chips — horizontal scroll on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {/* Tier chips */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {(["all", "frontier", "mid", "budget", "gateway", "specialised"] as TierFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all border flex-shrink-0 ${
                  tierFilter === t
                    ? t === "all"
                      ? "bg-foreground text-background border-foreground"
                      : `${TIER_META[t as ProviderInfo["tier"]]?.className ?? ""} border-current`
                    : "text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
                }`}
              >
                {t === "all" ? "All" : TIER_META[t as ProviderInfo["tier"]]?.label ?? t}
              </button>
            ))}
          </div>

          {/* Region */}
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value as RegionFilter)}
            className="flex-shrink-0 bg-secondary/40 border border-border rounded text-[10px] text-muted-foreground px-2 py-0.5 outline-none focus:border-primary/50 transition-all"
          >
            <option value="all">All regions</option>
            <option value="US">US</option>
            <option value="CN">China</option>
            <option value="EU/KR/IL">EU / KR / IL</option>
            <option value="Other">Other</option>
          </select>

          {/* Free-only toggle */}
          <button
            onClick={() => setFreeOnly((v) => !v)}
            className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
              freeOnly
                ? "text-success bg-success/10 border-success/30"
                : "text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
            }`}
          >
            Free only
          </button>

          {/* Expand all — push to end */}
          <button
            onClick={() => setExpandAll((v) => !v)}
            className="ml-auto flex-shrink-0 text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors whitespace-nowrap"
          >
            {expandAll ? "Collapse all" : "Expand all"}
          </button>
        </div>

        {/* Price sort row */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 flex-shrink-0 pr-1">
            Price
          </span>
          {([
            { id: "none",      label: "Default" },
            { id: "free",      label: "Free only" },
            { id: "cheapest",  label: "Cheapest first" },
            { id: "expensive", label: "Most expensive" },
          ] as { id: PriceSort; label: string }[]).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setPriceSort((v) => v === opt.id ? "none" : opt.id)}
              className={`flex-shrink-0 px-2.5 py-0.5 rounded text-[10px] font-medium border transition-all ${
                priceSort === opt.id
                  ? opt.id === "free"
                    ? "text-success bg-success/10 border-success/30"
                    : opt.id === "cheapest"
                    ? "text-success bg-success/10 border-success/30"
                    : opt.id === "expensive"
                    ? "text-destructive bg-destructive/10 border-destructive/30"
                    : "bg-foreground text-background border-foreground"
                  : "text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
              }`}
            >
              {opt.id === "free" && (
                <span className="mr-1">$0</span>
              )}
              {opt.id === "cheapest" && (
                <span className="mr-1">↑</span>
              )}
              {opt.id === "expensive" && (
                <span className="mr-1">↓</span>
              )}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="px-4 py-4">

        {/* ── Promos view ─────────────────────────────────────────── */}
        {view === "promos" && (
          <div className="flex flex-col gap-3">
            {/* Promo sub-filter row */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] text-muted-foreground/70 flex-1 min-w-0">
                Featured, new, or discounted models — updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
              </p>
              <div className="flex items-center gap-1 bg-secondary/30 rounded-md p-0.5 border border-border/40 flex-shrink-0">
                {([
                  { id: "all",        label: `All (${ALL_PROMO_MODELS.length})` },
                  { id: "discounted", label: `Discounts (${DISCOUNTED_MODELS.length})` },
                ] as { id: PromoView; label: string }[]).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setPromoView(opt.id)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                      promoView === opt.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile: stacked cards; Tablet+: 2-col grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(promoView === "discounted" ? DISCOUNTED_MODELS.map(d => ({ provider: d.provider, model: d.model })) : ALL_PROMO_MODELS).map(({ provider, model }) => {
                const hasDiscount = model.promoOriginalInputPer1M !== undefined && model.inputPer1M !== null
                const discountPct = hasDiscount ? calcDiscount(model.promoOriginalInputPer1M!, model.inputPer1M!) : 0
                return (
                  <div key={`${provider.id}:${model.id}`}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                      hasDiscount
                        ? "border-success/20 bg-success/5 hover:bg-success/8"
                        : "border-border/50 bg-secondary/10 hover:bg-secondary/20"
                    }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-foreground">{provider.name}</span>
                        <HQFlag code={provider.hq} />
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${TIER_META[provider.tier].className}`}>
                          {TIER_META[provider.tier].label}
                        </span>
                        {hasDiscount && discountPct > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-success/15 text-success border border-success/25">
                            -{discountPct}%
                          </span>
                        )}
                      </div>
                      <code className="text-[10px] font-mono text-muted-foreground/70 mt-0.5 block truncate" title={model.id}>
                        {model.id.split("/").pop() ?? model.id}
                      </code>
                      <div className="mt-1">
                        <PromoBadge label={model.promoLabel} link={model.promoLink} />
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-0.5 text-right min-w-[90px]">
                      {model.inputPer1M !== null ? (
                        <>
                          {/* Input price row */}
                          <div className="flex items-baseline gap-1.5">
                            {hasDiscount && (
                              <span className="text-[9px] font-mono text-muted-foreground/35 line-through">
                                {formatPrice(model.promoOriginalInputPer1M!)}
                              </span>
                            )}
                            <span className={`text-[11px] font-mono font-semibold ${hasDiscount ? "text-success" : "text-foreground"}`}>
                              {formatPrice(model.inputPer1M)}
                            </span>
                            <span className="text-muted-foreground/60 text-[9px]">in</span>
                          </div>
                          {/* Output price row */}
                          <div className="flex items-baseline gap-1.5">
                            {hasDiscount && (
                              <span className="text-[9px] font-mono text-muted-foreground/35 line-through">
                                {formatPrice(model.promoOriginalOutputPer1M ?? null)}
                              </span>
                            )}
                            <span className={`text-[11px] font-mono ${hasDiscount ? "text-success/80" : "text-foreground"}`}>
                              {formatPrice(model.outputPer1M)}
                            </span>
                            <span className="text-muted-foreground/60 text-[9px]">out</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] font-mono text-success font-semibold">Free</span>
                      )}
                      {model.contextK && (
                        <span className="text-[9px] font-mono text-muted-foreground/60">{model.contextK >= 1000 ? `${model.contextK / 1000}M` : `${model.contextK}K`} ctx</span>
                      )}
                      {model.promoLink && (
                        <a href={model.promoLink} target="_blank" rel="noopener noreferrer"
                          className="text-[9px] text-primary/60 hover:text-primary transition-colors flex items-center gap-0.5 mt-0.5">
                          <ExternalLinkIcon className="w-2 h-2" />
                          Details
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Providers view ───────────────────────────────────────── */}
        {view === "providers" && (
          <>
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-[11px] text-muted-foreground/60">
                No providers match your filters.
              </div>
            ) : (
              /* Mobile: single column; Tablet: 1 col (cards are wide); Desktop: still 1 col but wider layout */
              <div className="flex flex-col gap-2">
                {filtered.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    apiKey={apiKey}
                    defaultExpanded={expandAll}
                  />
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
