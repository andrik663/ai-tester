# Provider Logos System

This document describes how provider SVG logos are managed, stored, and retrieved across the AI Tester application.

## Overview

The Provider Logos system provides centralized management of SVG brand assets for all 47+ AI providers, image generators, and API gateways supported by AI Tester. Logos are:

- Sourced from **theSVG.org** CDN (6,000+ brand assets)
- Stored in **Neon PostgreSQL** database for fast retrieval
- Exposed via **REST API** for third-party integrations
- Used throughout the UI (tabs, cards, headers, dashboards)

## Database Schema

```sql
CREATE TABLE provider_logos (
  id TEXT PRIMARY KEY,
  provider_id TEXT UNIQUE NOT NULL,
  provider_name TEXT NOT NULL,
  svg_url TEXT NOT NULL,
  svg_variant TEXT DEFAULT 'default',
  logo_source TEXT DEFAULT 'thesvg.org',
  category TEXT,
  description TEXT,
  colors JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
)
```

Fields:
- **provider_id**: Unique identifier (e.g., `openai`, `anthropic`, `google`)
- **provider_name**: Display name (e.g., `OpenAI`, `Anthropic`, `Google Gemini`)
- **svg_url**: Full CDN URL to the SVG file
- **svg_variant**: Logo variant - `default`, `mono`, `light`, `dark`, `color`
- **logo_source**: Source of the logo (currently all from `thesvg.org`)
- **category**: Provider type - `Chat LLM`, `Image Gen`, `Video Gen`, `Gateway`, `Cloud Provider`
- **colors**: Optional JSONB with brand colors (hex values)
- **is_active**: Toggle to show/hide logo

## Current Providers (47 total)

All providers are grouped by category:

### Chat LLMs (37)
OpenAI, Anthropic, Google Gemini, xAI (Grok), DeepSeek, Qwen, Zhipu, MiniMax, Cerebras, Fireworks, Novita, SambaNova, NVIDIA, Hyperbolic, AI21, Groq, Together AI, Mistral, Cohere, Perplexity, Hugging Face, Replicate, Moonshot, Baidu, 01.AI, StepFun, Hunyuan, Upstage, Writer, Lepton, Inception, IBM, DeepInfra, Anyscale, Meta (Llama), Lamini, Neets

### Image Generators (3)
Black Forest Labs (Flux), Recraft, Ideogram

### Video Generators (1)
Luma AI

### Gateways (3)
Dahono Gateway, Cloudflare Workers AI, OpenRouter

### Cloud Providers (2)
Microsoft Azure, Amazon Web Services

## API Endpoints

### GET /api/provider-logos

Fetch provider logos from the database.

**Query Parameters:**
- `providerId` (optional): Filter by specific provider ID (e.g., `openai`)

**Responses:**

All logos:
```bash
curl https://ai-tester.vercel.app/api/provider-logos
```

```json
{
  "success": true,
  "count": 47,
  "data": [
    {
      "providerId": "openai",
      "providerName": "OpenAI",
      "svgUrl": "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/openai/dark.svg",
      "svgVariant": "dark",
      "logoSource": "thesvg.org",
      "category": "Chat LLM"
    },
    // ... 46 more providers
  ]
}
```

Specific provider:
```bash
curl https://ai-tester.vercel.app/api/provider-logos?providerId=google
```

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "providerId": "google",
      "providerName": "Google Gemini",
      "svgUrl": "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/google/default.svg",
      "svgVariant": "default",
      "logoSource": "thesvg.org",
      "category": "Chat LLM"
    }
  ]
}
```

### POST /api/provider-logos

Add or update a provider logo.

**Request Body:**
```json
{
  "providerId": "my-provider",
  "providerName": "My AI Provider",
  "svgUrl": "https://example.com/logo.svg",
  "svgVariant": "default",
  "category": "Chat LLM"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "providerId": "my-provider",
    "providerName": "My AI Provider",
    "svgUrl": "https://example.com/logo.svg",
    "svgVariant": "default",
    "createdAt": "2026-06-23T...",
    "updatedAt": "2026-06-23T..."
  }
}
```

## SVG Variants

theSVG.org provides multiple variants for each brand:

- **default** — Colored logo with full branding
- **mono** — Monochrome/grayscale version
- **light** — Version optimized for dark backgrounds (typically white/light)
- **dark** — Version optimized for light backgrounds (typically dark/black)
- **color** — Explicitly colorful variant
- **wordmark** — Logo with text included
- **wordmarkLight** — Wordmark for dark backgrounds
- **wordmarkDark** — Wordmark for light backgrounds

Current setup uses:
- `dark` variant for light-background logos (OpenAI, Anthropic)
- `mono` for versatile, neutral logos (xAI, Qwen, Tencent)
- `default` for most others
- `color` for providers needing vibrant branding (Dahono)

## Code Usage

### In Components

**From Frontend (using static PROVIDER_LOGOS mapping):**
```tsx
const PROVIDER_LOGOS: Record<string, string> = {
  openai: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/openai/dark.svg",
  anthropic: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/anthropic/light.svg",
  // ... all 47 providers
}

