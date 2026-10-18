"use client"

import { useState, useCallback } from "react"
import type { BatchModelResult, BatchTestResponse } from "@/app/api/batch-test/route"
import { PROVIDER_CONFIGS } from "@/app/api/batch-test/route"
import { PROVIDERS_WITH_LIVE_MODELS } from "@/lib/providers"
import { appendWorkingResults } from "@/lib/working-keys-store"
import { copyToClipboard } from "@/lib/clipboard"

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden
      className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Result row ────────────────────────────────────────────────────────────────

function ResultRow({ r }: { r: BatchModelResult }) {
  const [expanded, setExpanded] = useState(false)
  const [copiedCurl, setCopiedCurl]   = useState(false)
  const [copiedReply, setCopiedReply] = useState(false)

  function copyCurl(e: React.MouseEvent) {
    e.stopPropagation()
    copyToClipboard(r.curlFull).then(() => {
      setCopiedCurl(true)
      setTimeout(() => setCopiedCurl(false), 1400)
    }).catch(() => {})
  }

  function copyReply(e: React.MouseEvent) {
    e.stopPropagation()
    if (!r.reply) return
    copyToClipboard(r.reply).then(() => {
      setCopiedReply(true)
      setTimeout(() => setCopiedReply(false), 1400)
    }).catch(() => {})
  }

  return (
    <div className={`border-b border-border last:border-0 ${r.ok ? "" : "bg-destructive/10"}`}>
      {/* ── Main row ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-secondary/40 transition-colors select-none"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
      >
        {/* Status circle */}
        <span
          className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full border mt-0.5 ${
            r.ok
              ? "text-success border-success/30 bg-success/10"
              : "text-destructive  border-destructive/30  bg-destructive/10"
          }`}
        >
          {r.ok ? <CheckIcon /> : <XIcon />}
        </span>

        {/* Model name — full, wraps on mobile */}
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-[11px] font-mono text-foreground break-all leading-snug">
            {r.modelId}
          </span>
          {/* cURL always visible — single line preview */}
          <span className="text-[9px] font-mono text-muted-foreground/70 truncate leading-tight">
            {r.curlFull.split("\n")[0]}
          </span>
        </div>

        {/* Right stats */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-1">
          <span className={`text-[10px] font-mono font-semibold ${r.ok ? "text-success" : "text-destructive"}`}>
            {r.status > 0 ? r.status : "ERR"}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">{r.latencyMs}ms</span>
          {r.tokenUsage?.total !== undefined && (
            <span className="text-[9px] font-mono text-muted-foreground/70">{r.tokenUsage.total}tok</span>
          )}
        </div>

        {/* Expand chevron */}
        <span className="flex-shrink-0 text-muted-foreground/60 mt-0.5">
          <ChevronIcon open={expanded} />
        </span>
      </div>

      {/* ── Expanded detail ───────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 flex flex-col gap-2.5 border-t border-border/50 bg-secondary/10">

          {/* cURL block — always shown, full command */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
                cURL
              </span>
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
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
                  Reply
                </span>
                <button
                  onClick={copyReply}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <CopyIcon />
                  {copiedReply ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-[11px] text-foreground bg-secondary/50 rounded-md px-2.5 py-2 leading-relaxed">
                {r.reply}
              </p>
            </div>
          )}

          {/* Error detail */}
          {!r.ok && r.errorMsg && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
                Error
              </span>
              <p className="text-[10px] font-mono text-destructive bg-destructive/5 rounded px-2.5 py-2 border border-destructive/15 break-all">
                {r.errorMsg}
              </p>
            </div>
          )}

          {/* Token usage */}
          {r.tokenUsage && (r.tokenUsage.prompt !== undefined || r.tokenUsage.completion !== undefined) && (
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-muted-foreground/70 uppercase tracking-widest">Tokens</span>
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

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ i }: { i: number }) {
  return (
    <div
      className="flex items-start gap-2 px-3 py-2.5 border-b border-border last:border-0 animate-pulse"
      style={{ animationDelay: `${i * 50}ms` }}
    >
      <span className="w-5 h-5 rounded-full bg-secondary flex-shrink-0 mt-0.5" />
      <div className="flex flex-col gap-1 flex-1">
        <span className="h-2.5 rounded bg-secondary" style={{ width: `${50 + (i % 5) * 9}%` }} />
        <span className="h-2 rounded bg-secondary/60 w-3/4" />
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="h-2.5 w-8 rounded bg-secondary" />
        <span className="h-2 w-10 rounded bg-secondary/60" />
      </div>
      <span className="w-3 h-3 rounded bg-secondary/50 flex-shrink-0 mt-1" />
    </div>
  )
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

type Filter = "all" | "ok" | "fail"

function FilterTab({
  label, count, active, onClick, color,
}: {
  label: string; count: number; active: boolean; onClick: () => void; color?: string
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  providerId: string
  apiKey: string
  providerName?: string
  /** Called after passing results are saved — parent can refresh its Working Keys panel */
  onSaved?: (savedCount: number) => void
}

// Providers that fetch live model list from the gateway (Dahono, OpenAI, Groq, etc.)
// Imported directly from lib/providers.ts — single source of truth.
const DYNAMIC_PROVIDERS = PROVIDERS_WITH_LIVE_MODELS
// Providers that truly cannot be batch-tested (no standard chat endpoint or
// require interactive OAuth / variable env-based URLs):
//   - "custom"  : user-defined endpoint, no static model list
//   - "azure"   : endpoint URL varies per user ({{AZURE_RESOURCE_NAME}})
// All other providers — including image/video ones — are allowed through so the
// "Run All" button is always visible. The batch-test API will surface its own
// error for providers with non-chat endpoints instead of silently hiding the button.
const UNSUPPORTED_PROVIDERS = new Set([
  "custom",
  "azure",
])

// ── Main component ────────────────────────────────────────────────────────────

export default function ProviderBatchTest({ providerId, apiKey, providerName, onSaved }: Props) {
  const [loading, setLoading]           = useState(false)
  const [data, setData]                 = useState<BatchTestResponse | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [filter, setFilter]             = useState<Filter>("all")
  const [skeletonCount, setSkeletonCount] = useState(0)
  const [savedCount, setSavedCount]     = useState<number | null>(null)

  const canRun = apiKey.trim().length >= 4 && !UNSUPPORTED_PROVIDERS.has(providerId)

  // How many models will be tested (used for skeleton count)
  const estimatedCount =
    DYNAMIC_PROVIDERS.has(providerId)
      ? 0 // unknown until live fetch
      : PROVIDER_CONFIGS[providerId]?.models.length ?? 0

  const runBatch = useCallback(async () => {
    if (!canRun || loading) return

    setLoading(true)
    setError(null)
    setData(null)
    setFilter("all")
    setSavedCount(null)

    // For providers with live model lists, quickly fetch model count for skeleton display
    let skelCount = estimatedCount
    if (DYNAMIC_PROVIDERS.has(providerId)) {
      try {
        const r = await fetch("/api/fetch-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: providerId, apiKey: apiKey.trim() }),
        })
        const d = await r.json()
        skelCount = d?.total ?? d?.models?.length ?? 14
      } catch { skelCount = 14 }
    }
    setSkeletonCount(skelCount || 8)

    try {
      const res = await fetch("/api/batch-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, apiKey: apiKey.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      const batchResult = json as BatchTestResponse
      setData(batchResult)

      // Auto-save all passing results to Working Keys store
      const passing = batchResult.results.filter((r) => r.ok)
      if (passing.length > 0) {
        appendWorkingResults(
          providerId,
          providerName ?? providerId,
          apiKey.trim(),
          passing.map((r) => ({
            modelId: r.modelId,
            latencyMs: r.latencyMs,
            tokenUsage: r.tokenUsage,
          })),
        )
        setSavedCount(passing.length)
        onSaved?.(passing.length)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
      setSkeletonCount(0)
    }
  }, [providerId, apiKey, providerName, loading, canRun, estimatedCount, onSaved])

  const filtered = data?.results.filter((r) => {
    if (filter === "ok")   return r.ok
    if (filter === "fail") return !r.ok
    return true
  }) ?? []

  // Don't render anything for unsupported providers
  if (UNSUPPORTED_PROVIDERS.has(providerId)) return null

  return (
    <div className="flex flex-col gap-2">
      {/* Run button */}
      <button
        onClick={runBatch}
        disabled={!canRun || loading}
        className={`flex items-center justify-center gap-2 w-full rounded-md px-3 py-2 text-[11px] font-semibold transition-all border ${
          canRun && !loading
            ? "bg-primary text-primary-foreground border-primary hover:bg-primary-hover hover:border-primary-hover"
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
        <p className="text-xs text-muted-foreground/70 text-center">
          Enter an API key above to run batch test
        </p>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
          <p className="text-[10px] font-mono text-destructive">{error}</p>
        </div>
      )}

      {/* Skeleton loading state */}
      {loading && skeletonCount > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/40 border-b border-border">
            <span className="text-[10px] text-muted-foreground">
              Sending &quot;halo&quot; to {skeletonCount} models...
            </span>
            <SpinnerIcon />
          </div>
          {Array.from({ length: Math.min(skeletonCount, 24) }).map((_, i) => (
            <SkeletonRow key={i} i={i} />
          ))}
          {skeletonCount > 24 && (
            <p className="px-3 py-2 text-[9px] text-muted-foreground/70 text-center">
              +{skeletonCount - 24} more...
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="flex flex-col gap-2">
          {/* Saved banner */}
          {savedCount !== null && savedCount > 0 && (
            <div className="rounded-md border border-success/25 bg-success/8 px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-[10px] text-success">
                <span className="font-semibold">{savedCount} working model{savedCount > 1 ? "s" : ""}</span> saved to Working Keys tab
              </span>
              <button
                onClick={() => setSavedCount(null)}
                className="text-[9px] text-success/60 hover:text-success transition-colors"
              >
                dismiss
              </button>
            </div>
          )}

          {/* Summary bar */}
          <div className="rounded-md border border-border bg-card px-3 py-2 flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-semibold text-foreground">
              {data.total} models
            </span>
            {(data as BatchTestResponse & { modelSource?: string }).modelSource === "live" && (
              <span
                title="Model list was fetched live from the provider API"
                className="text-[8px] px-1.5 py-0.5 rounded bg-info/10 text-info border border-info/20 font-bold"
              >
                live
              </span>
            )}
            <span className="text-[11px] text-success font-mono font-semibold">
              {data.passed} passed
            </span>
            <span className="text-[11px] text-destructive font-mono font-semibold">
              {data.failed} failed
            </span>
            <span className="text-[10px] text-muted-foreground font-mono ml-auto">
              {(data.durationMs / 1000).toFixed(1)}s
            </span>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1">
            <FilterTab
              label="All"   count={data.total}   active={filter === "all"}  onClick={() => setFilter("all")}
            />
            <FilterTab
              label="OK"    count={data.passed}  active={filter === "ok"}   onClick={() => setFilter("ok")}
              color="text-success border-success/30 bg-success/10"
            />
            <FilterTab
              label="Fail"  count={data.failed}  active={filter === "fail"} onClick={() => setFilter("fail")}
              color="text-destructive border-destructive/30 bg-destructive/10"
            />
          </div>

          {/* Result list */}
          <div className="rounded-md border border-border overflow-hidden max-h-[480px] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/40 border-b border-border sticky top-0 z-10">
              <span className="w-5 flex-shrink-0" />
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 flex-1">
                Model / cURL preview
              </span>
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 flex-shrink-0">
                HTTP / ms
              </span>
              <span className="w-3 flex-shrink-0" />
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
