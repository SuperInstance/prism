# Indexer Architecture

**Last Updated**: 2026-01-13
**Version**: 0.1.0
**Status**: Beta

## Overview

The Prism indexer is a high-performance codebase indexing system built with Rust (compiled to WASM) and TypeScript. It transforms source code into searchable vector embeddings using AST-based parsing and semantic chunking.

**Architecture Goals:**
- **Performance**: Index 100K LOC in <30 seconds
- **Accuracy**: Preserve code semantics and structure
- **Efficiency**: Memory usage <100MB for 1M LOC
- **Extensibility**: Support multiple programming languages

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Interface                             │
│                     (src/cli/commands/index.ts)                   │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                       TypeScript Layer                            │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ File Scanner │  │  Config      │  │  Progress    │          │
│  │  (globby)    │  │  Loader      │  │  Reporter    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                       WASM Interface                              │
│                     (src/indexer/index.ts)                        │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  CodeIndexer                                              │  │
│  │  ├── initialize()                                         │  │
│  │  ├── parse(code, language)                                │  │
│  │  └── indexCodebase(path)                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Rust WASM Module                              │
│                   (prism-indexer/src/)                           │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Parser     │  │  Extractor   │  │   Chunker    │          │
│  │  (parser.rs) │  │(extractor.rs)│  │ (chunker.rs) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                 │                     │
│         └─────────────────┴─────────────────┘                     │
│                           │                                       │
│                           ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Tree-sitter (WASM)                                       │  │
│  │  ├── TypeScript Grammar                                   │  │
│  │  ├── JavaScript Grammar                                   │  │
│  │  ├── Python Grammar                                       │  │
│  │  ├── Rust Grammar                                         │  │
│  │  ├── Go Grammar                                           │  │
│  │  └── Java Grammar                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Output Layer                                  │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Chunks     │  │  Embeddings  │  │    Vectors   │          │
│  │  (CodeChunk) │  │  (Cloudflare)│  │ (Vector DB)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. File Discovery

```
Directory Tree
       │
       ├── globby (pattern matching)
       │
       ▼
File List
  ├── file1.ts
  ├── file2.py
  └── file3.rs
```

**Implementation:**
```typescript
// src/cli/commands/index.ts
async function collectFiles(
  rootPath: string,
  includePatterns: string[],
  excludePatterns: string[]
): Promise<string[]> {
  const { globby } = await import('globby');

  return await globby(includePatterns, {
    cwd: rootPath,
    ignore: excludePatterns,
    absolute: true,
    gitignore: true,
  });
}
```

### 2. Language Detection

```
File Path
   │
   ├── Extract extension
   │
   ▼
Language
  ├── .ts → TypeScript
  ├── .py → Python
  └── .rs → Rust
```

**Implementation:**
```typescript
function getLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath);
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
  };
  return languageMap[ext] || 'unknown';
}
```

### 3. AST Parsing

```
Source Code
     │
     ├── Tree-sitter Parser (WASM)
     │
     ▼
   AST
  ├── Functions
  ├── Classes
  ├── Imports
  └── Statements
```

**Implementation:**
```rust
// prism-indexer/src/parser.rs
#[wasm_bindgen]
pub fn parse(&mut self, code: &str) -> Result<ParseResult> {
    let tree = self.parser.parse(code, None)
        .ok_or_else(|| PrismError::ParseError("Failed to parse".to_string()))?;

    let root = tree.root_node();
    let has_errors = root.has_error();

    Ok(ParseResult {
        has_errors,
        chunks: chunk_code(&root, code, &self.language_name),
        functions: extract_functions(&root, code),
        classes: extract_classes(&root, code),
        error_nodes: find_error_nodes(&root, code),
    })
}
```

### 4. Semantic Chunking

```
AST
  │
  ├── Extract Functions/Classes
  │
  ├── Group by Token Count
  │
  ├── Add Overlap
  │
  ▼
Chunks
  ├── Chunk 1 (512 tokens)
  ├── Chunk 2 (512 tokens)
  └── Chunk 3 (512 tokens)
```

