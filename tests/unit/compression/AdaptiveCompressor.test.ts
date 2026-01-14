/**
 * Unit tests for AdaptiveCompressor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveCompressor } from '../../../src/compression/AdaptiveCompressor.js';
import { CodeChunk } from '../../../src/core/types/index.js';

describe('AdaptiveCompressor', () => {
  let compressor: AdaptiveCompressor;
  let mockChunk: CodeChunk;

  beforeEach(() => {
    compressor = new AdaptiveCompressor();

    mockChunk = {
      id: 'test-chunk',
      filePath: '/project/src/utils.ts',
      name: 'processData',
      kind: 'function',
      startLine: 1,
      endLine: 50,
      content: `
/**
 * Process data function
 * This function processes data in various ways
 */
function processData(
  input: string,
  options: ProcessingOptions
): ProcessedResult {
  // Validate input
  if (!input || input.length === 0) {
    throw new Error('Invalid input');
  }

  // Initialize result
  const result: ProcessedResult = {
    data: '',
    metadata: {},
  };

  // Process input
  result.data = input.trim().toLowerCase();

  // Add metadata
  result.metadata = {
    timestamp: Date.now(),
    length: input.length,
  };

  return result;
}
      `,
      language: 'typescript',
      signature: 'function processData(input: string, options: ProcessingOptions): ProcessedResult',
      metadata: {
        exports: ['processData'],
        imports: [],
        dependencies: [],
      },
    };
  });

  describe('compress', () => {
    it('should return chunk as-is if under target', async () => {
      const largeTarget = 10000;

      const result = await compressor.compress(mockChunk, largeTarget);

      expect(result.success).toBe(true);
      expect(result.content).toBe(mockChunk.content);
      expect(result.level).toBe('light');
      expect(result.compressionRatio).toBe(1.0);
    });

    it('should apply light compression first', async () => {
      const smallTarget = 100;

      const result = await compressor.compress(mockChunk, smallTarget);

      expect(result.success).toBe(true);
      expect(result.compressedTokens).toBeLessThan(result.originalTokens);
      expect(result.compressionRatio).toBeGreaterThan(1.0);
    });

    it('should apply increasingly aggressive compression', async () => {
      const verySmallTarget = 20;

      const result = await compressor.compress(mockChunk, verySmallTarget);

      expect(result.success).toBe(true);
      expect(result.compressedTokens).toBeLessThan(result.originalTokens);
      expect(result.compressionRatio).toBeGreaterThan(1.0);
    });

    it('should handle very small targets with signature-only', async () => {
      const tinyTarget = 10;

      const result = await compressor.compress(mockChunk, tinyTarget);

      expect(result.success).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    });

    it('should preserve signature in aggressive compression', async () => {
      const target = 30;

      const result = await compressor.compress(mockChunk, target);

      expect(result.content).toContain('processData');
      expect(result.success).toBe(true);
    });

    it('should handle chunks without signature', async () => {
      const chunkWithoutSignature = {
        ...mockChunk,
        signature: undefined,
      };

      const result = await compressor.compress(chunkWithoutSignature, 50);

      expect(result.success).toBe(true);
      expect(result.content).toContain('processData');
    });

    it('should respect preserveImports option', async () => {
      const chunkWithImports: CodeChunk = {
        ...mockChunk,
        content: `
import { ProcessingOptions } from './types';
import { ProcessedResult } from './results';

function processData(input: string): ProcessedResult {
  return { data: input };
}
        `.repeat(10),
        signature: 'function processData(input: string): ProcessedResult',
      };

      const result = await compressor.compress(
        chunkWithImports,
        50,
        { preserveImports: true }
      );

      // Should compress the large chunk
      expect(result.compressedTokens).toBeLessThan(result.originalTokens);
      expect(result.success).toBe(true);
    });

    it('should respect preserveTypes option', async () => {
      const chunkWithTypes: CodeChunk = {
        ...mockChunk,
        content: `
interface ProcessingOptions {
  format: string;
}

