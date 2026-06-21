"use client"

import { useRef, useState } from "react"
import { getVideoCapabilities } from "@/lib/provider-capabilities"

// Re-export for backwards compat
export const VIDEO_MODELS = getVideoCapabilities("google").models
export const VIDEO_ASPECT_RATIOS = ["16:9", "9:16"]

const EXAMPLE_PROMPTS = [
  "A drone shot over a misty mountain forest at sunrise, golden light breaking through the trees",
  "A close-up of rain drops hitting a puddle in slow motion, city lights reflected in the water",
  "A tiny robot tending to a glowing mushroom garden on a miniature planet, stop-motion style",
  "Two astronauts floating in space, Earth visible below, sharing a meal in zero gravity",
]

type Status = "idle" | "submitting" | "polling" | "done" | "error"

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? "w-4 h-4"}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 11-8 8z" />
    </svg>
  )
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    </svg>
  )
}

interface VideoTesterProps {
  apiKey?: string
  model?: string
  aspectRatio?: string
  providerId?: string
}

export default function VideoTester({
  apiKey = "",
  model,
  aspectRatio = "16:9",
  providerId = "google",
}: VideoTesterProps) {
  const [prompt, setPrompt] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [videoBase64, setVideoBase64] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [pollCount, setPollCount] = useState(0)
  const [operationName, setOperationName] = useState<string | null>(null)
  const [rawResponse, setRawResponse] = useState<object | null>(null)
  const [inspectorTab, setInspectorTab] = useState<"request" | "response">("response")

  const pollInterval = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef<number>(0)

  const hasKey = !!apiKey.trim()
  const isRunning = status === "submitting" || status === "polling"

  const { models: supportedModels, aspectRatios: supportedAspectRatios } = getVideoCapabilities(providerId)
  const isSupported = supportedModels.length > 0

  const activeModelId = model && supportedModels.find((m) => m.id === model)
    ? model
    : supportedModels[0]?.id ?? ""
  const currentModel = supportedModels.find((m) => m.id === activeModelId)

  function stopPolling() {
    if (pollInterval.current) { clearTimeout(pollInterval.current); pollInterval.current = null }
  }

  async function pollStatus(opName: string) {
    setPollCount((c) => c + 1)
    try {
      const params = new URLSearchParams({ operation: opName })
      if (apiKey.trim()) params.set("apiKey", apiKey.trim())
      const res = await fetch(`/api/video?${params.toString()}`)
      const data = await res.json()
      setRawResponse(data)
      if (data.error) {
        setError(data.error); setStatus("error"); setElapsedMs(Date.now() - startTimeRef.current); stopPolling(); return
      }
      if (data.done) {
        setElapsedMs(Date.now() - startTimeRef.current)
        if (data.videoBase64) { setVideoBase64(data.videoBase64); setStatus("done") }
        else { setError("Video completed but no video data returned."); setStatus("error") }
        stopPolling()
      } else {
        pollInterval.current = setTimeout(() => pollStatus(opName), 10000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Polling failed")
      setStatus("error"); setElapsedMs(Date.now() - startTimeRef.current); stopPolling()
    }
  }

  async function generateVideo() {
    const text = prompt.trim()
    if (!text || isRunning || !hasKey || !isSupported) return
    stopPolling()
    setStatus("submitting")
    setError(null); setVideoBase64(null); setPollCount(0); setOperationName(null); setRawResponse(null)
    startTimeRef.current = Date.now()

    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, model: activeModelId, aspectRatio, apiKey: apiKey.trim(), providerId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? `HTTP ${res.status}`); setStatus("error")
        setElapsedMs(Date.now() - startTimeRef.current); return
      }
      setOperationName(data.operationName)
      setStatus("polling")
      pollInterval.current = setTimeout(() => pollStatus(data.operationName), 10000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed")
      setStatus("error"); setElapsedMs(Date.now() - startTimeRef.current)
    }
  }

  function downloadVideo() {
    if (!videoBase64) return
    const a = document.createElement("a")
    a.href = `data:video/mp4;base64,${videoBase64}`
    a.download = `generated-video-${Date.now()}.mp4`
    a.click()
  }

  function reset() {
    stopPolling()
    setStatus("idle"); setError(null); setVideoBase64(null); setPollCount(0)
    setOperationName(null); setRawResponse(null); setElapsedMs(null)
  }

  const requestJson = JSON.stringify({
    model: activeModelId,
    prompt: prompt || "(prompt here)",
    aspectRatio,
    providerId,
  }, null, 2)

  return (
    <div className="flex h-full bg-background text-foreground font-sans overflow-hidden">

      {/* CENTER */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-1.5 h-1.5 flex-shrink-0 rounded-full ${
              !isSupported ? "bg-yellow-400" :
              isRunning ? "bg-chart-3 animate-pulse" :
              status === "done" ? "bg-green-400" :
              hasKey ? "bg-green-400" : "bg-muted-foreground"
            }`} />
            {isSupported ? (
              <>
                <span className="text-[11px] font-mono text-muted-foreground truncate">{currentModel?.label ?? activeModelId}</span>
                <span className="text-[10px] font-mono text-muted-foreground/60 border border-border rounded px-1.5 py-0.5">{aspectRatio}</span>
                {isRunning && (
                  <span className="text-[10px] font-mono text-primary">
                    {status === "submitting" ? "Submitting..." : `Polling... (${pollCount})`}
                  </span>
                )}
                {elapsedMs !== null && !isRunning && (
                  <span className="text-[10px] font-mono text-muted-foreground/60">{(elapsedMs / 1000).toFixed(1)}s</span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-yellow-400/80">Video generation not supported for this provider</span>
            )}
          </div>
          {(status === "done" || status === "error") && (
            <button onClick={reset} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded hover:bg-secondary">
              Reset
            </button>
          )}
        </div>

        {/* Video area */}
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col items-center justify-center gap-6">

          {/* Not supported */}
          {!isSupported && (
            <div className="flex flex-col items-center gap-4 text-center max-w-sm">
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
                  This provider does not have a video generation API.
                  Switch to <span className="text-foreground font-medium">Gemini (Google)</span> for Veo 3.1 or <span className="text-foreground font-medium">MiniMax (Hailuo)</span> for Hailuo Video.
                </p>
              </div>
            </div>
          )}

          {isSupported && status === "idle" && (
            <div className="flex flex-col items-center gap-4 text-center max-w-lg">
              {!hasKey && (
                <div className="text-[11px] text-yellow-400/80 border border-yellow-400/20 bg-yellow-400/5 px-4 py-2.5 rounded-lg">
                  Enter your API key in the left panel to generate video.
                </div>
              )}
              <div className="w-14 h-14 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground">
                <VideoIcon />
              </div>
              <div>
                <p className="text-foreground font-semibold text-base text-balance">Generate Video with {currentModel?.label ?? "AI"}</p>
                <p className="text-muted-foreground text-sm mt-1 leading-relaxed text-balance">
                  Describe a scene below. Video generation takes 30–120 seconds.
                </p>
              </div>
              {hasKey && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPrompt(p)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-ring transition-colors text-left"
                    >
                      {p.length > 60 ? p.slice(0, 57) + "..." : p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {isRunning && (
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-2 border-border" />
                <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><VideoIcon /></div>
              </div>
              <div>
                <p className="text-foreground font-semibold text-sm">
                  {status === "submitting" ? "Submitting job..." : "Generating your video..."}
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  {status === "polling" ? `Polling every 10s · ${pollCount} check${pollCount !== 1 ? "s" : ""}` : "Sending request..."}
                </p>
              </div>
              {prompt && (
                <div className="max-w-sm px-4 py-3 rounded-xl border border-border bg-card text-xs text-muted-foreground leading-relaxed italic">
                  &ldquo;{prompt}&rdquo;
                </div>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="max-w-lg w-full flex flex-col gap-3">
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4">
                <p className="text-sm font-semibold text-destructive mb-1">Generation failed</p>
                <p className="text-xs text-destructive/80 font-mono leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {status === "done" && videoBase64 && (
            <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
              <video
                src={`data:video/mp4;base64,${videoBase64}`}
                controls autoPlay loop
                className="w-full rounded-xl border border-border bg-black"
                style={{ aspectRatio: aspectRatio === "9:16" ? "9/16" : "16/9", maxHeight: "420px" }}
              />
              <div className="flex items-center gap-3">
                <button onClick={downloadVideo} className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Download MP4
                </button>
                <button onClick={reset} className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
                  Generate Another
                </button>
              </div>
              {elapsedMs && (
                <p className="text-[11px] text-muted-foreground font-mono">
                  Generated in {(elapsedMs / 1000).toFixed(1)}s · {currentModel?.label ?? activeModelId} · {aspectRatio}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Prompt input */}
        {isSupported && (
          <div className="px-5 py-4 border-t border-border bg-card flex-shrink-0">
            <div className="max-w-2xl mx-auto flex flex-col gap-2">
              <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-4 py-3 focus-within:border-ring transition-colors">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generateVideo() } }}
                  placeholder={hasKey ? "Describe the video you want to generate..." : "Enter API key in left panel first..."}
                  rows={2}
                  disabled={isRunning || !hasKey}
                  className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed disabled:opacity-50"
                />
                <button
                  onClick={generateVideo}
                  disabled={isRunning || !prompt.trim() || !hasKey}
                  className="flex-shrink-0 px-4 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 hover:opacity-85 transition-opacity whitespace-nowrap flex items-center gap-1.5"
                >
                  {isRunning ? <><SpinnerIcon className="w-3 h-3" /> Generating</> : "Generate"}
                </button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground font-mono">
                Long-running generation · polls every 10s
              </p>
            </div>
          </div>
        )}
      </main>

      {/* RIGHT — Inspector */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-l border-border bg-card overflow-hidden">
        <div className="flex border-b border-border flex-shrink-0">
          {(["request", "response"] as const).map((tab) => (
            <button key={tab} onClick={() => setInspectorTab(tab)}
              className={`flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-widest capitalize transition-colors ${
                inspectorTab === tab ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
            {inspectorTab === "request"
              ? requestJson
              : rawResponse ? JSON.stringify(rawResponse, null, 2) : "Submit a prompt to see responses here."}
          </pre>
        </div>
        {operationName && (
          <div className="flex-shrink-0 border-t border-border p-3">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Operation</p>
            <p className="text-[9px] font-mono text-muted-foreground break-all leading-relaxed">{operationName}</p>
          </div>
        )}
      </aside>
    </div>
  )
}
