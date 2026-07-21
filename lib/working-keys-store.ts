"use client"

/**
 * lib/working-keys-store.ts — Client-side store for API keys that passed testing.
 *
 * All data is persisted to `localStorage` under `ai_tester_working_keys_v1`.
 * This module is SSR-safe: every function that touches `localStorage` guards
 * against `typeof window === "undefined"` (Next.js server/edge rendering).
 *
 * Data flow:
 *   batch-test result → appendWorkingResults() → saveWorkingKeys() → localStorage
 *   Component mount   → loadWorkingKeys()      ← localStorage
 *   User delete       → deleteWorkingKey()     → saveWorkingKeys()
 *   User clear all    → clearAllWorkingKeys()  → localStorage.removeItem
 */

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

/** localStorage key — bump the version suffix if the shape changes. */
const STORAGE_KEY = "ai_tester_working_keys_v1"

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Load all working-key records from localStorage.
 *
 * Returns an empty array when called server-side (SSR/Edge) or when no
 * data has been saved yet. JSON parse errors are swallowed and also return [].
 *
 * @returns Array of saved {@link WorkingKeyRecord} objects, newest last.
 */
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

/**
 * Persist the full working-key array to localStorage.
 *
 * Silently skips when called server-side. Swallows `QuotaExceededError`
 * so that a full storage quota never crashes the UI.
 *
 * @param records - The complete set of records to persist (replaces current state).
 */
export function saveWorkingKeys(records: WorkingKeyRecord[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch { /* quota exceeded — silently skip */ }
}

// ── Append new passing results (deduplicates by providerId + modelId + apiKey) ─

/**
 * Append new test-passing results to the store, replacing any existing record
 * that shares the same `providerId + modelId + apiKey` triple (deduplication).
 *
 * Each result in the `results` array is stamped with a unique `savedAt`
 * timestamp (`batchTs + i`) so records created in the same millisecond are
 * still distinguishable.
 *
 * @param providerId   - Provider identifier string (e.g. `"openai"`).
 * @param providerName - Human-readable provider name (e.g. `"OpenAI"`).
 * @param apiKey       - The raw API key that produced the passing results.
 * @param results      - Array of per-model result objects from the batch test.
 * @returns The updated (deduplicated + appended) full array that was persisted.
 */
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

  const batchTs = Date.now()
  const newRecords: WorkingKeyRecord[] = results.map((r, i) => ({
    id: `${providerId}::${r.modelId}::${batchTs + i}`,
    providerId,
    providerName,
    apiKey,
    modelId: r.modelId,
    latencyMs: r.latencyMs,
    tokenUsage: r.tokenUsage,
    savedAt: batchTs + i,
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

/**
 * Remove a single working-key record by its `id`.
 *
 * Loads the current list, filters out the matching record, persists the
 * result, and returns the updated list for immediate UI re-render.
 *
 * @param id - The `WorkingKeyRecord.id` to remove.
 * @returns The updated array after deletion.
 */
export function deleteWorkingKey(id: string): WorkingKeyRecord[] {
  const updated = loadWorkingKeys().filter((r) => r.id !== id)
  saveWorkingKeys(updated)
  return updated
}

// ── Clear all ─────────────────────────────────────────────────────────────────

/**
 * Wipe all working-key records from localStorage.
 *
 * This is a destructive operation with no undo — use only when the user
 * explicitly confirms a "Clear all" action. Safe to call server-side (no-op).
 */
export function clearAllWorkingKeys(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}
