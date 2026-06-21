import { NextRequest, NextResponse } from "next/server"

// ── Rate limiting (in-memory, per-IP) ────────────────────────────────────────
const RATE_MAP = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10           // max requests
const RATE_WINDOW = 60_000      // per 60 seconds

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = RATE_MAP.get(ip)
  if (!entry || now > entry.resetAt) {
    RATE_MAP.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// ── SSRF blocklist ────────────────────────────────────────────────────────────
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^0\./,
]

async function isPrivateHost(hostname: string): Promise<boolean> {
  // Block common internal hostnames
  const lc = hostname.toLowerCase()
  if (
    lc === "localhost" ||
    lc === "metadata.google.internal" ||
    lc.endsWith(".internal") ||
    lc.endsWith(".local")
  )
    return true

  // For plain IP addresses, check against private ranges
  if (/^[\d.:a-f]+$/i.test(hostname)) {
    return PRIVATE_IP_PATTERNS.some((p) => p.test(hostname))
  }

  return false
}

// ── User-Agent rotation ───────────────────────────────────────────────────────
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

// ── Key patterns (same as before, unchanged) ─────────────────────────────────
const KEY_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "Google / Firebase API Key", pattern: /AIza[0-9A-Za-z\-_]{35}/g },
  { label: "Google Analytics ID",       pattern: /G-[A-Z0-9]{8,12}/g },
  { label: "Google OAuth Token",        pattern: /ya29\.[A-Za-z0-9\-_]{50,}/g },
  { label: "OpenAI Project Key",        pattern: /sk-proj-[A-Za-z0-9\-_]{40,120}/g },
  { label: "OpenAI API Key",            pattern: /sk-[A-Za-z0-9]{48,}/g },
  { label: "Anthropic API Key",         pattern: /sk-ant-[A-Za-z0-9\-_]{40,120}/g },
  { label: "HuggingFace Token",         pattern: /hf_[A-Za-z0-9]{30,50}/g },
  { label: "Groq API Key",              pattern: /gsk_[A-Za-z0-9]{40,60}/g },
  { label: "Cohere API Key",            pattern: /(?:cohere[_-]?api[_-]?key|CO_API_KEY|cohere[_-]?key)\s*[:=]\s*["']([A-Za-z0-9\-_]{32,64})['"]/gi },
  { label: "AWS Access Key ID",         pattern: /(?:AKIA|AIPA|ASIA)[0-9A-Z]{16}/g },
  { label: "AWS Secret Key",            pattern: /(?:aws[_-]?secret|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["']([A-Za-z0-9\/+]{40})['"]/gi },
  { label: "GitHub Token",              pattern: /ghp_[A-Za-z0-9]{36}/g },
  { label: "GitHub Fine-grained Token", pattern: /github_pat_[A-Za-z0-9_]{59,}/g },
  { label: "GitHub Actions Token",      pattern: /ghs_[A-Za-z0-9]{36}/g },
  { label: "Stripe Secret Key",         pattern: /sk_live_[0-9a-zA-Z]{24,}/g },
  { label: "Stripe Publishable Key",    pattern: /pk_live_[0-9a-zA-Z]{24,}/g },
  { label: "Stripe Test Secret Key",    pattern: /sk_test_[0-9a-zA-Z]{24,}/g },
  { label: "Stripe Test Pub Key",       pattern: /pk_test_[0-9a-zA-Z]{24,}/g },
  { label: "Twilio Account SID",        pattern: /AC[a-f0-9]{32}/g },
  { label: "Twilio API Key SID",        pattern: /SK[a-f0-9]{32}/g },
  { label: "Dahono API Key",            pattern: /dahono-[A-Za-z0-9]{8,64}/g },
  { label: "DeepSeek API Key",          pattern: /sk-[a-f0-9]{32}(?![A-Za-z0-9])/g },
  { label: "xAI API Key",               pattern: /xai-[A-Za-z0-9\-_]{30,80}/g },
  { label: "MiniMax API Key",           pattern: /eyJ[A-Za-z0-9\-_]{40,}\.eyJ[A-Za-z0-9\-_]{40,}\.[A-Za-z0-9\-_]{40,}/g },
  { label: "Together AI Key",           pattern: /(?:TOGETHER_API_KEY|together[_-]?api[_-]?key)\s*[:=]\s*["']([A-Za-z0-9\-_]{40,80})['"]/gi },
  { label: "Mistral API Key",           pattern: /(?:MISTRAL_API_KEY|mistral[_-]?api[_-]?key)\s*[:=]\s*["']([A-Za-z0-9]{32,64})['"]/gi },
  { label: "Replicate API Token",       pattern: /r8_[A-Za-z0-9]{37}/g },
  { label: "Perplexity API Key",        pattern: /pplx-[A-Za-z0-9]{48}/g },
  { label: "Generic API Key",           pattern: /(?:["']?api[_-]?key["']?\s*[:=]\s*["'])([A-Za-z0-9\-_\.]{24,})['"]/gi },
  { label: "Generic Secret",            pattern: /(?:["']?(?:client[_-]?secret|app[_-]?secret)["']?\s*[:=]\s*["'])([A-Za-z0-9\-_\.]{24,})['"]/gi },
  { label: "Generic Token",             pattern: /(?:["']?access[_-]?token["']?\s*[:=]\s*["'])([A-Za-z0-9\-_\.]{24,})['"]/gi },
]

export interface ScrapedKey {
  label: string
  value: string
  context: string
  source?: string
}

function extractContext(source: string, match: RegExpExecArray, windowSize = 60): string {
  const start = Math.max(0, match.index - windowSize)
  const end = Math.min(source.length, match.index + match[0].length + windowSize)
  let ctx = source.slice(start, end).replace(/\s+/g, " ").trim()
  if (start > 0) ctx = "..." + ctx
  if (end < source.length) ctx = ctx + "..."
  return ctx
}

const PLACEHOLDER_PATTERNS = [
  /^[xX]{4,}$/, /xxx+/i, /your[_-]?api[_-]?key/i, /your[_-]?key/i,
  /insert[_-]?key/i, /api[_-]?key[_-]?here/i, /placeholder/i, /example/i,
  /test[_-]?key/i, /dummy/i, /fake/i, /replace[_-]?me/i, /1234567890/,
  /abcdefgh/i, /^dahono-x{8,}/i, /^(.)\1{6,}$/,
]

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => p.test(value))
}

function dedupe(keys: ScrapedKey[]): ScrapedKey[] {
  const seen = new Set<string>()
  return keys.filter((k) => {
    if (isPlaceholder(k.value)) return false
    if (seen.has(k.value)) return false
    seen.add(k.value)
    return true
  })
}

// ── Key extractor: scans a text blob ─────────────────────────────────────────
function extractKeys(text: string, sourceLabel: string): ScrapedKey[] {
  const found: ScrapedKey[] = []
  for (const { label, pattern } of KEY_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const value = (match[1] ?? match[0]).trim()
      if (value.length < 8) continue
      const context = extractContext(text, match)
      found.push({ label, value, context, source: sourceLabel })
      if (match[0].length === 0) pattern.lastIndex++
    }
  }
  return found
}

// ── Extract embedded JSON blobs (Next.js, Nuxt, etc.) ────────────────────────
function extractEmbeddedJSON(html: string): string {
  const extractions: string[] = []

  // Next.js __NEXT_DATA__
  const nextData = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (nextData?.[1]) extractions.push(nextData[1])

  // Nuxt __NUXT__ state
  const nuxtData = html.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*?\})\s*;/m)
  if (nuxtData?.[1]) extractions.push(nuxtData[1])

  // Generic window env configs
  const windowEnvPatterns = [
    /window\.__ENV__\s*=\s*(\{[^;]{1,4096}?\})\s*;/gm,
    /window\.ENV\s*=\s*(\{[^;]{1,4096}?\})\s*;/gm,
    /window\.CONFIG\s*=\s*(\{[^;]{1,4096}?\})\s*;/gm,
    /window\.APP_CONFIG\s*=\s*(\{[^;]{1,4096}?\})\s*;/gm,
    /window\.RUNTIME_CONFIG\s*=\s*(\{[^;]{1,4096}?\})\s*;/gm,
    /__REDUX_STATE__\s*=\s*(\{[\s\S]*?\})\s*;/gm,
    /initialState\s*=\s*(\{[\s\S]*?\})\s*;/gm,
  ]
  for (const pat of windowEnvPatterns) {
    let m: RegExpExecArray | null
    pat.lastIndex = 0
    while ((m = pat.exec(html)) !== null) {
      if (m[1]) extractions.push(m[1])
    }
  }

  return extractions.join("\n")
}

