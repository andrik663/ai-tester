#!/usr/bin/env node
/**
 * MsakuCLI — official command-line client for Msaku Gateway.
 *
 * Usage:
 *   msaku login                     Save your API key (msk_...) to ~/.msaku/credentials
 *   msaku models                    List available models
 *   msaku chat "<prompt>"           One-shot chat completion
 *   msaku chat --model <id> "..."   Chat with a specific model
 *   msaku stream "<prompt>"         Stream the response token by token
 *   msaku status                    Show gateway status and your key tier
 *   msaku logout                    Remove stored credentials
 *
 * Config priority: --api-key flag > MSAKU_API_KEY env > ~/.msaku/credentials
 */

const BASE_URL = process.env.MSAKU_GATEWAY_URL || "https://gateway.msaku.id/api/v1"
const CONFIG_DIR = `${process.env.HOME || process.env.USERPROFILE}/.msaku`
const CRED_FILE = `${CONFIG_DIR}/credentials`

const args = process.argv.slice(2)
const command = args[0]

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
}

function readStoredKey() {
  try {
    return require("fs").readFileSync(CRED_FILE, "utf8").trim()
  } catch {
    return ""
  }
}

function saveKey(key) {
  require("fs").mkdirSync(CONFIG_DIR, { recursive: true })
  require("fs").chmodSync(CRED_FILE, 0o600)
  require("fs").writeFileSync(CRED_FILE, key + "\n")
}

function getApiKey() {
  const flagIdx = args.indexOf("--api-key")
  if (flagIdx !== -1 && args[flagIdx + 1]) return args[flagIdx + 1]
  if (process.env.MSAKU_API_KEY) return process.env.MSAKU_API_KEY
  return readStoredKey()
}

async function gatewayFetch(path, opts = {}) {
  const key = getApiKey()
  if (!key) {
    console.error(`${C.red}Error:${C.reset} API key not set. Run ${C.cyan}msaku login${C.reset} or set ${C.cyan}MSAKU_API_KEY${C.reset}.`)
    process.exit(1)
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(opts.headers || {}),
    },
  })
  if (res.status === 401) {
    console.error(`${C.red}Unauthorized (401).${C.reset} API key invalid or revoked. Run ${C.cyan}msaku login${C.reset} again.`)
    process.exit(1)
  }
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}))
    console.error(`${C.yellow}Rate limited (429).${C.reset} ${body.error || "Try again shortly."}`)
    process.exit(1)
  }
  return res
}

function parseChatArgs(restArgs) {
  let model = ""
  let maxTokens = 2048
  const rest = []
  for (let i = 0; i < restArgs.length; i++) {
    if (restArgs[i] === "--model") { model = restArgs[++i] || ""; continue }
    if (restArgs[i] === "--max-tokens") { maxTokens = parseInt(restArgs[++i] || "2048", 10); continue }
    rest.push(restArgs[i])
  }
  return { model, maxTokens, prompt: rest.join(" ") }
}

async function cmdLogin() {
  const keyIdx = args.indexOf("--api-key")
  const key = keyIdx !== -1 ? args[keyIdx + 1] : process.env.MSAKU_API_KEY
  if (!key) {
    console.error(`${C.red}Error:${C.reset} provide the key via ${C.cyan}--api-key msk_...${C.reset} or ${C.cyan}MSAKU_API_KEY${C.reset} env.`)
    process.exit(1)
  }
  saveKey(key.trim())
  console.log(`${C.green}✓${C.reset} API key saved to ${C.dim}${CRED_FILE}${C.reset}`)
  console.log(`  Verify with: ${C.cyan}msaku status${C.reset}`)
}

async function cmdLogout() {
  try { require("fs").unlinkSync(CRED_FILE) } catch {}
  console.log(`${C.green}✓${C.reset} Credentials removed.`)
}

async function cmdModels() {
  const res = await gatewayFetch("/models")
  const data = await res.json()
  const models = data.data || []
  console.log(`${C.bold}Models available on Msaku Gateway${C.reset} (${models.length})\n`)
  for (const m of models) {
    const provider = m._provider || m.owned_by || "-"
    console.log(`  ${C.cyan}${m.id.padEnd(40)}${C.reset} ${C.dim}${provider}${C.reset}`)
  }
}

