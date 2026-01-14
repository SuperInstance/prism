/**
 * ============================================================================
 * CLOUDFLARE WORKER ENVIRONMENT BINDINGS
 * ============================================================================
 *
 * This file defines the TypeScript interfaces for Cloudflare Workers
 * environment bindings. These are the services and variables that are
 * available to the Worker at runtime, configured in wrangler.toml.
 *
 * @see wrangler.toml for binding configuration
 * @see https://developers.cloudflare.com/workers/runtime-apis/
 */

// ============================================================================
// CLOUDFLARE D1 DATABASE
// ============================================================================

/**
 * D1 Database interface
 *
 * D1 is Cloudflare's SQLite-based database service.
 *
 * @see https://developers.cloudflare.com/d1/
 */
export interface D1Database {
  /**
   * Prepare a SQL statement for execution
   *
   * @param sql - SQL statement with optional ? placeholders
   * @returns Statement that can be executed
   */
  prepare(sql: string): D1PreparedStatement;

  /**
   * Execute a SQL statement directly (for statements without parameters)
   *
   * @param sql - SQL statement to execute
   * @returns Result of the execution
   */
  exec(sql: string): Promise<D1Result>;

  /**
   * Run multiple SQL statements in a transaction
   *
   * @param statements - Array of SQL statements
   * @returns Results of all executions
   */
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

/**
 * D1 Prepared Statement
 */
export interface D1PreparedStatement {
  /**
   * Bind parameters to the statement
   *
   * @param values - Parameter values (in order of ? placeholders)
   * @returns The statement for chaining
   */
  bind(...values: (string | number | boolean | null | ArrayBuffer)[]): D1PreparedStatement;

  /**
   * Execute the statement and return all results
   *
   * @returns All matching rows
   */
  all(): Promise<D1Result>;

  /**
   * Execute the statement and return first result
   *
   * @returns First matching row or null
   */
  first(): Promise<D1Record | null>;

  /**
   * Execute the statement (for INSERT/UPDATE/DELETE)
   *
   * @returns Execution result with metadata
   */
  run(): Promise<D1ExecResult>;
}

/**
 * D1 Query Result
 */
export interface D1Result {
  success: boolean;
  meta?: D1Meta;
  results?: D1Record[];
}

/**
 * D1 Single Record
 */
export interface D1Record {
  [column: string]: string | number | boolean | null;
}

/**
 * D1 Execution Result (for INSERT/UPDATE/DELETE)
 */
export interface D1ExecResult {
  success: boolean;
  meta: {
    duration: number;
    last_row_id: number;
    changes: number;
    served_by: string;
  };
}

/**
 * D1 Metadata
 */
export interface D1Meta {
  duration: number;
  last_row_id: number;
  changes: number;
  served_by: string;
}

// ============================================================================
// CLOUDFLARE KV
// ============================================================================

/**
 * KV Namespace interface
 *
 * KV is Cloudflare's key-value store with global edge caching.
 *
 * @see https://developers.cloudflare.com/kv/
 */
export interface KVNamespace {
  /**
   * Get a value by key
   *
   * @param key - Key to retrieve
   * @param options - Options for the get operation
   * @returns The value or null if not found
   */
  get(
    key: string,
    options?: { type: 'text' | 'arrayBuffer' | 'stream' }
  ): Promise<string | ArrayBuffer | ReadableStream | null>;

  /**
   * Put a value
   *
   * @param key - Key to set
   * @param value - Value to store
   * @param options - Options like expiration TTL
   */
  put(key: string, value: string | ReadableStream | ArrayBuffer, options?: {
    expirationTtl?: number;
    expiration?: number;
    metadata?: unknown;
  }): Promise<void>;

