# API Key Management System

Complete guide for managing API keys in AI Tester and integrating third-party applications.

## Overview

The API Key Management system allows:
- **Third-party applications** to securely access all AI Tester features via API keys
- **Key management** with expiration, rate limiting, and endpoint restrictions
- **Usage tracking** with detailed analytics and webhooks
- **Security** with key hashing, rotation, and revocation

## Quick Start

### 1. Create an API Key

**Endpoint:** `POST /api/keys/create`

```bash
curl -X POST https://ai-tester.vercel.app/api/keys/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App Integration",
    "description": "Production integration with AI Tester",
    "createdBy": "user123",
    "rateLimitPerHour": 100,
    "allowedEndpoints": ["*"],
    "expiresAt": "2025-12-31T23:59:59Z"
  }'
```

**Response:**
```json
{
  "success": true,
  "key": {
    "id": "key_abc123...",
    "name": "My App Integration",
    "rawKey": "atk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "createdAt": "2024-06-23T12:00:00Z"
  },
  "warning": "Save this key securely. You won't be able to see it again."
}
```

⚠️ **Important:** Save the `rawKey` immediately. It's only shown once!

### 2. Use the API Key

Include the key in the Authorization header:

```bash
curl -X POST https://ai-tester.vercel.app/api/manual-test \
  -H "Authorization: Bearer atk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "gpt-4",
    "prompt": "What is AI?"
  }'
```

### 3. Manage Your Keys

**List keys:**
```bash
GET /api/keys/list?createdBy=user123
```

**Get usage statistics:**
```bash
GET /api/keys/stats?keyId=key_abc123&days=7
```

**Revoke a key:**
```bash
POST /api/keys/revoke
Content-Type: application/json

{
  "keyId": "key_abc123",
  "createdBy": "user123"
}
```

---

## API Key Format

- **Prefix:** `atk_` (AI Tester Key)
- **Length:** 64 characters (prefix + 32 bytes hex)
- **Example:** `atk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6...`

---

## API Endpoints

### Create API Key

**POST** `/api/keys/create`

Request body:
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "createdBy": "string (required, your user ID)",
  "rateLimitPerHour": "number (default: 100)",
  "allowedEndpoints": ["string[] (default: ['*'])"],
  "webhookUrl": "string (optional)",
  "webhookSecret": "string (optional, required if webhookUrl set)",
  "expiresAt": "ISO 8601 date string (optional)"
}
```

Response (201):
```json
{
  "success": true,
  "key": {
    "id": "string",
    "name": "string",
    "rawKey": "string",
    "createdAt": "ISO 8601 date"
  },
  "warning": "string"
}
```

### List API Keys

**GET** `/api/keys/list?createdBy=<user_id>`

Response (200):
```json
{
  "success": true,
  "keys": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "isActive": "boolean",
      "createdAt": "ISO 8601 date",
      "lastUsedAt": "ISO 8601 date",
      "expiresAt": "ISO 8601 date",
      "rateLimitPerHour": "number",
      "allowedEndpoints": "string[]",
      "webhookUrl": "string or null"
    }
  ],
  "total": "number"
}
```

### Get Usage Statistics

**GET** `/api/keys/stats?keyId=<key_id>&days=<days>`

Query parameters:
- `keyId` (required): API key ID
- `days` (optional, default: 7): Number of days to include in stats

Response (200):
```json
{
  "success": true,
  "stats": {
    "period": {
      "days": 7,
      "startDate": "ISO 8601 date",
      "endDate": "ISO 8601 date"
    },
    "requests": {
      "total": 456,
      "successful": 445,
      "failed": 11,
      "successRate": "97.59%"
    },
    "performance": {
      "avgResponseTimeMs": 234
    },
    "byEndpoint": {
      "/api/manual-test": {
        "count": 200,
        "avgTime": 180
      },
      "/api/batch-test": {
        "count": 256,
        "avgTime": 280
      }
    }
  }
}
```

### Revoke API Key

**POST** `/api/keys/revoke`

Request body:
```json
{
  "keyId": "string (required)",
  "createdBy": "string (required)"
}
```

Response (200):
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

---

## Using API Key with Existing Endpoints

All existing AI Tester endpoints now support API key authentication:

### Manual Test
```bash
curl -X POST https://ai-tester.vercel.app/api/manual-test \
  -H "Authorization: Bearer atk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gemini",
    "apiKey": "user_provided_key",
    "model": "gemini-2.0-flash",
    "prompt": "Test prompt"
  }'
```

### Multi-Key Test
```bash
curl -X POST https://ai-tester.vercel.app/api/multi-key-test \
  -H "Authorization: Bearer atk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "providers": [
      { "provider": "openai", "apiKey": "sk_..." },
      { "provider": "gemini", "apiKey": "goog_..." }
    ],
    "prompt": "Compare these providers"
  }'
```

### Batch Test
```bash
curl -X POST https://ai-tester.vercel.app/api/batch-test \
  -H "Authorization: Bearer atk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "providers": ["openai", "gemini"],
    "keys": ["sk_...", "goog_..."],
    "prompt": "Batch test"
  }'
