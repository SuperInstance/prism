/**
 * Shared utility functions for PRISM
 *
 * This module contains common utilities used across workers and CLI
 * to avoid code duplication and ensure consistency.
 *
 * @module shared/utils
 * @version 0.3.1
 */

// ============================================================================
// Constants
// ============================================================================

export const CONFIG = {
  /** Maximum number of chunks per file */
  MAX_CHUNKS_PER_FILE: 1000,
  /** Maximum lines per chunk */
  MAX_LINES_PER_CHUNK: 50,
  /** Minimum content length for a chunk */
  MIN_CHUNK_CONTENT_LENGTH: 1,
  /** Maximum search results */
  MAX_SEARCH_LIMIT: 100,
  /** Default search results */
  DEFAULT_SEARCH_LIMIT: 10,
  /** Maximum files per indexing batch */
  MAX_FILES_PER_BATCH: 100,
  /** Maximum concurrent embedding generations */
  MAX_EMBEDDING_CONCURRENCY: 10,
  /** Embedding vector dimensions */
  EMBEDDING_DIMENSIONS: 384,
  /** Maximum query length */
  MAX_QUERY_LENGTH: 1000,
  /** Maximum file size (10MB) */
  MAX_FILE_SIZE: 10_000_000,
} as const;

// ============================================================================
// Types
// ============================================================================

export interface Chunk {
  content: string;
  startLine: number;
  endLine: number;
  language: string;
}

export interface CodeFile {
  path: string;
  content: string;
  language?: string;
}

// ============================================================================
// Cryptographic Utilities
// ============================================================================

/**
 * Calculate SHA-256 checksum of content
 * @param content - Text content to hash
 * @returns Hex-encoded SHA-256 hash
 */
export async function calculateChecksum(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// Language Detection
// ============================================================================

/**
 * Map of file extensions to programming languages
 */
const LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  pyi: "python",
  rs: "rust",
  go: "go",
  java: "java",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  c: "c",
  h: "c",
  hpp: "c",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  yaml: "yaml",
  yml: "yaml",
  json: "json",
  toml: "toml",
  xml: "xml",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "css",
  md: "markdown",
  markdown: "markdown",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
};

/**
 * Detect programming language from file path
 * @param path - File path
 * @returns Detected language or "text"
 */
export function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  return LANGUAGE_MAP[ext || ""] || "text";
}

// ============================================================================
// File Chunking
// ============================================================================

/**
 * Split file content into chunks
 * @param filePath - File path for error reporting
 * @param content - File content
 * @param language - Detected language
 * @returns Array of chunks
 * @throws Error if content is too large
 */
export function chunkFile(filePath: string, content: string, language: string): Chunk[] {
  const lines = content.split("\n");
  const chunks: Chunk[] = [];
  const maxLinesPerChunk = CONFIG.MAX_LINES_PER_CHUNK;
  let startLine = 0;

  while (startLine < lines.length) {
    const endLine = Math.min(startLine + maxLinesPerChunk, lines.length);
    const chunkContent = lines.slice(startLine, endLine).join("\n");

    // Only include non-empty chunks
    if (chunkContent.trim().length >= CONFIG.MIN_CHUNK_CONTENT_LENGTH) {
      chunks.push({
        content: chunkContent,
        startLine: startLine + 1, // 1-indexed
        endLine,
        language
      });
    }

    startLine = endLine;
  }

  // Validate chunk count
  if (chunks.length > CONFIG.MAX_CHUNKS_PER_FILE) {
    throw new Error(
      `File ${filePath} has too many chunks (${chunks.length}). ` +
      `Maximum allowed: ${CONFIG.MAX_CHUNKS_PER_FILE}`
    );
  }

  return chunks;
}

// ============================================================================
// Vector Encoding/Decoding
// ============================================================================

/**
 * Encode float array to Uint8Array for D1 BLOB storage
 * @param array - Float array to encode
 * @returns Uint8Array representation
 */
