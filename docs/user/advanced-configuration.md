# PRISM Configuration Guide

**Component**: PRISM Configuration
**Version**: 0.1.0
**Last Updated**: 2026-01-13

## Overview

PRISM uses a hierarchical configuration system that allows customization at multiple levels:

1. **Global config** (`~/.prism/config.yaml`) - System-wide defaults
2. **Project config** (`.prism/config.yaml`) - Project-specific overrides
3. **Environment variables** - Runtime overrides
4. **Command-line flags** - Per-command overrides

Priority (highest to lowest): CLI flags > Environment variables > Project config > Global config > Defaults

---

## Configuration File Format

PRISM uses YAML configuration files for readability and ease of editing.

### Global Configuration

Location: `~/.prism/config.yaml`

```yaml
# Global PRISM configuration
# This file applies to all projects unless overridden

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
  maxSize: 1  # MB
  workers: 4

embeddings:
  provider: auto  # auto, cloudflare, ollama
  model: bge-small-en-v1.5
  batchSize: 10

storage:
  type: sqlite  # sqlite, vectorize
  path: .prism/vectors.db

cloudflare:
  accountId: ${CLOUDFLARE_ACCOUNT_ID}
  apiToken: ${CLOUDFLARE_API_TOKEN}

ollama:
  enabled: false
  endpoint: http://localhost:11434
  model: nomic-embed-text

chat:
  budget: 50000
  model: auto  # auto, ollama, haiku, sonnet, opus
  apiKey: ${ANTHROPIC_API_KEY}
  temperature: 0.7
  maxTokens: 4096

logging:
  level: info  # debug, info, warn, error
  file: ~/.prism/logs/prism.log
```

### Project Configuration

Location: `.prism/config.yaml` (in your project root)

```yaml
# Project-specific PRISM configuration
# Overrides global config for this project only

indexing:
  extensions:
    - .ts
    - .tsx
    - .vue  # Add Vue support
  exclude:
    - node_modules/**
    - .git/**
    - dist/**
    - "**/*.test.ts"  # Exclude tests
    - "**/*.spec.ts"

storage:
  path: .prism/vectors.db

chat:
  budget: 100000  # Higher budget for this project
```

---

## Configuration Options

### Indexing Options

Control how PRISM scans and parses your codebase.

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
    - .vue  # Custom: add Vue.js support
    - .svelte  # Custom: add Svelte support

  # Paths/patterns to exclude from indexing
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
  # Recommended: 0.5-5 depending on your needs
  maxSize: 1

  # Number of parallel workers for indexing
  # Type: number
  # Default: 4
  # Recommended: 2-8, depending on CPU cores
  workers: 4

  # Enable incremental indexing (only changed files)
  # Type: boolean
  # Default: true
  # Recommended: true for faster updates
  incremental: true
```

**Validation Rules**:
- `extensions`: Must start with `.` (e.g., `.ts`, not `ts`)
- `maxSize`: Must be between 0.1 and 100
- `workers`: Must be between 1 and 16
- `exclude`: Uses gitignore-style glob patterns

---

### Embeddings Options

Control how PRISM generates vector embeddings.

```yaml
embeddings:
  # Embedding provider
  # Type: string
  # Options: auto, cloudflare, ollama
  # Default: auto
  # - auto: Automatically choose best available
  # - cloudflare: Use Cloudflare Workers AI (requires API key)
  # - ollama: Use local Ollama (requires installation)
  provider: auto

  # Embedding model name
  # Type: string
  # Options depend on provider:
  # - Cloudflare: bge-small-en-v1.5 (384d), bge-base-en-v1.5 (768d)
  # - Ollama: nomic-embed-text, all-minilm
  # Default: bge-small-en-v1.5
  model: bge-small-en-v1.5

  # Number of embeddings to generate per batch
  # Type: number
  # Default: 10
  # Recommended: 5-20 for performance
  batchSize: 10

  # Cache embeddings locally
  # Type: boolean
  # Default: true
  # Recommended: true for faster re-indexing
  cache: true

  # Cache directory
  # Type: string
  # Default: .prism/cache/embeddings
  cacheDir: .prism/cache/embeddings
```

**Provider-Specific Options**:

```yaml
embeddings:
  provider: cloudflare
  model: bge-small-en-v1.5

cloudflare:
  # Cloudflare Account ID
  # Type: string
  # Required: Yes (for cloudflare provider)
  # Get from: https://dash.cloudflare.com → Workers & Pages
  accountId: "your-account-id"

  # Cloudflare API Token
  # Type: string
  # Required: Yes (for cloudflare provider)
  # Get from: https://dash.cloudflare.com → My Profile → API Tokens
  # Permissions needed: Account > Cloudflare Workers AI > Edit
  apiToken: "your-api-token"

  # API endpoint (usually don't need to change)
  # Type: string
  # Default: https://api.cloudflare.com/client/v4
  endpoint: https://api.cloudflare.com/client/v4
