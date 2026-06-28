"use client"

import { useState, useCallback } from "react"
import { type WorkingKeyRecord } from "@/lib/working-keys-store"

interface Props {
  keys: WorkingKeyRecord[]
  /** Called after a successful sync so the parent can refresh gateway-dependent state */
  onSynced?: () => void
}

function SyncIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-3.5 h-3.5 ${spinning ? "animate-spin" : ""}`}
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

interface SyncResult {
  ok: boolean
  synced?: number
  providers?: number
  models?: number
  error?: string
}

export default function ExportApiPanel({ keys, onSynced }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)

  const handleSync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    setResult(null)

    // ── Phase 1: group + deduplicate keys (client-side, no network) ──────────
    let gatewayKeys: Array<{
      providerId: string
      providerName: string
      apiKey: string
      modelIds: string[]
      avgLatencyMs: number
      pushedAt: number
    }>
    try {
      const grouped = new Map<string, {
        providerId: string
        providerName: string
        apiKey: string
        modelIds: string[]
        latencies: number[]
      }>()

      for (const rec of keys) {
        const mapKey = `${rec.providerId}::${rec.apiKey}`
        const existing = grouped.get(mapKey)
        if (existing) {
          if (!existing.modelIds.includes(rec.modelId)) {
            existing.modelIds.push(rec.modelId)
            existing.latencies.push(rec.latencyMs)
          }
        } else {
          grouped.set(mapKey, {
            providerId: rec.providerId,
            providerName: rec.providerName,
            apiKey: rec.apiKey,
            modelIds: [rec.modelId],
            latencies: [rec.latencyMs],
          })
        }
      }

      gatewayKeys = Array.from(grouped.values()).map((g) => ({
        providerId: g.providerId,
        providerName: g.providerName,
        apiKey: g.apiKey,
        modelIds: g.modelIds,
        avgLatencyMs: g.latencies.reduce((a, b) => a + b, 0) / g.latencies.length,
        pushedAt: Date.now(),
      }))
    } catch (err) {
      setResult({ ok: false, error: `Failed to prepare keys: ${err instanceof Error ? err.message : String(err)}` })
      setSyncing(false)
      return
    }

    // ── Phase 2: POST to gateway ─────────────────────────────────────────────
    try {
      const res = await fetch("/api/v1/gateway/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: gatewayKeys }),
      })

      let data: { ok?: boolean; synced?: number; providers?: number; models?: number; error?: string }
      try {
        data = await res.json()
      } catch {
        setResult({ ok: false, error: `Server returned non-JSON response (status ${res.status})` })
        return
      }

      if (!res.ok) {
        setResult({ ok: false, error: data.error ?? `Server error ${res.status}` })
      } else {
        setResult({ ok: true, synced: data.synced, providers: data.providers, models: data.models })
        // Notify parent so it can refresh gateway-dependent UI (e.g. Miuclaw model dropdown)
        onSynced?.()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Distinguish fetch/network failure from other runtime errors
      const isNetworkErr = msg.includes("fetch") || msg.includes("network") || msg.includes("Failed to fetch")
      setResult({ ok: false, error: isNetworkErr ? `Network error — ${msg}` : `Unexpected error — ${msg}` })
    } finally {
      setSyncing(false)
    }
  }, [keys, syncing, onSynced])

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const endpoint = `${origin}/api/v1/chat/completions`

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
          ? "Syncing..."
          : keys.length > 0
            ? `Sync ${keys.length} key${keys.length !== 1 ? "s" : ""} to Gateway`
            : "Sync to Gateway"}
      </button>

      {/* Result */}
      {result && (
        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-[10px] leading-relaxed ${
          result.ok
            ? "border-green-500/25 bg-green-500/8 text-green-400"
            : "border-red-500/25 bg-red-500/8 text-red-400"
        }`}>
          {result.ok ? <CheckIcon /> : <XIcon />}
          <span>
            {result.ok
              ? `Gateway ready — ${result.models} model${(result.models ?? 0) !== 1 ? "s" : ""} across ${result.providers} provider${(result.providers ?? 0) !== 1 ? "s" : ""} (${result.synced} keys)`
              : result.error}
          </span>
        </div>
      )}

      {/* Stats */}
      {keys.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Keys", String(keys.length)],
            ["Providers", String(new Set(keys.map((k) => k.providerId)).size)],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md border border-border/40 bg-secondary/20">
              <span className="text-[14px] font-bold text-foreground">{value}</span>
              <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
