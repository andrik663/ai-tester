"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import useSWR from "swr"
import type { ManualTestResult } from "@/app/api/manual-test/route"
import type { LogEntry } from "@/app/api/test-key/route"
import ProviderBatchTest from "@/components/provider-batch-test"
import ImageTester from "@/components/image-tester"
import VideoTester from "@/components/video-tester"
import WorkingKeysPanel from "@/components/working-keys-panel"
import SBGAgent from "@/components/sbg-agent"
import MultiKeyBatch from "@/components/multi-key-batch"
import { getImageCapabilities, getVideoCapabilities, IMAGE_ASPECT_RATIOS } from "@/lib/provider-capabilities"

// ── Provider presets ──────────────────────────────────────────────────────────

interface ProviderModelInfo {
  id: string
  label: string
  tag: string
  ctx: string
  in: string
  out: string
  cache: string
}

interface ProviderPreset {
  id: string
  name: string
  /** ISO 3166-1 alpha-2 country code — shown as flag next to provider name */
  country: string
  endpoint: string
  method: "POST" | "GET"
  headers: Record<string, string>
  bodyTemplate: string
  docsUrl: string
  createKeyUrl: string   // direct link to API key creation page
  color: string
  models?: ProviderModelInfo[]  // compact model catalog with pricing
}

