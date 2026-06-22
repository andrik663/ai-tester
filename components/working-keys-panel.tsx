"use client"

import { useState, useEffect, useCallback } from "react"
import { copyToClipboard } from "@/lib/clipboard"
import {
  loadWorkingKeys,
  deleteWorkingKey,
  clearAllWorkingKeys,
  type WorkingKeyRecord,
} from "@/lib/working-keys-store"
import { buildProviderHeaders, resolveProviderEndpoint } from "@/lib/providers"

// Build a ready-to-run curl command for a working key record
function buildCurlCommand(record: WorkingKeyRecord): string {
  const endpoint = resolveProviderEndpoint(record.providerId, record.apiKey)
  if (!endpoint) return `# endpoint requires extra config (account ID / resource name)\n# Provider: ${record.providerName}`

  const headers = buildProviderHeaders(record.providerId, record.apiKey)

  // Replace key placeholder in endpoint (e.g. Google's ?key=...)
  const url = endpoint.includes("{{MODEL}}")
    ? endpoint.replace("{{MODEL}}", record.modelId)
    : endpoint

  const body: Record<string, unknown> = {
    model: record.modelId,
    max_tokens: 100,
    messages: [{ role: "user", content: "Say hello" }],
  }

  const headerFlags = Object.entries(headers)
    .map(([k, v]) => {
      // Mask the actual key in the header value for display
      const masked = typeof v === "string" && v.includes(record.apiKey)
        ? v.replace(record.apiKey, record.apiKey.slice(0, 4) + "••••" + record.apiKey.slice(-4))
        : v
      return `  -H '${k}: ${masked}'`
    })
    .join(" \\\n")

  return `curl -X POST '${url}' \\\n${headerFlags} \\\n  -d '${JSON.stringify(body)}'`
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4h12M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4M6 7v5M10 7v5M3 4l1 9.5A.5.5 0 004.5 14h7a.5.5 0 00.5-.5L13 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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

function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="5.5" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 8h6M12.5 8v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function TerminalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 6l3 3-3 3M9 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Masked key display ────────────────────────────────────────────────────────

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••"
  return key.slice(0, 4) + "••••" + key.slice(-4)
}

// ── Single record row ─────────────────────────────────────────────────────────

