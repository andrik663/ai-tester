# AI Tester API Specification

## Overview

AI Tester provides REST APIs for testing, validating, and comparing API keys across 40+ AI providers. Each endpoint is stateless and returns JSON responses.

**Base URL:** `https://ai-tester.vercel.app`  
**Response Format:** JSON  
**Rate Limit:** 1000 requests/hour (public), 10000 requests/hour (with API key)  

---

## Authentication

### Current: No Authentication Required
All endpoints are public and don't require authentication. Rate limiting is applied per IP address.

### Future: Optional API Key
```
Authorization: Bearer atk_xxxxxxxxxxxxx
```

---

## API Endpoints

### 1. Manual Test (Single Provider)

Test a single API key against a single provider.

**Endpoint:**
```
POST /api/manual-test
```

**Request Body:**
```typescript
{
  provider: string              // 'openai', 'anthropic', 'google', 'meta', etc
  apiKey: string                // The API key to test
  model?: string                // Model ID (optional, uses default)
  prompt?: string               // Chat prompt (optional, uses default test)
  testMode?: 'chat'|'vision'|'ocr'|'image-gen'|'video-gen'  // Test type
  imageData?: {                 // For vision/OCR tests
    base64: string              // Base64 encoded image
    mimeType: string            // 'image/jpeg', 'image/png', etc
  }
}
```

**Response:**
```typescript
{
  ok: boolean                           // Whether request succeeded
  status: number                        // HTTP status (200, 401, 429, etc)
  statusText: string                    // Status message ('OK', 'Unauthorized', etc)
  chatReply: string                     // The AI's response (if applicable)
  tokenUsage?: {                        // Token breakdown
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  durationMs: number                    // Response time in milliseconds
  responseBody: string                  // Raw response from provider
  responseHeaders?: Record<string, string>  // Response headers
  curlCommand: string                   // Masked curl command for debugging
  curlFull: string                      // Full curl command (with real key)
  requestBodySent: string               // The exact body sent to provider
  logs: Array<{                         // Debug logs
    ts: number                          // Timestamp (ms since start)
    level: 'info'|'warn'|'error'
    text: string
  }>
}
```

**Example:**
```bash
curl -X POST https://ai-tester.vercel.app/api/manual-test \
  -H 'Content-Type: application/json' \
  -d '{
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "gpt-4",
    "prompt": "Hello, how are you?"
  }'
```

**Status Codes:**
- `200 OK` - Test succeeded (key is valid and responded)
- `400 Bad Request` - Invalid request format
- `401 Unauthorized` - Key is invalid or expired
- `429 Too Many Requests` - Rate limited
- `500 Internal Server Error` - Server error

---

### 2. Multi-Key Test (3 Providers Parallel)

Test up to 3 different API keys simultaneously and compare results.

**Endpoint:**
```
POST /api/multi-key-test
```

**Request Body:**
```typescript
{
  keys: Array<{
    provider: string            // 'openai', 'anthropic', 'google'
    key: string                 // API key for that provider
  }>,
  prompt?: string               // Same prompt tested across all
  model?: string                // Model per provider (optional)
  timeout?: number              // Max wait time (default: 30000ms)
}
```

**Response:**
```typescript
{
  results: Array<{
    provider: string
    status: number
    statusText: string
    reply: string
    latencyMs: number
    tokenUsage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
    error?: string
  }>
}
```

**Example:**
```bash
curl -X POST https://ai-tester.vercel.app/api/multi-key-test \
  -H 'Content-Type: application/json' \
  -d '{
    "keys": [
      {"provider": "openai", "key": "sk-..."},
      {"provider": "anthropic", "key": "sk-ant-..."},
      {"provider": "google", "key": "..."}
    ],
    "prompt": "Which AI is fastest?"
  }'
```

---

### 3. Batch Test (Multiple Keys)

Validate multiple API keys in bulk (useful for key inventories).

**Endpoint:**
```
POST /api/batch-test
```

**Request Body:**
```typescript
{
  providers: string[]           // ['openai', 'anthropic', ...]
  keys: Record<string, string>  // { openai: 'sk-...', anthropic: 'sk-ant-...', ... }
  models?: Record<string, string> // Optional: specific model per provider
  timeout?: number              // Max wait per key (default: 30000ms)
}
```

**Response:**
```typescript
{
  results: Array<{
    provider: string
    model: string
    status: 'pass' | 'fail'
    latencyMs: number
    error?: string
    tokenUsage?: {...}
    message?: string
  }>,
  summary: {
    total: number
    passed: number
    failed: number
    avgLatencyMs: number
  }
}
```

---

### 4. Key Info (Validate & Detect)

Get information about an API key: whether it's valid, what provider it belongs to, available models.

**Endpoint:**
```
POST /api/key-info
```

**Request Body:**
```typescript
{
  key: string                   // API key to analyze
  detectProvider?: boolean      // Auto-detect from key format (default: true)
  fetchModels?: boolean         // Get available models from provider (default: true)
}
```

**Response:**
```typescript
{
  provider: string              // 'openai', 'anthropic', etc (or null if unknown)
  valid: boolean                // Whether key is valid
  detectedFormat: string        // 'sk-*' for OpenAI, 'sk-ant-*' for Anthropic, etc
  models: string[]              // Available models (if fetchModels: true)
  hasCredits: boolean           // Estimated if key has credits
  estimatedCredits?: string     // '$50.00 remaining' (if available)
  error?: string                // Why detection failed
}
```