  /**
   * Delete a value
   *
   * @param key - Key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * List all keys in the namespace
   *
   * @param options - Options for listing (limit, cursor, prefix)
   * @returns List of keys and metadata
   */
  list(options?: {
    limit?: number;
    cursor?: string;
    prefix?: string;
  }): Promise<{
    keys: Array<{
      name: string;
      metadata?: unknown;
      expiration?: number;
    }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

// ============================================================================
// CLOUDFLARE R2
// ============================================================================

/**
 * R2 Bucket interface
 *
 * R2 is Cloudflare's S3-compatible object storage.
 *
 * @see https://developers.cloudflare.com/r2/
 */
export interface R2Bucket {
  /**
   * Get an object from the bucket
   *
   * @param key - Object key
   * @returns The object or null if not found
   */
  get(key: string): Promise<R2Object | null>;

  /**
   * Put an object into the bucket
   *
   * @param key - Object key
   * @param value - Object data
   * @param options - Upload options
   */
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: {
    httpMetadata?: {
      contentType?: string;
      contentLanguage?: string;
      contentDisposition?: string;
      contentEncoding?: string;
      cacheControl?: string;
      cacheExpiry?: string;
    };
    customMetadata?: Record<string, string>;
  }): Promise<{
    key: string;
    version: string;
    size: number;
    etag: string;
    uploaded: Date;
  }>;

  /**
   * Delete an object from the bucket
   *
   * @param key - Object key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * List objects in the bucket
   *
   * @param options - List options (limit, prefix, cursor)
   */
  list(options?: {
    limit?: number;
    prefix?: string;
    cursor?: string;
  }): Promise<{
    objects: Array<{
      key: string;
      size: number;
      uploaded: Date;
    }>;
    truncated: boolean;
    cursor?: string;
  }>;
}

/**
 * R2 Object
 */
export interface R2Object {
  key: string;
  size: number;
  httpMetadata: {
    contentType?: string;
    cacheControl?: string;
    contentEncoding?: string;
  };
  customMetadata: Record<string, string>;
  writeHttpMetadata: (
    metadata: {
      contentType?: string;
      cacheControl?: string;
      contentEncoding?: string;
    }
  ) => void;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json(): Promise<unknown>;
  body: ReadableStream;
}

// ============================================================================
// CLOUDFLARE VECTORIZE
// ============================================================================

/**
 * Vectorize Index interface
 *
 * Vectorize is Cloudflare's vector database for embeddings.
 *
 * @see https://developers.cloudflare.com/vectorize/
 */
export interface VectorizeIndex {
  /**
   * Query the index for similar vectors
   *
   * @param vector - Query vector
   * @param options - Query options (topK, namespace, filter)
   * @returns Array of matching vectors with scores
   */
  query(
    vector: number[],
    options?: {
      topK?: number;
      namespace?: string;
      returnValues?: boolean;
      returnMetadata?: boolean;
      filter?: VectorizeFilter;
    }
  ): Promise<{
    matches: Array<{
      id: string;
      score: number;
      value?: number[];
      metadata?: Record<string, unknown>;
    }>;
    count: number;
  }>;

  /**
   * Insert vectors into the index
   *
   * @param vectors - Vectors to insert with IDs and optional metadata
   */
  insert(vectors: Array<{
    id: string;
    vector: number[];
    metadata?: Record<string, unknown>;
    namespace?: string;
  }>): Promise<void>;

  /**
   * Update vectors in the index
   *
   * @param vectors - Vectors to update
   */
  update(vectors: Array<{
    id: string;
    vector: number[];
    metadata?: Record<string, unknown>;
    namespace?: string;
  }>): Promise<void>;

