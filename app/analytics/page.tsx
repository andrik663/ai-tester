"use client"

/**
 * /analytics — gateway usage analytics.
 *
 * Gated by MsakuUserGate (same msk_ gate as the Studio): only registered
 * Msaku users get in. The API returns the caller's OWN usage for msk_
 * users, and global usage (incl. per-user top list) for admin/atk_.
 */

import { useCallback, useEffect, useState } from "react"
import MsakuUserGate from "@/components/msaku-user-gate"

const STORED_MSK_KEY = "msaku_gateway_user_api_key"

interface AnalyticsBody {
  window: string
  scope: "own" | "global"
  generatedAt: string
  totals: {
    requests: number
    success: number
    failed: number
    successRate: number
    tokens: number
    promptTokens: number
    completionTokens: number
    avgLatencyMs: number
    p95LatencyMs: number
  }
  daily: Array<{ day: string; requests: number; success: number; tokens: number }>
  topProviders: Array<{
    providerId: string
    providerName: string
    requests: number
    tokens: number
    successRate: number
    avgLatencyMs: number
  }>
  topModels: Array<{ model: string; requests: number; tokens: number }>
  sharedSplit: Array<{ shared: boolean; requests: number; tokens: number }>
  topUsers?: Array<{ userId: number | null; requests: number; tokens: number }>
}

const WINDOWS = [
  { key: "24h", label: "24 jam" },
  { key: "7d", label: "7 hari" },
  { key: "30d", label: "30 hari" },
]

function fmt(n: number): string {
  return n.toLocaleString("id-ID")
}

