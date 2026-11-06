"use client"

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Cpu,
  ExternalLink,
  GripHorizontal,
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

export interface StudioProviderItem {
  id: string
  name: string
  country: string
  endpoint: string
  createKeyUrl?: string
}

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
  "prov-google": { x: 48, y: 58 },
  "prov-openai": { x: 48, y: 174 },
  "prov-anthropic": { x: 48, y: 290 },
  "prov-deepseek": { x: 48, y: 406 },
  "prov-groq": { x: 48, y: 522 },
  "core-validator": { x: 370, y: 145 },
  "core-router": { x: 370, y: 375 },
  "out-playground": { x: 730, y: 80 },
  "out-opencode": { x: 730, y: 235 },
  "out-9router": { x: 730, y: 390 },
  "out-endpoint": { x: 730, y: 530 },
}

const DEFAULT_UPSTREAM_IDS = ["google", "openai", "anthropic", "deepseek", "groq"]

const NODE_COLORS: Record<string, string> = {
  google: "#3b82f6",
  openai: "#10b981",
  anthropic: "#06b6d4",
  deepseek: "#8b5cf6",
  groq: "#f59e0b",
  default: "#22d3ee",
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
  onOpenClassicTab,
  onSwitchToClassic,
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

  const [localKeys, setLocalKeys] = useState<WorkingKeyRecord[]>([])
  const [gatewayModels, setGatewayModels] = useState<Array<{ id: string; owned_by?: string }>>([])
  const [avgLatencyMs, setAvgLatencyMs] = useState<number>(38)
  const [successRate, setSuccessRate] = useState<number>(99.8)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [quickChatPrompt, setQuickChatPrompt] = useState("")
  const [quickChatReply, setQuickChatReply] = useState<string | null>(null)
  const [quickChatBusy, setQuickChatBusy] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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
      }
    } catch {}
  }, [])

  useEffect(() => {
    void refreshState()
  }, [refreshState, workingKeysTick])

  const startNodeDrag = (nodeId: string, clientX: number, clientY: number, e: React.MouseEvent | React.TouchEvent) => {
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
        x: dropX !== undefined ? Math.max(20, Math.round(dropX / 8) * 8) : 48,
        y:
          dropY !== undefined
            ? Math.max(20, Math.round(dropY / 8) * 8)
            : 58 + upstreamIds.length * 114,
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
      setSyncMsg("Uji key dulu di Langkah 2 (Batch) sebelum Sync.")
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

  const handleQuickChat = async () => {
    if (!quickChatPrompt.trim() || quickChatBusy) return
    setQuickChatBusy(true)
    setQuickChatReply(null)
    try {
      const selectedProv = providers.find((p) => p.id === selectedProviderId)
      const res = await fetch("/api/manual-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProviderId,
          apiKey: apiKey.trim(),
          endpoint: selectedProv?.endpoint || "https://gateway.msaku.id/api/v1/chat/completions",
          method: "POST",
          headers: { Authorization: `Bearer {{API_KEY}}`, "Content-Type": "application/json" },
          prompt: quickChatPrompt.trim(),
        }),
      })
      const data = await res.json()
      setQuickChatReply(
        data.chatReply || (data.ok ? data.responseBody : `HTTP ${data.status}: ${data.statusText || "Gagal"}`),
      )
    } catch (e) {
      setQuickChatReply(e instanceof Error ? e.message : "Request gagal")
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
    if (!q) return providers.slice(0, 45)
    return providers.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
  }, [providers, paletteSearch])

  const step1Done = Boolean(apiKey.trim()) || localKeys.length > 0
  const step2Done = localKeys.length > 0
  const step3Done = gatewayModels.length > 0
  const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 4

  const buildCurve = (fromId: string, toId: string, fromW = 228, fromH = 82, toH = 82) => {
    const a = positions[fromId] || { x: 48, y: 60 }
    const b = positions[toId] || { x: 370, y: 200 }
    const x1 = a.x + fromW
    const y1 = a.y + fromH / 2
    const x2 = b.x
    const y2 = b.y + toH / 2
    const cx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
  }

  // Read the stored msk_ key in an effect (never during render) so SSR and
  // client HTML match — reading localStorage during render causes a
  // hydration mismatch when the visitor already has a key stored.
  const [storedMskSample, setStoredMskSample] = useState("msk_API_KEY_ANDA")
  useEffect(() => {
    try {
      const stored = localStorage.getItem("msaku_gateway_user_api_key")?.trim()
      if (stored) setStoredMskSample(stored)
    } catch {}
  }, [])

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-[#060c16] text-slate-100 select-none overflow-hidden">
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
              },
            },
            {
              step: 2,
              label: `2. Uji Key (${localKeys.length})`,
              done: step2Done,
              onClick: () => {
                setActiveNodeId("core-validator")
                setInspectorOpen(true)
              },
            },
            {
              step: 3,
              label: `3. Sync Gateway (${gatewayModels.length})`,
              done: step3Done,
              onClick: () => {
                setActiveNodeId("core-router")
                setInspectorOpen(true)
              },
            },
            {
              step: 4,
              label: "4. Chat / Connect Agent",
              done: step3Done,
              onClick: () => {
                setActiveNodeId("out-playground")
                setInspectorOpen(true)
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

        <div className="flex items-center gap-1.5">
          <span className="hidden xl:inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/90 px-2 py-1 font-mono text-[10px] text-slate-400">
            <Move className="size-3 text-cyan-400" />
            Geser node bebas • Drag dari panel kiri
          </span>
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
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        {/* LEFT: Provider Node Palette */}
        <aside
          className={`flex flex-col border-r border-slate-800/90 bg-[#070e1b] transition-all duration-150 shrink-0 ${
            paletteOpen ? "w-56 sm:w-60" : "w-10"
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
                    placeholder="Cari provider..."
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
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/msaku-provider", p.id)
                      }}
                      onClick={() => addProviderNodeToCanvas(p.id)}
                      className={`group flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-grab active:cursor-grabbing transition-all ${
                        selectedProviderId === p.id
                          ? "border-cyan-500/60 bg-cyan-500/15 text-white"
                          : inCanvas
                            ? "border-slate-800 bg-slate-900/90 text-slate-200 hover:border-slate-700"
                            : "border-transparent bg-slate-900/40 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripHorizontal className="size-3 text-slate-600 group-hover:text-cyan-400 shrink-0" />
                        <span className="truncate font-medium">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
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
              width: "1060px",
              height: "650px",
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
                const d1 = buildCurve(fromId, "core-validator", 224, 78, 108)
                const d2 = buildCurve(fromId, "core-router", 224, 78, 126)
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
                const v = positions["core-validator"] || { x: 370, y: 145 }
                const r = positions["core-router"] || { x: 370, y: 375 }
                const x1 = v.x + 125
                const y1 = v.y + 108
                const x2 = r.x + 125
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
                const d = buildCurve("core-router", outId, 250, 126, 78)
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

            {/* Upstream Provider Nodes */}
            {upstreamIds.map((pid, idx) => {
              const nodeId = `prov-${pid}`
              const pos = positions[nodeId] || { x: 48, y: 58 + idx * 116 }
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
                  style={{ left: pos.x, top: pos.y, width: 224 }}
                  onMouseDown={(e) => startNodeDrag(nodeId, e.clientX, e.clientY, e)}
                  onTouchStart={(e) => {
                    if (e.touches[0]) startNodeDrag(nodeId, e.touches[0].clientX, e.touches[0].clientY, e)
                  }}
                  className={`absolute rounded-xl border bg-[#0b1526]/95 p-3 shadow-lg backdrop-blur-md transition-shadow cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? "border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.22)]"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r" style={{ backgroundColor: accent }} />
                  <div
                    className="absolute -right-2 top-1/2 -translate-y-1/2 size-3.5 rounded-full border-2 border-slate-950"
                    style={{ backgroundColor: accent }}
                  />

                  <div className="flex items-center justify-between gap-1.5 pl-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                      <span className="text-xs font-bold text-white truncate">{prov.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300 border border-slate-800">
                        {savedForProv.length > 0 ? `${savedForProv.length} key` : prov.country}
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

                  <div className="mt-2 flex items-center justify-between pl-1.5 text-[10px] text-slate-400">
                    <span className="font-mono truncate">
                      {savedForProv.length > 0 ? "Key Tervalidasi" : "Klik untuk isi Key"}
                    </span>
                    <span className="text-cyan-300 font-semibold">Atur →</span>
                  </div>
                </div>
              )
            })}

            {/* Core Node: Batch Validator */}
            {(() => {
              const nodeId = "core-validator"
              const pos = positions[nodeId] || { x: 370, y: 145 }
              const isSelected = activeNodeId === nodeId
              return (
                <div
                  style={{ left: pos.x, top: pos.y, width: 250 }}
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

                  <p className="mt-1.5 text-xs font-extrabold text-white">Multi-Key Batch &amp; Screener</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Filter otomatis model yang hidup &amp; tercepat.</p>

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenClassicTab("multi-batch")
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-2.5 py-1 text-[10px] font-bold text-emerald-200 transition-colors"
                    >
                      <Play className="size-2.5" /> Buka Batch Test
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Core Node: Msaku Virtual Router Core */}
            {(() => {
              const nodeId = "core-router"
              const pos = positions[nodeId] || { x: 370, y: 375 }
              const isSelected = activeNodeId === nodeId
              return (
                <div
                  style={{ left: pos.x, top: pos.y, width: 250 }}
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

                  <p className="mt-1.5 text-sm font-extrabold tracking-tight text-white">MSAKU AI GATEWAY</p>

                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
                    <div className="rounded-lg border border-sky-500/30 bg-sky-950/40 py-1">
                      <p className="text-[8px] font-bold uppercase text-sky-300">LOCAL KEYS</p>
                      <p className="font-mono text-xs font-bold text-emerald-300">{localKeys.length}</p>
                    </div>
                    <div className="rounded-lg border border-amber-500/30 bg-amber-950/40 py-1">
                      <p className="text-[8px] font-bold uppercase text-amber-300">IN GATEWAY</p>
                      <p className="font-mono text-xs font-bold text-amber-300">{gatewayModels.length}</p>
                    </div>
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
                sub: "Uji model langsung",
                badge: `${workingModelsCount || gatewayModels.length} Model`,
                color: "#06b6d4",
              },
              {
                id: "out-opencode",
                title: "Opencode & Claude Code",
                sub: "AI Coding Agent CLI",
                badge: "1-Click Config",
                color: "#10b981",
              },
              {
                id: "out-9router",
                title: "9Router & Cursor IDE",
                sub: "OpenAI-Compatible Mesh",
                badge: "120 RPM Tier",
                color: "#8b5cf6",
              },
              {
                id: "out-endpoint",
                title: "Unified API Endpoint",
                sub: "POST /api/v1/chat/completions",
                badge: `${successRate}% Online`,
                color: "#f59e0b",
              },
            ].map((node) => {
              const pos = positions[node.id] || { x: 730, y: 80 }
              const isSelected = activeNodeId === node.id
              return (
                <div
                  key={node.id}
                  style={{ left: pos.x, top: pos.y, width: 232 }}
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

                  <div className="flex items-center justify-between gap-1 pr-1.5">
                    <span className="text-xs font-bold text-white truncate">{node.title}</span>
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300 border border-slate-800 shrink-0">
                      {node.badge}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between pr-1.5 text-[10px] text-slate-400">
                    <span className="truncate font-mono">{node.sub}</span>
                    <span className="text-emerald-300 font-semibold">Buka →</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: Node Inspector */}
        {inspectorOpen && (
          <aside className="w-80 border-l border-slate-800/90 bg-[#070e1b] flex flex-col shrink-0 z-20">
            <div className="flex items-center justify-between border-b border-slate-800/80 px-3.5 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Workflow className="size-4 text-cyan-400 shrink-0" />
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
                      <span className="text-[11px] font-semibold text-slate-300">API Key {selectedProviderName}</span>
                      {providers.find((p) => p.id === selectedProviderId)?.createKeyUrl && (
                        <a
                          href={providers.find((p) => p.id === selectedProviderId)?.createKeyUrl}
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
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenClassicTab("multi-batch")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-2 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/30 transition-colors"
                      >
                        <Play className="size-3" /> Batch Test Key
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenClassicTab("unified", "chat")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-2 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/30 transition-colors"
                      >
                        <Bot className="size-3" /> Full Playground
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-300">Uji Cepat dari Kanvas</span>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={quickChatPrompt}
                        onChange={(e) => setQuickChatPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleQuickChat()
                        }}
                        placeholder="Ketik pesan tes singkat..."
                        className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleQuickChat()}
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
                      onClick={() => onOpenClassicTab("multi-batch")}
                      className="rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 p-2.5 text-left transition-colors"
                    >
                      <p className="text-[11px] font-bold text-emerald-300">Multi-Key Batch</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Uji banyak key sekaligus</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenClassicTab("working-keys")}
                      className="rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 p-2.5 text-left transition-colors"
                    >
                      <p className="text-[11px] font-bold text-amber-300">Kelola Keys &amp; Logs</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Lihat daftar key &amp; admin</p>
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
                        onOpenClassicTab("unified", "chat")
                      }}
                      className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 p-2.5 text-center text-[11px] font-bold text-cyan-200"
                    >
                      Buka Chat Studio
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenClassicTab("unified", "code")}
                      className="rounded-lg bg-violet-500/20 border border-violet-500/40 hover:bg-violet-500/30 p-2.5 text-center text-[11px] font-bold text-violet-200"
                    >
                      Lihat Semua Snippet
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={onSwitchToClassic}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <Terminal className="size-3.5 text-cyan-400" />
                  Buka Mode Tabel / Klasik Lengkap
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
