/**
 * GET /api/v1/models
 *
 * Msaku Gateway — OpenAI-compatible models list.
 * Returns all model IDs from the synced working keys.
 *
 * Auth: Authorization: Bearer <EXPORT_API_TOKEN>
 */

import { NextRequest, NextResponse } from "next/server"
import { getInternalToken, getAllModels, getGatewayStats } from "@/lib/gateway-cache"

export const runtime = "nodejs"

export async function GET(_req: NextRequest) {
  // ── Resolve internal token ──────────────────────────────────────────────────
  const token = getInternalToken()
  if (!token) {
    return NextResponse.json({ error: "Server misconfiguration: EXPORT_API_TOKEN not set" }, { status: 503 })
  }

  // ── Build response ──────────────────────────────────────────────────────────
  const models = await getAllModels(token)
  const stats = await getGatewayStats(token)

  const now = Math.floor(Date.now() / 1000)

  // Always include "msaku/auto" as the first model — it picks the fastest available key
  const autoModel = {
    id: "msaku/auto",
    object: "model",
    created: now,
    owned_by: "msaku",
    _provider: "Msaku Gateway (auto-select)",
  }

  if (models.length === 0) {
    return NextResponse.json({
      object: "list",
      data: [autoModel],
      _msaku: {
        message: "No working keys synced yet. Call POST /api/v1/gateway/push from the browser first.",
        totalKeys: 0,
      },
    })
  }

  return NextResponse.json(
    {
      object: "list",
      data: [
        autoModel,
        ...models
          .filter((m) => m.id !== "msaku/auto" && m.id !== "miuclaw/auto")
          .map((m) => ({
            id: m.id,
            object: "model",
            created: now,
            owned_by: m.providerId,
            // Extra metadata — ignored by OpenAI-compatible clients
            _provider: m.providerName,
          })),
      ],
      _msaku: {
        totalKeys: stats?.totalKeys ?? 0,
        totalModels: models.length,
        providers: stats?.providers ?? {},
        lastPushedAt: stats?.lastPushedAt ?? null,
      },
    },
    {
      headers: { "Cache-Control": "no-store, no-cache" },
    },
  )
}
