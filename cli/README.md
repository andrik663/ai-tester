# MsakuCLI

Official command-line client for **Msaku Gateway** (`https://gateway.msaku.id`).
Talk to 40+ AI providers through one OpenAI-compatible endpoint, right from your terminal.

## Install

```bash
npm install -g @msaku/cli
# or run directly without installing:
npx @msaku/cli --help
```

## Quickstart

```bash
# 1. Save your MSAKU.id API key (msk_...) — get it from https://msaku.id/gateway
msaku login --api-key msk_your_key_here

# 2. Check the gateway and your key
msaku status

# 3. List all available models
msaku models

# 4. Chat
msaku chat "Explain edge computing in 3 bullets"

# 5. Stream a response in real time
msaku stream --model claude-sonnet-4-5 "Write a haiku about APIs"
```

## Commands

| Command | Description |
|---|---|
| `msaku login --api-key <key>` | Save your `msk_...` key to `~/.msaku/credentials` (chmod 600) |
| `msaku status` | Show base URL, masked key, auth validity, model count, and tier |
| `msaku models` | List every model available on the gateway |
| `msaku chat "..."` | One-shot chat completion (prints full response) |
| `msaku stream "..."` | Stream tokens as they arrive |
| `msaku logout` | Remove stored credentials |

## Options

- `--model <id>` — pin a specific model; omit to let the gateway pick the fastest available key
- `--max-tokens <n>` — max output tokens (default 2048)
- `--api-key <key>` — override the stored credential for one command

## Environment variables

- `MSAKU_API_KEY` — your `msk_...` key (overrides the stored credential)
- `MSAKU_GATEWAY_URL` — gateway base URL (default `https://gateway.msaku.id/api/v1`)

## Use with coding agents

```bash
# Claude Code
export ANTHROPIC_BASE_URL="https://gateway.msaku.id/api/v1"
export ANTHROPIC_API_KEY="msk_your_key_here"

# OpenAI SDK / Cursor / Opencode
export OPENAI_BASE_URL="https://gateway.msaku.id/api/v1"
export OPENAI_API_KEY="msk_your_key_here"
```

## Rate limits

- 120 requests/minute per `msk_` key
- 1,000,000 tokens/day on shared keys (configurable; private keys never capped)
- Automatic fallback to the next available key when a provider returns 429

Full API reference: <https://gateway.msaku.id/docs>
