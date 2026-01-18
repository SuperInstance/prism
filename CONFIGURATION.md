# PRISM Configuration Guide

Complete guide to configuring PRISM for optimal performance.

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Variables](#environment-variables)
3. [Worker Configuration](#worker-configuration)
4. [File Patterns](#file-patterns)
5. [Performance Tuning](#performance-tuning)
6. [Language-Specific Settings](#language-specific-settings)
7. [Advanced Options](#advanced-options)
8. [Examples](#examples)

---

## Overview

PRISM can be configured at multiple levels:

1. **Environment Variables** - Shell-level configuration
2. **Worker Config** (`wrangler.toml`) - Worker behavior and resources
3. **CLI Options** - Per-command configuration
4. **File Patterns** - What files to index
5. **Runtime Settings** - Performance and optimization

---

## Environment Variables

Set these in your shell or shell profile (`.bashrc`, `.zshrc`, etc.)

### Required Variables

#### PRISM_URL

Your deployed Cloudflare Worker URL.

```bash
export PRISM_URL=https://claudes-friend.your-username.workers.dev
```

**How to find:**
1. Deploy worker: `npm run deploy`
2. Copy URL from deployment output
3. Or check Cloudflare Dashboard > Workers & Pages

**Usage:**
```bash
# Add to shell profile
echo 'export PRISM_URL=https://your-worker.workers.dev' >> ~/.bashrc
source ~/.bashrc

# Verify
echo $PRISM_URL
prism health
```

---

### Optional Variables

#### CLOUDFLARE_ACCOUNT_ID

Your Cloudflare account ID.

```bash
export CLOUDFLARE_ACCOUNT_ID=your-account-id
```

**How to find:**
```bash
wrangler whoami
# Or Cloudflare Dashboard > Workers & Pages > Overview
```

**When needed:**
- Multiple Cloudflare accounts
- CI/CD pipelines
- Automated deployments

---

#### CLOUDFLARE_API_TOKEN

API token for Cloudflare API access.

```bash
export CLOUDFLARE_API_TOKEN=your-api-token
```

**How to create:**
1. Cloudflare Dashboard > My Profile > API Tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Copy token

**Permissions needed:**
- Workers: Edit
- D1: Edit
- Vectorize: Edit
- KV: Edit

**Security:**
```bash
# Store securely
echo "export CLOUDFLARE_API_TOKEN=xxx" >> ~/.bashrc.private
source ~/.bashrc.private

# Or use password manager
# Or use CI/CD secrets
```

---

#### NODE_ENV

Node.js environment.

```bash
export NODE_ENV=production  # or development, test
```

**Values:**
- `production` - Production settings
- `development` - Development settings, more logging
- `test` - Test settings, mock data

---

#### LOG_LEVEL

Logging verbosity.

```bash
export LOG_LEVEL=info  # debug, info, warn, error
```

**Levels:**
- `debug` - Everything (very verbose)
- `info` - Normal operations (default)
- `warn` - Warnings only
- `error` - Errors only

---

## Worker Configuration

Configure worker behavior in `wrangler.toml`.

### Basic Settings

```toml
# Worker name (appears in Cloudflare Dashboard)
name = "claudes-friend"

# Main entry point
main = "src/worker-vectorize.ts"

# Compatibility date
compatibility_date = "2024-12-01"

# Node.js compatibility
compatibility_flags = ["nodejs_compat_v2"]
```

---

### Resource Bindings

#### D1 Database

```toml
[[d1_databases]]
binding = "DB"
database_name = "claudes-friend-db"
database_id = "your-database-id"
```

**Create database:**
```bash
wrangler d1 create claudes-friend-db
# Copy database_id from output
```

**Run migrations:**
```bash
wrangler d1 execute claudes-friend-db --file=./migrations/002_vector_index.sql
```

---

#### Vectorize Index

```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "claudes-friend-index"
remote = true  # Always use remote
```

**Create index:**
```bash
wrangler vectorize create claudes-friend-index \
  --dimensions=384 \
  --metric=cosine
```

**Check status:**
```bash
wrangler vectorize list
wrangler vectorize get claudes-friend-index
```

---

#### KV Namespace

```toml
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"
```

**Create namespace:**
```bash
wrangler kv:namespace create PRISM_INDEX
# Copy id from output
```

**Usage:**
- Embedding cache
- Search history
- Query suggestions

---

#### R2 Bucket

```toml
[[r2_buckets]]
binding = "R2"
bucket_name = "claudes-friend-storage"
```

**Create bucket:**
```bash
wrangler r2 bucket create claudes-friend-storage
```

**Usage:**
- Store raw files (optional)
- Backup index data
- Large file storage

---

#### Workers AI

```toml
[ai]
binding = "AI"
remote = true  # Always use remote
```

**No setup needed** - automatically available with Cloudflare account.

**Usage:**
- Generate embeddings
- Text analysis
- Semantic search

---

### Environment Variables (Worker)

```toml
[vars]
# Environment name
ENVIRONMENT = "production"

# Logging level
LOG_LEVEL = "info"

# AI model for embeddings
EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5"

# Default limits
MAX_TOKENS = "2048"
TEMPERATURE = "0.7"

# Free tier limits (for monitoring)
MAX_NEURONS_PER_DAY = "10000"
MAX_REQUESTS_PER_DAY = "100000"
```

**Available embedding models:**
- `@cf/baai/bge-small-en-v1.5` - 384d, fast, good quality (recommended)
- `@cf/baai/bge-base-en-v1.5` - 768d, slower, better quality
- `@cf/baai/bge-large-en-v1.5` - 1024d, slowest, best quality

---

### Environment-Specific Config

#### Development

```toml
[env.development]
name = "claudes-friend-dev"

[env.development.vars]
ENVIRONMENT = "development"
LOG_LEVEL = "debug"
```

**Usage:**
```bash
wrangler deploy --env development
```

---

#### Testing

```toml
[env.test]
name = "claudes-friend-test"

[env.test.vars]
ENVIRONMENT = "test"
LOG_LEVEL = "error"
```

**Usage:**
```bash
wrangler deploy --env test
npm test
```

---

#### Production

```toml
# Default environment (no [env.xxx] prefix)
name = "claudes-friend"

[vars]
ENVIRONMENT = "production"
LOG_LEVEL = "info"
```

**Usage:**
```bash
npm run deploy
# Or: wrangler deploy
```

---

## File Patterns

### Included Extensions

Default file extensions that are indexed:

```javascript
const EXTENSIONS = [
  '.ts',    // TypeScript
  '.tsx',   // TypeScript + JSX
  '.js',    // JavaScript
  '.jsx',   // JavaScript + JSX
  '.py',    // Python
  '.rs',    // Rust
  '.go',    // Go
  '.java',  // Java
  '.c',     // C
  '.cpp',   // C++
  '.h',     // C/C++ headers
  '.cs',    // C#
  '.php',   // PHP
  '.rb',    // Ruby
  '.kt',    // Kotlin
  '.swift', // Swift
  '.sh',    // Shell
  '.bash',  // Bash
  '.zsh',   // Zsh
  '.yaml',  // YAML
  '.yml',   // YAML
  '.json',  // JSON
  '.md',    // Markdown
];
```

**Customize:**
```bash
# Index only TypeScript
prism index ./src --extensions .ts,.tsx

# Add custom extensions
prism index ./src --extensions .ts,.tsx,.vue,.svelte
```

---

### Excluded Patterns

Default patterns that are skipped:

```javascript
const SKIP_PATTERNS = [
  // Test files
  '.test.',
  '.spec.',
  '.mock.',

  // Dependencies
  'node_modules',
  'vendor',
  'bower_components',

  // Build outputs
  'dist',
  'build',
  '.next',
  'out',
  'coverage',

  // Version control
  '.git',
  '.svn',
  '.hg',

  // IDE
  '.vscode',
  '.idea',
  '.DS_Store',
];
```

**Customize:**
```bash
# Exclude specific patterns
prism index ./src --exclude test,dist,node_modules

# Exclude with glob patterns
prism index ./src --exclude "**/*.test.ts" --exclude "**/*.spec.ts"
```

---

### .prismignore File

Create a `.prismignore` file in your project root:

```bash
# .prismignore
# Similar to .gitignore

# Dependencies
node_modules/
vendor/

# Build outputs
dist/
build/
*.min.js
*.bundle.js

# Tests
**/*.test.ts
**/*.spec.ts
**/*.mock.ts
coverage/

# Docs
docs/
*.md

# Config
*.config.js
*.config.ts

# Large files
data/
*.csv
*.json
```

**Usage:**
```bash
# PRISM automatically reads .prismignore
prism index ./src
```

---

## Performance Tuning

### Embedding Cache

Cache embeddings to avoid regenerating for unchanged content.

**Configuration:**
```toml
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"
```

**Cache behavior:**
- Automatic caching based on content hash
- TTL: 30 days
- Hit rate: 70-80% typical

**Clear cache:**
```bash
# List keys
wrangler kv:key list --binding=KV --namespace-id=your-kv-id

# Delete specific key
wrangler kv:key delete "embedding:hash" --namespace-id=your-kv-id

# Bulk delete (clear cache)
wrangler kv:key list --namespace-id=your-kv-id | \
  jq -r '.[].name' | \
  xargs -I {} wrangler kv:key delete {} --namespace-id=your-kv-id
```

---

### Incremental Indexing

Skip unchanged files using SHA-256 checksums.

**Enable:**
```bash
prism index ./src --incremental
```

**Performance:**
- First index: ~8s for 67 files
- Incremental: ~0.4s (21x faster)
- Only indexes changed files

**How it works:**
1. Calculate SHA-256 for each file
2. Check if checksum exists in database
3. Skip if unchanged
4. Index only new/changed files

---

### Batch Size

Control how many files are processed at once.

**Default:** 10 files per batch

**Adjust:**
```javascript
// In prism-cli.js
const BATCH_SIZE = 20;  // Process 20 files at once
```

**Trade-offs:**
- Larger batches: Faster but more memory
- Smaller batches: Slower but less memory

---

### Vectorize Settings

```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "claudes-friend-index"

# Dimensions (must match embedding model)
# bge-small-en-v1.5 = 384
# bge-base-en-v1.5 = 768
# bge-large-en-v1.5 = 1024

# Metric (similarity calculation)
# cosine = cosine similarity (recommended)
# euclidean = euclidean distance
# dot = dot product
```

**Create with options:**
```bash
wrangler vectorize create my-index \
  --dimensions=384 \
  --metric=cosine
```

---

### Search Optimization

#### Limit Results

```bash
# Get fewer results for faster response
prism search "auth" --limit 5

# Default is 10, max is 100
prism search "auth" --limit 100
```

#### Set Score Threshold

```bash
# Only return high-confidence matches
prism search "auth" --min-score 0.7

# Lower threshold for more results
prism search "auth" --min-score 0.5
```

#### Use Filters

```bash
# Reduce search space
prism search "database" --lang typescript --path src/db/
```

---

## Language-Specific Settings

### TypeScript

```bash
# Index TypeScript files
prism index ./src --extensions .ts,.tsx

# Exclude type definitions
prism index ./src --exclude "**/*.d.ts"

# Include tests
prism index ./src  # Tests excluded by default
```

**Recommended:**
- Include: `.ts`, `.tsx`
- Exclude: `.d.ts` (type definitions), `.test.ts`, `.spec.ts`

---

### JavaScript

```bash
# Index JavaScript files
prism index ./src --extensions .js,.jsx

# Exclude minified
prism index ./src --exclude "**/*.min.js"
```

**Recommended:**
- Include: `.js`, `.jsx`
- Exclude: `.min.js`, `.bundle.js`, `dist/`

---

### Python

```bash
# Index Python files
prism index ./src --extensions .py

# Exclude virtual env
prism index ./src --exclude venv,__pycache__
```

**Recommended:**
- Include: `.py`
- Exclude: `venv/`, `__pycache__/`, `.pyc`

---

### Rust

```bash
# Index Rust files
prism index ./src --extensions .rs

# Include Cargo.toml
prism index ./src --extensions .rs,.toml
```

**Recommended:**
- Include: `.rs`
- Exclude: `target/`

---

### Go

```bash
# Index Go files
prism index ./src --extensions .go

# Exclude vendor
prism index ./src --exclude vendor
```

**Recommended:**
- Include: `.go`
- Exclude: `vendor/`

---

### Multi-Language Projects

```bash
# Index multiple languages
prism index ./src --extensions .ts,.py,.go,.rs

# Exclude language-specific files
prism index ./src \
  --exclude node_modules \
  --exclude venv \
  --exclude target \
  --exclude vendor
```

---

## Advanced Options

### Custom Embedding Model

Change the embedding model for different quality/speed trade-offs.

**Edit `wrangler.toml`:**
```toml
[vars]
# Fast, good quality (default)
EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5"

# Better quality, slower
# EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5"

# Best quality, slowest
# EMBEDDING_MODEL = "@cf/baai/bge-large-en-v1.5"
```

**Note:** Changing models requires:
1. Updating Vectorize dimensions
2. Reindexing all files
3. More quota usage

---

### Custom Chunking

Adjust how code is split into chunks.

**Default:** Tree-sitter-based chunking (50 lines per chunk)

**Customize (in code):**
```typescript
// src/shared/utils.ts
export const CONFIG = {
  CHUNK_SIZE: 50,        // Lines per chunk
  CHUNK_OVERLAP: 5,      // Overlap between chunks
  MAX_CHUNK_SIZE: 100,   // Maximum lines
};
```

**Trade-offs:**
- Smaller chunks: More granular, more storage
- Larger chunks: More context, less granular

---

### CORS Configuration

Control which origins can access your worker.

**Edit `src/worker-vectorize.ts`:**
```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  'https://yourdomain.com',
  'https://app.yourdomain.com',
];
```

**Wildcard (not recommended):**
```typescript
const ALLOWED_ORIGINS = ['*'];
```

---

### Rate Limiting

Implement custom rate limiting (not built-in).

**Example:**
```typescript
// In worker
const rateLimit = async (env: Env, identifier: string) => {
  const key = `ratelimit:${identifier}`;
  const count = await env.KV.get(key);

  if (count && parseInt(count) > 100) {
    throw new Error('Rate limit exceeded');
  }

  await env.KV.put(key, String((parseInt(count || '0') + 1)), {
    expirationTtl: 60  // 1 minute
  });
};
```

---

### Custom Logging

Structured logging with log levels.

**Configuration:**
```toml
[vars]
LOG_LEVEL = "info"  # debug, info, warn, error
```

**Usage in worker:**
```typescript
import { createLogger } from './shared/utils.js';

const logger = createLogger('MyComponent');

logger.debug('Debug message', { data });
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', { error });
```

---

### Observability

Enable analytics and monitoring.

**Edit `wrangler.toml`:**
```toml
[observability]
enabled = true

# Log forwarding (optional)
# logpush = true
```

**View analytics:**
- Cloudflare Dashboard > Workers & Pages > Analytics

**Metrics:**
- Requests per second
- Errors
- CPU time
- Success rate

---

## Examples

### Example 1: TypeScript Monorepo

```bash
# .prismignore
node_modules/
dist/
coverage/
**/*.test.ts
**/*.spec.ts
*.d.ts

# Index
prism index ./packages --extensions .ts,.tsx --incremental

# Search
prism search "API endpoints" --lang typescript --path packages/api/
```

---

### Example 2: Python Data Science Project

```bash
# .prismignore
venv/
__pycache__/
*.pyc
.ipynb_checkpoints/
data/
*.csv
*.parquet

# Index
prism index ./src --extensions .py --exclude notebooks

# Search
prism search "data preprocessing" --lang python
```

---

### Example 3: Full-Stack App

```bash
# .prismignore
node_modules/
dist/
build/
.next/
coverage/
**/*.test.*
**/*.spec.*

# Index frontend
prism index ./frontend --extensions .ts,.tsx --incremental

# Index backend
prism index ./backend --extensions .py,.ts --incremental

# Search
prism search "authentication" --lang typescript,python
```

---

### Example 4: Microservices

```bash
# Index each service
prism index ./services/auth --path services/auth/
prism index ./services/api --path services/api/
prism index ./services/database --path services/database/

# Search specific service
prism search "user validation" --path services/auth/

# Search all services
prism search "logging"
```

---

### Example 5: CI/CD Pipeline

```yaml
# .github/workflows/index.yml
name: Index Codebase

on:
  push:
    branches: [main]

jobs:
  index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install PRISM
        run: npm install -g @claudes-friend/prism

      - name: Index codebase
        env:
          PRISM_URL: ${{ secrets.PRISM_URL }}
        run: prism index ./src --incremental
```

---

## Configuration Checklist

### Initial Setup

- [ ] Install Node.js 18+
- [ ] Install Wrangler
- [ ] Create Cloudflare account
- [ ] Deploy PRISM worker
- [ ] Set `PRISM_URL` environment variable
- [ ] Test with `prism health`

### Worker Setup

- [ ] Create D1 database
- [ ] Create Vectorize index
- [ ] Create KV namespace
- [ ] Run database migrations
- [ ] Configure `wrangler.toml`
- [ ] Deploy worker
- [ ] Verify all bindings work

### Optimization

- [ ] Enable incremental indexing
- [ ] Configure embedding cache
- [ ] Set up `.prismignore`
- [ ] Adjust chunk sizes (if needed)
- [ ] Configure CORS (if using API)
- [ ] Enable observability

### Testing

- [ ] Index test codebase
- [ ] Verify search results
- [ ] Check statistics
- [ ] Monitor performance
- [ ] Test error handling

---

## Best Practices

1. **Use incremental indexing** for faster updates
2. **Exclude test files** unless specifically needed
3. **Set appropriate score thresholds** (0.7+ recommended)
4. **Monitor quota usage** in Cloudflare Dashboard
5. **Cache search results** client-side when possible
6. **Use filters** to narrow search scope
7. **Version your configuration** in git
8. **Document custom settings** for your team
9. **Test configuration changes** in development first
10. **Monitor performance** and adjust as needed

---

## Troubleshooting Configuration

### Check Current Configuration

```bash
# Environment variables
env | grep PRISM

# Worker configuration
cat wrangler.toml

# Test configuration
prism health
prism stats
```

### Validate Configuration

```bash
# Validate wrangler.toml
wrangler deploy --dry-run

# Test bindings
wrangler d1 list
wrangler vectorize list
wrangler kv:namespace list
```

### Reset Configuration

```bash
# Clear environment
unset PRISM_URL

# Reset worker config
git checkout wrangler.toml

# Redeploy
npm run deploy
```

---

## Next Steps

- **User Guide** - [USER_GUIDE.md](./USER_GUIDE.md)
- **API Reference** - [API_REFERENCE.md](./API_REFERENCE.md)
- **Troubleshooting** - [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Architecture** - [docs/architecture/](./docs/architecture/)

---

**Last Updated:** 2026-01-15
**Version:** 0.3.2

Need help? Check [Troubleshooting](./TROUBLESHOOTING.md) or [open an issue](https://github.com/SuperInstance/prism/issues).
