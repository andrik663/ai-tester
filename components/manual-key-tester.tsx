"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import useSWR from "swr"
import type { ManualTestResult } from "@/app/api/manual-test/route"
import type { LogEntry } from "@/app/api/test-key/route"
import ProviderBatchTest from "@/components/provider-batch-test"
import ImageTester from "@/components/image-tester"
import VideoTester from "@/components/video-tester"
import WorkingKeysPanel from "@/components/working-keys-panel"
import { loadWorkingKeys } from "@/lib/working-keys-store"
import MultiKeyBatch from "@/components/multi-key-batch"
import { getImageCapabilities, getVideoCapabilities, IMAGE_ASPECT_RATIOS } from "@/lib/provider-capabilities"
import { copyToClipboard } from "@/lib/clipboard"
import { explainApiError } from "@/lib/explain-api-error"
import KeyInfoPanel from "@/components/key-info-panel"
import ProviderInfoPanel from "@/components/provider-info-panel"
import HistoryPanel from "@/components/history-panel"
import CollectionsPanel from "@/components/collections-panel"
import EnvSwitcher from "@/components/env-switcher"
import ModelScreenerPanel from "@/components/model-screener-panel"
import { pushHistory, type HistoryEntry } from "@/lib/history"
import { getActiveEnvironment, interpolate, type Environment } from "@/lib/environments"
import type { SavedRequest } from "@/lib/collections"

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

