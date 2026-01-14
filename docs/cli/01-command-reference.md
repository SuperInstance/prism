# PRISM CLI Command Reference

**Component**: PRISM CLI
**Version**: 0.1.0
**Last Updated**: 2026-01-13

## Overview

PRISM provides a single command-line interface `prism` with subcommands for indexing, searching, chatting, and statistics.

```bash
prism [command] [options]
```

### Global Options

These options can be used with any command:

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--config` | `-c` | string | `~/.prism/config.yaml` | Path to configuration file |
| `--verbose` | `-v` | boolean | `false` | Enable verbose output |
| `--quiet` | `-q` | boolean | `false` | Suppress non-error output |
| `--help` | `-h` | boolean | `false` | Show help for command |
| `--version` | `-V` | boolean | `false` | Show version number |

### Environment Variables

Global environment variables that override config:

| Variable | Description |
|----------|-------------|
| `PRISM_CONFIG` | Path to configuration file |
| `PRISM_VERBOSE` | Enable verbose mode (1=true, 0=false) |
| `PRISM_QUIET` | Suppress output (1=true, 0=false) |
| `PRISM_LOG_LEVEL` | Log level (debug, info, warn, error) |

---

## Commands

### 1. prism index

Build or update the codebase index for semantic search.

#### Usage

```bash
prism index [options]
```

#### Options

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--path` | `-p` | string | `.` | Path to codebase root directory |
| `--extensions` | `-e` | string | `.ts,.js,.py,.rs,.go,.java` | File extensions to index (comma-separated) |
| `--exclude` | | string[] | `node_modules,.git,dist,build` | Paths to exclude from indexing (comma-separated) |
| `--force` | `-f` | boolean | `false` | Force full reindex instead of incremental |
| `--max-size` | | number | `1` | Maximum file size in MB |
| `--output` | `-o` | string | `.prism/vectors.db` | Output path for vector database |
| `--format` | | string | `text` | Output format (text, json) |
| `--embeddings` | | string | `auto` | Embedding provider (auto, cloudflare, ollama) |
| `--workers` | | number | `4` | Number of parallel workers for indexing |

#### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments |
| `3` | Parse error (syntax error in source files) |
| `4` | Embedding generation failed |
| `5` | Database write failed |

#### Examples

```bash
# Index current directory
prism index

# Index specific path with custom extensions
prism index --path ./src --extensions .ts,.tsx,.vue

# Force full reindex with verbose output
prism index --force --verbose

# Index with custom exclusions
prism index --exclude "test/**,spec/**,mocks/**"

# JSON output for scripting
prism index --format json

# Use local Ollama for embeddings
prism index --embeddings ollama
```

#### Output (text format)

```
Indexing /home/user/project...
✓ Found 247 files matching criteria
✓ Parsed 247 files (3.2s)
✓ Extracted 3,456 code elements
✓ Generated 3,456 embeddings (18.4s)
✓ Indexed 3,456 chunks (1.2s)

Index complete!
Files: 247 | Chunks: 3,456 | Time: 22.8s
Storage: .prism/vectors.db (12.4 MB)
Embeddings: cloudflare (bge-small-en-v1.5)
```

#### Output (JSON format)

```json
{
  "success": true,
  "stats": {
    "filesIndexed": 247,
    "chunksCreated": 3456,
    "duration": 22800,
    "storageSize": 13000000,
    "storagePath": ".prism/vectors.db",
    "embeddingsProvider": "cloudflare",
    "embeddingsModel": "bge-small-en-v1.5"
  },
  "performance": {
    "parseTime": 3200,
    "embeddingTime": 18400,
    "indexTime": 1200
  }
}
```

---

### 2. prism search

Search codebase using semantic vector similarity.

#### Usage

```bash
prism search <query> [options]
```

#### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `query` | string | Yes | Natural language search query |

