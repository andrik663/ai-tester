/**
 * lib/history.ts — Request history stored in localStorage.
 * Keeps the last 100 entries, newest first (LIFO).
 */

export interface HistoryEntry {
  id: string
  ts: number               // epoch ms
  provider: string
  providerName: string
  model?: string
  prompt: string
  reply?: string
  ok: boolean
  status: number
  durationMs?: number
  ttftMs?: number | null
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  responseHeaders?: Record<string, string>
  curlFull?: string
}

const KEY = "ai_tester_history_v1"
const MAX = 100

function load(): HistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as HistoryEntry[]
  } catch {
    return []
  }
}

function save(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)))
  } catch { /* quota exceeded — ignore */ }
}

export function pushHistory(entry: Omit<HistoryEntry, "id" | "ts">): HistoryEntry {
  const full: HistoryEntry = {
    ...entry,
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
  }
  const existing = load()
  save([full, ...existing])
  return full
}

export function getHistory(): HistoryEntry[] {
  return load()
}

export function clearHistory(): void {
  localStorage.removeItem(KEY)
}

export function deleteHistoryEntry(id: string): void {
  save(load().filter((e) => e.id !== id))
}
