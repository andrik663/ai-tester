import { SandboxExpiredError, syncSandboxFiles, type SandboxFileMap } from "@/lib/sandbox"

export const maxDuration = 120

export async function POST(req: Request) {
  let body: { sandboxId?: string; files?: SandboxFileMap }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const { sandboxId, files } = body
  if (!sandboxId || typeof sandboxId !== "string") {
    return Response.json({ error: "Missing `sandboxId`." }, { status: 400 })
  }
  if (!files || typeof files !== "object" || Array.isArray(files)) {
    return Response.json({ error: "Missing or invalid `files` map." }, { status: 400 })
  }

  try {
    const result = await syncSandboxFiles(sandboxId, files)
    return Response.json(result)
  } catch (error) {
    if (error instanceof SandboxExpiredError) {
      return Response.json({ expired: true, error: error.message }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : "Failed to sync sandbox files."
    console.error("[v0] sandbox files sync failed:", message)
    return Response.json({ error: message }, { status: 500 })
  }
}
