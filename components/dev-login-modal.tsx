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
