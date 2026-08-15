"use client"

import { useState, useCallback, useEffect } from "react"
import { copyToClipboard } from "@/lib/clipboard"
import { loadWorkingKeys, type WorkingKeyRecord } from "@/lib/working-keys-store"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Skill {
  id: string
  name: string
  description: string
  repo: string
  registrySlug: string
  installs: string
  category: string
  systemPrompt: string
  tags: string[]
}

export interface ActiveSkillConfig {
  skillId: string
  systemPrompt: string
}

// ── Curated skill catalogue ───────────────────────────────────────────────────

const SKILLS: Skill[] = [
  // ── anthropics/skills ──────────────────────────────────────────────────────
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
- Output complete, working, self-contained HTML — never partial snippets
- Always wrap output in a fenced \`\`\`html block containing a full <!DOCTYPE html> document
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
- Always wrap output in a fenced \`\`\`html block containing a full <!DOCTYPE html> document
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
- Always wrap output in a fenced \`\`\`html block containing a full <!DOCTYPE html> document
- Follow the skill: npx skills add anthropics/skills --skill theme-factory`,
  },
  // ── vercel-labs/agent-skills ───────────────────────────────────────────────
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
  // ── Code completeness skills ───────────────────────────────────────────────
  {
    id: "complete-code-writer",
    name: "Complete Code Writer",
    description: "Forces AI to always output the entire, untruncated code in one shot — never partial snippets or TODOs.",
    repo: "anthropics/skills",
    registrySlug: "anthropics/skills",
    installs: "42.1K",
    category: "Coding",
    tags: ["Complete", "No-truncate", "HTML", "Output"],
    systemPrompt: `You are a code-completeness enforcer. Your single most important rule is:

NEVER output partial or truncated code. Every response that contains code MUST:
1. Begin with the opening tag (e.g. <!DOCTYPE html> or the first line of the file).
2. End with the closing tag (e.g. </html> or the last line of the file).
3. Contain every single line — no "// ... rest of code", no "<!-- continued -->", no "TODO", no "..." placeholders.
4. Be fully functional as-is. A user must be able to copy-paste it and run it immediately.

If the code is long, that is fine — write every line. Quality > brevity.
Always wrap output in a fenced \`\`\`html code block for HTML files.`,
  },
  {
    id: "futuristic-web-builder",
    name: "Futuristic Web Builder",
    description: "Specialises in building complete, animated futuristic/sci-fi websites with particles, glows, and 3D effects using CDN libraries.",
    repo: "anthropics/skills",
    registrySlug: "anthropics/skills",
    installs: "29.7K",
    category: "Coding",
    tags: ["Animation", "Futuristic", "Three.js", "Particles"],
    systemPrompt: `You are an expert at building visually stunning, futuristic animated websites.

When building futuristic/animated websites:
- Use Three.js (via CDN) for 3D scenes: rotating geometry, particle fields, holographic grids
- Use GSAP (via CDN) for smooth timeline animations, text reveals, and scroll effects
- Use particles.js or tsParticles (via CDN) for ambient particle backgrounds
- Apply a dark theme with neon accent colors (cyan #00ffff, electric blue #0080ff, green #00ff88)
- Add scanline overlays, glitch effects, and CRT flicker using CSS keyframes
- Use CSS custom properties for the color palette and glow effects (box-shadow, text-shadow)
- Include a pulsing HUD-style UI: progress bars, status indicators, data readouts
- ALWAYS output the ENTIRE complete HTML file — never truncate. Close every tag. End with </html>.
- Wrap output in a fenced \`\`\`html code block.`,
  },
  {
    id: "code-completer",
    name: "Code Completer",
    description: "Specialised skill for continuing or completing truncated code — picks up exactly where the previous response stopped.",
    repo: "anthropics/skills",
    registrySlug: "anthropics/skills",
    installs: "18.4K",
    category: "Coding",
    tags: ["Continue", "Fix", "Truncated", "Repair"],
    systemPrompt: `You are a code-completion specialist. When the user provides truncated or incomplete code:

1. Identify exactly where the code was cut off — look for unclosed tags, missing closing braces, or abrupt endings.
2. Continue from the EXACT cut-off point, do not repeat content that was already written.
3. Complete the remainder of the file fully — every line, every closing tag, ending with </html> or the appropriate file ending.
4. Ensure the combined result is a valid, complete, runnable document.
5. If the user says "continue" or "complete the code" — treat the previous message as the truncated code and finish it.
6. Never add "..." or "// rest is unchanged" — always write the actual code.

Always wrap continuation output in a fenced \`\`\`html code block.`,
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

// ── Preset stacks (like v0) ───────────────────────────────────────────────────

interface SkillStack {
  id: string
  label: string
  description: string
  skillIds: string[]
  color: string
}

const SKILL_STACKS: SkillStack[] = [
  {
    id: "v0-stack",
    label: "v0 Stack",
    description: "Web Artifacts Builder + Theme Factory + Frontend Design — the same combination that powers Vercel v0's artifact generation.",
    skillIds: ["web-artifacts-builder", "theme-factory", "frontend-design"],
    color: "text-violet-400 border-violet-400/30 bg-violet-400/10",
  },
  {
    id: "art-stack",
    label: "Art Stack",
    description: "Algorithmic Art + Theme Factory + Canvas Design — for generative graphics and creative coding.",
    skillIds: ["algorithmic-art", "theme-factory", "canvas-design"],
    color: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  },
  {
    id: "full-coding",
    label: "Full Coding",
    description: "Web Artifacts Builder + Web Design Guidelines + Vercel React Best Practices — for high-quality production web apps.",
    skillIds: ["web-artifacts-builder", "web-design-guidelines", "vercel-react-best-practices"],
    color: "text-success border-success/30 bg-success/10",
  },
  {
    id: "futuristic-stack",
    label: "Futuristic Stack",
    description: "Futuristic Web Builder + Complete Code Writer — generates complete animated sci-fi/futuristic websites without truncation.",
    skillIds: ["futuristic-web-builder", "complete-code-writer"],
    color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",
  },
  {
    id: "no-truncate-stack",
    label: "No-Truncate Stack",
    description: "Complete Code Writer + Code Completer + Web Artifacts Builder — maximises output completeness for any code generation task.",
    skillIds: ["complete-code-writer", "code-completer", "web-artifacts-builder"],
    color: "text-orange-400 border-orange-400/30 bg-orange-400/10",
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
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function TerminalIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <polyline points="2 5 7 8 2 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="9" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6.5 9.5a4 4 0 005.657 0l2-2a4 4 0 00-5.657-5.657l-1 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9.5 6.5a4 4 0 00-5.657 0l-2 2a4 4 0 005.657 5.657l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function ZapIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M9 1L3 9h5l-1 6 6-8h-5l1-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <polyline points="4 5 1 8 4 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="12 5 15 8 12 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="9" y1="3" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ── SkillCard ─────────────────────────────────────────────────────────────────

function SkillCard({
  skill,
  isActive,
  workingKeyCount,
  onActivate,
  onDeactivate,
}: {
  skill: Skill
  isActive: boolean
  workingKeyCount: number
  onActivate: (skill: Skill) => void
  onDeactivate: (skillId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [copiedInstall, setCopiedInstall] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  const handleCopyInstall = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    const cmd = skill.registrySlug === "vercel-labs/skills"
      ? `npx skills add vercel-labs/skills`
      : `npx skills add ${skill.registrySlug} --skill ${skill.id}`
    await copyToClipboard(cmd).catch(() => {})
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
  }, [skill])

  const handleCopyPrompt = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    await copyToClipboard(skill.systemPrompt).catch(() => {})
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }, [skill.systemPrompt])

  const repoColor =
    skill.registrySlug === "anthropics/skills"
      ? "border-amber-400/30 text-amber-400/70"
      : skill.registrySlug === "vercel-labs/agent-skills"
      ? "border-primary/30 text-primary/60"
      : "border-success/30 text-success/70"

  return (
    <div className={`rounded-xl border transition-colors ${isActive ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card/50"}`}>
      {/* Header row */}
      <button
        className="w-full flex items-start gap-2.5 p-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Checkbox toggle */}
        <div
          role="checkbox"
          aria-checked={isActive}
          onClick={(e) => {
            e.stopPropagation()
            isActive ? onDeactivate(skill.id) : onActivate(skill)
          }}
          className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
            isActive
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border/60 hover:border-primary/50"
          }`}
        >
          {isActive && <CheckIcon />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-foreground/90">{skill.name}</span>
            <span className="text-[8px] font-mono text-muted-foreground/40">{skill.installs} installs</span>
            {skill.category === "Coding" && (
              <span className="text-[8px] px-1.5 py-0.5 rounded border border-sky-400/30 bg-sky-400/10 text-sky-400 font-semibold flex items-center gap-0.5">
                <CodeIcon />
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

        {/* Expand chevron */}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={`w-3 h-3 flex-shrink-0 text-muted-foreground/40 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

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
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-border text-muted-foreground/50 hover:text-foreground hover:border-primary/40"
                }`}
              >
                {copiedInstall ? <CheckIcon /> : <CopyIcon />}
                {copiedInstall ? "Copied" : "Copy"}
              </button>
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
                    ? "border-success/40 bg-success/10 text-success"
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
    </div>
  )
}

// ── Preset stack card ──────────────────────────────────────────────────────────

function StackCard({
  stack,
  activeSkillIds,
  onApply,
  onClear,
}: {
  stack: SkillStack
  activeSkillIds: Set<string>
  onApply: (stack: SkillStack) => void
  onClear: (stack: SkillStack) => void
}) {
  const isApplied = stack.skillIds.every((id) => activeSkillIds.has(id))
  const partiallyApplied = !isApplied && stack.skillIds.some((id) => activeSkillIds.has(id))

  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-2 transition-colors ${
      isApplied
        ? "border-primary/40 bg-primary/5"
        : partiallyApplied
        ? "border-border/80 bg-card/60"
        : "border-border/50 bg-card/30"
    }`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${stack.color}`}>
              {stack.label}
            </span>
            {isApplied && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full border border-primary/40 bg-primary/15 text-primary font-semibold">
                ACTIVE
              </span>
            )}
            {partiallyApplied && (
              <span className="text-[8px] text-muted-foreground/50">partial</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1 leading-relaxed">{stack.description}</p>
          {/* Skill chips */}
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {stack.skillIds.map((id) => {
              const s = SKILLS.find((sk) => sk.id === id)
              const active = activeSkillIds.has(id)
              return (
                <span key={id} className={`text-[8px] px-1.5 py-0.5 rounded border font-mono transition-colors ${
                  active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground/50"
                }`}>
                  {s?.name ?? id}
                </span>
              )
            })}
          </div>
        </div>
        <button
          onClick={() => isApplied ? onClear(stack) : onApply(stack)}
          className={`flex-shrink-0 flex items-center gap-1.5 text-[9px] px-2.5 py-1.5 rounded-lg border transition-colors ${
            isApplied
              ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
              : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          <ZapIcon />
          {isApplied ? "Clear" : "Apply"}
        </button>
      </div>
    </div>
  )
}

