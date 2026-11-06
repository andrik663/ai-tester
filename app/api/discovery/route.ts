/**
 * GET /api/discovery?refresh=1&provider=<id>
 *
 * Real-time model discovery: for every provider in PROVIDER_CONFIGS,
 * fetch the LIVE model list from the provider's /models endpoint and diff
 * it against the static list in lib/providers.ts.
 *
 * How a live list is obtained (in order):
 *   1. The caller's OWN synced key for that provider (preferred — never
 *      spends another user's key), else
 *   2. an admin-shared key for that provider, else
 *   3. no key (only providers with a public /models endpoint answer live;
 *      the rest fall back to the static list, flagged source "static").
 *
 * Auth: Authorization: Bearer <msk_ / atk_ / admin token> (same gate as
 * /api/v1/*). Anonymous callers get 401 — discovery spends synced keys and
 * runs 98 provider fetches, so it must not be triggerable without a key.
 * (Do NOT pass allowAnonymousRead=true: anonymous callers would silently
 * fall through to the legacy/admin key pool.) Keys are used server-side
 * only and NEVER returned.
 *
 * Response:
 *   { providers: [{ providerId, providerName, liveTotal, staticTotal,
 *                    added: string[], removed: string[],
 *                    source: "live" | "static", keyAvailable: boolean,
 *                    fetchedAt, error? }],
 *     totals: { providers, live, staticOnly, newModels, removedModels },
 *     fetchedAt, cached: boolean }
 *
 * In-memory cache: 10 min for a full scan (?refresh=1 bypasses it).
 * A single ?provider=<id> refresh never overwrites the full cache.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateGatewayRequest } from "@/lib/gateway-auth"
import { fetchLiveModels, PROVIDER_CONFIGS } from "@/lib/providers"
import { getGatewayStore, scopeForAuth, type GatewayKeyScope } from "@/lib/gateway-cache"

export const runtime = "nodejs"

interface DiscoveryEntry {
  providerId: string
  providerName: string
  liveTotal: number
  staticTotal: number
  added: string[]
  removed: string[]
  source: "live" | "static"
  keyAvailable: boolean
  fetchedAt: string
  error?: string
}

const CACHE_TTL_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 6_000
const CONCURRENCY = 8

let cache: { at: number; entries: DiscoveryEntry[] } | null = null

async function discoverOne(
  providerId: string,
  keyMap: Map<string, { apiKey: string; providerName: string; isShared: boolean }>,
): Promise<DiscoveryEntry> {
  const cfg = PROVIDER_CONFIGS[providerId]
  const key = keyMap.get(providerId)
  const fetchedAt = new Date().toISOString()
  try {
    const { models, source } = await fetchLiveModels(
      providerId,
      key?.apiKey ?? "",
      FETCH_TIMEOUT_MS,
    )
    const liveIds = models.map((m) => m.id)
    const staticIds = cfg.models ?? []
    const liveSet = new Set(liveIds)
    const staticSet = new Set(staticIds)
    return {
      providerId,
      providerName: key?.providerName ?? providerId,
      liveTotal: liveIds.length,
      staticTotal: staticIds.length,
      added: liveIds.filter((id) => !staticSet.has(id)),
      removed: staticIds.filter((id) => !liveSet.has(id)),
      source,
      keyAvailable: !!key,
      fetchedAt,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      providerId,
      providerName: key?.providerName ?? providerId,
      liveTotal: 0,
      staticTotal: cfg.models?.length ?? 0,
      added: [],
      removed: [],
      source: "static",
      keyAvailable: !!key,
      fetchedAt,
      error: msg,
    }
  }
}

function totalsOf(entries: DiscoveryEntry[]) {
  return {
    providers: entries.length,
    live: entries.filter((e) => e.source === "live").length,
    staticOnly: entries.filter((e) => e.source === "static").length,
    newModels: entries.reduce((s, e) => s + e.added.length, 0),
    removedModels: entries.reduce((s, e) => s + e.removed.length, 0),
  }
}

export async function GET(req: NextRequest) {
  // allowAnonymousRead=false: anonymous callers must get 401, not a scan
  // against the legacy/admin key pool.
  const auth = await authenticateGatewayRequest(req.headers, "/api/discovery", false)
  if (!auth.valid || auth.tier === "anonymous_read") {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 })
  }

  const sp = req.nextUrl.searchParams
  const refresh = sp.get("refresh") === "1"
  const only = sp.get("provider")?.toLowerCase() || ""
  if (only && !PROVIDER_CONFIGS[only]) {
    return NextResponse.json({ error: `Unknown provider: ${only}` }, { status: 404 })
  }

  if (!only && !refresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(
      {
        providers: cache.entries,
        totals: totalsOf(cache.entries),
        fetchedAt: new Date(cache.at).toISOString(),
        cached: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  }

  const scope: GatewayKeyScope = scopeForAuth(auth)
  const keyMap = new Map<
    string,
    { apiKey: string; providerName: string; isShared: boolean }
  >()
  try {
    const store = await getGatewayStore("", scope)
    for (const k of store?.keys ?? []) {
      const prev = keyMap.get(k.providerId)
      // Own (non-shared) keys win over shared ones for the same provider.
      if (!prev || (prev.isShared && !k.isShared)) {
        keyMap.set(k.providerId, {
          apiKey: k.apiKey,
          providerName: k.providerName,
          isShared: k.isShared,
        })
      }
    }
  } catch {
    // No synced keys readable — discovery still works, everything falls
    // back to the static list (flagged source "static").
  }

  const ids = only ? [only] : Object.keys(PROVIDER_CONFIGS)
  const entries: DiscoveryEntry[] = []
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = await Promise.all(
      ids.slice(i, i + CONCURRENCY).map((id) => discoverOne(id, keyMap)),
    )
    entries.push(...chunk)
  }

  if (!only) cache = { at: Date.now(), entries }

  return NextResponse.json(
    {
      providers: entries,
      totals: totalsOf(entries),
      fetchedAt: new Date().toISOString(),
      cached: false,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
