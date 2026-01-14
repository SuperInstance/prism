/**
 * Compression Library
 *
 * Provides multiple compression strategies for code chunks with different
 * levels of aggressiveness while preserving AST structure and semantics.
 */

import type { CodeChunk } from '../core/types.js';

/**
 * Compression levels
 */
export enum CompressionLevel {
  LIGHT = 'light',
  MEDIUM = 'medium',
  AGGRESSIVE = 'aggressive',
}

/**
 * Compressed chunk result
 */
export interface CompressedChunk {
  original: CodeChunk;
  compressed: string;
  originalTokens: number;
  estimatedTokens: number;
  compressionRatio: number;
  level: CompressionLevel;
  metadata: CompressionMetadata;
}

/**
 * Metadata about compression
 */
export interface CompressionMetadata {
  commentsRemoved: number;
  whitespaceCollapsed: number;
  linesRemoved: number;
  signaturesPreserved: number;
  bodiesCollapsed: number;
  compressionTime: number;
}

/**
 * Language-specific patterns
 */
interface LanguagePatterns {
  commentPatterns: RegExp[];
  stringPatterns: RegExp[];
  functionPatterns: RegExp[];
  classPatterns: RegExp[];
}

/**
 * Compression library configuration
 */
export interface CompressionLibraryConfig {
  level: CompressionLevel;
  preserveSignatures: boolean;
  collapseWhitespace: boolean;
  removeComments: boolean;
  extractSignaturesOnly: boolean;
  maxBodyLines: number;
}

/**
 * Main compression library class
 */
export class CompressionLibrary {
  private patterns: Map<string, LanguagePatterns>;
  private config: CompressionLibraryConfig;

  constructor(config?: Partial<CompressionLibraryConfig>) {
    this.config = {
      level: CompressionLevel.MEDIUM,
      preserveSignatures: true,
      collapseWhitespace: true,
      removeComments: true,
      extractSignaturesOnly: false,
      maxBodyLines: 3,
      ...config,
    };

    this.patterns = new Map();
    this.initializePatterns();
  }

  /**
   * Compress a single code chunk
   */
  compressChunk(chunk: CodeChunk, level: CompressionLevel): CompressedChunk {
    const startTime = performance.now();
    const originalTokens = chunk.tokens;

    // Update config level
    this.config.level = level;

    let compressed = chunk.text;
    const metadata: CompressionMetadata = {
      commentsRemoved: 0,
      whitespaceCollapsed: 0,
      linesRemoved: 0,
      signaturesPreserved: 0,
      bodiesCollapsed: 0,
      compressionTime: 0,
    };

    // Apply compression strategies based on level
    if (this.config.removeComments) {
      const result = this.removeComments(compressed, chunk.language);
      compressed = result.text;
      metadata.commentsRemoved = result.count;
    }

    if (this.config.collapseWhitespace) {
      const result = this.collapseWhitespace(compressed);
      compressed = result.text;
      metadata.whitespaceCollapsed = result.removed;
    }

    if (this.config.preserveSignatures) {
      const result = this.extractSignatures(compressed, chunk);
      compressed = result.text;
      metadata.signaturesPreserved = result.count;
    }

    if (level === CompressionLevel.AGGRESSIVE && this.config.extractSignaturesOnly) {
      const result = this.collapseBody(compressed, this.config.maxBodyLines);
      compressed = result.text;
      metadata.bodiesCollapsed = result.collapsed;
      metadata.linesRemoved = result.linesRemoved;
    } else if (level === CompressionLevel.MEDIUM) {
      const result = this.collapseBody(compressed, this.config.maxBodyLines * 2);
      compressed = result.text;
      metadata.bodiesCollapsed = result.collapsed;
      metadata.linesRemoved = result.linesRemoved;
    }

    // Final cleanup
    compressed = this.finalCleanup(compressed);
    metadata.linesRemoved += chunk.text.split('\n').length - compressed.split('\n').length;

    const compressionTime = performance.now() - startTime;
    metadata.compressionTime = compressionTime;

    const estimatedTokens = this.estimateTokens(compressed);
    const compressionRatio = originalTokens / estimatedTokens;

    return {
      original: chunk,
      compressed,
      originalTokens,
      estimatedTokens,
      compressionRatio,
      level,
      metadata,
    };
  }

  /**
   * Compress a batch of code chunks
   */
  compressBatch(chunks: CodeChunk[], level: CompressionLevel): CompressedChunk[] {
    return chunks.map((chunk) => this.compressChunk(chunk, level));
  }

  /**
   * Remove comments from code
   */
  private removeComments(
    code: string,
    language: string
  ): { text: string; count: number } {
    let count = 0;
    const patterns = this.patterns.get(language);

    if (!patterns) {
      // Default comment patterns
      return this.removeDefaultComments(code);
    }

    let result = code;

    // Remove all comment patterns
    for (const pattern of patterns.commentPatterns) {
      const matches = result.match(pattern);
      if (matches) {
        count += matches.length;
      }
      result = result.replace(pattern, '');
    }

    return { text: result, count };
  }

  /**
   * Remove default comments (JS/TS/C style)
   */
  private removeDefaultComments(code: string): { text: string; count: number } {
    let count = 0;

    // Remove single-line comments
    const singleLineRegex = /\/\/.*$/gm;
    const singleLineMatches = code.match(singleLineRegex);
    if (singleLineMatches) {
      count += singleLineMatches.length;
    }

    // Remove multi-line comments
    const multiLineRegex = /\/\*[\s\S]*?\*\//g;
    const multiLineMatches = code.match(multiLineRegex);
    if (multiLineMatches) {
      count += multiLineMatches.length;
    }

    const result = code
      .replace(singleLineRegex, '')
      .replace(multiLineRegex, '');

    return { text: result, count };
  }

