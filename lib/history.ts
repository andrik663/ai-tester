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

/** localStorage key — bump suffix when the `HistoryEntry` shape changes. */
const KEY = "ai_tester_history_v1"

/** Maximum number of entries retained in localStorage (LIFO eviction). */
const MAX = 100

/**
 * Load all history entries from localStorage.
 * Returns `[]` when called server-side or when storage is empty/corrupt.
 *
 * @internal — use `getHistory()` externally.
 */
function load(): HistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as HistoryEntry[]
  } catch {
    return []
  }
}

/**
 * Persist an array of history entries to localStorage, capped at `MAX` items.
 * Silently swallows `QuotaExceededError`.
 *
 * @param entries - The ordered array to persist (index 0 = newest).
 * @internal
 */
function save(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)))
  } catch { /* quota exceeded — ignore */ }
}

/**
 * Prepend a new request/response entry to the history log.
 *
 * Automatically assigns a collision-resistant `id` and the current `ts`
 * timestamp. The list is capped at `MAX` entries (oldest are evicted).
 *
 * @param entry - All `HistoryEntry` fields except `id` and `ts` (auto-generated).
 * @returns The fully populated `HistoryEntry` that was saved.
 */
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

/**
 * Return all saved history entries, newest first.
 *
 * @returns Array of `HistoryEntry` objects, or `[]` if none are saved.
 */
export function getHistory(): HistoryEntry[] {
  return load()
}

/**
 * Remove all history entries from localStorage.
 * This is irreversible — show a confirmation dialog before calling.
 */
export function clearHistory(): void {
  localStorage.removeItem(KEY)
}

/**
 * Delete a single history entry by its `id`.
 *
 * @param id - The `HistoryEntry.id` to remove.
 */
export function deleteHistoryEntry(id: string): void {
  save(load().filter((e) => e.id !== id))
}
