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

// Build a ready-to-run curl command — key is masked in the output
function buildCurlCommand(record: WorkingKeyRecord): string {
  const endpoint = resolveProviderEndpoint(record.providerId, record.apiKey)
  if (!endpoint) return `# endpoint requires extra config\n# Provider: ${record.providerName}`

  const headers = buildProviderHeaders(record.providerId, record.apiKey)
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
      const masked =
        typeof v === "string" && v.includes(record.apiKey)
          ? v.replace(record.apiKey, "YOUR_API_KEY")
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden
      className={`transition-transform ${open ? "" : "-rotate-90"}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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

// ── Grouped key card — one card per provider+key, models listed inside ────────

interface GroupedRecord {
  groupKey: string          // providerId + ":" + apiKey (for dedup)
  providerId: string
  providerName: string
  apiKey: string
  records: WorkingKeyRecord[]
}

function GroupedKeyCard({
  group,
  onDeleteRecord,
  onLocked,
}: {
  group: GroupedRecord
  onDeleteRecord: (id: string) => void
  onLocked?: () => void
}) {
  const [open, setOpen]             = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState<string | null>(null)
  const [locking, setLocking]       = useState(false)
  const [lockStatus, setLockStatus] = useState<"idle" | "ok" | "error">("idle")
  const [lockError, setLockError]   = useState("")

  // Use the first/best record for lock/curl operations
  const primary = group.records[0]

  const handleLock = useCallback(async () => {
    setLocking(true)
    setLockStatus("idle")
    const result = await lockKeyToDb(primary)
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
  }, [primary, onLocked])

  const handleCopyCurl = useCallback((record: WorkingKeyRecord) => {
    const cmd = buildCurlCommand(record)
    copyToClipboard(cmd).then(() => {
      setCopiedCurl(record.id)
      setTimeout(() => setCopiedCurl(null), 2000)
    }).catch(() => {})
  }, [])

  const handleDeleteGroup = useCallback(() => {
    if (!confirmDel) {
      setConfirmDel(true)
      setTimeout(() => setConfirmDel(false), 2500)
      return
    }
    group.records.forEach((r) => onDeleteRecord(r.id))
  }, [confirmDel, group.records, onDeleteRecord])

  // Key fingerprint — just last 4 chars, not enough to reconstruct
  const fingerprint = "••••" + primary.apiKey.slice(-4)

  const earliest = group.records.reduce((a, b) => (a.savedAt < b.savedAt ? a : b))
  const date = new Date(earliest.savedAt)
  const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" })

  const avgLatency = Math.round(group.records.reduce((s, r) => s + r.latencyMs, 0) / group.records.length)

  return (
    <div className="border-b border-border last:border-0 flex flex-col">
      {/* Card header row */}
      <div
        className="px-3 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-secondary/20 transition-colors select-none"
        onClick={() => setOpen((v) => !v)}
      >
        {/* Status dot */}
        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-400" />

        {/* Provider + summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] uppercase tracking-widest font-semibold text-primary/70 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
              {group.providerName}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/40">{fingerprint}</span>
            <span className="text-[9px] text-muted-foreground/30">{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-foreground/80 font-medium">
              {group.records.length} model{group.records.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[9px] text-muted-foreground/40 font-mono">avg {avgLatency}ms</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Lock to DB */}
          <button
            onClick={handleLock}
            disabled={locking || lockStatus === "ok"}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md border text-[9px] transition-all disabled:opacity-60 ${
              lockStatus === "ok"
                ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-400"
                : lockStatus === "error"
                ? "border-red-400/50 bg-red-400/10 text-red-400"
                : "border-border text-muted-foreground/40 hover:border-cyan-400/30 hover:text-cyan-400 hover:bg-cyan-400/5"
            }`}
            title={lockStatus === "ok" ? "Locked" : lockStatus === "error" ? lockError : "Lock to DB"}
          >
            <LockIcon locked={lockStatus === "ok"} />
            {locking ? "..." : lockStatus === "ok" ? "Locked" : lockStatus === "error" ? "Failed" : null}
          </button>

          {/* Delete group */}
          <button
            onClick={handleDeleteGroup}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md border text-[9px] transition-all ${
              confirmDel
                ? "border-red-400/50 bg-red-400/10 text-red-400"
                : "border-border text-muted-foreground/40 hover:border-red-400/30 hover:text-red-400 hover:bg-red-400/5"
            }`}
            title={confirmDel ? "Tap again to confirm" : "Delete all"}
          >
            <TrashIcon />
            {confirmDel ? "Sure?" : null}
          </button>

          {/* Expand chevron */}
          <span className="text-muted-foreground/40 px-1">
            <ChevronIcon open={open} />
          </span>
        </div>
      </div>

      {/* Expanded model list */}
      {open && (
        <div className="border-t border-border/50 bg-secondary/10 flex flex-col">
          {group.records.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 px-4 py-2 border-b border-border/30 last:border-0 hover:bg-secondary/20 transition-colors"
            >
              {/* Model ID */}
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-[11px] font-mono text-foreground/80 truncate">{r.modelId}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-muted-foreground/40 font-mono">{r.latencyMs}ms</span>
                  {r.tokenUsage?.total !== undefined && (
                    <span className="text-[9px] text-muted-foreground/40 font-mono">{r.tokenUsage.total} tok</span>
                  )}
                </div>
              </div>

              {/* Copy cURL */}
              <button
                onClick={() => handleCopyCurl(r)}
                className={`flex items-center gap-1 text-[9px] px-2 py-1 rounded border transition-colors flex-shrink-0 ${
                  copiedCurl === r.id
                    ? "border-green-500/40 bg-green-500/10 text-green-400"
                    : "border-border text-muted-foreground/40 hover:text-foreground hover:border-primary/40"
                }`}
                title="Copy cURL (key is masked)"
              >
                <TerminalIcon />
                {copiedCurl === r.id ? "Copied!" : "cURL"}
              </button>

              {/* Delete single */}
              <button
                onClick={() => onDeleteRecord(r.id)}
                className="flex-shrink-0 text-muted-foreground/30 hover:text-red-400 transition-colors p-1"
                title="Remove"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
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
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleRunNow() }}
            disabled={running}
            className="flex items-center gap-1 text-[9px] px-2 py-1 rounded border border-border text-muted-foreground/50 hover:text-cyan-400 hover:border-cyan-400/40 transition-colors disabled:opacity-40"
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
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${row.isWorking ? "bg-green-400" : "bg-red-400"}`} />
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
                      <div className="text-[8px] text-muted-foreground/30 mt-0.5">
                        Locked {lockedDate.toLocaleDateString()} · Next refresh {nextRefresh.toLocaleString()}
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
  onUseKey?: (key: string, providerId: string) => void
  refreshTick?: number
  /** Called after a successful gateway sync so the parent can refresh Miuclaw model list */
  onGatewaySync?: () => void
}

