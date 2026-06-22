"use client"

import { useRef, useState } from "react"
import { getVideoCapabilities } from "@/lib/provider-capabilities"

export const VIDEO_MODELS = getVideoCapabilities("google").models
export const VIDEO_ASPECT_RATIOS = ["16:9", "9:16"]

const EXAMPLE_PROMPTS = [
  "A drone shot over a misty mountain forest at sunrise, golden light breaking through",
  "Rain drops hitting a puddle in slow motion, city lights reflected in the water",
  "A tiny robot tending to a glowing mushroom garden on a miniature planet",
  "Two astronauts floating in space, Earth visible below, sharing a meal",
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
  const [showInspector, setShowInspector] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<"request" | "response">("response")

  const pollInterval = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef<number>(0)

  const hasKey = !!apiKey.trim()
  const isRunning = status === "submitting" || status === "polling"

  const { models: supportedModels } = getVideoCapabilities(providerId)
  const isSupported = supportedModels.length > 0

  const activeModelId =
    model && supportedModels.find((m) => m.id === model)
      ? model
      : supportedModels[0]?.id ?? ""
  const currentModel = supportedModels.find((m) => m.id === activeModelId)

  function stopPolling() {
    if (pollInterval.current) {
      clearTimeout(pollInterval.current)
      pollInterval.current = null
    }
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
        setError(data.error)
        setStatus("error")
        setElapsedMs(Date.now() - startTimeRef.current)
        stopPolling()
        return
      }
      if (data.done) {
        setElapsedMs(Date.now() - startTimeRef.current)
        if (data.videoBase64) {
          setVideoBase64(data.videoBase64)
          setStatus("done")
        } else {
          setError("Video completed but no data returned.")
          setStatus("error")
        }
        stopPolling()
      } else {
        pollInterval.current = setTimeout(() => pollStatus(opName), 10000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Polling failed")
      setStatus("error")
      setElapsedMs(Date.now() - startTimeRef.current)
      stopPolling()
    }
  }

  async function generateVideo() {
    const text = prompt.trim()
    if (!text || isRunning || !hasKey || !isSupported) return
    stopPolling()
    setStatus("submitting")
    setError(null)
    setVideoBase64(null)
    setPollCount(0)
    setOperationName(null)
    setRawResponse(null)
    startTimeRef.current = Date.now()

    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          model: activeModelId,
          aspectRatio,
          apiKey: apiKey.trim(),
          providerId,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? `HTTP ${res.status}`)
        setStatus("error")
        setElapsedMs(Date.now() - startTimeRef.current)
        return
      }
      setOperationName(data.operationName)
      setStatus("polling")
      pollInterval.current = setTimeout(() => pollStatus(data.operationName), 10000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed")
      setStatus("error")
      setElapsedMs(Date.now() - startTimeRef.current)
    }
  }

  function downloadVideo() {
    if (!videoBase64) return
    const a = document.createElement("a")
    a.href = `data:video/mp4;base64,${videoBase64}`
    a.download = `video-${Date.now()}.mp4`
    a.click()
  }

  function reset() {
    stopPolling()
    setStatus("idle")
    setError(null)
    setVideoBase64(null)
    setPollCount(0)
    setOperationName(null)
    setRawResponse(null)
    setElapsedMs(null)
    setShowInspector(false)
  }

  const requestJson = JSON.stringify(
    { model: activeModelId, prompt: prompt || "(prompt here)", aspectRatio, providerId },
    null, 2
  )

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Status bar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 flex-shrink-0 rounded-full ${
            !isSupported ? "bg-yellow-400" :
            isRunning ? "bg-primary animate-pulse" :
            status === "done" ? "bg-green-400" :
            hasKey ? "bg-green-400" : "bg-muted-foreground/40"
          }`} />
          <span className="text-[11px] font-mono text-muted-foreground truncate">
            {isSupported ? (currentModel?.label ?? activeModelId) : "Not supported"}
          </span>
          {isRunning && (
            <span className="text-[10px] font-mono text-primary hidden sm:inline">
              {status === "submitting" ? "Submitting..." : `Polling... (${pollCount})`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {elapsedMs !== null && !isRunning && (
            <span className="text-[10px] font-mono text-muted-foreground/60">
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
          )}
          {(status === "done" || status === "error") && (
            <button
              onClick={reset}
              className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset
            </button>
          )}
          {rawResponse && (
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
            Switch to <span className="text-foreground">Gemini (Google)</span> for Veo 3.1 or{" "}
            <span className="text-foreground">MiniMax</span> for Hailuo Video.
          </p>
        </div>
      )}

      {/* Main content */}
      {isSupported && (
        <div className="flex-1 min-h-0 overflow-y-auto">

          {/* Idle */}
          {status === "idle" && (
            <div className="flex flex-col items-center justify-center min-h-full gap-5 p-6 text-center">
              {!hasKey && (
                <p className="text-[11px] text-yellow-400/80 border border-yellow-400/20 bg-yellow-400/5 px-4 py-2 rounded-lg">
                  Enter your API key to generate video.
                </p>
              )}
              <div className="w-12 h-12 rounded-2xl border border-border bg-secondary/40 flex items-center justify-center text-muted-foreground">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  Generate Video with {currentModel?.label ?? "AI"}
                </p>
                <p className="text-xs text-muted-foreground text-balance">
                  Describe a scene. Generation takes 30–120 seconds.
                </p>
              </div>
              {hasKey && (
                <div className="flex flex-col gap-2 w-full max-w-sm">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPrompt(p)}
                      className="text-left text-xs px-3 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors leading-relaxed"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Running */}
          {isRunning && (
            <div className="flex flex-col items-center justify-center min-h-full gap-5 p-6 text-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-border" />
                <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {status === "submitting" ? "Submitting job..." : "Generating video..."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {status === "polling"
                    ? `Checking every 10s · ${pollCount} check${pollCount !== 1 ? "s" : ""}`
                    : "Sending request..."}
                </p>
              </div>
              {prompt && (
                <p className="max-w-xs text-xs text-muted-foreground italic px-4 py-3 rounded-xl border border-border bg-secondary/30 leading-relaxed">
                  &ldquo;{prompt}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="p-4">
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-4">
                <p className="text-sm font-semibold text-destructive mb-1">Generation failed</p>
                <p className="text-xs text-destructive/80 font-mono leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Done */}
          {status === "done" && videoBase64 && (
            <div className="p-4 flex flex-col gap-4">
              <video
                src={`data:video/mp4;base64,${videoBase64}`}
                controls
                autoPlay
                loop
                className="w-full rounded-xl border border-border bg-black"
                style={{
                  aspectRatio: aspectRatio === "9:16" ? "9/16" : "16/9",
                  maxHeight: "400px",
                }}
              />
              {elapsedMs && (
                <p className="text-center text-[10px] text-muted-foreground font-mono">
                  {(elapsedMs / 1000).toFixed(1)}s &middot; {currentModel?.label ?? activeModelId} &middot; {aspectRatio}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={downloadVideo}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Download MP4
                </button>
                <button
                  onClick={reset}
                  className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs transition-colors"
                >
                  Generate Another
                </button>
              </div>

              {/* Inspector */}
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
                  <div className="p-3 bg-card">
                    <pre className="text-[9px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto">
                      {inspectorTab === "request"
                        ? requestJson
                        : rawResponse
                        ? JSON.stringify(rawResponse, null, 2)
                        : "No response"}
                    </pre>
                  </div>
                  {operationName && (
                    <div className="border-t border-border p-3 bg-card">
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Operation ID</p>
                      <p className="text-[9px] font-mono text-muted-foreground break-all">{operationName}</p>
                    </div>
                  )}
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
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  generateVideo()
                }
              }}
              placeholder={hasKey ? "Describe the video..." : "Enter API key first..."}
              rows={2}
              disabled={isRunning || !hasKey}
              className="flex-1 resize-none rounded-xl bg-secondary/60 border border-border text-sm text-foreground placeholder:text-muted-foreground px-3 py-2.5 outline-none focus:border-primary/60 transition-colors font-sans leading-relaxed disabled:opacity-50"
            />
            <button
              onClick={generateVideo}
              disabled={isRunning || !prompt.trim() || !hasKey}
              className="flex-shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 h-[46px] rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isRunning ? (
                <SpinnerIcon className="w-4 h-4" />
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
          {isRunning && (
            <p className="text-center text-[10px] text-primary font-mono mt-2">
              {status === "submitting" ? "Submitting..." : `Polling... ${pollCount} check${pollCount !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
