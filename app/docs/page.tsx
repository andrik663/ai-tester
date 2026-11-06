"use client"

import { useState } from "react"
import { CodeBlock } from "@/components/docs/code-block"
import { EndpointCard } from "@/components/docs/endpoint-card"
import { ParamTable } from "@/components/docs/param-table"

const BASE_URL = "https://gateway.msaku.id"

// ── Sidebar sections ──────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "overview",        label: "Overview" },
  { id: "authentication",  label: "Authentication" },
  { id: "models",          label: "List Models" },
  { id: "chat",            label: "Chat Completions" },
  { id: "streaming",       label: "Streaming" },
  { id: "rate-limits",     label: "Rate Limits" },
  { id: "chat-flow",       label: "Chat UI Flow" },
  { id: "push",            label: "Sync Keys (Push)" },
  { id: "errors",          label: "Error Codes" },
  { id: "cli",             label: "NaraCLI → MsakuCLI" },
  { id: "sdks",            label: "SDK Examples" },
] as const

// ── Request/response examples ─────────────────────────────────────────────────
const CURL_MODELS = `curl ${BASE_URL}/api/v1/models \\
  -H "Authorization: Bearer YOUR_TOKEN"`

const CURL_CHAT = `curl ${BASE_URL}/api/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "MODEL_ID",            // pilih dari GET /api/v1/models
    "messages": [
      { "role": "user", "content": "Hello!" }
    ]
  }'`

const CURL_CHAT_STREAM = `curl ${BASE_URL}/api/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "MODEL_ID",            // pilih dari GET /api/v1/models
    "messages": [{ "role": "user", "content": "Explain quantum computing" }],
    "stream": true,
    "max_tokens": 512
  }'`

// ── Chat UI flow examples ─────────────────────────────────────────────────────
const CURL_CHAT_UI = `curl ${BASE_URL}/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gemini-2.5-flash",
    "temperature": 1.0,
    "maxOutputTokens": 2048,
    "systemPrompt": "You are a helpful assistant.",
    "apiKey": "YOUR_GEMINI_API_KEY",
    "messages": [
      { "role": "user", "content": "Hello!" }
    ]
  }'`

const CHAT_REQUEST_BODY = `{
  "model":           "gemini-2.5-flash",   // required — model ID from GEMINI_CHAT_MODELS
  "messages":        [...],                 // required — full conversation history
  "temperature":     1.0,                  // optional — default 1.0
  "maxOutputTokens": 2048,                 // optional — default 2048
  "systemPrompt":    "...",               // optional — injected as systemInstruction
  "apiKey":          "AIza..."             // optional — falls back to GEMINI_API_KEY env var
}`

const CHAT_SSE_STREAM = `// Each chunk is a JSON object sent as SSE:
data: {"text":"Hello"}
data: {"text":"! How can I"}
data: {"text":" help you today?"}
data: {"inputTokens":12,"outputTokens":8}  // final metadata chunk
data: [DONE]`

const CHAT_CLIENT_CODE = `// Frontend fetch call (from chat.tsx)
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    temperature,
    maxOutputTokens: maxTokens,
    systemPrompt: systemPrompt || undefined,
    messages: newMessages,        // full history including new user message
    apiKey: apiKey.trim() || undefined,
  }),
})

// Read the SSE stream chunk-by-chunk
const reader = res.body?.getReader()
let assistantText = ""
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // parse SSE lines → JSON → append chunk.text to assistantText
}`

const GEMINI_MODELS_LIST = `[
  "gemini-2.5-flash",       // default — fast, free tier available
  "gemini-2.5-flash-lite",  // lightest / cheapest
  "gemini-2.5-pro",         // highest capability
  "gemini-3-flash",         // latest generation
  "gemini-flash-latest"     // alias → always resolves to newest flash
]`

const CURL_PUSH = `curl -X POST ${BASE_URL}/api/v1/gateway/push \\
  -H "Content-Type: application/json" \\
  -d '{
    "keys": [
      {
        "providerId": "groq",
        "providerName": "Groq",
        "apiKey": "gsk_...",
        "modelIds": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
        "avgLatencyMs": 280
      }
    ],
    "chunkIndex": 0,
    "totalChunks": 1,
    "allApiKeys": ["gsk_..."]
  }'`

