"use client"

import { useState, useRef, useCallback } from "react"
import type { MultiKeyResult, MultiKeyTestResponse } from "@/app/api/multi-key-test/route"

// ── Supported provider IDs (must match manual-test BODY_TEMPLATES) ────────────

const KNOWN_PROVIDERS = [
  "dahono", "anthropic", "openai", "google", "xai", "deepseek", "qwen",
  "zhipu", "minimax", "cerebras", "fireworks", "novita", "cloudflare",
  "openrouter", "sambanova", "nvidia", "hyperbolic", "ai21", "groq",
  "together", "mistral", "cohere", "perplexity", "huggingface", "replicate",
  "moonshot", "baidu", "yi", "stepfun", "hunyuan", "azure", "upstage",
  "writer", "lepton", "inception", "ibm", "deepinfra", "anyscale",
]

// ── Parse a .txt file ─────────────────────────────────────────────────────────
//
// Supported formats (one entry per line):
//   provider:apikey          → provider:sk-ant-...
//   apikey                   → sk-or-v1-... (provider auto-detected by prefix)
//   provider apikey          → openai sk-...
//
// Blank lines and lines starting with # are ignored.

interface ParsedEntry {
  provider: string
  apiKey: string
  raw: string
  detected: boolean   // true if provider was auto-detected from key prefix
  unknown: boolean    // true if provider could not be identified
}

function detectProvider(key: string): string | null {
  const k = key.trim()
  if (k.startsWith("sk-ant-"))             return "anthropic"
  if (k.startsWith("sk-") && k.length > 40) return "openai"
  if (k.startsWith("AIza"))               return "google"
  if (k.startsWith("xai-"))               return "xai"
  if (k.startsWith("sk-or-"))             return "openrouter"
  if (k.startsWith("gsk_"))               return "groq"
  if (k.startsWith("r8_"))                return "replicate"
  if (k.startsWith("pat-"))               return "huggingface"
  return null
}

