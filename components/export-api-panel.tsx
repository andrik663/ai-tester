"use client"

import { useState, useCallback } from "react"
import { copyToClipboard } from "@/lib/clipboard"
import { type WorkingKeyRecord } from "@/lib/working-keys-store"

interface Props {
  keys: WorkingKeyRecord[]
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function SyncIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 ${spinning ? "animate-spin" : ""}`} aria-hidden>
      <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  )
}

function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
    </svg>
  )
}

const STORAGE_TOKEN_KEY = "export_api_token_v1"

function loadToken(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(STORAGE_TOKEN_KEY) ?? ""
}

function saveToken(t: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_TOKEN_KEY, t)
}

export default function ExportApiPanel({ keys }: Props) {
  const [token, setToken] = useState<string>(loadToken)
  const [showToken, setShowToken] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    ok: boolean
    synced?: number
    error?: string
    at?: number
  } | null>(null)
  const [copiedCurl, setCopiedCurl] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)

  const handleTokenChange = useCallback((val: string) => {
    setToken(val)
    saveToken(val)
    setSyncResult(null)
  }, [])

  const handleSync = useCallback(async () => {
    if (!token.trim() || syncing) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch("/api/export/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), keys }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSyncResult({ ok: false, error: data.error ?? "Server error" })
      } else {
        setSyncResult({ ok: true, synced: data.synced, at: Date.now() })
      }
    } catch {
      setSyncResult({ ok: false, error: "Network error — check connection" })
    } finally {
      setSyncing(false)
    }
  }, [token, keys, syncing])

  // Build the cURL example for the SBG side
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"
  const curlExample = `curl -X GET '${origin}/api/export/working-keys' \\\n  -H 'Authorization: Bearer ${token.trim() || "<YOUR_TOKEN>"}'`

  const handleCopyCurl = useCallback(() => {
    copyToClipboard(curlExample).then(() => {
      setCopiedCurl(true)
      setTimeout(() => setCopiedCurl(false), 2000)
    }).catch(() => {})
  }, [curlExample])

  const handleCopyToken = useCallback(() => {
    copyToClipboard(token).then(() => {
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 1500)
    }).catch(() => {})
  }, [token])

  const endpointUrl = `${origin}/api/export/working-keys`

  return (
    <div className="flex flex-col gap-4 p-4 border-t border-border">
      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Export API
        </h3>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          External services (SBG) can fetch working keys via a secure REST endpoint. Only masked keys are returned.
        </p>
      </div>

      {/* Token input */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium text-muted-foreground" htmlFor="export-token">
            Secret Token
          </label>
          {token && (
            <button
              onClick={handleCopyToken}
              className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {copiedToken ? <><CheckIcon /><span className="text-green-400">Copied</span></> : <><CopyIcon />Copy</>}
            </button>
          )}
        </div>
        <div className="relative">
          <input
            id="export-token"
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(e) => handleTokenChange(e.target.value)}
            placeholder="Paste EXPORT_API_TOKEN value"
            className="w-full rounded-md border border-border bg-background text-foreground text-[11px] font-mono px-2.5 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
            autoComplete="off"
          />
          <button
            onClick={() => setShowToken((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            title={showToken ? "Hide token" : "Show token"}
            type="button"
          >
            <EyeIcon show={showToken} />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/50 leading-relaxed">
          Set <span className="font-mono text-muted-foreground">EXPORT_API_TOKEN</span> in Vercel Vars to the same value.
        </p>
      </div>

      {/* Endpoint display */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-medium text-muted-foreground">Endpoint</label>
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-secondary/30">
          <span className="text-[9px] font-mono text-primary/70 flex-shrink-0">GET</span>
          <span className="text-[9px] font-mono text-muted-foreground truncate flex-1">{endpointUrl}</span>
        </div>
      </div>

      {/* Sync button */}
      <button
        onClick={handleSync}
        disabled={!token.trim() || syncing || keys.length === 0}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-primary/10 border border-primary/25 hover:bg-primary/18 hover:border-primary/40 text-[11px] font-semibold text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <SyncIcon spinning={syncing} />
        {syncing ? "Syncing..." : `Sync ${keys.length} key${keys.length !== 1 ? "s" : ""} to server`}
      </button>

      {/* Sync result */}
      {syncResult && (
        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-[10px] ${
          syncResult.ok
            ? "border-green-500/25 bg-green-500/8 text-green-400"
            : "border-red-500/25 bg-red-500/8 text-red-400"
        }`}>
          {syncResult.ok ? <CheckIcon /> : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0 mt-0.5" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
          <span>
            {syncResult.ok
              ? `Synced ${syncResult.synced} keys. SBG can now fetch fresh data.`
              : syncResult.error}
          </span>
        </div>
      )}

      {/* cURL example for SBG */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium text-muted-foreground">SBG cURL Example</label>
          <button
            onClick={handleCopyCurl}
            className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border transition-colors ${
              copiedCurl
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
            }`}
          >
            {copiedCurl ? <><CheckIcon /><span>Copied</span></> : <><CopyIcon /><span>Copy</span></>}
          </button>
        </div>
        <pre className="text-[9px] font-mono bg-card/60 border border-border/60 rounded-md p-2.5 text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
          {curlExample}
        </pre>
      </div>

      {/* Filter docs */}
      <div className="flex flex-col gap-1 rounded-md border border-border/40 bg-secondary/20 px-3 py-2.5">
        <p className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1">Query Filters</p>
        {[
          ["?provider=mistral", "Filter by provider ID"],
          ["?max_latency=1000", "Max latency (ms)"],
          ["?since=1719000000000", "Only keys saved after (unix ms)"],
          ["?limit=50", "Max records (default 500)"],
        ].map(([param, desc]) => (
          <div key={param} className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-primary/70 flex-shrink-0">{param}</span>
            <span className="text-[9px] text-muted-foreground/60">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
