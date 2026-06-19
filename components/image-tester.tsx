"use client"

import { useState, useRef } from "react"

const IMAGE_MODELS = [
  {
    id: "gemini-3-pro-image",
    label: "Nano Banana Pro",
    tag: "Gemini 3 Pro",
    description: "Studio-quality 4K, complex layouts, precise text rendering",
  },
  {
    id: "gemini-3.1-flash-image",
    label: "Nano Banana 2",
    tag: "Gemini 3.1 Flash",
    description: "High-efficiency, fast generation for high-volume use cases",
  },
  {
    id: "gemini-2.5-flash-image",
    label: "Nano Banana",
    tag: "Gemini 2.5 Flash",
    description: "Fast creative workflows, native image generation & editing",
  },
]

const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3"]

const EXAMPLE_PROMPTS = [
  "A photorealistic bowl of ramen glowing under neon lights in a Tokyo alley at night",
  "An astronaut sitting on the moon reading a newspaper, cinematic lighting",
  "A cozy coffee shop interior with rain on the windows, warm golden hour light",
  "A futuristic city skyline with flying cars, volumetric fog, ultra-detailed",
]

interface ImageResult {
  imageData: string | null
  imageMimeType: string
  textContent: string
  rawRequest: unknown
  rawResponse: unknown
  duration: number
  model: string
  error?: string
  errorCode?: number
  errorStatus?: string
}

