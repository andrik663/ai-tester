/**
 * DELETE /api/locked-keys/unlock?id=<id>
 *
 * Removes a locked key from the DB.
 * Auth: Authorization: Bearer <EXPORT_API_TOKEN>
 */
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { lockedWorkingKeys } from "@/lib/db/locked-keys-schema"
import { validateToken } from "@/lib/export-cache"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

export async function DELETE(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (!validateToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Missing ?id=" }, { status: 400 })
  }

  try {
    const deleted = await db
      .delete(lockedWorkingKeys)
      .where(eq(lockedWorkingKeys.id, id))
      .returning({ id: lockedWorkingKeys.id })

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, id })
  } catch (err) {
    console.error("[locked-keys/unlock]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