const PRESETS: ProviderPreset[] = [
  // ── Dahono Labs Gateway ───────────────────────────────────────────────────
  {
    id: "dahono",
    name: "Dahono Labs Gateway",
    country: "ID",
    endpoint: "https://gateway.dahono.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "dahono/deepseek-v4-flash",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://labs.dahono.com/models",
    createKeyUrl: "https://labs.dahono.com/account/api-keys",
    color: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  },
  // ── Tier 1: Major providers ───────────────────────────────────────────────
  {
    id: "anthropic",
    name: "Claude (Anthropic)",
    country: "US",
    endpoint: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "x-api-key": "{{API_KEY}}",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.anthropic.com/en/api/messages",
    createKeyUrl: "https://console.anthropic.com/settings/keys",
    color: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  },
  {
    id: "openai",
    name: "GPT (OpenAI)",
    country: "US",
    endpoint: "https://api.openai.com/v1/responses",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    // Active: gpt-5.3-codex, gpt-5.2, gpt-5.2-pro, gpt-5.1, gpt-5, gpt-5-mini,
    //   gpt-5-nano, gpt-5-pro, o3-pro, o3, gpt-4.1, gpt-4.1-mini
    // Deprecated (still callable): gpt-5.3-chat, gpt-5.2-codex, gpt-5.1-codex,
    //   gpt-5.1-codex-max, gpt-5.1-codex-mini, gpt-5-codex, gpt-4.1-nano,
    //   o4-mini, o3-mini, o1-pro, o1, o1-mini, gpt-4o, gpt-4o-mini, gpt-4-turbo,
    //   gpt-4, gpt-3.5-turbo, babbage-002, davinci-002, codex-mini-latest
    bodyTemplate: JSON.stringify({
      model: "gpt-5.3-codex",
      input: "{{PROMPT}}",
    }, null, 2),
    docsUrl: "https://platform.openai.com/docs/api-reference/responses",
    createKeyUrl: "https://platform.openai.com/api-keys",
    color: "text-green-400 bg-green-400/10 border-green-400/30",
  },
  {
    id: "google",
    name: "Gemini (Google)",
    country: "US",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={{API_KEY}}",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Models (Gemini 3.x): gemini-3.5-flash, gemini-3.1-pro, gemini-3-flash,
    //   gemini-3.1-flash-lite, gemini-3.1-flash-live
    // Models (Gemini 2.5.x): gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite
    // Change model in the URL path above to switch models
    bodyTemplate: JSON.stringify({
      contents: [{ parts: [{ text: "{{PROMPT}}" }] }],
      generationConfig: { maxOutputTokens: 1024 },
    }, null, 2),
    docsUrl: "https://ai.google.dev/gemini-api/docs/models",
    createKeyUrl: "https://aistudio.google.com/apikey",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  },
  {
    id: "xai",
    name: "Grok (xAI)",
    country: "US",
    endpoint: "https://api.x.ai/v1/responses",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    // Chat: grok-4.3 | Coding: grok-build-0.1 | Image: grok-imagine-image-quality, grok-imagine-image-fast
    // Voice: POST /v1/tts  { text, voice_id: "eve", language: "en" }
    bodyTemplate: JSON.stringify({
      model: "grok-4.3",
      input: [
        { role: "system", content: "You are Grok, a highly intelligent, helpful AI assistant." },
        { role: "user", content: "{{PROMPT}}" },
      ],
    }, null, 2),
    docsUrl: "https://docs.x.ai/developers/models",
    createKeyUrl: "https://console.x.ai/",
    color: "text-zinc-300 bg-zinc-400/10 border-zinc-400/30",
  },
  // ── Tier 2: Chinese / Asian providers ────────────────────────────────────
  {
    id: "deepseek",
    name: "DeepSeek",
    country: "CN",
    endpoint: "https://api.deepseek.com/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "deepseek-v4-flash",
      max_tokens: 1024,
      stream: false,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://platform.deepseek.com/api-docs/",
    createKeyUrl: "https://platform.deepseek.com/api_keys",
    color: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  },
  {
    id: "qwen",
    name: "Qwen (Alibaba)",
    country: "CN",
    endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "qwen3-235b-a22b",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://help.aliyun.com/zh/model-studio/developer-reference/use-qwen-by-calling-api",
    createKeyUrl: "https://bailian.console.aliyun.com/?apiKey=1",
    color: "text-violet-400 bg-violet-400/10 border-violet-400/30",
  },
  {
    id: "zhipu",
    name: "GLM (Zhipu AI)",
    country: "CN",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "glm-5v-turbo",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://open.bigmodel.cn/dev/api",
    createKeyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    color: "text-indigo-400 bg-indigo-400/10 border-indigo-400/30",
  },
  {
    id: "minimax",
    name: "MiniMax",
    country: "CN",
    endpoint: "https://api.minimax.io/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    // Active: MiniMax-M3, MiniMax-M2.7, MiniMax-M2.7-highspeed
    // Legacy: MiniMax-M2.5, MiniMax-M2.5-highspeed, MiniMax-M2.1, MiniMax-M2.1-highspeed, MiniMax-M2
    bodyTemplate: JSON.stringify({
      model: "MiniMax-M3",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://platform.minimax.io/docs/guides/models-intro",
    createKeyUrl: "https://platform.minimax.io/user-center/basic-information/interface-key",
    color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  },
  // ── Meta / Llama providers ─────────────────────────────────────────────��──
  {
    id: "cerebras",
    name: "Cerebras",
    country: "US",
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    // Public models: kimi-k2.6, glm-5.1, minimax-m2.5, zai-glm-4.7,
    //                gpt-oss-120b, gemma-4-31b, qwen3-32b
    // kimi-k2.6 / glm-5.1 / minimax-m2.5 use max_completion_tokens + reasoning_effort
    // gemma-4-31b / qwen3-32b use standard max_tokens
    bodyTemplate: JSON.stringify({
      model: "kimi-k2.6",
      max_completion_tokens: 1024,
      temperature: 0.2,
      top_p: 1,
      stream: false,
      reasoning_effort: "medium",
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://inference-docs.cerebras.ai/api-reference/chat-completions",
    createKeyUrl: "https://cloud.cerebras.ai/",
    color: "text-lime-400 bg-lime-400/10 border-lime-400/30",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    country: "US",
    endpoint: "https://api.fireworks.ai/inference/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "accounts/fireworks/models/llama-v3p3-70b-instruct",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.fireworks.ai/api-reference/post-chatcompletions",
    createKeyUrl: "https://fireworks.ai/account/api-keys",
    color: "text-orange-300 bg-orange-300/10 border-orange-300/30",
  },
  {
    id: "novita",
    name: "Novita AI",
    country: "US",
    endpoint: "https://api.novita.ai/openai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "deepseek/deepseek-v4-pro",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    models: [
      // ── NEW (Jun 2026) ────────────────────────────────────────────────────
      { id: "zai-org/glm-5-2",                                   label: "GLM 5.2 (New)",               tag: "Zai-org",    ctx: "1M ctx",   in: "$1.4/Mt",   out: "$4.4/Mt",   cache: "$0.26/Mt" },
      { id: "moonshotai/kimi-k2-7-code",                         label: "Kimi K2.7 Code (Hot)",        tag: "MoonshotAI", ctx: "256K ctx", in: "$0.95/Mt",  out: "$4/Mt",     cache: "$0.19/Mt" },
      { id: "minimax/minimax-m3",                                label: "MiniMax M3 (New)",            tag: "MiniMax",    ctx: "977K ctx", in: "$0.3/Mt",   out: "$1.2/Mt",   cache: "$0.06/Mt" },
      { id: "deepseek/deepseek-v4-pro",                          label: "DeepSeek V4 Pro (Hot)",       tag: "DeepSeek",   ctx: "1M ctx",   in: "$1.6/Mt",   out: "$3.2/Mt",   cache: "$0.135/Mt"},
      { id: "deepseek/deepseek-v4-flash",                        label: "DeepSeek V4 Flash (Hot)",     tag: "DeepSeek",   ctx: "1M ctx",   in: "$0.14/Mt",  out: "$0.28/Mt",  cache: "$0.028/Mt"},
      { id: "deepseek/deepseek-v3-2",                            label: "DeepSeek V3.2 (Hot)",         tag: "DeepSeek",   ctx: "160K ctx", in: "$0.269/Mt", out: "$0.4/Mt",   cache: "$0.135/Mt"},
      { id: "stepfun/step-3-7-flash",                            label: "Step 3.7 Flash (New)",        tag: "StepFun",    ctx: "256K ctx", in: "$0.2/Mt",   out: "$1.15/Mt",  cache: "$0.04/Mt" },
      { id: "nvidia/nemotron-3-nano-30b-a3b",                    label: "Nemotron 3 Nano 30B (New)",   tag: "Nvidia",     ctx: "256K ctx", in: "$0.05/Mt",  out: "$0.2/Mt",   cache: "" },
      { id: "baidu/cobuddy",                                     label: "CoBuddy (New)",               tag: "Baidu",      ctx: "128K ctx", in: "$0.29/Mt",  out: "$1.13/Mt",  cache: "$0.07/Mt" },
      { id: "xiaomi/mimo-v2-5",                                  label: "MiMo-V2.5 (New)",             tag: "Xiaomi",     ctx: "1M ctx",   in: "$0.168/Mt", out: "$0.336/Mt", cache: "$0.003/Mt"},
      { id: "xiaomi/mimo-v2-5-pro",                              label: "MiMo-V2.5-Pro (New)",         tag: "Xiaomi",     ctx: "1M ctx",   in: "$0.522/Mt", out: "$1.044/Mt", cache: "$0.004/Mt"},
      // ── DeepSeek ─────────────────────────────────────────────────────────
      { id: "deepseek/deepseek-r1-0528",                         label: "DeepSeek R1 0528",            tag: "DeepSeek",   ctx: "160K ctx", in: "$0.7/Mt",   out: "$2.5/Mt",   cache: "$0.35/Mt" },
      { id: "deepseek/deepseek-v3-0324",                         label: "DeepSeek V3 0324",            tag: "DeepSeek",   ctx: "160K ctx", in: "$0.27/Mt",  out: "$1.12/Mt",  cache: "$0.135/Mt"},
      { id: "deepseek/deepseek-v3-1",                            label: "DeepSeek V3.1",               tag: "DeepSeek",   ctx: "131K ctx", in: "$0.27/Mt",  out: "$1/Mt",     cache: "$0.135/Mt"},
      { id: "deepseek/deepseek-r1",                              label: "DeepSeek R1 (Turbo)",         tag: "DeepSeek",   ctx: "64K ctx",  in: "$0.7/Mt",   out: "$2.5/Mt",   cache: "" },
      { id: "deepseek/deepseek-v3",                              label: "DeepSeek V3 (Turbo)",         tag: "DeepSeek",   ctx: "64K ctx",  in: "$0.4/Mt",   out: "$1.3/Mt",   cache: "" },
      { id: "deepseek/deepseek-prover-v2-671b",                  label: "DeepSeek Prover V2 671B",     tag: "DeepSeek",   ctx: "160K ctx", in: "$0.7/Mt",   out: "$2.5/Mt",   cache: "" },
      { id: "deepseek/deepseek-ocr-2",                           label: "DeepSeek-OCR 2",              tag: "DeepSeek",   ctx: "8K ctx",   in: "$0.03/Mt",  out: "$0.03/Mt",  cache: "" },
      // ── Qwen ─────────────────────────────────────────────────────────────
      { id: "qwen/qwen3-7-max",                                  label: "Qwen3.7-Max",                 tag: "Qwen",       ctx: "977K ctx", in: "$1.25/Mt",  out: "$3.75/Mt",  cache: "$0.25/Mt" },
      { id: "qwen/qwen3-6-27b",                                  label: "Qwen3.6-27B (New)",           tag: "Qwen",       ctx: "256K ctx", in: "$0.6/Mt",   out: "$3.6/Mt",   cache: "" },
      { id: "qwen/qwen3-5-27b",                                  label: "Qwen3.5-27B",                 tag: "Qwen",       ctx: "256K ctx", in: "$0.3/Mt",   out: "$2.4/Mt",   cache: "" },
      { id: "qwen/qwen3-coder-480b-a35b-instruct",               label: "Qwen3-Coder 480B A35B",       tag: "Qwen",       ctx: "256K ctx", in: "$0.38/Mt",  out: "$1.55/Mt",  cache: "" },
      { id: "qwen/qwen3-235b-a22b-instruct-2507",                label: "Qwen3-235B A22B 2507 Think",  tag: "Qwen",       ctx: "131K ctx", in: "$0.3/Mt",   out: "$3/Mt",     cache: "" },
      { id: "qwen/qwen3-235b-a22b-fp8",                          label: "Qwen3-235B A22B FP8",         tag: "Qwen",       ctx: "131K ctx", in: "$0.09/Mt",  out: "$0.58/Mt",  cache: "" },
      { id: "qwen/qwen3-vl-30b-a3b-instruct",                    label: "Qwen3 VL 30B Instruct",       tag: "Qwen VL",    ctx: "131K ctx", in: "$0.2/Mt",   out: "$0.7/Mt",   cache: "" },
      { id: "qwen/qwen2.5-vl-72b-instruct",                      label: "Qwen2.5-VL 72B",              tag: "Qwen VL",    ctx: "32K ctx",  in: "$0.38/Mt",  out: "$0.4/Mt",   cache: "" },
      // ── GLM / Zai-org ────────────────────────────────────────────────────
      { id: "zai-org/glm-5-1",                                   label: "GLM-5.1 (New)",               tag: "Zai-org",    ctx: "200K ctx", in: "$1.38/Mt",  out: "$4.4/Mt",   cache: "$0.26/Mt" },
      { id: "zai-org/glm-4-5",                                   label: "GLM-4.5",                     tag: "Zai-org",    ctx: "131K ctx", in: "$0.6/Mt",   out: "$2.2/Mt",   cache: "$0.11/Mt" },
      { id: "zai-org/glm-4-7-flash",                             label: "GLM-4.7-Flash",               tag: "Zai-org",    ctx: "200K ctx", in: "$0.07/Mt",  out: "$0.4/Mt",   cache: "$0.01/Mt" },
      // ── MiniMax ──────────────────────────────────────────────────────────
      { id: "minimax/minimax-m2-7",                              label: "MiniMax M2.7 (Hot)",          tag: "MiniMax",    ctx: "200K ctx", in: "$0.3/Mt",   out: "$1.2/Mt",   cache: "$0.06/Mt" },
      { id: "minimax/minimax-m2-5-highspeed",                    label: "MiniMax M2.5-Highspeed",      tag: "MiniMax",    ctx: "200K ctx", in: "$0.6/Mt",   out: "$2.4/Mt",   cache: "$0.03/Mt" },
      { id: "minimax/minimax-m1",                                label: "MiniMax M1",                  tag: "MiniMax",    ctx: "1M ctx",   in: "$0.55/Mt",  out: "$2.2/Mt",   cache: "" },
      // ── Kimi ─────────────────────────────────────────────────────────────
      { id: "moonshotai/kimi-k2-6",                              label: "Kimi K2.6 (New)",             tag: "MoonshotAI", ctx: "256K ctx", in: "$0.8/Mt",   out: "$3.4/Mt",   cache: "$0.16/Mt" },
      { id: "moonshotai/kimi-k2-instruct",                       label: "Kimi K2 Instruct",            tag: "MoonshotAI", ctx: "131K ctx", in: "$0.57/Mt",  out: "$2.3/Mt",   cache: "" },
      { id: "moonshotai/kimi-k2-thinking",                       label: "Kimi K2 Thinking",            tag: "MoonshotAI", ctx: "256K ctx", in: "$0.6/Mt",   out: "$2.5/Mt",   cache: "$0.15/Mt" },
      // ── Google Gemma ─────────────────────────────────────────────────────
      { id: "google/gemma-4-26b-a4b",                            label: "Gemma 4 26B A4B",             tag: "Gemma",      ctx: "256K ctx", in: "$0.13/Mt",  out: "$0.4/Mt",   cache: "" },
      { id: "google/gemma-4-31b",                                label: "Gemma 4 31B",                 tag: "Gemma",      ctx: "256K ctx", in: "$0.14/Mt",  out: "$0.4/Mt",   cache: "" },
      // ── Meta Llama ───────────────────────────────────────────────────────
      { id: "meta-llama/llama-4-maverick-17b-128e-instruct-fp8", label: "Llama 4 Maverick FP8",       tag: "Meta",       ctx: "1M ctx",   in: "$0.27/Mt",  out: "$0.85/Mt",  cache: "" },
      { id: "meta-llama/llama-4-scout-17b-16e-instruct",         label: "Llama 4 Scout",               tag: "Meta",       ctx: "131K ctx", in: "$0.18/Mt",  out: "$0.59/Mt",  cache: "" },
      { id: "meta-llama/llama-3.3-70b-instruct",                 label: "Llama 3.3 70B",               tag: "Meta",       ctx: "131K ctx", in: "$0.135/Mt", out: "$0.4/Mt",   cache: "" },
      { id: "meta-llama/llama-3.1-8b-instruct",                  label: "Llama 3.1 8B",                tag: "Meta",       ctx: "16K ctx",  in: "$0.02/Mt",  out: "$0.05/Mt",  cache: "" },
      // ── OpenAI OSS ───────────────────────────────────────────────────────
      { id: "openai/openai-gpt-oss-120b",                        label: "OpenAI GPT OSS 120B",         tag: "OpenAI",     ctx: "131K ctx", in: "$0.05/Mt",  out: "$0.25/Mt",  cache: "" },
      { id: "openai/openai-gpt-oss-20b",                         label: "OpenAI GPT OSS 20B",          tag: "OpenAI",     ctx: "131K ctx", in: "$0.04/Mt",  out: "$0.15/Mt",  cache: "" },
    ],
    docsUrl: "https://novita.ai/docs/api-reference/model-apis-llm-create-chat-completion",
    createKeyUrl: "https://novita.ai/settings/key-management",
    color: "text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/30",
  },
  {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    country: "US",
    endpoint: "https://api.cloudflare.com/client/v4/accounts/{{CF_ACCOUNT_ID}}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      messages: [{ role: "user", content: "{{PROMPT}}" }],
      max_tokens: 1024,
    }, null, 2),
    docsUrl: "https://developers.cloudflare.com/workers-ai/models/",
    createKeyUrl: "https://dash.cloudflare.com/profile/api-tokens",
    color: "text-amber-300 bg-amber-300/10 border-amber-300/30",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "meta-llama/llama-3.3-70b-instruct",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://openrouter.ai/docs/api-reference/overview",
    createKeyUrl: "https://openrouter.ai/settings/keys",
    color: "text-violet-300 bg-violet-300/10 border-violet-300/30",
  },
  {
    id: "sambanova",
    name: "SambaNova",
    country: "US",
    endpoint: "https://api.sambanova.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "Meta-Llama-3.3-70B-Instruct",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://community.sambanova.ai/t/supported-models/193",
    createKeyUrl: "https://cloud.sambanova.ai/apis",
    color: "text-red-300 bg-red-300/10 border-red-300/30",
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    country: "US",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "meta/llama-3.3-70b-instruct",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.api.nvidia.com/nim/reference/llm-apis",
    createKeyUrl: "https://build.nvidia.com/settings/api-keys",
    color: "text-green-300 bg-green-300/10 border-green-300/30",
  },
  {
    id: "hyperbolic",
    name: "Hyperbolic",
    country: "US",
    endpoint: "https://api.hyperbolic.xyz/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "meta-llama/Llama-3.3-70B-Instruct",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.hyperbolic.xyz/docs/getting-started",
    createKeyUrl: "https://app.hyperbolic.xyz/settings",
    color: "text-cyan-300 bg-cyan-300/10 border-cyan-300/30",
  },
  {
    id: "ai21",
    name: "AI21 Labs",
    country: "IL",
    endpoint: "https://api.ai21.com/studio/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "jamba-large",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.ai21.com/reference/jamba-chat-api-ref",
    createKeyUrl: "https://studio.ai21.com/account/api-key",
    color: "text-sky-300 bg-sky-300/10 border-sky-300/30",
  },
  // ── Tier 3: Open-source / infra providers ─────────────────────────────────
  {
    id: "groq",
    name: "Groq",
    country: "US",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://console.groq.com/docs/openai",
    createKeyUrl: "https://console.groq.com/keys",
    color: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  },
  {
    id: "together",
    name: "Together AI",
    country: "US",
    endpoint: "https://api.together.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    // Chat models (exact API strings):
    //   MiniMaxAI/MiniMax-M3, MiniMaxAI/MiniMax-M2.7
    //   moonshotai/Kimi-K2.7-Code, moonshotai/Kimi-K2.6
    //   zai-org/GLM-5.2, zai-org/GLM-5.1, zai-org/GLM-5
    //   openai/gpt-oss-120b, openai/gpt-oss-20b
    //   deepseek-ai/DeepSeek-V4-Pro
    //   nvidia/nemotron-3-ultra-550b-a55b
    //   Qwen/Qwen3.7-Max, Qwen/Qwen3.7-Plus, Qwen/Qwen3.6-Plus
    //   Qwen/Qwen3.5-9B, Qwen/Qwen3.5-397B-A17B
    //   Qwen/Qwen3-235B-A22B-Instruct-2507-tput
    //   Qwen/Qwen2.5-7B-Instruct-Turbo
    //   meta-llama/Llama-3.3-70B-Instruct-Turbo
    //   meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo
    //   meta-llama/Meta-Llama-3-8B-Instruct-Lite
    //   google/gemma-4-31B-it, google/gemma-3n-E4B-it
    //   essentialai/rnj-1-instruct, deepcogito/cogito-v2-1-671b
    //   LiquidAI/LFM2-24B-A2B, pearl-ai/gemma-4-31b-it
    bodyTemplate: JSON.stringify({
      model: "MiniMaxAI/MiniMax-M3",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.together.ai/docs/serverless-models",
    createKeyUrl: "https://api.together.ai/settings/api-keys",
    color: "text-pink-400 bg-pink-400/10 border-pink-400/30",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    country: "FR",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "mistral-small-latest",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.mistral.ai/api/#tag/chat",
    createKeyUrl: "https://console.mistral.ai/api-keys/",
    color: "text-red-400 bg-red-400/10 border-red-400/30",
  },
  {
    id: "cohere",
    name: "Cohere",
    country: "CA",
    endpoint: "https://api.cohere.com/v2/chat",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "command-a-plus-05-2026",
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.cohere.com/reference/chat",
    createKeyUrl: "https://dashboard.cohere.com/api-keys",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    country: "US",
    endpoint: "https://api.perplexity.ai/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "sonar",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.perplexity.ai/api-reference/chat-completions",
    createKeyUrl: "https://www.perplexity.ai/settings/api",
    color: "text-teal-400 bg-teal-400/10 border-teal-400/30",
  },
  {
    id: "huggingface",
    name: "HuggingFace",
    country: "US",
    endpoint: "https://api-inference.huggingface.co/models/meta-llama/Llama-3.3-70B-Instruct/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "meta-llama/Llama-3.3-70B-Instruct",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://huggingface.co/docs/api-inference/en/tasks/chat-completion",
    createKeyUrl: "https://huggingface.co/settings/tokens",
    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  },
  {
    id: "replicate",
    name: "Replicate",
    country: "US",
    endpoint: "https://api.replicate.com/v1/predictions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
      "Prefer": "wait",
    },
    bodyTemplate: JSON.stringify({
      version: "meta/meta-llama-3-3-70b-instruct",
      input: {
        prompt: "{{PROMPT}}",
        max_new_tokens: 1024,
      },
    }, null, 2),
    docsUrl: "https://replicate.com/docs/reference/http",
    createKeyUrl: "https://replicate.com/account/api-tokens",
    color: "text-rose-400 bg-rose-400/10 border-rose-400/30",
  },
  // ── Tier 4: Additional Chinese / Asian providers ──────────────────────────
  {
    id: "moonshot",
    name: "Moonshot AI (Kimi)",
    country: "CN",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "kimi-k2.6",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://platform.moonshot.cn/docs/api/chat",
    createKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    color: "text-teal-300 bg-teal-300/10 border-teal-300/30",
  },
  {
    id: "baidu",
    name: "Baidu ERNIE (Qianfan)",
    country: "CN",
    endpoint: "https://qianfan.baidubce.com/v2/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "ernie-4.5-turbo-128k-preview",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Nlks5zkzu",
    createKeyUrl: "https://console.bce.baidu.com/iam/#/iam/accesslist",
    color: "text-blue-300 bg-blue-300/10 border-blue-300/30",
  },
  {
    id: "yi",
    name: "01.AI (Yi)",
    country: "CN",
    endpoint: "https://api.lingyiwanwu.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "yi-lightning",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://platform.lingyiwanwu.com/docs",
    createKeyUrl: "https://platform.lingyiwanwu.com/apikeys",
    color: "text-emerald-300 bg-emerald-300/10 border-emerald-300/30",
  },
  {
    id: "stepfun",
    name: "Stepfun",
    country: "CN",
    endpoint: "https://api.stepfun.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "step-3.7-flash",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://platform.stepfun.ai/docs/Chat/chat_completion",
    createKeyUrl: "https://platform.stepfun.ai/account-info",
    color: "text-orange-300 bg-orange-300/10 border-orange-300/20",
  },
  {
    id: "hunyuan",
    name: "Tencent Hunyuan",
    country: "CN",
    endpoint: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "hunyuan-turbos-latest",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://cloud.tencent.com/document/product/1729/111007",
    createKeyUrl: "https://console.cloud.tencent.com/hunyuan/api-key",
    color: "text-cyan-300 bg-cyan-300/10 border-cyan-300/20",
  },
  // ── Tier 5: Cloud providers ───────────────────────────────────────────────
  {
    id: "azure",
    name: "Azure OpenAI",
    country: "US",
    endpoint: "https://{{AZURE_RESOURCE}}.openai.azure.com/openai/v1/chat/completions",
    method: "POST",
    headers: {
      "api-key": "{{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/reference",
    createKeyUrl: "https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  },
  // ── Tier 6: Korean / multilingual providers ───────────────────────────────
  {
    id: "upstage",
    name: "Upstage Solar",
    country: "KR",
    endpoint: "https://api.upstage.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "solar-pro3",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://developers.upstage.ai/docs/api-reference/chat-api",
    createKeyUrl: "https://console.upstage.ai/api-keys",
    color: "text-yellow-300 bg-yellow-300/10 border-yellow-300/20",
  },
  // ─�� Tier 7: Enterprise / specialty providers ───────��──────────────────────
  {
    id: "writer",
    name: "Writer AI (Palmyra)",
    country: "US",
    endpoint: "https://api.writer.com/v1/chat",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "palmyra-x5",
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://dev.writer.com/api-guides/chat",
    createKeyUrl: "https://app.writer.com/aistudio/organization/api-keys",
    color: "text-indigo-300 bg-indigo-300/10 border-indigo-300/20",
  },
  {
    id: "lepton",
    name: "LeptonAI",
    country: "US",
    endpoint: "https://api.lepton.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "llama3-3-70b",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://lepton.ai/references/llm_models",
    createKeyUrl: "https://dashboard.lepton.ai/",
    color: "text-violet-300 bg-violet-300/10 border-violet-300/20",
  },
  // ── Tier 8: Image-first providers (Arena.ai) ─────────────────────────────
  {
    id: "bfl",
    name: "Black Forest Labs (FLUX)",
    country: "DE",
    endpoint: "https://api.bfl.ai/v1/flux-pro-1.1",
    method: "POST",
    headers: {
      "x-key": "{{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      prompt: "{{PROMPT}}",
      width: 1024,
      height: 1024,
    }, null, 2),
    docsUrl: "https://docs.bfl.ai/quick_start",
    createKeyUrl: "https://api.bfl.ai/auth/register",
    color: "text-yellow-300 bg-yellow-300/10 border-yellow-300/20",
  },
  {
    id: "bytedance",
    name: "Bytedance (SeedDream)",
    country: "CN",
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/images/generations",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "doubao-seedream-4.5",
      prompt: "{{PROMPT}}",
      size: "1024x1024",
    }, null, 2),
    docsUrl: "https://www.volcengine.com/docs/82379/1399008",
    createKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    color: "text-red-300 bg-red-300/10 border-red-300/20",
  },
  {
    id: "recraft",
    name: "Recraft AI",
    country: "US",
    endpoint: "https://external.api.recraft.ai/v1/images/generations",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "recraftv3",
      prompt: "{{PROMPT}}",
      n: 1,
      size: "1024x1024",
    }, null, 2),
    docsUrl: "https://www.recraft.ai/docs",
    createKeyUrl: "https://www.recraft.ai/profile",
    color: "text-pink-300 bg-pink-300/10 border-pink-300/20",
  },
  {
    id: "ideogram",
    name: "Ideogram AI",
    country: "US",
    endpoint: "https://api.ideogram.ai/v1/ideogram-v3/generate",
    method: "POST",
    headers: {
      "Api-Key": "{{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      image_request: {
        prompt: "{{PROMPT}}",
        model: "V_3",
        aspect_ratio: "ASPECT_1_1",
      },
    }, null, 2),
    docsUrl: "https://developer.ideogram.ai/ideogram-v3",
    createKeyUrl: "https://ideogram.ai/manage-api",
    color: "text-purple-300 bg-purple-300/10 border-purple-300/20",
  },
  {
    id: "luma",
    name: "Luma AI (Photon)",
    country: "US",
    endpoint: "https://api.lumalabs.ai/dream-machine/v1/generations/image",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "photon-1",
      prompt: "{{PROMPT}}",
      aspect_ratio: "1:1",
    }, null, 2),
    docsUrl: "https://docs.lumalabs.ai/reference/create-image-generation",
    createKeyUrl: "https://lumalabs.ai/dream-machine/api/keys",
    color: "text-sky-300 bg-sky-300/10 border-sky-300/20",
  },
  {
    id: "amazon",
    name: "Amazon Nova (Bedrock)",
    country: "US",
    endpoint: "https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.nova-pro-v1:0/converse",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Amz-Bedrock-Key": "{{API_KEY}}",
    },
    bodyTemplate: JSON.stringify({
      messages: [{ role: "user", content: [{ text: "{{PROMPT}}" }] }],
      inferenceConfig: { maxTokens: 1024 },
    }, null, 2),
    docsUrl: "https://docs.aws.amazon.com/nova/latest/userguide/using-nova-apis.html",
    createKeyUrl: "https://console.aws.amazon.com/iam/home#/security_credentials",
    color: "text-amber-300 bg-amber-300/10 border-amber-300/20",
  },
  // ── Tier 9: New / Emerging providers ─────────────────────────────────────
  {
    id: "inception",
    name: "Inception (Mercury)",
    country: "US",
    endpoint: "https://api.inceptionlabs.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "mercury-coder-small",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.inceptionlabs.ai/api-reference/chat",
    createKeyUrl: "https://platform.inceptionlabs.ai/",
    color: "text-slate-300 bg-slate-300/10 border-slate-300/20",
  },
  {
    id: "ibm",
    name: "IBM Granite (WatsonX)",
    country: "US",
    endpoint: "https://us-south.ml.cloud.ibm.com/ml/v1/text/chat?version=2023-05-29",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model_id: "ibm/granite-4-8b-instruct",
      messages: [{ role: "user", content: "{{PROMPT}}" }],
      parameters: { max_new_tokens: 1024 },
    }, null, 2),
    docsUrl: "https://www.ibm.com/docs/en/watsonx/saas?topic=tasks-text-chat",
    createKeyUrl: "https://www.ibm.com/watsonx",
    color: "text-blue-300 bg-blue-300/10 border-blue-300/20",
  },
  {
    id: "neets",
    name: "Neets AI",
    country: "US",
    endpoint: "https://api.neets.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
      "X-API-Key": "{{API_KEY}}",
    },
    bodyTemplate: JSON.stringify({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.neets.ai/reference/create-chat-completion",
    createKeyUrl: "https://neets.ai/api",
    color: "text-rose-300 bg-rose-300/10 border-rose-300/20",
  },
  {
    id: "lamini",
    name: "Lamini AI",
    country: "US",
    endpoint: "https://api.lamini.ai/v1/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model_name: "meta-llama/Meta-Llama-3-8B-Instruct",
      prompt: "{{PROMPT}}",
      max_new_tokens: 1024,
    }, null, 2),
    docsUrl: "https://lamini-ai.github.io/lamini/",
    createKeyUrl: "https://app.lamini.ai/account",
    color: "text-yellow-300 bg-yellow-300/10 border-yellow-300/20",
  },
  {
    id: "deepinfra",
    name: "Deep Infra",
    country: "US",
    endpoint: "https://api.deepinfra.com/v1/openai/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "meta-llama/Meta-Llama-3.1-70B-Instruct",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://deepinfra.com/docs/advanced/openai_api",
    createKeyUrl: "https://deepinfra.com/dash/api_keys",
    color: "text-indigo-300 bg-indigo-300/10 border-indigo-300/20",
  },
  {
    id: "anyscale",
    name: "Anyscale",
    country: "US",
    endpoint: "https://api.endpoints.anyscale.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "meta-llama/Meta-Llama-3-70B-Instruct",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.endpoints.anyscale.com/",
    createKeyUrl: "https://console.anyscale.com/credentials",
    color: "text-cyan-300 bg-cyan-300/10 border-cyan-300/20",
  },
  // ── Custom ────────────────────────────────────────────────────────────────
  {
    id: "custom",
    name: "Custom / cURL",
    country: "",
    endpoint: "",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    bodyTemplate: JSON.stringify({
      model: "your-model",
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "",
    createKeyUrl: "",
    color: "text-muted-foreground bg-muted/10 border-border",
  },
]

// ── Provider logos (theSVG.org CDN) ───────────────────────────────────────────
// Using jsDelivr mirror for performance. Variants: light = white for dark BG, default fallback.
const BASE = "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons"

const PROVIDER_LOGOS: Record<string, string> = {
  dahono:      `${BASE}/dahono/color.svg`,
  anthropic:   `${BASE}/anthropic/light.svg`,
  openai:      `${BASE}/openai/dark.svg`,
  google:      `${BASE}/google/default.svg`,
  xai:         `${BASE}/x/mono.svg`,
  deepseek:    `${BASE}/deepseek/default.svg`,
  qwen:        `${BASE}/alibaba-cloud/mono.svg`,
  zhipu:       `${BASE}/zhipuai/default.svg`,
  minimax:     `${BASE}/minimax/default.svg`,
  cerebras:    `${BASE}/cerebras/mono.svg`,
  fireworks:   `${BASE}/fireworks-ai/default.svg`,
  novita:      `${BASE}/novita/default.svg`,
  cloudflare:  `${BASE}/cloudflare-workers/default.svg`,
  openrouter:  `${BASE}/openrouter/default.svg`,
  sambanova:   `${BASE}/sambanova/default.svg`,
  nvidia:      `${BASE}/nvidia/mono.svg`,
  hyperbolic:  `${BASE}/hyperbolic/default.svg`,
  ai21:        `${BASE}/ai21-labs/default.svg`,
  groq:        `${BASE}/groq/default.svg`,
  together:    `${BASE}/together-ai/default.svg`,
  mistral:     `${BASE}/mistral-ai/default.svg`,
  cohere:      `${BASE}/cohere/default.svg`,
  perplexity:  `${BASE}/perplexity/default.svg`,
  huggingface: `${BASE}/hugging-face/default.svg`,
  replicate:   `${BASE}/replicate/default.svg`,
  moonshot:    `${BASE}/moonshot-ai/default.svg`,
  baidu:       `${BASE}/baidu/default.svg`,
  yi:          `${BASE}/01dotai/mono.svg`,
  stepfun:     `${BASE}/stepfun/default.svg`,
  hunyuan:     `${BASE}/tencent/mono.svg`,
  azure:       `${BASE}/microsoft-azure/default.svg`,
  upstage:     `${BASE}/upstage/default.svg`,
  writer:      `${BASE}/writer/default.svg`,
  lepton:      `${BASE}/lepton-ai/default.svg`,
  bfl:         `${BASE}/black-forest-labs/default.svg`,
  bytedance:   `${BASE}/bytedance/default.svg`,
  recraft:     `${BASE}/recraft/default.svg`,
  ideogram:    `${BASE}/ideogram/default.svg`,
  luma:        `${BASE}/luma-ai/default.svg`,
  amazon:      `${BASE}/amazon-web-services/mono.svg`,
  inception:   `${BASE}/inception/default.svg`,
  ibm:         `${BASE}/ibm/default.svg`,
  deepinfra:   `${BASE}/deepinfra/default.svg`,
  anyscale:    `${BASE}/anyscale/default.svg`,
}


function ProviderLogo({ providerId, className = "w-4 h-4" }: { providerId: string; className?: string }) {
  const src = PROVIDER_LOGOS[providerId]
  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      className={`${className} object-contain flex-shrink-0`}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
    />
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 11-8 8z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <polyline points="4 7 4 4 7 4" />
      <polyline points="17 4 20 4 20 7" />
      <polyline points="20 17 20 20 17 20" />
      <polyline points="7 20 4 20 4 17" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function GeminiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M12 2C12 2 8 8 8 12s4 10 4 10 4-4 4-10S12 2 12 2z" />
      <path d="M2 12c0 0 6-4 10-4s10 4 10 4-4 4-10 4S2 12 2 12z" />
    </svg>
  )
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function VideoTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    </svg>
  )
}

