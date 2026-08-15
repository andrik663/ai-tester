"use client"

import { useState, useEffect, useCallback, useRef } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionInfo {
  valid:            boolean
  sessionId?:       string
  expiresAt?:       string
  ttlMinutes?:      number
  batchRan?:        boolean
  batchRanAt?:      string | null
  workingKeysCount?: number
  remainingMs?:     number
  remainingMin?:    number
  reason?:          string
}

interface SessionResult {
  providerId:   string
  providerName: string
  modelId:      string
  apiKeyMasked: string
  latencyMs:    number | null
  testedAt:     string
}

export interface WorkingKeyForSession {
  providerId:   string
  providerName: string
  modelId:      string
  apiKeyMasked: string
  isWorking:    boolean
  latencyMs?:   number
}

interface Props {
  /** Working keys from batch run to save into the session */
  pendingKeys?: WorkingKeyForSession[]
  onSessionToken?: (token: string | null) => void
}

// ── Storage key ───────────────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = "ai_tester_user_session_v1"

function readToken(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(SESSION_STORAGE_KEY)
}
function writeToken(token: string) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(SESSION_STORAGE_KEY, token)
}
function clearToken() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(SESSION_STORAGE_KEY)
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.5V8l2.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="5.5" cy="7.5" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8.5 7.5H14M12 7.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Countdown timer ───────────────────────────────────────────────────────────

