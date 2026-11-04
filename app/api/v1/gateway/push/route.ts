/**
 * POST /api/v1/gateway/push
 *
 * Supports two modes:
 *
 * 1. Single-shot (legacy): send all keys at once. Works fine for ≤ 10 keys.
 *    Body: { keys: GatewayKeyInput[] }
 *
 * 2. Chunked (recommended for many keys): send in small batches.
 *    Body: {
 *      keys: GatewayKeyInput[],      // this chunk
 *      chunkIndex: number,           // 0-based index of this chunk
 *      totalChunks: number,          // total number of chunks
 *      allApiKeys?: string[],        // full list of api_keys in the sync (sent on last chunk)
 *    }
 *    On the final chunk (chunkIndex === totalChunks - 1), the server prunes
 *    any gateway_keys row whose api_key is NOT in allApiKeys.
 *
 * SECURITY: Raw API keys are persisted server-side in Neon only.
 * They are NEVER returned to any external client and NEVER logged.
 *
 * OWNER ISOLATION: this route is authenticated (msk_ user key, atk_ key,
 * or the internal admin token). Synced rows are stamped with the caller's
 * owner (their msk_ user_id, or NULL for the legacy/admin pool), and the
 * final-chunk prune deletes ONLY rows in that same bucket — it can never
 * delete another msk_ user's keys or shared rows. Callers must NOT send
 * an owner in the body: any owner field present is ignored and replaced
 * server-side.
 *
 * ADMIN-SHARED KEYS: an admin push may also send { shared: true }. Those
 * rows (is_shared) are served to every registered msk_ user as a fallback
 * behind their own keys. Only admin may set shared; msk_/atk_ callers
 * sending shared:true get it forced to false. An admin shared prune
 * deletes only shared rows, never private user rows.
 *
 * SHARED ADMIN TOKEN (new in this change): marking keys shared no longer
 * accepts the internal admin token alone. It requires a separate,
 * server-only secret in GATEWAY_SHARED_ADMIN_TOKEN, sent as the request's
 * Authorization bearer. Rationale: the internal token is imported by
 * client components (e.g. the tester UI), so it ships in the browser
 * bundle and cannot be treated as a secret. The shared token is read
 * only here, server-side, and is never imported by client code — so it
 * never lands in the bundle. If the env var is unset, shared pushes are
 * rejected (503) instead of falling back to the weaker token. The old
 * internal token still works for ordinary (non-shared) admin pushes.
 * Operator setup after deploy: set GATEWAY_SHARED_ADMIN_TOKEN to a fresh
 * random secret in the deployment environment, then use that token for
 * shared pushes. Rotating it instantly revokes the old shared-push access.
 */

import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { upsertGatewayKeyChunk, pruneStaleGatewayKeys, GatewayKey, dbLoadKeyCount, GatewayPruneScope } from "@/lib/gateway-cache"
import { authenticateGatewayRequest, extractBearerOrHeaderKey } from "@/lib/gateway-auth"

