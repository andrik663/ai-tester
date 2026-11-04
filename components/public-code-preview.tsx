"use client"

import { useEffect, useRef, useState } from "react"
import CodePreviewTab from "@/components/code-preview-tab"
import { KeyRound, Lock, Loader2, ExternalLink } from "lucide-react"

const STORAGE_USER_KEY = "msaku_gateway_user_api_key"

/**
 * Single-page dashboard at gateway.msaku.id.
 *
 * ACCESS GATE: gateway.msaku.id is exclusive to registered MSAKU.id users.
 * Visitors see only a locked verification screen — the dashboard unlocks
 * after a valid personal MSAKU User API Key (msk_...) is verified via
 * POST /api/v1/keys/info. All /api/v1/* endpoints enforce the same rule
 * server-side, so a visitor can never actually use the gateway.
 */
export default function PublicCodePreview() {
  const [chatModel, setChatModel] = useState("")
  const [workingModels, setWorkingModels] = useState<Array<{ modelId: string; apiKey: string; latencyMs: number }>>([])
  const [userKey, setUserKey] = useState("")
  const [keyInput, setKeyInput] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [checkingStored, setCheckingStored] = useState(true)
  const [unlocked, setUnlocked] = useState(false)

  const lastFetched = useRef(false)

  const verifyKey = async (key: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/v1/keys/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      })
      const data = await res.json()
      if (!res.ok || !data.valid || data.tier === "anonymous_read") return false
      return true
    } catch {
      return false
    }
  }

  // On mount: verify the stored key (if any). Otherwise stay locked.
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const saved = localStorage.getItem(STORAGE_USER_KEY)
        if (saved && saved.trim() && (await verifyKey(saved.trim()))) {
          if (cancelled) return
          setUserKey(saved.trim())
          setKeyInput(saved.trim())
          setUnlocked(true)
        }
      } catch {}
      if (!cancelled) setCheckingStored(false)
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  // Load gateway models once unlocked
  useEffect(() => {
    if (!unlocked || lastFetched.current) return
    lastFetched.current = true
    let cancelled = false
    const fetchModels = async () => {
      try {
        const res = await fetch("/api/v1/models", {
          headers: { Authorization: `Bearer ${userKey}` },
        })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as {
          data?: Array<{ id: string }>
        }
        if (cancelled) return
        // msaku/auto & miuclaw/auto are permanently deleted — exclude legacy rows
        const models = (data.data ?? []).filter((m) => m.id !== "msaku/auto" && m.id !== "miuclaw/auto")
        if (models.length === 0) return
        setWorkingModels(models.map((m) => ({ modelId: m.id, apiKey: "", latencyMs: -1 })))
        setChatModel((prev) => prev || models[0].id)
      } catch {
        // Network error — leave empty
      }
    }
    fetchModels()
    return () => {
      cancelled = true
    }
  }, [unlocked, userKey])

  async function handleSaveUserKey() {
    const trimmed = keyInput.trim()
    if (!trimmed) {
      try { localStorage.removeItem(STORAGE_USER_KEY) } catch {}
      setUserKey("")
      setUnlocked(false)
      setVerifyMsg({ ok: false, text: "Masukkan API Key User MSAKU (msk_...) Anda." })
      return
    }
    setVerifying(true)
    setVerifyMsg(null)
    const valid = await verifyKey(trimmed)
    if (!valid) {
      setVerifying(false)
      setVerifyMsg({
        ok: false,
        text: "API Key tidak valid atau bukan milik pengguna terdaftar. Buat key di msaku.id/gateway.",
      })
      return
    }
    try { localStorage.setItem(STORAGE_USER_KEY, trimmed) } catch {}
    setUserKey(trimmed)
    setUnlocked(true)
    setVerifying(false)
    setVerifyMsg({ ok: true, text: "API Key User tervalidasi — dashboard terbuka." })
  }

  function handleLockAgain() {
    try { localStorage.removeItem(STORAGE_USER_KEY) } catch {}
    setUserKey("")
    setKeyInput("")
    setUnlocked(false)
    setWorkingModels([])
    setChatModel("")
    lastFetched.current = false
  }

  // ── Locked gate screen (visitors & invalid keys) ───────────────────────────
  if (checkingStored) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memeriksa akses Msaku Gateway…
        </div>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-lg">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
            <Lock className="size-6 text-primary" />
          </div>
          <h1 className="mt-4 text-lg font-bold tracking-tight text-foreground">
            Msaku Gateway Khusus Pengguna Terdaftar
          </h1>
          <p className="mx-auto mt-2 text-xs leading-relaxed text-muted-foreground">
            <code className="font-mono text-foreground">gateway.msaku.id</code> hanya dapat diakses oleh
            pengguna yang sudah terdaftar di <strong>msaku.id</strong>. Pengunjung tidak diijinkan.
            Masukkan API Key User pribadi Anda (<code className="font-mono">msk_...</code>) untuk membuka dashboard.
          </p>

          <div className="mt-5 flex items-center gap-2">
            <div className="relative flex-1">
              <KeyRound className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveUserKey()
                }}
                placeholder="msk_API_KEY_USER_ANDA"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveUserKey}
              disabled={verifying}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {verifying ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Buka
            </button>
          </div>

          {verifyMsg && (
            <p className={`mt-2.5 text-[11px] ${verifyMsg.ok ? "text-emerald-500" : "text-destructive"}`}>
              {verifyMsg.text}
            </p>
          )}

          <a
            href="https://msaku.id/gateway"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            Daftar / buat API Key User di msaku.id/gateway
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    )
  }

  // ── Unlocked dashboard (verified MSAKU users only) ─────────────────────────
  return (
    <div className="flex flex-col h-dvh bg-background text-foreground font-sans overflow-hidden">
      {/* Top bar — verified user session */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-border/50 bg-secondary/20 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-foreground truncate">Msaku Gateway</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border bg-primary/15 text-primary border-primary/30">
            User Key Aktif ({userKey.slice(0, 10)}•••) · 120 req/menit
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleLockAgain}
            className="px-2 py-1 rounded-md border border-border hover:bg-secondary/50 text-muted-foreground hover:text-foreground text-[11px] transition-colors"
          >
            Kunci / Ganti Key
          </button>
          <a
            href="/docs"
            className="px-2 py-1 rounded-md border border-border hover:bg-secondary/50 text-muted-foreground hover:text-foreground text-[11px] transition-colors"
          >
            Docs
          </a>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CodePreviewTab
          provider="msaku"
          providerName="Msaku Gateway"
          apiKey={userKey}
          endpoint="https://gateway.msaku.id/api/v1/chat/completions"
          headers={{ Authorization: "Bearer {{API_KEY}}", "Content-Type": "application/json" }}
          model={chatModel}
          onModelChange={setChatModel}
          workingModels={workingModels}
          presetModels={[]}
          isMiuclaw
        />
      </div>
    </div>
  )
}
