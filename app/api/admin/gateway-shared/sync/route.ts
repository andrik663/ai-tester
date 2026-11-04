/**
 * POST /api/admin/gateway-shared/sync — sync tester keys as shared keys.
 *
 * This is what lets the admin use the full-feature tester dashboard
 * (provider search, per-provider key input, batch test, screener) to feed
 * shared keys, instead of typing providerId/modelIds by hand in a separate
 * form. The tester page already holds the admin's working keys in its own
 * state; this route receives exactly those keys and stores them as shared.
 *
 * SECURITY — why the shared token never appears here or in the browser:
 * - Authentication is the panel-admin session cookie (signed HMAC, issued
 *   by /api/admin/gateway-shared/login after verifying
 *   GATEWAY_SHARED_ADMIN_TOKEN server-side). The tester page sends no
 *   token at all — the cookie is attached automatically, same-site.
 * - The provider keys in the body go straight from this route into Neon
 *   via upsertGatewayKeyChunk (owner NULL, is_shared TRUE) and are never
 *   returned, logged, or echoed in the response (only counts).
 * - NO PRUNE: unlike the msk_ push route, this route never deletes rows.
 *   Shared keys not present in this payload are left untouched, so syncing
 *   one new Claude key cannot wipe other shared keys.
 * - Without a valid admin session the route answers 401; the UI then
 *   points the admin to log in once at /admin/gateway-shared.
 */

import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db/index"
import { upsertGatewayKeyChunk } from "@/lib/gateway-cache"
import { GATEWAY_ADMIN_COOKIE, verifyAdminSession } from "@/lib/gateway-admin-session"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const secret = process.env.GATEWAY_SHARED_ADMIN_TOKEN
  if (!secret) {
    return NextResponse.json(
      { error: "Panel admin shared belum diaktifkan: set env GATEWAY_SHARED_ADMIN_TOKEN di environment deployment." },
      { status: 503 },
    )
  }
  const cookie = req.cookies.get(GATEWAY_ADMIN_COOKIE)?.value
  if (!(await verifyAdminSession(secret, cookie))) {
    return NextResponse.json(
      { error: "Belum login admin. Login dulu di /admin/gateway-shared, lalu ulangi sync shared ini." },
      { status: 401 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    return NextResponse.json({ error: "keys harus array berisi minimal satu kunci" }, { status: 400 })
  }
  if (body.keys.length > 200) {
    return NextResponse.json({ error: "Maksimal 200 kunci per sync shared" }, { status: 400 })
  }

  const cleaned = body.keys
    .map((k) => {
      if (typeof k !== "object" || k === null) return null
      const rec = k as Record<string, unknown>
      const providerId = typeof rec.providerId === "string" ? rec.providerId.trim() : ""
      const providerName = typeof rec.providerName === "string" ? rec.providerName.trim() : providerId
      const apiKey = typeof rec.apiKey === "string" ? rec.apiKey.trim() : ""
      const modelIds = Array.isArray(rec.modelIds)
        ? rec.modelIds.filter((m): m is string => typeof m === "string" && m.trim().length > 0).map((m) => m.trim())
        : []
      if (!providerId || !apiKey || modelIds.length === 0) return null
      return {
        providerId,
        providerName,
        apiKey,
        modelIds,
        avgLatencyMs: Math.round(Number(rec.avgLatencyMs ?? 0)) || 0,
        pushedAt: Date.now(),
        ownerUserId: null as number | null,
        isShared: true,
      }
    })
    .filter((k): k is NonNullable<typeof k> => k !== null)

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "Tidak ada kunci valid (providerId, apiKey, dan minimal satu model wajib diisi)" }, { status: 400 })
  }

  await upsertGatewayKeyChunk(cleaned, null)
  // Keep the pool import used: a cheap sanity read of the shared count.
  // (upsert already wrote the rows; this only reports back a count.)
  const client = await pool.connect()
  try {
    const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM gateway_keys WHERE is_shared = TRUE`)
    return NextResponse.json({
      ok: true,
      synced: cleaned.length,
      providers: new Set(cleaned.map((k) => k.providerId)).size,
      sharedTotal: rows[0]?.n ?? null,
    })
  } finally {
    client.release()
  }
}
