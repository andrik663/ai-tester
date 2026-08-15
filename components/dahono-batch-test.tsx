"use client"

import { useState, useCallback } from "react"
import type { DahnoBatchTestResponse, BatchModelResult } from "@/app/api/dahono-batch-test/route"
import { copyToClipboard } from "@/lib/clipboard"

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4 2.5l9 5.5-9 5.5V2.5z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

// ── Tier badge ────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  free:     "text-success  bg-success/10  border-success/25",
  starter:  "text-sky-400    bg-sky-400/10    border-sky-400/25",
  pro:      "text-violet-400 bg-violet-400/10 border-violet-400/25",
  business: "text-amber-400  bg-amber-400/10  border-amber-400/25",
}

function TierBadge({ tier }: { tier: string }) {
  const cls = TIER_COLORS[tier] ?? "text-muted-foreground bg-secondary border-border"
  return (
    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>
      {tier}
    </span>
  )
}

// ── Result row ────────────────────────────────────────────────────────────────

function ResultRow({ r }: { r: BatchModelResult }) {
  const [expanded, setExpanded] = useState(false)
  const [copiedReply, setCopiedReply] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState(false)

  function copyReply() {
    if (!r.reply) return
    copyToClipboard(r.reply).then(() => {
      setCopiedReply(true)
      setTimeout(() => setCopiedReply(false), 1400)
    }).catch(() => {})
  }

  function copyCurl(e: React.MouseEvent) {
    e.stopPropagation()
    copyToClipboard(r.curlFull).then(() => {
      setCopiedCurl(true)
      setTimeout(() => setCopiedCurl(false), 1400)
    }).catch(() => {})
  }

  return (
    <div className={`border-b border-border last:border-0 ${r.ok ? "" : "bg-destructive/10"}`}>
      {/* Main row — click to expand */}
      <div
        className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-secondary/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
      >
        {/* Status icon */}
        <span className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full border mt-0.5 ${
          r.ok
            ? "text-success border-success/30 bg-success/10"
            : "text-destructive border-destructive/30 bg-destructive/10"
        }`}>
          {r.ok ? <CheckIcon /> : <XIcon />}
        </span>

        {/* Model ID — full name, wraps if needed */}
        <span className="text-[11px] font-mono text-foreground flex-1 min-w-0 break-all leading-snug">
          {r.modelId}
        </span>

        {/* Right-side stats — stacked to avoid squishing model name */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-1">
          <div className="flex items-center gap-1.5">
            <TierBadge tier={r.tier} />
            <span className={`text-[10px] font-mono ${r.ok ? "text-success" : "text-destructive"}`}>
              {r.status > 0 ? r.status : "ERR"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground">{r.latencyMs}ms</span>
            {r.tokenUsage?.total !== undefined && (
              <span className="text-[10px] font-mono text-muted-foreground/60">{r.tokenUsage.total}tok</span>
            )}
          </div>
        </div>
      </div>

      {/* Expandable detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 flex flex-col gap-2 border-t border-border/50 bg-secondary/20">
          {/* cURL block */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-semibold">cURL</span>
              <button
                onClick={copyCurl}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                <CopyIcon />
                {copiedCurl ? "Copied!" : "Copy cURL"}
              </button>
            </div>
            <pre className="text-[9px] font-mono text-muted-foreground bg-background rounded px-2.5 py-2 border border-border overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              {r.curlFull}
            </pre>
          </div>

          {/* Reply */}
          {r.ok && r.reply && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-semibold">Reply</span>
              <div className="flex items-start gap-2">
                <p className="text-[11px] text-foreground bg-secondary/50 rounded-md px-2.5 py-2 leading-relaxed flex-1">
                  {r.reply}
                </p>
                <button
                  onClick={copyReply}
                  className="flex-shrink-0 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors mt-0.5"
                  title="Copy reply"
                >
                  {copiedReply ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {!r.ok && r.errorMsg && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-semibold">Error</span>
              <p className="text-[10px] font-mono text-destructive bg-destructive/5 rounded px-2.5 py-2 border border-destructive/15 break-all">
                {r.errorMsg}
              </p>
            </div>
          )}

          {/* Token usage */}
          {r.tokenUsage && (r.tokenUsage.prompt !== undefined || r.tokenUsage.completion !== undefined) && (
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">Tokens</span>
              {r.tokenUsage.prompt !== undefined && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  in: <span className="text-foreground">{r.tokenUsage.prompt}</span>
                </span>
              )}
              {r.tokenUsage.completion !== undefined && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  out: <span className="text-foreground">{r.tokenUsage.completion}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Skeleton placeholder rows shown while running ─────────────────────────────

function SkeletonRow({ i }: { i: number }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-0 animate-pulse"
      style={{ animationDelay: `${i * 60}ms` }}
    >
      <span className="w-5 h-5 rounded-full bg-secondary flex-shrink-0" />
      <span className="h-2.5 rounded bg-secondary flex-1" style={{ maxWidth: `${55 + (i % 4) * 10}%` }} />
      <span className="h-4 rounded bg-secondary w-12 flex-shrink-0" />
      <span className="h-2.5 rounded bg-secondary w-10 flex-shrink-0 hidden sm:block" />
    </div>
  )
}

// ── Filter tabs ───��───────────────────────────────────────────────────────────

type Filter = "all" | "ok" | "fail"

function FilterTab({
  label,
  count,
  active,
  onClick,
  color,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md border transition-colors ${
        active
          ? color ?? "text-foreground border-border bg-secondary"
          : "text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground"
      }`}
    >
      {label}
      <span className={`font-mono ${active ? "" : "text-muted-foreground/60"}`}>{count}</span>
    </button>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Props {
  apiKey: string
}

export default function DahonoBatchTest({ apiKey }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DahnoBatchTestResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [skeletonCount, setSkeletonCount] = useState(0)

  const runBatch = useCallback(async () => {
    if (!apiKey.trim() || loading) return

    setLoading(true)
    setError(null)
    setData(null)
    setSkeletonCount(0)

    // First, quickly fetch model count to show correct skeletons
    try {
      const modRes = await fetch("/api/dahono-models", {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      })
      const modData = await modRes.json()
      setSkeletonCount(modData?.models?.length ?? 12)
    } catch { setSkeletonCount(12) }

    try {
      const res = await fetch("/api/dahono-batch-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setData(json as DahnoBatchTestResponse)
      setFilter("all")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
      setSkeletonCount(0)
    }
  }, [apiKey, loading])

  const filtered = data?.results.filter((r) => {
    if (filter === "ok")   return r.ok
    if (filter === "fail") return !r.ok
    return true
  }) ?? []

  const passCount = data?.passed ?? 0
  const failCount = data?.failed ?? 0

  const canRun = apiKey.trim().length >= 8

  return (
    <div className="flex flex-col gap-2">
      {/* Run button */}
      <button
        onClick={runBatch}
        disabled={!canRun || loading}
        className={`flex items-center justify-center gap-2 w-full rounded-md px-3 py-2 text-[11px] font-semibold transition-all border ${
          canRun && !loading
            ? "bg-amber-400/10 text-amber-400 border-amber-400/30 hover:bg-amber-400/20 hover:border-amber-400/50"
            : "bg-secondary text-muted-foreground border-border cursor-not-allowed opacity-50"
        }`}
      >
        {loading ? (
          <>
            <SpinnerIcon />
            Testing all models...
          </>
        ) : (
          <>
            <PlayIcon />
            Run All Models
          </>
        )}
      </button>

      {!canRun && !loading && (
        <p className="text-[9px] text-muted-foreground/50 text-center">
          Enter a Dahono API key above to run
        </p>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
          <p className="text-[10px] font-mono text-destructive">{error}</p>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && skeletonCount > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/40 border-b border-border">
            <span className="text-[10px] text-muted-foreground">
              Sending &quot;halo&quot; to {skeletonCount} models...
            </span>
            <SpinnerIcon />
          </div>
          {Array.from({ length: Math.min(skeletonCount, 20) }).map((_, i) => (
            <SkeletonRow key={i} i={i} />
          ))}
          {skeletonCount > 20 && (
            <p className="px-3 py-2 text-[9px] text-muted-foreground/50 text-center">
              +{skeletonCount - 20} more…
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="flex flex-col gap-2">
          {/* Summary bar */}
          <div className="rounded-md border border-border bg-card px-3 py-2 flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-semibold text-foreground">
              {data.total} models tested
            </span>
            <span className="text-[11px] text-success font-mono">
              {passCount} passed
            </span>
            <span className="text-[11px] text-destructive font-mono">
              {failCount} failed
            </span>
            <span className="text-[10px] text-muted-foreground font-mono ml-auto">
              {(data.durationMs / 1000).toFixed(1)}s total
            </span>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1">
            <FilterTab
              label="All"
              count={data.total}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            <FilterTab
              label="Passed"
              count={passCount}
              active={filter === "ok"}
              onClick={() => setFilter("ok")}
              color="text-success border-success/30 bg-success/10"
            />
            <FilterTab
              label="Failed"
              count={failCount}
              active={filter === "fail"}
              onClick={() => setFilter("fail")}
              color="text-destructive border-destructive/30 bg-destructive/10"
            />
          </div>

          {/* Result list */}
          <div className="rounded-md border border-border overflow-hidden max-h-[420px] overflow-y-auto">
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/40 border-b border-border sticky top-0">
              <span className="w-5 flex-shrink-0" />
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 flex-1">Model</span>
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 flex-shrink-0 text-right">Tier / HTTP / ms</span>
            </div>

            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                No {filter === "ok" ? "passing" : "failing"} models.
              </p>
            ) : (
              filtered.map((r) => <ResultRow key={r.modelId} r={r} />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
