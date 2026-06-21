"use client"

import { useState } from "react"
import ApiKeyScraper from "@/components/api-key-scraper"
import ManualKeyTester from "@/components/manual-key-tester"

type Tab = "manual" | "scraper"

// ── Icons ─────────────────────────────────────────────────────────────────────

function TerminalIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}


function KeyScanIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 8.5l-5-5-5.5 5.5" />
      <path d="M15.5 2.5l1 1" />
      <path d="M18 5l1 1" />
    </svg>
  )
}

function MenuIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function CloseIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Tab; label: string; description: string; icon: React.FC<{ className?: string }>; badge?: string }[] = [
  {
    id: "manual",
    label: "API Key Tester",
    description: "Chat · Vision · OCR · Gemini · Image · Video",
    icon: TerminalIcon,
  },
  {
    id: "scraper",
    label: "API Key Scraper",
    description: "Find leaked API keys in repos",
    icon: KeyScanIcon,
  },
]

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  tab,
  onSelect,
  onClose,
}: {
  tab: Tab
  onSelect: (t: Tab) => void
  onClose?: () => void
}) {
  return (
    <nav className="flex flex-col h-full bg-card border-r border-border" aria-label="Main navigation">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-foreground flex items-center justify-center flex-shrink-0">
            <span className="text-background text-[10px] font-bold font-mono leading-none">AI</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">API Tester</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">Developer Tools</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 lg:hidden"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-3 px-3">
        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = tab === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id)
                  onClose?.()
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors w-full group ${
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium leading-tight truncate">{item.label}</span>
                  {item.badge && (
                    <span className="inline-block mt-0.5 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground leading-none">
                      {item.badge}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border flex-shrink-0">
        <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
          Test AI APIs directly with your own keys. No data stored.
        </p>
      </div>
    </nav>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Page() {
  const [tab, setTab] = useState<Tab>("manual")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const activeItem = NAV_ITEMS.find((n) => n.id === tab)!

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">

      {/* ── Desktop sidebar (always visible ≥ lg) ──────────────────────── */}
      <div className="hidden lg:flex lg:w-56 lg:flex-shrink-0 h-full">
        <Sidebar tab={tab} onSelect={setTab} />
      </div>

      {/* ── Mobile drawer overlay ────────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 bottom-0 w-64 z-50">
            <Sidebar tab={tab} onSelect={setTab} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <activeItem.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{activeItem.label}</span>
          </div>
          {activeItem.badge && (
            <span className="ml-auto text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
              {activeItem.badge}
            </span>
          )}
        </div>

        {/* Content panels */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className={tab === "manual" ? "h-full" : "hidden h-full"}>
            <ManualKeyTester />
          </div>
          <div className={tab === "scraper" ? "h-full" : "hidden h-full"}>
            <ApiKeyScraper />
          </div>
        </div>

      </div>
    </div>
  )
}
