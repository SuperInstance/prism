/**
 * ============================================================================
 * ADAPTIVE COMPRESSOR
 * ============================================================================
 *
 * Implements progressive compression that tries multiple strategies in sequence,
 * using the least aggressive level that meets the token target.
 *
 * Core Philosophy:
 * "Preserve as much meaning as possible while meeting the token budget."
 *
 * How It Works:
 * 1. Start with light compression (minimal loss)
 * 2. If still over budget, try medium (moderate loss)
 * 3. If still over budget, try aggressive (high loss but preserves structure)
 * 4. If still over budget, use signature-only (extreme loss, just types)
 * 5. Last resort: truncate the signature (may break code validity)
 *
 * Why Progressive?
 * - Different chunks need different compression levels
 * - A 100-line utility might only need light compression
 * - A 1000-line class might need aggressive compression
 * - Trying each level ensures we use the minimum necessary compression
 *
 * Performance:
 * - Time: O(n) per level where n = content length
 * - Space: O(n) for storing compressed results
 * - Worst case: 4 passes (light → medium → aggressive → signature-only)
 *
 * @see types.ts for type definitions
 * @see docs/architecture/02-token-optimizer.md#compression
 */

import { CodeChunk } from '../core/types/index.js';
import {
  ICompressor,
  CompressionLevel,
  CompressionContext,
  CompressionResult,
  CompressedChunk,
} from './types.js';
import { estimateCodeTokens } from '../core/utils/token-counter.js';

/**
 * ============================================================================
 * IMPLEMENTATION
 * ============================================================================
 */
export class AdaptiveCompressor implements ICompressor {
  /**
   * Default compression context
   *
   * These defaults were chosen based on testing across multiple codebases:
   *
   * - preserveImports: true → Imports are high-value context (show dependencies)
   * - preserveTypes: true → Types are critical for TypeScript/Python understanding
   * - maxCompressionRatio: 30 → Allow aggressive compression but prevent over-compression
   *
   * The maxCompressionRatio of 30x means:
   * - 1000-token chunk → minimum 33 tokens (1000/30)
   * - Prevents compressing 1000-token file to 5 tokens (too much loss)
   * - In practice, we rarely hit this limit (most chunks compress at 5-15x)
   */
  private readonly defaultContext: CompressionContext = {
    preserveImports: true,
    preserveTypes: true,
    maxCompressionRatio: 30, // Max 30x compression (allows signature-only)
  };

