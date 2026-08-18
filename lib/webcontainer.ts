"use client"

// Client-only "Full Project" sandbox runtime, backed by StackBlitz
// WebContainers instead of a remote Vercel Sandbox VM. Everything here runs
// entirely inside the user's browser tab (via WASM + SharedArrayBuffer), so
// it needs zero Vercel credentials, has no idle-timeout billing concerns,
// and has no cold-start round trip to a server.
//
// Requires the page to be served with COOP: same-origin and
// COEP: credentialless (see next.config.mjs) so the browser considers it
// "cross-origin isolated" — without that, WebContainer.boot() throws.

import type { FileSystemTree, WebContainer, WebContainerProcess } from "@webcontainer/api"
import { PROJECT_TEMPLATE_FILES } from "./sandbox/template"

const DEV_PORT = 5173
// `npm install` inside a WebContainer has no persistent node_modules cache
// across tabs/reloads — every boot re-downloads the full dependency tree
// (Vite, React, Tailwind, TypeScript, etc.) from the npm registry over the
// sandbox's virtual network, which is meaningfully slower and more
// network-variance-prone than a real npm install. 60s was cutting it close
// even for a single-page project; 120s gives realistic headroom.
const DEV_SERVER_READY_TIMEOUT_MS = 120 * 1000

/** Strips ANSI escape codes (color codes, cursor moves) from npm/vite CLI
 *  output so progress lines are readable as plain text in the UI. */
function stripAnsi(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
}

/** Picks the last non-empty, human-readable line out of a raw output chunk
 *  — used to surface a live "what's happening" line under the boot
 *  spinner instead of a static "Booting sandbox…" the whole time. */
export function lastMeaningfulLine(chunk: string): string | undefined {
  const lines = stripAnsi(chunk)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  return lines.at(-1)
}

export type SandboxFileMap = Record<string, string>

export class SandboxExpiredError extends Error {
  constructor(message = "The in-browser sandbox is no longer available. Please restart it.") {
    super(message)
    this.name = "SandboxExpiredError"
  }
}

interface ContainerState {
  instance: WebContainer
  devProcess: WebContainerProcess | null
}

let containerState: ContainerState | null = null
let bootPromise: Promise<WebContainer> | null = null

/** Converts a flat `{ "src/App.tsx": "..." }` map into the nested
 *  `FileSystemTree` shape WebContainer's `mount()` expects. */
function toFileSystemTree(files: SandboxFileMap): FileSystemTree {
  const tree: FileSystemTree = {}
  for (const [rawPath, content] of Object.entries(files)) {
    const parts = rawPath.split("/").filter(Boolean)
    if (parts.length === 0) continue
    let cursor = tree
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        cursor[part] = { file: { contents: content } }
        return
      }
      const existing = cursor[part]
      const dirNode =
        existing && "directory" in existing ? existing : { directory: {} as FileSystemTree }
      cursor[part] = dirNode
      cursor = dirNode.directory
    })
  }
  return tree
}

/** Returns the single WebContainer instance for this tab, booting it on
 *  first use. WebContainer only allows one live instance per page — this
 *  guard is what makes repeated "boot" calls (e.g. re-generating on the
 *  first turn, then the restart button later) safe to call unconditionally. */
async function getContainer(): Promise<WebContainer> {
  if (containerState) return containerState.instance
  if (!bootPromise) {
    bootPromise = import("@webcontainer/api").then(({ WebContainer }) => WebContainer.boot())
  }
  const instance = await bootPromise
  containerState = { instance, devProcess: null }
  return instance
}

async function runInstall(instance: WebContainer, onOutput?: (chunk: string) => void) {
  // --no-audit and --no-fund each skip an extra round trip to the npm
  // registry (security-advisory bulk lookup / funding-info lookup) that
  // npm normally fires after resolving the tree — neither is useful inside
  // an ephemeral WebContainer sandbox, and every network hop here is
  // meaningfully slower than a real install due to the virtualized network.
  // --loglevel=error trims the output piped into the UI down to what's
  // actually actionable (warnings/progress spam were burying real errors).
  const install = await instance.spawn("npm", [
    "install",
    "--no-audit",
    "--no-fund",
    "--loglevel=error",
  ])
  let tail = ""
  install.output.pipeTo(
    new WritableStream({
      write(chunk) {
        tail = (tail + chunk).slice(-4000)
        onOutput?.(chunk)
      },
    })
  )
  const exitCode = await install.exit
  if (exitCode !== 0) {
    throw new Error(`npm install failed (exit code ${exitCode}):\n${tail}`)
  }
}

