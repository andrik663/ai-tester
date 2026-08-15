"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getHistory,
  clearHistory,
  deleteHistoryEntry,
  type HistoryEntry,
} from "@/lib/history"

interface HistoryPanelProps {
  onRestore?: (entry: HistoryEntry) => void
}

function fmtRelative(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

function fmtDuration(ms?: number): string {
  if (!ms) return ""
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? "bg-success" : "bg-destructive"}`}
      aria-label={ok ? "success" : "error"}
    />
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden>
      <path d="M2 4h12M6 4V2h4v2M13 4l-1 10H4L3 4" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden>
      <path d="M3 8A5 5 0 1 0 4.9 4M3 2v4h4" />
    </svg>
  )
}

function CurlCopyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <rect x="4" y="4" width="9" height="10" rx="1.5" />
      <path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1" />
    </svg>
  )
}

function ExpandIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

function HistoryItem({
  entry,
  onRestore,
  onDelete,
}: {
  entry: HistoryEntry
  onRestore?: (e: HistoryEntry) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState(false)

  async function copyCurl() {
    if (!entry.curlFull) return
    try {
      await navigator.clipboard.writeText(entry.curlFull)
      setCopiedCurl(true)
      setTimeout(() => setCopiedCurl(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${entry.ok ? "border-border" : "border-destructive/20"}`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/30 transition-colors"
      >
        <StatusDot ok={entry.ok} />
        <span className="text-[11px] font-medium text-foreground truncate flex-1 min-w-0">{entry.prompt}</span>
        <span className="text-[9px] text-muted-foreground/50 flex-shrink-0 hidden sm:block">{entry.providerName}</span>
        {entry.durationMs && (
          <span className="text-[9px] font-mono text-muted-foreground/60 flex-shrink-0">{fmtDuration(entry.durationMs)}</span>
        )}
        <span className="text-[9px] text-muted-foreground/40 flex-shrink-0">{fmtRelative(entry.ts)}</span>
        <ExpandIcon open={expanded} />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border bg-secondary/10 px-3 py-2.5 flex flex-col gap-2">
          {/* Meta row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono">
            <span className="text-muted-foreground">provider: <span className="text-foreground">{entry.providerName}</span></span>
            {entry.model && <span className="text-muted-foreground">model: <span className="text-foreground">{entry.model}</span></span>}
            <span className="text-muted-foreground">HTTP: <span className={entry.ok ? "text-success" : "text-destructive"}>{entry.status}</span></span>
            {entry.durationMs && <span className="text-muted-foreground">total: <span className="text-foreground">{fmtDuration(entry.durationMs)}</span></span>}
            {entry.ttftMs != null && <span className="text-muted-foreground">TTFT: <span className="text-cyan-400">{entry.ttftMs}ms</span></span>}
            {entry.tokenUsage?.totalTokens && <span className="text-muted-foreground">tokens: <span className="text-foreground">{entry.tokenUsage.totalTokens}</span></span>}
          </div>

          {/* Reply preview */}
          {entry.reply && (
            <div className="rounded-md bg-card border border-border px-2.5 py-2 text-[11px] text-foreground leading-relaxed max-h-32 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-sans">{entry.reply}</pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-0.5">
            {onRestore && (
              <button
                onClick={() => onRestore(entry)}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                <RestoreIcon /> Restore
              </button>
            )}
            {entry.curlFull && (
              <button
                onClick={copyCurl}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-secondary/60 text-muted-foreground border border-border hover:text-foreground transition-colors"
              >
                <CurlCopyIcon /> {copiedCurl ? "Copied!" : "Copy cURL"}
              </button>
            )}
            <button
              onClick={() => onDelete(entry.id)}
              className="ml-auto flex items-center gap-1 text-[10px] px-2 py-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/8 transition-colors border border-transparent hover:border-destructive/20"
            >
              <TrashIcon /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HistoryPanel({ onRestore }: HistoryPanelProps) {
  const [entries, setEntries]   = useState<HistoryEntry[]>([])
  const [search, setSearch]     = useState("")
  const [filterOk, setFilterOk] = useState<"all" | "ok" | "err">("all")

  const reload = useCallback(() => setEntries(getHistory()), [])

  useEffect(() => { reload() }, [reload])

  // Re-sync when the tab becomes active
  useEffect(() => {
    const handler = () => reload()
    window.addEventListener("focus", handler)
    return () => window.removeEventListener("focus", handler)
  }, [reload])

  function handleDelete(id: string) {
    deleteHistoryEntry(id)
    reload()
  }

  function handleClearAll() {
    if (!confirm("Clear all history? This cannot be undone.")) return
    clearHistory()
    reload()
  }

  const filtered = entries.filter((e) => {
    const matchSearch = !search || e.prompt.toLowerCase().includes(search.toLowerCase()) || e.providerName.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filterOk === "all" || (filterOk === "ok" && e.ok) || (filterOk === "err" && !e.ok)
    return matchSearch && matchFilter
  })

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border flex-shrink-0">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search history..."
          className="flex-1 min-w-0 text-[11px] bg-secondary/40 border border-border rounded-md px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={filterOk}
          onChange={(e) => setFilterOk(e.target.value as "all" | "ok" | "err")}
          className="text-[10px] bg-secondary/40 border border-border rounded-md px-1.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All</option>
          <option value="ok">Success</option>
          <option value="err">Error</option>
        </select>
        {entries.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-[10px] text-muted-foreground/50 hover:text-destructive transition-colors px-1.5 py-1 rounded hover:bg-destructive/8 flex-shrink-0"
          >
            Clear all
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <div className="w-8 h-8 rounded-lg bg-secondary/60 border border-border flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted-foreground/50" aria-hidden>
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v3l2 1.5" />
              </svg>
            </div>
            <p className="text-[11px] text-muted-foreground/50">
              {entries.length === 0 ? "No requests yet — send a message to see history" : "No results match your filter"}
            </p>
          </div>
        ) : (
          filtered.map((e) => (
            <HistoryItem
              key={e.id}
              entry={e}
              onRestore={onRestore}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {entries.length > 0 && (
        <div className="px-3 py-2 border-t border-border flex-shrink-0">
          <p className="text-[9px] text-muted-foreground/40">{entries.length} entries · last 100 kept</p>
        </div>
      )}
    </div>
  )
}
