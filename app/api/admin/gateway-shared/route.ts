/**
 * /api/admin/gateway-shared — server-side admin API for shared keys.
 *
 * This is the ONLY code path the admin panel uses. It runs server-side,
 * so GATEWAY_SHARED_ADMIN_TOKEN is read from process.env here and never
 * reaches the browser. Access requires a signed gateway_admin_session
 * cookie (issued by the login route after verifying that same token).
 *
 * GET  → list shared rows WITHOUT api_key values (the query never selects
 *        the api_key column, so a leaked list response cannot leak keys).
 * POST { action: "add", providerId, providerName, apiKey, modelIds }
 *      → upsert one row as shared (owner NULL, is_shared TRUE) via the
 *        same upsert helper the push route uses. The provider key is
 *        stored server-side in Neon only and is never returned.
 * POST { action: "remove", id }
 *      → DELETE one shared row by id. Deleting (not downgrading) is the
 *        revoke path: the model stops being served to msk_ users within
 *        the ~30 s gateway cache TTL.
 */

import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db/index"
import { upsertGatewayKeyChunk } from "@/lib/gateway-cache"
import { GATEWAY_ADMIN_COOKIE, verifyAdminSession } from "@/lib/gateway-admin-session"

export const runtime = "nodejs"
export const maxDuration = 60

async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const secret = process.env.GATEWAY_SHARED_ADMIN_TOKEN
  if (!secret) {
    return NextResponse.json(
      { error: "Panel admin shared belum diaktifkan: set env GATEWAY_SHARED_ADMIN_TOKEN di environment deployment." },
      { status: 503 },
    )
  }
  const cookie = req.cookies.get(GATEWAY_ADMIN_COOKIE)?.value
  if (!(await verifyAdminSession(secret, cookie))) {
    return NextResponse.json({ error: "Sesi admin tidak valid. Silakan login ulang di panel." }, { status: 401 })
  }
  return null
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const client = await pool.connect()
  try {
    const { rows } = await client.query(
      `SELECT id, provider_id, provider_name, model_ids, avg_latency_ms, pushed_at
       FROM gateway_keys
       WHERE is_shared = TRUE
       ORDER BY provider_id ASC, id ASC`,
    )
    return NextResponse.json({
      sharedKeys: rows.map((r) => ({
        id: r.id,
        providerId: r.provider_id,
        providerName: r.provider_name,
        // Neon returns text[] as a JS array; tolerate a string just in case.
        modelIds: Array.isArray(r.model_ids) ? r.model_ids : [],
        avgLatencyMs: r.avg_latency_ms ?? 0,
        pushedAt: Number(r.pushed_at ?? 0),
      })),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Gagal membaca kunci shared: ${msg}` }, { status: 500 })
  } finally {
    client.release()
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (body.action === "remove") {
    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "id harus nomor baris shared yang valid" }, { status: 400 })
    }
    const client = await pool.connect()
    try {
      const { rowCount } = await client.query(
        `DELETE FROM gateway_keys WHERE id = $1 AND is_shared = TRUE`,
        [id],
      )
      if (!rowCount) {
        return NextResponse.json({ error: "Baris shared tidak ditemukan (mungkin sudah dicabut)" }, { status: 404 })
      }
      return NextResponse.json({ ok: true, removedId: id })
    } finally {
      client.release()
    }
  }

  if (body.action === "add") {
    const providerId = typeof body.providerId === "string" ? body.providerId.trim() : ""
    const providerName = typeof body.providerName === "string" ? body.providerName.trim() : providerId
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : ""
    const modelIds = Array.isArray(body.modelIds)
      ? body.modelIds.filter((m): m is string => typeof m === "string" && m.trim().length > 0).map((m) => m.trim())
      : []
    if (!providerId || !apiKey || modelIds.length === 0) {
      return NextResponse.json(
        { error: "providerId, apiKey, dan minimal satu model wajib diisi" },
        { status: 400 },
      )
    }
    await upsertGatewayKeyChunk(
      [
        {
          providerId,
          providerName,
          apiKey,
          modelIds,
          avgLatencyMs: 0,
          pushedAt: Date.now(),
          ownerUserId: null,
          isShared: true,
        },
      ],
      null,
    )
    return NextResponse.json({ ok: true, providerId, modelCount: modelIds.length })
  }

  return NextResponse.json({ error: "action harus 'add' atau 'remove'" }, { status: 400 })
}
