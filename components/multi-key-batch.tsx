"use client"

import { useState, useRef, useCallback } from "react"
import type { MultiKeyResult, MultiKeyTestResponse, TokenUsage } from "@/app/api/multi-key-test/route"
import { PROVIDER_MODELS, maskApiKey } from "@/app/api/multi-key-test/route"
import { PROVIDERS_WITH_LIVE_MODELS } from "@/lib/providers"

// ── Provider format catalogue ─────────────────────────────────────────────────

interface ProviderFormat {
  id: string
  label: string
  country: string
  flag: string
  example: string
  keyHint: string
  autoDetect?: boolean
}

const PROVIDER_FORMATS: ProviderFormat[] = [
  { id: "dahono",      label: "Dahono Labs Gateway",   country: "ID", flag: "🇮🇩", example: "dahono:YOUR_KEY",         keyHint: "gateway key" },
  { id: "anthropic",   label: "Anthropic",             country: "US", flag: "🇺🇸", example: "anthropic:sk-ant-...",    keyHint: "sk-ant-...", autoDetect: true },
  { id: "openai",      label: "OpenAI",                country: "US", flag: "🇺🇸", example: "openai:sk-...",           keyHint: "sk-...",     autoDetect: true },
  { id: "google",      label: "Google Gemini",         country: "US", flag: "🇺🇸", example: "google:AIza...",          keyHint: "AIza...",    autoDetect: true },
  { id: "xai",         label: "xAI Grok",              country: "US", flag: "🇺🇸", example: "xai:xai-...",             keyHint: "xai-...",    autoDetect: true },
  { id: "deepseek",    label: "DeepSeek",              country: "CN", flag: "🇨🇳", example: "deepseek:YOUR_KEY",       keyHint: "API key" },
  { id: "qwen",        label: "Qwen (Alibaba)",        country: "CN", flag: "🇨🇳", example: "qwen:YOUR_KEY",           keyHint: "DashScope key" },
  { id: "zhipu",       label: "Zhipu GLM",             country: "CN", flag: "🇨🇳", example: "zhipu:YOUR_KEY",          keyHint: "BigModel key" },
  { id: "minimax",     label: "MiniMax",               country: "CN", flag: "🇨🇳", example: "minimax:YOUR_KEY",        keyHint: "API key" },
  { id: "cerebras",    label: "Cerebras",              country: "US", flag: "🇺🇸", example: "cerebras:YOUR_KEY",       keyHint: "API key" },
  { id: "fireworks",   label: "Fireworks AI",          country: "US", flag: "🇺🇸", example: "fireworks:YOUR_KEY",      keyHint: "fw-..." },
  { id: "novita",      label: "Novita AI",             country: "US", flag: "🇺🇸", example: "novita:YOUR_KEY",         keyHint: "API key" },
  { id: "cloudflare",  label: "Cloudflare Workers AI", country: "US", flag: "🇺🇸", example: "cloudflare:YOUR_KEY",     keyHint: "CF token" },
  { id: "openrouter",  label: "OpenRouter",            country: "US", flag: "🇺🇸", example: "openrouter:sk-or-v1-...", keyHint: "sk-or-...", autoDetect: true },
  { id: "sambanova",   label: "SambaNova",             country: "US", flag: "🇺🇸", example: "sambanova:YOUR_KEY",      keyHint: "API key" },
  { id: "nvidia",      label: "NVIDIA NIM",            country: "US", flag: "🇺🇸", example: "nvidia:nvapi-...",        keyHint: "nvapi-...",  autoDetect: true },
  { id: "hyperbolic",  label: "Hyperbolic",            country: "US", flag: "🇺🇸", example: "hyperbolic:YOUR_KEY",     keyHint: "API key" },
  { id: "ai21",        label: "AI21 Labs",             country: "IL", flag: "🇮🇱", example: "ai21:YOUR_KEY",           keyHint: "API key" },
  { id: "groq",        label: "Groq",                  country: "US", flag: "🇺🇸", example: "groq:gsk_...",            keyHint: "gsk_...",    autoDetect: true },
  { id: "together",    label: "Together AI",           country: "US", flag: "🇺🇸", example: "together:YOUR_KEY",       keyHint: "API key" },
  { id: "mistral",     label: "Mistral AI",            country: "FR", flag: "🇫🇷", example: "mistral:YOUR_KEY",        keyHint: "API key" },
  { id: "cohere",      label: "Cohere",                country: "CA", flag: "🇨🇦", example: "cohere:YOUR_KEY",         keyHint: "API key" },
  { id: "perplexity",  label: "Perplexity",            country: "US", flag: "🇺🇸", example: "perplexity:pplx-...",     keyHint: "pplx-...",   autoDetect: true },
  { id: "huggingface", label: "HuggingFace",           country: "US", flag: "🇺🇸", example: "huggingface:hf_...",      keyHint: "hf_...",     autoDetect: true },
  { id: "replicate",   label: "Replicate",             country: "US", flag: "🇺🇸", example: "replicate:r8_...",        keyHint: "r8_...",     autoDetect: true },
  { id: "moonshot",    label: "Moonshot (Kimi)",       country: "CN", flag: "🇨🇳", example: "moonshot:YOUR_KEY",       keyHint: "API key" },
  { id: "baidu",       label: "Baidu ERNIE",           country: "CN", flag: "🇨🇳", example: "baidu:YOUR_KEY",          keyHint: "Qianfan key" },
  { id: "yi",          label: "01.AI (Yi)",            country: "CN", flag: "🇨🇳", example: "yi:YOUR_KEY",             keyHint: "API key" },
  { id: "stepfun",     label: "Stepfun",               country: "CN", flag: "🇨🇳", example: "stepfun:YOUR_KEY",        keyHint: "API key" },
  { id: "hunyuan",     label: "Tencent Hunyuan",       country: "CN", flag: "🇨🇳", example: "hunyuan:YOUR_KEY",        keyHint: "API key" },
  { id: "azure",       label: "Azure OpenAI",          country: "US", flag: "🇺🇸", example: "azure:YOUR_KEY",          keyHint: "Azure key" },
  { id: "upstage",     label: "Upstage Solar",         country: "KR", flag: "🇰🇷", example: "upstage:YOUR_KEY",        keyHint: "API key" },
  { id: "writer",      label: "Writer (Palmyra)",      country: "US", flag: "🇺🇸", example: "writer:YOUR_KEY",         keyHint: "API key" },
  { id: "lepton",      label: "LeptonAI",              country: "US", flag: "🇺🇸", example: "lepton:YOUR_KEY",         keyHint: "API key" },
  { id: "inception",   label: "Inception (Mercury)",   country: "US", flag: "🇺🇸", example: "inception:YOUR_KEY",      keyHint: "API key" },
  { id: "ibm",         label: "IBM Granite (WatsonX)", country: "US", flag: "🇺🇸", example: "ibm:YOUR_KEY",            keyHint: "IAM token" },
  { id: "deepinfra",   label: "Deep Infra",            country: "US", flag: "🇺🇸", example: "deepinfra:YOUR_KEY",      keyHint: "API key" },
  { id: "anyscale",    label: "Anyscale",              country: "US", flag: "🇺🇸", example: "anyscale:esecret_...",    keyHint: "esecret_...", autoDetect: true },
  { id: "neets",       label: "Neets AI",              country: "US", flag: "🇺🇸", example: "neets:YOUR_KEY",          keyHint: "API key" },
  { id: "lamini",      label: "Lamini AI",             country: "US", flag: "🇺🇸", example: "lamini:YOUR_KEY",         keyHint: "API key" },
]

