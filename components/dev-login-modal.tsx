"use client"

import { useState, useEffect, useRef, useCallback } from "react"

// ── Icons ─────────────────────────────────────────────────────────────────────

function ShieldIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.5L2 4v4c0 3.31 2.52 5.74 6 6.5 3.48-.76 6-3.19 6-6.5V4L8 1.5z"
        fill="oklch(0.76 0.17 192)"
        stroke="oklch(0.76 0.17 192)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M5.5 8l2 2 3-3" stroke="oklch(0.09 0.012 255)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.5L2 4v4c0 3.31 2.52 5.74 6 6.5 3.48-.76 6-3.19 6-6.5V4L8 1.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

// ── Dev Logout Confirm Modal ──────────────────────────────────────────────────

export interface AutoLockResult {
  total: number
  locked: number
  failed: number
}

interface LogoutConfirmProps {
  open: boolean
  keyCount: number                      // how many working keys are in localStorage
  onCancel: () => void
  onConfirm: () => Promise<AutoLockResult>  // caller does the actual lock + logout
}

export function DevLogoutConfirmModal({ open, keyCount, onCancel, onConfirm }: LogoutConfirmProps) {
  const [status, setStatus] = useState<"idle" | "locking" | "done">("idle")
  const [result, setResult] = useState<AutoLockResult | null>(null)

  // Reset when modal re-opens
  useEffect(() => {
    if (open) { setStatus("idle"); setResult(null) }
  }, [open])

  const handleConfirm = useCallback(async () => {
    setStatus("locking")
    const r = await onConfirm()
    setResult(r)
    setStatus("done")
  }, [onConfirm])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && status === "idle") onCancel() }}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm developer logout"
    >
      <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-destructive/50 to-transparent" />

        <div className="p-6 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 1.5L2 4v4c0 3.31 2.52 5.74 6 6.5 3.48-.76 6-3.19 6-6.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M8 5.5v3M8 10v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground leading-tight">Confirm Developer Logout</p>
              <p className="text-[10px] text-muted-foreground">
                {keyCount > 0
                  ? `You have ${keyCount} working key${keyCount > 1 ? "s" : ""} that will be auto-locked to DB`
                  : "No working keys to save"}
              </p>
            </div>
          </div>

          {/* Info box */}
          {status === "idle" && keyCount > 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 flex gap-2">
              <svg className="flex-shrink-0 mt-0.5" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="6.5" stroke="oklch(0.76 0.17 192)" strokeWidth="1.3" />
                <path d="M8 7v4M8 5v.5" stroke="oklch(0.76 0.17 192)" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                All <span className="text-foreground font-semibold">{keyCount}</span> working keys will be automatically locked to the database before you are logged out, so they persist for future sessions.
              </p>
            </div>
          )}

          {/* Progress / result */}
          {status === "locking" && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
              <svg className="animate-spin flex-shrink-0" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
              </svg>
              <p className="text-[11px] text-muted-foreground">Locking keys to database...</p>
            </div>
          )}

          {status === "done" && result && (
            <div className={`rounded-lg border px-3 py-2.5 flex items-start gap-2 ${result.failed === 0 ? "border-green-400/20 bg-green-400/5" : "border-yellow-400/20 bg-yellow-400/5"}`}>
              <svg className="flex-shrink-0 mt-0.5" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                {result.failed === 0
                  ? <><circle cx="8" cy="8" r="6.5" stroke="oklch(0.72 0.19 145)" strokeWidth="1.3" /><path d="M5 8l2.5 2.5L11 6" stroke="oklch(0.72 0.19 145)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></>
                  : <><circle cx="8" cy="8" r="6.5" stroke="oklch(0.8 0.17 80)" strokeWidth="1.3" /><path d="M8 5.5v3M8 10v.5" stroke="oklch(0.8 0.17 80)" strokeWidth="1.5" strokeLinecap="round" /></>
                }
              </svg>
              <div>
                <p className="text-[11px] font-medium text-foreground">
                  {result.locked} of {result.total} keys locked successfully
                </p>
                {result.failed > 0 && (
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {result.failed} failed — check that EXPORT_API_TOKEN is set in the Export panel
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={status === "locking"}
              className="flex-1 h-9 rounded-lg border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all disabled:opacity-40"
            >
              {status === "done" ? "Close" : "Cancel"}
            </button>
            {status !== "done" && (
              <button
                onClick={handleConfirm}
                disabled={status === "locking"}
                className="flex-1 h-9 rounded-lg bg-destructive/90 text-destructive-foreground text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:bg-destructive transition-all disabled:opacity-40"
              >
                {status === "locking" ? (
                  <svg className="animate-spin" width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M10.5 5.5L5.5 10.5M5.5 5.5l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
                {status === "locking" ? "Saving..." : keyCount > 0 ? "Save & Logout" : "Logout"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Exports ───────────────────────────────────────────────────────────────────

export interface DevAuthState {
  isDev: boolean
  loading: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onAuth: (isDev: boolean) => void
}

export default function DevLoginModal({ open, onClose, onAuth }: Props) {
  const [password, setPassword]   = useState("")
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState("")
  const [shake, setShake]         = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setPassword("")
      setError("")
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/dev/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        onAuth(true)
        onClose()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? "Login failed.")
        setShake(true)
        setTimeout(() => setShake(false), 500)
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    } catch {
      setError("Network error — please try again.")
    } finally {
      setLoading(false)
    }
  }, [password, onAuth, onClose])

  if (!open) return null

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Developer login"
    >
      {/* Card */}
      <div
        className={`relative w-full max-w-sm mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden transition-all ${shake ? "animate-[shake_0.4s_ease]" : ""}`}
      >
        {/* Top accent line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        <div className="p-6 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ShieldIcon />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground leading-tight">Developer Access</p>
              <p className="text-[10px] text-muted-foreground">Enter your EXPORT_API_TOKEN to unlock</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="relative">
              <input
                ref={inputRef}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError("") }}
                placeholder="Paste token here..."
                autoComplete="current-password"
                className={`w-full h-10 rounded-lg border bg-secondary/40 px-3 pr-9 text-[13px] font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 transition-all ${
                  error
                    ? "border-destructive/60 focus:ring-destructive/40"
                    : "border-border focus:ring-ring/40 focus:border-ring/60"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPw} />
              </button>
            </div>

            {error && (
              <p className="text-[11px] text-destructive leading-tight">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="h-9 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
                  </svg>
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldIcon />
                  Login as Developer
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-[9px] text-muted-foreground/40 text-center leading-relaxed">
            Session is stored as an httpOnly cookie valid for 7 days.
            <br />
            Token is your <code className="font-mono">EXPORT_API_TOKEN</code> env var.
          </p>
        </div>
      </div>

      {/* Shake keyframe */}
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-6px)}
          40%{transform:translateX(6px)}
          60%{transform:translateX(-4px)}
          80%{transform:translateX(4px)}
        }
      `}</style>
    </div>
  )
}