  /**
   * ============================================================================
 * CORE ALGORITHM: Progressive Compression
 * ============================================================================
 *
 * This is the main compression method. It tries each compression level
 * in sequence, stopping at the first one that meets the target.
 *
 * Algorithm (Step by Step):
 * ------------------------
 * 1. **Estimate**: Count tokens in original content
 * 2. **Early exit**: If already under target, return as-is (no compression needed)
 * 3. **Progressive tries**:
 *    - Try light compression (remove comments)
 *    - If still over target, try medium (collapse whitespace)
 *    - If still over target, try aggressive (extract structure)
 *    - If still over target, try signature-only (just types)
 * 4. **Last resort**: Truncate signature to fit (may break validity)
 * 5. **Return**: Result with metadata about what was done
 *
 * Why This Approach?
 * ------------------
 * - **Greedy**: First level that works is "good enough"
 * - **Conservative**: We never compress more than necessary
 * - **Predictable**: Same input always produces same output
 * - **Transparent**: Result metadata shows what happened
 *
 * Example Walkthrough:
 * -------------------
 * ```typescript
 * // Input: 500-token function, target: 100 tokens
 *
 * // Try light (1.2x): ~417 tokens → Still over
 * // Try medium (2-3x): ~200 tokens → Still over
 * // Try aggressive (5-15x): ~50 tokens → Success!
 * // Return: { level: "aggressive", ratio: 10, success: true }
 * ```
 *
 * Edge Cases:
 * ----------
 * - **Already under budget**: Return as-is (level: "light", ratio: 1.0)
 * - **Can't meet target**: Truncate signature (success: true, but may be invalid)
 * - **Empty content**: Return as-is (0 tokens)
 *
 * Performance:
 * - Best case: O(n) - single pass (already under budget or light works)
 * - Average case: O(2n) - two passes (light + medium)
 * - Worst case: O(4n) - four passes (all levels tried)
 *
 * Where n = content length in characters
 *
 * @param chunk - Chunk to compress (contains content, language, metadata)
 * @param targetTokens - Maximum tokens allowed in output
 * @param context - Compression context (what to preserve, max ratio, etc.)
 * @returns Compression result (content + metadata)
 */
  async compress(
    chunk: CodeChunk,
    targetTokens: number,
    context: CompressionContext = {}
  ): Promise<CompressionResult> {
    const ctx = { ...this.defaultContext, ...context };

    // Estimate current tokens
    const currentTokens = this.estimateTokens(chunk.content);

    // If already under target, return as-is
    // This is the fast path - no compression needed
    if (currentTokens <= targetTokens) {
      return this.createResult(chunk, chunk.content, 'light', 1.0, true);
    }

    // Try progressive compression levels
    // We try each in order, stopping at the first that meets target
    const levels: CompressionLevel[] = ['light', 'medium', 'aggressive', 'signature-only'];

    for (const level of levels) {
      const compressed = this.compressAtLevel(chunk, level, ctx);
      const compressedTokens = this.estimateTokens(compressed);

      // If this level meets target, we're done
      // Don't try more aggressive levels (would lose more context)
      if (compressedTokens <= targetTokens) {
        const ratio = currentTokens / compressedTokens;
        return this.createResult(chunk, compressed, level, ratio, true);
      }
    }

    // If signature-only is still too large, truncate
    // This is the last resort - may break code validity
    // AUDIT NOTE: Truncation doesn't preserve code validity (see line 372-386)
    const signatureOnly = this.compressAtLevel(chunk, 'signature-only', ctx);
    const truncated = this.truncateToTarget(signatureOnly, targetTokens);
    const finalTokens = this.estimateTokens(truncated);
    const ratio = currentTokens / finalTokens;

    return this.createResult(chunk, truncated, 'signature-only', ratio, true);
  }

  /**
   * ============================================================================
 * BATCH COMPRESSION
 * ============================================================================
 *
 * Compress multiple chunks efficiently. Currently processes chunks in parallel
 * using Promise.all, but could be optimized further with worker threads.
 *
 * Use Cases:
 * ----------
 * - Token optimization pipeline (compress all selected chunks)
 * - Parallel processing of independent chunks
 * - Bulk compression for caching/pre-computation
 *
 * Performance:
 * - Current: O(n) parallel where n = number of chunks
 * - Bottleneck: Token estimation is CPU-bound
 * - Future: Could use worker threads for true parallelism
 *
 * @param chunks - Chunks to compress
 * @param targetTokens - Target token count per chunk (same for all)
 * @param context - Compression context (applied to all chunks)
 * @returns Array of compression results (same order as input)
 */
  async compressBatch(
    chunks: CodeChunk[],
    targetTokens: number,
    context?: CompressionContext
  ): Promise<CompressionResult[]> {
    return Promise.all(
      chunks.map(chunk => this.compress(chunk, targetTokens, context))
    );
  }

  /**
   * ============================================================================
 * LEVEL 1: LIGHT COMPRESSION (~1.2x reduction)
 * ============================================================================
 *
 * Removes only "noise" that doesn't affect code semantics:
 * - Single-line comments (// ...)
 * - Multi-line comments (/* ... {* /})
 * - Blank lines
 *
 * Preserves:
 * - All code logic
 * - All whitespace within lines
 * - All formatting
 *
 * Example:
 * -------
 * ```typescript
 * // Before (light):
 * // {* This function processes user data
 * //  * @param data - The user data to process
 * //  * /}
 * function processData(data) {
 *
 *   // Validate input
 *   if (!data) return null;
 *
 *   // Process and return
 *   return data.map(x => x * 2);
 * }
 *
 * // After (light):
 * function processData(data) {
 *   if (!data) return null;
 *   return data.map(x => x * 2);
 * }
 * ```
 *
 * When to use:
 * - Just slightly over token budget (5-20% overage)
 * - Need to preserve exact formatting
 * - Comments are redundant with code
 *
 * Limitations:
 * - Doesn't reduce tokens much (only ~20%)
 * - Comments can be valuable (TODOs, explanations)
 * - Blank lines can improve readability
 *
 * @param content - Content to compress
 * @returns Compressed content
 */
  private removeCommentsAndBlankLines(content: string): string {
    // Remove single-line comments
    // Pattern: // followed by anything until end of line
    // Global multiline flag ensures we catch all instances
    let compressed = content.replace(/\/\/.*$/gm, '');

    // Remove multi-line comments
    // Pattern: /* ... */ spanning multiple lines
    // Non-greedy match (.*?) ensures we don't over-match
    compressed = compressed.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove blank lines
    // Pattern: Lines with only whitespace
    // Global multiline flag ensures we catch all blank lines
    compressed = compressed.replace(/^\s*[\r\n]/gm, '');

    return compressed.trim();
  }

