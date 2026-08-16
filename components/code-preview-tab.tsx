"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import CommentMarquee from "@/components/comment-marquee"

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
  /** Name of a .md file attached to this (user) turn, shown as a small
  *  badge under the message. The file's contents were sent to the model
  *  alongside the prompt text for this turn. */
  attachedFileName?: string
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

/**
 * Keyword → candidate follow-ups. Each entry is only offered when the last
 * user prompt mentions the keyword, so suggestions stay relevant to what was
 * actually asked for (e.g. a landing page gets "Tambahkan testimoni", not
 * "Tambahkan level" which only makes sense for a game).
 */
const CONTEXTUAL_FOLLOWUPS: { keywords: string[]; suggestions: string[] }[] = [
  {
    keywords: ["landing", "promosi", "produk", "bisnis", "company", "profil"],
    suggestions: ["Tambahkan bagian testimoni", "Tambahkan bagian FAQ", "Tambahkan section harga (pricing)"],
  },
  {
    keywords: ["game", "permainan", "score", "level"],
    suggestions: ["Tambahkan efek suara", "Tambahkan sistem skor", "Tambahkan level kesulitan"],
  },
  {
    keywords: ["login", "daftar", "register", "akun", "form"],
    suggestions: ["Tambahkan validasi input", "Tambahkan pesan error", "Tambahkan tombol lupa password"],
  },
  {
    keywords: ["toko", "belanja", "produk", "ecommerce", "cart", "keranjang"],
    suggestions: ["Tambahkan keranjang belanja", "Tambahkan filter kategori", "Tambahkan halaman checkout"],
  },
  {
    keywords: ["portofolio", "cv", "resume", "profil"],
    suggestions: ["Tambahkan bagian pengalaman kerja", "Tambahkan galeri proyek", "Tambahkan tombol unduh CV"],
  },
  {
    keywords: ["dashboard", "admin", "panel"],
    suggestions: ["Tambahkan grafik statistik", "Tambahkan tabel data", "Tambahkan sidebar navigasi"],
  },
  {
    keywords: ["3d", "particle", "webgl", "three.js", "animasi"],
    suggestions: ["Tambahkan interaksi mouse", "Ubah warna partikel", "Tambahkan efek transisi"],
  },
  {
    keywords: ["blog", "artikel", "berita"],
    suggestions: ["Tambahkan halaman detail artikel", "Tambahkan kolom komentar", "Tambahkan kategori artikel"],
  },
]

/** Generic fallbacks used to top up the list when the prompt doesn't match
 *  any known context, or to fill in slots left by features already present
 *  in the generated code (e.g. skip "dark mode" if it's already dark). */
const GENERIC_FOLLOWUPS = [
  "Ganti tema warna",
  "Tambahkan animasi",
  "Ubah ke mode gelap",
  "Rapikan tata letak (layout)",
  "Buat lebih responsive di mobile",
  "Tambahkan footer",
]

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

  function MicIcon() {
  return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
  <line x1="12" y1="19" x2="12" y2="23" />
  <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
  )
  }

  function PaperclipIcon() {
  return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
  )
  }

  function FileTextIcon() {
  return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
  <polyline points="14 2 14 8 20 8" />
  <line x1="8" y1="13" x2="16" y2="13" />
  <line x1="8" y1="17" x2="13" y2="17" />
  </svg>
  )
  }

  function XIcon() {
  return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
  <line x1="18" y1="6" x2="6" y2="18" />
  <line x1="6" y1="6" x2="18" y2="18" />
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

function ChevronUpIcon() {
  return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
  <polyline points="18 15 12 9 6 15" />
  </svg>
  )
}

function ArrowRightIcon() {
  return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
  <line x1="5" y1="12" x2="19" y2="12" />
  <polyline points="12 5 19 12 12 19" />
  </svg>
  )
}

function WandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h0M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <polyline points="20 6 9 17 4 12" />
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
  const [isMobile, setIsMobile]         = useState(false)

  // Track viewport width so narrow screens render a single active pane
  // (Code or Preview) instead of a squeezed side-by-side split.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
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
  const [isRecording, setIsRecording]   = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(true)
  /** Currently attached .md file, read into memory as plain text so it can
   *  be included in the next prompt sent to the model. */
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  /** Model-generated follow-ups for the CURRENT turn, produced by a hidden
   *  chain-of-thought reasoning pass (see `refreshAiSuggestions`). `null`
   *  means "not ready yet" — the static `getFollowUpSuggestions()` list is
   *  shown as instant filler in that gap so the UI is never empty while the
   *  reasoning call is in flight. */
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null)
  /** When on (default), every prompt is first sent to the model to fix
   *  grammar/clarity/typos — but the result is only ever a SUGGESTION the
   *  user must approve; nothing is auto-sent. */
  const [improveEnabled, setImproveEnabled] = useState(true)
  /** While true, the input is locked and a spinner shows in place of the
   *  send button — the brief window where the refine call is in flight. */
  const [isRefiningPrompt, setIsRefiningPrompt] = useState(false)
  /** Brief inline notice shown when the "Perbaikan prompt" refine call
   *  itself fails, so falling back to the un-refined text reads as an
   *  explained failure rather than the button silently doing nothing. */
  const [refineNotice, setRefineNotice] = useState<string | null>(null)
  /** Pending approval: the user's original text vs. the model's rewrite.
   *  `null` means no review is currently pending. `edited` starts equal to
   *  `suggested` but the user can tweak it before approving. */
  const [promptReview, setPromptReview] = useState<{ original: string; suggested: string; edited: string } | null>(null)

  const chatEndRef    = useRef<HTMLDivElement>(null)
  /** The scrollable chat-messages container itself (not just the bottom
   *  marker) — needed so the up/down nav helper buttons can scroll it
   *  programmatically and so we can track scroll position to enable/disable
   *  each button. */
  const chatScrollRef = useRef<HTMLDivElement>(null)
  /** Whether the chat panel currently has room to scroll up / down, used to
   *  show the slim scroll-nav helper only when it's actually useful and to
   *  dim whichever direction is already at its limit. */
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const abortRef      = useRef<AbortController | null>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  /** Every follow-up suggestion (AI or static fallback) already shown this
   *  session, so the same phrase is never offered twice in one chat — this
   *  is what fixes the "same suggestion block repeats every turn" bug. */
  const shownSuggestionsRef = useRef<Set<string>>(new Set())
  /** Web Speech API instance for voice-to-text prompt input. Typed as `any`
   *  since SpeechRecognition isn't in the standard TS DOM lib yet. */
  const recognitionRef = useRef<any>(null)
  /** Input text captured before this recording session started, so
   *  interim/final voice transcripts are appended rather than overwriting
   *  anything the user already typed. */
  const voiceBaseTextRef = useRef("")
  /** Finalized phrases recognized so far in the CURRENT voice-input session
   *  (from tap-to-start to tap-to-stop). Kept as an array of already-final
   *  segments so it only ever grows — this is what makes the transcript
   *  survive silent engine restarts without repeating any phrase. */
  const finalSegmentsRef = useRef<string[]>([])
  /** How many entries of the underlying engine's `event.results` list have
   *  already been folded into `finalSegmentsRef`. Resets to 0 every time the
   *  engine starts a fresh internal session, since `results` indices are
   *  local to that session — reusing a stale count from a previous session
   *  is what caused finalized phrases to be re-added and duplicated. */
  const processedResultCountRef = useRef(0)
  /** Mirrors `isRecording` for the `onend` handler, which is registered once
   *  and would otherwise only ever see the value from that first render. */
  const isRecordingRef = useRef(false)

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  /** Recomputes whether the chat panel can still scroll up/down from its
   *  current position — drives the up/down nav helper's enabled state and
   *  whether it's shown at all (only when content actually overflows). */
  const updateChatScrollState = useCallback(() => {
    const el = chatScrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    setCanScrollUp(scrollTop > 4)
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 4)
  }, [])

  // Keep the nav-helper's up/down availability in sync with new messages,
  // streaming text growing the panel, and manual scrolling.
  useEffect(() => {
    updateChatScrollState()
  }, [messages, streamingText, updateChatScrollState])

  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    updateChatScrollState()
    el.addEventListener("scroll", updateChatScrollState, { passive: true })
    const resizeObserver = new ResizeObserver(updateChatScrollState)
    resizeObserver.observe(el)
    return () => {
      el.removeEventListener("scroll", updateChatScrollState)
      resizeObserver.disconnect()
    }
  }, [updateChatScrollState])

  /** Scrolls the chat panel up/down by ~80% of its visible height — used by
   *  the slim nav-helper buttons so users can page through long
   *  conversations without hunting for a trackpad/touch scroll gesture. */
  const scrollChatByPage = useCallback((direction: "up" | "down") => {
    const el = chatScrollRef.current
    if (!el) return
    const amount = el.clientHeight * 0.8 * (direction === "up" ? -1 : 1)
    el.scrollBy({ top: amount, behavior: "smooth" })
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px"
  }, [input])

  // Once a turn finishes and the AI-reasoned suggestions haven't landed yet,
  // register whatever the static fallback is currently showing so it also
  // rotates instead of repeating once the effect re-runs on the next turn.
  useEffect(() => {
    if (isStreaming || aiSuggestions !== null) return
    if (lastFullHtml.trim().length === 0) return
    getFollowUpSuggestions().forEach((s) => shownSuggestionsRef.current.add(s))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isStreaming])

  // Set up the Web Speech API recognizer once, if the browser supports it.
  // Chrome/Edge only expose it under the `webkit` prefix.
  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null
    if (!SpeechRecognitionCtor) {
      setVoiceSupported(false)
      return
    }
    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = typeof navigator !== "undefined" ? navigator.language || "id-ID" : "id-ID"

    recognition.onresult = (event: any) => {
      // Only walk NEW entries since the last processed index of THIS engine
      // session, and commit each finalized one exactly once into
      // `finalSegmentsRef` (never re-summed from scratch). This is what
      // prevents the repeated-phrase bug (e.g. "buat buat toko buat toko
      // online") that happened when some mobile browsers silently restart
      // their internal recognition session and re-emit earlier phrases —
      // recomputing the whole transcript from index 0 on every event used to
      // double-count that resent text.
      let interimText = ""
      for (let i = processedResultCountRef.current; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = (result[0]?.transcript ?? "").trim()
        if (result.isFinal) {
          if (transcript) finalSegmentsRef.current.push(transcript)
          processedResultCountRef.current = i + 1
        } else {
          interimText += transcript
        }
      }
      const combined = [voiceBaseTextRef.current, ...finalSegmentsRef.current, interimText]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" ")
      setInput(combined)
    }
    recognition.onerror = () => {
      isRecordingRef.current = false
      setIsRecording(false)
    }
    recognition.onend = () => {
      // `continuous: true` should keep listening indefinitely, but several
      // mobile browsers silently end the underlying session after a brief
      // pause anyway. If the user hasn't explicitly tapped stop, transparently
      // restart so speech keeps flowing into the same transcript instead of
      // requiring another tap — and reset only the per-session index, since
      // `finalSegmentsRef` must survive the restart to avoid losing text.
      if (isRecordingRef.current) {
        processedResultCountRef.current = 0
        try {
          recognition.start()
          return
        } catch {
          // Restart failed (e.g. mic revoked) — fall through to stopping.
        }
      }
      isRecordingRef.current = false
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.stop()
      } catch {}
    }
  }, [])

  const toggleRecording = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (isRecording) {
      // Flip the ref first so the `onend` handler this triggers treats it as
      // a deliberate stop rather than auto-restarting.
      isRecordingRef.current = false
      recognition.stop()
      setIsRecording(false)
      return
    }
    voiceBaseTextRef.current = input
    finalSegmentsRef.current = []
    processedResultCountRef.current = 0
    try {
      recognition.start()
      isRecordingRef.current = true
      setIsRecording(true)
    } catch {
      // Already started or mic permission denied — ignore, onerror covers it.
    }
  }, [isRecording, input])

  const MAX_MD_FILE_SIZE = 300 * 1024 // 300KB — plenty for a markdown doc, keeps the prompt payload sane

  /** Reads a selected .md file as plain text into `attachedFile` so its
   *  content can be sent to the model along with the next prompt. Validates
   *  extension and size before touching the file contents. */
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting the same file later
    if (!file) return

    const isMarkdown = /\.(md|markdown)$/i.test(file.name)
    if (!isMarkdown) {
      setFileError("Only .md files are supported")
      return
    }
    if (file.size > MAX_MD_FILE_SIZE) {
      setFileError("File is too large (max 300KB)")
      return
    }

    setFileError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : ""
      setAttachedFile({ name: file.name, content })
    }
    reader.onerror = () => setFileError("Could not read file")
    reader.readAsText(file)
  }

  function removeAttachedFile() {
    setAttachedFile(null)
    setFileError(null)
  }

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
  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || isStreaming) return
    if (!apiKey.trim()) return

    const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    // Keep the chat bubble showing only what the user typed — the file's
    // contents are shown as a small badge instead of flooding the thread.
    const userMsg: ChatMessage = { role: "user", content: text, ts, attachedFileName: attachedFile?.name }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsStreaming(true)
    setStreamingText("")
    // Clear last turn's AI suggestions — the follow-ups block is hidden
    // while `isStreaming` anyway, so this can't cause a visible flicker.
    setAiSuggestions(null)

    // If a .md file is attached, prepend its full contents ahead of the
    // instruction so the model reads it first before acting on the prompt.
    const contentForModel = attachedFile
      ? `Attached file "${attachedFile.name}":\n\n${attachedFile.content}\n\n---\n\nUser instruction: ${text}`
      : text

    const prevMessages = messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    const allMessages  = [...prevMessages, { role: "user" as const, content: contentForModel }]
    setAttachedFile(null)

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

    // Fire-and-forget: reason about a better set of follow-ups for the NEW
    // state of the document. Never awaited, so it can't slow down or block
    // the reply from appearing.
    const codeForSuggestions = fullHtml ?? lastFullHtml
    if (codeForSuggestions.trim().length > 0) {
      void refreshAiSuggestions(text, codeForSuggestions)
    }
  }, [input, isStreaming, messages, apiKey, provider, endpoint, headers, model, composedSkillPrompt, lastFullHtml, attachedFile])

  /**
   * Asks the model to reason step-by-step (hidden chain-of-thought) about
   * what kind of app this is, what it already has, and what single class of
   * improvement is most valuable next — then emit ONLY a JSON array of 3
   * short, varied Indonesian follow-up phrases. This replaces the static
   * keyword table as the primary suggestion source; the table is now just
   * instant filler while this call is in flight, and it's what actually
   * fixes suggestions repeating turn after turn, since each pass reasons
   * fresh over the latest code and explicitly avoids anything already shown.
   * Fire-and-forget from `sendMessage` — any failure just leaves the
   * fallback list on screen, so this can never break the main chat flow.
   */
  async function refreshAiSuggestions(userGoal: string, code: string) {
    if (!apiKey.trim() || !code.trim()) return
    const already = Array.from(shownSuggestionsRef.current)
    const reasoningPrompt = `You are reasoning silently about what to suggest next for a web project — the user will only see your final answer, never your reasoning.

Think step by step (to yourself, not in the output):
1. What kind of app/page is this, based on the user's goal and the HTML/CSS/JS below?
2. What features does the code already implement?
3. What single class of improvement would be most valuable to offer next — pick a DIFFERENT kind each time (a new feature, a UX/visual polish, more content, or robustness/error-handling) rather than always defaulting to the same category.
4. Draft 3 short, concrete, varied Indonesian action phrases (max ~6 words each, e.g. "Tambahkan halaman checkout") that match that reasoning.

Then output ONLY a raw JSON array of exactly those 3 strings — no markdown, no code fence, no explanation, no reasoning text. Example output:
["Tambahkan filter kategori","Tambahkan animasi hover pada kartu","Tambahkan penanganan error saat submit"]

Rules:
- Never repeat any of these already-suggested phrases (case-insensitive): ${already.length > 0 ? already.join(" | ") : "(none yet)"}
- Never suggest something that already clearly exists in the code below.
- The 3 phrases must each represent a different category of improvement.
- Output nothing but the JSON array.

User's original goal: ${userGoal}

Current code (reference only):
${code.slice(0, 6000)}`

    try {
      const res = await fetch("/api/manual-test/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          endpoint,
          headers,
          messages: [{ role: "user", content: reasoningPrompt }],
          systemPrompt: "Reply with only a raw JSON array of strings — nothing else.",
          model: model.trim() || undefined,
        }),
      })
      const reader = res.body?.getReader()
      if (!reader) return
      const dec = new TextDecoder()
      let buf = ""
      let currentEvent = "token"
      let acc = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line) { currentEvent = "token"; continue }
          if (line.startsWith("event:")) { currentEvent = line.slice(6).trim(); continue }
          if (!line.startsWith("data:")) continue
          const dataStr = line.slice(5).trim()
          if (!dataStr || dataStr === "[DONE]") continue
          try {
            const parsed = JSON.parse(dataStr) as Record<string, unknown>
            if (currentEvent === "token") acc += (parsed.text as string) ?? ""
          } catch { /* skip */ }
        }
      }
      reader.releaseLock()

      const match = acc.match(/\[[\s\S]*\]/)
      if (!match) return
      const parsedArr = JSON.parse(match[0])
      if (!Array.isArray(parsedArr)) return

      const picks: string[] = []
      for (const item of parsedArr) {
        if (typeof item !== "string") continue
        const clean = item.trim()
        if (!clean || shownSuggestionsRef.current.has(clean)) continue
        picks.push(clean)
        if (picks.length >= 3) break
      }
      if (picks.length === 0) return
      picks.forEach((p) => shownSuggestionsRef.current.add(p))
      setAiSuggestions(picks)
    } catch {
      // Silent — the static fallback list stays on screen.
    }
  }

  /**
   * Asks the model to rewrite the user's raw prompt into an expert,
   * production-grade version — the kind a senior developer would hand off
   * to another engineer or to an AI code-gen tool. This goes beyond typo/
   * grammar cleanup: it adds the technical specificity, structure, and
   * implied best practices (responsiveness, validation, error handling,
   * edge cases, etc.) a professional would naturally include, WITHOUT
   * inventing unrelated features or changing the original intent/scope.
   *
   * Returns a discriminated result rather than a bare `string | null` so the
   * caller can tell "nothing needed changing" apart from "the refine call
   * itself failed" — previously both collapsed into the same `null`, so a
   * genuine API/network error silently sent the un-refined prompt with zero
   * indication to the user that "Perbaikan prompt" had actually failed.
   */
  async function refinePromptText(
    raw: string,
  ): Promise<{ status: "ok"; text: string } | { status: "unchanged" } | { status: "error" }> {
    if (!apiKey.trim() || !raw.trim()) return { status: "unchanged" }
    const refinePrompt = `Kamu adalah senior software engineer & prompt engineer profesional. Tulis ulang permintaan pengguna berikut menjadi prompt level-expert yang siap dipakai untuk code-generation — seperti yang akan ditulis oleh developer profesional, bukan sekadar memperbaiki typo.

Lakukan ini:
- Perjelas maksud, ruang lingkup, dan hasil akhir yang diharapkan dengan bahasa yang tegas dan spesifik
- Tambahkan detail teknis yang wajar tersirat dari permintaan aslinya (contoh: struktur/komponen, responsivitas, accessibility, validasi input, penanganan error/edge case, performa) HANYA jika itu relevan dan tidak mengubah cakupan permintaan
- Rapikan tata bahasa, ejaan, dan struktur kalimat supaya terbaca profesional dan actionable
- JANGAN menambahkan fitur besar atau permintaan baru yang sama sekali tidak disebutkan/tidak tersirat
- JANGAN mengubah maksud inti permintaan
- JANGAN mengubah bahasa yang dipakai (kalau aslinya Indonesia, hasilnya juga Indonesia; kalau Inggris, tetap Inggris)

Jika teks aslinya sudah sangat jelas, detail, dan setara level profesional, kembalikan teks itu sama persis tanpa perubahan.

Balas HANYA dengan teks prompt hasil penyempurnaan — tanpa tanda kutip, tanpa penjelasan, tanpa awalan seperti "Berikut" atau "Versi perbaikan:".

Permintaan asli:
${raw}`

    try {
      const res = await fetch("/api/manual-test/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          endpoint,
          headers,
          messages: [{ role: "user", content: refinePrompt }],
          systemPrompt:
            "You are an expert senior software engineer rewriting prompts to a professional, production-ready standard. Reply with only the improved prompt text — nothing else, no quotes, no explanation.",
          model: model.trim() || undefined,
        }),
      })
      // A non-2xx response (bad model, invalid key, upstream 4xx/5xx) has no
      // SSE stream to read — treat it as a real failure instead of falling
      // through to an empty accumulator that looks like "no change needed".
      if (!res.ok) return { status: "error" }
      const reader = res.body?.getReader()
      if (!reader) return { status: "error" }
      const dec = new TextDecoder()
      let buf = ""
      let currentEvent = "token"
      let acc = ""
      let sawErrorEvent = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line) { currentEvent = "token"; continue }
          if (line.startsWith("event:")) { currentEvent = line.slice(6).trim(); continue }
          if (!line.startsWith("data:")) continue
          const dataStr = line.slice(5).trim()
          if (!dataStr || dataStr === "[DONE]") continue
          try {
            const parsed = JSON.parse(dataStr) as Record<string, unknown>
            if (currentEvent === "token") acc += (parsed.text as string) ?? ""
            if (currentEvent === "error") sawErrorEvent = true
          } catch { /* skip */ }
        }
      }
      reader.releaseLock()
      if (sawErrorEvent) return { status: "error" }

      // Strip a wrapping code fence or quotes the model might add anyway.
      const cleaned = acc
        .trim()
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/```$/, "")
        .replace(/^"([\s\S]*)"$/, "$1")
        .trim()
      if (cleaned.length === 0) return { status: "error" }
      return cleaned === raw.trim() ? { status: "unchanged" } : { status: "ok", text: cleaned }
    } catch {
      return { status: "error" }
    }
  }

  /**
   * Entry point for both the Enter key and the send button. When prompt
   * refinement is enabled, this NEVER sends anything itself — it only ever
   * populates `promptReview` for the user to approve, edit, or reject.
   * Approval always happens through `approvePromptReview` /
   * `sendOriginalPrompt`, never automatically.
   */
  async function requestSend() {
    const text = input.trim()
    if (!text || isStreaming || isRefiningPrompt || !apiKey.trim()) return

    if (!improveEnabled) {
      sendMessage()
      return
    }

    setIsRefiningPrompt(true)
    const result = await refinePromptText(text)
    setIsRefiningPrompt(false)

    if (result.status === "error") {
      // The refine call itself failed (bad key/model, network, upstream
      // error) — tell the user plainly instead of silently sending the
      // untouched prompt, which looked like the button "did nothing".
      setRefineNotice("Perbaikan prompt gagal — mengirim teks asli")
      setTimeout(() => setRefineNotice(null), 3500)
      sendMessage()
      return
    }

    // Nothing needed improving — just send as-is rather than blocking the
    // user on a no-op approval step.
    if (result.status === "unchanged") {
      sendMessage()
      return
    }

    setPromptReview({ original: text, suggested: result.text, edited: result.text })
  }

  function approvePromptReview() {
    if (!promptReview) return
    const finalText = promptReview.edited.trim()
    setPromptReview(null)
    if (finalText) sendMessage(finalText)
  }

  function sendOriginalPrompt() {
    if (!promptReview) return
    const original = promptReview.original
    setPromptReview(null)
    sendMessage(original)
  }

  function cancelPromptReview() {
    setPromptReview(null)
    // Leave the original text in the input box so the user can edit it
    // further or try sending again.
  }

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

  // ── ZIP helpers ────────────���────────────────────────────────────────────────
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
        <div key={i} className="flex flex-col items-end gap-1">
          {msg.attachedFileName && (
            <div className="flex items-center gap-1.5 max-w-[75%] rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] text-muted-foreground">
              <FileTextIcon />
              <span className="truncate">{msg.attachedFileName}</span>
            </div>
          )}
          <div className="max-w-[75%] rounded-xl rounded-tr-sm bg-primary/15 border border-primary/25 px-3 py-2 text-[12px] text-foreground leading-relaxed">
            {msg.content}
          </div>
        </div>
      )
    }

    // Assistant — split on code fences to render code blocks inline
    const parts = msg.content.split(/(```[\s\S]*?```)/g)

    return (
      <div key={i} className="flex items-start gap-2">
        {/* Assistant avatar — the Miuclaw cat mascot, matching the icon used
            on the production site (miuclaw.my.id), so replies are clearly
            attributed to the brand rather than a generic bot glyph. */}
        <img
          src="/images/cat-mascot.png"
          alt="Miuclaw AI"
          className="w-6 h-6 rounded-full border border-border/50 flex-shrink-0 mt-0.5 object-cover"
        />
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex flex-col gap-2">
          {/* Full-file action strip — shown once per turn when an edit was
              merged, so the merged document stays copy/downloadable without
              ever re-printing the whole file inline. Rendered first and
              pinned to the top of the scroll area so it stays reachable
              even while the generated content below is very long. */}
          {msg.fullHtml && (
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/95 backdrop-blur-sm px-2.5 py-1.5 shadow-sm">
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
                  {/* Code block header — sticky so it stays visible while
                      scrolling through long generated code instead of
                      disappearing off the top of the chat. */}
                  <div className={`sticky top-0 z-10 flex items-center justify-between px-3 py-1.5 border-b backdrop-blur-sm ${isDiff ? "border-primary/15 bg-primary/15" : "border-border/40 bg-muted/90"}`}>
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
        </div>
        <span className="text-[10px] text-muted-foreground/70 ml-0.5">{msg.ts}</span>
        </div>
      </div>
    )
  }

  /** Builds follow-ups from what was actually asked for and what the last
   *  generated page already contains, instead of a fixed rotating pool —
   *  e.g. a landing page prompt surfaces "Tambahkan testimoni", and
   *  "Ubah ke mode gelap" is skipped once the page is already dark. */
  function getFollowUpSuggestions(count = 3): string[] {
    const lastUserPrompt = [...messages].reverse().find((m) => m.role === "user")?.content?.toLowerCase() ?? ""
    const html = lastFullHtml.toLowerCase()

    const candidates: string[] = []
    for (const group of CONTEXTUAL_FOLLOWUPS) {
      if (group.keywords.some((kw) => lastUserPrompt.includes(kw))) {
        candidates.push(...group.suggestions)
      }
    }
    candidates.push(...GENERIC_FOLLOWUPS)

    // Skip suggestions for features the code already appears to have.
    const alreadyPresent = (s: string) => {
      const lower = s.toLowerCase()
      if (lower.includes("mode gelap") && (html.includes("dark") || html.includes("#000") || html.includes("prefers-color-scheme"))) return true
      if (lower.includes("animasi") && (html.includes("@keyframes") || html.includes("animation:") || html.includes("transition"))) return true
      if (lower.includes("responsive") && html.includes("@media")) return true
      if (lower.includes("footer") && html.includes("<footer")) return true
      if (lower.includes("form kontak") && html.includes("<form")) return true
      return false
    }

    const seen = new Set<string>()
    const picks: string[] = []
    for (const c of candidates) {
      if (picks.length >= count) break
      if (seen.has(c) || alreadyPresent(c) || shownSuggestionsRef.current.has(c)) continue
      seen.add(c)
      picks.push(c)
    }
    // If every candidate has already been shown this session, allow repeats
    // rather than showing nothing — better than an empty follow-ups block.
    if (picks.length === 0) {
      for (const c of candidates) {
        if (picks.length >= count) break
        if (seen.has(c) || alreadyPresent(c)) continue
        seen.add(c)
        picks.push(c)
      }
    }
    return picks
  }

  // ── Layout ───────────────────────────────────────────────────────────────────

  // On mobile there is no room for a real side-by-side split, so "split"
  // collapses to a single active pane (Code by default) with the toggle
  // acting as a Code/Preview tab switcher instead.
  const showCode    = isMobile ? viewMode !== "preview" : viewMode === "split" || viewMode === "code"
  const showPreview = isMobile ? viewMode === "preview" : viewMode === "split" || viewMode === "preview"
  const noKey       = !apiKey.trim()

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

      {/* ── Toolbar ───────��────��──���─────────────────────────────────────────── */}
      {/* Sticky + solid background + high z-index so the model selector and
          Code/Split/Preview switcher stay reachable no matter which
          ancestor ends up scrolling (mobile browsers in particular can end
          up scrolling the outer page instead of just the inner message
          list, which would otherwise carry this toolbar off-screen). */}
      <div className="sticky top-0 z-30 flex-shrink-0">

        {/* Top strip — still reserves one bar's worth of height (plus the
            device's own safe-area inset) above the real toolbar, so mobile
            browser chrome (URL bar) never covers the toolbar underneath.
            Carries a live ticker of public feedback comments (Neon-backed,
            polls for updates) plus a "Feedback" button to post a new one.
            Every 3 minutes it briefly switches to the Independence Day
            message instead. See components/comment-marquee.tsx. */}
        <CommentMarquee />

        <div className="flex flex-wrap items-center gap-2 px-3 py-2 md:h-9 md:py-0 border-b border-border/40 bg-sidebar">

        {/* Model selector */}
        {(workingModels.length > 0 || (presetModels && presetModels.length > 0)) && (
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="text-[11px] font-medium bg-background text-foreground border border-border rounded px-2 py-1.5 md:py-1 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer min-w-0 flex-1 max-w-[240px] md:max-w-[180px] truncate"
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

        <div className="hidden md:block flex-1" />

        {/* View mode toggle — "Split" only makes sense once there's room for two panes */}
        <div className="flex items-center gap-0.5 rounded-md border border-border/50 bg-muted/30 p-0.5 ml-auto">
          {([
            { id: "code"    as const, icon: <CodeIcon />,    label: "Code"    },
            ...(isMobile ? [] : [{ id: "split" as const, icon: <SplitIcon />, label: "Split" }]),
            { id: "preview" as const, icon: <PreviewIcon />, label: "Preview" },
          ]).map((v) => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              title={v.label}
              className={`flex items-center justify-center w-7 h-7 md:w-6 md:h-6 rounded transition-all ${
                viewMode === v.id
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.icon}
            </button>
          ))}
        </div>

        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      {(() => {
        // "Split" only renders side-by-side once there's room for two panes;
        // on mobile it collapses to a single full-width active pane.
        const isSplitActive = viewMode === "split" && !isMobile
        return (
      <div className={`flex-1 min-h-0 flex overflow-hidden ${isSplitActive ? "flex-row" : "flex-col"}`}>

        {/* ── LEFT: Code / Chat panel ───────────────────────────────────────��� */}
        {showCode && (
          <div
            className={`flex flex-col min-h-0 overflow-hidden ${
              isSplitActive
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

            {/* Chat messages — wrapped in its own relative container (scoped
                to just this scrollable area, not the whole panel) so the
                scroll-nav helper below stays anchored inside the messages
                area and never overlaps the input bar underneath it. */}
            <div className="relative flex-1 min-h-0">
            <div ref={chatScrollRef} className="absolute inset-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
              {messages.length === 0 && !isStreaming && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center select-none pointer-events-none">
                  {/* Empty-state mark — the Miuclaw cat mascot, matching the
                      branding used on the production site (miuclaw.my.id),
                      instead of a generic code glyph. */}
                  <div className="w-14 h-14 rounded-2xl border border-primary/20 bg-primary/8 flex items-center justify-center shadow-[0_0_18px_oklch(0.76_0.17_192_/_0.10)] overflow-hidden">
                    <img
                      src="/images/cat-mascot.png"
                      alt="Miuclaw"
                      className="w-9 h-9 rounded-lg object-cover"
                    />
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

              {/* Suggested follow-ups — shown after the latest reply once a
                  project already exists, so the user can keep iterating with
                  one tap instead of typing a new request every turn. */}
              {!isStreaming && lastFullHtml.trim().length > 0 && (
                <div className="flex flex-col gap-2 pt-1 pl-8">
                  <span className="text-[11px] text-muted-foreground/60">Suggested follow-ups</span>
                  <div className="flex flex-col gap-1.5 items-start">
                    {(aiSuggestions && aiSuggestions.length > 0 ? aiSuggestions : getFollowUpSuggestions()).map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        disabled={noKey}
                        className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-primary disabled:opacity-40 disabled:hover:text-muted-foreground transition-colors"
                      >
                        <ArrowRightIcon />
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

            {/* Slim scroll-nav helper — only appears once the conversation
                actually overflows the panel, so short chats stay clean.
                Lets users page up/down through long threads without
                hunting for a trackpad/touch scroll gesture. */}
            {(canScrollUp || canScrollDown) && (
              <div className="absolute right-2.5 bottom-3 z-10 flex flex-col rounded-full border border-border/50 bg-sidebar/85 backdrop-blur-sm shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => scrollChatByPage("up")}
                  disabled={!canScrollUp}
                  aria-label="Gulir ke atas"
                  className="flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors"
                >
                  <ChevronUpIcon />
                </button>
                <div className="h-px bg-border/50" />
                <button
                  type="button"
                  onClick={() => scrollChatByPage("down")}
                  disabled={!canScrollDown}
                  aria-label="Gulir ke bawah"
                  className="flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors"
                >
                  <ChevronDownIcon />
                </button>
              </div>
            )}
            </div>

  {/* ── Input bar ──────────────────────────────────────────────────── */}
  <div className="flex-shrink-0 border-t border-border/40 bg-sidebar/30 px-3 py-2">
  <input
  ref={fileInputRef}
  type="file"
  accept=".md,.markdown,text/markdown"
  onChange={handleFileSelect}
  className="hidden"
  />
  {attachedFile && (
  <div className="flex items-center gap-2 mb-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5">
  <FileTextIcon />
  <span className="flex-1 text-[11px] text-foreground truncate">{attachedFile.name}</span>
  <span className="text-[10px] text-muted-foreground/70">{(attachedFile.content.length / 1024).toFixed(1)}KB</span>
  <button
  onClick={removeAttachedFile}
  title="Remove file"
  className="flex items-center justify-center w-4 h-4 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
  >
  <XIcon />
  </button>
  </div>
  )}
  {fileError && (
  <p className="text-[10px] text-destructive mb-1.5 ml-1">{fileError}</p>
  )}

  {/* Prompt-refinement approval card — appears only after the user tries
      to send while "improve prompt" is on and the model actually proposed
      a change. Nothing is sent until the user explicitly approves. */}
  {promptReview && (
    <div className="flex flex-col gap-2 mb-1.5 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
        <WandIcon />
        <span>Saran perbaikan prompt — periksa dulu sebelum kirim</span>
      </div>
      <div className="rounded-md bg-muted/30 px-2.5 py-1.5">
        <p className="text-[9px] uppercase tracking-wide text-muted-foreground/70 mb-0.5">Teks asli</p>
        <p className="text-[11px] text-muted-foreground line-clamp-3">{promptReview.original}</p>
      </div>
      <textarea
        value={promptReview.edited}
        onChange={(e) => setPromptReview((prev) => (prev ? { ...prev, edited: e.target.value } : prev))}
        rows={3}
        className="w-full resize-none rounded-md border border-primary/20 bg-background/80 px-2.5 py-1.5 text-[11px] text-foreground focus:outline-none focus:border-primary/50 leading-relaxed"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={approvePromptReview}
          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <CheckIcon />
          Gunakan &amp; kirim
        </button>
        <button
          onClick={sendOriginalPrompt}
          className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted/60 transition-colors"
        >
          Kirim versi asli
        </button>
        <button
          onClick={cancelPromptReview}
          className="ml-auto flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title="Batal"
        >
          <XIcon />
        </button>
      </div>
    </div>
  )}

  <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 focus-within:border-primary/40 transition-colors">
  <button
  onClick={() => fileInputRef.current?.click()}
  disabled={noKey || isStreaming}
  title="Attach .md file"
  className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
  >
  <PaperclipIcon />
  </button>
  <button
  onClick={() => setImproveEnabled((v) => !v)}
  disabled={noKey || isStreaming}
  title={improveEnabled ? "Perbaikan prompt: aktif (klik untuk matikan)" : "Perbaikan prompt: nonaktif (klik untuk aktifkan)"}
  className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
    improveEnabled
      ? "bg-primary/15 text-primary hover:bg-primary/25"
      : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
  }`}
  >
  <WandIcon />
  </button>
  <textarea
  ref={textareaRef}
  value={input}
  onChange={(e) => setInput(e.target.value)}
  onKeyDown={(e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !(e.keyCode === 229)) {
  e.preventDefault()
  requestSend()
  }
  }}
  placeholder={noKey ? "Add API key first…" : isRefiningPrompt ? "Menyempurnakan prompt…" : "Describe what to build… (Enter to send)"}
  disabled={noKey || isRefiningPrompt}
  rows={1}
  className="flex-1 min-h-[20px] max-h-[140px] resize-none bg-transparent text-[12px] text-foreground placeholder-muted-foreground/50 focus:outline-none leading-relaxed"
  />
  {voiceSupported && (
  <button
  onClick={toggleRecording}
  disabled={noKey || isStreaming || isRefiningPrompt}
  title={isRecording ? "Stop recording" : "Voice input"}
  className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
  isRecording
  ? "bg-destructive/20 text-destructive animate-pulse"
  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
  }`}
  >
  <MicIcon />
  </button>
  )}
  <button
  onClick={() => (isStreaming ? stopStreaming() : requestSend())}
  disabled={!isStreaming && (!input.trim() || noKey || isRefiningPrompt)}
  className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
  isStreaming
  ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
  : isRefiningPrompt
  ? "bg-muted/30 text-muted-foreground/60 cursor-not-allowed animate-pulse"
  : input.trim() && !noKey
  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_10px_oklch(0.76_0.17_192_/_0.25)]"
  : "bg-muted/30 text-muted-foreground/60 cursor-not-allowed"
  }`}
  >
  {isStreaming ? <StopIcon /> : <SendIcon />}
  </button>
  </div>
  <p className={`text-[10px] mt-1.5 ml-1 ${refineNotice ? "text-destructive" : "text-muted-foreground/60"}`}>
  {refineNotice
    ? refineNotice
    : isRecording
    ? "Listening… tap mic to stop"
    : isRefiningPrompt
    ? "Menyempurnakan prompt sebelum dikirim…"
    : "Shift+Enter for new line · powered by " + providerName}
  </p>
  </div>
          </div>
        )}

        {/* ── RIGHT: Preview panel ─────────────────────────────────────────── */}
        {showPreview && (
          <div
            className={`flex flex-col min-h-0 overflow-hidden ${
              isSplitActive ? "w-1/2" : "flex-1"
            }`}
          >
            {/* Preview toolbar */}
            {previewSrc && (
              <div className="flex items-center gap-2 px-3 h-8 border-b border-border/40 bg-sidebar/20 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground flex-1 text-center truncate">Preview</span>
              </div>
            )}

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
                <div className="flex flex-col items-center justify-center h-full gap-4 bg-sidebar select-none px-6">
                  <div className="w-14 h-14 rounded-2xl border border-dashed border-border/40 bg-muted/10 flex items-center justify-center">
                    <PreviewIcon />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-foreground/70 mb-1">Live Preview</p>
                    <p className="text-[11px] text-muted-foreground/70 max-w-[200px] leading-relaxed">
                      Your generated app will render here once the AI finishes building it.
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
        )
      })()}
    </div>
  )
}