function ProviderLogo({ providerId }: { providerId: string }) {
  const src = PROVIDER_LOGOS[providerId]
  if (!src) return null
  return <img src={src} alt={providerId} />
}
```

**From Backend (using database):**
```typescript
import { db } from "@/lib/db"
import { providerLogos } from "@/lib/db/provider-logos-schema"
import { eq } from "drizzle-orm"

// Get specific provider logo
const logo = await db
  .select()
  .from(providerLogos)
  .where(eq(providerLogos.providerId, "openai"))
  .limit(1)

// Get all logos by category
const images = await db
  .select()
  .from(providerLogos)
  .where(eq(providerLogos.category, "Image Gen"))
```

## Migration: Adding New Provider

When adding a new provider to AI Tester:

1. **Add provider config** to `lib/providers.ts`
2. **Add logo URL** to `PROVIDER_LOGOS` in `components/manual-key-tester.tsx`
3. **Insert into database:**

```bash
curl -X POST https://ai-tester.vercel.app/api/provider-logos \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "new-provider",
    "providerName": "New AI Provider",
    "svgUrl": "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/new-provider/default.svg",
    "category": "Chat LLM"
  }'
```

Or directly via SQL:
```sql
INSERT INTO provider_logos (provider_id, provider_name, svg_url, svg_variant, category)
VALUES ('new-provider', 'New AI Provider', 'https://...', 'default', 'Chat LLM')
ON CONFLICT (provider_id) DO UPDATE SET svg_url = EXCLUDED.svg_url;
```

## theSVG Brand Guidelines

All logos are sourced from [theSVG.org](https://thesvg.org) which provides:

- **6,000+ brand assets** maintained and verified
- **Consistent URL structure** for reliable CDN access
- **Multiple variants** per brand (mono, dark, light, color)
- **MIT-licensed library** with trademark-respecting usage

### Important: Trademark Compliance

Individual brand marks remain **trademarks of their respective owners**. When using logos:

1. Review each brand's trademark usage guidelines
2. Don't modify, recolor, or distort logos
3. Maintain proper attribution where required
4. Ensure compliance with brand guidelines for your use case

AWS Architecture Icons are specifically **CC BY-ND 2.0** (no derivatives, distribute unmodified).

## Performance Optimizations

**Database:**
- Indexed on `provider_id` for O(1) lookups
- Minimal queries (single SELECT by ID)
- Cached at application level (PROVIDER_LOGOS object)

**Frontend:**
- Static mapping for instant access
- CDN-served SVGs (jsDelivr for high availability)
- Lazy loading with `onError` handlers

**Caching:**
- Browser cache headers on CDN URLs
- Long TTL on API responses

## Troubleshooting

**Logo not showing:**
1. Check if SVG URL returns 200 status
2. Verify `provider_id` matches exactly (case-sensitive)
3. Test SVG URL directly in browser
4. Check for CORS issues (theSVG and jsDelivr support CORS)

**Missing provider:**
1. Verify provider is in `PROVIDER_CONFIGS`
2. Add to `PROVIDER_LOGOS` mapping
3. Insert row into `provider_logos` table
4. Clear browser cache

**Need a new brand:**
Submit to [theSVG.org/submit](https://thesvg.org/submit) for free community maintenance.
