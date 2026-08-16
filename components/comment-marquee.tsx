"use client"

import { useEffect, useState, useRef } from "react"
import useSWR from "swr"

/**
 * Header ticker — public feedback (Neon-backed) + Independence Day banner.
 *
 * Behaviour:
 * - Most of the time the strip scrolls the latest public comments, each with
 *   a random per-commenter avatar (DiceBear identicon seeded server-side).
 *   New comments show up automatically via SWR polling — no page reload.
 * - Every 3 minutes the strip switches to a short "Dirgahayu Republik
 *   Indonesia 🇮🇩" message for one loop, then goes back to comments.
 * - A small "Feedback" button pinned to the right opens a modal to post a
 *   new public comment (name optional, message required).
 */

interface Comment {
  id: number
  name: string
  message: string
  avatarSeed: string
  tsMs: number
}

const MAX_MESSAGE_LENGTH = 140
const MAX_NAME_LENGTH = 24
const INDEPENDENCE_INTERVAL_MS = 3 * 60 * 1000 // every 3 minutes
const INDEPENDENCE_DURATION_MS = 20_000 // ~one marquee loop

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to load comments")
  return res.json()
})

function avatarUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear`
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function CommentMarquee() {
  const { data, mutate } = useSWR<{ comments: Comment[] }>("/api/comments?limit=15", fetcher, {
    refreshInterval: 6_000,
    revalidateOnFocus: false,
  })
  const comments = data?.comments ?? []

  const [showIndependence, setShowIndependence] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Every 3 minutes, briefly switch the strip to the Independence Day message
  useEffect(() => {
    const interval = setInterval(() => {
      setShowIndependence(true)
      const revert = setTimeout(() => setShowIndependence(false), INDEPENDENCE_DURATION_MS)
      return () => clearTimeout(revert)
    }, INDEPENDENCE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (isModalOpen) textareaRef.current?.focus()
  }, [isModalOpen])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Gagal mengirim komentar")
        return
      }
      setSuccess(true)
      setMessage("")
      mutate() // refresh ticker immediately with the new comment
      setTimeout(() => {
        setSuccess(false)
        setIsModalOpen(false)
      }, 1200)
    } catch {
      setError("Gagal mengirim komentar — coba lagi")
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasComments = comments.length > 0

  return (
    <>
      <div
        className="id-flag-banner id-flag-sheen relative w-full h-9 border-b border-border/40 overflow-hidden flex items-center"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {showIndependence || !hasComments ? (
          <div
            className="relative flex items-center gap-10 whitespace-nowrap animate-marquee will-change-transform"
            aria-hidden="true"
          >
            {[0, 1].map((rep) => (
              <div key={rep} className="flex items-center gap-10 shrink-0">
                {Array.from({ length: hasComments ? 1 : 3 }).map((_, i) => (
                  <span
                    key={`${rep}-${i}`}
                    className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-id-banner-fg shrink-0"
                  >
                    <span className="text-id-banner-accent" aria-hidden="true">🇮🇩</span>
                    Dirgahayu Republik Indonesia
                  </span>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="relative flex items-center gap-8 whitespace-nowrap animate-marquee will-change-transform"
            aria-hidden="true"
          >
            {[0, 1].map((rep) => (
              <div key={rep} className="flex items-center gap-8 shrink-0">
                {comments.map((c) => (
                  <span
                    key={`${rep}-${c.id}`}
                    className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-id-banner-fg shrink-0"
                  >
                    <img
                      src={avatarUrl(c.avatarSeed) || "/placeholder.svg"}
                      alt=""
                      crossOrigin="anonymous"
                      className="w-4 h-4 rounded-full ring-1 ring-id-banner-accent/60 shrink-0"
                    />
                    <span className="text-id-banner-accent font-semibold">{c.name}:</span>
                    <span>{c.message}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}

        <span className="sr-only">Dirgahayu Republik Indonesia — komentar dan feedback publik</span>

        {/* Fade + pinned feedback trigger, sits above the scrolling track */}
        <div className="absolute right-0 top-0 h-full flex items-center pl-6 pr-1.5 bg-gradient-to-l from-[var(--id-banner-bg-start)] via-[var(--id-banner-bg-start)]/90 to-transparent">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1 rounded-full border border-id-banner-accent/50 bg-black/15 px-2 py-1 text-[10px] font-semibold text-id-banner-fg hover:bg-black/25 transition-colors"
          >
            <span className="text-id-banner-accent"><MessageIcon /></span>
            <span className="hidden sm:inline">Feedback</span>
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false) }}
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 id="feedback-modal-title" className="text-sm font-semibold text-foreground">
                Kirim feedback publik
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <CloseIcon />
              </button>
            </div>

            {success ? (
              <p className="text-[13px] text-primary py-4 text-center">Terima kasih! Komentarmu sudah tayang di header.</p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama (opsional)"
                  maxLength={MAX_NAME_LENGTH}
                  className="text-[12px] bg-background text-foreground border border-border rounded-md px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tulis komentar atau masukanmu..."
                  maxLength={MAX_MESSAGE_LENGTH}
                  rows={3}
                  required
                  className="text-[12px] bg-background text-foreground border border-border rounded-md px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{message.length}/{MAX_MESSAGE_LENGTH}</span>
                  {error && <span className="text-[10px] text-destructive">{error}</span>}
                </div>
                <button
                  type="submit"
                  disabled={!message.trim() || isSubmitting}
                  className="text-[12px] font-semibold bg-primary text-primary-foreground rounded-md py-2 disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {isSubmitting ? "Mengirim..." : "Kirim komentar"}
                </button>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Komentar tampil publik di header untuk semua pengunjung. Jaga bahasa yang sopan.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