#### Options

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--limit` | `-l` | number | `10` | Maximum number of results (1-100) |
| `--threshold` | `-t` | number | `0.7` | Minimum similarity score (0.0-1.0) |
| `--extensions` | `-e` | string[] | | Filter by file extensions (comma-separated) |
| `--paths` | | string[] | | Filter by file paths (comma-separated) |
| `--exclude` | | string[] | | Exclude file paths (comma-separated) |
| `--context` | `-C` | number | `3` | Number of context lines to show |
| `--format` | | string | `text` | Output format (text, json, markdown) |
| `--no-snippet` | | boolean | `false` | Don't show code snippets |
| `--no-line-numbers` | | boolean | `false` | Don't show line numbers |
| `--index` | `-i` | string | `.prism/vectors.db` | Path to vector database |

#### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success (results may be empty) |
| `1` | General error |
| `2` | Invalid arguments |
| `6` | Index not found |
| `7` | Search failed |

#### Examples

```bash
# Basic search
prism search "authentication flow"

# Search with options
prism search "user login" --limit 20 --threshold 0.8

# Filter by file type
prism search "database connection" --extensions .ts,.js

# Search specific directory
prism search "API endpoints" --paths "src/api/**"

# Exclude test files
prism search "error handling" --exclude "test/**,spec/**"

# JSON output for scripting
prism search "middleware" --format json

# Markdown output for documentation
prism search "types" --format markdown --limit 50
```

#### Output (text format)

```
Searching for "authentication flow"...
Found 15 results (0.24s)

src/auth/login.ts (score: 0.92)
  Line 45: async function login(username, password) {
  Line 46:   const user = await db.users.findOne({ username });
  Line 47:   if (!user) throw new AuthError('User not found');
  Line 48:   if (!await bcrypt.compare(password, user.passwordHash)) {
  Line 49:     throw new AuthError('Invalid password');
  Line 50:   }
  Line 51:   return generateToken(user);
  Line 52: }

src/auth/middleware.ts (score: 0.88)
  Line 12: export function authMiddleware(req, res, next) {
  Line 13:   const token = req.headers.authorization?.split(' ')[1];
  Line 14:   if (!token) return res.status(401).json({ error: 'No token' });
  Line 15:   try {
  Line 16:     const decoded = verifyToken(token);
  Line 17:     req.user = decoded;
  Line 18:     next();
  Line 19:   } catch (error) {
  Line 20:     return res.status(401).json({ error: 'Invalid token' });
  Line 21:   }
  Line 22: }

[13 more results...]
```

#### Output (JSON format)

```json
{
  "query": "authentication flow",
  "results": [
    {
      "filePath": "src/auth/login.ts",
      "score": 0.92,
      "lineRange": [45, 52],
      "snippet": "async function login(username, password) {\n  const user = await db.users.findOne({ username });\n  if (!user) throw new AuthError('User not found');\n  if (!await bcrypt.compare(password, user.passwordHash)) {\n    throw new AuthError('Invalid password');\n  }\n  return generateToken(user);\n}",
      "elementName": "login",
      "elementType": "function"
    },
    {
      "filePath": "src/auth/middleware.ts",
      "score": 0.88,
      "lineRange": [12, 22],
      "snippet": "export function authMiddleware(req, res, next) {\n  const token = req.headers.authorization?.split(' ')[1];\n  if (!token) return res.status(401).json({ error: 'No token' });\n  try {\n    const decoded = verifyToken(token);\n    req.user = decoded;\n    next();\n  } catch (error) {\n    return res.status(401).json({ error: 'Invalid token' });\n  }\n}",
      "elementName": "authMiddleware",
      "elementType": "function"
    }
  ],
  "totalResults": 15,
  "searchTime": 240,
  "indexPath": ".prism/vectors.db"
}
```

---

### 3. prism chat

Interactive AI-powered assistance with optimized context selection.

#### Usage

```bash
prism chat <message> [options]
```

#### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `message` | string | Yes | Question or task description |

#### Options

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--budget` | `-b` | number | `50000` | Token budget for context |
| `--model` | `-m` | string | `auto` | Model to use (auto, ollama, haiku, sonnet, opus) |
| `--history` | | boolean | `true` | Include conversation history |
| `--format` | | string | `text` | Output format (text, json) |
| `--show-usage` | | boolean | `true` | Show token usage statistics |
| `--non-interactive` | | boolean | `false` | Single query mode (no follow-up) |
| `--index` | `-i` | string | `.prism/vectors.db` | Path to vector database |
| `--api-key` | | string | | Anthropic API key (overrides env) |

#### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments |
| `6` | Index not found |
| `8` | LLM API error |
| `9` | Context optimization failed |

#### Examples

```bash
# Ask a question
prism chat "How does the authentication system work?"

# Specify token budget
prism chat "Explain the database schema" --budget 100000

# Force specific model
prism chat "Refactor this function" --model sonnet

# JSON output for scripting
prism chat "Find all API endpoints" --format json --non-interactive

# Single query without history
prism chat "What is the error handling strategy?" --non-interactive
```

#### Output (text format)

```
Query: How does the authentication system work?

Optimizing context...
✓ Retrieved 23 relevant code chunks
✓ Selected 8 chunks within budget (2,134 tokens)
✓ Compressed to 1,892 tokens (88.6% reduction)
✓ Selected model: claude-3.5-sonnet

Answer:
The authentication system uses JWT (JSON Web Tokens) with the following flow:

1. Login (src/auth/login.ts:45-52):
   - User provides username and password
   - System looks up user in database
   - Password is verified using bcrypt
   - JWT token is generated and returned

2. Middleware (src/auth/middleware.ts:12-22):
   - Each request includes Authorization header
   - Token is extracted and verified
   - Decoded user info is attached to request
   - Invalid tokens return 401 Unauthorized

3. Token Generation (src/auth/tokens.ts:15-30):
   - Tokens contain user ID, email, and expiration
   - Signed with HS256 using SECRET_KEY
   - Valid for 24 hours by default

Key security features:
- Password hashing with bcrypt (10 rounds)
- Token expiration and refresh
- CORS configuration for allowed origins

---
Token Usage:
  Input: 1,892 tokens (saved: 14,108 tokens, 88.1%)
  Output: estimated 500-800 tokens
  Model: claude-3.5-sonnet
  Cost: ~$0.01
```

#### Output (JSON format)

```json
{
  "query": "How does the authentication system work?",
  "answer": "The authentication system uses JWT (JSON Web Tokens)...",
  "optimization": {
    "chunksRetrieved": 23,
    "chunksSelected": 8,
    "originalTokens": 16000,
    "optimizedTokens": 1892,
    "compressionRatio": 88.1,
    "model": "claude-3.5-sonnet",
    "reason": "Balanced choice for this query complexity"
  },
  "tokenUsage": {
    "input": 1892,
    "output": 650,
    "total": 2542,
    "saved": 14108,
    "savingsPercentage": 88.1,
    "estimatedCost": 0.01
  }
}
```

---

### 4. prism stats

Display token usage statistics and savings.

#### Usage

```bash
prism stats [options]
```

#### Options

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--period` | `-p` | string | `session` | Time period (session, today, week, all) |
| `--format` | | string | `text` | Output format (text, json) |
| `--verbose` | `-v` | boolean | `false` | Show detailed breakdown |
| `--sort` | | string | `queries` | Sort by (queries, tokens, savings) |

#### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments |

#### Examples

```bash
# Show session stats
prism stats

# Show weekly stats
prism stats --period week

# Detailed JSON output
prism stats --format json --verbose

# Sort by token savings
prism stats --sort savings
```

#### Output (text format)

```
PRISM Token Usage Statistics
=============================

Session (since 2 hours ago):
  Queries: 23
  Total tokens used: 45,678
  Total tokens saved: 387,432
  Average savings: 89.5%
  Money saved: ~$1.16

Model distribution:
  ollama:     15 (65.2%) - $0.00
  haiku:       5 (21.7%) - $0.01
  sonnet:      3 (13.0%) - $0.14
  opus:        0 ( 0.0%) - $0.00

Top queries:
  1. "authentication flow"        - 12.3K tokens, 94.2% saved
  2. "database schema"            - 8.9K tokens, 91.7% saved
  3. "API endpoints"              - 6.2K tokens, 88.5% saved

Cache performance:
  Embedding cache hit rate: 78.3%
  Search cache hit rate: 65.2%
  Avg query time: 0.34s
