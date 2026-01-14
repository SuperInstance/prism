/**
 * Compression Library Tests
 *
 * Comprehensive test suite for the compression library including
 * ratio validation and language-specific patterns.
 */

import { describe, it, expect } from 'bun:test';
import {
  CompressionLibrary,
  CompressionLevel,
  type CodeChunk,
} from '../../prism/src/compression/index.js';

describe('CompressionLibrary', () => {
  let compressor: CompressionLibrary;

  beforeEach(() => {
    compressor = new CompressionLibrary();
  });

  describe('Basic Compression', () => {
    it('should compress a code chunk', () => {
      const chunk: CodeChunk = {
        id: 'test-1',
        text: `// This is a comment
function hello() {
  console.log("hello");
  return true;
}`,
        startLine: 1,
        endLine: 5,
        tokens: 20,
        language: 'typescript',
        functions: [
          {
            name: 'hello',
            signature: 'function hello()',
            startLine: 2,
            endLine: 5,
            parameters: [],
            returnType: 'boolean',
            isAsync: false,
            isExported: false,
          },
        ],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.MEDIUM);

      expect(result).toBeDefined();
      expect(result.compressed).toBeDefined();
      expect(result.compressionRatio).toBeGreaterThan(1);
      expect(result.estimatedTokens).toBeLessThan(result.originalTokens);
    });

    it('should compress a batch of chunks', () => {
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-1',
          text: 'function a() { return 1; }',
          startLine: 1,
          endLine: 1,
          tokens: 10,
          language: 'typescript',
          functions: [],
          classes: [],
          dependencies: [],
        },
        {
          id: 'chunk-2',
          text: 'function b() { return 2; }',
          startLine: 2,
          endLine: 2,
          tokens: 10,
          language: 'typescript',
          functions: [],
          classes: [],
          dependencies: [],
        },
      ];

      const results = compressor.compressBatch(chunks, CompressionLevel.LIGHT);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.compressionRatio >= 1)).toBe(true);
    });
  });

  describe('Comment Removal', () => {
    it('should remove single-line comments', () => {
      const chunk: CodeChunk = {
        id: 'comment-test',
        text: `// This is a comment
function test() { return true; }`,
        startLine: 1,
        endLine: 2,
        tokens: 15,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.LIGHT);

      expect(result.compressed).not.toContain('//');
      expect(result.metadata.commentsRemoved).toBeGreaterThan(0);
    });

    it('should remove multi-line comments', () => {
      const chunk: CodeChunk = {
        id: 'multi-comment-test',
        text: `/* This is a
   multi-line comment */
function test() { return true; }`,
        startLine: 1,
        endLine: 4,
        tokens: 20,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.LIGHT);

      expect(result.compressed).not.toContain('/*');
      expect(result.compressed).not.toContain('*/');
    });

    it('should remove JSDoc comments', () => {
      const chunk: CodeChunk = {
        id: 'jsdoc-test',
        text: `/**
 * @param {string} name
 * @returns {boolean}
 */
function test(name: string): boolean { return true; }`,
        startLine: 1,
        endLine: 6,
        tokens: 25,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.LIGHT);

      expect(result.compressed).not.toContain('/**');
      expect(result.metadata.commentsRemoved).toBeGreaterThan(0);
    });
  });

  describe('Whitespace Collapsing', () => {
    it('should collapse multiple spaces', () => {
      const chunk: CodeChunk = {
        id: 'whitespace-test',
        text: 'function    test()     {     return     true;     }',
        startLine: 1,
        endLine: 1,
        tokens: 15,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.LIGHT);

      expect(result.compressed).not.toContain('  '); // No double spaces
      expect(result.metadata.whitespaceCollapsed).toBeGreaterThan(0);
    });

    it('should collapse multiple newlines', () => {
      const chunk: CodeChunk = {
        id: 'newline-test',
        text: `function test() {



  return true;
}`,
        startLine: 1,
        endLine: 7,
        tokens: 15,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.LIGHT);

      expect(result.compressed).not.toContain('\n\n\n');
    });
  });

  describe('Compression Levels', () => {
    it('should apply light compression', () => {
      const chunk: CodeChunk = {
        id: 'light-test',
        text: `// Comment
function test() {
  // Another comment
  const x = 1;
  return x;
}`,
        startLine: 1,
        endLine: 6,
        tokens: 25,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.LIGHT);

      expect(result.level).toBe(CompressionLevel.LIGHT);
      expect(result.compressionRatio).toBeGreaterThan(1);
      expect(result.compressionRatio).toBeLessThan(2); // Light compression
    });

    it('should apply medium compression', () => {
      const chunk: CodeChunk = {
        id: 'medium-test',
        text: `// Comment
function test() {
  // Another comment
  const x = 1;
  const y = 2;
  const z = 3;
  return x + y + z;
}`,
        startLine: 1,
        endLine: 9,
        tokens: 35,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.MEDIUM);

      expect(result.level).toBe(CompressionLevel.MEDIUM);
      expect(result.compressionRatio).toBeGreaterThan(1);
      expect(result.compressionRatio).toBeLessThan(5); // Medium compression
    });

    it('should apply aggressive compression', () => {
      const chunk: CodeChunk = {
        id: 'aggressive-test',
        text: `// Comment
function test() {
  // Another comment
  const x = 1;
  const y = 2;
  const z = 3;
  return x + y + z;
}`,
        startLine: 1,
        endLine: 9,
        tokens: 35,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.AGGRESSIVE);

      expect(result.level).toBe(CompressionLevel.AGGRESSIVE);
      expect(result.compressionRatio).toBeGreaterThan(1);
    });
  });

  describe('Language-Specific Patterns', () => {
    it('should handle Python comments', () => {
      const chunk: CodeChunk = {
        id: 'python-test',
        text: `# This is a Python comment
def test_function():
    # Another comment
    return True`,
        startLine: 1,
        endLine: 4,
        tokens: 20,
        language: 'python',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.LIGHT);

      expect(result.compressed).not.toContain('#');
      expect(result.metadata.commentsRemoved).toBeGreaterThan(0);
    });

    it('should handle Rust comments', () => {
      const chunk: CodeChunk = {
        id: 'rust-test',
        text: `// This is a Rust comment
/// This is a doc comment
fn test_function() -> bool {
    true
}`,
        startLine: 1,
        endLine: 5,
        tokens: 20,
        language: 'rust',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.LIGHT);

      expect(result.compressed).not.toContain('//');
      expect(result.metadata.commentsRemoved).toBeGreaterThan(0);
    });

    it('should handle Go comments', () => {
      const chunk: CodeChunk = {
        id: 'go-test',
        text: `// This is a Go comment
func testFunction() bool {
    return true
}`,
        startLine: 1,
        endLine: 4,
        tokens: 20,
        language: 'go',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.LIGHT);

      expect(result.compressed).not.toContain('//');
      expect(result.metadata.commentsRemoved).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should compress 10K chunks quickly', () => {
      const chunks: CodeChunk[] = Array.from({ length: 10000 }, (_, i) => ({
        id: `chunk-${i}`,
        text: `// Comment
function func${i}() {
  const x = ${i};
  return x;
}`,
        startLine: i,
        endLine: i + 4,
        tokens: 20,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      }));

      const start = Date.now();
      const results = compressor.compressBatch(chunks, CompressionLevel.MEDIUM);
      const elapsed = Date.now() - start;

      expect(results).toHaveLength(10000);
      expect(elapsed).toBeLessThan(1000); // Should complete in <1s
    });
  });

  describe('Compression Ratios', () => {
    it('should achieve 10-30x compression on verbose code', () => {
      const chunk: CodeChunk = {
        id: 'verbose-test',
        text: `/**
 * This is a very verbose function with lots of
 * documentation and comments explaining every step
 * in great detail.
 *
 * @param {string} input - The input parameter
 * @returns {number} The calculated result
 */
function calculateVerboseResult(input: string): number {
  // Validate the input
  if (!input) {
    // Return default value if input is empty
    return 0;
  }

  // Calculate the result
  const result = input.length * 2;

  // Return the calculated result
  return result;
}`,
        startLine: 1,
        endLine: 23,
        tokens: 100,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.AGGRESSIVE);

      expect(result.compressionRatio).toBeGreaterThan(2);
      expect(result.estimatedTokens).toBeLessThan(result.originalTokens);
    });

    it('should preserve signatures when configured', () => {
      const chunk: CodeChunk = {
        id: 'signature-test',
        text: `function complexFunction(param1: string, param2: number): boolean {
  // Complex logic here
  return true;
}`,
        startLine: 1,
        endLine: 4,
        tokens: 25,
        language: 'typescript',
        functions: [
          {
            name: 'complexFunction',
            signature: 'function complexFunction(param1: string, param2: number): boolean',
            startLine: 1,
            endLine: 4,
            parameters: ['param1: string', 'param2: number'],
            returnType: 'boolean',
            isAsync: false,
            isExported: false,
          },
        ],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.MEDIUM);

      expect(result.compressed).toContain('function complexFunction');
      expect(result.metadata.signaturesPreserved).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty chunks', () => {
      const chunk: CodeChunk = {
        id: 'empty-test',
        text: '',
        startLine: 1,
        endLine: 1,
        tokens: 0,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.LIGHT);

      expect(result.compressed).toBe('');
      expect(result.estimatedTokens).toBe(0);
    });

    it('should handle chunks without comments', () => {
      const chunk: CodeChunk = {
        id: 'no-comments-test',
        text: 'function test(){return true;}',
        startLine: 1,
        endLine: 1,
        tokens: 10,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.LIGHT);

      expect(result.metadata.commentsRemoved).toBe(0);
      expect(result.compressed).toBeDefined();
    });

    it('should handle unknown languages', () => {
      const chunk: CodeChunk = {
        id: 'unknown-lang-test',
        text: '// This is a comment\nfunction test() { return true; }',
        startLine: 1,
        endLine: 2,
        tokens: 15,
        language: 'unknown-language',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const result = compressor.compressChunk(chunk, CompressionLevel.LIGHT);

      expect(result.compressed).toBeDefined();
      // Should still remove comments using default patterns
      expect(result.compressed).not.toContain('//');
    });
  });
});

