"use client"

/**
 * /discovery — real-time model discovery.
 *
 * Gated by MsakuUserGate (same msk_ gate as the Studio). Lists every
 * provider in the gateway, fetches its LIVE model list from the provider's
 * /models endpoint (using the caller's own synced key first, else a shared
 * key, else no key), and diffs it against the static list in the code.
 * Added models are green, removed ones red. No key values are ever shown.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import MsakuUserGate from "@/components/msaku-user-gate"

const STORED_MSK_KEY = "msaku_gateway_user_api_key"

interface DiscoveryEntry {
  providerId: string
  providerName: string
  liveTotal: number
  staticTotal: number
  added: string[]
  removed: string[]
  source: "live" | "static"
  keyAvailable: boolean
  fetchedAt: string
  error?: string
}

interface DiscoveryBody {
  providers: DiscoveryEntry[]
  totals: {
    providers: number
    live: number
    staticOnly: number
    newModels: number
    removedModels: number
  }
  fetchedAt: string
  cached: boolean
}

function DiscoveryContent() {
  const [data, setData] = useState<DiscoveryBody | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const load = useCallback(async (opts: { refresh?: boolean; provider?: string } = {}) => {
    setLoading(true)
    try {
      const key = localStorage.getItem(STORED_MSK_KEY) || ""
      const qs = new URLSearchParams()
      if (opts.refresh) qs.set("refresh", "1")
      if (opts.provider) qs.set("provider", opts.provider)
      const res = await fetch(`/api/discovery?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body: DiscoveryBody = await res.json()
      if (opts.provider) {
        setData((prev) => {
          if (!prev) return body
          const map = new Map(prev.providers.map((p) => [p.providerId, p]))
          for (const p of body.providers) map.set(p.providerId, p)
          const providers = [...map.values()]
          return { ...prev, providers, totals: body.totals, fetchedAt: body.fetchedAt }
        })
      } else {
        setData(body)
      }
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat discovery")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !data) return data?.providers ?? []
    return data.providers.filter(
      (p) =>
        p.providerId.toLowerCase().includes(q) ||
        p.providerName.toLowerCase().includes(q) ||
        p.added.some((m) => m.toLowerCase().includes(q)),
    )
  }, [data, query])

  const withChanges = useMemo(
    () => (data?.providers ?? []).filter((p) => p.added.length > 0 || p.removed.length > 0),
    [data],
  )

  return (
    <div className="min-h-dvh bg-[#0e0f11] font-sans text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Discovery Model</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Daftar model live dari tiap provider, dicek langsung ke endpoint /models-nya.
              Hijau = model baru, merah = sudah tidak ditawarkan. Cache 10 menit.
            </p>
          </div>
          <a
            href="/"
            className="shrink-0 rounded-md border border-[#222327] bg-[#151619] px-3 py-1.5 text-sm text-zinc-300 hover:bg-[#1c1e21]"
          >
            ← Studio
          </a>
        </header>

        <div className="mb-4 flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari provider atau model…"
            className="min-w-0 flex-1 rounded-md border border-[#222327] bg-[#151619] px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
          />
          <button
            onClick={() => load({ refresh: true })}
            disabled={loading}
            className="rounded-md border border-[#222327] bg-[#151619] px-3 py-2 text-sm text-zinc-200 hover:bg-[#1c1e21] disabled:opacity-50"
          >
            {loading ? "Memeriksa…" : "↻ Periksa ulang semua"}
          </button>
        </div>

        {!data && !error && (
          <p className="rounded-lg border border-[#222327] bg-[#151619] p-4 text-sm text-zinc-400">
            Memeriksa model live dari semua provider — pemindaian pertama bisa memakan waktu
            beberapa puluh detik…
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            Gagal memuat discovery: {error}
          </p>
        )}

        {data && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Provider dicek", value: String(data.totals.providers) },
                { label: "Live / statis saja", value: `${data.totals.live} / ${data.totals.staticOnly}` },
                { label: "Model baru", value: String(data.totals.newModels) },
                { label: "Model hilang", value: String(data.totals.removedModels) },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-[#222327] bg-[#151619] p-3">
                  <p className="text-xs text-zinc-400">{c.label}</p>
                  <p className="mt-1 text-lg font-semibold">{c.value}</p>
                </div>
              ))}
            </div>

            {withChanges.length > 0 && (
              <p className="mb-4 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">
                {withChanges.length} provider punya perubahan daftar model sejak daftar statis
                terakhir. {data.totals.newModels} model baru, {data.totals.removedModels} model
                sudah tidak ditawarkan.
              </p>
            )}

            <div className="space-y-2">
              {filtered.map((p) => {
                const open = !!expanded[p.providerId]
                const hasDiff = p.added.length > 0 || p.removed.length > 0
                return (
                  <div key={p.providerId} className="overflow-hidden rounded-lg border border-[#222327] bg-[#151619]">
                    <button
                      onClick={() =>
                        setExpanded((e) => ({ ...e, [p.providerId]: !e[p.providerId] }))
                      }
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-[#1a1c1f]"
                    >
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          p.source === "live" ? "bg-emerald-400" : "bg-zinc-600"
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{p.providerName}</span>
                      <span className="hidden text-xs text-zinc-400 sm:inline">
                        {p.liveTotal} live · {p.staticTotal} statis
                      </span>
                      {p.added.length > 0 && (
                        <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-xs text-emerald-300">
                          +{p.added.length} baru
                        </span>
                      )}
                      {p.removed.length > 0 && (
                        <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-xs text-red-300">
                          −{p.removed.length} hilang
                        </span>
                      )}
                      <span className="w-14 shrink-0 text-right text-xs text-zinc-400">
                        {p.source === "live" ? "LIVE" : "STATIS"}
                      </span>
                    </button>
                    {open && (
                      <div className="border-t border-[#222327] px-3 py-2.5 text-sm">
                        {!p.keyAvailable && (
                          <p className="mb-2 text-xs text-amber-300/90">
                            Tidak ada kunci tersync untuk provider ini — daftar live tidak bisa
                            dicek (tampilkan daftar statis). Sync kunci provider ini di tab Keys
                            untuk mengaktifkan pengecekan live.
                          </p>
                        )}
                        {p.error && (
                          <p className="mb-2 text-xs text-red-300">Error: {p.error}</p>
                        )}
                        {!hasDiff && (
                          <p className="text-xs text-zinc-400">
                            Daftar live sama dengan daftar statis ({p.liveTotal} model).
                          </p>
                        )}
                        {p.added.length > 0 && (
                          <div className="mb-2">
                            <p className="mb-1 text-xs font-medium text-emerald-300">Model baru:</p>
                            <div className="flex flex-wrap gap-1">
                              {p.added.map((m) => (
                                <code key={m} className="rounded bg-emerald-950 px-1.5 py-0.5 font-mono text-xs text-emerald-200">
                                  {m}
                                </code>
                              ))}
                            </div>
                          </div>
                        )}
                        {p.removed.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-medium text-red-300">Tidak lagi ditawarkan:</p>
                            <div className="flex flex-wrap gap-1">
                              {p.removed.map((m) => (
                                <code key={m} className="rounded bg-red-950 px-1.5 py-0.5 font-mono text-xs text-red-200 line-through">
                                  {m}
                                </code>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => load({ provider: p.providerId })}
                          disabled={loading}
                          className="mt-2 rounded border border-[#222327] px-2 py-1 text-xs text-zinc-300 hover:bg-[#1c1e21] disabled:opacity-50"
                        >
                          Periksa ulang provider ini
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <p className="rounded-lg border border-[#222327] bg-[#151619] p-4 text-sm text-zinc-400">
                  Tidak ada provider yang cocok dengan pencarian.
                </p>
              )}
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Terakhir dicek {new Date(data.fetchedAt).toLocaleString()}
              {data.cached ? " (dari cache 10 menit)" : ""} · Daftar live diambil dari endpoint
              /models masing-masing provider.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function DiscoveryPage() {
  return (
    <MsakuUserGate>
      <DiscoveryContent />
    </MsakuUserGate>
  )
}
