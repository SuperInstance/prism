/**
 * Configuration type definitions
 *
 * This module contains all configuration-related types for the PRISM system.
 * These define the shape of configuration files and runtime config objects.
 */

/**
 * Complete PRISM configuration
 *
 * Top-level configuration that includes all subsystem configurations.
 */
export interface PrismConfig {
  /** Cloudflare Workers configuration */
  cloudflare: CloudflareConfig;

  /** Ollama local model configuration */
  ollama: OllamaConfig;

  /** Code indexing configuration */
  indexing: IndexingConfig;

  /** Token optimization configuration */
  optimization: OptimizationConfig;

  /** MCP server configuration */
  mcp: MCPServerConfig;

  /** CLI configuration */
  cli: CLIConfig;

  /** Logging configuration */
  logging: LoggingConfig;
}

/**
 * Cloudflare configuration
 *
 * Settings for Cloudflare Workers AI, Vectorize, and D1.
 */
export interface CloudflareConfig {
  /** Cloudflare Account ID */
  accountId: string;

  /** Cloudflare API Key */
  apiKey: string;

  /** Optional: Custom API endpoint */
  apiEndpoint?: string;

  /** Vectorize vector database configuration */
  vectorize?: VectorizeConfig;

  /** D1 SQL database configuration */
  d1?: D1Config;

  /** KV storage configuration */
  kv?: KVConfig;

  /** R2 object storage configuration */
  r2?: R2Config;
}

/**
 * Vectorize configuration
 *
 * Settings for Cloudflare's vector database.
 */
export interface VectorizeConfig {
  /** Vectorize index name */
  indexName: string;

  /** Embedding dimensions (default: 384 for BGE-small) */
  dimensions?: number;

  /** Distance metric */
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

/**
 * D1 database configuration
 *
 * Settings for Cloudflare's SQLite database.
 */
export interface D1Config {
  /** Database name */
  databaseName: string;

  /** Optional: Database binding name */
  bindingName?: string;
}

/**
 * KV configuration
 *
 * Settings for Cloudflare's key-value store.
 */
export interface KVConfig {
  /** KV namespace ID */
  namespaceId: string;

  /** Optional: Binding name */
  bindingName?: string;
}

/**
 * R2 configuration
 *
 * Settings for Cloudflare's object storage.
 */
export interface R2Config {
  /** Bucket name */
  bucketName: string;

  /** Optional: Binding name */
  bindingName?: string;
}

/**
 * Ollama configuration
 *
 * Settings for local Ollama model server.
 */
export interface OllamaConfig {
  /** Enable Ollama integration */
  enabled: boolean;

  /** Ollama server URL */
  url: string;

  /** Default model to use */
  model: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Maximum retries for failed requests */
  maxRetries?: number;

  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Indexing configuration
 *
 * Settings for code indexing operations.
 */
export interface IndexingConfig {
  /** Glob patterns for files to include */
  include: string[];

  /** Glob patterns for files to exclude */
  exclude: string[];

  /** Watch files for changes and re-index */
  watch: boolean;

  /** Target chunk size in tokens */
  chunkSize: number;

  /** Maximum file size to process in bytes */
  maxFileSize: number;

  /** Specific languages to index (empty = all supported) */
  languages: string[];

  /** Chunking strategy */
  chunking: ChunkingConfig;

  /** Embedding configuration */
  embedding: EmbeddingConfig;
}

/**
 * Chunking configuration
 *
 * Settings for how code is divided into chunks.
 */
export interface ChunkingConfig {
  /** Chunking strategy */
  strategy: 'function' | 'fixed' | 'semantic';

  /** Minimum chunk size in tokens */
  minSize: number;

  /** Maximum chunk size in tokens */
  maxSize: number;

  /** Overlap between chunks in tokens */
  overlap: number;

  /** Preserve function/class boundaries */
  preserveBoundaries: boolean;
}

/**
 * Embedding configuration
 *
 * Settings for generating embeddings.
 */
export interface EmbeddingConfig {
  /** Embedding provider */
  provider: 'cloudflare' | 'ollama' | 'local';

  /** Model name */
  model: string;

  /** Batch size for embedding generation */
  batchSize: number;

  /** Dimensionality of embeddings */
  dimensions: number;

  /** Cache embeddings locally */
  cache: boolean;
}

/**
 * Optimization configuration
 *
 * Settings for token optimization.
 */
export interface OptimizationConfig {
  /** Total token budget for prompts */
  tokenBudget: number;

  /** Minimum relevance score (0-1) for chunks */
  minRelevance: number;

  /** Maximum number of chunks to include */
  maxChunks: number;

  /** Compression level (1-10, higher = more compression) */
  compressionLevel: number;

  /** Scoring weights */
  weights: ScoringWeights;
}

/**
 * Scoring weights for relevance calculation
 *
 * All weights should sum to 1.0.
 */
export interface ScoringWeights {
  /** Semantic similarity weight */
  semantic: number;

  /** File proximity weight */
  proximity: number;

  /** Symbol matching weight */
  symbol: number;

  /** Recency weight */
  recency: number;

