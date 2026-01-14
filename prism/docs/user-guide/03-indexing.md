# Indexing Guide

**Last Updated**: 2026-01-13
**Version**: 0.1.0
**Status**: Beta

## Overview

Prism's indexer transforms your codebase into a searchable vector database using AST-based parsing and semantic chunking. This enables fast, accurate code search and RAG-powered code generation.

**Key Benefits:**
- Index 100K+ LOC in under 30 seconds
- Support for 6+ programming languages
- Semantic understanding of code structure
- Incremental updates for changed files

---

## How Indexing Works

### 1. File Discovery

The indexer scans your codebase using glob patterns to find files matching supported languages:

```
your-project/
├── src/
│   ├── *.ts          ← Discovered
│   ├── *.tsx         ← Discovered
│   └── *.test.ts     ← Discovered
├── node_modules/     ← Skipped (excluded)
├── dist/            ← Skipped (excluded)
└── package.json     ← Skipped (not code)
```

**Default Include Patterns:**
```bash
**/*.{ts,tsx,js,jsx}     # TypeScript/JavaScript
**/*.{py,pyi}            # Python
**/*.{rs}                # Rust
**/*.{go}                # Go
**/*.{java}              # Java
```

**Default Exclude Patterns:**
```bash
**/node_modules/**       # Dependencies
**/dist/**               # Build output
**/build/**              # Build output
**/.git/**               # Git metadata
**/coverage/**           # Test coverage
**/*.min.js              # Minified files
**/*.test.{ts,js}        # Test files (optional)
```

### 2. AST Parsing

Each discovered file is parsed using Tree-sitter, which generates an Abstract Syntax Tree (AST):

```typescript
// Input: function.ts
function greet(name: string): string {
  return `Hello, ${name}!`;
}

// AST Representation:
FunctionDeclaration {
  name: Identifier("greet")
  parameters: [
    Parameter {
      name: Identifier("name")
      type: TypeAnnotation("string")
    }
  ]
  return_type: TypeAnnotation("string")
  body: BlockStatement {
    ReturnStatement {
      argument: TemplateExpression {
        parts: ["Hello, ", Identifier("name"), "!"]
      }
    }
  }
}
```

**Why AST Parsing?**
- **Semantic Understanding**: Knows what functions, classes, and imports are
- **Error Recovery**: Continues parsing even with syntax errors
- **Language Agnostic**: Same process for all supported languages
- **Structure Preservation**: Maintains code relationships

### 3. Chunk Extraction

The AST is divided into semantic chunks suitable for vector embeddings:

**Chunking Strategy:**
1. **Extract semantic units** (functions, classes, methods)
2. **Group by target size** (default: 512 tokens)
3. **Add overlap** (default: 128 tokens) between chunks
4. **Preserve context** (imports, parent class info)

**Example:**

```typescript
// Original File (800 tokens)
class UserService {
  constructor(private db: Database) {}

  async getUser(id: string): Promise<User> {
    return await this.db.find(id);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    return await this.db.update(id, data);
  }
}
```

**Chunk 1 (with context):**
```typescript
import { Database } from './db';

class UserService {
  constructor(private db: Database) {}

  async getUser(id: string): Promise<User> {
    return await this.db.find(id);
  }
}
// ~400 tokens
```

**Chunk 2 (with overlap):**
```typescript
class UserService {
  constructor(private db: Database) {}

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    return await this.db.update(id, data);
  }
}
// ~400 tokens
```

### 4. Embedding Generation

Each chunk is converted into a vector embedding using Cloudflare Workers AI:

```
Code Chunk (text)
    ↓
Embedding Model (@cf/baai/bge-small-en-v1.5)
    ↓
Vector [0.234, -0.123, 0.456, ..., 0.789]  (384 dimensions)
```

**Embedding Model:**
- **Model**: BGE-small-en-v1.5
- **Dimensions**: 384
- **Cost**: Free (Cloudflare Workers AI)
- **Quality**: State-of-the-art for code search

### 5. Vector Storage

Embeddings are stored in a vector database for fast similarity search:

```
Vector Database
├── Chunk ID
├── Vector (384 floats)
├── Metadata
│   ├── File path
│   ├── Line numbers
│   ├── Language
│   └── Functions/classes
└── Original text
```

**Storage Options:**
- **Local**: SQLite with FTS5 extension (default)
- **Cloud**: Cloudflare Vectorize (optional sync)

---

## Usage

### Basic Indexing

Index the current directory:

```bash
prism index
```