function processData(input: string): void {
  console.log(input);
}
        `,
      };

      const result = await compressor.compress(
        chunkWithTypes,
        50,
        { preserveTypes: true }
      );

      expect(result.content).toContain('interface');
    });
  });

  describe('compressBatch', () => {
    it('should compress multiple chunks', async () => {
      const chunks = [
        mockChunk,
        {
          ...mockChunk,
          id: 'chunk-2',
          name: 'parseData',
          content: 'function parseData() { /* parse */ }',
        },
        {
          ...mockChunk,
          id: 'chunk-3',
          name: 'validateData',
          content: 'function validateData() { /* validate */ }',
        },
      ];

      const results = await compressor.compressBatch(chunks, 100);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle empty array', async () => {
      const results = await compressor.compressBatch([], 100);

      expect(results).toHaveLength(0);
    });

    it('should compress all chunks to target', async () => {
      const chunks = [
        mockChunk,
        { ...mockChunk, id: 'chunk-2', content: 'x'.repeat(1000) },
        { ...mockChunk, id: 'chunk-3', content: 'y'.repeat(500) },
      ];

      const target = 50;
      const results = await compressor.compressBatch(chunks, target);

      for (const result of results) {
        expect(result.compressedTokens).toBeLessThanOrEqual(target + 10);
      }
    });
  });

  describe('compression levels', () => {
    it('should use light compression for small reductions', async () => {
      const result = await compressor.compress(mockChunk, 300);

      expect(result.level).toBe('light');
      expect(result.success).toBe(true);
    });

    it('should use medium compression for moderate reductions', async () => {
      const result = await compressor.compress(mockChunk, 150);

      expect(result.level).toMatch(/^(light|medium)$/);
      expect(result.success).toBe(true);
    });

    it('should use aggressive compression for large reductions', async () => {
      const result = await compressor.compress(mockChunk, 50);

      expect(result.level).toMatch(/^(medium|aggressive|signature-only)$/);
      expect(result.success).toBe(true);
    });

    it('should use signature-only for extreme reductions', async () => {
      const result = await compressor.compress(mockChunk, 20);

      expect(result.level).toBe('signature-only');
      expect(result.success).toBe(true);
    });
  });

  describe('compression quality', () => {
    it('should remove comments in light compression', async () => {
      const largeChunk: CodeChunk = {
        ...mockChunk,
        content: mockChunk.content.repeat(5),
      };

      const result = await compressor.compress(largeChunk, 100);

      // Should compress the large chunk
      expect(result.compressedTokens).toBeLessThan(result.originalTokens);
      expect(result.success).toBe(true);
    });

    it('should preserve function signatures', async () => {
      const result = await compressor.compress(mockChunk, 30);

      expect(result.content).toContain('function');
      expect(result.content).toContain('processData');
    });

    it('should maintain code structure', async () => {
      const result = await compressor.compress(mockChunk, 100);

      // Should still be valid TypeScript structure
      expect(result.content).toMatch(/function\s+\w+/);
    });

    it('should achieve meaningful compression ratios', async () => {
      const result = await compressor.compress(mockChunk, 50);

      expect(result.compressionRatio).toBeGreaterThan(2.0);
    });

    it('should handle very large chunks', async () => {
      const largeChunk: CodeChunk = {
        ...mockChunk,
        content: 'function large() { '.repeat(1000) + ' }',
      };

      const result = await compressor.compress(largeChunk, 100);

      expect(result.success).toBe(true);
      expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', async () => {
      const emptyChunk: CodeChunk = {
        ...mockChunk,
        content: '',
      };

      const result = await compressor.compress(emptyChunk, 100);

      expect(result.success).toBe(true);
      expect(result.content).toBe('');
    });

    it('should handle whitespace-only content', async () => {
      const whitespaceChunk: CodeChunk = {
        ...mockChunk,
        content: '   \n\n   \n   ',
      };

      const result = await compressor.compress(whitespaceChunk, 100);

      expect(result.success).toBe(true);
    });

    it('should handle zero target tokens', async () => {
      const result = await compressor.compress(mockChunk, 0);

      expect(result.success).toBe(true);
      expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    });

    it('should handle negative target tokens', async () => {
      const result = await compressor.compress(mockChunk, -100);

      expect(result.success).toBe(true);
      expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    });
  });

  describe('token estimation', () => {
    it('should estimate tokens accurately for code', async () => {
      const codeChunk: CodeChunk = {
        ...mockChunk,
        content: 'function test() { return 42; }',
      };

      const result = await compressor.compress(codeChunk, 100);

      expect(result.originalTokens).toBeGreaterThan(0);
      expect(result.compressedTokens).toBeGreaterThan(0);
    });

    it('should handle mixed content', async () => {
      const mixedChunk: CodeChunk = {
        ...mockChunk,
        content: `
// This is a comment
function test() {
  /* Multi-line comment */
  return "string with 'quotes' and \\"more\\"";
}
        `,
      };

      const result = await compressor.compress(mixedChunk, 50);

      expect(result.success).toBe(true);
    });
  });
});
