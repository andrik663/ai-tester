"use client"

/**
 * Admin shared-key panel — embedded INSIDE the main gateway dashboard.
 *
 * The standalone /admin/gateway-shared route now renders the full tester
 * dashboard (ManualKeyTester) with a "Shared" tab; this file provides that
 * tab's content. All behaviour is unchanged from PR #116/#117:
 * - Login sends the shared admin token once to the login route and gets
 *   only a session cookie back; the token never enters client code.
 * - The list API returns no api_key column, so provider keys are never
 *   displayed, fetched, or stored by this UI.
 * - Remove deletes one shared row by id; private user keys are never
 *   listed here and cannot be touched from this panel.
 */

import { useCallback, useEffect, useState } from "react"
import type { CSSProperties, FormEvent, ReactNode } from "react"

type SharedRow = {
  id: number
  providerId: string
  providerName: string
  modelIds: string[]
  avgLatencyMs: number
  pushedAt: number
}

// ── Design tokens (same as the tester dashboard) ─────────────────────────────
const BG = "#0e0f11"
const CARD = "#151619"
const SIDEBAR = "#0a0b0d"
const MUTED_BG = "#1d1e22"
const LINE = "#222327"
const TEXT = "#e4e4e7"
const DIM = "#a1a1aa"
const FAINT = "#71717a"

