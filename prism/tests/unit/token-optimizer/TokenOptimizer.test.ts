/**
 * Token Optimizer Unit Tests
 *
 * Tests for the TokenOptimizer class which handles
 * token budgeting and code compression.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TokenOptimizer } from '../../../src/token-optimizer/index.js';
import type { CodeChunk, OptimizedPrompt, OptimizerConfig } from '../../../src/token-optimizer/index.js';
import { createMockChunk, createMockChunks } from '../../helpers/test-utils.js';

describe('TokenOptimizer', () => {
  let optimizer: TokenOptimizer;
  let config: OptimizerConfig;

  beforeEach(() => {
    config = {
      maxTokens: 100000,
      targetCompression: 0.7,
      preserveSignatures: true,
    };
    optimizer = new TokenOptimizer(config);
  });

  describe('constructor', () => {
    it('should create optimizer with config', () => {
      const opt = new TokenOptimizer({
        maxTokens: 50000,
        targetCompression: 0.5,
        preserveSignatures: false,
      });

      expect(opt).toBeDefined();
    });

    it('should accept default values', () => {
      const opt = new TokenOptimizer({} as OptimizerConfig);
      expect(opt).toBeDefined();
    });
  });

  describe('optimize', () => {
    it('should return optimized prompt', async () => {
      const prompt = 'Here is some code for context:';
      const chunks = createMockChunks(5);

      const result = await optimizer.optimize(prompt, chunks);

      expect(result).toBeDefined();
      expect(result.prompt).toBeDefined();
      expect(result.originalTokens).toBeGreaterThan(0);
      expect(result.optimizedTokens).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeGreaterThan(0);
    });

    it('should estimate tokens correctly', async () => {
      const prompt = 'This is a test prompt with some text';
      const chunks = createMockChunks(3);

      const result = await optimizer.optimize(prompt, chunks);

      // Rough estimation: ~4 characters per token
      const expectedTokens = Math.ceil(prompt.length / 4);
      expect(result.originalTokens).toBeGreaterThanOrEqual(expectedTokens - 10);
      expect(result.originalTokens).toBeLessThanOrEqual(expectedTokens + 10);
    });

    it('should handle empty prompt', async () => {
      const result = await optimizer.optimize('', []);

      expect(result.prompt).toBe('');
      expect(result.originalTokens).toBe(0);
    });

    it('should handle empty chunks', async () => {
      const result = await optimizer.optimize('test prompt', []);

      expect(result.prompt).toBe('test prompt');
      expect(result.optimizedTokens).toBe(result.originalTokens);
    });

    it('should handle large prompt', async () => {
      const largePrompt = 'x'.repeat(10000);
      const chunks = createMockChunks(10);

      const result = await optimizer.optimize(largePrompt, chunks);

      expect(result.originalTokens).toBeGreaterThan(2000);
    });

    it('should calculate compression ratio', async () => {
      const prompt = 'Test prompt';
      const chunks = createMockChunks(5);

      const result = await optimizer.optimize(prompt, chunks);

      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeLessThanOrEqual(1);
    });
  });

  describe('token estimation', () => {
    it('should estimate tokens for short text', async () => {
      const text = 'hello world';
      const result = await optimizer.optimize(text, []);

      expect(result.originalTokens).toBeGreaterThan(0);
      expect(result.originalTokens).toBeLessThan(10);
    });

    it('should estimate tokens for long text', async () => {
      const text = 'hello world '.repeat(100);
      const result = await optimizer.optimize(text, []);

      expect(result.originalTokens).toBeGreaterThan(100);
    });

    it('should estimate tokens for code', async () => {
      const code = `
        function complexFunction(a: number, b: number): number {
          const result = a + b;
          return result * 2;
        }
      `;

      const result = await optimizer.optimize(code, []);

      expect(result.originalTokens).toBeGreaterThan(10);
    });
  });

  describe('compression behavior', () => {
    it('should not compress when within budget', async () => {
      const shortPrompt = 'test';
      const chunks = createMockChunks(1);

      const result = await optimizer.optimize(shortPrompt, chunks);

      // For now, compression is not implemented
      expect(result.compressionRatio).toBeCloseTo(1.0, 1);
    });

    it('should handle compression target config', async () => {
      const opt = new TokenOptimizer({
        maxTokens: 1000,
        targetCompression: 0.5,
        preserveSignatures: true,
      });

      const result = await opt.optimize('test', createMockChunks(10));

      expect(result).toBeDefined();
    });
  });

  describe('signature preservation', () => {
    it('should respect preserveSignatures config', async () => {
      const opt = new TokenOptimizer({
        maxTokens: 10000,
        targetCompression: 0.7,
        preserveSignatures: true,
      });

      const chunks = [
        createMockChunk({
          content: 'function signature(a: string, b: number): void {}',
        }),
      ];

      const result = await opt.optimize('test', chunks);

      expect(result).toBeDefined();
      // When implemented, signature should be preserved in result.prompt
    });

    it('should work with preserveSignatures false', async () => {
      const opt = new TokenOptimizer({
        maxTokens: 10000,
        targetCompression: 0.7,
        preserveSignatures: false,
      });

      const result = await opt.optimize('test', createMockChunks(5));

      expect(result).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle unicode characters', async () => {
      const prompt = 'Hello 世界 🌍';
      const result = await optimizer.optimize(prompt, []);

      expect(result.originalTokens).toBeGreaterThan(0);
    });

    it('should handle special characters', async () => {
      const prompt = 'Test\n\t\r\b\f';
      const result = await optimizer.optimize(prompt, []);

      expect(result.originalTokens).toBeGreaterThan(0);
    });

    it('should handle very long chunks', async () => {
      const largeChunk = createMockChunk({
        content: 'x'.repeat(100000),
      });

      const result = await optimizer.optimize('test', [largeChunk]);

      expect(result.originalTokens).toBeGreaterThan(10000);
    });

    it('should handle chunks with symbols', async () => {
      const chunkWithSymbols = createMockChunk({
        symbols: ['function1', 'function2', 'class1'],
      });

      const result = await optimizer.optimize('test', [chunkWithSymbols]);

      expect(result).toBeDefined();
    });

    it('should handle chunks with dependencies', async () => {
      const chunkWithDeps = createMockChunk({
        dependencies: ['lodash', 'axios', 'typescript'],
      });

      const result = await optimizer.optimize('test', [chunkWithDeps]);

      expect(result).toBeDefined();
    });
  });

  describe('batch processing', () => {
    it('should handle single chunk', async () => {
      const result = await optimizer.optimize('test', createMockChunks(1));

      expect(result).toBeDefined();
    });

    it('should handle multiple chunks', async () => {
      const result = await optimizer.optimize('test', createMockChunks(50));

      expect(result).toBeDefined();
    });

    it('should handle chunks with different sizes', async () => {
      const chunks = [
        createMockChunk({ content: 'small' }),
        createMockChunk({ content: 'x'.repeat(1000) }),
        createMockChunk({ content: 'medium content here' }),
      ];

      const result = await optimizer.optimize('test', chunks);

      expect(result).toBeDefined();
    });
  });

  describe('performance', () => {
    it('should optimize quickly for small inputs', async () => {
      const start = Date.now();
      await optimizer.optimize('test', createMockChunks(10));
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should optimize quickly for large inputs', async () => {
      const chunks = createMockChunks(100);
      const start = Date.now();
      await optimizer.optimize('test', chunks);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });
});
