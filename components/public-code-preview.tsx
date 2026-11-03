"use client"

import { useEffect, useRef, useState } from "react"
import CodePreviewTab from "@/components/code-preview-tab"

const DEFAULT_PUBLIC_KEY = "msaku_pub_v1_free_gateway_2026"
const STORAGE_USER_KEY = "msaku_gateway_user_api_key"

/**
 * Public-facing single-page dashboard at gateway.msaku.id.
 *
 * Supports two API key modes right from the top bar:
 * 1. API Key Publik (`msaku_pub_v1_free_gateway_2026`) — free shared key (20 req/min)
 * 2. API Key User MSAKU (`msk_...`) — personal key for registered msaku.id users (120 req/min)
 */
export default function PublicCodePreview() {
  const [chatModel, setChatModel] = useState("")
  const [workingModels, setWorkingModels] = useState<Array<{ modelId: string; apiKey: string; latencyMs: number }>>([])
  const [publicKey, setPublicKey] = useState(DEFAULT_PUBLIC_KEY)
  const [userKey, setUserKey] = useState("")
  const [activeTier, setActiveTier] = useState<"public" | "msaku_user">("public")
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [keyInput, setKeyInput] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copiedPub, setCopiedPub] = useState(false)

  const lastFetched = useRef(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_USER_KEY)
      if (saved && saved.trim()) {
        setUserKey(saved.trim())
        setKeyInput(saved.trim())
        setActiveTier("msaku_user")
      }
    } catch {}
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchModels = async () => {
      try {
        const res = await fetch("/api/v1/models")
        if (!res.ok || cancelled) return
        const data = (await res.json()) as {
          data?: Array<{ id: string }>
          _msaku?: { publicKey?: string }
        }
        if (cancelled) return
        if (data._msaku?.publicKey) {
          setPublicKey(data._msaku.publicKey)
        }
        const models = (data.data ?? []).filter((m) => m.id !== "msaku/auto" && m.id !== "miuclaw/auto")
        if (models.length === 0) return
        setWorkingModels(models.map((m) => ({ modelId: m.id, apiKey: "", latencyMs: -1 })))
        setChatModel((prev) => prev || models[0].id)
      } catch {
        // Network error — leave empty, CodePreviewTab falls back to "msaku/auto"
      }
    }
    fetchModels()
    lastFetched.current = true
    return () => { cancelled = true }
  }, [])

  async function handleSaveUserKey() {
    const trimmed = keyInput.trim()
    if (!trimmed) {
      try { localStorage.removeItem(STORAGE_USER_KEY) } catch {}
      setUserKey("")
      setActiveTier("public")
      setVerifyMsg({ ok: true, text: "Beralih ke API Key Publik." })
      return
    }
    setVerifying(true)
    setVerifyMsg(null)
    try {
      const res = await fetch("/api/v1/keys/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: trimmed }),
      })
      const data = await res.json()
      if (!res.ok || !data.valid) {
        setVerifyMsg({ ok: false, text: data.error || "API Key tidak valid." })
        return
      }
      try { localStorage.setItem(STORAGE_USER_KEY, trimmed) } catch {}
      setUserKey(trimmed)
      setActiveTier(data.tier === "public" ? "public" : "msaku_user")
      setVerifyMsg({
        ok: true,
        text: `Key aktif (${data.keyLabel || data.tier} — ${data.rateLimitPerMinute ?? 120} req/menit).`,
      })
    } catch {
      setVerifyMsg({ ok: false, text: "Gagal memverifikasi key." })
    } finally {
      setVerifying(false)
    }
  }

  function copyPublicKey() {
    navigator.clipboard.writeText(publicKey).then(() => {
      setCopiedPub(true)
      setTimeout(() => setCopiedPub(false), 1800)
    }).catch(() => {})
  }

  const effectiveKey = activeTier === "msaku_user" && userKey ? userKey : publicKey

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground font-sans overflow-hidden">
      {/* Top bar for Public API Key & MSAKU Registered User API Key */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-border/50 bg-secondary/20 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-foreground truncate">Msaku Gateway</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
            activeTier === "msaku_user"
              ? "bg-primary/15 text-primary border-primary/30"
              : "bg-muted/50 text-muted-foreground border-border"
          }`}>
            {activeTier === "msaku_user" ? `User MSAKU (${userKey.slice(0, 10)}•••)` : "Public Key (20 req/m)"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowKeyModal((v) => !v)}
            className="px-2.5 py-1 rounded-md border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-medium text-[11px] transition-colors"
          >
            {showKeyModal ? "Tutup API Key" : "API Key Publik & User MSAKU"}
          </button>
          <a
            href="/docs"
            className="px-2 py-1 rounded-md border border-border hover:bg-secondary/50 text-muted-foreground hover:text-foreground text-[11px] transition-colors"
          >
            Docs
          </a>
        </div>
      </div>

      {showKeyModal && (
        <div className="border-b border-border bg-card px-3 py-3 text-xs">
          <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Public API Key Card */}
            <div className="p-3 rounded-lg border border-border/70 bg-secondary/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">1. API Key Publik (Gratis)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">20 req/menit</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Bisa langsung dipakai untuk testing di kodingan / SDK OpenAI tanpa login:
              </p>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 truncate px-2 py-1.5 rounded border border-border bg-background font-mono text-[11px] text-foreground">
                  {publicKey}
                </code>
                <button
                  type="button"
                  onClick={copyPublicKey}
                  className="px-2.5 py-1.5 rounded border border-border bg-background hover:bg-secondary text-[11px] font-medium shrink-0"
                >
                  {copiedPub ? "Tersalin!" : "Salin"}
                </button>
              </div>
            </div>

            {/* Registered MSAKU User API Key Card */}
            <div className="p-3 rounded-lg border border-primary/25 bg-primary/5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">2. API Key User Terdaftar MSAKU.ID</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono">120 req/menit</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Khusus user yang sudah registrasi di{" "}
                <a
                  href="https://msaku.id/gateway"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 font-medium"
                >
                  msaku.id/gateway
                </a>{" "}
                atau{" "}
                <a
                  href="https://msaku.id/profil/api-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 font-medium"
                >
                  msaku.id/profil/api-key
                </a>:
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Tempel key msk_... Anda di sini"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded border border-border bg-background font-mono text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={handleSaveUserKey}
                  disabled={verifying}
                  className="px-2.5 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 text-[11px] font-medium shrink-0 disabled:opacity-50"
                >
                  {verifying ? "Cek..." : "Gunakan"}
                </button>
              </div>
              {verifyMsg && (
                <p className={`text-[11px] ${verifyMsg.ok ? "text-emerald-400" : "text-destructive"}`}>
                  {verifyMsg.text}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CodePreviewTab
          provider="msaku"
          providerName="Msaku Gateway"
          apiKey={effectiveKey}
          endpoint="https://gateway.msaku.id/api/v1/chat/completions"
          headers={{ Authorization: "Bearer {{API_KEY}}", "Content-Type": "application/json" }}
          model={chatModel || "msaku/auto"}
          onModelChange={setChatModel}
          workingModels={workingModels}
          presetModels={[{ id: "msaku/auto", label: "Auto (fastest key)" }]}
          isMiuclaw
        />
      </div>
    </div>
  )
}