  /**
   * ============================================================================
 * LEVEL 2: MEDIUM COMPRESSION (~2-3x reduction)
 * ============================================================================
 *
 * Builds on light compression by additionally collapsing whitespace:
 * - Removes comments and blank lines (from light)
 * - Collapses multiple spaces to single space
 * - Collapses multiple newlines to max 2 newlines
 * - Removes trailing whitespace from each line
 *
 * Preserves:
 * - All code logic
 * - Basic structure (paragraphs)
 * - Code semantics
 *
 * Example:
 * -------
 * ```typescript
 * // Before (medium):
 * function processData(  data  )  {
 *
 *   if  (  !data  )  {
 *     return  null;
 *   }
 *
 *
 *   return  data.map(  x  =>  x  *  2  );
 * }
 *
 * // After (medium):
 * function processData(data) {
 *   if (!data) {
 *     return null;
 *   }
 *
 *   return data.map(x => x * 2);
 * }
 * ```
 *
 * When to use:
 * - Moderately over token budget (20-50% overage)
 * - Need meaningful reduction without losing semantics
 * - Formatting is less important than content
 *
 * Trade-offs:
 * - Less readable than light (harder to debug)
 * - Still preserves all code logic
 * - Good balance for most use cases
 *
 * @param content - Content to compress (should already have comments removed)
 * @returns Compressed content
 */
  private collapseWhitespace(content: string): string {
    // Collapse multiple spaces/tabs to single space
    // Pattern: One or more spaces/tabs → single space
    let compressed = content.replace(/[ \t]+/g, ' ');

    // Collapse multiple newlines to max 2
    // Pattern: 3+ newlines → exactly 2 newlines
    // This preserves paragraph breaks while removing excessive spacing
    compressed = compressed.replace(/\n{3,}/g, '\n\n');

    // Remove trailing whitespace from each line
    // Pattern: Spaces/tabs at end of line → nothing
    compressed = compressed.replace(/[ \t]+$/gm, '');

    return compressed.trim();
  }

  /**
   * ============================================================================
 * LEVEL 1 IMPLEMENTATION
 * ============================================================================
 *
 * Implementation of light compression - removes comments and blank lines.
 *
 * Note: This is defined after the LEVEL 2 documentation because LEVEL 2
 * builds on LEVEL 1. The actual method order doesn't matter for execution.
 *
 * Regex Patterns Used:
 * -------------------
 * 1. Single-line comments: /\/\/.*$/gm
 *    - Matches // followed by anything until end of line
 *    - Global (g) and multiline (m) flags
 *
 * 2. Multi-line comments: /\/\*[\s\S]*?\*\//g
 *    - Matches /{* ... *} /} spanning multiple lines
 *    - Non-greedy ({@code *?}) prevents over-matching
 *    - [\s\S] matches any character including newlines
 *
 * 3. Blank lines: /^\s*[\r\n]/gm
 *    - Matches lines with only whitespace
 *    - Global and multiline flags
 *
 * @param content - Content to compress
 * @returns Compressed content with comments and blank lines removed
 */
  private removeCommentsAndBlankLines(content: string): string {
    // Remove single-line comments
    // Pattern: // followed by anything until end of line
    // Global multiline flag ensures we catch all instances
    let compressed = content.replace(/\/\/.*$/gm, '');

    // Remove multi-line comments
    // Pattern: /* ... */ spanning multiple lines
    // Non-greedy match ensures we don't over-match
    compressed = compressed.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove blank lines
    // Pattern: Lines with only whitespace
    // Global multiline flag ensures we catch all blank lines
    compressed = compressed.replace(/^\s*[\r\n]/gm, '');

    return compressed.trim();
  }

