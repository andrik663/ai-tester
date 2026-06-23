"use client"

/**
 * ProviderInfoPanel
 *
 * Full-page tab content for the "Info" tab in manual-key-tester.
 * Shows all 40+ providers with:
 *   - Tier badge, HQ flag, free-tier indicator
 *   - Description + pricing URL
 *   - Per-model pricing table (input / output per 1M tokens, context window)
 *   - Promo / new model highlights
 *   - Live model count fetched from /api/provider-models (auto-refresh)
 *   - Global search + filter by tier, region, free tier
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  PROVIDER_INFO_LIST,
  ALL_PROMO_MODELS,
  TIER_META,
  formatPrice,
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

// ── Icons ─────────────────────────────────────────────────────────────────────

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={`w-3 h-3 ${spinning ? "animate-spin" : ""}`} aria-hidden>
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

// ── HQ flag (country code → flag emoji) ──────────────────────────────────────
function HQFlag({ code }: { code: string }) {
  const flags: Record<string, string> = {
    US: "🇺🇸", CN: "🇨🇳", FR: "🇫🇷", CA: "🇨🇦",
    KR: "🇰🇷", IL: "🇮🇱", ID: "🇮🇩", EU: "🇪🇺",
  }
  return <span className="text-[13px]" aria-label={code}>{flags[code] ?? code}</span>
}

// ── Promo badge ───────────────────────────────────────────────────────────────
function PromoBadge({ label }: { label?: string }) {
  if (!label) return null
  const colorMap: Record<string, string> = {
    "New":          "text-sky-400 bg-sky-400/10 border-sky-400/20",
    "Free":         "text-green-400 bg-green-400/10 border-green-400/20",
    "Free tier":    "text-green-400 bg-green-400/10 border-green-400/20",
    "Flagship":     "text-violet-400 bg-violet-400/10 border-violet-400/20",
    "Popular":      "text-amber-400 bg-amber-400/10 border-amber-400/20",
    "Cheapest":     "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    "Best value":   "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    "Best price":   "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    "Reasoning":    "text-rose-400 bg-rose-400/10 border-rose-400/20",
    "Fastest":      "text-orange-400 bg-orange-400/10 border-orange-400/20",
    "Ultra-fast":   "text-orange-400 bg-orange-400/10 border-orange-400/20",
    "Web search":   "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
    "Long ctx":     "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
    "256K ctx":     "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
    "MoE flagship": "text-violet-400 bg-violet-400/10 border-violet-400/20",
    "Diffusion LLM":"text-pink-400 bg-pink-400/10 border-pink-400/20",
    "NVIDIA":       "text-green-400 bg-green-400/10 border-green-400/20",
    "Fast":         "text-orange-400 bg-orange-400/10 border-orange-400/20",
  }
  const cls = colorMap[label] ?? "text-muted-foreground bg-secondary/60 border-border"
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${cls}`}>
      <TagIcon />
      {label}
    </span>
  )
}

// ── Model pricing row ─────────────────────────────────────────────────────────
function ModelRow({ model, isLive }: { model: ModelPricing; isLive?: boolean }) {
  const shortId = model.id.split("/").pop() ?? model.id
  return (
    <tr className={`border-b border-border/30 last:border-0 transition-colors ${model.deprecated ? "opacity-40" : "hover:bg-secondary/20"}`}>
      <td className="px-3 py-1.5 max-w-[200px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <code className="text-[10px] font-mono text-foreground/80 truncate">{shortId}</code>
          {isLive && <span className="text-[8px] text-sky-400/60 flex-shrink-0">live</span>}
          {model.deprecated && <span className="text-[8px] text-muted-foreground/50 flex-shrink-0">deprecated</span>}
        </div>
      </td>
      <td className="px-3 py-1.5 text-right">
        <span className={`text-[11px] font-mono ${model.inputPer1M === null ? "text-muted-foreground/40" : "text-foreground"}`}>
          {formatPrice(model.inputPer1M)}
        </span>
      </td>
      <td className="px-3 py-1.5 text-right">
        <span className={`text-[11px] font-mono ${model.outputPer1M === null ? "text-muted-foreground/40" : "text-foreground"}`}>
          {formatPrice(model.outputPer1M)}
        </span>
      </td>
      <td className="px-3 py-1.5 text-right">
        <span className="text-[10px] text-muted-foreground/60 font-mono">
          {model.contextK ? `${model.contextK}K` : "—"}
        </span>
      </td>
      <td className="px-3 py-1.5">
        {model.promo && <PromoBadge label={model.promoLabel} />}
      </td>
    </tr>
  )
}

// ── Live model count badge ─────────────────────────────────────────────────────
function LiveModelBadge({
  providerId,
  apiKey,
}: {
  providerId: string
  apiKey?: string
}) {
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
    <span className="text-[9px] text-muted-foreground/40 font-mono">
      {loading ? "loading…" : ""}
    </span>
  )

  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[10px] font-mono font-semibold ${data.source === "live" ? "text-sky-400" : "text-muted-foreground/50"}`}>
        {data.models.length} models
      </span>
      {data.source === "live" && !data.fallback && (
        <span className="text-[8px] text-sky-400/60 bg-sky-400/8 px-1 rounded">live</span>
      )}
      {data.fallback && (
        <span className="text-[8px] text-yellow-400/60 bg-yellow-400/8 px-1 rounded">static</span>
      )}
      <button onClick={refresh} disabled={loading} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors" aria-label="Refresh model count">
        <RefreshIcon spinning={loading} />
      </button>
    </div>
  )
}

// ── Provider card ─────────────────────────────────────────────────────────────
function ProviderCard({
  provider,
  apiKey,
  defaultExpanded,
}: {
  provider: ProviderInfo
  apiKey?: string
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const tierMeta = TIER_META[provider.tier]
  const promoModels = provider.models.filter((m) => m.promo && !m.deprecated)

  return (
    <div className={`rounded-lg border transition-all ${expanded ? "border-border bg-secondary/10" : "border-border/50 bg-transparent hover:border-border hover:bg-secondary/5"}`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        {/* Chevron */}
        <span className="flex-shrink-0 mt-0.5 text-muted-foreground/50">
          {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </span>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{provider.name}</span>
            <HQFlag code={provider.hq} />
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${tierMeta.className}`}>
              {tierMeta.label}
            </span>
            {provider.hasFreeTier && (
              <span className="text-[9px] font-semibold text-green-400 bg-green-400/10 border border-green-400/20 px-1.5 py-0.5 rounded-full">
                Free tier
              </span>
            )}
            {provider.liveModels && (
              <span className="text-[9px] text-sky-400/70 bg-sky-400/8 border border-sky-400/15 px-1.5 py-0.5 rounded-full">
                live models
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
            {provider.description}
          </p>
        </div>

        {/* Right: model count + pricing link */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          {provider.liveModels ? (
            <LiveModelBadge providerId={provider.id} apiKey={apiKey} />
          ) : (
            <span className="text-[10px] font-mono text-muted-foreground/50">
              {provider.models.length} models
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/40 font-mono">
            {provider.lastUpdated}
          </span>
        </div>
      </button>

      {/* Expanded: links + promo highlights + full model table */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-border/40 pt-3">

          {/* Quick links */}
          <div className="flex items-center gap-3 flex-wrap">
            <a href={provider.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors">
              <ExternalLinkIcon /> Website
            </a>
            <a href={provider.pricingUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors">
              <ExternalLinkIcon /> Pricing
            </a>
            <span className="text-[10px] text-muted-foreground/40 font-mono ml-auto">
              HQ: {provider.hq}
            </span>
          </div>

          {/* Promo highlights strip */}
          {promoModels.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Featured models
              </span>
              <div className="flex flex-wrap gap-2">
                {promoModels.map((pm) => (
                  <div key={pm.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/40 border border-border/50">
                    <code className="text-[10px] font-mono text-foreground/80 max-w-[160px] truncate">
                      {pm.id.split("/").pop() ?? pm.id}
                    </code>
                    <PromoBadge label={pm.promoLabel} />
                    {pm.inputPer1M !== null && (
                      <span className="text-[9px] font-mono text-muted-foreground/60">
                        {formatPrice(pm.inputPer1M)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model pricing table */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              All models — price per 1M tokens
            </span>
            <div className="rounded-md border border-border/50 overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-secondary/30 border-b border-border/50">
                    <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground/70 text-[10px] uppercase tracking-wide">Model</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground/70 text-[10px] uppercase tracking-wide">Input</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground/70 text-[10px] uppercase tracking-wide">Output</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground/70 text-[10px] uppercase tracking-wide">Context</th>
                    <th className="px-3 py-1.5"></th>
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
    </div>
  )
}

// ── Filter bar types ──────────────────────────────────────────────────────────
type TierFilter = "all" | ProviderInfo["tier"]
type RegionFilter = "all" | "US" | "CN" | "EU/KR/IL" | "Other"

function matchRegion(hq: string, filter: RegionFilter): boolean {
  if (filter === "all") return true
  if (filter === "US") return hq === "US"
  if (filter === "CN") return hq === "CN"
  if (filter === "EU/KR/IL") return ["FR", "DE", "KR", "IL", "ID"].includes(hq)
  return !["US", "CN", "FR", "DE", "KR", "IL", "ID"].includes(hq)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProviderInfoPanel({ apiKey }: { apiKey?: string }) {
  const [search, setSearch]           = useState("")
  const [tierFilter, setTierFilter]   = useState<TierFilter>("all")
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all")
  const [freeOnly, setFreeOnly]       = useState(false)
  const [view, setView]               = useState<"providers" | "promos">("providers")
  const [expandAll, setExpandAll]     = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return PROVIDER_INFO_LIST.filter((p) => {
      if (tierFilter !== "all" && p.tier !== tierFilter) return false
      if (!matchRegion(p.hq, regionFilter)) return false
      if (freeOnly && !p.hasFreeTier) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.models.some((m) => m.id.toLowerCase().includes(q))
      )
    })
  }, [search, tierFilter, regionFilter, freeOnly])

  const promoCount = ALL_PROMO_MODELS.length
  const freeCount  = PROVIDER_INFO_LIST.filter((p) => p.hasFreeTier).length

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-3 flex flex-col gap-3">

        {/* Title + view switcher */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Provider Catalog</h2>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {PROVIDER_INFO_LIST.length} providers · {freeCount} with free tier · {promoCount} featured models
            </p>
          </div>
          <div className="flex items-center gap-1 bg-secondary/40 rounded-md p-0.5 border border-border/50">
            {(["providers", "promos"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v === "providers" ? `Providers (${filtered.length})` : `Promos (${promoCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" aria-hidden>
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search providers, models, descriptions…"
            className="w-full bg-secondary/40 border border-border rounded-md pl-8 pr-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors" aria-label="Clear search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tier filter */}
          <div className="flex items-center gap-1">
            {(["all", "frontier", "mid", "budget", "gateway", "specialised"] as TierFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all border ${
                  tierFilter === t
                    ? t === "all" ? "bg-foreground text-background border-foreground" : `${TIER_META[t as ProviderInfo["tier"]]?.className ?? ""} border-current`
                    : "text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
                }`}
              >
                {t === "all" ? "All tiers" : TIER_META[t as ProviderInfo["tier"]]?.label ?? t}
              </button>
            ))}
          </div>

          {/* Region filter */}
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value as RegionFilter)}
            className="bg-secondary/40 border border-border rounded text-[10px] text-muted-foreground px-2 py-0.5 outline-none focus:border-primary/50 transition-all"
          >
            <option value="all">All regions</option>
            <option value="US">US</option>
            <option value="CN">China</option>
            <option value="EU/KR/IL">EU / KR / IL</option>
          </select>

          {/* Free-tier toggle */}
          <button
            onClick={() => setFreeOnly((v) => !v)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
              freeOnly ? "text-green-400 bg-green-400/10 border-green-400/30" : "text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
            }`}
          >
            Free only
          </button>

          {/* Expand all */}
          <button
            onClick={() => setExpandAll((v) => !v)}
            className="ml-auto text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            {expandAll ? "Collapse all" : "Expand all"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 flex flex-col gap-2">

        {view === "promos" ? (
          /* Promo feed */
          <div className="flex flex-col gap-3">
            <p className="text-[10px] text-muted-foreground/50">
              Featured, new, or discounted models across all providers — updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            </p>
            {ALL_PROMO_MODELS.map(({ provider, model }) => (
              <div key={`${provider.id}:${model.id}`} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border/50 bg-secondary/10 hover:bg-secondary/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-foreground">{provider.name}</span>
                    <HQFlag code={provider.hq} />
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${TIER_META[provider.tier].className}`}>
                      {TIER_META[provider.tier].label}
                    </span>
                    <PromoBadge label={model.promoLabel} />
                  </div>
                  <code className="text-[10px] font-mono text-muted-foreground/70 mt-0.5 block truncate">
                    {model.id.split("/").pop() ?? model.id}
                  </code>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                  {model.inputPer1M !== null ? (
                    <>
                      <span className="text-[11px] font-mono text-foreground">
                        {formatPrice(model.inputPer1M)} <span className="text-muted-foreground/50 text-[9px]">in</span>
                      </span>
                      <span className="text-[11px] font-mono text-foreground">
                        {formatPrice(model.outputPer1M)} <span className="text-muted-foreground/50 text-[9px]">out</span>
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] font-mono text-green-400">Free / N/A</span>
                  )}
                  {model.contextK && (
                    <span className="text-[9px] font-mono text-muted-foreground/40">{model.contextK}K ctx</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Provider list */
          <>
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-[11px] text-muted-foreground/40">
                No providers match your filters.
              </div>
            ) : (
              filtered.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  apiKey={apiKey}
                  defaultExpanded={expandAll}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
