"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { loadWorkingKeys } from "@/lib/working-keys-store"
import {
  loadScreenerResults,
  saveScreenerResults,
  inferCapabilities,
  nextRefreshIso,
  getDueForRefresh,
  clearScreenerResults,
  type ScreenerModelResult,
  type CapabilityTag,
} from "@/lib/model-screener"

// ── Constants ─────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 h
const COUNTDOWN_TICK_MS   = 1_000                 // 1 s UI update

// ── Capability pill meta ──────────────────────────────────────────────────────

const CAP_META: Record<CapabilityTag, { label: string; color: string }> = {
  coding:   { label: "Coding",   color: "text-violet-400 bg-violet-400/10 border-violet-400/25" },
  text:     { label: "Text",     color: "text-sky-400 bg-sky-400/10 border-sky-400/25" },
  image:    { label: "Image",    color: "text-amber-400 bg-amber-400/10 border-amber-400/25" },
  video:    { label: "Video",    color: "text-rose-400 bg-rose-400/10 border-rose-400/25" },
  flagship: { label: "Flagship", color: "text-primary bg-primary/10 border-primary/25" },
}

const ALL_CAPS: CapabilityTag[] = ["flagship", "coding", "text", "image", "video"]

// ── Small icon components ─────────────────────────────────────────────────────

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 16 16" fill="none"
      aria-hidden
      className={spinning ? "animate-spin" : ""}
    >
      <path d="M13.5 8A5.5 5.5 0 112.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2.5 2v3.5H6"                 stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 11.5h2M12.5 11.5h1.5M11.5 9v2M11.5 12.5v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••"
  return key.slice(0, 6) + "••••••" + key.slice(-4)
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now"
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

// ── Single model row ──────────────────────────────────────────────────────────

