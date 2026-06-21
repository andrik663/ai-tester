import { NextRequest, NextResponse } from "next/server"

// Patterns to detect API keys in HTML/JS source
const KEY_PATTERNS: { label: string; pattern: RegExp }[] = [
  // Google / Firebase — AIza prefix, 39 chars total
  { label: "Google / Firebase API Key", pattern: /AIza[0-9A-Za-z\-_]{35}/g },
  // Google Analytics measurement ID (non-secret, informational)
  { label: "Google Analytics ID", pattern: /G-[A-Z0-9]{8,12}/g },
  // OpenAI
  { label: "OpenAI API Key", pattern: /sk-[A-Za-z0-9]{20,60}/g },
  // OpenAI Project key
  { label: "OpenAI Project Key", pattern: /sk-proj-[A-Za-z0-9\-_]{40,100}/g },
  // Anthropic Claude
  { label: "Anthropic API Key", pattern: /sk-ant-[A-Za-z0-9\-_]{40,100}/g },
  // HuggingFace
  { label: "HuggingFace Token", pattern: /hf_[A-Za-z0-9]{30,50}/g },
  // Groq
  { label: "Groq API Key", pattern: /gsk_[A-Za-z0-9]{40,60}/g },
  // Cohere
  { label: "Cohere API Key", pattern: /[A-Za-z0-9]{40}(?=[^A-Za-z0-9]|$)/g },
  // AWS Access Key
  { label: "AWS Access Key", pattern: /(?:AKIA|AIPA|ASIA)[0-9A-Z]{16}/g },
  // GitHub token
  { label: "GitHub Token", pattern: /ghp_[A-Za-z0-9]{36}/g },
  { label: "GitHub Fine-grained Token", pattern: /github_pat_[A-Za-z0-9_]{82}/g },
  // Stripe
  { label: "Stripe Secret Key", pattern: /sk_live_[0-9a-zA-Z]{24}/g },
  { label: "Stripe Publishable Key", pattern: /pk_live_[0-9a-zA-Z]{24}/g },
  { label: "Stripe Test Key", pattern: /sk_test_[0-9a-zA-Z]{24}/g },
  // Twilio
  { label: "Twilio Account SID", pattern: /AC[a-zA-Z0-9]{32}/g },
  { label: "Twilio Auth Token", pattern: /SK[a-zA-Z0-9]{32}/g },
  // Generic Bearer tokens
  { label: "Bearer Token", pattern: /Bearer\s+([A-Za-z0-9\-_\.]{20,})/g },
  // Generic key= assignments
  { label: "Generic API Key", pattern: /(?:api[_-]?key|apiKey|api_key|access[_-]?key)\s*[:=]\s*["']([A-Za-z0-9\-_\.]{16,})['"]/gi },
  // Generic secret= assignments
  { label: "Generic Secret", pattern: /(?:secret|secret[_-]?key|client[_-]?secret)\s*[:=]\s*["']([A-Za-z0-9\-_\.]{16,})['"]/gi },
  // Generic token= assignments
  { label: "Generic Token", pattern: /(?:token|access[_-]?token|auth[_-]?token)\s*[:=]\s*["']([A-Za-z0-9\-_\.]{20,})['"]/gi },
  // Dahono Labs gateway key
  { label: "Dahono API Key", pattern: /dahono-[A-Za-z0-9]{8,64}/g },
  // DeepSeek
  { label: "DeepSeek API Key", pattern: /sk-[a-f0-9]{32,64}/g },
  // xAI Grok
  { label: "xAI API Key", pattern: /xai-[A-Za-z0-9\-_]{30,80}/g },
  // MiniMax
  { label: "MiniMax API Key", pattern: /eyJ[A-Za-z0-9\-_]{60,200}\.eyJ[A-Za-z0-9\-_]{60,200}\.[A-Za-z0-9\-_]{40,100}/g },
  // Anthropic (additional variant)
  { label: "Anthropic API Key", pattern: /sk-ant-api03-[A-Za-z0-9\-_]{80,120}/g },
  // Together AI
  { label: "Together AI Key", pattern: /[0-9a-f]{64}/g },
]

export interface ScrapedKey {
  label: string
  value: string
  context: string
}

function extractContext(source: string, match: RegExpExecArray, windowSize = 60): string {
  const start = Math.max(0, match.index - windowSize)
  const end = Math.min(source.length, match.index + match[0].length + windowSize)
  let ctx = source.slice(start, end).replace(/\s+/g, " ").trim()
  if (start > 0) ctx = "..." + ctx
  if (end < source.length) ctx = ctx + "..."
  return ctx
}

// Values that look like placeholders / documentation examples — never real keys
const PLACEHOLDER_PATTERNS = [
  /^[xX]{4,}$/,
  /xxx+/i,
  /your[_-]?api[_-]?key/i,
  /your[_-]?key/i,
  /insert[_-]?key/i,
  /api[_-]?key[_-]?here/i,
  /placeholder/i,
  /example/i,
  /test[_-]?key/i,
  /dummy/i,
  /fake/i,
  /replace[_-]?me/i,
  /1234567890/,
  /abcdefgh/i,
  // Dahono template placeholder
  /^dahono-x{8,}/i,
  // All same character repeated
  /^(.)\1{6,}$/,
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

export async function POST(req: NextRequest) {
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

  // Validate URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "Only HTTP/HTTPS URLs are supported" }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; APIKeyScanner/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: HTTP ${response.status} ${response.statusText}` },
        { status: 502 }
      )
    }

    const html = await response.text()

    // Also fetch inline JS files referenced in the HTML (script src)
    const scriptSrcMatches = [...html.matchAll(/src=["']([^"']+\.js[^"']*)['"]/gi)]
    const jsUrls: string[] = []
    for (const m of scriptSrcMatches) {
      try {
        jsUrls.push(new URL(m[1], url).href)
      } catch {}
    }

    let combinedSource = html
    // Fetch up to 5 JS files to avoid long waits
    const jsFiles = jsUrls.slice(0, 5)
    for (const jsUrl of jsFiles) {
      try {
        const jsController = new AbortController()
        const jsTimeout = setTimeout(() => jsController.abort(), 8_000)
        const jsRes = await fetch(jsUrl, {
          signal: jsController.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; APIKeyScanner/1.0)" },
        })
        clearTimeout(jsTimeout)
        if (jsRes.ok) {
          const jsText = await jsRes.text()
          combinedSource += "\n" + jsText
        }
      } catch {}
    }

    const found: ScrapedKey[] = []

    for (const { label, pattern } of KEY_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(combinedSource)) !== null) {
        // If the pattern has a capture group, use it; otherwise use full match
        const value = (match[1] ?? match[0]).trim()
        if (value.length < 8) continue
        const context = extractContext(combinedSource, match)
        found.push({ label, value, context })
        // Avoid infinite loops on zero-length matches
        if (match[0].length === 0) pattern.lastIndex++
      }
    }

    const dedupedKeys = dedupe(found)

    return NextResponse.json({
      url,
      fetchedAt: new Date().toISOString(),
      totalFound: dedupedKeys.length,
      keys: dedupedKeys,
      scannedBytes: combinedSource.length,
      scannedJsFiles: jsFiles.length,
    })
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "Request timed out after 15s" }, { status: 504 })
    }
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Fetch failed: ${msg}` }, { status: 502 })
  }
}
