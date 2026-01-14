/**
 * ============================================================================
 * PRISM CORE TYPE DEFINITIONS
 * ============================================================================
 *
 * **Purpose**: This module defines all foundational types used across the PRISM
 * codebase. These types form the backbone of the codebase indexing, semantic search,
 * and token optimization system.
 *
 * **Last Updated**: 2025-01-13
 * **Dependencies**: None (base types)
 *
 * **Design Philosophy**:
 * - Types are designed to be serializable and transportable across process boundaries
 * - Optional fields represent data that may not be available during all operations
 * - Metadata fields use `Record<string, unknown>` for extensibility
 *
 * **Related Files**:
 * - `src/core/PrismEngine.ts` - Main consumer of these types
 * - `src/vector-db/SQLiteVectorDB.ts` - Stores CodeChunk instances
 * - `src/token-optimizer/TokenOptimizer.ts` - Uses TokenBudget and OptimizedPrompt
 * - `src/core/types/index.ts` (main project) - Extended version with more fields
 *
 * **Architecture Notes**:
 * These types represent the simplified PRISM-specific version. The main Vantage
 * project (`src/core/types/index.ts`) has extended versions with additional fields
 * like `embedding`, `name`, `kind`, and structured `metadata`. When adding features,
 * consider whether they should be added here or if the main project's extended
 * types should be used instead.
 */

/**
 * ============================================================================
 * SOURCE CODE LOCATION TYPES
 * ============================================================================
 *
 * Types for representing positions and ranges within source code files.
 * Used for extracting precise code segments and providing accurate references.
 */

/**
 * Represents a precise location in source code
 *
 * **Usage**: Used for pinpointing specific positions within source files,
 * such as the start and end of a function or variable declaration.
 *
 * **Coordinate System**: All line and column numbers are 0-indexed to match
 * common editor conventions and tree-sitter AST node positions.
 *
 * **Performance**: Minimal memory footprint (4 numbers = 32 bytes)
 *
 * **Example**:
 * ```typescript
 * const location: SourceLocation = {
 *   startRow: 10,
 *   startColumn: 4,
 *   endRow: 15,
 *   endColumn: 2
 * };
 * // Represents code spanning lines 10-15
 * ```
 *
 * @see tree-sitter AST node positions
 * @see Language Server Protocol (LSP) Position type
 */
export interface SourceLocation {
  /** Starting row (line) number (0-indexed) */
  startRow: number;

  /** Starting column within the start row (0-indexed) */
  startColumn: number;

  /** Ending row (line) number (0-indexed, inclusive) */
  endRow: number;

  /** Ending column within the end row (0-indexed, exclusive) */
  endColumn: number;
}

/**
 * ============================================================================
 * CODE STRUCTURE TYPES
 * ============================================================================
 *
 * Types representing code constructs extracted during parsing.
 * These provide structured information about functions, classes, and their relationships.
 */

/**
 * Represents a function extracted from source code
 *
 * **Usage**: Captures metadata about function declarations including signature,
 * parameters, and modifiers. Used for symbol search and code understanding.
 *
 * **Parsing**: Extracted by tree-sitter during indexing. Currently supports
 * JavaScript/TypeScript. Extend for additional languages in `prism-indexer/src/parser.rs`.
 *
 * **Limitations**:
 * - Does not capture function body content (use CodeChunk.content instead)
 * - Does not track nested functions (each function is a separate FunctionInfo)
 * - Overloaded methods appear as multiple entries
 *
 * **Future Enhancements**:
 * - Add `decorators: string[]` for TypeScript/Python decorators
 * - Add `accessibility: 'public' | 'private' | 'protected'` for class methods
 * - Add `isStatic: boolean` flag
 * - Add `docComment?: string` for documentation
 *
 * **Performance**: One FunctionInfo typically uses ~200 bytes including strings
 *
 * @see ClassInfo for method tracking
 * @see CodeChunk for full source content
 */
export interface FunctionInfo {
  /** Function name (e.g., "calculateTotal", "async fetchData") */
  name: string;

