"use client"

/**
 * /status — public gateway status page.
 *
 * No login needed (same as any public status page). Polls /api/status
 * every 60 s. Shows only aggregates — no keys, no user data.
 */

import { useCallback, useEffect, useState } from "react"

type Health = "operational" | "degraded" | "down" | "no_data"

interface ProviderHealth {
  providerId: string
  providerName: string
  total: number
  successRate: number
  avgLatencyMs: number
  lastRequestAt: string | null
  lastSuccessAt: string | null
  status: Health
}

interface StatusBody {
  status: "operational" | "degraded" | "down"
  generatedAt: string
  dbOk: boolean
  totals: {
    requests24h: number
    successRate: number
    avgLatencyMs: number
    totalKeys: number
    totalProviders: number
    totalModelsStatic: number
  }
  providers: ProviderHealth[]
}

const DOT: Record<Health, string> = {
  operational: "bg-emerald-400",
  degraded: "bg-amber-400",
  down: "bg-red-400",
  no_data: "bg-zinc-600",
}

const LABEL: Record<Health, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  no_data: "No data (24h)",
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString()
}

export default function StatusPage() {
  const [data, setData] = useState<StatusBody | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat status")
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  const overall = data?.status ?? "down"

  return (
    <div className="min-h-dvh bg-[#0e0f11] font-sans text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Msaku Gateway — Status</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Kesehatan gateway &amp; provider, 24 jam terakhir. Diperbarui otomatis tiap 60 detik.
            </p>
          </div>
          <a
            href="/"
            className="shrink-0 rounded-md border border-[#222327] bg-[#151619] px-3 py-1.5 text-sm text-zinc-300 hover:bg-[#1c1e21]"
          >
            ← Studio
          </a>
        </header>

        {!data && !error && (
          <p className="rounded-lg border border-[#222327] bg-[#151619] p-4 text-sm text-zinc-400">
            Memuat status…
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            Gagal memuat status: {error}
          </p>
        )}

        {data && (
          <>
            <div
              className={`mb-6 flex items-center gap-3 rounded-lg border p-4 ${
                overall === "operational"
                  ? "border-emerald-900 bg-emerald-950/40"
                  : overall === "degraded"
                    ? "border-amber-900 bg-amber-950/40"
                    : "border-red-900 bg-red-950/40"
              }`}
            >
              <span className={`h-3 w-3 shrink-0 rounded-full ${DOT[overall]}`} />
              <div>
                <p className="font-medium">
                  {overall === "operational"
                    ? "Semua sistem beroperasi normal"
                    : overall === "degraded"
                      ? "Sebagian provider bermasalah"
                      : "Gateway sedang down"}
                </p>
                <p className="text-xs text-zinc-400">
                  Database {data.dbOk ? "terhubung" : "TIDAK terhubung"} · dicek{" "}
                  {fmtTime(data.generatedAt)}
                </p>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Request 24 jam", value: String(data.totals.requests24h) },
                { label: "Tingkat sukses", value: `${data.totals.successRate}%` },
                { label: "Latensi rata-rata", value: `${data.totals.avgLatencyMs} ms` },
                { label: "Kunci tersync", value: String(data.totals.totalKeys) },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-[#222327] bg-[#151619] p-3">
                  <p className="text-xs text-zinc-400">{c.label}</p>
                  <p className="mt-1 text-lg font-semibold">{c.value}</p>
                </div>
              ))}
            </div>

            <h2 className="mb-2 text-sm font-semibold text-zinc-300">
              Provider ({data.providers.length} aktif 24 jam terakhir · {data.totals.totalProviders}{" "}
              terdaftar · {data.totals.totalModelsStatic} model statis)
            </h2>
            {data.providers.length === 0 ? (
              <p className="rounded-lg border border-[#222327] bg-[#151619] p-4 text-sm text-zinc-400">
                Belum ada request tercatat dalam 24 jam terakhir.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-[#222327]">
                {data.providers.map((p) => (
                  <div
                    key={p.providerId}
                    className="flex items-center gap-3 border-b border-[#222327] bg-[#151619] px-3 py-2.5 text-sm last:border-b-0"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[p.status]}`} />
                    <span className="min-w-0 flex-1 truncate font-medium">{p.providerName}</span>
                    <span className="hidden text-xs text-zinc-400 sm:inline">
                      {p.total} req · {p.successRate}% sukses · {p.avgLatencyMs} ms
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs text-zinc-400">
                      {LABEL[p.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-zinc-500">
              Sukses terakhir per provider:{" "}
              {data.providers.filter((p) => p.lastSuccessAt).length} dari{" "}
              {data.providers.length} provider punya request sukses dalam 24 jam terakhir.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