// ── Auto-detect provider from key prefix ─────────────────────────────────────
// Returns a preset id string when the key format matches a known provider.
// Ordered most-specific → least-specific to avoid false positives.
function detectProviderFromKey(key: string): string | null {
  if (!key || key.trim().length < 4) return null
  const k = key.trim()

  // ── Exact / unmistakable prefixes ────────────────────────────────────────
  if (k.startsWith("sk-ant-api"))         return "anthropic"   // Claude (Anthropic) — api key
  if (k.startsWith("sk-ant-"))            return "anthropic"   // Claude (Anthropic) — service key
  if (k.startsWith("AIzaSy"))             return "google"      // Gemini (Google AI Studio)
  if (k.startsWith("AIza"))              return "google"       // Google — older format
  if (k.startsWith("gsk_"))              return "groq"         // Groq
  if (k.startsWith("hf_"))              return "huggingface"   // HuggingFace
  if (k.startsWith("xai-"))             return "xai"           // Grok (xAI)
  if (k.startsWith("pplx-"))            return "perplexity"    // Perplexity
  if (k.startsWith("or-v1-"))           return "openrouter"    // OpenRouter (new format)
  if (k.startsWith("or-"))              return "openrouter"    // OpenRouter
  if (k.startsWith("fw-"))              return "fireworks"     // Fireworks AI
  if (k.startsWith("nvapi-"))           return "nvidia"        // NVIDIA NIM
  if (k.startsWith("dk-"))             return "dahono"         // Dahono Labs Gateway
  if (k.startsWith("dc-"))             return "dahono"         // Dahono Labs Gateway (alt)
  if (k.startsWith("r8_"))             return "replicate"      // Replicate
  if (k.startsWith("up_"))             return "upstage"        // Upstage Solar
  if (k.startsWith("sn-"))             return "sambanova"      // SambaNova
  if (k.startsWith("csk-"))            return "cerebras"       // Cerebras (some keys)
  if (k.startsWith("cbrss_"))          return "cerebras"       // Cerebras (new format)
  if (k.startsWith("hyp_"))            return "hyperbolic"     // Hyperbolic
  if (k.startsWith("J2-") || k.startsWith("j2-")) return "ai21"  // AI21 Labs (Jurassic prefix)
  if (k.startsWith("msauth_"))         return "mistral"        // Mistral (some enterprise keys)
  if (k.startsWith("lp_"))             return "lepton"         // LeptonAI
  if (k.startsWith("lmn_") || k.startsWith("lmni_")) return "lamini" // Lamini AI
  if (k.startsWith("di_"))             return "deepinfra"      // Deep Infra
  if (k.startsWith("esecret_"))        return "anyscale"       // Anyscale (old)
  if (k.startsWith("esec_"))           return "anyscale"       // Anyscale
  if (k.startsWith("neets-"))          return "neets"          // Neets AI

  // ── OpenAI — project keys (most specific first) ───────────────────────────
  if (k.startsWith("sk-proj-"))         return "openai"        // OpenAI project key
  if (k.startsWith("sk-svcacct-"))      return "openai"        // OpenAI service account
  if (k.startsWith("sk-None-"))         return "openai"        // OpenAI legacy

  // ── sk- ambiguous: OpenAI vs DeepSeek vs Together vs others ──────────────
  // DeepSeek keys are typically 35–40 chars; OpenAI legacy sk- are 51 chars.
  // Together AI keys are also sk- but exactly 64 hex chars.
  if (k.startsWith("sk-") && !k.startsWith("sk_")) {
    if (k.length >= 60) return "together"     // Together AI — long hex key
    if (k.length >= 45) return "openai"       // OpenAI legacy
    if (k.length >= 32) return "deepseek"     // DeepSeek
    return "openai"                           // fallback
  }

  // ── Non sk- generic bearer tokens — no reliable pattern, skip ─────────────
  // Providers using opaque UUIDs / random tokens: Cohere, Mistral (non-msauth),
  // MiniMax, Zhipu, Qwen, Moonshot, Baidu, Yi, Stepfun, Hunyuan, Cloudflare,
  // Azure, Writer, BFL, Bytedance, Recraft, Ideogram, Luma, IBM, Amazon, Novita,
  // Inception, DeepInfra (non-di_ prefix), SambaNova (non-sn-), Cerebras (non-csk-)
  return null
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
  // ── Tier 1: Major providers ─────────────────�����─────────────────────────────
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
  // ── Meta AI (llama.com) ───────────────────────────────────────────────────
  {
    id: "meta",
    name: "Meta AI",
    country: "US",
    endpoint: "https://api.llama.com/compat/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "Llama-4-Scout-17B-16E-Instruct",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    models: [
      { id: "Llama-4-Maverick-17B-128E-Instruct-FP8", label: "Llama 4 Maverick 17B FP8", tag: "flagship", ctx: "1M ctx",   in: "$0.27/Mt",  out: "$0.85/Mt",  cache: "" },
      { id: "Llama-4-Scout-17B-16E-Instruct",          label: "Llama 4 Scout 17B",        tag: "fast",     ctx: "131K ctx", in: "$0.18/Mt",  out: "$0.59/Mt",  cache: "" },
      { id: "Llama-3.3-70B-Instruct",                  label: "Llama 3.3 70B",            tag: "stable",   ctx: "131K ctx", in: "$0.20/Mt",  out: "$0.60/Mt",  cache: "" },
      { id: "Llama-3.1-70B-Instruct",                  label: "Llama 3.1 70B",            tag: "stable",   ctx: "131K ctx", in: "$0.20/Mt",  out: "$0.60/Mt",  cache: "" },
      { id: "Llama-3.1-8B-Instruct",                   label: "Llama 3.1 8B",             tag: "mini",     ctx: "131K ctx", in: "$0.02/Mt",  out: "$0.05/Mt",  cache: "" },
    ],
    docsUrl: "https://llama.developer.meta.com/docs/overview",
    createKeyUrl: "https://llama.developer.meta.com/",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  },
  // ── Meta / Llama providers via 3rd-party ────���─────────────────────────────
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
      // ── Kimi ────�������───────────────────���────────────────────────────────────
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
      // ── OpenAI OSS ──────────────────────────────────────────��────────────
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
  // ── OpenRouter Providers (from OpenRouter API) ───────────────────────────
  {
    id: "aion-labs",
    name: "Aion Labs",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "aion-labs/aion-2.0", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/aion-labs",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  },
  {
    id: "allenai",
    name: "Allen AI",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "allenai/olmo-3-32b-think", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/allenai",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  },
  {
    id: "anthracite-org",
    name: "Anthracite",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "anthracite-org/magnum-v4-72b", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/anthracite-org",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-gray-300 bg-gray-300/10 border-gray-300/20",
  },
  {
    id: "arcee-ai",
    name: "Arcee AI",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "arcee-ai/trinity-large-thinking", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/arcee-ai",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  },

  {
    id: "cognitivecomputations",
    name: "Cognitive Computations",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "cognitivecomputations/dolphin-mistral-24b-venice-edition", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/cognitivecomputations",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  },
  {
    id: "deepcogito",
    name: "Deep Cogito",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "deepcogito/cogito-v2.1-671b", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/deepcogito",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-teal-400 bg-teal-400/10 border-teal-400/20",
  },
  {
    id: "gryphe",
    name: "Gryphe",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "gryphe/mythomax-l2-13b", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/gryphe",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-red-500 bg-red-500/10 border-red-500/20",
  },

  {
    id: "inclusionai",
    name: "Inclusion AI",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "inclusionai/ring-2.6-1t", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/inclusionai",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  },
  {
    id: "inflection",
    name: "Inflection AI",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "inflection/inflection-3-productivity", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/inflection",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  },
  {
    id: "kwaipilot",
    name: "Kwaipilot",
    country: "CN",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "kwaipilot/kat-coder-pro-v2", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/kwaipilot",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-red-400 bg-red-400/10 border-red-400/20",
  },
  {
    id: "liquid",
    name: "Liquid AI",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "liquid/lfm-2-24b-a2b", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/liquid",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-sky-400 bg-sky-400/10 border-sky-400/20",
  },
  {
    id: "mancer",
    name: "Mancer",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "mancer/weaver", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/mancer",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-pink-500 bg-pink-500/10 border-pink-500/20",
  },

  {
    id: "microsoft",
    name: "Microsoft Phi",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "microsoft/phi-4-mini-instruct", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/microsoft",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  },


  {
    id: "morph",
    name: "Morph",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "morph/morph-v3-large", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/morph",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  },
  {
    id: "nex-agi",
    name: "Nex AGI",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "nex-agi/nex-n2-pro", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/nex-agi",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  },
  {
    id: "nousresearch",
    name: "Nous Research",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "nousresearch/hermes-4-70b", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/nousresearch",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
  },
  {
    id: "perceptron",
    name: "Perceptron",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "perceptron/perceptron-mk1", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/perceptron",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  },
  {
    id: "poolside",
    name: "Poolside AI",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "poolside/laguna-xs.2", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/poolside",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-cyan-300 bg-cyan-300/10 border-cyan-300/20",
  },
  {
    id: "rekaai",
    name: "Reka AI",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "rekaai/reka-edge", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/rekaai",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-violet-500 bg-violet-500/10 border-violet-500/20",
  },
  {
    id: "relace",
    name: "Relace",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "relace/relace-search", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/relace",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20",
  },
  {
    id: "sao10k",
    name: "Sao10k",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "sao10k/l3.1-70b-hanami-x1", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/sao10k",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-sky-300 bg-sky-300/10 border-sky-300/20",
  },
  {
    id: "switchpoint",
    name: "Switchpoint",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "switchpoint/router", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/switchpoint",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-lime-400 bg-lime-400/10 border-lime-400/20",
  },

  {
    id: "thedrummer",
    name: "The Drummer",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "thedrummer/cydonia-24b-v4.1", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/thedrummer",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  {
    id: "undi95",
    name: "Undi95",
    country: "US",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "undi95/remm-slerp-l2-13b", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/undi95",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-teal-300 bg-teal-300/10 border-teal-300/20",
  },

  {
    id: "xiaomi",
    name: "Xiaomi MiMo",
    country: "CN",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    method: "POST" as const,
    headers: { "Authorization": "Bearer {{API_KEY}}", "Content-Type": "application/json", "HTTP-Referer": "https://openrouter.ai", "X-Title": "AI Tester" },
    bodyTemplate: JSON.stringify({ model: "xiaomi/mimo-v2.5-pro", messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2),
    docsUrl: "https://openrouter.ai/xiaomi",
    createKeyUrl: "https://openrouter.ai/keys",
    color: "text-orange-500 bg-orange-500/10 border-orange-500/20",
  },

  // ── Marketku Router ───────────────────────────────────────────────────────
  {
    id: "marketku",
    name: "Marketku Router",
    country: "ID",
    endpoint: "https://router.marketku.id/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "mk/auto",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://router.marketku.id",
    createKeyUrl: "https://router.marketku.id",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  },

  // ── OpenModel ─────────────────────────────────────────────────────────────
  {
    id: "openmodel",
    name: "OpenModel",
    country: "US",
    endpoint: "https://api.openmodel.app/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "deepseek-v4-flash",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    docsUrl: "https://docs.openmodel.ai",
    createKeyUrl: "https://openmodel.ai",
    color: "text-blue-300 bg-blue-300/10 border-blue-300/30",
  },

  // ── Miuclaw Gateway ───────────────────────────────────────────────────────
  // Self-hosted gateway at miuclaw.my.id — routes to all synced working keys.
  // Use EXPORT_API_TOKEN as the API key. Sync keys first via Keys → Export API.
  {
    id: "miuclaw",
    name: "Miuclaw Gateway",
    country: "ID",
    endpoint: "https://www.miuclaw.my.id/api/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "miuclaw/auto",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    models: [
      { id: "miuclaw/auto", label: "Auto (fastest key)", tag: "Gateway", ctx: "varies", in: "varies", out: "varies", cache: "" },
    ],
    docsUrl: "/api/v1/models",
    createKeyUrl: "/keys",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  },

  // ── Avian ─────────────────────────────────────────────────────────────────
  {
    id: "avian",
    name: "Avian",
    country: "EU",
    endpoint: "https://api.avian.io/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "moonshotai/kimi-k2.5",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    models: [
      { id: "deepseek/deepseek-v4-flash",   label: "DeepSeek V4 Flash",  tag: "DeepSeek",   ctx: "1M ctx",   in: "$0.105/Mt", out: "$0.21/Mt",  cache: "" },
      { id: "deepseek/deepseek-v4-pro",     label: "DeepSeek V4 Pro",    tag: "DeepSeek",   ctx: "1M ctx",   in: "$1.305/Mt", out: "$2.61/Mt",  cache: "" },
      { id: "deepseek/deepseek-v3.2",       label: "DeepSeek V3.2",      tag: "DeepSeek",   ctx: "163K ctx", in: "$0.23/Mt",  out: "$0.33/Mt",  cache: "" },
      { id: "minimax/minimax-m2.5",         label: "MiniMax M2.5",       tag: "MiniMax",    ctx: "196K ctx", in: "$0.27/Mt",  out: "$1.08/Mt",  cache: "" },
      { id: "z-ai/glm-5",                   label: "GLM-5",              tag: "Z-AI",       ctx: "200K ctx", in: "$0.95/Mt",  out: "$2.55/Mt",  cache: "" },
      { id: "z-ai/glm-5.1",                 label: "GLM-5.1",            tag: "Z-AI",       ctx: "202K ctx", in: "$1.00/Mt",  out: "$3.20/Mt",  cache: "" },
      { id: "moonshotai/kimi-k2.5",         label: "Kimi K2.5",          tag: "MoonshotAI", ctx: "262K ctx", in: "$0.45/Mt",  out: "$2.20/Mt",  cache: "" },
      { id: "moonshotai/kimi-k2.6",         label: "Kimi K2.6",          tag: "MoonshotAI", ctx: "262K ctx", in: "$0.95/Mt",  out: "$4.00/Mt",  cache: "" },
    ],
    docsUrl: "https://docs.avian.io",
    createKeyUrl: "https://avian.io",
    color: "text-teal-400 bg-teal-400/10 border-teal-400/30",
  },

  // ── Parasail ──────────────────────────────────────────────────────────────
  {
    id: "parasail",
    name: "Parasail",
    country: "US",
    endpoint: "https://api.parasail.io/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "meta-llama/Meta-Llama-3.3-70B-Instruct",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    models: [
      { id: "meta-llama/Meta-Llama-3.3-70B-Instruct",  label: "Llama 3.3 70B",         tag: "Meta",      ctx: "128K ctx", in: "",         out: "",          cache: "" },
      { id: "meta-llama/Meta-Llama-3.1-405B-Instruct", label: "Llama 3.1 405B",         tag: "Meta",      ctx: "128K ctx", in: "",         out: "",          cache: "" },
      { id: "meta-llama/Meta-Llama-3.1-70B-Instruct",  label: "Llama 3.1 70B",          tag: "Meta",      ctx: "128K ctx", in: "",         out: "",          cache: "" },
      { id: "meta-llama/Meta-Llama-3.1-8B-Instruct",   label: "Llama 3.1 8B",           tag: "Meta",      ctx: "128K ctx", in: "",         out: "",          cache: "" },
      { id: "Qwen/Qwen2.5-72B-Instruct",               label: "Qwen2.5 72B",            tag: "Qwen",      ctx: "128K ctx", in: "",         out: "",          cache: "" },
      { id: "deepseek-ai/DeepSeek-R1",                 label: "DeepSeek R1",            tag: "DeepSeek",  ctx: "128K ctx", in: "",         out: "",          cache: "" },
      { id: "deepseek-ai/DeepSeek-V3",                 label: "DeepSeek V3",            tag: "DeepSeek",  ctx: "128K ctx", in: "",         out: "",          cache: "" },
      { id: "mistralai/Mistral-7B-Instruct-v0.3",      label: "Mistral 7B v0.3",        tag: "Mistral",   ctx: "32K ctx",  in: "",         out: "",          cache: "" },
      { id: "google/gemma-3-27b-it",                   label: "Gemma 3 27B",            tag: "Google",    ctx: "128K ctx", in: "",         out: "",          cache: "" },
    ],
    docsUrl: "https://docs.parasail.io",
    createKeyUrl: "https://parasail.io",
    color: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  },

  // ── Telnyx AI ─────────────────────────────────────────────────────────────
  {
    id: "telnyx",
    name: "Telnyx AI",
    country: "US",
    endpoint: "https://api.telnyx.com/v2/ai/openai/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "moonshotai/Kimi-K2.6",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    models: [
      { id: "moonshotai/Kimi-K2.6",                    label: "Kimi K2.6",              tag: "MoonshotAI", ctx: "262K ctx", in: "",         out: "",          cache: "" },
      { id: "moonshotai/Kimi-K2.5",                    label: "Kimi K2.5",              tag: "MoonshotAI", ctx: "262K ctx", in: "",         out: "",          cache: "" },
      { id: "zai-org/GLM-5.1-FP8",                     label: "GLM-5.1 FP8",            tag: "Z-AI",       ctx: "200K ctx", in: "",         out: "",          cache: "" },
      { id: "MiniMaxAI/MiniMax-M2.7",                  label: "MiniMax M2.7",           tag: "MiniMax",    ctx: "196K ctx", in: "",         out: "",          cache: "" },
      { id: "MiniMaxAI/MiniMax-M2.5",                  label: "MiniMax M2.5",           tag: "MiniMax",    ctx: "196K ctx", in: "",         out: "",          cache: "" },
      { id: "meta-llama/Meta-Llama-3.1-70B-Instruct",  label: "Llama 3.1 70B",          tag: "Meta",       ctx: "128K ctx", in: "",         out: "",          cache: "" },
      { id: "meta-llama/Meta-Llama-3.1-8B-Instruct",   label: "Llama 3.1 8B",           tag: "Meta",       ctx: "128K ctx", in: "",         out: "",          cache: "" },
    ],
    docsUrl: "https://developers.telnyx.com/docs/inference",
    createKeyUrl: "https://portal.telnyx.com/#/app/api-keys",
    color: "text-indigo-400 bg-indigo-400/10 border-indigo-400/30",
  },

  // ── Targon (Bittensor) ────────────────────────────────────────────────────
  {
    id: "targon",
    name: "Targon (Bittensor)",
    country: "US",
    endpoint: "https://api.targon.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "NousResearch/Hermes-3-Llama-3.1-70B",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    models: [
      { id: "NousResearch/Hermes-3-Llama-3.1-70B",    label: "Hermes 3 Llama 3.1 70B", tag: "NousResearch", ctx: "128K ctx", in: "",        out: "",          cache: "" },
      { id: "NousResearch/Meta-Llama-3.1-8B-Instruct", label: "Llama 3.1 8B Instruct",  tag: "NousResearch", ctx: "128K ctx", in: "",        out: "",          cache: "" },
      { id: "meta-llama/Llama-3.3-70B-Instruct",       label: "Llama 3.3 70B",          tag: "Meta",         ctx: "128K ctx", in: "",        out: "",          cache: "" },
      { id: "deepseek-ai/DeepSeek-R1",                 label: "DeepSeek R1",            tag: "DeepSeek",     ctx: "128K ctx", in: "",        out: "",          cache: "" },
      { id: "Qwen/Qwen2.5-72B-Instruct",               label: "Qwen2.5 72B",            tag: "Qwen",         ctx: "128K ctx", in: "",        out: "",          cache: "" },
      { id: "mistralai/Mistral-7B-Instruct-v0.3",      label: "Mistral 7B v0.3",        tag: "Mistral",      ctx: "32K ctx",  in: "",        out: "",          cache: "" },
    ],
    docsUrl: "https://docs.targon.com",
    createKeyUrl: "https://app.targon.com",
    color: "text-violet-400 bg-violet-400/10 border-violet-400/30",
  },

  // ── Sakana AI (Fugu) ──────────────────────────────────────────────────────
  {
    id: "sakana",
    name: "Sakana AI (Fugu)",
    country: "JP",
    endpoint: "https://api.fugu.sakana.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer {{API_KEY}}",
      "Content-Type": "application/json",
    },
    bodyTemplate: JSON.stringify({
      model: "fugu-20260615",
      max_tokens: 1024,
      messages: [{ role: "user", content: "{{PROMPT}}" }],
    }, null, 2),
    models: [
      { id: "fugu-20260615",       label: "Fugu (Balanced)",    tag: "Multi-agent", ctx: "128K ctx", in: "",       out: "",        cache: "" },
      { id: "fugu-ultra-20260615", label: "Fugu Ultra (Max)",   tag: "Multi-agent", ctx: "272K ctx", in: "$5/Mt",  out: "$30/Mt",  cache: "" },
    ],
    docsUrl: "https://api.fugu.sakana.ai/docs",
    createKeyUrl: "https://sakana.ai/fugu/",
    color: "text-pink-400 bg-pink-400/10 border-pink-400/30",
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

// ── Provider logos ────────────────────────────────────────────────────────────
// Uses Google's faviconV2 service (returns 64px PNG, no CORS issues).
// Falls back to DuckDuckGo favicon, then branded initials badge.
//
// Domain map: provider id → website domain used for favicon lookup.
const PROVIDER_DOMAIN: Record<string, string> = {
  // Frontier
  anthropic:      "anthropic.com",
  openai:         "openai.com",
  google:         "google.com",
  xai:            "x.ai",
  deepseek:       "deepseek.com",
  meta:           "meta.ai",
  // Chinese providers
  qwen:           "alibabacloud.com",
  zhipu:          "zhipuai.cn",
  minimax:        "minimax.io",
  moonshot:       "moonshot.ai",
  moonshotai:     "moonshot.ai",
  baidu:          "cloud.baidu.com",
  hunyuan:        "cloud.tencent.com",
  stepfun:        "stepfun.com",
  bytedance:      "volcengine.com",
  xiaomi:         "mi.com",
  "z-ai":         "zhipuai.cn",
  "nex-agi":      "nexagi.com",
  kwaipilot:      "kwai.com",
  siliconflow:    "siliconflow.cn",
  seed:           "seed.sg",
  // American providers
  groq:           "groq.com",
  cerebras:       "cerebras.ai",
  fireworks:      "fireworks.ai",
  together:       "together.xyz",
  sambanova:      "sambanova.ai",
  nvidia:         "nvidia.com",
  perplexity:     "perplexity.ai",
  cohere:         "cohere.com",
  ai21:           "ai21.com",
  replicate:      "replicate.com",
  huggingface:    "huggingface.co",
  cloudflare:     "cloudflare.com",
  deepinfra:      "deepinfra.com",
  novita:         "novita.ai",
  upstage:        "upstage.ai",
  inception:      "inceptionlabs.ai",
  ibm:            "ibm.com",
  anyscale:       "anyscale.com",
  recraft:        "recraft.ai",
  luma:           "lumalabs.ai",
  writer:         "writer.com",
  hyperbolic:     "hyperbolic.xyz",
  lepton:         "lepton.ai",
  bfl:            "blackforestlabs.ai",
  "black-forest-labs": "blackforestlabs.ai",
  ideogram:       "ideogram.ai",
  amazon:         "aws.amazon.com",
  "amazon-bedrock": "aws.amazon.com",
  azure:          "azure.microsoft.com",
  "google-ai-studio": "ai.google.dev",
  "google-vertex":    "cloud.google.com",
  openrouter:     "openrouter.ai",
  inflection:     "inflection.ai",
  "arcee-ai":     "arcee.ai",
  mancer:         "mancer.tech",
  liquid:         "liquid.ai",
  morph:          "morphllm.com",
  poolside:       "poolside.ai",
  relace:         "relace.ai",
  venice:         "venice.ai",
  baseten:        "baseten.co",
  wandb:          "wandb.ai",
  featherless:    "featherless.ai",
  friendli:       "friendli.ai",
  nebius:         "nebius.com",
  crusoe:         "crusoe.ai",
  clarifai:       "clarifai.com",
  digitalocean:   "digitalocean.com",
  gmicloud:       "gmicloud.ai",
  chutes:         "chutes.ai",
  phala:          "phala.network",
  switchpoint:    "switchpoint.ai",
  inceptron:      "inceptron.se",
  infermatic:     "infermatic.ai",
  perceptron:     "perceptron.ai",
  akashml:        "akash.network",
  "atlas-cloud":  "atlascloud.ai",
  "io-net":       "io.net",
  nousresearch:   "nousresearch.com",
  reka:           "reka.ai",
  rekaai:         "reka.ai",
  "aion-labs":    "aionlabs.net",
  mistral:        "mistral.ai",
  marketku:       "router.marketku.id",
  openmodel:      "openmodel.ai",
  avian:          "avian.io",
  parasail:       "parasail.io",
  telnyx:         "telnyx.com",
  targon:         "targon.com",
  sakana:         "sakana.ai",
  miuclaw:        "www.miuclaw.my.id",
}

/** Google faviconV2 — returns 64 px PNG, works cross-origin, no auth needed. */
function getLogoUrl(domain: string): string {
  return `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`
}

/** DuckDuckGo favicon fallback */
function getDDGLogoUrl(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`
}

/** Deterministic brand color from name — used for initials badge */
function providerColor(name: string): string {
  const colors = [
    "#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316",
    "#eab308","#22c55e","#14b8a6","#0ea5e9","#3b82f6",
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return colors[Math.abs(h) % colors.length]
}

function ProviderLogo({
  providerId,
  providerName = "",
  className = "w-4 h-4",
}: {
  providerId: string
  providerName?: string
  className?: string
}) {
  const [stage, setStage] = useState<"primary" | "fallback" | "initials">("primary")
  const domain = PROVIDER_DOMAIN[providerId]
  const displayName = providerName || providerId
  const initials = displayName.replace(/[^A-Za-z0-9]/g, " ").trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?"
  const bg = providerId === "dahono" ? "#8b5cf6" : providerColor(displayName)

  if (!domain || stage === "initials") {
    return (
      <span
        aria-hidden
        className={`${className} flex-shrink-0 rounded-lg flex items-center justify-center text-white font-bold leading-none`}
        style={{ background: bg, fontSize: "40%", letterSpacing: "-0.02em" }}
      >
        {initials}
      </span>
    )
  }

  const src = stage === "primary" ? getLogoUrl(domain) : getDDGLogoUrl(domain)

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      className={`${className} object-contain flex-shrink-0 rounded-md`}
      onError={() => setStage(s => s === "primary" ? "fallback" : "initials")}
    />
  )
}

// ── Icons ����────────────────────������─������───────────────────────────────────────────

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

// ── Log level styles ──���────────────────��─��───────────────────��────────────────

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
  const [batchView, setBatchView] = useState<"config" | "run">("run")
  const [copiedCurl, setCopiedCurl] = useState(false)
  const [copiedCurlFull, setCopiedCurlFull] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)
  const [selectedDahonoModel, setSelectedDahonoModel] = useState("dahono/deepseek-v4-flash")
  const [configOpen, setConfigOpen] = useState(false)
  const [sidebarSearch, setSidebarSearch] = useState("")
  // ── New feature state ────────────────────────────────────────────────────────
  // System prompt
  const [systemPrompt, setSystemPrompt]           = useState("")
  const [showSystemPrompt, setShowSystemPrompt]   = useState(false)
  // Streaming
  const [streamingText, setStreamingText]         = useState("")
  const [isStreaming, setIsStreaming]             = useState(false)
  const [ttftMs, setTtftMs]                       = useState<number | null>(null)
  const [useStreaming, setUseStreaming]            = useState(true)
  // Active environment
  const [activeEnv, setActiveEnv]                 = useState<Environment | null>(null)
  // Notification permission
  const [notifPerm, setNotifPerm]                 = useState<NotificationPermission>("default")
  useEffect(() => {
    if (typeof Notification !== "undefined") setNotifPerm(Notification.permission)
    const env = getActiveEnvironment()
    setActiveEnv(env)
  }, [])
  // Tab state
  const [activeTab, setActiveTab] = useState<"unified" | "working-keys" | "multi-batch" | "auto-detect" | "info" | "history" | "collections" | "environments" | "screener" | "saved">("unified")
  // Onboarding banner — dismissed in localStorage
  // Start as false (matches SSR), sync from localStorage after mount to avoid hydration mismatch
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(false)
  useEffect(() => {
    setOnboardingDismissed(localStorage.getItem("ai_tester_onboarding_dismissed") === "1")
  }, [])
  function dismissOnboarding() {
    localStorage.setItem("ai_tester_onboarding_dismissed", "1")
    setOnboardingDismissed(true)
  }

  // Remember API key per provider — stored obfuscated in localStorage (btoa/atob)
  // Start as false (matches SSR), sync from localStorage after mount
  const [rememberKey, setRememberKey] = useState<boolean>(false)
  useEffect(() => {
    setRememberKey(localStorage.getItem("ai_tester_remember_pref") === "1")
  }, [])
  // Load saved key when provider changes or remember preference loads
  useEffect(() => {
    if (!rememberKey) return
    const saved = localStorage.getItem(`ai_tester_key_${selectedPreset.id}`)
    if (saved) {
      try {
        const decoded = atob(saved)
        handleApiKeyChange(decoded)
      } catch { /* ignore malformed */ }
    } else {
      // Clear key when switching to a provider with no saved key
      handleApiKeyChange("")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPreset.id, rememberKey])

  function handleRememberToggle(checked: boolean) {
    setRememberKey(checked)
    localStorage.setItem("ai_tester_remember_pref", checked ? "1" : "0")
    if (checked && apiKey) {
      localStorage.setItem(`ai_tester_key_${selectedPreset.id}`, btoa(apiKey))
    } else if (!checked) {
      // Clear all saved keys
      Object.keys(localStorage)
        .filter((k) => k.startsWith("ai_tester_key_"))
        .forEach((k) => localStorage.removeItem(k))
    }
  }

  // Persist key whenever it changes and rememberKey is on
  useEffect(() => {
    if (!rememberKey || !apiKey) return
    localStorage.setItem(`ai_tester_key_${selectedPreset.id}`, btoa(apiKey))
  }, [apiKey, rememberKey, selectedPreset.id])
  // Sub-tab inside "unified"
  const [unifiedSubTab, setUnifiedSubTab] = useState<"chat" | "vision" | "ocr" | "image-gen" | "video-gen" | "compare">("chat")
  
  // Per-tab model selectors — each tab remembers its own model choice
  const [chatModel, setChatModel] = useState<string>("")
  const [visionModel, setVisionModel] = useState<string>("")
  const [imageGenModel, setImageGenModel] = useState<string>("")
  const [videoGenModel, setVideoGenModel] = useState<string>("")

  // Tracks saves from WorkingKeysPanel — bump to reload working models
  const [workingKeysTick, setWorkingKeysTick] = useState(0)

  // All saved working-key records for the currently selected provider.
  // Declared here (before any JSX) so every reference below is in-scope.
  const [workingModels, setWorkingModels] = useState<Array<{
    modelId: string
    apiKey: string
    latencyMs: number
  }>>([])

  // Reload working models whenever the provider or workingKeysTick changes,
  // and auto-fill chatModel + apiKey from the first saved record.
  useEffect(() => {
    if (selectedPreset.id === "miuclaw") return // handled below
    const records = loadWorkingKeys().filter((r) => r.providerId === selectedPreset.id)
    const seen = new Set<string>()
    const deduped = records.filter((r) => {
      const k = `${r.apiKey}::${r.modelId}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    setWorkingModels(deduped.map((r) => ({
      modelId: r.modelId,
      apiKey: r.apiKey,
      latencyMs: r.latencyMs,
    })))
    if (deduped.length > 0) {
      setChatModel((prev) => prev || deduped[0].modelId)
      setApiKey((prev) => prev.trim() ? prev : deduped[0].apiKey)
    } else {
      setChatModel((prev) => prev || (selectedPreset.models?.[0]?.id ?? ""))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPreset.id, workingKeysTick])

  // ── Miuclaw Gateway: fetch available models from /api/v1/models ─────────────
  // No auth header required — gateway uses server-side EXPORT_API_TOKEN.
  // We track the last providerId we cleared for, so we only clear on actual
  // provider switch — not on workingKeysTick increments (post-sync refreshes).
  const miuclawLastProvider = useRef<string>("")
  useEffect(() => {
    if (selectedPreset.id !== "miuclaw") return

    // Only clear stale models when switching TO miuclaw from a different provider
    if (miuclawLastProvider.current !== "miuclaw") {
      miuclawLastProvider.current = "miuclaw"
      setWorkingModels([])
      setChatModel("")
    }

    let cancelled = false
    const fetchModels = async () => {
      try {
        const res = await fetch("/api/v1/models")
        if (!res.ok || cancelled) return
        const data = await res.json() as { data?: Array<{ id: string; owned_by?: string }> }
        if (cancelled) return
        const models = (data.data ?? []).filter((m) => m.id !== "miuclaw/auto")
        if (models.length === 0) return // no keys synced yet — leave empty, show hint
        setWorkingModels(models.map((m) => ({ modelId: m.id, apiKey: "", latencyMs: -1 })))
        setChatModel((prev) => prev || models[0].id) // keep existing selection if any
      } catch {
        // Network error — leave empty
      }
    }

    fetchModels()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPreset.id, workingKeysTick])

  // Get the current model based on active sub-tab
  const getCurrentModel = () => {
    switch (unifiedSubTab) {
      case "chat":       return chatModel
      case "vision":     return visionModel
      case "image-gen":  return imageGenModel
      case "video-gen":  return videoGenModel
      default:           return ""
    }
  }
  
  const setCurrentModel = (model: string) => {
    switch (unifiedSubTab) {
      case "chat":       setChatModel(model); break
      case "vision":     setVisionModel(model); break
      case "image-gen":  setImageGenModel(model); break
      case "video-gen":  setVideoGenModel(model); break
    }
  }
  
  // Set default model when provider changes
  // Skip for Miuclaw — it fetches real model list from /api/v1/models asynchronously
  useEffect(() => {
    if (selectedPreset.id === "miuclaw") return
    if (selectedPreset.models && selectedPreset.models.length > 0) {
      const defaultModel = selectedPreset.models[0].id
      setChatModel(defaultModel)
      setVisionModel(defaultModel)
      setImageGenModel(defaultModel)
      setVideoGenModel(defaultModel)
    }
  }, [selectedPreset.id])
  // Compare mode state
  const [comparePrompt, setComparePrompt] = useState("Say hello in one sentence.")
  const [compareSlots, setCompareSlots] = useState<Array<{ providerId: string; apiKey: string }>>([
    { providerId: "anthropic", apiKey: "" },
    { providerId: "openai",    apiKey: "" },
    { providerId: "google",    apiKey: "" },
  ])
  const [compareResults, setCompareResults] = useState<Array<{ result: ManualTestResult | null; loading: boolean }>>([
    { result: null, loading: false },
    { result: null, loading: false },
    { result: null, loading: false },
  ])
  async function runCompare() {
    setCompareResults(compareSlots.map(() => ({ result: null, loading: true })))
    const requests = compareSlots.map(async (slot, i) => {
      const preset = PRESETS.find((p) => p.id === slot.providerId)
      if (!preset || !slot.apiKey.trim()) {
        setCompareResults((prev) => {
          const next = [...prev]
          next[i] = { result: null, loading: false }
          return next
        })
        return
      }
      try {
        const res = await fetch("/api/manual-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: preset.id,
            apiKey: slot.apiKey.trim(),
            endpoint: preset.endpoint,
            method: preset.method,
            headers: preset.headers,
            prompt: comparePrompt,
          }),
        })
        const data: ManualTestResult = await res.json()
        setCompareResults((prev) => {
          const next = [...prev]
          next[i] = { result: data, loading: false }
          return next
        })
      } catch (err) {
        setCompareResults((prev) => {
          const next = [...prev]
          next[i] = {
            result: { ok: false, status: 0, statusText: err instanceof Error ? err.message : "Request failed", responseBody: "", logs: [], curlCommand: "", curlFull: "", requestBodySent: "", durationMs: 0 } as ManualTestResult,
            loading: false,
          }
          return next
        })
      }
    })
    await Promise.all(requests)
  }
  // Auto-detect tab state
  const [detectInput, setDetectInput]   = useState("")
  const [detectResult, setDetectResult] = useState<{ providerId: string | null; providerName: string | null; confidence: "high" | "low" | "unknown" | "none"; prefix: string; reason: string } | null>(null)

  // Increment to trigger a fresh KeyInfoPanel fetch (bumped after successful chat)
  const [keyInfoTick, setKeyInfoTick] = useState(0)
  // Last known response headers — passed to KeyInfoPanel for rate limit data
  const [lastResponseHeaders, setLastResponseHeaders] = useState<Record<string, string> | undefined>(undefined)
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

  // Debounce API key changes by 400ms — also auto-detects provider from key prefix
  const handleApiKeyChange = useCallback((val: string) => {
    setApiKey(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedApiKey(val)
      // Auto-detect: if the current preset is "custom" or the key prefix clearly matches a different provider, switch
      const detectedId = detectProviderFromKey(val)
      if (detectedId) {
        setSelectedPreset((current) => {
          if (current.id === detectedId) return current  // already correct
          // Only auto-switch when the user hasn't explicitly customized the endpoint
          const detected = PRESETS.find((p) => p.id === detectedId)
          if (detected) {
            // Apply full preset (endpoint, headers, body) — mirrors applyPreset but without setResult
            setEndpoint(detected.endpoint)
            setMethod(detected.method)
            setHeaderRows(Object.entries(detected.headers).map(([k, v], i) => ({ key: k, value: v, id: i })))
            setBodyTemplate(detected.bodyTemplate)
            const imgModels = getImageCapabilities(detected.id)
            if (imgModels.length > 0) setImageModel(imgModels[0].id)
            const { models: vidModels } = getVideoCapabilities(detected.id)
            if (vidModels.length > 0) setVideoModel(vidModels[0].id)
            return detected
          }
          return current
        })
      }
    }, 400)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Vision / OCR helpers ─���─���────────────────────────��─��─────────────────────

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
    // Reset chat model so the useEffect auto-populates from new provider's saved keys
    setChatModel("")
    // Reset image/video model to first supported for the new provider
    const imgModels = getImageCapabilities(preset.id)
    if (imgModels.length > 0) setImageModel(imgModels[0].id)
    const { models: vidModels } = getVideoCapabilities(preset.id)
    if (vidModels.length > 0) setVideoModel(vidModels[0].id)
  }

  async function runTest() {
    const isMiuclaw = selectedPreset.id === "miuclaw"
    if ((!isMiuclaw && !apiKey.trim()) || !prompt.trim() || loading || isStreaming) return

    const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    const userMsg: ChatMessage = { role: "user", content: prompt, ts }
    const currentPrompt = prompt
    // Build multi-turn history: all previous messages + new user message
    const previousMessages = chatHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

    setChatHistory((prev) => [...prev, userMsg])
    setPrompt("")
    setResult(null)
    setTtftMs(null)

    const headers: Record<string, string> = {}
    for (const row of headerRows) {
      if (row.key.trim()) {
        const val = activeEnv ? interpolate(row.value, activeEnv) : row.value
        headers[row.key.trim()] = val
      }
    }
    const resolvedBody = activeEnv && bodyTemplate ? interpolate(bodyTemplate, activeEnv) : (bodyTemplate || undefined)

    if (useStreaming) {
      // ── Streaming path ────────────────────────────────────────────────────
      setIsStreaming(true)
      setStreamingText("")

      let accumulated = ""
      let finalResult: ManualTestResult | null = null

      try {
        const res = await fetch("/api/manual-test/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: selectedPreset.id,
            apiKey: apiKey.trim(),
            endpoint,
            headers,
            messages: [...previousMessages, { role: "user", content: currentPrompt }],
            systemPrompt: systemPrompt.trim() || undefined,
            // Do NOT send rawBody for chat — let the route build the correct body
            // from messages + model. rawBody (which contains {{PROMPT}}) is only
            // for the single-shot Test tab.
            model: chatModel.trim() || undefined,
          }),
        })

        const reader = res.body?.getReader()
        if (!reader) throw new Error("No stream body")
        const dec = new TextDecoder()
        let buf = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split("\n")
          buf = lines.pop() ?? ""

          // SSE format:  "event: <name>\ndata: <json>\n\n"
          // Track the current event name across lines in this chunk.
          let currentEvent = "token"
          for (const rawLine of lines) {
            const line = rawLine.trim()
            if (!line) { currentEvent = "token"; continue } // blank line = event boundary reset

            // Parse event name line
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim()
              continue
            }

            if (!line.startsWith("data:")) continue
            const dataStr = line.slice(5).trim()
            if (!dataStr || dataStr === "[DONE]") continue

            try {
              const parsed = JSON.parse(dataStr) as Record<string, unknown>
              const evName = currentEvent

              if (evName === "token") {
                accumulated += (parsed.text as string) ?? ""
                setStreamingText(accumulated)
              } else if (evName === "ttft") {
                setTtftMs(parsed.ms as number)
              } else if (evName === "response_headers") {
                setLastResponseHeaders(parsed as Record<string, string>)
              } else if (evName === "done") {
                finalResult = {
                  ok: true,
                  status: 200,
                  statusText: "OK",
                  responseBody: accumulated,
                  chatReply: accumulated,
                  logs: [],
                  curlCommand: "",
                  curlFull: "",
                  requestBodySent: "",
                  durationMs: parsed.durationMs as number,
                  ttftMs: parsed.ttftMs as number | null,
                  tokenUsage: parsed.tokenUsage as ManualTestResult["tokenUsage"],
                  responseHeaders: parsed.responseHeaders as Record<string, string>,
                } as ManualTestResult & { ttftMs?: number | null }
                setResult(finalResult)
                if (finalResult.responseHeaders) setLastResponseHeaders(finalResult.responseHeaders)
                setKeyInfoTick((t) => t + 1)
              } else if (evName === "error") {
                const errContent = (parsed.body as string) || (parsed.message as string) || "Stream error"
                const errMsg: ChatMessage = { role: "assistant", content: `Error: ${errContent}`, ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }
                setChatHistory((prev) => [...prev, errMsg])
                reader.releaseLock()
                return
              }
            } catch { /* skip malformed SSE line */ }
          }
        }
        reader.releaseLock()

        const replyTs = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        const assistantMsg: ChatMessage = { role: "assistant", content: accumulated || "(empty response)", ts: replyTs }
        setChatHistory((prev) => [...prev, assistantMsg])
        setStreamingText("")

        // Push to history
        pushHistory({
          provider: selectedPreset.id,
          providerName: selectedPreset.name,
          model: getCurrentModel() || undefined,
          prompt: currentPrompt,
          reply: accumulated,
          ok: true,
          status: 200,
          durationMs: finalResult?.durationMs,
          ttftMs: (finalResult as (ManualTestResult & { ttftMs?: number | null }) | null)?.ttftMs,
          tokenUsage: finalResult?.tokenUsage,
          responseHeaders: finalResult?.responseHeaders,
        })

        // Browser notification for long responses
        if (Notification.permission === "granted" && document.hidden) {
          new Notification(`${selectedPreset.name} replied`, { body: accumulated.slice(0, 80) + "…", silent: true })
        }
      } catch (err) {
        const errMsg: ChatMessage = { role: "assistant", content: err instanceof Error ? err.message : "Streaming failed", ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }
        setChatHistory((prev) => [...prev, errMsg])
        setStreamingText("")
      } finally {
        setIsStreaming(false)
      }
    } else {
      // ── Non-streaming path ──────────────────────────���─────────────────────
      setLoading(true)
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
            body: resolvedBody,
            prompt: currentPrompt,
            messages: previousMessages,
            systemPrompt: systemPrompt.trim() || undefined,
            model: getCurrentModel() || undefined,
          }),
        })
        const data: ManualTestResult = await res.json()
        setResult(data)
        if (data.responseHeaders) setLastResponseHeaders(data.responseHeaders)
        if (data.ok) setKeyInfoTick((t) => t + 1)

        const reply = data.chatReply ?? (data.ok ? data.responseBody : null)
        const replyTs = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        if (reply) {
          const assistantMsg: ChatMessage = { role: "assistant", content: reply, ts: replyTs }
          setChatHistory((prev) => [...prev, assistantMsg])
        } else {
          const errMsg: ChatMessage = { role: "assistant", content: `Error: HTTP ${data.status} ${data.statusText}`, ts: replyTs }
          setChatHistory((prev) => [...prev, errMsg])
        }

        pushHistory({
          provider: selectedPreset.id,
          providerName: selectedPreset.name,
          model: getCurrentModel() || undefined,
          prompt: currentPrompt,
          reply: reply ?? undefined,
          ok: data.ok,
          status: data.status,
          durationMs: data.durationMs,
          tokenUsage: data.tokenUsage,
          responseHeaders: data.responseHeaders,
          curlFull: data.curlFull,
        })

        if (Notification.permission === "granted" && document.hidden && reply) {
          new Notification(`${selectedPreset.name} replied`, { body: reply.slice(0, 80) + "…", silent: true })
        }
      } catch (err) {
        const errMsg: ChatMessage = { role: "assistant", content: err instanceof Error ? err.message : "Request failed", ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }
        setChatHistory((prev) => [...prev, errMsg])
      } finally {
        setLoading(false)
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!loading && !isStreaming) runTest()
    }
  }

  function copyCurl() {
    if (!result?.curlCommand) return
    copyToClipboard(result.curlCommand).then(() => {
      setCopiedCurl(true)
      setTimeout(() => setCopiedCurl(false), 1500)
    }).catch(() => {})
  }

  function copyCurlFull() {
    if (!result?.curlFull) return
    copyToClipboard(result.curlFull).then(() => {
      setCopiedCurlFull(true)
      setTimeout(() => setCopiedCurlFull(false), 1500)
    }).catch(() => {})
  }

  async function requestNotifPermission() {
    if (typeof Notification === "undefined") return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
  }

  function exportResultJSON() {
    if (!result) return
    const blob = new Blob([JSON.stringify({ provider: selectedPreset.name, ...result }, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `api-test-${selectedPreset.id}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportChatMarkdown() {
    const lines = chatHistory.map((m) =>
      `**${m.role === "user" ? "User" : selectedPreset.name}** (${m.ts})\n\n${m.content}`
    )
    const md = `# Chat Export — ${selectedPreset.name}\n\n${lines.join("\n\n---\n\n")}`
    const blob = new Blob([md], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `chat-${selectedPreset.id}-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function shareResult() {
    if (!result) return
    const lines = [
      `API Key Test Result — ${selectedPreset.name}`,
      `Status: ${result.ok ? "VALID" : "INVALID"} (HTTP ${result.status})`,
      result.durationMs !== undefined ? `Latency: ${result.durationMs}ms` : null,
      result.tokenUsage?.totalTokens !== undefined ? `Total Tokens: ${result.tokenUsage.totalTokens}` : null,
      result.tokenUsage?.promptTokens !== undefined ? `Prompt: ${result.tokenUsage.promptTokens} / Completion: ${result.tokenUsage.completionTokens}` : null,
      result.curlFull ? `\ncURL:\n${result.curlFull}` : null,
    ].filter(Boolean).join("\n")
    copyToClipboard(lines).then(() => {
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="flex h-full bg-background text-foreground font-sans overflow-hidden relative antialiased">

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
        flex-shrink-0 border-r border-border bg-sidebar flex flex-col overflow-hidden h-full
        fixed md:static inset-y-0 left-0 z-40 md:z-auto
        w-72 md:w-60 lg:w-64
        transition-transform duration-200 ease-in-out md:transition-none md:translate-x-0
        ${configOpen ? "translate-x-0" : "-translate-x-full"}
      `}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/12 border border-primary/25 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_oklch(0.76_0.17_192_/_0.2)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary">
                <circle cx="7" cy="12" r="4" />
                <path d="M11 12h9M17 10v4" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground leading-tight tracking-tight">API Tester</p>
              <p className="text-[10px] text-muted-foreground/60">{PRESETS.length} providers</p>
            </div>
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

        {/* ── Scrollable sidebar body ── */}
        <div className="flex-1 overflow-y-auto flex flex-col">

          {/* Onboarding hint — shown once, dismissable */}
          {!onboardingDismissed && (
            <div className="mx-3 mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 flex items-center gap-2 relative flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-primary flex-shrink-0">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
              <p className="text-[11px] text-muted-foreground flex-1 leading-snug">Pick a provider, paste your key, then use the Test tab.</p>
              <button
                onClick={dismissOnboarding}
                className="w-4 h-4 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-2.5 h-2.5">
                  <path d="M12 4L4 12M4 4l8 8" />
                </svg>
              </button>
            </div>
          )}

          {/* Provider search */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <div className="relative">
              <svg
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none"
                aria-hidden
              >
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="search"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder={`Search ${PRESETS.length} providers...`}
                className="w-full rounded-lg border border-border bg-background/60 text-foreground text-[11px] pl-7 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
              />
              {sidebarSearch && (
                <button
                  onClick={() => setSidebarSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3">
                    <path d="M12 4L4 12M4 4l8 8" />
                  </svg>
                </button>
              )}
            </div>
            {apiKey && detectProviderFromKey(apiKey) === selectedPreset.id && (
              <span className="mt-1.5 inline-flex text-[9px] text-primary/70 bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded font-medium">
                auto-detected
              </span>
            )}
          </div>

          {/* Provider list — fills available space */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2 flex flex-col gap-px">
            {(() => {
              const q = sidebarSearch.trim().toLowerCase()
              const matched = q ? PRESETS.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) : PRESETS
              // Dahono pinned first, Custom pinned last, rest sorted A→Z
              const pinFirst = matched.filter((p) => p.id === "dahono")
              const pinLast  = matched.filter((p) => p.id === "custom")
              const middle   = matched.filter((p) => p.id !== "dahono" && p.id !== "custom").sort((a, b) => a.name.localeCompare(b.name))
              const filtered = [...pinFirst, ...middle, ...pinLast]
              if (filtered.length === 0) return (
                <div className="text-center py-8 text-[11px] text-muted-foreground/50">
                  No providers match &ldquo;{sidebarSearch}&rdquo;
                </div>
              )
              return filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className={`text-xs font-medium px-2.5 py-2 rounded transition-colors text-left w-full flex items-center gap-2 group ${
                    selectedPreset.id === p.id
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground/90 hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <span className={`w-4 h-4 flex items-center justify-center flex-shrink-0 rounded transition-colors ${
                    selectedPreset.id === p.id ? "opacity-100" : "opacity-60 group-hover:opacity-90"
                  }`}>
                    <ProviderLogo providerId={p.id} providerName={p.name} className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0 truncate">{p.name}</span>
                  {p.country && (
                    <span className="flex-shrink-0 text-[10px] font-mono font-semibold tracking-wider text-muted-foreground/75 uppercase">
                      {p.country}
                    </span>
                  )}
                </button>
              ))
            })()}
          </div>

        </div>{/* end scrollable body */}
      </aside>

      {/* ── RIGHT: Tabbed panel ──────────────────────────────���─────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* ── HEADER: mobile config toggle + provider badge + tab bar ───────── */}
        <div className="flex flex-col border-b border-border bg-card flex-shrink-0">

          {/* Single combined header row */}
          <div className="flex items-center gap-1 px-2 h-10">
            {/* Mobile: config drawer toggle */}
            <button
              onClick={() => setConfigOpen(true)}
              className="md:hidden flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
              aria-label="Open configuration"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Provider badge — desktop */}
            <span className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground mr-1 flex-shrink-0">
              <ProviderLogo providerId={selectedPreset.id} providerName={selectedPreset.name} className="w-3 h-3 opacity-60 flex-shrink-0" />
              <span className="font-medium text-foreground/60 max-w-[80px] truncate">{selectedPreset.name}</span>
            </span>

            {/* Divider */}
            <div className="hidden md:block w-px h-4 bg-border/60 flex-shrink-0 mr-1" />

            {/* Primary tabs — inline with header */}
            <div className="flex items-center gap-0.5 flex-1 min-w-0">
              {([
                { id: "unified" as const,      label: "Test"  },
                { id: "multi-batch" as const,   label: "Batch" },
                { id: "working-keys" as const,  label: "Keys"  },
                { id: "saved" as const,         label: "Saved" },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as typeof activeTab)}
                  className={`px-3 h-7 rounded text-[11px] font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                    activeTab === t.id || (t.id === "saved" && (activeTab === "history" || activeTab === "collections"))
                      ? "bg-secondary text-foreground shadow-[inset_0_-2px_0_oklch(0.76_0.17_192_/_0.8)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Icon-only utility buttons — right side */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* Envs */}
              <button
                onClick={() => setActiveTab("environments")}
                title="Environments"
                className={`w-7 h-7 flex items-center justify-center rounded transition-all ${
                  activeTab === "environments"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </button>
              {/* Pricing */}
              <button
                onClick={() => setActiveTab("info")}
                title="Pricing"
                className={`w-7 h-7 flex items-center justify-center rounded transition-all ${
                  activeTab === "info"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </button>

              {/* Logout — only shown when DEV_PASSWORD gate is active */}
              <button
                title="Sign out"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" })
                  window.location.href = "/login"
                }}
                className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>

            {/* Response status chip */}
            {activeTab === "unified" && (unifiedSubTab === "vision" ? visionResult : result) && (
              <span className={`text-[10px] font-mono flex-shrink-0 ml-1 ${(unifiedSubTab === "vision" ? visionResult?.ok : result?.ok) ? "text-green-400" : "text-red-400"}`}>
                {(unifiedSubTab === "vision" ? visionResult?.status : result?.status)}&nbsp;·&nbsp;{(unifiedSubTab === "vision" ? visionResult?.durationMs : result?.durationMs)}ms
              </span>
            )}
          </div>

          {/* Sub-tab row — only shown inside Unified tab */}
          {activeTab === "unified" && (
            <div className="flex items-center gap-0.5 px-3 h-8 bg-sidebar/60 border-t border-border/40 overflow-x-auto scrollbar-none">
              {([
                {
                  id: "chat" as const,
                  label: "Chat",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  ),
                },
                {
                  id: "vision" as const,
                  label: "Vision",
                  icon: <ImageIcon />,
                },
                {
                  id: "ocr" as const,
                  label: "OCR",
                  icon: <ScanIcon />,
                },
                {
                  id: "image-gen" as const,
                  label: "Image",
                  icon: <PhotoIcon />,
                },
                {
                  id: "video-gen" as const,
                  label: "Video",
                  icon: <VideoTabIcon />,
                },
                {
                  id: "compare" as const,
                  label: "Compare",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                      <rect x="3" y="3" width="7" height="18" rx="1" />
                      <rect x="14" y="3" width="7" height="18" rx="1" />
                    </svg>
                  ),
                },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setUnifiedSubTab(t.id)}
                  className={`flex items-center gap-1 px-2 h-6 rounded text-[10px] font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                    unifiedSubTab === t.id
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ��─ CHAT TAB ─────────────────────────────────────────────────────── */}
        {activeTab === "unified" && unifiedSubTab === "chat" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

            {/* Model selector bar — working keys models + static preset models */}
            {(workingModels.length > 0 || (selectedPreset.models && selectedPreset.models.length > 0)) && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-sidebar/30 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">Model</span>
                <select
                  value={chatModel}
                  onChange={(e) => {
                    setChatModel(e.target.value)
                    // Auto-fill API key from working key if available
                    const wm = workingModels.find((m) => m.modelId === e.target.value)
                    if (wm && !apiKey.trim()) handleApiKeyChange(wm.apiKey)
                  }}
                  className="text-[11px] font-medium bg-background text-foreground border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer flex-1 min-w-0 truncate"
                >
                  {selectedPreset.id === "miuclaw" ? (
                    // Miuclaw: show gateway models with clean names — no latency suffix
                    workingModels.length > 0 ? (
                      workingModels.map((m) => (
                        <option key={m.modelId} value={m.modelId}>
                          {m.modelId}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>Sync keys first (Keys → Gateway)</option>
                    )
                  ) : (
                    <>
                      {workingModels.length > 0 && (
                        <optgroup label={`Saved working (${workingModels.length})`}>
                          {workingModels.map((m) => (
                            <option key={m.modelId} value={m.modelId}>
                              {m.modelId} · {m.latencyMs}ms
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {selectedPreset.models && selectedPreset.models.length > 0 && (
                        <optgroup label="All models">
                          {selectedPreset.models.map((m) => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  )}
                </select>
                {workingModels.length > 0 && (
                  <span className="text-[9px] text-primary/60 border border-primary/20 bg-primary/8 rounded px-1 py-0.5 flex-shrink-0 whitespace-nowrap">
                    {workingModels.length} {selectedPreset.id === "miuclaw" ? "models" : "saved"}
                  </span>
                )}
              </div>
            )}

            {/* Chat messages area */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col gap-3">
              {chatHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center max-w-sm mx-auto w-full">
                  <div className="w-12 h-12 rounded-xl border border-primary/20 bg-primary/8 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_oklch(0.76_0.17_192_/_0.12)]">
                    <ProviderLogo providerId={selectedPreset.id} providerName={selectedPreset.name} className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedPreset.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedPreset.id === "miuclaw"
                        ? workingModels.length > 0
                          ? "Ready — send a message to test"
                          : "No models synced — go to Keys → Sync to Miuclaw Gateway"
                        : apiKey
                          ? "Ready — send a message to test"
                          : workingModels.length > 0
                            ? "Loading saved key..."
                            : "Paste your API key below to start"
                      }
                    </p>
                  </div>
                  {apiKey && (
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {["Say hello", "What can you do?", "Count to 5", "Write a haiku"].map((s) => (
                        <button
                          key={s}
                          onClick={() => setPrompt(s)}
                          className="text-[10px] px-2.5 py-1 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:border-ring/50 hover:bg-secondary/60 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border text-foreground rounded-bl-sm"
                  }`}>
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{msg.content}</pre>
                  </div>
                  <span className="text-[9px] text-muted-foreground/50 px-1">
                    {msg.role === "user" ? "You" : selectedPreset.name} · {msg.ts}
                  </span>
                </div>
              ))}

              {/* Streaming bubble — shows tokens as they arrive */}
              {isStreaming && (
                <div className="flex items-start gap-2">
                  <div className="bg-card border border-primary/30 rounded-xl px-3.5 py-2.5 max-w-[85%] flex flex-col gap-1">
                    {streamingText ? (
                      <>
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">{streamingText}<span className="inline-block w-1.5 h-4 bg-primary/70 animate-pulse rounded-sm ml-0.5 align-middle" /></pre>
                        {ttftMs !== null && (
                          <span className="text-[9px] text-cyan-400/70 font-mono">TTFT: {ttftMs}ms</span>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <SpinnerIcon />
                        <span className="text-[11px] text-muted-foreground">Connecting...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {loading && !isStreaming && (
                <div className="flex items-start gap-2">
                  <div className="bg-card border border-border rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                    <SpinnerIcon />
                    <span className="text-[11px] text-muted-foreground">Waiting for response...</span>
                  </div>
                </div>
              )}

              {/* Result stats bar */}
              {result && (
                <div className={`rounded-xl border overflow-hidden ${
                  result.ok ? "border-green-500/25 bg-green-500/5" : "border-red-500/25 bg-red-500/5"
                }`}>
                  {/* Top status row */}
                  <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
                    result.ok ? "border-green-500/15" : "border-red-500/15"
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${result.ok ? "bg-green-400" : "bg-red-400"}`} />
                      <span className={`text-sm font-bold ${result.ok ? "text-green-400" : "text-red-400"}`}>
                        HTTP {result.status} �� {result.ok ? "Success" : "Failed"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {result.durationMs !== undefined && (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          <span className="text-foreground font-semibold">{result.durationMs}</span>ms
                        </span>
                      )}
                      {result.curlFull && (
                        <button
                          onClick={copyCurlFull}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border/50 bg-card/40 hover:bg-secondary transition-colors"
                        >
                          <CopyIcon />
                          {copiedCurlFull ? <span className="text-green-400">Copied</span> : "cURL"}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Error explanation */}
                  {!result.ok && (() => {
                    const exp = explainApiError(result.status, result.responseBody ?? result.statusText)
                    if (!exp) return null
                    return (
                      <div className="flex flex-col gap-1 px-4 py-3 border-b border-red-500/10 bg-red-500/3">
                        <div className="flex items-start gap-2">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-semibold text-red-300">{exp.cause}</span>
                            <span className="text-[11px] text-muted-foreground leading-snug">{exp.suggestion}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                  {/* Stats grid */}
                  {(() => {
                    const rh = result.responseHeaders ?? {}
                    const reqRem = rh["x-ratelimit-remaining-requests"] ?? rh["anthropic-ratelimit-requests-remaining"]
                    const reqLim = rh["x-ratelimit-limit-requests"] ?? rh["anthropic-ratelimit-requests-limit"]
                    const reqReset = rh["x-ratelimit-reset-requests"] ?? rh["anthropic-ratelimit-requests-reset"]
                    const tokRem = rh["x-ratelimit-remaining-tokens"] ?? rh["anthropic-ratelimit-tokens-remaining"]
                    const tokLim = rh["x-ratelimit-limit-tokens"] ?? rh["anthropic-ratelimit-tokens-limit"]
                    const hasStats = result.tokenUsage?.promptTokens !== undefined || reqRem || tokRem
                    if (!hasStats) return null

                    function fmtReset(s?: string): string | null {
                      if (!s) return null
                      const iso = s.match(/^PT?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+\.?\d*)S)?$/i)
                      if (iso) {
                        const h = parseInt(iso[1] ?? "0"), m = parseInt(iso[2] ?? "0"), sec = Math.round(parseFloat(iso[3] ?? "0"))
                        const parts: string[] = []
                        if (h) parts.push(`${h}h`)
                        if (m) parts.push(`${m}m`)
                        if (sec) parts.push(`${sec}s`)
                        return parts.join(" ") || null
                      }
                      const compact = s.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/)
                      if (compact && (compact[1] || compact[2] || compact[3])) {
                        const parts: string[] = []
                        if (compact[1]) parts.push(`${compact[1]}h`)
                        if (compact[2]) parts.push(`${compact[2]}m`)
                        if (compact[3]) parts.push(`${Math.round(parseFloat(compact[3]))}s`)
                        return parts.join(" ") || null
                      }
                      try {
                        const dt = new Date(s)
                        if (!isNaN(dt.getTime())) {
                          const diff = Math.round((dt.getTime() - Date.now()) / 1000)
                          if (diff < 0) return "soon"
                          if (diff < 60) return `${diff}s`
                          if (diff < 3600) return `${Math.round(diff/60)}m`
                          return `${Math.round(diff/3600)}h`
                        }
                      } catch { /* ignore */ }
                      return null
                    }

                    function pctAccent(rem?: string, lim?: string): string {
                      if (!rem || !lim) return "text-sky-400"
                      const pct = Math.round((parseInt(rem) / parseInt(lim)) * 100)
                      if (pct > 60) return "text-green-400"
                      if (pct > 25) return "text-yellow-400"
                      return "text-red-400"
                    }

                    const reqResetLabel = fmtReset(reqReset)

                    return (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[10px] font-mono border-t border-inherit/20">
                        {result.tokenUsage?.promptTokens !== undefined && (
                          <span className="text-muted-foreground">
                            in: <span className="text-foreground font-semibold">{result.tokenUsage.promptTokens}</span> tok
                          </span>
                        )}
                        {result.tokenUsage?.completionTokens !== undefined && (
                          <span className="text-muted-foreground">
                            out: <span className="text-foreground font-semibold">{result.tokenUsage.completionTokens}</span> tok
                          </span>
                        )}
                        {reqRem && (
                          <span className="text-muted-foreground flex items-center gap-1">
                            req: <span className={`font-semibold ${pctAccent(reqRem, reqLim)}`}>
                              {reqLim ? `${reqRem}/${reqLim}` : reqRem}
                            </span>
                            {reqResetLabel && (
                              <span className="text-[9px] text-sky-400/70 bg-sky-400/8 px-1 rounded">
                                ↺{reqResetLabel}
                              </span>
                            )}
                          </span>
                        )}
                        {tokRem && (
                          <span className="text-muted-foreground">
                            tok: <span className={`font-semibold ${pctAccent(tokRem, tokLim)}`}>
                              {tokLim ? `${tokRem}/${tokLim}` : tokRem}
                            </span>
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="border-t border-border px-4 py-3 flex-shrink-0 bg-card">

              {/* Inline API key input — hidden for Miuclaw (no client key needed), shown for others when no saved key exists */}
              {selectedPreset.id !== "miuclaw" && !apiKey.trim() && workingModels.length === 0 && (
                <div className="flex items-center gap-2 px-1 py-1 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="relative flex-1 min-w-0">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder="Paste API key to start..."
                      className="w-full rounded-lg border border-border bg-background text-foreground text-[11px] font-mono px-2.5 py-2 pr-7 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
                    />
                    <button
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                    >
                      <EyeIcon show={showKey} />
                    </button>
                  </div>
                  {selectedPreset.createKeyUrl && (
                    <a
                      href={selectedPreset.createKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-[10px] text-primary/60 hover:text-primary transition-colors whitespace-nowrap"
                    >
                      Get key →
                    </a>
                  )}
                </div>
              )}
              <div className="flex gap-2 items-end">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={(selectedPreset.id === "miuclaw" || apiKey.trim()) ? "Type a message... (Enter to send)" : "Enter API key above first..."}
                  disabled={(loading || isStreaming) || (selectedPreset.id !== "miuclaw" && !apiKey.trim())}
                  rows={2}
                  className="flex-1 min-w-0 rounded-xl border border-border bg-background text-foreground text-sm px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-none disabled:opacity-40 leading-relaxed"
                />
                <button
                  onClick={runTest}
                  disabled={(selectedPreset.id !== "miuclaw" && !apiKey.trim()) || !prompt.trim() || loading || isStreaming}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all flex-shrink-0 min-w-[80px] h-[46px]"
                >
                  {loading || isStreaming ? <SpinnerIcon /> : <SendIcon />}
                  {loading || isStreaming ? "..." : "Send"}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5 gap-2 flex-wrap">
                {/* Streaming toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none" htmlFor="streaming-toggle">
                  <button
                    id="streaming-toggle"
                    role="switch"
                    aria-checked={useStreaming}
                    onClick={() => setUseStreaming((v) => !v)}
                    className={`relative w-7 h-4 rounded-full border transition-all flex-shrink-0 ${useStreaming ? "bg-primary/80 border-primary/60" : "bg-secondary border-border"}`}
                  >
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${useStreaming ? "left-3.5" : "left-0.5"}`} />
                  </button>
                  <span className="text-[9px] text-muted-foreground">Stream</span>
                </label>
                {/* Notification bell */}
                {notifPerm !== "granted" && (
                  <button
                    onClick={requestNotifPermission}
                    title="Enable notifications when response arrives"
                    className="text-[9px] text-muted-foreground/50 hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden>
                      <path d="M8 2a5 5 0 0 1 5 5v2l1.5 2.5H1.5L3 9V7a5 5 0 0 1 5-5z" />
                      <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" />
                    </svg>
                    Notify
                  </button>
                )}
                {/* TTFT display */}
                {ttftMs !== null && (
                  <span className="text-[9px] font-mono text-cyan-400/80">TTFT {ttftMs}ms</span>
                )}
                <div className="flex items-center gap-3 ml-auto">
                  {chatHistory.length > 0 && (
                    <>
                      <button onClick={exportChatMarkdown} className="text-[9px] text-muted-foreground/50 hover:text-foreground transition-colors">Export MD</button>
                      {result && <button onClick={exportResultJSON} className="text-[9px] text-muted-foreground/50 hover:text-foreground transition-colors">Export JSON</button>}
                      <button
                        onClick={() => { setChatHistory([]); setResult(null); setStreamingText(""); setTtftMs(null) }}
                        className="text-[9px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      >
                        Clear chat
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── VISION TAB ───────────�����─────���────────��───────────────────����───��─ */}
        {activeTab === "unified" && unifiedSubTab === "vision" && (
          <>
            {/* Provider Header Bar */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-border bg-secondary/20">
              <div className="flex items-center gap-2.5 min-w-0">
                <ProviderLogo providerId={selectedPreset.id} providerName={selectedPreset.name} className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">{selectedPreset.name}</span>
              </div>
              
              {/* Model Selector */}
              {selectedPreset.models && selectedPreset.models.length > 0 && (
                <select
                  value={visionModel}
                  onChange={(e) => setVisionModel(e.target.value)}
                  className="text-xs font-semibold bg-background text-foreground border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                  title="Select vision model for this provider"
                >
                  {selectedPreset.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

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

        {/* ── OCR TAB ──────────────────────��───────────────��───────────────── */}
        {activeTab === "unified" && unifiedSubTab === "ocr" && (
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
                        onClick={() => copyToClipboard(ocrResult).catch(() => {})}
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
        {activeTab === "unified" && unifiedSubTab === "image-gen" && (() => {
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
              {/* Provider Header Bar */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-border bg-secondary/20">
              <div className="flex items-center gap-2.5 min-w-0">
                <ProviderLogo providerId={selectedPreset.id} providerName={selectedPreset.name} className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">{selectedPreset.name}</span>
              </div>
              
              {/* Model Selector */}
              {selectedPreset.models && selectedPreset.models.length > 0 && (
                <select
                  value={imageGenModel}
                  onChange={(e) => setImageGenModel(e.target.value)}
                  className="text-xs font-semibold bg-background text-foreground border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                  title="Select image model for this provider"
                >
                  {selectedPreset.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

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

        {/* ── VIDEO GEN TAB ─────────────────────────────────────────────��──── */}
        {activeTab === "unified" && unifiedSubTab === "video-gen" && (() => {
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
              {/* Provider Header Bar */}
              <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-border bg-secondary/20">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ProviderLogo providerId={selectedPreset.id} providerName={selectedPreset.name} className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate">{selectedPreset.name}</span>
                </div>
                
                {/* Model Selector */}
                {selectedPreset.models && selectedPreset.models.length > 0 && (
                  <select
                    value={videoGenModel}
                    onChange={(e) => setVideoGenModel(e.target.value)}
                    className="text-xs font-semibold bg-background text-foreground border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    title="Select video model for this provider"
                  >
                    {selectedPreset.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

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

        {/* ── COMPARE TAB ──────────────────────────────────────────────────── */}
        {activeTab === "unified" && unifiedSubTab === "compare" && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-5">

              {/* Header */}
              <div>
                <h2 className="text-sm font-semibold text-foreground">Side-by-side Comparison</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Send the same prompt to up to 3 providers simultaneously and compare responses, latency, and token usage.</p>
              </div>

              {/* Prompt input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-medium text-muted-foreground/80">Test Prompt</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={comparePrompt}
                    onChange={(e) => setComparePrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") runCompare() }}
                    placeholder="Enter a prompt to send to all providers..."
                    className="flex-1 rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                  />
                  <button
                    onClick={runCompare}
                    disabled={compareSlots.every(s => !s.apiKey.trim()) || !comparePrompt.trim()}
                    className="flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Run All
                  </button>
                </div>
              </div>

              {/* Comparison columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {compareSlots.map((slot, i) => {
                  const res = compareResults[i]
                  const preset = PRESETS.find((p) => p.id === slot.providerId)
                  return (
                    <div key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-card/40 overflow-hidden">
                      {/* Column header */}
                      <div className="px-3 pt-3 pb-2 border-b border-border/50 flex flex-col gap-2 bg-secondary/20">
                        <div className="flex items-center gap-2">
                          {preset && <ProviderLogo providerId={preset.id} providerName={preset.name} className="w-4 h-4 flex-shrink-0" />}
                          <select
                            value={slot.providerId}
                            onChange={(e) => {
                              setCompareSlots((prev) => {
                                const next = [...prev]
                                next[i] = { ...next[i], providerId: e.target.value }
                                return next
                              })
                            }}
                            className="flex-1 text-xs font-semibold bg-transparent text-foreground focus:outline-none cursor-pointer"
                          >
                            {PRESETS.filter((p) => p.id !== "custom").map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="password"
                          value={slot.apiKey}
                          onChange={(e) => {
                            setCompareSlots((prev) => {
                              const next = [...prev]
                              next[i] = { ...next[i], apiKey: e.target.value }
                              return next
                            })
                          }}
                          placeholder="API key for this slot..."
                          className="w-full rounded border border-border bg-background text-foreground text-xs font-mono px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                        />
                      </div>

                      {/* Result area */}
                      <div className="px-3 pb-3 flex-1 flex flex-col gap-2 min-h-[120px]">
                        {res.loading && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                            <SpinnerIcon />
                            Waiting...
                          </div>
                        )}
                        {!res.loading && res.result && (
                          <>
                            {/* Status bar */}
                            <div className={`flex items-center gap-2 text-xs font-semibold ${res.result.ok ? "text-green-400" : "text-red-400"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${res.result.ok ? "bg-green-400" : "bg-red-400"}`} />
                              HTTP {res.result.status}
                              {res.result.durationMs !== undefined && (
                                <span className="text-muted-foreground font-normal ml-auto">{res.result.durationMs}ms</span>
                              )}
                            </div>
                            {/* Token usage */}
                            {res.result.tokenUsage && (
                              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                <span>in <span className="text-foreground font-mono">{res.result.tokenUsage.promptTokens}</span></span>
                                <span>out <span className="text-foreground font-mono">{res.result.tokenUsage.completionTokens}</span></span>
                                <span>total <span className="text-foreground font-mono">{res.result.tokenUsage.totalTokens}</span></span>
                              </div>
                            )}
                            {/* Reply */}
                            {res.result.ok && res.result.chatReply && (
                              <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5 flex-1">
                                <pre className="text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans">{res.result.chatReply}</pre>
                              </div>
                            )}
                            {!res.result.ok && (
                              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-400 leading-relaxed break-all">
                                {res.result.statusText || `HTTP ${res.result.status}`}
                              </div>
                            )}
                          </>
                        )}
                        {!res.loading && !res.result && (
                          <p className="text-[11px] text-muted-foreground/50 mt-2">
                            {slot.apiKey ? "Press Run All to test" : "Enter an API key above"}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          </div>
        )}

        {/* ── SAVED TAB (History + Collections merged) ──────────────────────── */}
        {(activeTab === "saved" || activeTab === "history" || activeTab === "collections") && (() => {
          const savedSub = activeTab === "collections" ? "collections" : "history"
          return (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Sub-tab row */}
              <div className="flex items-center gap-0.5 px-3 h-8 border-b border-border/40 bg-sidebar/40 flex-shrink-0">
                {([
                  { id: "history",     label: "Recent" },
                  { id: "collections", label: "Collections" },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`px-2.5 h-6 rounded text-[10px] font-medium whitespace-nowrap transition-all ${
                      savedSub === t.id
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {savedSub === "history" && (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <HistoryPanel
                    onRestore={(entry) => {
                      const preset = PRESETS.find((p) => p.id === entry.provider)
                      if (preset) applyPreset(preset)
                      setPrompt(entry.prompt)
                      setActiveTab("unified")
                      setUnifiedSubTab("chat")
                    }}
                  />
                </div>
              )}
              {savedSub === "collections" && (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <CollectionsPanel
                    onLoad={(req: SavedRequest) => {
                      const preset = PRESETS.find((p) => p.id === req.provider)
                      if (preset) applyPreset(preset)
                      if (req.endpoint) setEndpoint(req.endpoint)
                      if (req.method) setMethod(req.method)
                      if (req.body) setBodyTemplate(req.body)
                      if (req.prompt) setPrompt(req.prompt)
                      if (req.systemPrompt) { setSystemPrompt(req.systemPrompt); setShowSystemPrompt(true) }
                      setActiveTab("unified")
                      setUnifiedSubTab("chat")
                    }}
                    currentRequest={{
                      name: prompt.slice(0, 40) || "Request",
                      provider: selectedPreset.id,
                      providerName: selectedPreset.name,
                      endpoint,
                      method,
                      headers: Object.fromEntries(headerRows.filter((r) => r.key.trim()).map((r) => [r.key, r.value])),
                      body: bodyTemplate || undefined,
                      prompt: prompt || undefined,
                      systemPrompt: systemPrompt || undefined,
                      model: getCurrentModel() || undefined,
                    }}
                  />
                </div>
              )}
            </div>
          )
        })()}

        {/* ── ENVIRONMENTS TAB ──────────────────────────────────────────────── */}
        {activeTab === "environments" && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <EnvSwitcher onEnvChange={(env) => setActiveEnv(env)} />
          </div>
        )}

        {/* ── KEYS TAB (Saved keys + Screener merged) ──────────────────────── */}
        {(activeTab === "working-keys" || activeTab === "screener") && (() => {
          const keysSub = activeTab === "screener" ? "screener" : "keys"
          return (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Sub-tab row */}
              <div className="flex items-center gap-0.5 px-3 h-8 border-b border-border/40 bg-sidebar/40 flex-shrink-0">
                {([
                  { id: "keys",     label: "Saved Keys" },
                  { id: "screener", label: "Screener"   },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id === "keys" ? "working-keys" : "screener")}
                    className={`px-2.5 h-6 rounded text-[10px] font-medium whitespace-nowrap transition-all ${
                      keysSub === t.id
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {keysSub === "keys" && (
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <WorkingKeysPanel
                    refreshTick={workingKeysTick}
                    onUseKey={(key) => {
                      handleApiKeyChange(key)
                      setConfigOpen(true)
                    }}
                    onGatewaySync={() => setWorkingKeysTick((t) => t + 1)}
                  />
                </div>
              )}
              {keysSub === "screener" && (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <ModelScreenerPanel />
                </div>
              )}
            </div>
          )
        })()}

        {/* ── INFO TAB ──────────────────────────────���──────────────────────── */}
        {activeTab === "info" && (
          <ProviderInfoPanel apiKey={apiKey || undefined} />
        )}

        {/* ── AUTO-DETECT TAB ──────────────────────────────────────────────��─ */}
        {activeTab === "auto-detect" && (() => {
          // Full provider pattern table — mirrors detectProviderFromKey but with metadata
          type DetectPattern = {
            prefix: string
            providerId: string
            providerName: string
            example: string
            confidence: "high" | "low" | "none"
            note?: string
          }
          const DETECT_PATTERNS: DetectPattern[] = [
            // ── High-confidence exact prefixes ──────────────────────────────
            { prefix: "sk-ant-api",  providerId: "anthropic",   providerName: "Claude (Anthropic)",      example: "sk-ant-api03-…",       confidence: "high" },
            { prefix: "sk-ant-",     providerId: "anthropic",   providerName: "Claude (Anthropic)",      example: "sk-ant-…",             confidence: "high" },
            { prefix: "AIzaSy",      providerId: "google",      providerName: "Gemini (Google)",         example: "AIzaSy…",              confidence: "high" },
            { prefix: "AIza",        providerId: "google",      providerName: "Gemini (Google)",         example: "AIza…",                confidence: "high" },
            { prefix: "gsk_",        providerId: "groq",        providerName: "Groq",                    example: "gsk_abc…",             confidence: "high" },
            { prefix: "hf_",         providerId: "huggingface", providerName: "HuggingFace",             example: "hf_abc…",              confidence: "high" },
            { prefix: "xai-",        providerId: "xai",         providerName: "Grok (xAI)",              example: "xai-abc…",             confidence: "high" },
            { prefix: "pplx-",       providerId: "perplexity",  providerName: "Perplexity",              example: "pplx-abc…",            confidence: "high" },
            { prefix: "or-v1-",      providerId: "openrouter",  providerName: "OpenRouter",              example: "or-v1-abc…",           confidence: "high" },
            { prefix: "or-",         providerId: "openrouter",  providerName: "OpenRouter",              example: "or-abc…",              confidence: "high" },
            { prefix: "fw-",         providerId: "fireworks",   providerName: "Fireworks AI",            example: "fw-abc…",              confidence: "high" },
            { prefix: "nvapi-",      providerId: "nvidia",      providerName: "NVIDIA NIM",              example: "nvapi-abc…",           confidence: "high" },
            { prefix: "dk-",         providerId: "dahono",      providerName: "Dahono Labs Gateway",     example: "dk-abc…",              confidence: "high" },
            { prefix: "dc-",         providerId: "dahono",      providerName: "Dahono Labs Gateway",     example: "dc-abc…",              confidence: "high" },
            { prefix: "r8_",         providerId: "replicate",   providerName: "Replicate",               example: "r8_abc…",              confidence: "high" },
            { prefix: "up_",         providerId: "upstage",     providerName: "Upstage Solar",           example: "up_abc��",              confidence: "high" },
            { prefix: "sn-",         providerId: "sambanova",   providerName: "SambaNova",               example: "sn-abc…",              confidence: "high" },
            { prefix: "csk-",        providerId: "cerebras",    providerName: "Cerebras",                example: "csk-abc…",             confidence: "high" },
            { prefix: "cbrss_",      providerId: "cerebras",    providerName: "Cerebras",                example: "cbrss_abc…",           confidence: "high" },
            { prefix: "hyp_",        providerId: "hyperbolic",  providerName: "Hyperbolic",              example: "hyp_abc…",             confidence: "high" },
            { prefix: "J2-",         providerId: "ai21",        providerName: "AI21 Labs",               example: "J2-abc…",              confidence: "high" },
            { prefix: "msauth_",     providerId: "mistral",     providerName: "Mistral AI",              example: "msauth_abc…",          confidence: "high" },
            { prefix: "lp_",         providerId: "lepton",      providerName: "LeptonAI",                example: "lp_abc…",              confidence: "high" },
            { prefix: "lmn_",        providerId: "lamini",      providerName: "Lamini AI",               example: "lmn_abc…",             confidence: "high" },
            { prefix: "di_",         providerId: "deepinfra",   providerName: "Deep Infra",              example: "di_abc…",              confidence: "high" },
            { prefix: "esec_",       providerId: "anyscale",    providerName: "Anyscale",                example: "esec_abc…",            confidence: "high" },
            { prefix: "neets-",      providerId: "neets",       providerName: "Neets AI",                example: "neets-abc…",           confidence: "high" },
            // ── OpenAI exact formats ────────────────────────────────────────
            { prefix: "sk-proj-",    providerId: "openai",      providerName: "GPT (OpenAI)",            example: "sk-proj-abc…",         confidence: "high" },
            { prefix: "sk-svcacct-", providerId: "openai",      providerName: "GPT (OpenAI)",            example: "sk-svcacct-abc…",      confidence: "high" },
            { prefix: "sk-None-",    providerId: "openai",      providerName: "GPT (OpenAI)",            example: "sk-None-abc…",         confidence: "high" },
            // ── sk- ambiguous — length-based tiebreaker ─────────────────────
            { prefix: "sk-",         providerId: "together",    providerName: "Together AI",             example: "sk-… (64 hex chars)",  confidence: "low",  note: "sk- key ≥60 chars is likely Together AI — identical prefix to OpenAI/DeepSeek" },
            { prefix: "sk-",         providerId: "openai",      providerName: "GPT (OpenAI) legacy",     example: "sk-… (45–59 chars)",   confidence: "low",  note: "sk- key 45–59 chars is likely OpenAI legacy format" },
            { prefix: "sk-",         providerId: "deepseek",    providerName: "DeepSeek",                example: "sk-… (32–44 chars)",   confidence: "low",  note: "sk- key 32–44 chars is likely DeepSeek — cannot distinguish from short OpenAI keys with certainty" },
            // ── No reliable prefix — opaque UUID/random tokens ──────────────
            { prefix: "—",           providerId: "cohere",      providerName: "Cohere",                  example: "random 40-char hex",   confidence: "none", note: "Opaque random token — cannot be distinguished by prefix" },
            { prefix: "—",           providerId: "mistral",     providerName: "Mistral AI",              example: "random UUID",          confidence: "none", note: "Opaque random token — cannot be distinguished by prefix" },
            { prefix: "—",           providerId: "together",    providerName: "Together AI",             example: "short random token",   confidence: "none", note: "Short random token variant — cannot be distinguished by prefix" },
            { prefix: "—",           providerId: "minimax",     providerName: "MiniMax",                 example: "numeric ID",           confidence: "none", note: "MiniMax keys are numeric IDs — not prefix-detectable" },
            { prefix: "—",           providerId: "zhipu",       providerName: "GLM (Zhipu AI)",          example: "JWT token",            confidence: "none", note: "Zhipu keys are JWT tokens — not prefix-detectable" },
            { prefix: "—",           providerId: "qwen",        providerName: "Qwen (Alibaba)",          example: "random string",        confidence: "none", note: "Alibaba DashScope keys have no fixed prefix" },
            { prefix: "—",           providerId: "moonshot",    providerName: "Moonshot AI (Kimi)",      example: "random string",        confidence: "none", note: "Moonshot keys have no fixed prefix" },
            { prefix: "—",           providerId: "baidu",       providerName: "Baidu ERNIE (Qianfan)",   example: "random string",        confidence: "none", note: "Baidu Qianfan keys have no fixed prefix" },
            { prefix: "—",           providerId: "yi",          providerName: "01.AI (Yi)",              example: "random string",        confidence: "none", note: "Yi keys have no fixed prefix" },
            { prefix: "���",           providerId: "stepfun",     providerName: "Stepfun",                 example: "random string",        confidence: "none", note: "Stepfun keys have no fixed prefix" },
            { prefix: "—",           providerId: "hunyuan",     providerName: "Tencent Hunyuan",         example: "random string",        confidence: "none", note: "Hunyuan keys have no fixed prefix" },
            { prefix: "—",           providerId: "cloudflare",  providerName: "Cloudflare Workers AI",   example: "accountId|apiToken",   confidence: "none", note: "Cloudflare keys use accountId|apiToken composite format" },
            { prefix: "—",           providerId: "azure",       providerName: "Azure OpenAI",            example: "32-char hex",          confidence: "none", note: "Azure keys are 32-char hex — indistinguishable from other hex keys" },
            { prefix: "—",           providerId: "writer",      providerName: "Writer AI (Palmyra)",     example: "random string",        confidence: "none", note: "Writer keys have no fixed prefix" },
            { prefix: "—",           providerId: "bfl",         providerName: "Black Forest Labs (FLUX)", example: "random string",       confidence: "none", note: "BFL keys have no fixed prefix" },
            { prefix: "—",           providerId: "bytedance",   providerName: "Bytedance (SeedDream)",   example: "random string",        confidence: "none", note: "Bytedance Ark keys have no fixed prefix" },
            { prefix: "—",           providerId: "recraft",     providerName: "Recraft AI",              example: "random string",        confidence: "none", note: "Recraft keys have no fixed prefix" },
            { prefix: "—",           providerId: "ideogram",    providerName: "Ideogram AI",             example: "random string",        confidence: "none", note: "Ideogram keys have no fixed prefix" },
            { prefix: "—",           providerId: "luma",        providerName: "Luma AI (Photon)",        example: "random string",        confidence: "none", note: "Luma keys have no fixed prefix" },
            { prefix: "—",           providerId: "amazon",      providerName: "Amazon Nova (Bedrock)",   example: "AKID… / session token", confidence: "none", note: "AWS keys use AKID prefix but require additional SigV4 signing — not auto-switchable" },
            { prefix: "���",           providerId: "ibm",         providerName: "IBM Granite (WatsonX)",   example: "IAM API key",          confidence: "none", note: "IBM WatsonX keys are IAM tokens — not prefix-detectable" },
            { prefix: "—",           providerId: "novita",      providerName: "Novita AI",               example: "random UUID",          confidence: "none", note: "Novita keys are UUIDs — not prefix-detectable" },
            { prefix: "—",           providerId: "inception",   providerName: "Inception (Mercury)",     example: "random string",        confidence: "none", note: "Inception keys have no fixed prefix" },
            { prefix: "—",           providerId: "deepinfra",   providerName: "Deep Infra (non-di_)",    example: "random string",        confidence: "none", note: "Some Deep Infra keys lack the di_ prefix — use di_ keys for auto-detection" },
          ]

          function runDetect(raw: string): typeof detectResult {
            if (!raw.trim()) return null
            const k = raw.trim()
            // Only match patterns that have real prefixes (not the "—" sentinel)
            for (const p of DETECT_PATTERNS) {
              if (p.prefix === "—") continue
              if (!k.startsWith(p.prefix)) continue
              // For generic sk- apply length-based tiebreaker
              if (p.prefix === "sk-") {
                if (p.providerId === "together" && k.length < 60) continue
                if (p.providerId === "openai"   && (k.length < 45 || k.length >= 60)) continue
                if (p.providerId === "deepseek" && (k.length < 32 || k.length >= 45)) continue
              }
              return {
                providerId: p.providerId,
                providerName: p.providerName,
                confidence: p.confidence,
                prefix: k.slice(0, Math.min(p.prefix.length + 4, k.length)) + "…",
                reason: p.note ?? `Key starts with "${p.prefix}" — exclusive to ${p.providerName}`,
              }
            }
            return {
              providerId: null,
              providerName: null,
              confidence: "unknown",
              prefix: k.slice(0, 10) + (k.length > 10 ? "…" : ""),
              reason: "No matching prefix found. This provider likely uses an opaque random token — see the undetectable providers list below.",
            }
          }

          const liveResult = runDetect(detectInput)
          const detectedPreset = liveResult?.providerId ? PRESETS.find((p) => p.id === liveResult.providerId) : null

          return (
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 flex flex-col gap-5">

              {/* Title */}
              <div>
                <h2 className="text-base font-semibold text-foreground tracking-tight">Identify Provider</h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Paste any API key — the system instantly recognises the provider from its prefix pattern.
                </p>
              </div>

              {/* Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Paste API key to identify
                </label>
                <input
                  type="password"
                  value={detectInput}
                  onChange={(e) => setDetectInput(e.target.value)}
                  placeholder="sk-ant-api03-… or AIzaSy… or gsk_…"
                  className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  autoComplete="off"
                  spellCheck={false}
                />
                {detectInput && (
                  <button
                    onClick={() => setDetectInput("")}
                    className="flex items-center gap-1.5 self-start px-2.5 py-1.5 rounded-md text-[11px] font-medium text-red-400 bg-red-500/8 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/40 transition-all"
                    aria-label="Delete key"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                    Delete key
                  </button>
                )}
              </div>

              {/* Live result card */}
              {liveResult && (
                <div className={`rounded-lg border p-4 flex flex-col gap-3 transition-all ${
                  liveResult.confidence === "high"    ? "border-green-500/30 bg-green-500/5"
                  : liveResult.confidence === "low"   ? "border-yellow-500/30 bg-yellow-500/5"
                  : "border-border bg-secondary/20"
                }`}>
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {detectedPreset && (
                        <ProviderLogo providerId={detectedPreset.id} providerName={detectedPreset.name} className="w-6 h-6 flex-shrink-0" />
                      )}
                      <span className="text-sm font-semibold text-foreground truncate tracking-tight">
                        {liveResult.providerName ?? "Unknown Provider"}
                      </span>
                    </div>
                    <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      liveResult.confidence === "high"  ? "text-green-400 bg-green-400/10 border-green-400/30"
                      : liveResult.confidence === "low" ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
                      : "text-muted-foreground bg-secondary border-border"
                    }`}>
                      {liveResult.confidence === "high" ? "High confidence" : liveResult.confidence === "low" ? "Low confidence" : "Unrecognised"}
                    </span>
                  </div>

                  {/* Detected prefix */}
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-14 flex-shrink-0">Prefix</span>
                    <code className="text-xs font-mono bg-secondary/60 px-2.5 py-1 rounded text-foreground">{liveResult.prefix}</code>
                  </div>

                  {/* Reason */}
                  <div className="flex items-start gap-3">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-14 flex-shrink-0 pt-0.5">Reason</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{liveResult.reason}</p>
                  </div>

                  {/* CTA — use this provider */}
                  {detectedPreset && (
                    <button
                      onClick={() => {
                        handleApiKeyChange(detectInput)
                        setActiveTab("unified")
                        setUnifiedSubTab("chat")
                        const preset = PRESETS.find((p) => p.id === detectedPreset.id)
                        if (preset) {
                          setSelectedPreset(preset)
                          setEndpoint(preset.endpoint)
                          setMethod(preset.method)
                          setHeaderRows(Object.entries(preset.headers).map(([k, v], i) => ({ key: k, value: v, id: i })))
                          setBodyTemplate(preset.bodyTemplate)
                        }
                      }}
                      className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[11px] font-semibold bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary transition-all"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      Use as {detectedPreset.name} key and go to Chat
                    </button>
                  )}
                </div>
              )}

              {/* Pattern reference table — detectable */}
              {(() => {
                const detectable   = DETECT_PATTERNS.filter((p) => p.confidence !== "none")
                const undetectable = DETECT_PATTERNS.filter((p) => p.confidence === "none")
                return (
                  <div className="flex flex-col gap-4">

                    {/* Detectable */}
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Auto-detectable by prefix ({detectable.length} patterns)
                      </h3>
                      <div className="rounded-md border border-border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border bg-secondary/40">
                              <th className="text-left px-3 py-2.5 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Prefix</th>
                              <th className="text-left px-3 py-2.5 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Provider</th>
                              <th className="text-left px-3 py-2.5 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider hidden sm:table-cell">Example</th>
                              <th className="text-left px-3 py-2.5 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Conf.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detectable.map((p, i) => {
                              const isActive = liveResult?.providerId === p.providerId && p.prefix !== "—" && detectInput.trim().startsWith(p.prefix)
                              return (
                                <tr key={i} className={`border-b border-border/50 last:border-0 transition-colors ${isActive ? "bg-primary/10" : "hover:bg-secondary/30"}`}>
                                  <td className="px-3 py-2.5">
                                    <code className={`font-mono font-semibold text-[12px] ${isActive ? "text-primary" : "text-foreground"}`}>{p.prefix}</code>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <ProviderLogo providerId={p.providerId} providerName={p.providerName} className="w-4 h-4 flex-shrink-0 opacity-80" />
                                      <span className="text-foreground font-medium truncate max-w-[130px]">{p.providerName}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 hidden sm:table-cell">
                                    <code className="text-muted-foreground font-mono text-[11px] bg-secondary/50 px-1.5 py-0.5 rounded">{p.example}</code>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.confidence === "high" ? "text-green-400 bg-green-400/10 border border-green-400/20" : "text-yellow-400 bg-yellow-400/10 border border-yellow-400/20"}`}>
                                      {p.confidence}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Undetectable */}
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Cannot be detected by prefix ({undetectable.length} providers)
                      </h3>
                      <div className="rounded-md border border-border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border bg-secondary/40">
                              <th className="text-left px-3 py-2.5 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Provider</th>
                              <th className="text-left px-3 py-2.5 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider hidden sm:table-cell">Key format</th>
                              <th className="text-left px-3 py-2.5 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {undetectable.map((p, i) => (
                              <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-secondary/30 transition-colors">
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <ProviderLogo providerId={p.providerId} providerName={p.providerName} className="w-4 h-4 flex-shrink-0 opacity-70" />
                                    <span className="text-foreground font-medium truncate max-w-[130px]">{p.providerName}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 hidden sm:table-cell">
                                  <code className="text-muted-foreground font-mono text-[11px] bg-secondary/50 px-1.5 py-0.5 rounded">{p.example}</code>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="text-muted-foreground text-[11px] leading-relaxed">{p.note}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )
              })()}

            </div>
          )
        })()}

        {/* ── MULTI-KEY BATCH TAB ────────────────────────────────────────────── */}
        {activeTab === "multi-batch" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

            {/* Mobile segment toggle — hidden on md+ */}
            <div className="flex md:hidden items-center gap-1 px-3 py-2 border-b border-border bg-sidebar/60 flex-shrink-0">
              <div className="flex items-center gap-0.5 bg-secondary/60 rounded-lg p-0.5 w-full">
                {(["run", "config"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setBatchView(v)}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                      batchView === v
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v === "run" ? "Multi-key Run" : "Config"}
                  </button>
                ))}
              </div>
            </div>

            {/* Body — side-by-side on desktop, single panel on mobile */}
            <div className="flex-1 min-h-0 flex overflow-hidden">

              {/* Config panel — always visible on md+, toggled on mobile */}
              <div className={`
                flex-shrink-0 border-r border-border flex flex-col overflow-hidden
                md:w-72 md:flex
                ${batchView === "config" ? "flex w-full" : "hidden md:flex"}
              `}>
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">

                  {/* API Key */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-muted-foreground">API Key</label>
                      <div className="flex items-center gap-1.5">
                        {apiKey && detectProviderFromKey(apiKey) === selectedPreset.id && (
                          <span className="text-[9px] text-primary/70 bg-primary/8 border border-primary/20 px-1 py-0.5 rounded">detected</span>
                        )}
                        {apiKey && (
                          <button
                            onClick={() => { handleApiKeyChange(""); setShowKey(false) }}
                            className="text-[9px] text-muted-foreground/50 hover:text-destructive transition-colors"
                          >
                            clear
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => handleApiKeyChange(e.target.value)}
                        placeholder="Paste API key..."
                        className="w-full rounded border border-border bg-background text-foreground text-[11px] font-mono px-2.5 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
                      />
                      <button
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                        title={showKey ? "Hide" : "Show"}
                      >
                        <EyeIcon show={showKey} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        role="switch"
                        aria-checked={rememberKey}
                        onClick={() => handleRememberToggle(!rememberKey)}
                        className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      >
                        <span className={`relative w-6 h-3.5 rounded-full border transition-all flex-shrink-0 ${rememberKey ? "bg-primary/70 border-primary/50" : "bg-secondary border-border"}`}>
                          <span className={`absolute top-[1px] w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-all ${rememberKey ? "left-[11px]" : "left-[1px]"}`} />
                        </span>
                        Remember
                        {rememberKey && <span className="text-primary/60 font-medium ml-0.5">· saved</span>}
                      </button>
                      {selectedPreset.createKeyUrl && !apiKey && (
                        <a
                          href={selectedPreset.createKeyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors"
                        >
                          Get key
                          <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M1.5 6.5L6.5 1.5M6.5 1.5H3M6.5 1.5V5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Endpoint */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Endpoint URL</label>
                    <div className="flex gap-1.5">
                      <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value as "GET" | "POST" | "PUT" | "DELETE")}
                        className="text-[11px] font-mono bg-background border border-border rounded px-1.5 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring flex-shrink-0"
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
                        className="flex-1 min-w-0 rounded border border-border bg-background text-foreground text-[11px] font-mono px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
                      />
                    </div>
                    {selectedPreset.docsUrl && (
                      <a href={selectedPreset.docsUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary/70 hover:text-primary transition-colors">
                        API docs →
                      </a>
                    )}
                  </div>

                  {/* Single-key batch test */}
                  <div className="flex flex-col gap-1.5">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">Test all models — single key</label>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Uses the API key above</p>
                    </div>
                    <ProviderBatchTest
                      providerId={selectedPreset.id}
                      providerName={selectedPreset.name}
                      apiKey={apiKey}
                      onSaved={() => setWorkingKeysTick((t) => t + 1)}
                    />
                  </div>

                  {/* Headers */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Headers</label>
                    <HeaderEditor rows={headerRows} onChange={setHeaderRows} />
                    <p className="text-[10px] text-muted-foreground/50">
                      <code className="text-primary/70">{"{{API_KEY}}"}</code> is replaced on send.
                    </p>
                  </div>

                  {/* Model catalog */}
                  {selectedPreset.models && selectedPreset.models.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Models <span className="text-muted-foreground/40">({selectedPreset.models.length})</span>
                      </p>
                      <div className="flex flex-col gap-px">
                        {selectedPreset.models.map((m) => {
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
                                  setBodyTemplate(JSON.stringify({ model: m.id, max_tokens: 1024, messages: [{ role: "user", content: "{{PROMPT}}" }] }, null, 2))
                                }
                              }}
                              className={`text-left w-full px-2 py-1.5 rounded flex items-center justify-between gap-2 transition-colors ${
                                isActive ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary/50 border border-transparent"
                              }`}
                            >
                              <span className={`text-[11px] truncate ${isActive ? "text-primary font-medium" : "text-foreground/70"}`}>{m.label}</span>
                              <span className="text-[9px] text-muted-foreground/50 bg-muted/30 px-1 py-0.5 rounded flex-shrink-0 font-mono">{m.tag}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Request Body */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => setShowBodyEditor((v) => !v)}
                      className="flex items-center justify-between text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span>Request Body</span>
                      <ChevronIcon open={showBodyEditor} />
                    </button>
                    {showBodyEditor && (
                      <>
                        <textarea
                          value={bodyTemplate}
                          onChange={(e) => setBodyTemplate(e.target.value)}
                          rows={7}
                          spellCheck={false}
                          placeholder={"{\n  \"model\": \"...\"\n}"}
                          className="w-full rounded border border-border bg-background text-foreground text-[10px] font-mono px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/30 resize-y"
                        />
                        <p className="text-[9px] text-muted-foreground/40">
                          <code className="text-primary/60">{"{{PROMPT}}"}</code> — injected message placeholder.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Key info */}
                  {apiKey.trim().length >= 8 && (
                    <KeyInfoPanel
                      provider={selectedPreset.id}
                      apiKey={apiKey}
                      responseHeaders={lastResponseHeaders}
                      fetchTick={keyInfoTick}
                    />
                  )}

                  {/* Clear */}
                  <button
                    onClick={() => { setChatHistory([]); setVisionHistory([]); setOcrResult(null); setResult(null); setVisionResult(null); setShowLog(false) }}
                    className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-secondary/40 px-3 py-2 rounded border border-border/40 hover:border-border transition-colors text-center"
                  >
                    Clear history
                  </button>

                </div>
              </div>

              {/* Multi-key batch panel */}
              <div className={`
                flex-1 min-w-0 min-h-0 overflow-hidden
                ${batchView === "run" ? "flex" : "hidden md:flex"}
              `}>
                <MultiKeyBatch
                  onKeysSaved={() => {
                    setWorkingKeysTick((t) => t + 1)
                    setActiveTab("working-keys")
                  }}
                />
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  )
}