function useCountdown(expiresAt: string | undefined): string {
  const [label, setLabel] = useState("")

  useEffect(() => {
    if (!expiresAt) { setLabel(""); return }
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now()
      if (ms <= 0) { setLabel("Expired"); return }
      const m = Math.floor(ms / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setLabel(`${m}m ${String(s).padStart(2, "0")}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return label
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UserSessionPanel({ pendingKeys, onSessionToken }: Props) {
  const [token, setToken]           = useState<string | null>(null)
  const [session, setSession]       = useState<SessionInfo | null>(null)
  const [results, setResults]       = useState<SessionResult[]>([])
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [ttlInput, setTtlInput]     = useState(60)
  const [open, setOpen]             = useState(false)
  const [saveMsg, setSaveMsg]       = useState("")
  const savedRef                    = useRef(false)
  const countdown                   = useCountdown(session?.valid ? session.expiresAt : undefined)

  // Load token from sessionStorage on mount
  useEffect(() => {
    const stored = readToken()
    if (stored) {
      setToken(stored)
      onSessionToken?.(stored)
    }
  }, [onSessionToken])

  // Verify token whenever it changes
  const verify = useCallback(async (t: string) => {
    const res = await fetch(`/api/session/verify?token=${encodeURIComponent(t)}`)
    const data: SessionInfo = await res.json()
    setSession(data)
    if (!data.valid) {
      clearToken()
      setToken(null)
      setResults([])
      onSessionToken?.(null)
      savedRef.current = false
    }
    return data
  }, [onSessionToken])

  useEffect(() => {
    if (!token) return
    verify(token)
    const id = setInterval(() => verify(token), 30_000)
    return () => clearInterval(id)
  }, [token, verify])

  // Fetch results when session is valid + batch ran
  const fetchResults = useCallback(async (t: string) => {
    const res = await fetch(`/api/session/results?token=${encodeURIComponent(t)}`)
    if (res.ok) {
      const d = await res.json()
      setResults(d.results ?? [])
    }
  }, [])

  useEffect(() => {
    if (token && session?.valid && session.batchRan) {
      fetchResults(token)
    }
  }, [token, session?.valid, session?.batchRan, fetchResults])

  // Auto-save pending keys when they arrive (once per session)
  useEffect(() => {
    if (!token || !session?.valid || savedRef.current) return
    if (!pendingKeys || pendingKeys.length === 0) return
    if (session.batchRan) { savedRef.current = true; return }
    savedRef.current = true
    autoSave(token, pendingKeys)
  })

  const autoSave = useCallback(async (t: string, keys: WorkingKeyForSession[]) => {
    setSaving(true)
    setSaveMsg("")
    try {
      const res = await fetch("/api/session/save-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: t, results: keys }),
      })
      const d = await res.json()
      if (res.ok) {
        setSaveMsg(`${d.saved} working keys saved (expires in ${d.remainingMin}m)`)
        await verify(t)
        await fetchResults(t)
      } else {
        setSaveMsg(d.error ?? "Save failed")
      }
    } finally {
      setSaving(false)
    }
  }, [verify, fetchResults])

  const handleStart = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttlMinutes: ttlInput }),
      })
      const d = await res.json()
      if (res.ok) {
        writeToken(d.sessionToken)
        setToken(d.sessionToken)
        onSessionToken?.(d.sessionToken)
        setSession({
          valid:       true,
          expiresAt:   d.expiresAt,
          ttlMinutes:  d.ttlMinutes,
          batchRan:    false,
          remainingMin: d.ttlMinutes,
        })
        savedRef.current = false
        setOpen(true)
      }
    } finally {
      setLoading(false)
    }
  }, [ttlInput, onSessionToken])

  const handleEndSession = useCallback(() => {
    clearToken()
    setToken(null)
    setSession(null)
    setResults([])
    setSaveMsg("")
    savedRef.current = false
    onSessionToken?.(null)
  }, [onSessionToken])

  // ── No session yet ─────────────────────────────────────────────────────────

  if (!token || !session?.valid) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-secondary/10 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <UserIcon />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Public User Session
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
          Start a temporary session to save your batch results for up to{" "}
          <strong className="text-foreground/70">{ttlInput} minutes</strong>.
          Results are stored server-side (masked keys only) and auto-deleted when the session expires.
        </p>

        <div className="flex items-center gap-2">
          <label className="text-[9px] text-muted-foreground/50 flex-shrink-0">TTL (min)</label>
          <input
            type="number"
            min={5}
            max={480}
            step={5}
            value={ttlInput}
            onChange={(e) => setTtlInput(Number(e.target.value))}
            className="w-16 px-2 py-1 rounded-md border border-border bg-background text-[10px] text-center font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={handleStart}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-[10px] font-medium text-foreground/80 border border-border hover:border-ring/50 hover:text-foreground transition-colors disabled:opacity-50"
          >
            <ClockIcon />
            {loading ? "Starting..." : "Start Temporary Session"}
          </button>
        </div>

        {session?.reason === "expired" && (
          <p className="text-[9px] text-amber-400/80 px-2 py-1.5 rounded bg-amber-400/10 border border-amber-400/20">
            Previous session expired. Start a new one to access results.
          </p>
        )}
        {session?.reason === "revoked" && (
          <p className="text-[9px] text-destructive/80 px-2 py-1.5 rounded bg-destructive/10 border border-destructive/20">
            Session was revoked. Contact the developer if this is unexpected.
          </p>
        )}
      </div>
    )
  }

  // ── Active session ─────────────────────────────────────────────────────────

  const isExpiring = (session.remainingMs ?? Infinity) < 10 * 60 * 1000 // < 10 min

  return (
    <div className={`rounded-xl border flex flex-col gap-0 overflow-hidden transition-colors ${
      isExpiring ? "border-amber-400/30" : "border-border"
    }`}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between px-3 py-2.5 hover:bg-secondary/20 transition-colors w-full"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <UserIcon />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            User Session
          </span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
            isExpiring
              ? "text-amber-400 border-amber-400/20 bg-amber-400/10"
              : "text-success border-success/20 bg-success/10"
          }`}>
            {countdown || `${session.remainingMin}m`}
          </span>
          {session.batchRan && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border text-cyan-400 border-cyan-400/20 bg-cyan-400/10">
              {session.workingKeysCount} keys saved
            </span>
          )}
        </div>
        <span className={`text-muted-foreground/40 transition-transform ${open ? "" : "rotate-180"}`}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-3 pb-3 pt-0 border-t border-border">

          {/* Session meta */}
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] uppercase tracking-widest text-muted-foreground/40">Expires</span>
              <span className="text-[10px] font-mono text-foreground/70">
                {new Date(session.expiresAt!).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] uppercase tracking-widest text-muted-foreground/40">Remaining</span>
              <span className={`text-[10px] font-mono font-semibold ${isExpiring ? "text-amber-400" : "text-success"}`}>
                {countdown}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] uppercase tracking-widest text-muted-foreground/40">Status</span>
              <span className="text-[10px] text-success">Active</span>
            </div>
          </div>

          {/* Save status */}
          {saving && (
            <p className="text-[9px] text-muted-foreground/60 animate-pulse">Saving results to session...</p>
          )}
          {saveMsg && !saving && (
            <div className="flex items-center gap-1.5 text-[9px] px-2 py-1.5 rounded bg-cyan-400/10 border border-cyan-400/20 text-cyan-400">
              <CheckIcon />
              {saveMsg}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <KeyIcon />
                <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Working Keys ({results.length})
                </span>
                <span className="text-[8px] text-muted-foreground/40">· masked only · raw key never stored</span>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-0 hover:bg-secondary/20 transition-colors"
                  >
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-success" />
                    <span className="text-[9px] font-semibold text-cyan-400/80 uppercase tracking-widest w-20 flex-shrink-0 truncate">
                      {r.providerName}
                    </span>
                    <span className="flex-1 text-[9px] font-mono text-foreground/70 truncate">{r.modelId}</span>
                    <span className="text-[8px] font-mono text-muted-foreground/40 flex-shrink-0">{r.apiKeyMasked}</span>
                    {r.latencyMs && (
                      <span className="text-[8px] text-muted-foreground/40 flex-shrink-0">{r.latencyMs}ms</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[8px] text-muted-foreground/35 text-center">
                Results auto-deleted at session expiry · Raw keys never exposed
              </p>
            </div>
          )}

          {session.batchRan && results.length === 0 && (
            <p className="text-[9px] text-muted-foreground/50 text-center py-2">
              No working keys found in your batch run.
            </p>
          )}

          {!session.batchRan && (
            <p className="text-[9px] text-muted-foreground/50 text-center py-2">
              Run a batch test — working keys will be saved here automatically.
            </p>
          )}

          {/* End session */}
          <button
            onClick={handleEndSession}
            className="text-[9px] text-muted-foreground/30 hover:text-destructive/70 transition-colors text-right"
          >
            End session early
          </button>
        </div>
      )}
    </div>
  )
}
