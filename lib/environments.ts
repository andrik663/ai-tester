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

const KEY     = "ai_tester_environments_v1"
const ACT_KEY = "ai_tester_active_env_v1"

function load(): Environment[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Environment[]
  } catch { return [] }
}

function save(envs: Environment[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(envs)) }
  catch { /* quota */ }
}

export function getEnvironments(): Environment[] { return load() }

export function getActiveEnvironment(): Environment | null {
  const id = typeof window !== "undefined" ? localStorage.getItem(ACT_KEY) : null
  if (!id) return null
  return load().find((e) => e.id === id) ?? null
}

export function setActiveEnvironment(id: string | null): void {
  if (id) localStorage.setItem(ACT_KEY, id)
  else localStorage.removeItem(ACT_KEY)
}

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

export function deleteEnvironment(id: string): void {
  save(load().filter((e) => e.id !== id))
  const active = localStorage.getItem(ACT_KEY)
  if (active === id) localStorage.removeItem(ACT_KEY)
}

export function updateEnvironmentVars(id: string, vars: EnvVar[]): void {
  save(load().map((e) => e.id === id ? { ...e, vars } : e))
}

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