function parseLines(text: string): ParsedEntry[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((raw) => {
      // Format 1: "provider:apikey"
      const colonIdx = raw.indexOf(":")
      if (colonIdx > 0) {
        const left = raw.slice(0, colonIdx).trim().toLowerCase()
        const right = raw.slice(colonIdx + 1).trim()
        if (KNOWN_PROVIDERS.includes(left) && right) {
          return { provider: left, apiKey: right, raw, detected: false, unknown: false }
        }
        // Could be a key that starts with "sk-ant-..." etc. — treat whole line as key
      }

      // Format 2: "provider apikey"
      const spaceIdx = raw.indexOf(" ")
      if (spaceIdx > 0) {
        const left = raw.slice(0, spaceIdx).trim().toLowerCase()
        const right = raw.slice(spaceIdx + 1).trim()
        if (KNOWN_PROVIDERS.includes(left) && right) {
          return { provider: left, apiKey: right, raw, detected: false, unknown: false }
        }
      }

      // Format 3: bare API key — auto-detect provider
      const detected = detectProvider(raw)
      if (detected) {
        return { provider: detected, apiKey: raw, raw, detected: true, unknown: false }
      }

      // Unknown
      return { provider: "?", apiKey: raw, raw, detected: false, unknown: true }
    })
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ result }: { result: MultiKeyResult | null; running?: boolean }) {
  if (!result) return <span className="text-[10px] text-muted-foreground/40">—</span>
  if (result.ok) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
          <circle cx="4" cy="4" r="3" fill="currentColor" opacity=".3" />
          <path d="M2 4l1.3 1.3L6 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {result.status}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-red-400">
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
        <circle cx="4" cy="4" r="3" fill="currentColor" opacity=".3" />
        <path d="M2.5 2.5l3 3M5.5 2.5l-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      {result.status || "Err"}
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-3 h-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MultiKeyBatch() {
  const [entries, setEntries]       = useState<ParsedEntry[]>([])
  const [prompt, setPrompt]         = useState("halo")
  const [running, setRunning]       = useState(false)
  const [results, setResults]       = useState<MultiKeyResult[]>([])
  const [summary, setSummary]       = useState<{ passed: number; failed: number; totalMs: number } | null>(null)
  const [dragOver, setDragOver]     = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [manualInput, setManualInput] = useState("")
  const [showManual, setShowManual] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Parse & load entries ──────────────────────────────────────────────────

  function loadText(text: string) {
    const parsed = parseLines(text)
    setEntries(parsed)
    setResults([])
    setSummary(null)
    setError(null)
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
  }

  // ── Run all ───────────────────────────────────────────────────────────────

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

  // ── Export results as .txt ────────────────────────────────────────────────

  function exportResults() {
    if (!results.length) return
    const lines = results.map((r) =>
      `${r.provider} | ${r.apiKey} | ${r.ok ? "OK" : "FAIL"} | ${r.status} | ${r.durationMs}ms | ${r.chatReply ? r.chatReply.slice(0, 60).replace(/\n/g, " ") : r.error ?? ""}`
    )
    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `multi-key-results-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const validCount = entries.filter((e) => !e.unknown).length
  const unknownCount = entries.filter((e) => e.unknown).length

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div>
          <p className="text-xs font-semibold text-foreground">Multi-Key Batch Test</p>
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
              onClick={() => { setEntries([]); setResults([]); setSummary(null) }}
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
              <p className="text-[11px] text-muted-foreground mt-1">
                One key per line. Formats accepted:
              </p>
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

        {/* ── Manual input toggle ──────────────────────────────────────────── */}
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

        {/* ── Loaded entries table ─────────────────────────────────────────── */}
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
                {running ? <Spinner /> : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path d="M2 2l8 4-8 4V2z" fill="currentColor" />
                  </svg>
                )}
                {running ? "Testing…" : `Run All (${validCount})`}
              </button>
            </div>

            {/* Summary bar */}
            {summary && (
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/50 border border-border text-[11px]">
                <span className="text-emerald-400 font-semibold">{summary.passed} passed</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-red-400 font-semibold">{summary.failed} failed</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-muted-foreground">{summary.totalMs}ms total</span>
                <span className="ml-auto text-muted-foreground/50">{results.length} entries</span>
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

            {/* Keys table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground/60 uppercase tracking-wider text-[9px] w-8">#</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground/60 uppercase tracking-wider text-[9px]">Provider</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground/60 uppercase tracking-wider text-[9px]">Key</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground/60 uppercase tracking-wider text-[9px]">Status</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground/60 uppercase tracking-wider text-[9px] hidden sm:table-cell">Reply</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground/60 uppercase tracking-wider text-[9px] hidden sm:table-cell">ms</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => {
                    const res = results.find(
                      (r) => r.provider === entry.provider && r.apiKey.startsWith(entry.apiKey.slice(0, 8))
                    )
                    const isRunning = running && !res
                    return (
                      <tr
                        key={idx}
                        className={`border-b border-border/50 last:border-0 transition-colors ${
                          res?.ok ? "bg-emerald-500/3" : res && !res.ok ? "bg-red-500/3" : ""
                        }`}
                      >
                        <td className="px-3 py-2 text-muted-foreground/40 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2">
                          {entry.unknown ? (
                            <span className="text-yellow-400/80 font-mono">? unknown</span>
                          ) : (
                            <span className="font-medium text-foreground font-mono">
                              {entry.provider}
                              {entry.detected && (
                                <span className="ml-1 text-[9px] text-muted-foreground/40 font-normal">auto</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground/60">
                          {entry.apiKey.slice(0, 10)}{"•".repeat(Math.min(6, Math.max(0, entry.apiKey.length - 10)))}
                        </td>
                        <td className="px-3 py-2">
                          {isRunning ? <Spinner /> : <StatusBadge result={res ?? null} />}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground/70 max-w-[180px] truncate hidden sm:table-cell">
                          {res?.chatReply ? res.chatReply.slice(0, 60) : res?.error ?? ""}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground/50 font-mono hidden sm:table-cell">
                          {res?.durationMs ? `${res.durationMs}` : ""}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => removeEntry(idx)}
                            className="text-muted-foreground/30 hover:text-destructive transition-colors"
                            title="Remove"
                            aria-label="Remove entry"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Unknown keys warning */}
            {unknownCount > 0 && (
              <p className="text-[10px] text-yellow-400/70 border border-yellow-400/15 bg-yellow-400/5 rounded px-3 py-2">
                {unknownCount} {unknownCount === 1 ? "entry" : "entries"} skipped — provider could not be detected. Use format: <code className="font-mono">provider:apikey</code>
              </p>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
