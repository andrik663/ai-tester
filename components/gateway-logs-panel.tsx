"use client"

import { useState, useEffect, useCallback, useRef } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogRow {
  id:               number
  model:            string
  providerId:       string
  providerName:     string
  success:          boolean
  statusCode:       number
  latencyMs:        number
  errorMessage?:    string | null
  streaming:        boolean
  fallbackUsed:     boolean
  attemptCount:     number
  promptTokens:     number
  completionTokens: number
  tsMs:             number
  createdAt:        string
}

interface LogsSummary {
  total:         number
  successCount:  number
  failCount:     number
  avgLatencyMs:  number
  p95LatencyMs:  number
  topModels:     Array<{ model: string; count: number }>
  topProviders:  Array<{ providerId: string; count: number; avgLatencyMs: number }>
  rps:           number
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconRefresh({ spinning }: { spinning?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      className={`w-3.5 h-3.5 flex-shrink-0 ${spinning ? "animate-spin" : ""}`} aria-hidden>
      <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconStream() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

function IconFallback() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(tsMs: number): string {
  const delta = Date.now() - tsMs
  if (delta < 1_000)  return "just now"
  if (delta < 60_000) return `${Math.floor(delta / 1_000)}s ago`
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  return new Date(tsMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function latencyColor(ms: number): string {
  if (ms < 500)   return "text-success"
  if (ms < 1500)  return "text-warning"
  return "text-destructive"
}

function successRate(total: number, success: number): number {
  if (total === 0) return 100
  return Math.round((success / total) * 100)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border border-border/40 bg-secondary/20">
      <span className="text-[15px] font-bold text-foreground tabular-nums">{value}</span>
      <span className="text-[8.5px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
      {sub && <span className="text-[8px] text-muted-foreground/60">{sub}</span>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type View = "live" | "analytics"

export default function GatewayLogsPanel() {
  const [view,      setView]      = useState<View>("live")
  const [rows,      setRows]      = useState<LogRow[]>([])
  const [summary,   setSummary]   = useState<LogsSummary | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const sinceRef    = useRef<number>(0)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch live log rows (tail) ───────────────────────────────────────────────
  const fetchLogs = useCallback(async (replace = false) => {
    setLoading(true)
    setError(null)
    try {
      const since = replace ? 0 : sinceRef.current
      const url = `/api/v1/logs?limit=80${since ? `&since=${since}` : ""}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { rows: LogRow[] }
      const incoming = data.rows ?? []
      if (incoming.length > 0) {
        sinceRef.current = Math.max(...incoming.map((r) => r.tsMs))
      }
      setRows((prev) => {
        if (replace) return incoming
        // Prepend new rows, deduplicate, cap at 200
        const merged = [...incoming.filter((r) => !prev.some((p) => p.id === r.id)), ...prev]
        return merged.slice(0, 200)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs")
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Fetch analytics summary ──────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/v1/logs?summary=1&window=3600000")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as LogsSummary
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Auto-refresh wiring ──────────────────────────────────────────────────────
  useEffect(() => {
    if (view === "live") {
      fetchLogs(true)
    } else {
      fetchSummary()
    }
  }, [view, fetchLogs, fetchSummary])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!autoRefresh) return
    timerRef.current = setInterval(() => {
      if (view === "live") fetchLogs(false)
      else fetchSummary()
    }, 4_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [autoRefresh, view, fetchLogs, fetchSummary])

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-0.5">
          {(["live", "analytics"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 h-6 rounded text-[10px] font-medium transition-all capitalize ${
                view === v
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {v === "live" ? "Live Feed" : "Analytics"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* Live dot */}
          {autoRefresh && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[9px] text-success">live</span>
            </div>
          )}
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-2 h-5.5 rounded text-[9px] font-medium transition-all border ${
              autoRefresh
                ? "border-success/30 bg-success/10 text-success"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {autoRefresh ? "Auto" : "Paused"}
          </button>
          {/* Manual refresh */}
          <button
            onClick={() => view === "live" ? fetchLogs(true) : fetchSummary()}
            className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-all"
            title="Refresh"
          >
            <IconRefresh spinning={loading} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 text-[10px] text-destructive bg-destructive/8 border-b border-destructive/20 flex-shrink-0">
          {error}
        </div>
      )}

      {/* ── LIVE FEED ── */}
      {view === "live" && (
        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <span className="text-[11px] text-muted-foreground/70">No requests yet</span>
              <span className="text-[9px] text-muted-foreground/35">
                Send a request to{" "}
                <span className="font-mono">/api/v1/chat/completions</span>
              </span>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {rows.map((row) => (
                <div key={row.id} className="flex items-start gap-2 px-3 py-2 hover:bg-secondary/15 transition-colors">
                  {/* Status icon */}
                  <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                    row.success ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                  }`}>
                    {row.success ? <IconCheck /> : <IconX />}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono text-foreground/90 truncate max-w-[130px]">{row.model}</span>
                      <span className="text-[8.5px] text-muted-foreground/70 px-1 py-0.5 rounded bg-secondary/30 flex-shrink-0">{row.providerId}</span>
                      {row.streaming && (
                        <span className="text-info flex-shrink-0" title="Streaming"><IconStream /></span>
                      )}
                      {row.fallbackUsed && (
                        <span className="text-warning flex-shrink-0" title={`Fallback used (${row.attemptCount} attempts)`}><IconFallback /></span>
                      )}
                    </div>
                    {row.errorMessage && (
                      <p className="text-[9px] text-destructive/80 mt-0.5 truncate">{row.errorMessage}</p>
                    )}
                    {row.completionTokens > 0 && (
                      <p className="text-[8.5px] text-muted-foreground/60 mt-0.5">
                        {row.promptTokens}+{row.completionTokens} tok
                      </p>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className={`text-[10px] font-mono font-semibold tabular-nums ${latencyColor(row.latencyMs)}`}>
                      {row.latencyMs}ms
                    </span>
                    <span className="text-[8px] text-muted-foreground/60">{relativeTime(row.tsMs)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS ── */}
      {view === "analytics" && summary && (
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4">
          {/* Stat grid */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Requests" value={summary.total} sub="last 1h" />
            <StatCard label="Success" value={`${successRate(summary.total, summary.successCount)}%`} />
            <StatCard label="Errors" value={summary.failCount} />
            <StatCard label="Avg Latency" value={`${summary.avgLatencyMs}ms`} />
            <StatCard label="p95 Latency" value={`${summary.p95LatencyMs}ms`} />
            <StatCard label="Req/min" value={Math.round(summary.rps)} sub="last 60s" />
          </div>

          {/* Top models */}
          {summary.topModels.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] text-muted-foreground/60 uppercase tracking-widest">Top Models</span>
              <div className="flex flex-col gap-1">
                {summary.topModels.map((m) => {
                  const pct = summary.total > 0 ? Math.round((m.count / summary.total) * 100) : 0
                  return (
                    <div key={m.model} className="flex items-center gap-2">
                      <span className="text-[9.5px] font-mono text-foreground/80 truncate flex-1 min-w-0">{m.model}</span>
                      <div className="w-16 h-1 rounded-full bg-secondary/40 overflow-hidden flex-shrink-0">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[9px] text-muted-foreground/70 w-7 text-right flex-shrink-0">{m.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top providers */}
          {summary.topProviders.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] text-muted-foreground/60 uppercase tracking-widest">Top Providers</span>
              <div className="flex flex-col gap-1">
                {summary.topProviders.map((p) => (
                  <div key={p.providerId} className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/15 border border-border/20">
                    <span className="text-[9.5px] text-foreground/80 flex-1 min-w-0 truncate">{p.providerId}</span>
                    <span className={`text-[9px] font-mono font-semibold tabular-nums flex-shrink-0 ${latencyColor(p.avgLatencyMs)}`}>
                      {p.avgLatencyMs}ms
                    </span>
                    <span className="text-[9px] text-muted-foreground/70 flex-shrink-0">{p.count} req</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.total === 0 && (
            <div className="flex flex-col items-center justify-center h-20 gap-1.5">
              <span className="text-[11px] text-muted-foreground/70">No data in last hour</span>
              <span className="text-[9px] text-muted-foreground/35">Make requests through the gateway to see analytics</span>
            </div>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && rows.length === 0 && view === "live" && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground/60 animate-pulse">Loading logs...</span>
        </div>
      )}
    </div>
  )
}
