import { db } from "@/lib/db"
import { apiKeys } from "@/lib/db/api-key-schema"
import { eq, and } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { keyId, createdBy } = body

    if (!keyId || !createdBy) {
      return NextResponse.json(
        { error: "Missing required fields: keyId, createdBy" },
        { status: 400 }
      )
    }

    // Verify ownership before revoking
    const key = await db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.createdBy, createdBy)
      ),
    })

    if (!key) {
      return NextResponse.json(
        { error: "API key not found or unauthorized" },
        { status: 404 }
      )
    }

    // Revoke the key
    await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.id, keyId))

    return NextResponse.json({
      success: true,
      message: "API key revoked successfully",
    })
  } catch (error) {
    console.error("[Revoke API Key Error]", error)
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    )
  }
}