// ── Decode base64 chunks and scan them ───────────────────────────────────────
function extractBase64Secrets(text: string): string {
  // Only scan base64 strings that appear to be assigned to a variable
  // (avoids decoding random long base64 like images or hashes)
  const b64InAssignment = /(?:key|token|secret|password|apikey|api_key|auth)\s*[:=]\s*["']([A-Za-z0-9+/]{32,}={0,2})['"]/gi
  const decoded: string[] = []
  let m: RegExpExecArray | null
  b64InAssignment.lastIndex = 0
  while ((m = b64InAssignment.exec(text)) !== null) {
    try {
      const dec = Buffer.from(m[1], "base64").toString("utf-8")
      // Only keep if decoded output looks like printable ASCII (not binary)
      if (/^[\x20-\x7E]+$/.test(dec) && dec.length > 8) {
        decoded.push(dec)
      }
    } catch {}
  }
  return decoded.join("\n")
}

// ── Fetch helper with timeout + content-length guard ─────────────────────────
const MAX_CONTENT_BYTES = 10 * 1024 * 1024 // 10 MB

async function safeFetch(
  url: string,
  timeoutMs: number
): Promise<{ ok: boolean; text: string; status: number; contentType: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": randomUA(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/javascript,application/javascript,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
    })
    clearTimeout(timer)

    const contentLength = res.headers.get("content-length")
    if (contentLength && parseInt(contentLength) > MAX_CONTENT_BYTES) {
      return { ok: false, text: "", status: res.status, contentType: "" }
    }

    const contentType = res.headers.get("content-type") ?? ""
    const text = await res.text()
    return { ok: res.ok, text, status: res.status, contentType }
  } catch {
    clearTimeout(timer)
    return { ok: false, text: "", status: 0, contentType: "" }
  }
}

