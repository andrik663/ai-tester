import { createProjectSandbox, type SandboxFileMap } from "@/lib/sandbox"

export const maxDuration = 120

export async function POST(req: Request) {
  let body: { files?: SandboxFileMap }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const files = body.files
  if (!files || typeof files !== "object" || Array.isArray(files)) {
    return Response.json({ error: "Missing or invalid `files` map." }, { status: 400 })
  }

  try {
    const result = await createProjectSandbox(files)
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create sandbox."
    console.error("[v0] sandbox create failed:", message)
    return Response.json({ error: message }, { status: 500 })
  }
}
