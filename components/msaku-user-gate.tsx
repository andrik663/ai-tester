"use client"

import { useEffect, useState, type ReactNode } from "react"

// Kunci msk_ yang sama dipakai panel Keys tester untuk Sync (export-api-panel).
const STORED_MSK_KEY = "msaku_gateway_user_api_key"

// Brand provider yang tampil di marquee "Route Requests Across Top AI
// Providers." di bawah kartu gerbang — sama seperti seksi di homepage
// router.bynara.id. Hanya nama brand yang memang ada sebagai provider
// di gateway ini (PRESETS di components/manual-key-tester.tsx); tampil
// sebagai wordmark teks abu-abu, bukan logo resmi, supaya tidak ada
// klaim afiliasi dan tidak perlu aset gambar per brand.
const TOP_PROVIDER_BRANDS = [
  "OpenAI",
  "Claude",
  "Gemini",
  "DeepSeek",
  "Meta AI",
  "Mistral AI",
  "Grok",
  "Qwen",
  "Groq",
  "Together AI",
  "OpenRouter",
  "Cohere",
  "Perplexity",
  "Moonshot AI",
  "GLM",
  "Bynara",
  "MeongTopup",
  "UnliRouter",
]

/**
 * Gerbang Studio — khusus pengguna terdaftar msaku.id.
 *
 * Studio gateway.msaku.id sebelumnya terbuka untuk siapa pun tanpa login,
 * sehingga pengunjung bisa masuk ke tester walau belum terdaftar di
 * msaku.id. Gerbang ini menutupnya di sisi UI: tester hanya dirender
 * setelah pengunjung membuktikan satu API Key User msaku.id (msk_...)
 * yang valid, divalidasi server-side lewat POST /api/v1/keys/info
 * (tier harus msaku_user). Kunci atk_/admin tidak diterima sebagai
 * pass gerbang ini.
 *
 * Yang TIDAK diubah gerbang ini:
 * - Tidak ada endpoint yang diubah jalurnya maupun auth-nya; API v1
 *   tetap menolak anonim (401) seperti sebelumnya.
 * - Kunci yang dimasukkan hanya disimpan di localStorage browser ini
 *   (sama seperti perilaku "remember" tester) dan hanya dikirim ke
 *   endpoint validasi keys/info — tidak pernah ditampilkan kembali
 *   di UI gerbang.
 * - Jalur /api/chat (fallback GEMINI_API_KEY tanpa auth) adalah API
 *   terpisah dan tidak disentuh gerbang UI ini.
 */
