"use client"

import { useState, useRef, useCallback } from "react"
import type { MultiKeyResult, MultiKeyTestResponse, TokenUsage } from "@/app/api/multi-key-test/route"
import { PROVIDER_MODELS } from "@/app/api/multi-key-test/route"

// ── Provider format catalogue ─────────────────────────────────────────────────

interface ProviderFormat {
  id: string
  label: string
  country: string
  flag: string
  example: string
  keyHint: string
  autoDetect?: boolean
}

const PROVIDER_FORMATS: ProviderFormat[] = [
  { id: "dahono",      label: "Dahono Labs Gateway",   country: "ID", flag: "🇮🇩", example: "dahono:YOUR_KEY",         keyHint: "gateway key" },
  { id: "anthropic",   label: "Anthropic",             country: "US", flag: "🇺🇸", example: "anthropic:sk-ant-...",    keyHint: "sk-ant-...", autoDetect: true },
  { id: "openai",      label: "OpenAI",                country: "US", flag: "🇺🇸", example: "openai:sk-...",           keyHint: "sk-...",     autoDetect: true },
  { id: "google",      label: "Google Gemini",         country: "US", flag: "🇺🇸", example: "google:AIza...",          keyHint: "AIza...",    autoDetect: true },
  { id: "xai",         label: "xAI Grok",              country: "US", flag: "🇺🇸", example: "xai:xai-...",             keyHint: "xai-...",    autoDetect: true },
  { id: "deepseek",    label: "DeepSeek",              country: "CN", flag: "🇨🇳", example: "deepseek:YOUR_KEY",       keyHint: "API key" },
  { id: "qwen",        label: "Qwen (Alibaba)",        country: "CN", flag: "🇨🇳", example: "qwen:YOUR_KEY",           keyHint: "DashScope key" },
  { id: "zhipu",       label: "Zhipu GLM",             country: "CN", flag: "🇨🇳", example: "zhipu:YOUR_KEY",          keyHint: "BigModel key" },
  { id: "minimax",     label: "MiniMax",               country: "CN", flag: "🇨🇳", example: "minimax:YOUR_KEY",        keyHint: "API key" },
  { id: "cerebras",    label: "Cerebras",              country: "US", flag: "🇺🇸", example: "cerebras:YOUR_KEY",       keyHint: "API key" },
  { id: "fireworks",   label: "Fireworks AI",          country: "US", flag: "🇺🇸", example: "fireworks:YOUR_KEY",      keyHint: "fw-..." },
  { id: "novita",      label: "Novita AI",             country: "US", flag: "🇺🇸", example: "novita:YOUR_KEY",         keyHint: "API key" },
  { id: "cloudflare",  label: "Cloudflare Workers AI", country: "US", flag: "🇺🇸", example: "cloudflare:YOUR_KEY",     keyHint: "CF token" },
  { id: "openrouter",  label: "OpenRouter",            country: "US", flag: "🇺🇸", example: "openrouter:sk-or-v1-...", keyHint: "sk-or-...", autoDetect: true },
  { id: "sambanova",   label: "SambaNova",             country: "US", flag: "🇺🇸", example: "sambanova:YOUR_KEY",      keyHint: "API key" },
  { id: "nvidia",      label: "NVIDIA NIM",            country: "US", flag: "🇺🇸", example: "nvidia:nvapi-...",        keyHint: "nvapi-..." },
  { id: "hyperbolic",  label: "Hyperbolic",            country: "US", flag: "🇺🇸", example: "hyperbolic:YOUR_KEY",     keyHint: "API key" },
  { id: "ai21",        label: "AI21 Labs",             country: "IL", flag: "🇮🇱", example: "ai21:YOUR_KEY",           keyHint: "API key" },
  { id: "groq",        label: "Groq",                  country: "US", flag: "🇺🇸", example: "groq:gsk_...",            keyHint: "gsk_...",    autoDetect: true },
  { id: "together",    label: "Together AI",           country: "US", flag: "🇺🇸", example: "together:YOUR_KEY",       keyHint: "API key" },
  { id: "mistral",     label: "Mistral AI",            country: "FR", flag: "🇫🇷", example: "mistral:YOUR_KEY",        keyHint: "API key" },
  { id: "cohere",      label: "Cohere",                country: "CA", flag: "🇨🇦", example: "cohere:YOUR_KEY",         keyHint: "API key" },
  { id: "perplexity",  label: "Perplexity",            country: "US", flag: "🇺🇸", example: "perplexity:pplx-...",     keyHint: "pplx-..." },
  { id: "huggingface", label: "HuggingFace",           country: "US", flag: "🇺🇸", example: "huggingface:hf_...",      keyHint: "hf_...",     autoDetect: true },
  { id: "replicate",   label: "Replicate",             country: "US", flag: "🇺🇸", example: "replicate:r8_...",        keyHint: "r8_...",     autoDetect: true },
  { id: "moonshot",    label: "Moonshot (Kimi)",       country: "CN", flag: "🇨🇳", example: "moonshot:YOUR_KEY",       keyHint: "API key" },
  { id: "baidu",       label: "Baidu ERNIE",           country: "CN", flag: "🇨🇳", example: "baidu:YOUR_KEY",          keyHint: "Qianfan key" },
  { id: "yi",          label: "01.AI (Yi)",            country: "CN", flag: "🇨🇳", example: "yi:YOUR_KEY",             keyHint: "API key" },
  { id: "stepfun",     label: "Stepfun",               country: "CN", flag: "🇨🇳", example: "stepfun:YOUR_KEY",        keyHint: "API key" },
  { id: "hunyuan",     label: "Tencent Hunyuan",       country: "CN", flag: "🇨🇳", example: "hunyuan:YOUR_KEY",        keyHint: "API key" },
  { id: "azure",       label: "Azure OpenAI",          country: "US", flag: "🇺🇸", example: "azure:YOUR_KEY",          keyHint: "Azure key" },
  { id: "upstage",     label: "Upstage Solar",         country: "KR", flag: "🇰🇷", example: "upstage:YOUR_KEY",        keyHint: "API key" },
  { id: "writer",      label: "Writer (Palmyra)",      country: "US", flag: "🇺🇸", example: "writer:YOUR_KEY",         keyHint: "API key" },
  { id: "lepton",      label: "LeptonAI",              country: "US", flag: "🇺🇸", example: "lepton:YOUR_KEY",         keyHint: "API key" },
  { id: "inception",   label: "Inception (Mercury)",   country: "US", flag: "🇺🇸", example: "inception:YOUR_KEY",      keyHint: "API key" },
  { id: "ibm",         label: "IBM Granite (WatsonX)", country: "US", flag: "🇺🇸", example: "ibm:YOUR_KEY",            keyHint: "IAM token" },
  { id: "deepinfra",   label: "Deep Infra",            country: "US", flag: "🇺🇸", example: "deepinfra:YOUR_KEY",      keyHint: "API key" },
  { id: "anyscale",    label: "Anyscale",              country: "US", flag: "🇺🇸", example: "anyscale:esecret_...",    keyHint: "esecret_..." },
  { id: "neets",       label: "Neets AI",              country: "US", flag: "🇺🇸", example: "neets:YOUR_KEY",          keyHint: "API key" },
  { id: "lamini",      label: "Lamini AI",             country: "US", flag: "🇺🇸", example: "lamini:YOUR_KEY",         keyHint: "API key" },
]

