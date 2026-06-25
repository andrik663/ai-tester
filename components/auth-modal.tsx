"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { authClient } from "@/lib/auth-client"

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

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
    </svg>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AuthState {
  isAuthenticated: boolean
  userId?: string
  email?: string
  name?: string
}

interface Props {
  open: boolean
  onClose: () => void
  onAuth: (state: AuthState) => void
}

type Mode = "sign-in" | "sign-up"

// ── Component ──────────────────────────────────────────────────────────────────

export default function AuthModal({ open, onClose, onAuth }: Props) {
  const [mode, setMode] = useState<Mode>("sign-in")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [shake, setShake] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  // Focus email when modal opens or mode changes
  useEffect(() => {
    if (open) {
      resetForm()
      setTimeout(() => emailRef.current?.focus(), 60)
    }
  }, [open, mode])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  function resetForm() {
    setName("")
    setEmail("")
    setPassword("")
    setError("")
    setShowPw(false)
  }

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!email.trim() || !password.trim()) return
      if (mode === "sign-up" && !name.trim()) return
      setLoading(true)
      setError("")

      try {
        if (mode === "sign-in") {
          const { data, error: err } = await authClient.signIn.email({
            email: email.trim(),
            password,
          })
          if (err || !data) {
            setError(err?.message ?? "Login failed. Check your credentials.")
            triggerShake()
            return
          }
          onAuth({
            isAuthenticated: true,
            userId: data.user.id,
            email: data.user.email,
            name: data.user.name,
          })
          onClose()
        } else {
          const { data, error: err } = await authClient.signUp.email({
            email: email.trim(),
            password,
            name: name.trim(),
          })
          if (err || !data) {
            setError(err?.message ?? "Registration failed. Try a different email.")
            triggerShake()
            return
          }
          onAuth({
            isAuthenticated: true,
            userId: data.user.id,
            email: data.user.email,
            name: data.user.name,
          })
          onClose()
        }
      } catch {
        setError("Network error — please try again.")
        triggerShake()
      } finally {
        setLoading(false)
      }
    },
    [mode, name, email, password, onAuth, onClose]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={mode === "sign-in" ? "Sign in" : "Create account"}
    >
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
              <p className="text-[13px] font-semibold text-foreground leading-tight">
                {mode === "sign-in" ? "Welcome back" : "Create your account"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {mode === "sign-in"
                  ? "Sign in with your email and password"
                  : "Register to get started"}
              </p>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-lg border border-border bg-secondary/30 p-0.5 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => { setMode("sign-in"); resetForm() }}
              className={`flex-1 h-7 rounded-md transition-all ${
                mode === "sign-in"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("sign-up"); resetForm() }}
              className={`flex-1 h-7 rounded-md transition-all ${
                mode === "sign-up"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === "sign-up" && (
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError("") }}
                placeholder="Your name"
                autoComplete="name"
                required
                className="w-full h-10 rounded-lg border border-border bg-secondary/40 px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-ring/40 focus:border-ring/60 transition-all"
              />
            )}

            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError("") }}
              placeholder="Email address"
              autoComplete="email"
              required
              className={`w-full h-10 rounded-lg border bg-secondary/40 px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 transition-all ${
                error
                  ? "border-destructive/60 focus:ring-destructive/40"
                  : "border-border focus:ring-ring/40 focus:border-ring/60"
              }`}
            />

            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError("") }}
                placeholder={mode === "sign-up" ? "Create password" : "Password"}
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                required
                className={`w-full h-10 rounded-lg border bg-secondary/40 px-3 pr-9 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 transition-all ${
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
              disabled={
                loading ||
                !email.trim() ||
                !password.trim() ||
                (mode === "sign-up" && !name.trim())
              }
              className="h-9 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <SpinnerIcon />
                  {mode === "sign-in" ? "Signing in..." : "Creating account..."}
                </>
              ) : (
                <>
                  <ShieldIcon filled />
                  {mode === "sign-in" ? "Sign In" : "Create Account"}
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-[9px] text-muted-foreground/40 text-center leading-relaxed">
            Session is stored as an httpOnly cookie valid for 7 days.
          </p>
        </div>
      </div>

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
