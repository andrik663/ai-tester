"use client"

import { useEffect, useRef, useState } from "react"
import CodePreviewTab from "@/components/code-preview-tab"

const DEFAULT_PUBLIC_KEY = "msaku_pub_v1_free_gateway_2026"
const STORAGE_USER_KEY = "msaku_gateway_user_api_key"

/**
 * Public-facing single-page dashboard at gateway.msaku.id.
 *
 * Supports two distinct API key roles right from the top bar:
 * 1. API Key Publik (`msaku_pub_v1_free_gateway_2026`) — khusus untuk Custom Gateway (seperti `https://free.ai.id/`)
 * 2. API Key User MSAKU (`msk_...`) — khusus untuk mengakses `https://gateway.msaku.id` bagi user terdaftar msaku.id (120 req/min)
 */
export default function PublicCodePreview() {
  const [chatModel, setChatModel] = useState("")
  const [workingModels, setWorkingModels] = useState<Array<{ modelId: string; apiKey: string; latencyMs: number }>>([])
  const [publicKey, setPublicKey] = useState(DEFAULT_PUBLIC_KEY)
  const [userKey, setUserKey] = useState("")
  const [activeTier, setActiveTier] = useState<"public" | "msaku_user">("public")
  const [customGatewayEndpoint, setCustomGatewayEndpoint] = useState("https://free.ai.id/v1/chat/completions")
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
  const effectiveEndpoint =
    activeTier === "msaku_user" && userKey
      ? "https://gateway.msaku.id/api/v1/chat/completions"
      : customGatewayEndpoint

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground font-sans overflow-hidden">
      {/* Top bar for Public API Key (Custom Gateway) & MSAKU Registered User API Key (gateway.msaku.id) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-border/50 bg-secondary/20 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-foreground truncate">Msaku Gateway</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
            activeTier === "msaku_user"
              ? "bg-primary/15 text-primary border-primary/30"
              : "bg-muted/50 text-muted-foreground border-border"
          }`}>
            {activeTier === "msaku_user"
              ? `User Key → gateway.msaku.id (${userKey.slice(0, 10)}•••)`
              : "Public Key → Custom Gateway (free.ai.id)"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowKeyModal((v) => !v)}
            className="px-2.5 py-1 rounded-md border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-medium text-[11px] transition-colors"
          >
            {showKeyModal ? "Tutup API Key" : "API Key Publik (Custom) & Key User (gateway.msaku.id)"}
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
            {/* Public API Key Card (for Custom Gateway e.g. https://free.ai.id/) */}
            <div className="p-3 rounded-lg border border-border/70 bg-secondary/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">1. API Key Publik (Custom Gateway)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">free.ai.id</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Fungsi <strong>API Key Publik</strong> adalah untuk terhubung ke <strong>Custom Gateway</strong> seperti{" "}
                <a href="https://free.ai.id/" target="_blank" rel="noopener noreferrer" className="text-primary underline font-mono">
                  https://free.ai.id/
                </a>:
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
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-muted-foreground shrink-0">Custom URL:</span>
                <input
                  type="text"
                  value={customGatewayEndpoint}
                  onChange={(e) => setCustomGatewayEndpoint(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 rounded border border-border bg-background font-mono text-[10.5px] text-foreground"
                />
              </div>
            </div>

            {/* Registered MSAKU User API Key Card (for gateway.msaku.id) */}
            <div className="p-3 rounded-lg border border-primary/25 bg-primary/5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">2. API Key User (Akses gateway.msaku.id)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono">120 req/menit</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Untuk mengakses <strong>gateway.msaku.id</strong>, wajib menggunakan <strong>API Key User</strong> (<code className="font-mono">msk_...</code>) yang dibuat di{" "}
                <a
                  href="https://msaku.id/gateway"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 font-medium"
                >
                  msaku.id/gateway
                </a>:
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Tempel key user msk_... Anda di sini"
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
          providerName={activeTier === "msaku_user" ? "Msaku Gateway (gateway.msaku.id)" : "Custom Gateway (free.ai.id)"}
          apiKey={effectiveKey}
          endpoint={effectiveEndpoint}
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
