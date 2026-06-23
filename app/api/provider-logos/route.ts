import { db } from "@/lib/db"
import { providerLogos } from "@/lib/db/provider-logos-schema"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/provider-logos
 * Fetch all provider logos from database
 * ?providerId=openai — optional filter for specific provider
 */
export async function GET(req: NextRequest) {
  try {
    const providerId = req.nextUrl.searchParams.get("providerId")

    let query = db.select().from(providerLogos).where(eq(providerLogos.isActive, true))

    if (providerId) {
      query = db.select().from(providerLogos).where(eq(providerLogos.providerId, providerId))
    }

    const logos = await query

    if (providerId && logos.length === 0) {
      return NextResponse.json({ error: "Provider logo not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      count: logos.length,
      data: logos.map((logo) => ({
        providerId: logo.providerId,
        providerName: logo.providerName,
        svgUrl: logo.svgUrl,
        svgVariant: logo.svgVariant,
        logoSource: logo.logoSource,
        category: logo.category,
      })),
    })
  } catch (error) {
    console.error("[api/provider-logos] Error:", error)
    return NextResponse.json({ error: "Failed to fetch provider logos" }, { status: 500 })
  }
}

/**
 * POST /api/provider-logos
 * Add or update a provider logo
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { providerId, providerName, svgUrl, svgVariant = "default", category } = body

    if (!providerId || !providerName || !svgUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await db
      .insert(providerLogos)
      .values({
        providerId,
        providerName,
        svgUrl,
        svgVariant,
        category,
      })
      .onConflictDoUpdate({
        target: providerLogos.providerId,
        set: {
          providerName,
          svgUrl,
          svgVariant,
          category,
          updatedAt: new Date(),
        },
      })
      .returning()

    return NextResponse.json({
      success: true,
      data: result[0],
    })
  } catch (error) {
    console.error("[api/provider-logos] POST Error:", error)
    return NextResponse.json({ error: "Failed to save provider logo" }, { status: 500 })
  }
}
