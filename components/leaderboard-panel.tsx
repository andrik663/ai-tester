"use client"

import React, { useState, useCallback } from "react"
import useSWR from "swr"

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeaderboardMeta {
  leaderboard: string
  source_url: string
  fetched_at: string
  last_updated: string
  model_count: number
}

interface LeaderboardModel {
  rank: number
  model: string
  vendor: string
  license: string
  score: number
  ci: number
  votes: number
}

interface LeaderboardResponse {
  meta: LeaderboardMeta
  models: LeaderboardModel[]
}

interface LeaderboardsResponse {
  date: string
  fetched_at: string
  leaderboards: Record<string, { model_count: number }>
  errors: string[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = "https://api.wulong.dev/arena-ai-leaderboards/v1"

const CATEGORY_LABELS: Record<string, string> = {
  text:           "Text",
  vision:         "Vision",
  code:           "Code",
  search:         "Search",
  agent:          "Agent",
  document:       "Document",
  "text-to-image":  "Text→Image",
  "image-edit":     "Image Edit",
  "text-to-video":  "Text→Video",
  "image-to-video": "Image→Video",
  "video-edit":     "Video Edit",
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  text: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5"><path d="M2 4h12M2 8h8M2 12h10" strokeLinecap="round"/></svg>
  ),
  vision: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5"><circle cx="8" cy="8" r="2.5"/><path d="M1.5 8C3 4.5 5.3 3 8 3s5 1.5 6.5 5c-1.5 3.5-3.8 5-6.5 5s-5-1.5-6.5-5z" strokeLinecap="round"/></svg>
  ),
  code: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5"><path d="M5 5L2 8l3 3M11 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  search: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5"><circle cx="6.5" cy="6.5" r="4"/><path d="M14 14l-3.5-3.5" strokeLinecap="round"/></svg>
  ),
  agent: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5"><rect x="3" y="5" width="10" height="8" rx="1.5"/><path d="M5.5 5V3.5a2.5 2.5 0 0 1 5 0V5" strokeLinecap="round"/><circle cx="6" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="9" r="1" fill="currentColor" stroke="none"/></svg>
  ),
  document: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5"><path d="M4 2h6l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" strokeLinecap="round"/><path d="M9 2v4h4" strokeLinecap="round"/><path d="M5 9h6M5 12h4" strokeLinecap="round"/></svg>
  ),
  "text-to-image": (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5"><rect x="2" y="4" width="12" height="9" rx="1.2"/><circle cx="5.5" cy="7.5" r="1"/><path d="M2 11.5l3-3 2.5 2.5 2-2 4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  "image-edit": (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5"><path d="M2 13.5L9.5 6l3 3L5 14.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9.5 6l1.5-1.5a1.5 1.5 0 0 1 2.12 2.12L11.5 8.5" strokeLinecap="round"/><path d="M2 13.5h2.5" strokeLinecap="round"/></svg>
  ),
  "text-to-video": (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5"><rect x="2" y="4" width="10" height="9" rx="1"/><path d="M12 7l3-2v6l-3-2V7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  "image-to-video": (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5"><rect x="2" y="4" width="10" height="9" rx="1"/><path d="M12 7l3-2v6l-3-2V7z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="5" cy="7.5" r="1" fill="currentColor" stroke="none"/></svg>
  ),
  "video-edit": (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5"><rect x="2" y="5" width="8" height="7" rx="1"/><path d="M10 8l3-2v5l-3-2V8z"/><path d="M4 3l2-1 2 1" strokeLinecap="round"/></svg>
  ),
}

// Vendor → accent color mapping
const VENDOR_COLOR: Record<string, string> = {
  Anthropic: "text-[oklch(0.78_0.13_20)]",
  OpenAI:    "text-[oklch(0.80_0.10_175)]",
  Google:    "text-[oklch(0.78_0.16_250)]",
  Meta:      "text-[oklch(0.72_0.14_265)]",
  Mistral:   "text-[oklch(0.82_0.14_60)]",
  DeepSeek:  "text-[oklch(0.76_0.14_235)]",
  xAI:       "text-[oklch(0.85_0.02_0)]",
  Qwen:      "text-[oklch(0.78_0.16_30)]",
  Microsoft: "text-[oklch(0.76_0.14_252)]",
}

function vendorColor(vendor: string) {
  return VENDOR_COLOR[vendor] ?? "text-muted-foreground"
}

// Medal for rank 1-3
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-[13px] leading-none" title="1st">🥇</span>
  if (rank === 2) return <span className="text-[13px] leading-none" title="2nd">🥈</span>
  if (rank === 3) return <span className="text-[13px] leading-none" title="3rd">🥉</span>
  return (
    <span className="w-5 text-center text-[11px] font-mono text-muted-foreground tabular-nums">
      {rank}
    </span>
  )
}