const KNOWN_PROVIDERS = PROVIDER_FORMATS.map((p) => p.id)

// Issue 6 fix: dev-time consistency check — every PROVIDER_FORMATS entry should have
// a matching PROVIDER_MODELS entry so the model catalogue is never silently missing.
if (process.env.NODE_ENV === "development") {
  PROVIDER_FORMATS.forEach((pf) => {
    if (!PROVIDER_MODELS[pf.id]) {
      console.warn(`[batch] No PROVIDER_MODELS entry for provider "${pf.id}". Add it to route.ts.`)
    }
  })
}

// ── Parser ────────────────────────────────────────────────────────────────────

interface ParsedEntry {
  provider: string
  apiKey: string
  raw: string
  detected: boolean
  unknown: boolean
}

function detectProvider(key: string): string | null {
  const k = key.trim()
  if (k.startsWith("sk-ant-"))               return "anthropic"
  if (k.startsWith("sk-or-"))               return "openrouter"
  if (k.startsWith("sk-proj-"))             return "openai"
  if (k.startsWith("sk-") && k.length > 30) return "openai"
  if (k.startsWith("AIza"))                return "google"
  if (k.startsWith("xai-"))                return "xai"
  if (k.startsWith("gsk_"))                return "groq"
  if (k.startsWith("r8_"))                 return "replicate"
  if (k.startsWith("pat-"))                return "huggingface"
  if (k.startsWith("hf_"))                 return "huggingface"
  if (k.startsWith("nvapi-"))              return "nvidia"
  if (k.startsWith("pplx-"))              return "perplexity"
  if (k.startsWith("esecret_"))           return "anyscale"
  return null
}

