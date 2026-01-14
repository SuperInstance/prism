# PRISM Security Guide

**Version:** 0.1.0
**Last Updated:** 2026-01-13
**Target Audience:** DevOps Engineers, Security Engineers

## Table of Contents

1. [Overview](#overview)
2. [Security Audit Findings](#security-audit-findings)
3. [API Key Management](#api-key-management)
4. [Authentication & Authorization](#authentication--authorization)
5. [Input Validation](#input-validation)
6. [Rate Limiting](#rate-limiting)
7. [Data Protection](#data-protection)
8. [Secure Communication](#secure-communication)
9. [Security Best Practices](#security-best-practices)
10. [Incident Response](#incident-response)
11. [Compliance](#compliance)

---

## Overview

This guide covers security considerations for running PRISM in production, including addressing findings from the security audit.

### Security Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Security Layers                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Layer 1: Edge Security                            │
│  ├─ DDoS Protection (Cloudflare)                   │
│  ├─ WAF Rules                                      │
│  └─ Rate Limiting                                  │
│                                                     │
│  Layer 2: API Security                             │
│  ├─ Authentication (JWT)                           │
│  ├─ Authorization (RBAC)                           │
│  └─ API Key Management                             │
│                                                     │
│  Layer 3: Application Security                     │
│  ├─ Input Validation                               │
│  ├─ Output Encoding                                │
│  └─ SQL Injection Prevention                       │
│                                                     │
│  Layer 4: Data Security                            │
│  ├─ Encryption at Rest (D1, KV)                    │
│  ├─ Encryption in Transit (TLS)                    │
│  └─ Secret Management                              │
│                                                     │
│  Layer 5: Monitoring & Auditing                    │
│  ├─ Access Logging                                 │
│  ├─ Security Events                                │
│  └─ Anomaly Detection                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Security Audit Findings

### Critical Issues

#### 1. API Key Storage (CRITICAL)

**Finding:** API keys stored in plaintext in `.dev.vars`

**Risk:** If repository is compromised, all API keys are exposed

**Remediation:**

```bash
# ❌ BAD: Keys in .dev.vars (plaintext)
API_SECRET=your-api-secret-here
JWT_SECRET=your-jwt-secret-here

# ✅ GOOD: Use Cloudflare Secrets
wrangler secret put API_SECRET
# Enter secure value (32+ random characters)

# Verify secret is set
wrangler secret list
```

**Implementation:**

```typescript
// Access secrets in Worker
export default {
  async fetch(request: Request, env: Env) {
    // Secret is injected at runtime, never in source code
    const apiSecret = env.API_SECRET;

    // Validate secret
    const providedSecret = request.headers.get('X-API-Secret');
    if (providedSecret !== apiSecret) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Process request...
  }
};
```

#### 2. Missing Authentication (CRITICAL)

**Finding:** No authentication on API endpoints

**Risk:** Unauthorized access to sensitive data and functions

**Remediation:**

```typescript
// middleware/auth.ts
export async function authenticate(
  request: Request,
  env: Env
): Promise<{ user: User } | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT token
    const decoded = await verifyJWT(token, env.JWT_SECRET);

    // Load user from database
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(decoded.userId).first();

    if (!user) {
      return null;
    }

    return { user };
  } catch (error) {
    return null;
  }
}

// Usage in endpoints
export async function handleSearch(
  request: Request,
  env: Env
): Promise<Response> {
  // Authenticate first
  const auth = await authenticate(request, env);
  if (!auth) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Authorize: Check permissions
  if (!auth.user.permissions.includes('search')) {
    return new Response('Forbidden', { status: 403 });
  }

  // Process request...
}
```

#### 3. Input Validation Gaps (HIGH)

**Finding:** Insufficient validation on user inputs

**Risk:** SQL injection, XSS, DoS attacks

**Remediation:**

```typescript
// middleware/validation.ts
import { z } from 'zod';

// Define validation schemas
const searchSchema = z.object({
  query: z.string().min(1).max(1000),
  top_k: z.number().int().min(1).max(100).optional(),
  filter: z.object({
    type: z.enum(['code', 'docs', 'all']).optional(),
    language: z.string().optional()
  }).optional()
});

const chatSchema = z.object({
  message: z.string().min(1).max(10000),
  model: z.enum(['quick', 'standard', 'premium']).optional(),
  temperature: z.number().min(0).max(1).optional()
});

// Validation middleware
export async function validateInput<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Invalid input',
        error.errors
      );
    }
    throw error;
  }
}

// Usage
export async function handleSearch(
  request: Request,
  env: Env
): Promise<Response> {
  // Parse and validate input
  const body = await request.json();
  const validated = await validateInput(body, searchSchema);

  // Safe to use validated data
  const results = await search(validated.query, validated.top_k);

  return Response.json(results);
}
```

**SQL Injection Prevention:**

```typescript
// ❌ BAD: String concatenation (SQL injection risk)
const query = `SELECT * FROM documents WHERE title = '${userInput}'`;
const result = await env.DB.prepare(query).all();

// ✅ GOOD: Parameterized queries
const result = await env.DB.prepare(
  'SELECT * FROM documents WHERE title = ?'
).bind(userInput).all();

// ✅ BETTER: With validation
const sanitized = validateString(userInput, { max: 100 });
const result = await env.DB.prepare(
  'SELECT * FROM documents WHERE title = ?'
).bind(sanitized).all();
```

#### 4. Rate Limiting Not Implemented (HIGH)

**Finding:** No rate limiting on API endpoints

**Risk:** DoS attacks, resource exhaustion, cost overruns

**Remediation:**

```typescript
// middleware/ratelimit.ts
interface RateLimitConfig {
  window: number;  // Time window in seconds
  max: number;     // Max requests per window
}

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
  env: Env
): Promise<{ allowed: boolean; resetAt: number }> {
  const key = `ratelimit:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.window;

  // Get current usage
  const data = await env.KV.get(key, 'json') as {
    count: number;
    resetAt: number;
  } | null;

  if (!data || data.resetAt < now) {
    // Reset window
    const newData = {
      count: 1,
      resetAt: now + config.window
    };

    await env.KV.put(key, JSON.stringify(newData), {
      expirationTtl: config.window
    });

    return { allowed: true, resetAt: newData.resetAt };
  }

  if (data.count >= config.max) {
    // Rate limit exceeded
    return { allowed: false, resetAt: data.resetAt };
  }

  // Increment counter
  const newData = {
    count: data.count + 1,
    resetAt: data.resetAt
  };

  await env.KV.put(key, JSON.stringify(newData), {
    expirationTtl: config.window
  });

  return { allowed: true, resetAt: newData.resetAt };
}

// Usage
export async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Get client identifier
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const apiKey = request.headers.get('X-API-Key') || 'anonymous';

  // Check rate limit
  const limit = await checkRateLimit(
    `${clientIP}:${apiKey}`,
    { window: 60, max: 100 },  // 100 requests per minute
    env
  );

  if (!limit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        resetAt: limit.resetAt
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(limit.resetAt - Math.floor(Date.now() / 1000))
        }
      }
    );
  }

  // Process request...
}
```

---

## API Key Management

### Key Generation

**Generate Secure API Keys:**

```typescript
// utils/crypto.ts
export async function generateApiKey(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  // Convert to hex string
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Format: prism_ + 64 hex chars = 69 chars total
export async function generateFormattedApiKey(): Promise<string> {
  const random = await generateApiKey();
  return `prism_${random}`;
}
```

**Example Output:**
```
prism_a1b2c3d4e5f6...7890 (64 random hex chars)
```

### Key Storage

**Never store plaintext keys. Always hash:**

```typescript
// utils/crypto.ts
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Store in database
async function createApiKey(userId: string): Promise<string> {
  const apiKey = await generateFormattedApiKey();
  const keyHash = await hashApiKey(apiKey);

  await env.DB.prepare(`
    INSERT INTO api_keys (id, user_id, key_hash, name, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).bind(
    crypto.randomUUID(),
    userId,
    keyHash,
    'API Key'
  ).run();

  return apiKey;  // Return plaintext key to user (only time!)
}
```

### Key Rotation

```typescript
// Implement key rotation
async function rotateApiKey(
  userId: string,
  oldKeyId: string
): Promise<string> {
  // Generate new key
  const newKey = await createApiKey(userId);

  // Revoke old key
  await env.DB.prepare(`
    UPDATE api_keys
    SET expires_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).bind(oldKeyId, userId).run();

  // Log rotation
  await logSecurityEvent({
    type: 'api_key_rotated',
    userId,
    oldKeyId,
    newKeyId: newKey.id
  });

  return newKey.key;
}
```

---

## Authentication & Authorization

### JWT Authentication

```typescript
// auth/jwt.ts
interface JWTPayload {
  userId: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

export async function generateJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string
): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + (24 * 60 * 60)  // 24 hours
  };

  const encoder = new TextEncoder();

  const encodedHeader = base64UrlEncode(
    encoder.encode(JSON.stringify(header))
  );

  const encodedPayload = base64UrlEncode(
    encoder.encode(JSON.stringify(tokenPayload))
  );

  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = await hmacSha256(data, secret);

  return `${data}.${signature}`;
}

export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  // Verify signature
  const expectedSignature = await hmacSha256(data, secret);
  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }

  // Decode payload
  const decoder = new TextDecoder();
  const payload = JSON.parse(decoder.decode(base64UrlDecode(encodedPayload)));

  // Check expiration
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

// Helper functions
async function hmacSha256(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );

  return base64UrlEncode(new Uint8Array(signature));
}

function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(data: string): Uint8Array {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}
```

### Role-Based Access Control (RBAC)

```typescript
// auth/rbac.ts
enum Permission {
  SEARCH = 'search',
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin'
}

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  anonymous: [Permission.SEARCH, Permission.READ],
  user: [Permission.SEARCH, Permission.READ, Permission.WRITE],
  admin: [Permission.SEARCH, Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN]
};

export function hasPermission(
  roles: string[],
  permission: Permission
): boolean {
  return roles.some(role =>
    ROLE_PERMISSIONS[role]?.includes(permission)
  );
}

// Usage
export async function handleDelete(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Check permission
  if (!hasPermission(auth.user.roles, Permission.DELETE)) {
    return new Response('Forbidden', { status: 403 });
  }

  // Process deletion...
}
```

---

## Input Validation

### Validation Rules

```typescript
// validation/schemas.ts
import { z } from 'zod';

// String validation
export const safeString = z.string()
  .min(1)
  .max(10000)
  .transform(s => s.trim())
  .transform(s => s.replace(/[<>]/g, ''));  // Remove potential XSS

// Email validation
export const safeEmail = z.string()
  .email()
  .transform(e => e.toLowerCase());

// URL validation
export const safeUrl = z.string()
  .url()
  .refine(url => url.startsWith('https://'), {
    message: 'Only HTTPS URLs are allowed'
  });

// Code snippet validation
export const safeCode = z.string()
  .max(100000)  // 100KB max
  .refine(code => {
    // Check for suspicious patterns
    const suspicious = [
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /onload=/i
    ];
    return !suspicious.some(pattern => pattern.test(code));
  });

// Query validation
export const searchQuery = z.object({
  q: safeString.min(1).max(1000),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
  filters: z.object({
    type: z.enum(['code', 'docs', 'all']).optional(),
    language: z.string().regex(/^[a-z]+$/).optional()
  }).optional()
});
```

### Sanitization

```typescript
// utils/sanitize.ts
export function sanitizeHtml(input: string): string {
  // Remove HTML tags
  return input.replace(/<[^>]*>/g, '');
}

export function sanitizeSql(input: string): string {
  // Remove SQL injection patterns
  return input
    .replace(/['";\\]/g, '')  // Remove dangerous chars
    .replace(/\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b/gi, '');
}

export function sanitizePath(input: string): string {
  // Prevent path traversal
  return input
    .replace(/\.\./g, '')  // Remove ..
    .replace(/~/g, '')     // Remove ~
    .replace(/\//g, '');   // Remove /
}
```

---

## Rate Limiting

### Rate Limit Strategies

```typescript
// ratelimit/strategies.ts

// 1. Fixed Window Counter
export async function fixedWindowRateLimit(
  key: string,
  limit: number,
  window: number,
  env: Env
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / window) * window;
  const cacheKey = `ratelimit:${key}:${windowStart}`;

  const current = await env.KV.get(cacheKey);
  const count = current ? parseInt(current) : 0;

  if (count >= limit) {
    return false;
  }

  await env.KV.put(cacheKey, String(count + 1), {
    expirationTtl: window
  });

  return true;
}

// 2. Sliding Window Log
export async function slidingWindowRateLimit(
  key: string,
  limit: number,
  window: number,
  env: Env
): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - (window * 1000);

  // Get recent requests
  const listKey = `ratelimit:${key}:list`;
  const requests = await env.KV.get(listKey, 'json') as number[] || [];

  // Remove old requests
  const validRequests = requests.filter(t => t > windowStart);

  if (validRequests.length >= limit) {
    return false;
  }

  // Add current request
  validRequests.push(now);

  await env.KV.put(listKey, JSON.stringify(validRequests), {
    expirationTtl: window
  });

  return true;
}

// 3. Token Bucket
export async function tokenBucketRateLimit(
  key: string,
  rate: number,  // Tokens per second
  capacity: number,  // Max tokens
  env: Env
): Promise<boolean> {
  const now = Date.now();
  const bucketKey = `ratelimit:${key}:bucket`;

  const bucket = await env.KV.get(bucketKey, 'json') as {
    tokens: number;
    lastRefill: number;
  } | null || {
    tokens: capacity,
    lastRefill: now
  };

  // Refill tokens
  const elapsed = (now - bucket.lastRefill) / 1000;
  const tokensToAdd = elapsed * rate;
  bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    return false;
  }

  // Consume token
  bucket.tokens -= 1;

  await env.KV.put(bucketKey, JSON.stringify(bucket), {
    expirationTtl: 3600
  });

  return true;
}
```

### Rate Limit Configuration

```typescript
// ratelimit/config.ts
export const RATE_LIMITS = {
  // Public endpoints
  anonymous: {
    search: { window: 60, max: 20 },      // 20 searches/min
    read: { window: 60, max: 100 },       // 100 reads/min
  },

  // Authenticated users
  user: {
    search: { window: 60, max: 100 },     // 100 searches/min
    read: { window: 60, max: 1000 },      // 1000 reads/min
    write: { window: 60, max: 50 },       // 50 writes/min
  },

  // Admin users
  admin: {
    all: { window: 60, max: 10000 },      // 10K requests/min
  },

  // API keys
  apiKey: {
    free: { window: 86400, max: 1000 },   // 1000/day
    paid: { window: 86400, max: 100000 }, // 100K/day
  }
};
```

---

## Data Protection

### Encryption at Rest

Cloudflare automatically encrypts data at rest:
- **D1 Database:** AES-256 encryption
- **KV Storage:** AES-256 encryption
- **Vectorize:** AES-256 encryption
- **R2 Storage:** AES-256 encryption

No additional configuration needed.

### Encryption in Transit

```typescript
// Force HTTPS
export async function forceHttps(
  request: Request
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.protocol === 'http:') {
    const httpsUrl = url.toString().replace('http:', 'https:');
    return Response.redirect(httpsUrl, 301);
  }

  return null;
}

// Add security headers
export function addSecurityHeaders(
  response: Response
): Response {
  const headers = new Headers(response.headers);

  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
```

### Sensitive Data Handling

```typescript
// utils/redact.ts
export function redactSensitive(data: any): any {
  const REDACTED = '[REDACTED]';

  if (typeof data === 'string') {
    // Check for sensitive patterns
    if (data.includes('password') ||
        data.includes('secret') ||
        data.includes('token') ||
        data.includes('api_key')) {
      return REDACTED;
    }
  }

  if (typeof data === 'object' && data !== null) {
    const redacted: any = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      // Redact sensitive keys
      if (key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('token')) {
        redacted[key] = REDACTED;
      } else {
        redacted[key] = redactSensitive(value);
      }
    }

    return redacted;
  }

  return data;
}

// Usage in logging
console.log(JSON.stringify(redactSensitive(logData)));
```

---

## Secure Communication

### CORS Configuration

```typescript
// middleware/cors.ts
export function handleCors(
  request: Request,
  response: Response
): Response {
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'https://yourdomain.com',
    'https://app.yourdomain.com',
    'http://localhost:3000'  // Development
  ];

  const headers = new Headers(response.headers);

  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '86400');
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  return new Response(response.body, {
    status: response.status,
    headers
  });
}
```

---

## Security Best Practices

### 1. Least Privilege Principle

```typescript
// Grant minimum required permissions
async function createScopedToken(
  userId: string,
  scopes: string[]
): Promise<string> {
  const payload = {
    userId,
    scopes,  // Only requested scopes
    exp: Math.floor(Date.now() / 1000) + (60 * 60)  // 1 hour
  };

  return generateJWT(payload, env.JWT_SECRET);
}
```

### 2. Defense in Depth

```typescript
// Multiple layers of security
async function secureOperation(
  request: Request,
  env: Env
): Promise<Response> {
  // Layer 1: Authentication
  const auth = await authenticate(request, env);
  if (!auth) return unauthorized();

  // Layer 2: Authorization
  if (!hasPermission(auth.user.roles, Permission.WRITE))
    return forbidden();

  // Layer 3: Rate limiting
  if (!await checkRateLimit(auth.user.id, RATE_LIMITS.user.write, env))
    return rateLimited();

  // Layer 4: Input validation
  const body = await request.json();
  const validated = await validateInput(body, writeSchema);

  // Layer 5: Business logic validation
  if (!await canUserWrite(auth.user, validated))
    return forbidden();

  // Process operation...
}
```

### 3. Security Headers

```typescript
// Add to all responses
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
};
```

### 4. Regular Security Audits

```bash
# Run security audits regularly
npm audit
npm audit fix

