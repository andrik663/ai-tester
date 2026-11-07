"use client"

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  ExternalLink,
  GripHorizontal,
  KeyRound,
  Layers,
  Maximize2,
  Minimize2,
  Move,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Terminal,
  Workflow,
  X,
  Zap,
} from "lucide-react"
import { loadWorkingKeys, type WorkingKeyRecord } from "@/lib/working-keys-store"
import ProviderLogo from "@/components/provider-logo"
import ProviderBatchTest from "@/components/provider-batch-test"
import MultiKeyBatch from "@/components/multi-key-batch"
import WorkingKeysPanel from "@/components/working-keys-panel"

export interface StudioProviderItem {
  id: string
  name: string
  country: string
  endpoint: string
  createKeyUrl?: string
  docsUrl?: string
  method?: string
}

type VirtualDrawerKind =
  | null
  | "single-batch"
  | "multi-batch"
  | "working-keys"
  | "playground"
  | "snippets"

interface VirtualN8nCanvasProps {
  providers: StudioProviderItem[]
  selectedProviderId: string
  selectedProviderName: string
  apiKey: string
  onApiKeyChange: (val: string) => void
  workingModelsCount: number
  workingKeysTick: number
  onSelectProviderById: (providerId: string) => void
  onOpenClassicTab: (
    tab: "unified" | "working-keys" | "multi-batch" | "skills" | "saved" | "leaderboard",
    subTab?: "chat" | "code" | "compare" | "vision" | "ocr" | "image-gen" | "video-gen",
  ) => void
  onSwitchToClassic: () => void
  onTriggerGatewaySync: () => void
}

interface CanvasNodePos {
  x: number
  y: number
}

type NodeMap = Record<string, CanvasNodePos>

const DEFAULT_POSITIONS: NodeMap = {
  "prov-google": { x: 44, y: 56 },
  "prov-openai": { x: 44, y: 174 },
  "prov-anthropic": { x: 44, y: 292 },
  "prov-deepseek": { x: 44, y: 410 },
  "prov-groq": { x: 44, y: 528 },
  "core-validator": { x: 374, y: 138 },
  "core-router": { x: 374, y: 372 },
  "out-playground": { x: 742, y: 76 },
  "out-opencode": { x: 742, y: 230 },
  "out-9router": { x: 742, y: 384 },
  "out-endpoint": { x: 742, y: 528 },
}

const DEFAULT_UPSTREAM_IDS = ["google", "openai", "anthropic", "deepseek", "groq"]

const NODE_COLORS: Record<string, string> = {
  google: "#3b82f6",
  openai: "#10b981",
  anthropic: "#d97757",
  deepseek: "#4d6bfe",
  groq: "#f55036",
  xai: "#e4e4e7",
  meta: "#0668E1",
  mistral: "#ff7000",
  openrouter: "#6366f1",
  cloudflare: "#f38020",
  nvidia: "#76b900",
  qwen: "#615ced",
  default: "#22d3ee",
}

// Output node custom vector icons for professional visual hierarchy
function OutputNodeBadgeIcon({ id }: { id: string }) {
  switch (id) {
    case "out-playground":
      return (
        <span className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 shrink-0">
          <Bot className="size-4" />
        </span>
      )
    case "out-opencode":
      return (
        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 shrink-0">
          <Terminal className="size-4" />
        </span>
      )
    case "out-9router":
      return (
        <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/35 text-violet-300 shrink-0">
          <Workflow className="size-4" />
        </span>
      )
    default:
      return (
        <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-300 shrink-0">
          <Code2 className="size-4" />
        </span>
      )
  }
}

