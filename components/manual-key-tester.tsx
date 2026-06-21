"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import useSWR from "swr"
import type { ManualTestResult } from "@/app/api/manual-test/route"
import type { LogEntry } from "@/app/api/test-key/route"
import ProviderBatchTest from "@/components/provider-batch-test"

// ── Provider presets ──────────────────────────────────────────────────────────

interface ProviderPreset {
  id: string
  name: string
  endpoint: string
  method: "POST" | "GET"
  headers: Record<string, string>
  bodyTemplate: string
  docsUrl: string
  color: string
}

const PRESETS: ProviderPreset[] = [
  // ── Dahono Labs Gateway ───────────────────────────────────────────────────
  {
    id: "dahono",
    name: "Dahono Labs Gateway",
    endpoint: "https://gateway.dahono.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "dahono/deepseek-v4-flash",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://labs.dahono.com/models",
    color: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  },
  // ── Tier 1: Major providers ───────────────────────────────────────────────
  {
    id: "anthropic",
    name: "Claude (Anthropic)",
    endpoint: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "x-api-key": "{{API_KEY}}",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.anthropic.com/en/api/messages",
    color: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  },
  {
    id: "openai",
    name: "GPT (OpenAI)",
    endpoint: "https://api.openai.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://platform.openai.com/docs/api-reference/chat",
    color: "text-green-400 bg-green-400/10 border-green-400/30",
  },
  {
    id: "google",
    name: "Gemini (Google)",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={{API_KEY}}",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    bodyTemplate: JSON.stringify({
      contents: [{ parts: [{ text: "{{PROMPT}}" }] }],
      generationConfig: { maxOutputTokens: 1024 },
    }, null, 2),
    docsUrl: "https://ai.google.dev/gemini-api/docs/text-generation",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  },
  {
    id: "xai",
    name: "Grok (xAI)",
    endpoint: "https://api.x.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "grok-3-mini",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.x.ai/docs/overview",
    color: "text-zinc-300 bg-zinc-400/10 border-zinc-400/30",
  },
  // ── Tier 2: Chinese / Asian providers ────────────────────────────────────
  {
    id: "deepseek",
    name: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 1024,
      stream: false,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://platform.deepseek.com/api-docs/",
    color: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  },
  {
    id: "qwen",
    name: "Qwen (Alibaba)",
    endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "qwen-plus",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://help.aliyun.com/zh/model-studio/developer-reference/use-qwen-by-calling-api",
    color: "text-violet-400 bg-violet-400/10 border-violet-400/30",
  },
  {
    id: "zhipu",
    name: "GLM (Zhipu AI)",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "glm-4-flash",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://open.bigmodel.cn/dev/api",
    color: "text-indigo-400 bg-indigo-400/10 border-indigo-400/30",
  },
  {
    id: "minimax",
    name: "MiniMax (Hailuo)",
    endpoint: "https://api.minimaxi.chat/v1/text/chatcompletion_v2",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "MiniMax-Text-01",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://platform.minimaxi.com/document/ChatCompletion%20v2",
    color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  },
  // ── Tier 3: Open-source / infra providers ─────────────────────────────────
  {
    id: "groq",
    name: "Groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://console.groq.com/docs/openai",
    color: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  },
  {
    id: "together",
    name: "Together AI",
    endpoint: "https://api.together.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.together.ai/reference/chat-completions-1",
    color: "text-pink-400 bg-pink-400/10 border-pink-400/30",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "mistral-small-latest",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.mistral.ai/api/#tag/chat",
    color: "text-red-400 bg-red-400/10 border-red-400/30",
  },
  {
    id: "cohere",
    name: "Cohere",
    endpoint: "https://api.cohere.ai/v2/chat",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "command-r-plus",
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.cohere.com/reference/chat",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    endpoint: "https://api.perplexity.ai/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "sonar",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.perplexity.ai/api-reference/chat-completions",
    color: "text-teal-400 bg-teal-400/10 border-teal-400/30",
  },
  {
    id: "huggingface",
    name: "HuggingFace",
    endpoint: "https://api-inference.huggingface.co/models/meta-llama/Llama-3.3-70B-Instruct/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "meta-llama/Llama-3.3-70B-Instruct",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://huggingface.co/docs/api-inference/en/tasks/chat-completion",
    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  },
  {
    id: "replicate",
    name: "Replicate",
    endpoint: "https://api.replicate.com/v1/models/meta/meta-llama-3-8b-instruct/predictions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
      "Prefer": "wait",
    },
    bodyTemplate: JSON.stringify({
      input: {
        prompt: "{{PROMPT}}",
        max_new_tokens: 512,
      },
    }, null, 2),
    docsUrl: "https://replicate.com/docs/reference/http",
    color: "text-rose-400 bg-rose-400/10 border-rose-400/30",
  },
  // ── Custom ────────────────────────────────────────────────────────────────
  {
    id: "custom",
    name: "Custom / cURL",
    endpoint: "",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    bodyTemplate: JSON.stringify({
      model: "your-model",
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "",
    color: "text-muted-foreground bg-muted/10 border-border",
  },
]

// ── Icons ─────────────────────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 11-8 8z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
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

// ── Log level styles ──────────────────────────────────────────────────────────

const LOG_STYLES: Record<LogEntry["level"], string> = {
  info: "text-muted-foreground",
  req:  "text-blue-400",
  res:  "text-yellow-400",
  ok:   "text-green-400",
  err:  "text-red-400",
  curl: "text-cyan-400",
}

const LOG_PREFIX: Record<LogEntry["level"], string> = {
  info: "  ",
  req:  "→ ",
  res:  "← ",
  ok:   "✓ ",
  err:  "✗ ",
  curl: "$ ",
}

// ── Header row editor ────────────────────────────────────────────────��────────

interface HeaderRow { key: string; value: string; id: number }

function HeaderEditor({
  rows,
  onChange,
}: {
  rows: HeaderRow[]
  onChange: (rows: HeaderRow[]) => void
}) {
  function update(id: number, field: "key" | "value", val: string) {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  }
  function remove(id: number) {
    onChange(rows.filter((r) => r.id !== id))
  }
  function add() {
    onChange([...rows, { key: "", value: "", id: Date.now() }])
  }

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => (
        <div key={row.id} className="flex gap-1 items-center">
          <input
            value={row.key}
            onChange={(e) => update(row.id, "key", e.target.value)}
            placeholder="Header-Name"
            className="flex-1 min-w-0 text-[11px] font-mono bg-background border border-border rounded px-2 py-1 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-muted-foreground/40 text-[10px] flex-shrink-0">:</span>
          <input
            value={row.value}
            onChange={(e) => update(row.id, "value", e.target.value)}
            placeholder="value or {{API_KEY}}"
            className="flex-1 min-w-0 text-[11px] font-mono bg-background border border-border rounded px-2 py-1 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => remove(row.id)}
            className="flex-shrink-0 text-muted-foreground/40 hover:text-red-400 transition-colors p-1 rounded"
          >
            <TrashIcon />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition-colors self-start"
      >
        <PlusIcon /> Add header
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  ts: string
}

export default function ManualKeyTester() {
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset>(PRESETS[0])
  const [apiKey, setApiKey] = useState("")
  const [debouncedApiKey, setDebouncedApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [endpoint, setEndpoint] = useState(PRESETS[0].endpoint)
  const [method, setMethod] = useState<"GET" | "POST" | "PUT" | "DELETE">(PRESETS[0].method)
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>(
    Object.entries(PRESETS[0].headers).map(([key, value], i) => ({ key, value, id: i }))
  )
  const [bodyTemplate, setBodyTemplate] = useState(PRESETS[0].bodyTemplate)
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ManualTestResult | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [showLog, setShowLog] = useState(false)
  const [showRawResponse, setShowRawResponse] = useState(false)
  const [showBodyEditor, setShowBodyEditor] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState(false)
  const [copiedCurlFull, setCopiedCurlFull] = useState(false)
  const [selectedDahonoModel, setSelectedDahonoModel] = useState("dahono/deepseek-v4-flash")
  const chatEndRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce API key changes by 400ms
  const handleApiKeyChange = useCallback((val: string) => {
    setApiKey(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedApiKey(val), 400)
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatHistory, loading])

  // SWR key — only fetches when Dahono is selected AND key is long enough
  const dahonoSWRKey =
    selectedPreset.id === "dahono" && debouncedApiKey.trim().length >= 8
      ? ["/api/dahono-models", debouncedApiKey.trim()]
      : null

  const { data: dahonoData, isLoading: dahonoModelsFetching } = useSWR(
    dahonoSWRKey,
    ([url, key]: [string, string]) =>
      fetch(url, { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  )

  const dahonoModels: { id: string; tier: string; free: boolean }[] = dahonoData?.models ?? []

  // Auto-select first free model when models load
  useEffect(() => {
    if (dahonoModels.length > 0) {
      const firstFree = dahonoModels.find((m) => m.free)
      if (firstFree) {
        setSelectedDahonoModel(firstFree.id)
        updateDahonoBodyModel(firstFree.id)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dahonoData])

  function updateDahonoBodyModel(modelId: string) {
    setBodyTemplate(JSON.stringify({
      model: modelId,
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2))
  }

  function applyPreset(preset: ProviderPreset) {
    setSelectedPreset(preset)
    setEndpoint(preset.endpoint)
    setMethod(preset.method)
    setHeaderRows(
      Object.entries(preset.headers).map(([key, value], i) => ({ key, value, id: i }))
    )
    setBodyTemplate(preset.bodyTemplate)
  setResult(null)
  setShowLog(false)
  }

  async function runTest() {
    if (!apiKey.trim() || !prompt.trim() || loading) return

    const userMsg: ChatMessage = {
      role: "user",
      content: prompt,
      ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    }
    setChatHistory((prev) => [...prev, userMsg])
    const currentPrompt = prompt
    setPrompt("")
    setLoading(true)
    setResult(null)

    const headers: Record<string, string> = {}
    for (const row of headerRows) {
      if (row.key.trim()) headers[row.key.trim()] = row.value
    }

    try {
      const res = await fetch("/api/manual-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedPreset.id,
          apiKey: apiKey.trim(),
          endpoint,
          method,
          headers,
          body: bodyTemplate || undefined,
          prompt: currentPrompt,
        }),
      })
      const data: ManualTestResult = await res.json()
      setResult(data)

      const reply = data.chatReply ?? (data.ok ? data.responseBody : null)
      if (reply) {
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: reply,
          ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        }
        setChatHistory((prev) => [...prev, assistantMsg])
      } else {
        const errMsg: ChatMessage = {
          role: "assistant",
          content: `Error: HTTP ${data.status} ${data.statusText}`,
          ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        }
        setChatHistory((prev) => [...prev, errMsg])
      }
    } catch (err) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: err instanceof Error ? err.message : "Request failed",
        ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      }
      setChatHistory((prev) => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      runTest()
    }
  }

  function copyCurl() {
    if (!result?.curlCommand) return
    navigator.clipboard.writeText(result.curlCommand).then(() => {
      setCopiedCurl(true)
      setTimeout(() => setCopiedCurl(false), 1500)
    })
  }

  function copyCurlFull() {
    if (!result?.curlFull) return
    navigator.clipboard.writeText(result.curlFull).then(() => {
      setCopiedCurlFull(true)
      setTimeout(() => setCopiedCurlFull(false), 1500)
    })
  }

  return (
    <div className="flex h-full bg-background text-foreground font-sans overflow-hidden">

      {/* ── LEFT: Config panel ─────────────────────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 border-r border-border bg-card flex flex-col overflow-y-auto">

        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-foreground">Manual Key Tester</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Input an API key and test chat directly</p>
        </div>

        <div className="flex-1 px-4 py-4 flex flex-col gap-4">

          {/* Provider selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Provider <span className="normal-case font-normal text-muted-foreground/50">({PRESETS.length - 1} supported)</span>
            </label>
            <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto pr-0.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className={`text-[10px] font-medium px-2.5 py-1.5 rounded border transition-colors text-left w-full ${
                    selectedPreset.id === p.id
                      ? p.color
                      : "text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                API Key
              </label>
              {apiKey && (
                <button
                  onClick={() => { handleApiKeyChange(""); setShowKey(false) }}
                  className="text-[9px] text-muted-foreground/60 hover:text-destructive transition-colors flex items-center gap-0.5"
                  title="Clear API key"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Clear
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="sk-ant-... / sk-... / AIza..."
                className="w-full rounded-md border border-border bg-background text-foreground text-[11px] font-mono px-2.5 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                title={showKey ? "Hide key" : "Show key"}
              >
                <EyeIcon show={showKey} />
              </button>
            </div>
            {apiKey && (
              <p className="text-[9px] text-muted-foreground/60 font-mono truncate">
                {apiKey.slice(0, 12)}{"•".repeat(Math.max(0, apiKey.length - 12))}
              </p>
            )}
          </div>

          {/* Endpoint */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Endpoint URL
            </label>
            <div className="flex gap-1">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as "GET" | "POST" | "PUT" | "DELETE")}
                className="text-[10px] font-mono bg-background border border-border rounded px-1.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring flex-shrink-0"
              >
                {["POST", "GET", "PUT", "DELETE"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input
                type="url"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://api.example.com/v1/..."
                className="flex-1 min-w-0 rounded-md border border-border bg-background text-foreground text-[10px] font-mono px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
            </div>
            {selectedPreset.docsUrl && (
              <a
                href={selectedPreset.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] text-primary/70 hover:text-primary transition-colors"
              >
                View API docs →
              </a>
            )}
          </div>

          {/* Dahono model picker — shown when provider is Dahono */}
          {selectedPreset.id === "dahono" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Model
                {dahonoModelsFetching && <span className="ml-1 font-normal normal-case text-muted-foreground/50">fetching...</span>}
                {!dahonoModelsFetching && dahonoModels.length > 0 && (
                  <span className="ml-1 font-normal normal-case text-muted-foreground/50">
                    {dahonoModels.length} models from gateway
                  </span>
                )}
              </label>
              {dahonoModels.length > 0 ? (
                <select
                  value={selectedDahonoModel}
                  onChange={(e) => {
                    setSelectedDahonoModel(e.target.value)
                    updateDahonoBodyModel(e.target.value)
                  }}
                  className="text-[10px] font-mono bg-background border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full"
                >
                  {["free", "starter", "pro", "business"].map((tier) => {
                    const tier_models = dahonoModels.filter((m) => m.tier === tier)
                    if (tier_models.length === 0) return null
                    return (
                      <optgroup key={tier} label={`${tier.charAt(0).toUpperCase() + tier.slice(1)} (${tier_models.length})`}>
                        {tier_models.map((m) => (
                          <option key={m.id} value={m.id}>{m.id}</option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              ) : (
                <p className="text-[9px] text-muted-foreground/50">
                  Enter your Dahono API key above to auto-load all {dahonoModelsFetching ? "..." : "models"} from the gateway.
                </p>
              )}
            </div>
          )}

          {/* Batch Model Test — Run All Models (all providers) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Batch Model Test
            </label>
            <ProviderBatchTest providerId={selectedPreset.id} apiKey={apiKey} />
          </div>

          {/* Headers */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Headers
            </label>
            <HeaderEditor rows={headerRows} onChange={setHeaderRows} />
            <p className="text-[9px] text-muted-foreground/50">
              Use <code className="text-primary/70">{"{{API_KEY}}"}</code> as placeholder — replaced with your key on send.
            </p>
          </div>

          {/* Request body */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => setShowBodyEditor((v) => !v)}
              className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Request Body Template</span>
              <ChevronIcon open={showBodyEditor} />
            </button>
            {showBodyEditor && (
              <>
                <textarea
                  value={bodyTemplate}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  placeholder={`{\n  "model": "...",\n  "messages": [{"role": "user", "content": "{{PROMPT}}"}]\n}`}
                  className="w-full rounded-md border border-border bg-background text-foreground text-[10px] font-mono px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 resize-y"
                />
                <p className="text-[9px] text-muted-foreground/50">
                  Use <code className="text-primary/70">{"{{PROMPT}}"}</code> where you want the message injected.
                </p>
              </>
            )}
          </div>

          {/* Reset */}
          <button
            onClick={() => { setChatHistory([]); setResult(null); setShowLog(false) }}
            className="text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary px-2 py-1.5 rounded transition-colors border border-transparent hover:border-border"
          >
            Clear Chat
          </button>

        </div>
      </aside>

      {/* ── RIGHT: Chat + log panel ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Status bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card flex-shrink-0">
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border ${selectedPreset.color}`}>
            {selectedPreset.name}
          </span>
          {endpoint && (
            <span className="text-[10px] font-mono text-muted-foreground truncate flex-1 min-w-0">
              {method} {endpoint}
            </span>
          )}
          {result && (
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              {result.tokenUsage?.totalTokens && (
                <span className="text-[10px] font-mono text-muted-foreground hidden sm:block">
                  {result.tokenUsage.totalTokens} tokens
                </span>
              )}
              <span
                className={`text-[10px] font-mono ${result.ok ? "text-green-400" : "text-red-400"}`}
              >
                HTTP {result.status} · {result.durationMs}ms
              </span>
            </div>
          )}
        </div>

        {/* Chat messages */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {chatHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${selectedPreset.color}`}>
                <span className="text-lg font-bold">{selectedPreset.name[0]}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{selectedPreset.name}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Enter your API key and send a message to test the endpoint.
                </p>
                {!apiKey && (
                  <p className="text-[10px] text-yellow-400/80 mt-2 border border-yellow-400/20 bg-yellow-400/5 px-3 py-1.5 rounded-md">
                    API key required — enter it in the left panel
                  </p>
                )}
              </div>
            </div>
          )}

          {chatHistory.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground"
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{msg.content}</pre>
              </div>
              <span className="text-[9px] text-muted-foreground/50 px-1">{msg.role === "user" ? "You" : selectedPreset.name} · {msg.ts}</span>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2">
              <div className="bg-card border border-border rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                <SpinnerIcon />
                <span className="text-[11px] text-muted-foreground">Waiting for response...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Log / Raw toggle row */}
        {result && (
          <div className="flex items-center gap-2 px-4 py-1.5 border-t border-border bg-card/50 flex-shrink-0">
            <button
              onClick={() => { setShowLog((v) => !v); if (showRawResponse) setShowRawResponse(false) }}
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${
                showLog ? "text-cyan-400 border-cyan-400/30 bg-cyan-400/10" : "text-muted-foreground border-transparent hover:bg-secondary"
              }`}
            >
              <span className="font-mono">$</span> Test Log ({result.logs.length})
            </button>
            <button
              onClick={() => { setShowRawResponse((v) => !v); if (showLog) setShowLog(false) }}
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${
                showRawResponse ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" : "text-muted-foreground border-transparent hover:bg-secondary"
              }`}
            >
              {"{ }"} Raw Response
            </button>
            {result.curlCommand && (
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={copyCurl}
                  title="Copy cURL with masked key"
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border text-muted-foreground border-transparent hover:bg-secondary transition-colors"
                >
                  <CopyIcon />
                  {copiedCurl ? "Copied!" : "cURL (masked)"}
                </button>
                {result.curlFull && (
                  <button
                    onClick={copyCurlFull}
                    title="Copy cURL with real key — safe since you own this key"
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                  >
                    <CopyIcon />
                    {copiedCurlFull ? "Copied!" : "cURL (full)"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Terminal log panel */}
        {showLog && result && (
          <div className="border-t border-border bg-[#0a0a0a] px-4 pt-2.5 pb-3 font-mono flex-shrink-0 max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Request Log — {result.durationMs}ms
              </span>
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500/60" />
                <span className="w-2 h-2 rounded-full bg-yellow-500/60" />
                <span className="w-2 h-2 rounded-full bg-green-500/60" />
              </div>
            </div>
            {result.logs.map((entry, i) => (
              <div key={i} className="flex gap-2 items-start mb-0.5">
                <span className="text-[9px] text-muted-foreground/40 w-8 flex-shrink-0 pt-px tabular-nums">
                  {entry.ts}ms
                </span>
                <span className={`text-[10px] leading-relaxed ${LOG_STYLES[entry.level]} whitespace-pre-wrap break-all`}>
                  <span className="opacity-60">{LOG_PREFIX[entry.level]}</span>
                  {entry.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Raw response */}
        {showRawResponse && result && (
          <div className="border-t border-border bg-[#0a0a0a] px-4 pt-2.5 pb-3 font-mono flex-shrink-0 max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Raw JSON Response
              </span>
              <span className={`text-[9px] font-mono ${result.ok ? "text-green-400" : "text-red-400"}`}>
                HTTP {result.status}
              </span>
            </div>
            <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
              {result.responseBody}
            </pre>
          </div>
        )}

        {/* Token usage + response headers mini-panel */}
        {result?.ok && (result.tokenUsage || (result.responseHeaders && Object.keys(result.responseHeaders).length > 0)) && (
          <div className="border-t border-border bg-card/30 px-4 py-2 flex-shrink-0 flex items-center gap-4 flex-wrap">
            {result.tokenUsage && (
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">Tokens</span>
                {result.tokenUsage.promptTokens !== undefined && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    in: <span className="text-foreground">{result.tokenUsage.promptTokens}</span>
                  </span>
                )}
                {result.tokenUsage.completionTokens !== undefined && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    out: <span className="text-foreground">{result.tokenUsage.completionTokens}</span>
                  </span>
                )}
                {result.tokenUsage.totalTokens !== undefined && (
                  <span className="text-[10px] font-mono text-primary font-semibold">
                    total: {result.tokenUsage.totalTokens}
                  </span>
                )}
              </div>
            )}
            {result.responseHeaders?.["x-ratelimit-remaining-requests"] && (
              <span className="text-[10px] font-mono text-muted-foreground">
                rl-remaining: <span className="text-foreground">{result.responseHeaders["x-ratelimit-remaining-requests"]}</span>
              </span>
            )}
            {result.responseHeaders?.["x-request-id"] && (
              <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">
                req-id: <span className="text-foreground">{result.responseHeaders["x-request-id"]}</span>
              </span>
            )}
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-border px-4 py-3 flex-shrink-0 bg-card">
          <div className="flex gap-2 items-end">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={apiKey ? "Type a message and press Enter..." : "Enter API key first..."}
              disabled={!apiKey.trim() || loading}
              rows={2}
              className="flex-1 min-w-0 rounded-md border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-none disabled:opacity-40"
            />
            <button
              onClick={runTest}
              disabled={!apiKey.trim() || !prompt.trim() || loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity flex-shrink-0"
            >
              {loading ? <SpinnerIcon /> : <SendIcon />}
              {loading ? "Sending" : "Send"}
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground/40 mt-1.5">
            Enter sends · Shift+Enter for newline · <code>{"{{PROMPT}}"}</code> in body template is replaced with your message
          </p>
        </div>

      </div>
    </div>
  )
}
