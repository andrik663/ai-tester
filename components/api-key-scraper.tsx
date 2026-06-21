"use client"

import { useState } from "react"
import type { ScrapedKey } from "@/app/api/scrape-keys/route"

// ── Icons ──────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 11-8 8z" />
    </svg>
  )
}

function CopyIcon({ size = "sm" }: { size?: "sm" | "xs" }) {
  const cls = size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5"
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 8.5l-5-5-5.5 5.5" />
      <path d="M15.5 2.5l1 1" />
      <path d="M18 5l1 1" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

// ── Label colour map ───────────────────────────────────────────────────────

const LABEL_COLORS: Record<string, string> = {
  "Google API Key": "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  "OpenAI API Key": "text-green-400 bg-green-400/10 border-green-400/30",
  "OpenAI Project Key": "text-green-400 bg-green-400/10 border-green-400/30",
  "Anthropic API Key": "text-orange-400 bg-orange-400/10 border-orange-400/30",
  "HuggingFace Token": "text-yellow-300 bg-yellow-300/10 border-yellow-300/30",
  "Groq API Key": "text-purple-400 bg-purple-400/10 border-purple-400/30",
  "AWS Access Key": "text-orange-500 bg-orange-500/10 border-orange-500/30",
  "GitHub Token": "text-slate-300 bg-slate-300/10 border-slate-300/30",
  "GitHub Fine-grained Token": "text-slate-300 bg-slate-300/10 border-slate-300/30",
  "Stripe Secret Key": "text-blue-400 bg-blue-400/10 border-blue-400/30",
  "Stripe Publishable Key": "text-blue-300 bg-blue-300/10 border-blue-300/30",
  "Stripe Test Key": "text-blue-300 bg-blue-300/10 border-blue-300/30",
  default: "text-primary bg-primary/10 border-primary/30",
}

function labelColor(label: string) {
  return LABEL_COLORS[label] ?? LABEL_COLORS.default
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KeyCard({ item, index }: { item: ScrapedKey; index: number }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [masked, setMasked] = useState(true)

  function copy() {
    navigator.clipboard.writeText(item.value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const maskedValue = item.value.slice(0, 6) + "•".repeat(Math.max(4, item.value.length - 10)) + item.value.slice(-4)

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <span className="text-[10px] font-mono text-muted-foreground w-5 flex-shrink-0">{index + 1}</span>

        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${labelColor(item.label)} flex-shrink-0`}>
          <KeyIcon />
          {item.label}
        </span>

        <code className="flex-1 min-w-0 text-xs font-mono text-foreground truncate">
          {masked ? maskedValue : item.value}
        </code>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setMasked((v) => !v)}
            title={masked ? "Reveal key" : "Mask key"}
            className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary transition-colors"
          >
            {masked ? "Show" : "Hide"}
          </button>
          <button
            onClick={copy}
            title="Copy key"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary transition-colors"
          >
            <CopyIcon size="xs" />
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            title="Toggle context"
            className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-secondary transition-colors"
          >
            <ChevronIcon open={expanded} />
          </button>
        </div>
      </div>

      {/* Context row */}
      {expanded && (
        <div className="px-3.5 pb-3 border-t border-border pt-2.5 bg-card">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Source context</p>
          <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
            {item.context}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface ScrapeResult {
  url: string
  fetchedAt: string
  totalFound: number
  keys: ScrapedKey[]
  scannedBytes: number
  scannedJsFiles: number
}

const EXAMPLE_URLS = [
  "https://aisure.uk",
  "https://platform.openai.com",
  "https://console.anthropic.com",
]

export default function ApiKeyScraper() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filterText, setFilterText] = useState("")
  const [copiedAll, setCopiedAll] = useState(false)

  async function runScrape() {
    const trimmed = url.trim()
    if (!trimmed || loading) return

    let target = trimmed
    if (!/^https?:\/\//i.test(target)) target = "https://" + target

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/scrape-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setResult(data as ScrapeResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") runScrape()
  }

  function copyAll() {
    if (!result) return
    const text = result.keys.map((k) => `[${k.label}]\n${k.value}`).join("\n\n")
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 1500)
    })
  }

  function downloadAll() {
    if (!result) return
    const lines = [`# API Keys scraped from: ${result.url}`, `# Date: ${result.fetchedAt}`, `# Total: ${result.totalFound}`, ""]
    result.keys.forEach((k, i) => {
      lines.push(`## ${i + 1}. ${k.label}`)
      lines.push(`VALUE: ${k.value}`)
      lines.push(`CONTEXT: ${k.context}`)
      lines.push("")
    })
    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "scraped-keys.txt"
    a.click()
  }

  const filtered = result
    ? result.keys.filter(
        (k) =>
          !filterText ||
          k.label.toLowerCase().includes(filterText.toLowerCase()) ||
          k.value.toLowerCase().includes(filterText.toLowerCase())
      )
    : []

  return (
    <div className="flex h-full bg-background text-foreground font-sans overflow-hidden">

      {/* LEFT panel — controls */}
      <aside className="w-72 flex-shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">
        <div className="px-4 py-4 border-b border-border">
          <p className="text-xs font-semibold text-foreground">API Key Scraper</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Scan any webpage for exposed API keys</p>
        </div>

        <div className="flex-1 px-4 py-4 flex flex-col gap-5">

          {/* URL input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Target URL</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                <GlobeIcon />
              </span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://example.com"
                className="w-full rounded-md border border-border bg-background text-foreground text-xs px-3 py-2 pl-8 font-mono focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runScrape}
            disabled={loading || !url.trim()}
            className="flex items-center justify-center gap-2 w-full rounded-md bg-primary text-primary-foreground text-xs font-semibold py-2.5 hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {loading ? (
              <>
                <SpinnerIcon />
                Scanning...
              </>
            ) : (
              <>
                <SearchIcon />
                Run Scan
              </>
            )}
          </button>

          {/* Examples */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Examples</p>
            <div className="flex flex-col gap-1">
              {EXAMPLE_URLS.map((u) => (
                <button
                  key={u}
                  onClick={() => setUrl(u)}
                  className="text-left text-[11px] font-mono text-muted-foreground hover:text-primary truncate px-2 py-1 rounded hover:bg-secondary transition-colors"
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          {result && (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Scan Results</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <StatItem label="Keys found" value={result.totalFound.toString()} highlight={result.totalFound > 0} />
                <StatItem label="JS files" value={result.scannedJsFiles.toString()} />
                <StatItem label="Scanned" value={formatBytes(result.scannedBytes)} />
                <StatItem label="Fetched" value={new Date(result.fetchedAt).toLocaleTimeString()} />
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="rounded-md border border-border bg-background p-3 flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">How it works</p>
            <ul className="flex flex-col gap-1">
              {[
                "Fetches the page HTML",
                "Discovers inline script tags",
                "Fetches up to 5 external JS files",
                "Matches 18+ key patterns",
                "Deduplicates results",
              ].map((step) => (
                <li key={step} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                  <span className="text-primary mt-0.5">›</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* RIGHT panel — results */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {result ? (
              <>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${result.totalFound > 0 ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
                <span className="text-xs font-mono text-muted-foreground truncate">{result.url}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${result.totalFound > 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {result.totalFound} found
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">No scan yet — enter a URL and click Run Scan</span>
            )}
          </div>

          {result && result.totalFound > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  placeholder="Filter keys..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="text-xs rounded-md border border-border bg-background text-foreground pl-7 pr-3 py-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>
              <button
                onClick={copyAll}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-secondary transition-colors"
              >
                <CopyIcon />
                {copiedAll ? "Copied!" : "Copy All"}
              </button>
              <button
                onClick={downloadAll}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-secondary transition-colors"
              >
                <DownloadIcon />
                Export
              </button>
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* Empty state */}
          {!result && !loading && !error && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center">
                <KeyIcon />
              </div>
              <div>
                <p className="text-foreground font-semibold">API Key Scraper</p>
                <p className="text-muted-foreground text-sm mt-1 leading-relaxed max-w-sm">
                  Enter a URL in the left panel and click{" "}
                  <span className="text-primary font-medium">Run Scan</span> to detect exposed API keys
                  in the page source and linked JavaScript files.
                </p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
              <SpinnerIcon />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Scanning...</p>
                <p className="text-xs text-muted-foreground mt-1">Fetching page and JS files, scanning for key patterns</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-4 max-w-xl">
              <p className="text-sm font-semibold text-destructive mb-1">Scan failed</p>
              <p className="text-xs font-mono text-destructive/80">{error}</p>
            </div>
          )}

          {/* No keys found */}
          {result && result.totalFound === 0 && !loading && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground">
                <KeyIcon />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No API keys found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                  No recognised API key patterns were detected in the page HTML or linked JS files.
                  The site may use server-side rendering or obfuscation.
                </p>
              </div>
              <div className="text-xs text-muted-foreground font-mono bg-card border border-border rounded-lg px-3 py-2">
                Scanned {formatBytes(result.scannedBytes)} across {result.scannedJsFiles + 1} file(s)
              </div>
            </div>
          )}

          {/* Results list */}
          {result && filtered.length > 0 && (
            <div className="flex flex-col gap-2 max-w-3xl">
              {filterText && filtered.length !== result.totalFound && (
                <p className="text-[11px] text-muted-foreground mb-1">
                  Showing {filtered.length} of {result.totalFound} keys
                </p>
              )}
              {filtered.map((item, i) => (
                <KeyCard key={i} item={item} index={i} />
              ))}
            </div>
          )}

          {/* Filter no match */}
          {result && result.totalFound > 0 && filtered.length === 0 && filterText && (
            <p className="text-sm text-muted-foreground mt-8">No keys match &ldquo;{filterText}&rdquo;</p>
          )}
        </div>
      </main>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function StatItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-xs font-mono font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
