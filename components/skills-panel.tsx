"use client"

import { useState, useCallback } from "react"
import { copyToClipboard } from "@/lib/clipboard"
import { loadWorkingKeys, type WorkingKeyRecord } from "@/lib/working-keys-store"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Skill {
  id: string
  name: string
  description: string
  repo: string           // e.g. "anthropics/skills"
  registrySlug: string   // e.g. "anthropics/skills"
  installs: string       // human-readable, e.g. "679.3K"
  category: string
  systemPrompt: string   // injected when skill is activated
  tags: string[]
}

export interface ActiveSkillConfig {
  skillId: string
  systemPrompt: string
}

// ── Curated skill catalogue ───────────────────────────────────────────────────

const SKILLS: Skill[] = [
  // ── anthropics/skills (most downloaded) ────────────────────────────────────
  {
    id: "frontend-design",
    name: "Frontend Design",
    description: "Build production-quality UIs with modern design patterns, accessibility, and responsive layouts.",
    repo: "anthropics/skills",
    registrySlug: "anthropics/skills",
    installs: "679.3K",
    category: "Design",
    tags: ["UI", "CSS", "React", "A11y"],
    systemPrompt: `You are an expert frontend engineer and designer. When helping with UI tasks:
- Apply modern design principles: clear hierarchy, consistent spacing, readable typography
- Always consider accessibility (ARIA roles, keyboard navigation, contrast ratios)
- Use semantic HTML and Tailwind utility classes
- Prefer component composition over monolithic components
- Optimize for responsive design (mobile-first)
- Follow the skill: npx skills add anthropics/skills --skill frontend-design`,
  },
  {
    id: "skill-creator",
    name: "Skill Creator",
    description: "Create well-structured agent skills with proper SKILL.md frontmatter and clear instructions.",
    repo: "anthropics/skills",
    registrySlug: "anthropics/skills",
    installs: "319.3K",
    category: "Productivity",
    tags: ["Skills", "Agent", "Tooling"],
    systemPrompt: `You are an expert at creating agent skills for Claude and other coding agents.
When creating skills:
- Write clear SKILL.md files with proper YAML frontmatter (name, description fields are required)
- Make instructions explicit and actionable
- Include examples of when and how to use the skill
- Keep skills focused and single-purpose
- Follow the skill: npx skills add anthropics/skills --skill skill-creator`,
  },
  {
    id: "webapp-testing",
    name: "Web App Testing",
    description: "Test web applications systematically — unit, integration, and e2e tests with best practices.",
    repo: "anthropics/skills",
    registrySlug: "anthropics/skills",
    installs: "117.6K",
    category: "Testing",
    tags: ["Testing", "QA", "Vitest", "Playwright"],
    systemPrompt: `You are an expert in web application testing. When writing tests:
- Prefer Vitest/Jest for unit and integration tests, Playwright for e2e
- Follow AAA (Arrange-Act-Assert) pattern
- Write tests that describe behavior, not implementation
- Mock external dependencies (APIs, databases) properly
- Aim for meaningful coverage, not 100% coverage
- Follow the skill: npx skills add anthropics/skills --skill webapp-testing`,
  },
  {
    id: "mcp-builder",
    name: "MCP Builder",
    description: "Build Model Context Protocol (MCP) servers and tools that extend AI capabilities.",
    repo: "anthropics/skills",
    registrySlug: "anthropics/skills",
    installs: "91.3K",
    category: "Developer Tools",
    tags: ["MCP", "Protocol", "Tools", "API"],
    systemPrompt: `You are an expert at building MCP (Model Context Protocol) servers.
When building MCP tools:
- Define clear tool schemas with proper JSON Schema types
- Handle errors gracefully with informative error messages
- Use zod for runtime validation of inputs
- Keep tools atomic and composable
- Document all parameters and return types
- Follow the skill: npx skills add anthropics/skills --skill mcp-builder`,
  },
  {
    id: "canvas-design",
    name: "Canvas Design",
    description: "Create rich canvas-based visualizations, interactive graphics, and data displays.",
    repo: "anthropics/skills",
    registrySlug: "anthropics/skills",
    installs: "88.3K",
    category: "Design",
    tags: ["Canvas", "Graphics", "Visualization", "SVG"],
    systemPrompt: `You are an expert in canvas and SVG-based design and visualization.
When working with Canvas/SVG:
- Use requestAnimationFrame for smooth animations
- Handle DPI/devicePixelRatio for crisp rendering on high-DPI screens
- Prefer SVG for static or scalable graphics, Canvas for pixel-intensive work
- Always set crossOrigin="anonymous" when loading external images onto canvas
- Clean up event listeners and animation frames on unmount
- Follow the skill: npx skills add anthropics/skills --skill canvas-design`,
  },
  {
    id: "claude-api",
    name: "Claude API",
    description: "Use the Anthropic Claude API effectively — streaming, tool use, vision, and best practices.",
    repo: "anthropics/skills",
    registrySlug: "anthropics/skills",
    installs: "50.7K",
    category: "AI / API",
    tags: ["Claude", "Anthropic", "API", "Streaming"],
    systemPrompt: `You are an expert at using the Anthropic Claude API.
When working with the Claude API:
- Use the Messages API (/v1/messages) for all chat completions
- Prefer streaming (stream: true) for long responses
- Use tool_use content blocks for function/tool calling
- Structure system prompts clearly with explicit instructions
- Handle rate limits with exponential backoff
- Use claude-3-5-haiku for fast tasks, claude-opus-4 for complex reasoning
- Follow the skill: npx skills add anthropics/skills --skill claude-api`,
  },
  // ── anthropics/skills — Coding & Artifacts ─────────────────────────────────
  {
    id: "web-artifacts-builder",
    name: "Web Artifacts Builder",
    description: "Build multi-component React artifacts with Vite, Tailwind CSS, and 40+ shadcn/ui components. Bundles into a single self-contained HTML file.",
    repo: "anthropics/skills",
    registrySlug: "anthropics/skills",
    installs: "82.8K",
    category: "Coding",
    tags: ["React", "Vite", "shadcn/ui", "Artifacts"],
    systemPrompt: `You are an expert at building React artifacts for Claude using the web-artifacts-builder skill.
When building web artifacts:
- Scaffold with React 18 + TypeScript + Vite + Tailwind CSS
- Use shadcn/ui for 40+ pre-built components (Button, Card, Dialog, etc.)
- Bundle everything into a single self-contained HTML file with inlined assets
- Avoid "AI slop" patterns: no excessive centered layouts, purple gradients, uniform rounded corners, or Inter font everywhere
- Use scripts/init-artifact.sh to initialize and scripts/bundle-artifact.sh to output the final HTML
- Output complete, working, self-contained HTML — never partial snippets
- Follow the skill: npx skills add anthropics/skills --skill web-artifacts-builder`,
  },
  {
    id: "algorithmic-art",
    name: "Algorithmic Art",
    description: "Create generative art using p5.js with seeded randomness, particle systems, and parametric exploration. Outputs self-contained HTML artifacts.",
    repo: "anthropics/skills",
    registrySlug: "anthropics/skills",
    installs: "68.0K",
    category: "Coding",
    tags: ["p5.js", "Generative", "Canvas", "Art"],
    systemPrompt: `You are an expert at creating algorithmic generative art using p5.js.
When creating algorithmic art:
- First define an algorithmic philosophy — a computational aesthetic movement (emergent behavior, mathematical beauty, controlled chaos)
- Express it through a p5.js sketch with seeded randomness for reproducible variations
- Include seed navigation controls (previous/next/random/jump) and real-time parameter sliders
- Output a self-contained HTML file with embedded p5.js code, sidebar controls, and a download button
- Use noise fields, particle systems, flow dynamics, and parametric variation
- Keep the aesthetic intentional — emergent behavior constrained by mathematical rules
- Follow the skill: npx skills add anthropics/skills --skill algorithmic-art`,
  },
  {
    id: "theme-factory",
    name: "Theme Factory",
    description: "Apply professional font and color themes to web artifacts, slides, and documents. 10 curated preset themes plus custom generation.",
    repo: "anthropics/skills",
    registrySlug: "anthropics/skills",
    installs: "70.0K",
    category: "Coding",
    tags: ["Themes", "CSS", "Colors", "Typography"],
    systemPrompt: `You are an expert at applying professional visual themes to web artifacts and documents using the theme-factory skill.
When applying themes:
- Choose from 10 preset themes: Ocean Depths, Sunset Boulevard, Forest Canopy, Modern Minimalist, Golden Hour, Arctic Frost, Desert Rose, Tech Innovation, Botanical Garden, Midnight Galaxy
- Each theme has a cohesive color palette with hex codes and complementary font pairings
- Generate custom themes on-the-fly when presets don't fit
- Apply themes consistently: enforce proper contrast ratios (4.5:1 minimum), readable typography, and visual hierarchy
- Workflow: show theme showcase → get user selection → apply throughout the artifact
- Never apply themes that reduce readability or accessibility
- Follow the skill: npx skills add anthropics/skills --skill theme-factory`,
  },
  // ── vercel-labs/agent-skills (most downloaded) ──────────────────────────────
  {
    id: "web-design-guidelines",
    name: "Web Design Guidelines",
    description: "Review and improve web interfaces with Vercel's design standards, accessibility, and UX quality checks.",
    repo: "vercel-labs/agent-skills",
    registrySlug: "vercel-labs/agent-skills",
    installs: "473.3K",
    category: "Design",
    tags: ["Design", "UX", "Vercel", "A11y"],
    systemPrompt: `You are a web design expert following Vercel's design guidelines.
When reviewing or building UIs:
- Use max 3-5 colors total with a clear primary, neutrals, and accent
- Limit to 2 font families max (one for headings, one for body)
- Design mobile-first, then enhance for larger screens
- Use semantic Tailwind classes and avoid arbitrary values
- Wrap titles in text-balance for optimal line breaks
- Never use emojis as icons — use proper SVG icons
- Follow the skill: npx skills add vercel-labs/agent-skills --skill web-design-guidelines`,
  },
  {
    id: "vercel-react-best-practices",
    name: "Vercel React Best Practices",
    description: "Build production-quality React apps following Vercel's engineering patterns and Next.js conventions.",
    repo: "vercel-labs/agent-skills",
    registrySlug: "vercel-labs/agent-skills",
    installs: "561.8K",
    category: "React",
    tags: ["React", "Next.js", "Vercel", "RSC"],
    systemPrompt: `You are a React and Next.js expert following Vercel's best practices.
When building React apps:
- Use Server Components (RSC) by default, Client Components only when needed
- Fetch data in RSCs and pass down as props rather than fetching in useEffect
- Use SWR or React Query for client-side data fetching
- Split code into focused, single-responsibility components
- Use Next.js App Router patterns: layouts, loading.tsx, error.tsx
- Await params and searchParams in Next.js 16+ Server Components
- Follow the skill: npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices`,
  },
  {
    id: "deploy-to-vercel",
    name: "Deploy to Vercel",
    description: "Deploy apps to Vercel — project setup, environment variables, domains, and CI/CD.",
    repo: "vercel-labs/agent-skills",
    registrySlug: "vercel-labs/agent-skills",
    installs: "93.9K",
    category: "DevOps",
    tags: ["Vercel", "Deploy", "CI/CD", "Env"],
    systemPrompt: `You are an expert at deploying applications to Vercel.
When deploying to Vercel:
- Use vercel.json for project configuration and rewrites
- Set environment variables in Vercel dashboard or via vercel env add
- Use Preview deployments for branch testing
- Configure domains via vercel domains add
- Use Edge Functions for low-latency global APIs
- Monitor deployments via vercel inspect and vercel logs
- Follow the skill: npx skills add vercel-labs/agent-skills --skill deploy-to-vercel`,
  },
  // ── vercel-labs/skills ──────────────────────────────────────────────────────
  {
    id: "find-skills",
    name: "Find Skills",
    description: "Discover and search for agent skills interactively across registries on skills.sh.",
    repo: "vercel-labs/skills",
    registrySlug: "vercel-labs/skills",
    installs: "2.6M",
    category: "Productivity",
    tags: ["Discovery", "Skills", "Registry"],
    systemPrompt: `You help users find and install agent skills from the skills.sh registry.
When searching for skills:
- Use npx skills find <keyword> to search by topic
- Browse skills.sh for curated collections by org (e.g. anthropics/skills, vercel-labs/agent-skills)
- Recommend skills based on the task at hand
- Install with: npx skills add <owner/repo> --skill <skill-name>
- List installed skills with: npx skills list
- Update skills with: npx skills update
- Follow the skill: npx skills add vercel-labs/skills`,
  },
]

