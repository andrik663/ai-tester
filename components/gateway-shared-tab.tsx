"use client"

/**
 * Admin tab inside the tester dashboard (Keys → Admin).
 *
 * This completes "the dashboard IS the admin panel": after sharing keys
 * from the Sync tab, the admin manages them here without leaving the
 * dashboard — list shared keys and revoke one — while adding stays in the
 * Sync tab's full-feature input ("Bagikan sebagai shared").
 *
 * SECURITY: this tab only ever talks to the session-gated admin API.
 * - GET /api/admin/gateway-shared returns shared rows WITHOUT the api_key
 *   column, so provider keys are never displayed or fetched here.
 * - POST remove deletes one shared row by id; private user keys are never
 *   listed and cannot be touched from this tab.
 * - Without a panel-admin session the API answers 401 and this tab shows
 *   a login link instead of a list. No token is sent from this page.
 */

import { useCallback, useEffect, useState } from "react"

type SharedRow = {
  id: number
  providerId: string
  providerName: string
  modelIds: string[]
  avgLatencyMs: number
  pushedAt: number
}

export default function GatewaySharedTab() {
  const [rows, setRows] = useState<SharedRow[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/gateway-shared")
      const data = await res.json().catch(() => ({})) as { sharedKeys?: SharedRow[]; error?: string }
      if (res.status === 401) {
        setError("unauthorized")
      } else if (!res.ok) {
        setError(data.error ?? `Gagal memuat (${res.status})`)
      } else {
        setRows(data.sharedKeys ?? [])
        setError("")
      }
    } catch {
      setError("Gagal memuat daftar kunci shared")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function remove(row: SharedRow) {
    if (!window.confirm(`Cabut kunci shared ${row.providerId} (${row.modelIds.join(", ")}) untuk semua user?`)) return
    setNotice("")
    try {
      const res = await fetch("/api/admin/gateway-shared", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id: row.id }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? `Gagal mencabut (${res.status})`)
      setNotice(`Kunci shared ${row.providerId} dicabut — model berhenti disajikan dalam ~30 detik.`)
      await load()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Gagal mencabut kunci")
    }
  }

  if (error === "unauthorized") {
    return (
      <div className="flex flex-col gap-2 p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Admin — Kunci Shared</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Tab ini hanya untuk admin. Login dulu di{" "}
          <a href="/admin/gateway-shared" className="text-primary/80 underline">panel admin</a>{" "}
          (sesi 24 jam), lalu kembali ke tab ini — daftar kunci shared akan tampil di sini.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Admin — Kunci Shared ({rows.length})
        </h3>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Kunci di sini disajikan ke semua user msk_ sebagai fallback. Menambah kunci dilakukan di
          tab Sync lewat tombol “Bagikan sebagai shared”; di sini hanya daftar dan cabut.
          Nilai kunci provider tidak pernah ditampilkan.
        </p>
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {notice && <p className="text-[11px] text-muted-foreground">{notice}</p>}

      <button
        onClick={load}
        disabled={loading}
        className="self-start px-3 py-2 rounded-md bg-secondary/40 border border-border text-[11px] font-semibold text-foreground disabled:opacity-40 transition-all"
      >
        {loading ? "Memuat…" : "Muat ulang daftar"}
      </button>

      {rows.length === 0 && !loading ? (
        <p className="text-[11px] text-muted-foreground">Belum ada kunci shared.</p>
      ) : (
        <div className="flex flex-col rounded-md border border-border overflow-hidden">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-border/40 last:border-b-0">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold truncate">{row.providerName}</div>
                <div className="text-[10px] text-muted-foreground truncate">{row.providerId} · {row.modelIds.join(", ")}</div>
              </div>
              <button
                onClick={() => remove(row)}
                className="flex-shrink-0 px-2.5 py-1.5 rounded-md border border-destructive/40 text-[11px] font-semibold text-destructive hover:bg-destructive/10 transition-all"
              >
                Cabut
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
