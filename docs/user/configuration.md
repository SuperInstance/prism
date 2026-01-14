# PRISM Configuration Guide

**Version**: 0.1.0
**Last Updated**: 2026-01-13

---

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Configuration File](#configuration-file)
3. [Environment Variables](#environment-variables)
4. [Indexing Options](#indexing-options)
5. [Embedding Options](#embedding-options)
6. [Storage Options](#storage-options)
7. [Chat Options](#chat-options)
8. [Model Selection](#model-selection)
9. [Logging Options](#logging-options)
10. [Example Configurations](#example-configurations)

---

## Configuration Overview

PRISM uses a hierarchical configuration system:

```
1. Default values (built-in)
    ↓
2. Global config (~/.prism/config.yaml)
    ↓
3. Project config (.prism/config.yaml)
    ↓
4. Environment variables
    ↓
5. Command-line flags
```

**Priority**: Command-line flags > Environment variables > Project config > Global config > Defaults

---

## Configuration File

### Global Configuration

**Location**: `~/.prism/config.yaml`

Applies to all projects unless overridden.

```yaml
# ~/.prism/config.yaml
# Global PRISM configuration

# Indexing settings
indexing:
  extensions:
    - .ts
    - .js
    - .tsx
    - .jsx
    - .py
    - .rs
    - .go
    - .java
  exclude:
    - node_modules/**
    - .git/**
    - dist/**
    - build/**
  maxSize: 1
  workers: 4

# Embedding settings
embeddings:
  provider: auto
  model: bge-small-en-v1.5
  batchSize: 10
  cache: true

# Storage settings
storage:
  type: sqlite
  path: .prism/vectors.db

# Cloudflare settings
cloudflare:
  accountId: ${CLOUDFLARE_ACCOUNT_ID}
  apiToken: ${CLOUDFLARE_API_TOKEN}

# Ollama settings
ollama:
  enabled: false
  endpoint: http://localhost:11434
  model: nomic-embed-text

# Chat settings
chat:
  budget: 50000
  model: auto
  apiKey: ${ANTHROPIC_API_KEY}
  temperature: 0.7
  maxTokens: 4096

# Logging settings
logging:
  level: info
  file: ~/.prism/logs/prism.log
  console: true
  color: true
```

### Project Configuration

**Location**: `.prism/config.yaml` (in your project root)

Overrides global config for this project only.

```yaml
# .prism/config.yaml
# Project-specific PRISM configuration

# Override file extensions
indexing:
  extensions:
    - .ts
    - .tsx
    - .vue  # Add Vue support

# Override exclusions
  exclude:
    - node_modules/**
    - .git/**
    - dist/**
    - "**/*.test.ts"
    - "**/*.spec.ts"

# Override chat budget
chat:
  budget: 100000  # Higher budget for this project
```

---

## Environment Variables

Environment variables override configuration file settings.

### General Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PRISM_CONFIG` | string | `~/.prism/config.yaml` | Path to config file |
| `PRISM_VERBOSE` | boolean | `false` | Enable verbose output |
| `PRISM_QUIET` | boolean | `false` | Suppress non-error output |
| `PRISM_LOG_LEVEL` | string | `info` | Log level (debug, info, warn, error) |
| `PRISM_NO_COLOR` | boolean | `false` | Disable colored output |

### Cloudflare Variables

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | string | Yes | Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | string | Yes | Cloudflare API token |

### Ollama Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OLLAMA_ENABLED` | boolean | `false` | Enable Ollama |
| `OLLAMA_ENDPOINT` | string | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | string | `nomic-embed-text` | Embedding model |
| `OLLAMA_CHAT_MODEL` | string | `deepseek-coder-v2` | Chat model |

### Anthropic Variables

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `ANTHROPIC_API_KEY` | string | Yes | Anthropic API key |

### Storage Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PRISM_STORAGE_PATH` | string | `.prism/vectors.db` | Vector DB path |
| `PRISM_CACHE_DIR` | string | `.prism/cache` | Cache directory |
| `PRISM_LOG_FILE` | string | `~/.prism/logs/prism.log` | Log file path |

### Indexing Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PRISM_EXTENSIONS` | string | See defaults | File extensions (comma-separated) |
| `PRISM_EXCLUDE` | string | See defaults | Exclude patterns (comma-separated) |
| `PRISM_MAX_SIZE` | number | `1` | Max file size (MB) |
| `PRISM_WORKERS` | number | `4` | Number of workers |

### Chat Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PRISM_CHAT_BUDGET` | number | `50000` | Token budget |
| `PRISM_CHAT_MODEL` | string | `auto` | Model selection |
| `PRISM_CHAT_TEMPERATURE` | number | `0.7` | Temperature |
| `PRISM_CHAT_MAX_TOKENS` | number | `4096` | Max tokens |

---

## Indexing Options

Control how PRISM scans and parses your codebase.

### Configuration

```yaml
indexing:
  # File extensions to index
  # Type: array of strings
  # Default: ['.ts', '.js', '.tsx', '.jsx', '.py', '.rs', '.go', '.java']
  extensions:
    - .ts
    - .js
    - .tsx
    - .jsx
    - .py
    - .rs
    - .go
    - .java
    - .vue    # Custom: add Vue.js
    - .svelte # Custom: add Svelte

  # Paths/patterns to exclude
  # Type: array of strings (glob patterns)
  # Default: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
  exclude:
    - node_modules/**
    - .git/**
    - dist/**
    - build/**
    - coverage/**
    - "**/*.test.ts"  # Exclude test files
    - "**/*.spec.ts"
    - "**/mocks/**"

  # Maximum file size to index (in MB)
  # Type: number
  # Default: 1
  # Range: 0.1-100
  maxSize: 1

  # Number of parallel workers
  # Type: number
  # Default: 4
  # Range: 1-16
  workers: 4

  # Enable incremental indexing
  # Type: boolean
  # Default: true
  incremental: true

  # Chunk size (in characters)
  # Type: number
  # Default: 1000
  # Range: 500-5000
  chunkSize: 1000

  # Chunk overlap (in characters)
  # Type: number
  # Default: 200
  # Range: 0-1000
  chunkOverlap: 200
```

### Command-Line Flags

```bash
prism index \
  --extensions .ts,.tsx,.vue \
  --exclude "node_modules/**,dist/**" \
  --max-size 0.5 \
  --workers 8
```

### Best Practices

1. **Exclude test files** (unless you need them):
   ```yaml
   exclude:
     - "**/*.test.ts"
     - "**/*.spec.ts"
   ```

2. **Adjust for project size**:
   ```yaml
   # Large project (500K+ LOC)
   workers: 8
   maxSize: 0.5

   # Small project (<50K LOC)
   workers: 2
   maxSize: 2
   ```

3. **Include only relevant languages**:
   ```yaml
   # TypeScript project
   extensions:
     - .ts
     - .tsx
   ```

---

## Embedding Options

Control how PRISM generates vector embeddings.

### Configuration

```yaml
embeddings:
  # Embedding provider
  # Type: string
  # Options: auto, cloudflare, ollama
  # Default: auto
  provider: auto

  # Embedding model name
  # Type: string
  # Options:
  #   - Cloudflare: bge-small-en-v1.5 (384d), bge-base-en-v1.5 (768d)
  #   - Ollama: nomic-embed-text, all-minilm
  # Default: bge-small-en-v1.5
  model: bge-small-en-v1.5

  # Number of embeddings per batch
  # Type: number
  # Default: 10
  # Range: 1-100
  batchSize: 10

  # Cache embeddings locally
  # Type: boolean
  # Default: true
  cache: true

  # Cache directory
  # Type: string
  # Default: .prism/cache/embeddings
  cacheDir: .prism/cache/embeddings
```

### Provider-Specific Options

#### Cloudflare

```yaml
embeddings:
  provider: cloudflare
  model: bge-small-en-v1.5

cloudflare:
  # Cloudflare Account ID
  # Required for cloudflare provider
  accountId: "your-account-id"

  # Cloudflare API Token
  # Required for cloudflare provider
  # Permissions: Account > Cloudflare Workers AI > Edit
  apiToken: "your-api-token"

  # API endpoint
  # Type: string
  # Default: https://api.cloudflare.com/client/v4
  endpoint: https://api.cloudflare.com/client/v4
```

**Get Credentials**:
1. Account ID: https://dash.cloudflare.com → Workers & Pages
2. API Token: https://dash.cloudflare.com → My Profile → API Tokens

#### Ollama

```yaml
embeddings:
  provider: ollama
  model: nomic-embed-text

ollama:
  # Enable Ollama
  # Type: boolean
  # Default: false
  enabled: true

  # Ollama server endpoint
  # Type: string
  # Default: http://localhost:11434
  endpoint: http://localhost:11434

  # Embedding model
  # Type: string
  # Options: nomic-embed-text, all-minilm, mxbai-embed-large
  # Default: nomic-embed-text
  model: nomic-embed-text

  # Request timeout (seconds)
  # Type: number
  # Default: 30
  timeout: 30

  # Retry attempts
  # Type: number
  # Default: 3
  retries: 3
```

**Install Ollama**:
```bash
curl https://ollama.ai/install.sh | sh
ollama pull nomic-embed-text
```

### Model Comparison

| Model | Dimensions | Speed | Quality | Best For |
|-------|------------|-------|---------|----------|
| **bge-small-en-v1.5** | 384 | Fast | Good | General use (default) |
| **bge-base-en-v1.5** | 768 | Medium | Better | Complex queries |
| **nomic-embed-text** | 768 | Medium | Good | Local, offline |
| **all-minilm** | 384 | Fast | Fair | Quick searches |

---

## Storage Options

Control where PRISM stores vector data.

### Configuration

```yaml
storage:
  # Storage type
  # Type: string
  # Options: sqlite, vectorize
  # Default: sqlite
  type: sqlite

  # Database path (for sqlite)
  # Type: string
  # Default: .prism/vectors.db
  path: .prism/vectors.db

  # Vectorize index name (for vectorize)
  # Type: string
  # Default: prism-codebase
  indexName: prism-codebase

  # Enable compression
  # Type: boolean
  # Default: true
  compression: true

  # Sync to cloud (for hybrid)
  # Type: boolean
  # Default: false
  sync: false

  # Sync interval (seconds)
  # Type: number
  # Default: 300 (5 minutes)
  syncInterval: 300
```

### Storage Types

#### SQLite (Default)

**Pros**:
- Fast (local)
- Offline-capable
- No external dependencies

**Cons**:
- Local only
- No sharing across machines

**Configuration**:
```yaml
storage:
  type: sqlite
  path: .prism/vectors.db
```

#### Cloudflare Vectorize

**Pros**:
- Cloud storage
- Accessible from anywhere
- Automatic scaling

**Cons**:
- Requires internet
- Cloudflare account needed
- Potential latency

**Configuration**:
```yaml
storage:
  type: vectorize
  indexName: prism-codebase
```

**Create Vectorize Index**:
```bash
prism vectorize create
```

---

## Chat Options

Control AI model selection and behavior.

### Configuration

```yaml
chat:
  # Token budget for context optimization
  # Type: number
  # Default: 50000
  # Range: 1000-200000
  budget: 50000

  # Model selection strategy
  # Type: string
  # Options: auto, ollama, haiku, sonnet, opus
  # Default: auto
  model: auto

  # Anthropic API key
  # Type: string
  # Required: Yes (for Claude models)
  apiKey: ${ANTHROPIC_API_KEY}

  # Temperature for response generation
  # Type: number
  # Range: 0.0-1.0
  # Default: 0.7
  temperature: 0.7

  # Maximum tokens in response
  # Type: number
  # Default: 4096
  # Range: 256-8192
  maxTokens: 4096

  # Include conversation history
  # Type: boolean
  # Default: true
  history: true

  # History length (number of turns)
  # Type: number
  # Default: 10
  historyLength: 10
```

### Budget Guidelines

| Use Case | Budget | Notes |
|----------|--------|-------|
| **Simple questions** | 10K-20K | "What is X?" |
| **How-to questions** | 30K-50K | "How do I implement X?" |
| **Architecture questions** | 80K-100K | "Explain the system design" |
| **Complex analysis** | 150K+ | "Analyze trade-offs of X vs Y" |

### Model Selection

```yaml
chat:
  model: auto  # Automatic selection based on query
```

| Model | Best For | Speed | Cost |
|-------|----------|-------|------|
| **haiku** | Simple, factual queries | Fast | $0.25/M input |
| **sonnet** | Most development tasks | Medium | $3/M input |
| **opus** | Complex analysis, architecture | Slow | $15/M input |
| **ollama** | Offline, cost-sensitive | Variable | Free |

### Temperature Settings

```yaml
chat:
  temperature: 0.7  # Balanced
```

| Range | Behavior | Best For |
|-------|----------|----------|
| **0.0-0.3** | Focused, deterministic | Factual queries |
| **0.4-0.7** | Balanced (default) | General use |
| **0.8-1.0** | Creative, varied | Brainstorming |

---

## Model Selection

### Auto Mode

When `model: auto`, PRISM selects the best model based on:

1. **Query complexity** (simple vs complex)
2. **Token budget** (how much context is needed)
3. **Available models** (API keys, Ollama)
4. **Cost optimization** (cheapest viable model)

**Selection Logic**:
```typescript
if (tokens < 5000 && complexity < 0.3) {
  return 'haiku';      // Fast, cheap
} else if (tokens < 50000 && complexity < 0.7) {
  return 'sonnet';     // Balanced
} else if (ollamaAvailable && tokens < 10000) {
  return 'ollama';     // Free
} else {
  return 'opus';       // Best quality
}
```

### Manual Selection

Force a specific model:

```bash
prism chat "question" --model sonnet
```

Or in config:

```yaml
chat:
  model: sonnet  # Always use Sonnet
```

### Model-Specific Options

#### Ollama Models

```yaml
chat:
  model: ollama

ollama:
  # Chat model
  # Options: deepseek-coder-v2, codellama, llama2, mistral
  model: deepseek-coder-v2

  # Request timeout (seconds)
  timeout: 120
```

**Available Models**:
- `deepseek-coder-v2` - Best for code (recommended)
- `codellama` - Good for code
- `llama2` - General purpose
- `mistral` - Fast, good quality

---

## Logging Options

Control logging behavior and verbosity.

### Configuration

```yaml
logging:
  # Log level
  # Type: string
  # Options: debug, info, warn, error
  # Default: info
  level: info

  # Log file path
  # Type: string
  # Default: ~/.prism/logs/prism.log
  # Use empty string to disable
  file: ~/.prism/logs/prism.log

  # Console output
  # Type: boolean
  # Default: true
  console: true

  # Color output
  # Type: boolean
  # Default: true
  color: true

  # Log rotation
  # Type: boolean
  # Default: true
  rotation: true

  # Max log file size (MB)
  # Type: number
  # Default: 10
  maxSize: 10

  # Number of log files to keep
  # Type: number
  # Default: 5
  maxFiles: 5
```

### Log Levels

| Level | Description | When to Use |
|-------|-------------|-------------|
| **debug** | Detailed debugging info | Troubleshooting |
| **info** | General information | Normal use (default) |
| **warn** | Warnings only | Production |
| **error** | Errors only | Silent mode |

### Enable Debug Logging

```bash
# Via environment
export PRISM_LOG_LEVEL=debug

# Via config
logging:
  level: debug

# Via command line
prism --verbose search "test"
```

---

## Example Configurations

### Minimal Configuration

For users who want defaults:

```yaml
# ~/.prism/config.yaml
chat:
  apiKey: ${ANTHROPIC_API_KEY}
```

### Development Configuration

Fast, local-first development:

```yaml
# ~/.prism/config.yaml
embeddings:
  provider: ollama
  model: nomic-embed-text

ollama:
  enabled: true
  endpoint: http://localhost:11434

chat:
  model: ollama
  budget: 30000

logging:
  level: debug
```

### Production Configuration

Cloud-based, optimized for cost:

```yaml
# ~/.prism/config.yaml
embeddings:
  provider: cloudflare
  model: bge-small-en-v1.5
  batchSize: 20

cloudflare:
  accountId: ${CLOUDFLARE_ACCOUNT_ID}
  apiToken: ${CLOUDFLARE_API_TOKEN}

chat:
  model: auto
  budget: 50000
  temperature: 0.7

logging:
  level: info
```

### Large Project Configuration

For codebases with 500K+ LOC:

```yaml
# .prism/config.yaml (project-specific)
indexing:
  exclude:
    - node_modules/**
    - .git/**
    - dist/**
    - build/**
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "**/mocks/**"
    - "**/__tests__/**"
    - "**/coverage/**"
  maxSize: 0.5  # Smaller files only
  workers: 8     # More parallelism

storage:
  type: vectorize  # Use cloud for large indexes

chat:
  budget: 100000  # Higher budget for complex codebases
```

### CI/CD Configuration

For automated environments:

```yaml
# ~/.prism/config.yaml
logging:
  level: warn
  console: false
  file: ""

chat:
  model: haiku  # Cheapest option
  budget: 20000
```

---

## Configuration Validation

PRISM validates configuration on startup.

### Validation Rules

**Indexing**:
- `extensions`: Must start with `.` (e.g., `.ts`, not `ts`)
- `maxSize`: Must be between 0.1 and 100
- `workers`: Must be between 1 and 16

**Embeddings**:
- `provider`: Must be one of `auto`, `cloudflare`, `ollama`
- `batchSize`: Must be between 1 and 100

**Storage**:
- `type`: Must be one of `sqlite`, `vectorize`

**Chat**:
- `budget`: Must be between 1000 and 200000
- `temperature`: Must be between 0.0 and 1.0
- `maxTokens`: Must be between 256 and 8192

### Validate Configuration

```bash
# Test configuration
prism config validate

# Show current configuration
prism config show

# Show with defaults
prism config show --all

# Show effective configuration
prism config show --effective
```

---

**Document Status**: Complete
**Last Updated**: 2026-01-13
**Version**: 0.1.0
