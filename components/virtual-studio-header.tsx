"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Cpu, ExternalLink, Gauge, Sparkles, Terminal, Workflow } from "lucide-react"
import { loadWorkingKeys } from "@/lib/working-keys-store"

interface VirtualStudioHeaderProps {
  uiMode: "virtual" | "classic"
  onToggleMode: (mode: "virtual" | "classic") => void
  activeTab: string
  unifiedSubTab: string
  selectedProviderId: string
  selectedProviderName: string
  apiKey: string
  workingModelsCount: number
  workingKeysTick: number
  onSelectProviderById: (providerId: string) => void
  onNavigateTab: (
    tab: "unified" | "working-keys" | "multi-batch" | "skills" | "saved" | "leaderboard",
    subTab?: "chat" | "code" | "compare",
  ) => void
  onOpenProviderDrawer?: () => void
}

export default function VirtualStudioHeader({
  uiMode,
  onToggleMode,
  workingKeysTick,
}: VirtualStudioHeaderProps) {
  const [localKeysCount, setLocalKeysCount] = useState(0)
  const [gatewayModelsCount, setGatewayModelsCount] = useState(0)
  const [avgLatencyMs, setAvgLatencyMs] = useState(38)

  const refreshTelemetry = useCallback(async () => {
    try {
      const records = loadWorkingKeys()
      setLocalKeysCount(records.length)

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
        if (sData?.totals?.avgLatencyMs) setAvgLatencyMs(sData.totals.avgLatencyMs)
      }
      if (modelsRes && modelsRes.ok) {
        const mData = await modelsRes.json()
        const list = Array.isArray(mData?.data)
          ? mData.data.filter((m: { id: string }) => m.id !== "msaku/auto" && m.id !== "miuclaw/auto")
          : []
        setGatewayModelsCount(list.length)
      }
    } catch {}
  }, [])

  useEffect(() => {
    void refreshTelemetry()
  }, [refreshTelemetry, workingKeysTick])

  return (
    <div className="shrink-0 border-b border-slate-800/90 bg-[#060c16] text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-bold tracking-wide uppercase text-white flex items-center gap-1.5">
            <Cpu className="size-3.5 text-cyan-400" />
            Msaku Studio
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
            <Workflow className="size-2.5" />
            N8N VIRTUAL NODE
          </span>
          <a
            href="https://msaku.id/gateway"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/90 px-2 py-0.5 text-[11px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
          >
            Dashboard AI Gateway
            <ExternalLink className="size-2.5" />
          </a>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-[11px]">
            <Gauge className="size-3.5 text-emerald-400" />
            <span className="font-mono font-bold text-emerald-400">{avgLatencyMs}ms</span>
            <span className="text-slate-700">•</span>
            <span className="text-slate-400">Saved:</span>
            <span className="font-mono font-bold text-amber-300">{localKeysCount}</span>
            <span className="text-slate-700">•</span>
            <span className="text-slate-400">Synced:</span>
            <span className="font-mono font-bold text-cyan-300">{gatewayModelsCount}</span>
          </div>

          <div
            role="group"
            aria-label="Pilih mode tampilan Studio"
            className="inline-flex items-center rounded-lg border border-slate-700/80 bg-slate-900 p-0.5"
          >
            <button
              type="button"
              onClick={() => onToggleMode("virtual")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                uiMode === "virtual"
                  ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="size-3" />
              Mode Virtual (Drag &amp; Drop)
            </button>
            <button
              type="button"
              onClick={() => onToggleMode("classic")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                uiMode === "classic"
                  ? "bg-slate-200 text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Terminal className="size-3" />
              Mode Klasik (Pro)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