const KNOWN_PROVIDERS = PROVIDER_FORMATS.map((p) => p.id)

// ── Parser ────────────────────────────────────────────────────────────────────

interface ParsedEntry {
  provider: string
  apiKey: string
  raw: string
  detected: boolean
  unknown: boolean
}

function detectProvider(key: string): string | null {
  const k = key.trim()
  if (k.startsWith("sk-ant-"))               return "anthropic"
  if (k.startsWith("sk-or-"))               return "openrouter"
  if (k.startsWith("sk-proj-"))             return "openai"
  if (k.startsWith("sk-") && k.length > 30) return "openai"
  if (k.startsWith("AIza"))                return "google"
  if (k.startsWith("xai-"))                return "xai"
  if (k.startsWith("gsk_"))                return "groq"
  if (k.startsWith("r8_"))                 return "replicate"
  if (k.startsWith("pat-"))                return "huggingface"
  if (k.startsWith("hf_"))                 return "huggingface"
  if (k.startsWith("nvapi-"))              return "nvidia"
  if (k.startsWith("pplx-"))              return "perplexity"
  if (k.startsWith("esecret_"))           return "anyscale"
  return null
}

function parseLines(text: string): ParsedEntry[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((raw) => {
      const colonIdx = raw.indexOf(":")
      if (colonIdx > 0) {
        const left = raw.slice(0, colonIdx).trim().toLowerCase()
        const right = raw.slice(colonIdx + 1).trim()
        if (KNOWN_PROVIDERS.includes(left) && right) {
          return { provider: left, apiKey: right, raw, detected: false, unknown: false }
        }
      }
      const spaceIdx = raw.indexOf(" ")
      if (spaceIdx > 0) {
        const left = raw.slice(0, spaceIdx).trim().toLowerCase()
        const right = raw.slice(spaceIdx + 1).trim()
        if (KNOWN_PROVIDERS.includes(left) && right) {
          return { provider: left, apiKey: right, raw, detected: false, unknown: false }
        }
      }
      const detected = detectProvider(raw)
      if (detected) {
        return { provider: detected, apiKey: raw, raw, detected: true, unknown: false }
      }
      return { provider: "?", apiKey: raw, raw, detected: false, unknown: true }
    })
}

