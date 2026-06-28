"use client"

import { useState, useCallback, useEffect } from "react"
import { type WorkingKeyRecord } from "@/lib/working-keys-store"

const CHUNK_SIZE = 8 // keys per request — keeps payloads small and avoids timeouts

interface Props {
  keys: WorkingKeyRecord[]
  onSynced?: () => void
}

interface SyncResult {
  ok: boolean
  totalSynced?: number
  totalModels?: number
  totalProviders?: number
  totalInDb?: number
  error?: string
}

interface Progress {
  chunk: number
  total: number
  phase: "preparing" | "uploading" | "pruning" | "done"
}

// ── Icons ────────────────────────────────────────────────────────────────────

function SyncIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={`w-3.5 h-3.5 flex-shrink-0 ${spinning ? "animate-spin" : ""}`}
      aria-hidden
    >
      <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type GatewayKeyPayload = {
  providerId: string
  providerName: string
  apiKey: string
  modelIds: string[]
  avgLatencyMs: number
  pushedAt: number
}

function groupKeys(records: WorkingKeyRecord[]): GatewayKeyPayload[] {
  const grouped = new Map<string, {
    providerId: string; providerName: string; apiKey: string
    modelIds: string[]; latencies: number[]
  }>()
  for (const rec of records) {
    const key = `${rec.providerId}::${rec.apiKey}`
    const ex = grouped.get(key)
    if (ex) {
      if (!ex.modelIds.includes(rec.modelId)) {
        ex.modelIds.push(rec.modelId)
        ex.latencies.push(rec.latencyMs)
      }
    } else {
      grouped.set(key, {
        providerId: rec.providerId,
        providerName: rec.providerName,
        apiKey: rec.apiKey,
        modelIds: [rec.modelId],
        latencies: [rec.latencyMs],
      })
    }
  }
  return Array.from(grouped.values()).map((g) => ({
    providerId: g.providerId,
    providerName: g.providerName,
    apiKey: g.apiKey,
    modelIds: g.modelIds,
    avgLatencyMs: g.latencies.reduce((a, b) => a + b, 0) / g.latencies.length,
    pushedAt: Date.now(),
  }))
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ExportApiPanel({ keys, onSynced }: Props) {
  const [syncing, setSyncing]   = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [result, setResult]     = useState<SyncResult | null>(null)
  const [gatewayStats, setGatewayStats] = useState<{ keys: number; providers: number } | null>(null)

  const refreshGatewayStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/models")
      if (!res.ok) return
      const data = await res.json() as { data?: Array<{ id: string; owned_by?: string }> }
      const models = (data.data ?? []).filter((m: { id: string }) => m.id !== "miuclaw/auto")
      const providerSet = new Set(models.map((m: { owned_by?: string }) => m.owned_by ?? "unknown"))
      setGatewayStats({ keys: models.length, providers: providerSet.size })
    } catch { /* silently ignore */ }
  }, [])

  useEffect(() => { refreshGatewayStats() }, [refreshGatewayStats])

  const handleSync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    setResult(null)
    setProgress({ chunk: 0, total: 0, phase: "preparing" })

    // ── Phase 1: group & deduplicate ─────────────────────────────────────────
    let grouped: GatewayKeyPayload[]
    try {
      grouped = groupKeys(keys)
    } catch (err) {
      setResult({ ok: false, error: `Failed to prepare keys: ${err instanceof Error ? err.message : String(err)}` })
      setSyncing(false)
      setProgress(null)
      return
    }

    if (grouped.length === 0) {
      setResult({ ok: false, error: "No local keys to sync — run a batch test first, then sync." })
      setSyncing(false)
      setProgress(null)
      return
    }

    // ── Phase 2: chunked upload ──────────────────────────────────────────────
    const chunks       = chunk(grouped, CHUNK_SIZE)
    const totalChunks  = chunks.length
    const allApiKeys   = grouped.map((k) => k.apiKey)
    let totalSynced    = 0
    let totalModels    = 0
    let totalProviders = 0
    let totalInDb      = 0

    setProgress({ chunk: 0, total: totalChunks, phase: "uploading" })

    try {
      for (let i = 0; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1
        const body = {
          keys:        chunks[i],
          chunkIndex:  i,
          totalChunks,
          ...(isLast ? { allApiKeys } : {}),
        }

        const res = await fetch("/api/v1/gateway/push", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(body),
        })

        let data: {
          ok?: boolean; synced?: number; providers?: number
          models?: number; totalInDb?: number; error?: string
        }
        try {
          data = await res.json()
        } catch {
          throw new Error(`Chunk ${i + 1}/${totalChunks}: server returned non-JSON (status ${res.status})`)
        }

        if (!res.ok || !data.ok) {
          throw new Error(`Chunk ${i + 1}/${totalChunks}: ${data.error ?? `server error ${res.status}`}`)
        }

        totalSynced    += data.synced    ?? 0
        totalModels    += data.models    ?? 0
        totalProviders  = Math.max(totalProviders, data.providers ?? 0)
        if (isLast) totalInDb = data.totalInDb ?? 0

        setProgress({ chunk: i + 1, total: totalChunks, phase: isLast ? "pruning" : "uploading" })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setResult({ ok: false, error: msg })
      setSyncing(false)
      setProgress(null)
      return
    }

    // ── Done ─────────────────────────────────────────────────────────────────
    setProgress({ chunk: totalChunks, total: totalChunks, phase: "done" })
    setResult({ ok: true, totalSynced, totalModels, totalProviders, totalInDb })
    onSynced?.()
    await refreshGatewayStats()
    setSyncing(false)
  }, [keys, syncing, onSynced, refreshGatewayStats])

  const origin   = typeof window !== "undefined" ? window.location.origin : ""
  const endpoint = `${origin}/api/v1/chat/completions`
  const grouped  = typeof window !== "undefined" ? groupKeys(keys) : []

  // Progress percentage
  const progressPct = progress && progress.total > 0
    ? Math.round((progress.chunk / progress.total) * 100)
    : 0

  return (
    <div className="flex flex-col gap-4 p-4 border-t border-border">

      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Miuclaw Gateway
        </h3>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Push your working keys into the gateway. The{" "}
          <span className="font-mono text-primary/80">/api/v1/chat/completions</span>{" "}
          endpoint will automatically route requests to the best available provider.
        </p>
      </div>

      {/* Endpoint display */}
      <div className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-secondary/20">
        <span className="text-[9px] font-mono text-primary/70 flex-shrink-0">POST</span>
        <span className="text-[9px] font-mono text-muted-foreground truncate">{endpoint}</span>
      </div>

      {/* Sync button */}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-primary/10 border border-primary/25 hover:bg-primary/18 hover:border-primary/40 text-[11px] font-semibold text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <SyncIcon spinning={syncing} />
        {syncing
          ? progress?.phase === "preparing"
            ? "Preparing..."
            : progress?.phase === "pruning"
            ? "Finalizing..."
            : `Uploading chunk ${progress?.chunk ?? 0} / ${progress?.total ?? 0}...`
          : grouped.length > 0
            ? `Sync ${grouped.length} key${grouped.length !== 1 ? "s" : ""} to Gateway`
            : "Sync to Gateway"}
      </button>

      {/* Progress bar — visible only while syncing */}
      {syncing && progress && progress.total > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="w-full h-1.5 rounded-full bg-secondary/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">
              {progress.phase === "pruning"
                ? "Removing stale keys..."
                : `Chunk ${progress.chunk} of ${progress.total}`}
            </span>
            <span className="text-[9px] text-primary font-semibold">{progressPct}%</span>
          </div>
        </div>
      )}

      {/* Result */}
      {!syncing && result && (() => {
        const isWarning = !result.ok && result.error?.startsWith("No local keys")
        const colorClass = result.ok
          ? "border-green-500/25 bg-green-500/8 text-green-400"
          : isWarning
          ? "border-yellow-500/25 bg-yellow-500/8 text-yellow-400"
          : "border-red-500/25 bg-red-500/8 text-red-400"
        const icon = result.ok ? <CheckIcon /> : <XIcon />
        const message = result.ok
          ? `Synced ${result.totalSynced} key${(result.totalSynced ?? 0) !== 1 ? "s" : ""} — ${result.totalModels} models across ${result.totalProviders} providers. Gateway has ${result.totalInDb} keys ready.`
          : result.error
        return (
          <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-[10px] leading-relaxed ${colorClass}`}>
            {icon}
            <span>{message}</span>
          </div>
        )
      })()}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        {([
          ["Local Keys", String(grouped.length)],
          ["In Gateway", gatewayStats !== null ? String(gatewayStats.keys) : "—"],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md border border-border/40 bg-secondary/20">
            <span className="text-[14px] font-bold text-foreground">{value}</span>
            <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
