/**
 * GET /api/v1/models
 *
 * Miuclaw Gateway — OpenAI-compatible models list.
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

  // Always include "miuclaw/auto" as the first model — it picks the fastest available key
  const autoModel = {
    id: "miuclaw/auto",
    object: "model",
    created: now,
    owned_by: "miuclaw",
    _provider: "Miuclaw Gateway (auto-select)",
  }

  if (models.length === 0) {
    return NextResponse.json({
      object: "list",
      data: [autoModel],
      _miuclaw: {
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
          .filter((m) => m.id !== "miuclaw/auto")
          .map((m) => ({
            id: m.id,
            object: "model",
            created: now,
            owned_by: m.providerId,
            // Extra metadata — ignored by OpenAI-compatible clients
            _provider: m.providerName,
          })),
      ],
      _miuclaw: {
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