```

---

## Rate Limiting

- **Default:** 100 requests per hour per API key
- **Customizable:** Set `rateLimitPerHour` when creating a key
- **Response on limit:** HTTP 429 (Too Many Requests)

Error response:
```json
{
  "status": 429,
  "message": "Rate limit exceeded. Limit: 100 requests per hour",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

---

## Endpoint Restrictions

### All Endpoints (Wildcard)
```json
{
  "allowedEndpoints": ["*"]
}
```

### Specific Endpoints
```json
{
  "allowedEndpoints": [
    "/api/manual-test",
    "/api/multi-key-test",
    "/api/batch-test"
  ]
}
```

Error response when endpoint not allowed:
```json
{
  "status": 403,
  "message": "API key does not have access to endpoint: /api/batch-test",
  "code": "ENDPOINT_NOT_ALLOWED"
}
```

---

## Webhook Callbacks

When `webhookUrl` is set, AI Tester sends real-time notifications:

### Webhook Events

#### API Request Completed
```json
{
  "event": "api_request_completed",
  "timestamp": "2024-06-23T12:00:00Z",
  "apiKeyId": "key_abc123",
  "endpoint": "/api/manual-test",
  "statusCode": 200,
  "responseTimeMs": 234,
  "metadata": {
    "provider": "openai",
    "model": "gpt-4"
  }
}
```

#### Rate Limit Approaching
```json
{
  "event": "rate_limit_warning",
  "timestamp": "2024-06-23T12:00:00Z",
  "apiKeyId": "key_abc123",
  "requestsUsed": 95,
  "limit": 100,
  "timeUntilReset": 3600
}
```

#### Key Expiring Soon
```json
{
  "event": "key_expiring_soon",
  "timestamp": "2024-06-23T12:00:00Z",
  "apiKeyId": "key_abc123",
  "expiresAt": "2024-07-23T12:00:00Z",
  "daysRemaining": 30
}
```

### Webhook Verification

Every webhook includes a `X-Webhook-Signature` header:

```typescript
// Node.js example
import crypto from 'crypto'

function verifyWebhookSignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}
```

---

## Security Best Practices

### Do
✅ Store API keys securely (environment variables, secret management)
✅ Use HTTPS only
✅ Rotate keys regularly
✅ Set expiration dates
✅ Restrict endpoints when possible
✅ Use webhook signatures for verification
✅ Monitor usage statistics regularly
✅ Revoke unused keys

### Don't
❌ Expose API keys in frontend code
❌ Commit keys to version control
❌ Share keys in chat or emails
❌ Use one key for multiple environments
❌ Skip webhook signature verification
❌ Keep keys without expiration indefinitely

---

## Integration Examples

### JavaScript/TypeScript

```typescript
const API_KEY = process.env.AI_TESTER_API_KEY
const API_BASE = 'https://ai-tester.vercel.app'

async function testProvider(provider, apiKey, prompt) {
  const response = await fetch(`${API_BASE}/api/manual-test`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider,
      apiKey,
      prompt,
      model: 'gpt-4'
    }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  return response.json()
}
```

### Python

```python
import requests
import os

API_KEY = os.getenv('AI_TESTER_API_KEY')
API_BASE = 'https://ai-tester.vercel.app'

def test_provider(provider, api_key, prompt):
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
    }
    
    payload = {
        'provider': provider,
        'apiKey': api_key,
        'prompt': prompt,
        'model': 'gpt-4'
    }
    
    response = requests.post(
        f'{API_BASE}/api/manual-test',
        headers=headers,
        json=payload
    )
    
    response.raise_for_status()
    return response.json()
```

---

## Error Codes

| Code | Status | Description | Solution |
|------|--------|-------------|----------|
| `INVALID_KEY_FORMAT` | 401 | Key format is invalid | Verify key starts with `atk_` and is 64 chars |
| `INVALID_KEY` | 401 | Key not found or inactive | Create a new key or check key ID |
| `KEY_EXPIRED` | 401 | Key expiration date passed | Create a new key or extend expiration |
| `ENDPOINT_NOT_ALLOWED` | 403 | Key doesn't have access to endpoint | Update `allowedEndpoints` or use unrestricted key |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in last hour | Wait or request higher limit |
| `VALIDATION_ERROR` | 500 | Server error during validation | Contact support |

---

## Monitoring & Analytics

### Track API Usage
```bash
# Daily usage for last 30 days
curl https://ai-tester.vercel.app/api/keys/stats \
  ?keyId=key_abc123&days=30
```

### Identify Issues
- Filter by status code (success vs. failure)
- Group by endpoint to find slow operations
- Monitor response times
- Set up webhook alerts for rate limit warnings

---

## FAQ

**Q: Can I rotate my API key?**
A: Yes. Create a new key and revoke the old one. New key is available immediately.

**Q: What happens when my key expires?**
A: Requests using expired keys return 401. Create a new key before expiration.

**Q: Can I share an API key across multiple applications?**
A: Not recommended. Create separate keys per application for better control and monitoring.

**Q: How can I regenerate a lost key?**
A: You cannot recover a lost key. Revoke it and create a new one immediately.

**Q: What's the maximum rate limit?**
A: Contact support for higher limits. Default is customizable up to 10,000 requests/hour.

---

## Support

For issues or questions:
- Check documentation: `/docs/API_KEY_MANAGEMENT.md`
- Review error codes above
- Contact: support@ai-tester.dev
