import { Sandbox } from "@vercel/sandbox"
import { PROJECT_TEMPLATE_FILES } from "./sandbox/template"

const DEV_PORT = 5173
// Matches the "auto-stop after 10 minutes idle" decision for the Full
// Project preview mode.
const SANDBOX_IDLE_TIMEOUT_MS = 10 * 60 * 1000

export class SandboxExpiredError extends Error {
  constructor(message = "Sandbox session has expired or no longer exists.") {
    super(message)
    this.name = "SandboxExpiredError"
  }
}

export type SandboxFileMap = Record<string, string>

export interface SandboxResult {
  sandboxId: string
  previewUrl: string
}

/**
 * Normalizes a model/user-supplied file path and rejects anything that
 * could escape the project directory inside the sandbox VM.
 */
function normalizeProjectPath(rawPath: string): string {
  const cleaned = rawPath.replace(/\\/g, "/").trim()
  if (cleaned.startsWith("/")) {
    throw new Error(`Invalid file path "${rawPath}": absolute paths are not allowed.`)
  }
  const segments = cleaned.split("/").filter((segment) => segment.length > 0)
  if (segments.length === 0) {
    throw new Error(`Invalid file path "${rawPath}": path is empty.`)
  }
  if (segments.some((segment) => segment === "..")) {
    throw new Error(`Invalid file path "${rawPath}": path traversal ("..") is not allowed.`)
  }
  return segments.join("/")
}

function normalizeFileMap(files: SandboxFileMap): Map<string, string> {
  const normalized = new Map<string, string>()
  for (const [path, content] of Object.entries(files)) {
    normalized.set(normalizeProjectPath(path), content)
  }
  return normalized
}

function uniqueDirectories(paths: string[]): string[] {
  const dirs = new Set<string>()
  for (const path of paths) {
    const parts = path.split("/")
    parts.pop() // drop filename
    let current = ""
    for (const part of parts) {
      current = current ? `${current}/${part}` : part
      dirs.add(current)
    }
  }
  return Array.from(dirs)
}

async function ensureDirectories(sandbox: Sandbox, paths: string[]) {
  const dirs = uniqueDirectories(paths)
  for (const dir of dirs) {
    await sandbox.fs.mkdir(dir, { recursive: true }).catch(() => {
      // Directory may already exist from the template write — safe to ignore.
    })
  }
}

async function writeFileMap(sandbox: Sandbox, files: Map<string, string>) {
  const paths = Array.from(files.keys())
  await ensureDirectories(sandbox, paths)
  await sandbox.writeFiles(
    paths.map((path) => ({ path, content: files.get(path) as string }))
  )
}

async function installDependencies(sandbox: Sandbox) {
  const result = await sandbox.runCommand({
    cmd: "npm",
    args: ["install"],
    timeoutMs: 3 * 60 * 1000,
  })
  if (result.exitCode !== 0) {
    const stderr = await result.stderr()
    throw new Error(`npm install failed (exit code ${result.exitCode}):\n${stderr.slice(0, 2000)}`)
  }
}

async function restartDevServer(sandbox: Sandbox) {
  // Best-effort: kill any previously running vite process before starting a
  // fresh one so file/dependency changes are picked up cleanly.
  await sandbox
    .runCommand({ cmd: "pkill", args: ["-f", "vite"], timeoutMs: 5000 })
    .catch(() => {})
  await sandbox.runCommand({
    cmd: "npm",
    args: ["run", "dev"],
    detached: true,
  })
  // Give the dev server a brief moment to bind to the port before the
  // caller reports the preview URL as ready.
  await new Promise((resolve) => setTimeout(resolve, 1500))
}

function getPreviewUrl(sandbox: Sandbox): string {
  return sandbox.domain(DEV_PORT)
}

/**
 * Creates a brand new sandbox, seeds it with the static starter template
 * plus the AI-generated files (which take precedence on path collisions),
 * installs dependencies, and starts the Vite dev server.
 */
export async function createProjectSandbox(files: SandboxFileMap): Promise<SandboxResult> {
  const sandbox = await Sandbox.create({
    ports: [DEV_PORT],
    timeout: SANDBOX_IDLE_TIMEOUT_MS,
    resources: { vcpus: 2 },
  })

  try {
    const merged = normalizeFileMap(PROJECT_TEMPLATE_FILES)
    for (const [path, content] of normalizeFileMap(files)) {
      merged.set(path, content)
    }

    await writeFileMap(sandbox, merged)
    await installDependencies(sandbox)
    await restartDevServer(sandbox)

    return {
      sandboxId: sandbox.name,
      previewUrl: getPreviewUrl(sandbox),
    }
  } catch (error) {
    await sandbox.stop().catch(() => {})
    throw error
  }
}

/**
 * Writes only the changed files to an already-running sandbox. Re-installs
 * dependencies and restarts the dev server only when package.json changed.
 * Throws {@link SandboxExpiredError} if the sandbox can no longer be found
 * (e.g. it idle-timed-out) so the caller can trigger a full recreate.
 */
export async function syncSandboxFiles(sandboxId: string, files: SandboxFileMap): Promise<SandboxResult> {
  let sandbox: Sandbox
  try {
    sandbox = await Sandbox.get({ name: sandboxId })
  } catch {
    throw new SandboxExpiredError()
  }

  const normalized = normalizeFileMap(files)
  await writeFileMap(sandbox, normalized)

  if (normalized.has("package.json")) {
    await installDependencies(sandbox)
    await restartDevServer(sandbox)
  }

  return {
    sandboxId: sandbox.name,
    previewUrl: getPreviewUrl(sandbox),
  }
}

/**
 * Best-effort early stop, used when a user leaves the Full Project preview
 * before the idle timeout fires.
 */
export async function stopProjectSandbox(sandboxId: string): Promise<void> {
  try {
    const sandbox = await Sandbox.get({ name: sandboxId, resume: false })
    await sandbox.stop()
  } catch {
    // Already stopped or expired — nothing to do.
  }
}