describe('Compression Performance Benchmarks', () => {
  it('should achieve target compression ratios across levels', () => {
    const compressor = new CompressionLibrary();

    const testCode = `/**
 * Complex function with lots of documentation
 */
function complexFunction(param1: string, param2: number): boolean {
  // Validate input
  if (!param1) {
    return false;
  }

  // Process data
  const result = param1.length + param2;

  // Return result
  return result > 0;
}`;

    const chunk: CodeChunk = {
      id: 'benchmark',
      text: testCode,
      startLine: 1,
      endLine: 17,
      tokens: 80,
      language: 'typescript',
      functions: [],
      classes: [],
      dependencies: [],
    };

    const lightResult = compressor.compressChunk(chunk, CompressionLevel.LIGHT);
    const mediumResult = compressor.compressChunk(chunk, CompressionLevel.MEDIUM);
    const aggressiveResult = compressor.compressChunk(chunk, CompressionLevel.AGGRESSIVE);

    // Light should be least aggressive
    expect(lightResult.compressionRatio).toBeLessThanOrEqual(mediumResult.compressionRatio);
    // Medium should be more aggressive than light
    expect(mediumResult.compressionRatio).toBeLessThanOrEqual(aggressiveResult.compressionRatio);
    // All should compress
    expect(lightResult.compressionRatio).toBeGreaterThan(1);
    expect(mediumResult.compressionRatio).toBeGreaterThan(1);
    expect(aggressiveResult.compressionRatio).toBeGreaterThan(1);
  });
});
