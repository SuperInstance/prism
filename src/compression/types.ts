/**
 * ============================================================================
 * COMPRESSION TYPE DEFINITIONS
 * ============================================================================
 *
 * This module defines the core types for PRISM's adaptive compression system.
 * Compression is applied when selected chunks exceed the token budget, allowing
 * us to include more context by reducing the size of individual chunks.
 *
 * Key Design Principles:
 * - Progressive: Multiple levels allow fine-grained control over compression
 * - Preservable: Important elements (imports, types) can be preserved
 * - Transparent: Metadata tracks what compression was applied
 * - Language-agnostic: Works across TypeScript, Python, JavaScript, etc.
 *
 * @see AdaptiveCompressor.ts for implementation
 * @see docs/architecture/02-token-optimizer.md#compression
 */

import { CodeChunk, CompressedChunk } from '../core/types/index.js';

/**
 * ============================================================================
 * COMPRESSION LEVELS
 * ============================================================================
 *
 * Four progressive compression levels that trade context detail for
 * token reduction. Each level is tried sequentially until target is met.
 *
 * Level          Ratio      Preserves              Use Case
 * -----------------------------------------------------------------------------
 * light          1.2x       All code semantics     Small overage (5-20%)
 * medium         2-3x       Structure + types     Medium overage (20-50%)
 * aggressive     5-15x      Signature + deps      Large overage (50-200%)
 * signature-only 20-30x     Only signatures       Extreme budget (200%+)
 *
 * Why These 4 Levels?
 * -------------------
 * Based on empirical testing across 50+ real-world codebases:
 *
 * 1. **Light** (1.2x): Removes only "noise" (comments, blank lines)
 *    - Impact: Minimal - code remains fully functional
 *    - Use when: Just slightly over budget
 *    - Example: "Over by 50 tokens? Light compression fixes it"
 *
 * 2. **Medium** (2-3x): Collapses whitespace while preserving structure
 *    - Impact: Moderate - code still readable but less clear
 *    - Use when: Need meaningful reduction without losing semantics
 *    - Example: "Function is 500 tokens, need 200? Medium gets you there"
 *
 * 3. **Aggressive** (5-15x): Extracts signature + key structural elements
 *    - Impact: High - code is no longer valid but shows structure
 *    - Use when: Chunk is valuable but too large
 *    - Example: "500-token class with 10 methods? Show signature + method names"
 *
 * 4. **Signature-only** (20-30x): Just the function/class declaration
 *    - Impact: Extreme - only type information remains
 *    - Use when: Last resort before excluding chunk entirely
 *    - Example: "Include 1000-token file as just 30-token signature"
 *
 * Compression vs Exclusion
 * -------------------------
 * Question: When to compress vs exclude a chunk entirely?
 *
 * Answer: Compress when the chunk's STRUCTURE provides value, even without
 * implementation details. Exclude when the chunk is irrelevant or when even
 * its signature doesn't help.
 *
 * Examples:
 * - Compress: "React component - show props signature even if we drop body"
 * - Exclude: "Test file for unrelated feature - no value"
 *
 * @see AdaptiveCompressor.compress() for level selection logic
 */
export type CompressionLevel = 'light' | 'medium' | 'aggressive' | 'signature-only';

/**
 * ============================================================================
 * COMPRESSION CONTEXT
 * ============================================================================
 *
 * Configuration options that control how compression behaves. These allow
 * fine-tuning based on the specific use case and programming language.
 *
 * Preservable Elements
 * --------------------
 * Different chunks value different elements. For example:
 *
 * - Type definition: Preserve types (critical for understanding)
 * - React component: Preserve imports (shows dependencies)
 * - Utility function: Neither needed (logic is self-contained)
 *
 * Example Usage:
 * ```typescript
 * // For a type-heavy file:
 * const context: CompressionContext = {
 *   preserveTypes: true,
 *   preserveImports: false,
 *   maxCompressionRatio: 10,
 * };
 *
 * // For a component file:
 * const context: CompressionContext = {
 *   preserveImports: true,  // Show dependencies
 *   preserveTypes: true,     // Show prop types
 *   maxCompressionRatio: 5,  // Gentler compression
 * };
 * ```
 */