// ── Token usage display ───────────────────────────────────────────────────────

function TokenBadge({ usage }: { usage?: TokenUsage }) {
  if (!usage) return <span className="text-[10px] text-muted-foreground/30">—</span>

  const hasData = usage.promptTokens !== null || usage.completionTokens !== null || usage.totalTokens !== null

  if (!hasData) return <span className="text-[10px] text-muted-foreground/30">—</span>

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      {usage.totalTokens !== null && (
        <span className="text-[11px] font-semibold font-mono text-foreground/80 leading-none">
          {usage.totalTokens.toLocaleString()}
        </span>
      )}
      <div className="flex items-center gap-1 flex-wrap">
        {usage.promptTokens !== null && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-sky-400/70 leading-none">
            <svg width="6" height="6" viewBox="0 0 6 6" fill="none" aria-hidden>
              <path d="M1 3h4M3 1v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            {usage.promptTokens.toLocaleString()}
          </span>
        )}
        {usage.completionTokens !== null && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-violet-400/70 leading-none">
            <svg width="6" height="6" viewBox="0 0 6 6" fill="none" aria-hidden>
              <path d="M1 3h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            {usage.completionTokens.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ result }: { result: MultiKeyResult | null }) {
  if (!result) return <span className="text-[10px] text-muted-foreground/30 font-mono">—</span>

  if (result.statusText === "Skipped") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold font-mono bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
        SKIP
      </span>
    )
  }

  if (result.ok) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden>
            <path d="M1.5 4l1.8 1.8L6.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {result.status} OK
        </span>
        {result.durationMs > 0 && (
          <span className="text-[9px] font-mono text-muted-foreground/40 pl-0.5">{result.durationMs}ms</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold font-mono bg-red-500/10 text-red-400 border border-red-500/20">
        <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden>
          <path d="M2 2l4 4M6 2l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {result.status || "ERR"}
      </span>
      {result.durationMs > 0 && (
        <span className="text-[9px] font-mono text-muted-foreground/40 pl-0.5">{result.durationMs}ms</span>
      )}
    </div>
  )
}

// ── Model list cell ───────────────────────────────────────────────────────────

