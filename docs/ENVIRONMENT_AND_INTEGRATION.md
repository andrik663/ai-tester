# Environment Variables & Third-Party Integration Guide

## 1. ENVIRONMENT VARIABLES REQUIRED

### Current Required Variables

```env
# Vercel / Infrastructure
VERCEL_WEB_ANALYTICS_ID=your_vercel_analytics_id
VERCEL_OIDC_TOKEN=auto_generated_by_vercel

# AI Gateway (for auto-detect and multi-provider testing)
AI_GATEWAY_API_KEY=vck_xxxxxxxxxxxxxxxxxxxx

# Runtime & Callbacks (auto-generated in v0 environment)
V0_RUNTIME_URL=https://vm-xxxxx.vusercontent.net
V0_CALLBACK_URL=https://callback.v0.app/...
```

### Optional But Recommended

```env
# For future integrations (database, auth, webhooks)
DATABASE_URL=postgresql://...              # If adding persistent storage
WEBHOOK_SECRET=your_secret_key             # For third-party webhooks
LOG_LEVEL=info|debug|error                 # Logging level
MAX_API_REQUESTS_PER_HOUR=1000            # Rate limiting
```

### What Each Variable Does

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `AI_GATEWAY_API_KEY` | Enables Vercel AI Gateway for auto-detect provider feature | ✅ YES |
| `VERCEL_WEB_ANALYTICS_ID` | Analytics tracking (optional) | ❌ NO |
| `VERCEL_OIDC_TOKEN` | Authentication with Vercel services | ✅ Auto-generated |

### Setup Instructions

1. **For local development:**
   ```bash
   # Copy existing .env.development.local or create new one
   cp .env.development.local .env.local
   ```

2. **For Vercel deployment:**
   - Go to Vercel Project Settings → Environment Variables
   - Add: `AI_GATEWAY_API_KEY` (from Vercel console)

3. **For custom deployments:**
   - Set `AI_GATEWAY_API_KEY` in your hosting platform
   - Ensure `DATABASE_URL` if using persistent storage

---

## 2. CURRENT API ENDPOINTS & CAPABILITIES

### Available APIs for Integration

#### A. Key Testing APIs

**1. Manual Test (Single Provider)**
```
POST /api/manual-test

Request:
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4",
  "prompt": "Your prompt here",
  "testMode": "chat" | "vision" | "ocr"
}

Response:
{
  "ok": boolean,
  "status": 200,
  "chatReply": "...",
  "tokenUsage": { "promptTokens": N, "completionTokens": N, "totalTokens": N },
  "durationMs": 1234,
  "logs": [...]
}
```

**2. Multi-Key Test (3 Providers Parallel)**
```
POST /api/multi-key-test

Request:
{
  "keys": [
    { "provider": "openai", "key": "sk-..." },
    { "provider": "anthropic", "key": "sk-ant-..." },
    { "provider": "google", "key": "...-..." }
  ],
  "prompt": "Your prompt here"
}

Response:
{
  "results": [
    { "provider": "openai", "status": 200, "reply": "...", "latencyMs": 1234, "tokenUsage": {...} },
    { "provider": "anthropic", "status": 200, "reply": "...", "latencyMs": 980, "tokenUsage": {...} },
    { "provider": "google", "status": 200, "reply": "...", "latencyMs": 1100, "tokenUsage": {...} }
  ]
}
```

**3. Key Info (Validate & Detect Provider)**
```
POST /api/key-info

Request:
{
  "key": "sk-...",
  "detectProvider": true  // Auto-detect from key format
}

Response:
{
  "provider": "openai",
  "valid": true,
  "models": ["gpt-4", "gpt-4-turbo", ...],
  "hasCredits": true,
  "estimatedCredits": "$50.00"
}
```

**4. Batch Test (Upload CSV Keys)**
```
POST /api/batch-test

Request:
{
  "providers": ["openai", "anthropic", "google"],
  "keys": { "openai": "sk-...", "anthropic": "sk-ant-...", ... },
  "models": { "openai": "gpt-4", "anthropic": "claude-opus", ... }
}

Response:
{
  "results": [{
    "provider": "openai",
    "model": "gpt-4",
    "status": "pass" | "fail",
    "error": null | "Invalid API key",
    "latencyMs": 1234,
    "tokenUsage": {...}
  }, ...]
}
```

#### B. Provider Data APIs

**5. Provider Models (Get All Available Models)**
```
GET /api/provider-models?provider=openai&freshData=true

Response:
{
  "provider": "openai",
  "models": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "inputPrice": "$0.03/1M tokens",
      "outputPrice": "$0.06/1M tokens",
      "contextWindow": 8192,
      "capabilities": ["chat", "vision", "function_calling"]
    }
  ],
  "lastUpdated": "2026-06-23"
}
```

**6. Fetch Models (For Specific Provider)**
```
POST /api/fetch-models

Request:
{
  "provider": "anthropic",
  "apiKey": "sk-ant-..." // Optional: to get real-time model list
}

Response:
{
  "models": ["claude-opus", "claude-sonnet", "claude-haiku"],
  "cached": false,
  "freshData": true
}
```

