# Architecture Overview

**Component**: PRISM Development Guide
**Status**: Development Document
**Priority**: Foundational
**Last Updated**: 2026-01-13

## Purpose

This document provides contributors with a comprehensive understanding of PRISM's architecture, including module organization, extension points, adding new features, and breaking changes policy.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Module Organization](#2-module-organization)
3. [Core Components](#3-core-components)
4. [Extension Points](#4-extension-points)
5. [Adding New Features](#5-adding-new-features)
6. [Breaking Changes Policy](#6-breaking-changes-policy)
7. [Technical Debt](#7-technical-debt)
8. [Known Issues](#8-known-issues)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         PRISM                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    CLI Layer                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │ Commands │  │ Progress │  │   Error Handling │   │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Core Engine                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │   Indexer   │  │ Token Opt. │  │ Model Router│  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Services                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │ Vector DB│  │ Embedding │  │      MCP         │   │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Storage                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │  Local   │  │Cloudflare│  │      Ollama       │   │  │
│  │  │  SQLite  │  │ Vectorize│  │                    │   │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

1. **Modularity** - Each component has a single, well-defined responsibility
2. **Extensibility** - Easy to add new languages, storage backends, and models
3. **Performance** - Optimized for speed and memory efficiency
4. **Simplicity** - Clear, understandable code with minimal complexity
5. **Testing** - Every component is testable in isolation

### 1.3 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **CLI** | Node.js/TypeScript | Familiarity, ecosystem |
| **Indexer** | Rust/WASM | Performance, portability |
| **Vector DB** | SQLite + Vectorize | Local speed + cloud sync |
| **Embeddings** | Workers AI | Free tier, no API keys |
| **LLM** | Ollama + Claude | Local + cloud fallback |

---

## 2. Module Organization

### 2.1 Directory Structure

```
prism/
├── src/
│   ├── cli/                    # Command-line interface
│   │   ├── index.ts            # CLI entry point
│   │   ├── commands/           # Command implementations
│   │   ├── progress.ts         # Progress reporting
│   │   └── errors.ts           # Error handling
│   │
│   ├── core/                   # Core PRISM engine
│   │   ├── index.ts            # Core exports
│   │   ├── types.ts            # Core type definitions
│   │   └── PrismEngine.ts      # Main orchestration
│   │
│   ├── indexer/                # Code indexing pipeline
│   │   ├── index.ts            # Indexer exports
│   │   ├── types.ts            # Indexer types
│   │   └── IndexerOrchestrator.ts  # Orchestration logic
│   │
│   ├── vector-db/              # Vector database abstraction
│   │   ├── index.ts            # Vector DB exports
│   │   ├── VectorDatabase.ts   # Main implementation
│   │   └── adapters/           # Storage adapters
│   │       ├── SQLite.ts       # Local SQLite
│   │       └── Vectorize.ts    # Cloudflare Vectorize
│   │
│   ├── token-optimizer/        # Context optimization
│   │   ├── index.ts
│   │   ├── TokenOptimizer.ts   # Main optimizer
│   │   ├── scoring/            # Relevance scoring
│   │   └── compression/        # Compression algorithms
│   │
│   ├── model-router/           # Model selection
│   │   ├── index.ts
│   │   ├── ModelRouter.ts      # Routing logic
│   │   └── providers/          # LLM providers
│   │       ├── Ollama.ts       # Local Ollama
│   │       └── Claude.ts       # Anthropic Claude
│   │
│   ├── embeddings/             # Embedding generation
│   │   ├── index.ts
│   │   ├── EmbeddingService.ts # Main service
│   │   └── providers/          # Embedding providers
│   │       ├── WorkersAI.ts    # Cloudflare Workers
│   │       └── Ollama.ts       # Local Ollama
│   │
│   ├── mcp/                    # MCP server implementation
│   │   ├── index.ts
│   │   ├── MCPServer.ts        # Server implementation
│   │   └── tools/              # Tool definitions
│   │
│   ├── ollama/                 # Ollama integration
│   │   ├── index.ts
│   │   ├── OllamaClient.ts     # HTTP client
│   │   ├── HealthMonitor.ts    # Health checks
│   │   └── ModelDetector.ts    # Model detection
│   │
│   ├── config/                 # Configuration management
│   │   ├── index.ts
│   │   └── loader.ts           # Config loading
│   │
│   └── utils/                  # Utilities
│       ├── logger.ts           # Logging
│       ├── error.ts            # Error types
│       └── metrics.ts          # Performance metrics
│
├── prism-indexer/              # Rust WASM indexer
│   ├── src/
│   │   ├── lib.rs              # WASM exports
│   │   ├── parser.rs           # Parser wrapper
│   │   ├── languages.rs        # Language registry
│   │   ├── extractor.rs        # AST extraction
│   │   ├── chunker.rs          # Code chunking
│   │   └── error.rs            # Error types
│   └── Cargo.toml              # Rust configuration
│
├── tests/                      # Test files
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── fixtures/               # Test fixtures
│
└── docs/                       # Documentation
    ├── architecture/           # Architecture docs
    ├── api/                    # API documentation
    ├── development/            # Development guides
    └── user-guide/             # User documentation
```

### 2.2 Module Dependencies

```
cli
  ├─→ core
  │     ├─→ indexer
  │     ├─→ token-optimizer
  │     └─→ model-router
  │           ├─→ ollama
  │           └─→ embeddings
  │                 ├─→ vector-db
  │                 └─→ ollama
  ├─→ mcp
  │     ├─→ core
  │     └─→ vector-db
  └─→ config
```

**Key patterns:**
- CLI depends on Core, not individual services
- Core orchestrates services but doesn't implement them
- Services are independent and can be swapped
- No circular dependencies

---

## 3. Core Components

### 3.1 CLI Layer

**Purpose:** User-facing command-line interface

**Key responsibilities:**
- Parse command-line arguments
- Display progress and results
- Handle errors gracefully
- Load configuration

**Main class:** `CLI` (`src/cli/index.ts`)

```typescript
class CLI {
  constructor(private config: Config) {}

  async execute(args: string[]): Promise<void> {
    const command = this.parseCommand(args);
    const handler = this.getHandler(command);

    try {
      await handler.execute(command);
    } catch (error) {
      this.handleError(error);
    }
  }

  private parseCommand(args: string[]): Command { }
  private getHandler(command: Command): CommandHandler { }
  private handleError(error: Error): void { }
}
```

**Commands:** (`src/cli/commands/`)
- `index.ts` - Index codebase
- `search.ts` - Search indexed code
- `chat.ts` - Interactive chat
- `stats.ts` - Display statistics

### 3.2 Core Engine

**Purpose:** Orchestrate all services

**Key responsibilities:**
- Coordinate indexing, search, and optimization
- Manage service lifecycle
- Handle caching
- Track metrics

**Main class:** `PrismEngine` (`src/core/PrismEngine.ts`)

```typescript
class PrismEngine {
  constructor(
    private indexer: IIndexer,
    private vectorDB: IVectorDatabase,
    private embeddings: IEmbeddingService,
    private optimizer: ITokenOptimizer,
    private router: IModelRouter
  ) {}

  async index(codebase: string): Promise<IndexResult> { }
  async search(query: string): Promise<SearchResult[]> { }
  async optimize(prompt: string, budget: number): Promise<OptimizedPrompt> { }
  async route(tokens: number, complexity: number): Promise<ModelChoice> { }
}
```

### 3.3 Indexer

**Purpose:** Parse and index code

**Key responsibilities:**
- Parse source code (via WASM)
- Extract functions, classes, imports
- Chunk code into manageable pieces
- Track incremental changes

**Main interface:** `IIndexer` (`src/indexer/types.ts`)

```typescript
interface IIndexer {
  // Index a single file
  indexFile(filePath: string): Promise<IndexResult>;

  // Index entire directory
  indexDirectory(dirPath: string): Promise<IndexResult>;

  // Supported languages
  getSupportedLanguages(): string[];

  // Check if file is supported
  isSupported(filePath: string): boolean;

  // Incremental indexing
  isChanged(filePath: string): Promise<boolean>;
}
```

**Implementation:** `WasmIndexer` wraps Rust WASM module

### 3.4 Vector Database

**Purpose:** Store and query vector embeddings

**Key responsibilities:**
- Store vectors with metadata
- Perform similarity search
- Filter by metadata
- Handle persistence

**Main interface:** `IVectorDatabase` (`src/vector-db/types.ts`)

```typescript
interface IVectorDatabase {
  // Insert or update vectors
  upsert(vectors: Vector[]): Promise<number>;

  // Search for similar vectors
  search(query: number[], options: SearchOptions): Promise<SearchResult[]>;

  // Delete vectors
  delete(ids: string[]): Promise<number>;

  // Count vectors
  count(filter?: MetadataFilter): Promise<number>;

  // Close connection
  close(): Promise<void>;
}
```

**Implementations:**
- `SQLiteVectorDB` - Local SQLite with FTS5
- `VectorizeAdapter` - Cloudflare Vectorize

### 3.5 Token Optimizer

**Purpose:** Compress context to fit token limits

**Key responsibilities:**
- Detect query intent
- Select relevant code chunks
- Compress selected chunks
- Choose optimal model

**Main interface:** `ITokenOptimizer` (`src/token-optimizer/types.ts`)

```typescript
interface ITokenOptimizer {
  // Reconstruct prompt within budget
  reconstructPrompt(
    prompt: string,
    codebase: CodeChunk[],
    budget: number
  ): Promise<OptimizedPrompt>;

  // Estimate token count
  estimateTokens(text: string): number;

  // Calculate savings
  calculateSavings(original: number, optimized: number): Savings;
}
```

### 3.6 Model Router

**Purpose:** Choose optimal LLM for each task

**Key responsibilities:**
- Analyze query complexity
- Estimate token count
- Select model (local vs cloud)
- Handle fallbacks

**Main interface:** `IModelRouter` (`src/model-router/types.ts`)

```typescript
interface IModelRouter {
  // Route to optimal model
  route(tokens: number, complexity: number): ModelChoice;

  // Get available models
  getAvailableModels(): Model[];

  // Check model health
  isHealthy(model: Model): Promise<boolean>;

  // Handle fallback
  getFallback(model: Model): Model;
}
```

---

## 4. Extension Points

### 4.1 Adding New Languages

**Step 1:** Add Tree-sitter parser to Rust code

```rust
// prism-indexer/src/languages.rs
pub fn get_parser(language: &str) -> Result<Parser> {
    match language {
        "typescript" => Ok(Parser::new(tree_sitter_typescript::language())),
        "python" => Ok(Parser::new(tree_sitter_python::language())),
        "your-language" => Ok(Parser::new(tree_sitter_your_language::language())),
        _ => Err(Error::UnsupportedLanguage),
    }
}
```

**Step 2:** Add language-specific extraction rules

```rust
// prism-indexer/src/extractor.rs
impl<'a> CodeExtractor<'a> {
    pub fn extract_functions(&self, language: &str) -> Vec<Function> {
        match language {
            "typescript" => self.extract_ts_functions(),
            "python" => self.extract_python_functions(),
            "your-language" => self.extract_your_language_functions(),
            _ => vec![],
        }
    }
}
```

**Step 3:** Update TypeScript wrapper

```typescript
// src/indexer/types.ts
export const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'rust',
  'go',
  'java',
  'your-language',
] as const;
```

**Step 4:** Add tests

```typescript
// tests/unit/indexer/your-language.test.ts
describe('YourLanguage Indexer', () => {
  it('should parse your-language files', async () => {
    const code = `...`;
    const result = await indexer.indexFile('test.yl');

    expect(result.success).toBe(true);
    expect(result.elements).not.toHaveLength(0);
  });
});
```

### 4.2 Adding New Storage Backends

**Step 1:** Implement interface

```typescript
// src/vector-db/adapters/YourBackend.ts
import { IVectorDatabase, Vector, SearchResult, SearchOptions } from '../types';

export class YourBackend implements IVectorDatabase {
  async upsert(vectors: Vector[]): Promise<number> {
    // Your implementation
  }

  async search(query: number[], options: SearchOptions): Promise<SearchResult[]> {
    // Your implementation
  }

  async delete(ids: string[]): Promise<number> {
    // Your implementation
  }

  async count(filter?: MetadataFilter): Promise<number> {
    // Your implementation
  }

  async close(): Promise<void> {
    // Your implementation
  }
}
```

**Step 2:** Register backend

```typescript
// src/vector-db/index.ts
import { YourBackend } from './adapters/YourBackend';

export function createVectorBackend(config: Config): IVectorDatabase {
  switch (config.type) {
    case 'sqlite':
      return new SQLiteVectorDB(config.path);
    case 'vectorize':
      return new VectorizeAdapter(config.credentials);
    case 'your-backend':
      return new YourBackend(config.credentials);
    default:
      throw new Error(`Unknown backend: ${config.type}`);
  }
}
```

**Step 3:** Add configuration

```typescript
// src/config/loader.ts
export interface VectorDBConfig {
  type: 'sqlite' | 'vectorize' | 'your-backend';
  path?: string;  // For SQLite
  credentials?: Record<string, unknown>;  // For backends
}
```

### 4.3 Adding New Embedding Providers

**Step 1:** Implement interface

```typescript
// src/embeddings/providers/YourProvider.ts
import { IEmbeddingProvider } from '../types';

export class YourProvider implements IEmbeddingProvider {
  async generateEmbedding(text: string): Promise<number[]> {
    // Your implementation
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    // Your implementation
  }

  getDimensions(): number {
    return 384;  // Your embedding dimensions
  }
}
```

**Step 2:** Register provider

```typescript
// src/embeddings/EmbeddingService.ts
import { YourProvider } from './providers/YourProvider';

export class EmbeddingService {
  constructor(config: EmbeddingConfig) {
    switch (config.provider) {
      case 'workers_ai':
        this.provider = new WorkersAIProvider(config.credentials);
        break;
      case 'ollama':
        this.provider = new OllamaProvider(config.endpoint);
        break;
      case 'your-provider':
        this.provider = new YourProvider(config.credentials);
        break;
    }
  }
}
```

### 4.4 Adding New LLM Providers

**Step 1:** Implement interface

```typescript
// src/model-router/providers/YourLLM.ts
import { ILLMProvider } from '../types';

export class YourLLM implements ILLMProvider {
  async complete(prompt: string, options: CompletionOptions): Promise<CompletionResult> {
    // Your implementation
  }

  async stream(prompt: string, options: CompletionOptions): AsyncIterator<string> {
    // Your implementation
  }

  getMaxTokens(): number {
    return 200000;  // Your model's max tokens
  }

  getCostPerToken(): number {
    return 0.00001;  // Your model's cost
  }
}
```

**Step 2:** Register in router

```typescript
// src/model-router/ModelRouter.ts
import { YourLLM } from './providers/YourLLM';

export class ModelRouter {
  private models = {
    'your-model': new YourLLM(config),
    'claude-3-opus': new ClaudeProvider(config),
    'ollama-deepseek': new OllamaProvider(config),
  };

  route(tokens: number, complexity: number): ModelChoice {
    // Routing logic
  }
}
```

### 4.5 Adding New CLI Commands

**Step 1:** Create command file

```typescript
// src/cli/commands/your-command.ts
import { Command } from 'commander';
import { PrismEngine } from '@/core/PrismEngine';

export function createYourCommand(engine: PrismEngine): Command {
  const cmd = new Command('your-command');

  cmd
    .description('Description of your command')
    .argument('<input>', 'Input argument')
    .option('-o, --output <file>', 'Output file')
    .action(async (input, options) => {
      try {
        const result = await engine.doSomething(input);
        console.log(result);
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}
```

**Step 2:** Register command

```typescript
// src/cli/index.ts
import { createYourCommand } from './commands/your-command';

export class CLI {
  registerCommands(engine: PrismEngine): void {
    this.program.addCommand(createYourCommand(engine));
  }
}
```

---

## 5. Adding New Features

### 5.1 Feature Development Process

**1. Design Phase**
- Create architecture document (`docs/architecture/XX-feature-name.md`)
- Define interfaces and types
- Plan integration points
- Identify breaking changes

**2. Implementation Phase**
- Implement core logic
- Add tests
- Update documentation
- Follow style guidelines

**3. Review Phase**
- Self-review code
- Run all tests
- Check coverage
- Verify performance

**4. Integration Phase**
- Update changelog
- Bump version (if needed)
- Create PR
- Address feedback

### 5.2 Feature Example: Git-Aware Indexing

**Design Document:** `docs/architecture/10-git-aware-indexing.md`

**Key Components:**
- Git service to track file changes
- Diff viewer to see what changed
- Blame integration to know who changed what
- Branch-aware indexing

**Implementation:**

```typescript
// src/indexer/GitIndexer.ts
export class GitIndexer implements IIndexer {
  constructor(
    private baseIndexer: IIndexer,
    private gitService: GitService
  ) {}

  async indexFile(filePath: string): Promise<IndexResult> {
    // Check if file changed in git
    const changed = await this.gitService.isChanged(filePath);

    if (!changed) {
      // Return cached result
      return await this.getCachedResult(filePath);
    }

    // Index the file
    const result = await this.baseIndexer.indexFile(filePath);

    // Add git metadata
    result.gitMetadata = {
      branch: await this.gitService.getCurrentBranch(),
      lastCommit: await this.gitService.getLastCommit(filePath),
      author: await this.gitService.getAuthor(filePath),
    };

    return result;
  }
}
```

---

## 6. Breaking Changes Policy

### 6.1 Definition of Breaking Change

A breaking change is any modification that:
- Changes public API signatures
- Removes or renames public interfaces/classes/functions
- Changes behavior in a way that breaks existing code
- Modifies configuration file format
- Changes database schema
- Alters CLI command syntax

### 6.2 Breaking Change Process

**Before making breaking changes:**

1. **Discuss with maintainers**
   - Open issue proposing change
   - Get consensus on approach
   - Document rationale

2. **Create migration guide**
   - Document what's changing
   - Provide migration steps
   - Include code examples

3. **Deprecate old API**
   - Mark as `@deprecated` in JSDoc
   - Add runtime warnings
   - Keep old API working for one minor version

4. **Implement new API**
   - Implement new approach
   - Add tests
   - Update documentation

5. **Release with deprecation warnings**
   - Release version N with deprecation
   - Announce in changelog
   - Give users time to migrate

6. **Remove old API**
   - Release version N+1
   - Remove deprecated code
   - Update migration guide to reflect removal

### 6.3 Version Policy

PRISM follows [Semantic Versioning](https://semver.org/):

- **Major (X.0.0)**: Breaking changes
- **Minor (0.X.0)**: New features, backwards compatible
- **Patch (0.0.X)**: Bug fixes, backwards compatible

**Example:**

```typescript
// Version 0.1.0
interface IIndexer {
  indexFile(path: string): Promise<IndexResult>;
}

// Version 0.2.0 (minor) - new method, backwards compatible
interface IIndexer {
  indexFile(path: string): Promise<IndexResult>;
  indexDirectory(path: string): Promise<IndexResult>;  // NEW
}

// Version 1.0.0 (major) - breaking change
interface IIndexer {
  // Changed signature - BREAKING
  indexFile(path: string, options?: IndexOptions): Promise<IndexResult>;
  indexDirectory(path: string, options?: IndexOptions): Promise<IndexResult>;
}
```

### 6.4 Communication

**When releasing breaking changes:**

1. **Update CHANGELOG.md**
   ```markdown
   ## [1.0.0] - 2026-01-13

   ### Breaking Changes
   - `IIndexer.indexFile()` now requires `IndexOptions` parameter
   - Removed deprecated `legacySearch()` method

   ### Migration Guide
   See MIGRATION.md for detailed migration steps.
   ```

2. **Create MIGRATION.md**
   - List all breaking changes
   - Provide before/after examples
   - Include automated migration scripts if possible

3. **Announce**
   - GitHub release notes
   - Blog post (for major versions)
   - Twitter/X post

---

## 7. Technical Debt

### 7.1 Current Technical Debt

**1. WASM Indexer**
- **Issue**: Not yet built (code complete, needs Rust toolchain)
- **Impact**: Cannot test actual WASM functionality
- **Priority**: High
- **Resolution**: Build WASM once Rust is available

**2. Test Coverage**
- **Issue**: Some modules below target coverage
- **Impact**: Reduced confidence in code quality
- **Priority**: Medium
- **Resolution**: Add tests to reach 80% coverage

**3. Error Handling**
- **Issue**: Inconsistent error types across modules
- **Impact**: Difficult to handle errors gracefully
- **Priority**: Medium
- **Resolution**: Standardize error handling

**4. Documentation**
- **Issue**: Some modules lack detailed documentation
- **Impact**: Harder for contributors to understand
- **Priority**: Low
- **Resolution**: Add JSDoc comments to all public APIs

**5. Performance**
- **Issue**: No performance benchmarks
- **Impact**: Cannot detect regressions
- **Priority**: Medium
- **Resolution**: Add benchmark suite

### 7.2 Cleanup Tasks

**Short-term (within 1 month):**
- [ ] Build WASM module
- [ ] Increase test coverage to 80%
- [ ] Add error handling tests
- [ ] Document all public APIs

**Medium-term (within 3 months):**
- [ ] Standardize error types
- [ ] Add performance benchmarks
- [ ] Implement caching layer
- [ ] Add integration tests

**Long-term (within 6 months):**
- [ ] Refactor for better separation of concerns
- [ ] Improve type safety
- [ ] Add more language support
- [ ] Optimize WASM binary size

---

## 8. Known Issues

### 8.1 Current Limitations

**1. WASM Indexer Not Built**
- **Description**: Rust code is complete but WASM not compiled
- **Workaround**: Use mock indexer for testing
- **Status**: Blocked on Rust toolchain availability
- **ETA**: Once environment has Rust installed

**2. Limited Language Support**
- **Description**: Only TypeScript, JavaScript, Python, Rust, Go, Java
- **Workaround**: Files in other languages ignored
- **Status**: Working as designed
- **ETA**: Add more languages based on demand

**3. No Cloudflare Integration**
- **Description**: Cloudflare Workers AI and Vectorize not implemented
- **Workaround**: Use local Ollama for embeddings
- **Status**: Planned for v0.2
- **ETA**: Post-MVP

**4. No Incremental Indexing**
- **Description**: Always re-indexes entire codebase
- **Workaround**: None, slow on large codebases
- **Status**: Partially implemented
- **ETA**: v0.1.1

**5. No Learning System**
- **Description**: Doesn't learn from user feedback
- **Workaround**: Manual query refinement
- **Status**: Planned for v0.3
- **ETA**: Post-HN launch

### 8.2 Performance Issues

**1. Large File Indexing**
- **Issue**: Files >10K LOC can be slow
- **Workaround**: Break into smaller files
- **Status**: Known limitation
- **Fix**: Implement streaming parsing

**2. Memory Usage**
- **Issue**: Can use >100MB for large codebases
- **Workaround**: Index in batches
- **Status**: Under investigation
- **Fix**: Implement chunk streaming

**3. Search Latency**
- **Issue**: Search can take >500ms on large indexes
- **Workaround**: Use tighter filters
- **Status**: Needs optimization
- **Fix**: Implement vector indexing

### 8.3 Bug Reports

For bugs not listed here, please file an issue on GitHub with:
- PRISM version
- Node.js version
- Operating system
- Reproduction steps
- Expected vs actual behavior
- Error messages and stack traces

---

## 9. Next Steps

After understanding the architecture:

1. **Choose an area to contribute:**
   - Add a new language parser
   - Implement a storage backend
   - Improve test coverage
   - Add documentation

2. **Read relevant documentation:**
   - API docs for your chosen module
   - Development setup guide
   - Testing guide

3. **Start small:**
   - Pick a good first issue
   - Make your changes
   - Write tests
   - Submit PR

4. **Join the community:**
   - GitHub Discussions
   - Discord (if available)
   - Twitter/X

---

**Document Status**: Complete
**Last Updated**: 2026-01-13
**Next Review**: After major architectural changes
