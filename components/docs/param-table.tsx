interface Param {
  name: string
  type: string
  required: boolean
  default?: string
  description: string
}

interface ParamTableProps {
  params: Param[]
}

export function ParamTable({ params }: ParamTableProps) {
  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border/40 bg-secondary/30">
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Parameter</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Type</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] hidden sm:table-cell">Required</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={p.name} className={`border-b border-border/20 last:border-0 ${i % 2 === 0 ? "bg-background/30" : "bg-secondary/10"}`}>
              <td className="px-3 py-2.5 font-mono text-foreground/90 font-medium">{p.name}</td>
              <td className="px-3 py-2.5">
                <span className="font-mono text-primary/80 text-[11px] bg-primary/8 px-1 rounded">{p.type}</span>
              </td>
              <td className="px-3 py-2.5 hidden sm:table-cell">
                {p.required ? (
                  <span className="text-[10px] font-semibold text-destructive/80 uppercase">required</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/60 uppercase">optional{p.default ? ` (${p.default})` : ""}</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground leading-relaxed">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
