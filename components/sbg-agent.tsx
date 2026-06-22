"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"

// ── SBG Agent — Research & Coding Helper powered by Hermes 3 ─────────────────

// Available Hermes models via OpenRouter
const OPENROUTER_MODELS = [
  { id: "openrouter/nousresearch/hermes-3-llama-3.1-405b", label: "Hermes 3 405B (Best)", badge: "HOT" },
  { id: "openrouter/nousresearch/hermes-3-llama-3.1-70b",  label: "Hermes 3 70B (Fast)",  badge: "" },
  { id: "openrouter/nousresearch/hermes-4-405b",           label: "Hermes 4 405B",         badge: "NEW" },
  { id: "openrouter/nousresearch/hermes-4-70b",            label: "Hermes 4 70B",          badge: "NEW" },
]

// Popular Ollama models that support tool calling / function calling
const OLLAMA_MODELS = [
  { id: "hermes3",          label: "Hermes 3 (8B)",      badge: "REC" },
  { id: "hermes3:70b",      label: "Hermes 3 (70B)",     badge: "" },
  { id: "llama3.1",         label: "Llama 3.1 (8B)",     badge: "" },
  { id: "llama3.1:70b",     label: "Llama 3.1 (70B)",    badge: "" },
  { id: "mistral",          label: "Mistral (7B)",        badge: "" },
  { id: "qwen2.5:14b",      label: "Qwen 2.5 (14B)",     badge: "" },
]

type Provider = "openrouter" | "ollama"

const SUGGESTED_PROMPTS = [
  { icon: "search", text: "Research: What are the latest AI reasoning models in 2026?", label: "Research" },
  { icon: "code",   text: "Write a Python function to fetch and parse JSON from an API with retry logic", label: "Code" },
  { icon: "file",   text: "Save a research summary about DeepSeek V4 to a file called deepseek.md", label: "File" },
  { icon: "calc",   text: "Calculate the first 20 Fibonacci numbers and plot their growth rate", label: "Compute" },
]

// ── Icons ─────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M5.5 5L2 8l3.5 3M10.5 5L14 8l-3.5 3M8.5 3l-1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 2h7l3 3v9H3V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SpinnerIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Tool card component ───────────────────────────────────────────────────────

function ToolCallCard({
  toolName,
  state,
  input,
  output,
}: {
  toolName: string
  state: string
  input: unknown
  output: unknown
}) {
  const [expanded, setExpanded] = useState(false)

  const toolMeta: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    webSearch:  { label: "Web Search",    color: "text-sky-400 border-sky-400/20 bg-sky-400/5",      icon: <SearchIcon /> },
    codeRunner: { label: "Code Runner",   color: "text-violet-400 border-violet-400/20 bg-violet-400/5", icon: <CodeIcon /> },
    readFile:   { label: "Read File",     color: "text-amber-400 border-amber-400/20 bg-amber-400/5", icon: <FileIcon /> },
    writeFile:  { label: "Write File",    color: "text-emerald-400 border-emerald-400/20 bg-emerald-400/5", icon: <FileIcon /> },
  }

  const meta = toolMeta[toolName] ?? {
    label: toolName,
    color: "text-muted-foreground border-border bg-secondary/30",
    icon: null,
  }

  const isStreaming = state === "input-streaming"
  const isDone = state === "output-available"
  const isError = state === "output-error"

  return (
    <div className={`rounded-lg border text-[11px] font-mono overflow-hidden ${meta.color}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className="flex-shrink-0">{meta.icon}</span>
        <span className="font-semibold">{meta.label}</span>
        {isStreaming && <SpinnerIcon className="w-3 h-3 ml-auto" />}
        {isDone && (
          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-current/10 text-inherit opacity-70">
            done
          </span>
        )}
        {isError && (
          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-red-400/10 text-red-400">
            error
          </span>
        )}
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`ml-${isDone || isError ? "1" : "auto"} flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-current/10 px-3 py-2 flex flex-col gap-2">
          {input !== undefined && (
            <div>
              <p className="text-[9px] uppercase tracking-wider opacity-50 mb-1">Input</p>
              <pre className="text-[10px] whitespace-pre-wrap break-all opacity-80">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {isDone && output !== undefined && (
            <div>
              <p className="text-[9px] uppercase tracking-wider opacity-50 mb-1">Output</p>
              <pre className="text-[10px] whitespace-pre-wrap break-all opacity-80 max-h-48 overflow-y-auto">
                {typeof output === "string" ? output : JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Markdown-lite renderer for assistant messages ────────────────────────────

function MessageText({ text }: { text: string }) {
  const lines = text.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <div key={i} className="my-2 rounded-lg overflow-hidden border border-border bg-muted/30">
          {lang && (
            <div className="px-3 py-1 text-[9px] font-mono text-muted-foreground/60 bg-muted/40 border-b border-border">
              {lang}
            </div>
          )}
          <pre className="p-3 text-[11px] font-mono text-foreground overflow-x-auto leading-relaxed whitespace-pre">
            {codeLines.join("\n")}
          </pre>
        </div>
      )
      i++
      continue
    }

    // Heading
    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="font-semibold text-[13px] text-foreground mt-3 mb-1">{line.slice(4)}</h3>)
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="font-semibold text-[14px] text-foreground mt-3 mb-1">{line.slice(3)}</h2>)
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="font-bold text-[15px] text-foreground mt-3 mb-1">{line.slice(2)}</h1>)
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-4 text-[12px] leading-relaxed list-disc">
          {inlineFormat(line.slice(2))}
        </li>
      )
    } else if (/^\d+\. /.test(line)) {
      elements.push(
        <li key={i} className="ml-4 text-[12px] leading-relaxed list-decimal">
          {inlineFormat(line.replace(/^\d+\. /, ""))}
        </li>
      )
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(
        <p key={i} className="text-[12px] leading-relaxed">
          {inlineFormat(line)}
        </p>
      )
    }
    i++
  }

  return <div className="flex flex-col gap-0.5">{elements}</div>
}

