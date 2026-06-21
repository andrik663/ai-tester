"use client"

import { useEffect, useRef, useState } from "react"

interface Message {
  role: "user" | "assistant"
  content: string
}

export const GEMINI_CHAT_MODELS = [
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

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 11-8 8z" />
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

interface ChatProps {
  apiKey?: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export default function Chat({ apiKey = "", model = GEMINI_CHAT_MODELS[0], temperature = 1.0, maxTokens = 2048, systemPrompt = "" }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenInfo, setTokenInfo] = useState<{ input: number; output: number; durationMs: number } | null>(null)

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

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature,
          maxOutputTokens: maxTokens,
          systemPrompt: systemPrompt || undefined,
          messages: newMessages,
          apiKey: apiKey.trim() || undefined,
        }),
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

      setTokenInfo({ input: inputTokens, output: outputTokens, durationMs: Date.now() - startTime })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg)
      setMessages((prev) => prev.slice(0, -1))
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

  function clearChat() {
    setMessages([])
    setTokenInfo(null)
    setError(null)
  }

  const hasKey = !!apiKey.trim()

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${hasKey ? "bg-green-400" : "bg-muted-foreground"}`} />
          <span className="text-[11px] font-mono text-muted-foreground">{model}</span>
          {hasKey && tokenInfo && (
            <span className="text-[10px] font-mono text-muted-foreground/60 hidden sm:inline">
              {tokenInfo.input}in / {tokenInfo.output}out · {tokenInfo.durationMs}ms
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded hover:bg-secondary"
          >
            <TrashIcon />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-5 text-center">
              {!hasKey && (
                <div className="text-[11px] text-yellow-400/80 border border-yellow-400/20 bg-yellow-400/5 px-4 py-2.5 rounded-lg">
                  Enter your Gemini API key in the left panel to start chatting.
                </div>
              )}
              {hasKey && (
                <>
                  <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center">
                    <span className="text-sm font-bold text-primary font-mono">G</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Gemini Chat</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Model: {model} · Temp: {temperature} · Max tokens: {maxTokens.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-md bg-primary flex-shrink-0 flex items-center justify-center mt-0.5">
                  <span className="text-primary-foreground text-[10px] font-bold font-mono">G</span>
                </div>
              )}
              <div className={`max-w-[78%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-secondary text-foreground rounded-br-sm"
                  : "bg-card text-foreground border border-border rounded-bl-sm"
              }`}>
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
      <div className="px-4 py-3 border-t border-border bg-card flex-shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5 focus-within:border-ring transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasKey ? "Send a message... (Enter to send, Shift+Enter for newline)" : "Enter API key in left panel first..."}
              rows={1}
              disabled={isLoading || !hasKey}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim() || !hasKey}
              aria-label="Send message"
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-85 transition-opacity"
            >
              {isLoading ? <SpinnerIcon /> : <SendIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
