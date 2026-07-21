/**
 * lib/collections.ts — Saved request collections stored in localStorage.
 * A collection groups saved prompts/configs under a named folder.
 */

export interface SavedRequest {
  id: string
  name: string
  provider: string
  providerName: string
  endpoint: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  headers: Record<string, string>
  body?: string
  prompt?: string
  systemPrompt?: string
  model?: string
  createdAt: number
}

export interface Collection {
  id: string
  name: string
  color: string
  requests: SavedRequest[]
  createdAt: number
}

/** localStorage key — bump suffix when the `Collection` shape changes. */
const KEY = "ai_tester_collections_v1"

/**
 * Rotating Tailwind color presets used to auto-assign a color to each new
 * collection so they are visually distinguishable in the sidebar.
 * The palette cycles when more than 6 collections exist.
 */
const DEFAULT_COLORS = [
  "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "bg-purple-500/15 text-purple-400 border-purple-500/25",
  "bg-green-500/15 text-green-400 border-green-500/25",
  "bg-orange-500/15 text-orange-400 border-orange-500/25",
  "bg-pink-500/15 text-pink-400 border-pink-500/25",
  "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
]

/**
 * Return the Tailwind color preset for the `i`-th collection.
 * Wraps around using modulo so the palette repeats indefinitely.
 *
 * @param i - Zero-based index (usually `collections.length` at creation time).
 * @returns A Tailwind class string combining bg, text, and border colors.
 */
export function getColorForIndex(i: number): string {
  return DEFAULT_COLORS[i % DEFAULT_COLORS.length]
}

/**
 * Load all collections from localStorage.
 * Returns `[]` server-side or when storage is empty/corrupt.
 * @internal
 */
function load(): Collection[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Collection[]
  } catch { return [] }
}

/**
 * Persist the full collections array to localStorage.
 * Silently swallows `QuotaExceededError`.
 * @internal
 */
function save(cols: Collection[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(cols)) }
  catch { /* quota */ }
}

/**
 * Return all saved collections.
 *
 * @returns Array of `Collection` objects, or `[]` if none exist.
 */
export function getCollections(): Collection[] { return load() }

/**
 * Create a new empty collection with an auto-assigned color.
 *
 * The collection is immediately persisted to localStorage. Its `id` is a
 * collision-resistant string prefixed with `col_`.
 *
 * @param name - Display name for the new collection.
 * @returns The newly created `Collection` object.
 */
export function createCollection(name: string): Collection {
  const cols = load()
  const col: Collection = {
    id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    color: getColorForIndex(cols.length),
    requests: [],
    createdAt: Date.now(),
  }
  save([...cols, col])
  return col
}

/**
 * Permanently delete a collection and all its saved requests.
 *
 * @param id - The `Collection.id` to remove.
 */
export function deleteCollection(id: string): void {
  save(load().filter((c) => c.id !== id))
}

/**
 * Rename an existing collection.
 *
 * @param id   - The `Collection.id` to update.
 * @param name - New display name.
 */
export function renameCollection(id: string, name: string): void {
  save(load().map((c) => c.id === id ? { ...c, name } : c))
}

/**
 * Append a new saved request to an existing collection.
 *
 * Auto-assigns `id` (prefixed `req_`) and `createdAt`. The request is
 * appended to the collection's `requests` array in place.
 *
 * @param collectionId - Target `Collection.id`.
 * @param req          - All `SavedRequest` fields except `id` and `createdAt`.
 * @returns The fully populated `SavedRequest` that was saved.
 */
export function addRequestToCollection(collectionId: string, req: Omit<SavedRequest, "id" | "createdAt">): SavedRequest {
  const saved: SavedRequest = {
    ...req,
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  }
  save(load().map((c) =>
    c.id === collectionId ? { ...c, requests: [...c.requests, saved] } : c
  ))
  return saved
}

/**
 * Remove a single saved request from a collection.
 *
 * @param collectionId - The parent `Collection.id`.
 * @param requestId    - The `SavedRequest.id` to remove.
 */
export function deleteRequestFromCollection(collectionId: string, requestId: string): void {
  save(load().map((c) =>
    c.id === collectionId
      ? { ...c, requests: c.requests.filter((r) => r.id !== requestId) }
      : c
  ))
}