function inlineFormat(text: string): React.ReactNode {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="px-1 py-0.5 rounded bg-muted/50 text-[11px] font-mono text-primary">{part.slice(1, -1)}</code>
    }
    return part
  })
}

// ── Main SBG Agent component ──────────────────────────────────────────────────

interface SBGAgentProps {
  openRouterApiKey?: string
}

export default function SBGAgent({ openRouterApiKey = "" }: SBGAgentProps) {
  const [input, setInput] = useState("")
  const [provider, setProvider] = useState<Provider>("openrouter")
  const [selectedModel, setSelectedModel] = useState(OPENROUTER_MODELS[0].id)
  const [apiKey, setApiKey] = useState(openRouterApiKey)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Switch default model when provider changes
  function switchProvider(next: Provider) {
    setProvider(next)
    setSelectedModel(next === "ollama" ? OLLAMA_MODELS[0].id : OPENROUTER_MODELS[0].id)
    setShowModelPicker(false)
  }

  const modelList = provider === "ollama" ? OLLAMA_MODELS : OPENROUTER_MODELS

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/sbg",
      prepareSendMessagesRequest: ({ id, messages: msgs }) => ({
        body: {
          id,
          messages: msgs,
          model: selectedModel,
          apiKey: apiKey.trim(),
          provider,
          ollamaUrl: ollamaUrl.trim(),
        },
      }),
    }),
  })

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const isStreaming = status === "streaming" || status === "submitted"
  const selectedModelMeta = modelList.find((m) => m.id === selectedModel) ?? modelList[0]

  function handleSend() {
    const text = input.trim()
    if (!text || isStreaming) return
    sendMessage({ text })
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function getPromptIcon(icon: string) {
    switch (icon) {
      case "search": return <SearchIcon />
      case "code":   return <CodeIcon />
      case "file":   return <FileIcon />
      default:       return <SearchIcon />
    }
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">

      {/* Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          {/* SBG logo mark */}
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-primary font-mono">SBG</span>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground leading-tight">SBG Agent</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Research &amp; Coding Helper</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Provider toggle */}
          <div className="flex items-center rounded border border-border overflow-hidden text-[10px] font-mono">
            <button
              onClick={() => switchProvider("openrouter")}
              className={`px-2 py-1 transition-colors ${
                provider === "openrouter"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              OpenRouter
            </button>
            <button
              onClick={() => switchProvider("ollama")}
              className={`px-2 py-1 transition-colors border-l border-border ${
                provider === "ollama"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              Ollama
            </button>
          </div>

          {/* Model picker */}
          <div className="relative">
            <button
              onClick={() => setShowModelPicker((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border hover:border-border/80 rounded px-2 py-1 transition-colors bg-card"
            >
              <span className="truncate max-w-[120px]">{selectedModelMeta.label}</span>
              {selectedModelMeta.badge && (
                <span className="text-[8px] font-bold text-primary bg-primary/10 px-1 rounded">
                  {selectedModelMeta.badge}
                </span>
              )}
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`flex-shrink-0 transition-transform ${showModelPicker ? "rotate-180" : ""}`} aria-hidden>
                <path d="M1 2.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showModelPicker && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[200px]">
                {modelList.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setShowModelPicker(false) }}
                    className={`w-full text-left px-3 py-2 text-[11px] flex items-center justify-between gap-2 transition-colors ${
                      selectedModel === m.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <span>{m.label}</span>
                    {m.badge && (
                      <span className="text-[8px] font-bold px-1 rounded bg-primary/10 text-primary flex-shrink-0">
                        {m.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear chat */}
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title="Clear conversation"
              className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded hover:bg-destructive/10"
            >
              <ClearIcon />
            </button>
          )}
        </div>
      </div>

      {/* Banner: API key warning for OpenRouter / Ollama info ──────────────── */}
      {provider === "openrouter" && !apiKey && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-400/5 border-b border-amber-400/15 text-[11px]">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-amber-400 flex-shrink-0" aria-hidden>
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="text-amber-400/80">
            Set your OpenRouter API key below to enable SBG with Hermes models.
          </span>
        </div>
      )}
      {provider === "ollama" && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-emerald-400/5 border-b border-emerald-400/15 text-[11px]">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-emerald-400 flex-shrink-0" aria-hidden>
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 7l1.5 1.5L9.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-emerald-400/80">
            Ollama mode — no API key needed. Make sure Ollama is running and the model is pulled locally.
          </span>
        </div>
      )}

      {/* Messages area ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 min-h-0">

        {/* Empty state with suggested prompts */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-6 py-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-[16px] font-bold text-primary font-mono">SBG</span>
              </div>
              <p className="text-[14px] font-semibold text-foreground">Ready to help</p>
              <p className="text-[12px] text-muted-foreground max-w-xs">
                Ask me to research any topic, write and run code, or save notes to files.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(prompt.text)
                    inputRef.current?.focus()
                  }}
                  className="flex items-start gap-2.5 p-3 rounded-xl border border-border hover:border-primary/30 bg-card hover:bg-primary/5 text-left transition-colors group"
                >
                  <span className="mt-0.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0">
                    {getPromptIcon(prompt.icon)}
                  </span>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">
                      {prompt.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                      {prompt.text}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation messages */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col gap-1.5 ${message.role === "user" ? "items-end" : "items-start"} max-w-full`}
          >
            {/* Role label */}
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 px-1">
              {message.role === "user" ? "You" : "SBG"}
            </p>

            {/* Parts */}
            <div className={`flex flex-col gap-2 ${message.role === "user" ? "items-end" : "items-start"} max-w-[85%]`}>
              {message.parts.map((part, pi) => {
                // Text part
                if (part.type === "text") {
                  return (
                    <div
                      key={pi}
                      className={`rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-card border border-border rounded-tl-sm"
                      }`}
                    >
                      {message.role === "user" ? (
                        <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{part.text}</p>
                      ) : (
                        <MessageText text={part.text} />
                      )}
                    </div>
                  )
                }

                // Tool call parts — generic handler for all 4 tools
                if (
                  part.type === "tool-webSearch" ||
                  part.type === "tool-codeRunner" ||
                  part.type === "tool-readFile" ||
                  part.type === "tool-writeFile"
                ) {
                  const toolName = part.type.replace("tool-", "")
                  return (
                    <div key={pi} className="w-full max-w-sm">
                      <ToolCallCard
                        toolName={toolName}
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

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-2 text-muted-foreground/60 pl-1">
            <SpinnerIcon className="w-3.5 h-3.5" />
            <span className="text-[11px]">SBG is thinking&hellip;</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-[11px] text-destructive">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7 4v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span>{error.message ?? "An error occurred. Check your API key and try again."}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3 flex flex-col gap-2">

        {/* Provider-specific config row */}
        {provider === "openrouter" ? (
          /* OpenRouter API key */
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 flex-shrink-0 w-16">
              OR Key
            </label>
            <div className="flex-1 relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full rounded border border-border bg-background text-foreground text-[10px] font-mono px-2 py-1 pr-7 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/30"
              />
              <button
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                tabIndex={-1}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
                  {showApiKey ? (
                    <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5zm7 2a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.4" />
                  ) : (
                    <path d="M2 2l12 12M6.7 6.7A2 2 0 0110.3 9.3M4.2 4.2C2.5 5.4 1 8 1 8s2.5 5 7 5c1.4 0 2.7-.4 3.8-1M9 3.2C8.4 3.1 8.2 3 8 3 3.5 3 1 8 1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  )}
                </svg>
              </button>
            </div>
            {apiKey && (
              <span className="text-[9px] text-emerald-400/70 flex-shrink-0">connected</span>
            )}
          </div>
        ) : (
          /* Ollama base URL */
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 flex-shrink-0 w-16">
              Ollama
            </label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="flex-1 rounded border border-border bg-background text-foreground text-[10px] font-mono px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/30"
            />
            <span className="text-[9px] text-emerald-400/70 flex-shrink-0">local</span>
          </div>
        )}

        {/* Message input */}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask SBG to research, code, or save files... (Enter to send, Shift+Enter for newline)"
            rows={2}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-border bg-background text-foreground text-[12px] px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 disabled:opacity-50 leading-relaxed min-h-[52px] max-h-32 overflow-y-auto"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Send (Enter)"
          >
            {isStreaming ? <SpinnerIcon className="w-3.5 h-3.5" /> : <SendIcon />}
          </button>
        </div>

        <p className="text-[9px] text-muted-foreground/30 text-center">
          {provider === "ollama"
            ? `Ollama · ${ollamaUrl} · Tools: Web Search · Code Runner · File R/W`
            : "Powered by Hermes 3/4 via OpenRouter · Tools: Web Search · Code Runner · File R/W"
          }
        </p>
      </div>
    </div>
  )
}
