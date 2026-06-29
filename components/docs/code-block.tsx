"use client"

import { useState } from "react"

interface CodeBlockProps {
  code: string
  language?: string
  title?: string
}

export function CodeBlock({ code, language = "bash", title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-secondary/40 border-b border-border/50">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          <button
            onClick={handleCopy}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded border border-border/40 hover:border-border/80"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      {!title && (
        <div className="absolute top-2 right-2">
          <button
            onClick={handleCopy}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded border border-border/40 hover:border-border/80 bg-card"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      <div className="relative">
        {!title && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 z-10 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded border border-border/40 hover:border-border/80 bg-card"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
        <pre className="p-4 text-[12px] leading-relaxed font-mono text-foreground/90 overflow-x-auto bg-background/60">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}