  /** Full function signature including name and parameters */
  signature: string;

  /** Starting line number (1-indexed for display) */
  startLine: number;

  /** Ending line number (1-indexed, inclusive) */
  endLine: number;

  /** Parameter names (without types) */
  parameters: string[];

  /** Return type if available (empty string for inferred/void) */
  returnType?: string;

  /** True if function is async (await/async keyword) */
  isAsync: boolean;

  /** True if function is exported (export keyword) */
  isExported: boolean;
}

/**
 * Represents a class extracted from source code
 *
 * **Usage**: Captures class hierarchy and structure for object-oriented code.
 * Enables understanding of inheritance relationships and method organization.
 *
 * **Parsing**: Extracted during tree-sitter parsing. Supports inheritance
 * and interface implementation tracking.
 *
 * **Limitations**:
 * - Does not capture class properties/fields
 * - Does not track class decorators
 * - Nested classes are not tracked as children
 * - Generic type parameters are not parsed
 *
 * **Future Enhancements**:
 * - Add `properties: PropertyInfo[]` for class fields
 * - Add `generics: string[]` for type parameters
 * - Add `decorators: string[]` for annotation tracking
 * - Add `isAbstract: boolean` flag
 * - Add `extendsChain: string[]` for full inheritance tree
 *
 * **Performance**: Scales with number of methods (~200 bytes per method)
 *
 * @see FunctionInfo for individual method details
 */
export interface ClassInfo {
  /** Class name (e.g., "UserService", "AbstractController") */
  name: string;

  /** Parent class name if extends clause present */
  extends?: string;

  /** Interface names from implements clause */
  implements: string[];

  /** Methods defined in this class (excluding inherited) */
  methods: FunctionInfo[];

  /** Starting line number (1-indexed) */
  startLine: number;

  /** Ending line number (1-indexed, inclusive) */
  endLine: number;
}

/**
 * ============================================================================
 * CODE CHUNK TYPES
 * ============================================================================
 *
 * The core unit of indexed code. Chunks represent logical segments of code
 * that can be embedded, searched, and reconstructed for LLM context.
 */

/**
 * Represents a code chunk for indexing and retrieval
 *
 * **Purpose**: The fundamental unit of PRISM's codebase representation. Chunks
 * are created during indexing, embedded for semantic search, and reconstructed
 * into optimized prompts.
 *
 * **Creation Strategy**: Chunks are created by tree-sitter AST parsing. The
 * current strategy creates chunks for functions, classes, and top-level statements.
 * Future versions will support adaptive chunking based on semantic coherence.
 *
 * **Current Limitations vs Main Project**:
 * The main Vantage project (`src/core/types/index.ts`) extends this with:
 * - `name: string` - Human-readable identifier
 * - `kind: 'function' | 'class' | 'method' | 'variable' | 'interface'` - Type classification
 * - `embedding?: number[]` - Pre-computed vector embedding
 * - `metadata: CodeChunkMetadata` - Structured metadata (exports, imports, dependencies)
 *
 * Consider migrating to those fields if you need:
 * - Semantic search without recomputing embeddings
 * - Symbol-level type tracking
 * - Dependency analysis
 *
 * **Performance Characteristics**:
 * - Memory: ~1-5KB per chunk depending on content size
 * - Vector DB: 384 floats (1.5KB) per embedding
 * - Search: O(log n) with vector index
 *
 * **Optimization Opportunities**:
 * - Compress content with AST-preserving compression
 * - Store embeddings separately from chunks
 * - Delta-encode similar chunks
 *
 * **Usage Examples**:
 * ```typescript
 * // Create a chunk
 * const chunk: CodeChunk = {
 *   id: 'abc123',
 *   filePath: '/src/utils/helpers.ts',
 *   content: 'export function add(a: number, b: number) { return a + b; }',
 *   startLine: 10,
 *   endLine: 10,
 *   language: 'typescript',
 *   symbols: ['add'],
 *   dependencies: [],
 *   metadata: { exported: true }
 * };
 *
 * // Search for similar chunks
 * const results = await vectorDB.search(queryEmbedding, { limit: 10 });
 * ```
 *
 * **Future Enhancements**:
 * - Add `name` and `kind` fields (see main project types)
 * - Replace `metadata` with structured `CodeChunkMetadata`
 * - Add `embedding?: number[]` for cached embeddings
 * - Add `hash: string` for content-based deduplication
 * - Add `astDigest: string` for structure-based similarity
 * - Add `compressedContent?: string` for pre-compressed storage
 *
 * @see ParseResult for chunk collection
 * @see SearchResult for chunk with scoring
 */