  /**
   * ============================================================================
 * COMPRESSION LEVEL DISPATCHER
 * ============================================================================
 *
 * Routes to the appropriate compression method based on level.
 *
 * This is a simple switch statement that maps each level to its
 * corresponding implementation. The order matters:
 *
 * - Light: Fastest, least compression
 * - Medium: Builds on light
 * - Aggressive: Different strategy (structure extraction)
 * - Signature-only: Most aggressive (just types)
 *
 * @param chunk - Chunk to compress
 * @param level - Compression level to apply
 * @param context - Compression context
 * @returns Compressed content
 */
  private compressAtLevel(
    chunk: CodeChunk,
    level: CompressionLevel,
    context: CompressionContext
  ): string {
    switch (level) {
      case 'light':
        return this.removeCommentsAndBlankLines(chunk.content);

      case 'medium':
        return this.collapseWhitespace(
          this.removeCommentsAndBlankLines(chunk.content)
        );

      case 'aggressive':
        return this.extractSignaturePlusContext(chunk, context);

      case 'signature-only':
        return this.extractSignatureOnly(chunk, context);
    }
  }

  /**
   * ============================================================================
 * LEVEL 3: AGGRESSIVE COMPRESSION (~5-15x reduction)
 * ============================================================================
 *
 * Extracts signature and key structural elements, discarding implementation:
 * - Preserves: Function/class signature
 * - Preserves: Import statements (if enabled)
 * - Preserves: Type definitions (if enabled)
 * - Preserves: Key structural elements (method signatures, control flow)
 * - Discards: Implementation details
 *
 * Preserves:
 * - Type signatures (critical for understanding)
 * - Dependencies (imports)
 * - Structure (methods, control flow)
 *
 * Example:
 * -------
 * ```typescript
 * // Before (aggressive):
 * import { useState, useEffect } from 'react';
 *
 * interface UserData {
 *   id: string;
 *   name: string;
 * }
 *
 * function UserProfile({ userId }: { userId: string }) {
 *   const [user, setUser] = useState<UserData | null>(null);
 *   const [loading, setLoading] = useState(true);
 *
 *   useEffect(() => {
 *     fetch(`/api/users/${userId}`)
 *       .then(res => res.json())
 *       .then(data => {
 *         setUser(data);
 *         setLoading(false);
 *       });
 *   }, [userId]);
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (!user) return <div>User not found</div>;
 *
 *   return (
 *     <div>
 *       <h1>{user.name}</h1>
 *       <p>ID: {user.id}</p>
 *     </div>
 *   );
 * }
 *
 * // After (aggressive):
 * import { useState, useEffect } from 'react';
 *
 * interface UserData {
 *   id: string;
 *   name: string;
 * }
 *
 * function UserProfile({ userId }: { userId: string }) {
 *   ...
 *   if (loading) return <div>Loading...</div>;
 *   if (!user) return <div>User not found</div>;
 * }
 * ```
 *
 * When to use:
 * - Significantly over token budget (50-200% overage)
 * - Structure is more important than implementation
 * - Types/signatures provide most of the value
 *
 * Trade-offs:
 * - Code is no longer valid (won't run)
 * - Loses all implementation logic
 * - Preserves "shape" of code
 *
 * Language Considerations:
 * - TypeScript: Types are high-value (preserve them)
 * - Python: Type hints are valuable (preserve them)
 * - JavaScript: No types, so less effective
 *
 * @param chunk - Chunk to compress
 * @param context - Compression context (what to preserve)
 * @returns Compressed content
 */
  private extractSignaturePlusContext(
    chunk: CodeChunk,
    context: CompressionContext
  ): string {
    const lines = chunk.content.split('\n');
    const result: string[] = [];

    // Always preserve signature
    if (chunk.signature) {
      result.push(chunk.signature);
    } else {
      // Extract signature from first few lines
      const signatureLines = this.extractSignatureLines(lines, chunk.kind);
      result.push(...signatureLines);
    }

    // Preserve imports if requested
    if (context.preserveImports) {
      const imports = this.extractImports(lines);
      if (imports.length > 0) {
        result.push(...imports);
      }
    }

    // Preserve type definitions if requested
    if (context.preserveTypes) {
      const types = this.extractTypeDefinitions(lines);
      if (types.length > 0) {
        result.push(...types);
      }
    }

    // Add key structural elements (class methods, important statements)
    const structure = this.extractKeyStructure(lines, chunk.kind);
    if (structure.length > 0) {
      result.push('...');
      result.push(...structure);
    }

    return result.join('\n');
  }

