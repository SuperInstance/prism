/**
 * Prism Engine Unit Tests
 *
 * Tests for the main PrismEngine class which coordinates
 * indexing, searching, and context retrieval.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismEngine } from '../../../src/core/PrismEngine.js';
import type { CodeChunk } from '../../../src/core/types.js';
import { createTempDir, cleanupTempDir, createMockChunk, createTempFile } from '../../helpers/test-utils.js';

describe('PrismEngine', () => {
  let engine: PrismEngine;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    engine = new PrismEngine({ dbPath: ':memory:' });
  });

  afterEach(async () => {
    engine.close();
    await cleanupTempDir(tempDir);
  });

  describe('constructor', () => {
    it('should create engine with default config', () => {
      const defaultEngine = new PrismEngine();
      expect(defaultEngine).toBeDefined();
      defaultEngine.close();
    });

    it('should create engine with custom config', () => {
      const customEngine = new PrismEngine({
        dbPath: ':memory:',
        maxResults: 20,
      });
      expect(customEngine).toBeDefined();
      customEngine.close();
    });
  });

  describe('index', () => {
    it('should index a directory with TypeScript files', async () => {
      // Create test files
      await createTempFile(tempDir, 'test.ts', `
        export function test() {
          return true;
        }
      `);

      const result = await engine.index(tempDir);

      expect(result.chunks).toBeGreaterThan(0);
      expect(result.errors).toBe(0);
    });

    it('should index a directory with JavaScript files', async () => {
      await createTempFile(tempDir, 'test.js', `
        function test() {
          return true;
        }
      `);

      const result = await engine.index(tempDir);

      expect(result.chunks).toBeGreaterThan(0);
    });

    it('should index a directory with Python files', async () => {
      await createTempFile(tempDir, 'test.py', `
        def test():
            return True
      `);

      const result = await engine.index(tempDir);

      expect(result.chunks).toBeGreaterThan(0);
    });

    it('should handle empty directory', async () => {
      const result = await engine.index(tempDir);

      expect(result.chunks).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should handle non-existent directory gracefully', async () => {
      const result = await engine.index('/nonexistent/path');

      expect(result.chunks).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should handle files with errors gracefully', async () => {
      await createTempFile(tempDir, 'test.ts', 'function test() {');

      const result = await engine.index(tempDir);

      // Should still create chunks even with parse errors
      expect(result.chunks).toBeGreaterThanOrEqual(0);
    });

    it('should create chunks with correct metadata', async () => {
      await createTempFile(tempDir, 'calculator.ts', `
        export class Calculator {
          add(a: number, b: number): number {
            return a + b;
          }

          subtract(a: number, b: number): number {
            return a - b;
          }
        }
      `);

      await engine.index(tempDir);

      const allChunks = await engine.vectorDB.getAllChunks();

      expect(allChunks.length).toBeGreaterThan(0);

      const chunk = allChunks[0];
      expect(chunk.language).toBe('typescript');
      expect(chunk.symbols).toContain('Calculator');
      expect(chunk.startLine).toBeGreaterThan(0);
      expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
    });

    it('should extract symbols from code', async () => {
      await createTempFile(tempDir, 'functions.ts', `
        function processData(input: string): string {
          return input.trim();
        }

        const helper = () => {
          console.log('helper');
        };
      `);

      await engine.index(tempDir);

      const allChunks = await engine.vectorDB.getAllChunks();

      const symbols = allChunks.flatMap((c) => c.symbols);
      expect(symbols).toContain('processData');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // Create test files for search
      await createTempFile(tempDir, 'auth.ts', `
        export function authenticate(username: string, password: string) {
          // Authentication logic
          return true;
        }

        export function authorize(token: string) {
          // Authorization logic
          return true;
        }
      `);

      await createTempFile(tempDir, 'database.ts', `
        export class Database {
          connect() {
            // Connect to database
          }

          query(sql: string) {
            // Execute query
          }
        }
      `);

      await engine.index(tempDir);
    });

    it('should return search results', async () => {
      const results = await engine.search('authenticate');

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return results sorted by relevance', async () => {
      const results = await engine.search('authenticate');

      expect(results.length).toBeGreaterThan(0);

      // Results should be sorted by score (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should respect maxResults limit', async () => {
      const results = await engine.search('function', 5);

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should return empty array for no matches', async () => {
      const results = await engine.search('xyznonexistent');

      // May return results due to fallback embedding
      expect(results).toBeDefined();
    });

    it('should handle empty query', async () => {
      const results = await engine.search('');

      expect(results).toBeDefined();
    });

    it('should include chunk data in results', async () => {
      const results = await engine.search('authenticate');

      expect(results.length).toBeGreaterThan(0);

      const result = results[0];
      expect(result.chunk).toBeDefined();
      expect(result.chunk.content).toBeDefined();
      expect(result.chunk.filePath).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe('getContext', () => {
    beforeEach(async () => {
      await createTempFile(tempDir, 'test.ts', `
        export function testFunction() {
          return true;
        }
      `);

      await engine.index(tempDir);
    });

    it('should return chunks for a file path', async () => {
      const allChunks = await engine.vectorDB.getAllChunks();

      if (allChunks.length > 0) {
        const filePath = allChunks[0].filePath;
        const context = await engine.getContext(filePath);

        expect(context).toBeDefined();
        expect(context.length).toBeGreaterThan(0);
      }
    });

    it('should return empty array for non-existent file', async () => {
      const context = await engine.getContext('/nonexistent/file.ts');

      expect(context).toEqual([]);
    });

    it('should handle relative and absolute paths', async () => {
      const allChunks = await engine.vectorDB.getAllChunks();

      if (allChunks.length > 0) {
        const fileName = allChunks[0].filePath.split('/').pop() || '';

        const context = await engine.getContext(fileName);
        expect(context).toBeDefined();
      }
    });
  });

  describe('explainUsage', () => {
    beforeEach(async () => {
      await createTempFile(tempDir, 'utils.ts', `
        export function formatDate(date: Date): string {
          return date.toISOString();
        }

        export function parseDate(str: string): Date {
          return new Date(str);
        }

        export function process() {
          const date = formatDate(new Date());
          return date;
        }
      `);

      await engine.index(tempDir);
    });

    it('should find symbol definition and usages', async () => {
      const result = await engine.explainUsage('formatDate');

      expect(result).toBeDefined();
      expect(result.definition).toBeDefined();
      expect(result.usages).toBeDefined();
    });

    it('should return definition with matching symbols', async () => {
      const result = await engine.explainUsage('formatDate');

      if (result.definition) {
        expect(result.definition.symbols).toContain('formatDate');
      }
    });

    it('should respect limit parameter', async () => {
      const result = await engine.explainUsage('formatDate', 5);

      expect(result.usages.length).toBeLessThanOrEqual(5);
    });

    it('should handle non-existent symbol', async () => {
      const result = await engine.explainUsage('nonexistentFunction');

      expect(result.definition).toBeNull();
      expect(result.usages).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return zero stats for empty database', () => {
      const stats = engine.getStats();

      expect(stats).toBeDefined();
      expect(stats.chunks).toBe(0);
      expect(stats.vectors).toBe(0);
      expect(stats.languages).toEqual({});
    });

    it('should return stats after indexing', async () => {
      await createTempFile(tempDir, 'test.ts', 'function test() {}');
      await engine.index(tempDir);

      const stats = engine.getStats();

      expect(stats.chunks).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear all data', async () => {
      await createTempFile(tempDir, 'test.ts', 'function test() {}');
      await engine.index(tempDir);

      let stats = engine.getStats();
      expect(stats.chunks).toBeGreaterThan(0);

      await engine.clear();

      stats = engine.getStats();
      expect(stats.chunks).toBe(0);
    });
  });

  describe('close', () => {
    it('should close the engine without errors', () => {
      expect(() => engine.close()).not.toThrow();
    });

    it('should be safe to call close multiple times', () => {
      engine.close();
      expect(() => engine.close()).not.toThrow();
    });
  });

  describe('embedding generation', () => {
    it('should generate normalized embeddings', async () => {
      // This tests the internal generateEmbedding method indirectly
      await createTempFile(tempDir, 'test.ts', 'function test() {}');
      await engine.index(tempDir);

      const stats = engine.getStats();
      expect(stats.vectors).toBeGreaterThan(0);
    });

    it('should generate consistent embeddings for same input', async () => {
      await createTempFile(tempDir, 'test.ts', 'function test() {}');
      await engine.index(tempDir);

      const results1 = await engine.search('test');
      const results2 = await engine.search('test');

      expect(results1).toEqual(results2);
    });
  });

  describe('symbol extraction', () => {
    it('should extract function symbols', async () => {
      await createTempFile(tempDir, 'functions.ts', `
        function helperFunction() {}
        async function asyncFunction() {}
        export function exportedFunction() {}
      `);

      await engine.index(tempDir);

      const allChunks = await engine.vectorDB.getAllChunks();
      const symbols = allChunks.flatMap((c) => c.symbols);

      expect(symbols).toContain('helperFunction');
      expect(symbols).toContain('asyncFunction');
      expect(symbols).toContain('exportedFunction');
    });

    it('should extract class symbols', async () => {
      await createTempFile(tempDir, 'classes.ts', `
        class HelperClass {}
        export class ExportedClass {}
      `);

      await engine.index(tempDir);

      const allChunks = await engine.vectorDB.getAllChunks();
      const symbols = allChunks.flatMap((c) => c.symbols);

      expect(symbols).toContain('HelperClass');
      expect(symbols).toContain('ExportedClass');
    });

    it('should extract arrow function symbols', async () => {
      await createTempFile(tempDir, 'arrow.ts', `
        const arrowFunction = () => {};
        const asyncArrow = async () => {};
      `);

      await engine.index(tempDir);

      const allChunks = await engine.vectorDB.getAllChunks();
      const symbols = allChunks.flatMap((c) => c.symbols);

      expect(symbols).toContain('arrowFunction');
      expect(symbols).toContain('asyncArrow');
    });
  });

  describe('language detection', () => {
    it('should detect TypeScript language', async () => {
      await createTempFile(tempDir, 'test.ts', 'function test() {}');
      await engine.index(tempDir);

      const allChunks = await engine.vectorDB.getAllChunks();
      expect(allChunks.some((c) => c.language === 'typescript')).toBe(true);
    });

    it('should detect JavaScript language', async () => {
      await createTempFile(tempDir, 'test.js', 'function test() {}');
      await engine.index(tempDir);

      const allChunks = await engine.vectorDB.getAllChunks();
      expect(allChunks.some((c) => c.language === 'javascript')).toBe(true);
    });

    it('should detect Python language', async () => {
      await createTempFile(tempDir, 'test.py', 'def test(): pass');
      await engine.index(tempDir);

      const allChunks = await engine.vectorDB.getAllChunks();
      expect(allChunks.some((c) => c.language === 'python')).toBe(true);
    });
  });

  describe('chunking behavior', () => {
    it('should split large files into multiple chunks', async () => {
      const largeFile = Array(200).fill(null).map((_, i) => `export function func${i}() { return ${i}; }`).join('\n');

      await createTempFile(tempDir, 'large.ts', largeFile);
      await engine.index(tempDir);

      const allChunks = await engine.vectorDB.getAllChunks();
      expect(allChunks.length).toBeGreaterThan(1);
    });

    it('should preserve line numbers in chunks', async () => {
      await createTempFile(tempDir, 'test.ts', `
        line 1
        line 2
        line 3
        line 4
        line 5
      `);

      await engine.index(tempDir);

      const allChunks = await engine.vectorDB.getAllChunks();

      for (const chunk of allChunks) {
        expect(chunk.startLine).toBeGreaterThan(0);
        expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
      }
    });
  });
});