**Example:**
```bash
curl -X POST https://ai-tester.vercel.app/api/key-info \
  -H 'Content-Type: application/json' \
  -d '{"key": "sk-...", "detectProvider": true}'
```

---

### 5. Provider Models (Catalog)

Get list of all available models for a specific provider, including pricing and capabilities.

**Endpoint:**
```
GET /api/provider-models?provider=openai&freshData=true
```

**Query Parameters:**
```
provider: string                // 'openai', 'anthropic', 'google', etc
freshData?: boolean             // Force refresh from provider (default: false, uses cache)
```

**Response:**
```typescript
{
  provider: string
  models: Array<{
    id: string                  // 'gpt-4', 'claude-opus', etc
    name: string                // 'GPT-4', 'Claude 3 Opus', etc
    inputPrice: string          // '$0.03/1M tokens'
    outputPrice: string         // '$0.06/1M tokens'
    contextWindow: number       // 8192, 200000, etc
    capabilities: string[]      // ['chat', 'vision', 'function_calling']
    releaseDate: string         // '2024-01-15'
    status: 'active' | 'deprecated' | 'beta'
  }>
  lastUpdated: string           // ISO timestamp of last catalog update
  cached: boolean               // Whether results are from cache
}
```

**Example:**
```bash
curl 'https://ai-tester.vercel.app/api/provider-models?provider=openai'
```

---

### 6. Fetch Models (Real-Time)

Get real-time model list from provider (more accurate but slower).

**Endpoint:**
```
POST /api/fetch-models
```

**Request Body:**
```typescript
{
  provider: string              // 'openai', 'anthropic', 'google'
  apiKey?: string               // Optional: get live models from your account
}
```

**Response:**
```typescript
{
  provider: string
  models: string[]              // Model IDs
  freshData: boolean            // Whether fetched live from provider
  cached: boolean
  error?: string
}
```

---

### 7. Image Generation Test

Test image generation capability of a provider.

**Endpoint:**
```
POST /api/image
```

**Request Body:**
```typescript
{
  provider: string              // 'openai', 'google', 'anthropic'
  apiKey: string                // Provider API key
  model: string                 // 'dall-e-3', 'imagen-3', etc
  prompt: string                // Image description
  size?: string                 // '1024x1024', '512x512', etc (default: provider's default)
  count?: number                // Number of images (default: 1)
}
```

**Response:**
```typescript
{
  ok: boolean
  images: string[]              // Base64 encoded PNG images
  urls?: string[]               // Public URLs (if provider returns them)
  latencyMs: number
  tokenUsage?: {...}
  error?: string
}
```

---

### 8. Video Generation Test

Test video generation capability.

**Endpoint:**
```
POST /api/video
```

**Request Body:**
```typescript
{
  provider: string              // 'openai', 'google'
  apiKey: string
  model: string                 // 'gpt-4-video', 'veo', etc
  prompt: string                // Video description
  duration?: number             // Seconds (default: 10)
}
```

**Response:**
```typescript
{
  ok: boolean
  videoUrl: string              // URL to generated video
  status: 'completed' | 'processing'
  latencyMs: number
  error?: string
}
```

---

## Error Handling

All errors follow this format:

```typescript
{
  ok: false,
  error: string,                // Human-readable error message
  code: string,                 // Error code: 'INVALID_KEY', 'RATE_LIMITED', etc
  status: number,               // HTTP status code
  timestamp: string             // ISO timestamp
}
```

**Common Error Codes:**
- `INVALID_KEY` - API key is invalid or expired
- `RATE_LIMITED` - Rate limit exceeded
- `PROVIDER_ERROR` - Provider returned error
- `NETWORK_ERROR` - Network connectivity issue
- `INVALID_REQUEST` - Bad request format
- `TIMEOUT` - Request timed out

---

## Rate Limiting

**Public API:**
- 1000 requests per hour per IP
- Header: `X-RateLimit-Remaining: 999`

**Response when limited:**
```
HTTP 429 Too Many Requests
{
  "error": "Rate limit exceeded",
  "retryAfter": 3600,
  "resetAt": "2026-06-23T14:00:00Z"
}
```

---

## Pagination & Limits

Most batch operations support:
- `limit`: Max results (default: 100, max: 1000)
- `offset`: Start position (default: 0)

---

## Webhook Events (Future)

When implemented, AI Tester will send webhook notifications:

```typescript
POST https://your-app.com/webhooks/ai-tester
{
  event: 'key_tested' | 'key_failed' | 'rate_limited',
  timestamp: '2026-06-23T12:34:56Z',
  provider: string,
  result: {...},
  signature: 'sha256=xxxxx'  // HMAC signature for verification
}
```

---

## SDK / Client Libraries

### JavaScript/TypeScript
```typescript
import { AiTesterClient } from '@ai-tester/sdk'

const client = new AiTesterClient({
  apiKey: 'atk_...'  // Optional
})

const result = await client.manualTest({
  provider: 'openai',
  apiKey: 'sk-...',
  prompt: 'Hello'
})
```

### Python
```python
from ai_tester import AiTesterClient

client = AiTesterClient(api_key='atk_...')

result = client.manual_test(
    provider='openai',
    api_key='sk-...',
    prompt='Hello'
)
```

---

## Support & Feedback

- **Documentation:** https://ai-tester.vercel.app/docs
- **GitHub:** https://github.com/ai-tester/ai-tester
- **Issues:** https://github.com/ai-tester/ai-tester/issues