const shell: CSSProperties = { minHeight: "100vh", background: BG, color: TEXT, fontFamily: "system-ui, sans-serif" }
const header: CSSProperties = {
  height: 48, display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "0 16px", borderBottom: `1px solid ${LINE}`, background: BG, position: "sticky", top: 0, zIndex: 10,
}
const brand: CSSProperties = { fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }
const badge: CSSProperties = {
  display: "inline-block", marginLeft: 8, padding: "2px 8px", borderRadius: 999,
  border: `1px solid ${LINE}`, background: MUTED_BG, color: DIM, fontSize: 11, fontWeight: 600, verticalAlign: "middle",
}
const ghostBtn: CSSProperties = {
  height: 36, padding: "0 14px", borderRadius: 6, border: `1px solid ${LINE}`,
  background: MUTED_BG, color: TEXT, fontSize: 13, fontWeight: 600, cursor: "pointer",
}
const solidBtn: CSSProperties = {
  height: 44, padding: "0 16px", borderRadius: 6, border: "none",
  background: TEXT, color: "#0e0f11", fontSize: 13, fontWeight: 700, cursor: "pointer",
}
const input: CSSProperties = {
  width: "100%", height: 44, padding: "0 12px", borderRadius: 6, border: `1px solid ${LINE}`,
  background: CARD, color: TEXT, fontSize: 13, boxSizing: "border-box", outline: "none",
}
const card: CSSProperties = { background: CARD, border: `1px solid ${LINE}`, borderRadius: 6 }
const statLabel: CSSProperties = { fontSize: 12, color: DIM, marginBottom: 4 }
const statValue: CSSProperties = { fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em" }
const pill: CSSProperties = {
  display: "inline-block", padding: "3px 8px", borderRadius: 999, background: MUTED_BG,
  border: `1px solid ${LINE}`, fontSize: 12, color: TEXT, margin: "0 6px 6px 0",
}
const navItem: CSSProperties = {
  display: "block", width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 13,
  border: "none", borderLeft: "2px solid transparent", background: "transparent", color: DIM, cursor: "pointer",
}
const navActive: CSSProperties = { ...navItem, background: CARD, borderLeft: "2px solid #e4e4e7", color: TEXT, fontWeight: 600 }

const responsive = `
  .gw-admin-body { display: flex; }
  .gw-admin-sidebar { width: 240px; flex-shrink: 0; background: ${SIDEBAR}; border-right: 1px solid ${LINE}; padding: 16px 12px; }
  .gw-admin-main { flex: 1; min-width: 0; padding: 24px; }
  .gw-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .gw-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .gw-form-full { grid-column: 1 / -1; }
  @media (max-width: 768px) {
    .gw-admin-sidebar { display: none; }
    .gw-admin-main { padding: 16px; }
    .gw-stats { grid-template-columns: 1fr; }
    .gw-form-grid { grid-template-columns: 1fr; }
  }
`

function Shell({ children, onLogout }: { children: ReactNode; onLogout?: () => void }) {
  return (
    <div style={shell}>
      <style>{responsive}</style>
      <header style={header}>
        <div style={brand}>Msaku Gateway<span style={badge}>ADMIN</span></div>
        {onLogout && (
          <button onClick={onLogout} style={ghostBtn}>Keluar</button>
        )}
      </header>
      {children}
    </div>
  )
}

function Sidebar({ active }: { active: string }) {
  return (
    <aside className="gw-admin-sidebar">
      <div style={{ fontSize: 11, color: FAINT, fontWeight: 700, letterSpacing: "0.08em", padding: "0 12px 8px" }}>ADMIN</div>
      <button style={active === "shared" ? navActive : navItem}>Kunci Shared</button>
      <button style={active === "tambah" ? navActive : navItem} onClick={() => document.getElementById("gw-tambah")?.scrollIntoView({ behavior: "smooth" })}>
        Tambah Kunci
      </button>
      <div style={{ marginTop: 24, padding: "0 12px", fontSize: 12, color: FAINT, lineHeight: 1.6 }}>
        Kunci provider tidak pernah ditampilkan di browser. Yang terlihat di sini hanya provider dan
        daftar modelnya.
      </div>
    </aside>
  )
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
    <Shell>
      <div style={{ maxWidth: 400, margin: "72px auto", padding: "0 16px" }}>
        <div style={{ ...card, padding: 24 }}>
          <div style={brand}>Msaku Gateway<span style={badge}>ADMIN</span></div>
          <h1 style={{ fontSize: 18, margin: "16px 0 8px" }}>Panel Admin — Kunci Shared</h1>
          <p style={{ color: DIM, fontSize: 13, lineHeight: 1.6, margin: "0 0 20px" }}>
            Login memakai token admin shared (<code>GATEWAY_SHARED_ADMIN_TOKEN</code>) yang sudah
            diset di environment deployment. Yang disimpan browser hanya sesi login 24 jam.
          </p>
          <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Token admin shared"
              autoComplete="current-password"
              style={input}
            />
            {error && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={busy || !password} style={solidBtn}>
              {busy ? "Memeriksa…" : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    </Shell>
  )
}

/** Inline login card shown inside the dashboard tab when the admin session is missing. */
function InlineLogin({ onAuthed }: { onAuthed: () => void }) {
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
      onAuthed()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ ...card, padding: 20, maxWidth: 420, margin: "0 auto" }}>
      <div style={brand}>Msaku Gateway<span style={badge}>ADMIN</span></div>
      <p style={{ color: DIM, fontSize: 13, lineHeight: 1.6, margin: "12px 0 16px" }}>
        Masuk memakai token admin shared. Yang disimpan browser hanya sesi login 24 jam.
      </p>
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Token admin shared"
          autoComplete="current-password"
          style={input}
        />
        {error && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>}
        <button type="submit" disabled={busy || !password} style={solidBtn}>
          {busy ? "Memeriksa…" : "Masuk"}
        </button>
      </form>
    </div>
  )
}

/**
 * Tab content for the main dashboard's "Shared" tab. Detects the admin
 * session by hitting the list API: 401 → inline login; otherwise the
 * shared-key manager.
 */
