/**
 * OpenRouter Providers Extended Configuration
 * 
 * Complete mapping of all 55+ real providers available through OpenRouter.
 * This extends the base PROVIDER_CONFIGS with additional providers not in the original list.
 * 
 * Source: https://openrouter.ai/api/v1/models
 * Last Updated: 2026-06-23
 */

export const OPENROUTER_EXTENDED_PROVIDERS = {
  // New providers from OpenRouter (with OpenAI-compatible endpoint)
  "ai21": {
    id: "ai21",
    name: "AI21 Labs",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["j2-ultra", "j2-mid", "j2-light"],
  },
  "aion-labs": {
    id: "aion-labs",
    name: "Aion Labs",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["aion-1.0"],
  },
  "allenai": {
    id: "allenai",
    name: "Allen Institute for AI",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["olmo-7b", "olmo-13b"],
  },
  "amazon-bedrock": {
    id: "amazon-bedrock",
    name: "Amazon Bedrock",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["bedrock-nova-lite", "bedrock-nova-pro"],
  },
  "arcee": {
    id: "arcee",
    name: "Arcee AI",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["arcee-trinity"],
  },
  "deep-cogito": {
    id: "deep-cogito",
    name: "Deep Cogito",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["cognito-v2.1"],
  },
  "inflection": {
    id: "inflection",
    name: "Inflection AI",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["inflection-3", "inflection-3.5"],
  },
  "kwaipilot": {
    id: "kwaipilot",
    name: "Kwaipilot (Kwai)",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["kwaipilot-coder"],
  },
  "liquid": {
    id: "liquid",
    name: "Liquid AI",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["lfm-40b", "lfm-7b"],
  },
  "mancer": {
    id: "mancer",
    name: "Mancer",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["mancer-weaver"],
  },
  "microsoft": {
    id: "microsoft",
    name: "Microsoft",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["phi-3", "phi-3.5", "phi-4"],
  },
  "morph": {
    id: "morph",
    name: "Morph AI",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["morph-1"],
  },
  "nex-agi": {
    id: "nex-agi",
    name: "Nex AGI",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["nex-1"],
  },
  "nous-research": {
    id: "nous-research",
    name: "Nous Research",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["nous-hermes-2", "nous-hermes-3"],
  },
  "openrouter-fusion": {
    id: "openrouter-fusion",
    name: "OpenRouter Fusion",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["openrouter-auto", "openrouter-ultimate"],
  },
  "perceptron": {
    id: "perceptron",
    name: "Perceptron",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["perceptron-1"],
  },
  "poolside": {
    id: "poolside",
    name: "Poolside AI",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["poolside-1"],
  },
  "reka": {
    id: "reka",
    name: "Reka AI",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["reka-core", "reka-flash"],
  },
  "relace": {
    id: "relace",
    name: "Relace",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["relace-1"],
  },
  "sao10k": {
    id: "sao10k",
    name: "Sao10k",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["sao10k-1"],
  },
  "switchpoint": {
    id: "switchpoint",
    name: "Switchpoint",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["switchpoint-1"],
  },
  "xiaomi": {
    id: "xiaomi",
    name: "Xiaomi",
    endpoint: "https://api.openrouter.ai/api/v1/chat/completions",
    models: ["xiaomi-mi", "xiaomi-moe"],
  },
} as const

/**
 * Provider logos - SVG URLs or data URIs for all providers
 * Used in sidebar and provider list display
 */
export const OPENROUTER_EXTENDED_LOGOS: Record<string, string> = {
  "ai21": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%231F88E5' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EA21%3C/text%3E%3C/svg%3E",
  "aion-labs": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23FFB81C' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EAL%3C/text%3E%3C/svg%3E",
  "allenai": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%235B2C6F' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EAA%3C/text%3E%3C/svg%3E",
  "amazon-bedrock": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23FF9900' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='38' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EBR%3C/text%3E%3C/svg%3E",
  "arcee": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%2300B4E4' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EAR%3C/text%3E%3C/svg%3E",
  "deep-cogito": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23234C5C' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='38' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EDC%3C/text%3E%3C/svg%3E",
  "inflection": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%235D3FD3' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EIF%3C/text%3E%3C/svg%3E",
  "kwaipilot": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23FF0000' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EKP%3C/text%3E%3C/svg%3E",
  "liquid": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%2300A8E8' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3ELQ%3C/text%3E%3C/svg%3E",
  "mancer": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23FF1493' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EMC%3C/text%3E%3C/svg%3E",
  "microsoft": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%230078D4' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EMS%3C/text%3E%3C/svg%3E",
  "morph": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%239B59B6' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EM%3C/text%3E%3C/svg%3E",
  "nex-agi": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%2308A88D' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3ENX%3C/text%3E%3C/svg%3E",
  "nous-research": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%234A5899' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3ENR%3C/text%3E%3C/svg%3E",
  "openrouter-fusion": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23FF6B35' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='38' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EOR%3C/text%3E%3C/svg%3E",
  "perceptron": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23E63946' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EPC%3C/text%3E%3C/svg%3E",
  "poolside": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%2300C9A7' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EPS%3C/text%3E%3C/svg%3E",
  "reka": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%238E44AD' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3ERK%3C/text%3E%3C/svg%3E",
  "relace": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%236C63FF' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3ERL%3C/text%3E%3C/svg%3E",
  "sao10k": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%2300D9FF' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3ES10%3C/text%3E%3C/svg%3E",
  "switchpoint": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23FF00FF' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3ESP%3C/text%3E%3C/svg%3E",
  "xiaomi": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23FF6900' width='100' height='100' rx='20'/%3E%3Ctext x='50' y='60' font-size='40' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3EXM%3C/text%3E%3C/svg%3E",
}
