"use client"

import { useState, useRef } from "react"
import { getImageCapabilities, IMAGE_ASPECT_RATIOS } from "@/lib/provider-capabilities"
import type { ImageModel } from "@/lib/provider-capabilities"

export { IMAGE_ASPECT_RATIOS }
export const IMAGE_MODELS = getImageCapabilities("google")

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
  const [showInspector, setShowInspector] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<"request" | "response">("response")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const hasKey = !!apiKey.trim()
  const supportedModels: ImageModel[] = getImageCapabilities(providerId)
  const isSupported = supportedModels.length > 0

  const activeModelId =
    model && supportedModels.find((m) => m.id === model)
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

  const imageUrl = result?.imageData
    ? `data:${result.imageMimeType};base64,${result.imageData}`
    : result?.textContent && !result.error
    ? result.textContent
    : null

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Status bar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 flex-shrink-0 rounded-full ${
            !isSupported ? "bg-yellow-400" : hasKey ? "bg-green-400" : "bg-muted-foreground/40"
          }`} />
          <span className="text-[11px] font-mono text-muted-foreground truncate">
            {isSupported ? (currentModel?.label ?? activeModelId) : "Not supported"}
          </span>
          {isSupported && (
            <span className="text-[10px] font-mono text-muted-foreground/50 hidden sm:inline">{aspectRatio}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              result.error
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-green-400/10 border-green-400/30 text-green-400"
            }`}>
              {result.error ? "ERROR" : `${result.duration}ms`}
            </span>
          )}
          {result && (
            <button
              onClick={() => setShowInspector((v) => !v)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                showInspector
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {showInspector ? "Hide JSON" : "JSON"}
            </button>
          )}
        </div>
      </div>

      {/* Not supported */}
      {!isSupported && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-yellow-400">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-foreground">Not Available</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
            Switch to <span className="text-foreground">Gemini</span>, <span className="text-foreground">OpenAI</span>, <span className="text-foreground">Together AI</span>, or <span className="text-foreground">Replicate</span> to generate images.
          </p>
        </div>
      )}

      {/* Main content */}
      {isSupported && (
        <div className="flex-1 min-h-0 overflow-y-auto">

          {/* Empty state */}
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center min-h-full gap-5 p-6 text-center">
              {!hasKey && (
                <p className="text-[11px] text-yellow-400/80 border border-yellow-400/20 bg-yellow-400/5 px-4 py-2 rounded-lg">
                  Enter your API key to generate images.
                </p>
              )}
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-primary">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Generate an Image</p>
                <p className="text-xs text-muted-foreground">
                  {hasKey ? "Write a prompt below and hit Generate" : "API key required"}
                </p>
              </div>
              {hasKey && (
                <div className="flex flex-col gap-2 w-full max-w-sm">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setPrompt(p); textareaRef.current?.focus() }}
                      className="text-left text-xs px-3 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors leading-relaxed"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center min-h-full gap-4 p-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-primary">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">Generating image...</p>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <div className="p-4 flex flex-col gap-4">
              {result.error ? (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
                  <p className="text-xs font-semibold text-destructive mb-1">
                    {result.errorStatus ?? "Error"}{result.errorCode ? ` (${result.errorCode})` : ""}
                  </p>
                  <p className="text-xs text-destructive/80">{result.error}</p>
                </div>
              ) : imageUrl ? (
                <>
                  <div className="rounded-xl overflow-hidden border border-border bg-secondary/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt={prompt} className="w-full h-auto object-contain" />
                  </div>
                  {result.textContent && !result.textContent.startsWith("http") && (
                    <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Commentary</p>
                      <p className="text-xs text-foreground leading-relaxed">{result.textContent}</p>
                    </div>
                  )}
                  <a
                    href={imageUrl}
                    download={result.imageData ? `image-${Date.now()}.${result.imageMimeType.split("/")[1]}` : undefined}
                    target={!result.imageData ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-semibold transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {result.imageData ? "Download Image" : "Open Full Size"}
                  </a>
                  <button
                    onClick={() => setResult(null)}
                    className="w-full py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs transition-colors"
                  >
                    Generate Another
                  </button>
                </>
              ) : (
                <div className="p-4 rounded-xl bg-secondary/40 border border-border">
                  <p className="text-xs text-muted-foreground">No image data returned.</p>
                </div>
              )}

              {/* Inline JSON inspector (collapsible) */}
              {showInspector && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="flex border-b border-border">
                    {(["request", "response"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setInspectorTab(t)}
                        className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                          inspectorTab === t
                            ? "text-primary bg-primary/5 border-b-2 border-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="p-3 relative bg-card">
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          JSON.stringify(
                            inspectorTab === "request" ? result.rawRequest : result.rawResponse,
                            null, 2
                          )
                        )
                      }
                      className="absolute top-3 right-3 text-[9px] px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
                    >
                      Copy
                    </button>
                    <pre className="text-[9px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto pr-10">
                      {inspectorTab === "request"
                        ? JSON.stringify(result.rawRequest, null, 2)
                        : result.rawResponse
                        ? JSON.stringify(
                            JSON.parse(
                              JSON.stringify(result.rawResponse, (_, v) =>
                                typeof v === "string" && v.length > 200
                                  ? v.slice(0, 60) + `...[${v.length}chars]`
                                  : v
                              )
                            ),
                            null, 2
                          )
                        : "No response"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Prompt input */}
      {isSupported && (
        <div className="flex-shrink-0 border-t border-border px-3 pt-3 pb-4 bg-card">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate()
              }}
              placeholder={
                hasKey ? "Describe the image..." : "Enter API key first..."
              }
              rows={2}
              disabled={!hasKey}
              className="flex-1 resize-none rounded-xl bg-secondary/60 border border-border text-sm text-foreground placeholder:text-muted-foreground px-3 py-2.5 outline-none focus:border-primary/60 transition-colors font-sans leading-relaxed disabled:opacity-50"
            />
            <button
              onClick={generate}
              disabled={!prompt.trim() || loading || !hasKey}
              className="flex-shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 h-[46px] rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                  <span className="hidden sm:inline">Generate</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