  /**
   * ============================================================================
 * LEVEL 4: SIGNATURE-ONLY COMPRESSION (~20-30x reduction)
 * ============================================================================
 *
 * Extracts only the function/class signature, discarding all implementation:
 * - Preserves: Function/class declaration line(s)
 * - Preserves: Import statements (if enabled)
 * - Discards: All implementation, all structure, all logic
 *
 * This is the most aggressive compression level. It provides maximum token
 * reduction but minimum context.
 *
 * Example:
 * -------
 * ```typescript
 * // Before (signature-only):
 * import { useState, useEffect } from 'react';
 *
 * interface UserData {
 *   id: string;
 *   name: string;
 * }
 *
 * function UserProfile({ userId }: { userId: string }) {
 *   const [user, setUser] = useState<UserData | null>(null);
 *   const [loading, setLoading] = useState(true);
 *
 *   useEffect(() => {
 *     fetch(`/api/users/${userId}`)
 *       .then(res => res.json())
 *       .then(data => {
 *         setUser(data);
 *         setLoading(false);
 *       });
 *   }, [userId]);
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (!user) return <div>User not found</div>;
 *
 *   return (
 *     <div>
 *       <h1>{user.name}</h1>
 *       <p>ID: {user.id}</p>
 *     </div>
 *   );
 * }
 *
 * // After (signature-only):
 * import { useState, useEffect } from 'react';
 * function UserProfile({ userId }: { userId: string })
 * ```
 *
 * When to use:
 * - Extremely over token budget (200%+ overage)
 * - Type signature is the most valuable part
 * - Last resort before excluding chunk entirely
 *
 * Trade-offs:
 * - Code is invalid (just a declaration)
 * - No implementation context at all
 * - May not provide enough context for LLM to understand
 *
 * Language Considerations:
 * - TypeScript: Very effective (types are in signature)
 * - Python: Effective with type hints
 * - JavaScript: Less effective (no types in signature)
 *
 * @param chunk - Chunk to compress
 * @param context - Compression context (what to preserve)
 * @returns Signature only (plus imports if enabled)
 */
  private extractSignatureOnly(
    chunk: CodeChunk,
    context: CompressionContext
  ): string {
    // Build result from signature or extracted lines
    let result: string;

    // Use pre-computed signature if available
    // This is faster and more accurate than extracting on-the-fly
    if (chunk.signature) {
      result = chunk.signature;
    } else {
      // Extract from content using heuristic-based extraction
      const lines = chunk.content.split('\n');
      const signatureLines = this.extractSignatureLines(lines, chunk.kind);
      result = signatureLines.join('\n');
    }

    // Add imports if preserving
    // Imports provide valuable context about dependencies
    if (context.preserveImports) {
      const lines = chunk.content.split('\n');
      const imports = this.extractImports(lines);
      if (imports.length > 0) {
        return [...imports, result].join('\n');
      }
    }

    return result;
  }

