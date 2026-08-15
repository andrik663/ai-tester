"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"

// ── Models ────────────────────────────────────────────────────────────────────

const OPENROUTER_MODELS = [
  { id: "openrouter/nousresearch/hermes-3-llama-3.1-405b", label: "Hermes 3 405B" },
  { id: "openrouter/nousresearch/hermes-3-llama-3.1-70b",  label: "Hermes 3 70B" },
  { id: "openrouter/nousresearch/hermes-4-405b",           label: "Hermes 4 405B" },
  { id: "openrouter/nousresearch/hermes-4-70b",            label: "Hermes 4 70B" },
]

const OLLAMA_MODELS = [
  { id: "hermes3",       label: "Hermes 3 (8B)" },
  { id: "hermes3:70b",   label: "Hermes 3 (70B)" },
  { id: "llama3.1",      label: "Llama 3.1 (8B)" },
  { id: "llama3.1:70b",  label: "Llama 3.1 (70B)" },
  { id: "mistral",       label: "Mistral (7B)" },
  { id: "qwen2.5:14b",   label: "Qwen 2.5 (14B)" },
]

type Provider = "openrouter" | "ollama"

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { label: "Research",  text: "What are the latest AI reasoning models in 2026?" },
  { label: "Code",      text: "Write a Python function to fetch JSON from an API with retry logic" },
  { label: "Explain",   text: "Explain how transformer attention mechanisms work" },
  { label: "Compare",   text: "Compare Llama 3.1 vs Mistral vs Qwen 2.5 capabilities" },
]

// ── Icons ─────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.53 11.53l1.42 1.42M3.05 12.95l1.42-1.42M11.53 4.47l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M4.5 4.5L2 7l2.5 2.5M9.5 4.5L12 7l-2.5 2.5M7.5 3l-1 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 2h6l3 3v7h-9V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.5 2v3H11.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EyeIcon({ show }: { show: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      {show ? (
        <>
          <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
        </>
      ) : (
        <path d="M2 2l12 12M6.4 6.4A2 2 0 009.6 9.6M4 4.2C2.4 5.4 1 8 1 8s2.5 5 7 5c1.4 0 2.6-.4 3.7-1M9.2 3.2C8.8 3.1 8.4 3 8 3c-4.5 0-7 5-7 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  )
}

// ── Tool call card ────────────────────────────────────────────────────────────

