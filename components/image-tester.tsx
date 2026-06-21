"use client"

import { useState, useRef } from "react"
import { getImageCapabilities, IMAGE_ASPECT_RATIOS } from "@/lib/provider-capabilities"
import type { ImageModel } from "@/lib/provider-capabilities"

// Re-export for backwards compatibility with manual-key-tester imports
export { IMAGE_ASPECT_RATIOS }
export const IMAGE_MODELS = getImageCapabilities("google") // default fallback

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

interface ImageTesterProps {
  apiKey?: string
  model?: string
  aspectRatio?: string
  providerId?: string
}

export default function ImageTester({
  apiKey = "",
  model,
  aspectRatio = "1:1",
  providerId = "google",
}: ImageTesterProps) {
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImageResult | null>(null)
  const [inspectorTab, setInspectorTab] = useState<"request" | "response">("response")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const hasKey = !!apiKey.trim()
  const supportedModels: ImageModel[] = getImageCapabilities(providerId)
  const isSupported = supportedModels.length > 0

  // Resolve which model to use: prefer prop, else first supported
  const activeModelId = model && supportedModels.find((m) => m.id === model)
    ? model
    : supportedModels[0]?.id ?? ""
  const currentModel = supportedModels.find((m) => m.id === activeModelId)

  async function generate() {
    if (!prompt.trim() || loading || !hasKey || !isSupported) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model: activeModelId,
          aspectRatio,
          apiKey: apiKey.trim(),
          providerId,
        }),
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
        model: activeModelId,
        error: err instanceof Error ? err.message : "Network error",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Center — prompt + result */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Header status bar */}
        <div className="flex-shrink-0 px-5 py-2.5 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-1.5 h-1.5 flex-shrink-0 rounded-full ${
              !isSupported ? "bg-yellow-400" : hasKey ? "bg-green-400" : "bg-muted-foreground"
            }`} />
            {isSupported ? (
              <>
                <span className="text-[11px] font-mono text-muted-foreground truncate">{currentModel?.label ?? activeModelId}</span>
                <span className="text-[10px] font-mono text-muted-foreground/60">{aspectRatio}</span>
              </>
            ) : (
              <span className="text-[11px] text-yellow-400/80">Image generation not supported for this provider</span>
            )}
          </div>
          {result && (
            <span className={`flex-shrink-0 text-[10px] font-mono px-2 py-0.5 rounded border ${
              result.error
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-green-400/10 border-green-400/30 text-green-400"
            }`}>
              {result.error ? "ERROR" : `${result.duration}ms`}
            </span>
          )}
        </div>

        {/* Result area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col items-center justify-start gap-4">

          {/* Provider not supported */}
          {!isSupported && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center max-w-sm">
              <div className="w-12 h-12 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-yellow-400">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Not Available</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This provider does not have a dedicated image generation API.
                  Switch to <span className="text-foreground font-medium">Gemini (Google)</span>, <span className="text-foreground font-medium">GPT (OpenAI)</span>, <span className="text-foreground font-medium">Together AI</span>, <span className="text-foreground font-medium">Fireworks AI</span>, or <span className="text-foreground font-medium">Replicate</span> to generate images.
                </p>
              </div>
            </div>
          )}

          {isSupported && !result && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
              {!hasKey && (
                <div className="text-[11px] text-yellow-400/80 border border-yellow-400/20 bg-yellow-400/5 px-4 py-2.5 rounded-lg">
                  Enter your API key in the left panel to generate images.
                </div>
              )}
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-primary">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Generate an Image</p>
                <p className="text-xs text-muted-foreground">
                  {hasKey
                    ? `Using ${currentModel?.label ?? activeModelId} · write a prompt below and hit Generate`
                    : "API key required"}
                </p>
              </div>
              {hasKey && (
                <div className="flex flex-col gap-2 w-full max-w-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Example prompts</p>
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setPrompt(p); textareaRef.current?.focus() }}
                      className="text-left text-xs px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-primary">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-1">Generating image...</p>
                <p className="text-xs text-muted-foreground">{currentModel?.label ?? activeModelId} is working</p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="w-full max-w-xl flex flex-col gap-4">
              {result.error ? (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
                  <p className="text-xs font-semibold text-destructive mb-1">
                    {result.errorStatus ?? "Error"}{result.errorCode ? ` (${result.errorCode})` : ""}
                  </p>
                  <p className="text-xs text-destructive/80">{result.error}</p>
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
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Model commentary</p>
                      <p className="text-xs text-foreground leading-relaxed">{result.textContent}</p>
                    </div>
                  )}
                  <a
                    href={`data:${result.imageMimeType};base64,${result.imageData}`}
                    download={`generated-image-${Date.now()}.${result.imageMimeType.split("/")[1]}`}
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
              ) : result.textContent ? (
                // Provider returned a URL instead of base64 (Novita, Replicate)
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl overflow-hidden border border-border bg-secondary/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.textContent} alt={prompt} className="w-full h-auto object-contain" />
                  </div>
                  <a
                    href={result.textContent}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-semibold transition-colors"
                  >
                    Open Full Size
                  </a>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-secondary/40 border border-border">
                  <p className="text-xs text-muted-foreground">No image data returned by the model.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prompt input */}
        {isSupported && (
          <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 pt-3 pb-4 bg-card">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate() }}
                  placeholder={hasKey ? "Describe the image to generate..." : "Open config (menu icon) and enter API key first..."}
                  rows={2}
                  disabled={!hasKey}
                  className="w-full resize-none rounded-xl bg-secondary/60 border border-border text-sm text-foreground placeholder:text-muted-foreground px-3 py-2.5 outline-none focus:border-primary/60 transition-colors font-sans leading-relaxed disabled:opacity-50"
                />
              </div>
              <button
                onClick={generate}
                disabled={!prompt.trim() || loading || !hasKey}
                className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 h-[46px] rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all min-w-[90px]"
              >
                {loading ? (
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
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
            <p className="text-[10px] text-muted-foreground mt-2 hidden sm:block">
              Ctrl+Enter to generate
            </p>
          </div>
        )}
      </main>

      {/* Right — inspector */}
      <aside className="w-64 flex-shrink-0 border-l border-border bg-card flex flex-col min-h-0">
        <div className="flex border-b border-border flex-shrink-0">
          {(["request", "response"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setInspectorTab(t)}
              className={`flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                inspectorTab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {!result ? (
            <p className="text-[10px] text-muted-foreground text-center mt-8">
              Generate an image to see request and response payloads.
            </p>
          ) : inspectorTab === "request" ? (
            <div className="relative">
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(result.rawRequest, null, 2))}
                className="absolute top-0 right-0 text-[9px] px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
              >
                Copy
              </button>
              <pre className="text-[9px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed pr-10">
                {JSON.stringify(result.rawRequest, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(result.rawResponse, null, 2))}
                className="absolute top-0 right-0 text-[9px] px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
              >
                Copy
              </button>
              <pre className="text-[9px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed pr-10">
                {result.rawResponse
                  ? JSON.stringify(
                      JSON.parse(JSON.stringify(result.rawResponse, (_, v) =>
                        typeof v === "string" && v.length > 200 ? v.slice(0, 60) + `...[${v.length}chars]` : v
                      )), null, 2)
                  : "No response"}
              </pre>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