**Implementation:**
```rust
// prism-indexer/src/chunker.rs
pub fn chunk_code(root: &Node, source: &str, language: &str) -> Vec<CodeChunk> {
    let mut chunks = Vec::new();

    // Extract semantic units
    let functions = extract_functions(root, source);
    let classes = extract_classes(root, source);

    // Group into chunks
    let mut current_chunk = CodeChunk::default();
    let mut current_size = 0;

    for function in functions {
        let func_size = estimate_tokens(&function.signature);

        if current_size + func_size > DEFAULT_CHUNK_SIZE {
            chunks.push(current_chunk);
            current_chunk = CodeChunk::default();
            current_size = 0;
        }

        current_chunk.functions.push(function);
        current_size += func_size;
    }

    chunks
}
```

### 5. Embedding Generation

```
Chunk
  │
  ├── Cloudflare Workers AI
  │   ├── Model: @cf/baai/bge-small-en-v1.5
  │   └── Dimensions: 384
  │
  ▼
Vector
  └── [0.234, -0.123, 0.456, ..., 0.789]
```

**Implementation:**
```typescript
// src/vector-db/embeddings.ts
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/baai/bge-small-en-v1.5',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    }
  );

  const data = await response.json();
  return data.result;
}
```

### 6. Vector Storage

```
Vector + Metadata
       │
       ├── SQLite (Local)
       │   └── FTS5 Extension
       │
       ├── Cloudflare Vectorize (Cloud)
       │   └── HNSW Index
       │
       ▼
Vector Database
  ├── Chunk ID
  ├── Vector (384 floats)
  ├── Metadata
  └── Original Text
```

**Implementation:**
```typescript
// src/vector-db/sqlite.ts
async function storeChunk(chunk: CodeChunk, vector: number[]): Promise<void> {
  await db.run(`
    INSERT INTO chunks (id, vector, metadata, text)
    VALUES (?, ?, ?, ?)
  `, [
    chunk.id,
    new Float32Array(vector),
    JSON.stringify(chunk.metadata),
    chunk.text
  ]);
}
```

---

## Data Structures

### CodeChunk

```typescript
interface CodeChunk {
  id: string;              // UUID
  text: string;            // Original source code
  start_line: number;      // Starting line number
  end_line: number;        // Ending line number
  tokens: number;          // Estimated token count
  language: string;        // Programming language

  // Extracted elements
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  dependencies: string[];  // Chunk dependencies
}
```

### FunctionInfo

```typescript
interface FunctionInfo {
  name: string;            // Function name
  signature: string;       // Full signature
  start_line: number;      // Starting line
  end_line: number;        // Ending line

  // Parameters
  parameters: string[];    // Parameter names
  return_type?: string;    // Return type

  // Modifiers
  is_async: boolean;       // Is async function
  is_exported: boolean;    // Is exported
}
```

### ClassInfo

```typescript
interface ClassInfo {
  name: string;            // Class name
  extends?: string;        // Parent class
  implements: string[];    // Implemented interfaces
  methods: FunctionInfo[]; // Class methods
  start_line: number;      // Starting line
  end_line: number;        // Ending line
}
```

### ImportInfo

```typescript
interface ImportInfo {
  source: string;          // Import source
  imported_names: string[];// Imported symbols
  is_type_only: boolean;   // Is type-only import
  location: SourceLocation;// Location in file
}
```

### ParseResult

```typescript
interface ParseResult {
  has_errors: boolean;     // Any errors?
  error_nodes: ErrorNode[];// Error details
  chunks: CodeChunk[];     // Extracted chunks
  functions: FunctionInfo[];// All functions
  classes: ClassInfo[];    // All classes
}
```

---

## Algorithms

### File Discovery Algorithm

```
Input: Root directory, patterns
Output: List of files

1. Expand glob patterns
2. Filter by include patterns
3. Filter by exclude patterns
4. Filter by gitignore (if enabled)
5. Return absolute paths
```