Output:
```
✓ Loading configuration...
✓ Found 142 files to index
✓ Indexer initialized

Indexing files...
  ████████████████████░░░░  80%  (113/142 files)

Indexing Complete!
──────────────────────────────────────────────────
  Files Indexed:  142
  Chunks Created: 487
  Total Tokens:   125,430
──────────────────────────────────────────────────
  Duration:       12s
  Speed:          11.83 files/sec
```

### Index Specific Directory

Index a specific directory:

```bash
prism index src
```

Index with custom output:

```bash
prism index src --output ~/.prism/custom-index.db
```

### Force Re-indexing

Force complete re-indexing even if index exists:

```bash
prism index --force
```

Use this when:
- Configuration has changed
- Chunk size has been modified
- Index appears corrupted

### Watch Mode (Future)

Watch for changes and re-index automatically (not yet implemented):

```bash
prism index --watch
```

Expected behavior:
- Monitor file system for changes
- Re-parse only modified files
- Update vector database incrementally

### Custom Patterns

Override include/exclude patterns:

```bash
# Only index TypeScript files
prism index --include-patterns "**/*.ts,**/*.tsx"

# Include Python files
prism index --include-patterns "**/*.py"

# Exclude test files
prism index --exclude-patterns "**/*.test.ts,**/*.spec.ts"

# Multiple patterns
prism index \
  --include-patterns "**/*.ts,**/*.tsx,**/*.py" \
  --exclude-patterns "**/dist/**,**/node_modules/**"
```

### Custom Chunk Size

Adjust chunk size and overlap:

```bash
# Smaller chunks (more precise retrieval)
prism index --chunk-size 256 --overlap 64

# Larger chunks (more context per chunk)
prism index --chunk-size 1024 --overlap 256

# No overlap (less storage, less context)
prism index --chunk-size 512 --overlap 0
```

**Trade-offs:**

| Chunk Size | Pros | Cons | Best For |
|------------|------|------|----------|
| **256** | Precise retrieval, less noise | More chunks, slower search | Fine-grained code search |
| **512** (default) | Balanced context and precision | - | General use |
| **1024** | More context per chunk | Less precise, larger storage | Documentation-heavy code |

---

## Configuration

### Project Configuration

Create `.prismrc.json` in your project root:

```json
{
  "indexer": {
    "includePatterns": [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx"
    ],
    "excludePatterns": [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.test.ts"
    ],
    "chunkSize": 512,
    "overlap": 128
  }
}
```

### Global Configuration

Create `~/.prism/config.json` for global settings:

```json
{
  "indexer": {
    "parallelism": 4,
    "batchSize": 100,
    "maxFileSize": 1048576
  },
  "vectorDB": {
    "path": "~/.prism/vector.db",
    "cloudflare": {
      "enabled": false,
      "accountId": "your-account-id",
      "apiKey": "your-api-key"
    }
  }
}
```

### Configuration Priority

Settings are merged in this order (later overrides earlier):

1. Global defaults (`~/.prism/config.json`)
2. Project config (`.prismrc.json`)
3. CLI flags (`--chunk-size`, etc.)

Example:
```bash
# Global: chunkSize = 512
# Project: chunkSize = 1024
# CLI: --chunk-size 256
# Result: chunkSize = 256 (CLI wins)
```

---

## Language Support

### Supported Languages

| Language | Extensions | Status | Parser |
|----------|-----------|--------|--------|
| **TypeScript** | `.ts`, `.tsx` | ✅ Stable | tree-sitter-typescript |
| **JavaScript** | `.js`, `.jsx` | ✅ Stable | tree-sitter-javascript |
| **Python** | `.py`, `.pyi` | ✅ Stable | tree-sitter-python |
| **Rust** | `.rs` | ✅ Stable | tree-sitter-rust |
| **Go** | `.go` | ✅ Stable | tree-sitter-go |
| **Java** | `.java` | ✅ Stable | tree-sitter-java |

### Mixed-Language Repositories

Prism handles monorepos with multiple languages:

```bash
# Monorepo structure
monorepo/
├── frontend/    # TypeScript
├── backend/     # Python
├── worker/      # Rust
└── mobile/      # Java

# Index entire monorepo
prism index .

# Prism automatically detects language per file
```

### Adding New Languages

To add support for a new language:

1. **Install tree-sitter grammar**
   ```bash
   cd prism-indexer
   cargo add tree-sitter-cpp
   ```

2. **Update parser**
   ```rust
   // prism-indexer/src/parser.rs
   "cpp" => tree_sitter_cpp::language_cpp(),
   ```

