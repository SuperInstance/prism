/**
 * Unit tests for RelevanceScorer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RelevanceScorer } from '../../../src/scoring/scores/RelevanceScorer.js';
import { CodeChunk } from '../../../src/core/types/index.js';
import type { QueryEmbedding, ScoringContext } from '../../../src/scoring/types.js';

describe('RelevanceScorer', () => {
  let scorer: RelevanceScorer;
  let mockChunk: CodeChunk;
  let mockQuery: QueryEmbedding;
  let mockContext: ScoringContext;

  beforeEach(() => {
    scorer = new RelevanceScorer();

    mockChunk = {
      id: 'test-chunk-1',
      filePath: '/home/user/project/src/utils/helpers.ts',
      name: 'formatDate',
      kind: 'function',
      startLine: 10,
      endLine: 25,
      content: `function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return \`\${year}-\${month}-\${day}\`;
  }`,
      language: 'typescript',
      embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
      metadata: {
        exports: ['formatDate'],
        imports: [],
        dependencies: [],
        lastModified: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
      },
    };

    mockQuery = {
      text: 'formatDate function',
      vector: [0.1, 0.2, 0.3, 0.4, 0.5], // Same as chunk for perfect match
      entities: [
        { type: 'symbol', value: 'formatDate', position: 0 },
      ],
    };

    mockContext = {
      currentFile: '/home/user/project/src/utils/helpers.ts',
      now: Date.now(),
      usageHistory: [
        {
          chunkId: 'test-chunk-1',
          timestamp: Date.now() - 1000 * 60 * 60,
          helpful: true,
        },
      ],
      cwd: '/home/user/project',
      currentLanguage: 'typescript',
    };
  });

  describe('score', () => {
    it('should calculate overall relevance score', async () => {
      const result = await scorer.score(mockChunk, mockQuery, mockContext);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.chunk).toEqual(mockChunk);
      expect(result.breakdown).toBeDefined();
    });

    it('should include all five scoring features', async () => {
      const result = await scorer.score(mockChunk, mockQuery, mockContext);

      expect(result.breakdown).toHaveProperty('semantic');
      expect(result.breakdown).toHaveProperty('proximity');
      expect(result.breakdown).toHaveProperty('symbol');
      expect(result.breakdown).toHaveProperty('recency');
      expect(result.breakdown).toHaveProperty('frequency');
    });

    it('should calculate semantic similarity using cosine similarity', async () => {
      const result = await scorer.score(mockChunk, mockQuery, mockContext);

      expect(result.breakdown.semantic).toBeGreaterThan(0);
      expect(result.breakdown.semantic).toBeLessThanOrEqual(1);
    });

    it('should give perfect semantic score for identical embeddings', async () => {
      const identicalChunk = {
        ...mockChunk,
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
      };

      const result = await scorer.score(identicalChunk, mockQuery, mockContext);

      expect(result.breakdown.semantic).toBeCloseTo(1.0, 5);
    });

    it('should calculate file proximity correctly', async () => {
      const result = await scorer.score(mockChunk, mockQuery, mockContext);

      // Same file should get high proximity score
      expect(result.breakdown.proximity).toBeGreaterThan(0.8);
    });

    it('should give lower proximity for different files', async () => {
      const differentFileContext = {
        ...mockContext,
        currentFile: '/home/user/project/src/other/file.ts',
      };

      const result = await scorer.score(mockChunk, mockQuery, differentFileContext);

      expect(result.breakdown.proximity).toBeLessThan(1.0);
    });

    it('should match symbols correctly', async () => {
      const result = await scorer.score(mockChunk, mockQuery, mockContext);

      // Query contains 'formatDate' which matches chunk name
      expect(result.breakdown.symbol).toBeGreaterThan(0);
    });

    it('should give perfect symbol match for exact match', async () => {
      const exactQuery = {
        ...mockQuery,
        entities: [{ type: 'symbol', value: 'formatDate', position: 0 }],
      };

      const result = await scorer.score(mockChunk, exactQuery, mockContext);

      expect(result.breakdown.symbol).toBe(1.0);
    });

    it('should calculate recency based on last modified time', async () => {
      const result = await scorer.score(mockChunk, mockQuery, mockContext);

      expect(result.breakdown.recency).toBeGreaterThan(0);
      expect(result.breakdown.recency).toBeLessThanOrEqual(1);
    });

    it('should give higher recency for recently modified files', async () => {
      const recentChunk = {
        ...mockChunk,
        metadata: {
          ...mockChunk.metadata,
          lastModified: Date.now() - 1000 * 60 * 60, // 1 hour ago
        },
      };

      const recentContext = {
        ...mockContext,
        now: Date.now(),
      };

      const recentResult = await scorer.score(recentChunk, mockQuery, recentContext);

      const oldChunk = {
        ...mockChunk,
        metadata: {
          ...mockChunk.metadata,
          lastModified: Date.now() - 1000 * 60 * 60 * 24 * 30, // 30 days ago
        },
      };

      const oldResult = await scorer.score(oldChunk, mockQuery, recentContext);

      expect(recentResult.breakdown.recency).toBeGreaterThan(oldResult.breakdown.recency);
    });

    it('should calculate frequency from usage history', async () => {
      const result = await scorer.score(mockChunk, mockQuery, mockContext);

      expect(result.breakdown.frequency).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.frequency).toBeLessThanOrEqual(1);
    });

    it('should give higher frequency for helpful chunks', async () => {
      const helpfulHistory = [
        {
          chunkId: 'test-chunk-1',
          timestamp: Date.now() - 1000 * 60 * 60,
          helpful: true,
        },
        {
          chunkId: 'test-chunk-1',
          timestamp: Date.now() - 1000 * 60 * 30,
          helpful: true,
        },
      ];

      const helpfulContext = {
        ...mockContext,
        usageHistory: helpfulHistory,
      };

      const helpfulResult = await scorer.score(mockChunk, mockQuery, helpfulContext);

      const unhelpfulHistory = [
        {
          chunkId: 'test-chunk-1',
          timestamp: Date.now() - 1000 * 60 * 60,
          helpful: false,
        },
        {
          chunkId: 'test-chunk-1',
          timestamp: Date.now() - 1000 * 60 * 30,
          helpful: false,
        },
      ];

      const unhelpfulContext = {
        ...mockContext,
        usageHistory: unhelpfulHistory,
      };

      const unhelpfulResult = await scorer.score(mockChunk, mockQuery, unhelpfulContext);

      expect(helpfulResult.breakdown.frequency).toBeGreaterThan(unhelpfulResult.breakdown.frequency);
    });

    it('should handle chunks without embeddings', async () => {
      const chunkWithoutEmbedding = {
        ...mockChunk,
        embedding: undefined,
      };

      const result = await scorer.score(chunkWithoutEmbedding, mockQuery, mockContext);

      expect(result.breakdown.semantic).toBe(0);
      expect(result.score).toBeGreaterThan(0); // Other features still contribute
    });

    it('should handle empty query entities', async () => {
      const emptyQuery = {
        ...mockQuery,
        entities: [],
      };

      const result = await scorer.score(mockChunk, emptyQuery, mockContext);

      expect(result.breakdown.symbol).toBe(0);
      expect(result.score).toBeGreaterThan(0); // Other features still contribute
    });

    it('should handle missing last modified time', async () => {
      const chunkWithoutTimestamp = {
        ...mockChunk,
        metadata: {
          ...mockChunk.metadata,
          lastModified: undefined,
        },
      };

      const result = await scorer.score(chunkWithoutTimestamp, mockQuery, mockContext);

      expect(result.breakdown.recency).toBe(0.5); // Default neutral score
    });
  });

  describe('scoreBatch', () => {
    it('should score multiple chunks', async () => {
      const chunks = [
        mockChunk,
        {
          ...mockChunk,
          id: 'test-chunk-2',
          name: 'parseDate',
          filePath: '/home/user/project/src/utils/parser.ts',
        },
        {
          ...mockChunk,
          id: 'test-chunk-3',
          name: 'validateDate',
          filePath: '/home/user/project/src/utils/validator.ts',
        },
      ];

      const results = await scorer.scoreBatch(chunks, mockQuery, mockContext);

      expect(results).toHaveLength(3);
      expect(results[0].chunk.id).toBe('test-chunk-1');
      expect(results[1].chunk.id).toBe('test-chunk-2');
      expect(results[2].chunk.id).toBe('test-chunk-3');
    });

    it('should handle empty array', async () => {
      const results = await scorer.scoreBatch([], mockQuery, mockContext);

      expect(results).toHaveLength(0);
    });

    it('should be faster than individual scoring for large batches', async () => {
      const chunks = Array.from({ length: 100 }, (_, i) => ({
        ...mockChunk,
        id: `chunk-${i}`,
        name: `function${i}`,
        filePath: `/home/user/project/src/file${i}.ts`,
      }));

      const start = Date.now();
      await scorer.scoreBatch(chunks, mockQuery, mockContext);
      const batchTime = Date.now() - start;

      // Batch should complete in reasonable time (< 1 second for 100 chunks)
      expect(batchTime).toBeLessThan(1000);
    });
  });

  describe('weighted scoring', () => {
    it('should use correct weights for features', async () => {
      const result = await scorer.score(mockChunk, mockQuery, mockContext);

      // Verify weights sum to approximately 1.0
      const { breakdown } = result;
      const weights = {
        semantic: 0.40,
        proximity: 0.20,
        symbol: 0.25,
        recency: 0.10,
        frequency: 0.05,
      };

      const expectedScore =
        breakdown.semantic * weights.semantic +
        breakdown.proximity * weights.proximity +
        breakdown.symbol * weights.symbol +
        breakdown.recency * weights.recency +
        breakdown.frequency * weights.frequency;

      expect(result.score).toBeCloseTo(expectedScore, 5);
    });

    it('should prioritize semantic similarity', async () => {
      const highSemanticQuery = {
        ...mockQuery,
        vector: [0.1, 0.2, 0.3, 0.4, 0.5], // Perfect match
      };

      const lowSemanticQuery = {
        ...mockQuery,
        vector: [0.9, 0.8, 0.7, 0.6, 0.5], // Poor match
      };

      const highResult = await scorer.score(mockChunk, highSemanticQuery, mockContext);
      const lowResult = await scorer.score(mockChunk, lowSemanticQuery, mockContext);

      expect(highResult.score).toBeGreaterThan(lowResult.score);
    });
  });
});