function ModelRow({ result, probing }: { result: ScreenerModelResult; probing: boolean }) {
  const capMeta = result.tags.map((t) => CAP_META[t]).filter(Boolean)

  return (
    <div className={`border-b border-border last:border-0 px-3 py-2.5 flex items-start gap-2.5 transition-colors ${
      probing ? "opacity-60 animate-pulse" : "hover:bg-secondary/20"
    }`}>
      {/* Status dot */}
      <span className={`flex-shrink-0 mt-1.5 w-2 h-2 rounded-full ${
        probing ? "bg-yellow-400/60 animate-pulse" : result.isOn ? "bg-green-400" : "bg-red-400"
      }`} />

      <div className="flex-1 min-w-0">
        {/* Top: provider + model ID */}
        <div className="flex items-start gap-1.5 flex-wrap">
          <span className="text-[9px] uppercase tracking-widest font-semibold text-cyan-400/80 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded flex-shrink-0">
            {result.providerName}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 flex items-center gap-0.5 ${
            probing
              ? "text-yellow-400 border-yellow-400/20 bg-yellow-400/10"
              : result.isOn
              ? "text-green-400 border-green-400/20 bg-green-400/10"
              : "text-red-400 border-red-400/20 bg-red-400/10"
          }`}>
            {probing ? (
              <RefreshIcon spinning />
            ) : result.isOn ? (
              <CheckIcon />
            ) : (
              <XIcon />
            )}
            {probing ? "probing" : result.isOn ? "ON" : "OFF"}
          </span>
        </div>

        {/* Model ID */}
        <div className="text-[10px] font-mono text-foreground/85 mt-0.5 truncate" title={result.modelId}>
          {result.modelId}
        </div>

        {/* Capability pills */}
        {capMeta.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mt-1">
            {capMeta.map((c) => (
              <span key={c.label} className={`text-[8px] px-1.5 py-0.5 rounded border font-medium ${c.color}`}>
                {c.label}
              </span>
            ))}
          </div>
        )}

        {/* Meta: latency + key + last checked */}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {result.latencyMs !== null && (
            <span className="text-[8px] font-mono text-muted-foreground/50">{result.latencyMs}ms</span>
          )}
          <span className="text-[8px] font-mono text-muted-foreground/35">{result.apiKeyMasked}</span>
          {!probing && (
            <span className="text-[8px] text-muted-foreground/30 flex items-center gap-0.5">
              <ClockIcon />
              {new Date(result.lastCheckedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Error message */}
        {!result.isOn && result.error && (
          <div className="text-[8px] text-red-400/70 mt-0.5 truncate" title={result.error}>
            {result.error}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ModelScreenerPanel() {
  const [results, setResults]         = useState<ScreenerModelResult[]>([])
  const [scanning, setScanning]       = useState(false)
  const [probingIds, setProbingIds]   = useState<Set<string>>(new Set())
  const [filterCap, setFilterCap]     = useState<CapabilityTag | "all">("all")
  const [filterStatus, setFilterStatus] = useState<"all" | "on" | "off">("all")
  const [filterProvider, setFilterProvider] = useState<string>("all")
  const [countdown, setCountdown]     = useState<number>(0)
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null)
  const [lastScanMs, setLastScanMs]   = useState<number | null>(null)

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load saved results on mount ──────────────────────────────────────────

  const reload = useCallback(() => {
    const saved = loadScreenerResults()
    setResults(saved)
    if (saved.length > 0) {
      const earliest = Math.min(...saved.map((r) => new Date(r.nextRefreshAt).getTime()))
      setCountdown(Math.max(0, earliest - Date.now()))
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // ── Countdown ticker ──────────────────────────────────────────────────────

  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        const next = Math.max(0, prev - COUNTDOWN_TICK_MS)
        return next
      })
    }, COUNTDOWN_TICK_MS)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [])

  // Auto-trigger scan when any item is due
  useEffect(() => {
    if (countdown === 0 && results.length > 0 && !scanning) {
      const due = getDueForRefresh(results)
      if (due.length > 0) runScan(due)
    }
  }, [countdown]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Run a probe scan ──────────────────────────────────────────────────────

  const runScan = useCallback(async (itemsToScan?: ScreenerModelResult[]) => {
    const workingKeys = loadWorkingKeys()
    if (workingKeys.length === 0) return

    setScanning(true)
    const scanStart = Date.now()

    // Build probe list: either from itemsToScan or rebuild from working keys
    type ProbeItem = { id: string; providerId: string; providerName: string; modelId: string; apiKey: string; apiKeyMasked: string }
    let probes: ProbeItem[]

    if (itemsToScan && itemsToScan.length > 0) {
      // Match back to raw key from localStorage
      probes = itemsToScan.flatMap((item) => {
        const match = workingKeys.find(
          (k) => k.providerId === item.providerId && k.modelId === item.modelId
        )
        if (!match) return []
        return [{ id: item.id, providerId: item.providerId, providerName: item.providerName, modelId: item.modelId, apiKey: match.apiKey, apiKeyMasked: maskKey(match.apiKey) }]
      })
    } else {
      // Full scan: one probe per (key + model) combo
      probes = workingKeys.map((k) => ({
        id: `${k.providerId}::${k.modelId}::${maskKey(k.apiKey)}`,
        providerId: k.providerId,
        providerName: k.providerName,
        modelId: k.modelId,
        apiKey: k.apiKey,
        apiKeyMasked: maskKey(k.apiKey),
      }))
    }

    if (probes.length === 0) { setScanning(false); return }

    setScanProgress({ done: 0, total: probes.length })
    setProbingIds(new Set(probes.map((p) => p.id)))

    // Chunk into batches of 10 to avoid overwhelming the API route
    const CHUNK = 10
    const allResults: ScreenerModelResult[] = []

    for (let i = 0; i < probes.length; i += CHUNK) {
      const chunk = probes.slice(i, i + CHUNK)
      try {
        const res = await fetch("/api/model-screener", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ probes: chunk.map((p) => ({ providerId: p.providerId, modelId: p.modelId, apiKey: p.apiKey })) }),
        })
        if (res.ok) {
          const data = await res.json() as { results: Array<{ providerId: string; modelId: string; isOn: boolean; latencyMs: number | null; error?: string }> }
          const now = new Date().toISOString()
          const next = nextRefreshIso()

          for (const r of data.results) {
            const probe = chunk.find((p) => p.providerId === r.providerId && p.modelId === r.modelId)
            if (!probe) continue
            const screenerResult: ScreenerModelResult = {
              id: probe.id,
              providerId: probe.providerId,
              providerName: probe.providerName,
              modelId: probe.modelId,
              apiKeyMasked: probe.apiKeyMasked,
              isOn: r.isOn,
              latencyMs: r.latencyMs,
              lastCheckedAt: now,
              error: r.error,
              tags: inferCapabilities(probe.modelId),
              nextRefreshAt: next,
            }
            allResults.push(screenerResult)
          }
        }
      } catch {}

      // Update progress
      const done = Math.min(i + CHUNK, probes.length)
      setScanProgress({ done, total: probes.length })
      // Remove probed IDs from probing set
      setProbingIds((prev) => {
        const next = new Set(prev)
        chunk.forEach((p) => next.delete(p.id))
        return next
      })
    }

    // Merge results into stored screener data
    const existing = loadScreenerResults()
    const merged = [...existing]
    for (const incoming of allResults) {
      const idx = merged.findIndex((r) => r.id === incoming.id)
      if (idx >= 0) merged[idx] = incoming
      else merged.push(incoming)
    }
    saveScreenerResults(merged)
    setResults(merged)

    // Update countdown from earliest nextRefreshAt
    if (merged.length > 0) {
      const earliest = Math.min(...merged.map((r) => new Date(r.nextRefreshAt).getTime()))
      setCountdown(Math.max(0, earliest - Date.now()))
    }

    setLastScanMs(Date.now() - scanStart)
    setScanning(false)
    setScanProgress(null)
    setProbingIds(new Set())
  }, [])

  // ── Filter helpers ────────────────────────────────────────────────────────

  const allProviders = Array.from(new Set(results.map((r) => r.providerId))).sort()

  const filtered = results.filter((r) => {
    if (filterCap !== "all" && !r.tags.includes(filterCap)) return false
    if (filterStatus === "on"  && !r.isOn) return false
    if (filterStatus === "off" && r.isOn) return false
    if (filterProvider !== "all" && r.providerId !== filterProvider) return false
    return true
  })

  const onCount  = results.filter((r) => r.isOn).length
  const offCount = results.filter((r) => !r.isOn).length

  // ── Empty state ───────────────────────────────────────────────────────────

  if (results.length === 0 && !scanning) {
    const hasKeys = typeof window !== "undefined" && loadWorkingKeys().length > 0

    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
        <span className="w-12 h-12 rounded-xl border border-border flex items-center justify-center text-muted-foreground/40">
          <ScanIcon />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Model Status Screener</p>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-xs leading-relaxed">
            {hasKeys
              ? "Probe all your saved working keys to see which models are currently ON or OFF. Auto-refreshes every 24h."
              : "Run a batch test first to save working keys, then come back here to monitor their status."}
          </p>
        </div>
        {hasKeys && (
          <button
            onClick={() => runScan()}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <ScanIcon />
            Start Scan
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-border px-3 py-2.5 flex flex-col gap-2">
        {/* Top row: title + stats + scan button */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Screener</span>
            {/* ON/OFF summary */}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-400/10 text-green-400 border border-green-400/20 font-mono">
              {onCount} ON
            </span>
            {offCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20 font-mono">
                {offCount} OFF
              </span>
            )}
            {lastScanMs !== null && (
              <span className="text-[9px] text-muted-foreground/35 font-mono hidden sm:inline">
                {(lastScanMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Countdown */}
            {results.length > 0 && !scanning && (
              <span className="text-[9px] font-mono text-muted-foreground/40 flex items-center gap-1">
                <ClockIcon />
                next: {formatCountdown(countdown)}
              </span>
            )}

            {/* Progress */}
            {scanning && scanProgress && (
              <span className="text-[9px] font-mono text-yellow-400/80">
                {scanProgress.done}/{scanProgress.total}
              </span>
            )}

            {/* Scan now button */}
            <button
              onClick={() => runScan()}
              disabled={scanning}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[9px] text-muted-foreground hover:text-cyan-400 hover:border-cyan-400/40 hover:bg-cyan-400/5 transition-all disabled:opacity-40"
            >
              <RefreshIcon spinning={scanning} />
              {scanning ? "Scanning..." : "Scan now"}
            </button>

            {/* Clear results */}
            {results.length > 0 && !scanning && (
              <button
                onClick={() => { clearScreenerResults(); setResults([]) }}
                className="text-[9px] text-muted-foreground/30 hover:text-red-400 transition-colors px-1.5"
                title="Clear all screener results"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {scanning && scanProgress && (
          <div className="w-full h-0.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-cyan-400/60 transition-all duration-300"
              style={{ width: `${(scanProgress.done / scanProgress.total) * 100}%` }}
            />
          </div>
        )}

        {/* ── Filter row ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Status filter */}
          {(["all", "on", "off"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                filterStatus === s
                  ? s === "on"  ? "border-green-400/50 bg-green-400/10 text-green-400"
                    : s === "off" ? "border-red-400/50 bg-red-400/10 text-red-400"
                    : "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground/50 hover:bg-secondary"
              }`}
            >
              {s === "all" ? `All (${results.length})` : s === "on" ? `ON (${onCount})` : `OFF (${offCount})`}
            </button>
          ))}

          {/* Divider */}
          <span className="w-px h-3 bg-border mx-0.5" />

          {/* Capability filter */}
          <button
            onClick={() => setFilterCap("all")}
            className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
              filterCap === "all" ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground/50 hover:bg-secondary"
            }`}
          >
            All types
          </button>
          {ALL_CAPS.map((cap) => {
            const meta = CAP_META[cap]
            const count = results.filter((r) => r.tags.includes(cap)).length
            if (count === 0) return null
            return (
              <button
                key={cap}
                onClick={() => setFilterCap(cap)}
                className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                  filterCap === cap ? meta.color : "border-border text-muted-foreground/50 hover:bg-secondary"
                }`}
              >
                {meta.label} ({count})
              </button>
            )
          })}

          {/* Divider */}
          {allProviders.length > 1 && <span className="w-px h-3 bg-border mx-0.5" />}

          {/* Provider filter */}
          {allProviders.length > 1 && (
            <>
              <button
                onClick={() => setFilterProvider("all")}
                className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                  filterProvider === "all" ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground/50 hover:bg-secondary"
                }`}
              >
                All providers
              </button>
              {allProviders.map((pid) => {
                const name = results.find((r) => r.providerId === pid)?.providerName ?? pid
                const cnt  = results.filter((r) => r.providerId === pid).length
                return (
                  <button
                    key={pid}
                    onClick={() => setFilterProvider(pid)}
                    className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                      filterProvider === pid ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-400" : "border-border text-muted-foreground/50 hover:bg-secondary"
                    }`}
                  >
                    {name} ({cnt})
                  </button>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Results list ───────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-[11px] text-muted-foreground/50">No models match current filters.</p>
          </div>
        ) : (
          <div className="rounded-none">
            {/* Group by provider for readability */}
            {allProviders
              .filter((pid) => filterProvider === "all" || filterProvider === pid)
              .map((pid) => {
                const rows = filtered.filter((r) => r.providerId === pid)
                if (rows.length === 0) return null
                const providerName = rows[0].providerName
                const provOn  = rows.filter((r) => r.isOn).length
                const provOff = rows.filter((r) => !r.isOn).length

                return (
                  <div key={pid}>
                    {/* Provider group header */}
                    <div className="px-3 py-1.5 bg-secondary/30 border-b border-border flex items-center gap-2 sticky top-0 z-10">
                      <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                        {providerName}
                      </span>
                      <span className="text-[8px] font-mono text-green-400/70">{provOn} ON</span>
                      {provOff > 0 && <span className="text-[8px] font-mono text-red-400/70">{provOff} OFF</span>}
                    </div>
                    {rows.map((r) => (
                      <ModelRow key={r.id} result={r} probing={probingIds.has(r.id)} />
                    ))}
                  </div>
                )
              })}
          </div>
        )}

        {/* Footer note */}
        <p className="text-[9px] text-muted-foreground/30 text-center py-3 px-4">
          Auto-refresh every 24h. Results cached in browser storage.
        </p>
      </div>
    </div>
  )
}