function RecordRow({
  record,
  onDelete,
  onCopyKey,
}: {
  record: WorkingKeyRecord
  onDelete: (id: string) => void
  onCopyKey: (key: string) => void
}) {
  const [copiedKey, setCopiedKey]     = useState(false)
  const [copiedModel, setCopiedModel] = useState(false)
  const [copiedCurl, setCopiedCurl]   = useState(false)
  const [confirmDel, setConfirmDel]   = useState(false)

  const handleCopyKey = useCallback(() => {
    copyToClipboard(record.apiKey).then(() => {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 1500)
      onCopyKey(record.apiKey)
    }).catch(() => {})
  }, [record.apiKey, onCopyKey])

  const handleCopyModel = useCallback(() => {
    copyToClipboard(record.modelId).then(() => {
      setCopiedModel(true)
      setTimeout(() => setCopiedModel(false), 1500)
    }).catch(() => {})
  }, [record.modelId])

  const handleCopyCurl = useCallback(() => {
    const cmd = buildCurlCommand(record)
    copyToClipboard(cmd).then(() => {
      setCopiedCurl(true)
      setTimeout(() => setCopiedCurl(false), 2000)
    }).catch(() => {})
  }, [record])

  const handleDelete = useCallback(() => {
    if (!confirmDel) {
      setConfirmDel(true)
      setTimeout(() => setConfirmDel(false), 2500)
      return
    }
    onDelete(record.id)
  }, [confirmDel, record.id, onDelete])

  const date = new Date(record.savedAt)
  const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  const timeStr = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

  return (
    <div className="border-b border-border last:border-0 px-3 py-3 flex flex-col gap-2 hover:bg-secondary/20 transition-colors">
      {/* Top row: provider badge + model + latency */}
      <div className="flex items-start gap-2">
        {/* Green dot */}
        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-400 mt-1.5" />

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {/* Provider */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] uppercase tracking-widest font-semibold text-primary/70 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
              {record.providerName}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/50">{dateStr} {timeStr}</span>
          </div>
          {/* Model */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-foreground break-all leading-snug">
              {record.modelId}
            </span>
            <button
              onClick={handleCopyModel}
              className="flex-shrink-0 text-muted-foreground/40 hover:text-primary transition-colors"
              title="Copy model ID"
            >
              {copiedModel ? (
                <span className="text-[8px] text-green-400">OK</span>
              ) : (
                <CopyIcon />
              )}
            </button>
          </div>
          {/* Stats */}
          <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground/50">
            <span>{record.latencyMs}ms</span>
            {record.tokenUsage?.total !== undefined && (
              <span>{record.tokenUsage.total} tok</span>
            )}
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          className={`flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-md border text-[9px] transition-all ${
            confirmDel
              ? "border-red-400/50 bg-red-400/10 text-red-400"
              : "border-border text-muted-foreground/40 hover:border-red-400/30 hover:text-red-400 hover:bg-red-400/5"
          }`}
          title={confirmDel ? "Tap again to confirm" : "Delete"}
        >
          <TrashIcon />
          {confirmDel ? <span>Sure?</span> : null}
        </button>
      </div>

      {/* API Key + cURL row */}
      <div className="flex flex-col gap-1.5 pl-3.5">
        <div className="flex items-center gap-2">
          <KeyIcon />
          <span className="text-[10px] font-mono text-muted-foreground/60 flex-1 truncate">
            {maskKey(record.apiKey)}
          </span>
          <button
            onClick={handleCopyKey}
            className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex-shrink-0"
          >
            <CopyIcon />
            {copiedKey ? "Copied!" : "Copy Key"}
          </button>
        </div>

        {/* cURL command row */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground/30">
            <TerminalIcon />
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/40 flex-1 truncate">
            curl -X POST &apos;{resolveProviderEndpoint(record.providerId, record.apiKey) ?? "N/A"}&apos;
          </span>
          <button
            onClick={handleCopyCurl}
            className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border transition-colors flex-shrink-0 ${
              copiedCurl
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
            }`}
            title="Copy full cURL command"
          >
            <TerminalIcon />
            {copiedCurl ? "Copied!" : "Copy cURL"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  /** Called when user copies a key — so parent can optionally paste it into the key field */
  onUseKey?: (key: string, providerId: string) => void
  /** Refresh trigger from parent (increment to force re-load) */
  refreshTick?: number
}

export default function WorkingKeysPanel({ onUseKey, refreshTick }: Props) {
  const [records, setRecords]         = useState<WorkingKeyRecord[]>([])
  const [filterProvider, setFilterProvider] = useState<string>("all")
  const [confirmClear, setConfirmClear] = useState(false)

  // Load from localStorage
  const reload = useCallback(() => {
    setRecords(loadWorkingKeys().sort((a, b) => b.savedAt - a.savedAt))
  }, [])

  useEffect(() => {
    reload()
  }, [reload, refreshTick])

  const handleDelete = useCallback((id: string) => {
    const updated = deleteWorkingKey(id)
    setRecords(updated.sort((a, b) => b.savedAt - a.savedAt))
  }, [])

  const handleCopyKey = useCallback((key: string) => {
    // Find which provider this key belongs to for onUseKey
    const record = records.find((r) => r.apiKey === key)
    if (record && onUseKey) onUseKey(key, record.providerId)
  }, [records, onUseKey])

  const handleClearAll = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 2500)
      return
    }
    clearAllWorkingKeys()
    setRecords([])
    setConfirmClear(false)
  }, [confirmClear])

  // Unique providers for filter
  const providers = Array.from(new Set(records.map((r) => r.providerId))).sort()

  const filtered = filterProvider === "all"
    ? records
    : records.filter((r) => r.providerId === filterProvider)

  const okCount = records.length

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <span className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground/40">
          <KeyIcon />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">No saved keys yet</p>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
            Run a batch test on any provider. Working models are automatically saved here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-3 sm:px-4 py-3">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Working Keys
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-400/10 text-green-400 border border-green-400/20">
            {okCount} saved
          </span>
        </div>

        {/* Clear all */}
        <button
          onClick={handleClearAll}
          className={`flex items-center gap-1 text-[9px] px-2 py-1 rounded border transition-all ${
            confirmClear
              ? "border-red-400/50 bg-red-400/10 text-red-400"
              : "border-border text-muted-foreground/40 hover:border-red-400/30 hover:text-red-400"
          }`}
        >
          <TrashIcon />
          {confirmClear ? "Confirm clear all?" : "Clear all"}
        </button>
      </div>

      {/* Provider filter chips */}
      {providers.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-muted-foreground/40">
            <FilterIcon />
          </span>
          <button
            onClick={() => setFilterProvider("all")}
            className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
              filterProvider === "all"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            All ({records.length})
          </button>
          {providers.map((pid) => {
            const count = records.filter((r) => r.providerId === pid).length
            const name = records.find((r) => r.providerId === pid)?.providerName ?? pid
            return (
              <button
                key={pid}
                onClick={() => setFilterProvider(pid)}
                className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                  filterProvider === pid
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {name} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Records list */}
      <div className="rounded-xl border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-[11px] text-muted-foreground">
            No records for this provider.
          </p>
        ) : (
          filtered.map((r) => (
            <RecordRow
              key={r.id}
              record={r}
              onDelete={handleDelete}
              onCopyKey={handleCopyKey}
            />
          ))
        )}
      </div>

      <p className="text-[9px] text-muted-foreground/40 text-center">
        Stored locally in browser. Keys are never sent to any server.
      </p>
    </div>
  )
}
