"use client"

import { useMemo, useState } from "react"

export type SandboxStatus =
  | "idle"
  | "booting"
  | "installing"
  | "starting"
  | "ready"
  | "error"

interface SandboxFilePreviewProps {
  files: Record<string, string>
  viewMode: "split" | "code" | "preview"
  status: SandboxStatus
  errorMessage?: string
  previewUrl?: string
  onRestart: () => void
}

// ── Icons (kept local to this file — mirrors the icon style already used
//    in code-preview-tab.tsx: 16/24 viewBox, currentColor stroke) ─────────────

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0">
      <path d="M9.5 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5z" />
      <polyline points="9.5 1 9.5 4.5 13 4.5" />
    </svg>
  )
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0">
      {open ? (
        <path d="M1.5 4.5h4l1 1.5h6a1 1 0 0 1 1 1v.5h-11z M1.5 4.5v8a1 1 0 0 0 1 1h9.5a1 1 0 0 0 1-1l.7-5.5h-11.2" />
      ) : (
        <path d="M1.5 3.5h4l1 1.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1z" />
      )}
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-2.5 h-2.5 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
    >
      <polyline points="5 3 11 8 5 13" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 flex-shrink-0 animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
      <path d="M12 9v4" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-12.95L1 6" />
    </svg>
  )
}

// ── File tree ──────────────────────────────────────────────────────────────

type TreeNode =
  | { type: "file"; name: string; path: string }
  | { type: "dir"; name: string; path: string; children: TreeNode[] }

function buildFileTree(paths: string[]): TreeNode[] {
  interface RawDir {
    dirs: Record<string, RawDir>
    files: string[]
  }
  const root: RawDir = { dirs: {}, files: [] }

  for (const path of paths) {
    const parts = path.split("/").filter(Boolean)
    let cursor = root
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        cursor.files.push(part)
      } else {
        cursor.dirs[part] = cursor.dirs[part] ?? { dirs: {}, files: [] }
        cursor = cursor.dirs[part]
      }
    })
  }

  function toNodes(dir: RawDir, prefix: string): TreeNode[] {
    const dirNodes: TreeNode[] = Object.keys(dir.dirs)
      .sort()
      .map((name) => {
        const path = prefix ? `${prefix}/${name}` : name
        return { type: "dir" as const, name, path, children: toNodes(dir.dirs[name], path) }
      })
    const fileNodes: TreeNode[] = dir.files
      .sort()
      .map((name) => ({ type: "file" as const, name, path: prefix ? `${prefix}/${name}` : name }))
    return [...dirNodes, ...fileNodes]
  }

  return toNodes(root, "")
}

function FileTreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: TreeNode
  depth: number
  selectedPath: string
  onSelect: (path: string) => void
}) {
  const [open, setOpen] = useState(true)

  if (node.type === "file") {
    const isSelected = node.path === selectedPath
    return (
      <button
        onClick={() => onSelect(node.path)}
        title={node.path}
        className={`flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-md text-[11px] transition-colors truncate ${
          isSelected ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <FileIcon />
        <span className="truncate">{node.name}</span>
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors truncate"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <ChevronIcon open={open} />
        <FolderIcon open={open} />
        <span className="truncate">{node.name}</span>
      </button>
      {open && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Status banner ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<SandboxStatus, string> = {
  idle: "",
  booting: "Booting sandbox…",
  installing: "Installing dependencies…",
  starting: "Starting dev server…",
  ready: "Ready",
  error: "Sandbox error",
}

function StatusBanner({
  status,
  errorMessage,
  onRestart,
}: {
  status: SandboxStatus
  errorMessage?: string
  onRestart: () => void
}) {
  if (status === "idle" || status === "ready") return null

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 px-3 h-8 border-b border-destructive/30 bg-destructive/10 text-destructive flex-shrink-0">
        <AlertIcon />
        <span className="text-[11px] flex-1 truncate">{errorMessage || STATUS_LABEL.error}</span>
        <button
          onClick={onRestart}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md hover:bg-destructive/20 transition-colors"
        >
          <RestartIcon />
          Restart
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 h-8 border-b border-border/40 bg-sidebar/20 text-muted-foreground flex-shrink-0">
      <SpinnerIcon />
      <span className="text-[11px]">{STATUS_LABEL[status]}</span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function SandboxFilePreview({
  files,
  viewMode,
  status,
  errorMessage,
  previewUrl,
  onRestart,
}: SandboxFilePreviewProps) {
  const paths = useMemo(() => Object.keys(files).sort(), [files])
  const tree = useMemo(() => buildFileTree(paths), [paths])
  const [selectedPath, setSelectedPath] = useState<string>("")

  const effectiveSelected = selectedPath && files[selectedPath] !== undefined ? selectedPath : paths.find((p) => p === "src/App.tsx") ?? paths[0] ?? ""

  const showCode = viewMode === "split" || viewMode === "code"
  const showPreview = viewMode === "split" || viewMode === "preview"

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {showCode && (
        <div
          className={`flex flex-col min-h-0 border-r border-border/40 ${showPreview ? "w-1/2" : "flex-1"}`}
        >
          <StatusBanner status={status} errorMessage={errorMessage} onRestart={onRestart} />
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* File tree */}
            <div className="w-40 flex-shrink-0 border-r border-border/40 bg-sidebar/10 overflow-y-auto py-1.5">
              {paths.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/60 px-3 py-2">No files yet</p>
              ) : (
                tree.map((node) => (
                  <FileTreeNode key={node.path} node={node} depth={0} selectedPath={effectiveSelected} onSelect={setSelectedPath} />
                ))
              )}
            </div>
            {/* Code panel */}
            <div className="flex-1 min-w-0 overflow-auto bg-sidebar/5">
              {effectiveSelected ? (
                <>
                  <div className="sticky top-0 px-3 py-1.5 border-b border-border/30 bg-sidebar/20 text-[10px] text-muted-foreground truncate">
                    {effectiveSelected}
                  </div>
                  <pre className="text-[11px] leading-relaxed text-foreground/85 p-3 whitespace-pre-wrap break-words font-mono">
                    {files[effectiveSelected]}
                  </pre>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground/60 p-3">Select a file to view its contents.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <div className={`flex flex-col min-h-0 ${showCode ? "w-1/2" : "flex-1"}`}>
          {!showCode && <StatusBanner status={status} errorMessage={errorMessage} onRestart={onRestart} />}
          <div className="flex-1 min-h-0 relative bg-white">
            {previewUrl && status === "ready" ? (
              <iframe
                key={previewUrl}
                src={previewUrl}
                className="w-full h-full border-0"
                title="Full project preview"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 bg-sidebar select-none px-6">
                {status === "error" ? (
                  <>
                    <AlertIcon />
                    <p className="text-[11px] text-destructive/80 text-center max-w-[220px]">
                      {errorMessage || "Something went wrong starting the sandbox."}
                    </p>
                    <button
                      onClick={onRestart}
                      className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-border/50 text-foreground/80 hover:bg-muted/30 transition-colors"
                    >
                      <RestartIcon />
                      Restart sandbox
                    </button>
                  </>
                ) : (
                  <>
                    <SpinnerIcon />
                    <p className="text-[11px] text-muted-foreground/70 text-center max-w-[220px]">
                      {STATUS_LABEL[status] || "Waiting for the first prompt…"}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