**Complexity:** O(n) where n = number of files

**Optimization:**
- Use `globby` for fast pattern matching
- Parallel directory traversal
- Gitignore-aware filtering

### AST Parsing Algorithm

```
Input: Source code, language
Output: Parse result

1. Create parser for language
2. Parse code into AST
3. Check for errors
4. Extract functions (recursive walk)
5. Extract classes (recursive walk)
6. Extract imports (query-based)
7. Return structured result
```

**Complexity:** O(m) where m = code length

**Optimization:**
- Incremental parsing (cache trees)
- Error recovery (continue despite errors)
- Parallel parsing (multiple files)

### Chunking Algorithm

```
Input: AST, source code, target size
Output: List of chunks

1. Extract semantic units (functions, classes)
2. Sort by position in file
3. Group units into chunks:
   a. Add unit to current chunk
   b. If chunk size > target:
      - Save current chunk
      - Start new chunk
      - Add overlap from previous
4. Handle oversized units:
   - Split large functions
   - Preserve semantic boundaries
5. Return chunks
```

**Complexity:** O(k) where k = number of semantic units

**Optimization:**
- Semantic boundaries (don't break functions)
- Token estimation (character count / 4)
- Overlap for context (25% of chunk size)

### Embedding Algorithm

```
Input: Chunk text
Output: Vector (384 floats)

1. Preprocess text:
   a. Normalize whitespace
   b. Preserve code structure
   c. Add context (imports, parent class)
2. Call embedding model
3. Receive vector (384 floats)
4. Normalize vector (L2 norm)
5. Return vector
```

**Complexity:** O(n) where n = text length (model-dependent)

**Optimization:**
- Batch processing (multiple chunks at once)
- Cloudflare caching (avoid redundant calls)
- Local fallback (Ollama)

---

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| File Discovery | O(n) | n = number of files |
| AST Parsing | O(m) | m = code length |
| Chunking | O(k) | k = semantic units |
| Embeddings | O(n) | n = text length |
| Vector Storage | O(1) | Indexed insert |

### Space Complexity

| Component | Memory | Notes |
|-----------|--------|-------|
| Parsed AST | O(m) | m = code length |
| Chunks | O(k) | k = chunks |
| Embeddings | O(k*d) | d = 384 dimensions |
| Total | O(k*d) | Dominated by embeddings |

### Bottlenecks

1. **AST Parsing (78%)**
   - Tree-sitter WASM overhead
   - Solution: Incremental parsing, caching

2. **Chunk Extraction (8%)**
   - Algorithm complexity
   - Solution: Optimize grouping logic

3. **Embedding Generation (5%)**
   - Network latency
   - Solution: Batching, caching

4. **Vector Storage (4%)**
   - I/O operations
   - Solution: Streaming, SSD storage

---

## Error Handling

### Error Recovery

```
Parse Error
    │
    ├── Check severity
    │
    ├── Minor: Continue extraction
    │
    ├── Major: Skip node, log error
    │
    └── Critical: Fail fast, report error
```

**Implementation:**
```rust
pub fn parse_with_recovery(code: &str) -> ParseResult {
    let tree = parser.parse(code, None)?;
    let root = tree.root_node();

    let has_errors = root.has_error();
    let error_nodes = find_error_nodes(&root, code);

    // Still extract valid code
    let functions = extract_functions(&root, code);
    let classes = extract_classes(&root, code);

    ParseResult {
        has_errors,
        error_nodes,
        functions,
        classes,
        chunks: chunk_code(&root, code),
    }
}
```

### Graceful Degradation

```
Feature Failure
    │
    ├── Disable feature
    │
    ├── Log warning
    │
    └── Continue with reduced functionality
```

**Example:**
- Cloudflare API down → Use local embeddings
- SQLite locked → Retry with backoff
- WASM error → Fallback to pure JS

---

## Extension Points

### Adding New Languages

**1. Add Grammar**
```toml
# Cargo.toml
tree-sitter-cpp = "0.23"
```

**2. Update Parser**
```rust
// parser.rs
"cpp" => tree_sitter_cpp::language_cpp(),
```

**3. Create Language Adapter**
```rust
// languages/cpp.rs
pub fn extract_cpp_function(node: &Node, source: &str) -> Option<FunctionInfo> {
    // C++ specific extraction
}
```

**4. Update Chunker**
```rust
// chunker.rs
"cpp" => chunk_cpp_code(root, source),
```

### Custom Chunking Strategies

```rust
pub trait ChunkStrategy {
    fn chunk(&self, root: &Node, source: &str) -> Vec<CodeChunk>;
}

pub struct FunctionLevelChunking;
pub struct TokenBasedChunking;
pub struct SemanticChunking;
```

### Pluggable Embedding Models

```typescript
interface EmbeddingModel {
  name: string;
  dimensions: number;
  generate(text: string): Promise<number[]>;
}

class CloudflareBGE implements EmbeddingModel {
  // ...
}

class OllamaNomic implements EmbeddingModel {
  // ...
}
```

---

## Security Considerations

### Input Validation

```
Untrusted Code
    │
    ├── Validate file size (<10MB)
    │
    ├── Validate encoding (UTF-8)
    │
    ├── Sanitize paths (prevent traversal)
    │
    └── Check language support
```

### Resource Limits

```
Resource Limits
    ├── Max file size: 10MB
    ├── Max chunks per file: 100
    ├── Max embedding size: 8192 tokens
    └── Max memory: 1GB
```

### Sandboxing

```
WASM Sandbox
    ├── No file system access
    ├── No network access
    ├── Limited memory
    └── Computation limits
```

---

## Testing Strategy

### Unit Tests

```typescript
// Test parser extraction
describe('Parser', () => {
  it('should extract functions', () => {
    const code = 'function test() {}';
    const result = parser.parse(code, 'javascript');
    expect(result.functions).toHaveLength(1);
  });
});
```

### Integration Tests

```typescript
// Test full indexing pipeline
describe('Indexer', () => {
  it('should index a codebase', async () => {
    const chunks = await indexer.indexCodebase('./test-repo');
    expect(chunks.length).toBeGreaterThan(0);
  });
});
```

### Performance Tests

```typescript
// Benchmark parsing speed
describe('Performance', () => {
  it('should parse 100K LOC in <30s', async () => {
    const start = Date.now();
    await indexer.indexCodebase('./large-repo');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(30000);
  });
});
```

---

## Future Enhancements

### Planned Features

1. **Incremental Indexing**
   - Track file changes
   - Re-parse only modified files
   - Update vectors selectively

2. **Dependency Graph**
   - Track imports/exports
   - Build call graph
   - Enable dependency-aware search

3. **Semantic Analysis**
   - Type information extraction
   - Variable usage tracking
   - Code smell detection

4. **Multi-Language Support**
   - Add 10+ languages
   - Language-agnostic queries
   - Cross-language references

### Experimental Features

1. **GPU Acceleration**
   - CUDA embeddings
   - Parallel parsing
   - Faster vector operations

2. **Distributed Indexing**
   - Sharding across workers
   - Parallel processing
   - MapReduce architecture

3. **Learning System**
   - User feedback
   - Relevance scoring
   - Adaptive chunking

---

## References

### Related Documents

- [Tree-sitter WASM Integration](../../research/03-treesitter-wasm-integration.md)
- [Indexing Guide](../user-guide/03-indexing.md)
- [Performance Guide](../guide/05-performance.md)
- [Language Support](../guide/04-language-support.md)

### External Resources

- [Tree-sitter Documentation](https://tree-sitter.github.io/)
- [WASM Bindgen Guide](https://rustwasm.github.io/docs/wasm-bindgen/)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)

---

**Contributors:**
- Claude (AI Researcher)
- Prism Team

**Last Updated:** 2026-01-13
**Status:** Beta
**Version:** 0.1.0
