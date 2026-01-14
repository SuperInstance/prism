/**
 * Scoring Service Tests
 *
 * Comprehensive test suite for the scoring service including
 * performance benchmarks and accuracy tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ScoringService, type ScoringContext, type QueryEmbedding } from '../../prism/src/scoring/index.js';
import type { CodeChunk } from '../../prism/src/core/types.js';
import type { PrismConfig } from '../../prism/src/config/index.js';

// Mock scorer for testing
class MockScorer {
  name = 'mock';
  weight = 1.0;

  async calculate(
    chunk: CodeChunk,
    query: QueryEmbedding,
    _context: ScoringContext
  ): Promise<number> {
    // Simple similarity based on text overlap
    const chunkText = chunk.text.toLowerCase();
    const queryText = query.text.toLowerCase();
    let overlap = 0;

    for (const word of queryText.split(/\s+/)) {
      if (chunkText.includes(word)) {
        overlap++;
      }
    }

    return overlap / queryText.split(/\s+/).length;
  }
}

describe('ScoringService', () => {
  let service: ScoringService;
  let mockConfig: PrismConfig;

  beforeEach(() => {
    mockConfig = {
      indexer: {
        chunkSize: 100,
        overlap: 0,
        languages: ['typescript'],
        includePatterns: ['**/*.ts'],
        excludePatterns: ['node_modules/**'],
      },
      vectorDB: {
        type: 'sqlite',
        path: ':memory:',
      },
      tokenOptimizer: {
        maxTokens: 8000,
        targetCompression: 10,
        preserveSignatures: true,
      },
      modelRouter: {
        preferLocal: false,
      },
    };

    service = new ScoringService(mockConfig, {
      enableCache: true,
      enableMetrics: true,
      parallelism: 4,
    });

    service.registerScorer(new MockScorer());
  });

  afterEach(async () => {
    await service.cleanup();
  });

  describe('Basic Functionality', () => {
    it('should calculate relevance score for a single chunk', async () => {
      const chunk: CodeChunk = {
        id: 'test-1',
        text: 'function hello() { console.log("hello"); }',
        startLine: 1,
        endLine: 1,
        tokens: 10,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const query: QueryEmbedding = {
        vector: [],
        text: 'hello function',
        timestamp: Date.now(),
      };

      const context: ScoringContext = {
        currentFile: 'test.ts',
        currentDirectory: '/test',
        recentFiles: [],
        timestamp: Date.now(),
      };

      const score = await service.calculateRelevance(chunk, query, context);

      expect(score).toBeDefined();
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(1);
    });

    it('should score a batch of chunks', async () => {
      const chunks: CodeChunk[] = Array.from({ length: 10 }, (_, i) => ({
        id: `chunk-${i}`,
        text: `function func${i}() { return ${i}; }`,
        startLine: i,
        endLine: i,
        tokens: 10,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      }));

      const query: QueryEmbedding = {
        vector: [],
        text: 'function',
        timestamp: Date.now(),
      };

      const context: ScoringContext = {
        recentFiles: [],
        timestamp: Date.now(),
      };

      const results = await service.scoreBatch(chunks, query, context);

      expect(results).toHaveLength(10);
      expect(results[0].rank).toBe(1);
      expect(results.every((r) => r.score.total >= 0)).toBe(true);
    });

    it('should cache scoring results', async () => {
      const chunk: CodeChunk = {
        id: 'cache-test',
        text: 'test content',
        startLine: 1,
        endLine: 1,
        tokens: 2,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const query: QueryEmbedding = {
        vector: [],
        text: 'test',
        timestamp: Date.now(),
      };

      const context: ScoringContext = {
        recentFiles: [],
        timestamp: Date.now(),
      };

      const score1 = await service.calculateRelevance(chunk, query, context);
      const score2 = await service.calculateRelevance(chunk, query, context);

      expect(score1.total).toBe(score2.total);

      const metrics = service.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    });
  });

  describe('Plugin Architecture', () => {
    it('should register and use multiple scorers', async () => {
      class SecondMockScorer {
        name = 'mock2';
        weight = 0.5;

        async calculate(): Promise<number> {
          return 0.5;
        }
      }

      service.registerScorer(new SecondMockScorer());

      const chunk: CodeChunk = {
        id: 'multi-scorer',
        text: 'test',
        startLine: 1,
        endLine: 1,
        tokens: 1,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const query: QueryEmbedding = {
        vector: [],
        text: 'test',
        timestamp: Date.now(),
      };

      const context: ScoringContext = {
        recentFiles: [],
        timestamp: Date.now(),
      };

      const score = await service.calculateRelevance(chunk, query, context);

      expect(score.metadata).toBeDefined();
      expect(score.total).toBeGreaterThan(0);
    });

    it('should unregister scorers', async () => {
      const scorer = new MockScorer();
      service.unregisterScorer('mock');

      const chunk: CodeChunk = {
        id: 'no-scorer',
        text: 'test',
        startLine: 1,
        endLine: 1,
        tokens: 1,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      };

      const query: QueryEmbedding = {
        vector: [],
        text: 'test',
        timestamp: Date.now(),
      };

      const context: ScoringContext = {
        recentFiles: [],
        timestamp: Date.now(),
      };

      const score = await service.calculateRelevance(chunk, query, context);

      // Should return 0 since no scorers are registered
      expect(score.total).toBe(0);
    });
  });
});

describe('Scoring Performance', () => {
  let service: ScoringService;
  let mockConfig: PrismConfig;

  beforeEach(async () => {
    mockConfig = {
      indexer: {
        chunkSize: 100,
        overlap: 0,
        languages: ['typescript'],
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
      },
      vectorDB: {
        type: 'sqlite',
        path: ':memory:',
      },
      tokenOptimizer: {
        maxTokens: 8000,
        targetCompression: 10,
        preserveSignatures: true,
      },
      modelRouter: {
        preferLocal: false,
      },
    };

    service = new ScoringService(mockConfig, {
      enableCache: false, // Disable cache for performance testing
      enableMetrics: true,
      parallelism: 4,
    });

    service.registerScorer(new MockScorer());
    await service.initialize();
  });

  afterEach(async () => {
    await service.cleanup();
  });

  it('should score 10K chunks in <100ms', async () => {
    const chunks = generateMockChunks(10000);

    const query: QueryEmbedding = {
      vector: [],
      text: 'function test',
      timestamp: Date.now(),
    };

    const context: ScoringContext = {
      recentFiles: [],
      timestamp: Date.now(),
    };

    const start = Date.now();
    await service.scoreBatch(chunks, query, context);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('should score 100K chunks in <1s', async () => {
    const chunks = generateMockChunks(100000);

    const query: QueryEmbedding = {
      vector: [],
      text: 'function test',
      timestamp: Date.now(),
    };

    const context: ScoringContext = {
      recentFiles: [],
      timestamp: Date.now(),
    };

    const start = Date.now();
    await service.scoreBatch(chunks, query, context);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });

  it('should maintain performance with cache enabled', async () => {
    const serviceWithCache = new ScoringService(mockConfig, {
      enableCache: true,
      enableMetrics: true,
      parallelism: 4,
    });

    serviceWithCache.registerScorer(new MockScorer());
    await serviceWithCache.initialize();

    const chunks = generateMockChunks(10000);

    const query: QueryEmbedding = {
      vector: [],
      text: 'function test',
      timestamp: Date.now(),
    };

    const context: ScoringContext = {
      recentFiles: [],
      timestamp: Date.now(),
    };

    const start = Date.now();
    await serviceWithCache.scoreBatch(chunks, query, context);
    const elapsedFirst = Date.now() - start;

    const start2 = Date.now();
    await serviceWithCache.scoreBatch(chunks, query, context);
    const elapsedSecond = Date.now() - start2;

    await serviceWithCache.cleanup();

    // Second run should be faster due to cache
    expect(elapsedSecond).toBeLessThanOrEqual(elapsedFirst);
  });
});

describe('Scoring Accuracy', () => {
  let service: ScoringService;
  let mockConfig: PrismConfig;

  beforeEach(async () => {
    mockConfig = {
      indexer: {
        chunkSize: 100,
        overlap: 0,
        languages: ['typescript'],
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
      },
      vectorDB: {
        type: 'sqlite',
        path: ':memory:',
      },
      tokenOptimizer: {
        maxTokens: 8000,
        targetCompression: 10,
        preserveSignatures: true,
      },
      modelRouter: {
        preferLocal: false,
      },
    };

    service = new ScoringService(mockConfig);
    service.registerScorer(new MockScorer());
    await service.initialize();
  });

  afterEach(async () => {
    await service.cleanup();
  });

  it('should rank relevant chunks higher', async () => {
    const chunks: CodeChunk[] = [
      {
        id: 'relevant-1',
        text: 'function processPayment() { /* payment logic */ }',
        startLine: 1,
        endLine: 1,
        tokens: 10,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      },
      {
        id: 'irrelevant-1',
        text: 'function helperFunction() { /* unrelated */ }',
        startLine: 2,
        endLine: 2,
        tokens: 10,
        language: 'typescript',
        functions: [],
        classes: [],
        dependencies: [],
      },
    ];

    const query: QueryEmbedding = {
      vector: [],
      text: 'payment processing function',
      timestamp: Date.now(),
    };

    const context: ScoringContext = {
      recentFiles: [],
      timestamp: Date.now(),
    };

    const results = await service.scoreBatch(chunks, query, context);

    expect(results[0].chunk.id).toBe('relevant-1');
    expect(results[0].score.total).toBeGreaterThan(results[1].score.total);
  });

  it('should handle empty queries gracefully', async () => {
    const chunk: CodeChunk = {
      id: 'empty-query-test',
      text: 'test content',
      startLine: 1,
      endLine: 1,
      tokens: 2,
      language: 'typescript',
      functions: [],
      classes: [],
      dependencies: [],
    };

    const query: QueryEmbedding = {
      vector: [],
      text: '',
      timestamp: Date.now(),
    };

    const context: ScoringContext = {
      recentFiles: [],
      timestamp: Date.now(),
    };

    const score = await service.calculateRelevance(chunk, query, context);

    expect(score).toBeDefined();
    expect(score.total).toBeGreaterThanOrEqual(0);
  });
});

// Helper function to generate mock chunks
function generateMockChunks(count: number): CodeChunk[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `chunk-${i}`,
    text: `function func${i}() { return ${i}; }`,
    startLine: i,
    endLine: i,
    tokens: 10,
    language: 'typescript',
    functions: [],
    classes: [],
    dependencies: [],
  }));
}
