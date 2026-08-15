"use client"

import { useEffect, useRef, useState } from "react"
import CodePreviewTab from "@/components/code-preview-tab"

/**
 * Public-facing single-page dashboard.
 *
 * Shown to every visitor who has NOT logged in as a dev (see app/page.tsx).
 * It intentionally exposes nothing else from the full dashboard — no
 * provider sidebar, no other tabs (Batch, Compare, Keys, Skills, Docs, ...).
 * Just the "Code Preview" chat + live-preview experience, hard-wired to the
 * Miuclaw Gateway.
 *
 * Auth note: the Miuclaw routes (/api/v1/models, /api/v1/chat/completions via
 * /api/manual-test/stream) authenticate with the server-side EXPORT_API_TOKEN
 * env var — they never check a client-supplied key. The apiKey passed to
 * CodePreviewTab below is just a non-empty placeholder so its own "add a key
 * first" UI gate doesn't block the input; it is not sent anywhere meaningful.
 */
export default function PublicCodePreview() {
  const [chatModel, setChatModel] = useState("")
  const [workingModels, setWorkingModels] = useState<Array<{ modelId: string; apiKey: string; latencyMs: number }>>([])

  const lastFetched = useRef(false)

  useEffect(() => {
    let cancelled = false
    const fetchModels = async () => {
      try {
        const res = await fetch("/api/v1/models")
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { data?: Array<{ id: string }> }
        if (cancelled) return
        const models = (data.data ?? []).filter((m) => m.id !== "miuclaw/auto")
        if (models.length === 0) return
        setWorkingModels(models.map((m) => ({ modelId: m.id, apiKey: "", latencyMs: -1 })))
        setChatModel((prev) => prev || models[0].id)
      } catch {
        // Network error — leave empty, CodePreviewTab falls back to "miuclaw/auto"
      }
    }
    fetchModels()
    lastFetched.current = true
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground font-sans overflow-hidden">
      <CodePreviewTab
        provider="miuclaw"
        providerName="Miuclaw Gateway"
        apiKey="miuclaw-gateway"
        endpoint="https://www.miuclaw.my.id/api/v1/chat/completions"
        headers={{ Authorization: "Bearer {{API_KEY}}", "Content-Type": "application/json" }}
        model={chatModel || "miuclaw/auto"}
        onModelChange={setChatModel}
        workingModels={workingModels}
        presetModels={[{ id: "miuclaw/auto", label: "Auto (fastest key)" }]}
        isMiuclaw
      />
    </div>
  )
}
