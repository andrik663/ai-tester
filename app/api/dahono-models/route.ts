import { NextRequest, NextResponse } from "next/server"

export interface DahonoModel {
  id: string
  description: string
  tier: "free" | "starter" | "pro" | "business"
  free: boolean
  inputIDRper1M: number
  outputIDRper1M: number
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? ""
  const apiKey = authHeader.replace("Bearer ", "").trim() || "dahono-xxx"

  try {
    const res = await fetch("https://router.dahono.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Gateway returned HTTP ${res.status}` }, { status: res.status })
    }

    const data = await res.json()
    const models: DahonoModel[] = (data?.data ?? []).map((m: Record<string, unknown>) => ({
      id: String(m.id),
      description: String(m.description ?? ""),
      tier: String(m.tier ?? "free") as DahonoModel["tier"],
      free: Boolean(m.free),
      inputIDRper1M: Number(m.inputIDRper1M ?? 0),
      outputIDRper1M: Number(m.outputIDRper1M ?? 0),
    }))

    return NextResponse.json({ models, total: models.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
