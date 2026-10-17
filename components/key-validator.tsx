"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import useSWR from "swr"
import type { TestKeyResult } from "@/app/api/test-key/route"
import { copyToClipboard } from "@/lib/clipboard"

// ── Supported providers for the quick tester ──────────────────────────────────
// NOTE: `testerLabel` must match a key in the TESTERS map in /api/test-key/route.ts

interface QuickProvider {
  id: string
  name: string
  /** Must match a key in the route's TESTERS map exactly */
  testerLabel: string
  keyPrefix?: string
  keyExample: string
  color: string
  dotColor: string
}

const QUICK_PROVIDERS: QuickProvider[] = [
  { id: "openai",      name: "OpenAI",        testerLabel: "OpenAI API Key",           keyPrefix: "sk-",       keyExample: "sk-...",        color: "text-success",   dotColor: "bg-success"   },
  { id: "anthropic",   name: "Anthropic",     testerLabel: "Anthropic API Key",        keyPrefix: "sk-ant-",   keyExample: "sk-ant-...",    color: "text-orange-400",  dotColor: "bg-orange-400"  },
  { id: "google",      name: "Google Gemini", testerLabel: "Google Gemini Key",        keyPrefix: "AIza",      keyExample: "AIzaSy...",     color: "text-blue-400",    dotColor: "bg-blue-400"    },
  { id: "groq",        name: "Groq",          testerLabel: "Groq API Key",             keyPrefix: "gsk_",      keyExample: "gsk_...",       color: "text-cyan-400",    dotColor: "bg-cyan-400"    },
  { id: "mistral",     name: "Mistral",       testerLabel: "Mistral API Key",          keyPrefix: undefined,   keyExample: "••••••••",      color: "text-destructive",     dotColor: "bg-destructive"     },
  { id: "cohere",      name: "Cohere",        testerLabel: "Cohere API Key",           keyPrefix: undefined,   keyExample: "••••••••",      color: "text-success", dotColor: "bg-success" },
  { id: "huggingface", name: "HuggingFace",   testerLabel: "HuggingFace Token",        keyPrefix: "hf_",       keyExample: "hf_...",        color: "text-yellow-400",  dotColor: "bg-yellow-400"  },
  { id: "github",      name: "GitHub",        testerLabel: "GitHub Token",             keyPrefix: "ghp_",      keyExample: "ghp_...",       color: "text-foreground",  dotColor: "bg-foreground"  },
  { id: "stripe",      name: "Stripe",        testerLabel: "Stripe Secret Key",        keyPrefix: "sk_",       keyExample: "sk_live_...",   color: "text-violet-400",  dotColor: "bg-violet-400"  },
  { id: "xai",         name: "xAI (Grok)",    testerLabel: "xAI API Key",              keyPrefix: undefined,   keyExample: "xai-...",       color: "text-zinc-300",    dotColor: "bg-zinc-300"    },
  { id: "deepseek",    name: "DeepSeek",      testerLabel: "DeepSeek API Key",         keyPrefix: undefined,   keyExample: "sk-...",        color: "text-sky-400",     dotColor: "bg-sky-400"     },
  { id: "together",    name: "Together AI",   testerLabel: "Together AI Key",          keyPrefix: undefined,   keyExample: "••••••••",      color: "text-pink-400",    dotColor: "bg-pink-400"    },
  { id: "dahono",      name: "Dahono Gateway",testerLabel: "Dahono API Key",           keyPrefix: undefined,   keyExample: "dk-...",        color: "text-primary",     dotColor: "bg-primary"     },
]

// ── Auto-detect provider from key prefix ──────────────────────────────────────

