"use client"

import { useState } from "react"
import Chat from "@/components/chat"
import VideoTester from "@/components/video-tester"
import ImageTester from "@/components/image-tester"
import ApiKeyScraper from "@/components/api-key-scraper"

type Tab = "chat" | "video" | "image" | "scraper"

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function KeyScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 8.5l-5-5-5.5 5.5" />
      <path d="M15.5 2.5l1 1" />
      <path d="M18 5l1 1" />
    </svg>
  )
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("chat")

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* Tab bar */}
      <nav className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card flex-shrink-0" role="tablist">
        <div className="flex items-center gap-2 mr-3">
          <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-[9px] font-bold font-mono">G</span>
          </div>
          <span className="text-xs font-semibold text-foreground">Gemini API Tester</span>
        </div>

        <div className="h-4 w-px bg-border mx-1" />

        {([
          { id: "chat", label: "Chat", icon: <MessageIcon /> },
          { id: "image", label: "Image Generation", icon: <ImageIcon />, badge: "Nano Banana" },
          { id: "video", label: "Video Generation", icon: <VideoIcon />, badge: "Veo 3.1" },
          { id: "scraper", label: "API Key Scraper", icon: <KeyScanIcon /> },
        ] as { id: Tab; label: string; icon: React.ReactNode; badge?: string }[]).map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            {t.icon}
            {t.label}
            {t.badge && (
              <span className="ml-0.5 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={tab === "chat" ? "h-full" : "hidden h-full"}>
          <Chat />
        </div>
        <div className={tab === "image" ? "h-full" : "hidden h-full"}>
          <ImageTester />
        </div>
        <div className={tab === "video" ? "h-full" : "hidden h-full"}>
          <VideoTester />
        </div>
        <div className={tab === "scraper" ? "h-full" : "hidden h-full"}>
          <ApiKeyScraper />
        </div>
      </div>
    </div>
  )
}
