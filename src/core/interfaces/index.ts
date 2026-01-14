/**
 * Core service interfaces for PRISM system
 *
 * This module defines the contracts that all major services must implement.
 * These interfaces enable dependency injection, testing, and modularity.
 */

import type {
  CodeChunk,
  CompressedChunk,
  ModelChoice,
  OptimizedPrompt,
  Result,
  SearchResults,
  TokenBudget,
} from '../types/index.js';

/**
 * Vector database interface
 *
 * Defines operations for storing, retrieving, and searching code chunks
 * using vector embeddings.
 */
export interface IVectorDatabase {
  /**
   * Insert a single code chunk into the database
   *
   * @param chunk - The code chunk to insert
   * @returns Promise that resolves when insertion is complete
   * @throws {PrismError} If insertion fails
   */
  insert(chunk: CodeChunk): Promise<void>;

  /**
   * Insert multiple code chunks in a batch
   *
   * More efficient than multiple single inserts.
   *
   * @param chunks - Array of code chunks to insert
   * @returns Promise that resolves when all chunks are inserted
   * @throws {PrismError} If batch insertion fails
   */
  insertBatch(chunks: CodeChunk[]): Promise<void>;

  /**
   * Search for similar chunks using vector embedding
   *
   * @param query - Vector embedding of the query
   * @param options - Search options and filters
   * @returns Search results with scored chunks
   * @throws {PrismError} If search fails
   */
  search(query: number[], options: SearchOptions): Promise<SearchResults>;

  /**
   * Retrieve a chunk by its ID
   *
   * @param id - Unique chunk identifier
   * @returns The chunk if found, null otherwise
   * @throws {PrismError} If retrieval fails
   */
  get(id: string): Promise<CodeChunk | null>;

  /**
   * Delete a chunk by its ID
   *
   * @param id - Unique chunk identifier
   * @returns Promise that resolves when deletion is complete
   * @throws {PrismError} If deletion fails
   */
  delete(id: string): Promise<void>;

  /**
   * Clear all chunks from the database
   *
   * Use with caution! This operation is not reversible.
   *
   * @returns Promise that resolves when database is cleared
   * @throws {PrismError} If clearing fails
   */
  clear(): Promise<void>;

  /**
   * Get statistics about the database
   *
   * @returns Database statistics
   */
  getStats(): Promise<DatabaseStats>;
}

/**
 * Vector database statistics
 */
export interface DatabaseStats {
  /** Total number of chunks stored */
  totalChunks: number;

  /** Number of chunks by language */
  chunksByLanguage: Record<string, number>;

  /** Index size in bytes */
  indexSize: number;

  /** Last update timestamp */
  lastUpdated: Date;
}

/**
 * Search options for vector database queries
 */
export interface SearchOptions {
  /** Maximum number of results to return */
  limit?: number;

  /** Filter by file path pattern */
  pathFilter?: string;

  /** Filter by programming language */
  languageFilter?: string;

  /** Include detailed score breakdown */
  includeBreakdown?: boolean;

  /** Minimum relevance threshold */
  minRelevance?: number;
}

/**
 * Code indexer interface
 *
 * Defines operations for parsing source code and extracting
 * code chunks with their embeddings.
 */
export interface IIndexer {
  /**
   * Index a single source file
   *
   * Parses the file and extracts code chunks.
   *
   * @param filePath - Absolute path to the source file
   * @returns Array of extracted code chunks
   * @throws {PrismError} If parsing fails
   */
  index(filePath: string): Promise<CodeChunk[]>;

  /**
   * Index all files in a directory recursively
   *
   * @param path - Absolute path to the directory
   * @returns Array of all extracted code chunks
   * @throws {PrismError} If directory scanning or parsing fails
   */
  indexDirectory(path: string): Promise<CodeChunk[]>;

  /**
   * Generate embeddings for code chunks
   *
   * Uses the configured embedding model to generate vector
   * representations for semantic search.
   *
   * @param chunks - Code chunks to embed
   * @returns Chunks with embeddings populated
   * @throws {PrismError} If embedding generation fails
   */
  generateEmbeddings(chunks: CodeChunk[]): Promise<CodeChunk[]>;

  /**
   * Watch a directory for changes and auto-index
   *
   * @param path - Absolute path to watch
   * @param callback - Called when chunks are updated
   * @returns Function to stop watching
   */
  watch(
    path: string,
    callback: (chunks: CodeChunk[]) => void
  ): () => void;
}

/**
 * Token optimizer interface
 *
 * Defines operations for selecting and compressing code chunks
 * to fit within token budget constraints.
 */
export interface ITokenOptimizer {
  /**
   * Reconstruct an optimized prompt
   *
   * Selects the most relevant chunks and compresses them to fit
   * within the token budget.
   *
   * @param query - User query or search context
   * @param chunks - Available code chunks to select from
   * @param budget - Token budget allocation
   * @returns Optimized prompt with compressed chunks
   * @throws {PrismError} If optimization fails
   */
  reconstructPrompt(
    query: string,
    chunks: CodeChunk[],
    budget: TokenBudget
  ): Promise<OptimizedPrompt>;