/** Constant-time check that this request carries the shared admin token. */
function hasSharedAdminToken(headers: Headers): boolean {
  const expected = process.env.GATEWAY_SHARED_ADMIN_TOKEN ?? ""
  if (!expected) return false
  const presented = extractBearerOrHeaderKey(headers)
  if (!presented) return false
  const a = Buffer.from(presented)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const runtime = "nodejs"
export const maxDuration = 60

interface GatewayKeyInput {
  providerId: string
  providerName: string
  apiKey: string
  modelIds: string[]
  avgLatencyMs?: number
  pushedAt?: number
}

interface PushBody {
  keys?: unknown[]
  chunkIndex?: number
  totalChunks?: number
  allApiKeys?: string[]
  /** Admin only: mark these keys as shared with every registered msk_ user.
   * Ignored (forced false) for msk_/atk_ callers — only an admin push may
   * create shared rows. Admin shares via this route with the internal
   * admin token, e.g. POST /api/v1/gateway/push { shared: true, keys: [...] }.
   * There is no tester-UI toggle for this: the export panel always syncs
   * as the msk_ user, so it can never mark keys shared. */
  shared?: unknown
}

function sanitize(raw: unknown[], ownerUserId: number | null, isShared: boolean): GatewayKey[] {
  const cleaned = (raw as unknown[])
    .filter((k): k is GatewayKeyInput =>
      typeof k === "object" && k !== null &&
      typeof (k as GatewayKeyInput).providerId === "string" &&
      typeof (k as GatewayKeyInput).apiKey === "string" &&
      Array.isArray((k as GatewayKeyInput).modelIds),
    )
    .map((k) => ({
      providerId: k.providerId.trim(),
      providerName: k.providerName?.trim() ?? k.providerId,
      apiKey: k.apiKey.trim(),
      modelIds: k.modelIds.filter((m) => typeof m === "string" && m.trim().length > 0),
      avgLatencyMs: Math.round(Number(k.avgLatencyMs ?? 0)),
      pushedAt: Number(k.pushedAt ?? Date.now()),
      // Owner and shared are server-side auth only — never taken from the
      // request body except the admin's shared flag, decided below.
      ownerUserId,
      isShared,
    }))
    .filter((k) => k.providerId && k.apiKey && k.modelIds.length > 0)

  // Dedupe by (providerId, apiKey) WITHIN this chunk — merging modelIds.
  // Postgres' ON CONFLICT DO UPDATE cannot touch the same row twice in one
  // INSERT, so duplicate pairs in a single chunk would otherwise cause a 500.
  const merged = new Map<string, GatewayKey>()
  for (const k of cleaned) {
    const mapKey = `${k.providerId}::${k.apiKey}`
    const existing = merged.get(mapKey)
    if (existing) {
      const modelSet = new Set([...existing.modelIds, ...k.modelIds])
      existing.modelIds = Array.from(modelSet)
      existing.avgLatencyMs = Math.round((existing.avgLatencyMs + k.avgLatencyMs) / 2)
      existing.pushedAt = Math.max(existing.pushedAt, k.pushedAt)
    } else {
      merged.set(mapKey, { ...k })
    }
  }
  return Array.from(merged.values())
}

export async function POST(req: NextRequest) {
  // ── Parse body first: the shared flag decides which auth applies ──────────
  // A shared push is authenticated ONLY by the shared admin token (see
  // header comment) — that token is not a recognised msk_/atk_/internal
  // credential, so it must be checked before the general auth below,
  // which would otherwise reject it as unrecognised. The shared token
  // grants nothing else: without shared:true it authenticates no push.
  let body: PushBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(body.keys)) {
    return NextResponse.json({ error: "keys must be an array" }, { status: 400 })
  }

  const wantsShared = body.shared === true
  let auth: { valid: boolean; tier?: string; userId?: number; status?: number; error?: string }
  if (wantsShared) {
    if (!process.env.GATEWAY_SHARED_ADMIN_TOKEN) {
      return NextResponse.json(
        { error: "Kunci bersama belum diaktifkan: set env GATEWAY_SHARED_ADMIN_TOKEN di environment deployment, lalu ulangi push shared ini." },
        { status: 503 },
      )
    }
    if (!hasSharedAdminToken(req.headers)) {
      return NextResponse.json(
        { error: "Menandai kunci sebagai shared membutuhkan token admin khusus shared (env GATEWAY_SHARED_ADMIN_TOKEN). Token admin internal saja tidak cukup." },
        { status: 403 },
      )
    }
    auth = { valid: true, tier: "admin" }
  } else {
    // ── Guard: authenticate the syncing caller ────────────────────────────────
    // Previously this route only checked that an internal token EXISTED on
    // the server — it never checked the request — so anyone could push and
    // prune the whole global pool. Now the caller must authenticate, and
    // their rows are stamped with their own owner (see header comment).
    auth = await authenticateGatewayRequest(req.headers, "/api/v1/gateway/push")
    if (!auth.valid) {
      return NextResponse.json(
        {
          error:
            auth.error ||
            "Sync membutuhkan API Key User MSAKU (msk_...) — simpan dulu kunci msk_ Anda di tester, lalu sync ulang.",
        },
        { status: auth.status || 401 },
      )
    }
  }
  // msk_ callers own their rows; admin/atk_ callers write the legacy pool.
  const ownerUserId: number | null =
    auth.tier === "msaku_user" && typeof auth.userId === "number" ? auth.userId : null

  // Shared flag: true only when the shared admin token authorised this
  // push (checked above). Every other caller gets false, even if they
  // sent shared:true — otherwise any user could inject their key into
  // every other user's model list.
  const isShared = wantsShared
  // Prune bucket follows the push kind: an msk_ prune touches only that
  // user's own rows (never shared rows), a legacy prune only legacy rows,
  // and an admin shared prune only shared rows.
  const pruneScope: GatewayPruneScope =
    ownerUserId !== null ? ownerUserId : isShared ? "shared" : null
  // Read scope for the response count (msk_ scope = own rows + shared rows).
  const scope = ownerUserId

  const sanitized = sanitize(body.keys, ownerUserId, isShared)

  // ── Determine mode ──────────────────────────────────────────────────────────
  const chunkIndex  = typeof body.chunkIndex  === "number" ? body.chunkIndex  : 0
  const totalChunks = typeof body.totalChunks === "number" ? body.totalChunks : 1
  const isLastChunk = chunkIndex === totalChunks - 1
  const isChunked   = totalChunks > 1

  // ── DB writes — wrapped so ANY failure returns JSON (never an HTML 500) ──────
  try {
    // UPSERT this chunk (stamped with the caller's owner)
    await upsertGatewayKeyChunk(sanitized, ownerUserId)

    let pruned = 0

    // On final chunk: prune stale keys — ONLY within the caller's scope.
    // Another msk_ user's rows are never touched, even if their api_key
    // values are absent from this caller's allApiKeys list.
    if (isLastChunk) {
      const allApiKeys = Array.isArray(body.allApiKeys)
        ? body.allApiKeys.filter((k) => typeof k === "string" && k.trim().length > 0)
        : sanitized.map((k) => k.apiKey)        // single-shot: keep only what was sent
      pruned = await pruneStaleGatewayKeys(allApiKeys, pruneScope)
    }

    // Build response (counts are scoped to this caller, not global)
    const providerCount = new Set(sanitized.map((k) => k.providerId)).size
    const modelCount    = sanitized.reduce((acc, k) => acc + k.modelIds.length, 0)
    const totalInDb     = isLastChunk ? await dbLoadKeyCount(scope) : null

    return NextResponse.json({
      ok: true,
      chunkIndex,
      totalChunks,
      synced:    sanitized.length,
      providers: providerCount,
      models:    modelCount,
      pruned,
      ownerScope: ownerUserId !== null ? `msk_user:${ownerUserId}` : isShared ? "shared" : "legacy",
      ...(totalInDb !== null ? { totalInDb } : {}),
      ...(isChunked ? { isLastChunk } : {}),
    })
  } catch (err) {
    // Surface the real DB error as JSON so the client shows a useful message
    const message = err instanceof Error ? err.message : String(err)
    console.error("[v0] gateway push DB error:", message)
    return NextResponse.json(
      { error: `Database error while saving keys: ${message}`, chunkIndex, totalChunks },
      { status: 500 },
    )
  }
}
