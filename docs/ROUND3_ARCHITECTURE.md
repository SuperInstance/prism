# Round 3 Architecture: WASM Indexer

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRISM System                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    User Layer                             │  │
│  │  CLI │ MCP Server │ Web UI                              │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │                 Orchestrator Layer                       │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │   IndexerOrchestrator                             │   │  │
│  │  │   - File collection                               │   │  │
│  │  │   - Incremental indexing                          │   │  │
│  │  │   - Progress reporting                            │   │  │
│  │  │   - Error recovery                                │   │  │
│  │  └──┬──────────┬──────────┬──────────┬──────────────┘   │  │
│  └─────┼──────────┼──────────┼──────────┼──────────────────┘  │
│        │          │          │          │                      │
│  ┌─────▼───┐ ┌───▼───┐ ┌───▼────┐ ┌──▼─────────┐              │
│  │Indexer  │ │Storage│ │Progress│ │  Config    │              │
│  └─────┬───┘ └──────┘ └────────┘ └────────────┘              │
│        │                                                        │
│  ┌─────▼─────────────────────────────────────────────────┐   │
│  │                  Parser Layer                          │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │         WasmIndexer                              │  │   │
│  │  │  ┌──────────────────────────────────────────┐   │  │   │
│  │  │  │    WASM Module (Rust)                    │   │  │   │
│  │  │  │  ┌────────────────────────────────────┐  │   │  │   │
│  │  │  │  │  PrismParser (Tree-sitter)         │  │   │  │   │
│  │  │  │  │  - TypeScript                       │  │   │  │   │
│  │  │  │  │  - JavaScript                       │  │   │  │   │
│  │  │  │  │  - Python                           │  │   │  │   │
│  │  │  │  │  - Rust                             │  │   │  │   │
│  │  │  │  │  - Go                               │  │   │  │   │
│  │  │  │  │  - Java                             │  │   │  │   │
│  │  │  │  └────────────────────────────────────┘  │   │  │   │
│  │  │  │  ┌────────────────────────────────────┐  │   │  │   │
│  │  │  │  │  Extractor                         │  │   │  │   │
│  │  │  │  │  - Functions                       │  │   │  │   │
│  │  │  │  │  - Classes                         │  │   │  │   │
│  │  │  │  │  - Imports                         │  │   │  │   │
│  │  │  │  └────────────────────────────────────┘  │   │  │   │
│  │  │  │  ┌────────────────────────────────────┐  │   │  │   │
│  │  │  │  │  Chunker                           │  │   │  │   │
│  │  │  │  │  - Semantic boundaries             │  │   │  │   │
│  │  │  │  │  - Token counting                  │  │   │  │   │
│  │  │  │  │  - Size optimization               │  │   │  │   │
│  │  │  │  └────────────────────────────────────┘  │   │  │   │
│  │  │  └──────────────────────────────────────────┘   │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │                    Output Layer                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐       │  │
│  │  │CodeChunk │  │Functions │  │     Classes      │       │  │
│  │  │   []     │  │    []    │  │        []         │       │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
Source File
    │
    ├─► Read (FileSystem)
    │
    ├─► Detect Language
    │   └─► .ts → TypeScript
    │   └─► .js → JavaScript
    │   └─► .py → Python
    │
    ├─► Parse (WasmIndexer)
    │   │
    │   ├─► Load WASM Module
    │   │   └─► prism_indexer_bg.wasm
    │   │
    │   ├─► Create Parser
    │   │   └─► PrismParser::new(language)
    │   │
    │   ├─► Parse Code
    │   │   └─► parser.parse(code)
    │   │       │
    │   │       ├─► Tree-sitter (AST)
    │   │       │
    │   │       ├─► Extract Functions
    │   │       │
    │   │       ├─► Extract Classes
    │   │       │
    │   │       └─► Detect Errors
    │   │
    │   └─► Convert to TypeScript
    │       └─► ParseResult → CodeChunk[]
    │
    ├─► Process (IndexerOrchestrator)
    │   │
    │   ├─► Filter by language
    │   │
    │   ├─► Generate embeddings (future)
    │   │
    │   ├─► Store in vector DB (future)
    │   │
    │   └─► Update metadata
    │
    └─► Output
        ├─► CodeChunk[]
        ├─► Progress update
        └─► Index stats
```

## Component Interfaces

### WasmIndexer

```typescript
interface IIndexer {
  init(): Promise<void>
  index(filePath: string): Promise<CodeChunk[]>
  indexDirectory(path: string): Promise<CodeChunk[]>
  generateEmbeddings(chunks: CodeChunk[]): Promise<CodeChunk[]>
  watch(path: string, callback: Function): () => void
}

class WasmIndexer implements IIndexer {
  private wasm: any
  private initialized: boolean
  private fs: IFileSystem