  /** Usage frequency weight */
  frequency: number;
}

/**
 * MCP server configuration
 *
 * Settings for the Model Context Protocol server.
 */
export interface MCPServerConfig {
  /** Enable MCP server */
  enabled: boolean;

  /** Host to bind to */
  host: string;

  /** Port to listen on */
  port: number;

  /** Enable debug logging */
  debug: boolean;

  /** Maximum concurrent connections */
  maxConnections?: number;

  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * CLI configuration
 *
 * Settings for command-line interface behavior.
 */
export interface CLIConfig {
  /** Output format */
  format: 'text' | 'json' | 'markdown';

  /** Enable colored output */
  color: boolean;

  /** Show progress indicators */
  progress: boolean;

  /** Require confirmation for destructive operations */
  confirm: boolean;

  /** Default editor for opening files */
  editor?: string;

  /** Pager for long output */
  pager?: string;
}

/**
 * Logging configuration
 *
 * Settings for application logging.
 */
export interface LoggingConfig {
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error' | 'silent';

  /** Log format */
  format: 'pretty' | 'json';

  /** Log to file */
  file?: string;

  /** Maximum log file size in bytes */
  maxSize?: number;

  /** Number of backup log files to keep */
  maxFiles?: number;
}

/**
 * Configuration file format
 *
 * Represents the structure of prism.config.json files.
 */
export interface PrismConfigFile {
  /** Schema version */
  $schema?: string;

  /** Configuration values */
  config: PrismConfig;

  /** Profile name (for multi-environment configs) */
  profile?: string;

  /** Extends another config file */
  extends?: string;
}

/**
 * Configuration validation result
 *
 * Result of validating a configuration object.
 */
export type ValidationResult =
  | { valid: true; config: PrismConfig }
  | { valid: false; errors: ValidationError[] };

/**
 * Configuration validation error
 *
 * Describes a validation problem with configuration.
 */
export interface ValidationError {
  /** Path to invalid field (dot notation) */
  path: string;

  /** Error message */
  message: string;

  /** Invalid value */
  value: unknown;

  /** Expected type or format */
  expected?: string;
}

/**
 * Configuration source
 *
 * Where a configuration value came from.
 */
export enum ConfigSource {
  /** From default values */
  DEFAULT = 'default',

  /** From config file */
  FILE = 'file',

  /** From environment variable */
  ENV = 'env',

  /** From command-line flag */
  CLI = 'cli',
}

/**
 * Configuration metadata
 *
 * Tracks where each config value came from.
 */
export interface ConfigMetadata {
  /** Configuration value */
  value: unknown;

  /** Where this value came from */
  source: ConfigSource;

  /** For file sources, the file path */
  filePath?: string;

  /** For env sources, the variable name */
  envVar?: string;
}

/**
 * Environment-specific configuration
 *
 * Configuration that varies by environment.
 */
export interface EnvironmentConfig {
  /** Development environment config */
  development?: Partial<PrismConfig>;

  /** Production environment config */
  production?: Partial<PrismConfig>;

  /** Test environment config */
  test?: Partial<PrismConfig>;
}

/**
 * Feature flags
 *
 * Toggle features on/off.
 */
export interface FeatureFlags {
  /** Enable experimental features */
  experimental: boolean;

  /** Enable analytics collection */
  analytics: boolean;

  /** Enable telemetry */
  telemetry: boolean;

  /** Enable beta features */
  beta: boolean;
}

/**
 * Rate limiting configuration
 *
 * Settings for API rate limits.
 */
export interface RateLimitConfig {
  /** Requests per minute */
  requestsPerMinute: number;

  /** Tokens per minute */
  tokensPerMinute: number;

  /** Concurrent request limit */
  concurrentRequests: number;

  /** Retry after rate limit in milliseconds */
  retryAfter: number;
}

/**
 * Cache configuration
 *
 * Settings for various caches.
 */
export interface CacheConfig {
  /** Enable caching */
  enabled: boolean;

  /** Cache directory path */
  directory: string;

  /** Maximum cache size in bytes */
  maxSize: number;

  /** Cache entry TTL in milliseconds */
  ttl: number;

  /** Maximum number of entries */
  maxEntries: number;
}

/**
 * Security configuration
 *
 * Security-related settings.
 */
export interface SecurityConfig {
  /** API key encryption */
  encryptApiKeys: boolean;

  /** Allowed origins for CORS */
  allowedOrigins: string[];

  /** Enable CSRF protection */
  csrfProtection: boolean;

  /** Rate limiting */
  rateLimit: RateLimitConfig;
}

/**
 * Complete configuration with metadata
 *
 * Configuration that includes tracking of where values came from.
 */
export interface PrismConfigWithMetadata extends PrismConfig {
  /** Metadata for each configuration value */
  metadata: Record<string, ConfigMetadata>;

  /** Configuration file path (if loaded from file) */
  filePath?: string;

  /** Environment name */
  environment: string;

  /** Feature flags */
  features: FeatureFlags;

  /** Security settings */
  security: SecurityConfig;

  /** Cache settings */
  cache: CacheConfig;
}