# Check for dependencies with known vulnerabilities
npm audit --audit-level=moderate

# Update dependencies
npm update
```

---

## Incident Response

### Security Event Types

```typescript
enum SecurityEventType {
  // Authentication
  FAILED_LOGIN = 'failed_login',
  SUSPICIOUS_LOGIN = 'suspicious_login',
  MULTIPLE_FAILED_LOGINS = 'multiple_failed_logins',

  // Authorization
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PRIVILEGE_ESCALATION = 'privilege_escalation',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',

  // Data
  DATA_EXFILTRATION_ATTEMPT = 'data_exfiltration_attempt',
  UNUSUAL_DATA_ACCESS = 'unusual_data_access',

  // API Keys
  API_KEY_LEAK = 'api_key_leak',
  API_KEY_ABUSE = 'api_key_abuse'
}
```

### Alert Thresholds

```typescript
// Security alert configuration
export const SECURITY_THRESHOLDS = {
  FAILED_LOGIN_ATTEMPTS: 5,      // Alert after 5 failed logins
  RATE_LIMIT_VIOLATIONS: 10,     // Alert after 10 violations
  UNUSUAL_ACCESS_PATTERN: 3,     // Alert after 3 unusual patterns
  DATA_ACCESS_SPIKE: 1000,       // Alert after 1000+ record access
  API_KEY_ERRORS: 20             // Alert after 20 errors
};
```

### Response Procedures

1. **Detection:** Automated monitoring triggers alert
2. **Investigation:** Security team investigates within 15 minutes
3. **Containment:** Isolate affected systems
4. **Eradication:** Remove threat
5. **Recovery:** Restore normal operations
6. **Post-Mortem:** Document and learn

---

## Compliance

### Data Protection

- **GDPR Compliance:** Implement user data export/deletion
- **CCPA Compliance:** Implement "Do Not Sell My Data"
- **SOC 2:** Implement access logging and audit trails

### Logging

```typescript
// Security event logging
async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO security_events
    (id, type, user_id, ip_address, user_agent, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    crypto.randomUUID(),
    event.type,
    event.userId || null,
    event.ipAddress,
    event.userAgent,
    JSON.stringify(event.details)
  ).run();
}
```

---

## Next Steps

- **Deployment procedures:** See [Deployment Guide](deployment.md)
- **Monitoring:** See [Operations Guide](operations.md)
- **Maintenance:** See [Maintenance Guide](maintenance.md)

---

**Last Updated:** 2026-01-13
**Version:** 0.1.0
**Maintainer:** Security Team