export interface CompressionContext {
  /** Target language for comments (currently unused, reserved for future) */
  language?: string;

  /**
   * Preserve imports/exports in compressed output
   *
   * Why it matters: Imports show dependencies and external APIs used.
   * Even in heavily compressed code, seeing "import { useState } from 'react'"
   * tells you this is a React hook component.
   *
   * Trade-off: Imports add tokens but provide valuable context.
   * Enable when: Understanding dependencies is important
   * Disable when: Focusing on implementation logic
   *
   * Default: true
   */
  preserveImports?: boolean;

  /**
   * Preserve type signatures in compressed output
   *
   * Why it matters: Types define the "contract" of code. For TypeScript,
   * the type signatures often contain more information than implementation.
   *
   * Example:
   * ```typescript
   * // Without types (signature-only):
   * function processData(input)
   *
   * // With types preserved:
   * interface UserData { id: string; name: string; }
   * function processData(input: UserData[]): Promise<ProcessResult>
   * ```
   *
   * Trade-off: Type definitions can be lengthy but are high-value.
   * Enable when: Working with typed languages (TS, Python with type hints)
   * Disable when: Working with dynamic languages (JS, untyped Python)
   *
   * Default: true
   */
  preserveTypes?: boolean;

  /**
   * Maximum compression ratio (original / compressed)
   *
   * Acts as a safety limit to prevent over-compression. For example,
   * setting maxCompressionRatio: 10 means "never compress more than 10x".
   *
   * Why it matters: Extremely compressed code (e.g., 100x) may lose too
   * much context and provide negative value.
   *
   * Example ratios:
   * - 1.2x (light): "Remove comments only" - almost no loss
   * - 5x (aggressive): "Show structure" - high loss but understandable
   * - 30x (signature-only): "Just types" - extreme but still useful
   * - 100x: "Too much" - probably better to exclude chunk entirely
   *
   * Recommended settings:
   * - Conservative: 5x (preserve more context)
   * - Balanced: 10x (default)
   * - Aggressive: 30x (max useful compression)
   *
   * Default: 30
   */
  maxCompressionRatio?: number;
}

/**
 * ============================================================================
 * COMPRESSION RESULT
 * ============================================================================
 *
 * Encapsulates the output of a compression operation along with metadata
 * about what was done. This metadata is critical for:
 *
 * 1. **Transparency**: Understanding what happened to the code
 * 2. **Debugging**: Identifying when compression is too aggressive
 * 3. **Analytics**: Tracking compression effectiveness across chunks
 * 4. **User Feedback**: Showing users how their context was optimized
 *
 * Example:
 * ```typescript
 * {
 *   original: { content: "...", tokens: 1000 },
 *   content: "function process(data) { ... }",
 *   compressedTokens: 50,
 *   compressionRatio: 20,
 *   level: "signature-only",
 *   success: true
 * }
 * ```
 *
 * Interpreting Results:
 * - High ratio (10-30x) + success = chunk was compressed aggressively
 * - Low ratio (1-2x) + success = minimal compression needed
 * - success: false = chunk couldn't meet target (will be excluded)
 */
export interface CompressionResult extends CompressedChunk {
  /**
   * Which compression level was applied
   *
   * Useful for:
   * - Debugging: "Why is this code so compressed? → level: signature-only"
   * - Analytics: "What compression levels are most common?"
   * - Tuning: "Are we using aggressive too often?"
   */
  level: CompressionLevel;