function parseLines(text: string): ParsedEntry[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((raw) => {
      const colonIdx = raw.indexOf(":")
      if (colonIdx > 0) {
        const left = raw.slice(0, colonIdx).trim().toLowerCase()
        const right = raw.slice(colonIdx + 1).trim()
        if (KNOWN_PROVIDERS.includes(left) && right) {
          return { provider: left, apiKey: right, raw, detected: false, unknown: false }
        }
      }
      const spaceIdx = raw.indexOf(" ")
      if (spaceIdx > 0) {
        const left = raw.slice(0, spaceIdx).trim().toLowerCase()
        const right = raw.slice(spaceIdx + 1).trim()
        if (KNOWN_PROVIDERS.includes(left) && right) {
          return { provider: left, apiKey: right, raw, detected: false, unknown: false }
        }
      }
      const detected = detectProvider(raw)
      if (detected) {
        return { provider: detected, apiKey: raw, raw, detected: true, unknown: false }
      }
      return { provider: "?", apiKey: raw, raw, detected: false, unknown: true }
    })
}

// ── Token badge (inline compact) ─────────────────────────────────────────────

function TokenBadge({ usage }: { usage?: TokenUsage }) {
  if (!usage) return <span className="text-[10px] text-muted-foreground/30">—</span>
  const hasData = usage.promptTokens !== null || usage.completionTokens !== null || usage.totalTokens !== null
  if (!hasData) return <span className="text-[10px] text-muted-foreground/30">—</span>

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      {usage.totalTokens !== null && (
        <span className="text-[11px] font-bold font-mono text-foreground/75 leading-none tabular-nums">
          {usage.totalTokens.toLocaleString()}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        {usage.promptTokens !== null && (
          <span className="text-[9px] font-mono text-sky-400/70 leading-none tabular-nums">
            +{usage.promptTokens.toLocaleString()}
          </span>
        )}
        {usage.completionTokens !== null && (
          <span className="text-[9px] font-mono text-violet-400/70 leading-none tabular-nums">
            -{usage.completionTokens.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ result }: { result: MultiKeyResult | null }) {
  if (!result) return <span className="text-[10px] text-muted-foreground/30 font-mono">—</span>

  if (result.statusText === "Skipped") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 whitespace-nowrap">
        SKIP
      </span>
    )
  }

  const ok = result.ok
  return (
    <div className="flex flex-col gap-0.5 items-start">
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono whitespace-nowrap border ${
        ok
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-red-500/10 text-red-400 border-red-500/20"
      }`}>
        {ok ? (
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden>
            <path d="M1.5 4l1.8 1.8L6.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden>
            <path d="M2 2l4 4M6 2l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        )}
        {result.status || "ERR"}
      </span>
      {result.durationMs > 0 && (
        <span className="text-[9px] font-mono text-muted-foreground/40 tabular-nums">{result.durationMs}ms</span>
      )}
    </div>
  )
}

// ── Model cell ────────────────────────────────────────────────────────────────

function ModelCell({ provider, result }: { provider: string; result: MultiKeyResult | null }) {
  const models = PROVIDER_MODELS[provider] ?? []
  const defaultModel = models.find((m) => m.default) ?? models[0]
  const activeModelId = result?.modelUsed ?? defaultModel?.id ?? ""
  const activeModel = models.find((m) => m.id === activeModelId) ?? defaultModel

  if (!models.length) return <span className="text-[10px] text-muted-foreground/30 font-mono">—</span>

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-medium text-foreground/80 truncate leading-tight max-w-[100px]">
        {activeModel?.label ?? activeModelId.split("/").pop() ?? "—"}
      </span>
      {models.length > 1 && (
        <div className="flex items-center gap-0.5 flex-wrap">
          {models
            .filter((m) => m.id !== activeModel?.id)
            .slice(0, 2)
            .map((m) => (
              <span
                key={m.id}
                className="text-[8px] font-mono text-muted-foreground/30 border border-border/25 rounded px-0.5 py-0 leading-tight"
                title={m.label}
              >
                {m.label.split(/[\s-]/)[0]}
              </span>
            ))}
          {models.length > 3 && (
            <span className="text-[8px] text-muted-foreground/25">+{models.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ size = 12 }: { size?: number }) {
  return (
    <svg
      className="animate-spin text-muted-foreground/60"
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ── Expanded detail panel ─────────────────────────────────────────────────────

function ExpandedDetail({
  entry,
  result,
}: {
  entry: ParsedEntry
  result: MultiKeyResult | null
}) {
  const models = PROVIDER_MODELS[entry.provider] ?? []

  return (
    <div className="px-3 py-3 flex flex-col gap-3 bg-secondary/20 border-t border-border/20">
      {/* Reply / Error */}
      {result?.chatReply && (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Reply</span>
          <p className="text-[11px] text-foreground/70 leading-relaxed">{result.chatReply}</p>
        </div>
      )}
      {result?.error && !result.ok && (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-red-400/50">Error</span>
          <p className="text-[10px] text-red-400/70 font-mono leading-relaxed break-all">{result.error}</p>
        </div>
      )}

      {/* Token breakdown */}
      {result?.tokenUsage && (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Token Usage</span>
          <div className="flex items-center gap-4">
            {result.tokenUsage.promptTokens !== null && (
              <div className="flex flex-col items-start">
                <span className="text-[8px] text-sky-400/60 font-bold uppercase tracking-wider">Input</span>
                <span className="text-sm font-mono font-bold text-sky-400 tabular-nums">{result.tokenUsage.promptTokens.toLocaleString()}</span>
              </div>
            )}
            {result.tokenUsage.completionTokens !== null && (
              <div className="flex flex-col items-start">
                <span className="text-[8px] text-violet-400/60 font-bold uppercase tracking-wider">Output</span>
                <span className="text-sm font-mono font-bold text-violet-400 tabular-nums">{result.tokenUsage.completionTokens.toLocaleString()}</span>
              </div>
            )}
            {result.tokenUsage.totalTokens !== null && (
              <div className="flex flex-col items-start">
                <span className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-wider">Total</span>
                <span className="text-sm font-mono font-bold text-foreground/60 tabular-nums">{result.tokenUsage.totalTokens.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Available models — active model is already highlighted in the chip list below (issue 5: removed duplicate plain-text "Model:" line) */}
      {models.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
            Available Models ({models.length})
          </span>
          <div className="flex flex-wrap gap-1">
            {models.map((m) => {
              const isActive = result?.modelUsed ? result.modelUsed === m.id : m.default
              return (
                <span
                  key={m.id}
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border leading-tight ${
                    isActive
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-border/40 text-muted-foreground/45"
                  }`}
                >
                  {m.label}
                  {isActive && <span className="ml-1 opacity-60">✓</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mobile card row ───────────────────────────────────────────────────────────

function MobileRow({
  entry,
  idx,
  result,
  isRunning,
  isExpanded,
  onToggle,
  onRemove,
}: {
  entry: ParsedEntry
  idx: number
  result: MultiKeyResult | null
  isRunning: boolean
  isExpanded: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const providerInfo = PROVIDER_FORMATS.find((p) => p.id === entry.provider)
  const models = PROVIDER_MODELS[entry.provider] ?? []
  const defaultModel = models.find((m) => m.default) ?? models[0]
  const activeModelId = result?.modelUsed ?? defaultModel?.id ?? ""
  const activeModel = models.find((m) => m.id === activeModelId) ?? defaultModel

  const rowBg = result?.ok
    ? "bg-emerald-500/[0.03] border-l-2 border-l-emerald-500/30"
    : result && !result.ok
      ? "bg-red-500/[0.03] border-l-2 border-l-red-500/30"
      : "border-l-2 border-l-border/20"

  return (
    <div className={`border-b border-border/40 last:border-0 ${rowBg}`}>
      {/* Main row */}
      <div
        className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer active:bg-secondary/20"
        onClick={onToggle}
      >
        {/* Index */}
        <span className="text-[10px] font-mono text-muted-foreground/30 w-5 flex-shrink-0 pt-0.5 text-right">{idx + 1}</span>

        {/* Provider + key + model */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {entry.unknown ? (
              <span className="text-[11px] font-semibold text-yellow-400/70">? unknown</span>
            ) : (
              <>
                <span className="text-base leading-none select-none" aria-hidden>{providerInfo?.flag}</span>
                <span className="text-[11px] font-semibold text-foreground truncate">{providerInfo?.label ?? entry.provider}</span>
                {entry.detected && (
                  <span className="text-[8px] px-1 rounded bg-primary/10 text-primary font-bold">auto</span>
                )}
              </>
            )}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground/45">{maskApiKey(entry.apiKey)}</span>
          {/* Model line */}
          {!entry.unknown && activeModel && (
            <span className="text-[9px] text-muted-foreground/50 truncate max-w-[160px]">
              {isRunning ? (
                <span className="inline-flex items-center gap-1"><Spinner size={8} /> testing…</span>
              ) : (
                activeModel.label
              )}
            </span>
          )}
        </div>

        {/* Right side: status + tokens */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {isRunning ? (
            <Spinner size={12} />
          ) : (
            <>
              <StatusPill result={result} />
              {/* Issue 4 fix: use shared TokenBadge instead of duplicate inline token display */}
              <TokenBadge usage={result?.tokenUsage} />
            </>
          )}
        </div>

        {/* Remove button */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded text-muted-foreground/20 hover:text-destructive hover:bg-destructive/10 transition-colors self-center"
          title="Remove"
          aria-label="Remove entry"
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Expanded */}
      {isExpanded && <ExpandedDetail entry={entry} result={result} />}
    </div>
  )
}

// ── Desktop table row ─────────────────────────────────────────────────────────

function DesktopRow({
  entry,
  idx,
  result,
  isRunning,
  isExpanded,
  onToggle,
  onRemove,
}: {
  entry: ParsedEntry
  idx: number
  result: MultiKeyResult | null
  isRunning: boolean
  isExpanded: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const providerInfo = PROVIDER_FORMATS.find((p) => p.id === entry.provider)

  const rowBg = result?.ok
    ? "bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04]"
    : result && !result.ok
      ? "bg-red-500/[0.02] hover:bg-red-500/[0.04]"
      : "hover:bg-secondary/20"

  return (
    <>
      <tr
        onClick={() => (result || entry.unknown) && onToggle()}
        className={`border-b border-border/40 last:border-0 transition-colors ${rowBg} ${(result || entry.unknown) ? "cursor-pointer" : ""}`}
      >
        {/* # */}
        <td className="px-3 py-2.5 text-muted-foreground/30 font-mono text-[10px] w-8">{idx + 1}</td>

        {/* Provider */}
        <td className="px-2 py-2.5 w-36">
          {entry.unknown ? (
            <span className="text-yellow-400/70 font-mono text-[10px]">? unknown</span>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-sm leading-none select-none flex-shrink-0" aria-hidden>{providerInfo?.flag}</span>
              <div className="flex flex-col gap-0 min-w-0">
                <span className="font-semibold text-foreground text-[10px] truncate leading-tight">
                  {providerInfo?.label ?? entry.provider}
                </span>
                {entry.detected && (
                  <span className="text-[8px] text-primary/40 font-mono">auto</span>
                )}
              </div>
            </div>
          )}
        </td>

        {/* Key */}
        <td className="px-2 py-2.5 font-mono text-muted-foreground/45 text-[10px] w-32 max-w-[128px]">
          <span className="truncate block">{maskApiKey(entry.apiKey)}</span>
        </td>

        {/* Model */}
        <td className="px-2 py-2.5 w-32">
          {isRunning ? (
            <div className="flex items-center gap-1.5">
              <Spinner size={9} />
              <span className="text-[9px] text-muted-foreground/40">testing…</span>
            </div>
          ) : (
            <ModelCell provider={entry.provider} result={result ?? null} />
          )}
        </td>

        {/* Status */}
        <td className="px-2 py-2.5 w-20">
          {isRunning ? <Spinner size={10} /> : <StatusPill result={result ?? null} />}
        </td>

        {/* Tokens */}
        <td className="px-2 py-2.5 w-24">
          {isRunning ? (
            <span className="text-[10px] text-muted-foreground/20">…</span>
          ) : (
            <TokenBadge usage={result?.tokenUsage} />
          )}
        </td>

        {/* Actions */}
        <td className="px-2 py-2.5 w-10">
          <div className="flex items-center gap-1.5">
            {(result || entry.unknown) && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggle() }}
                className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
                aria-label={isExpanded ? "Collapse row" : "Expand row"}
              >
                <svg
                  width="9" height="9" viewBox="0 0 10 10" fill="none"
                  className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              className="text-muted-foreground/20 hover:text-destructive transition-colors"
              title="Remove"
              aria-label="Remove entry"
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {isExpanded && (
        <tr className="border-b border-border/30">
          <td colSpan={7} className="p-0">
            <ExpandedDetail entry={entry} result={result ?? null} />
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MultiKeyBatch() {
  const [entries, setEntries]         = useState<ParsedEntry[]>([])
  const [prompt, setPrompt]           = useState("halo")
  const [running, setRunning]         = useState(false)
  const [results, setResults]         = useState<MultiKeyResult[]>([])
  const [summary, setSummary]         = useState<{ passed: number; failed: number; totalMs: number } | null>(null)
  const [dragOver, setDragOver]       = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [manualInput, setManualInput] = useState("")
  const [showManual, setShowManual]   = useState(false)
  const [showGuide, setShowGuide]     = useState(false)
  const [copiedId, setCopiedId]       = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  function toggleExpand(idx: number) {
    setExpandedIdx((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  function copyAllFormats() {
    const lines = PROVIDER_FORMATS.map((p) => `${p.example}`)
    copyText(lines.join("\n"), "all")
  }

  function loadText(text: string) {
    const parsed = parseLines(text)
    setEntries(parsed)
    setResults([])
    setSummary(null)
    setError(null)
    setExpandedIdx(new Set())
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
      setError("Only .txt files are supported.")
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => loadText(e.target?.result as string ?? "")
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleManualApply() {
    loadText(manualInput)
    setShowManual(false)
    // Issue 9 fix: clear the textarea so reopening manual input starts fresh
    setManualInput("")
  }

  function removeEntry(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx))
    setExpandedIdx((prev) => {
      const next = new Set<number>()
      prev.forEach((i) => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1) })
      return next
    })
  }

  const runAll = useCallback(async () => {
    const valid = entries.filter((e) => !e.unknown && e.provider !== "?")
    if (!valid.length || running) return

    setRunning(true)
    setResults([])
    setSummary(null)
    setError(null)

    try {
      const res = await fetch("/api/multi-key-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim() || "halo",
          entries: valid.map((e) => ({ provider: e.provider, apiKey: e.apiKey })),
        }),
      })
      const data: MultiKeyTestResponse = await res.json()
      setResults(data.results)
      setSummary({ passed: data.passed, failed: data.failed, totalMs: data.totalMs })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setRunning(false)
    }
  }, [entries, prompt, running])

  function exportResults() {
    if (!results.length) return
    const header = `# Multi-Key Batch Test Results\n# Generated: ${new Date().toISOString()}\n# Format: Provider | Key | Status | Code | Model | Tokens (in+out=total) | Duration | Reply\n\n`
    const lines = results.map((r) => {
      const tokens = r.tokenUsage
        ? `${r.tokenUsage.promptTokens ?? "?"}+${r.tokenUsage.completionTokens ?? "?"}=${r.tokenUsage.totalTokens ?? "?"}`
        : "—"
      return `${r.provider} | ${r.apiKeyMasked} | ${r.ok ? "OK" : "FAIL"} | ${r.status} | ${r.modelUsed ?? "—"} | ${tokens} | ${r.durationMs}ms | ${r.chatReply ? r.chatReply.slice(0, 80).replace(/\n/g, " ") : r.error ?? ""}`
    })
    const blob = new Blob([header + lines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `batch-results-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const validCount    = entries.filter((e) => !e.unknown).length
  const unknownCount  = entries.filter((e) => e.unknown).length
  const totalTokens   = results.reduce((acc, r) => acc + (r.tokenUsage?.totalTokens ?? 0), 0)
  const avgLatency    = results.length
    ? Math.round(results.reduce((a, r) => a + r.durationMs, 0) / results.length)
    : 0

  // Issue 10 fix: match by exact masked key (consistent with maskApiKey) instead of
  // fragile 8-char prefix which would collide for keys sharing the same prefix.
  function getResult(entry: ParsedEntry) {
    const masked = maskApiKey(entry.apiKey)
    return results.find(
      (r) => r.provider === entry.provider && r.apiKeyMasked === masked
    ) ?? null
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-border px-3 sm:px-4 py-2.5">
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground tracking-tight">Multi-Key Batch Test</p>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Import a .txt file — all providers tested simultaneously
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {results.length > 0 && (
              <button
                onClick={exportResults}
                className="text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors whitespace-nowrap"
              >
                Export .txt
              </button>
            )}
            {entries.length > 0 && (
              <button
                onClick={() => { setEntries([]); setResults([]); setSummary(null); setExpandedIdx(new Set()) }}
                className="text-[10px] font-medium text-muted-foreground hover:text-destructive border border-border rounded px-2 py-1 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 px-3 sm:px-4 py-3">

        {/* ── Drop zone ──────────────────────────────────────────────────────── */}
        {entries.length === 0 && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-8 px-4 text-center select-none ${
              dragOver
                ? "border-primary/60 bg-primary/5"
                : "border-border hover:border-border/80 hover:bg-secondary/30"
            }`}
          >
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="text-muted-foreground/40" aria-hidden>
              <rect x="6" y="4" width="20" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 10h12M10 14h12M10 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div>
              <p className="text-sm font-medium text-foreground">Drop a .txt file or tap to browse</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">One API key per line</p>
              <div className="mt-2 text-left inline-block bg-secondary/50 rounded px-3 py-2 text-[10px] font-mono text-muted-foreground space-y-0.5">
                <p className="text-foreground/50"># Accepted formats:</p>
                <p>anthropic:sk-ant-...</p>
                <p>openai sk-proj-...</p>
                <p>sk-or-v1-... &nbsp;&nbsp;(auto-detect)</p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>
        )}

        {/* ── Manual input ─────────────────────────────────────────────────── */}
        {entries.length === 0 && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowManual((v) => !v)}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 self-start transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${showManual ? "rotate-90" : ""}`} aria-hidden>
                <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Or paste keys manually
            </button>
            {showManual && (
              <div className="flex flex-col gap-2">
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  rows={6}
                  placeholder={"anthropic:sk-ant-...\nopenai:sk-...\nsk-or-v1-..."}
                  className="w-full rounded-md border border-border bg-background text-foreground text-[11px] font-mono px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 resize-none"
                />
                <button
                  onClick={handleManualApply}
                  disabled={!manualInput.trim()}
                  className="self-start text-[11px] font-semibold bg-primary text-primary-foreground rounded px-3 py-1.5 hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  Load keys
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Provider Format Guide ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-border overflow-hidden flex-shrink-0">
          <button
            onClick={() => setShowGuide((v) => !v)}
            className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 bg-secondary/40 hover:bg-secondary/60 transition-colors"
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold text-foreground">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted-foreground flex-shrink-0" aria-hidden>
                <rect x="1" y="2" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3 5h6M3 7h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Provider Format Guide
              <span className="text-[9px] font-normal text-muted-foreground/50">{PROVIDER_FORMATS.length} providers</span>
            </span>
            <div className="flex items-center gap-2">
              {showGuide && (
                <button
                  onClick={(e) => { e.stopPropagation(); copyAllFormats() }}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-colors ${
                    copiedId === "all"
                      ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/10"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {copiedId === "all" ? "Copied!" : "Copy All"}
                </button>
              )}
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                className={`text-muted-foreground/60 transition-transform flex-shrink-0 ${showGuide ? "rotate-180" : ""}`}
                aria-hidden
              >
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>

          {showGuide && (
            <div className="overflow-y-auto max-h-64 divide-y divide-border/40">
              {PROVIDER_FORMATS.map((pf) => {
                const models = PROVIDER_MODELS[pf.id] ?? []
                const isLive = PROVIDERS_WITH_LIVE_MODELS.has(pf.id)
                return (
                  <div key={pf.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-secondary/20 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm leading-none select-none flex-shrink-0" aria-hidden>{pf.flag}</span>
                        <span className="text-[11px] font-medium text-foreground">{pf.label}</span>
                        {pf.autoDetect && (
                          <span className="text-[8px] px-1 rounded bg-primary/10 text-primary font-bold">auto</span>
                        )}
                        {isLive && (
                          <span
                            title="Model list is fetched live from the provider API at batch test time"
                            className="text-[8px] px-1 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold"
                          >
                            live
                          </span>
                        )}
                      </div>
                      <code className="text-[10px] font-mono text-muted-foreground/55 block mt-0.5 break-all">{pf.example}</code>
                      {isLive ? (
                        <p className="text-[9px] text-muted-foreground/40 mt-1 leading-none">
                          Models fetched live from {pf.label} API at test time
                          {models.length > 0 && ` (${models.length}+ known static fallback)`}
                        </p>
                      ) : models.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {models.map((m) => (
                            <span
                              key={m.id}
                              className={`text-[8px] font-mono px-1 py-0 rounded border leading-tight ${
                                m.default
                                  ? "border-emerald-500/25 text-emerald-400/60 bg-emerald-500/5"
                                  : "border-border/30 text-muted-foreground/35"
                              }`}
                            >
                              {m.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => copyText(pf.example, pf.id)}
                      title={`Copy format for ${pf.label}`}
                      className={`flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-all mt-0.5 ${
                        copiedId === pf.id
                          ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/10"
                          : "border-border/60 text-muted-foreground/50 hover:text-foreground hover:border-border opacity-0 group-hover:opacity-100 sm:opacity-100"
                      }`}
                    >
                      {copiedId === pf.id ? "Copied" : "Copy"}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Loaded entries section ────────────────────────────────────────── */}
        {entries.length > 0 && (
          <div className="flex flex-col gap-3">

            {/* Prompt + Run */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 block mb-1">
                  Test Prompt
                </label>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="halo"
                  className="w-full rounded-lg border border-border bg-background text-foreground text-[12px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
                />
              </div>
              <button
                onClick={runAll}
                disabled={running || validCount === 0}
                className="flex items-center justify-center gap-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap"
              >
                {running ? <Spinner size={12} /> : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path d="M2 2l8 4-8 4V2z" fill="currentColor" />
                  </svg>
                )}
                {running ? "Testing…" : `Run All (${validCount})`}
              </button>
            </div>

            {/* ── Summary stats ─────────────────────────────────────────────── */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/50">Passed</span>
                  <span className="text-xl font-bold font-mono text-emerald-400 leading-none tabular-nums">{summary.passed}</span>
                  <span className="text-[9px] text-emerald-400/40 tabular-nums">{Math.round((summary.passed / results.length) * 100)}%</span>
                </div>
                <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-red-400/50">Failed</span>
                  <span className="text-xl font-bold font-mono text-red-400 leading-none tabular-nums">{summary.failed}</span>
                  <span className="text-[9px] text-red-400/40 tabular-nums">{Math.round((summary.failed / results.length) * 100)}%</span>
                </div>
                <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Total Tokens</span>
                  <span className="text-xl font-bold font-mono text-foreground/70 leading-none tabular-nums">
                    {totalTokens > 0 ? totalTokens.toLocaleString() : "—"}
                  </span>
                  <span className="text-[9px] text-muted-foreground/30">all keys</span>
                </div>
                <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Avg Latency</span>
                  <span className="text-xl font-bold font-mono text-foreground/70 leading-none tabular-nums">{avgLatency}ms</span>
                  <span className="text-[9px] text-muted-foreground/30 tabular-nums">{summary.totalMs}ms total</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-[11px] text-destructive">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden>
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M6 3.5v3M6 8v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {error}
              </div>
            )}

            {/* ── Entry count summary ───────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground/50">
                {entries.length} {entries.length === 1 ? "entry" : "entries"} loaded
              </span>
              {validCount !== entries.length && (
                <span className="text-[10px] text-emerald-400/60">{validCount} valid</span>
              )}
              {unknownCount > 0 && (
                <span className="text-[10px] text-yellow-400/60">{unknownCount} unknown</span>
              )}
            </div>

            {/* ── Mobile card list ──────────────────────────────────────────── */}
            <div className="block sm:hidden rounded-xl border border-border overflow-hidden">
              {/* Mobile header */}
              <div className="flex items-center justify-between px-3 py-2 bg-secondary/60 border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/40 w-5">#</span>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/40">Provider / Key / Model</span>
                </div>
                <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/40">Status / Tokens</span>
              </div>
              {entries.map((entry, idx) => {
                const res = getResult(entry)
                const isRunning = running && !res
                const isExpanded = expandedIdx.has(idx)
                return (
                  <MobileRow
                    key={idx}
                    entry={entry}
                    idx={idx}
                    result={res}
                    isRunning={isRunning}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(idx)}
                    onRemove={() => removeEntry(idx)}
                  />
                )
              })}
            </div>

            {/* ── Desktop table ─────────────────────────────────────────────── */}
            <div className="hidden sm:block rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] min-w-[520px]">
                  <thead>
                    <tr className="border-b border-border bg-secondary/60">
                      <th className="text-left px-3 py-2.5 font-bold text-muted-foreground/40 uppercase tracking-wider text-[8px] w-8">#</th>
                      <th className="text-left px-2 py-2.5 font-bold text-muted-foreground/40 uppercase tracking-wider text-[8px] w-36">Provider</th>
                      <th className="text-left px-2 py-2.5 font-bold text-muted-foreground/40 uppercase tracking-wider text-[8px] w-32">Key</th>
                      <th className="text-left px-2 py-2.5 font-bold text-muted-foreground/40 uppercase tracking-wider text-[8px] w-32">Model</th>
                      <th className="text-left px-2 py-2.5 font-bold text-muted-foreground/40 uppercase tracking-wider text-[8px] w-20">Status</th>
                      <th className="text-left px-2 py-2.5 font-bold text-muted-foreground/40 uppercase tracking-wider text-[8px] w-24">
                        <div className="flex flex-col gap-0.5">
                          <span>Tokens</span>
                          <span className="flex gap-1.5 font-normal text-[7px] normal-case tracking-normal">
                            <span className="text-sky-400/50">in</span>
                            <span className="text-violet-400/50">out</span>
                          </span>
                        </div>
                      </th>
                      <th className="w-10 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, idx) => {
                      const res = getResult(entry)
                      const isRunning = running && !res
                      const isExpanded = expandedIdx.has(idx)
                      return (
                        <DesktopRow
                          key={idx}
                          entry={entry}
                          idx={idx}
                          result={res}
                          isRunning={isRunning}
                          isExpanded={isExpanded}
                          onToggle={() => toggleExpand(idx)}
                          onRemove={() => removeEntry(idx)}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Unknown keys warning */}
            {unknownCount > 0 && (
              <p className="text-[10px] text-yellow-400/70 border border-yellow-400/15 bg-yellow-400/5 rounded px-3 py-2 leading-relaxed">
                {unknownCount} {unknownCount === 1 ? "entry" : "entries"} skipped — provider could not be detected. Use format:{" "}
                <code className="font-mono">provider:apikey</code>
              </p>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
