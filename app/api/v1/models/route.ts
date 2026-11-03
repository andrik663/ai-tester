/**
 * GET /api/v1/models
 *
 * Msaku Gateway — OpenAI-compatible models list.
 * Returns all model IDs from the synced working keys.
 *
 * Auth: Authorization: Bearer <msk_ MSAKU User Key>
 */

import { NextRequest, NextResponse } from "next/server"
import { getInternalToken, getAllModels, getGatewayStats } from "@/lib/gateway-cache"
import { authenticateGatewayRequest } from "@/lib/gateway-auth"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const auth = await authenticateGatewayRequest(req.headers, "/api/v1/models", true)
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 })
  }

  // ── Resolve internal token ──────────────────────────────────────────────────
  const token = getInternalToken()

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
        totalModels: 1,
        avgLatencyMs: 0,
        providers: {},
        providerNodes: [],
        registerKeyUrl: "https://msaku.id/gateway",
        authTier: auth.tier,
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
        avgLatencyMs: stats?.avgLatencyMs ?? 0,
        providers: stats?.providers ?? {},
        providerNodes: stats?.providerNodes ?? [],
        lastPushedAt: stats?.lastPushedAt ?? null,
        registerKeyUrl: "https://msaku.id/gateway",
        authTier: auth.tier,
      },
    },
    {
      headers: { "Cache-Control": "no-store, no-cache" },
    },
  )
}