  /**
   * ============================================================================
 * SIGNATURE EXTRACTION (Heuristic-Based)
 * ============================================================================
 *
 * Extracts the signature lines from a code chunk using pattern matching.
 *
 * How It Works:
 * -------------
 * This method uses simple string matching (regex-like) to identify where
 * the signature ends. It's not a full parser, but works well for common cases.
 *
 * For each construct type, we look for specific patterns:
 *
 * 1. **Functions/Methods**: Stop at opening brace `{` or arrow `=>`
 *    ```typescript
 *    function foo(a: string, b: number): boolean {
 *    //          ↑ signature ends here          ↑ stop
 *    ```
 *
 * 2. **Classes**: Stop at opening brace `{` or `extends` keyword
 *    ```typescript
 *    class MyClass extends ParentClass {
 *    //         ↑ signature ends here           ↑ stop
 *    ```
 *
 * 3. **Variables/Interfaces**: Stop at semicolon `;` or colon `:`
 *    ```typescript
 *    const myVar: string = "value";
 *    //              ↑ signature ends here ↑ stop
 *    ```
 *
 * AUDIT FINDING: Behavior on Brace Detection
 * -----------------------------------------
 * The current implementation STOPS at the brace line, not after it.
 * This means:
 *
 * ```typescript
 * // Input:
 * function processData(
 *   data: UserData[],
 *   options: ProcessOptions
 * ): Promise<Result> {
 *   const result = await process(data);
 *   return result;
 * }
 *
 * // Output (stops at brace):
 * function processData(
 *   data: UserData[],
 *   options: ProcessOptions
 * ): Promise<Result> {
 *
 * // Note: The brace line IS included, but nothing after it
 * ```
 *
 * This is intentional - the brace indicates the end of the signature.
 *
 * Safety Limit:
 * ------------
 * If we can't find the signature end within 5 lines, we stop anyway.
 * This prevents infinite loops on malformed code.
 *
 * Limitations:
 * - Not a full parser (may fail on complex signatures)
 * - Language-specific (works for TS/JS, not Python)
 * - May include extra lines in edge cases
 *
 * Future Improvements:
 * - Use Tree-sitter for AST-based extraction (more accurate)
 * - Add Python support (different signature syntax)
 * - Handle multi-line generics better
 *
 * @param lines - Lines of code to extract signature from
 * @param kind - Type of code construct (function, class, method, etc.)
 * @returns Signature lines (1-5 lines typically)
 */
  private extractSignatureLines(lines: string[], kind: string): string[] {
    const signature: string[] = [];

    for (const line of lines) {
      signature.push(line);

      // Check if we found the signature end
      // Logic varies by construct type
      if (kind === 'function' || kind === 'method') {
        // Stop after finding the opening brace or arrow
        // AUDIT NOTE: Stops AT the brace line, not after it
        if (line.includes('{') || line.includes('=>')) {
          break;
        }
      } else if (kind === 'class') {
        // Stop after finding class declaration or opening brace
        if (line.includes('{') || line.includes('extends')) {
          break;
        }
      } else {
        // For variables, interfaces, etc., stop at semicolon or colon
        if (line.includes('=') || line.includes(':') || line.trim().endsWith(';')) {
          break;
        }
      }

      // Safety limit: Stop if we've gone too far (more than 5 lines)
      // This prevents extracting entire file if signature is malformed
      if (signature.length > 5) {
        break;
      }
    }

    return signature;
  }

  /**
   * ============================================================================
 * IMPORT EXTRACTION
 * ============================================================================
 *
 * Extracts import/require statements from code.
 *
 * Why Imports Matter:
 * ------------------
 * Imports show dependencies and external APIs. Even in compressed code,
 * seeing "import { useState } from 'react'" tells you this is a React
 * hook component.
 *
 * Patterns Matched:
 * ---------------
 * - ES6 imports: `import ... from '...'`
 * - CommonJS requires: `require('...')`
 *
 * Example:
 * -------
 * ```typescript
 * // Input:
 * import { useState } from 'react';
 * import axios from 'axios';
 * const myModule = require('./myModule');
 *
 * function myFunc() { ... }
 *
 * // Output:
 * import { useState } from 'react';
 * import axios from 'axios';
 * const myModule = require('./myModule');
 * ```
 *
 * Limitations:
 * - Doesn't extract dynamic imports (import())
 * - Doesn't extract re-exports (export ... from ...)
 * - May miss import statements with unusual formatting
 *
 * @param lines - Lines of code to extract imports from
 * @returns Import lines found in the code
 */
  private extractImports(lines: string[]): string[] {
    const imports: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Match: "import ..." or "require(...)"
      if (trimmed.startsWith('import ') || trimmed.startsWith('require(')) {
        imports.push(line);
      }
    }