const RESP_MODELS = `{
  "object": "list",
  "data": [
    {
      "id": "MODEL_ID",
      "object": "model",
      "created": 1700000000,
      "owned_by": "msaku"
    },
    {
      "id": "llama-3.3-70b-versatile",
      "object": "model",
      "created": 1700000000,
      "owned_by": "groq"
    }
  ]
}`

const RESP_CHAT = `{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "llama-3.3-70b-versatile",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 12,
    "total_tokens": 22
  }
}`

const RESP_STREAM = `data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"delta":{"role":"assistant"},"index":0}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"},"index":0}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"delta":{"content":"!"},"index":0}]}

data: [DONE]`

const RESP_PUSH = `{
  "ok": true,
  "chunkIndex": 0,
  "totalChunks": 1,
  "synced": 3,
  "providers": 2,
  "models": 16,
  "pruned": 0,
  "totalInDb": 3,
  "isLastChunk": true
}`

const SDK_PYTHON = `from openai import OpenAI

client = OpenAI(
    api_key="YOUR_TOKEN",
    base_url="${BASE_URL}/api/v1",
)

response = client.chat.completions.create(
    model="MODEL_ID",        # pilih dari GET /api/v1/models
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`

const SDK_JS = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "YOUR_TOKEN",
  baseURL: "${BASE_URL}/api/v1",
});

