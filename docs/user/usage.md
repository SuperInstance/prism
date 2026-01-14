# PRISM Usage Guide

**Version**: 0.1.0
**Last Updated**: 2026-01-13

---

## Table of Contents

1. [Command Reference](#command-reference)
2. [Basic Usage Patterns](#basic-usage-patterns)
3. [Advanced Usage](#advanced-usage)
4. [Common Workflows](#common-workflows)
5. [Integration Examples](#integration-examples)
6. [Performance Tips](#performance-tips)
7. [Troubleshooting](#troubleshooting)

---

## Command Reference

### prism

Main PRISM command-line interface.

```bash
prism [command] [options]
```

**Global Options**:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--help` | `-h` | Show help | - |
| `--version` | `-v` | Show version | - |
| `--verbose` | `-V` | Enable verbose output | false |
| `--quiet` | `-q` | Suppress non-error output | false |
| `--config` | `-c` | Path to config file | ~/.prism/config.yaml |

**Example**:

```bash
# Show version
prism --version

# Use custom config
prism --config ./my-config.yaml index

# Verbose output
prism --verbose search "authentication"
```

---

### prism init

Initialize PRISM in your project.

```bash
prism init [options]
```

**Options**:

| Option | Description | Default |
|--------|-------------|---------|
| `--force` | Overwrite existing config | false |

**Example**:

```bash
# Initialize with default config
prism init

# Overwrite existing config
prism init --force
```

**What it creates**:

```
.prism/
├── config.yaml        # PRISM configuration
└── .gitignore         # Exclude generated files
```

---

### prism index

Index your codebase for semantic search.

```bash
prism index [options]
```

**Options**:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--path` | `-p` | Path to index | . (current directory) |
| `--output` | `-o` | Output database path | .prism/vectors.db |
| `--force` | `-f` | Rebuild index from scratch | false |
| `--extensions` | `-e` | File extensions to index | .ts,.js,.tsx,.jsx,.py,.rs,.go,.java |
| `--exclude` | `-E` | Paths/patterns to exclude | node_modules/**,.git/**,dist/**,build/** |
| `--max-size` | `-m` | Max file size (MB) | 1 |
| `--workers` | `-w` | Number of parallel workers | 4 |
| `--embeddings` | Provider for embeddings | auto |
| `--batch-size` | Embedding batch size | 10 |
| `--watch` | Watch for changes and auto-update | false |

**Examples**:

```bash
# Basic indexing
prism index

# Index specific directory
prism index --path ./src

# Rebuild from scratch
prism index --force

# Custom file extensions
prism index --extensions .ts,.tsx,.vue

# Exclude more patterns
prism index --exclude "node_modules/**,dist/**,coverage/**,test/**"

# Use local embeddings
prism index --embeddings ollama

# Watch mode (auto-update on file changes)
prism index --watch

# Verbose indexing
prism index --verbose

# Large project optimization
prism index --workers 8 --max-size 0.5 --batch-size 20
```

**Output Example**:

```
Indexing /home/user/project...
✓ Found 247 files matching criteria
✓ Parsed 247 files (3.2s)
  - Functions: 1,234
  - Classes: 456
  - Methods: 1,766
✓ Generated 3,456 embeddings (18.4s)
  - Using: cloudflare (bge-small-en-v1.5)
  - Batch size: 10
✓ Indexed 3,456 chunks (1.2s)

Index complete!
Files: 247 | Chunks: 3,456 | Time: 22.8s
Storage: .prism/vectors.db (12.4 MB)
```

---

### prism search

Search your codebase semantically.

```bash
prism search <query> [options]
```

**Positional Arguments**:

| Argument | Description | Required |
|----------|-------------|----------|
| `query` | Search query | Yes |

**Options**:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--limit` | `-l` | Max results | 10 |
| `--threshold` | `-t` | Min similarity (0-1) | 0.7 |
| `--extensions` | `-e` | Filter by extensions | All |
| `--exclude` | `-E` | Exclude paths/patterns | None |
| `--format` | `-f` | Output format (text,json,markdown) | text |
| `--index` | `-i` | Path to index | .prism/vectors.db |
| `--context` | `-c` | Lines of context | 5 |
| `--no-score` | Hide similarity scores | false |

**Examples**:

```bash
# Basic search
prism search "authentication"

# Get more results
prism search "database" --limit 20

# Lower threshold
prism search "error handling" --threshold 0.6

# Filter by file type
prism search "API" --extensions .ts,.js

# Exclude test files
prism search "user model" --exclude "test/**,spec/**"

# JSON output
prism search "payment" --format json

# More context
prism search "validation" --context 10

# Use specific index
prism search "auth" --index /path/to/index.db

# Markdown output
prism search "middleware" --format markdown
```

**Output Examples**:

**Text format** (default):
```
Searching for "authentication"...
Found 8 results (0.18s)

src/auth/login.ts (score: 0.94)
  Line 45: async function login(username, password) {
  Line 46:   const user = await db.users.findOne({ username });
  Line 47:   if (!user) throw new AuthError('User not found');
  Line 48:   if (!await bcrypt.compare(password, user.passwordHash)) {
  Line 49:     throw new AuthError('Invalid password');
  Line 50:   }
  Line 51:   return generateToken(user);
  Line 52: }

src/auth/middleware.ts (score: 0.91)
  Line 12: export function authMiddleware(req, res, next) {
  Line 13:   const token = req.headers.authorization?.split(' ')[1];
  Line 14:   if (!token) return res.status(401).json({ error: 'No token' });
  Line 15:   const decoded = verifyToken(token);
  Line 16:   req.user = decoded;
  Line 17:   next();
  Line 18: }
```

**JSON format**:
```json
{
  "query": "authentication",
  "total": 8,
  "time": 0.18,
  "results": [
    {
      "file": "src/auth/login.ts",
      "score": 0.94,
      "startLine": 45,
      "endLine": 52,
      "code": "async function login(username, password) {..."
    }
  ]
}
```

---

### prism chat

Ask questions about your codebase.

```bash
prism chat <query> [options]
```

**Positional Arguments**:

| Argument | Description | Required |
|----------|-------------|----------|
| `query` | Question or prompt | Yes |

**Options**:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--model` | `-m` | Model to use (auto,ollama,haiku,sonnet,opus) | auto |
| `--budget` | `-b` | Token budget | 50000 |
| `--temperature` | `-t` | Temperature (0-1) | 0.7 |
| `--max-tokens` | Max response tokens | 4096 |
| `--no-history` | Don't use conversation history | false |
| `--format` | `-f` | Output format (text,json) | text |
| `--save` | `-s` | Save conversation to file | - |
| `--interactive` | `-i` | Interactive mode | false |

**Examples**:

```bash
# Basic question
prism chat "How does the payment flow work?"

# Use specific model
prism chat "Explain the auth system" --model sonnet

# Higher budget for complex questions
prism chat "What is the architecture?" --budget 100000

# Interactive mode
prism chat --interactive

# Save conversation
prism chat "Review this code" --save conversation.md

# JSON output
prism chat "Summarize the API" --format json

# Lower temperature for more focused answers
prism chat "What are the API endpoints?" --temperature 0.3

# No history for isolated questions
prism chat "What is X?" --no-history
```

**Interactive Mode**:

```bash
prism chat --interactive
```

```
PRISM Interactive Chat (Ctrl+C to exit)

> How does authentication work?
[Answer appears here]

> What about authorization?
[Answer appears here, with context from previous question]

> exit
```

---

### prism stats

View usage statistics and token savings.

```bash
prism stats [options]
```

**Options**:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--period` | `-p` | Time period (session,today,week,month,all) | session |
| `--format` | `-f` | Output format (text,json) | text |
| `--verbose` | `-v` | Show detailed stats | false |

**Examples**:

```bash
# Session statistics
prism stats

# Today's statistics
prism stats --period today

# Weekly statistics
prism stats --period week

# JSON output
prism stats --format json

# Detailed statistics
prism stats --verbose
```

**Output Example**:

```
PRISM Token Usage Statistics
=============================

Session (since 15 minutes ago):
  Queries: 3
  Total tokens used: 3,456
  Total tokens saved: 28,912
  Average savings: 89.3%
  Money saved: ~$0.09

Model distribution:
  sonnet: 2 (66.7%) - $0.01
  haiku:  1 (33.3%) - $0.00

Cache performance:
  Embedding cache hit rate: 82.1%
  Search cache hit rate: 71.4%
  Avg query time: 0.28s

Index information:
  Total chunks: 3,456
  Storage size: 12.4 MB
  Last indexed: 5 minutes ago

Top queries:
  1. "authentication" (3 times)
  2. "payment flow" (2 times)
  3. "error handling" (1 time)
```

---

### prism config

Manage PRISM configuration.

```bash
prism config <subcommand> [options]
```

**Subcommands**:

| Subcommand | Description |
|------------|-------------|
| `show` | Display current configuration |
| `validate` | Validate configuration |
| `set <key> <value>` | Set configuration value |
| `get <key>` | Get configuration value |
| `edit` | Open config in editor |

**Examples**:

```bash
# Show current configuration
prism config show

# Show with defaults
prism config show --all

# Show effective configuration
prism config show --effective

# Validate configuration
prism config validate

# Set a value
prism config set indexing.workers 8

# Get a value
prism config get indexing.workers

# Edit configuration
prism config edit
```

---

### prism mcp

Manage MCP (Model Context Protocol) integration.

```bash
prism mcp <subcommand> [options]
```

**Subcommands**:

| Subcommand | Description |
|------------|-------------|
| `install` | Install PRISM MCP server |
| `uninstall` | Uninstall PRISM MCP server |
| `start` | Start MCP server |
| `status` | Check MCP server status |

**Examples**:

```bash
# Install MCP server
prism mcp install

# Start MCP server
prism mcp start

# Check status
prism mcp status
```

---

## Basic Usage Patterns

### Pattern 1: Quick Code Search

Find relevant code fast:

```bash
# Search for functionality
prism search "user authentication"

# Search for specific components
prism search "database connection pool"

# Search for error handling
prism search "error handling"
```

### Pattern 2: Understand Code Architecture

Get high-level understanding:

```bash
# Ask about architecture
prism chat "What is the overall architecture?"

# Ask about data flow
prism chat "How does data flow through the system?"

# Ask about patterns
prism chat "What design patterns are used?"
```

### Pattern 3: Debug with Context

Find related code when debugging:

```bash
# Search for error-related code
prism search "permission denied" --limit 20

# Ask about potential causes
prism chat "What could cause 'permission denied' in auth?"

# Search for similar patterns
prism search "similar error handling"
```

### Pattern 4: Learn Codebase

Onboard to a new project:

```bash
# Index the codebase
prism index

# Start with high-level questions
prism chat "What does this application do?"

# Explore specific areas
prism search "API endpoints"
prism search "data models"

# Understand implementation
prism chat "How are requests processed?"
```

---

## Advanced Usage

### Combining Search and Chat

Use search results to inform chat:

```bash
# First, find relevant code
prism search "authentication" --limit 5

# Then, ask about specific aspects
prism chat "Explain the JWT implementation in the authentication system"
```

### Filtering and Refining

Narrow down results:

```bash
# Search specific file types
prism search "API" --extensions .ts

# Exclude test files
prism search "user model" --exclude "test/**,spec/**"

# Lower threshold for more results
prism search "database" --threshold 0.6

# Get more context
prism search "validation" --context 10
```

### Batch Operations

Process multiple queries:

```bash
# Search for multiple terms
for term in "authentication" "authorization" "permissions"; do
  prism search "$term" --limit 5
done

# Save to file
prism search "API" --format json > api-results.json
```

### Integration with Scripts

Use PRISM in shell scripts:

```bash
#!/bin/bash

# Find all API endpoints
prism search "API endpoint" --format json | \
  jq -r '.results[].file' | \
  sort -u
```

---

## Common Workflows

### Workflow 1: Feature Development

```bash
# 1. Update index
git pull
prism index

# 2. Understand existing code
prism search "user profile"
prism chat "How are user profiles stored?"

# 3. Find similar patterns
prism search "CRUD operations"

# 4. Implement feature
# ... (write code) ...

# 5. Check impact
prism index --force
prism chat "What did my changes affect?"
```

### Workflow 2: Code Review

```bash
# 1. Checkout PR branch
git checkout feature/new-auth

# 2. Index changes
prism index --force

# 3. Understand changes
prism search "authentication" --limit 20

# 4. Ask about impact
prism chat "What are the security implications?"

# 5. Compare with main
git checkout main
prism search "authentication"
```

### Workflow 3: Bug Investigation

```bash
# 1. Search for error-related code
prism search "error handling" --limit 30

# 2. Find specific functionality
prism search "user permissions check"

# 3. Ask about potential causes
prism chat "What could cause 'permission denied'?"

# 4. Examine related code
prism search "similar permission checks" --threshold 0.6
```

### Workflow 4: Documentation

```bash
# 1. Generate architecture overview
prism chat "Explain the system architecture" --save architecture.md

# 2. Document specific modules
prism chat "How does the payment system work?" --save payment-flow.md

# 3. Create API documentation
prism chat "List all API endpoints with descriptions" --save api-docs.md
```

---

## Integration Examples

### With Git Hooks

Add to `.git/hooks/post-merge`:

```bash
#!/bin/bash
# Auto-update index after pull

echo "Updating PRISM index..."
prism index --quiet
echo "Index updated!"
```

### With VS Code

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "PRISM: Index Codebase",
      "type": "shell",
      "command": "prism index",
      "problemMatcher": []
    },
    {
      "label": "PRISM: Search",
      "type": "shell",
      "command": "prism search",
      "args": ["${input:query}"],
      "problemMatcher": []
    }
  ],
  "inputs": [
    {
      "id": "query",
      "type": "promptString",
      "description": "Search query"
    }
  ]
}
```

### With Make

Add to `Makefile`:

```makefile
.PHONY: index search chat

index:
	prism index

search:
	@read -p "Search query: " query; \
	prism search "$$query"

chat:
	@read -p "Question: " question; \
	prism chat "$$question"
```

---

## Performance Tips

### 1. Index Optimization

```bash
# For large codebases, use more workers
prism index --workers 8

# Reduce file size limit
prism index --max-size 0.5

# Exclude more patterns
prism index --exclude "node_modules/**,dist/**,build/**,coverage/**"
```

### 2. Search Optimization

```bash
# Use specific file extensions
prism search "API" --extensions .ts

# Exclude unnecessary directories
prism search "model" --exclude "test/**,mocks/**"

# Adjust threshold based on needs
prism search "functionality" --threshold 0.8  # More precise
prism search "functionality" --threshold 0.6  # More results
```

### 3. Chat Optimization

```bash
# Use appropriate budget
prism chat "Simple question" --budget 20000
prism chat "Complex architecture" --budget 100000

# Choose model based on complexity
prism chat "Quick question" --model haiku
prism chat "Complex analysis" --model sonnet

# Use lower temperature for focused answers
prism chat "What are the API endpoints?" --temperature 0.3
```

### 4. Caching

```bash
# Enable embedding cache (default)
# In config.yaml:
embeddings:
  cache: true

# Clear cache if needed
rm -rf .prism/cache/
```

---

## Troubleshooting

### Issue: Slow Search

**Symptoms**: Search takes >1 second

**Solutions**:

```bash
# Check index size
prism stats --verbose

# Rebuild index if corrupted
prism index --force

# Use SQLite (faster than Vectorize for local)
# In config.yaml:
storage:
  type: sqlite
```

### Issue: Poor Search Results

**Symptoms**: Search returns irrelevant results

**Solutions**:

```bash
# Lower threshold
prism search "query" --threshold 0.6

# Rebuild index
prism index --force

# Check file types
prism search "query" --extensions .ts,.js

# Use more specific query
prism search "specific authentication function"
```

### Issue: High Token Usage

**Symptoms**: Chat uses too many tokens

**Solutions**:

```bash
# Lower budget
prism chat "question" --budget 20000

# Use cheaper model
prism chat "question" --model haiku

# Disable history
prism chat "question" --no-history

# Check what's being sent
prism chat "question" --verbose
```

### Issue: Memory Errors

**Symptoms**: Out of memory during indexing

**Solutions**:

```bash
# Reduce workers
prism index --workers 2

# Reduce batch size
prism index --batch-size 5

# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
prism index
```

---

**Document Status**: Complete
**Last Updated**: 2026-01-13
**Version**: 0.1.0