export default function ImageTester() {
  const [prompt, setPrompt] = useState("")
  const [selectedModel, setSelectedModel] = useState(IMAGE_MODELS[0].id)
  const [aspectRatio, setAspectRatio] = useState("1:1")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImageResult | null>(null)
  const [inspectorTab, setInspectorTab] = useState<"request" | "response">("response")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function generate() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), model: selectedModel, aspectRatio }),
      })
      const data: ImageResult = await res.json()
      setResult(data)
      setInspectorTab("response")
    } catch (err) {
      setResult({
        imageData: null,
        imageMimeType: "image/png",
        textContent: "",
        rawRequest: null,
        rawResponse: null,
        duration: 0,
        model: selectedModel,
        error: err instanceof Error ? err.message : "Network error",
      })
    } finally {
      setLoading(false)
    }
  }

  const currentModel = IMAGE_MODELS.find((m) => m.id === selectedModel)

  return (
    <div className="flex h-full min-h-0">
      {/* Left sidebar — config */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-sidebar flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Model
          </p>
          <div className="flex flex-col gap-2">
            {IMAGE_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModel(m.id)}
                className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  selectedModel === m.id
                    ? "border-primary/60 bg-primary/10"
                    : "border-border hover:border-border/80 hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-foreground">{m.label}</span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                    {m.tag}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{m.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Aspect Ratio
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`py-1.5 rounded-md text-xs font-mono font-medium border transition-colors ${
                  aspectRatio === ratio
                    ? "bg-primary/20 border-primary/60 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {result && (
          <div className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Last Result
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">Status</span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    result.error
                      ? "bg-destructive/20 text-destructive"
                      : "bg-chart-2/20 text-chart-2"
                  }`}
                >
                  {result.error ? "ERROR" : "200 OK"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">Duration</span>
                <span className="text-[10px] font-mono text-foreground">{result.duration}ms</span>
              </div>
              {result.imageData && (
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">Format</span>
                  <span className="text-[10px] font-mono text-foreground">
                    {result.imageMimeType.split("/")[1].toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Center — prompt + result */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Image Generation</h2>
            <p className="text-[10px] text-muted-foreground font-mono">
              generativelanguage.googleapis.com/v1/models/{selectedModel}:generateContent
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20">
            {currentModel?.label}
          </span>
        </div>

        {/* Result area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col items-center justify-start gap-4">
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-primary">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Generate an Image</p>
                <p className="text-xs text-muted-foreground">
                  Select a model, write a prompt below, and hit Generate
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-sm">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Example prompts
                </p>
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPrompt(p)
                      textareaRef.current?.focus()
                    }}
                    className="text-left text-xs px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary border border-border hover:border-border/80 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-primary">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-1">Generating image...</p>
                <p className="text-xs text-muted-foreground">
                  {currentModel?.label} is creating your image
                </p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="w-full max-w-xl flex flex-col gap-4">
              {result.error ? (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
                  <p className="text-xs font-semibold text-destructive mb-1">
                    {result.errorStatus ?? "Error"} {result.errorCode && `(${result.errorCode})`}
                  </p>
                  <p className="text-xs text-destructive/80">{result.error}</p>
                  {result.errorCode === 403 && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Image generation models require a paid Gemini API tier. Free API keys return 403.
                    </p>
                  )}
                </div>
              ) : result.imageData ? (
                <>
                  <div className="rounded-xl overflow-hidden border border-border bg-secondary/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:${result.imageMimeType};base64,${result.imageData}`}
                      alt={prompt}
                      className="w-full h-auto object-contain"
                    />
                  </div>
                  {result.textContent && (
                    <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                        Model commentary
                      </p>
                      <p className="text-xs text-foreground leading-relaxed">{result.textContent}</p>
                    </div>
                  )}
                  <a
                    href={`data:${result.imageMimeType};base64,${result.imageData}`}
                    download={`gemini-image-${Date.now()}.${result.imageMimeType.split("/")[1]}`}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-semibold transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download Image
                  </a>
                </>
              ) : (
                <div className="p-4 rounded-xl bg-secondary/40 border border-border">
                  <p className="text-xs text-muted-foreground">No image data returned by the model.</p>
                  {result.textContent && (
                    <p className="text-xs text-foreground mt-2">{result.textContent}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prompt input */}
        <div className="flex-shrink-0 border-t border-border p-4 bg-card">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate()
                }}
                placeholder="Describe the image you want to generate..."
                rows={2}
                className="w-full resize-none rounded-xl bg-secondary/60 border border-border text-sm text-foreground placeholder:text-muted-foreground px-4 py-3 outline-none focus:border-primary/60 transition-colors font-sans leading-relaxed"
              />
            </div>
            <button
              onClick={generate}
              disabled={!prompt.trim() || loading}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? (
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Generate
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Ctrl+Enter to generate &middot; x-goog-api-key: &bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull; &middot; SynthID watermark included
          </p>
        </div>
      </main>

      {/* Right — inspector */}
      <aside className="w-80 flex-shrink-0 border-l border-border bg-sidebar flex flex-col min-h-0">
        <div className="flex border-b border-border flex-shrink-0">
          {(["request", "response"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setInspectorTab(t)}
              className={`flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                inspectorTab === t
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {!result && (
            <p className="text-[10px] text-muted-foreground text-center mt-8">
              Generate an image to see the request and response payloads here.
            </p>
          )}
          {result && (
            <>
              {inspectorTab === "request" && (
                <div className="relative">
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(JSON.stringify(result.rawRequest, null, 2))
                    }
                    className="absolute top-2 right-2 text-[9px] px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Copy
                  </button>
                  <pre className="text-[9px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed pr-12">
                    {JSON.stringify(result.rawRequest, null, 2)}
                  </pre>
                </div>
              )}
              {inspectorTab === "response" && (
                <div className="relative">
                  <button
                    onClick={() => {
                      const displayResponse = result.rawResponse
                        ? JSON.parse(JSON.stringify(result.rawResponse, (_, v) =>
                            typeof v === "string" && v.length > 200 ? v.slice(0, 60) + "...[base64 truncated]" : v
                          ))
                        : null
                      navigator.clipboard.writeText(JSON.stringify(displayResponse, null, 2))
                    }}
                    className="absolute top-2 right-2 text-[9px] px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Copy
                  </button>
                  <pre className="text-[9px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed pr-12">
                    {result.rawResponse
                      ? JSON.stringify(
                          JSON.parse(
                            JSON.stringify(result.rawResponse, (_, v) =>
                              typeof v === "string" && v.length > 200
                                ? v.slice(0, 60) + `...[base64 ${v.length} chars]`
                                : v
                            )
                          ),
                          null,
                          2
                        )
                      : "No response"}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* cURL equivalent */}
        <div className="flex-shrink-0 border-t border-border p-3">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            cURL Equivalent
          </p>
          <pre className="text-[8px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed bg-secondary/40 rounded-lg p-2 border border-border">
{`curl -X POST \\
  "https://generativelanguage.googleapis.com/v1/models/${selectedModel}:generateContent" \\
  -H "x-goog-api-key: $GEMINI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"contents":[{"parts":[{"text":"${(prompt || "your prompt here").slice(0, 60)}..."}]}],"generationConfig":{"responseModalities":["TEXT","IMAGE"]}}'`}
          </pre>
        </div>
      </aside>
    </div>
  )
}