const CATEGORIES = Array.from(new Set(SKILLS.map((s) => s.category))).sort()
const REGISTRIES = [
  { id: "all", label: "All registries" },
  { id: "anthropics/skills", label: "anthropics/skills" },
  { id: "vercel-labs/agent-skills", label: "vercel-labs/agent-skills" },
  { id: "vercel-labs/skills", label: "vercel-labs/skills" },
]

// ── Icons ─────────────────────────────────────────────────────────────────────

function SkillIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5" y="5" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 11V3a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function ZapIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M9 1L3 9h5l-1 6 7-8H9l1-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function TerminalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 6l3 3-3 3M9 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M7 9a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5l-1 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 7a3.5 3.5 0 00-5 0L2 9a3.5 3.5 0 005 5l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

// ── Skill card ────────────────────────────────────────────────────────────────

function SkillCard({
  skill,
  isActive,
  onActivate,
  onDeactivate,
  workingKeyCount,
}: {
  skill: Skill
  isActive: boolean
  onActivate: (skill: Skill) => void
  onDeactivate: (skillId: string) => void
  workingKeyCount: number
}) {
  const [copiedInstall, setCopiedInstall] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const installCmd = `npx skills add ${skill.registrySlug}${skill.registrySlug.includes("/skills") && !skill.registrySlug.endsWith("/skills") ? ` --skill ${skill.id}` : skill.repo.startsWith("vercel-labs/agent") ? ` --skill ${skill.id}` : ""}`

  const handleCopyInstall = useCallback(async () => {
    const cmd = skill.registrySlug === "vercel-labs/skills"
      ? `npx skills add vercel-labs/skills`
      : `npx skills add ${skill.registrySlug} --skill ${skill.id}`
    await copyToClipboard(cmd).catch(() => {})
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
  }, [skill])

  const handleCopyPrompt = useCallback(async () => {
    await copyToClipboard(skill.systemPrompt).catch(() => {})
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }, [skill])

  const repoColor =
    skill.registrySlug.startsWith("anthropics") ? "text-amber-400 border-amber-400/30 bg-amber-400/10" :
    skill.registrySlug.startsWith("vercel-labs/agent") ? "text-sky-400 border-sky-400/30 bg-sky-400/10" :
    "text-violet-400 border-violet-400/30 bg-violet-400/10"

  return (
    <div className={`flex flex-col border rounded-xl transition-all overflow-hidden ${
      isActive
        ? "border-primary/50 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
        : "border-border bg-secondary/10 hover:border-border/80"
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${
          isActive ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground/50"
        }`}>
          <SkillIcon />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-foreground/90">{skill.name}</span>
            <span className="text-[8px] font-mono text-muted-foreground/40">{skill.installs} installs</span>
            {skill.category === "Coding" && (
              <span className="text-[8px] px-1.5 py-0.5 rounded border border-sky-400/30 bg-sky-400/10 text-sky-400 font-semibold flex items-center gap-0.5">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-2 h-2">
                  <polyline points="4 5 1 8 4 11" />
                  <polyline points="12 5 15 8 12 11" />
                  <line x1="9" y1="3" x2="7" y2="13" />
                </svg>
                Code tab
              </span>
            )}
            {isActive && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full border border-primary/40 bg-primary/15 text-primary font-semibold">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-2 leading-relaxed">
            {skill.description}
          </p>
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <span className={`text-[8px] px-1.5 py-0.5 rounded border font-mono ${repoColor}`}>
              {skill.registrySlug}
            </span>
            {skill.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[8px] px-1 py-0.5 rounded border border-border text-muted-foreground/40">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Expanded: install + prompt */}
      {expanded && (
        <div className="border-t border-border/50 bg-background/20 flex flex-col gap-3 p-3">
          {/* Install command */}
          <div>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1.5 font-semibold">
              Install
            </p>
            <div className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2 border border-border/50">
              <TerminalIcon />
              <code className="flex-1 text-[10px] font-mono text-foreground/80 truncate">
                {skill.registrySlug === "vercel-labs/skills"
                  ? `npx skills add vercel-labs/skills`
                  : `npx skills add ${skill.registrySlug} --skill ${skill.id}`}
              </code>
              <button
                onClick={handleCopyInstall}
                className={`flex-shrink-0 flex items-center gap-1 text-[9px] px-2 py-1 rounded border transition-colors ${
                  copiedInstall
                    ? "border-green-500/40 bg-green-500/10 text-green-400"
                    : "border-border text-muted-foreground/50 hover:text-foreground hover:border-primary/40"
                }`}
              >
                {copiedInstall ? <CheckIcon /> : <CopyIcon />}
                {copiedInstall ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Usage instructions */}
          <div>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1.5 font-semibold">
              Usage
            </p>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2 border border-border/50">
                <TerminalIcon />
                <code className="flex-1 text-[10px] font-mono text-foreground/70 truncate">
                  {skill.registrySlug === "vercel-labs/skills"
                    ? `npx skills use vercel-labs/skills`
                    : `npx skills use ${skill.registrySlug} --skill ${skill.id}`}
                </code>
              </div>
              <div className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2 border border-border/50">
                <TerminalIcon />
                <code className="flex-1 text-[10px] font-mono text-foreground/70 truncate">
                  {`npx skills use ${skill.registrySlug.split("/").pop()} --skill ${skill.id} --agent claude-code`}
                </code>
              </div>
            </div>
          </div>

          {/* System prompt preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
                System Prompt (injected when active)
              </p>
              <button
                onClick={handleCopyPrompt}
                className={`flex items-center gap-1 text-[9px] px-2 py-1 rounded border transition-colors ${
                  copiedPrompt
                    ? "border-green-500/40 bg-green-500/10 text-green-400"
                    : "border-border text-muted-foreground/50 hover:text-foreground"
                }`}
              >
                {copiedPrompt ? <CheckIcon /> : <CopyIcon />}
                {copiedPrompt ? "Copied" : "Copy prompt"}
              </button>
            </div>
            <pre className="text-[9px] text-muted-foreground/60 bg-secondary/30 rounded-lg p-2.5 border border-border/50 overflow-auto max-h-28 leading-relaxed whitespace-pre-wrap font-mono">
              {skill.systemPrompt}
            </pre>
          </div>

          {/* View on skills.sh */}
          <a
            href={`https://skills.sh/${skill.registrySlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[9px] text-muted-foreground/50 hover:text-primary transition-colors"
          >
            <LinkIcon />
            View on skills.sh/{skill.registrySlug}
          </a>
        </div>
      )}

      {/* Activate / deactivate row */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border/50 bg-background/10">
        {isActive ? (
          <>
            <span className="flex items-center gap-1.5 text-[9px] text-primary/80 flex-1">
              <ZapIcon />
              {skill.category === "Coding"
                ? "Active — switch to Code tab to use"
                : `Active on ${workingKeyCount} key${workingKeyCount !== 1 ? "s" : ""}`}
            </span>
            <button
              onClick={() => onDeactivate(skill.id)}
              className="text-[9px] px-3 py-1.5 rounded-lg border border-red-400/30 bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors"
            >
              Deactivate
            </button>
          </>
        ) : (
          <>
            <span className="text-[9px] text-muted-foreground/40 flex-1">
              {skill.category === "Coding" ? "Injects skill into Code tab" : "Activates on all working keys"}
            </span>
            <button
              onClick={() => onActivate(skill)}
              className="flex items-center gap-1.5 text-[9px] px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <ZapIcon />
              Activate
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Active skill banner ───────────────────────────────────────────────────────

function ActiveSkillBanner({
  activeSkill,
  workingKeys,
  onDeactivate,
}: {
  activeSkill: Skill
  workingKeys: WorkingKeyRecord[]
  onDeactivate: () => void
}) {
  const [copied, setCopied] = useState(false)

  const snippet = `// Active skill: ${activeSkill.name}
// System prompt injected into all working key requests:
const systemPrompt = \`${activeSkill.systemPrompt.split("\n").slice(0, 3).join("\\n")}\n...\`

// Example fetch with active skill:
const providers = [
${workingKeys.slice(0, 3).map((k) => `  { provider: "${k.providerId}", model: "${k.modelId}", apiKey: "${k.apiKey.slice(0, 8)}..." }`).join(",\n")}
]

for (const { provider, model, apiKey } of providers) {
  await fetch(endpoint, {
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Your prompt here" },
      ],
    }),
  })
}`

  const handleCopy = useCallback(async () => {
    await copyToClipboard(snippet).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [snippet])

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 flex flex-col gap-2.5">
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 w-7 h-7 rounded-lg border border-primary/40 bg-primary/15 text-primary flex items-center justify-center">
          <ZapIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-primary">{activeSkill.name}</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full border border-primary/40 bg-primary/15 text-primary font-semibold">ACTIVE</span>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            System prompt injected into <span className="text-foreground/80 font-semibold">{workingKeys.length} working key{workingKeys.length !== 1 ? "s" : ""}</span> across {Array.from(new Set(workingKeys.map((k) => k.providerId))).length} provider{Array.from(new Set(workingKeys.map((k) => k.providerId))).length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onDeactivate}
          className="flex-shrink-0 text-[9px] px-2.5 py-1.5 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors"
        >
          Deactivate
        </button>
      </div>

      {/* Integration snippet */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
            Integration snippet
          </span>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1 text-[9px] px-2 py-1 rounded border transition-colors ${
              copied
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-border text-muted-foreground/50 hover:text-foreground"
            }`}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="text-[9px] text-muted-foreground/60 bg-secondary/40 rounded-lg p-2.5 border border-border/50 overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-40">
          {snippet}
        </pre>
      </div>

      {/* Provider badges */}
      {workingKeys.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] text-muted-foreground/50">Integrated:</span>
          {Array.from(new Set(workingKeys.map((k) => k.providerName))).slice(0, 8).map((name) => (
            <span key={name} className="text-[8px] px-1.5 py-0.5 rounded border border-primary/25 bg-primary/10 text-primary/70">
              {name}
            </span>
          ))}
          {Array.from(new Set(workingKeys.map((k) => k.providerName))).length > 8 && (
            <span className="text-[8px] text-muted-foreground/40">
              +{Array.from(new Set(workingKeys.map((k) => k.providerName))).length - 8} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main SkillsPanel ──────────────────────────────────────────────────────────

interface SkillsPanelProps {
  /** Called when a skill is activated/deactivated, so parent can inject the system prompt */
  onActiveSkillChange?: (config: ActiveSkillConfig | null) => void
}

export default function SkillsPanel({ onActiveSkillChange }: SkillsPanelProps) {
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterRegistry, setFilterRegistry] = useState<string>("all")
  const [search, setSearch] = useState("")

  const workingKeys = loadWorkingKeys()
  const activeSkill = SKILLS.find((s) => s.id === activeSkillId) ?? null

  const handleActivate = useCallback((skill: Skill) => {
    setActiveSkillId(skill.id)
    onActiveSkillChange?.({ skillId: skill.id, systemPrompt: skill.systemPrompt })
  }, [onActiveSkillChange])

  const handleDeactivate = useCallback((skillId?: string) => {
    if (skillId === undefined || skillId === activeSkillId) {
      setActiveSkillId(null)
      onActiveSkillChange?.(null)
    }
  }, [activeSkillId, onActiveSkillChange])

  const filtered = SKILLS.filter((s) => {
    if (filterCategory !== "all" && s.category !== filterCategory) return false
    if (filterRegistry !== "all" && s.registrySlug !== filterRegistry) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  return (
    <div className="flex flex-col gap-3 px-3 sm:px-4 py-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SkillIcon />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Skills
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            {SKILLS.length} available
          </span>
          {activeSkill && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-semibold">
              1 active
            </span>
          )}
        </div>
        <a
          href="https://skills.sh"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[9px] text-muted-foreground/50 hover:text-primary transition-colors"
        >
          <LinkIcon />
          skills.sh
        </a>
      </div>

      {/* Active skill banner */}
      {activeSkill && (
        <ActiveSkillBanner
          activeSkill={activeSkill}
          workingKeys={workingKeys}
          onDeactivate={() => handleDeactivate()}
        />
      )}

      {/* No working keys notice */}
      {workingKeys.length === 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2.5 text-[10px] text-amber-400/80">
          No working keys saved yet. Run a batch test first — skills will be integrated with all working keys.
        </div>
      )}

      {/* Registry filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {REGISTRIES.map((r) => (
          <button
            key={r.id}
            onClick={() => setFilterRegistry(r.id)}
            className={`text-[8px] px-2 py-0.5 rounded-full border transition-colors ${
              filterRegistry === r.id
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground/50 hover:bg-secondary"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {["all", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors capitalize ${
              filterCategory === cat
                ? "border-sky-400/50 bg-sky-400/10 text-sky-400"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {cat === "all" ? "All" : cat}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40">
          <SearchIcon />
        </span>
        <input
          type="text"
          placeholder="Search skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-[11px] bg-secondary/30 border border-border rounded-xl placeholder:text-muted-foreground/40 text-foreground focus:outline-none focus:border-primary/40 focus:bg-secondary/50 transition-colors"
        />
      </div>

      {/* Skills list */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <p className="text-center text-[11px] text-muted-foreground/50 py-6">
            No skills match your filter.
          </p>
        ) : (
          filtered.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              isActive={activeSkillId === skill.id}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
              workingKeyCount={workingKeys.length}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-1 pt-1">
        <p className="text-[9px] text-muted-foreground/40 text-center">
          Skills from{" "}
          <a href="https://skills.sh" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary transition-colors">skills.sh</a>
          {" "}· Install with{" "}
          <code className="font-mono">npx skills add</code>
          {" "}· Powered by the{" "}
          <a href="https://agentskills.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary transition-colors">Agent Skills</a>
          {" "}spec
        </p>
      </div>
    </div>
  )
}