// ── Log level styles ───────────────────��─────────────────────��────────────────

const LOG_STYLES: Record<LogEntry["level"], string> = {
  info: "text-muted-foreground",
  req:  "text-blue-400",
  res:  "text-yellow-400",
  ok:   "text-green-400",
  err:  "text-red-400",
  curl: "text-cyan-400",
}

const LOG_PREFIX: Record<LogEntry["level"], string> = {
  info: "  ",
  req:  "→ ",
  res:  "← ",
  ok:   "✓ ",
  err:  "✗ ",
  curl: "$ ",
}

// ── Header row editor ────────────────────────────────────────────────��────────

interface HeaderRow { key: string; value: string; id: number }

function HeaderEditor({
  rows,
  onChange,
}: {
  rows: HeaderRow[]
  onChange: (rows: HeaderRow[]) => void
}) {
  function update(id: number, field: "key" | "value", val: string) {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  }
  function remove(id: number) {
    onChange(rows.filter((r) => r.id !== id))
  }
  function add() {
    onChange([...rows, { key: "", value: "", id: Date.now() }])
  }

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => (
        <div key={row.id} className="flex gap-1 items-center">
          <input
            value={row.key}
            onChange={(e) => update(row.id, "key", e.target.value)}
            placeholder="Header-Name"
            className="flex-1 min-w-0 text-[11px] font-mono bg-background border border-border rounded px-2 py-1 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-muted-foreground/40 text-[10px] flex-shrink-0">:</span>
          <input
            value={row.value}
            onChange={(e) => update(row.id, "value", e.target.value)}
            placeholder="value or {{API_KEY}}"
            className="flex-1 min-w-0 text-[11px] font-mono bg-background border border-border rounded px-2 py-1 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => remove(row.id)}
            className="flex-shrink-0 text-muted-foreground/40 hover:text-red-400 transition-colors p-1 rounded"
          >
            <TrashIcon />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition-colors self-start"
      >
        <PlusIcon /> Add header
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  ts: string
}

export default function ManualKeyTester() {
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset>(PRESETS[0])
  const [apiKey, setApiKey] = useState("")
  const [debouncedApiKey, setDebouncedApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [endpoint, setEndpoint] = useState(PRESETS[0].endpoint)
  const [method, setMethod] = useState<"GET" | "POST" | "PUT" | "DELETE">(PRESETS[0].method)
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>(
    Object.entries(PRESETS[0].headers).map(([key, value], i) => ({ key, value, id: i }))
  )
  const [bodyTemplate, setBodyTemplate] = useState(PRESETS[0].bodyTemplate)
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ManualTestResult | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [showLog, setShowLog] = useState(false)
  const [showRawResponse, setShowRawResponse] = useState(false)
  const [showBodyEditor, setShowBodyEditor] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState(false)
  const [copiedCurlFull, setCopiedCurlFull] = useState(false)
  const [selectedDahonoModel, setSelectedDahonoModel] = useState("dahono/deepseek-v4-flash")
  const [configOpen, setConfigOpen] = useState(false)
  // Tab state
  const [activeTab, setActiveTab] = useState<"vision" | "ocr" | "image-gen" | "video-gen" | "working-keys" | "sbg-agent" | "multi-batch">("vision")
  // Increment to force WorkingKeysPanel to re-load from localStorage
  const [workingKeysTick, setWorkingKeysTick] = useState(0)
  // Image Gen config — default to first Google image model
  const [imageModel, setImageModel] = useState(() => getImageCapabilities("google")[0]?.id ?? "")
  const [imageAspectRatio, setImageAspectRatio] = useState("1:1")
  // Video Gen config — default to first Google video model
  const [videoModel, setVideoModel] = useState(() => getVideoCapabilities("google").models[0]?.id ?? "")
  const [videoAspectRatio, setVideoAspectRatio] = useState("16:9")
  // Vision / OCR state
  const [visionPrompt, setVisionPrompt] = useState("")
  const [visionImage, setVisionImage] = useState<{ dataUrl: string; mimeType: string; name: string } | null>(null)
  const [visionLoading, setVisionLoading] = useState(false)
  const [visionResult, setVisionResult] = useState<ManualTestResult | null>(null)
  const [visionHistory, setVisionHistory] = useState<ChatMessage[]>([])
  const [ocrImage, setOcrImage] = useState<{ dataUrl: string; mimeType: string; name: string } | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<string | null>(null)
  const visionFileRef = useRef<HTMLInputElement>(null)
  const ocrFileRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const visionEndRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce API key changes by 400ms
  const handleApiKeyChange = useCallback((val: string) => {
    setApiKey(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedApiKey(val), 400)
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatHistory, loading])

  useEffect(() => {
    visionEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [visionHistory, visionLoading])

  // SWR key — only fetches when Dahono is selected AND key is long enough
  const dahonoSWRKey =
    selectedPreset.id === "dahono" && debouncedApiKey.trim().length >= 8
      ? ["/api/dahono-models", debouncedApiKey.trim()]
      : null

  const { data: dahonoData, isLoading: dahonoModelsFetching } = useSWR(
    dahonoSWRKey,
    ([url, key]: [string, string]) =>
      fetch(url, { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  )

  const dahonoModels: { id: string; tier: string; free: boolean }[] = dahonoData?.models ?? []

  // Auto-select first free model when models load
  useEffect(() => {
    if (dahonoModels.length > 0) {
      const firstFree = dahonoModels.find((m) => m.free)
      if (firstFree) {
        setSelectedDahonoModel(firstFree.id)
        updateDahonoBodyModel(firstFree.id)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dahonoData])

  function updateDahonoBodyModel(modelId: string) {
    setBodyTemplate(JSON.stringify({
      model: modelId,
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2))
  }

  // ── Vision / OCR helpers ────────────────────────────────────────────────────

  function handleImageFile(
    file: File,
    setter: (v: { dataUrl: string; mimeType: string; name: string } | null) => void
  ) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setter({ dataUrl, mimeType: file.type || "image/jpeg", name: file.name })
    }
    reader.readAsDataURL(file)
  }

  async function runVisionTest() {
    if (!apiKey.trim() || !visionImage || visionLoading) return
    setVisionLoading(true)
    const userMsg: ChatMessage = {
      role: "user",
      content: visionPrompt || "(image only)",
      ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    }
    setVisionHistory((prev) => [...prev, userMsg])
    const headers: Record<string, string> = {}
    for (const row of headerRows) {
      if (row.key.trim()) headers[row.key.trim()] = row.value
    }
    try {
      const base64 = visionImage.dataUrl.split(",")[1]
      const res = await fetch("/api/manual-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedPreset.id,
          apiKey: apiKey.trim(),
          endpoint,
          method,
          headers,
          prompt: visionPrompt || "Describe this image in detail.",
          testMode: "vision",
          imageData: { base64, mimeType: visionImage.mimeType },
        }),
      })
      const data: ManualTestResult = await res.json()
      setVisionResult(data)
      const reply = data.chatReply ?? (data.ok ? data.responseBody : `Error: HTTP ${data.status}`)
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: reply ?? "No response",
        ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      }
      setVisionHistory((prev) => [...prev, assistantMsg])
    } catch (err) {
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: err instanceof Error ? err.message : "Request failed",
        ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      }
      setVisionHistory((prev) => [...prev, assistantMsg])
    } finally {
      setVisionLoading(false)
      setVisionPrompt("")
    }
  }

  async function runOcrTest() {
    if (!apiKey.trim() || !ocrImage || ocrLoading) return
    setOcrLoading(true)
    setOcrResult(null)
    const headers: Record<string, string> = {}
    for (const row of headerRows) {
      if (row.key.trim()) headers[row.key.trim()] = row.value
    }
    try {
      const base64 = ocrImage.dataUrl.split(",")[1]
      const res = await fetch("/api/manual-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedPreset.id,
          apiKey: apiKey.trim(),
          endpoint,
          method,
          headers,
          prompt: "Please extract and transcribe ALL text visible in this image. Output only the extracted text, preserving layout as much as possible. Do not add any explanation.",
          testMode: "vision",
          imageData: { base64, mimeType: ocrImage.mimeType },
        }),
      })
      const data: ManualTestResult = await res.json()
      setOcrResult(data.chatReply ?? (data.ok ? data.responseBody : `Error: HTTP ${data.status} ${data.statusText}`))
    } catch (err) {
      setOcrResult(err instanceof Error ? err.message : "Request failed")
    } finally {
      setOcrLoading(false)
    }
  }

  function applyPreset(preset: ProviderPreset) {
    setSelectedPreset(preset)
    setEndpoint(preset.endpoint)
    setMethod(preset.method)
    setHeaderRows(
      Object.entries(preset.headers).map(([key, value], i) => ({ key, value, id: i }))
    )
    setBodyTemplate(preset.bodyTemplate)
    setResult(null)
    setShowLog(false)
    // Reset image/video model to first supported for the new provider
    const imgModels = getImageCapabilities(preset.id)
    if (imgModels.length > 0) setImageModel(imgModels[0].id)
    const { models: vidModels } = getVideoCapabilities(preset.id)
    if (vidModels.length > 0) setVideoModel(vidModels[0].id)
  }

  async function runTest() {
    if (!apiKey.trim() || !prompt.trim() || loading) return

    const userMsg: ChatMessage = {
      role: "user",
      content: prompt,
      ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    }
    setChatHistory((prev) => [...prev, userMsg])
    const currentPrompt = prompt
    setPrompt("")
    setLoading(true)
    setResult(null)

    const headers: Record<string, string> = {}
    for (const row of headerRows) {
      if (row.key.trim()) headers[row.key.trim()] = row.value
    }

    try {
      const res = await fetch("/api/manual-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedPreset.id,
          apiKey: apiKey.trim(),
          endpoint,
          method,
          headers,
          body: bodyTemplate || undefined,
          prompt: currentPrompt,
        }),
      })
      const data: ManualTestResult = await res.json()
      setResult(data)

      const reply = data.chatReply ?? (data.ok ? data.responseBody : null)
      if (reply) {
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: reply,
          ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        }
        setChatHistory((prev) => [...prev, assistantMsg])
      } else {
        const errMsg: ChatMessage = {
          role: "assistant",
          content: `Error: HTTP ${data.status} ${data.statusText}`,
          ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        }
        setChatHistory((prev) => [...prev, errMsg])
      }
    } catch (err) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: err instanceof Error ? err.message : "Request failed",
        ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      }
      setChatHistory((prev) => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      runTest()
    }
  }

  function copyCurl() {
    if (!result?.curlCommand) return
    navigator.clipboard.writeText(result.curlCommand).then(() => {
      setCopiedCurl(true)
      setTimeout(() => setCopiedCurl(false), 1500)
    })
  }

  function copyCurlFull() {
    if (!result?.curlFull) return
    navigator.clipboard.writeText(result.curlFull).then(() => {
      setCopiedCurlFull(true)
      setTimeout(() => setCopiedCurlFull(false), 1500)
    })
  }

  return (
    <div className="flex h-full bg-background text-foreground font-sans overflow-hidden relative">

      {/* ── Mobile config overlay backdrop ────────────────────────────────── */}
      {configOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setConfigOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── LEFT: Config panel ─────────────────────────────────────────────── */}
      <aside className={`
        flex-shrink-0 border-r border-border bg-card flex flex-col overflow-y-auto
        fixed md:static inset-y-0 left-0 z-40 md:z-auto
        w-72 md:w-64 lg:w-72
        transition-transform duration-200 ease-in-out md:transition-none md:translate-x-0
        ${configOpen ? "translate-x-0" : "-translate-x-full"}
      `}>

        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div>
            <p className="text-xs font-semibold text-foreground">Configuration</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Provider &amp; API key settings</p>
          </div>
          <button
            onClick={() => setConfigOpen(false)}
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1"
            aria-label="Close config"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-4 py-4 flex flex-col gap-5">

          {/* Provider selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Provider <span className="normal-case font-normal text-muted-foreground/50">({PRESETS.length - 1} supported)</span>
            </label>
            <div className="flex flex-col gap-px max-h-52 overflow-y-auto">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className={`text-[11px] font-medium px-2.5 py-1.5 rounded transition-colors text-left w-full flex items-center gap-2 group ${
                    selectedPreset.id === p.id
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <span className={`w-4 h-4 flex items-center justify-center flex-shrink-0 rounded transition-colors overflow-hidden ${
                    selectedPreset.id === p.id ? "opacity-100" : "opacity-60 group-hover:opacity-90"
                  }`}>
                    {PROVIDER_LOGOS[p.id] ? (
                      <ProviderLogo providerId={p.id} className="w-4 h-4" />
                    ) : (
                      <span className={`w-1.5 h-1.5 rounded-full border transition-colors ${
                        selectedPreset.id === p.id ? "bg-foreground border-foreground" : "border-border group-hover:border-muted-foreground"
                      }`} />
                    )}
                  </span>
                  <span className="flex-1 min-w-0 truncate">{p.name}</span>
                  {p.country && (
                    <span className="flex-shrink-0 text-[9px] font-mono font-semibold tracking-wider text-muted-foreground/50 uppercase">
                      {p.country}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                API Key
              </label>
              {apiKey && (
                <button
                  onClick={() => { handleApiKeyChange(""); setShowKey(false) }}
                  className="text-[9px] text-muted-foreground/60 hover:text-destructive transition-colors flex items-center gap-0.5"
                  title="Clear API key"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Clear
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="sk-ant-... / sk-... / AIza..."
                className="w-full rounded-md border border-border bg-background text-foreground text-[11px] font-mono px-2.5 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                title={showKey ? "Hide key" : "Show key"}
              >
                <EyeIcon show={showKey} />
              </button>
            </div>
            {apiKey && (
              <p className="text-[9px] text-muted-foreground/60 font-mono truncate">
                {apiKey.slice(0, 12)}{"•".repeat(Math.max(0, apiKey.length - 12))}
              </p>
            )}
            {/* Create API key link */}
            {selectedPreset.createKeyUrl && (
              <a
                href={selectedPreset.createKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors self-start"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5 3v4M3 5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Get {selectedPreset.name} API key
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.5 6.5L6.5 1.5M6.5 1.5H3M6.5 1.5V5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            )}
          </div>

          {/* Endpoint */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Endpoint URL
            </label>
            <div className="flex gap-1">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as "GET" | "POST" | "PUT" | "DELETE")}
                className="text-[10px] font-mono bg-background border border-border rounded px-1.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring flex-shrink-0"
              >
                {["POST", "GET", "PUT", "DELETE"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input
                type="url"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://api.example.com/v1/..."
                className="flex-1 min-w-0 rounded-md border border-border bg-background text-foreground text-[10px] font-mono px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
            </div>
            {selectedPreset.docsUrl && (
              <a
                href={selectedPreset.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] text-primary/70 hover:text-primary transition-colors"
              >
                View API docs →
              </a>
            )}
          </div>

          {/* Dahono model picker — shown when provider is Dahono */}
          {selectedPreset.id === "dahono" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Model
                {dahonoModelsFetching && <span className="ml-1 font-normal normal-case text-muted-foreground/50">fetching...</span>}
                {!dahonoModelsFetching && dahonoModels.length > 0 && (
                  <span className="ml-1 font-normal normal-case text-muted-foreground/50">
                    {dahonoModels.length} models from gateway
                  </span>
                )}
              </label>
              {dahonoModels.length > 0 ? (
                <select
                  value={selectedDahonoModel}
                  onChange={(e) => {
                    setSelectedDahonoModel(e.target.value)
                    updateDahonoBodyModel(e.target.value)
                  }}
                  className="text-[10px] font-mono bg-background border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full"
                >
                  {["free", "starter", "pro", "business"].map((tier) => {
                    const tier_models = dahonoModels.filter((m) => m.tier === tier)
                    if (tier_models.length === 0) return null
                    return (
                      <optgroup key={tier} label={`${tier.charAt(0).toUpperCase() + tier.slice(1)} (${tier_models.length})`}>
                        {tier_models.map((m) => (
                          <option key={m.id} value={m.id}>{m.id}</option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              ) : (
                <p className="text-[9px] text-muted-foreground/50">
                  Enter your Dahono API key above to auto-load all {dahonoModelsFetching ? "..." : "models"} from the gateway.
                </p>
              )}
            </div>
          )}

          {/* Batch Model Test — Run All Models (all providers) */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Batch Model Test
            </label>
            <ProviderBatchTest
              providerId={selectedPreset.id}
              providerName={selectedPreset.name}
              apiKey={apiKey}
              onSaved={() => setWorkingKeysTick((t) => t + 1)}
            />
          </div>

          {/* Headers */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Headers
            </label>
            <HeaderEditor rows={headerRows} onChange={setHeaderRows} />
            <p className="text-[9px] text-muted-foreground/50">
              Use <code className="text-primary/70">{"{{API_KEY}}"}</code> as placeholder — replaced with your key on send.
            </p>
          </div>

          {/* Compact model catalog (providers with rich model list) */}
          {selectedPreset.models && selectedPreset.models.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Models ({selectedPreset.models.length})
                <span className="ml-1 normal-case font-normal text-muted-foreground/40">— click to use</span>
              </p>
              <div className="max-h-64 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
                {selectedPreset.models.map((m) => {
                  // Check if this model is currently in the body template
                  const isActive = bodyTemplate.includes(`"${m.id}"`)
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        try {
                          const parsed = JSON.parse(bodyTemplate)
                          parsed.model = m.id
                          setBodyTemplate(JSON.stringify(parsed, null, 2))
                        } catch {
                          // fallback: just inject the model id into a new template
                          setBodyTemplate(JSON.stringify({
                            model: m.id,
                            max_tokens: 1024,
                            messages: [{ role: "user", content: "{{PROMPT}}" }],
                          }, null, 2))
                        }
                      }}
                      className={`text-left w-full px-2 py-1.5 rounded transition-colors flex flex-col gap-0.5 group ${
                        isActive
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-secondary/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-medium truncate ${isActive ? "text-primary" : "text-foreground group-hover:text-foreground"}`}>
                          {m.label}
                        </span>
                        <span className="text-[9px] text-muted-foreground/50 bg-muted/40 px-1 py-0.5 rounded flex-shrink-0">{m.tag}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        <span className="text-[9px] text-muted-foreground/70">In: <span className="text-emerald-400/80">{m.in}</span></span>
                        <span className="text-[9px] text-muted-foreground/70">Out: <span className="text-amber-400/80">{m.out}</span></span>
                        {m.cache && <span className="text-[9px] text-muted-foreground/70">Cache: <span className="text-sky-400/80">{m.cache}</span></span>}
                        <span className="text-[9px] text-muted-foreground/50">{m.ctx}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Request body */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => setShowBodyEditor((v) => !v)}
              className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Request Body Template</span>
              <ChevronIcon open={showBodyEditor} />
            </button>
            {showBodyEditor && (
              <>
                <textarea
                  value={bodyTemplate}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  placeholder={`{\n  "model": "...",\n  "messages": [{"role": "user", "content": "{{PROMPT}}"}]\n}`}
                  className="w-full rounded-md border border-border bg-background text-foreground text-[10px] font-mono px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 resize-y"
                />
                <p className="text-[9px] text-muted-foreground/50">
                  Use <code className="text-primary/70">{"{{PROMPT}}"}</code> where you want the message injected.
                </p>
              </>
            )}
          </div>

          {/* ── Image Gen config — provider-aware ── */}
          {activeTab === "image-gen" && (() => {
            const imageModels = getImageCapabilities(selectedPreset.id)
            const isImageSupported = imageModels.length > 0
            return (
              <div className="flex flex-col gap-3 pt-1 border-t border-border">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Image Gen Config</p>

                {!isImageSupported ? (
                  <p className="text-[10px] text-yellow-400/80 border border-yellow-400/20 bg-yellow-400/5 px-2.5 py-2 rounded-lg leading-relaxed">
                    {selectedPreset.name} does not support image generation. Switch to Gemini, OpenAI, Together AI, Fireworks, or Replicate.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Model</label>
                      {imageModels.map((m) => (
                        <button key={m.id} onClick={() => setImageModel(m.id)}
                          className={`text-left px-2.5 py-2 rounded-lg border transition-colors ${
                            imageModel === m.id ? "border-primary/60 bg-primary/10" : "border-border hover:bg-secondary/40"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-semibold text-foreground">{m.label}</span>
                            <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-primary/20 text-primary">{m.tag}</span>
                          </div>
                          <p className="text-[9px] text-muted-foreground leading-snug">{m.description}</p>
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Aspect Ratio</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {IMAGE_ASPECT_RATIOS.map((r) => (
                          <button key={r} onClick={() => setImageAspectRatio(r)}
                            className={`py-1.5 rounded-md text-[11px] font-mono font-medium border transition-colors ${
                              imageAspectRatio === r
                                ? "bg-primary/20 border-primary/60 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })()}

          {/* ── Video Gen config — provider-aware ── */}
          {activeTab === "video-gen" && (() => {
            const { models: videoModels, aspectRatios: videoAspects } = getVideoCapabilities(selectedPreset.id)
            const isVideoSupported = videoModels.length > 0
            return (
              <div className="flex flex-col gap-3 pt-1 border-t border-border">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Video Gen Config</p>

                {!isVideoSupported ? (
                  <p className="text-[10px] text-yellow-400/80 border border-yellow-400/20 bg-yellow-400/5 px-2.5 py-2 rounded-lg leading-relaxed">
                    {selectedPreset.name} does not support video generation. Switch to Gemini (Google) for Veo 3.1 or MiniMax (Hailuo) for Hailuo Video.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Model</label>
                      <select
                        value={videoModel}
                        onChange={(e) => setVideoModel(e.target.value)}
                        className="w-full appearance-none rounded-md border border-border bg-background text-foreground text-[11px] font-mono px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {videoModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Aspect Ratio</label>
                      <div className="flex gap-2">
                        {videoAspects.map((r) => (
                          <button key={r} onClick={() => setVideoAspectRatio(r)}
                            className={`flex-1 py-1.5 rounded-md border text-[11px] font-mono transition-colors ${
                              videoAspectRatio === r
                                ? "border-primary text-primary bg-primary/10"
                                : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })()}

          {/* Reset */}
          <button
            onClick={() => { setChatHistory([]); setVisionHistory([]); setOcrResult(null); setResult(null); setVisionResult(null); setShowLog(false) }}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary px-3 py-2 rounded transition-colors border border-border/50 hover:border-border w-full text-left"
          >
            Clear All History
          </button>

        </div>
      </aside>

      {/* ── RIGHT: Tabbed panel ────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Tab bar + status */}
        <div className="flex items-center gap-0 px-2 border-b border-border bg-card flex-shrink-0 min-h-[44px]">

          {/* Mobile: config toggle button */}
          <button
            onClick={() => setConfigOpen(true)}
            className="md:hidden flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground px-2 py-2 mr-1 flex-shrink-0 transition-colors"
            aria-label="Open configuration"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* API Tester tabs — icon only */}
          <div className="flex items-center gap-0.5 py-1.5 mr-1">
            {([
              { id: "vision", icon: <ImageIcon />, title: "Vision" },
              { id: "ocr", icon: <ScanIcon />, title: "OCR" },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                title={t.title}
                className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
                  activeTab === t.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {t.icon}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-border flex-shrink-0 mx-1" />

          {/* AI Generation tabs — icon only */}
          <div className="flex items-center gap-0.5 py-1.5 mr-1">
            {([
              { id: "image-gen", icon: <PhotoIcon />, title: "Image Gen" },
              { id: "video-gen", icon: <VideoTabIcon />, title: "Video Gen" },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                title={t.title}
                className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
                  activeTab === t.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {t.icon}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-border flex-shrink-0 mx-1" />

          {/* Working Keys tab */}
          <button
            onClick={() => setActiveTab("working-keys")}
            title="Working Keys"
            className={`relative flex items-center justify-center w-8 h-8 rounded transition-colors ${
              activeTab === "working-keys"
                ? "bg-green-400/15 text-green-400"
                : "text-muted-foreground hover:text-green-400 hover:bg-green-400/10"
            }`}
          >
            {/* Key icon */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="5.5" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8.5 8h6M12.5 8v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* Divider */}
          <div className="w-px h-4 bg-border flex-shrink-0 mx-1" />

          {/* SBG Agent tab */}
          <button
            onClick={() => setActiveTab("sbg-agent")}
            title="SBG Agent — Research & Coding Helper"
            className={`relative flex items-center gap-1 px-2 h-8 rounded text-[10px] font-semibold font-mono transition-colors ${
              activeTab === "sbg-agent"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10"
            }`}
          >
            SBG
            {activeTab !== "sbg-agent" && (
              <span className="text-[7px] font-bold px-0.5 rounded bg-primary/10 text-primary leading-none py-px">AI</span>
            )}
          </button>

          {/* Multi-Key Batch tab */}
          <button
            onClick={() => setActiveTab("multi-batch")}
            title="Multi-Key Batch — Test all providers at once"
            className={`relative flex items-center gap-1 px-2 h-8 rounded text-[10px] font-semibold transition-colors ${
              activeTab === "multi-batch"
                ? "bg-emerald-500/15 text-emerald-400"
                : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0" aria-hidden>
              <path d="M1 3h10M1 6h10M1 9h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="10" cy="3" r="1.5" fill="currentColor" />
              <circle cx="10" cy="6" r="1.5" fill="currentColor" />
              <circle cx="10" cy="9" r="1.5" fill="currentColor" />
            </svg>
            Batch
          </button>

          {/* Divider */}
          <div className="hidden sm:block w-px h-4 bg-border flex-shrink-0 mr-2" />

          {/* Provider badge — with logo and country flag */}
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground truncate max-w-[200px] flex-shrink-0">
            <ProviderLogo providerId={selectedPreset.id} className="w-3.5 h-3.5 opacity-70" />
            {selectedPreset.name}
            {selectedPreset.country && (
              <span className="text-[9px] font-mono font-semibold tracking-wider text-muted-foreground/40 uppercase">
                {selectedPreset.country}
              </span>
            )}
          </span>

          {/* Endpoint */}
          {endpoint && (
            <span className="hidden md:block text-[10px] font-mono text-muted-foreground/50 truncate flex-1 min-w-0 ml-2">
              {method} {endpoint.replace(/\?key=.*/, "?key=…")}
            </span>
          )}

          {/* Response status — shown for Vision and OCR tabs only */}
          {activeTab === "vision" && visionResult && (
            <div className="flex items-center gap-2 ml-auto flex-shrink-0 pr-1">
              {visionResult.tokenUsage?.totalTokens && (
                <span className="text-[10px] font-mono text-muted-foreground hidden md:block">
                  {visionResult.tokenUsage.totalTokens}t
                </span>
              )}
              <span className={`text-[10px] font-mono ${visionResult.ok ? "text-green-400" : "text-red-400"}`}>
                {visionResult.status} · {visionResult.durationMs}ms
              </span>
            </div>
          )}
        </div>

        {/* ── VISION TAB ────────────��──────────────────────────────────��───── */}
        {activeTab === "vision" && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 flex flex-col gap-4">
              {visionHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${selectedPreset.color}`}>
                    <ImageIcon />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Vision Test</p>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                      Upload an image, optionally type a prompt, and test the model&apos;s vision capability.
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      Works with GPT-4o, Claude Sonnet, Gemini, Llama-Vision, etc.
                    </p>
                    {!apiKey && (
                      <p className="text-[10px] text-yellow-400/80 mt-2 border border-yellow-400/20 bg-yellow-400/5 px-3 py-1.5 rounded-md">
                        API key required — tap the menu icon to open config
                      </p>
                    )}
                  </div>
                </div>
              )}

              {visionHistory.map((msg, i) => (
                <div key={i} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  }`}>
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{msg.content}</pre>
                  </div>
                  <span className="text-[9px] text-muted-foreground/50 px-1">{msg.role === "user" ? "You" : selectedPreset.name} · {msg.ts}</span>
                </div>
              ))}

              {visionLoading && (
                <div className="flex items-start gap-2">
                  <div className="bg-card border border-border rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                    <SpinnerIcon />
                    <span className="text-[11px] text-muted-foreground">Analyzing image...</span>
                  </div>
                </div>
              )}
              <div ref={visionEndRef} />
            </div>

            {/* Vision result footer */}
            {visionResult?.ok && visionResult.tokenUsage && (
              <div className="border-t border-border bg-card/30 px-4 py-2 flex-shrink-0 flex items-center gap-4">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">Tokens</span>
                {visionResult.tokenUsage.promptTokens !== undefined && (
                  <span className="text-[10px] font-mono text-muted-foreground">in: <span className="text-foreground">{visionResult.tokenUsage.promptTokens}</span></span>
                )}
                {visionResult.tokenUsage.completionTokens !== undefined && (
                  <span className="text-[10px] font-mono text-muted-foreground">out: <span className="text-foreground">{visionResult.tokenUsage.completionTokens}</span></span>
                )}
                {visionResult.tokenUsage.totalTokens !== undefined && (
                  <span className="text-[10px] font-mono text-primary font-semibold">total: {visionResult.tokenUsage.totalTokens}</span>
                )}
                {visionResult.durationMs && (
                  <span className={`text-[10px] font-mono ml-auto ${visionResult.ok ? "text-green-400" : "text-red-400"}`}>
                    HTTP {visionResult.status} · {visionResult.durationMs}ms
                  </span>
                )}
              </div>
            )}

            {/* Vision input */}
            <div className="border-t border-border px-3 sm:px-4 py-3 flex-shrink-0 bg-card safe-area-bottom">
              {/* Image preview / drop zone */}
              <div
                className="mb-2.5 relative"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files[0]
                  if (file && file.type.startsWith("image/")) handleImageFile(file, setVisionImage)
                }}
              >
                {visionImage ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={visionImage.dataUrl}
                      alt="Vision input"
                      className="max-h-28 rounded-lg border border-border object-contain"
                    />
                    <button
                      onClick={() => setVisionImage(null)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-80 transition-opacity"
                    >
                      <XIcon />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded font-mono">
                      {visionImage.name}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => visionFileRef.current?.click()}
                    className="w-full border border-dashed border-border rounded-lg px-4 py-3 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50 active:bg-secondary/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <ImageIcon /> Tap or drag an image here (JPG, PNG, WebP, GIF)
                  </button>
                )}
                <input
                  ref={visionFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImageFile(file, setVisionImage)
                    e.target.value = ""
                  }}
                />
              </div>

              <div className="flex gap-2 items-end">
                <textarea
                  value={visionPrompt}
                  onChange={(e) => setVisionPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runVisionTest() } }}
                  placeholder={visionImage ? "Optional: ask about the image..." : "Upload an image first..."}
                  disabled={!apiKey.trim() || !visionImage || visionLoading}
                  rows={2}
                  className="flex-1 min-w-0 rounded-xl border border-border bg-background text-foreground text-sm px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-none disabled:opacity-40 leading-relaxed"
                />
                <button
                  onClick={runVisionTest}
                  disabled={!apiKey.trim() || !visionImage || visionLoading}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all flex-shrink-0 min-w-[80px] h-[42px]"
                >
                  {visionLoading ? <SpinnerIcon /> : <SendIcon />}
                  {visionLoading ? "..." : "Analyze"}
                </button>
              </div>
              <p className="text-[9px] text-muted-foreground/40 mt-1.5">
                Prompt optional — defaults to &quot;Describe this image in detail.&quot;
              </p>
            </div>
          </>
        )}

        {/* ── OCR TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "ocr" && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 flex flex-col gap-4">
              {!ocrResult && !ocrLoading && (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${selectedPreset.color}`}>
                    <ScanIcon />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">OCR — Extract Text from Image</p>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                      Upload an image containing text. The model will extract and transcribe all visible text.
                    </p>
                    {!apiKey && (
                      <p className="text-[10px] text-yellow-400/80 mt-2 border border-yellow-400/20 bg-yellow-400/5 px-3 py-1.5 rounded-md">
                        API key required — tap the menu icon to open config
                      </p>
                    )}
                  </div>
                </div>
              )}

              {ocrLoading && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <SpinnerIcon />
                  <span className="text-[11px] text-muted-foreground">Extracting text...</span>
                </div>
              )}

              {ocrResult && !ocrLoading && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Extracted Text</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(ocrResult)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-transparent hover:bg-secondary transition-colors"
                      >
                        <CopyIcon /> Copy
                      </button>
                      <button
                        onClick={() => { setOcrResult(null); setOcrImage(null) }}
                        className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-transparent hover:bg-secondary transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {ocrImage && (
                    <div className="flex gap-3 items-start">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ocrImage.dataUrl} alt="OCR input" className="max-h-40 max-w-[40%] rounded-lg border border-border object-contain flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <pre className="text-sm text-foreground font-mono whitespace-pre-wrap break-words bg-card border border-border rounded-lg px-3 py-2.5 leading-relaxed text-[11px] max-h-40 overflow-y-auto">
                          {ocrResult}
                        </pre>
                      </div>
                    </div>
                  )}
                  {!ocrImage && (
                    <pre className="text-sm text-foreground font-mono whitespace-pre-wrap break-words bg-card border border-border rounded-lg px-3 py-2.5 leading-relaxed text-[11px]">
                      {ocrResult}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* OCR input */}
            <div className="border-t border-border px-3 sm:px-4 py-3 flex-shrink-0 bg-card">
              <div
                className="mb-2.5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files[0]
                  if (file && file.type.startsWith("image/")) handleImageFile(file, setOcrImage)
                }}
              >
                {ocrImage ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/50 rounded-xl border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ocrImage.dataUrl} alt="OCR preview" className="h-9 w-9 object-cover rounded border border-border flex-shrink-0" />
                    <span className="text-[10px] font-mono text-foreground truncate flex-1 min-w-0">{ocrImage.name}</span>
                    <button onClick={() => setOcrImage(null)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 p-1">
                      <XIcon />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => ocrFileRef.current?.click()}
                    className="w-full border border-dashed border-border rounded-xl px-4 py-3.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50 active:bg-secondary/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <ScanIcon /> Tap or drag an image with text here
                  </button>
                )}
                <input
                  ref={ocrFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImageFile(file, setOcrImage)
                    e.target.value = ""
                  }}
                />
              </div>

              <button
                onClick={runOcrTest}
                disabled={!apiKey.trim() || !ocrImage || ocrLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all"
              >
                {ocrLoading ? <SpinnerIcon /> : <ScanIcon />}
                {ocrLoading ? "Extracting text..." : "Extract Text"}
              </button>
              <p className="text-[9px] text-muted-foreground/40 mt-1.5">
                Uses the selected provider&apos;s vision model to read text from the image.
              </p>
            </div>
          </>
        )}

        {/* ── IMAGE GEN TAB ────────────────────────────────────────────────── */}
        {activeTab === "image-gen" && (() => {
          const imageModels = getImageCapabilities(selectedPreset.id)
          const isImageSupported = imageModels.length > 0
          return (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Mobile-visible unsupported banner */}
              {!isImageSupported && (
                <div className="md:hidden flex-shrink-0 mx-3 mt-3 px-3 py-3 rounded-xl border border-yellow-400/25 bg-yellow-400/8 text-yellow-300 text-[11px] leading-relaxed">
                  <p className="font-semibold mb-0.5">Image generation not supported</p>
                  <p className="text-yellow-400/70">
                    <strong>{selectedPreset.name}</strong> has no image API. Open config (menu icon) and switch to Google, OpenAI, Together AI, Fireworks, BFL, Recraft, or Ideogram.
                  </p>
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-hidden">
                <ImageTester
                  apiKey={apiKey}
                  model={imageModel}
                  aspectRatio={imageAspectRatio}
                  providerId={selectedPreset.id}
                />
              </div>
            </div>
          )
        })()}

        {/* ── VIDEO GEN TAB ────────────────────────────────────────────────── */}
        {activeTab === "video-gen" && (() => {
          const { models: videoModels } = getVideoCapabilities(selectedPreset.id)
          const isVideoSupported = videoModels.length > 0
          return (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Mobile-visible unsupported banner */}
              {!isVideoSupported && (
                <div className="md:hidden flex-shrink-0 mx-3 mt-3 px-3 py-3 rounded-xl border border-yellow-400/25 bg-yellow-400/8 text-yellow-300 text-[11px] leading-relaxed">
                  <p className="font-semibold mb-0.5">Video generation not supported</p>
                  <p className="text-yellow-400/70">
                    <strong>{selectedPreset.name}</strong> has no video API. Open config and switch to Google (Veo 3), MiniMax (Hailuo), Together AI (Wan 2.7), or Zhipu (CogVideoX).
                  </p>
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-hidden">
                <VideoTester
                  apiKey={apiKey}
                  model={videoModel}
                  aspectRatio={videoAspectRatio}
                  providerId={selectedPreset.id}
                />
              </div>
            </div>
          )
        })()}

        {/* ── WORKING KEYS TAB ──────────────────────────────────────────────── */}
        {activeTab === "working-keys" && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <WorkingKeysPanel
              refreshTick={workingKeysTick}
              onUseKey={(key) => {
                // Pre-fill the API key field when user taps "Copy Key"
                handleApiKeyChange(key)
                setConfigOpen(true)
              }}
            />
          </div>
        )}

        {/* ── SBG AGENT TAB ─────────────────────────────────────────────────── */}
        {activeTab === "sbg-agent" && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <SBGAgent openRouterApiKey={selectedPreset.id === "openrouter" ? apiKey : ""} />
          </div>
        )}

        {/* ── MULTI-KEY BATCH TAB ───────────────────────────────────────────── */}
        {activeTab === "multi-batch" && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <MultiKeyBatch />
          </div>
        )}

      </div>
    </div>
  )
}