function ToolCallCard({ toolName, state, input, output }: {
  toolName: string
  state: string
  input: unknown
  output: unknown
}) {
  const [open, setOpen] = useState(false)

  const meta: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    webSearch:  { label: "Web Search",  icon: <SearchIcon />, color: "text-sky-400 bg-sky-400/8 border-sky-400/20" },
    codeRunner: { label: "Code Runner", icon: <CodeIcon />,   color: "text-violet-400 bg-violet-400/8 border-violet-400/20" },
    readFile:   { label: "Read File",   icon: <FileIcon />,   color: "text-amber-400 bg-amber-400/8 border-amber-400/20" },
    writeFile:  { label: "Write File",  icon: <FileIcon />,   color: "text-success bg-success/8 border-success/20" },
  }

  const m = meta[toolName] ?? { label: toolName, icon: null, color: "text-muted-foreground bg-secondary/30 border-border" }
  const running = state === "input-streaming"
  const done    = state === "output-available"

  return (
    <div className={`rounded-xl border text-[11px] overflow-hidden ${m.color}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className="flex-shrink-0 opacity-80">{m.icon}</span>
        <span className="font-medium flex-1">{m.label}</span>
        {running && <SpinnerIcon />}
        {done    && <span className="opacity-50 text-[9px]">done</span>}
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="border-t border-current/10 px-3 py-2.5 space-y-2 text-[10px] font-mono">
          {input !== undefined && (
            <pre className="opacity-70 whitespace-pre-wrap break-all">{JSON.stringify(input, null, 2)}</pre>
          )}
          {done && output !== undefined && (
            <pre className="opacity-70 whitespace-pre-wrap break-all max-h-40 overflow-y-auto border-t border-current/10 pt-2">
              {typeof output === "string" ? output : JSON.stringify(output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function MessageText({ text }: { text: string }) {
  const lines = text.split("\n")
  const nodes: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) { code.push(lines[i]); i++ }
      nodes.push(
        <div key={i} className="my-1.5 rounded-lg overflow-hidden border border-border/50 bg-background/50">
          {lang && <div className="px-3 py-1 text-[9px] font-mono text-muted-foreground/60 bg-muted/30 border-b border-border/30">{lang}</div>}
          <pre className="p-3 text-[11px] font-mono overflow-x-auto leading-relaxed whitespace-pre">{code.join("\n")}</pre>
        </div>
      )
    } else if (line.startsWith("### ")) {
      nodes.push(<p key={i} className="font-semibold text-[13px] mt-2 mb-0.5">{fmt(line.slice(4))}</p>)
    } else if (line.startsWith("## ")) {
      nodes.push(<p key={i} className="font-semibold text-[14px] mt-2 mb-0.5">{fmt(line.slice(3))}</p>)
    } else if (line.startsWith("# ")) {
      nodes.push(<p key={i} className="font-bold text-[15px] mt-2 mb-0.5">{fmt(line.slice(2))}</p>)
    } else if (line.match(/^[-*] /)) {
      nodes.push(<li key={i} className="ml-4 list-disc text-[12px] leading-relaxed">{fmt(line.slice(2))}</li>)
    } else if (line.match(/^\d+\. /)) {
      nodes.push(<li key={i} className="ml-4 list-decimal text-[12px] leading-relaxed">{fmt(line.replace(/^\d+\. /, ""))}</li>)
    } else if (line.trim() === "") {
      nodes.push(<div key={i} className="h-1.5" />)
    } else {
      nodes.push(<p key={i} className="text-[12px] leading-relaxed">{fmt(line)}</p>)
    }
    i++
  }
  return <div className="flex flex-col gap-0.5">{nodes}</div>
}

function fmt(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
    if (p.startsWith("`") && p.endsWith("`"))   return <code key={i} className="px-1 rounded bg-muted/60 text-[10px] font-mono text-primary/90">{p.slice(1, -1)}</code>
    return p
  })
}

// ── Ollama client-side hook ───────────────────────────────────────────────────

interface SimpleMsg { id: string; role: "user" | "assistant"; content: string; streaming?: boolean }

const SBG_BRIEF = "You are SBG, an expert AI assistant for research and software engineering. Answer clearly using markdown."

function useOllamaChat(url: string, model: string) {
  const [messages, setMessages] = useState<SimpleMsg[]>([])
  const [status, setStatus]     = useState<"idle" | "streaming" | "error">("idle")
  const [error, setError]       = useState<Error | null>(null)
  const abort = useRef<AbortController | null>(null)

  const send = useCallback(async (text: string) => {
    if (!text.trim() || status === "streaming") return
    setError(null)
    const uid = Date.now().toString()
    const aid = (Date.now() + 1).toString()
    setMessages(p => [...p, { id: uid, role: "user", content: text }, { id: aid, role: "assistant", content: "", streaming: true }])
    setStatus("streaming")
    const ctrl = new AbortController()
    abort.current = ctrl
    const history = [
      { role: "system", content: SBG_BRIEF },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ]
    try {
      const base = url.replace(/\/$/, "")
      const res = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ model, messages: history, stream: true }),
      })
      if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`)
      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response body")
      const dec = new TextDecoder()
      let acc = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of dec.decode(value, { stream: true }).split("\n").filter(Boolean)) {
          try {
            const j = JSON.parse(line)
            acc += j?.message?.content ?? ""
            setMessages(p => p.map(m => m.id === aid ? { ...m, content: acc, streaming: !j.done } : m))
          } catch { /* skip */ }
        }
      }
      setMessages(p => p.map(m => m.id === aid ? { ...m, streaming: false } : m))
      setStatus("idle")
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") { setStatus("idle"); return }
      const msg = e instanceof Error
        ? (e.message.includes("Failed to fetch") || e.message.includes("NetworkError"))
          ? `Cannot connect to Ollama at ${url}.\n\nMake sure:\n1. Ollama is running (ollama serve)\n2. Model is pulled (ollama pull ${model})\n3. CORS enabled: OLLAMA_ORIGINS=*`
          : e.message
        : "Unknown error"
      setError(new Error(msg))
      setMessages(p => p.map(m => m.id === aid ? { ...m, streaming: false } : m))
      setStatus("error")
    }
  }, [messages, status, url, model])

  const clear = useCallback(() => {
    abort.current?.abort()
    setMessages([])
    setStatus("idle")
    setError(null)
  }, [])

  return { messages, send, status, error, clear }
}

// ── Main component ────────────────────────────────────────────────────────────