  async init(): Promise<void>
  async index(filePath: string): Promise<CodeChunk[]>
  async parseFile(content: string, language: string): Promise<ParseResult>
  async extractChunks(result: ParseResult, options: ChunkOptions): Promise<CodeChunk[]>
  getSupportedLanguages(): string[]
  getVersion(): string
}
```

### IndexerOrchestrator

```typescript
class IndexerOrchestrator {
  private fileSystem: IFileSystem
  private parser: IIndexer
  private embeddings: IEmbeddingService
  private vectorDB: IVectorDatabase
  private storage: IndexStorage
  private progress: ProgressReporter

  async indexDirectory(path: string, options: IndexOptions): Promise<IndexResult>

  private async collectFiles(path: string, options: IndexOptions): Promise<string[]>
  private async filterUnchangedFiles(files: string[]): Promise<string[]>
  private async processFile(filePath: string, options: IndexOptions): Promise<CodeChunk[]>
  private async enrichWithEmbeddings(chunks: CodeChunk[]): Promise<CodeChunk[]>
  private async storeChunks(chunks: CodeChunk[]): Promise<void>
}
```

### Rust/WASM Module

```rust
// WASM exports
#[wasm_bindgen]
pub fn create_parser(language: &str) -> Result<PrismParser, JsValue>

#[wasm_bindgen]
pub fn parse_code(code: &str, language: &str) -> Result<JsValue, JsValue>

#[wasm_bindgen]
pub fn get_supported_languages() -> JsValue

#[wasm_bindgen]
pub fn get_version() -> String

// Parser implementation
#[wasm_bindgen]
pub struct PrismParser {
    parser: Parser,
    language_name: String,
}

#[wasm_bindgen]
impl PrismParser {
    #[wasm_bindgen(constructor)]
    pub fn new(language: &str) -> Result<PrismParser>

    #[wasm_bindgen]
    pub fn parse(&mut self, code: &str) -> Result<ParseResult>
}
```

## File Organization

```
prism/prism-indexer/                    # Rust Project
├── src/
│   ├── lib.rs                          # WASM exports
│   ├── parser.rs                       # Tree-sitter wrapper
│   ├── chunker.rs                      # Chunking logic
│   ├── extractor.rs                    # AST extraction
│   ├── error.rs                        # Error types
│   └── types.rs                        # Serde types
├── Cargo.toml                          # Dependencies & config
├── build.sh                            # Build script
└── pkg/                                # wasm-pack output
    ├── prism_indexer_bg.wasm           # Compiled WASM
    ├── prism_indexer.js                # JS loader
    └── prism_indexer.d.ts              # TS definitions

src/indexer/                            # TypeScript Integration
├── WasmIndexer.ts                      # WASM wrapper
├── IndexerOrchestrator.ts              # Pipeline orchestration
├── IndexStorage.ts                     # Metadata management
├── ProgressReporter.ts                 # Progress tracking
├── types.ts                            # Type definitions
└── index.ts                            # Module exports

tests/wasm/                             # Test Suite
└── indexer.test.ts                     # Integration tests
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Parser** | Rust + Tree-sitter | Fast, safe parsing |
| **WASM** | wasm-bindgen | Rust ↔ JS interop |
| **Build** | wasm-pack | WASM compilation |
| **Wrapper** | TypeScript | Node.js integration |
| **Testing** | Vitest | Unit & integration tests |

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────┐
│                   Performance                           │
├─────────────────────────────────────────────────────────┤
│  WASM Size:          <1MB (optimized)                   │
│  Parse Speed:        >10K LOC/sec                       │
│  Memory Usage:       <100MB (WASM sandbox)              │
│  Init Time:          <100ms (lazy loading)              │
│  Supported Languages: 6 (TS, JS, Py, Rust, Go, Java)    │
└─────────────────────────────────────────────────────────┘
```

## Integration Points

```
┌──────────────────────────────────────────────────────────┐
│              PRISM Integration Layer                    │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐     ┌──────────────┐                  │
│  │   Vector DB  │◄────┤  Embeddings  │ (Round 4)         │
│  └──────────────┘     └──────────────┘                  │
│         ▲                                                   │
│         │                                                   │
│  ┌──────────────┐     ┌──────────────┐                  │
│  │  WasmIndexer │────►│  Optimizer   │ (Round 5)         │
│  └──────────────┘     └──────────────┘                  │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐     ┌──────────────┐                  │
│  │  File System │     │   Config     │                   │
│  └──────────────┘     └──────────────┘                  │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **Rust/WASM for Parser**
   - Tree-sitter is written in C (fast)
   - Rust provides safety and ergonomics
   - WASM allows Node.js integration
   - Size <1MB with optimizations

2. **Lazy Initialization**
   - WASM loaded only when needed
   - Faster startup for other operations
   - Memory efficient

3. **Interface-Based Design**
   - Easy to mock for testing
   - Swappable implementations
   - Clear contracts

4. **Incremental Indexing**
   - Track file modifications
   - Only reindex changed files
   - Faster updates

5. **Progress Reporting**
   - Real-time feedback
   - ETA calculation
   - Error tracking

---

**Last Updated:** 2025-01-13
**Status:** Complete - Ready for Build
**Next:** Embedding Generation (Round 4)