  /**
   * Estimate token count for text
   *
   * Uses a heuristic approximation (~4 chars per token).
   *
   * @param text - Text to estimate
   * @returns Estimated token count
   */
  estimateTokens(text: string): number;

  /**
   * Compress a code chunk to target token count
   *
   * Uses AST-preserving compression to maintain code structure
   * while reducing token count.
   *
   * @param chunk - Chunk to compress
   * @param targetTokens - Target token count
   * @returns Compressed chunk with metrics
   * @throws {PrismError} If compression fails
   */
  compressChunk(chunk: CodeChunk, targetTokens: number): CompressedChunk;
}

/**
 * Model router interface
 *
 * Defines operations for intelligently routing requests to the
 * most appropriate model based on complexity and cost.
 */
export interface IModelRouter {
  /**
   * Select the best model for a request
   *
   * Considers token count, query complexity, and cost to choose
   * the optimal model.
   *
   * @param tokens - Estimated token count
   * @param complexity - Query complexity score (0-1)
   * @returns Selected model with reasoning
   */
  selectModel(tokens: number, complexity: number): ModelChoice;

  /**
   * Route a request to Ollama (local model)
   *
   * @param request - AI request to process
   * @returns AI response from Ollama
   * @throws {PrismError} If Ollama is unavailable or request fails
   */
  routeToOllama(request: AIRequest): Promise<AIResponse>;

  /**
   * Route a request to Claude (Anthropic API)
   *
   * @param request - AI request to process
   * @returns AI response from Claude
   * @throws {PrismError} If API call fails
   */
  routeToClaude(request: AIRequest): Promise<AIResponse>;

  /**
   * Route a request to Cloudflare Workers AI
   *
   * @param request - AI request to process
   * @returns AI response from Cloudflare
   * @throws {PrismError} If API call fails
   */
  routeToCloudflare(request: AIRequest): Promise<AIResponse>;

  /**
   * Check if a model is available
   *
   * @param model - Model identifier
   * @returns True if model is available
   */
  isAvailable(model: string): Promise<boolean>;
}

/**
 * AI request structure
 */
export interface AIRequest {
  /** The prompt to send to the model */
  prompt: string;

  /** Maximum tokens to generate */
  maxTokens: number;

  /** Temperature for sampling (0-1) */
  temperature?: number;

  /** Stop sequences */
  stopSequences?: string[];
}

/**
 * AI response structure
 */
export interface AIResponse {
  /** Generated text */
  text: string;

  /** Tokens used (input + output) */
  tokensUsed: number;

  /** Cost in USD */
  cost: number;

  /** Model that processed the request */
  model: string;

  /** Time taken in milliseconds */
  duration: number;
}

/**
 * MCP server interface
 *
 * Defines operations for running an MCP (Model Context Protocol) server
 * that provides tools to Claude Code.
 */
export interface IMCPServer {
  /**
   * Start the MCP server
   *
   * Begins listening for connections from Claude Code.
   *
   * @returns Promise that resolves when server is started
   * @throws {PrismError} If server fails to start
   */
  start(): Promise<void>;

  /**
   * Stop the MCP server
   *
   * Gracefully shuts down the server.
   *
   * @returns Promise that resolves when server is stopped
   * @throws {PrismError} If shutdown fails
   */
  stop(): Promise<void>;

  /**
   * Register a tool with the server
   *
   * Tools are callable functions that Claude Code can invoke.
   *
   * @param name - Tool identifier
   * @param handler - Function to handle tool calls
   */
  registerTool(name: string, handler: ToolHandler): void;

  /**
   * Unregister a tool
   *
   * @param name - Tool identifier
   */
  unregisterTool(name: string): void;

  /**
   * Get list of registered tools
   *
   * @returns Array of tool definitions
   */
  getTools(): ToolDefinition[];

  /**
   * Check if server is running
   *
   * @returns True if server is active
   */
  isRunning(): boolean;
}

/**
 * Tool handler function
 *
 * Called when Claude Code invokes a tool.
 */
export interface ToolHandler {
  /**
   * Handle a tool invocation
   *
   * @param params - Parameters from Claude Code
   * @returns Tool execution result
   * @throws {PrismError} If tool execution fails
   */
  (params: unknown): Promise<ToolResult>;
}

/**
 * Tool definition for MCP
 */
export interface ToolDefinition {
  /** Tool identifier */
  name: string;

  /** Human-readable description */
  description: string;

  /** JSON schema for parameters */
  inputSchema: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  /** Result data */
  content: unknown;