function AnalyticsContent() {
  const [windowKey, setWindowKey] = useState("7d")
  const [data, setData] = useState<AnalyticsBody | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async (w: string) => {
    try {
      const key = localStorage.getItem(STORED_MSK_KEY) || ""
      const res = await fetch(`/api/analytics?window=${w}`, {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat analytics")
    }
  }, [])

  useEffect(() => {
    load(windowKey)
  }, [windowKey, load])

  const maxDaily = Math.max(1, ...(data?.daily.map((d) => d.requests) ?? [0]))

  return (
    <div className="min-h-dvh bg-[#0e0f11] font-sans text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Analytics Gateway</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {data?.scope === "global"
                ? "Pemakaian seluruh gateway (khusus admin)."
                : "Pemakaian kamu sendiri di gateway."}{" "}
              Token dihitung dari log (streaming tidak tercatat tokennya).
            </p>
          </div>
          <a
            href="/"
            className="shrink-0 rounded-md border border-[#222327] bg-[#151619] px-3 py-1.5 text-sm text-zinc-300 hover:bg-[#1c1e21]"
          >
            ← Studio
          </a>
        </header>

        <div className="mb-6 flex gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWindowKey(w.key)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                windowKey === w.key
                  ? "border-zinc-500 bg-[#1c1e21] text-white"
                  : "border-[#222327] bg-[#151619] text-zinc-300 hover:bg-[#1c1e21]"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>

        {!data && !error && (
          <p className="rounded-lg border border-[#222327] bg-[#151619] p-4 text-sm text-zinc-400">
            Memuat analytics…
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            Gagal memuat analytics: {error}
          </p>
        )}

        {data && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Request", value: fmt(data.totals.requests) },
                { label: "Tingkat sukses", value: `${data.totals.successRate}%` },
                { label: "Total token", value: fmt(data.totals.tokens) },
                { label: "Latensi rata-rata / P95", value: `${data.totals.avgLatencyMs} / ${data.totals.p95LatencyMs} ms` },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-[#222327] bg-[#151619] p-3">
                  <p className="text-xs text-zinc-400">{c.label}</p>
                  <p className="mt-1 text-lg font-semibold">{c.value}</p>
                </div>
              ))}
            </div>

            <h2 className="mb-2 text-sm font-semibold text-zinc-300">Request per hari</h2>
            {data.daily.length === 0 ? (
              <p className="mb-6 rounded-lg border border-[#222327] bg-[#151619] p-4 text-sm text-zinc-400">
                Belum ada request pada periode ini.
              </p>
            ) : (
              <div className="mb-6 flex h-28 items-end gap-1 rounded-lg border border-[#222327] bg-[#151619] p-3">
                {data.daily.map((d) => (
                  <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[10px] text-zinc-400 opacity-0 transition group-hover:opacity-100">
                      {fmt(d.requests)}
                    </span>
                    <div
                      className="w-full max-w-6 rounded-sm bg-emerald-500/80"
                      style={{ height: `${Math.max(2, (d.requests / maxDaily) * 100)}%` }}
                      title={`${d.day}: ${fmt(d.requests)} request, ${fmt(d.tokens)} token`}
                    />
                    <span className="text-[9px] text-zinc-500">{d.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}

            <h2 className="mb-2 text-sm font-semibold text-zinc-300">Provider teratas</h2>
            {data.topProviders.length === 0 ? (
              <p className="mb-6 rounded-lg border border-[#222327] bg-[#151619] p-4 text-sm text-zinc-400">
                Belum ada data provider.
              </p>
            ) : (
              <div className="mb-6 overflow-hidden rounded-lg border border-[#222327]">
                {data.topProviders.map((p) => (
                  <div
                    key={p.providerId}
                    className="flex items-center gap-3 border-b border-[#222327] bg-[#151619] px-3 py-2.5 text-sm last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{p.providerName}</span>
                    <span className="text-xs text-zinc-400">
                      {fmt(p.requests)} req · {fmt(p.tokens)} token · {p.successRate}% · {p.avgLatencyMs} ms
                    </span>
                  </div>
                ))}
              </div>
            )}

            <h2 className="mb-2 text-sm font-semibold text-zinc-300">Model teratas</h2>
            {data.topModels.length === 0 ? (
              <p className="mb-6 rounded-lg border border-[#222327] bg-[#151619] p-4 text-sm text-zinc-400">
                Belum ada data model.
              </p>
            ) : (
              <div className="mb-6 overflow-hidden rounded-lg border border-[#222327]">
                {data.topModels.map((m) => (
                  <div
                    key={m.model}
                    className="flex items-center gap-3 border-b border-[#222327] bg-[#151619] px-3 py-2.5 text-sm last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{m.model}</span>
                    <span className="text-xs text-zinc-400">
                      {fmt(m.requests)} req · {fmt(m.tokens)} token
                    </span>
                  </div>
                ))}
              </div>
            )}

            <h2 className="mb-2 text-sm font-semibold text-zinc-300">Kunci sendiri vs shared</h2>
            <div className="mb-6 overflow-hidden rounded-lg border border-[#222327]">
              {data.sharedSplit.length === 0 && (
                <p className="bg-[#151619] p-4 text-sm text-zinc-400">Belum ada data.</p>
              )}
              {data.sharedSplit.map((s) => (
                <div
                  key={s.shared ? "shared" : "own"}
                  className="flex items-center gap-3 border-b border-[#222327] bg-[#151619] px-3 py-2.5 text-sm last:border-b-0"
                >
                  <span className="flex-1 font-medium">
                    {s.shared ? "Kunci shared (admin)" : "Kunci sendiri"}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {fmt(s.requests)} req · {fmt(s.tokens)} token
                  </span>
                </div>
              ))}
            </div>

            {data.topUsers && (
              <>
                <h2 className="mb-2 text-sm font-semibold text-zinc-300">Pengguna teratas (admin)</h2>
                <div className="overflow-hidden rounded-lg border border-[#222327]">
                  {data.topUsers.length === 0 && (
                    <p className="bg-[#151619] p-4 text-sm text-zinc-400">Belum ada data.</p>
                  )}
                  {data.topUsers.map((u) => (
                    <div
                      key={String(u.userId)}
                      className="flex items-center gap-3 border-b border-[#222327] bg-[#151619] px-3 py-2.5 text-sm last:border-b-0"
                    >
                      <span className="flex-1 font-medium">
                        {u.userId === null ? "Sistem / internal" : `User #${u.userId}`}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {fmt(u.requests)} req · {fmt(u.tokens)} token
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <MsakuUserGate>
      <AnalyticsContent />
    </MsakuUserGate>
  )
}
