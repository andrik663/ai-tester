"use client"

import { useRef, useState } from "react"

const VIDEO_MODELS = [
  { id: "veo-3.1-generate-preview", label: "Veo 3.1 (Latest)", badge: "NEW" },
  { id: "veo-3.1-lite-generate-preview", label: "Veo 3.1 Lite", badge: "FAST" },
]

const ASPECT_RATIOS = ["16:9", "9:16"]

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

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export default function VideoTester() {
  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState(VIDEO_MODELS[0].id)
  const [aspectRatio, setAspectRatio] = useState("16:9")
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

  function stopPolling() {
    if (pollInterval.current) {
      clearTimeout(pollInterval.current)
      pollInterval.current = null
    }
  }

  async function pollStatus(opName: string) {
    setPollCount((c) => c + 1)
    try {
      const res = await fetch(`/api/video?operation=${encodeURIComponent(opName)}`)
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
          setError("Video completed but no video data returned.")
          setStatus("error")
        }
        stopPolling()
      } else {
        // Still processing — poll again in 10 seconds
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
    if (!text || status === "submitting" || status === "polling") return

    stopPolling()
    setStatus("submitting")
    setError(null)
    setVideoBase64(null)
    setPollCount(0)
    setOperationName(null)
    setRawResponse(null)
    startTimeRef.current = Date.now()

    const requestBody = { prompt: text, model, aspectRatio }

    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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
      // Start polling after 10s — video gen takes ~30-90s
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
    a.download = "veo-generated.mp4"
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
  }

  const isRunning = status === "submitting" || status === "polling"

  const requestJson = JSON.stringify({
    endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`,
    body: {
      instances: [{ prompt: prompt || "(prompt here)" }],
      parameters: { aspectRatio, sampleCount: 1 },
    },
  }, null, 2)

  return (
    <div className="flex h-full bg-background text-foreground font-sans overflow-hidden">

      {/* LEFT — Config */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">
        <div className="px-4 py-4 border-b border-border flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <VideoIcon />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground leading-none">Video Gen</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Veo via Gemini API</p>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 flex flex-col gap-5">

          {/* Model selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Model</label>
            <div className="relative">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isRunning}
                className="w-full appearance-none rounded-md border border-border bg-background text-foreground text-xs px-3 py-2 pr-7 font-mono focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                {VIDEO_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                <ChevronDown />
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Veo 3.1 generates 8-second 720p–4K videos with native audio.
            </p>
          </div>

          {/* Aspect ratio */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Aspect Ratio</label>
            <div className="flex gap-2">
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  disabled={isRunning}
                  className={`flex-1 py-1.5 rounded-md border text-xs font-mono transition-colors disabled:opacity-50 ${
                    aspectRatio === r
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Status card */}
          <div className="rounded-md border border-border bg-background p-3 flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</p>
            <div className="flex items-center gap-2">
              {isRunning && <SpinnerIcon className="w-3 h-3 text-primary" />}
              <span className={`text-xs font-mono font-semibold ${
                status === "done" ? "text-chart-2" :
                status === "error" ? "text-destructive" :
                isRunning ? "text-primary" :
                "text-muted-foreground"
              }`}>
                {status === "idle" && "Ready"}
                {status === "submitting" && "Submitting..."}
                {status === "polling" && `Generating... (${pollCount} poll${pollCount !== 1 ? "s" : ""})`}
                {status === "done" && "Done"}
                {status === "error" && "Error"}
              </span>
            </div>
            {elapsedMs !== null && (
              <p className="text-[10px] text-muted-foreground font-mono">{(elapsedMs / 1000).toFixed(1)}s total</p>
            )}
            {operationName && (
              <p className="text-[9px] text-muted-foreground font-mono break-all leading-relaxed">{operationName}</p>
            )}
          </div>

          {/* Capability notes */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Veo 3.1 Capabilities</p>
            <ul className="flex flex-col gap-1">
              {["8-second 720p / 1080p / 4K output", "Natively synchronized audio", "Landscape & portrait modes", "Cinematic realism & animation"].map((c) => (
                <li key={c} className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-relaxed">
                  <span className="text-primary mt-0.5 flex-shrink-0">·</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="px-4 pb-4">
          <p className="text-[9px] text-muted-foreground font-mono break-all leading-relaxed">
            POST generativelanguage.googleapis.com/v1beta
          </p>
        </div>
      </aside>

      {/* CENTER — Generator */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-chart-3 animate-pulse" : status === "done" ? "bg-chart-2" : "bg-muted-foreground"}`} />
            <span className="text-xs font-mono text-muted-foreground">{model}</span>
            <span className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">{aspectRatio}</span>
          </div>
          {(status === "done" || status === "error") && (
            <button
              onClick={reset}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-secondary"
            >
              Reset
            </button>
          )}
        </div>

        {/* Video area */}
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col items-center justify-center gap-6">

          {/* Empty state */}
          {status === "idle" && (
            <div className="flex flex-col items-center gap-4 text-center max-w-lg">
              <div className="w-16 h-16 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground">
                <VideoIcon />
              </div>
              <div>
                <p className="text-foreground font-semibold text-base text-balance">Generate Video with Veo 3.1</p>
                <p className="text-muted-foreground text-sm mt-1 leading-relaxed text-balance">
                  Describe a scene below. Video generation takes 30–90 seconds.
                </p>
              </div>
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
            </div>
          )}

          {/* Loading state */}
          {isRunning && (
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-2 border-border" />
                <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <VideoIcon />
                </div>
              </div>
              <div>
                <p className="text-foreground font-semibold text-sm">
                  {status === "submitting" ? "Submitting job..." : "Generating your video..."}
                </p>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  {status === "polling"
                    ? `Polling every 10s · ${pollCount} check${pollCount !== 1 ? "s" : ""} so far`
                    : "Sending request to Gemini API"}
                </p>
              </div>
              {prompt && (
                <div className="max-w-sm px-4 py-3 rounded-xl border border-border bg-card text-xs text-muted-foreground leading-relaxed text-center italic">
                  &ldquo;{prompt}&rdquo;
                </div>
              )}
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div className="max-w-lg w-full flex flex-col gap-3">
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4">
                <p className="text-sm font-semibold text-destructive mb-1">Generation failed</p>
                <p className="text-xs text-destructive/80 font-mono leading-relaxed">{error}</p>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Note: Veo 3.1 requires a paid Gemini API tier. Free keys will return a 403 error.
              </p>
            </div>
          )}

          {/* Done — video player */}
          {status === "done" && videoBase64 && (
            <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
              <video
                src={`data:video/mp4;base64,${videoBase64}`}
                controls
                autoPlay
                loop
                className="w-full rounded-xl border border-border bg-black"
                style={{ aspectRatio: aspectRatio === "9:16" ? "9/16" : "16/9", maxHeight: "420px" }}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadVideo}
                  className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium"
                >
                  <DownloadIcon />
                  Download MP4
                </button>
                <button
                  onClick={reset}
                  className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  Generate Another
                </button>
              </div>
              {elapsedMs && (
                <p className="text-[11px] text-muted-foreground font-mono">
                  Generated in {(elapsedMs / 1000).toFixed(1)}s · {model} · {aspectRatio}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Prompt input */}
        <div className="px-5 py-4 border-t border-border bg-card flex-shrink-0">
          <div className="max-w-2xl mx-auto flex flex-col gap-2">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-4 py-3 focus-within:border-ring transition-colors">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    generateVideo()
                  }
                }}
                placeholder="Describe the video you want to generate... (Enter to submit)"
                rows={2}
                disabled={isRunning}
                className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed disabled:opacity-50"
              />
              <button
                onClick={generateVideo}
                disabled={isRunning || !prompt.trim()}
                aria-label="Generate video"
                className="flex-shrink-0 px-4 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 hover:opacity-85 transition-opacity whitespace-nowrap flex items-center gap-1.5"
              >
                {isRunning ? <><SpinnerIcon className="w-3 h-3" /> Generating</> : "Generate"}
              </button>
            </div>
            <p className="text-center text-[10px] text-muted-foreground font-mono">
              predictLongRunning · polls every 10s until done
            </p>
          </div>
        </div>
      </main>

      {/* RIGHT — Inspector */}
      <aside className="w-72 flex-shrink-0 flex flex-col border-l border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Inspector</p>
        </div>

        <div className="flex border-b border-border flex-shrink-0">
          {(["request", "response"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setInspectorTab(tab)}
              className={`flex-1 py-2.5 text-[11px] font-medium capitalize transition-colors ${
                inspectorTab === tab
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <pre className="text-[10px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
            {inspectorTab === "request"
              ? requestJson
              : rawResponse
                ? JSON.stringify(rawResponse, null, 2)
                : "(no response yet)"}
          </pre>
        </div>

        {/* cURL preview */}
        {inspectorTab === "request" && (
          <div className="border-t border-border p-3 flex-shrink-0">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Equivalent cURL</p>
            <pre className="text-[9px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
{`curl "${`https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`}" \\
  -H 'Content-Type: application/json' \\
  -H 'x-goog-api-key: YOUR_KEY' \\
  -X POST \\
  -d '{"instances":[{"prompt":"${(prompt || "...").slice(0, 40)}"}],"parameters":{"aspectRatio":"${aspectRatio}"}}'`}
            </pre>
          </div>
        )}
      </aside>
    </div>
  )
}