// Score bar — visual relative to max score in set
function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? Math.max(4, (score / maxScore) * 100) : 4
  return (
    <div className="w-full h-1 rounded-full bg-secondary/60 overflow-hidden">
      <div
        className="h-full rounded-full bg-primary/70 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// Compact vote display
function fmtVotes(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`
  return String(v)
}

// SWR fetcher
const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
})

// ── Main Component ────────────────────────────────────────────────────────────

export default function LeaderboardPanel() {
  const [activeCategory, setActiveCategory] = useState("text")
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch available categories
  const { data: categoriesData } = useSWR<LeaderboardsResponse>(
    `${API_BASE}/leaderboards`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 * 10 }
  )

  // Fetch leaderboard data for active category
  const { data, error, isLoading } = useSWR<LeaderboardResponse>(
    `${API_BASE}/leaderboard?name=${activeCategory}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 * 5 }
  )

  const categories = categoriesData
    ? Object.keys(categoriesData.leaderboards)
    : ["text", "vision", "code", "search", "agent", "document",
       "text-to-image", "image-edit", "text-to-video", "image-to-video", "video-edit"]

  const filtered = data?.models.filter(m =>
    !searchQuery ||
    m.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.vendor.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? []

  const maxScore = data?.models[0]?.score ?? 1

  const handleCategoryChange = useCallback((cat: string) => {
    setActiveCategory(cat)
    setSearchQuery("")
  }, [])

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-sidebar/40 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {/* Trophy icon */}
          <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 text-[oklch(0.82_0.14_60)] flex-shrink-0" aria-hidden>
            <path d="M4 3h12v6a6 6 0 0 1-12 0V3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M4 6H2a2 2 0 0 0 2 4M16 6h2a2 2 0 0 1-2 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M10 15v3M7 18h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <div>
            <span className="text-[12px] font-semibold text-foreground">Arena AI Leaderboard</span>
            {data?.meta.last_updated && (
              <span className="ml-2 text-[10px] text-muted-foreground/60">
                Updated {data.meta.last_updated}
              </span>
            )}
          </div>
        </div>

        {/* Source link */}
        <a
          href={data?.meta.source_url ?? "https://arena.ai/leaderboard"}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors flex-shrink-0"
        >
          arena.ai
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden><path d="M1.5 6.5L6.5 1.5M6.5 1.5H3M6.5 1.5V5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </a>
      </div>

      {/* ── Category tabs ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-0.5 px-3 h-9 border-b border-border bg-sidebar/20 overflow-x-auto scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`inline-flex items-center gap-1.5 px-2.5 h-6 rounded text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              activeCategory === cat
                ? "bg-secondary text-foreground shadow-[inset_0_-2px_0_oklch(0.93_0_0)]"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <span className={activeCategory === cat ? "text-foreground/70" : "text-muted-foreground/60"}>
              {CATEGORY_ICONS[cat]}
            </span>
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-border/60 bg-sidebar/10">
        <div className="relative">
          <svg
            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none"
            aria-hidden
          >
            <circle cx="6.5" cy="6.5" r="4"/><path d="M14 14l-3.5-3.5" strokeLinecap="round"/>
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Search ${CATEGORY_LABELS[activeCategory] ?? activeCategory} models…`}
            className="w-full pl-8 pr-3 py-1.5 rounded border border-border bg-background text-foreground text-[11px] focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              aria-label="Clear search"
            >
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><path d="M2 2l8 8M10 2L2 10" strokeLinecap="round"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center h-40 gap-2">
            <svg className="w-4 h-4 animate-spin text-muted-foreground/60" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <span className="text-[11px] text-muted-foreground/60">Loading leaderboard…</span>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-6">
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 text-destructive/70" aria-hidden>
              <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M10 6v5M10 13.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <p className="text-[11px] text-muted-foreground/70">Failed to load leaderboard data.</p>
            <p className="text-[10px] text-muted-foreground/60">Check your network connection and try again.</p>
          </div>
        )}

        {/* Empty search state */}
        {!isLoading && !error && data && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-1.5">
            <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5 text-muted-foreground/55" aria-hidden>
              <circle cx="6.5" cy="6.5" r="4"/><path d="M14 14l-3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <p className="text-[11px] text-muted-foreground/70">No models match &ldquo;{searchQuery}&rdquo;</p>
          </div>
        )}

        {/* Table */}
        {!isLoading && !error && filtered.length > 0 && (
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-10 bg-sidebar/90 backdrop-blur-sm">
              <tr className="border-b border-border/60">
                <th className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground/60 w-10">#</th>
                <th className="text-left px-2 py-2 text-[10px] font-medium text-muted-foreground/60">Model</th>
                <th className="text-left px-2 py-2 text-[10px] font-medium text-muted-foreground/60 hidden sm:table-cell w-24">Vendor</th>
                <th className="text-right px-2 py-2 text-[10px] font-medium text-muted-foreground/60 w-20">Score</th>
                <th className="text-right px-2 py-2 text-[10px] font-medium text-muted-foreground/60 hidden md:table-cell w-16">±CI</th>
                <th className="text-right px-4 py-2 text-[10px] font-medium text-muted-foreground/60 hidden md:table-cell w-20">Votes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((model, idx) => (
                <tr
                  key={model.model}
                  className={`border-b border-border/30 transition-colors hover:bg-secondary/20 ${
                    idx === 0 ? "bg-[oklch(0.82_0.14_60_/_0.04)]" : ""
                  }`}
                >
                  {/* Rank */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center w-5">
                      <RankBadge rank={model.rank} />
                    </div>
                  </td>

                  {/* Model name + score bar */}
                  <td className="px-2 py-2.5">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-mono font-medium text-foreground/90 truncate max-w-[180px] sm:max-w-[240px] md:max-w-none">
                        {model.model}
                      </span>
                      <ScoreBar score={model.score} maxScore={maxScore} />
                    </div>
                  </td>

                  {/* Vendor */}
                  <td className="px-2 py-2.5 hidden sm:table-cell">
                    <span className={`font-medium ${vendorColor(model.vendor)}`}>
                      {model.vendor}
                    </span>
                  </td>

                  {/* Score */}
                  <td className="px-2 py-2.5 text-right">
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {model.score.toLocaleString()}
                    </span>
                  </td>

                  {/* CI */}
                  <td className="px-2 py-2.5 text-right hidden md:table-cell">
                    <span className="text-muted-foreground/60 font-mono tabular-nums">
                      ±{model.ci}
                    </span>
                  </td>

                  {/* Votes */}
                  <td className="px-4 py-2.5 text-right hidden md:table-cell">
                    <span className="text-muted-foreground/70 font-mono tabular-nums">
                      {fmtVotes(model.votes)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Footer — model count + data source note */}
        {!isLoading && !error && data && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground/60">
              {filtered.length} of {data.meta.model_count} models
            </span>
            <a
              href="https://api.wulong.dev/arena-ai-leaderboards/v1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-muted-foreground/55 hover:text-muted-foreground/60 transition-colors"
            >
              Data via wulong.dev archive API
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
