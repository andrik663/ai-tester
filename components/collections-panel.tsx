"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getCollections,
  createCollection,
  deleteCollection,
  renameCollection,
  addRequestToCollection,
  deleteRequestFromCollection,
  type Collection,
  type SavedRequest,
} from "@/lib/collections"

interface CollectionsPanelProps {
  /** Called when the user clicks "Load" on a saved request */
  onLoad?: (req: SavedRequest) => void
  /** Current request config to save into a collection */
  currentRequest?: Omit<SavedRequest, "id" | "createdAt">
}

function FolderIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0" aria-hidden>
      <path d="M1 4a1 1 0 0 1 1-1h4l1.5 2H14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4z" />
      <path d="M1 7h14" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0" aria-hidden>
      <path d="M1 4a1 1 0 0 1 1-1h4l1.5 2H14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <path d="M2 4h12M6 4V2h4v2M13 4l-1 10H4L3 4" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden>
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden>
      <path d="M13 13H3a1 1 0 0 1-1-1V2l3 3h5l3-3v11a1 1 0 0 1-1 1z" />
      <path d="M5 13V8h6v5" />
    </svg>
  )
}

function LoadIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <path d="M3 8A5 5 0 1 0 4.9 4M3 2v4h4" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <path d="M11 2l3 3-8 8H3v-3L11 2z" />
    </svg>
  )
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-success/12 text-success",
    POST: "bg-blue-500/12 text-blue-400",
    PUT: "bg-yellow-500/12 text-yellow-400",
    DELETE: "bg-destructive/12 text-destructive",
  }
  return (
    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${colors[method] ?? "bg-secondary text-muted-foreground"}`}>
      {method}
    </span>
  )
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function CollectionSection({
  col,
  onLoad,
  onDelete,
  onRename,
  onDeleteRequest,
  onSaveCurrent,
  canSave,
}: {
  col: Collection
  onLoad?: (r: SavedRequest) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onDeleteRequest: (colId: string, reqId: string) => void
  onSaveCurrent?: (colId: string) => void
  canSave: boolean
}) {
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(col.name)

  function commitRename() {
    if (editName.trim()) onRename(col.id, editName.trim())
    setEditing(false)
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Collection header */}
      <div className="flex items-center gap-1.5 px-2.5 py-2 bg-secondary/20">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          <FolderIcon open={open} />
          {editing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename()
                if (e.key === "Escape") { setEditing(false); setEditName(col.name) }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 text-[11px] font-semibold bg-background border border-primary/50 rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <span className="text-[11px] font-semibold text-foreground truncate flex-1 min-w-0">{col.name}</span>
          )}
          <span className="text-[9px] text-muted-foreground/60 flex-shrink-0">{col.requests.length}</span>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          {canSave && onSaveCurrent && (
            <button
              onClick={() => onSaveCurrent(col.id)}
              title="Save current request here"
              className="p-1 rounded text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <SaveIcon />
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <EditIcon />
          </button>
          <button
            onClick={() => {
              if (!confirm(`Delete "${col.name}" and all its requests?`)) return
              onDelete(col.id)
            }}
            className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/8 transition-colors"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Requests list */}
      {open && (
        <div className="flex flex-col">
          {col.requests.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/60 px-3 py-2.5 italic">
              No saved requests. Click the save icon above to add one.
            </p>
          ) : (
            col.requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-2 px-3 py-2 border-t border-border/50 hover:bg-secondary/20 transition-colors group"
              >
                <MethodBadge method={req.method} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-foreground truncate">{req.name}</p>
                  <p className="text-[9px] text-muted-foreground/70 truncate">{req.providerName} · {fmtDate(req.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onLoad && (
                    <button
                      onClick={() => onLoad(req)}
                      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      <LoadIcon /> Load
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteRequest(col.id, req.id)}
                    className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/8 transition-colors"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function CollectionsPanel({ onLoad, currentRequest }: CollectionsPanelProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [newColName, setNewColName]   = useState("")
  const [creating, setCreating]       = useState(false)
  const [saveAs, setSaveAs]           = useState("")
  const [saveToColId, setSaveToColId] = useState<string | null>(null)

  const reload = useCallback(() => setCollections(getCollections()), [])
  useEffect(() => { reload() }, [reload])

  function handleCreate() {
    if (!newColName.trim()) return
    createCollection(newColName.trim())
    setNewColName("")
    setCreating(false)
    reload()
  }

  function handleSaveCurrent(colId: string) {
    setSaveToColId(colId)
    setSaveAs(currentRequest?.name ?? currentRequest?.prompt?.slice(0, 40) ?? "New request")
  }

  function commitSave() {
    if (!saveToColId || !currentRequest) return
    addRequestToCollection(saveToColId, { ...currentRequest, name: saveAs || "New request" })
    setSaveToColId(null)
    setSaveAs("")
    reload()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Save dialog overlay */}
      {saveToColId && (
        <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-4 w-full max-w-xs flex flex-col gap-3">
            <p className="text-[13px] font-semibold text-foreground">Save request</p>
            <input
              autoFocus
              value={saveAs}
              onChange={(e) => setSaveAs(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitSave(); if (e.key === "Escape") setSaveToColId(null) }}
              placeholder="Request name..."
              className="text-[11px] bg-background border border-border rounded-md px-2.5 py-2 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2">
              <button
                onClick={commitSave}
                className="flex-1 text-[11px] py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                Save
              </button>
              <button
                onClick={() => setSaveToColId(null)}
                className="flex-1 text-[11px] py-1.5 rounded-lg bg-secondary text-foreground hover:opacity-80 transition-opacity"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border flex-shrink-0">
        <span className="text-[11px] font-semibold text-foreground flex-1">Collections</span>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
        >
          <PlusIcon /> New
        </button>
      </div>

      {/* New collection form */}
      {creating && (
        <div className="px-3 py-2 border-b border-border flex gap-2">
          <input
            autoFocus
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreating(false); setNewColName("") } }}
            placeholder="Collection name..."
            className="flex-1 text-[11px] bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={handleCreate} className="text-[11px] px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
            Create
          </button>
          <button onClick={() => { setCreating(false); setNewColName("") }} className="text-[11px] px-2 py-1.5 rounded-md bg-secondary text-foreground hover:opacity-80 transition-opacity">
            Cancel
          </button>
        </div>
      )}

      {/* Collections list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <div className="w-8 h-8 rounded-lg bg-secondary/60 border border-border flex items-center justify-center">
              <FolderIcon open={false} />
            </div>
            <p className="text-[11px] text-muted-foreground/70">No collections yet</p>
            <button
              onClick={() => setCreating(true)}
              className="text-[10px] text-primary hover:underline"
            >
              Create your first collection
            </button>
          </div>
        ) : (
          collections.map((col) => (
            <CollectionSection
              key={col.id}
              col={col}
              onLoad={onLoad}
              onDelete={(id) => { deleteCollection(id); reload() }}
              onRename={(id, name) => { renameCollection(id, name); reload() }}
              onDeleteRequest={(cid, rid) => { deleteRequestFromCollection(cid, rid); reload() }}
              onSaveCurrent={currentRequest ? handleSaveCurrent : undefined}
              canSave={!!currentRequest}
            />
          ))
        )}
      </div>
    </div>
  )
}