export default function MsakuUserGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "open" | "locked">("checking")
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function validateMsk(key: string): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await fetch("/api/v1/keys/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.valid) {
        return { ok: false, message: typeof data?.error === "string" ? data.error : "Kunci tidak valid." }
      }
      if (data?.tier !== "msaku_user") {
        return { ok: false, message: "Kunci ini bukan API Key User msaku.id (msk_...)." }
      }
      return { ok: true }
    } catch {
      return { ok: false, message: "Gagal menghubungi gateway. Coba lagi." }
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let stored = ""
      try {
        stored = localStorage.getItem(STORED_MSK_KEY) || ""
      } catch {
        stored = ""
      }
      if (!stored) {
        if (!cancelled) setState("locked")
        return
      }
      const result = await validateMsk(stored)
      if (cancelled) return
      if (result.ok) {
        setState("open")
      } else {
        try {
          localStorage.removeItem(STORED_MSK_KEY)
        } catch {
          // abaikan
        }
        setError(result.message || "Kunci tersimpan tidak valid. Masukkan kunci baru.")
        setState("locked")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogin() {
    const key = input.trim()
    if (!key) {
      setError("Tempel API Key User (msk_...) kamu dulu.")
      return
    }
    if (!key.startsWith("msk_")) {
      setError("Gerbang ini hanya menerima API Key User msaku.id (msk_...).")
      return
    }
    setBusy(true)
    setError(null)
    const result = await validateMsk(key)
    setBusy(false)
    if (!result.ok) {
      setError(result.message || "Kunci tidak valid.")
      return
    }
    try {
      localStorage.setItem(STORED_MSK_KEY, key)
    } catch {
      // penyimpanan lokal gagal — tester tetap tidak bisa dibuka tanpa kunci tersimpan
      setError("Gagal menyimpan kunci di browser ini. Coba browser lain.")
      return
    }
    setState("open")
  }

  if (state === "open") return <>{children}</>

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "#0e0f11",
        color: "#e4e4e7",
        padding: "48px 16px 64px",
        overflowY: "auto",
      }}
    >
      <style>{`
        @keyframes msaku-brand-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .msaku-brand-track { animation: msaku-brand-marquee 42s linear infinite; }
        .msaku-brand-marquee:hover .msaku-brand-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .msaku-brand-track { animation: none; }
        }
      `}</style>
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#151619",
          border: "1px solid #222327",
          borderRadius: 8,
          padding: 24,
        }}
      >
        <p style={{ fontSize: 13, color: "#a1a1aa", margin: "0 0 6px" }}>Msaku Gateway</p>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Studio khusus pengguna terdaftar</h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa", margin: "0 0 20px" }}>
          Studio ini hanya untuk pengguna msaku.id. Masukkan API Key User (msk_...) kamu satu kali —
          kunci tersimpan di browser ini saja dan dipakai lagi otomatis di kunjungan berikutnya.
        </p>
        <ol style={{ fontSize: 14, lineHeight: 1.8, color: "#e4e4e7", margin: "0 0 20px", paddingLeft: 20 }}>
          <li>
            Daftar / masuk di{" "}
            <a href="https://msaku.id/gateway" style={{ color: "#e4e4e7", textDecoration: "underline" }}>
              msaku.id/gateway
            </a>
          </li>
          <li>
            Buat API Key di{" "}
            <a href="https://msaku.id/profil/api-key" style={{ color: "#e4e4e7", textDecoration: "underline" }}>
              msaku.id/profil/api-key
            </a>{" "}
            (ditampilkan sekali saja)
          </li>
          <li>Tempel kunci itu di bawah, lalu tekan Masuk ke Studio.</li>
        </ol>
        {state === "checking" ? (
          <p style={{ fontSize: 14, color: "#a1a1aa" }}>Memeriksa kunci tersimpan…</p>
        ) : (
          <>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6 }} htmlFor="msaku-gate-key">
              API Key User (msk_...)
            </label>
            <input
              id="msaku-gate-key"
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleLogin()
              }}
              placeholder="msk_..."
              autoComplete="off"
              style={{
                width: "100%",
                boxSizing: "border-box",
                height: 44,
                padding: "0 12px",
                fontSize: 14,
                background: "#0e0f11",
                color: "#e4e4e7",
                border: "1px solid #222327",
                borderRadius: 6,
                marginBottom: 12,
              }}
            />
            {error && <p style={{ fontSize: 13, color: "#f87171", margin: "0 0 12px" }}>{error}</p>}
            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={busy}
              style={{
                width: "100%",
                height: 44,
                fontSize: 14,
                fontWeight: 600,
                background: "#e4e4e7",
                color: "#0e0f11",
                border: "none",
                borderRadius: 6,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {busy ? "Memeriksa…" : "Masuk ke Studio"}
            </button>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: "#71717a", margin: "16px 0 0" }}>
              Kunci tidak pernah ditampilkan kembali di halaman ini. Untuk ganti akun, hapus data situs
              gateway.msaku.id di pengaturan browser, lalu buka ulang halaman ini.
            </p>
          </>
        )}
      </div>

      {/* ── Branding provider berjalan, ala seksi homepage router.bynara.id ── */}
      <section
        style={{
          width: "100%",
          maxWidth: 860,
          textAlign: "center",
          marginTop: 72,
        }}
      >
        <h2
          style={{
            fontSize: "clamp(28px, 6vw, 40px)",
            lineHeight: 1.15,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            margin: "0 0 12px",
          }}
        >
          Route Requests Across Top AI Providers.
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa", margin: "0 0 36px" }}>
          Switch providers without changing your integration.
        </p>
        <div
          className="msaku-brand-marquee"
          style={{
            overflow: "hidden",
            maskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
          }}
        >
          <div className="msaku-brand-track" style={{ display: "flex", width: "max-content" }}>
            {[...TOP_PROVIDER_BRANDS, ...TOP_PROVIDER_BRANDS].map((brand, i) => (
              <span
                key={i}
                aria-hidden={i >= TOP_PROVIDER_BRANDS.length}
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  color: "#52525b",
                  whiteSpace: "nowrap",
                  paddingRight: 56,
                }}
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
