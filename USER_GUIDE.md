# PRISM User Guide

Complete guide to using PRISM for semantic code search.

---

## Table of Contents

1. [What is PRISM?](#what-is-prism)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Basic Usage](#basic-usage)
5. [Advanced Features](#advanced-features)
6. [Configuration](#configuration)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## What is PRISM?

PRISM is a **semantic code search engine** that helps you find code by **meaning**, not just keywords. Instead of grepping for exact matches, PRISM understands what your code does and returns the most relevant results.

### Key Benefits

- **Find code by meaning** - Search "user login flow" and find authentication code even if those exact words don't appear
- **Blazing fast** - Search 100K+ code chunks in under 400ms
- **90% token savings** - Only send relevant code to AI assistants like Claude
- **Zero infrastructure** - Runs on Cloudflare's free tier forever

### How It Works

1. **Index** - PRISM breaks your code into intelligent chunks
2. **Vectorize** - Each chunk is converted into a 384-dimensional vector (embedding)
3. **Search** - When you search, PRISM finds chunks with similar meaning
4. **Optimize** - Only the most relevant chunks are returned

---

## Installation

### Prerequisites

- **Node.js 18+** ([Download here](https://nodejs.org/))
- **Free Cloudflare account** ([Sign up](https://dash.cloudflare.com/sign-up))

### Method 1: NPM Global Install (Recommended)

```bash
# Install PRISM globally
npm install -g @claudes-friend/prism

# Verify installation
prism --version
```

### Method 2: Clone and Install from Source

```bash
# Clone the repository
git clone https://github.com/SuperInstance/prism.git
cd prism

# Install dependencies
npm install

# Link globally
npm link

# Verify installation
prism --version
```

### Method 3: Run without Installing

```bash
# Use npx to run without installing
npx @claudes-friend/prism index ./src
npx @claudes-friend/prism search "authentication"
```

### Setting Up Cloudflare

PRISM requires Cloudflare Workers for embedding generation and vector storage.

```bash
# Install Wrangler (Cloudflare CLI)
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

This opens your browser to authorize the CLI. Click "Authorize" and you're done!

### Deploy PRISM Worker

```bash
# Navigate to PRISM directory
cd prism

# Deploy to Cloudflare
npm run deploy
```

This automatically:
- ✅ Creates a D1 database for metadata
- ✅ Creates a Vectorize index for vector search
- ✅ Deploys the Worker to Cloudflare's edge
- ✅ Runs database migrations

**Cost: $0/month** on Cloudflare's free tier

---

## Quick Start

Get up and running in 5 minutes.

### Step 1: Set Worker URL

After deployment, set your worker URL:

```bash
# Your worker URL from deployment output
export PRISM_URL=https://claudes-friend.your-username.workers.dev
```

Or add to your shell profile:

```bash
# ~/.bashrc or ~/.zshrc
echo 'export PRISM_URL=https://claudes-friend.your-username.workers.dev' >> ~/.bashrc
source ~/.bashrc
```

### Step 2: Index Your Code

```bash
# Index current directory
prism index ./src

# Or index specific files
prism index src/auth.ts src/database.ts
```

**Output:**
```
Indexing src/...
✓ Processed 67 files
✓ Created 549 chunks
✓ Generated embeddings
✓ Indexed in Vectorize

Duration: 8.2s
```

### Step 3: Search Your Code

```bash
# Semantic search
prism search "user authentication flow"
```

**Output:**
```
Found 3 results for "user authentication flow"

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

### Step 4: Use with Claude

Copy the search results and paste into Claude for perfect context.

---

## Basic Usage

### Indexing Files

#### Index a Directory

```bash
# Index all supported files in a directory
prism index ./src

# Index with specific extensions
prism index ./src --extensions .ts,.tsx,.js

# Exclude directories
prism index ./src --exclude node_modules,dist,test
```

#### Incremental Indexing

PRISM automatically skips unchanged files using SHA-256 checksums:

```bash
# First index (slow)
prism index ./src
# → Indexes 67 files (8.2s)

# Second index (fast - only changed files)
prism index ./src --incremental
# → Skipped 65 files, indexed 2 changed files (0.4s)
# → 21x faster!
```

#### Index Specific Files

```bash
# Index one file
prism index src/auth/login.ts

# Index multiple files
prism index src/auth/login.ts src/auth/session.ts src/database/users.ts
```

### Searching Code

#### Basic Search

```bash
# Natural language search
prism search "how do users log in?"

# Technical search
prism search "JWT token verification"

# Concept search
prism search "database connection pooling"
```

#### Search with Options

```bash
# Limit results
prism search "authentication" --limit 20

# Set minimum similarity score (0-1)
prism search "user login" --min-score 0.7

# Filter by language
prism search "error handling" --lang typescript

# Filter by path
prism search "api endpoints" --path src/api/

# Combine options
prism search "database queries" --limit 10 --min-score 0.8 --lang typescript
```

#### Search Output Formats

```bash
# Default text format (human-readable)
prism search "authentication"

# JSON format (for scripts)
prism search "authentication" --format json

# Markdown format
prism search "authentication" --format markdown
```

### Viewing Statistics

```bash
# Show index statistics
prism stats
```

**Output:**
```
PRISM Statistics

Files indexed    67
Chunks created   549
Last indexed     1/14/2026, 7:55:38 PM
```

### Health Check

```bash
# Check service health
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

## Advanced Features

### Search Query Suggestions

```bash
# Get query suggestions based on history
prism suggest

# Get suggestions for partial query
prism suggest "auth"
```

### Search History

```bash
# View recent searches
prism history

# View last 20 searches
prism history --limit 20

# Clear history
prism history --clear
```

### Favorites

```bash
# Save a search as favorite
prism search "authentication flow" --save

# View favorites
prism favorites

# Run a favorite search
prism favorites --run <id>

# Remove favorite
prism favorites --remove <id>
```

### Batch Indexing

For large codebases, batch index multiple directories:

```bash
# Create a file with paths to index
cat > index-list.txt <<EOF
./src
./lib
./packages/core
./packages/utils
EOF

# Index all paths
while read path; do
  prism index "$path" --incremental
done < index-list.txt
```

### Custom File Extensions

Index non-standard file extensions:

```bash
# Index custom extensions
prism index ./src --extensions .ts,.tsx,.vue,.svelte

# Index all text files
prism index ./docs --extensions .md,.txt,.rst
```

### Path Filtering

Exclude specific patterns:

```bash
# Exclude multiple patterns
prism index ./src \
  --exclude node_modules \
  --exclude dist \
  --exclude "**/*.test.ts" \
  --exclude "**/*.spec.ts"
```

### Performance Tuning

#### Parallel Indexing

For faster indexing on large codebases:

```bash
# Index multiple directories in parallel
prism index ./src &
prism index ./lib &
prism index ./packages &
wait
echo "All indexing complete"
```

#### Embedding Cache

PRISM automatically caches embeddings in KV storage:

```bash
# Clear embedding cache if needed
wrangler kv:key list --binding=KV --namespace-id=<your-kv-id>
wrangler kv:key delete <key> --binding=KV --namespace-id=<your-kv-id>
```

---

## Configuration

### Environment Variables

Set these in your shell or `.bashrc`/`.zshrc`:

```bash
# Required: Your worker URL
export PRISM_URL=https://claudes-friend.your-username.workers.dev

# Optional: Cloudflare account ID
export CLOUDFLARE_ACCOUNT_ID=your-account-id

# Optional: API token for direct API access
export CLOUDFLARE_API_TOKEN=your-api-token
```

### Worker Configuration

Edit `wrangler.toml` to customize:

```toml
[vars]
# Environment name
ENVIRONMENT = "production"

# Logging level (debug, info, warn, error)
LOG_LEVEL = "info"

# Embedding model
EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5"

# Default limits
MAX_TOKENS = "2048"
TEMPERATURE = "0.7"
```

### File Patterns

Customize which files to index by editing the CLI patterns:

**Included Extensions:**
- TypeScript: `.ts`, `.tsx`
- JavaScript: `.js`, `.jsx`
- Python: `.py`
- Rust: `.rs`
- Go: `.go`
- Java: `.java`
- C/C++: `.c`, `.cpp`, `.h`
- C#: `.cs`
- PHP: `.php`
- Ruby: `.rb`
- Kotlin: `.kt`
- Swift: `.swift`
- Shell: `.sh`, `.bash`, `.zsh`
- Config: `.yaml`, `.yml`, `.json`
- Docs: `.md`

**Excluded Patterns:**
- Test files: `.test.`, `.spec.`, `.mock.`
- Dependencies: `node_modules`, `vendor`
- Build outputs: `dist`, `build`, `.next`, `coverage`
- Version control: `.git`, `.svn`

---

## Troubleshooting

### Common Issues

#### "No worker URL configured"

**Problem:** PRISM_URL environment variable not set

**Solution:**
```bash
# Set your worker URL
export PRISM_URL=https://claudes-friend.your-username.workers.dev

# Or add to shell profile
echo 'export PRISM_URL=https://...' >> ~/.bashrc
source ~/.bashrc
```

#### "Failed to connect to worker"

**Problem:** Network or worker deployment issue

**Solutions:**
1. Check worker is deployed:
   ```bash
   wrangler deployments list
   ```

2. Test worker directly:
   ```bash
   curl https://your-worker.workers.dev/health
   ```

3. Redeploy if needed:
   ```bash
   npm run deploy
   ```

#### "No results found"

**Problem:** Index is empty or query too specific

**Solutions:**
1. Check index status:
   ```bash
   prism stats
   ```

2. Reindex if needed:
   ```bash
   prism index ./src --force
   ```

3. Try broader search:
   ```bash
   prism search "auth" --min-score 0.5
   ```

#### "Embedding generation failed"

**Problem:** Workers AI quota exceeded or network issue

**Solutions:**
1. Check Cloudflare dashboard for quota
2. Wait for daily reset (midnight UTC)
3. Retry after a few minutes

#### Slow Indexing

**Problem:** Large files or many files

**Solutions:**
1. Use incremental indexing:
   ```bash
   prism index ./src --incremental
   ```

2. Exclude unnecessary files:
   ```bash
   prism index ./src --exclude test,dist,node_modules
   ```

3. Index in smaller batches:
   ```bash
   prism index ./src/auth
   prism index ./src/database
   ```

### Getting Help

1. **Check Documentation:**
   - [API Reference](./API_REFERENCE.md)
   - [Troubleshooting Guide](./TROUBLESHOOTING.md)
   - [Configuration Guide](./CONFIGURATION.md)

2. **View Logs:**
   ```bash
   # Worker logs
   wrangler tail

   # CLI verbose mode
   prism index ./src --verbose
   ```

3. **Report Issues:**
   - GitHub Issues: [github.com/SuperInstance/prism/issues](https://github.com/SuperInstance/prism/issues)
   - Include: PRISM version, error message, steps to reproduce

---

## FAQ

### General

**Q: Is PRISM free to use?**
A: Yes! PRISM runs on Cloudflare's free tier which includes:
- 100,000 requests per day
- 5 GB D1 storage
- 1 GB Vectorize index
- 10,000 AI embeddings per day

**Q: Is my code private?**
A: Yes! Your code is stored in your personal Cloudflare account and never shared with anyone.

**Q: Can I use PRISM offline?**
A: No, PRISM requires internet access to reach Cloudflare Workers. However, API calls are extremely fast (<50ms).

**Q: What happens if I exceed the free tier?**
A: You can upgrade to Cloudflare's paid plans. Most projects will never exceed the free tier.

### Technical

**Q: How accurate is semantic search?**
A: PRISM uses BGE-small-en-v1.5 embeddings with 384 dimensions. In testing, it achieves 85%+ relevance for typical code searches.

**Q: How fast is search?**
A: - Small projects (<1K chunks): ~360ms
- Medium projects (10K chunks): ~378ms
- Large projects (100K chunks): ~396ms
- Very large (1M chunks): ~432ms

**Q: Can I use different embedding models?**
A: Yes! Edit `EMBEDDING_MODEL` in `wrangler.toml`. Available models:
- `@cf/baai/bge-small-en-v1.5` (384d, fast, good quality)
- `@cf/baai/bge-base-en-v1.5` (768d, slower, better quality)
- `@cf/baai/bge-large-en-v1.5` (1024d, slowest, best quality)

**Q: How does incremental indexing work?**
A: PRISM calculates SHA-256 checksums for each file. On subsequent indexes, files with unchanged checksums are skipped (21x faster).

**Q: Can I export my index?**
A: Yes! Use Wrangler to export:
```bash
# Export D1 database
wrangler d1 export claudes-friend-db --output=index-backup.sql

# Export Vectorize index (via API)
# Coming soon
```

### Integration

**Q: How do I integrate with Claude Code?**
A: PRISM provides MCP (Model Context Protocol) tools. See [Architecture Docs](./docs/architecture/05-mcp-plugin-spec.md) for details.

**Q: Can I use PRISM with other AI assistants?**
A: Yes! PRISM is AI-agnostic. Use the search results with any AI assistant that accepts code context.

**Q: Is there an API?**
A: Yes! See [API Reference](./API_REFERENCE.md) for complete documentation.

**Q: Can I self-host PRISM?**
A: Yes! PRISM is open source. You can deploy to any platform that supports Cloudflare Workers runtime.

### Limitations

**Q: What's the maximum file size?**
A: Default is 1MB per file. Configure with `--max-size` flag:
```bash
prism index ./src --max-size 5  # 5MB limit
```

**Q: How many files can I index?**
A: Limited by:
- D1: 5GB storage (free tier) = ~500K chunks
- Vectorize: 1GB vectors (free tier) = ~2.7M vectors
- Typical project: 10-100K chunks

**Q: What languages are supported?**
A: See [Configuration](#file-patterns) for full list. PRISM uses Tree-sitter for parsing, supporting 20+ languages.

---

## Next Steps

- **API Reference** - [API_REFERENCE.md](./API_REFERENCE.md)
- **Troubleshooting** - [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Configuration** - [CONFIGURATION.md](./CONFIGURATION.md)
- **Architecture** - [docs/architecture/](./docs/architecture/)
- **Examples** - [examples/](./examples/)

---

**Need Help?**
- 📖 [Full Documentation](./docs/)
- 🐛 [Report Issues](https://github.com/SuperInstance/prism/issues)
- 💬 [Discussions](https://github.com/SuperInstance/prism/discussions)
- 🌟 [Star on GitHub](https://github.com/SuperInstance/prism)
