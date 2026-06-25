"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getEnvironments,
  getActiveEnvironment,
  setActiveEnvironment,
  createEnvironment,
  deleteEnvironment,
  updateEnvironmentVars,
  renameEnvironment,
  type Environment,
  type EnvVar,
} from "@/lib/environments"

interface EnvSwitcherProps {
  onEnvChange?: (env: Environment | null) => void
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden>
      <path d="M8 3v10M3 8h10" />
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

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <path d="M11 2l3 3-8 8H3v-3L11 2z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
      <path d="M3 8l4 4 6-7" />
    </svg>
  )
}

function VarRow({
  row,
  onChange,
  onDelete,
}: {
  row: EnvVar & { _id: number }
  onChange: (key: string, value: string) => void
  onDelete: () => void
}) {
  return (
    <div className="flex gap-1 items-center">
      <input
        value={row.key}
        onChange={(e) => onChange(e.target.value, row.value)}
        placeholder="VARIABLE_NAME"
        className="w-32 text-[10px] font-mono bg-background border border-border rounded px-2 py-1 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <span className="text-muted-foreground/40 text-[10px] flex-shrink-0">=</span>
      <input
        value={row.value}
        onChange={(e) => onChange(row.key, e.target.value)}
        placeholder="value"
        type="password"
        className="flex-1 min-w-0 text-[10px] font-mono bg-background border border-border rounded px-2 py-1 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        onClick={onDelete}
        className="flex-shrink-0 text-muted-foreground/40 hover:text-red-400 transition-colors p-1 rounded"
      >
        <TrashIcon />
      </button>
    </div>
  )
}

function EnvDetail({
  env,
  isActive,
  onActivate,
  onDelete,
  onRename,
}: {
  env: Environment
  isActive: boolean
  onActivate: (id: string | null) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
}) {
  const [open, setOpen]         = useState(isActive)
  const [editName, setEditName] = useState(false)
  const [name, setName]         = useState(env.name)
  const [rows, setRows]         = useState<Array<EnvVar & { _id: number }>>(
    env.vars.map((v, i) => ({ ...v, _id: i }))
  )
  const [dirty, setDirty]       = useState(false)
  const nextId                  = rows.length + 1

  function addRow() {
    setRows((prev) => [...prev, { key: "", value: "", _id: Date.now() + nextId }])
    setDirty(true)
  }

  function updateRow(id: number, key: string, value: string) {
    setRows((prev) => prev.map((r) => r._id === id ? { ...r, key, value } : r))
    setDirty(true)
  }

  function deleteRow(id: number) {
    setRows((prev) => prev.filter((r) => r._id !== id))
    setDirty(true)
  }

  function save() {
    const vars = rows.filter((r) => r.key.trim()).map(({ key, value }) => ({ key, value }))
    updateEnvironmentVars(env.id, vars)
    setDirty(false)
  }

  function commitRename() {
    if (name.trim()) onRename(env.id, name.trim())
    setEditName(false)
  }

  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${isActive ? "border-primary/40" : "border-border"}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-2.5 py-2 ${isActive ? "bg-primary/8" : "bg-secondary/20"}`}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {isActive && (
            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary/20 border border-primary/40 text-primary flex items-center justify-center">
              <CheckIcon />
            </span>
          )}
          {!isActive && (
            <span className="flex-shrink-0 w-4 h-4 rounded-full border border-border" />
          )}
          {editName ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setEditName(false); setName(env.name) } }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 text-[11px] font-semibold bg-background border border-primary/50 rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <span className={`text-[11px] font-semibold truncate flex-1 min-w-0 ${isActive ? "text-primary" : "text-foreground"}`}>{env.name}</span>
          )}
          <span className="text-[9px] text-muted-foreground/40 flex-shrink-0">{env.vars.length} vars</span>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onActivate(isActive ? null : env.id)}
            className={`text-[9px] px-1.5 py-0.5 rounded border font-medium transition-colors ${
              isActive
                ? "bg-primary/10 text-primary border-primary/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                : "bg-secondary/60 text-muted-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            }`}
          >
            {isActive ? "Deactivate" : "Activate"}
          </button>
          <button onClick={() => setEditName(true)} className="p-1 rounded text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60 transition-colors">
            <EditIcon />
          </button>
          <button
            onClick={() => { if (!confirm(`Delete env "${env.name}"?`)) return; onDelete(env.id) }}
            className="p-1 rounded text-muted-foreground/40 hover:text-red-400 hover:bg-red-400/8 transition-colors"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Vars editor */}
      {open && (
        <div className="px-3 py-2.5 flex flex-col gap-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">Variables · use {`{{VARIABLE_NAME}}`} in headers/body</p>
          {rows.map((row) => (
            <VarRow
              key={row._id}
              row={row}
              onChange={(k, v) => updateRow(row._id, k, v)}
              onDelete={() => deleteRow(row._id)}
            />
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={addRow}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary/60 transition-colors"
            >
              <PlusIcon /> Add variable
            </button>
            {dirty && (
              <button
                onClick={save}
                className="ml-auto text-[10px] px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                Save
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function EnvSwitcher({ onEnvChange }: EnvSwitcherProps) {
  const [envs, setEnvs]           = useState<Environment[]>([])
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [creating, setCreating]   = useState(false)
  const [newName, setNewName]     = useState("")

  const reload = useCallback(() => {
    const all = getEnvironments()
    const active = getActiveEnvironment()
    setEnvs(all)
    setActiveId(active?.id ?? null)
    onEnvChange?.(active)
  }, [onEnvChange])

  useEffect(() => { reload() }, [reload])

  function handleActivate(id: string | null) {
    setActiveEnvironment(id)
    reload()
  }

  function handleCreate() {
    if (!newName.trim()) return
    createEnvironment(newName.trim())
    setNewName("")
    setCreating(false)
    reload()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border flex-shrink-0">
        <span className="text-[11px] font-semibold text-foreground flex-1">Environments</span>
        {activeId && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            1 active
          </span>
        )}
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
        >
          <PlusIcon /> New
        </button>
      </div>

      {/* New env form */}
      {creating && (
        <div className="px-3 py-2 border-b border-border flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreating(false); setNewName("") } }}
            placeholder="Environment name (e.g. Development)"
            className="flex-1 text-[11px] bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={handleCreate} className="text-[11px] px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
            Create
          </button>
          <button onClick={() => { setCreating(false); setNewName("") }} className="text-[11px] px-2 py-1.5 rounded-md bg-secondary text-foreground hover:opacity-80 transition-opacity">
            Cancel
          </button>
        </div>
      )}

      {/* Env list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {envs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <div className="w-8 h-8 rounded-lg bg-secondary/60 border border-border flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted-foreground/50" aria-hidden>
                <rect x="2" y="3" width="12" height="10" rx="1.5" />
                <path d="M5 7h6M5 10h3" />
              </svg>
            </div>
            <p className="text-[11px] text-muted-foreground/50">No environments</p>
            <p className="text-[10px] text-muted-foreground/40 max-w-[200px]">
              Create environments to store API keys and variables. Use {`{{VAR}}`} in headers and body templates.
            </p>
            <button onClick={() => setCreating(true)} className="text-[10px] text-primary hover:underline mt-1">
              Create first environment
            </button>
          </div>
        ) : (
          envs.map((env) => (
            <EnvDetail
              key={env.id}
              env={env}
              isActive={env.id === activeId}
              onActivate={handleActivate}
              onDelete={(id) => { deleteEnvironment(id); reload() }}
              onRename={(id, name) => { renameEnvironment(id, name); reload() }}
            />
          ))
        )}
      </div>
    </div>
  )
}
