/**
 * Integration tests for service interactions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigurationService } from '../../src/config/ConfigurationService.js';
import { FileSystemService } from '../../src/core/services/FileSystem.js';
import { MemoryVectorDB } from '../../src/vector-db/MemoryVectorDB.js';
import { SimpleTokenCounter } from '../../src/token-optimizer/SimpleTokenCounter.js';
import { ModelRouter } from '../../src/model-router/ModelRouter.js';
import type { CodeChunk } from '../../src/core/types/index.js';

describe('Service Integration', () => {
  describe('Configuration + File System', () => {
    it('should load config and use file service', async () => {
      const configService = new ConfigurationService();
      const fileService = new FileSystemService();

      const config = await configService.load();

      expect(config.indexing.include).toBeDefined();
      expect(config.indexing.exclude).toBeDefined();

      // Test that file service can use config values
      const testFile = '/path/to/test.ts';
      expect(fileService.isSourceFile(testFile)).toBe(true);
      expect(fileService.getLanguage(testFile)).toBe('typescript');
    });
  });

  describe('Token Counter + Model Router', () => {
    it('should estimate tokens and route to appropriate model', () => {
      const tokenCounter = new SimpleTokenCounter();
      const modelRouter = new ModelRouter({
        anthropicApiKey: 'test-key',
      });

      const shortQuery = 'what is a function';
      const longQuery = `
        Design a scalable microservice architecture for an e-commerce platform
        that needs to handle 10k requests per second with millisecond latency.
        Include considerations for data consistency, fault tolerance, and eventual consistency.
        Implement async message queues and circuit breakers for resilience.
      `;

      const shortTokens = tokenCounter.estimate(shortQuery);
      const longTokens = tokenCounter.estimate(longQuery);

      expect(shortTokens).toBeLessThan(longTokens);

      const shortChoice = modelRouter.selectModel(shortTokens, modelRouter.getComplexity(shortQuery));
      const longChoice = modelRouter.selectModel(longTokens, modelRouter.getComplexity(longQuery));

      expect(shortChoice).toBeDefined();
      expect(longChoice).toBeDefined();

      // Longer query should likely route to a more capable model
      expect(longChoice.estimatedCost).toBeGreaterThanOrEqual(shortChoice.estimatedCost);
    });
  });

  describe('Vector DB + Token Counter', () => {
    it('should store chunks and estimate context size', async () => {
      const db = new MemoryVectorDB();
      const tokenCounter = new SimpleTokenCounter();

      const chunks: CodeChunk[] = [
        {
          id: 'chunk1',
          filePath: '/src/test.ts',
          name: 'function1',
          kind: 'function',
          startLine: 1,
          endLine: 10,
          content: 'function test() { return true; }',
          language: 'typescript',
          embedding: Array(384).fill(0.1),
          metadata: {
            exports: [],
            imports: [],
            dependencies: [],
          },
        },
        {
          id: 'chunk2',
          filePath: '/src/test2.ts',
          name: 'function2',
          kind: 'function',
          startLine: 1,
          endLine: 20,
          content: 'async function fetchData() { return await fetch("/api"); }',
          language: 'typescript',
          embedding: Array(384).fill(0.2),
          metadata: {
            exports: [],
            imports: [],
            dependencies: [],
          },
        },
      ];

      await db.insertBatch(chunks);

      // Estimate tokens for context
      const contextText = chunks.map((c) => c.content).join('\n');
      const estimatedTokens = tokenCounter.estimate(contextText);

      expect(estimatedTokens).toBeGreaterThan(0);

      // Verify chunks are searchable
      const results = await db.search(Array(384).fill(0.15), { limit: 10 });
      expect(results.chunks.length).toBe(2);
    });
  });

  describe('Full Pipeline Integration', () => {
    it('should integrate all services for a complete workflow', async () => {
      // Setup services
      const configService = new ConfigurationService();
      const tokenCounter = new SimpleTokenCounter();
      const modelRouter = new ModelRouter({
        anthropicApiKey: 'test-key',
      });
      const db = new MemoryVectorDB();

      // Load configuration
      const config = await configService.load();
      expect(config).toBeDefined();

      // Simulate indexing code
      const codeChunk: CodeChunk = {
        id: 'test-func',
        filePath: '/src/utils/helpers.ts',
        name: 'formatDate',
        kind: 'function',
        startLine: 1,
        endLine: 15,
        content: `
          export function formatDate(date: Date, format: string): string {
            const options: Intl.DateTimeFormatOptions = {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            };
            return date.toLocaleDateString('en-US', options);
          }
        `,
        language: 'typescript',
        embedding: Array(384).fill(0.3).map((v, i) => v + i * 0.001),
        metadata: {
          exports: ['formatDate'],
          imports: [],
          dependencies: [],
        },
      };

      await db.insert(codeChunk);

      // Simulate query
      const query = 'How do I format dates in TypeScript?';
      const queryTokens = tokenCounter.estimate(query);
      const queryComplexity = modelRouter.getComplexity(query);

      // Select model
      const modelChoice = modelRouter.selectModel(queryTokens, queryComplexity);
      expect(modelChoice).toBeDefined();

      // Search for relevant code
      const searchResults = await db.search(codeChunk.embedding!, {
        limit: config.optimization.maxChunks,
        minRelevance: config.optimization.minRelevance,
      });

      expect(searchResults.chunks.length).toBeGreaterThan(0);

      // Calculate total context tokens
      const contextTokens = tokenCounter.estimate(
        searchResults.chunks.map((c) => c.content).join('\n')
      );

      const totalTokens = queryTokens + contextTokens;

      // Verify within budget
      expect(totalTokens).toBeLessThanOrEqual(config.optimization.tokenBudget);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle missing embeddings gracefully', async () => {
      const db = new MemoryVectorDB();
      const tokenCounter = new SimpleTokenCounter();

      const chunkWithoutEmbedding: CodeChunk = {
        id: 'no-embedding',
        filePath: '/src/test.ts',
        name: 'test',
        kind: 'function',
        startLine: 1,
        endLine: 5,
        content: 'function test() {}',
        language: 'typescript',
        metadata: {
          exports: [],
          imports: [],
          dependencies: [],
        },
      };

      await expect(db.insert(chunkWithoutEmbedding)).rejects.toThrow();
    });

    it('should handle empty searches', async () => {
      const db = new MemoryVectorDB();

      // Empty query should return empty results, not throw
      const results = await db.search([], { limit: 10 });

      expect(results.chunks).toEqual([]);
      expect(results.totalEvaluated).toBe(0);
      expect(results.searchTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle token counter edge cases', () => {
      const tokenCounter = new SimpleTokenCounter();

      expect(tokenCounter.estimate('')).toBe(0);
      expect(tokenCounter.estimateBatch([])).toEqual([]);
    });
  });

  describe('Performance Integration', () => {
    it('should handle batch operations efficiently', async () => {
      const db = new MemoryVectorDB();
      const tokenCounter = new SimpleTokenCounter();

      // Create many chunks
      const chunks: CodeChunk[] = Array.from({ length: 100 }, (_, i) => ({
        id: `chunk-${i}`,
        filePath: `/src/file${i}.ts`,
        name: `function${i}`,
        kind: 'function' as const,
        startLine: 1,
        endLine: 10,
        content: `function test${i}() { return ${i}; }`,
        language: 'typescript',
        embedding: Array(384).fill(0).map(() => Math.random()),
        metadata: {
          exports: [],
          imports: [],
          dependencies: [],
        },
      }));

      const insertStart = performance.now();
      await db.insertBatch(chunks);
      const insertTime = performance.now() - insertStart;

      // Batch insert should be reasonably fast
      expect(insertTime).toBeLessThan(1000);

      // Search should also be fast
      const searchStart = performance.now();
      const results = await db.search(Array(384).fill(0.5), { limit: 10 });
      const searchTime = performance.now() - searchStart;

      expect(results.chunks.length).toBe(10);
      expect(searchTime).toBeLessThan(500);

      // Token estimation should be fast
      const tokenStart = performance.now();
      const tokenCounts = tokenCounter.estimateBatch(
        chunks.slice(0, 10).map((c) => c.content)
      );
      const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);
      const tokenTime = performance.now() - tokenStart;

      expect(totalTokens).toBeGreaterThan(0);
      expect(tokenTime).toBeLessThan(100);
    });
  });
});