// ── Collect JS chunk URLs from HTML ──────────────────────────────────────────
function collectJsUrls(html: string, baseUrl: string): string[] {
  const urls = new Set<string>()

  // Standard script src tags
  for (const m of html.matchAll(/src=["']([^"']+\.js[^"']*)['"]/gi)) {
    try { urls.add(new URL(m[1], baseUrl).href) } catch {}
  }

  // Next.js chunk manifest (_buildManifest.js, _ssgManifest.js, chunk files)
  for (const m of html.matchAll(/["'](\/_next\/static\/[^"']+\.js)['"]/gi)) {
    try { urls.add(new URL(m[1], baseUrl).href) } catch {}
  }

  // Webpack chunks referenced as strings
  for (const m of html.matchAll(/["'](\/static\/js\/[^"']+\.js)['"]/gi)) {
    try { urls.add(new URL(m[1], baseUrl).href) } catch {}
  }

  return [...urls]
}

// ── Ancillary files to always check ──────────────────────────────────────────
const ANCILLARY_PATHS = [
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
  "/.well-known/openid-configuration",
  "/config.js",
  "/env.js",
  "/runtime-config.js",
]

// ─────────────────────────────────────────────────────────────────────────────

export interface ScrapeResponse {
  url: string
  fetchedAt: string
  totalFound: number
  keys: ScrapedKey[]
  scannedBytes: number
  scannedJsFiles: number
  scannedSources: { url: string; bytes: number; type: string }[]
  warning?: string
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded — try again in a minute" }, { status: 429 })
  }

  let url: string
  try {
    const body = await req.json()
    url = body.url
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing or invalid url" }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "Only HTTP/HTTPS URLs are supported" }, { status: 400 })
  }

  // SSRF protection
  if (await isPrivateHost(parsedUrl.hostname)) {
    return NextResponse.json(
      { error: "Scanning private/internal network addresses is not allowed" },
      { status: 403 }
    )
  }

  try {
    // ── Phase 1: Fetch main HTML ──────────────────────────────────────────
    const mainFetch = await safeFetch(url, 15_000)

    const isScannable =
      mainFetch.contentType.includes("text/") ||
      mainFetch.contentType.includes("javascript") ||
      mainFetch.contentType.includes("application/json")

    if (!mainFetch.ok && !isScannable && mainFetch.status !== 0) {
      return NextResponse.json(
        { error: `Failed to fetch URL: HTTP ${mainFetch.status}` },
        { status: 502 }
      )
    }

    const fetchWarning =
      mainFetch.ok || mainFetch.status === 0
        ? null
        : `HTTP ${mainFetch.status} — scanning partial response`

    const html = mainFetch.text
    const scannedSources: ScrapeResponse["scannedSources"] = [
      { url, bytes: html.length, type: "html" },
    ]

    let combinedSource = html

    // ── Phase 2: Extract embedded JSON (Next.js, Nuxt, window.*) ─────────
    const embeddedJson = extractEmbeddedJSON(html)
    if (embeddedJson) {
      combinedSource += "\n" + embeddedJson
      scannedSources.push({ url: `${url}#embedded-json`, bytes: embeddedJson.length, type: "embedded-json" })
    }

    // ── Phase 3: Decode base64 strings ───────────────────────────────────
    const b64Decoded = extractBase64Secrets(html)
    if (b64Decoded) {
      combinedSource += "\n" + b64Decoded
      scannedSources.push({ url: `${url}#base64-decoded`, bytes: b64Decoded.length, type: "base64-decoded" })
    }

    // ── Phase 4: Fetch ancillary files (robots, sitemap, manifest) ────────
    const ancillaryFetches = await Promise.allSettled(
      ANCILLARY_PATHS.map(async (path) => {
        const ancUrl = new URL(path, url).href
        const r = await safeFetch(ancUrl, 5_000)
        return { url: ancUrl, result: r, type: path.split("/").pop() ?? "file" }
      })
    )
    for (const settled of ancillaryFetches) {
      if (settled.status === "fulfilled" && settled.value.result.ok && settled.value.result.text) {
        combinedSource += "\n" + settled.value.result.text
        scannedSources.push({
          url: settled.value.url,
          bytes: settled.value.result.text.length,
          type: settled.value.type,
        })
      }
    }

    // ── Phase 5: Collect and fetch JS files (up to 20) ────────────────────
    const jsUrls = collectJsUrls(html, url)

    // Prioritize: env/config JS first, then chunks, then everything else
    const prioritized = [
      ...jsUrls.filter((u) => /env|config|runtime|settings/i.test(u)),
      ...jsUrls.filter((u) => !/env|config|runtime|settings/i.test(u)),
    ].slice(0, 20)

    const jsFetches = await Promise.allSettled(
      prioritized.map(async (jsUrl) => {
        const r = await safeFetch(jsUrl, 8_000)
        return { url: jsUrl, result: r }
      })
    )

    let jsFileCount = 0
    for (const settled of jsFetches) {
      if (settled.status === "fulfilled" && settled.value.result.ok && settled.value.result.text) {
        const jsText = settled.value.result.text
        combinedSource += "\n" + jsText

        // Also decode base64 in each JS file
        const jsB64 = extractBase64Secrets(jsText)
        if (jsB64) combinedSource += "\n" + jsB64

        scannedSources.push({
          url: settled.value.url,
          bytes: jsText.length,
          type: "js",
        })
        jsFileCount++
      }
    }

    // ── Phase 6: Run all patterns against combined source ─────────────────
    const found: ScrapedKey[] = []

    // Main HTML + JS combined
    found.push(...extractKeys(combinedSource, "page"))

    const dedupedKeys = dedupe(found)

    const response: ScrapeResponse = {
      url,
      fetchedAt: new Date().toISOString(),
      totalFound: dedupedKeys.length,
      keys: dedupedKeys,
      scannedBytes: combinedSource.length,
      scannedJsFiles: jsFileCount,
      scannedSources,
      ...(fetchWarning ? { warning: fetchWarning } : {}),
    }

    return NextResponse.json(response)
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "Request timed out after 15s" }, { status: 504 })
    }
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Fetch failed: ${msg}` }, { status: 502 })
  }
}