```

```yaml
embeddings:
  provider: ollama
  model: nomic-embed-text

ollama:
  # Enable Ollama integration
  # Type: boolean
  # Default: false
  enabled: true

  # Ollama server endpoint
  # Type: string (URL)
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

  # Retry attempts on failure
  # Type: number
  # Default: 3
  retries: 3
```

**Validation Rules**:
- `provider`: Must be one of `auto`, `cloudflare`, `ollama`
- `batchSize`: Must be between 1 and 100
- `cacheDir`: Must be a valid directory path

---

### Storage Options

Control where PRISM stores vector data.

```yaml
storage:
  # Storage type
  # Type: string
  # Options: sqlite, vectorize
  # Default: sqlite
  # - sqlite: Local SQLite database (fast, offline-capable)
  # - vectorize: Cloudflare Vectorize (cloud, persistent)
  type: sqlite

  # Database path (for sqlite)
  # Type: string
  # Default: .prism/vectors.db
  # Can be absolute or relative path
  path: .prism/vectors.db

  # Vectorize index name (for vectorize)
  # Type: string
  # Default: prism-codebase
  indexName: prism-codebase

  # Enable compression
  # Type: boolean
  # Default: true
  # Recommended: true to save disk space
  compression: true

  # Sync to cloud (for hybrid storage)
  # Type: boolean
  # Default: false
  sync: false

  # Sync interval (seconds)
  # Type: number
  # Default: 300 (5 minutes)
  syncInterval: 300
```

**Validation Rules**:
- `type`: Must be one of `sqlite`, `vectorize`
- `path`: Must be writable directory path
- `syncInterval`: Must be between 10 and 3600

---

### Chat Options

Control AI model selection and behavior.

```yaml
chat:
  # Token budget for context optimization
  # Type: number
  # Default: 50000
  # Recommended: 10000-200000 depending on use case
  # - Lower (10K): Simple queries, fast responses
  # - Medium (50K): General development (default)
  # - Higher (100K+): Complex architecture questions
  budget: 50000

  # Model selection strategy
  # Type: string
  # Options: auto, ollama, haiku, sonnet, opus
  # Default: auto
  # - auto: Automatically choose based on query
  # - ollama: Use local Ollama (free, requires installation)
  # - haiku: Claude 3 Haiku (fast, cheap)
  # - sonnet: Claude 3.5 Sonnet (balanced, recommended)
  # - opus: Claude 3 Opus (best quality, expensive)
  model: auto

  # Anthropic API key
  # Type: string
  # Required: Yes (for Claude models)
  # Get from: https://console.anthropic.com/
  # Can also use ANTHROPIC_API_KEY environment variable
  apiKey: ${ANTHROPIC_API_KEY}

  # Temperature for response generation
  # Type: number
  # Range: 0.0-1.0
  # Default: 0.7
  # - Lower (0.0-0.3): More focused, deterministic
  # - Medium (0.4-0.7): Balanced (default)
  # - Higher (0.8-1.0): More creative, varied
  temperature: 0.7

  # Maximum tokens in response
  # Type: number
  # Default: 4096
  # Recommended: 1024-8192
  maxTokens: 4096

  # Include conversation history
  # Type: boolean
  # Default: true
  # Recommended: true for follow-up questions
  history: true

  # History length (number of turns)
  # Type: number
  # Default: 10
  # Recommended: 5-20
  historyLength: 10
```

**Model-Specific Options**:

```yaml
chat:
  model: ollama

ollama:
  # Ollama chat model
  # Type: string
  # Options: deepseek-coder-v2, codellama, llama2, mistral
  # Default: deepseek-coder-v2
  model: deepseek-coder-v2

  # Request timeout (seconds)
  # Type: number
  # Default: 120
  timeout: 120
```

**Validation Rules**:
- `budget`: Must be between 1000 and 200000
- `temperature`: Must be between 0.0 and 1.0
- `maxTokens`: Must be between 256 and 8192

---

### Logging Options

Control logging behavior and verbosity.

```yaml
logging:
  # Log level
  # Type: string
  # Options: debug, info, warn, error
  # Default: info
  # - debug: Detailed debugging info
  # - info: General information (default)
  # - warn: Warnings only
  # - error: Errors only
  level: info

  # Log file path
  # Type: string
  # Default: ~/.prism/logs/prism.log
  # Use empty string to disable file logging
  file: ~/.prism/logs/prism.log

  # Console output
  # Type: boolean
  # Default: true
  # Set to false to suppress console output
  console: true

  # Color output
  # Type: boolean
  # Default: true
  # Set to false for plain text
  color: true

  # Log rotation
  # Type: boolean
  # Default: true
  # Automatically rotate log files when they get too large
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