function ModelCell({ provider, result }: { provider: string; result: MultiKeyResult | null }) {
  const models = PROVIDER_MODELS[provider] ?? []
  const defaultModel = models.find((m) => m.default) ?? models[0]
  const activeModelId = result?.modelUsed ?? defaultModel?.id ?? ""
  const activeModel = models.find((m) => m.id === activeModelId) ?? defaultModel

  if (!models.length) {
    return (
      <span className="text-[10px] text-muted-foreground/30 font-mono">—</span>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      {/* Active model */}
      <span className="text-[10px] font-medium text-foreground/80 truncate leading-tight">
        {activeModel?.label ?? activeModelId.split("/").pop() ?? "—"}
      </span>
      {/* Other models (collapsed chip list) */}
      {models.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap">
          {models
            .filter((m) => m.id !== activeModel?.id)
            .slice(0, 2)
            .map((m) => (
              <span
                key={m.id}
                className="text-[8px] font-mono text-muted-foreground/35 border border-border/30 rounded px-1 py-0 leading-tight truncate max-w-[80px]"
                title={m.label}
              >
                {m.label}
              </span>
            ))}
          {models.length > 3 && (
            <span className="text-[8px] text-muted-foreground/25">+{models.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ size = 12 }: { size?: number }) {
  return (
    <svg
      className="animate-spin text-muted-foreground/60"
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ── Expanded detail row ───────────────────────────────────────────────────────

function ExpandedRow({
  entry,
  result,
  colSpan,
}: {
  entry: ParsedEntry
  result: MultiKeyResult | null
  colSpan: number
}) {
  const models = PROVIDER_MODELS[entry.provider] ?? []

  return (
    <tr className="bg-secondary/20 border-b border-border/30">
      <td colSpan={colSpan} className="px-4 py-3">
        <div className="flex flex-col gap-2.5 text-[11px]">

          {/* Reply / Error */}
          {result?.chatReply && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40">Reply</span>
              <p className="text-foreground/70 leading-relaxed line-clamp-3">{result.chatReply}</p>
            </div>
          )}
          {result?.error && !result.ok && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-red-400/50">Error</span>
              <p className="text-red-400/70 font-mono text-[10px] leading-relaxed">{result.error}</p>
            </div>
          )}

          {/* Models available */}
          {models.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                Available Models ({models.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {models.map((m) => {
                  const isActive = result?.modelUsed
                    ? result.modelUsed === m.id
                    : m.default
                  return (
                    <span
                      key={m.id}
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border leading-tight ${
                        isActive
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-border/40 text-muted-foreground/50"
                      }`}
                    >
                      {m.label}
                      {isActive && <span className="ml-1 opacity-60">✓</span>}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Token breakdown */}
          {result?.tokenUsage && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40">Token Usage</span>
              <div className="flex items-center gap-4">
                {result.tokenUsage.promptTokens !== null && (
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] text-sky-400/60 font-semibold uppercase tracking-wider">Input</span>
                    <span className="text-[13px] font-mono font-bold text-sky-400">{result.tokenUsage.promptTokens.toLocaleString()}</span>
                  </div>
                )}
                {result.tokenUsage.completionTokens !== null && (
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] text-violet-400/60 font-semibold uppercase tracking-wider">Output</span>
                    <span className="text-[13px] font-mono font-bold text-violet-400">{result.tokenUsage.completionTokens.toLocaleString()}</span>
                  </div>
                )}
                {result.tokenUsage.totalTokens !== null && (
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Total</span>
                    <span className="text-[13px] font-mono font-bold text-foreground/60">{result.tokenUsage.totalTokens.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Model used */}
          {result?.modelUsed && (
            <div className="text-[9px] font-mono text-muted-foreground/40">
              Model used: <span className="text-muted-foreground/60">{result.modelUsed}</span>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MultiKeyBatch() {
  const [entries, setEntries]         = useState<ParsedEntry[]>([])
  const [prompt, setPrompt]           = useState("halo")
  const [running, setRunning]         = useState(false)
  const [results, setResults]         = useState<MultiKeyResult[]>([])
  const [summary, setSummary]         = useState<{ passed: number; failed: number; totalMs: number } | null>(null)
  const [dragOver, setDragOver]       = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [manualInput, setManualInput] = useState("")
  const [showManual, setShowManual]   = useState(false)
  const [showGuide, setShowGuide]     = useState(false)
  const [copiedId, setCopiedId]       = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  function toggleExpand(idx: number) {
    setExpandedIdx((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  function copyAllFormats() {
    const lines = PROVIDER_FORMATS.map((p) => `${p.example}`)
    copyText(lines.join("\n"), "all")
  }

  function loadText(text: string) {
    const parsed = parseLines(text)
    setEntries(parsed)
    setResults([])
    setSummary(null)
    setError(null)
    setExpandedIdx(new Set())
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
      setError("Only .txt files are supported.")
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => loadText(e.target?.result as string ?? "")
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleManualApply() {
    loadText(manualInput)
    setShowManual(false)
  }

  function removeEntry(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx))
    setExpandedIdx((prev) => {
      const next = new Set<number>()
      prev.forEach((i) => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1) })
      return next
    })
  }

  const runAll = useCallback(async () => {
    const valid = entries.filter((e) => !e.unknown && e.provider !== "?")
    if (!valid.length || running) return

    setRunning(true)
    setResults([])
    setSummary(null)
    setError(null)

    try {
      const res = await fetch("/api/multi-key-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim() || "halo",
          entries: valid.map((e) => ({ provider: e.provider, apiKey: e.apiKey })),
        }),
      })
      const data: MultiKeyTestResponse = await res.json()
      setResults(data.results)
      setSummary({ passed: data.passed, failed: data.failed, totalMs: data.totalMs })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setRunning(false)
    }
  }, [entries, prompt, running])

  function exportResults() {
    if (!results.length) return
    const header = `# Multi-Key Batch Test Results\n# Generated: ${new Date().toISOString()}\n# Format: Provider | Key | Status | Code | Model | Tokens (in+out) | Duration | Reply\n\n`
    const lines = results.map((r) => {
      const tokens = r.tokenUsage
        ? `${r.tokenUsage.promptTokens ?? "?"}+${r.tokenUsage.completionTokens ?? "?"}=${r.tokenUsage.totalTokens ?? "?"}`
        : "—"
      return `${r.provider} | ${r.apiKeyMasked} | ${r.ok ? "OK" : "FAIL"} | ${r.status} | ${r.modelUsed ?? "—"} | ${tokens} | ${r.durationMs}ms | ${r.chatReply ? r.chatReply.slice(0, 80).replace(/\n/g, " ") : r.error ?? ""}`
    })
    const blob = new Blob([header + lines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `batch-results-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const validCount = entries.filter((e) => !e.unknown).length
  const unknownCount = entries.filter((e) => e.unknown).length

  // Stats for summary bar
  const totalTokens = results.reduce((acc, r) => acc + (r.tokenUsage?.totalTokens ?? 0), 0)
  const avgLatency = results.length
    ? Math.round(results.reduce((a, r) => a + r.durationMs, 0) / results.length)
    : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div>
          <p className="text-xs font-semibold text-foreground tracking-tight">Multi-Key Batch Test</p>
          <p className="text-[10px] text-muted-foreground">
            Import a .txt file with API keys — all providers tested simultaneously
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {results.length > 0 && (
            <button
              onClick={exportResults}
              className="text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors"
            >
              Export .txt
            </button>
          )}
          {entries.length > 0 && (
            <button
              onClick={() => { setEntries([]); setResults([]); setSummary(null); setExpandedIdx(new Set()) }}
              className="text-[10px] font-medium text-muted-foreground hover:text-destructive border border-border rounded px-2 py-1 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 px-4 py-4">

        {/* ── Drop zone ──────────────────────────────────────────────────────── */}
        {entries.length === 0 && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-10 px-4 text-center select-none ${
              dragOver
                ? "border-primary/60 bg-primary/5"
                : "border-border hover:border-border/80 hover:bg-secondary/30"
            }`}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-muted-foreground/40" aria-hidden>
              <rect x="6" y="4" width="20" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 10h12M10 14h12M10 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div>
              <p className="text-sm font-medium text-foreground">Drop a .txt file or click to browse</p>
              <p className="text-[11px] text-muted-foreground mt-1">One key per line. Formats accepted:</p>
              <div className="mt-2 text-left inline-block bg-secondary/50 rounded px-3 py-2 text-[10px] font-mono text-muted-foreground space-y-0.5">
                <p className="text-foreground/60"># Format options:</p>
                <p>provider:apikey &nbsp;&nbsp;&nbsp;&nbsp;→ &nbsp;anthropic:sk-ant-...</p>
                <p>provider apikey &nbsp;&nbsp;&nbsp;&nbsp;→ &nbsp;openai sk-...</p>
                <p>apikey &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ &nbsp;sk-or-v1-... (auto-detect)</p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>
        )}

        {/* ── Manual input ─────────────────────────────────────────────────── */}
        {entries.length === 0 && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowManual((v) => !v)}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 self-start transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${showManual ? "rotate-90" : ""}`} aria-hidden>
                <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Or paste keys manually
            </button>
            {showManual && (
              <div className="flex flex-col gap-2">
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  rows={6}
                  placeholder={"anthropic:sk-ant-...\nopenai:sk-...\nsk-or-v1-..."}
                  className="w-full rounded-md border border-border bg-background text-foreground text-[11px] font-mono px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 resize-none"
                />
                <button
                  onClick={handleManualApply}
                  disabled={!manualInput.trim()}
                  className="self-start text-[11px] font-medium bg-primary text-primary-foreground rounded px-3 py-1.5 hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  Load keys
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Provider Format Guide ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-border overflow-hidden flex-shrink-0">
          <button
            onClick={() => setShowGuide((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-secondary/40 hover:bg-secondary/60 transition-colors"
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold text-foreground">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted-foreground" aria-hidden>
                <rect x="1" y="2" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3 5h6M3 7h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Provider Format Guide
              <span className="text-[9px] font-normal text-muted-foreground/50">{PROVIDER_FORMATS.length} providers</span>
            </span>
            <div className="flex items-center gap-2">
              {showGuide && (
                <button
                  onClick={(e) => { e.stopPropagation(); copyAllFormats() }}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-colors ${
                    copiedId === "all"
                      ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/10"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                  }`}
                >
                  {copiedId === "all" ? "Copied!" : "Copy All"}
                </button>
              )}
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                className={`text-muted-foreground/60 transition-transform ${showGuide ? "rotate-180" : ""}`}
                aria-hidden
              >
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>
          {showGuide && (
            <div className="overflow-y-auto max-h-72 divide-y divide-border/40">
              {PROVIDER_FORMATS.map((pf) => {
                const models = PROVIDER_MODELS[pf.id] ?? []
                return (
                  <div key={pf.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-secondary/20 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-base leading-none select-none" aria-hidden>{pf.flag}</span>
                        <span className="text-[11px] font-medium text-foreground">{pf.label}</span>
                        {pf.autoDetect && (
                          <span className="text-[8px] px-1 rounded bg-primary/10 text-primary font-semibold">auto</span>
                        )}
                      </div>
                      <code className="text-[10px] font-mono text-muted-foreground/60 block mt-0.5">{pf.example}</code>
                      {/* Models list inline */}
                      {models.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {models.map((m) => (
                            <span
                              key={m.id}
                              className={`text-[8px] font-mono px-1 py-0 rounded border leading-tight ${
                                m.default
                                  ? "border-emerald-500/25 text-emerald-400/60 bg-emerald-500/5"
                                  : "border-border/30 text-muted-foreground/35"
                              }`}
                            >
                              {m.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => copyText(pf.example, pf.id)}
                      title={`Copy format for ${pf.label}`}
                      className={`flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-all ${
                        copiedId === pf.id
                          ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/10"
                          : "border-border/60 text-muted-foreground/50 hover:text-foreground hover:border-border opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {copiedId === pf.id ? "Copied" : "Copy"}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Loaded entries section ────────────────────────────────────────── */}
        {entries.length > 0 && (
          <div className="flex flex-col gap-3">

            {/* Prompt + Run */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 block mb-1">
                  Test Prompt
                </label>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="halo"
                  className="w-full rounded-md border border-border bg-background text-foreground text-[12px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
                />
              </div>
              <button
                onClick={runAll}
                disabled={running || validCount === 0}
                className="flex-shrink-0 flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-40 transition-opacity mt-5 sm:mt-0"
              >
                {running ? <Spinner size={12} /> : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path d="M2 2l8 4-8 4V2z" fill="currentColor" />
                  </svg>
                )}
                {running ? "Testing…" : `Run All (${validCount})`}
              </button>
            </div>

            {/* ── Summary dashboard ────────────────────────────────────────── */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Passed */}
                <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-emerald-400/50">Passed</span>
                  <span className="text-lg font-bold font-mono text-emerald-400 leading-none">{summary.passed}</span>
                  <span className="text-[9px] text-emerald-400/40">{Math.round((summary.passed / results.length) * 100)}%</span>
                </div>
                {/* Failed */}
                <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-red-400/50">Failed</span>
                  <span className="text-lg font-bold font-mono text-red-400 leading-none">{summary.failed}</span>
                  <span className="text-[9px] text-red-400/40">{Math.round((summary.failed / results.length) * 100)}%</span>
                </div>
                {/* Total tokens */}
                <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40">Total Tokens</span>
                  <span className="text-lg font-bold font-mono text-foreground/70 leading-none">
                    {totalTokens > 0 ? totalTokens.toLocaleString() : "—"}
                  </span>
                  <span className="text-[9px] text-muted-foreground/30">across all keys</span>
                </div>
                {/* Avg latency */}
                <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40">Avg Latency</span>
                  <span className="text-lg font-bold font-mono text-foreground/70 leading-none">{avgLatency}ms</span>
                  <span className="text-[9px] text-muted-foreground/30">{summary.totalMs}ms total</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-[11px] text-destructive">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0" aria-hidden>
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M6 3.5v3M6 8v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {error}
              </div>
            )}

            {/* ── Main results table ────────────────────────────────────────── */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border bg-secondary/60">
                    <th className="text-left px-2 py-2.5 font-semibold text-muted-foreground/50 uppercase tracking-wider text-[8px] w-7">#</th>
                    <th className="text-left px-2 py-2.5 font-semibold text-muted-foreground/50 uppercase tracking-wider text-[8px]">Provider</th>
                    <th className="text-left px-2 py-2.5 font-semibold text-muted-foreground/50 uppercase tracking-wider text-[8px]">Key</th>
                    <th className="text-left px-2 py-2.5 font-semibold text-muted-foreground/50 uppercase tracking-wider text-[8px]">Model</th>
                    <th className="text-left px-2 py-2.5 font-semibold text-muted-foreground/50 uppercase tracking-wider text-[8px]">Status</th>
                    <th className="text-left px-2 py-2.5 font-semibold text-muted-foreground/50 uppercase tracking-wider text-[8px]">
                      <div className="flex flex-col">
                        <span>Tokens</span>
                        <span className="text-[7px] font-normal text-muted-foreground/30 normal-case tracking-normal flex gap-1.5">
                          <span className="text-sky-400/50">in</span>
                          <span className="text-violet-400/50">out</span>
                        </span>
                      </div>
                    </th>
                    <th className="w-7 px-1.5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => {
                    const res = results.find(
                      (r) => r.provider === entry.provider && r.apiKeyMasked.startsWith(entry.apiKey.slice(0, 8))
                    )
                    const isRunning = running && !res
                    const isExpanded = expandedIdx.has(idx)
                    const providerInfo = PROVIDER_FORMATS.find((p) => p.id === entry.provider)

                    return (
                      <>
                        <tr
                          key={`row-${idx}`}
                          onClick={() => (res || entry.unknown) && toggleExpand(idx)}
                          className={`border-b border-border/40 last:border-0 transition-colors ${
                            res?.ok
                              ? "bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04]"
                              : res && !res.ok
                                ? "bg-red-500/[0.02] hover:bg-red-500/[0.04]"
                                : "hover:bg-secondary/20"
                          } ${(res || entry.unknown) ? "cursor-pointer" : ""}`}
                        >
                          {/* # */}
                          <td className="px-2 py-2.5 text-muted-foreground/30 font-mono text-[10px]">{idx + 1}</td>

                          {/* Provider */}
                          <td className="px-2 py-2.5">
                            {entry.unknown ? (
                              <span className="text-yellow-400/70 font-mono text-[10px]">? unknown</span>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-foreground text-[10px] leading-tight">
                                  {providerInfo?.label ?? entry.provider}
                                </span>
                                {providerInfo?.country && (
                                  <span className="text-[8px] text-muted-foreground/35 font-mono uppercase">{providerInfo.country}</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Key */}
                          <td className="px-2 py-2.5 font-mono text-muted-foreground/50 text-[10px]">
                            {entry.apiKey.slice(0, 8)}
                            {"•".repeat(Math.min(6, Math.max(0, entry.apiKey.length - 8)))}
                            {entry.detected && (
                              <span className="ml-1 text-[8px] text-primary/40">auto</span>
                            )}
                          </td>

                          {/* Model */}
                          <td className="px-2 py-2.5 max-w-[110px]">
                            {isRunning ? (
                              <div className="flex items-center gap-1.5">
                                <Spinner size={10} />
                                <span className="text-[9px] text-muted-foreground/40">testing…</span>
                              </div>
                            ) : (
                              <ModelCell provider={entry.provider} result={res ?? null} />
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-2 py-2.5">
                            {isRunning ? (
                              <Spinner size={10} />
                            ) : (
                              <StatusPill result={res ?? null} />
                            )}
                          </td>

                          {/* Tokens */}
                          <td className="px-2 py-2.5">
                            {isRunning ? (
                              <span className="text-[10px] text-muted-foreground/20">…</span>
                            ) : (
                              <TokenBadge usage={res?.tokenUsage} />
                            )}
                          </td>

                          {/* Expand / Remove */}
                          <td className="px-1.5 py-2.5">
                            <div className="flex flex-col items-center gap-1">
                              {(res || entry.unknown) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleExpand(idx) }}
                                  className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                                  title={isExpanded ? "Collapse" : "Expand"}
                                  aria-label={isExpanded ? "Collapse row" : "Expand row"}
                                >
                                  <svg
                                    width="9" height="9" viewBox="0 0 10 10" fill="none"
                                    className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                    aria-hidden
                                  >
                                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); removeEntry(idx) }}
                                className="text-muted-foreground/20 hover:text-destructive transition-colors"
                                title="Remove"
                                aria-label="Remove entry"
                              >
                                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
                                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <ExpandedRow
                            key={`expand-${idx}`}
                            entry={entry}
                            result={res ?? null}
                            colSpan={7}
                          />
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Unknown keys warning */}
            {unknownCount > 0 && (
              <p className="text-[10px] text-yellow-400/70 border border-yellow-400/15 bg-yellow-400/5 rounded px-3 py-2">
                {unknownCount} {unknownCount === 1 ? "entry" : "entries"} skipped — provider could not be detected. Use format:{" "}
                <code className="font-mono">provider:apikey</code>
              </p>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