```

#### Output (JSON format)

```json
{
  "period": "session",
  "stats": {
    "queries": 23,
    "totalTokensUsed": 45678,
    "totalTokensSaved": 387432,
    "averageSavings": 89.5,
    "costSaved": 1.16
  },
  "modelDistribution": {
    "ollama": { "count": 15, "percentage": 65.2, "cost": 0 },
    "haiku": { "count": 5, "percentage": 21.7, "cost": 0.01 },
    "sonnet": { "count": 3, "percentage": 13.0, "cost": 0.14 },
    "opus": { "count": 0, "percentage": 0, "cost": 0 }
  },
  "topQueries": [
    { "query": "authentication flow", "tokens": 12300, "savings": 94.2 },
    { "query": "database schema", "tokens": 8900, "savings": 91.7 },
    { "query": "API endpoints", "tokens": 6200, "savings": 88.5 }
  ],
  "cache": {
    "embeddingHitRate": 78.3,
    "searchHitRate": 65.2,
    "avgQueryTime": 0.34
  }
}
```

---

## Common Patterns

### Combining Options

Multiple options can be combined:

```bash
# Verbose JSON output
prism index --verbose --format json

# Custom path with exclusions
prism search "auth" --paths "src/**" --exclude "test/**" --limit 20
```

### Piping to Other Tools

JSON output can be piped to other CLI tools:

```bash
# Count results
prism search "error" --format json | jq '.totalResults'

# Extract file paths
prism search "database" --format json | jq -r '.results[].filePath'

# Sort by score
prism search "api" --format json | jq '.results | sort_by(.score) | reverse'
```

### Shell Integration

Add to your `.bashrc` or `.zshrc` for aliases:

```bash
# Quick search alias
alias ps='prism search'

# Quick chat alias
alias pc='prism chat'

# Quick index with force
alias pi='prism index --force'
```

### Error Handling

All commands return non-zero exit codes on error:

```bash
# Check if index exists
if prism search "test" &>/dev/null; then
  echo "Index exists"
else
  echo "No index found, creating..."
  prism index
fi

# Retry on failure
prism search "auth" || prism index && prism search "auth"
```

---

## File Locations

### Default Paths

| Platform | Config | Index | Cache |
|----------|--------|-------|-------|
| Linux/macOS | `~/.prism/config.yaml` | `.prism/vectors.db` | `.prism/cache/` |
| Windows | `%APPDATA%\prism\config.yaml` | `.prism\vectors.db` | `.prism\cache\` |

### Environment-Specific Overrides

```bash
# Development
export PRISM_CONFIG=./prism.config.yaml
prism search "test"

# Production
export PRISM_CONFIG=/etc/prism/config.yaml
prism search "test"
```

---

## Exit Code Reference

All PRISM commands use consistent exit codes:

| Code | Name | Description | Retryable |
|------|------|-------------|-----------|
| 0 | SUCCESS | Operation completed successfully | N/A |
| 1 | GENERAL_ERROR | unspecified error | Maybe |
| 2 | INVALID_ARGS | Invalid command arguments | No |
| 3 | PARSE_ERROR | Failed to parse source code | No |
| 4 | EMBEDDING_ERROR | Embedding generation failed | Yes |
| 5 | STORAGE_ERROR | Database operation failed | Maybe |
| 6 | INDEX_NOT_FOUND | No index found | No |
| 7 | SEARCH_ERROR | Search operation failed | Yes |
| 8 | LLM_ERROR | LLM API error | Yes |
| 9 | OPTIMIZER_ERROR | Context optimization failed | Yes |
| 10 | NETWORK_ERROR | Network connectivity issue | Yes |
| 11 | AUTH_ERROR | Authentication failed | No |
| 12 | QUOTA_EXCEEDED | API quota exceeded | Yes |
| 13 | VALIDATION_ERROR | Input validation failed | No |

---

## Version Information

Display version and system information:

```bash
prism --version
# Output: prism version 0.1.0 (node v18.0.0, linux x64)

prism --help
# Shows all commands and options
```

---

**Document Status**: Complete
**Last Updated**: 2026-01-13
**Next Review**: After v0.2.0 release