export default function VirtualN8nCanvas({
  providers,
  selectedProviderId,
  selectedProviderName,
  apiKey,
  onApiKeyChange,
  workingModelsCount,
  workingKeysTick,
  onSelectProviderById,
  onTriggerGatewaySync,
}: VirtualN8nCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [positions, setPositions] = useState<NodeMap>(DEFAULT_POSITIONS)
  const [upstreamIds, setUpstreamIds] = useState<string[]>(DEFAULT_UPSTREAM_IDS)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState<number>(1)

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  })

  const [activeNodeId, setActiveNodeId] = useState<string>("prov-google")
  const [paletteSearch, setPaletteSearch] = useState("")
  const [paletteOpen, setPaletteOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [virtualDrawer, setVirtualDrawer] = useState<VirtualDrawerKind>(null)

  const [localKeys, setLocalKeys] = useState<WorkingKeyRecord[]>([])
  const [gatewayModels, setGatewayModels] = useState<Array<{ id: string; owned_by?: string }>>([])
  const [avgLatencyMs, setAvgLatencyMs] = useState<number>(38)
  const [successRate, setSuccessRate] = useState<number>(99.8)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  // Quick Chat & Virtual Playground state
  const [quickChatPrompt, setQuickChatPrompt] = useState("")
  const [quickChatReply, setQuickChatReply] = useState<string | null>(null)
  const [quickChatMeta, setQuickChatMeta] = useState<{ status?: number; durationMs?: number } | null>(null)
  const [quickChatBusy, setQuickChatBusy] = useState(false)
  const [selectedGatewayModel, setSelectedGatewayModel] = useState<string>("")
  const [playgroundHistory, setPlaygroundHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string; ts: string; meta?: string }>
  >([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [snippetTab, setSnippetTab] = useState<"curl" | "js" | "python" | "opencode">("curl")

  useEffect(() => {
    try {
      const savedPos = localStorage.getItem("msaku_n8n_positions_v1")
      if (savedPos) {
        const parsed = JSON.parse(savedPos)
        setPositions((prev) => ({ ...prev, ...parsed }))
      }
      const savedUp = localStorage.getItem("msaku_n8n_upstream_v1")
      if (savedUp) {
        const parsedUp = JSON.parse(savedUp)
        if (Array.isArray(parsedUp) && parsedUp.length > 0) setUpstreamIds(parsedUp)
      }
    } catch {}
  }, [])

  const savePositions = useCallback((next: NodeMap) => {
    try {
      localStorage.setItem("msaku_n8n_positions_v1", JSON.stringify(next))
    } catch {}
  }, [])

  const refreshState = useCallback(async () => {
    try {
      const records = loadWorkingKeys()
      setLocalKeys(records)

      const storedMsk =
        typeof window !== "undefined" ? localStorage.getItem("msaku_gateway_user_api_key")?.trim() : ""

      const [statusRes, modelsRes] = await Promise.all([
        fetch("/api/status", { cache: "no-store" }).catch(() => null),
        fetch("/api/v1/models", {
          cache: "no-store",
          headers: storedMsk ? { Authorization: `Bearer ${storedMsk}` } : undefined,
        }).catch(() => null),
      ])

      if (statusRes && statusRes.ok) {
        const sData = await statusRes.json()
        if (sData?.totals) {
          setAvgLatencyMs(sData.totals.avgLatencyMs || 38)
          setSuccessRate(sData.totals.successRate ?? 99.8)
        }
      }

      if (modelsRes && modelsRes.ok) {
        const mData = await modelsRes.json()
        const list = Array.isArray(mData?.data)
          ? mData.data.filter((m: { id: string }) => m.id !== "msaku/auto" && m.id !== "miuclaw/auto")
          : []
        setGatewayModels(list)
        if (list.length > 0) {
          setSelectedGatewayModel((prev) => prev || list[0].id)
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    void refreshState()
  }, [refreshState, workingKeysTick])

  const startNodeDrag = (
    nodeId: string,
    clientX: number,
    clientY: number,
    e: React.MouseEvent | React.TouchEvent,
  ) => {
    e.stopPropagation()
    const pos = positions[nodeId] || { x: 60, y: 60 }
    setDraggingNodeId(nodeId)
    setActiveNodeId(nodeId)
    setInspectorOpen(true)
    dragOffsetRef.current = {
      x: clientX / zoom - pos.x,
      y: clientY / zoom - pos.y,
    }
    if (nodeId.startsWith("prov-")) {
      const pid = nodeId.replace("prov-", "")
      onSelectProviderById(pid)
    } else if (nodeId === "core-router") {
      onSelectProviderById("msaku")
    }
  }

  useEffect(() => {
    if (!draggingNodeId && !isPanning) return

    const handleMove = (clientX: number, clientY: number) => {
      if (draggingNodeId) {
        const nextX = Math.max(12, Math.round((clientX / zoom - dragOffsetRef.current.x) / 8) * 8)
        const nextY = Math.max(12, Math.round((clientY / zoom - dragOffsetRef.current.y) / 8) * 8)
        setPositions((prev) => {
          const updated = { ...prev, [draggingNodeId]: { x: nextX, y: nextY } }
          savePositions(updated)
          return updated
        })
      } else if (isPanning) {
        const dx = clientX - panStartRef.current.x
        const dy = clientY - panStartRef.current.y
        setPan({
          x: panStartRef.current.panX + dx,
          y: panStartRef.current.panY + dy,
        })
      }
    }

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onEnd = () => {
      setDraggingNodeId(null)
      setIsPanning(false)
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onEnd)
    window.addEventListener("touchmove", onTouchMove)
    window.addEventListener("touchend", onEnd)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onEnd)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onEnd)
    }
  }, [draggingNodeId, isPanning, zoom, savePositions])

  const addProviderNodeToCanvas = (providerId: string, dropX?: number, dropY?: number) => {
    const nodeKey = `prov-${providerId}`
    if (!upstreamIds.includes(providerId)) {
      const nextUp = [...upstreamIds, providerId]
      setUpstreamIds(nextUp)
      try {
        localStorage.setItem("msaku_n8n_upstream_v1", JSON.stringify(nextUp))
      } catch {}
    }
    setPositions((prev) => {
      if (prev[nodeKey] && dropX === undefined) return prev
      const nextPos = {
        x: dropX !== undefined ? Math.max(20, Math.round(dropX / 8) * 8) : 44,
        y:
          dropY !== undefined
            ? Math.max(20, Math.round(dropY / 8) * 8)
            : 56 + upstreamIds.length * 116,
      }
      const updated = { ...prev, [nodeKey]: nextPos }
      savePositions(updated)
      return updated
    })
    onSelectProviderById(providerId)
    setActiveNodeId(nodeKey)
    setInspectorOpen(true)
  }

  const removeProviderNodeFromCanvas = (providerId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (upstreamIds.length <= 1) return
    const nextUp = upstreamIds.filter((id) => id !== providerId)
    setUpstreamIds(nextUp)
    try {
      localStorage.setItem("msaku_n8n_upstream_v1", JSON.stringify(nextUp))
    } catch {}
    if (activeNodeId === `prov-${providerId}`) {
      setActiveNodeId("core-router")
    }
  }

  const resetCanvasLayout = () => {
    setPositions(DEFAULT_POSITIONS)
    setUpstreamIds(DEFAULT_UPSTREAM_IDS)
    setPan({ x: 0, y: 0 })
    setZoom(1)
    try {
      localStorage.removeItem("msaku_n8n_positions_v1")
      localStorage.removeItem("msaku_n8n_upstream_v1")
    } catch {}
  }

  const handleDirectSync = async () => {
    if (syncing) return
    const records = loadWorkingKeys()
    if (records.length === 0) {
      setSyncMsg("Belum ada working key tersimpan. Klik 'Batch Test Key' dulu untuk menguji key.")
      return
    }
    setSyncing(true)
    setSyncMsg(null)
    try {
      const groupedMap = new Map<
        string,
        { providerId: string; providerName: string; apiKey: string; modelIds: string[]; latencies: number[] }
      >()
      for (const rec of records) {
        const k = `${rec.providerId}::${rec.apiKey}`
        const ex = groupedMap.get(k)
        if (ex) {
          if (!ex.modelIds.includes(rec.modelId)) {
            ex.modelIds.push(rec.modelId)
            ex.latencies.push(rec.latencyMs)
          }
        } else {
          groupedMap.set(k, {
            providerId: rec.providerId,
            providerName: rec.providerName,
            apiKey: rec.apiKey,
            modelIds: [rec.modelId],
            latencies: [rec.latencyMs],
          })
        }
      }
      const payload = Array.from(groupedMap.values()).map((g) => ({
        providerId: g.providerId,
        providerName: g.providerName,
        apiKey: g.apiKey,
        modelIds: g.modelIds,
        avgLatencyMs: g.latencies.reduce((a, b) => a + b, 0) / g.latencies.length,
        pushedAt: Date.now(),
      }))

      const storedMsk = localStorage.getItem("msaku_gateway_user_api_key")?.trim() || ""
      const res = await fetch("/api/v1/gateway/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(storedMsk ? { Authorization: `Bearer ${storedMsk}` } : {}),
        },
        body: JSON.stringify({
          keys: payload,
          chunkIndex: 0,
          totalChunks: 1,
          allApiKeys: payload.map((p) => p.apiKey),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setSyncMsg(data.error || `Gagal sync (HTTP ${res.status})`)
      } else {
        setSyncMsg(`✓ ${data.models ?? payload.length} model aktif di Gateway`)
        onTriggerGatewaySync()
        await refreshState()
      }
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Gagal sync")
    } finally {
      setSyncing(false)
    }
  }

  const handleQuickChat = async (fromPlaygroundModal = false) => {
    const promptText = quickChatPrompt.trim()
    if (!promptText || quickChatBusy) return
    setQuickChatBusy(true)
    setQuickChatReply(null)
    setQuickChatMeta(null)

    const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    if (fromPlaygroundModal) {
      setPlaygroundHistory((prev) => [...prev, { role: "user", content: promptText, ts }])
      setQuickChatPrompt("")
    }

    try {
      const selectedProv = providers.find((p) => p.id === selectedProviderId)
      const isMsaku = selectedProviderId === "msaku"
      const savedForProv = localKeys.filter((k) => k.providerId === selectedProviderId)
      const effectiveKey = apiKey.trim() || savedForProv[0]?.apiKey || ""
      const effectiveModel = isMsaku
        ? selectedGatewayModel || gatewayModels[0]?.id || undefined
        : savedForProv[0]?.modelId || undefined

      const res = await fetch("/api/manual-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProviderId,
          apiKey: effectiveKey,
          endpoint: selectedProv?.endpoint || "https://gateway.msaku.id/api/v1/chat/completions",
          method: "POST",
          headers: { Authorization: `Bearer {{API_KEY}}`, "Content-Type": "application/json" },
          prompt: promptText,
          model: effectiveModel,
        }),
      })
      const data = await res.json()
      const replyText =
        data.chatReply || (data.ok ? data.responseBody : `HTTP ${data.status}: ${data.statusText || "Gagal"}`)
      setQuickChatReply(replyText)
      setQuickChatMeta({ status: data.status, durationMs: data.durationMs })

      if (fromPlaygroundModal) {
        setPlaygroundHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content: replyText || "(Respons kosong)",
            ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
            meta: `HTTP ${data.status} • ${data.durationMs ?? 0}ms`,
          },
        ])
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request gagal"
      setQuickChatReply(msg)
      if (fromPlaygroundModal) {
        setPlaygroundHistory((prev) => [...prev, { role: "assistant", content: `Error: ${msg}`, ts }])
      }
    } finally {
      setQuickChatBusy(false)
    }
  }

  const copyText = (txt: string, id: string) => {
    navigator.clipboard
      .writeText(txt)
      .then(() => {
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 1600)
      })
      .catch(() => {})
  }

  const filteredProviders = useMemo(() => {
    const q = paletteSearch.trim().toLowerCase()
    if (!q) return providers
    return providers.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
  }, [providers, paletteSearch])

  const step1Done = Boolean(apiKey.trim()) || localKeys.length > 0
  const step2Done = localKeys.length > 0
  const step3Done = gatewayModels.length > 0
  const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 4

  const buildCurve = (fromId: string, toId: string, fromW = 232, fromH = 84, toH = 84) => {
    const a = positions[fromId] || { x: 44, y: 60 }
    const b = positions[toId] || { x: 374, y: 200 }
    const x1 = a.x + fromW
    const y1 = a.y + fromH / 2
    const x2 = b.x
    const y2 = b.y + toH / 2
    const cx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
  }

  // Read the stored msk_ key in an effect (never during render) so SSR and
  // client HTML match.
  const [storedMskSample, setStoredMskSample] = useState("msk_API_KEY_ANDA")
  useEffect(() => {
    try {
      const stored = localStorage.getItem("msaku_gateway_user_api_key")?.trim()
      if (stored) setStoredMskSample(stored)
    } catch {}
  }, [])

  const selectedProvObj = providers.find((p) => p.id === selectedProviderId)
  const activeSavedModelsForProv = localKeys.filter((k) => k.providerId === selectedProviderId)
  const targetModelForSnippet =
    selectedProviderId === "msaku"
      ? selectedGatewayModel || gatewayModels[0]?.id || "MODEL_ID"
      : activeSavedModelsForProv[0]?.modelId || "MODEL_ID"
  const targetEndpointForSnippet =
    selectedProviderId === "msaku"
      ? "https://gateway.msaku.id/api/v1/chat/completions"
      : selectedProvObj?.endpoint || "https://gateway.msaku.id/api/v1/chat/completions"
  const targetKeyForSnippet =
    selectedProviderId === "msaku" ? storedMskSample : apiKey.trim() || "YOUR_API_KEY"

  const snippetText = useMemo(() => {
    if (snippetTab === "curl") {
      return `curl -X POST "${targetEndpointForSnippet}" \\
  -H "Authorization: Bearer ${targetKeyForSnippet}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${targetModelForSnippet}",
    "messages": [{"role": "user", "content": "Halo! Tes koneksi API."}],
    "max_tokens": 512
  }'`
    }
    if (snippetTab === "js") {
      return `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://gateway.msaku.id/api/v1",
  apiKey: "${storedMskSample}",
});

const response = await client.chat.completions.create({
  model: "${gatewayModels[0]?.id || targetModelForSnippet}",
  messages: [{ role: "user", content: "Halo dari Msaku Gateway!" }],
});

console.log(response.choices[0]?.message?.content);`
    }
    if (snippetTab === "python") {
      return `from openai import OpenAI

client = OpenAI(
    base_url="https://gateway.msaku.id/api/v1",
    api_key="${storedMskSample}",
)

res = client.chat.completions.create(
    model="${gatewayModels[0]?.id || targetModelForSnippet}",
    messages=[{"role": "user", "content": "Halo dari Msaku Gateway!"}],
)
print(res.choices[0].message.content)`
    }
    return JSON.stringify(
      {
        $schema: "https://opencode.ai/config.json",
        provider: {
          msaku: {
            npm: "@ai-sdk/openai-compatible",
            name: "Msaku AI Gateway",
            options: {
              baseURL: "https://gateway.msaku.id/api/v1",
              apiKey: storedMskSample,
            },
            models: Object.fromEntries(
              (gatewayModels.length > 0 ? gatewayModels.slice(0, 8) : [{ id: targetModelForSnippet }]).map((m) => [
                m.id,
                { name: m.id },
              ]),
            ),
          },
        },
      },
      null,
      2,
    )
  }, [snippetTab, targetEndpointForSnippet, targetKeyForSnippet, targetModelForSnippet, storedMskSample, gatewayModels])

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-[#060c16] text-slate-100 select-none overflow-hidden relative">
      {/* Step-by-Step Pill Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 bg-[#081120] px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            {
              step: 1,
              label: "1. Pilih / Drag Provider",
              done: step1Done,
              onClick: () => {
                setPaletteOpen(true)
                setActiveNodeId(`prov-${upstreamIds[0] || "google"}`)
                setInspectorOpen(true)
                setVirtualDrawer(null)
              },
            },
            {
              step: 2,
              label: `2. Uji Key (${localKeys.length})`,
              done: step2Done,
              onClick: () => {
                setActiveNodeId("core-validator")
                setInspectorOpen(true)
                setVirtualDrawer("multi-batch")
              },
            },
            {
              step: 3,
              label: `3. Sync Gateway (${gatewayModels.length})`,
              done: step3Done,
              onClick: () => {
                setActiveNodeId("core-router")
                setInspectorOpen(true)
                setVirtualDrawer(null)
              },
            },
            {
              step: 4,
              label: "4. Chat / Connect Agent",
              done: step3Done,
              onClick: () => {
                setActiveNodeId("out-playground")
                setInspectorOpen(true)
                setVirtualDrawer("playground")
              },
            },
          ].map((item, idx) => {
            const isCurrent = currentStep === item.step
            return (
              <React.Fragment key={item.step}>
                <button
                  type="button"
                  onClick={item.onClick}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    isCurrent
                      ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                      : item.done
                        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/60"
                        : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {item.done ? (
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                  ) : (
                    <span className="flex size-4 items-center justify-center rounded-full bg-slate-800 font-mono text-[10px] text-cyan-300">
                      {item.step}
                    </span>
                  )}
                  <span>{item.label}</span>
                </button>
                {idx < 3 && <ChevronRight className="size-3.5 text-slate-600 hidden sm:inline" />}
              </React.Fragment>
            )
          })}
        </div>

        {/* Right Quick Tools in Virtual Bar */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setVirtualDrawer((d) => (d === "multi-batch" ? null : "multi-batch"))}
            className={`inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold transition-colors ${
              virtualDrawer === "multi-batch"
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Play className="size-3 text-emerald-400" />
            <span>Batch Validator</span>
          </button>
          <button
            type="button"
            onClick={() => setVirtualDrawer((d) => (d === "working-keys" ? null : "working-keys"))}
            className={`inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold transition-colors ${
              virtualDrawer === "working-keys"
                ? "border-amber-400 bg-amber-500/20 text-amber-200"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <KeyRound className="size-3 text-amber-400" />
            <span>Working Keys ({localKeys.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setVirtualDrawer((d) => (d === "playground" ? null : "playground"))}
            className={`inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold transition-colors ${
              virtualDrawer === "playground"
                ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Bot className="size-3 text-cyan-400" />
            <span className="hidden sm:inline">Playground</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5 hidden sm:block" />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.1).toFixed(2)))}
            className="h-7 rounded-md border border-slate-800 bg-slate-900 px-2 font-mono text-[11px] text-slate-300 hover:bg-slate-800"
            title="Zoom Out"
          >
            -
          </button>
          <span className="font-mono text-[10px] text-slate-400 w-9 text-center">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.25, +(z + 0.1).toFixed(2)))}
            className="h-7 rounded-md border border-slate-800 bg-slate-900 px-2 font-mono text-[11px] text-slate-300 hover:bg-slate-800"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={resetCanvasLayout}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-2 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Reset posisi node"
          >
            <RotateCcw className="size-3" />
            <span className="hidden md:inline">Reset</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        {/* LEFT: Provider Node Palette with Real Brand Logos */}
        <aside
          className={`flex flex-col border-r border-slate-800/90 bg-[#070e1b] transition-all duration-150 shrink-0 ${
            paletteOpen ? "w-60 sm:w-64" : "w-10"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 px-2.5 py-2">
            {paletteOpen && (
              <div className="flex items-center gap-1.5">
                <Layers className="size-3.5 text-cyan-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                  Node Provider ({providers.length})
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setPaletteOpen((v) => !v)}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              title={paletteOpen ? "Sembunyikan Palette" : "Buka Palette Node"}
            >
              {paletteOpen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
          </div>

          {paletteOpen && (
            <>
              <div className="p-2 border-b border-slate-800/60">
                <div className="relative">
                  <Search className="size-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={paletteSearch}
                    onChange={(e) => setPaletteSearch(e.target.value)}
                    placeholder={`Cari dari ${providers.length} provider...`}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/60 focus:outline-none"
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Drag ke kanvas atau klik +</span>
                  <span className="font-mono text-cyan-400">{upstreamIds.length} aktif</span>
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredProviders.map((p) => {
                  const inCanvas = upstreamIds.includes(p.id)
                  const savedCount = localKeys.filter((k) => k.providerId === p.id).length
                  const isSelected = selectedProviderId === p.id
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/msaku-provider", p.id)
                      }}
                      onClick={() => addProviderNodeToCanvas(p.id)}
                      className={`group flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs cursor-grab active:cursor-grabbing transition-all ${
                        isSelected
                          ? "border-cyan-500/70 bg-cyan-500/15 text-white shadow-sm"
                          : inCanvas
                            ? "border-slate-800 bg-slate-900/90 text-slate-200 hover:border-slate-700"
                            : "border-transparent bg-slate-900/40 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripHorizontal className="size-3 text-slate-600 group-hover:text-cyan-400 shrink-0" />
                        <ProviderLogo providerId={p.id} providerName={p.name} className="w-5 h-5" />
                        <span className="truncate font-medium">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {p.country && (
                          <span className="font-mono text-[9px] uppercase text-slate-500 hidden sm:inline">
                            {p.country}
                          </span>
                        )}
                        {savedCount > 0 && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
                            {savedCount}
                          </span>
                        )}
                        {inCanvas ? (
                          <span className="size-2 rounded-full bg-cyan-400" title="Ada di kanvas" />
                        ) : (
                          <Plus className="size-3 text-slate-500 group-hover:text-cyan-300" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </aside>

        {/* CENTER: Dot-Grid Drag & Drop Canvas */}
        <div
          ref={containerRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const pid = e.dataTransfer.getData("text/msaku-provider")
            if (!pid || !containerRef.current) return
            const rect = containerRef.current.getBoundingClientRect()
            const dropX = (e.clientX - rect.left - pan.x) / zoom - 110
            const dropY = (e.clientY - rect.top - pan.y) / zoom - 40
            addProviderNodeToCanvas(pid, dropX, dropY)
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg === "true") {
              setIsPanning(true)
              panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
            }
          }}
          data-canvas-bg="true"
          className="relative flex-1 min-w-0 overflow-hidden cursor-grab active:cursor-grabbing"
          style={{
            backgroundColor: "#060c16",
            backgroundImage: `
              radial-gradient(circle at 50% 45%, rgba(6, 182, 212, 0.10) 0%, rgba(16, 185, 129, 0.04) 40%, transparent 75%),
              radial-gradient(rgba(148, 163, 184, 0.18) 1px, transparent 1px)
            `,
            backgroundSize: "100% 100%, 22px 22px",
            backgroundPosition: `0 0, ${pan.x}px ${pan.y}px`,
          }}
        >
          <div className="pointer-events-none absolute top-3 left-4 right-4 z-10 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-slate-500">
            <span className="rounded bg-slate-950/80 px-2 py-0.5 border border-slate-800/80 text-cyan-400">
              1. UPSTREAM PROVIDER NODES
            </span>
            <span className="rounded bg-slate-950/80 px-2 py-0.5 border border-slate-800/80 text-emerald-400">
              2. MSAKU VIRTUAL CORE
            </span>
            <span className="rounded bg-slate-950/80 px-2 py-0.5 border border-slate-800/80 text-violet-400">
              3. CLIENT &amp; PLAYGROUND NODES
            </span>
          </div>

          <div
            data-canvas-bg="true"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              width: "1080px",
              height: "660px",
            }}
            className="relative"
          >
            {/* SVG Bezier Connections */}
            <svg className="pointer-events-none absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
              <defs>
                <linearGradient id="n8nWireLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.85" />
                </linearGradient>
                <linearGradient id="n8nWireRight" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.85" />
                </linearGradient>
              </defs>

              {upstreamIds.map((pid, idx) => {
                const fromId = `prov-${pid}`
                const d1 = buildCurve(fromId, "core-validator", 232, 84, 112)
                const d2 = buildCurve(fromId, "core-router", 232, 84, 132)
                const color = NODE_COLORS[pid] || NODE_COLORS.default
                const isSelected = activeNodeId === fromId || selectedProviderId === pid
                return (
                  <g key={fromId}>
                    <path
                      d={d1}
                      fill="none"
                      stroke={isSelected ? color : "#1e293b"}
                      strokeWidth={isSelected ? "2.2" : "1.5"}
                    />
                    <path
                      d={d2}
                      fill="none"
                      stroke="url(#n8nWireLeft)"
                      strokeWidth={isSelected ? "2.2" : "1.5"}
                      strokeDasharray="6 5"
                    >
                      <animate attributeName="stroke-dashoffset" from="22" to="0" dur="1.3s" repeatCount="indefinite" />
                    </path>
                    <circle r="3.5" fill={color}>
                      <animateMotion dur={`${2 + (idx % 3) * 0.4}s`} repeatCount="indefinite" path={d2} />
                    </circle>
                  </g>
                )
              })}

              {(() => {
                const v = positions["core-validator"] || { x: 374, y: 138 }
                const r = positions["core-router"] || { x: 374, y: 372 }
                const x1 = v.x + 128
                const y1 = v.y + 112
                const x2 = r.x + 128
                const y2 = r.y
                const d = `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`
                return (
                  <g>
                    <path d={d} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="5 5">
                      <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1s" repeatCount="indefinite" />
                    </path>
                    <circle r="4" fill="#10b981">
                      <animateMotion dur="1.5s" repeatCount="indefinite" path={d} />
                    </circle>
                  </g>
                )
              })()}

              {["out-playground", "out-opencode", "out-9router", "out-endpoint"].map((outId, idx) => {
                const d = buildCurve("core-router", outId, 256, 132, 82)
                return (
                  <g key={outId}>
                    <path d={d} fill="none" stroke="#1e293b" strokeWidth="2" />
                    <path d={d} fill="none" stroke="url(#n8nWireRight)" strokeWidth="2" strokeDasharray="6 5">
                      <animate attributeName="stroke-dashoffset" from="22" to="0" dur="1.1s" repeatCount="indefinite" />
                    </path>
                    <circle r="3.8" fill={idx === 0 ? "#06b6d4" : idx === 1 ? "#10b981" : "#8b5cf6"}>
                      <animateMotion dur={`${1.8 + idx * 0.3}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  </g>
                )
              })}
            </svg>

            {/* Upstream Provider Nodes with Real Brand Logos */}
            {upstreamIds.map((pid, idx) => {
              const nodeId = `prov-${pid}`
              const pos = positions[nodeId] || { x: 44, y: 56 + idx * 118 }
              const prov = providers.find((p) => p.id === pid) || {
                id: pid,
                name: pid.toUpperCase(),
                country: "AI",
                endpoint: "",
              }
              const savedForProv = localKeys.filter((k) => k.providerId === pid)
              const accent = NODE_COLORS[pid] || NODE_COLORS.default
              const isSelected = activeNodeId === nodeId || selectedProviderId === pid

              return (
                <div
                  key={nodeId}
                  style={{ left: pos.x, top: pos.y, width: 232 }}
                  onMouseDown={(e) => startNodeDrag(nodeId, e.clientX, e.clientY, e)}
                  onTouchStart={(e) => {
                    if (e.touches[0]) startNodeDrag(nodeId, e.touches[0].clientX, e.touches[0].clientY, e)
                  }}
                  className={`absolute rounded-xl border bg-[#0b1526]/95 p-3 shadow-lg backdrop-blur-md transition-all cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? "border-cyan-400 shadow-[0_0_22px_rgba(6,182,212,0.25)]"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r" style={{ backgroundColor: accent }} />
                  <div
                    className="absolute -right-2 top-1/2 -translate-y-1/2 size-3.5 rounded-full border-2 border-slate-950"
                    style={{ backgroundColor: accent }}
                  />

                  <div className="flex items-center justify-between gap-2 pl-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <ProviderLogo providerId={pid} providerName={prov.name} className="w-6 h-6" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate leading-tight">{prov.name}</p>
                        <p className="text-[9px] font-mono text-slate-400 truncate">
                          {prov.country || "GLOBAL"} • {pid}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[9px] border ${
                          savedForProv.length > 0
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-slate-900 text-slate-400 border-slate-800"
                        }`}
                      >
                        {savedForProv.length > 0 ? `${savedForProv.length} key` : "Ready"}
                      </span>
                      {upstreamIds.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => removeProviderNodeFromCanvas(pid, e)}
                          className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                          title="Hapus node dari kanvas"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between pl-1.5 pt-1.5 border-t border-slate-800/70 text-[10px] text-slate-400">
                    <span className="font-mono truncate">
                      {savedForProv.length > 0 ? `✓ ${savedForProv[0].latencyMs}ms aktif` : "Klik untuk isi / uji Key"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectProviderById(pid)
                        setActiveNodeId(nodeId)
                        setInspectorOpen(true)
                      }}
                      className="text-cyan-300 hover:text-cyan-200 font-semibold"
                    >
                      Atur →
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Core Node: Batch Validator */}
            {(() => {
              const nodeId = "core-validator"
              const pos = positions[nodeId] || { x: 374, y: 138 }
              const isSelected = activeNodeId === nodeId
              return (
                <div
                  style={{ left: pos.x, top: pos.y, width: 256 }}
                  onMouseDown={(e) => startNodeDrag(nodeId, e.clientX, e.clientY, e)}
                  onTouchStart={(e) => {
                    if (e.touches[0]) startNodeDrag(nodeId, e.touches[0].clientX, e.touches[0].clientY, e)
                  }}
                  className={`absolute rounded-2xl border bg-[#09192c]/95 p-3.5 shadow-xl backdrop-blur-md cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? "border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.22)]"
                      : "border-emerald-500/40 hover:border-emerald-400/70"
                  }`}
                >
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 size-3.5 rounded-full bg-emerald-400 border-2 border-slate-950" />

                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-300 border border-emerald-500/30">
                      <Zap className="size-2.5" /> STEP 2 • VALIDATOR
                    </span>
                    <span className="font-mono text-[10px] text-emerald-300 font-bold">{localKeys.length} Lolos</span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shrink-0">
                      <Play className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-white leading-tight">Multi-Key Batch &amp; Screener</p>
                      <p className="text-[10px] text-slate-400 truncate">Uji semua model tanpa keluar kanvas</p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveNodeId(nodeId)
                        setVirtualDrawer("multi-batch")
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-2.5 py-1.5 text-[10px] font-bold text-emerald-200 transition-colors"
                    >
                      <Play className="size-2.5" /> Buka Batch Test
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveNodeId(nodeId)
                        setVirtualDrawer("single-batch")
                      }}
                      className="inline-flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 px-2 py-1.5 text-[10px] font-semibold text-slate-200 transition-colors"
                      title="Uji semua model untuk provider aktif"
                    >
                      1-Key
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Core Node: Msaku Virtual Router Core with Official Brand Mark */}
            {(() => {
              const nodeId = "core-router"
              const pos = positions[nodeId] || { x: 374, y: 372 }
              const isSelected = activeNodeId === nodeId
              return (
                <div
                  style={{ left: pos.x, top: pos.y, width: 256 }}
                  onMouseDown={(e) => startNodeDrag(nodeId, e.clientX, e.clientY, e)}
                  onTouchStart={(e) => {
                    if (e.touches[0]) startNodeDrag(nodeId, e.touches[0].clientX, e.touches[0].clientY, e)
                  }}
                  className={`absolute rounded-2xl border-2 bg-[#08172b]/95 p-3.5 shadow-2xl backdrop-blur-md cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? "border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.3)]"
                      : "border-cyan-500/60 hover:border-cyan-400"
                  }`}
                >
                  <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 size-4 rounded-full bg-cyan-400 border-2 border-white" />
                  <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 size-4 rounded-full bg-emerald-400 border-2 border-white" />

                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan-200 border border-cyan-400/40">
                      <Cpu className="size-2.5" /> VIRTUAL NODE CORE
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400 font-bold">{avgLatencyMs}ms</span>
                  </div>

                  <div className="mt-2 flex items-center gap-2.5">
                    <ProviderLogo providerId="msaku" providerName="Msaku Gateway" className="w-7 h-7" />
                    <div>
                      <p className="text-sm font-extrabold tracking-tight text-white leading-tight">MSAKU AI GATEWAY</p>
                      <p className="text-[10px] font-mono text-cyan-300/90">gateway.msaku.id/api/v1</p>
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setVirtualDrawer("working-keys")
                      }}
                      className="rounded-lg border border-sky-500/30 bg-sky-950/40 hover:bg-sky-900/50 py-1 transition-colors"
                    >
                      <p className="text-[8px] font-bold uppercase text-sky-300">LOCAL KEYS</p>
                      <p className="font-mono text-xs font-bold text-emerald-300">{localKeys.length}</p>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setVirtualDrawer("playground")
                      }}
                      className="rounded-lg border border-amber-500/30 bg-amber-950/40 hover:bg-amber-900/50 py-1 transition-colors"
                    >
                      <p className="text-[8px] font-bold uppercase text-amber-300">IN GATEWAY</p>
                      <p className="font-mono text-xs font-bold text-amber-300">{gatewayModels.length}</p>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDirectSync()
                    }}
                    disabled={syncing}
                    className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:opacity-95 disabled:opacity-50 transition-opacity"
                  >
                    <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Syncing..." : "Sync Keys ke Gateway"}
                  </button>
                </div>
              )
            })()}

            {/* Output & Client Nodes */}
            {[
              {
                id: "out-playground",
                title: "Chat & Vision Playground",
                sub: "Uji model langsung di sini",
                badge: `${workingModelsCount || gatewayModels.length} Model`,
                color: "#06b6d4",
                drawer: "playground" as VirtualDrawerKind,
              },
              {
                id: "out-opencode",
                title: "Opencode & Claude Code",
                sub: "AI Coding Agent CLI",
                badge: "1-Click Config",
                color: "#10b981",
                drawer: "snippets" as VirtualDrawerKind,
              },
              {
                id: "out-9router",
                title: "9Router & Cursor IDE",
                sub: "OpenAI-Compatible Mesh",
                badge: "120 RPM Tier",
                color: "#8b5cf6",
                drawer: "snippets" as VirtualDrawerKind,
              },
              {
                id: "out-endpoint",
                title: "Unified API Endpoint",
                sub: "POST /api/v1/chat/completions",
                badge: `${successRate}% Online`,
                color: "#f59e0b",
                drawer: "snippets" as VirtualDrawerKind,
              },
            ].map((node) => {
              const pos = positions[node.id] || { x: 742, y: 76 }
              const isSelected = activeNodeId === node.id
              return (
                <div
                  key={node.id}
                  style={{ left: pos.x, top: pos.y, width: 244 }}
                  onMouseDown={(e) => startNodeDrag(node.id, e.clientX, e.clientY, e)}
                  onTouchStart={(e) => {
                    if (e.touches[0]) startNodeDrag(node.id, e.touches[0].clientX, e.touches[0].clientY, e)
                  }}
                  className={`absolute rounded-xl border bg-[#0b1526]/95 p-3 shadow-lg backdrop-blur-md cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? "border-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.25)]"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div
                    className="absolute -left-2 top-1/2 -translate-y-1/2 size-3.5 rounded-full border-2 border-slate-950"
                    style={{ backgroundColor: node.color }}
                  />
                  <div
                    className="absolute right-0 top-2.5 bottom-2.5 w-1 rounded-l"
                    style={{ backgroundColor: node.color }}
                  />

                  <div className="flex items-center justify-between gap-2 pr-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <OutputNodeBadgeIcon id={node.id} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate leading-tight">{node.title}</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate">{node.sub}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between pr-1.5 pt-1.5 border-t border-slate-800/70 text-[10px]">
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300 border border-slate-800">
                      {node.badge}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveNodeId(node.id)
                        setInspectorOpen(true)
                        if (node.id === "out-opencode") setSnippetTab("opencode")
                        setVirtualDrawer(node.drawer)
                      }}
                      className="text-emerald-300 hover:text-emerald-200 font-semibold"
                    >
                      Buka Panel →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* VIRTUAL IN-CANVAS DRAWER MODAL (Stays 100% in Virtual Mode!) */}
          {virtualDrawer && (
            <div
              className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col w-full max-w-4xl h-[86%] rounded-2xl border border-cyan-500/40 bg-[#081120] shadow-[0_0_50px_rgba(0,0,0,0.75)] overflow-hidden">
                {/* Modal Top Bar */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-[#060c16] px-4 py-3 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ProviderLogo
                      providerId={
                        virtualDrawer === "single-batch"
                          ? selectedProviderId
                          : virtualDrawer === "playground"
                            ? selectedProviderId
                            : "msaku"
                      }
                      providerName={selectedProviderName}
                      className="w-6 h-6"
                    />
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                        {virtualDrawer === "single-batch" && `Batch Test Semua Model — ${selectedProviderName}`}
                        {virtualDrawer === "multi-batch" && "Multi-Key Batch Validator & Screener (Virtual Mode)"}
                        {virtualDrawer === "working-keys" && `Working Keys & Sync Gateway (${localKeys.length} Tersimpan)`}
                        {virtualDrawer === "playground" && `Virtual Chat Playground — ${selectedProviderName}`}
                        {virtualDrawer === "snippets" && "Integrasi Endpoint, cURL, SDK & Opencode Config"}
                      </h3>
                      <p className="text-[10px] text-slate-400 truncate">
                        Berjalan langsung di Mode Virtual tanpa pindah ke tampilan Klasik
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {(["single-batch", "multi-batch", "working-keys", "playground", "snippets"] as const).map((tabId) => {
                      const labels: Record<string, string> = {
                        "single-batch": "1-Key Batch",
                        "multi-batch": "Multi-Key",
                        "working-keys": "Saved Keys",
                        playground: "Chat",
                        snippets: "Code/API",
                      }
                      return (
                        <button
                          key={tabId}
                          type="button"
                          onClick={() => setVirtualDrawer(tabId)}
                          className={`hidden md:inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                            virtualDrawer === tabId
                              ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
                              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          }`}
                        >
                          {labels[tabId]}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setVirtualDrawer(null)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-200 transition-colors"
                    >
                      <X className="size-3.5" /> Tutup
                    </button>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                  {virtualDrawer === "single-batch" && (
                    <div className="max-w-2xl mx-auto space-y-4">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ProviderLogo
                              providerId={selectedProviderId}
                              providerName={selectedProviderName}
                              className="w-5 h-5"
                            />
                            <span className="text-xs font-bold text-white">
                              API Key untuk {selectedProviderName}
                            </span>
                          </div>
                          {selectedProvObj?.createKeyUrl && (
                            <a
                              href={selectedProvObj.createKeyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-cyan-400 hover:underline inline-flex items-center gap-1"
                            >
                              Buat Key Baru <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => onApiKeyChange(e.target.value)}
                          placeholder={`Tempel API key ${selectedProviderName}...`}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                        />
                        <p className="text-[11px] text-slate-400">
                          Klik tombol <strong>Test All Models</strong> di bawah untuk menguji seluruh model{" "}
                          {selectedProviderName}. Model yang lolos otomatis tersimpan ke Working Keys.
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
                        <ProviderBatchTest
                          providerId={selectedProviderId}
                          providerName={selectedProviderName}
                          apiKey={apiKey}
                          customEndpoint={
                            (selectedProviderId === "custom" || selectedProviderId.startsWith("custom:"))
                              ? providers.find((p) => p.id === selectedProviderId)?.endpoint || undefined
                              : undefined
                          }
                          onSaved={() => {
                            onTriggerGatewaySync()
                            void refreshState()
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {virtualDrawer === "multi-batch" && (
                    <div className="h-full min-h-[420px] rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden flex">
                      <MultiKeyBatch
                        onKeysSaved={() => {
                          onTriggerGatewaySync()
                          void refreshState()
                          setVirtualDrawer("working-keys")
                        }}
                      />
                    </div>
                  )}

                  {virtualDrawer === "working-keys" && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                      <WorkingKeysPanel
                        refreshTick={workingKeysTick}
                        onUseKey={(k) => {
                          onApiKeyChange(k)
                          setVirtualDrawer("playground")
                        }}
                        onGatewaySync={() => {
                          onTriggerGatewaySync()
                          void refreshState()
                        }}
                      />
                    </div>
                  )}

                  {virtualDrawer === "playground" && (
                    <div className="flex flex-col h-full max-w-3xl mx-auto gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="flex items-center gap-2">
                          <ProviderLogo
                            providerId={selectedProviderId}
                            providerName={selectedProviderName}
                            className="w-5 h-5"
                          />
                          <select
                            value={selectedProviderId}
                            onChange={(e) => onSelectProviderById(e.target.value)}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
                          >
                            {providers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.country || "AI"})
                              </option>
                            ))}
                          </select>

                          {selectedProviderId === "msaku" && gatewayModels.length > 0 && (
                            <select
                              value={selectedGatewayModel}
                              onChange={(e) => setSelectedGatewayModel(e.target.value)}
                              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-cyan-300 focus:border-cyan-400 focus:outline-none max-w-[240px]"
                            >
                              {gatewayModels.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.id}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {selectedProviderId !== "msaku" && (
                          <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => onApiKeyChange(e.target.value)}
                            placeholder={`API Key ${selectedProviderName}...`}
                            className="flex-1 min-w-[200px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                          />
                        )}
                      </div>

                      <div className="flex-1 min-h-[260px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                        {playgroundHistory.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-center py-10 gap-2">
                            <ProviderLogo
                              providerId={selectedProviderId}
                              providerName={selectedProviderName}
                              className="w-10 h-10"
                            />
                            <p className="text-sm font-bold text-white">
                              Uji Chat Langsung — {selectedProviderName}
                            </p>
                            <p className="text-xs text-slate-400 max-w-md">
                              Ketik pesan di bawah untuk mengetes respons model secara real-time langsung dari kanvas
                              Virtual.
                            </p>
                            <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                              {[
                                "Halo! Sebutkan model apa kamu dalam 1 kalimat.",
                                "Buatkan fungsi debounce singkat di TypeScript.",
                                "Jelaskan keunggulan AI Gateway dalam 3 poin.",
                              ].map((sample) => (
                                <button
                                  key={sample}
                                  type="button"
                                  onClick={() => setQuickChatPrompt(sample)}
                                  className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200"
                                >
                                  {sample}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          playgroundHistory.map((item, i) => (
                            <div
                              key={i}
                              className={`flex flex-col gap-1 ${item.role === "user" ? "items-end" : "items-start"}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                                  item.role === "user"
                                    ? "bg-cyan-500 text-slate-950 font-medium"
                                    : "border border-slate-800 bg-slate-900 text-slate-100"
                                }`}
                              >
                                <pre className="whitespace-pre-wrap font-sans">{item.content}</pre>
                              </div>
                              <span className="text-[10px] font-mono text-slate-500 px-1">
                                {item.role === "user" ? "Anda" : selectedProviderName} • {item.ts}{" "}
                                {item.meta ? `• ${item.meta}` : ""}
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={quickChatPrompt}
                          onChange={(e) => setQuickChatPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleQuickChat(true)
                          }}
                          placeholder="Ketik pesan uji coba (Enter untuk kirim)..."
                          className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => void handleQuickChat(true)}
                          disabled={quickChatBusy || !quickChatPrompt.trim()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:opacity-95 disabled:opacity-40"
                        >
                          <Send className="size-3.5" />
                          {quickChatBusy ? "Mengirim..." : "Kirim"}
                        </button>
                      </div>
                    </div>
                  )}

                  {virtualDrawer === "snippets" && (
                    <div className="max-w-3xl mx-auto space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {(
                            [
                              { id: "curl", label: "cURL" },
                              { id: "js", label: "Node.js / OpenAI SDK" },
                              { id: "python", label: "Python SDK" },
                              { id: "opencode", label: "Opencode / 9Router JSON" },
                            ] as const
                          ).map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSnippetTab(t.id)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                snippetTab === t.id
                                  ? "bg-cyan-500 text-slate-950"
                                  : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => copyText(snippetText, "modal-snippet")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
                        >
                          {copiedId === "modal-snippet" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                          {copiedId === "modal-snippet" ? "Tersalin!" : "Salin Kode"}
                        </button>
                      </div>

                      <pre className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-cyan-200 overflow-x-auto leading-relaxed">
                        {snippetText}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Node Inspector (All buttons stay in Virtual Mode!) */}
        {inspectorOpen && (
          <aside className="w-80 border-l border-slate-800/90 bg-[#070e1b] flex flex-col shrink-0 z-20">
            <div className="flex items-center justify-between border-b border-slate-800/80 px-3.5 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <ProviderLogo
                  providerId={
                    activeNodeId.startsWith("prov-")
                      ? activeNodeId.replace("prov-", "")
                      : "msaku"
                  }
                  providerName={selectedProviderName}
                  className="w-5 h-5"
                />
                <span className="text-xs font-bold text-white truncate">
                  {activeNodeId.startsWith("prov-")
                    ? `Node: ${selectedProviderName}`
                    : activeNodeId === "core-validator"
                      ? "Node: Batch Validator"
                      : activeNodeId === "core-router"
                        ? "Node: Msaku Virtual Core"
                        : "Node: Output & Integrasi"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectorOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
              {activeNodeId.startsWith("prov-") && (
                <>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-200">API Key {selectedProviderName}</span>
                      {selectedProvObj?.createKeyUrl && (
                        <a
                          href={selectedProvObj.createKeyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-semibold text-cyan-400 hover:underline inline-flex items-center gap-1"
                        >
                          Dapatkan Key <ExternalLink className="size-2.5" />
                        </a>
                      )}
                    </div>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => onApiKeyChange(e.target.value)}
                      placeholder={`Tempel API key ${selectedProviderName}...`}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                    {selectedProvObj?.endpoint && (
                      <div className="rounded-lg border border-slate-800/90 bg-slate-950/90 px-2.5 py-1.5">
                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                          <span className="text-emerald-400 font-bold">{selectedProvObj.method || "POST"}</span>
                          <button
                            type="button"
                            onClick={() => copyText(selectedProvObj.endpoint, "prov-ep")}
                            className="text-cyan-400 hover:underline"
                          >
                            {copiedId === "prov-ep" ? "Tersalin" : "Copy URL"}
                          </button>
                        </div>
                        <p className="font-mono text-[10px] text-slate-300 truncate mt-0.5">
                          {selectedProvObj.endpoint}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setVirtualDrawer("single-batch")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-2 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/30 transition-colors"
                      >
                        <Play className="size-3" /> Batch Test Key
                      </button>
                      <button
                        type="button"
                        onClick={() => setVirtualDrawer("playground")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-2 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/30 transition-colors"
                      >
                        <Bot className="size-3" /> Full Playground
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-300">Uji Cepat dari Kanvas</span>
                      {quickChatMeta?.status && (
                        <span className="font-mono text-[10px] text-emerald-400">
                          HTTP {quickChatMeta.status} • {quickChatMeta.durationMs}ms
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={quickChatPrompt}
                        onChange={(e) => setQuickChatPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleQuickChat(false)
                        }}
                        placeholder="Ketik pesan tes singkat..."
                        className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleQuickChat(false)}
                        disabled={quickChatBusy || !quickChatPrompt.trim()}
                        className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
                      >
                        <Send className="size-3" />
                      </button>
                    </div>
                    {quickChatReply && (
                      <pre className="max-h-36 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-[11px] text-slate-200 whitespace-pre-wrap">
                        {quickChatReply}
                      </pre>
                    )}
                  </div>
                </>
              )}

              {(activeNodeId === "core-validator" || activeNodeId === "core-router") && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Working Keys Tersimpan:</span>
                      <span className="font-mono font-bold text-emerald-400">{localKeys.length} model</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Tersinkron di Gateway:</span>
                      <span className="font-mono font-bold text-amber-300">{gatewayModels.length} model</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleDirectSync()}
                      disabled={syncing}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:opacity-95 disabled:opacity-50"
                    >
                      <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
                      {syncing ? "Menyinkronkan..." : "Sync Working Keys Sekarang"}
                    </button>

                    {syncMsg && (
                      <p className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-[11px] text-cyan-300">
                        {syncMsg}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVirtualDrawer("multi-batch")}
                      className="rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 p-2.5 text-left transition-colors"
                    >
                      <p className="text-[11px] font-bold text-emerald-300">Multi-Key Batch</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Uji banyak key sekaligus</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVirtualDrawer("working-keys")}
                      className="rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 p-2.5 text-left transition-colors"
                    >
                      <p className="text-[11px] font-bold text-amber-300">Kelola Keys &amp; Logs</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Lihat daftar key &amp; sync</p>
                    </button>
                  </div>
                </div>
              )}

              {activeNodeId.startsWith("out-") && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white">Endpoint Unified Gateway</span>
                      <button
                        type="button"
                        onClick={() => copyText("https://gateway.msaku.id/api/v1/chat/completions", "ep")}
                        className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] text-cyan-300 hover:bg-slate-700"
                      >
                        {copiedId === "ep" ? <Check className="size-3" /> : <Copy className="size-3" />}
                        {copiedId === "ep" ? "Disalin" : "Salin URL"}
                      </button>
                    </div>
                    <code className="block rounded-lg border border-slate-800 bg-slate-950 p-2 font-mono text-[10px] text-cyan-300 break-all">
                      https://gateway.msaku.id/api/v1/chat/completions
                    </code>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white">Config Opencode / 9Router</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            JSON.stringify(
                              {
                                baseURL: "https://gateway.msaku.id/api/v1",
                                apiKey: storedMskSample,
                                model: gatewayModels[0]?.id || "MODEL_ID",
                              },
                              null,
                              2,
                            ),
                            "cfg",
                          )
                        }
                        className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-slate-700"
                      >
                        {copiedId === "cfg" ? <Check className="size-3" /> : <Copy className="size-3" />}
                        {copiedId === "cfg" ? "Disalin" : "Copy JSON"}
                      </button>
                    </div>
                    <pre className="rounded-lg border border-slate-800 bg-slate-950 p-2 font-mono text-[10px] text-slate-300 overflow-x-auto">
{`{
  "baseURL": "https://gateway.msaku.id/api/v1",
  "apiKey": "${storedMskSample.slice(0, 12)}...",
  "model": "${gatewayModels[0]?.id || "pilih-dari-models"}"
}`}
                    </pre>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProviderById("msaku")
                        setVirtualDrawer("playground")
                      }}
                      className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 p-2.5 text-center text-[11px] font-bold text-cyan-200"
                    >
                      Buka Chat Studio
                    </button>
                    <button
                      type="button"
                      onClick={() => setVirtualDrawer("snippets")}
                      className="rounded-lg bg-violet-500/20 border border-violet-500/40 hover:bg-violet-500/30 p-2.5 text-center text-[11px] font-bold text-violet-200"
                    >
                      Lihat Semua Snippet
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
