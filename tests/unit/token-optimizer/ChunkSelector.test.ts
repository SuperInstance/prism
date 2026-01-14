/**
 * Unit tests for ChunkSelector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChunkSelector } from '../../../src/token-optimizer/ChunkSelector.js';
import { ScoredChunk } from '../../../src/core/types/index.js';

describe('ChunkSelector', () => {
  let selector: ChunkSelector;
  let mockChunks: ScoredChunk[];

  beforeEach(() => {
    selector = new ChunkSelector();

    // Create mock chunks with varying relevance and sizes
    mockChunks = [
      {
        id: 'chunk-1',
        filePath: '/project/src/utils.ts',
        name: 'helperFunction',
        kind: 'function',
        startLine: 1,
        endLine: 20,
        content: 'function helperFunction() { /* 100 tokens */ }'.repeat(5),
        language: 'typescript',
        relevanceScore: 0.9,
        scoreBreakdown: {
          semantic: 0.9,
          proximity: 0.8,
          symbol: 0.95,
          recency: 0.7,
          frequency: 0.5,
        },
        metadata: {
          exports: ['helperFunction'],
          imports: [],
          dependencies: [],
        },
      },
      {
        id: 'chunk-2',
        filePath: '/project/src/utils.ts',
        name: 'anotherFunction',
        kind: 'function',
        startLine: 21,
        endLine: 40,
        content: 'function anotherFunction() { /* 80 tokens */ }'.repeat(4),
        language: 'typescript',
        relevanceScore: 0.7,
        scoreBreakdown: {
          semantic: 0.7,
          proximity: 0.6,
          symbol: 0.8,
          recency: 0.6,
          frequency: 0.4,
        },
        metadata: {
          exports: ['anotherFunction'],
          imports: [],
          dependencies: [],
        },
      },
      {
        id: 'chunk-3',
        filePath: '/project/src/other.ts',
        name: 'smallFunction',
        kind: 'function',
        startLine: 1,
        endLine: 10,
        content: 'function smallFunction() { /* 30 tokens */ }',
        language: 'typescript',
        relevanceScore: 0.6,
        scoreBreakdown: {
          semantic: 0.6,
          proximity: 0.5,
          symbol: 0.7,
          recency: 0.5,
          frequency: 0.3,
        },
        metadata: {
          exports: ['smallFunction'],
          imports: [],
          dependencies: [],
        },
      },
      {
        id: 'chunk-4',
        filePath: '/project/src/other.ts',
        name: 'lowRelevanceFunction',
        kind: 'function',
        startLine: 11,
        endLine: 30,
        content: 'function lowRelevanceFunction() { /* 50 tokens */ }'.repeat(2),
        language: 'typescript',
        relevanceScore: 0.3,
        scoreBreakdown: {
          semantic: 0.3,
          proximity: 0.2,
          symbol: 0.4,
          recency: 0.3,
          frequency: 0.1,
        },
        metadata: {
          exports: ['lowRelevanceFunction'],
          imports: [],
          dependencies: [],
        },
      },
    ];
  });

  describe('selectWithinBudget', () => {
    it('should return empty array for empty chunks', () => {
      const result = selector.selectWithinBudget([], 1000);

      expect(result).toEqual([]);
    });

    it('should return empty array for zero budget', () => {
      const result = selector.selectWithinBudget(mockChunks, 0);

      expect(result).toEqual([]);
    });

    it('should select chunks within budget', () => {
      const budget = 200; // Should fit ~2 chunks
      const result = selector.selectWithinBudget(mockChunks, budget);

      expect(result.length).toBeGreaterThan(0);
      expect(selector.calculateTotalTokens(result)).toBeLessThanOrEqual(budget * 1.1); // Allow 10% overage
    });

    it('should prioritize score density', () => {
      const budget = 150; // Tight budget

      const result = selector.selectWithinBudget(mockChunks, budget);

      // Should prefer small + high relevance (chunk-3) over large + high relevance (chunk-1)
      const hasSmallHighRelevance = result.some(c => c.id === 'chunk-3');
      expect(hasSmallHighRelevance).toBe(true);
    });

    it('should allow overage for high-value chunks', () => {
      const budget = 100; // Very tight budget

      const result = selector.selectWithinBudget(mockChunks, budget);

      // Should select at least the best chunk even if slightly over budget
      expect(result.length).toBeGreaterThan(0);
    });

    it('should respect maxChunks option', () => {
      const budget = 10000; // Large budget
      const options = { maxChunks: 2 };

      const result = selector.selectWithinBudget(mockChunks, budget, options);

      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should respect minRelevance option', () => {
      const budget = 10000; // Large budget
      const options = { minRelevance: 0.7 };

      const result = selector.selectWithinBudget(mockChunks, budget, options);

      for (const chunk of result) {
        expect(chunk.relevanceScore).toBeGreaterThanOrEqual(0.7);
      }
    });

    it('should filter out low relevance chunks', () => {
      const budget = 10000; // Large budget
      const options = { minRelevance: 0.5 };

      const result = selector.selectWithinBudget(mockChunks, budget, options);

      expect(result.every(c => c.relevanceScore >= 0.5)).toBe(true);
      expect(result.some(c => c.id === 'chunk-4')).toBe(false); // Low relevance chunk
    });

    it('should apply diversity when requested', () => {
      const budget = 10000; // Large budget
      const options = { preferDiversity: 0.5 };

      const result = selector.selectWithinBudget(mockChunks, budget, options);

      // Should include chunks from different files
      const uniqueFiles = new Set(result.map(c => c.filePath));
      expect(uniqueFiles.size).toBeGreaterThan(1);
    });

    it('should sort by relevance in final result', () => {
      const budget = 10000; // Large budget

      const result = selector.selectWithinBudget(mockChunks, budget);

      // Check sorted by relevance descending
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].relevanceScore).toBeGreaterThanOrEqual(result[i].relevanceScore);
      }
    });

    it('should handle all chunks fitting in budget', () => {
      const budget = 10000; // Very large budget

      const result = selector.selectWithinBudget(mockChunks, budget);

      expect(result.length).toBe(mockChunks.length);
    });

    it('should handle very tight budget', () => {
      const budget = 20; // Very small budget

      const result = selector.selectWithinBudget(mockChunks, budget);

      // Should select the best value chunk (smallest with decent relevance)
      expect(result.length).toBeGreaterThan(0);
      expect(selector.calculateTotalTokens(result)).toBeLessThanOrEqual(budget * 1.1);
    });
  });

  describe('score density calculation', () => {
    it('should prefer high relevance, low token chunks', () => {
      const budget = 50; // Very tight budget

      const result = selector.selectWithinBudget(mockChunks, budget);

      // Should prefer chunk-3 (small + decent relevance) over chunk-1 (large + high relevance)
      expect(result[0].id).toBe('chunk-3');
    });

    it('should calculate density correctly', () => {
      const chunkWithHighDensity: ScoredChunk = {
        ...mockChunks[0],
        relevanceScore: 0.9,
        content: 'small', // Low token count
      };

      const chunkWithLowDensity: ScoredChunk = {
        ...mockChunks[0],
        relevanceScore: 0.5,
        content: 'large content '.repeat(100), // High token count
      };

      const densityHigh = selector['calculateScoreDensity'](chunkWithHighDensity);
      const densityLow = selector['calculateScoreDensity'](chunkWithLowDensity);

      expect(densityHigh).toBeGreaterThan(densityLow);
    });
  });

  describe('calculateTotalTokens', () => {
    it('should sum token counts correctly', () => {
      const result = selector.calculateTotalTokens(mockChunks);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeGreaterThan(mockChunks.length * 10); // At least 10 tokens per chunk
    });

    it('should return 0 for empty array', () => {
      const result = selector.calculateTotalTokens([]);

      expect(result).toBe(0);
    });
  });

  describe('calculateAverageRelevance', () => {
    it('should calculate average correctly', () => {
      const result = selector.calculateAverageRelevance(mockChunks);

      const expected = (0.9 + 0.7 + 0.6 + 0.3) / 4;
      expect(result).toBeCloseTo(expected, 5);
    });

    it('should return 0 for empty array', () => {
      const result = selector.calculateAverageRelevance([]);

      expect(result).toBe(0);
    });
  });

  describe('getSelectionStats', () => {
    it('should return correct statistics', () => {
      const budget = 200;
      const selected = selector.selectWithinBudget(mockChunks, budget);

      const stats = selector.getSelectionStats(selected, mockChunks.length);

      expect(stats.selectedCount).toBe(selected.length);
      expect(stats.totalCount).toBe(mockChunks.length);
      expect(stats.selectionRate).toBeGreaterThanOrEqual(0);
      expect(stats.selectionRate).toBeLessThanOrEqual(1);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.avgRelevance).toBeGreaterThanOrEqual(0);
      expect(stats.avgRelevance).toBeLessThanOrEqual(1);
    });

    it('should calculate selection rate correctly', () => {
      const selected = [mockChunks[0], mockChunks[1]];

      const stats = selector.getSelectionStats(selected, 4);

      expect(stats.selectionRate).toBe(0.5);
    });
  });

  describe('edge cases', () => {
    it('should handle chunks with zero estimated tokens', () => {
      const zeroTokenChunk: ScoredChunk = {
        ...mockChunks[0],
        content: '',
      };

      const result = selector.selectWithinBudget([zeroTokenChunk], 100);

      expect(result.length).toBe(1);
    });

    it('should handle chunks with very high relevance', () => {
      const highRelevanceChunks: ScoredChunk[] = [
        {
          ...mockChunks[0],
          relevanceScore: 0.95,
          content: 'large content '.repeat(10),
        },
        {
          ...mockChunks[1],
          relevanceScore: 0.85,
          content: 'medium content '.repeat(5),
        },
      ];

      const budget = 100;
      const result = selector.selectWithinBudget(highRelevanceChunks, budget);

      // Should still select at least one high-value chunk even if over budget
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle negative budget', () => {
      const result = selector.selectWithinBudget(mockChunks, -100);

      expect(result).toEqual([]);
    });
  });
});