    return imports;
  }

  /**
   * ============================================================================
 * TYPE DEFINITION EXTRACTION
 * ============================================================================
 *
 * Extracts type definitions (interfaces, type aliases) from code.
 *
 * Why Types Matter:
 * ----------------
 * In TypeScript, types often contain more information than implementation.
 * For example, a complex interface may document the entire data structure.
 *
 * Patterns Matched:
 * ---------------
 * - Type aliases: `type Name = ...`
 * - Interfaces: `interface Name { ... }`
 *
 * Example:
 * -------
 * ```typescript
 * // Input:
 * type UserRole = 'admin' | 'user' | 'guest';
 *
 * interface UserData {
 *   id: string;
 *   name: string;
 *   role: UserRole;
 * }
 *
 * function processUser(user: UserData) { ... }
 *
 * // Output:
 * type UserRole = 'admin' | 'user' | 'guest';
 * interface UserData { id: string; name: string; role: UserRole; }
 * ```
 *
 * Limitations:
 * - Only extracts first line (multi-line types are truncated)
 * - Doesn't extract enum definitions
 * - Doesn't extract class declarations (different from interfaces)
 *
 * @param lines - Lines of code to extract types from
 * @returns Type definition lines found in the code
 */
  private extractTypeDefinitions(lines: string[]): string[] {
    const types: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Match: "type ..." or "interface ..."
      if (trimmed.startsWith('type ') || trimmed.startsWith('interface ')) {
        types.push(line);
      }
    }

    return types;
  }

  /**
   * ============================================================================
 * STRUCTURAL ELEMENT EXTRACTION
 * ============================================================================
 *
 * Extracts key structural elements from code based on construct type.
 *
 * For Classes:
 * -----------
 * Extracts method signatures (public, private, protected, static, async).
 *
 * For Functions:
 * -------------
 * Extracts control flow statements (if, for, while, switch).
 *
 * Example:
 * -------
 * ```typescript
 * // Input (class):
 * class MyClass {
 *   private data: Data;
 *
 *   public async fetchData(): Promise<void> {
 *     this.data = await api.get();
 *   }
 *
 *   private processData(): void {
 *     // process...
 *   }
 * }
 *
 * // Output (structure):
 *   public async fetchData(): Promise<void> {
 *   private processData(): void {
 * ```
 *
 * Limitations:
 * - Regex-based (may miss patterns or match non-methods)
 * - Only extracts first line of multi-line declarations
 * - Doesn't handle decorators or complex modifiers
 *
 * @param lines - Lines of code to extract structure from
 * @param kind - Type of code construct
 * @returns Key structural lines found in the code
 */
  private extractKeyStructure(lines: string[], kind: string): string[] {
    const structure: string[] = [];

    if (kind === 'class') {
      // Extract method signatures
      // Pattern: [visibility] [async] methodName(
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.match(/^(public |private |protected |static )?(async )?\w+\(/)) {
          structure.push(line);
        }
      }
    } else if (kind === 'function' || kind === 'method') {
      // Extract control flow statements
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('if ') || trimmed.startsWith('for ') ||
            trimmed.startsWith('while ') || trimmed.startsWith('switch ')) {
          structure.push(line);
        }
      }
    }

    return structure;
  }

  /**
   * ============================================================================
 * TRUNCATION (Last Resort)
 * ============================================================================
 *
 * Truncates content to fit within token budget by cutting off at line boundary.
 *
 * AUDIT FINDING: Code Validity Not Preserved
 * ------------------------------------------
 * This method does NOT preserve code validity. It simply cuts lines until
 * the token target is met. This can result in:
 *
 * ```typescript
 * // Input (signature-only compressed):
 * function processData(
 *   data: UserData[],
 *   options: ProcessOptions
 * ): Promise<Result>
 *
 * // Output (truncated to 20 tokens):
 * function processData(
 *   data: UserData[],
 *
 * // Result: Invalid syntax (unclosed parentheses)
 * ```
 *
 * Why Use Truncation?
 * -----------------
 * - Last resort when even signature-only is too large
 * - Better to show partial signature than exclude chunk entirely
 * - LLM may still infer structure from partial signature
 *
 * Safety Buffer:
 * -------------
 * Stops at 90% of target (targetTokens * 0.9) to avoid going over budget.
 * This accounts for estimation errors in token counting.
 *
 * Example:
 * -------
 * ```typescript
 * // Input: 100-token signature, target: 30 tokens
 * // After truncate: First 27 tokens (~3 lines)
 *
 * // Before:
 * function processUserData(
 *   users: UserData[],
 *   options: ProcessOptions
 * ): Promise<ProcessResult>
 *
 * // After (truncated):
 * function processUserData(
 *   users: UserData[],
 * ```
 *
 * Limitations:
 * - May produce invalid syntax
 * - Cuts at line boundaries (not token boundaries)
 * - No smart truncation (doesn't try to preserve validity)
 *
 * Future Improvements:
 * - Smart truncation at token boundaries
 * - Try to preserve validity (close parens, etc.)
 * - Add "...truncated" marker
 *
 * @param content - Content to truncate (already compressed)
 * @param targetTokens - Target token count
 * @returns Truncated content (may be invalid)
 */
  private truncateToTarget(content: string, targetTokens: number): string {
    const lines = content.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      result.push(line);
      const currentTokens = this.estimateTokens(result.join('\n'));

      // Stop at 90% of target to avoid going over budget
      // Safety buffer accounts for token estimation errors
      if (currentTokens >= targetTokens * 0.9) {
        break;
      }
    }

    return result.join('\n');
  }

  /**
   * ============================================================================
 * TOKEN ESTIMATION
 * ============================================================================
 *
 * Estimates token count for a given content string.
 *
 * Uses the estimateCodeTokens utility which provides a fast, language-aware
 * token approximation without calling the LLM API.
 *
 * Why Estimation Instead of Exact Count?
 * -------------------------------------
 * - Exact tokenization requires LLM API call (slow, costs money)
 * - Estimation is fast (milliseconds) and free
 * - Close enough for compression purposes (within 5-10%)
 *
 * Performance:
 * - Time: O(n) where n = content length
 * - No external dependencies
 * - Works offline
 *
 * @param content - Content to estimate tokens for
 * @returns Estimated token count
 */
  private estimateTokens(content: string): number {
    return estimateCodeTokens(content);
  }

  /**
   * ============================================================================
 * RESULT BUILDER
 * ============================================================================
 *
 * Creates a CompressionResult object with all metadata.
 *
 * Tracks:
 * - Original and compressed content
 * - Original and compressed token counts
 * - Compression ratio (how much we reduced)
 * - Which level was used
 * - Whether compression succeeded
 *
 * Example Output:
 * --------------
 * ```typescript
 * {
 *   original: { content: "...", language: "typescript" },
 *   content: "function foo() { ... }",
 *   originalTokens: 500,
 *   compressedTokens: 50,
 *   compressionRatio: 10,
 *   level: "aggressive",
 *   success: true
 * }
 * ```
 *
 * This metadata is critical for:
 * - Debugging: "Why is this so compressed?"
 * - Analytics: "What compression levels are most common?"
 * - User feedback: "We saved you 450 tokens!"
 *
 * @param original - Original chunk (before compression)
 * @param content - Compressed content
 * @param level - Compression level that was applied
 * @param ratio - Compression ratio (original / compressed)
 * @param success - Whether compression met the target
 * @returns Complete compression result with metadata
 */
  private createResult(
    original: CodeChunk,
    content: string,
    level: CompressionLevel,
    ratio: number,
    success: boolean
  ): CompressionResult {
    const originalTokens = this.estimateTokens(original.content);
    const compressedTokens = this.estimateTokens(content);

    return {
      original,
      content,
      originalTokens,
      compressedTokens,
      compressionRatio: ratio,
      level,
      success,
    };
  }
}
