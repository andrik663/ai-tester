import { stopProjectSandbox } from "@/lib/sandbox"

export const maxDuration = 30

export async function POST(req: Request) {
  let body: { sandboxId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const { sandboxId } = body
  if (!sandboxId || typeof sandboxId !== "string") {
    return Response.json({ error: "Missing `sandboxId`." }, { status: 400 })
  }

  // Best-effort — used via navigator.sendBeacon when the preview unmounts,
  // so we don't want to surface errors back to a beacon caller anyway.
  await stopProjectSandbox(sandboxId)
  return Response.json({ ok: true })
}
