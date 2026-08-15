"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import type { KeyInfoResult } from "@/app/api/key-info/route"
import { copyToClipboard } from "@/lib/clipboard"

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseResetTime(resetStr?: string): string | null {
  if (!resetStr) return null
  // ISO 8601 duration e.g. "1m30s" or "PT1M30S" or a datetime string
  const isoMatch = resetStr.match(/^PT?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+\.?\d*)S)?$/i)
  if (isoMatch) {
    const h = parseInt(isoMatch[1] ?? "0")
    const m = parseInt(isoMatch[2] ?? "0")
    const s = Math.round(parseFloat(isoMatch[3] ?? "0"))
    const parts: string[] = []
    if (h) parts.push(`${h}h`)
    if (m) parts.push(`${m}m`)
    if (s) parts.push(`${s}s`)
    return parts.join(" ") || "< 1s"
  }
  // Compact like "1m30s"
  const compactMatch = resetStr.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/)
  if (compactMatch && (compactMatch[1] || compactMatch[2] || compactMatch[3])) {
    const h = parseInt(compactMatch[1] ?? "0")
    const m = parseInt(compactMatch[2] ?? "0")
    const s = parseInt(compactMatch[3] ?? "0")
    const parts: string[] = []
    if (h) parts.push(`${h}h`)
    if (m) parts.push(`${m}m`)
    if (s) parts.push(`${s}s`)
    return parts.join(" ") || "< 1s"
  }
  // Datetime string
  try {
    const dt = new Date(resetStr)
    if (!isNaN(dt.getTime())) {
      const diffMs = dt.getTime() - Date.now()
      if (diffMs < 0) return "resetting"
      const diffSec = Math.round(diffMs / 1000)
      if (diffSec < 60) return `${diffSec}s`
      const diffMin = Math.round(diffSec / 60)
      if (diffMin < 60) return `${diffMin}m`
      return `${Math.round(diffMin / 60)}h`
    }
  } catch { /* ignore */ }
  return resetStr.slice(0, 20)
}

function ratePct(remaining?: string, limit?: string): number | null {
  if (!remaining || !limit) return null
  const r = parseInt(remaining), l = parseInt(limit)
  if (isNaN(r) || isNaN(l) || l === 0) return null
  return Math.round((r / l) * 100)
}

function pctColor(pct: number | null): string {
  if (pct === null) return "text-muted-foreground"
  if (pct > 60) return "text-success"
  if (pct > 25) return "text-yellow-400"
  return "text-destructive"
}

function pctBarColor(pct: number | null): string {
  if (pct === null) return "bg-muted-foreground/20"
  if (pct > 60) return "bg-success"
  if (pct > 25) return "bg-yellow-400"
  return "bg-destructive"
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatRow({
  label,
  value,
  accent = "default",
  mono = false,
  copy,
}: {
  label: string
  value: string
  accent?: "green" | "yellow" | "red" | "blue" | "muted" | "default"
  mono?: boolean
  copy?: string
}) {
  const [copied, setCopied] = useState(false)
  const colors = {
    green:   "text-success",
    yellow:  "text-yellow-400",
    red:     "text-destructive",
    blue:    "text-sky-400",
    muted:   "text-muted-foreground",
    default: "text-foreground",
  }
  function doCopy() {
    if (!copy) return
    copyToClipboard(copy).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200) })
  }
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-border/40 last:border-0">
      <span className="text-[10px] text-muted-foreground flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className={`text-[11px] ${mono ? "font-mono" : "font-medium"} ${colors[accent]} truncate text-right`}>
          {value}
        </span>
        {copy && (
          <button
            onClick={doCopy}
            className="flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            title="Copy"
          >
            {copied ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 text-success">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

function RateLimitBar({
  label,
  remaining,
  limit,
  reset,
}: {
  label: string
  remaining?: string
  limit?: string
  reset?: string
}) {
  if (!remaining) return null
  const pct = ratePct(remaining, limit)
  const resetLabel = parseResetTime(reset)
  const barColor = pctBarColor(pct)
  const textColor = pctColor(pct)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono font-semibold ${textColor}`}>
            {limit ? `${remaining} / ${limit}` : remaining}
          </span>
          {resetLabel && (
            <span className="text-[9px] text-sky-400/80 font-mono bg-sky-400/8 px-1.5 py-0.5 rounded border border-sky-400/15">
              reset {resetLabel}
            </span>
          )}
        </div>
      </div>
      {pct !== null && (
        <div className="h-1 bg-border/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.max(1, pct)}%` }}
          />
        </div>
      )}
    </div>
  )
}

function ModelGrid({ models, total }: { models: string[]; total?: number }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? models : models.slice(0, 6)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {shown.map((m) => (
          <span
            key={m}
            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary/60 border border-border text-muted-foreground truncate max-w-full"
            title={m}
          >
            {m.length > 28 ? m.slice(0, 28) + "…" : m}
          </span>
        ))}
      </div>
      {models.length > 6 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[9px] text-primary/70 hover:text-primary transition-colors self-start"
        >
          {expanded ? "Show less" : `+${models.length - 6} more${total && total > models.length ? ` (${total} total)` : ""}`}
        </button>
      )}
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

