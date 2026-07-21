/**
 * lib/environments.ts — Environment variable sets stored in localStorage.
 * Users can define named envs (dev / staging / prod) with key-value pairs
 * that can be interpolated into request headers and bodies via {{VAR_NAME}}.
 */

export interface EnvVar { key: string; value: string }

export interface Environment {
  id: string
  name: string
  vars: EnvVar[]
  isActive: boolean
  createdAt: number
}

/** localStorage key for the environments list. */
const KEY     = "ai_tester_environments_v1"
/** localStorage key for the currently active environment id. */
const ACT_KEY = "ai_tester_active_env_v1"

/** @internal Load all environments from localStorage. */
function load(): Environment[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Environment[]
  } catch { return [] }
}

/** @internal Persist environments array to localStorage. */
function save(envs: Environment[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(envs)) }
  catch { /* quota */ }
}

/**
 * Return all saved environments.
 *
 * @returns Array of `Environment` objects, or `[]` if none exist.
 */
export function getEnvironments(): Environment[] { return load() }

/**
 * Return the currently active environment, or `null` if none is selected.
 *
 * Reads the active id from `ACT_KEY` then looks it up in the environment
 * list. Returns `null` if the stored id no longer matches any saved env.
 *
 * @returns The active `Environment`, or `null`.
 */
export function getActiveEnvironment(): Environment | null {
  const id = typeof window !== "undefined" ? localStorage.getItem(ACT_KEY) : null
  if (!id) return null
  return load().find((e) => e.id === id) ?? null
}

/**
 * Set (or clear) the active environment.
 *
 * @param id - The `Environment.id` to activate, or `null` to deactivate all.
 */
export function setActiveEnvironment(id: string | null): void {
  if (id) localStorage.setItem(ACT_KEY, id)
  else localStorage.removeItem(ACT_KEY)
}

/**
 * Create a new empty environment and persist it.
 *
 * The `id` is prefixed with `env_` and is collision-resistant.
 *
 * @param name - Display name for the environment (e.g. `"Production"`).
 * @returns The newly created `Environment` object.
 */
export function createEnvironment(name: string): Environment {
  const env: Environment = {
    id: `env_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    vars: [],
    isActive: false,
    createdAt: Date.now(),
  }
  save([...load(), env])
  return env
}

/**
 * Delete an environment by id and deactivate it if it was active.
 *
 * @param id - The `Environment.id` to remove.
 */
export function deleteEnvironment(id: string): void {
  save(load().filter((e) => e.id !== id))
  const active = localStorage.getItem(ACT_KEY)
  if (active === id) localStorage.removeItem(ACT_KEY)
}

/**
 * Replace all variables in an environment with a new set.
 *
 * @param id   - The `Environment.id` to update.
 * @param vars - The complete new list of key-value pairs.
 */
export function updateEnvironmentVars(id: string, vars: EnvVar[]): void {
  save(load().map((e) => e.id === id ? { ...e, vars } : e))
}

/**
 * Rename an existing environment.
 *
 * @param id   - The `Environment.id` to rename.
 * @param name - New display name.
 */
export function renameEnvironment(id: string, name: string): void {
  save(load().map((e) => e.id === id ? { ...e, name } : e))
}

/**
 * Interpolate {{VAR_NAME}} placeholders in a string using the active env vars.
 * Falls back gracefully — unknown placeholders are left as-is.
 */
export function interpolate(text: string, env: Environment | null): string {
  if (!env || !text) return text
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const found = env.vars.find((v) => v.key === key.trim())
    return found ? found.value : match
  })
}