export function encodeFloat32Array(array: number[]): Uint8Array {
  const float32Array = new Float32Array(array);
  return new Uint8Array(float32Array.buffer);
}

/**
 * Decode D1 BLOB to float array
 * @param blob - Blob from D1 (various formats)
 * @returns Float array
 * @throws Error if blob format is invalid
 */
export function decodeFloat32Array(
  blob: Uint8Array | ArrayLike<number> | Record<string, unknown>
): number[] {
  let bytes: Uint8Array;

  if (blob instanceof Uint8Array) {
    bytes = blob;
  } else if (Array.isArray(blob)) {
    bytes = new Uint8Array(blob);
  } else if (blob && typeof blob === 'object') {
    if (blob.buffer instanceof ArrayBuffer) {
      bytes = new Uint8Array(blob.buffer);
    } else {
      // Handle D1 object format
      bytes = new Uint8Array(Object.values(blob).filter((v): v is number => typeof v === 'number'));
    }
  } else {
    throw new Error(`Invalid blob type: ${typeof blob}`);
  }

  if (bytes.length % 4 !== 0) {
    throw new Error(
      `Invalid blob length for float32: ${bytes.length} ` +
      `(must be multiple of 4, got ${bytes.length / 4} float32 values)`
    );
  }

  const float32Array = new Float32Array(bytes.buffer);
  return Array.from(float32Array);
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate file path to prevent path traversal attacks
 * @param path - File path to validate
 * @throws Error if path contains suspicious patterns
 */
export function validatePath(path: string): void {
  // Check for path traversal attempts
  if (path.includes('..') || path.includes('~')) {
    throw new Error(`Invalid file path: ${path}`);
  }

  // Check for absolute paths (not allowed in Workers)
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
    throw new Error(`Absolute paths not allowed: ${path}`);
  }

  // Check for null bytes
  if (path.includes('\0')) {
    throw new Error(`Null bytes not allowed in path`);
  }
}

/**
 * Validate file content
 * @param path - File path for error reporting
 * @param content - File content
 * @throws Error if content is invalid
 */
export function validateContent(path: string, content: string): void {
  if (typeof content !== 'string') {
    throw new Error(`Invalid content type for ${path}`);
  }

  if (content.length === 0) {
    throw new Error(`Empty file content: ${path}`);
  }

  if (content.length > CONFIG.MAX_FILE_SIZE) {
    throw new Error(
      `File too large: ${path} (${content.length} bytes, ` +
      `max ${CONFIG.MAX_FILE_SIZE})`
    );
  }
}

/**
 * Sanitize search query
 * @param query - Search query
 * @returns Sanitized query
 */
export function sanitizeQuery(query: string): string {
  return query.trim().slice(0, CONFIG.MAX_QUERY_LENGTH);
}

// ============================================================================
// Cosine Similarity
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score between 0 and 1
 * @throws Error if vector dimensions don't match
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimensions must match: ${a.length} != ${b.length}`
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

// ============================================================================
// HTTP Response Utilities
// ============================================================================

/**
 * Standard CORS headers for Workers
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

/**
 * Create a JSON response with CORS headers
 * @param data - Response data
 * @param status - HTTP status code
 * @returns Response object
 */
export function jsonResponse(data: unknown, status: number = 200): Response {
  const headers = new Headers(CORS_HEADERS);
  headers.set("Content-Type", "application/json");

  if (status >= 400) {
    return Response.json(
      { success: false, error: data },
      { status, headers }
    );
  }

  return Response.json({ success: true, data }, { status, headers });
}

/**
 * Create an error response
 * @param error - Error message or Error object
 * @param status - HTTP status code
 * @returns Response object
 */
export function errorResponse(error: Error | string, status: number = 500): Response {
  const message = error instanceof Error ? error.message : error;
  return jsonResponse(message, status);
}