export interface CodeChunk {
  /** Unique identifier (typically SHA-256 hash of content + path) */
  id: string;

  /** Absolute file path this chunk was extracted from */
  filePath: string;

  /** Full source code content of this chunk */
  content: string;

  /** Starting line number in source file (1-indexed) */
  startLine: number;

  /** Ending line number in source file (1-indexed, inclusive) */
  endLine: number;

  /** Programming language identifier (e.g., 'typescript', 'python', 'rust') */
  language: string;

  /** Symbol names defined or referenced in this chunk */
  symbols: string[];

  /** Import paths and external dependencies */
  dependencies: string[];

  /** Arbitrary metadata for extensibility (avoid for critical data) */
  metadata?: Record<string, unknown>;
}

/**
 * ============================================================================
 * PARSING RESULT TYPES
 * ============================================================================
 *
 * Types representing the output of code parsing operations.
 * Include extracted chunks, functions, classes, and error information.
 */

/**
 * Result of parsing source code
 *
 * **Usage**: Returned by indexer after parsing a file or directory.
 * Contains all extracted code structures and error status.
 *
 * **Error Handling**: `hasErrors` indicates parsing issues but doesn't
 * prevent returning partial results. Check this flag before relying on
 * completeness of extracted data.
 *
 * **Performance**: For a 1000 LOC file:
 * - Functions: ~50 FunctionInfo (~10KB)
 * - Classes: ~10 ClassInfo with methods (~20KB)
 * - Chunks: ~100 CodeChunk (~300KB)
 * - Total: ~330KB per file
 *
 * **Optimization**:
 * - Stream results for large directories
 * - Lazy-load function/class details
 * - Compress chunk content during parsing
 *
 * **Future Enhancements**:
 * - Add `errors: ParseError[]` for detailed error information
 * - Add `warnings: ParseWarning[]` for non-fatal issues
 * - Add `stats: ParseStats` for parsing metrics
 * - Add `duration: number` for parsing time
 *
 * @see IIndexer.index() for production
 */
export interface ParseResult {
  /** True if any errors occurred during parsing (results may be incomplete) */
  hasErrors: boolean;

  /** All code chunks extracted from the parsed code */
  chunks: CodeChunk[];

  /** All function definitions extracted */
  functions: FunctionInfo[];

  /** All class definitions extracted */
  classes: ClassInfo[];
}

/**
 * ============================================================================
 * CONFIGURATION TYPES
 * ============================================================================
 *
 * Configuration interfaces for all PRISM subsystems.
 * These are loaded from ~/.prism/config.yaml and control runtime behavior.
 */