  /**
   * Delete vectors from the index
   *
   * @param ids - IDs of vectors to delete
   * @param options - Delete options (namespace)
   */
  delete(ids: string[], options?: {
    namespace?: string;
  }): Promise<void>;
}

/**
 * Vectorize filter for conditional queries
 */
export interface VectorizeFilter {
  [key: string]: string | number | boolean | null;
}

// ============================================================================
// CLOUDFLARE WORKERS AI
// ============================================================================

/**
 * Workers AI binding interface
 *
 * Provides access to Cloudflare's AI models including
 * text embeddings and LLM inference.
 *
 * @see https://developers.cloudflare.com/workers-ai/
 */
export interface Ai {
  /**
   * Run a text embedding model
   *
   * @param model - Model name (e.g., '@cf/baai/bge-small-en-v1.5')
   * @param input - Text or array of texts to embed
   * @returns Embedding vector(s)
   */
  run(
    model: '@cf/baai/bge-small-en-v1.5' | '@cf/baai/bge-base-en-v1.5' | string,
    input: string | string[]
  ): Promise<number[] | number[][]>;
}

// ============================================================================
// WORKER ENVIRONMENT
// ============================================================================

/**
 * Complete Worker Environment
 *
 * This interface defines all bindings and environment variables
 * available to the Worker at runtime.
 *
 * Bindings are configured in wrangler.toml under [env.production] or
 * at the top level for all environments.
 */
export interface Env {
  // ================================================================
  // SERVICE BINDINGS
  // ================================================================

  /** D1 Database - Stores vectors, chunks, file index, metadata */
  DB: D1Database;

  /** KV Namespace - Caches index metadata and frequently accessed data */
  KV: KVNamespace;

  /** R2 Bucket - Stores large files and documents */
  R2: R2Bucket;

  /** Vectorize Index - Vector database for fast similarity search */
  VECTORIZE: VectorizeIndex;

  /** Workers AI - Embedding generation and LLM inference */
  AI: Ai;

  // ================================================================
  // ENVIRONMENT VARIABLES (from wrangler.toml [vars])
  // ================================================================

  /** Environment name ('development', 'staging', 'production') */
  ENVIRONMENT?: string;

  /** Log level ('debug', 'info', 'warn', 'error') */
  LOG_LEVEL?: string;

  /** Default model for chat/completions */
  DEFAULT_MODEL?: string;

  /** Embedding model name */
  EMBEDDING_MODEL?: string;

  /** Maximum tokens per request */
  MAX_TOKENS?: string;

  /** Daily neuron limit for Cloudflare Workers AI */
  MAX_NEURONS_PER_DAY?: string;

  // ================================================================
  // SECRETS (from wrangler.toml [vars] with wrangler secret put)
  // ================================================================

  /** API authentication secret */
  API_SECRET?: string;

  /** JWT signing secret */
  JWT_SECRET?: string;

  /** Anthropic API key (for Claude models) */
  ANTHROPIC_API_KEY?: string;

  /** Ollama base URL (for local LLM fallback) */
  OLLAMA_BASE_URL?: string;

  // ================================================================
  // OPTIONAL: DURABLE OBJECTS (for session state)
  // ================================================================

  /** Durable Object for session management */
  SESSIONS?: {
    get(id: string): DurableObjectState;
  };
}

/**
 * Durable Object State
 */
export interface DurableObjectState {
  id: string;
  storage: DurableObjectStorage;
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Durable Object Storage
 */
export interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<{ keys: string[] }>;
  deleteAll(): Promise<void>;
  transaction(): Promise<DurableObjectTransaction>;
}

/**
 * Durable Object Transaction
 */
export interface DurableObjectTransaction {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): void;
  delete(key: string): void;
  commit(): Promise<void>;
  rollback(): void;
}

// ============================================================================
// WORKER EXPORT TYPE
// ============================================================================

/**
 * ExportedHandler type from Cloudflare Workers
 *
 * This is the type that the default export should match.
 */
export interface ExportedHandler<E = Env> {
  fetch?: (request: Request, env: E, ctx: ExecutionContext) => Promise<Response>;
}

/**
 * ExecutionContext provided by Cloudflare Workers
 */
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Request context passed to route handlers
 */
export interface RequestContext {
  env: Env;
  request: Request;
}

/**
 * API Response wrapper
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
