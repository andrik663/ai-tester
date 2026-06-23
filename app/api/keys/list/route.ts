import { db } from "@/lib/db"
import { apiKeys } from "@/lib/db/api-key-schema"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { maskApiKey } from "@/lib/api-key-utils"

export async function GET(req: NextRequest) {
  try {
    const createdBy = req.nextUrl.searchParams.get("createdBy")

    if (!createdBy) {
      return NextResponse.json(
        { error: "Missing required query parameter: createdBy" },
        { status: 400 }
      )
    }

    // Get all keys for this user
    const userKeys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.createdBy, createdBy),
    })

    // Mask the hashes in response
    const maskedKeys = userKeys.map((key) => ({
      id: key.id,
      name: key.name,
      description: key.description,
      isActive: key.isActive,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      rateLimitPerHour: key.rateLimitPerHour,
      allowedEndpoints: key.allowedEndpoints,
      webhookUrl: key.webhookUrl ? "***" : null,
    }))

    return NextResponse.json({
      success: true,
      keys: maskedKeys,
      total: maskedKeys.length,
    })
  } catch (error) {
    console.error("[List API Keys Error]", error)
    return NextResponse.json(
      { error: "Failed to list API keys" },
      { status: 500 }
    )
  }
}