function detectProvider(key: string): QuickProvider | undefined {
  if (!key || key.length < 4) return undefined
  const k = key.trim()
  // Most specific prefixes first
  if (k.startsWith("sk-ant-"))                             return QUICK_PROVIDERS.find((p) => p.id === "anthropic")
  if (k.startsWith("AIza"))                               return QUICK_PROVIDERS.find((p) => p.id === "google")
  if (k.startsWith("gsk_"))                               return QUICK_PROVIDERS.find((p) => p.id === "groq")
  if (k.startsWith("hf_"))                                return QUICK_PROVIDERS.find((p) => p.id === "huggingface")
  if (k.startsWith("ghp_") || k.startsWith("github_pat_")) return QUICK_PROVIDERS.find((p) => p.id === "github")
  if (k.startsWith("sk_live_") || k.startsWith("sk_test_")) return QUICK_PROVIDERS.find((p) => p.id === "stripe")
  if (k.startsWith("xai-"))                               return QUICK_PROVIDERS.find((p) => p.id === "xai")
  // OpenAI sk- (after stripe sk_ and anthropic sk-ant- are already caught above)
  if (k.startsWith("sk-") && !k.startsWith("sk_"))        return QUICK_PROVIDERS.find((p) => p.id === "openai")
  return undefined
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ valid, small = false }: { valid: boolean | null; small?: boolean }) {
  if (valid === null) return null
  const base = small ? "text-[10px] px-2 py-0.5 rounded-full font-semibold" : "text-xs px-3 py-1 rounded-full font-semibold"
  if (valid) return <span className={`${base} bg-success/15 text-success border border-success/30`}>Valid</span>
  return <span className={`${base} bg-destructive/15 text-destructive border border-destructive/30`}>Invalid</span>
}

// ── Metric chip ───────────────────────────────────────────────────────────────

function MetricChip({ label, value, accent = "default" }: { label: string; value: string; accent?: "green" | "yellow" | "red" | "blue" | "default" }) {
  const colors = {
    green:   "text-success",
    yellow:  "text-yellow-400",
    red:     "text-destructive",
    blue:    "text-blue-400",
    default: "text-foreground",
  }
  return (
    <div className="flex flex-col gap-0.5 bg-secondary/60 rounded-md px-3 py-2 border border-border">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
      <span className={`text-[13px] font-mono font-semibold ${colors[accent]}`}>{value}</span>
    </div>
  )
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    copyToClipboard(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary border border-transparent hover:border-border"
    >
      {copied ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-success">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-success">Copied</span>
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {label}
        </>
      )}
    </button>
  )
}

// ── Rate limit / quota parser ─────────────────────────────────────────────────

function parseRateLimits(headers?: Record<string, string>) {
  if (!headers) return null
  const items: { label: string; value: string; accent: "green" | "yellow" | "red" | "blue" | "default" }[] = []

  // OpenAI / Groq style
  const reqLimit     = headers["x-ratelimit-limit-requests"]
  const reqRemaining = headers["x-ratelimit-remaining-requests"]
  const reqReset     = headers["x-ratelimit-reset-requests"]
  const tokLimit     = headers["x-ratelimit-limit-tokens"]
  const tokRemaining = headers["x-ratelimit-remaining-tokens"]

  if (reqRemaining !== undefined) {
    const pct = reqLimit ? Math.round((parseInt(reqRemaining) / parseInt(reqLimit)) * 100) : null
    const accent = pct !== null ? (pct > 50 ? "green" : pct > 20 ? "yellow" : "red") : "default"
    items.push({ label: "Req Remaining", value: reqLimit ? `${reqRemaining} / ${reqLimit}` : reqRemaining, accent })
  }
  if (reqReset) {
    items.push({ label: "Req Reset", value: reqReset, accent: "blue" })
  }
  if (tokRemaining !== undefined) {
    const pct = tokLimit ? Math.round((parseInt(tokRemaining) / parseInt(tokLimit)) * 100) : null
    const accent = pct !== null ? (pct > 50 ? "green" : pct > 20 ? "yellow" : "red") : "default"
    items.push({ label: "Tokens Left", value: tokLimit ? `${tokRemaining} / ${tokLimit}` : tokRemaining, accent })
  }

  // Anthropic style
  const anthReq = headers["anthropic-ratelimit-requests-remaining"]
  const anthReqLimit = headers["anthropic-ratelimit-requests-limit"]
  if (anthReq !== undefined) {
    const pct = anthReqLimit ? Math.round((parseInt(anthReq) / parseInt(anthReqLimit)) * 100) : null
    const accent = pct !== null ? (pct > 50 ? "green" : pct > 20 ? "yellow" : "red") : "default"
    items.push({ label: "Req Remaining", value: anthReqLimit ? `${anthReq} / ${anthReqLimit}` : anthReq, accent })
  }

  return items.length > 0 ? items : null
}

// ── Main KeyValidator component ───────────────────────────────────────────────

