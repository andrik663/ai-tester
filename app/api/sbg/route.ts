import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { z } from "zod"

export const maxDuration = 60

// ── SBG Agent: Hermes-powered Research & Coding Helper ────────────────────────
// Supports two providers:
//   1. OpenRouter  — via Vercel AI Gateway (requires OpenRouter API key)
//   2. Ollama      — self-hosted local inference (zero 3rd-party dependency)
// Tools: webSearch, codeRunner, readFile, writeFile
// ─────────────────────────────────────────────────────────────────────────────

const SBG_SYSTEM = `You are SBG, an expert AI agent specialised in deep research and software engineering.

CAPABILITIES:
- Use webSearch to find up-to-date information, documentation, papers, and data
- Use codeRunner to execute Python or JavaScript for calculations, data processing, or proof-of-concept code
- Use readFile to read content from a specified virtual path
- Use writeFile to persist notes, code snippets, or research summaries

GUIDELINES:
- Always think step-by-step before using tools
- For research tasks: search first, synthesize carefully, cite sources
- For coding tasks: write clean, well-commented code; explain what it does
- When multiple tools are needed, chain them logically
- If a search returns insufficient info, refine and search again
- Present final answers in clear, structured markdown`

// ── Tool definitions ──────────────────────────────────────────────────────────

const webSearchTool = tool({
  description:
    "Search the web for up-to-date information, documentation, papers, news, or any external data. Use this for research tasks or to verify facts.",
  inputSchema: z.object({
    query: z.string().describe("The search query to look up"),
    focus: z
      .enum(["general", "code", "research", "news"])
      .default("general")
      .describe("Focus area for the search"),
  }),
  execute: async ({ query, focus }) => {
    // Simulate web search — in production replace with Tavily / Brave / SerpAPI
    // Using Brave Search API pattern; returns structured snippets
    const mockResults = [
      {
        title: `${query} — Overview`,
        url: `https://search.example.com/q=${encodeURIComponent(query)}`,
        snippet: `Top results for "${query}" (focus: ${focus}). This would contain real web search results from a search API like Tavily or Brave Search. Configure TAVILY_API_KEY or BRAVE_API_KEY env var to enable real search.`,
        published: new Date().toISOString().split("T")[0],
      },
      {
        title: `${query} — Documentation`,
        url: `https://docs.example.com/${encodeURIComponent(query.replace(/\s+/g, "-"))}`,
        snippet: `Detailed documentation and examples for ${query}. Real results require a connected search API.`,
        published: new Date().toISOString().split("T")[0],
      },
    ]

    // If Tavily API key is available, use it
    if (process.env.TAVILY_API_KEY) {
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query,
            search_depth: focus === "research" ? "advanced" : "basic",
            include_answer: true,
            max_results: 5,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          return {
            query,
            answer: data.answer ?? null,
            results: (data.results ?? []).map(
              (r: { title: string; url: string; content: string; published_date?: string }) => ({
                title: r.title,
                url: r.url,
                snippet: r.content,
                published: r.published_date ?? "",
              })
            ),
          }
        }
      } catch {
        // fall through to mock
      }
    }

    return { query, answer: null, results: mockResults }
  },
})

const codeRunnerTool = tool({
  description:
    "Execute Python or JavaScript code snippets for calculations, data processing, algorithm testing, or generating results. Returns stdout and any errors.",
  inputSchema: z.object({
    language: z.enum(["python", "javascript"]).describe("Language to execute"),
    code: z.string().describe("The code to run"),
    description: z.string().optional().describe("What this code does"),
  }),
  execute: async ({ language, code, description }) => {
    // Sandboxed execution — returns simulated output
    // In production, connect to a real sandbox (e.g. e2b.dev, Piston API, Pyodide)
    const timestamp = new Date().toISOString()

    // If E2B sandbox key is available, use it
    if (process.env.E2B_API_KEY) {
      try {
        const res = await fetch("https://api.e2b.dev/sandboxes/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.E2B_API_KEY}`,
          },
          body: JSON.stringify({ language, code }),
        })
        if (res.ok) {
          const data = await res.json()
          return {
            language,
            description: description ?? "",
            stdout: data.stdout ?? "",
            stderr: data.stderr ?? "",
            exitCode: data.exitCode ?? 0,
            executedAt: timestamp,
          }
        }
      } catch {
        // fall through to simulation
      }
    }

    // Simulation mode: echo back the code with a note
    return {
      language,
      description: description ?? "",
      stdout: `[Simulation Mode] Code received and parsed successfully.\n\nCode:\n${code}\n\nTo enable real execution, set E2B_API_KEY in environment variables.`,
      stderr: "",
      exitCode: 0,
      executedAt: timestamp,
      note: "Real execution requires E2B_API_KEY. Configure it in project environment variables.",
    }
  },
})