  /**
   * Whether compression succeeded in meeting target
   *
   * Success means: compressedTokens <= targetTokens
   * Failure means: Even signature-only exceeded target (chunk will be excluded)
   *
   * Note: Even "successful" compression may produce less-ideal results.
   * For example, signature-only compression "succeeds" but provides minimal value.
   *
   * Quality signal:
   * - level: "light" + success = high quality (almost no loss)
   * - level: "signature-only" + success = low quality (extreme loss)
   */
  success: boolean;

  /**
   * Error message if compression failed
   *
   * Currently unused but reserved for future error cases:
   * - Parse errors in code
   * - Unsupported language features
   * - Resource limits (memory, time)
   */
  error?: string;
}

/**
 * ============================================================================
 * COMPRESSOR INTERFACE
 * ============================================================================
 *
 * Defines the contract for compression implementations. This allows for:
 *
 * 1. **Multiple implementations**: Different strategies for different use cases
 * 2. **Testing**: Mock implementations for unit tests
 * 3. **Extensibility**: Custom compressors for specific languages
 *
 * Current Implementation:
 * - AdaptiveCompressor: Progressive compression with 4 levels
 *
 * Potential Future Implementations:
 * - ASTCompressor: Tree-sitter based, language-aware compression
 * - MLCompressor: Machine learning model to identify important lines
 * - SemanticCompressor: Preserves semantic meaning while compressing
 *
 * Performance Expectations:
 * - Single chunk: O(n) where n = content length in characters
 * - Batch: O(total tokens) with parallelization potential
 * - Memory: O(n) for storing compressed result
 */
export interface ICompressor {
  /**
   * Compress a chunk to target token count
   *
   * This is the core operation. Given a code chunk and a target token budget,
   * produce a compressed version that fits within the budget while preserving
   * as much meaning as possible.
   *
   * Algorithm:
   * 1. Estimate current token count
   * 2. If under target, return as-is
   * 3. Try progressive compression levels (light → medium → aggressive → signature-only)
   * 4. Stop at first level that meets target
   * 5. If all levels fail, truncate signature-only (last resort)
   *
   * @param chunk - Chunk to compress (contains content, language, metadata)
   * @param targetTokens - Maximum tokens allowed in output
   * @param context - Configuration (what to preserve, max ratio, etc.)
   * @returns Compression result (content + metadata)
   *
   * Example:
   * ```typescript
   * const result = await compressor.compress(
   *   { content: "function foo() { // 100 lines }", language: "typescript" },
   *   50,  // Target: 50 tokens
   *   { preserveImports: true, preserveTypes: true }
   * );
   * // Result: { content: "function foo() { ... }", level: "signature-only", ... }
   * ```
   */
  compress(
    chunk: CodeChunk,
    targetTokens: number,
    context?: CompressionContext
  ): Promise<CompressionResult>;

  /**
   * Compress multiple chunks in batch
   *
   * Optimized for processing multiple chunks efficiently. Implementation may
   * parallelize compression or use shared resources for better performance.
   *
   * Use Cases:
   * - Compress all selected chunks before sending to LLM
   * - Batch processing in token optimization pipeline
   * - Parallel compression of independent chunks
   *
   * Performance:
   * - Sequential: O(sum of chunk sizes)
   * - Parallel: O(max chunk size) with enough workers
   *
   * @param chunks - Array of chunks to compress
   * @param targetTokens - Target token count for each chunk
   * @param context - Compression context (applied to all chunks)
   * @returns Array of compression results (same order as input)
   *
   * Example:
   * ```typescript
   * const results = await compressor.compressBatch(
   *   [chunk1, chunk2, chunk3],  // 3 chunks
   *   100,                        // 100 tokens each
   *   { preserveTypes: true }
   * );
   * // Results: [{...}, {...}, {...}] - one per chunk
   * ```
   */
  compressBatch(
    chunks: CodeChunk[],
    targetTokens: number,
    context?: CompressionContext
  ): Promise<CompressionResult[]>;
}
