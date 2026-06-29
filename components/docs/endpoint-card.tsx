interface EndpointCardProps {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  path: string
  description: string
  auth?: boolean
  badge?: string
}

const METHOD_COLORS: Record<string, string> = {
  GET:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  POST:   "text-primary bg-primary/10 border-primary/30",
  PUT:    "text-amber-400 bg-amber-400/10 border-amber-400/30",
  DELETE: "text-red-400 bg-red-400/10 border-red-400/30",
  PATCH:  "text-orange-400 bg-orange-400/10 border-orange-400/30",
}

export function EndpointCard({ method, path, description, auth = true, badge }: EndpointCardProps) {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-lg border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors">
      <span className={`shrink-0 mt-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${METHOD_COLORS[method]}`}>
        {method}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-[13px] font-mono text-foreground/90 break-all">{path}</code>
          {badge && (
            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/25">
              {badge}
            </span>
          )}
          {auth && (
            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/40">
              Auth required
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
