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
import ExportApiPanel from "@/components/export-api-panel"
import UserSessionPanel, { type WorkingKeyForSession } from "@/components/user-session-panel"
import { inferCapabilities, type CapabilityTag } from "@/lib/model-screener"

// ── Types for locked keys (DB-backed) ────────────────────────────────────────

interface LockedKeyRecord {
  id: string
  providerId: string
  providerName: string
  modelId: string
  apiKeyMasked: string
  isWorking: boolean
  latencyMs: number | null
  lastTestedAt: string | null
  lockedAt: string
  nextRefreshAt: string
  refreshIntervalHours: number
  lastError: string | null
}

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

function LockIcon({ locked }: { locked?: boolean }) {
  return locked ? (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="1" fill="currentColor" />
    </svg>
  ) : (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 7V5a3 3 0 016 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="1" fill="currentColor" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M13.5 8A5.5 5.5 0 112.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2.5 2v3.5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DatabaseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <ellipse cx="8" cy="4" rx="6" ry="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 4v4c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 8v4c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

// ── Masked key display ────────────────────────────────────────────────────────

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••"
  return key.slice(0, 4) + "••••" + key.slice(-4)
}

// ── Shared: read EXPORT_API_TOKEN from same localStorage key as ExportApiPanel ─
const EXPORT_TOKEN_STORAGE_KEY = "export_api_token_v1"
function getExportToken(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(EXPORT_TOKEN_STORAGE_KEY) ?? ""
}

// ── Lock a key to DB via API ──────────────────────────────────────────────────

async function lockKeyToDb(
  record: WorkingKeyRecord,
  refreshIntervalHours = 24,
): Promise<{ success: boolean; error?: string }> {
  const token = getExportToken()
  if (!token) return { success: false, error: "Set your EXPORT_API_TOKEN in the Export panel first" }
  try {
    const res = await fetch("/api/locked-keys/lock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        providerId:   record.providerId,
        providerName: record.providerName,
        modelId:      record.modelId,
        apiKey:       record.apiKey,
        latencyMs:    record.latencyMs,
        refreshIntervalHours,
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      return { success: false, error: d.error ?? `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Single record row ─────────────────────────────────────────────────────────

function RecordRow({
  record,
  onDelete,
  onCopyKey,
  onLocked,
}: {
  record: WorkingKeyRecord
  onDelete: (id: string) => void
  onCopyKey: (key: string) => void
  onLocked?: () => void
}) {
  const [copiedKey, setCopiedKey]     = useState(false)
  const [copiedModel, setCopiedModel] = useState(false)
  const [copiedCurl, setCopiedCurl]   = useState(false)
  const [confirmDel, setConfirmDel]   = useState(false)
  const [locking, setLocking]         = useState(false)
  const [lockStatus, setLockStatus]   = useState<"idle" | "ok" | "error">("idle")
  const [lockError, setLockError]     = useState<string>("")

  const handleLock = useCallback(async () => {
    setLocking(true)
    setLockStatus("idle")
    const result = await lockKeyToDb(record)
    setLocking(false)
    if (result.success) {
      setLockStatus("ok")
      onLocked?.()
      setTimeout(() => setLockStatus("idle"), 3000)
    } else {
      setLockStatus("error")
      setLockError(result.error ?? "Unknown error")
      setTimeout(() => { setLockStatus("idle"); setLockError("") }, 4000)
    }
  }, [record, onLocked])

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

        {/* Lock button */}
        <button
          onClick={handleLock}
          disabled={locking || lockStatus === "ok"}
          className={`flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-md border text-[9px] transition-all disabled:opacity-60 ${
            lockStatus === "ok"
              ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-400"
              : lockStatus === "error"
              ? "border-red-400/50 bg-red-400/10 text-red-400"
              : "border-border text-muted-foreground/40 hover:border-cyan-400/30 hover:text-cyan-400 hover:bg-cyan-400/5"
          }`}
          title={lockStatus === "ok" ? "Locked to DB" : lockStatus === "error" ? lockError : "Lock key permanently to DB (auto-refreshes every 24h)"}
        >
          <LockIcon locked={lockStatus === "ok"} />
          {locking ? <span>...</span> : lockStatus === "ok" ? <span>Locked</span> : lockStatus === "error" ? <span>Failed</span> : null}
        </button>

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

// ── Locked keys section (DB-backed, auto-refresh) ────────────────────────────

function LockedKeysSection({ refreshTick }: { refreshTick?: number }) {
  const [locked, setLocked]       = useState<LockedKeyRecord[]>([])
  const [loading, setLoading]     = useState(false)
  const [running, setRunning]     = useState(false)
  const [runResult, setRunResult] = useState<{ tested: number; changed: number } | null>(null)
  const [open, setOpen]           = useState(true)
  const [noToken, setNoToken]     = useState(false)

  const load = useCallback(async () => {
    const token = getExportToken()
    // Skip the fetch entirely if no token is configured — avoids a guaranteed 401
    if (!token) {
      setNoToken(true)
      return
    }
    setNoToken(false)
    setLoading(true)
    try {
      const res = await fetch("/api/locked-keys/list", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const d = await res.json()
        setLocked(d.keys ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshTick])

  const handleUnlock = useCallback(async (id: string) => {
    const token = getExportToken()
    if (!token) return
    await fetch(`/api/locked-keys/unlock?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    setLocked((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const handleRunNow = useCallback(async () => {
    const token = getExportToken()
    if (!token) return
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch("/api/locked-keys/refresh?force=true", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const d = await res.json()
        setRunResult({ tested: d.tested, changed: d.changed })
        await load()
      }
    } finally {
      setRunning(false)
    }
  }, [load])

  // No token configured — show a small hint rather than nothing
  if (noToken) {
    return (
      <p className="text-[9px] text-muted-foreground/40 px-1 py-1">
        Set your EXPORT_API_TOKEN in the Export panel to view locked keys.
      </p>
    )
  }

  if (locked.length === 0 && !loading) return null

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <DatabaseIcon />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Locked Keys
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
            {locked.length} permanent
          </span>
          <span className="text-[9px] text-muted-foreground/50">
            · auto-refreshes every 24h
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleRunNow() }}
            disabled={running}
            className="flex items-center gap-1 text-[9px] px-2 py-1 rounded border border-border text-muted-foreground/50 hover:text-cyan-400 hover:border-cyan-400/40 transition-colors disabled:opacity-40"
            title="Re-test all locked keys now"
          >
            <RefreshIcon />
            {running ? "Testing..." : "Run now"}
          </button>
          <span className={`text-muted-foreground/40 transition-transform ${open ? "" : "rotate-180"}`}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </button>

      {runResult && (
        <div className="text-[9px] px-2 py-1 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
          Refreshed {runResult.tested} keys — {runResult.changed} changed status
        </div>
      )}

      {open && (
        <div className="rounded-xl border border-border overflow-hidden">
          {loading ? (
            <p className="px-4 py-4 text-center text-[10px] text-muted-foreground/50">Loading...</p>
          ) : (
            locked.map((row) => {
              const nextRefresh = new Date(row.nextRefreshAt)
              const lockedDate  = new Date(row.lockedAt)
              return (
                <div key={row.id} className="border-b border-border last:border-0 px-3 py-2.5 flex flex-col gap-1.5 hover:bg-secondary/20 transition-colors">
                  <div className="flex items-start gap-2">
                    <span
                      className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${row.isWorking ? "bg-green-400" : "bg-red-400"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] uppercase tracking-widest font-semibold text-cyan-400/80 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded">
                          {row.providerName}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${row.isWorking ? "text-green-400 border-green-400/20 bg-green-400/10" : "text-red-400 border-red-400/20 bg-red-400/10"}`}>
                          {row.isWorking ? "working" : "failed"}
                        </span>
                        {row.latencyMs && (
                          <span className="text-[9px] font-mono text-muted-foreground/50">{row.latencyMs}ms</span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-foreground/80 mt-0.5 truncate">{row.modelId}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[9px] font-mono text-muted-foreground/40">{row.apiKeyMasked}</span>
                        <span className="text-[8px] text-muted-foreground/30">
                          Locked {lockedDate.toLocaleDateString()} · Next refresh {nextRefresh.toLocaleString()}
                        </span>
                      </div>
                      {!row.isWorking && row.lastError && (
                        <div className="text-[8px] text-red-400/70 mt-0.5 truncate" title={row.lastError}>
                          {row.lastError}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleUnlock(row.id)}
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-md border border-border text-[9px] text-muted-foreground/40 hover:border-red-400/30 hover:text-red-400 transition-colors"
                      title="Remove lock (does not delete the key from localStorage)"
                    >
                      <LockIcon locked={false} />
                      Unlock
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
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
  const [filterCap, setFilterCap]     = useState<CapabilityTag | "all">("all")
  const [confirmClear, setConfirmClear] = useState(false)
  const [lockedTick, setLockedTick]   = useState(0)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  // Derive session-ready keys from current working key records
  const sessionKeys: WorkingKeyForSession[] = records.map((r) => ({
    providerId:   r.providerId,
    providerName: r.providerName,
    modelId:      r.modelId,
    apiKeyMasked: r.apiKey.slice(0, 12) + "••••••",
    isWorking:    true,
    latencyMs:    r.latencyMs,
  }))

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

  const filtered = records.filter((r) => {
    if (filterProvider !== "all" && r.providerId !== filterProvider) return false
    if (filterCap !== "all") {
      const caps = inferCapabilities(r.modelId)
      if (!caps.includes(filterCap)) return false
    }
    return true
  })

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

      {/* Capability filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-muted-foreground/40">
          <FilterIcon />
        </span>
        {(["all", "flagship", "coding", "text", "image", "video"] as const).map((cap) => {
          const CAP_COLORS: Record<string, string> = {
            flagship: "border-primary/50 bg-primary/10 text-primary",
            coding:   "border-violet-400/50 bg-violet-400/10 text-violet-400",
            text:     "border-sky-400/50 bg-sky-400/10 text-sky-400",
            image:    "border-amber-400/50 bg-amber-400/10 text-amber-400",
            video:    "border-rose-400/50 bg-rose-400/10 text-rose-400",
          }
          const CAP_LABELS: Record<string, string> = {
            all: "All", flagship: "Flagship", coding: "Coding", text: "Text", image: "Image", video: "Video",
          }
          const count = cap === "all" ? records.length : records.filter((r) => inferCapabilities(r.modelId).includes(cap as CapabilityTag)).length
          if (cap !== "all" && count === 0) return null
          return (
            <button
              key={cap}
              onClick={() => setFilterCap(cap as CapabilityTag | "all")}
              className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                filterCap === cap
                  ? (CAP_COLORS[cap] ?? "border-primary/50 bg-primary/10 text-primary")
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {CAP_LABELS[cap]} ({count})
            </button>
          )
        })}
      </div>

      {/* Provider filter chips */}
      {providers.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterProvider("all")}
            className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
              filterProvider === "all"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            All providers ({records.length})
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
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-400"
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
              onLocked={() => setLockedTick((t) => t + 1)}
            />
          ))
        )}
      </div>

      <p className="text-[9px] text-muted-foreground/40 text-center">
        Stored locally in browser. Raw keys are never exposed via the API.
      </p>

      {/* Locked keys section — DB-backed, auto-refreshes every 24h (developer) */}
      <LockedKeysSection refreshTick={lockedTick} />

      {/* User temporary session — public users, TTL-based access */}
      <UserSessionPanel
        pendingKeys={sessionToken ? sessionKeys : undefined}
        onSessionToken={setSessionToken}
      />

      {/* Export API section */}
      <ExportApiPanel keys={records} />
    </div>
  )
}
