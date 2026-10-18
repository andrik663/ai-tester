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

// Indonesia declared independence on 17 August 1945 — the "ke-N" ordinal is
// just the number of years since, computed live so it never goes stale.
const INDONESIA_INDEPENDENCE_YEAR = 1945
function independenceOrdinal(): number {
  const now = new Date()
  const anniversaryYear = now.getFullYear()
  // Before Aug 17 in the current year, the anniversary hasn't happened yet.
  const passedThisYear = now.getMonth() > 7 || (now.getMonth() === 7 && now.getDate() >= 17)
  return (passedThisYear ? anniversaryYear : anniversaryYear - 1) - INDONESIA_INDEPENDENCE_YEAR
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to load comments")
  return res.json()
})

// Wide, saturated palettes for both the background wash and the identicon
// glyph itself. DiceBear picks pseudo-randomly *within* whatever list you
// give it per seed — the previous URL supplied neither `backgroundColor`
// nor `rowColor`, so every avatar fell back to the same default pair and
// only the seed's shape differed, reading as "monotone". Two long, hue-
// spread lists (never adjacent) make each commenter visibly distinct.
const AVATAR_BG_COLORS = [
  "f87171", "fb923c", "fbbf24", "a3e635", "4ade80",
  "34d399", "2dd4bf", "22d3ee", "38bdf8", "60a5fa",
  "818cf8", "a78bfa", "c084fc", "e879f9", "f472b6",
]
const AVATAR_ROW_COLORS = [
  "7f1d1d", "78350f", "713f12", "365314", "064e3b",
  "134e4a", "164e63", "1e3a8a", "312e81", "4a044e",
  "581c87", "831843", "9d174d", "1e293b", "052e16",
]

function avatarUrl(seed: string): string {
  const params = new URLSearchParams({
    seed,
    backgroundType: "gradientLinear",
    backgroundColor: AVATAR_BG_COLORS.join(","),
    backgroundColorOrder: "random",
    rowColor: AVATAR_ROW_COLORS.join(","),
    rowColorOrder: "random",
  })
  return `https://api.dicebear.com/9.x/identicon/svg?${params.toString()}`
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
  const inIndependenceMode = showIndependence || !hasComments
  const independenceText = `Dirgahayu Republik Indonesia ke-${independenceOrdinal()}`

  return (
    <>
      <div
        className="relative w-full h-9 border-b border-border/40 overflow-hidden flex items-center"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Both states stay mounted and marqueeing at all times, stacked on
            top of each other, and cross-fade via opacity — swapping the
            layer's whole class list on toggle (as before) snapped instantly
            because the two backgrounds are gradients, not a single
            background-color Tailwind's `transition-colors` can tween. This
            way the outgoing state visibly dissolves into the incoming one. */}
        <div
          className={`absolute inset-0 flex items-center id-flag-banner id-flag-sheen transition-opacity duration-[900ms] ease-in-out ${
            inIndependenceMode ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!inIndependenceMode}
        >
          <div className="relative flex items-center gap-10 whitespace-nowrap animate-marquee will-change-transform">
            {[0, 1].map((rep) => (
              <div key={rep} className="flex items-center gap-10 shrink-0">
                {Array.from({ length: hasComments ? 1 : 3 }).map((_, i) => (
                  <span
                    key={`${rep}-${i}`}
                    className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-id-banner-fg shrink-0"
                  >
                    <span className="text-id-banner-accent" aria-hidden="true">🇮🇩</span>
                    {independenceText}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div
          className={`absolute inset-0 flex items-center feedback-ticker-bg feedback-sheen transition-opacity duration-[900ms] ease-in-out ${
            inIndependenceMode ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden={inIndependenceMode}
        >
          {/* Feedback state — quiet dark strip on the shared banner
              gradient vars, each comment rendered as its own pill with
              avatar, name, and a subtle pulsing LIVE badge leading the
              track for an at-a-glance cue that this is real people's
              feedback, not the flag banner. */}
          <div className="relative flex items-center gap-3 whitespace-nowrap animate-marquee will-change-transform">
            {[0, 1].map((rep) => (
              <div key={rep} className="flex items-center gap-3 shrink-0">
                <span className="flex items-center gap-1.5 shrink-0 rounded-full bg-feedback-accent/15 px-2 py-0.5">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-feedback-accent animate-live-pulse" />
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-feedback-accent">Live</span>
                </span>
                {comments.map((c) => (
                  <span
                    key={`${rep}-${c.id}`}
                    className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-feedback-fg shrink-0 rounded-full bg-black/25 border border-feedback-accent/20 pl-1 pr-3 py-1"
                  >
                    <img
                      src={avatarUrl(c.avatarSeed) || "/placeholder.svg"}
                      alt=""
                      crossOrigin="anonymous"
                      className="w-4.5 h-4.5 rounded-full ring-1 ring-feedback-accent/70 shrink-0"
                    />
                    <span className="text-feedback-accent font-semibold">{c.name}</span>
                    <span className="text-feedback-fg/40">·</span>
                    <span>{c.message}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <span className="sr-only">
          {inIndependenceMode ? independenceText : "Komentar dan feedback publik"}
        </span>

        {/* Fade + pinned feedback trigger, sits above both layers and
            cross-fades the same way so its backdrop never snaps either. */}
        <div className="absolute right-0 top-0 h-full flex items-center pl-6 pr-1.5 z-10">
          <div
            className={`absolute inset-0 bg-gradient-to-l from-[var(--id-banner-bg-start)] via-[var(--id-banner-bg-start)]/90 to-transparent transition-opacity duration-[900ms] ease-in-out ${
              inIndependenceMode ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`absolute inset-0 bg-gradient-to-l from-[var(--feedback-bg-start)] via-[var(--feedback-bg-start)]/90 to-transparent transition-opacity duration-[900ms] ease-in-out ${
              inIndependenceMode ? "opacity-0" : "opacity-100"
            }`}
          />
          <button
            onClick={() => setIsModalOpen(true)}
            className={`relative flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold transition-colors duration-500 ${
              inIndependenceMode
                ? "border-id-banner-accent/50 bg-black/15 text-id-banner-fg hover:bg-black/25"
                : "border-feedback-accent/50 bg-black/25 text-feedback-fg hover:bg-black/40"
            }`}
          >
            <span className={inIndependenceMode ? "text-id-banner-accent" : "text-feedback-accent"}>
              <MessageIcon />
            </span>
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