async function cmdChat() {
  const { model, maxTokens, prompt } = parseChatArgs(args.slice(1))
  if (!prompt) {
    console.error(`${C.red}Error:${C.reset} provide a prompt. Usage: ${C.cyan}msaku chat "Hello"${C.reset}`)
    process.exit(1)
  }
  const res = await gatewayFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: model || undefined,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || JSON.stringify(data)
  console.log(content)
  if (data?.usage) {
    console.error(`${C.dim}— prompt: ${data.usage.prompt_tokens} tok, completion: ${data.usage.completion_tokens} tok${C.reset}`)
  }
}

async function cmdStream() {
  const { model, maxTokens, prompt } = parseChatArgs(args.slice(1))
  if (!prompt) {
    console.error(`${C.red}Error:${C.reset} provide a prompt. Usage: ${C.cyan}msaku stream "Hello"${C.reset}`)
    process.exit(1)
  }
  const res = await gatewayFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: model || undefined,
      max_tokens: maxTokens,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split("\n")
    buf = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const payload = line.slice(6).trim()
      if (payload === "[DONE]") continue
      try {
        const chunk = JSON.parse(payload)
        const delta = chunk?.choices?.[0]?.delta?.content
        if (delta) process.stdout.write(delta)
      } catch {}
    }
  }
  console.log()
}

async function cmdStatus() {
  const key = getApiKey()
  const masked = key ? `${key.slice(0, 10)}${"•".repeat(Math.max(4, key.length - 10))}` : "(not set)"
  console.log(`${C.bold}Msaku Gateway Status${C.reset}`)
  console.log(`  Base URL : ${C.cyan}${BASE_URL}${C.reset}`)
  console.log(`  API Key  : ${C.dim}${masked}${C.reset}`)
  try {
    const res = await fetch(`${BASE_URL}/models`, { headers: { Authorization: `Bearer ${key}` } })
    console.log(`  Auth     : ${res.ok ? C.green + "valid" + C.reset : C.red + "invalid" + C.reset}`)
    if (res.ok) {
      const data = await res.json()
      console.log(`  Models   : ${data?.data?.length ?? 0}`)
      console.log(`  Tier     : ${data?._msaku?.authTier || "msaku_user"}`)
    }
  } catch {
    console.log(`  Gateway  : ${C.red}unreachable${C.reset}`)
  }
}

function printHelp() {
  console.log(`${C.bold}MsakuCLI${C.reset} — official CLI for Msaku Gateway (${C.dim}${BASE_URL}${C.reset})

${C.bold}Usage:${C.reset}
  ${C.cyan}msaku login${C.reset} --api-key msk_...   Save credentials locally
  ${C.cyan}msaku status${C.reset}                    Check gateway reachability and key validity
  ${C.cyan}msaku models${C.reset}                    List all available models
  ${C.cyan}msaku chat${C.reset} "..."                One-shot chat completion
  ${C.cyan}msaku stream${C.reset} "..."              Stream response in real time
  ${C.cyan}msaku logout${C.reset}                    Remove stored credentials

${C.bold}Options:${C.reset}
  --model <id>          Use a specific model (default: gateway auto-selection)
  --max-tokens <n>      Max output tokens (default: 2048)
  --api-key <key>       Override stored credential for a single command

${C.bold}Examples:${C.reset}
  msaku login --api-key msk_your_key_here
  msaku chat --model claude-sonnet-4-5 "Explain edge computing in 3 bullets"
  msaku stream --model gpt-4o "Write a haiku about APIs"
`)
}

async function main() {
  if (!command || command === "help" || command === "--help" || command === "-h") return printHelp()
  switch (command) {
    case "login":  return cmdLogin()
    case "logout": return cmdLogout()
    case "models": return cmdModels()
    case "chat":   return cmdChat()
    case "stream": return cmdStream()
    case "status": return cmdStatus()
    default:
      console.error(`${C.red}Unknown command:${C.reset} ${command}`)
      printHelp()
      process.exit(1)
  }
}

main().catch((e) => {
  console.error(`${C.red}Error:${C.reset}`, e.message)
  process.exit(1)
})