interface SBGAgentProps { openRouterApiKey?: string }

export default function SBGAgent({ openRouterApiKey = "" }: SBGAgentProps) {
  const [input,          setInput]         = useState("")
  const [provider,       setProvider]      = useState<Provider>("openrouter")
  const [model,          setModel]         = useState(OPENROUTER_MODELS[0].id)
  const [apiKey,         setApiKey]        = useState(openRouterApiKey)
  const [showKey,        setShowKey]       = useState(false)
  const [ollamaUrl,      setOllamaUrl]     = useState("http://localhost:11434")
  const [showSettings,   setShowSettings]  = useState(false)
  const [showModelDrop,  setShowModelDrop] = useState(false)
  const messagesEnd = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)

  const modelList = provider === "ollama" ? OLLAMA_MODELS : OPENROUTER_MODELS

  function switchProvider(next: Provider) {
    setProvider(next)
    setModel(next === "ollama" ? OLLAMA_MODELS[0].id : OPENROUTER_MODELS[0].id)
    setShowModelDrop(false)
  }

  // OpenRouter path — via AI SDK server route
  const orChat = useChat({
    transport: new DefaultChatTransport({
      api: "/api/sbg",
      prepareSendMessagesRequest: ({ id, messages: msgs }) => ({
        body: { id, messages: msgs, model, apiKey: apiKey.trim(), provider: "openrouter" },
      }),
    }),
  })

  // Ollama path — direct browser fetch
  const ollamaChat = useOllamaChat(ollamaUrl, model)

  const isOllama   = provider === "ollama"
  const isStreaming = isOllama
    ? ollamaChat.status === "streaming"
    : orChat.status === "streaming" || orChat.status === "submitted"
  const error = isOllama ? ollamaChat.error : orChat.error

  // Normalise Ollama messages to AI SDK shape for uniform rendering
  const ollamaMsgs = ollamaChat.messages.map(m => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: [{ type: "text" as const, text: m.content }],
  }))
  const messages = isOllama ? ollamaMsgs : orChat.messages

  function clearChat() {
    if (isOllama) ollamaChat.clear()
    else orChat.setMessages([])
  }

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const modelLabel = modelList.find(m => m.id === model)?.label ?? model

  function send() {
    const text = input.trim()
    if (!text || isStreaming) return
    if (isOllama) ollamaChat.send(text)
    else orChat.sendMessage({ text })
    setInput("")
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-primary font-mono tracking-tight">SBG</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">SBG Agent</p>
            <p className="text-[10px] text-muted-foreground/60 leading-tight">
              {isOllama ? `Ollama · ${modelLabel}` : `OpenRouter · ${modelLabel}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {hasMessages && (
            <button
              onClick={clearChat}
              title="Clear chat"
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
            >
              <TrashIcon />
            </button>
          )}
          <button
            onClick={() => setShowSettings(v => !v)}
            title="Settings"
            className={`p-2 rounded-lg transition-colors ${
              showSettings
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <SettingsIcon />
          </button>
        </div>
      </div>

      {/* ── Settings panel (collapsible) ── */}
      {showSettings && (
        <div className="flex-shrink-0 border-b border-border bg-card/60 px-4 py-3 flex flex-col gap-3">
          {/* Provider toggle */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Provider</p>
            <div className="flex rounded-lg border border-border overflow-hidden text-[11px] font-medium w-fit">
              {(["openrouter", "ollama"] as Provider[]).map(p => (
                <button
                  key={p}
                  onClick={() => switchProvider(p)}
                  className={`px-3 py-1.5 capitalize transition-colors ${
                    provider === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  } ${p === "ollama" ? "border-l border-border" : ""}`}
                >
                  {p === "openrouter" ? "OpenRouter" : "Ollama (Local)"}
                </button>
              ))}
            </div>
          </div>

          {/* Model selector */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Model</p>
            <div className="relative w-full max-w-xs">
              <button
                onClick={() => setShowModelDrop(v => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-background text-[11px] text-foreground hover:border-primary/40 transition-colors"
              >
                <span className="truncate">{modelLabel}</span>
                <ChevronIcon open={showModelDrop} />
              </button>
              {showModelDrop && (
                <div className="absolute left-0 top-full mt-1 z-30 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                  {modelList.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setModel(m.id); setShowModelDrop(false) }}
                      className={`w-full text-left px-3 py-2.5 text-[11px] transition-colors ${
                        model === m.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* API key or Ollama URL */}
          {isOllama ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ollama URL</p>
              <p className="text-[10px] text-muted-foreground/50">Browser connects directly — set <code className="font-mono">OLLAMA_ORIGINS=*</code> for CORS</p>
              <input
                type="text"
                value={ollamaUrl}
                onChange={e => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full max-w-xs rounded-lg border border-border bg-background text-[11px] font-mono px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/30"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">OpenRouter API Key</p>
              <div className="relative w-full max-w-xs">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full rounded-lg border border-border bg-background text-[11px] font-mono px-3 py-2 pr-9 text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/30"
                />
                <button
                  onClick={() => setShowKey(v => !v)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <EyeIcon show={showKey} />
                </button>
              </div>
              {apiKey && <p className="text-[10px] text-success/80">Key set</p>}
            </div>
          )}
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-4 py-4 flex flex-col gap-4">

          {/* Empty state */}
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center py-8 gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-primary">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-foreground">AI Gateway</p>
                <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                  A general-purpose AI assistant powered by {isOllama ? "your local Ollama models" : "Hermes via OpenRouter"}. Use it to research, write code, compare models, or ask anything — independent of your provider API keys.
                </p>
              </div>

              {/* What it's for */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {[
                  { label: "Different from Test tab", desc: "Uses a fixed OpenRouter/Ollama connection — not your own keys" },
                  { label: "General purpose", desc: "Research, code, writing, comparisons — anything you need" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-1 px-3 py-2.5 rounded-xl border border-border bg-card/40">
                    <p className="text-[11px] font-semibold text-foreground">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-snug">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                {SUGGESTED_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(p.text); inputRef.current?.focus() }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/30 bg-card hover:bg-primary/5 text-left transition-colors group"
                  >
                    <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider w-14 flex-shrink-0 group-hover:text-primary/70 transition-colors">
                      {p.label}
                    </span>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                      {p.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/40 px-1">
                {msg.role === "user" ? "You" : "Gateway"}
              </p>
              <div className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end max-w-[82%]" : "items-start w-full max-w-full"}`}>
                {msg.parts.map((part, pi) => {
                  if (part.type === "text") {
                    if (!part.text) return null
                    return (
                      <div
                        key={pi}
                        className={`rounded-2xl px-4 py-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-md"
                            : "bg-card border border-border rounded-tl-md w-full"
                        }`}
                      >
                        {msg.role === "user"
                          ? <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{part.text}</p>
                          : <MessageText text={part.text} />
                        }
                      </div>
                    )
                  }
                  if (
                    part.type === "tool-webSearch"  ||
                    part.type === "tool-codeRunner" ||
                    part.type === "tool-readFile"   ||
                    part.type === "tool-writeFile"
                  ) {
                    return (
                      <div key={pi} className="w-full max-w-xs">
                        <ToolCallCard
                          toolName={part.type.replace("tool-", "")}
                          state={part.state}
                          input={"input" in part ? part.input : undefined}
                          output={"output" in part ? part.output : undefined}
                        />
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {isStreaming && (() => {
            const last = messages[messages.length - 1]
            const firstPart = last?.parts?.[0]
            const hasText = firstPart?.type === "text" && firstPart.text
            return !hasText ? (
              <div className="flex items-center gap-2 text-muted-foreground/50 pl-1">
                <SpinnerIcon />
                <span className="text-xs">Thinking&hellip;</span>
              </div>
            ) : null
          })()}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden>
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
                <path d="M7 4v3.5M7 9v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <div className="flex flex-col gap-0.5">
                {(error.message ?? "An error occurred.").split("\n").map((line, i) => (
                  <span key={i} className={`${i === 0 ? "text-[12px] font-medium" : "text-[10px] opacity-70"}`}>{line}</span>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEnd} />
        </div>
      </div>

      {/* ── Input ── */}
      <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-border bg-background text-foreground text-[13px] px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/35 disabled:opacity-50 leading-relaxed min-h-[44px] max-h-36 overflow-y-auto"
            style={{ height: "auto" }}
            onInput={e => {
              const t = e.currentTarget
              t.style.height = "auto"
              t.style.height = Math.min(t.scrollHeight, 144) + "px"
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || isStreaming}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
            title="Send (Enter)"
          >
            {isStreaming ? <SpinnerIcon /> : <SendIcon />}
          </button>
        </div>
      </div>
    </div>
  )
}