const response = await client.chat.completions.create({
  model: "MODEL_ID",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(response.choices[0].message.content);`

const SDK_LANGCHAIN = `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="MODEL_ID",
    openai_api_key="YOUR_TOKEN",
    openai_api_base="${BASE_URL}/api/v1",
)

response = llm.invoke("Hello!")
print(response.content)`

// ── Page component ─────────────────────────────────────────────────────────────
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<string>("overview")
  const [sdkTab, setSdkTab] = useState<"python" | "js" | "langchain">("python")

  const scrollTo = (id: string) => {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-muted-foreground hover:text-foreground transition-colors text-[13px]">
              ← Back
            </a>
            <span className="text-border/60">|</span>
            <span className="text-[13px] font-semibold text-foreground">Msaku Gateway</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/25">
              API Docs
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground hidden sm:block">
              {BASE_URL}/api/v1
            </span>
            <span className="h-2 w-2 rounded-full bg-success shrink-0" title="Gateway online" />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8">
        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="hidden lg:block w-48 shrink-0">
          <nav className="sticky top-22 space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3 px-2">
              Contents
            </p>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`w-full text-left px-2 py-1.5 rounded text-[13px] transition-colors ${
                  activeSection === s.id
                    ? "text-primary bg-primary/10 font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 space-y-16">

          {/* Overview -------------------------------------------------------- */}
          <section id="overview">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground mb-2 text-balance">
                Msaku Gateway API
              </h1>
              <p className="text-muted-foreground leading-relaxed text-[14px]">
                An OpenAI-compatible gateway that automatically routes requests to the fastest available provider.
                Drop-in replacement for the OpenAI API — just change the <code className="text-primary/90 font-mono text-[13px]">base_url</code>.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mb-6">
              {[
                { label: "Base URL", value: `${BASE_URL}/api/v1` },
                { label: "Protocol", value: "HTTPS only" },
                { label: "Format",   value: "OpenAI-compatible" },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-lg border border-border/40 bg-secondary/10">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">{item.label}</p>
                  <p className="text-[13px] font-mono text-foreground/90 break-all">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Available Endpoints</p>
              <EndpointCard method="GET"  path="/api/v1/models"              description="List all active models in the gateway"   auth />
              <EndpointCard method="POST" path="/api/v1/chat/completions"    description="OpenAI-compatible chat completions"       auth badge="OpenAI compat" />
              <EndpointCard method="POST" path="/api/v1/gateway/push"        description="Sync working keys to the gateway DB"      auth={false} badge="Admin" />
            </div>
          </section>

          {/* Authentication -------------------------------------------------- */}
          <section id="authentication">
            <h2 className="text-lg font-bold text-foreground mb-1">Authentication</h2>
            <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
              Msaku Gateway (<code className="text-primary/90 font-mono text-[12px]">https://gateway.msaku.id</code>) khusus
              menggunakan <strong>API Key User</strong> (<code className="text-primary/90 font-mono text-[12px]">msk_...</code>)
              pada header <code className="text-primary/90 font-mono text-[12px]">Authorization: Bearer &lt;KEY&gt;</code>.
              Tidak ada API Key Publik — gateway ini eksklusif untuk pengguna terdaftar MSAKU.id.
            </p>
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 mb-4">
              <p className="text-[12px] font-semibold text-foreground mb-1">API Key User MSAKU.ID (msk_...)</p>
              <p className="text-[11px] text-muted-foreground mb-2">
                API Key khusus pengguna terdaftar di{" "}
                <a href="https://msaku.id/gateway" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  msaku.id/gateway
                </a>{" "}
                atau{" "}
                <a href="https://msaku.id/profil/api-key" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  msaku.id/profil/api-key
                </a>{" "}
                (kuota 120 req/menit untuk AI Gateway dan MCP Server Msaku):
              </p>
              <code className="block px-2.5 py-1.5 rounded bg-background border border-border font-mono text-[11px] text-foreground break-all">
                msk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
              </code>
            </div>
            <CodeBlock
              title="Authorization header"
              language="bash"
              code={`Authorization: Bearer msk_YOUR_MSAKU_USER_KEY`}
            />
          </section>

          {/* List Models ----------------------------------------------------- */}
          <section id="models">
            <h2 className="text-lg font-bold text-foreground mb-1">List Models</h2>
            <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
              Returns all models currently active in the gateway from synced working keys.
              Gunakan salah satu Model ID yang dikembalikan endpoint ini untuk request chat.
            </p>

            <div className="mb-4">
              <EndpointCard method="GET" path="/api/v1/models" description="Returns a list of available models" auth />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Request</p>
                <CodeBlock title="cURL" code={CURL_MODELS} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Response</p>
                <CodeBlock title="200 OK" language="json" code={RESP_MODELS} />
              </div>
            </div>
          </section>

          {/* Chat Completions ------------------------------------------------- */}
          <section id="chat">
            <h2 className="text-lg font-bold text-foreground mb-1">Chat Completions</h2>
            <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
              Fully OpenAI-compatible chat completions. The gateway selects the best available
              key for the requested model and forwards the request. If the primary key fails
              (429 / 401 / 503), it automatically falls back to the next available key.
            </p>

            <div className="mb-4">
              <EndpointCard method="POST" path="/api/v1/chat/completions" description="Create a chat completion" auth badge="OpenAI compat" />
            </div>

            <div className="mb-5">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Request body</p>
              <ParamTable params={[
                { name: "model",       type: "string",   required: true,  description: 'Model ID dari GET /api/v1/models' },
                { name: "messages",    type: "array",    required: true,  description: "Array of {role, content} message objects" },
                { name: "stream",      type: "boolean",  required: false, default: "false", description: "Stream response chunks using SSE" },
                { name: "max_tokens",  type: "integer",  required: false, description: "Maximum tokens to generate" },
                { name: "temperature", type: "number",   required: false, default: "1.0",   description: "Sampling temperature (0–2)" },
                { name: "top_p",       type: "number",   required: false, default: "1.0",   description: "Nucleus sampling probability" },
              ]} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Request</p>
                <CodeBlock title="cURL" code={CURL_CHAT} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Response</p>
                <CodeBlock title="200 OK" language="json" code={RESP_CHAT} />
              </div>
            </div>

            <div className="mt-5 p-3.5 rounded-lg border border-primary/20 bg-primary/5">
              <p className="text-[12px] text-primary/80 leading-relaxed">
                <strong className="text-primary">Tip:</strong> Selalu ambil daftar Model ID terbaru dari{" "}
                <code className="font-mono text-[11px]">GET /api/v1/models</code> sebelum mengirim request chat —
                hanya model dari key yang tersinkron dan masih aktif yang dilayani gateway.
                providers with the lowest average latency.
              </p>
            </div>
          </section>

          {/* Streaming ------------------------------------------------------- */}
          <section id="streaming">
            <h2 className="text-lg font-bold text-foreground mb-1">Streaming</h2>
            <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
              Set <code className="text-primary/90 font-mono text-[12px]">stream: true</code> to receive
              Server-Sent Events (SSE) chunks in OpenAI delta format. The stream ends with{" "}
              <code className="text-primary/90 font-mono text-[12px]">data: [DONE]</code>.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Request</p>
                <CodeBlock title="cURL (streaming)" code={CURL_CHAT_STREAM} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">SSE chunks</p>
                <CodeBlock title="Event stream" language="text" code={RESP_STREAM} />
              </div>
            </div>
          </section>

          {/* Chat UI Flow --------------------------------------------------- */}
          <section id="chat-flow">
            <h2 className="text-lg font-bold text-foreground mb-1">Chat UI Flow</h2>
            <p className="text-[13px] text-muted-foreground mb-5 leading-relaxed">
              The built-in Chat interface (accessible from the main app) proxies directly to the{" "}
              <code className="text-primary/90 font-mono text-[12px]">/api/chat</code> route, which
              forwards to Google Generative Language API and streams back SSE chunks. This is a separate
              flow from the gateway &mdash; it uses a Gemini API key directly rather than the key pool.
            </p>

            {/* Step-by-step flow */}
            <div className="mb-6">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                End-to-end flow
              </p>
              <div className="flex flex-col gap-0">
                {[
                  {
                    step: "1",
                    label: "User selects provider + model",
                    detail: "In the left panel: choose a provider preset (e.g. Gemini), paste an API key, and pick a model from GEMINI_CHAT_MODELS. Temperature and max tokens are also configurable.",
                  },
                  {
                    step: "2",
                    label: "User types a message → Enter",
                    detail: "Shift+Enter inserts a newline. IME composition (CJK input) is handled — the message is only submitted after composition ends. The full conversation history is included in every request.",
                  },
                  {
                    step: "3",
                    label: "Frontend POSTs to /api/chat",
                    detail: "The Chat component sends the full message array plus model, temperature, maxOutputTokens, systemPrompt, and optionally the API key. If no key is provided, the server falls back to the GEMINI_API_KEY environment variable.",
                  },
                  {
                    step: "4",
                    label: "Server calls Gemini streamGenerateContent",
                    detail: `The route handler hits https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse using the X-goog-api-key header. The request body includes contents[], generationConfig, and optionally systemInstruction.`,
                  },
                  {
                    step: "5",
                    label: "Server re-streams SSE to client",
                    detail: 'Each Gemini SSE chunk is parsed for text and usageMetadata, then re-emitted as a simplified JSON object: {"text":"..."} or {"inputTokens":N,"outputTokens":N}. The stream terminates with data: [DONE].',
                  },
                  {
                    step: "6",
                    label: "Frontend renders text incrementally",
                    detail: "The client reads the stream chunk-by-chunk, appends chunk.text to the assistant message, and updates React state in real-time. Token counts and latency are displayed in the top bar after the stream ends.",
                  },
                ].map((item, i, arr) => (
                  <div key={item.step} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-primary">{item.step}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="w-px flex-1 bg-border/40 my-1" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-[13px] font-semibold text-foreground mb-0.5">{item.label}</p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Endpoint card */}
            <div className="mb-4">
              <EndpointCard
                method="POST"
                path="/api/chat"
                description="Gemini streaming chat proxy — no gateway auth required"
                auth={false}
                badge="Gemini SSE"
              />
            </div>

            {/* Request body params */}
            <div className="mb-5">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Request body
              </p>
              <ParamTable params={[
                { name: "model",            type: "string",   required: true,  description: "Gemini model ID (see supported models below)" },
                { name: "messages",         type: "array",    required: true,  description: "Full conversation history as [{role, content}]. role must be \"user\" or \"assistant\"" },
                { name: "temperature",      type: "number",   required: false, default: "1.0",   description: "Sampling temperature forwarded to generationConfig" },
                { name: "maxOutputTokens",  type: "integer",  required: false, default: "2048",  description: "Max tokens to generate, forwarded to generationConfig" },
                { name: "systemPrompt",     type: "string",   required: false, description: "Injected as systemInstruction.parts[0].text — sets the model's persona" },
                { name: "apiKey",           type: "string",   required: false, description: "Gemini API key. If omitted, falls back to GEMINI_API_KEY env var on the server" },
              ]} />
            </div>

            {/* Supported models */}
            <div className="mb-5">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Supported models (GEMINI_CHAT_MODELS)
              </p>
              <CodeBlock title="Model list" language="json" code={GEMINI_MODELS_LIST} />
            </div>

            {/* Request body annotated */}
            <div className="mb-5">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Request body (annotated)
              </p>
              <CodeBlock title="JSON body" language="javascript" code={CHAT_REQUEST_BODY} />
            </div>

            {/* cURL + SSE response */}
            <div className="grid md:grid-cols-2 gap-4 mb-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">cURL example</p>
                <CodeBlock title="cURL" code={CURL_CHAT_UI} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">SSE response stream</p>
                <CodeBlock title="Event stream" language="text" code={CHAT_SSE_STREAM} />
              </div>
            </div>

            {/* Client-side fetch code */}
            <div className="mb-5">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Frontend fetch (chat.tsx pattern)
              </p>
              <CodeBlock title="TypeScript — reading the SSE stream" language="javascript" code={CHAT_CLIENT_CODE} />
            </div>

            {/* Architecture note */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg border border-border/40 bg-secondary/10">
                <p className="text-[11px] font-semibold text-foreground mb-1.5">Gemini role mapping</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Gemini uses <code className="font-mono text-[11px]">model</code> instead of <code className="font-mono text-[11px]">assistant</code>.
                  The route handler automatically remaps <code className="font-mono text-[11px]">role === &quot;assistant&quot;</code>{" "}
                  to <code className="font-mono text-[11px]">&quot;model&quot;</code> before forwarding.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-border/40 bg-secondary/10">
                <p className="text-[11px] font-semibold text-foreground mb-1.5">API key priority</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Key resolution order: <span className="text-foreground/80">1.</span> <code className="font-mono text-[11px]">apiKey</code> field in request body
                  &rarr; <span className="text-foreground/80">2.</span> <code className="font-mono text-[11px]">GEMINI_API_KEY</code> environment variable.
                  If neither is set the request will return a 400 from Gemini.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-border/40 bg-secondary/10">
                <p className="text-[11px] font-semibold text-foreground mb-1.5">Provider selector</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  The Chat tab is currently Gemini-only. The provider/model picker in the left panel controls
                  which <code className="font-mono text-[11px]">model</code> string is sent. Selecting a different
                  preset (e.g. OpenAI) routes to the gateway endpoint, not <code className="font-mono text-[11px]">/api/chat</code>.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-border/40 bg-secondary/10">
                <p className="text-[11px] font-semibold text-foreground mb-1.5">No gateway auth needed</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  <code className="font-mono text-[11px]">/api/chat</code> does not require a Bearer token —
                  authentication is handled by the Gemini API key in the body. Only the{" "}
                  <code className="font-mono text-[11px]">/api/v1/*</code> gateway routes require the Public Key or your personal <code className="font-mono text-[11px]">msk_</code> MSAKU.id key.
                </p>
              </div>
            </div>
          </section>

          {/* Rate Limits ------------------------------------------------------ */}
          <section id="rate-limits">
            <h2 className="text-lg font-bold text-foreground mb-1">Rate Limits &amp; Quotas</h2>
            <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
              Msaku Gateway applies layered limits: per API key, per provider, and a daily shared-token
              budget for shared keys. Responses include <code className="text-primary/90 font-mono text-[12px]">X-Msaku-Provider</code> and{" "}
              <code className="text-primary/90 font-mono text-[12px]">X-Msaku-Model</code> headers.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div className="p-3.5 rounded-lg border border-border/40 bg-secondary/10">
                <p className="text-[12px] font-semibold text-foreground mb-1">Per API key (msk_...)</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">120 requests per minute per personal key. Applies to both streaming and non-streaming requests.</p>
              </div>
              <div className="p-3.5 rounded-lg border border-border/40 bg-secondary/10">
                <p className="text-[12px] font-semibold text-foreground mb-1">Per provider</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">Each provider has its own concurrency limit (typically 10 concurrent requests). When a provider returns 429, the gateway automatically falls back to the next available key.</p>
              </div>
              <div className="p-3.5 rounded-lg border border-border/40 bg-secondary/10">
                <p className="text-[12px] font-semibold text-foreground mb-1">Shared-key daily budget</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">1,000,000 tokens per day per msk_ user on shared keys (default, configurable via <code className="font-mono">SHARED_DAILY_TOKEN_BUDGET_PER_USER</code>). Private keys are never capped. Streaming usage is not counted.</p>
              </div>
              <div className="p-3.5 rounded-lg border border-border/40 bg-secondary/10">
                <p className="text-[12px] font-semibold text-foreground mb-1">429 handling</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">A 429 from the gateway means either your key rate limit or the shared daily budget was hit. The error message tells you which one.</p>
              </div>
            </div>

            <CodeBlock
              title="Example 429 response"
              language="json"
              code={`{
  "error": "Rate limit tercapai (120 req/menit). Tunggu sebentar lalu coba lagi."
}`}
            />
          </section>

          {/* Push ------------------------------------------------------------ */}
          <section id="push">
            <h2 className="text-lg font-bold text-foreground mb-1">Sync Keys (Push)</h2>
            <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
              Push working API keys into the gateway database. Keys are sent in chunks to avoid
              timeouts with large sets. The final chunk prunes any keys that were not included
              in <code className="text-primary/90 font-mono text-[12px]">allApiKeys</code>.
            </p>

            <div className="mb-4">
              <EndpointCard method="POST" path="/api/v1/gateway/push" description="Upsert a chunk of working keys" auth={false} badge="Admin" />
            </div>

            <div className="mb-5">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Request body</p>
              <ParamTable params={[
                { name: "keys",        type: "GatewayKey[]", required: true,  description: "Array of key objects to upsert (see schema below)" },
                { name: "chunkIndex",  type: "integer",      required: false, default: "0",    description: "0-based index of this chunk" },
                { name: "totalChunks", type: "integer",      required: false, default: "1",    description: "Total number of chunks being sent" },
                { name: "allApiKeys",  type: "string[]",     required: false, description: "Full list of api_key values. Sent on the last chunk to prune stale rows." },
              ]} />
            </div>

            <div className="mb-5">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">GatewayKey schema</p>
              <ParamTable params={[
                { name: "providerId",   type: "string",   required: true,  description: "Unique provider identifier (e.g. groq, openai, mistral)" },
                { name: "providerName", type: "string",   required: true,  description: "Human-readable provider name" },
                { name: "apiKey",       type: "string",   required: true,  description: "The actual API key for this provider" },
                { name: "modelIds",     type: "string[]", required: true,  description: "List of model IDs confirmed working with this key" },
                { name: "avgLatencyMs", type: "number",   required: false, default: "0", description: "Average latency in milliseconds (used for routing priority)" },
                { name: "pushedAt",     type: "number",   required: false, description: "Unix timestamp in ms when this key was last tested" },
              ]} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Request</p>
                <CodeBlock title="cURL" code={CURL_PUSH} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Response</p>
                <CodeBlock title="200 OK" language="json" code={RESP_PUSH} />
              </div>
            </div>
          </section>

          {/* Errors ---------------------------------------------------------- */}
          <section id="errors">
            <h2 className="text-lg font-bold text-foreground mb-1">Error Codes</h2>
            <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
              All errors are returned as JSON with an <code className="text-primary/90 font-mono text-[12px]">error</code> field.
            </p>

            <div className="rounded-lg border border-border/40 overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border/40 bg-secondary/30">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Meaning</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Common cause</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["400", "Bad Request",        "Missing or invalid request body fields"],
                    ["401", "Unauthorized",       "Missing or invalid Authorization header / token"],
                    ["404", "Model Not Found",    "No key in the gateway supports the requested model"],
                    ["429", "Rate Limited",       "All keys for this provider are rate-limited"],
                    ["500", "Server Error",       "DB write failure or unexpected upstream error"],
                    ["503", "Service Unavailable","No working keys available for any provider"],
                  ].map(([code, title, cause], i) => (
                    <tr key={code} className={`border-b border-border/20 last:border-0 ${i % 2 === 0 ? "bg-background/30" : "bg-secondary/10"}`}>
                      <td className="px-3 py-2.5 font-mono font-semibold text-destructive/80">{code}</td>
                      <td className="px-3 py-2.5 text-foreground/80">{title}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{cause}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <CodeBlock
                title="Error response format"
                language="json"
                code={`{
  "error": "No active key found for model: gpt-5-ultra",
  "model": "gpt-5-ultra"
}`}
              />
            </div>
          </section>

          {/* CLI Tooling ---------------------------------------------------- */}
          <section id="cli">
            <h2 className="text-lg font-bold text-foreground mb-1">MsakuCLI — Official CLI</h2>
            <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
              Command-line client untuk Msaku Gateway: login sekali, lalu chat, list models, atau stream
              langsung dari terminal. Kompatibel dengan agent coding lain via base URL.
            </p>

            <div className="mb-5">
              <CodeBlock title="Install" language="bash" code={`npm install -g @msaku/cli\n# atau tanpa install:\nnpx @msaku/cli --help`} />
            </div>

            <div className="mb-5">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quickstart</p>
              <CodeBlock
                title="3 langkah mulai"
                language="bash"
                code={`# 1. Simpan API key msaku.id kamu\nmsaku login --api-key msk_your_key_here\n\n# 2. Cek koneksi & kuota\nmsaku status\n\n# 3. Chat / stream\nmsaku chat "Explain edge computing in 3 bullets"\nmsaku stream --model claude-sonnet-4-5 "Write a haiku about APIs"`}
              />
            </div>

            <div className="mb-5">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Semua perintah</p>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-border/40 bg-secondary/30">
                      <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Command</th>
                      <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["msaku login --api-key <key>",  "Simpan kunci msk_... ke ~/.msaku/credentials (chmod 600)"],
                      ["msaku status",                 "Cek base URL, status auth, jumlah model, dan tier kunci"],
                      ["msaku models",                 "List semua model yang tersedia di gateway"],
                      ["msaku chat \"...\"",            "Chat completion sekali jalan, print hasil lengkap"],
                      ["msaku stream \"...\"",          "Stream token real-time ke terminal"],
                      ["msaku logout",                 "Hapus kredensial tersimpan"],
                    ].map(([cmd, desc], i) => (
                      <tr key={cmd} className={`border-b border-border/20 last:border-0 ${i % 2 === 0 ? "bg-background/30" : "bg-secondary/10"}`}>
                        <td className="px-3 py-2.5 font-mono text-primary/90 whitespace-nowrap">{cmd}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Integrasi dengan coding agent</p>
              <CodeBlock
                title="Environment variables"
                language="bash"
                code={`# Claude Code\nexport ANTHROPIC_BASE_URL="${BASE_URL}/v1"\nexport ANTHROPIC_API_KEY="msk_your_key_here"\n\n# OpenAI SDK / Cursor / Opencode\nexport OPENAI_BASE_URL="${BASE_URL}/v1"\nexport OPENAI_API_KEY="msk_your_key_here"`}
              />
            </div>

            <div className="p-3.5 rounded-lg border border-primary/25 bg-primary/5">
              <p className="text-[12px] text-foreground/90 leading-relaxed">
                <strong>Tip:</strong> Semua perintah menerima <code className="font-mono text-primary">--model &lt;id&gt;</code> untuk
                pin model tertentu, dan <code className="font-mono text-primary">--api-key</code> untuk override kredensial satu kali.
                Tanpa <code className="font-mono text-primary">--model</code>, gateway memilih kunci tercepat yang tersedia secara otomatis.
              </p>
            </div>
          </section>

          {/* SDK Examples ----------------------------------------------------- */}
          <section id="sdks">
            <h2 className="text-lg font-bold text-foreground mb-1">SDK Examples</h2>
            <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
              The gateway is fully OpenAI-compatible — use any OpenAI SDK by changing only the{" "}
              <code className="text-primary/90 font-mono text-[12px]">base_url</code>.
            </p>

            {/* Tab switcher */}
            <div className="flex gap-1 mb-4 border-b border-border/40 pb-0">
              {(["python", "js", "langchain"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSdkTab(tab)}
                  className={`px-3 py-2 text-[12px] font-medium transition-colors border-b-2 -mb-px ${
                    sdkTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "python" ? "Python" : tab === "js" ? "Node.js" : "LangChain"}
                </button>
              ))}
            </div>

            {sdkTab === "python" && (
              <CodeBlock title="Python (openai >= 1.0)" language="python" code={SDK_PYTHON} />
            )}
            {sdkTab === "js" && (
              <CodeBlock title="Node.js (openai npm)" language="javascript" code={SDK_JS} />
            )}
            {sdkTab === "langchain" && (
              <CodeBlock title="LangChain (Python)" language="python" code={SDK_LANGCHAIN} />
            )}

            <div className="mt-5 p-3.5 rounded-lg border border-border/40 bg-secondary/10">
              <p className="text-[12px] font-semibold text-foreground mb-2">Compatible with any OpenAI client</p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                LibreChat, Open WebUI, Continue.dev, Cursor, AnythingLLM, and any other tool that
                accepts a custom OpenAI base URL will work out of the box.
              </p>
            </div>
          </section>

          {/* Footer ---------------------------------------------------------- */}
          <footer className="pt-8 border-t border-border/30">
            <p className="text-[12px] text-muted-foreground/70 text-center">
              Msaku Gateway &mdash; API Docs &mdash; {BASE_URL}
            </p>
          </footer>

        </main>
      </div>
    </div>
  )
}