/**
 * Configuration for the code indexer
 *
 * **Purpose**: Controls how source code is parsed, chunked, and filtered
 * during the indexing process.
 *
 * **Chunk Size vs Overlap**:
 * - Larger chunks = better context, more tokens per chunk
 * - Overlap = prevents breaking code at boundaries, reduces missing context
 * - Recommended: overlap = 10-20% of chunkSize
 *
 * **Performance Impact**:
 * - chunkSize 500, overlap 50: ~6 chunks per 2500 LOC file
 * - chunkSize 1000, overlap 100: ~3 chunks per 2500 LOC file
 * - More chunks = more embeddings = higher indexing cost
 *
 * **Language Support**:
 * - Current: JavaScript, TypeScript, Python, Rust, Go
 * - Add more in `prism-indexer/src/languages/`
 * - Tree-sitter grammar must be available
 *
 * **Pattern Matching**:
 * - Uses minimatch glob patterns
 * - excludePatterns override includePatterns
 * - **Security**: Validate patterns to prevent directory traversal
 *
 * **Validation Rules** (enforced in `src/config/loader.ts`):
 * - chunkSize >= 100 (prevents tiny chunks)
 * - overlap >= 0
 * - overlap < chunkSize
 *
 * **Example Config**:
 * ```yaml
 * indexer:
 *   chunkSize: 500
 *   overlap: 50
 *   languages: [typescript, python]
 *   includePatterns: ["src/**/*.ts", "lib/**/*.py"]
 *   excludePatterns: ["**/node_modules/**", "**/*.test.ts"]
 * ```
 *
 * **Future Enhancements**:
 * - Add `strategy: 'semantic' | 'syntactic' | 'hybrid'` for chunking algorithm
 * - Add `maxChunkSize: number` for hard limit
 * - Add `detectBoundaries: boolean` for function-level chunking
 * - Add `includeComments: boolean` for documentation preservation
 *
 * @see DEFAULT_CONFIG in src/config/loader.ts
 */
export interface IndexerConfig {
  /** Target chunk size in tokens (not characters!) */
  chunkSize: number;

  /** Token overlap between adjacent chunks (prevents boundary issues) */
  overlap: number;

  /** Languages to index (must have tree-sitter grammar) */
  languages: string[];

  /** Glob patterns for files to include */
  includePatterns: string[];

  /** Glob patterns for files to exclude */
  excludePatterns: string[];
}

/**
 * Configuration for vector database backend
 *
 * **Purpose**: Selects and configures the vector storage backend for
 * storing and searching code embeddings.
 *
 * **Backend Options**:
 *
 * **SQLite (Local)**:
 * - Pros: Fast, free, no network, works offline
 * - Cons: Single-machine only, no persistence across devices
 * - Storage: ~/.prism/vector.db
 * - Performance: ~10ms for 100K chunk search
 *
 * **Cloudflare Vectorize (Cloud)**:
 * - Pros: Persistent, shared access, automatic scaling
 * - Cons: Free tier limits (30M queried dims/month), requires internet
 * - Requires: accountId, apiKey from Cloudflare dashboard
 * - Performance: ~100ms for 100K chunk search (network latency)
 *
 * **Security Considerations**:
 * - apiKey is sensitive, store in environment variable
 * - Never commit API keys to version control
 * - Use Cloudflare API tokens with minimal scope
 *
 * **Migration Path**:
 * - Start with SQLite for development
 * - Export embeddings and migrate to Vectorize for production
 * - Use local SQLite as fallback when cloud unavailable
 *
 * **Future Enhancements**:
 * - Add `type: 'pinecone' | 'weaviate'` for other backends
 * - Add `backupPath: string` for automatic backups
 * - Add `cacheSize: number` for in-memory cache tuning
 * - Add `syncInterval: number` for cloud sync frequency
 *
 * **Example Config**:
 * ```yaml
 * vectorDB:
 *   type: sqlite
 *   path: ~/.prism/vector.db
 * # OR
 * vectorDB:
 *   type: cloudflare
 *   accountId: your-account-id
 *   apiKey: ${CLOUDFLARE_API_KEY}
 * ```
 *
 * @see SQLiteVectorDB for local implementation
 * @see https://developers.cloudflare.com/vectorize/
 */
export interface VectorDBConfig {
  /** Database backend type */
  type: 'sqlite' | 'cloudflare';

  /** SQLite database path (required for sqlite type) */
  path?: string;

  /** Cloudflare account ID (required for cloudflare type) */
  accountId?: string;

  /** Cloudflare API key (required for cloudflare type, use env var!) */
  apiKey?: string;
}

/**
 * Configuration for token optimizer
 *
 * **Purpose**: Controls how code chunks are compressed and selected to fit
 * within token budget constraints while maintaining relevance.
 *
 * **Token Budget**:
 * - maxTokens is the hard limit for LLM context
 * - Claude 3.5 Sonnet: 200K tokens
 * - Claude 3 Opus: 200K tokens
 * - Claude 3 Haiku: 200K tokens
 * - GPT-4: 128K tokens
 * - Set conservatively (80% of limit) for response headroom
 *
 * **Compression Strategy**:
 * - targetCompression 0.7 = reduce to 70% of original tokens
 * - preserveSignatures true = keep function signatures intact
 * - Higher compression = more tokens saved but more information loss
 *
 * **Quality Trade-offs**:
 * - Compression 0.9 (light): Remove comments, whitespace
 * - Compression 0.7 (medium): Remove docstrings, inline comments
 * - Compression 0.5 (aggressive): Remove all non-essential code
 *
 * **Performance Impact**:
 * - Higher compression = faster processing, less context
 * - Signature preservation = better type inference, more tokens
 *
 * **Validation Rules**:
 * - maxTokens >= 1000
 * - targetCompression in [0, 1]
 *
 * **Example Config**:
 * ```yaml
 * tokenOptimizer:
 *   maxTokens: 100000  # 100K tokens for code context
 *   targetCompression: 0.7  # Reduce to 70%
 *   preserveSignatures: true  # Keep type information
 * ```
 *
 * **Future Enhancements**:
 * - Add `strategy: 'ast' | 'semantic' | 'hybrid'` for compression algorithm
 * - Add `minRelevance: number` for chunk filtering threshold
 * - Add `preserveImports: boolean` for dependency tracking
 * - Add `adaptiveBudget: boolean` for dynamic token allocation
 *
 * @see TokenOptimizer for implementation
 */
export interface TokenOptimizerConfig {
  /** Maximum tokens to include in optimized prompt (hard limit) */
  maxTokens: number;

  /** Target compression ratio (0.0-1.0, where 0.5 = 50% of original) */
  targetCompression: number;

  /** Preserve function/method signatures during compression */
  preserveSignatures: boolean;
}

/**
 * Configuration for model router
 *
 * **Purpose**: Controls how requests are routed to different LLM providers
 * based on cost, availability, and query complexity.
 *
 * **Routing Strategy**:
 * - preferLocal true: Use Ollama (free, local) when available
 * - preferLocal false: Use Claude API (paid, higher quality)
 * - Fallback: Automatic if primary choice unavailable
 *
 * **Model Selection Logic** (in ModelRouter):
 * - Simple queries + < 8K tokens → Ollama (deepseek-coder-v2)
 * - Medium complexity + < 20K tokens → Claude 3 Haiku
 * - Complex + < 100K tokens → Claude 3.5 Sonnet
 * - Very complex or large → Claude 3 Opus
 *
 * **Ollama Configuration**:
 * - Default: http://localhost:11434
 * - Requires: Ollama installed and model downloaded
 * - Models: deepseek-coder-v2, codellama, mistral
 *
 * **API Key Security**:
 * - Store in environment variable: `ANTHROPIC_API_KEY`
 * - Never hardcode in config files
 * - Use different keys for dev/prod
 *
 * **Cost Optimization**:
 * - Ollama: $0 (local GPU/CPU)
 * - Claude 3 Haiku: $0.25/M input tokens
 * - Claude 3.5 Sonnet: $3/M input tokens
 * - Claude 3 Opus: $15/M input tokens
 *
 * **Example Config**:
 * ```yaml
 * modelRouter:
 *   preferLocal: true
 *   localEndpoint: http://localhost:11434
 *   apiKey: ${ANTHROPIC_API_KEY}
 * ```
 *
 * **Future Enhancements**:
 * - Add `models: ModelConfig[]` for explicit model list
 * - Add `complexityThreshold: number` for routing sensitivity
 * - Add `costLimit: number` for monthly budget cap
 * - Add `latencyBudget: number` for response time SLA
 * - Add `fallbackOrder: string[]` for custom fallback chain
 *
 * @see ModelRouter for routing logic
 * @see https://ollama.ai/
 */
export interface ModelRouterConfig {
  /** Prefer local Ollama over Claude API */
  preferLocal: boolean;

  /** Ollama server endpoint (if preferLocal is true) */
  localEndpoint?: string;

  /** Anthropic API key (for Claude models, use env var!) */
  apiKey?: string;
}

/**
 * Main PRISM configuration
 *
 * **Purpose**: Root configuration object containing all subsystem configs.
 * Loaded from ~/.prism/config.yaml on startup.
 *
 * **Structure**: Organized by subsystem for clarity and modularity.
 * Each subsystem has its own config interface with validation rules.
 *
 * **Loading Process** (in src/config/loader.ts):
 * 1. Read ~/.prism/config.yaml (or create with defaults)
 * 2. Validate against schema
 * 3. Merge with DEFAULT_CONFIG (fills missing values)
 * 4. Return merged PrismConfig
 *
 * **Validation**:
 * - All required fields must be present
 * - Type checking enforced
 * - Range validation (e.g., chunkSize >= 100)
 * - Pattern validation for file paths
 *
 * **Hot Reload**:
 * - Not currently supported
 * - Requires restarting CLI after config changes
 * - Future: watch config file for changes
 *
 * **Example Full Config**:
 * ```yaml
 * indexer:
 *   chunkSize: 500
 *   overlap: 50
 *   languages: [typescript, python]
 *   includePatterns: ["src/**/*.ts"]
 *   excludePatterns: ["**/node_modules/**"]
 *
 * vectorDB:
 *   type: sqlite
 *   path: ~/.prism/vector.db
 *
 * tokenOptimizer:
 *   maxTokens: 100000
 *   targetCompression: 0.7
 *   preserveSignatures: true
 *
 * modelRouter:
 *   preferLocal: false
 *   localEndpoint: http://localhost:11434
 *   apiKey: ${ANTHROPIC_API_KEY}
 * ```
 *
 * **Future Enhancements**:
 * - Add `version: string` for config migration
 * - Add `profiles: Record<string, Partial<PrismConfig>>` for presets
 * - Add `experimental: Record<string, unknown>` for feature flags
 * - Add `logging: LogConfig` for log level control
 *
 * @see loadConfig() in src/config/loader.ts
 * @see DEFAULT_CONFIG for default values
 */
export interface PrismConfig {
  /** Indexer configuration */
  indexer: IndexerConfig;

  /** Vector database configuration */
  vectorDB: VectorDBConfig;

  /** Token optimizer configuration */
  tokenOptimizer: TokenOptimizerConfig;

  /** Model router configuration */
  modelRouter: ModelRouterConfig;
}

/**
 * ============================================================================
 * ERROR HANDLING TYPES
 * ============================================================================
 *
 * Types for structured error handling throughout PRISM.
 * Enables consistent error reporting and debugging.
 */

/**
 * Custom error class for PRISM
 *
 * **Purpose**: Provides structured error information with machine-readable
 * error codes and optional details for debugging.
 *
 * **Error Codes**:
 * - UNKNOWN: Uncategorized error
 * - EMBEDDING_FAILED: Embedding generation failure
 * - VECTOR_DB_ERROR: Database operation failure
 * - TOKEN_BUDGET_EXCEEDED: Context too large
 * - INVALID_CONFIG: Configuration validation failed
 * - FILE_NOT_FOUND: Source file missing
 * - INDEXING_FAILED: Parsing or extraction error
 * - MODEL_ROUTING_FAILED: Model selection/routing error
 * - INVALID_QUERY: Search query malformed
 * - COMPRESSION_FAILED: Chunk compression error
 *
 * **Usage Pattern**:
 * ```typescript
 * throw new PrismError(
 *   'Failed to generate embedding',
 *   'EMBEDDING_FAILED',
 *   { model: 'bge-small', text: '...' }
 * );
 * ```
 *
 * **Error Handling Best Practices**:
 * - Always provide human-readable message
 * - Use specific error codes (not UNKNOWN)
 * - Include relevant details for debugging
 * - Don't expose sensitive data in details
 * - Log errors before throwing/rethrowing
 *
 * **Serialization**: The `toJSON()` method enables JSON.stringify(error)
 * for logging and transmission across process boundaries.
 *
 * **Stack Traces**: In Node.js, uses Error.captureStackTrace for proper
 * stack trace. In browser, stack trace is automatic.
 *
 * **Future Enhancements**:
 * - Add `timestamp: Date` for error occurrence time
 * - Add `cause?: Error` for error chaining
 * - Add `context: Map<string, unknown>` for structured context
 * - Add error recovery suggestions
 *
 * @see ErrorCode enum in src/core/types/index.ts (main project)
 */
export class PrismError extends Error {
  /** Machine-readable error code for categorization */
  code: string;

  /** Additional error context (avoid sensitive data!) */
  details?: string | undefined;

  /**
   * Create a new PrismError
   *
   * @param message - Human-readable error description
   * @param code - Error category code (default: 'UNKNOWN')
   * @param details - Additional debugging information
   */
  constructor(
    message: string,
    code: string = 'UNKNOWN',
    details?: string | undefined
  ) {
    super(message);
    this.name = 'PrismError';
    this.code = code;
    this.details = details;
  }
}

/**
 * ============================================================================
 * SEARCH RESULT TYPES
 * ============================================================================
 *
 * Types representing the output of vector search operations.
 * Include scored chunks and ranking information.
 */

/**
 * Search result from vector database
 *
 * **Purpose**: Represents a single search result with relevance score
 * and metadata. Returned by vector database similarity search.
 *
 * **Score Interpretation**:
 * - Range: 0.0 to 1.0 (higher = more relevant)
 * - Score < 0.3: Not relevant
 * - Score 0.3-0.6: Somewhat relevant
 * - Score 0.6-0.8: Relevant
 * - Score > 0.8: Highly relevant
 * - Scores are comparable within a single search query only
 *
 * **Difference from CodeChunk**:
 * - SearchResult has `score` and `text` fields
 * - SearchResult.file = CodeChunk.filePath
 * - SearchResult is what users see
 * - CodeChunk is what's stored internally
 *
 * **Usage**:
 * ```typescript
 * const results: SearchResult[] = await vectorDB.search(embedding, { limit: 10 });
 *
 * // Filter by relevance
 * const relevant = results.filter(r => r.score > 0.6);
 *
 * // Group by file
 * const byFile = groupBy(results, 'file');
 * ```
 *
 * **Limitations**:
 * - Score is cosine similarity only (no boosting)
 * - Doesn't include score breakdown (use main project's ScoredChunk)
 * - Text field duplicates chunk.content (redundant)
 *
 * **Migration to Main Project Types**:
 * The main project uses `ScoredChunk` which extends `CodeChunk`:
 * ```typescript
 * interface ScoredChunk extends CodeChunk {
 *   relevanceScore: number;
 *   scoreBreakdown: ScoreBreakdown;  // semantic, proximity, symbol, etc.
 * }
 * ```
 * This provides more detailed scoring information for better ranking.
 *
 * **Future Enhancements**:
 * - Replace with ScoredChunk for detailed breakdowns
 * - Add `highlightRanges: SourceLocation[]` for query match locations
 * - Add `rank: number` for result position
 * - Add `explanation: string` for relevance explanation
 *
 * @see SearchResults for result collection
 * @see ScoredChunk in src/core/types/index.ts (main project)
 */
export interface SearchResult {
  /** Unique identifier matching CodeChunk.id */
  id: string;

  /** Code content (duplicates chunk.content for convenience) */
  text: string;

  /** File path (duplicates chunk.filePath) */
  file: string;

  /** Starting line number in source file */
  startLine: number;

  /** Ending line number in source file */
  endLine: number;

  /** Relevance score (0.0-1.0, higher = better) */
  score: number;

  /** Programming language */
  language: string;
}
