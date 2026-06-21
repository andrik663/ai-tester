"use client"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkingKeyRecord {
  id: string             // unique: `${providerId}::${modelId}::${timestamp}`
  providerId: string     // e.g. "cerebras"
  providerName: string   // e.g. "Cerebras"
  apiKey: string         // the key that worked
  modelId: string        // e.g. "zai-glm-4.7"
  latencyMs: number
  tokenUsage?: { prompt?: number; completion?: number; total?: number }
  savedAt: number        // Date.now()
}

const STORAGE_KEY = "ai_tester_working_keys_v1"

// ── Read ──────────────────────────────────────────────────────────────────────

export function loadWorkingKeys(): WorkingKeyRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as WorkingKeyRecord[]
  } catch {
    return []
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────

export function saveWorkingKeys(records: WorkingKeyRecord[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch { /* quota exceeded — silently skip */ }
}

// ── Append new passing results (deduplicates by providerId + modelId + apiKey) ─

export function appendWorkingResults(
  providerId: string,
  providerName: string,
  apiKey: string,
  results: Array<{
    modelId: string
    latencyMs: number
    tokenUsage?: { prompt?: number; completion?: number; total?: number }
  }>,
): WorkingKeyRecord[] {
  const existing = loadWorkingKeys()

  const newRecords: WorkingKeyRecord[] = results.map((r) => ({
    id: `${providerId}::${r.modelId}::${Date.now()}`,
    providerId,
    providerName,
    apiKey,
    modelId: r.modelId,
    latencyMs: r.latencyMs,
    tokenUsage: r.tokenUsage,
    savedAt: Date.now(),
  }))

  // Deduplicate: if same provider + model + key already saved, replace it
  const deduped = [
    ...existing.filter(
      (e) =>
        !newRecords.some(
          (n) =>
            n.providerId === e.providerId &&
            n.modelId === e.modelId &&
            n.apiKey === e.apiKey,
        ),
    ),
    ...newRecords,
  ]

  saveWorkingKeys(deduped)
  return deduped
}

// ── Delete one record ──────────────────────────────────────────────────────────

export function deleteWorkingKey(id: string): WorkingKeyRecord[] {
  const updated = loadWorkingKeys().filter((r) => r.id !== id)
  saveWorkingKeys(updated)
  return updated
}

// ── Clear all ─────────────────────────────────────────────────────────────────

export function clearAllWorkingKeys(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}
