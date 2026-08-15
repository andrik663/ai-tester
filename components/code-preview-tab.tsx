"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  ts: string
  codeBlocks?: ExtractedCode[]
  /** The full merged HTML document after this turn — used to drive the
   *  preview/download without re-displaying the whole file in the chat. */
  fullHtml?: string
  /** Set when this turn's edit request could not locate every SEARCH
   *  snippet exactly, so one or more requested changes were skipped. */
  failedEdits?: number
}

interface ExtractedCode {
  lang: string
  code: string
}

interface EditBlock {
  search: string
  replace: string
}

interface WorkingModel {
  modelId: string
  apiKey: string
  latencyMs: number
}

interface PresetModel {
  id: string
  label: string
}

interface ActiveSkillConfig {
  skillId: string
  systemPrompt: string
}

interface Props {
  /** Provider id (e.g. "openai", "bynara") */
  provider: string
  providerName: string
  apiKey: string
  endpoint: string
  /** Resolved header rows from config */
  headers: Record<string, string>
  /** Currently selected model id */
  model: string
  onModelChange: (modelId: string) => void
  workingModels: WorkingModel[]
  presetModels?: PresetModel[]
  isMiuclaw?: boolean
  /** Array of active skill configs to compose into the system prompt */
  activeSkillConfigs?: ActiveSkillConfig[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CODE_SYSTEM_PROMPT = `You are an expert web developer. When the user asks you to build or create something, respond with a SINGLE complete, self-contained HTML document that includes all CSS and JavaScript inline. Always output code in a fenced code block with the \`\`\`html language tag.

CRITICAL RULES — you MUST follow ALL of them:
- ALWAYS produce ONE complete HTML file. Never stop mid-way. Never truncate. Never say "continued below" or leave TODO comments.
- The file MUST contain <!DOCTYPE html>, <html>, <head>, and </body></html> — a fully closed, valid document.
- All styles MUST be in a <style> tag inside <head>. Use modern CSS with animations if relevant.
- All scripts MUST be in a <script> tag before </body>. Use vanilla JS or CDN libraries (e.g. Three.js, GSAP, particles.js from cdnjs).
- Do NOT import from npm or use build tools. CDN <script src="..."> only.
- Make the output visually polished and professional. For animations: use requestAnimationFrame, CSS keyframes, or CDN animation libraries.
- FINISH the entire HTML document in one response — closing every tag properly. Output </html> as the very last character.
- If the user asks a question instead of requesting code, answer concisely in plain text.`

/**
 * System prompt used for every follow-up turn once a full HTML document
 * already exists. Instead of asking the model to resend the entire file
 * (slow, wasteful, and error-prone on long files), it must respond with
 * small SEARCH/REPLACE edit blocks that are applied client-side on top of
 * the last known full document — so only the touched region ever changes.
 */
function buildEditSystemPrompt(currentHtml: string, skillPrompt: string | null): string {
  return `You are editing an existing, already-working HTML page that is live in a preview pane. The user will ask for a small, specific change (e.g. "tambahkan footer widget", "ubah warna tombol jadi hijau", "add a contact form").

CRITICAL RULE — do NOT rewrite, resend, or repeat the whole file. Respond with ONLY one or more SEARCH/REPLACE edit blocks in this exact format:

\`\`\`edit
<<<<<<< SEARCH
(exact snippet copied character-for-character from the current file below, including original whitespace/indentation)
=======
(the new code that replaces that exact snippet)
>>>>>>> REPLACE
\`\`\`

Rules you MUST follow:
1. Never output \`\`\`html or the full document — only \`\`\`edit blocks with SEARCH/REPLACE pairs.
2. Each SEARCH section must copy an EXACT, contiguous snippet that exists verbatim in the current file below (same characters, same indentation). Keep it as short as possible — just enough lines (2-8) to uniquely locate the spot. Never paste the whole file into SEARCH.
3. Include multiple SEARCH/REPLACE blocks in one response if the request touches multiple separate spots.
4. To ADD brand-new markup (e.g. a new footer) rather than change existing text, use a short unique anchor line as SEARCH (e.g. the line right before </body>) and REPLACE it with that same anchor line followed by the new markup.
5. If the user asks a question instead of requesting a change, just answer in plain text — no code block at all.
${skillPrompt ? `\nAdditional style guidance to apply to any new code you add:\n${skillPrompt}\n` : ""}
CURRENT FILE (reference only, to locate exact snippets from — do not repeat it back):
\`\`\`html
${currentHtml}
\`\`\``
}

/**
 * Extract the first fenced code block from a markdown-formatted string.
 * Returns { lang, code } or null.
 */
function extractCodeBlocks(text: string): ExtractedCode[] {
  const results: ExtractedCode[] = []
  const regex = /```(\w*)\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const lang = match[1].toLowerCase() || "text"
    const code = match[2].trim()
    if (code.length > 0) {
      results.push({ lang, code })
    }
  }
  return results
}

/**
 * Extract SEARCH/REPLACE edit blocks from a response. Looks inside fenced
 * ```edit blocks first; falls back to scanning the raw text for the marker
 * pattern in case the model omits the fence.
 */
function extractEditBlocks(text: string): EditBlock[] {
  const out: EditBlock[] = []
  const pairRegex = /<{3,}\s*SEARCH\s*\n([\s\S]*?)\n={3,}\s*\n([\s\S]*?)\n>{3,}\s*REPLACE/g

  const fenceRegex = /```edit\n([\s\S]*?)```/g
  let fenceMatch
  let sawFence = false
  while ((fenceMatch = fenceRegex.exec(text)) !== null) {
    sawFence = true
    let m
    const segment = fenceMatch[1]
    const localRegex = new RegExp(pairRegex.source, "g")
    while ((m = localRegex.exec(segment)) !== null) {
      out.push({ search: m[1], replace: m[2] })
    }
  }
  if (!sawFence) {
    let m
    while ((m = pairRegex.exec(text)) !== null) {
      out.push({ search: m[1], replace: m[2] })
    }
  }
  return out
}

/**
 * Apply SEARCH/REPLACE edit blocks on top of the current full HTML.
 * Tries an exact substring match first, then falls back to a whitespace-
 * tolerant line-window match so minor indentation drift from the model
 * doesn't cause the edit to silently fail.
 */
function applyEditBlocks(baseHtml: string, edits: EditBlock[]): { html: string; appliedCount: number; failedCount: number } {
  let html = baseHtml
  let appliedCount = 0
  let failedCount = 0

  const normalize = (s: string) => s.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim()

  for (const edit of edits) {
    const searchText = edit.search.trim()
    if (!searchText) { failedCount++; continue }

    if (html.includes(edit.search)) {
      html = html.replace(edit.search, edit.replace)
      appliedCount++
      continue
    }

    // Whitespace-tolerant fallback: find a contiguous window of lines whose
    // normalized text matches the normalized SEARCH snippet.
    const lines = html.split("\n")
    const searchLineCount = edit.search.split("\n").length
    const normSearch = normalize(edit.search)
    let matched = false
    for (let i = 0; i <= lines.length - searchLineCount; i++) {
      const windowText = lines.slice(i, i + searchLineCount).join("\n")
      if (normalize(windowText) === normSearch) {
        lines.splice(i, searchLineCount, edit.replace)
        html = lines.join("\n")
        matched = true
        appliedCount++
        break
      }
    }
    if (!matched) failedCount++
  }

  return { html, appliedCount, failedCount }
}

/**
 * Build an iframe srcDoc from extracted code blocks.
 * Prefers html > jsx > js > css blocks.
 */
function buildSrcDoc(blocks: ExtractedCode[]): string {
  // Prefer full HTML doc
  const htmlBlock = blocks.find((b) => b.lang === "html" || b.lang === "html5")
  if (htmlBlock) return htmlBlock.code

  // JS + CSS combo
  const jsBlock  = blocks.find((b) => b.lang === "js" || b.lang === "javascript" || b.lang === "jsx" || b.lang === "tsx" || b.lang === "ts" || b.lang === "typescript")
  const cssBlock = blocks.find((b) => b.lang === "css")

  if (jsBlock || cssBlock) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  ${cssBlock ? `<style>\n${cssBlock.code}\n</style>` : ""}
</head>
<body>
  ${jsBlock ? `<script>\n${jsBlock.code}\n<\/script>` : ""}
</body>
</html>`
  }

  return ""
}

// ── View toggle icons ─────────────────────────────────────────────────────────

function SplitIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <rect x="1" y="2" width="6" height="12" rx="1" />
      <rect x="9" y="2" width="6" height="12" rx="1" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <polyline points="4 5 1 8 4 11" />
      <polyline points="12 5 15 8 12 11" />
      <line x1="9" y1="3" x2="7" y2="13" />
    </svg>
  )
}

function PreviewIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <rect x="1" y="3" width="14" height="10" rx="1.5" />
      <line x1="5" y1="3" x2="5" y2="13" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-12.95L1 6" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CodePreviewTab({
  provider,
  providerName,
  apiKey,
  endpoint,
  headers,
  model,
  onModelChange,
  workingModels,
  presetModels,
  isMiuclaw,
  activeSkillConfigs = [],
}: Props) {
  // Compose all active skill system prompts into one
  const composedSkillPrompt = activeSkillConfigs.length > 0
    ? activeSkillConfigs
        .map((c, i) => `### Skill ${i + 1}: ${c.skillId}\n${c.systemPrompt}`)
        .join("\n\n---\n\n") +
      "\n\n---\n\nWhen generating code output, always wrap it in a single fenced ```html code block containing a complete, self-contained HTML document with <!DOCTYPE html>. Include all CSS in a <style> tag and all JS in a <script> tag so the preview iframe can render it immediately."
    : null

  const activeSkillName = activeSkillConfigs.length === 1
    ? activeSkillConfigs[0].skillId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : activeSkillConfigs.length > 1
    ? `${activeSkillConfigs.length} skills`
    : undefined
  // ── State ───────────────────────────────────���───────────────────────────────
  type ViewMode = "split" | "code" | "preview"
  const [viewMode, setViewMode]         = useState<ViewMode>("split")
  const [messages, setMessages]         = useState<ChatMessage[]>([])
  const [input, setInput]               = useState("")
  const [isStreaming, setIsStreaming]   = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [previewSrc, setPreviewSrc]     = useState("")
  const [previewKey, setPreviewKey]     = useState(0)
  const [copyFeedback, setCopyFeedback]       = useState<number | null>(null)
  const [iframeError, setIframeError]         = useState(false)
  const [downloadOpenIdx, setDownloadOpenIdx] = useState<number | null>(null)
  /** Ground-truth full HTML document, kept up to date after every turn
   *  (either a fresh generation or an applied SEARCH/REPLACE edit). This is
   *  what gets fed back to the model on each follow-up so it can locate
   *  exact snippets, without ever having to re-display the whole file. */
  const [lastFullHtml, setLastFullHtml] = useState("")

  const chatEndRef    = useRef<HTMLDivElement>(null)
  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const abortRef      = useRef<AbortController | null>(null)

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px"
  }, [input])

  // When streaming finishes, extract latest code and update preview.
  // `fullHtml` (set for both fresh generations and applied edits) always
  // wins — it's the merged, ground-truth document even when the chat only
  // displayed a small diff for this turn.
  useEffect(() => {
    if (isStreaming) return
    if (messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.role !== "assistant") return
    if (last.fullHtml) {
      setPreviewSrc(last.fullHtml)
      setIframeError(false)
    } else if (last.codeBlocks && last.codeBlocks.length > 0) {
      const src = buildSrcDoc(last.codeBlocks)
      if (src) {
        setPreviewSrc(src)
        setIframeError(false)
      }
    }
  }, [messages, isStreaming])

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    if (!apiKey.trim()) return

    const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    const userMsg: ChatMessage = { role: "user", content: text, ts }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsStreaming(true)
    setStreamingText("")

    const prevMessages = messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    const allMessages  = [...prevMessages, { role: "user" as const, content: text }]

    const ctrl = new AbortController()
    abortRef.current = ctrl

    // Once a full document already exists, switch to edit mode: the model
    // is told to return only SEARCH/REPLACE blocks against the current file
    // instead of resending the whole HTML on every follow-up.
    const isEditTurn = lastFullHtml.trim().length > 0
    const systemPromptToUse = isEditTurn
      ? buildEditSystemPrompt(lastFullHtml, composedSkillPrompt)
      : (composedSkillPrompt ?? CODE_SYSTEM_PROMPT)

    let accumulated = ""

    try {
      const res = await fetch("/api/manual-test/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          endpoint,
          headers,
          messages: allMessages,
          systemPrompt: systemPromptToUse,
          model: model.trim() || undefined,
        }),
        signal: ctrl.signal,
      })

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No stream body")
      const dec = new TextDecoder()
      let buf = ""
      let currentEvent = "token"

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line) { currentEvent = "token"; continue }

          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim()
            continue
          }
          if (!line.startsWith("data:")) continue
          const dataStr = line.slice(5).trim()
          if (!dataStr || dataStr === "[DONE]") continue

          try {
            const parsed = JSON.parse(dataStr) as Record<string, unknown>
            if (currentEvent === "token") {
              accumulated += (parsed.text as string) ?? ""
              setStreamingText(accumulated)
            } else if (currentEvent === "error") {
              const errBody = (parsed.body as string) || (parsed.message as string) || "Error"
              accumulated += `\n\nError: ${errBody}`
              setStreamingText(accumulated)
            }
          } catch { /* skip */ }
        }
      }
      reader.releaseLock()
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        accumulated += `\nError: ${err instanceof Error ? err.message : "Streaming failed"}`
      }
    }

    let codeBlocks   = extractCodeBlocks(accumulated)
    let fullHtml: string | undefined
    let failedEdits: number | undefined

    if (isEditTurn) {
      const editBlocks = extractEditBlocks(accumulated)
      if (editBlocks.length > 0) {
        // Model followed the SEARCH/REPLACE format — apply the patch on top
        // of the last known full document and show only the concise diff
        // in the chat, never the whole file again.
        const { html, appliedCount, failedCount } = applyEditBlocks(lastFullHtml, editBlocks)
        fullHtml = html
        failedEdits = failedCount > 0 ? failedCount : undefined
        codeBlocks = editBlocks.map((b) => ({
          lang: "diff",
          code: `<<<<<<< SEARCH\n${b.search}\n=======\n${b.replace}\n>>>>>>> REPLACE`,
        }))
        if (appliedCount === 0 && failedCount > 0) {
          // Nothing could be located — fall back to showing the raw reply
          // text so the user isn't left staring at an unexplained diff.
          codeBlocks = []
        }
      } else {
        // Model ignored the edit-mode instructions and sent a full document
        // anyway — accept it as a full replace rather than breaking.
        const htmlBlock = codeBlocks.find((b) => b.lang === "html" || b.lang === "html5")
        if (htmlBlock) fullHtml = htmlBlock.code
      }
    } else {
      // First generation for this conversation.
      const htmlBlock = codeBlocks.find((b) => b.lang === "html" || b.lang === "html5")
      if (htmlBlock) fullHtml = htmlBlock.code
    }

    if (fullHtml) setLastFullHtml(fullHtml)

    let finalContent = accumulated || "(empty response)"
    if (failedEdits) {
      finalContent += `\n\nNote: ${failedEdits} requested change${failedEdits > 1 ? "s" : ""} could not be located exactly in the current file and were skipped — try rephrasing the request.`
    }

    const replyTs = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: finalContent, ts: replyTs, codeBlocks, fullHtml, failedEdits },
    ])
    setStreamingText("")
    setIsStreaming(false)
    abortRef.current = null
  }, [input, isStreaming, messages, apiKey, provider, endpoint, headers, model, composedSkillPrompt, lastFullHtml])

  function stopStreaming() {
    abortRef.current?.abort()
    abortRef.current = null
  }

  function refreshPreview() {
    setPreviewKey((k) => k + 1)
    setIframeError(false)
  }

  async function copyCode(code: string, idx: number) {
    try {
      await navigator.clipboard.writeText(code)
      setCopyFeedback(idx)
      setTimeout(() => setCopyFeedback(null), 1500)
    } catch { /* ignore */ }
  }

  type DownloadFormat = "html" | "txt" | "md" | "zip" | "json"

  const DOWNLOAD_OPTIONS: { format: DownloadFormat; label: string; ext: string; mime: string; description: string }[] = [
    { format: "html", label: "HTML File",      ext: "html",   mime: "text/html",              description: "Single page .html" },
    { format: "txt",  label: "Plain Text",     ext: "txt",    mime: "text/plain",             description: "Raw .txt source"   },
    { format: "md",   label: "Markdown",       ext: "md",     mime: "text/markdown",          description: "Fenced code block" },
    { format: "zip",  label: "ZIP Archive",    ext: "zip",    mime: "application/zip",        description: "Compressed .zip"  },
    { format: "json", label: "JSON Metadata",  ext: "json",   mime: "application/json",       description: "Code + meta .json" },
  ]

  async function downloadCode(code: string, lang: string, format: DownloadFormat) {
    const ts   = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")
    const base = `code-${ts}`
    let blob: Blob
    let filename: string

    if (format === "html") {
      blob     = new Blob([code], { type: "text/html" })
      filename = `${base}.html`
    } else if (format === "txt") {
      blob     = new Blob([code], { type: "text/plain" })
      filename = `${base}.txt`
    } else if (format === "md") {
      const mdContent = `\`\`\`${lang}\n${code}\n\`\`\``
      blob     = new Blob([mdContent], { type: "text/markdown" })
      filename = `${base}.md`
    } else if (format === "zip") {
      // Build a minimal valid ZIP file with a single entry using raw bytes
      const encoder   = new TextEncoder()
      const fileBytes = encoder.encode(code)
      const innerName = `${base}.${lang === "html" ? "html" : "txt"}`
      const nameBytes = encoder.encode(innerName)

      // Local file header
      const localHeader = new Uint8Array([
        0x50, 0x4b, 0x03, 0x04, // signature
        0x14, 0x00,             // version needed: 2.0
        0x00, 0x00,             // flags
        0x00, 0x00,             // compression: stored
        0x00, 0x00, 0x00, 0x00, // mod time/date (dummy)
        0x00, 0x00, 0x00, 0x00, // CRC-32 (dummy — not validated by most apps)
        ...u32le(fileBytes.length), // compressed size
        ...u32le(fileBytes.length), // uncompressed size
        ...u16le(nameBytes.length), // filename length
        0x00, 0x00,             // extra field length
      ])
      const entryOffset = 0
      const entrySize   = localHeader.length + nameBytes.length + fileBytes.length

      // Central directory header
      const centralHeader = new Uint8Array([
        0x50, 0x4b, 0x01, 0x02, // signature
        0x14, 0x00,             // version made by
        0x14, 0x00,             // version needed
        0x00, 0x00,             // flags
        0x00, 0x00,             // compression: stored
        0x00, 0x00, 0x00, 0x00, // mod time/date
        0x00, 0x00, 0x00, 0x00, // CRC-32
        ...u32le(fileBytes.length),
        ...u32le(fileBytes.length),
        ...u16le(nameBytes.length),
        0x00, 0x00,             // extra length
        0x00, 0x00,             // comment length
        0x00, 0x00,             // disk start
        0x00, 0x00,             // int attr
        0x00, 0x00, 0x00, 0x00, // ext attr
        ...u32le(entryOffset),  // local header offset
      ])

      // End of central directory
      const eocd = new Uint8Array([
        0x50, 0x4b, 0x05, 0x06, // signature
        0x00, 0x00,             // disk number
        0x00, 0x00,             // start disk
        0x01, 0x00,             // entries on disk
        0x01, 0x00,             // total entries
        ...u32le(centralHeader.length + nameBytes.length), // central dir size
        ...u32le(entrySize),    // central dir offset
        0x00, 0x00,             // comment length
      ])

      const all = concat([localHeader, nameBytes, fileBytes, centralHeader, nameBytes, eocd])
      blob     = new Blob([all], { type: "application/zip" })
      filename = `${base}.zip`
    } else {
      // JSON
      const meta = {
        generatedAt: new Date().toISOString(),
        language:    lang,
        lines:       code.split("\n").length,
        characters:  code.length,
        provider,
        model,
        source:      "ai-tester-code-preview",
        code,
      }
      blob     = new Blob([JSON.stringify(meta, null, 2)], { type: "application/json" })
      filename = `${base}.json`
    }

    const url = URL.createObjectURL(blob)
    const a   = document.createElement("a")
    a.href    = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setDownloadOpenIdx(null)
  }

  // ── ZIP helpers ─────────────────────────────────────────────────────────────
  function u32le(n: number): number[] {
    return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]
  }
  function u16le(n: number): number[] {
    return [n & 0xff, (n >> 8) & 0xff]
  }
  function concat(arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((s, a) => s + a.length, 0)
    const out   = new Uint8Array(total)
    let offset  = 0
    for (const a of arrays) { out.set(a, offset); offset += a.length }
    return out
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  /** Render a single message bubble */
  function renderMessage(msg: ChatMessage, i: number) {
    const isUser = msg.role === "user"

    if (isUser) {
      return (
        <div key={i} className="flex justify-end">
          <div className="max-w-[75%] rounded-xl rounded-tr-sm bg-primary/15 border border-primary/25 px-3 py-2 text-[12px] text-foreground leading-relaxed">
            {msg.content}
          </div>
        </div>
      )
    }

    // Assistant — split on code fences to render code blocks inline
    const parts = msg.content.split(/(```[\s\S]*?```)/g)

    return (
      <div key={i} className="flex flex-col gap-1.5">
        <div className="flex flex-col gap-2">
          {parts.map((part, pi) => {
              const fenceMatch = part.match(/^```(\w*)\n([\s\S]*?)```$/)
            if (fenceMatch) {
              const lang    = fenceMatch[1] || "text"
              const code    = fenceMatch[2].trim()
              const blockId = i * 100 + pi
              const dlOpen  = downloadOpenIdx === blockId
              const isDiff  = lang === "edit" || lang === "diff"
              return (
                <div key={pi} className={`rounded-lg border overflow-hidden ${isDiff ? "border-primary/25 bg-primary/5" : "border-border/60 bg-muted/40"}`}>
                  {/* Code block header */}
                  <div className={`flex items-center justify-between px-3 py-1.5 border-b ${isDiff ? "border-primary/15 bg-primary/8" : "border-border/40 bg-muted/30"}`}>
                    {/* Lang badge */}
                    <span className={`text-[10px] font-mono ${isDiff ? "text-primary/80" : "text-muted-foreground"}`}>
                      {isDiff ? "diff · search & replace" : lang}
                    </span>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">

                      {/* Copy button */}
                      <button
                        onClick={() => copyCode(code, blockId)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/60"
                      >
                        <CopyIcon />
                        {copyFeedback === blockId ? "Copied!" : "Copy"}
                      </button>

                      {/* Divider */}
                      {!isDiff && <div className="w-px h-3 bg-border/60" />}

                      {/* Download dropdown — only meaningful for full files, not diffs */}
                      {!isDiff && <div className="relative">
                        <button
                          onClick={() => setDownloadOpenIdx(dlOpen ? null : blockId)}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/60"
                        >
                          <DownloadIcon />
                          <span>Download</span>
                          <ChevronDownIcon />
                        </button>

                        {dlOpen && (
                          <>
                            {/* Backdrop to close on outside click */}
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setDownloadOpenIdx(null)}
                            />
                            {/* Dropdown menu */}
                            <div className="absolute right-0 top-full mt-1 z-20 min-w-[172px] rounded-lg border border-border/70 bg-background shadow-xl shadow-black/30 overflow-hidden">
                              <div className="px-3 py-2 border-b border-border/40">
                                <p className="text-[10px] font-semibold text-foreground/70 uppercase tracking-wider">Export as</p>
                              </div>
                              {DOWNLOAD_OPTIONS.map((opt) => (
                                <button
                                  key={opt.format}
                                  onClick={() => downloadCode(code, lang, opt.format)}
                                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-primary/8 hover:text-foreground transition-colors group"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex-shrink-0 w-8 text-center text-[9px] font-mono font-semibold px-1 py-0.5 rounded border border-border/60 bg-muted/60 text-primary/80 group-hover:border-primary/40 group-hover:bg-primary/10 transition-colors">
                                      .{opt.ext}
                                    </span>
                                    <span className="text-[11px] text-foreground/90 font-medium truncate">{opt.label}</span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">{opt.description}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>}

                    </div>
                  </div>
                  <pre className="px-3 py-2.5 text-[11px] font-mono text-foreground/90 overflow-x-auto leading-relaxed whitespace-pre-wrap break-words">
                    {code}
                  </pre>
                </div>
              )
            }
            if (part.trim()) {
              return (
                <p key={pi} className="text-[12px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {part.trim()}
                </p>
              )
            }
            return null
          })}

          {/* Full-file action strip — shown once per turn when an edit was
              merged, so the merged document stays copy/downloadable without
              ever re-printing the whole file inline. */}
          {msg.fullHtml && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <CodeIcon />
                Full file updated
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => copyCode(msg.fullHtml!, i * 100 + 99)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/60"
                >
                  <CopyIcon />
                  {copyFeedback === i * 100 + 99 ? "Copied!" : "Copy HTML"}
                </button>
                <div className="w-px h-3 bg-border/60" />
                <button
                  onClick={() => downloadCode(msg.fullHtml!, "html", "html")}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/60"
                >
                  <DownloadIcon />
                  Download
                </button>
              </div>
            </div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground/50 ml-0.5">{msg.ts}</span>
      </div>
    )
  }

  // ── Layout ───────────────────────────────────────────────────────────────────

  const showCode    = viewMode === "split" || viewMode === "code"
  const showPreview = viewMode === "split" || viewMode === "preview"
  const noKey       = !apiKey.trim()

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-border/40 bg-sidebar/40 flex-shrink-0">

        {/* Model selector */}
        {(workingModels.length > 0 || (presetModels && presetModels.length > 0)) && (
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="text-[11px] font-medium bg-background text-foreground border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer min-w-0 flex-1 max-w-[180px] truncate"
          >
            {isMiuclaw ? (
              workingModels.length > 0 ? (
                workingModels.map((m) => (
                  <option key={m.modelId} value={m.modelId}>{m.modelId}</option>
                ))
              ) : (
                <option value="" disabled>Sync keys first</option>
              )
            ) : (
              <>
                {workingModels.length > 0 && (
                  <optgroup label={`Saved (${workingModels.length})`}>
                    {workingModels.map((m) => (
                      <option key={m.modelId} value={m.modelId}>{m.modelId} · {m.latencyMs}ms</option>
                    ))}
                  </optgroup>
                )}
                {presetModels && presetModels.length > 0 && (
                  <optgroup label="All models">
                    {presetModels.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </optgroup>
                )}
              </>
            )}
          </select>
        )}

        {/* Active skills badge */}
        {activeSkillConfigs.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-primary/30 bg-primary/10 text-primary max-w-[160px]">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="w-2.5 h-2.5 flex-shrink-0">
              <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z" />
            </svg>
            <span className="text-[10px] font-medium truncate">
              {activeSkillConfigs.length === 1
                ? activeSkillName
                : `${activeSkillConfigs.length} skills active`}
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* View mode toggle */}
        <div className="flex items-center gap-0.5 rounded-md border border-border/50 bg-muted/30 p-0.5">
          {([
            { id: "code"    as const, icon: <CodeIcon />,    label: "Code"    },
            { id: "split"   as const, icon: <SplitIcon />,   label: "Split"   },
            { id: "preview" as const, icon: <PreviewIcon />, label: "Preview" },
          ]).map((v) => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              title={v.label}
              className={`flex items-center justify-center w-6 h-6 rounded transition-all ${
                viewMode === v.id
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.icon}
            </button>
          ))}
        </div>

        {/* Refresh preview button */}
        {previewSrc && (
          <button
            onClick={refreshPreview}
            title="Reload preview"
            className="flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-foreground transition-colors hover:bg-secondary/50"
          >
            <RefreshIcon />
          </button>
        )}
      </div>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className={`flex-1 min-h-0 flex overflow-hidden ${viewMode === "split" ? "flex-row" : "flex-col"}`}>

        {/* ── LEFT: Code / Chat panel ──────────────────────────────────────── */}
        {showCode && (
          <div
            className={`flex flex-col min-h-0 overflow-hidden ${
              viewMode === "split"
                ? "w-1/2 border-r border-border/50"
                : "flex-1"
            }`}
          >
            {/* No API key warning */}
            {noKey && (
              <div className="m-3 rounded-lg border border-yellow-500/25 bg-yellow-500/8 px-3 py-2.5 text-[11px] text-yellow-400/90 leading-relaxed">
                Add an API key in Config to start generating code.
              </div>
            )}

            {/* Chat messages */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
              {messages.length === 0 && !isStreaming && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center select-none pointer-events-none">
                  <div className="w-10 h-10 rounded-xl border border-primary/20 bg-primary/8 flex items-center justify-center shadow-[0_0_18px_oklch(0.76_0.17_192_/_0.10)]">
                    <CodeIcon />
                  </div>
                  {activeSkillConfigs.length > 0 && (
                    <div>
                      <p className="text-[13px] font-medium text-foreground mb-0.5">
                        {`${activeSkillConfigs.length} skill${activeSkillConfigs.length > 1 ? "s" : ""} active`}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[200px]">
                        {`System prompts from ${activeSkillConfigs.length} skill${activeSkillConfigs.length > 1 ? "s" : ""} are composed and injected. Ask it to build something.`}
                      </p>
                    </div>
                  )}
                  {activeSkillConfigs.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                      {activeSkillConfigs.map((c) => (
                        <div key={c.skillId} className="flex items-center gap-1 px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="w-2.5 h-2.5 flex-shrink-0">
                            <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z" />
                          </svg>
                          <span className="text-[9px] font-semibold truncate max-w-[90px]">
                            {c.skillId.replace(/-/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {messages.map((msg, i) => renderMessage(msg, i))}

              {/* Streaming bubble */}
              {isStreaming && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[12px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {streamingText || (
                      <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                        <span className="inline-flex gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                          <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                          <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                        </span>
                        Generating
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* ── Input bar ───────────────────────────────────────────────── */}
            <div className="flex-shrink-0 border-t border-border/40 bg-sidebar/30 px-3 py-2">
              <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 focus-within:border-primary/40 transition-colors">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !(e.keyCode === 229)) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder={noKey ? "Add API key first…" : "Describe what to build… (Enter to send)"}
                  disabled={noKey}
                  rows={1}
                  className="flex-1 min-h-[20px] max-h-[140px] resize-none bg-transparent text-[12px] text-foreground placeholder-muted-foreground/50 focus:outline-none leading-relaxed"
                />
                <button
                  onClick={isStreaming ? stopStreaming : sendMessage}
                  disabled={!isStreaming && (!input.trim() || noKey)}
                  className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
                    isStreaming
                      ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                      : input.trim() && !noKey
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_10px_oklch(0.76_0.17_192_/_0.25)]"
                      : "bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
                  }`}
                >
                  {isStreaming ? <StopIcon /> : <SendIcon />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/40 mt-1.5 ml-1">
                Shift+Enter for new line · powered by {providerName}
              </p>
            </div>
          </div>
        )}

        {/* ── RIGHT: Preview panel ─────────────────────────────────────────── */}
        {showPreview && (
          <div
            className={`flex flex-col min-h-0 overflow-hidden ${
              viewMode === "split" ? "w-1/2" : "flex-1"
            }`}
          >
            {/* Preview toolbar */}
            <div className="flex items-center gap-2 px-3 h-8 border-b border-border/40 bg-sidebar/20 flex-shrink-0">
              <span className="text-[10px] text-muted-foreground flex-1 text-center truncate">
                {previewSrc ? "Preview" : ""}
              </span>
              {previewSrc && (
                <button
                  onClick={refreshPreview}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <RefreshIcon />
                </button>
              )}
            </div>

            {/* iframe */}
            <div className="flex-1 min-h-0 relative bg-white">
              {previewSrc ? (
                <iframe
                  key={previewKey}
                  srcDoc={previewSrc}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                  className="w-full h-full border-0"
                  title="Code preview"
                  onError={() => setIframeError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 bg-[#0f0f0f] select-none">
                  <div className="w-10 h-10 rounded-xl border border-border/30 bg-muted/20 flex items-center justify-center">
                    <PreviewIcon />
                  </div>
                  <div className="text-center">
                    <p className="text-[12px] font-medium text-foreground/60 mb-0.5">Live Preview</p>
                    <p className="text-[11px] text-muted-foreground/40 max-w-[180px] leading-relaxed">
                      Preview will appear here when AI generates HTML code.
                    </p>
                  </div>
                </div>
              )}
              {iframeError && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                  <div className="text-center">
                    <p className="text-[12px] text-destructive mb-2">Preview failed to load</p>
                    <button
                      onClick={refreshPreview}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Reload
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