#### C. Content Generation APIs

**7. Image Generation**
```
POST /api/image

Request:
{
  "provider": "openai",
  "apiKey": "sk-...",
  "prompt": "A beautiful sunset",
  "model": "dall-e-3",
  "size": "1024x1024"
}

Response:
{
  "images": ["data:image/png;base64,..."],
  "tokenUsage": {...}
}
```

**8. Video Generation**
```
POST /api/video

Request:
{
  "provider": "openai",
  "apiKey": "sk-...",
  "prompt": "A cat playing with a ball",
  "model": "gpt-4-vision",
  "duration": 10
}

Response:
{
  "videoUrl": "https://...",
  "duration": 10,
  "status": "completed" | "processing"
}
```

---

## 3. RECOMMENDED INTEGRATION ARCHITECTURE

### Best Practice: Consumer App Integration

```
┌─────────────────────────────────────────────────────────┐
│  YOUR APPLICATION (Web/Mobile/Backend)                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ 1. Store API keys encrypted in DB
                 │ 2. Call AI Tester API for testing
                 │ 3. Receive results + usage stats
                 ↓
┌──────────────────────────────────────────────────────────┐
│  AI TESTER PUBLIC APIs                                    │
│  ✅ /api/manual-test (single provider)                    │
│  ✅ /api/multi-key-test (3 providers in parallel)         │
│  ✅ /api/batch-test (bulk key validation)                │
│  ✅ /api/provider-models (get available models)          │
│  ✅ /api/key-info (validate & detect)                     │
│  ✅ /api/image, /api/video (content generation)          │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
        Multiple AI Providers
   (OpenAI, Anthropic, Google, etc)
```

### Option 1: Simple Webhook Integration (Recommended for Most)

**Setup:**
1. Consumer app calls AI Tester API
2. AI Tester returns results immediately
3. Consumer app logs/stores results in own database

**Advantages:**
- ✅ Stateless, simple to implement
- ✅ No database required in AI Tester
- ✅ Fast response times
- ✅ Each app owns its data

**Example Flow:**
```typescript
// Your app backend
async function testApiKey(provider: string, key: string) {
  const response = await fetch('https://ai-tester.vercel.app/api/manual-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      apiKey: key,
      model: 'default-model',
      prompt: 'Test message'
    })
  })
  
  const result = await response.json()
  
  // Store in YOUR database
  await db.insertTestResult({
    provider,
    timestamp: new Date(),
    status: result.status,
    latency: result.durationMs,
    tokens: result.tokenUsage
  })
  
  return result
}
```

### Option 2: Webhook Callbacks (For Real-Time Monitoring)

**Setup requires:**
1. Add webhook receiver in AI Tester (new feature)
2. Consumer registers webhook URL
3. AI Tester sends test results to consumer app

**Advantages:**
- ✅ Proactive notifications
- ✅ Real-time monitoring
- ✅ Good for automated alerts

**Architecture:**
```typescript
// Consumer app registers webhook
POST /api/webhooks/register
{
  "url": "https://your-app.com/webhooks/ai-tester",
  "events": ["key_tested", "key_failed", "rate_limited"],
  "secret": "your_webhook_secret"
}

// AI Tester sends POST to consumer
POST https://your-app.com/webhooks/ai-tester
{
  "event": "key_tested",
  "provider": "openai",
  "timestamp": "2026-06-23T12:34:56Z",
  "result": {
    "status": 200,
    "latency": 1234,
    "tokenUsage": {...},
    "valid": true
  },
  "signature": "sha256=xxxxx"  // For verification
}
```

### Option 3: API Key Management Service (For Enterprise)

**Requires:**
1. Database in AI Tester
2. Multi-user auth
3. Key encryption
4. Usage analytics dashboard

**Flow:**
```
Your App
   ↓
AI Tester (Central Key Manager)
   ├─ Store encrypted API keys
   ├─ Track usage per provider
   ├─ Generate reports
   └─ Alert on issues
   ↓
Multiple consumer apps share same key pool
```

---

## 4. RECOMMENDED SOLUTION FOR YOUR USE CASE

### 🎯 Best Recommendation: **REST API + Webhook Hybrid**

**Why this approach?**
- ✅ Simple to implement
- ✅ Scalable without database
- ✅ Real-time + batch capabilities
- ✅ Each consumer owns their data
- ✅ No vendor lock-in

**Implementation Steps:**

1. **Make APIs Public:**
   - Create `/api/public/` routes that don't require auth
   - Add rate limiting (1000 requests/hour per IP)
   - Document with OpenAPI/Swagger

2. **Add Optional Auth (API Key):**
   ```typescript
   // For premium consumers who want higher limits
   // POST /api/keys/create
   // Returns: { "api_key": "atk_xxxxx", "rateLimit": 10000 }
   ```

