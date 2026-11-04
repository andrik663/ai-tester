"use client"

/**
 * Client UI for the admin shared-key panel. This file contains NO secrets:
 * - The login form sends the shared admin token once to the login route
 *   (over HTTPS) and receives only a session cookie in return.
 * - The panel never fetches, displays, or stores provider keys. The list
 *   API deliberately returns no api_key column, and the add form clears
 *   its key field after a successful submit.
 * - Removing a row deletes that shared row only (by id); private user
 *   keys are never listed here and can never be touched from this panel.
 */

import { useCallback, useEffect, useState } from "react"
import type { CSSProperties, FormEvent } from "react"

type SharedRow = {
  id: number
  providerId: string
  providerName: string
  modelIds: string[]
  avgLatencyMs: number
  pushedAt: number
}

const panelStyle: CSSProperties = {
  maxWidth: 720,
  margin: "48px auto",
  padding: "0 16px",
  fontFamily: "system-ui, sans-serif",
  color: "#e4e4e7",
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid #3f3f46",
  background: "#151619",
  color: "#e4e4e7",
  fontSize: 14,
  boxSizing: "border-box",
}

const buttonStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 6,
  border: "none",
  background: "#e4e4e7",
  color: "#0e0f11",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
}

export function GatewaySharedLogin() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      const res = await fetch("/api/admin/gateway-shared/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Login gagal (${res.status})`)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={panelStyle}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Panel Admin — Kunci Shared Gateway</h1>
      <p style={{ color: "#a1a1aa", fontSize: 14, lineHeight: 1.6 }}>
        Login memakai token admin shared (<code>GATEWAY_SHARED_ADMIN_TOKEN</code>) yang sudah diset di
        environment deployment. Token ini tidak pernah ditampilkan atau disimpan di browser — yang
        disimpan hanya sesi login selama 24 jam.
      </p>
      <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 20 }}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Token admin shared"
          autoComplete="current-password"
          style={inputStyle}
        />
        {error && <p style={{ color: "#f87171", fontSize: 14 }}>{error}</p>}
        <button type="submit" disabled={busy || !password} style={buttonStyle}>
          {busy ? "Memeriksa…" : "Masuk"}
        </button>
      </form>
    </div>
  )
}

export function GatewaySharedPanel() {
  const [rows, setRows] = useState<SharedRow[]>([])
  const [loadError, setLoadError] = useState("")
  const [notice, setNotice] = useState("")
  const [providerId, setProviderId] = useState("")
  const [providerName, setProviderName] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [models, setModels] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/gateway-shared")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Gagal memuat (${res.status})`)
      setRows(data.sharedKeys ?? [])
      setLoadError("")
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat daftar")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    setNotice("")
    setBusy(true)
    try {
      const modelIds = models.split(",").map((m) => m.trim()).filter(Boolean)
      const res = await fetch("/api/admin/gateway-shared", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", providerId, providerName, apiKey, modelIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Gagal menambah (${res.status})`)
      setNotice(`Kunci shared ${providerId} ditambahkan — aktif untuk semua user msk_ dalam ~30 detik (cache TTL).`)
      setProviderId("")
      setProviderName("")
      setApiKey("")
      setModels("")
      await load()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Gagal menambah kunci")
    } finally {
      setBusy(false)
    }
  }

  async function remove(row: SharedRow) {
    if (!window.confirm(`Cabut kunci shared ${row.providerId} (${row.modelIds.join(", ")}) untuk semua user?`)) return
    setNotice("")
    try {
      const res = await fetch("/api/admin/gateway-shared", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id: row.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Gagal mencabut (${res.status})`)
      setNotice(`Kunci shared ${row.providerId} dicabut — model berhenti disajikan dalam ~30 detik.`)
      await load()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Gagal mencabut kunci")
    }
  }

  async function logout() {
    await fetch("/api/admin/gateway-shared/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logout: true }),
    }).catch(() => {})
    window.location.reload()
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 22 }}>Panel Admin — Kunci Shared Gateway</h1>
        <button onClick={logout} style={{ ...buttonStyle, background: "#27272a", color: "#e4e4e7" }}>
          Keluar
        </button>
      </div>
      <p style={{ color: "#a1a1aa", fontSize: 14, lineHeight: 1.6 }}>
        Kunci di sini disajikan ke <strong>semua user msk_</strong> sebagai fallback di belakang kunci
        mereka sendiri. Kunci provider tidak pernah ditampilkan di panel ini — yang terlihat hanya
        provider dan daftar modelnya.
      </p>

      {loadError && <p style={{ color: "#f87171", fontSize: 14 }}>{loadError}</p>}
      {notice && <p style={{ color: "#a1a1aa", fontSize: 14 }}>{notice}</p>}

      <h2 style={{ fontSize: 16, marginTop: 28 }}>Kunci shared aktif ({rows.length})</h2>
      {rows.length === 0 ? (
        <p style={{ color: "#a1a1aa", fontSize: 14 }}>Belum ada kunci shared.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#a1a1aa" }}>
              <th style={{ padding: "8px 4px" }}>Provider</th>
              <th style={{ padding: "8px 4px" }}>Model</th>
              <th style={{ padding: "8px 4px" }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid #27272a" }}>
                <td style={{ padding: "8px 4px" }}>
                  {row.providerName}
                  <div style={{ color: "#71717a", fontSize: 12 }}>{row.providerId}</div>
                </td>
                <td style={{ padding: "8px 4px" }}>{row.modelIds.join(", ")}</td>
                <td style={{ padding: "8px 4px", textAlign: "right" }}>
                  <button
                    onClick={() => remove(row)}
                    style={{ ...buttonStyle, background: "#7f1d1d", color: "#fecaca", padding: "6px 12px" }}
                  >
                    Cabut
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 16, marginTop: 32 }}>Tambah kunci shared</h2>
      <form onSubmit={add} style={{ display: "grid", gap: 12 }}>
        <input value={providerId} onChange={(e) => setProviderId(e.target.value)} placeholder="providerId, mis. anthropic" style={inputStyle} />
        <input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="Nama provider, mis. Claude (Anthropic)" style={inputStyle} />
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Kunci provider (tidak pernah ditampilkan lagi setelah disimpan)" autoComplete="off" style={inputStyle} />
        <input value={models} onChange={(e) => setModels(e.target.value)} placeholder="Model, pisahkan koma — mis. claude-sonnet-4-5" style={inputStyle} />
        <button type="submit" disabled={busy || !providerId || !apiKey || !models} style={buttonStyle}>
          {busy ? "Menyimpan…" : "Bagikan ke semua user"}
        </button>
      </form>
    </div>
  )
}
