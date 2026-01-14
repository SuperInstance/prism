/**
 * Scoring Service Unit Tests
 *
 * Tests for the ScoringService class which handles
 * relevance scoring and ranking of code chunks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScoringService } from '../../../src/scoring/ScoringService.js';
import type {
  CodeChunk,
  QueryEmbedding,
  ScoringContext,
  IScorer,
  PrismConfig,
} from '../../../src/scoring/ScoringService.js';
import { createMockChunk, createMockChunks } from '../../helpers/test-utils.js';

describe('ScoringService', () => {
  let service: ScoringService;
  let mockConfig: PrismConfig;
  let testChunks: CodeChunk[];
  let testQuery: QueryEmbedding;
  let testContext: ScoringContext;

  beforeEach(() => {
    mockConfig = {
      indexer: {
        chunkSize: 500,
        overlap: 50,
        languages: ['typescript'],
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
      },
      vectorDB: {
        type: 'sqlite',
        path: ':memory:',
      },
      tokenOptimizer: {
        maxTokens: 100000,
        targetCompression: 0.7,
        preserveSignatures: true,
      },
      modelRouter: {
        preferLocal: false,
        localEndpoint: 'http://localhost:11434',
      },
    };

    service = new ScoringService(mockConfig);
    testChunks = createMockChunks(10);
    testQuery = {
      vector: Array(384).fill(0).map(() => Math.random()),
      text: 'test query',
      timestamp: Date.now(),
    };
    testContext = {
      currentFile: '/test/current.ts',
      currentDirectory: '/test',
      recentFiles: ['/test/file1.ts', '/test/file2.ts'],
      timestamp: Date.now(),
    };
  });

  afterEach(async () => {
    await service.cleanup();
  });

  describe('constructor', () => {
    it('should create service with default config', () => {
      const svc = new ScoringService(mockConfig);
      expect(svc).toBeDefined();
      svc.cleanup();
    });

    it('should create service with custom config', () => {
      const svc = new ScoringService(mockConfig, {
        enableCache: false,
        cacheSize: 100,
        parallelism: 2,
      });
      expect(svc).toBeDefined();
      svc.cleanup();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await service.initialize();
      // Should not throw
    });

    it('should be idempotent', async () => {
      await service.initialize();
      await service.initialize();
      // Should not throw
    });

    it('should initialize scorer plugins', async () => {
      const mockScorer: IScorer = {
        name: 'test-scorer',
        weight: 1.0,
        initialize: async () => {
          // Mock initialization
        },
        calculate: async () => 0.5,
      };

      service.registerScorer(mockScorer);
      await service.initialize();
      // Should not throw
    });
  });

  describe('registerScorer', () => {
    it('should register a scorer', () => {
      const mockScorer: IScorer = {
        name: 'test-scorer',
        weight: 1.0,
        calculate: async () => 0.5,
      };

      service.registerScorer(mockScorer);
      // Should not throw
    });

    it('should allow multiple scorers', () => {
      const scorer1: IScorer = {
        name: 'scorer1',
        weight: 0.5,
        calculate: async () => 0.3,
      };
      const scorer2: IScorer = {
        name: 'scorer2',
        weight: 0.5,
        calculate: async () => 0.7,
      };

      service.registerScorer(scorer1);
      service.registerScorer(scorer2);
      // Should not throw
    });
  });

  describe('unregisterScorer', () => {
    it('should unregister a scorer', async () => {
      const mockScorer: IScorer = {
        name: 'test-scorer',
        weight: 1.0,
        calculate: async () => 0.5,
        cleanup: async () => {
          // Mock cleanup
        },
      };

      service.registerScorer(mockScorer);
      service.unregisterScorer('test-scorer');
      // Should not throw
    });

    it('should handle unregistering non-existent scorer', () => {
      service.unregisterScorer('non-existent');
      // Should not throw
    });
  });

  describe('calculateRelevance', () => {
    beforeEach(async () => {
      // Register a test scorer
      const mockScorer: IScorer = {
        name: 'semantic',
        weight: 1.0,
        calculate: async () => 0.7,
      };

      service.registerScorer(mockScorer);
      await service.initialize();
    });

    it('should calculate relevance score', async () => {
      const chunk = testChunks[0];
      const score = await service.calculateRelevance(chunk, testQuery, testContext);

      expect(score).toBeDefined();
      expect(score.total).toBeGreaterThan(0);
      expect(score.total).toBeLessThanOrEqual(1);
    });

    it('should include score breakdown', async () => {
      const chunk = testChunks[0];
      const score = await service.calculateRelevance(chunk, testQuery, testContext);

      expect(score.semantic).toBeDefined();
      expect(score.symbolMatch).toBeDefined();
      expect(score.fileProximity).toBeDefined();
      expect(score.recency).toBeDefined();
      expect(score.usageFrequency).toBeDefined();
      expect(score.metadata).toBeDefined();
    });

    it('should use cache when enabled', async () => {
      const chunk = testChunks[0];

      const score1 = await service.calculateRelevance(chunk, testQuery, testContext);
      const score2 = await service.calculateRelevance(chunk, testQuery, testContext);

      expect(score1.total).toBe(score2.total);
    });

    it('should handle different chunks', async () => {
      const score1 = await service.calculateRelevance(testChunks[0], testQuery, testContext);
      const score2 = await service.calculateRelevance(testChunks[1], testQuery, testContext);

      expect(score1.total).toBeGreaterThan(0);
      expect(score2.total).toBeGreaterThan(0);
    });

    it('should handle different queries', async () => {
      const chunk = testChunks[0];
      const query1: QueryEmbedding = {
        vector: testQuery.vector,
        text: 'query 1',
        timestamp: Date.now(),
      };
      const query2: QueryEmbedding = {
        vector: testQuery.vector,
        text: 'query 2',
        timestamp: Date.now(),
      };

      const score1 = await service.calculateRelevance(chunk, query1, testContext);
      const score2 = await service.calculateRelevance(chunk, query2, testContext);

      expect(score1.total).toBeGreaterThan(0);
      expect(score2.total).toBeGreaterThan(0);
    });
  });

  describe('scoreBatch', () => {
    beforeEach(async () => {
      const mockScorer: IScorer = {
        name: 'semantic',
        weight: 1.0,
        calculate: async () => Math.random(),
      };

      service.registerScorer(mockScorer);
      await service.initialize();
    });

    it('should score multiple chunks', async () => {
      const results = await service.scoreBatch(testChunks, testQuery, testContext);

      expect(results).toHaveLength(testChunks.length);
    });

    it('should rank results by score', async () => {
      const results = await service.scoreBatch(testChunks, testQuery, testContext);

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score.total).toBeGreaterThanOrEqual(results[i].score.total);
      }
    });

    it('should assign ranks', async () => {
      const results = await service.scoreBatch(testChunks, testQuery, testContext);

      results.forEach((result, index) => {
        expect(result.rank).toBe(index + 1);
      });
    });

    it('should handle empty batch', async () => {
      const results = await service.scoreBatch([], testQuery, testContext);

      expect(results).toEqual([]);
    });

    it('should handle single chunk', async () => {
      const results = await service.scoreBatch([testChunks[0]], testQuery, testContext);

      expect(results).toHaveLength(1);
      expect(results[0].rank).toBe(1);
    });

    it('should handle large batch', async () => {
      const largeBatch = createMockChunks(100);
      const results = await service.scoreBatch(largeBatch, testQuery, testContext);

      expect(results).toHaveLength(100);
    });
  });

  describe('getMetrics', () => {
    beforeEach(async () => {
      const mockScorer: IScorer = {
        name: 'test',
        weight: 1.0,
        calculate: async () => 0.5,
      };

      service.registerScorer(mockScorer);
      await service.initialize();
    });

    it('should return metrics', async () => {
      await service.calculateRelevance(testChunks[0], testQuery, testContext);

      const metrics = service.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalChunksScored).toBeGreaterThan(0);
      expect(metrics.averageTimePerChunk).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.scorerPerformance).toBeDefined();
    });

    it('should track scored chunks', async () => {
      await service.calculateRelevance(testChunks[0], testQuery, testContext);
      await service.calculateRelevance(testChunks[1], testQuery, testContext);

      const metrics = service.getMetrics();

      expect(metrics.totalChunksScored).toBeGreaterThanOrEqual(2);
    });
  });

  describe('resetMetrics', () => {
    it('should reset metrics', async () => {
      const mockScorer: IScorer = {
        name: 'test',
        weight: 1.0,
        calculate: async () => 0.5,
      };

      service.registerScorer(mockScorer);
      await service.initialize();

      await service.calculateRelevance(testChunks[0], testQuery, testContext);

      service.resetMetrics();

      const metrics = service.getMetrics();
      expect(metrics.totalChunksScored).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('should clear cache', async () => {
      const mockScorer: IScorer = {
        name: 'test',
        weight: 1.0,
        calculate: async () => 0.5,
      };

      service.registerScorer(mockScorer);
      await service.initialize();

      await service.calculateRelevance(testChunks[0], testQuery, testContext);
      service.clearCache();

      // Should not throw
    });
  });

  describe('cleanup', () => {
    it('should cleanup service', async () => {
      const mockScorer: IScorer = {
        name: 'test',
        weight: 1.0,
        calculate: async () => 0.5,
        cleanup: async () => {
          // Mock cleanup
        },
      };

      service.registerScorer(mockScorer);
      await service.initialize();
      await service.cleanup();

      // Should not throw
    });

    it('should be idempotent', async () => {
      await service.initialize();
      await service.cleanup();
      await service.cleanup();

      // Should not throw
    });
  });

  describe('cache behavior', () => {
    it('should cache scores', async () => {
      const svc = new ScoringService(mockConfig, {
        enableCache: true,
        cacheSize: 100,
        cacheTTL: 1000,
      });

      const mockScorer: IScorer = {
        name: 'test',
        weight: 1.0,
        calculate: async () => Math.random(),
      };

      svc.registerScorer(mockScorer);
      await svc.initialize();

      const chunk = testChunks[0];
      const score1 = await svc.calculateRelevance(chunk, testQuery, testContext);
      const score2 = await svc.calculateRelevance(chunk, testQuery, testContext);

      expect(score1.total).toBe(score2.total);

      await svc.cleanup();
    });

    it('should expire cache', async () => {
      const svc = new ScoringService(mockConfig, {
        enableCache: true,
        cacheSize: 100,
        cacheTTL: 10, // 10ms TTL
      });

      const mockScorer: IScorer = {
        name: 'test',
        weight: 1.0,
        calculate: async () => Math.random(),
      };

      svc.registerScorer(mockScorer);
      await svc.initialize();

      const chunk = testChunks[0];

      await svc.calculateRelevance(chunk, testQuery, testContext);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      // This should calculate new score
      await svc.calculateRelevance(chunk, testQuery, testContext);

      await svc.cleanup();
    });
  });

  describe('parallel processing', () => {
    it('should process chunks in parallel', async () => {
      const svc = new ScoringService(mockConfig, {
        parallelism: 4,
      });

      const mockScorer: IScorer = {
        name: 'test',
        weight: 1.0,
        calculate: async () => Math.random(),
      };

      svc.registerScorer(mockScorer);
      await svc.initialize();

      const start = Date.now();
      await svc.scoreBatch(testChunks, testQuery, testContext);
      const duration = Date.now() - start;

      // Should be relatively fast with parallelism
      expect(duration).toBeLessThan(1000);

      await svc.cleanup();
    });
  });
});