3. **Implement Webhook System:**
   ```typescript
   // Consumer registers webhook
   // POST /api/webhooks/register
   // Body: { "url": "https://...", "events": [...], "secret": "..." }
   
   // AI Tester sends notifications
   // POST to consumer webhook with HMAC-SHA256 signature
   ```

4. **Add Analytics Endpoint:**
   ```typescript
   // GET /api/analytics/summary?provider=openai&range=7d
   // Returns: { tests: N, success_rate: %, avg_latency: Nms, ... }
   ```

---

## 5. SECURITY BEST PRACTICES

### For API Consumers

1. **Never expose API keys in frontend**
   ```typescript
   // ❌ WRONG - Never do this
   const testKey = async (key) => {
     const result = await fetch('/api/test', { 
       body: JSON.stringify({ apiKey: key }) 
     })
   }
   
   // ✅ CORRECT - Backend only
   app.post('/test-key', async (req, res) => {
     const { encryptedKey } = req.body
     const key = decrypt(encryptedKey)
     const result = await fetch('https://ai-tester/api/manual-test', {
       body: JSON.stringify({ apiKey: key })
     })
   })
   ```

2. **Encrypt keys at rest**
   - Use AES-256 encryption
   - Store decryption key in environment variable

3. **Rate limiting**
   - Max 100 tests per key per hour
   - Queue long-running batch tests
   - Return 429 Too Many Requests if exceeded

4. **Webhook verification**
   ```typescript
   // Verify webhook signature
   const crypto = require('crypto')
   const signature = req.headers['x-ai-tester-signature']
   const body = JSON.stringify(req.body)
   const secret = process.env.AI_TESTER_WEBHOOK_SECRET
   
   const hash = crypto
     .createHmac('sha256', secret)
     .update(body)
     .digest('hex')
   
   if (signature !== `sha256=${hash}`) {
     return res.status(401).json({ error: 'Invalid signature' })
   }
   ```

---

## 6. ROADMAP: FEATURES TO ADD

**Phase 1 (MVP)** - Current State
- ✅ Manual single key test
- ✅ Multi-key comparison
- ✅ Batch testing
- ✅ Model catalog

**Phase 2 (Next)** - Recommended
- 🔄 Public REST API with documentation
- 🔄 Simple API key authentication
- 🔄 Rate limiting + quota management
- 🔄 Basic webhook system

**Phase 3 (Future)**
- 📋 Database for key storage
- 📋 Multi-user/team management
- 📋 Advanced analytics dashboard
- 📋 Custom test templates
- 📋 Scheduled monitoring
- 📋 Slack/Discord integration

---

## 7. USAGE EXAMPLES

### Example 1: Your App Testing User's Key

```typescript
// User submits key via your web form
const testUserKey = async (provider: string, apiKey: string) => {
  try {
    const res = await fetch('https://ai-tester.vercel.app/api/manual-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        apiKey,
        model: 'default',
        prompt: 'Test'
      })
    })
    
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    
    const result = await res.json()
    
    // Show user the result
    return {
      valid: result.ok && result.status === 200,
      latency: result.durationMs,
      credits: estimateCredits(result.tokenUsage),
      error: result.statusText
    }
  } catch (err) {
    console.error('Key validation failed:', err)
    return { valid: false, error: err.message }
  }
}
```

### Example 2: Monitoring Multiple Providers

```typescript
// Schedule daily provider health check
const healthCheck = async () => {
  const keys = {
    openai: process.env.OPENAI_KEY,
    anthropic: process.env.ANTHROPIC_KEY,
    google: process.env.GOOGLE_KEY
  }
  
  const res = await fetch('https://ai-tester.vercel.app/api/multi-key-test', {
    method: 'POST',
    body: JSON.stringify({
      keys: Object.entries(keys).map(([provider, key]) => ({
        provider, key
      })),
      prompt: 'Verify service is working'
    })
  })
  
  const results = await res.json()
  
  // Alert if any provider is down
  const down = results.results.filter(r => r.status !== 200)
  if (down.length > 0) {
    await notifySlack(`⚠️ Provider down: ${down.map(d => d.provider).join(', ')}`)
  }
}
```

### Example 3: Batch Validation

```typescript
// Validate 100 API keys uploaded by user
const validateBatch = async (keys: Array<{provider: string; key: string}>) => {
  const res = await fetch('https://ai-tester.vercel.app/api/batch-test', {
    method: 'POST',
    body: JSON.stringify({
      entries: keys,
      timeout: 30000
    })
  })
  
  const results = await res.json()
  
  // Show summary to user
  const summary = {
    total: results.results.length,
    valid: results.results.filter(r => r.ok).length,
    invalid: results.results.filter(r => !r.ok).length,
    avgLatency: Math.round(
      results.results.reduce((sum, r) => sum + r.durationMs, 0) /
      results.results.length
    )
  }
  
  return summary
}
```

---

## 8. CONTACT & SUPPORT

For API documentation questions:
- Check `/docs/TYPOGRAPHY_SYSTEM.md` for UI standards
- Review API route files in `/app/api/` for exact parameters
- Open GitHub issue for feature requests