3. **Rebuild WASM**
   ```bash
   wasm-pack build --target web
   ```

4. **Test**
   ```bash
   prism index test.cpp --verbose
   ```

---

## Performance Tuning

### Memory Usage

**Target:** <100MB for 1M LOC

**Optimization Tips:**

1. **Use incremental indexing**
   ```bash
   prism index --watch  # Only re-index changed files
   ```

2. **Adjust batch size**
   ```json
   {
     "indexer": {
       "batchSize": 50  // Reduce memory pressure
     }
   }
   ```

3. **Stream embeddings**
   ```bash
   prism index --stream  # Send embeddings as they're generated
   ```

### Speed Optimization

**Target:** <30s for 100K LOC

**Optimization Tips:**

1. **Increase parallelism**
   ```json
   {
     "indexer": {
       "parallelism": 8  // Use more CPU cores
     }
   }
   ```

2. **Use SSD storage**
   ```bash
   prism index --output /ssd/prism/index.db  # Faster I/O
   ```

3. **Skip unnecessary files**
   ```bash
   prism index --exclude-patterns "**/*.test.ts,**/*.spec.ts"
   ```

### Large File Handling

Files >1MB are handled specially:

```bash
# Skip very large files
prism index --max-file-size 1048576  # 1MB

# Or parse in chunks (experimental)
prism index --chunk-large-files
```

---

## Troubleshooting

### No Files Found

```bash
$ prism index
⚠ No files found to index
```

**Solutions:**
- Check include patterns: `prism index --verbose`
- Verify directory path: `ls -la src/`
- Override patterns: `prism index --include-patterns "**/*.ts"`

### Parsing Errors

```bash
$ prism index --verbose
✗ Failed to parse src/file.ts: Syntax error at line 42
```

**Solutions:**
- Prism continues despite errors
- Fix syntax errors in source files
- Use `--force` to re-index after fixes

### WASM Loading Errors

```bash
$ prism index
✗ Failed to load WASM module
```

**Solutions:**
- Rebuild WASM: `cd prism-indexer && wasm-pack build`
- Check Node.js version: `node --version` (requires >=18)
- Clear npm cache: `npm cache clean --force`

### Out of Memory

```bash
$ prism index
✗ JavaScript heap out of memory
```

**Solutions:**
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096 prism index`
- Reduce batch size: `prism index --batch-size 50`
- Index in smaller chunks: `prism index src/components && prism index src/utils`

---

## Advanced Usage

### Incremental Updates

Manually update only changed files:

```bash
# Detect changed files using git
git diff --name-only | prism index --files-from -

# Or use find
find src -name "*.ts" -newer ~/.prism/last-index | prism index --files-from -
```

### CI/CD Integration

```yaml
# .github/workflows/index.yml
name: Index Codebase
on: [push]

jobs:
  index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Prism
        run: npm install -g @prism/cli
      - name: Index Codebase
        run: prism index --output ./prism-index.db
      - name: Upload Index
        uses: actions/upload-artifact@v3
        with:
          name: prism-index
          path: ./prism-index.db
```

### Pre-commit Hooks

```bash
# .git/hooks/pre-commit
#!/bin/bash
echo "Indexing changed files..."
git diff --cached --name-only | grep '\.ts$' | prism index --files-from -
```

---

## Best Practices

### When to Index

1. **After major changes**: New features, refactoring
2. **Before releases**: Ensure index is up-to-date
3. **In CI/CD**: Keep index synchronized with code

### What to Index

**Include:**
- Source code (`src/`, `lib/`, `app/`)
- Tests (optional, for test search)
- Configuration (if relevant)

**Exclude:**
- Dependencies (`node_modules/`, `vendor/`)
- Build artifacts (`dist/`, `build/`)
- Generated code (`*.generated.ts`)

### Index Maintenance

```bash
# Rebuild index periodically
prism index --force

# Check index health
prism index --check

# Remove old index
rm ~/.prism/vector.db
prism index
```

---

## Next Steps

- **Learn about language support**: [Language Support Guide](../guide/04-language-support.md)
- **Optimize performance**: [Performance Guide](../guide/05-performance.md)
- **Troubleshoot issues**: [Troubleshooting](../troubleshooting/01-indexing.md)
- **Understand architecture**: [Indexer Architecture](../architecture/04-indexer-architecture.md)

---

**Need Help?**
- GitHub Issues: [https://github.com/prism/prism/issues](https://github.com/prism/prism/issues)
- Discord: [https://discord.gg/prism](https://discord.gg/prism)
- Email: support@prism.dev