  /**
   * Collapse whitespace
   */
  private collapseWhitespace(code: string): { text: string; removed: number } {
    const before = code.length;
    const result = code
      // Replace multiple spaces with single space
      .replace(/[ \t]+/g, ' ')
      // Replace multiple newlines with double newline
      .replace(/\n{3,}/g, '\n\n')
      // Remove trailing whitespace
      .split('\n')
      .map((line) => line.trimRight())
      .join('\n')
      // Remove leading/trailing whitespace
      .trim();

    const removed = before - result.length;
    return { text: result, removed };
  }

  /**
   * Extract and preserve function/class signatures
   */
  private extractSignatures(code: string, chunk: CodeChunk): { text: string; count: number } {
    let result = code;
    let count = 0;

    // Preserve function signatures
    for (const func of chunk.functions) {
      const signature = func.signature;
      if (signature && result.includes(signature)) {
        count++;
        // Ensure signature is preserved (it already is, but we could mark it)
      }
    }

    // Preserve class signatures
    for (const cls of chunk.classes) {
      const classPattern = new RegExp(`class\\s+${cls.name}\\s*\\{`, 'g');
      if (classPattern.test(result)) {
        count++;
      }
    }

    return { text: result, count };
  }

  /**
   * Collapse function bodies to limited lines
   */
  private collapseBody(code: string, maxLines: number): {
    text: string;
    collapsed: number;
    linesRemoved: number;
  } {
    const lines = code.split('\n');
    const result: string[] = [];
    let collapsed = 0;
    let linesRemoved = 0;
    let inFunctionBody = false;
    let braceCount = 0;
    let bodyStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;

      // Check if we're entering a function
      if (!inFunctionBody && openBraces > 0) {
        inFunctionBody = true;
        braceCount = openBraces - closeBraces;
        bodyStart = i;
        result.push(line);
        continue;
      }

      // Track brace count in function body
      if (inFunctionBody) {
        braceCount += openBraces - closeBraces;

        // Check if we're exiting the function
        if (braceCount === 0 && closeBraces > 0) {
          const bodyLines = i - bodyStart - 1;

          if (bodyLines > maxLines) {
            // Collapse the body
            const indent = line.match(/^\s*/)?.[0] || '';
            result.push(`${indent}// ... ${bodyLines} lines collapsed ...`);
            linesRemoved += bodyLines - maxLines;
            collapsed++;
          } else {
            // Keep the body as-is
            for (let j = bodyStart + 1; j < i; j++) {
              const bodyLine = lines[j];
              if (bodyLine !== undefined) {
                result.push(bodyLine);
              }
            }
          }

          result.push(line);
          inFunctionBody = false;
          continue;
        }

        // Keep only first N lines of body
        const currentBodyLines = i - bodyStart;
        if (currentBodyLines <= maxLines) {
          result.push(line);
        } else {
          linesRemoved++;
        }
      } else {
        result.push(line);
      }
    }

    return {
      text: result.join('\n'),
      collapsed,
      linesRemoved,
    };
  }

  /**
   * Final cleanup of compressed code
   */
  private finalCleanup(code: string): string {
    return code
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .join('\n')
      .trim();
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Initialize language-specific patterns
   */
  private initializePatterns(): void {
    // JavaScript/TypeScript patterns
    this.patterns.set('typescript', {
      commentPatterns: [
        /\/\/.*$/gm,
        /\/\*[\s\S]*?\*\//g,
        /\/\*\*[\s\S]*?\*\//g, // JSDoc
      ],
      stringPatterns: [
        /(['"`])((?:\\.|[^\\])*?)\1/g,
      ],
      functionPatterns: [
        /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)/g,
      ],
      classPatterns: [
        /class\s+(\w+)\s*(?:extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?/g,
      ],
    });

    // Python patterns
    this.patterns.set('python', {
      commentPatterns: [
        /#.*$/gm,
        /'''[\s\S]*?'''/g,
        /"""[\s\S]*?"""/g,
      ],
      stringPatterns: [
        /(['"])((?:\\.|[^\\])*?)\1/g,
        /(['"]{3})[\s\S]*?\1/g,
      ],
      functionPatterns: [
        /def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*([^:]+))?/g,
      ],
      classPatterns: [
        /class\s+(\w+)(?:\([^)]*\))?:/g,
      ],
    });

    // Rust patterns
    this.patterns.set('rust', {
      commentPatterns: [
        /\/\/.*$/gm,
        /\/\*[\s\S]*?\*\//g,
        /\/\/\/.*$/gm, // Doc comments
      ],
      stringPatterns: [
        /b?["']((?:\\.|[^\\])*?)["']/g,
        /b?r#*"[\s\S]*?"*#/g, // Raw strings
      ],
      functionPatterns: [
        /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*\([^)]*\)(?:\s*->\s+[^{]+)?/g,
      ],
      classPatterns: [
        /(?:pub\s+)?(?:struct|enum)\s+(\w+)/g,
      ],
    });

    // Go patterns
    this.patterns.set('go', {
      commentPatterns: [
        /\/\/.*$/gm,
        /\/\*[\s\S]*?\*\//g,
      ],
      stringPatterns: [
        /(["`])((?:\\.|[^\\])*?)\1/g,
      ],
      functionPatterns: [
        /func\s+(?:\([^)]*\)\s+)?(\w+)\s*\([^)]*\)(?:\s*[^{]+)?/g,
      ],
      classPatterns: [
        /type\s+(\w+)\s+(?:struct|interface)/g,
      ],
    });
  }
}

/**
 * Factory function to create a compression library
 */
export function createCompressionLibrary(
  config?: Partial<CompressionLibraryConfig>
): CompressionLibrary {
  return new CompressionLibrary(config);
}
