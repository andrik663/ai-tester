"use client"

import { useEffect, useRef, useState } from "react"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface RequestLog {
  timestamp: string
  endpoint: string
  requestBody: object
  responseText: string
  durationMs: number
  inputTokens: number
  outputTokens: number
  status: "success" | "error"
  error?: string
}

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-3-flash",
  "gemini-flash-latest",
]

const SUGGESTIONS = [
  "Explain how AI works in a few words",
  "Write a haiku about coding",
  "What is 17 × 83?",
  "Summarize the history of the internet",
]

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <polyline points="6 9 12 15 18 9" />
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

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<RequestLog | null>(null)
  const [copied, setCopied] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<"request" | "response">("response")

  // Config
  const [model, setModel] = useState(MODELS[0])
  const [temperature, setTemperature] = useState(1.0)
  const [maxTokens, setMaxTokens] = useState(2048)
  const [systemPrompt, setSystemPrompt] = useState("")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px"
  }, [input])

  async function sendMessage() {
    const text = input.trim()
    if (!text || isLoading) return

    const newMessages: Message[] = [...messages, { role: "user", content: text }]
    setMessages(newMessages)
    setInput("")
    setIsLoading(true)
    setError(null)

    const startTime = Date.now()

    const requestBody = {
      model,
      temperature,
      maxOutputTokens: maxTokens,
      systemPrompt: systemPrompt || undefined,
      messages: newMessages,
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error ?? `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error("No response body")

      let assistantText = ""
      setMessages((prev) => [...prev, { role: "assistant", content: "" }])

      let buf = ""
      let inputTokens = 0
      let outputTokens = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("data:")) continue
          const data = trimmed.slice(5).trim()
          if (!data || data === "[DONE]") continue
          try {
            const chunk = JSON.parse(data)
            if (chunk.text) {
              assistantText += chunk.text
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: "assistant", content: assistantText }
                return updated
              })
            }
            if (chunk.inputTokens) inputTokens = chunk.inputTokens
            if (chunk.outputTokens) outputTokens = chunk.outputTokens
          } catch { /* skip */ }
        }
      }

      const durationMs = Date.now() - startTime
      setLog({
        timestamp: new Date().toISOString(),
        endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`,
        requestBody: {
          contents: newMessages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: { temperature, maxOutputTokens: maxTokens },
          ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
        },
        responseText: assistantText,
        durationMs,
        inputTokens,
        outputTokens,
        status: "success",
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg)
      setMessages((prev) => prev.slice(0, -1))
      setLog((prev) =>
        prev
          ? { ...prev, status: "error", error: msg }
          : {
              timestamp: new Date().toISOString(),
              endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`,
              requestBody,
              responseText: "",
              durationMs: Date.now() - startTime,
              inputTokens: 0,
              outputTokens: 0,
              status: "error",
              error: msg,
            }
      )
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function clearChat() {
    setMessages([])
    setLog(null)
    setError(null)
  }

  const inspectorJson =
    inspectorTab === "request"
      ? JSON.stringify(log?.requestBody ?? {}, null, 2)
      : JSON.stringify({ response: log?.responseText ?? "", ...(log?.error ? { error: log.error } : {}) }, null, 2)

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">

      {/* LEFT — Config Panel */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-border flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground text-xs font-bold font-mono">G</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground leading-none">Gemini Tester</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">API v1beta</p>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 flex flex-col gap-5">

          {/* Model */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Model</label>
            <div className="relative">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full appearance-none rounded-md border border-border bg-background text-foreground text-xs px-3 py-2 pr-7 font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                <ChevronDown />
              </span>
            </div>
          </div>

          {/* Temperature */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Temperature</label>
              <span className="text-xs font-mono text-primary">{temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-secondary accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Max tokens */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Max Tokens</label>
              <span className="text-xs font-mono text-primary">{maxTokens.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="128"
              max="8192"
              step="128"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-secondary accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>128</span>
              <span>8192</span>
            </div>
          </div>

          {/* System prompt */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Optional system instruction..."
              rows={4}
              className="w-full rounded-md border border-border bg-background text-foreground text-xs px-3 py-2 resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring leading-relaxed"
            />
          </div>

          {/* Stats */}
          {log && (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Last Request</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <Stat label="Duration" value={`${log.durationMs}ms`} />
                <Stat label="Status" value={log.status === "success" ? "200 OK" : "Error"} error={log.status === "error"} />
                <Stat label="Input tk." value={log.inputTokens > 0 ? log.inputTokens.toString() : "—"} />
                <Stat label="Output tk." value={log.outputTokens > 0 ? log.outputTokens.toString() : "—"} />
              </div>
            </div>
          )}
        </div>

        {/* Endpoint badge */}
        <div className="px-4 pb-4">
          <p className="text-[9px] text-muted-foreground font-mono break-all leading-relaxed">
            POST generativelanguage.googleapis.com/v1beta
          </p>
        </div>
      </aside>

      {/* CENTER — Chat */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-mono text-muted-foreground">{model}</span>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-secondary"
              >
                <TrashIcon />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="max-w-2xl mx-auto flex flex-col gap-5">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center">
                  <span className="text-xl font-bold text-primary font-mono">G</span>
                </div>
                <div>
                  <p className="text-foreground font-semibold text-base">Gemini API Tester</p>
                  <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                    Configure the model on the left, then send a message.<br />
                    The inspector panel shows the raw API call.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-md bg-primary flex-shrink-0 flex items-center justify-center mt-0.5">
                    <span className="text-primary-foreground text-[10px] font-bold font-mono">G</span>
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-secondary text-foreground rounded-br-sm"
                      : "bg-card text-foreground border border-border rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                  {msg.role === "assistant" && !msg.content && isLoading && (
                    <span className="inline-flex gap-1 items-center h-4">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                      <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                      <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            ))}

            {error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
                <span className="font-semibold">Error: </span>{error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-border bg-card flex-shrink-0">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-4 py-3 focus-within:border-ring transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message... (Enter to send, Shift+Enter for newline)"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-85 transition-opacity"
              >
                {isLoading ? <SpinnerIcon /> : <SendIcon />}
              </button>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-2 font-mono">
              X-goog-api-key · streamGenerateContent?alt=sse
            </p>
          </div>
        </div>
      </main>

      {/* RIGHT — Inspector */}
      <aside className="w-72 flex-shrink-0 flex flex-col border-l border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Inspector</p>
          {log && (
            <button
              onClick={() => copyToClipboard(inspectorJson)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Copy to clipboard"
            >
              <CopyIcon />
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0">
          {(["request", "response"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setInspectorTab(tab)}
              className={`flex-1 py-2.5 text-[11px] font-medium capitalize transition-colors ${
                inspectorTab === tab
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* JSON content */}
        <div className="flex-1 overflow-y-auto p-3">
          {log ? (
            <pre className="text-[10px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
              {inspectorJson}
            </pre>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
              <div className="w-8 h-8 rounded-lg border border-border flex items-center justify-center opacity-40">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-muted-foreground">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Send a message to see the raw API request and response here.
              </p>
            </div>
          )}
        </div>

        {/* cURL preview */}
        {log && inspectorTab === "request" && (
          <div className="border-t border-border p-3 flex-shrink-0">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Equivalent cURL</p>
            <pre className="text-[9px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
{`curl "${log.endpoint}?alt=sse" \\
  -H 'Content-Type: application/json' \\
  -H 'X-goog-api-key: YOUR_KEY' \\
  -X POST \\
  -d '${JSON.stringify(log.requestBody)}'`}
            </pre>
          </div>
        )}
      </aside>
    </div>
  )
}

function Stat({ label, value, error }: { label: string; value: string; error?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={`text-xs font-mono font-semibold ${error ? "text-destructive" : "text-foreground"}`}>{value}</span>
    </div>
  )
}