interface KeyInfoPanelProps {
  provider: string
  apiKey: string
  /** Response headers from the last successful request — passed for rate limit extraction */
  responseHeaders?: Record<string, string>
  /** Trigger a fresh fetch (bump this counter) */
  fetchTick?: number
}

export default function KeyInfoPanel({ provider, apiKey, responseHeaders, fetchTick = 0 }: KeyInfoPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  const swrKey =
    provider && apiKey.trim().length >= 8
      ? ["/api/key-info", provider, apiKey.trim().slice(0, 12), fetchTick]
      : null

  const fetcher = useCallback(
    async ([url]: [string]) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          responseHeaders,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<KeyInfoResult>
    },
    [provider, apiKey, responseHeaders]
  )

  const { data, isLoading, error, mutate } = useSWR<KeyInfoResult>(swrKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  if (!apiKey.trim() || apiKey.trim().length < 8) return null

  const rl = data?.rateLimit
  const reqPct = ratePct(rl?.reqRemaining, rl?.reqLimit)
  const tokPct = ratePct(rl?.tokRemaining, rl?.tokLimit)

  return (
    <div className="flex flex-col gap-0 border border-border rounded-lg overflow-hidden bg-card/60">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors select-none"
        onClick={() => setCollapsed((v) => !v)}
        role="button"
        aria-expanded={!collapsed}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setCollapsed((v) => !v) }}
      >
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 flex-shrink-0 ${data && !error ? "text-success" : isLoading ? "text-yellow-400 animate-pulse" : "text-muted-foreground"}`}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Key Info
          </span>
          {isLoading && (
            <span className="text-[9px] text-muted-foreground/60 font-normal normal-case">fetching...</span>
          )}
          {data && !isLoading && (
            <span className="text-[9px] text-success/70 font-normal normal-case">
              {data.modelCount ? `${data.modelCount} models` : ""}
              {data.balance ? (data.modelCount ? " · " : "") + data.balance : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {data && (
            <button
              onClick={(e) => { e.stopPropagation(); mutate() }}
              className="p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors rounded"
              title="Refresh"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-4" />
              </svg>
            </button>
          )}
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`w-3 h-3 text-muted-foreground/60 transition-transform ${collapsed ? "" : "rotate-180"}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-3 py-3 flex flex-col gap-3">
          {isLoading && (
            <div className="flex flex-col gap-2">
              {[80, 60, 70, 50].map((w, i) => (
                <div key={i} className={`h-3 rounded bg-border/50 animate-pulse`} style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {error && !isLoading && (
            <p className="text-[10px] text-muted-foreground/60 italic">Could not load enriched info for this key.</p>
          )}

          {data && !isLoading && (
            <>
              {/* Account section */}
              {(data.username || data.org || data.plan) && (
                <div className="flex flex-col gap-0">
                  {data.username && <StatRow label="Account" value={data.username} mono />}
                  {data.org && <StatRow label="Org" value={data.org} />}
                  {data.plan && <StatRow label="Plan" value={data.plan} accent="blue" />}
                </div>
              )}

              {/* Balance */}
              {data.balance && (
                <div className="flex flex-col gap-0 pt-1 border-t border-border/40">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[10px] text-muted-foreground">Balance</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold font-mono ${(data.balanceRaw ?? 1) > 0 ? "text-success" : "text-destructive"}`}>
                        {data.balance}
                      </span>
                      {data.balanceRaw !== undefined && data.balanceRaw < 1 && (
                        <span className="text-[9px] text-yellow-400/80 border border-yellow-400/20 bg-yellow-400/8 px-1.5 py-0.5 rounded">
                          Low balance
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Model count */}
              {data.modelCount !== undefined && (
                <div className="flex flex-col gap-1.5 pt-1 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Models accessible</span>
                    <span className="text-[13px] font-bold font-mono text-foreground">{data.modelCount}</span>
                  </div>
                  {data.modelList && data.modelList.length > 0 && (
                    <ModelGrid models={data.modelList} total={data.modelCount} />
                  )}
                </div>
              )}

              {/* Rate limits */}
              {rl && (rl.reqRemaining || rl.tokRemaining) && (
                <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rate Limits</span>
                  <RateLimitBar
                    label="Requests"
                    remaining={rl.reqRemaining}
                    limit={rl.reqLimit}
                    reset={rl.reqReset}
                  />
                  <RateLimitBar
                    label="Tokens"
                    remaining={rl.tokRemaining}
                    limit={rl.tokLimit}
                  />
                  {!rl.reqRemaining && !rl.tokRemaining && (
                    <p className="text-[9px] text-muted-foreground/50 italic">No rate limit headers returned by this provider.</p>
                  )}
                </div>
              )}

              {/* Rate limit summary chips when no bar data */}
              {!rl && (
                <div className="pt-1 border-t border-border/40">
                  <p className="text-[9px] text-muted-foreground/50 italic">
                    Rate limit data available after sending a message.
                  </p>
                </div>
              )}

              {/* Fetched timestamp */}
              <p className="text-[9px] text-muted-foreground/30 text-right">
                Updated {new Date(data.fetchedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