**Validation Rules**:
- `level`: Must be one of `debug`, `info`, `warn`, `error`
- `maxSize`: Must be between 1 and 100
- `maxFiles`: Must be between 1 and 20

---

## Environment Variables

Environment variables override configuration file settings.

### General

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PRISM_CONFIG` | string | `~/.prism/config.yaml` | Path to config file |
| `PRISM_VERBOSE` | boolean | `false` | Enable verbose output |
| `PRISM_QUIET` | boolean | `false` | Suppress non-error output |
| `PRISM_LOG_LEVEL` | string | `info` | Log level (debug, info, warn, error) |
| `PRISM_NO_COLOR` | boolean | `false` | Disable colored output |

### Cloudflare

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | string | Yes | Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | string | Yes | Cloudflare API token |

### Ollama

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OLLAMA_ENABLED` | boolean | `false` | Enable Ollama |
| `OLLAMA_ENDPOINT` | string | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | string | `nomic-embed-text` | Embedding model |
| `OLLAMA_CHAT_MODEL` | string | `deepseek-coder-v2` | Chat model |

### Anthropic

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `ANTHROPIC_API_KEY` | string | Yes | Anthropic API key |

### Storage

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PRISM_STORAGE_PATH` | string | `.prism/vectors.db` | Vector DB path |
| `PRISM_CACHE_DIR` | string | `.prism/cache` | Cache directory |
| `PRISM_LOG_FILE` | string | `~/.prism/logs/prism.log` | Log file path |

### Indexing

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PRISM_EXTENSIONS` | string | See defaults | File extensions (comma-separated) |
| `PRISM_EXCLUDE` | string | See defaults | Exclude patterns (comma-separated) |
| `PRISM_MAX_SIZE` | number | `1` | Max file size (MB) |
| `PRISM_WORKERS` | number | `4` | Number of workers |

### Chat

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PRISM_CHAT_BUDGET` | number | `50000` | Token budget |
| `PRISM_CHAT_MODEL` | string | `auto` | Model selection |
| `PRISM_CHAT_TEMPERATURE` | number | `0.7` | Temperature |
| `PRISM_CHAT_MAX_TOKENS` | number | `4096` | Max tokens |

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

PRISM validates configuration on startup. Common errors:

### Invalid Provider

```yaml
# WRONG
embeddings:
  provider: azure  # Not supported
```

```
Error: VANTAGE_013: Invalid configuration
  embeddings.provider must be one of: auto, cloudflare, ollama
```

### Invalid File Size

```yaml
# WRONG
indexing:
  maxSize: 200  # Too large
```

```
Error: VANTAGE_013: Invalid configuration
  indexing.maxSize must be between 0.1 and 100
```

### Missing API Key

```yaml
# WRONG (no API key set)
chat:
  model: sonnet
```

```
Error: VANTAGE_002: Authentication failed
  ANTHROPIC_API_KEY not set. Please set environment variable or add to config.
```

---

## Best Practices

### 1. Use Environment Variables for Secrets

Never commit API keys:

```yaml
# GOOD - Use environment variable
chat:
  apiKey: ${ANTHROPIC_API_KEY}

# BAD - Hardcoded key
chat:
  apiKey: sk-ant-xxx...
```

### 2. Project-Specific Overrides

Keep project-specific settings in project config:

```yaml
# ~/.prism/config.yaml (global defaults)
indexing:
  workers: 4

# .prism/config.yaml (project override)
indexing:
  workers: 8  # More workers for this project
```

### 3. Version Control

Commit project config but exclude global config:

```gitignore
# .gitignore
.prism/cache/
.prism/vectors.db
.prism/logs/
```

```yaml
# .prism/config.yaml (committed)
indexing:
  extensions:
    - .ts
    - .tsx
  exclude:
    - "**/*.test.ts"
```

### 4. Document Custom Settings

Add comments for non-default settings:

```yaml
# Using Ollama for faster local development
embeddings:
  provider: ollama

# Higher budget for complex architecture questions
chat:
  budget: 100000
```

---

## Testing Configuration

Verify your configuration:

```bash
# Test configuration loading
prism config validate

# Show current configuration
prism config show

# Show configuration with defaults
prism config show --all

# Show effective configuration (with env vars applied)
prism config show --effective
```

---

**Document Status**: Complete
**Last Updated**: 2026-01-13
**Next Review**: After v0.2.0 release
