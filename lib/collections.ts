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

const KEY = "ai_tester_collections_v1"

const DEFAULT_COLORS = [
  "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "bg-purple-500/15 text-purple-400 border-purple-500/25",
  "bg-green-500/15 text-green-400 border-green-500/25",
  "bg-orange-500/15 text-orange-400 border-orange-500/25",
  "bg-pink-500/15 text-pink-400 border-pink-500/25",
  "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
]

export function getColorForIndex(i: number): string {
  return DEFAULT_COLORS[i % DEFAULT_COLORS.length]
}

function load(): Collection[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Collection[]
  } catch { return [] }
}

function save(cols: Collection[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(cols)) }
  catch { /* quota */ }
}

export function getCollections(): Collection[] { return load() }

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

export function deleteCollection(id: string): void {
  save(load().filter((c) => c.id !== id))
}

export function renameCollection(id: string, name: string): void {
  save(load().map((c) => c.id === id ? { ...c, name } : c))
}

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

export function deleteRequestFromCollection(collectionId: string, requestId: string): void {
  save(load().map((c) =>
    c.id === collectionId
      ? { ...c, requests: c.requests.filter((r) => r.id !== requestId) }
      : c
  ))
}
