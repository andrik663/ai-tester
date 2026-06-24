import { db } from "@/lib/db"
import { apiKeys } from "@/lib/db/api-key-schema"
import { generateApiKey } from "@/lib/api-key-utils"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name,
      description,
      createdBy,
      rateLimitPerHour = 100,
      allowedEndpoints = ["*"],
      webhookUrl,
      webhookSecret,
      expiresAt,
    } = body

    // Validate required fields
    if (!name || !createdBy) {
      return NextResponse.json(
        { error: "Missing required fields: name, createdBy" },
        { status: 400 }
      )
    }

    // Generate new API key
    const { rawKey, keyHash } = generateApiKey()

    // Store hashed key in database
    const newKey = await db
      .insert(apiKeys)
      .values({
        name,
        keyHash,
        createdBy,
        description,
        rateLimitPerHour,
        allowedEndpoints,
        webhookUrl,
        webhookSecret,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        metadata: {
          createdAt: new Date().toISOString(),
        },
      })
      .returning()

    // Return the raw key (only shown once!)
    return NextResponse.json({
      success: true,
      key: {
        id: newKey[0].id,
        name: newKey[0].name,
        rawKey, // Only shown once - user must save it
        createdAt: newKey[0].createdAt,
      },
      warning: "Save this key securely. You won't be able to see it again.",
    })
  } catch (error) {
    console.error("[Create API Key Error]", error)
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    )
  }
}