/** Kills any previously running dev server, starts a fresh one, and
 *  resolves once WebContainer reports the preview server as bound and
 *  reachable via its `server-ready` event. */
async function startDevServer(instance: WebContainer, onOutput?: (chunk: string) => void): Promise<string> {
  if (containerState?.devProcess) {
    containerState.devProcess.kill()
    containerState.devProcess = null
  }

  const devProcess = await instance.spawn("npm", ["run", "dev"])
  if (containerState) containerState.devProcess = devProcess
  devProcess.output.pipeTo(new WritableStream({ write: (chunk) => onOutput?.(chunk) }))

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for the dev server to start."))
    }, DEV_SERVER_READY_TIMEOUT_MS)

    const unsubscribe = instance.on("server-ready", (port, url) => {
      if (port !== DEV_PORT) return
      clearTimeout(timeout)
      unsubscribe()
      resolve(url)
    })
  })
}

export interface WebContainerBootResult {
  previewUrl: string
}

/** Boots (or reuses) the WebContainer, mounts the static starter template
 *  plus the AI-generated files (which win on path collisions), installs
 *  dependencies, and starts the Vite dev server. Used for the first turn of
 *  a Full Project conversation and for the manual "Restart" action. */
export async function createProjectWebContainer(
  files: SandboxFileMap,
  onOutput?: (chunk: string) => void
): Promise<WebContainerBootResult> {
  const instance = await getContainer()
  const merged: SandboxFileMap = { ...PROJECT_TEMPLATE_FILES, ...files }
  await instance.mount(toFileSystemTree(merged))
  await runInstall(instance, onOutput)
  const previewUrl = await startDevServer(instance, onOutput)
  return { previewUrl }
}

export interface WebContainerSyncResult {
  previewUrl?: string
  restarted: boolean
}

/** Writes only the changed files into the already-booted container.
 *  Re-installs dependencies and restarts the dev server only when
 *  package.json changed. Throws {@link SandboxExpiredError} if no
 *  container has been booted yet (e.g. the tab was reloaded) so the caller
 *  can fall back to a full `createProjectWebContainer` call. */
export async function syncWebContainerFiles(
  files: SandboxFileMap,
  onOutput?: (chunk: string) => void
): Promise<WebContainerSyncResult> {
  if (!containerState) {
    throw new SandboxExpiredError()
  }
  const instance = containerState.instance

  for (const [rawPath, content] of Object.entries(files)) {
    const dir = rawPath.split("/").slice(0, -1).join("/")
    if (dir) {
      await instance.fs.mkdir(dir, { recursive: true }).catch(() => {})
    }
    await instance.fs.writeFile(rawPath, content)
  }

  if (Object.keys(files).includes("package.json")) {
    await runInstall(instance, onOutput)
    const previewUrl = await startDevServer(instance, onOutput)
    return { previewUrl, restarted: true }
  }

  return { restarted: false }
}

/** Tears down the WebContainer instance entirely (kills the dev server and
 *  frees the underlying WASM VM). Used by the manual "Restart" action so a
 *  broken container is discarded rather than reused. */
export async function teardownProjectWebContainer(): Promise<void> {
  const state = containerState
  containerState = null
  bootPromise = null
  if (!state) return
  try {
    state.devProcess?.kill()
  } catch {
    // Already dead — nothing to do.
  }
  try {
    state.instance.teardown()
  } catch {
    // Already torn down.
  }
}

/** Whether the current page satisfies the cross-origin isolation
 *  requirement WebContainer needs (COOP + COEP headers). Surfaced in the UI
 *  as an actionable error instead of a cryptic WebContainer boot failure. */
export function isCrossOriginIsolated(): boolean {
  return typeof window !== "undefined" && window.crossOriginIsolated === true
}