// ── Active skills banner ──────────────────────────────────────────────────────

function ActiveSkillsBanner({
  activeSkills,
  workingKeys,
  onDeactivateAll,
  onDeactivate,
}: {
  activeSkills: Skill[]
  workingKeys: WorkingKeyRecord[]
  onDeactivateAll: () => void
  onDeactivate: (id: string) => void
}) {
  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 flex flex-col gap-2.5">
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 w-7 h-7 rounded-lg border border-primary/40 bg-primary/15 text-primary flex items-center justify-center">
          <ZapIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-primary">
              {activeSkills.length} skill{activeSkills.length !== 1 ? "s" : ""} active
            </span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full border border-primary/40 bg-primary/15 text-primary font-semibold">
              ACTIVE
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            System prompts composed and injected into{" "}
            <span className="text-foreground/80 font-semibold">
              {workingKeys.length} working key{workingKeys.length !== 1 ? "s" : ""}
            </span>
          </p>
        </div>
        <button
          onClick={onDeactivateAll}
          className="flex-shrink-0 text-[9px] px-2.5 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Active skill chips with individual remove */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {activeSkills.map((s) => (
          <span
            key={s.id}
            className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary"
          >
            {s.name}
            <button
              onClick={() => onDeactivate(s.id)}
              className="hover:text-destructive transition-colors ml-0.5"
              aria-label={`Remove ${s.name}`}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-2.5 h-2.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </span>
        ))}
      </div>

      {/* Composed system prompt preview */}
      <div>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
          Composed system prompt ({activeSkills.length} skill{activeSkills.length !== 1 ? "s" : ""} merged)
        </span>
        <pre className="mt-1.5 text-[9px] text-muted-foreground/60 bg-secondary/40 rounded-lg p-2.5 border border-border/50 overflow-auto max-h-24 leading-relaxed whitespace-pre-wrap font-mono">
          {activeSkills.map((s, i) => `### Skill ${i + 1}: ${s.name}\n${s.systemPrompt.split("\n").slice(0, 3).join("\n")}\n...`).join("\n\n")}
        </pre>
      </div>
    </div>
  )
}

