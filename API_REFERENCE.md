# PRISM API Reference

Complete API documentation for PRISM semantic code search.

---

## Table of Contents

1. [HTTP API](#http-api)
2. [CLI Commands](#cli-commands)
3. [MCP Tools](#mcp-tools)
4. [Request/Response Formats](#requestresponse-formats)
5. [Error Codes](#error-codes)
6. [Rate Limits](#rate-limits)
7. [Authentication](#authentication)

---

## HTTP API

PRISM exposes a REST-like API via Cloudflare Workers.

### Base URL

```
https://claudes-friend.your-username.workers.dev
```

### Common Headers

```http
Content-Type: application/json
Origin: https://yourdomain.com  # For CORS
```

---

## Endpoints

### 1. Health Check

Check if the service is healthy and operational.

**Endpoint:** `GET /health`

**Request:**
```bash
curl https://your-worker.workers.dev/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-01-14T19:55:18.421Z",
    "version": "0.3.2",
    "environment": "production",
    "vectorize": {
      "dimensions": 384
    },
    "d1_initialized": true
  }
}
```

**Status Codes:**
- `200 OK` - Service is healthy
- `503 Service Unavailable` - Service is down

---

### 2. Index Files

Index one or more files for semantic search.

**Endpoint:** `POST /api/index`

**Request:**
```bash
curl -X POST https://your-worker.workers.dev/api/index \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "path": "src/auth/login.ts",
        "content": "export function login(user, pass) { return auth(user, pass); }",
        "language": "typescript"
      }
    ],
    "options": {
      "incremental": true
    }
  }'
```

**Request Body:**
```typescript
{
  files: Array<{
    path: string;           // File path (required)
    content: string;        // File content (required)
    language?: string;      // Language (auto-detected if omitted)
  }>;
  options?: {
    incremental?: boolean;  // Skip unchanged files (default: true)
  };
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "files": 1,
    "chunks": 3,
    "errors": 0,
    "duration": 234,
    "failedFiles": []
  }
}
```

**Response Fields:**
- `files` - Number of files processed
- `chunks` - Number of code chunks created
- `errors` - Number of errors encountered
- `duration` - Processing time in milliseconds
- `failedFiles` - Array of files that failed to index

**Status Codes:**
- `200 OK` - Indexing completed successfully
- `400 Bad Request` - Invalid request body
- `413 Payload Too Large` - File content exceeds size limit
- `500 Internal Server Error` - Server error

**Errors:**
```json
{
  "success": false,
  "error": "Invalid request body",
  "details": {
    "field": "files[0].content",
    "message": "Content is required"
  }
}
```

---

### 3. Search Code

Search indexed code using semantic similarity.

**Endpoint:** `POST /api/search`

**Request:**
```bash
curl -X POST https://your-worker.workers.dev/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "user authentication flow",
    "limit": 10,
    "minScore": 0.7,
    "filters": {
      "language": "typescript",
      "pathPrefix": "src/auth/"
    }
  }'
```

**Request Body:**
```typescript
{
  query: string;           // Search query (required)
  limit?: number;          // Max results (default: 10, max: 100)
  minScore?: number;       // Min similarity 0-1 (default: 0.0)
  filters?: {
    language?: string;     // Filter by language
    pathPrefix?: string;   // Filter by path prefix
    filePath?: string;     // Filter by file path (supports *)
    createdAfter?: number; // Unix timestamp
    createdBefore?: number; // Unix timestamp
  };
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "user authentication flow",
    "results": [
      {
        "id": "chunk_abc123",
        "filePath": "src/auth/login.ts",
        "content": "export function authenticateUser(credentials) {...}",
        "score": 0.92,
        "language": "typescript",
        "startLine": 25,
        "endLine": 40,
        "checksum": "a3f2..."
      }
    ],
    "total": 15,
    "duration": 234
  }
}
```

**Response Fields:**
- `query` - Original search query
- `results` - Array of matching code chunks
- `total` - Total number of matches found
- `duration` - Search time in milliseconds

**Result Object:**
- `id` - Unique chunk identifier
- `filePath` - Path to source file
- `content` - Code chunk content
- `score` - Similarity score (0-1)
- `language` - Programming language
- `startLine` - Starting line number
- `endLine` - Ending line number
- `checksum` - SHA-256 checksum of original file

**Status Codes:**
- `200 OK` - Search completed successfully
- `400 Bad Request` - Invalid query
- `500 Internal Server Error` - Server error

---

### 4. Get Statistics

Get index statistics and metadata.

**Endpoint:** `GET /api/stats`

**Request:**
```bash
curl https://your-worker.workers.dev/api/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "files": 67,
    "chunks": 549,
    "lastIndexed": "2026-01-14T19:55:38.000Z",
    "languages": {
      "typescript": 45,
      "javascript": 12,
      "python": 10
    },
    "vectorize": {
      "dimensions": 384,
      "count": 549
    },
    "storage": {
      "d1_size": 4200000,
      "vectorize_size": 842256
    }
  }
}
```

**Response Fields:**
- `files` - Total number of indexed files
- `chunks` - Total number of code chunks
- `lastIndexed` - Timestamp of last indexing operation
- `languages` - Breakdown by language
- `vectorize` - Vectorize index info
- `storage` - Storage usage in bytes

**Status Codes:**
- `200 OK` - Statistics retrieved successfully
- `500 Internal Server Error` - Server error

---

## CLI Commands

### prism index

Index files or directories.

```bash
prism index [path] [options]
```

**Arguments:**
- `path` - File or directory to index (default: current directory)

**Options:**
```
-i, --incremental     Skip unchanged files (faster)
-f, --force          Force full reindex
-e, --extensions     File extensions to index (comma-separated)
-x, --exclude        Patterns to exclude (comma-separated)
-v, --verbose        Verbose output
--format json        JSON output
--max-size N         Maximum file size in MB (default: 1)
```

**Examples:**
```bash
# Index current directory
prism index

# Index specific path
prism index ./src

# Incremental index
prism index ./src --incremental

# Custom extensions
prism index ./src --extensions .ts,.tsx,.vue

# Exclude patterns
prism index ./src --exclude node_modules,dist,test

# JSON output
prism index ./src --format json

# Verbose mode
prism index ./src --verbose
```

**Output (text):**
```
Indexing src/...
✓ Processed 67 files
✓ Created 549 chunks
✓ Generated embeddings
✓ Indexed in Vectorize

Duration: 8.2s
```

**Output (JSON):**
```json
{
  "success": true,
  "stats": {
    "filesProcessed": 67,
    "chunksCreated": 549,
    "duration": 8200,
    "filesSkipped": 0
  }
}
```

---

### prism search

Search indexed code semantically.

```bash
prism search <query> [options]
```

**Arguments:**
- `query` - Search query (required)

**Options:**
```
-l, --limit N         Max results (default: 10, max: 100)
-s, --min-score N     Minimum similarity 0-1 (default: 0)
--lang LANGUAGE       Filter by language
--path PREFIX         Filter by path prefix
--format FORMAT       Output format: text, json, markdown
--save               Save search to favorites
```

**Examples:**
```bash
# Basic search
prism search "authentication flow"

# Limit results
prism search "database queries" --limit 20

# Set minimum score
prism search "error handling" --min-score 0.7

# Filter by language
prism search "async functions" --lang typescript

# Filter by path
prism search "API routes" --path src/api/

# JSON output
prism search "auth" --format json

# Save to favorites
prism search "user login" --save
```

**Output (text):**
```
Found 3 results for "authentication flow"

1. src/auth/login.ts:25-40 (score: 0.85)
   Language: typescript

   export function authenticateUser(credentials: Credentials) {
     const user = await database.users.findByEmail(credentials.email);
     if (!user) {
       throw new AuthenticationError('Invalid credentials');
     }
     return verifyPassword(user, credentials.password);
   }

2. src/auth/session.ts:10-25 (score: 0.72)
   ...
```

**Output (JSON):**
```json
{
  "query": "authentication flow",
  "results": [
    {
      "filePath": "src/auth/login.ts",
      "content": "export function authenticateUser...",
      "score": 0.85,
      "language": "typescript",
      "startLine": 25,
      "endLine": 40
    }
  ],
  "total": 3,
  "duration": 234
}
```

---

### prism stats

Show index statistics.

```bash
prism stats [options]
```

**Options:**
```
--format FORMAT    Output format: text, json
```

**Examples:**
```bash
# Show stats
prism stats

# JSON format
prism stats --format json
```

**Output:**
```
PRISM Statistics

Files indexed    67
Chunks created   549
Last indexed     1/14/2026, 7:55:38 PM
```

---

### prism health

Check service health.

```bash
prism health
```

**Output:**
```
Status: healthy
Version: 0.3.2
Vectorize: dimensions=384
D1: initialized
```

---

### prism history

View search history.

```bash
prism history [options]
```

**Options:**
```
-l, --limit N      Number of entries to show (default: 10)
-c, --clear        Clear history
```

**Examples:**
```bash
# View history
prism history

# Last 20 searches
prism history --limit 20

# Clear history
prism history --clear
```

---

### prism favorites

Manage favorite searches.

```bash
prism favorites [options]
```

**Options:**
```
-r, --run ID       Run a favorite search
-d, --remove ID    Remove a favorite
```

**Examples:**
```bash
# List favorites
prism favorites

# Run favorite
prism favorites --run abc123

# Remove favorite
prism favorites --remove abc123
```

---

### prism suggest

Get query suggestions.

```bash
prism suggest [prefix]
```

**Examples:**
```bash
# All suggestions
prism suggest

# Suggestions starting with "auth"
prism suggest auth
```

---

## MCP Tools

PRISM provides Model Context Protocol (MCP) tools for integration with Claude Code.

### Tool 1: search_repo

Search codebase using semantic similarity.

**Tool Name:** `search_repo`

**Input Schema:**
```typescript
{
  query: string;           // Search query (required)
  limit?: number;          // Max results (default: 10)
  threshold?: number;      // Min similarity 0-1 (default: 0.7)
  extensions?: string[];   // Filter by extensions
  exclude?: string[];      // Paths to exclude
}
```

**Example:**
```json
{
  "query": "authentication middleware",
  "limit": 20,
  "threshold": 0.8,
  "extensions": [".ts", ".js"]
}
```

**Output:**
```json
{
  "results": [
    {
      "filePath": "src/auth/middleware.ts",
      "score": 0.94,
      "snippet": "export function authMiddleware(req, res, next) {...}",
      "lineRange": [12, 22]
    }
  ],
  "query": "authentication middleware",
  "totalResults": 8,
  "searchTime": 156
}
```

---

### Tool 2: optimize_context

Optimize code context for token efficiency.

**Tool Name:** `optimize_context`

**Input Schema:**
```typescript
{
  query: string;           // Current task or question (required)
  maxTokens?: number;      // Token budget (default: 50000)
  budget?: number;         // Alias for maxTokens
}
```

**Example:**
```json
{
  "query": "How does the user authentication flow work?",
  "maxTokens": 30000
}
```

**Output:**
```json
{
  "selectedFiles": [
    {
      "filePath": "src/auth/login.ts",
      "relevanceScore": 0.95,
      "estimatedTokens": 2341,
      "reason": "Contains login function and password verification"
    }
  ],
  "totalTokens": 5740,
  "budgetUsed": 19.1,
  "estimatedCoverage": 0.94,
  "confidence": 0.92
}
```

---

### Tool 3: get_usage_stats

Get token usage statistics.

**Tool Name:** `get_usage_stats`

**Input Schema:**
```typescript
{
  period?: 'session' | 'today' | 'week' | 'all';  // Default: 'session'
}
```

**Example:**
```json
{
  "period": "session"
}
```

**Output:**
```json
{
  "session": {
    "totalQueries": 23,
    "totalTokensUsed": 45678,
    "totalTokensSaved": 387432,
    "averageSavings": 89.5,
    "costSaved": 1.16
  },
  "modelDistribution": {
    "ollama": 15,
    "haiku": 5,
    "sonnet": 3,
    "opus": 0
  }
}
```

---

## Request/Response Formats

### Standard Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Standard Error Response

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error information
  }
}
```

### Pagination

Not currently supported. Use `limit` parameter for result limits.

### Filtering

Filters are applied via query parameters or request body:

**Query Parameters:**
```
GET /api/search?q=auth&limit=10&lang=typescript
```

**Request Body:**
```json
{
  "query": "auth",
  "limit": 10,
  "filters": {
    "language": "typescript"
  }
}
```

---

## Error Codes

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `200` | OK | Request successful |
| `400` | Bad Request | Invalid request parameters |
| `401` | Unauthorized | Authentication required |
| `403` | Forbidden | Access denied |
| `404` | Not Found | Resource not found |
| `413` | Payload Too Large | Request body too large |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |
| `503` | Service Unavailable | Service temporarily down |

### Application Error Codes

| Code | Name | Description |
|------|------|-------------|
| `PRISM_001` | NetworkError | Network connectivity issue |
| `PRISM_002` | AuthError | Authentication failed |
| `PRISM_003` | QuotaExceeded | Rate limit exceeded |
| `PRISM_004` | ParseError | Code parsing failed |
| `PRISM_005` | StorageError | Database access failed |
| `PRISM_006` | EmbeddingError | Embedding generation failed |
| `PRISM_007` | ValidationError | Invalid input |
| `PRISM_008` | IndexNotFound | No index found |
| `PRISM_009` | UnsupportedLanguage | Language not supported |
| `PRISM_010` | VectorSearchFailed | Vector search failed |
| `PRISM_011` | FileTooLarge | File exceeds size limit |
| `PRISM_012` | InvalidConfig | Invalid configuration |

### Error Response Example

```json
{
  "success": false,
  "error": "Embedding generation failed",
  "code": "PRISM_006",
  "details": {
    "model": "@cf/baai/bge-small-en-v1.5",
    "reason": "Workers AI quota exceeded"
  },
  "suggestions": [
    "Wait for quota reset (midnight UTC)",
    "Check Cloudflare dashboard for usage"
  ]
}
```

---

## Rate Limits

### Cloudflare Free Tier

PRISM respects Cloudflare's free tier limits:

| Resource | Limit | Period |
|----------|-------|--------|
| Worker Requests | 100,000 | Per day |
| Workers AI Embeddings | 10,000 | Per day |
| D1 Reads | 5,000,000 | Per day |
| D1 Writes | 100,000 | Per day |
| KV Reads | 100,000 | Per day |
| KV Writes | 1,000 | Per day |

### Rate Limit Headers

Responses include rate limit information:

```http
X-RateLimit-Limit: 100000
X-RateLimit-Remaining: 95432
X-RateLimit-Reset: 1705276800
```

### Handling Rate Limits

When rate limited, the API returns:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "PRISM_003",
  "details": {
    "limit": 100000,
    "used": 100523,
    "resetTime": "2026-01-15T00:00:00Z"
  }
}
```

**Retry Strategy:**
1. Wait for reset time (provided in response)
2. Implement exponential backoff
3. Cache results to reduce API calls

---

## Authentication

### Current Implementation

PRISM currently does not require authentication for self-hosted deployments. All requests are authenticated via:

1. **Origin Validation** - CORS headers validate request origin
2. **Worker URL** - Your deployed worker URL is private

### Future Authentication

Planned authentication methods:

1. **API Keys** - Generate keys in dashboard
2. **JWT Tokens** - OAuth 2.0 compatible
3. **Cloudflare Access** - Enterprise SSO integration

### CORS

CORS is configured in the worker:

```typescript
// Allowed origins (configure in wrangler.toml)
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://yourdomain.com'
];
```

**CORS Headers:**
```http
Access-Control-Allow-Origin: https://yourdomain.com
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 86400
```

---

## Best Practices

### 1. Use Incremental Indexing

```bash
# Fast: Only indexes changed files
prism index ./src --incremental
```

### 2. Set Appropriate Score Thresholds

```bash
# Only return highly relevant results
prism search "auth" --min-score 0.7
```

### 3. Limit Result Counts

```bash
# Get top 5 results for faster responses
prism search "database" --limit 5
```

### 4. Use Filters

```bash
# Narrow search scope for better relevance
prism search "error" --lang typescript --path src/
```

### 5. Cache Results

```javascript
// Cache search results client-side
const cache = new Map();
const cacheKey = `${query}-${filters}`;
if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
const results = await search(query, filters);
cache.set(cacheKey, results);
```

### 6. Handle Errors Gracefully

```javascript
try {
  const results = await prism.search(query);
} catch (error) {
  if (error.code === 'PRISM_003') {
    // Rate limit - retry later
    await sleep(60000);
    return prism.search(query);
  }
  throw error;
}
```

---

## SDK Examples

### Node.js

```javascript
const PRISM_URL = process.env.PRISM_URL;

async function search(query) {
  const response = await fetch(`${PRISM_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit: 10 })
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error);
  }

  return data.data.results;
}

// Usage
const results = await search('authentication');
console.log(results);
```

### Python

```python
import os
import requests

PRISM_URL = os.environ.get('PRISM_URL')

def search(query, limit=10):
    response = requests.post(
        f'{PRISM_URL}/api/search',
        json={'query': query, 'limit': limit}
    )
    data = response.json()

    if not data['success']:
        raise Exception(data['error'])

    return data['data']['results']

# Usage
results = search('authentication')
print(results)
```

### cURL

```bash
# Search
curl -X POST $PRISM_URL/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"auth","limit":10}'

# Index
curl -X POST $PRISM_URL/api/index \
  -H "Content-Type: application/json" \
  -d '{
    "files": [{
      "path": "src/test.ts",
      "content": "export function test() { return true; }"
    }]
  }'
```

---

## Changelog

### v0.3.2 (2026-01-14)
- Added structured logging
- Improved error handling
- Enhanced CORS security
- Better type safety

### v0.3.1 (2026-01-14)
- Added comprehensive JSDoc comments
- Improved validation
- Parallelized embedding generation
- Better error messages

### v0.3.0 (2026-01-14)
- Initial Vectorize integration
- Fast ANN vector search
- Hybrid storage (Vectorize + D1)
- CLI tool with history and favorites

---

## Support

- **Documentation:** [docs/](./docs/)
- **Issues:** [github.com/SuperInstance/prism/issues](https://github.com/SuperInstance/prism/issues)
- **Discussions:** [github.com/SuperInstance/prism/discussions](https://github.com/SuperInstance/prism/discussions)

---

**Last Updated:** 2026-01-15
**Version:** 0.3.2