// In-memory virtual filesystem for the session
const virtualFS = new Map<string, string>()

const readFileTool = tool({
  description:
    "Read the content of a previously written file from the virtual session filesystem. Useful for retrieving saved research notes or code.",
  inputSchema: z.object({
    path: z.string().describe("The virtual file path to read (e.g. notes.md, snippet.py)"),
  }),
  execute: async ({ path }) => {
    const content = virtualFS.get(path)
    if (!content) {
      return {
        path,
        found: false,
        content: null,
        message: `File "${path}" not found. Available files: ${Array.from(virtualFS.keys()).join(", ") || "none"}`,
      }
    }
    return { path, found: true, content, size: content.length }
  },
})

const writeFileTool = tool({
  description:
    "Write or overwrite a file in the virtual session filesystem. Use to save research summaries, code snippets, or structured notes for later retrieval.",
  inputSchema: z.object({
    path: z.string().describe("The virtual file path to write (e.g. research.md, solution.py)"),
    content: z.string().describe("The content to write"),
    description: z.string().optional().describe("What this file contains"),
  }),
  execute: async ({ path, content, description }) => {
    virtualFS.set(path, content)
    return {
      path,
      success: true,
      bytesWritten: content.length,
      description: description ?? "",
      allFiles: Array.from(virtualFS.keys()),
    }
  },
})

export const tools = {
  webSearch: webSearchTool,
  codeRunner: codeRunnerTool,
  readFile: readFileTool,
  writeFile: writeFileTool,
} as const

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json()
  const messages: UIMessage[] = body.messages ?? []
  const apiKey: string = body.apiKey ?? ""

  // provider: "openrouter" | "ollama"
  const provider: string = body.provider ?? "openrouter"

  // Ollama base URL (default: localhost:11434)
  const ollamaUrl: string = (body.ollamaUrl ?? "http://localhost:11434").replace(/\/$/, "")

  // Model selection
  // - OpenRouter: "openrouter/nousresearch/hermes-3-llama-3.1-405b" etc.
  // - Ollama: bare model name like "hermes3", "llama3.1", "mistral"
  const modelId: string = body.model ?? (
    provider === "ollama"
      ? "hermes3"
      : "openrouter/nousresearch/hermes-3-llama-3.1-405b"
  )

  let resolvedModel: Parameters<typeof streamText>[0]["model"]

  if (provider === "ollama") {
    // Ollama exposes an OpenAI-compatible API at /v1
    const ollama = createOpenAICompatible({
      name: "ollama",
      baseURL: `${ollamaUrl}/v1`,
      // Ollama doesn't need an API key, but the SDK requires a non-empty string
      apiKey: "ollama",
    })
    resolvedModel = ollama(modelId)
  } else {
    // OpenRouter via Vercel AI Gateway — model string passed directly
    // The AI Gateway routes "openrouter/..." prefix automatically
    resolvedModel = modelId as unknown as Parameters<typeof streamText>[0]["model"]
  }

  // Build extra headers for OpenRouter attribution
  const extraHeaders: Record<string, string> = {
    "HTTP-Referer": "https://ai-tester.vercel.app",
    "X-Title": "SBG Agent",
  }

  // If user provides their own OpenRouter key, inject it as Bearer
  if (apiKey && provider === "openrouter") {
    extraHeaders["Authorization"] = `Bearer ${apiKey}`
  }

  const result = streamText({
    model: resolvedModel,
    system: SBG_SYSTEM,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(15),
    maxRetries: 2,
    ...(provider === "openrouter" ? { headers: extraHeaders } : {}),
  })

  return result.toUIMessageStreamResponse()
}