// ── Main SkillsPanel ──────────────────────────────────────────────────────────

interface SkillsPanelProps {
  onActiveSkillChange?: (configs: ActiveSkillConfig[]) => void
}

// ── Skills persistence helpers ────────────────────────────────────────────────
const SKILLS_STORAGE_KEY = "ai_tester_active_skills"

// Developer-configured default — always active for a fresh visitor so code
// generation never falls back to the bare, no-skill system prompt. Users can
// still deactivate/change it in this panel; their explicit choice is
// persisted and takes precedence over this default on future visits.
const DEFAULT_ACTIVE_SKILL_IDS = ["complete-code-writer"]

/**
 * Returns the persisted skill id set, or `null` if the visitor has never
 * explicitly saved a selection (fresh visit / cleared storage) — in that case
 * the caller should fall back to DEFAULT_ACTIVE_SKILL_IDS instead of "none".
 */
function loadPersistedSkillIds(): Set<string> | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SKILLS_STORAGE_KEY)
    if (raw === null) return null
    const ids: string[] = JSON.parse(raw)
    // Only restore ids that still exist in the current SKILLS list
    const validIds = ids.filter((id) => SKILLS.some((s) => s.id === id))
    return new Set(validIds)
  } catch {
    return null
  }
}

function saveSkillIds(ids: Set<string>): void {
  try {
    localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {}
}

export default function SkillsPanel({ onActiveSkillChange }: SkillsPanelProps) {
  const [activeSkillIds, setActiveSkillIds] = useState<Set<string>>(new Set(DEFAULT_ACTIVE_SKILL_IDS))
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterRegistry, setFilterRegistry] = useState<string>("all")
  const [search, setSearch] = useState("")

  const workingKeys = loadWorkingKeys()
  const activeSkills = SKILLS.filter((s) => activeSkillIds.has(s.id))

  const notify = useCallback((ids: Set<string>) => {
    const configs = SKILLS
      .filter((s) => ids.has(s.id))
      .map((s) => ({ skillId: s.id, systemPrompt: s.systemPrompt }))
    onActiveSkillChange?.(configs)
  }, [onActiveSkillChange])

  // On mount: restore the visitor's explicit choice if they ever saved one,
  // otherwise keep the developer default (already the initial state) — and
  // always notify the parent so Code Preview picks up the active skill(s)
  // immediately, even on a first-ever visit.
  useEffect(() => {
    const restored = loadPersistedSkillIds()
    const initial = restored ?? new Set(DEFAULT_ACTIVE_SKILL_IDS)
    setActiveSkillIds(initial)
    notify(initial)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist whenever active skill ids change
  useEffect(() => {
    saveSkillIds(activeSkillIds)
  }, [activeSkillIds])

  const handleActivate = useCallback((skill: Skill) => {
    setActiveSkillIds((prev) => {
      const next = new Set(prev)
      next.add(skill.id)
      notify(next)
      return next
    })
  }, [notify])

  const handleDeactivate = useCallback((skillId: string) => {
    setActiveSkillIds((prev) => {
      const next = new Set(prev)
      next.delete(skillId)
      notify(next)
      return next
    })
  }, [notify])

  const handleDeactivateAll = useCallback(() => {
    const empty = new Set<string>()
    setActiveSkillIds(empty)
    saveSkillIds(empty)
    onActiveSkillChange?.([])
  }, [onActiveSkillChange])

  const handleApplyStack = useCallback((stack: SkillStack) => {
    setActiveSkillIds((prev) => {
      const next = new Set(prev)
      stack.skillIds.forEach((id) => next.add(id))
      notify(next)
      return next
    })
  }, [notify])

  const handleClearStack = useCallback((stack: SkillStack) => {
    setActiveSkillIds((prev) => {
      const next = new Set(prev)
      stack.skillIds.forEach((id) => next.delete(id))
      notify(next)
      return next
    })
  }, [notify])

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
          {activeSkills.length > 0 && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-semibold">
              {activeSkills.length} active
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

      {/* Active skills banner */}
      {activeSkills.length > 0 && (
        <ActiveSkillsBanner
          activeSkills={activeSkills}
          workingKeys={workingKeys}
          onDeactivateAll={handleDeactivateAll}
          onDeactivate={handleDeactivate}
        />
      )}

      {/* No working keys notice */}
      {workingKeys.length === 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2.5 text-[10px] text-amber-400/80">
          No working keys saved yet. Run a batch test first — skills will be integrated with all working keys.
        </div>
      )}

      {/* Preset stacks */}
      <div>
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-2">
          Preset Stacks
        </p>
        <div className="flex flex-col gap-2">
          {SKILL_STACKS.map((stack) => (
            <StackCard
              key={stack.id}
              stack={stack}
              activeSkillIds={activeSkillIds}
              onApply={handleApplyStack}
              onClear={handleClearStack}
            />
          ))}
        </div>
      </div>

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
        <button
          onClick={() => setFilterCategory("all")}
          className={`text-[8px] px-2 py-0.5 rounded-full border transition-colors ${
            filterCategory === "all"
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border text-muted-foreground/50 hover:bg-secondary"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`text-[8px] px-2 py-0.5 rounded-full border transition-colors ${
              filterCategory === cat
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground/50 hover:bg-secondary"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40 pointer-events-none">
          <circle cx="6.5" cy="6.5" r="4" />
          <path d="M11 11l3 3" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills..."
          className="w-full pl-7 pr-3 py-1.5 text-[10px] bg-secondary/40 border border-border/60 rounded-lg focus:outline-none focus:border-primary/40 text-foreground placeholder:text-muted-foreground/40"
        />
      </div>

      {/* Skill list */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/50 text-center py-4">No skills match your filters.</p>
        ) : (
          filtered.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              isActive={activeSkillIds.has(skill.id)}
              workingKeyCount={workingKeys.length}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
            />
          ))
        )}
      </div>
    </div>
  )
}