interface KeyValidatorProps {
  compact?: boolean
  onValidated?: (provider: string, key: string, result: TestKeyResult) => void
}

export default function KeyValidator({ compact = false, onValidated }: KeyValidatorProps) {
  const [apiKey, setApiKey]           = useState("")
  const [debouncedKey, setDebouncedKey] = useState("")
  const [showKey, setShowKey]         = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<QuickProvider | null>(null)
  const [manualProvider, setManualProvider] = useState<string | null>(null)
  const [result, setResult]           = useState<TestKeyResult | null>(null)
  const [loading, setLoading]         = useState(false)
  const [showCurl, setShowCurl]       = useState(false)
  const [showModels, setShowModels]   = useState(false)
  const [showHeaders, setShowHeaders] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoRunRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef     = useRef<HTMLInputElement | null>(null)

  // Debounce key input for auto-detect + auto-run
  const handleKeyChange = useCallback((val: string) => {
    setApiKey(val)
    setResult(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedKey(val)
      const detected = detectProvider(val)
      if (detected && !manualProvider) {
        setSelectedProvider(detected)
        // Auto-run: fire the test 600ms after provider is detected and key looks complete (≥20 chars)
        if (val.trim().length >= 20) {
          if (autoRunRef.current) clearTimeout(autoRunRef.current)
          autoRunRef.current = setTimeout(() => {
            // Use detected provider directly (state may not be updated yet)
            runTestWith(detected, val.trim())
          }, 600)
        }
      }
    }, 300)
  }, [manualProvider]) // eslint-disable-line react-hooks/exhaustive-deps

  // Global keyboard shortcut: "/" focuses the key input, Ctrl/Cmd+Enter triggers test
  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      // "/" focuses input if not already in an input/textarea
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      // Ctrl/Cmd + Enter triggers test from anywhere on the page
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        runTestWithCurrent()
      }
    }
    window.addEventListener("keydown", onGlobalKey)
    return () => window.removeEventListener("keydown", onGlobalKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveProvider = manualProvider
    ? QUICK_PROVIDERS.find((p) => p.id === manualProvider)
    : (selectedProvider ?? undefined)

  // Fetch models if provider supports it and key is valid
  const modelsSWRKey =
    result?.valid && effectiveProvider
      ? ["/api/test-key", effectiveProvider.id, debouncedKey.trim()]
      : null

  // Core test runner — accepts provider and key directly so it works for both auto-run and manual
  async function runTestWith(provider: QuickProvider, key: string) {
    if (!key || !provider || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: provider.testerLabel, value: key }),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`)
        setResult({ valid: false, provider: provider.name, message: `Server error (${res.status})`, detail: errText.slice(0, 200), logs: [] })
        return
      }
      const data: TestKeyResult = await res.json()
      setResult(data)
      onValidated?.(provider.id, key, data)
    } catch (err) {
      setResult({ valid: false, provider: provider.name, message: err instanceof Error ? err.message : "Network request failed", detail: "Check your connection and try again.", logs: [] })
    } finally {
      setLoading(false)
    }
  }

  // Convenience wrapper that reads current state — used by button + Ctrl+Enter shortcut
  function runTestWithCurrent() {
    const key = apiKey.trim()
    const provider = effectiveProvider
    if (!key || !provider) return
    runTestWith(provider, key)
  }

  // Share result: copy formatted summary to clipboard
  function shareResult() {
    if (!result) return
    const lines = [
      `API Key Test Result — ${result.provider}`,
      `Status: ${result.valid ? "VALID" : "INVALID"}`,
      `Message: ${result.message}`,
      result.detail ? `Detail: ${result.detail}` : null,
      result.latencyMs !== undefined ? `Latency: ${result.latencyMs}ms` : null,
      result.tokenUsage?.totalTokens !== undefined ? `Total Tokens: ${result.tokenUsage.totalTokens}` : null,
      result.curlDisplay ? `\ncURL:\n${result.curlDisplay}` : null,
    ].filter(Boolean).join("\n")
    copyToClipboard(lines).then(() => {
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2000)
    }).catch(() => {
      // Silent fail — user will see no state change, which is acceptable
    })
  }

  const rateLimits = parseRateLimits(result?.responseHeaders)
  const hasModelsInfo = result?.message && result.message.includes("models")

  const keyMasked = apiKey.length > 8
    ? apiKey.slice(0, 8) + "•".repeat(Math.min(apiKey.length - 8, 16))
    : apiKey

  return (
    <div className="flex flex-col gap-4">

      {/* ── Security notice ─────────────────────────────────���────────────── */}
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-border bg-secondary/40">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-primary flex-shrink-0 mt-px">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span className="text-[10px] text-muted-foreground leading-relaxed">
          Key is <span className="text-foreground font-medium">never stored or logged</span> — proxied and discarded immediately.
        </span>
      </div>

      {/* ── Provider selector ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Provider</label>
          {selectedProvider && !manualProvider && (
            <span className="text-[9px] text-primary/70 font-medium">
              Auto-detected: {selectedProvider.name}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {QUICK_PROVIDERS.map((p) => {
            const isActive = (manualProvider ?? selectedProvider?.id) === p.id
            return (
              <button
                key={p.id}
                onClick={() => {
                  setManualProvider(p.id)
                  setSelectedProvider(p)
                  setResult(null)
                }}
                className={`flex items-center gap-1 text-[10px] font-medium px-2 py-[3px] rounded border transition-all ${
                  isActive
                    ? "border-primary/60 bg-primary/12 text-primary"
                    : "border-border/60 text-muted-foreground/70 hover:border-border hover:text-foreground bg-secondary/20"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-primary" : `${p.dotColor} opacity-40`}`} />
                {p.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── API key input ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">API Key</label>
          {apiKey && (
            <button
              onClick={() => { setApiKey(""); setDebouncedKey(""); setResult(null); setManualProvider(null); setSelectedProvider(null) }}
              className="text-[9px] text-muted-foreground/60 hover:text-destructive transition-colors flex items-center gap-1"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Clear
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runTestWithCurrent() }}
              placeholder={effectiveProvider?.keyExample ?? "Paste key — / to focus, Ctrl+Enter to test"}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-md border border-border bg-card text-foreground text-[11px] font-mono px-3 py-2 pr-9 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/55 transition-colors"
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              title={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <button
            onClick={runTestWithCurrent}
            disabled={!apiKey.trim() || loading}
            title={!effectiveProvider ? "Select a provider above first" : "Test key (Enter)"}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-[11px] font-bold tracking-wide transition-all hover:bg-primary-hover active:brightness-95 disabled:opacity-35 disabled:cursor-not-allowed flex-shrink-0"
          >
            {loading ? (
              <>
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 11-8 8z" />
                </svg>
                Testing...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Test Key
              </>
            )}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-muted-foreground/60">
            {apiKey.length >= 4 && !effectiveProvider
              ? <span className="text-yellow-400/70">Select a provider above</span>
              : apiKey.length >= 4
              ? <span className="font-mono">{keyMasked}</span>
              : <span>Press <kbd className="px-1 py-px rounded bg-secondary border border-border text-[8px] font-mono">/</kbd> to focus &middot; <kbd className="px-1 py-px rounded bg-secondary border border-border text-[8px] font-mono">Ctrl+Enter</kbd> to test</span>
            }
          </p>
          {loading && (
            <p className="text-[9px] text-primary/60 animate-pulse">Auto-testing...</p>
          )}
        </div>
      </div>

      {/* ── Result panel ─────────────────────────────────────────────────── */}
      {result && (
        <div className={`flex flex-col gap-3 rounded-xl border p-4 ${
          result.valid === true
            ? "border-success/25 bg-success/5"
            : result.valid === false
            ? "border-destructive/25 bg-destructive/5"
            : "border-border bg-card"
        }`}>

          {/* Status row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                {result.valid === true && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-success flex-shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {result.valid === false && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-destructive flex-shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                )}
                <span className="text-sm font-semibold text-foreground leading-tight">{result.message}</span>
              </div>
              {result.detail && (
                <p className="text-[11px] text-muted-foreground ml-6">{result.detail}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <StatusBadge valid={result.valid ?? null} />
              {/* Share result — copy formatted summary to clipboard */}
              <button
                onClick={shareResult}
                title="Copy result to clipboard"
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary border border-transparent hover:border-border"
              >
                {copiedShare ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-success">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-success">Copied</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    Share
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Metrics row: latency + tokens */}
          {(result.latencyMs !== undefined || result.tokenUsage) && (
            <div className="flex flex-wrap gap-2">
              {result.latencyMs !== undefined && (
                <MetricChip
                  label="Latency"
                  value={`${result.latencyMs}ms`}
                  accent={result.latencyMs < 800 ? "green" : result.latencyMs < 2000 ? "yellow" : "red"}
                />
              )}
              {result.tokenUsage?.promptTokens !== undefined && (
                <MetricChip label="Input Tokens" value={String(result.tokenUsage.promptTokens)} accent="blue" />
              )}
              {result.tokenUsage?.completionTokens !== undefined && (
                <MetricChip label="Output Tokens" value={String(result.tokenUsage.completionTokens)} accent="blue" />
              )}
              {result.tokenUsage?.totalTokens !== undefined && (
                <MetricChip label="Total Tokens" value={String(result.tokenUsage.totalTokens)} accent="default" />
              )}
            </div>
          )}

          {/* Rate limits / quota */}
          {rateLimits && rateLimits.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quota &amp; Rate Limits</p>
              <div className="flex flex-wrap gap-2">
                {rateLimits.map((item, i) => (
                  <MetricChip key={i} label={item.label} value={item.value} accent={item.accent} />
                ))}
              </div>
            </div>
          )}

          {/* Models count / accessible info from message */}
          {result.valid && hasModelsInfo && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/40 border border-border">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-primary flex-shrink-0">
                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
              </svg>
              <span className="text-[11px] text-foreground">{result.message}</span>
            </div>
          )}

          {/* cURL command */}
          {result.curlDisplay && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowCurl((v) => !v)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 transition-transform ${showCurl ? "rotate-90" : ""}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  cURL command {showCurl ? "" : "(masked)"}
                </button>
                <div className="flex gap-1">
                  <CopyButton text={result.curlDisplay} label="Copy (masked)" />
                  {result.curlFull && <CopyButton text={result.curlFull} label="Copy (full key)" />}
                </div>
              </div>
              {showCurl && (
                <pre className="text-[10px] font-mono text-cyan-400/80 bg-background/60 rounded-md border border-border px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {result.curlDisplay}
                </pre>
              )}
            </div>
          )}

          {/* Response headers (rate limit details) */}
          {result.responseHeaders && Object.keys(result.responseHeaders).length > 0 && (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setShowHeaders((v) => !v)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors self-start"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 transition-transform ${showHeaders ? "rotate-90" : ""}`}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Response headers ({Object.keys(result.responseHeaders).length})
              </button>
              {showHeaders && (
                <div className="flex flex-col gap-0.5 bg-background/60 rounded-md border border-border px-3 py-2">
                  {Object.entries(result.responseHeaders).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-[10px] font-mono">
                      <span className="text-muted-foreground/60 flex-shrink-0">{k}:</span>
                      <span className="text-foreground/80 break-all">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Request log */}
          {result.logs && result.logs.length > 0 && (
            <details className="group">
              <summary className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer list-none select-none">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 transition-transform group-open:rotate-90">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Request log ({result.logs.length} entries)
              </summary>
              <div className="mt-2 flex flex-col gap-0.5 bg-background/60 rounded-md border border-border px-3 py-2 max-h-48 overflow-y-auto">
                {result.logs.map((log, i) => {
                  const colors: Record<string, string> = {
                    info: "text-muted-foreground",
                    req: "text-blue-400",
                    res: "text-yellow-400",
                    ok: "text-success",
                    err: "text-destructive",
                    curl: "text-cyan-400",
                  }
                  const prefixes: Record<string, string> = {
                    info: "  ", req: "→ ", res: "← ", ok: "✓ ", err: "✗ ", curl: "$ ",
                  }
                  return (
                    <div key={i} className={`text-[10px] font-mono ${colors[log.level] ?? "text-muted-foreground"} flex gap-1.5`}>
                      <span className="text-muted-foreground/60 flex-shrink-0 w-10 text-right">{log.ts}ms</span>
                      <span className="opacity-60 flex-shrink-0">{prefixes[log.level] ?? "  "}</span>
                      <span className="break-all">{log.text}</span>
                    </div>
                  )
                })}
              </div>
            </details>
          )}

        </div>
      )}

    </div>
  )
}