  /** Whether execution was successful */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Embedding service interface
 *
 * Defines operations for generating vector embeddings from text.
 */
export interface IEmbeddingService {
  /**
   * Generate embedding for a single text
   *
   * @param text - Text to embed
   * @returns Vector embedding (typically 384 dimensions)
   * @throws {PrismError} If embedding generation fails
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts in batch
   *
   * More efficient than multiple single calls.
   *
   * @param texts - Array of texts to embed
   * @returns Array of vector embeddings
   * @throws {PrismError} If batch embedding fails
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Get dimension of embedding vectors
   *
   * @returns Vector dimension (e.g., 384 for BGE-small)
   */
  getDimension(): number;
}

/**
 * File system interface
 *
 * Defines operations for reading and writing files.
 * Useful for testing with mock file systems.
 */
export interface IFileSystem {
  /**
   * Read file contents
   *
   * @param filePath - Absolute path to file
   * @returns File contents as string
   * @throws {PrismError} If file doesn't exist or can't be read
   */
  readFile(filePath: string): Promise<string>;

  /**
   * Write contents to file
   *
   * @param filePath - Absolute path to file
   * @param content - Content to write
   * @throws {PrismError} If write fails
   */
  writeFile(filePath: string, content: string): Promise<void>;

  /**
   * Check if file exists
   *
   * @param filePath - Absolute path to file
   * @returns True if file exists
   */
  exists(filePath: string): Promise<boolean>;

  /**
   * List files in directory
   *
   * @param dirPath - Absolute path to directory
   * @param options - Options for listing
   * @returns Array of file paths
   * @throws {PrismError} If directory doesn't exist
   */
  listFiles(
    dirPath: string,
    options?: { recursive?: boolean; pattern?: string }
  ): Promise<string[]>;

  /**
   * Get file stats
   *
   * @param filePath - Absolute path to file
   * @returns File statistics
   * @throws {PrismError} If file doesn't exist
   */
  getStats(filePath: string): Promise<FileStats>;
}

/**
 * File statistics
 */
export interface FileStats {
  /** File size in bytes */
  size: number;

  /** Last modified timestamp */
  modified: Date;

  /** Is this a directory? */
  isDirectory: boolean;

  /** File extension */
  extension: string;
}

/**
 * Configuration service interface
 *
 * Defines operations for loading and validating configuration.
 */
export interface IConfigurationService {
  /**
   * Load configuration from file or environment
   *
   * @returns Loaded and validated configuration
   * @throws {PrismError} If configuration is invalid
   */
  load(): Promise<Config>;

  /**
   * Validate configuration
   *
   * @param config - Configuration to validate
   * @returns Validation result
   */
  validate(config: unknown): Result<Config, ValidationError[]>;

  /**
   * Get a configuration value
   *
   * @param key - Configuration key (dot notation supported)
   * @returns Configuration value or undefined
   */
  get<T>(key: string): T | undefined;

  /**
   * Set a configuration value
   *
   * @param key - Configuration key (dot notation supported)
   * @param value - Value to set
   */
  set<T>(key: string, value: T): void;

  /**
   * Save configuration to file
   *
   * @returns Promise that resolves when saved
   * @throws {PrismError} If save fails
   */
  save(): Promise<void>;
}

/**
 * Application configuration
 */
export interface Config {
  /** Cloudflare configuration */
  cloudflare: CloudflareConfig;

  /** Ollama configuration */
  ollama: OllamaConfig;

  /** Indexing configuration */
  indexing: IndexingConfig;

  /** Optimization configuration */
  optimization: OptimizationConfig;

  /** MCP server configuration */
  mcp: MCPServerConfig;
}

/**
 * Cloudflare configuration
 */
export interface CloudflareConfig {
  /** Cloudflare account ID */
  accountId: string;

  /** API key for Cloudflare */
  apiKey: string;

  /** Optional: Vectorize index name */
  vectorIndex?: string;

  /** Optional: D1 database name */
  databaseName?: string;

  /** Optional: KV namespace binding */
  kvNamespace?: string;
}

/**
 * Ollama configuration
 */
export interface OllamaConfig {
  /** Is Ollama enabled? */
  enabled: boolean;

  /** Ollama server URL */
  url: string;

  /** Default model to use */
  model: string;

  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Indexing configuration
 */
export interface IndexingConfig {
  /** Glob patterns for files to include */
  include: string[];

  /** Glob patterns for files to exclude */
  exclude: string[];

  /** Watch files for changes? */
  watch: boolean;

  /** Target chunk size in tokens */
  chunkSize: number;

  /** Maximum file size to process (bytes) */
  maxFileSize: number;

  /** Languages to index (empty = all) */
  languages: string[];
}

/**
 * Optimization configuration
 */
export interface OptimizationConfig {
  /** Total token budget */
  tokenBudget: number;

  /** Minimum relevance score (0-1) */
  minRelevance: number;

  /** Maximum chunks to include */
  maxChunks: number;

  /** Compression level (1-10) */
  compressionLevel: number;
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  /** Port to listen on */
  port: number;

  /** Host to bind to */
  host: string;

  /** Enable debug logging? */
  debug: boolean;
}

/**
 * Configuration validation error
 */
export interface ValidationError {
  /** Path to invalid field */
  path: string;

  /** Error message */
  message: string;

  /** Invalid value */
  value: unknown;
}