export default function WorkingKeysPanel({ onUseKey: _onUseKey, refreshTick, onGatewaySync }: Props) {
  const [records, setRecords]               = useState<WorkingKeyRecord[]>([])
  const [filterProvider, setFilterProvider] = useState<string>("all")
  const [filterCap, setFilterCap]           = useState<CapabilityTag | "all">("all")
  const [confirmClear, setConfirmClear]     = useState(false)
  const [lockedTick, setLockedTick]         = useState(0)
  const [sessionToken, setSessionToken]     = useState<string | null>(null)

  const sessionKeys: WorkingKeyForSession[] = records.map((r) => ({
    providerId:   r.providerId,
    providerName: r.providerName,
    modelId:      r.modelId,
    apiKeyMasked: "••••" + r.apiKey.slice(-4),
    isWorking:    true,
    latencyMs:    r.latencyMs,
  }))

  const reload = useCallback(() => {
    setRecords(loadWorkingKeys().sort((a, b) => b.savedAt - a.savedAt))
  }, [])

  useEffect(() => { reload() }, [reload, refreshTick])

  const handleDelete = useCallback((id: string) => {
    const updated = deleteWorkingKey(id)
    setRecords(updated.sort((a, b) => b.savedAt - a.savedAt))
  }, [])

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

  const providers = Array.from(new Set(records.map((r) => r.providerId))).sort()

  const filtered = records.filter((r) => {
    if (filterProvider !== "all" && r.providerId !== filterProvider) return false
    if (filterCap !== "all") {
      const caps = inferCapabilities(r.modelId)
      if (!caps.includes(filterCap)) return false
    }
    return true
  })

  // Group filtered records by providerId + apiKey
  const grouped: GroupedRecord[] = []
  const groupMap = new Map<string, GroupedRecord>()
  for (const r of filtered) {
    const gk = r.providerId + ":" + r.apiKey
    if (!groupMap.has(gk)) {
      const g: GroupedRecord = {
        groupKey: gk,
        providerId: r.providerId,
        providerName: r.providerName,
        apiKey: r.apiKey,
        records: [],
      }
      groupMap.set(gk, g)
      grouped.push(g)
    }
    groupMap.get(gk)!.records.push(r)
  }

  const okCount = records.length

  if (records.length === 0) {
    return (
      <div className="flex flex-col gap-3 px-3 sm:px-4 py-3">
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
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
        <ExportApiPanel keys={[]} onSynced={onGatewaySync} />
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

      {/* Grouped records list */}
      <div className="rounded-xl border border-border overflow-hidden">
        {grouped.length === 0 ? (
          <p className="px-4 py-6 text-center text-[11px] text-muted-foreground">
            No records for this filter.
          </p>
        ) : (
          grouped.map((g) => (
            <GroupedKeyCard
              key={g.groupKey}
              group={g}
              onDeleteRecord={handleDelete}
              onLocked={() => setLockedTick((t) => t + 1)}
            />
          ))
        )}
      </div>

      <p className="text-[9px] text-muted-foreground/40 text-center">
        Stored locally in your browser. Keys are never sent to our servers.
      </p>

      <LockedKeysSection refreshTick={lockedTick} />

      <UserSessionPanel
        pendingKeys={sessionToken ? sessionKeys : undefined}
        onSessionToken={setSessionToken}
      />

      <ExportApiPanel keys={records} onSynced={onGatewaySync} />
    </div>
  )
}
