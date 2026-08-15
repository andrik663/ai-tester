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
import { inferCapabilities, loadScreenerResults, maskApiKey, type CapabilityTag, type ScreenerModelResult } from "@/lib/model-screener"

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
  screenerResults,
}: {
  group: GroupedRecord
  onDeleteRecord: (id: string) => void
  onLocked?: () => void
  screenerResults: ScreenerModelResult[]
}) {
  const [open, setOpen]             = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState<string | null>(null)
  const [locking, setLocking]       = useState(false)
  const [lockStatus, setLockStatus] = useState<"idle" | "ok" | "error">("idle")
  const [lockError, setLockError]   = useState("")

  // Use the first/best record for lock/curl operations
  const primary = group.records[0]

  // ── Screener status lookup ────────────────────────────────────────────────
  // Match by providerId + modelId + masked key so that two different keys for the
  // same provider/model each get their own independent screener status.
  // Falls back to providerId + modelId only when no key-specific result exists
  // (e.g. the key was never run through the screener).
  const getScreenerStatus = useCallback((record: WorkingKeyRecord): ScreenerModelResult | undefined => {
    const masked = maskApiKey(record.apiKey)
    // Prefer exact 3-field match first
    const exact = screenerResults.find(
      (s) =>
        s.providerId === record.providerId &&
        s.modelId    === record.modelId &&
        s.apiKeyMasked === masked,
    )
    if (exact) return exact
    // Fallback: same provider + model, any key (covers keys added before screener ran)
    return screenerResults.find(
      (s) => s.providerId === record.providerId && s.modelId === record.modelId,
    )
  }, [screenerResults])

  // Aggregate: how many of this group's models have screener data + are OFF
  const groupScreenerCounts = (() => {
    let on = 0, off = 0, unknown = 0
    for (const r of group.records) {
      const s = getScreenerStatus(r)
      if (!s) unknown++
      else if (s.isOn) on++
      else off++
    }
    return { on, off, unknown }
  })()

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
        {/* Status dot — red if all screened models are OFF, yellow if mixed, green otherwise */}
        <span className={`flex-shrink-0 w-2 h-2 rounded-full ${
          groupScreenerCounts.off > 0 && groupScreenerCounts.on === 0
            ? "bg-destructive"
            : groupScreenerCounts.off > 0
            ? "bg-yellow-400"
            : "bg-success"
        }`} />

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
            {/* Screener summary badges — only shown when screener data exists */}
            {(groupScreenerCounts.on > 0 || groupScreenerCounts.off > 0) && (
              <>
                {groupScreenerCounts.on > 0 && (
                  <span className="text-[8px] px-1 py-0.5 rounded border border-success/25 bg-success/10 text-success font-mono">
                    {groupScreenerCounts.on} ON
                  </span>
                )}
                {groupScreenerCounts.off > 0 && (
                  <span className="text-[8px] px-1 py-0.5 rounded border border-destructive/25 bg-destructive/10 text-destructive font-mono">
                    {groupScreenerCounts.off} OFF
                  </span>
                )}
              </>
            )}
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
                ? "border-destructive/50 bg-destructive/10 text-destructive"
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
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-border text-muted-foreground/40 hover:border-destructive/30 hover:text-destructive hover:bg-destructive/5"
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
          {group.records.map((r) => {
            const screenerStatus = getScreenerStatus(r)
            return (
            <div
              key={r.id}
              className="flex items-center gap-2 px-4 py-2 border-b border-border/30 last:border-0 hover:bg-secondary/20 transition-colors"
            >
              {/* Status dot from screener */}
              <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
                !screenerStatus ? "bg-muted-foreground/20" : screenerStatus.isOn ? "bg-success" : "bg-destructive"
              }`} />

              {/* Model ID */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono text-foreground/80 truncate">{r.modelId}</span>
                  {screenerStatus && (
                    <span className={`text-[8px] px-1 py-0.5 rounded border font-medium flex-shrink-0 ${
                      screenerStatus.isOn
                        ? "text-success border-success/25 bg-success/10"
                        : "text-destructive border-destructive/25 bg-destructive/10"
                    }`}>
                      {screenerStatus.isOn ? "ON" : "OFF"}
                    </span>
                  )}
                </div>
                {/* Capability tags row */}
                {(() => {
                  const caps = inferCapabilities(r.modelId).filter((c) => c !== "text")
                  const CAP_TAG_COLORS: Record<string, string> = {
                    flagship: "text-yellow-400/80 border-yellow-400/20 bg-yellow-400/5",
                    agent:    "text-success/80 border-success/20 bg-success/5",
                    coding:   "text-violet-400/80 border-violet-400/20 bg-violet-400/5",
                    document: "text-orange-400/80 border-orange-400/20 bg-orange-400/5",
                    image:    "text-amber-400/80 border-amber-400/20 bg-amber-400/5",
                    video:    "text-rose-400/80 border-rose-400/20 bg-rose-400/5",
                  }
                  const CAP_TAG_LABELS: Record<string, string> = {
                    flagship: "flagship", agent: "agent", coding: "code",
                    document: "doc", image: "image", video: "video",
                  }
                  if (caps.length === 0) return null
                  return (
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {caps.map((c) => (
                        <span key={c} className={`text-[7px] px-1 py-px rounded border font-medium uppercase tracking-wide ${CAP_TAG_COLORS[c] ?? "text-muted-foreground/50 border-border/50"}`}>
                          {CAP_TAG_LABELS[c] ?? c}
                        </span>
                      ))}
                    </div>
                  )
                })()}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-muted-foreground/40 font-mono">{r.latencyMs}ms</span>
                  {r.tokenUsage?.total !== undefined && (
                    <span className="text-[9px] text-muted-foreground/40 font-mono">{r.tokenUsage.total} tok</span>
                  )}
                  {screenerStatus && !screenerStatus.isOn && screenerStatus.error && (
                    <span className="text-[8px] text-destructive/70 truncate max-w-[140px]" title={screenerStatus.error}>
                      {screenerStatus.error}
                    </span>
                  )}
                </div>
              </div>

              {/* Copy cURL */}
              <button
                onClick={() => handleCopyCurl(r)}
                className={`flex items-center gap-1 text-[9px] px-2 py-1 rounded border transition-colors flex-shrink-0 ${
                  copiedCurl === r.id
                    ? "border-success/40 bg-success/10 text-success"
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
                className="flex-shrink-0 text-muted-foreground/30 hover:text-destructive transition-colors p-1"
                title="Remove"
              >
                <TrashIcon />
              </button>
            </div>
          )})}
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
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${row.isWorking ? "bg-success" : "bg-destructive"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] uppercase tracking-widest font-semibold text-cyan-400/80 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded">
                          {row.providerName}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${row.isWorking ? "text-success border-success/20 bg-success/10" : "text-destructive border-destructive/20 bg-destructive/10"}`}>
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
                        <div className="text-[8px] text-destructive/70 mt-0.5 truncate" title={row.lastError}>
                          {row.lastError}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleUnlock(row.id)}
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-md border border-border text-[9px] text-muted-foreground/40 hover:border-destructive/30 hover:text-destructive transition-colors"
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
  const [modelSearch, setModelSearch]       = useState<string>("")
  const [confirmClear, setConfirmClear]     = useState(false)
  const [lockedTick, setLockedTick]         = useState(0)
  const [sessionToken, setSessionToken]     = useState<string | null>(null)
  const [screenerResults, setScreenerResults] = useState<ScreenerModelResult[]>([])

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
    setScreenerResults(loadScreenerResults())
  }, [])

  useEffect(() => { reload() }, [reload, refreshTick])

  // Re-sync screener results whenever localStorage changes (e.g. after a scan in Screener tab)
  useEffect(() => {
    const handler = () => setScreenerResults(loadScreenerResults())
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }, [])

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
    if (modelSearch.trim()) {
      const q = modelSearch.toLowerCase()
      if (!r.modelId.toLowerCase().includes(q) && !r.providerName.toLowerCase().includes(q)) return false
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
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">
            {okCount} saved
          </span>
        </div>
        <button
          onClick={handleClearAll}
          className={`flex items-center gap-1 text-[9px] px-2 py-1 rounded border transition-all ${
            confirmClear
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : "border-border text-muted-foreground/40 hover:border-destructive/30 hover:text-destructive"
          }`}
        >
          <TrashIcon />
          {confirmClear ? "Confirm clear all?" : "Clear all"}
        </button>
      </div>

      {/* ── Capability filter tabs (Rank-style) ─────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
        {([
          { cap: "all",      label: "All",      icon: (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )},
          { cap: "agent",    label: "Agent",    icon: (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="2" y="4" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 7h2M9 7h2M5 10h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M6 4V2.5A.5.5 0 016.5 2h3a.5.5 0 01.5.5V4" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          )},
          { cap: "coding",   label: "Code",     icon: (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M5 5l-3 3 3 3M11 5l3 3-3 3M9 3l-2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )},
          { cap: "document", label: "Document", icon: (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="3" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 5h4M6 8h4M6 11h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          )},
          { cap: "text",     label: "Chat",     icon: (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H9l-3 2v-2H3a1 1 0 01-1-1V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          )},
          { cap: "image",    label: "Image",    icon: (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="5.5" cy="6" r="1.2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M1.5 11l3.5-3.5 3 3 2-2 3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )},
          { cap: "video",    label: "Video",    icon: (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="1" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 6l4-2v8l-4-2V6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          )},
          { cap: "flagship", label: "Flagship", icon: (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.4l-3.7 2.2.7-4.1-3-2.9 4.2-.9L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          )},
        ] as const).map(({ cap, label, icon }) => {
          const count = cap === "all"
            ? records.length
            : records.filter((r) => inferCapabilities(r.modelId).includes(cap as CapabilityTag)).length
          if (cap !== "all" && count === 0) return null

          const ACTIVE_COLORS: Record<string, string> = {
            all:      "border-primary/50 bg-primary/10 text-primary",
            agent:    "border-success/50 bg-success/10 text-success",
            coding:   "border-violet-400/50 bg-violet-400/10 text-violet-400",
            document: "border-orange-400/50 bg-orange-400/10 text-orange-400",
            text:     "border-sky-400/50 bg-sky-400/10 text-sky-400",
            image:    "border-amber-400/50 bg-amber-400/10 text-amber-400",
            video:    "border-rose-400/50 bg-rose-400/10 text-rose-400",
            flagship: "border-yellow-400/50 bg-yellow-400/10 text-yellow-400",
          }

          const isActive = filterCap === cap
          return (
            <button
              key={cap}
              onClick={() => setFilterCap(cap as CapabilityTag | "all")}
              className={`flex items-center gap-1.5 flex-shrink-0 text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
                isActive
                  ? (ACTIVE_COLORS[cap] ?? "border-primary/50 bg-primary/10 text-primary")
                  : "border-border/50 text-muted-foreground/50 hover:bg-secondary/60 hover:text-foreground/70 hover:border-border"
              }`}
            >
              <span className={isActive ? "" : "opacity-60"}>{icon}</span>
              {label}
              <span className={`text-[9px] font-mono ${isActive ? "opacity-90" : "opacity-40"}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Model search input ──────────────────────────────────────────── */}
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="text"
          value={modelSearch}
          onChange={(e) => setModelSearch(e.target.value)}
          placeholder={`Search ${filterCap === "all" ? "all" : filterCap} models...`}
          className="w-full pl-7 pr-3 py-1.5 text-[11px] rounded-lg border border-border/50 bg-secondary/30 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:bg-secondary/60 transition-colors"
        />
        {modelSearch && (
          <button
            onClick={() => setModelSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            aria-label="Clear search"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Provider filter chips ───────────────────────────────────────── */}
      {providers.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-muted-foreground/30">
            <FilterIcon />
          </span>
          <button
            onClick={() => setFilterProvider("all")}
            className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
              filterProvider === "all"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/50 text-muted-foreground/50 hover:bg-secondary"
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
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-400"
                    : "border-border/50 text-muted-foreground/50 hover:bg-secondary"
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
              screenerResults={screenerResults}
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
