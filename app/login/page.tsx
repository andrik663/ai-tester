"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"

// ── Icons ────────────────────────────────────────────────────────────────────

function ShieldIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.5L2 4v4c0 3.31 2.52 5.74 6 6.5 3.48-.76 6-3.19 6-6.5V4L8 1.5z"
        fill="oklch(0.76 0.17 192)"
        stroke="oklch(0.76 0.17 192)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M5.5 8l2 2 3-3" stroke="oklch(0.09 0.012 255)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
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
    <svg className="animate-spin" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
    </svg>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/"

  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState("")
  const [shake, setShake] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)

  // Check if already logged in via dev session
  useEffect(() => {
    fetch("/api/dev/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.isDev) {
          router.replace(callbackUrl)
        } else {
          setCheckingSession(false)
          setTimeout(() => passwordRef.current?.focus(), 60)
        }
      })
      .catch(() => setCheckingSession(false))
  }, [callbackUrl, router])

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 450)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/dev/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Incorrect password. Please try again.")
        triggerShake()
        setPassword("")
        setTimeout(() => passwordRef.current?.focus(), 60)
        return
      }

      router.replace(callbackUrl)
      router.refresh()
    } catch {
      setError("Network error — please try again.")
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <SpinnerIcon />
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, oklch(0.76 0.17 192 / 8%) 0%, transparent 70%)",
        }}
      />

      {/* Card */}
      <div
        className={`w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl overflow-hidden transition-transform ${
          shake ? "animate-[shake_0.4s_ease]" : ""
        }`}
      >
        {/* Top accent line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        <div className="p-7 flex flex-col gap-6">
          {/* Branding */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ShieldIcon />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-foreground tracking-tight">
                API Key Tester
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Enter the access password to continue
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-[11px] font-medium text-muted-foreground">
                Access Password
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError("") }}
                  placeholder="Enter access password"
                  autoComplete="current-password"
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
            </div>

            {error && (
              <p role="alert" className="text-[11px] text-destructive leading-tight -mt-1">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="mt-1 h-10 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <SpinnerIcon />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldIcon filled />
                  Access
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-[9px] text-muted-foreground/40 text-center leading-relaxed">
            Dev access only &bull; Session valid for 7 days
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
    </main>
  )
}