export function GatewaySharedTabContent() {
  const [authed, setAuthed] = useState<boolean | null>(null) // null = checking
  const [rows, setRows] = useState<SharedRow[]>([])
  const [loadError, setLoadError] = useState("")
  const [notice, setNotice] = useState("")
  const [providerId, setProviderId] = useState("")
  const [providerName, setProviderName] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [models, setModels] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/gateway-shared")
      const data = await res.json().catch(() => ({}))
      if (res.status === 401 || res.status === 503) {
        setAuthed(false)
        return false
      }
      if (!res.ok) throw new Error(data.error || `Gagal memuat (${res.status})`)
      setRows(data.sharedKeys ?? [])
      setLoadError("")
      setAuthed(true)
      return true
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat daftar")
      setAuthed(true)
      return true
    }
  }, [])

  useEffect(() => {
    void load()
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

  if (authed === null) {
    return <p style={{ color: DIM, fontSize: 13 }}>Memeriksa sesi admin…</p>
  }
  if (authed === false) {
    return <InlineLogin onAuthed={() => void load()} />
  }

  const totalModels = rows.reduce((n, r) => n + r.modelIds.length, 0)
  const providerCount = new Set(rows.map((r) => r.providerId)).size

  return (
    <div style={{ color: TEXT, fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <style>{responsive}</style>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Kunci Shared Gateway</h1>
          <p style={{ color: DIM, fontSize: 13, lineHeight: 1.6, margin: "0 0 20px", maxWidth: 640 }}>
            Kunci di sini disajikan ke <strong>semua user msk_</strong> sebagai fallback di belakang
            kunci mereka sendiri. Kunci provider tidak pernah ditampilkan di panel ini.
          </p>
        </div>
        <button onClick={logout} style={{ ...ghostBtn, flexShrink: 0 }}>Keluar admin</button>
      </div>

      <div className="gw-stats" style={{ marginBottom: 16 }}>
        <div style={{ ...card, padding: 16 }}>
          <div style={statLabel}>Kunci shared aktif</div>
          <div style={statValue}>{rows.length}</div>
        </div>
        <div style={{ ...card, padding: 16 }}>
          <div style={statLabel}>Total model shared</div>
          <div style={statValue}>{totalModels}</div>
        </div>
        <div style={{ ...card, padding: 16 }}>
          <div style={statLabel}>Provider</div>
          <div style={statValue}>{providerCount}</div>
        </div>
      </div>

      {loadError && <p style={{ color: "#f87171", fontSize: 13 }}>{loadError}</p>}
      {notice && <p style={{ color: DIM, fontSize: 13 }}>{notice}</p>}

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${LINE}`, fontSize: 13, fontWeight: 700 }}>
          Kunci shared aktif ({rows.length})
        </div>
        {rows.length === 0 ? (
          <p style={{ color: DIM, fontSize: 13, padding: "16px", margin: 0 }}>Belum ada kunci shared.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: DIM }}>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>Provider</th>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>Model</th>
                <th style={{ padding: "10px 16px" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600 }}>{row.providerName}</div>
                    <div style={{ color: FAINT, fontSize: 12 }}>{row.providerId}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {row.modelIds.map((m) => (
                      <span key={m} style={pill}>{m}</span>
                    ))}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => remove(row)}
                      style={{ height: 32, padding: "0 12px", borderRadius: 6, border: `1px solid #7f1d1d`, background: "transparent", color: "#fca5a5", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      Cabut
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div id="gw-tambah" style={{ ...card, padding: 20, marginTop: 16 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Tambah kunci shared</h2>
        <p style={{ color: DIM, fontSize: 13, margin: "0 0 16px" }}>
          Sekali disimpan, kunci langsung dibagikan ke semua user msk_.
        </p>
        <form onSubmit={add} style={{ display: "grid", gap: 12 }}>
          <div className="gw-form-grid">
            <input value={providerId} onChange={(e) => setProviderId(e.target.value)} placeholder="providerId, mis. anthropic" style={input} />
            <input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="Nama provider, mis. Claude (Anthropic)" style={input} />
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Kunci provider (tidak pernah ditampilkan lagi setelah disimpan)" autoComplete="off" style={input} className="gw-form-full" />
            <input value={models} onChange={(e) => setModels(e.target.value)} placeholder="Model, pisahkan koma — mis. claude-sonnet-4-5" style={input} className="gw-form-full" />
          </div>
          <div>
            <button type="submit" disabled={busy || !providerId || !apiKey || !models} style={solidBtn}>
              {busy ? "Menyimpan…" : "Bagikan ke semua user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** Standalone full-page panel (kept for direct navigation + fallback). */
export function GatewaySharedPanel() {
  return (
    <Shell onLogout={undefined}>
      <div className="gw-admin-body">
        <Sidebar active="shared" />
        <main className="gw-admin-main">
          <GatewaySharedTabContent />
        </main>
      </div>
    </Shell>
  )
}
