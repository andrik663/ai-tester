"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  ts: string
  codeBlocks?: ExtractedCode[]
}

interface ExtractedCode {
  lang: string
  code: string
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
  /** System prompt override from an active Skill */
  activeSkillSystemPrompt?: string
  /** Human-readable name of the active skill */
  activeSkillName?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CODE_SYSTEM_PROMPT = `You are an expert web developer. When the user asks you to build or create something, respond with a SINGLE complete, self-contained HTML document that includes all CSS and JavaScript inline. Always output code in a fenced code block with the \`\`\`html language tag.

Rules:
- Always produce one complete HTML file with <!DOCTYPE html>, <html>, <head>, <body>.
- All styles must be in a <style> tag inside <head>. Use modern CSS.
- All scripts must be in a <script> tag before </body>. Use vanilla JS or CDN libraries only.
- Do not import from npm or use build tools.
- Make the output visually polished and professional.
- If the user asks a question instead of requesting code, answer concisely in plain text.`

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
  activeSkillSystemPrompt,
  activeSkillName,
}: Props) {
  // ── State ───────────────────────────────────────────────────────────────────
  type ViewMode = "split" | "code" | "preview"
  const [viewMode, setViewMode]         = useState<ViewMode>("split")
  const [messages, setMessages]         = useState<ChatMessage[]>([])
  const [input, setInput]               = useState("")
  const [isStreaming, setIsStreaming]   = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [previewSrc, setPreviewSrc]     = useState("")
  const [previewKey, setPreviewKey]     = useState(0)
  const [copyFeedback, setCopyFeedback] = useState<number | null>(null)
  const [iframeError, setIframeError]   = useState(false)

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

  // When streaming finishes, extract latest code and update preview
  useEffect(() => {
    if (isStreaming) return
    if (messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.role === "assistant" && last.codeBlocks && last.codeBlocks.length > 0) {
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
          systemPrompt: activeSkillSystemPrompt
            ? `${activeSkillSystemPrompt}\n\n---\n\nWhen generating code output, always wrap it in a single fenced \`\`\`html code block containing a complete, self-contained HTML document with <!DOCTYPE html>. Include all CSS in a <style> tag and all JS in a <script> tag so the preview iframe can render it immediately.`
            : CODE_SYSTEM_PROMPT,
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

    const codeBlocks = extractCodeBlocks(accumulated)
    const replyTs    = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: accumulated || "(empty response)", ts: replyTs, codeBlocks },
    ])
    setStreamingText("")
    setIsStreaming(false)
    abortRef.current = null
  }, [input, isStreaming, messages, apiKey, provider, endpoint, headers, model, activeSkillSystemPrompt])

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
              const lang = fenceMatch[1] || "text"
              const code = fenceMatch[2].trim()
              return (
                <div key={pi} className="rounded-lg border border-border/60 bg-muted/40 overflow-hidden">
                  {/* Code block header */}
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-muted/30">
                    <span className="text-[10px] font-mono text-muted-foreground">{lang}</span>
                    <button
                      onClick={() => copyCode(code, i * 100 + pi)}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <CopyIcon />
                      {copyFeedback === i * 100 + pi ? "Copied!" : "Copy"}
                    </button>
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

        {/* Active skill badge */}
        {activeSkillName && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-primary/30 bg-primary/10 text-primary max-w-[130px]">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="w-2.5 h-2.5 flex-shrink-0">
              <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z" />
            </svg>
            <span className="text-[10px] font-medium truncate">{activeSkillName}</span>
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
                  <div>
                    <p className="text-[13px] font-medium text-foreground mb-0.5">
                      {activeSkillName ? `Skill: ${activeSkillName}` : "Code Preview"}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[200px]">
                      {activeSkillName
                        ? `AI is using the "${activeSkillName}" skill. Ask it to build or create something.`
                        : "Ask the AI to build something — it generates live HTML, CSS & JS you can preview instantly."}
                    </p>
                  </div>
                  {activeSkillName && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-primary/30 bg-primary/10 text-primary">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0">
                        <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z" />
                      </svg>
                      <span className="text-[10px] font-semibold">{activeSkillName} active</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 w-full max-w-[220px]">
                    {(activeSkillName === "Web Artifacts Builder"
                      ? ["Build a dashboard with charts", "Create a shadcn/ui form", "Make a multi-step wizard"]
                      : activeSkillName === "Algorithmic Art"
                      ? ["Particle flow field with p5.js", "Cellular automata simulation", "Perlin noise landscape"]
                      : activeSkillName === "Theme Factory"
                      ? ["Apply Ocean Depths theme", "Generate a dark tech theme", "Create a warm golden theme"]
                      : [
                          "Build a todo app with dark mode",
                          "Create an animated gradient clock",
                          "Make a responsive pricing card",
                        ]
                    ).map((ex) => (
                      <button
                        key={ex}
                        onClick={() => { setInput(ex); textareaRef.current?.focus() }}
                        className="pointer-events-auto text-left text-[11px] px-2.5 py-1.5 rounded-lg border border-border/50 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
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
              {/* Traffic light dots */}
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500/60" />
                <span className="w-2 h-2 rounded-full bg-yellow-500/60" />
                <span className="w-2 h-2 rounded-full bg-green-500/60" />
              </div>
              <span className="text-[10px] text-muted-foreground/60 flex-1 text-center truncate">
                {previewSrc ? "Preview" : "No output yet"}
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
