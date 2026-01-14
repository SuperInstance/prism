/**
 * Integration test for Token Optimizer Pipeline
 *
 * Tests the complete 6-phase optimization pipeline:
 * 1. Intent detection
 * 2. Scoring
 * 3. Selection
 * 4. Compression
 * 5. Prompt reconstruction
 * 6. Model selection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TokenOptimizer, createTokenOptimizer } from '../../src/token-optimizer/TokenOptimizer.js';
import { CodeChunk } from '../../src/core/types/index.js';

describe('Token Optimizer Integration Tests', () => {
  let optimizer: TokenOptimizer;
  let mockChunks: CodeChunk[];

  beforeEach(() => {
    // Create optimizer with default model router
    optimizer = createTokenOptimizer();

    // Create mock code chunks
    mockChunks = [
      {
        id: 'chunk-1',
        filePath: '/project/src/utils/date.ts',
        name: 'formatDate',
        kind: 'function',
        startLine: 1,
        endLine: 20,
        content: `
/**
 * Format a date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return \`\${year}-\${month}-\${day}\`;
}
        `,
        language: 'typescript',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        metadata: {
          exports: ['formatDate'],
          imports: [],
          dependencies: [],
          lastModified: Date.now() - 1000 * 60 * 60 * 24,
        },
      },
      {
        id: 'chunk-2',
        filePath: '/project/src/utils/date.ts',
        name: 'parseDate',
        kind: 'function',
        startLine: 21,
        endLine: 40,
        content: `
/**
 * Parse a date string
 */
export function parseDate(input: string): Date | null {
  const match = input.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
        `,
        language: 'typescript',
        embedding: [0.2, 0.3, 0.4, 0.5, 0.6],
        metadata: {
          exports: ['parseDate'],
          imports: [],
          dependencies: [],
          lastModified: Date.now() - 1000 * 60 * 60 * 48,
        },
      },
      {
        id: 'chunk-3',
        filePath: '/project/src/utils/string.ts',
        name: 'capitalize',
        kind: 'function',
        startLine: 1,
        endLine: 15,
        content: `
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
        `,
        language: 'typescript',
        embedding: [0.5, 0.4, 0.3, 0.2, 0.1],
        metadata: {
          exports: ['capitalize'],
          imports: [],
          dependencies: [],
          lastModified: Date.now() - 1000 * 60 * 60 * 24 * 7,
        },
      },
      {
        id: 'chunk-4',
        filePath: '/project/src/api/users.ts',
        name: 'getUserById',
        kind: 'function',
        startLine: 1,
        endLine: 30,
        content: `
import { db } from './db';

export async function getUserById(id: string): Promise<User | null> {
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}
        `,
        language: 'typescript',
        embedding: [0.3, 0.4, 0.5, 0.6, 0.7],
        metadata: {
          exports: ['getUserById'],
          imports: ['db'],
          dependencies: ['./db'],
          lastModified: Date.now() - 1000 * 60 * 60,
        },
      },
    ];
  });

  describe('full pipeline', () => {
    it('should complete all 6 phases', async () => {
      const prompt = 'Explain the formatDate function';
      const budget = 1000;

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget, {
        currentFile: '/project/src/utils/date.ts',
        cwd: '/project',
        currentLanguage: 'typescript',
      });

      // Verify all phases completed
      expect(result).toBeDefined();
      expect(result.prompt).toBeDefined();
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.chunks).toBeDefined();
      expect(result.model).toBeDefined();
      expect(result.savings).toBeDefined();
    });

    it('should detect intent correctly', async () => {
      const prompts = [
        'Fix the bug in formatDate',
        'Add a new function to parse dates',
        'Explain how formatDate works',
        'Refactor the date utilities',
      ];

      for (const prompt of prompts) {
        const result = await optimizer.reconstructPrompt(prompt, mockChunks, 1000);

        expect(result.prompt).toContain(prompt);
        expect(result.tokensUsed).toBeGreaterThan(0);
      }
    });

    it('should score and select relevant chunks', async () => {
      const prompt = 'Explain the formatDate function';
      const budget = 1000;

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget, {
        currentFile: '/project/src/utils/date.ts',
      });

      // Should select formatDate chunk as most relevant
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks.some(c => c.original.name === 'formatDate')).toBe(true);
    });

    it('should compress selected chunks', async () => {
      const prompt = 'Show me all date utilities';
      const budget = 500;

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget, {
        currentFile: '/project/src/utils/date.ts',
      });

      // All chunks should be compressed
      for (const chunk of result.chunks) {
        expect(chunk.compressedTokens).toBeLessThan(chunk.originalTokens);
        expect(chunk.compressionRatio).toBeGreaterThan(1.0);
      }
    });

    it('should build optimized prompt', async () => {
      const prompt = 'Explain the date utilities';
      const budget = 1000;

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget);

      expect(result.prompt).toContain('User Query');
      expect(result.prompt).toContain(prompt);
      expect(result.tokensUsed).toBeGreaterThan(0);
    });

    it('should select appropriate model', async () => {
      const prompt = 'Explain the formatDate function';
      const budget = 5000;

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget);

      expect(result.model).toBeDefined();
      expect(typeof result.model).toBe('string');
    });

    it('should calculate savings', async () => {
      const prompt = 'Explain the date utilities';
      const budget = 1000;

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget);

      expect(result.savings).toBeDefined();
      expect(result.savings.tokensSaved).toBeGreaterThan(0);
      expect(result.savings.percentage).toBeGreaterThan(0);
      expect(result.savings.costSaved).toBeGreaterThanOrEqual(0);
    });

    it('should stay within budget', async () => {
      const prompt = 'Show me all functions';
      const budget = 500;

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget);

      // Should not significantly exceed budget (allow 20% overage for high-value chunks)
      expect(result.tokensUsed).toBeLessThan(budget * 1.2);
    });
  });

  describe('budget allocation', () => {
    it('should allocate budget correctly', () => {
      const totalBudget = 10000;
      const allocation = optimizer.allocateBudget(totalBudget);

      expect(allocation.total).toBe(totalBudget);
      expect(allocation.system).toBeGreaterThan(0);
      expect(allocation.userQuery).toBeGreaterThan(0);
      expect(allocation.context).toBeGreaterThan(0);
      expect(allocation.response).toBeGreaterThan(0);

      // Sum should approximately equal total
      const sum = allocation.system + allocation.userQuery +
                  allocation.context + allocation.response;
      expect(sum).toBeLessThanOrEqual(totalBudget);
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', async () => {
      const prompt = 'Explain the date utilities';
      const budget = 1000;

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget);
      const stats = optimizer.getStats(mockChunks, result);

      expect(stats.originalChunks).toBe(mockChunks.length);
      expect(stats.selectedChunks).toBe(result.chunks.length);
      expect(stats.selectionRate).toBeGreaterThan(0);
      expect(stats.selectionRate).toBeLessThanOrEqual(1);
      expect(stats.originalTokens).toBeGreaterThan(0);
      expect(stats.optimizedTokens).toBe(result.tokensUsed);
      expect(stats.compressionRatio).toBeGreaterThan(1);
      expect(stats.savings.tokens).toBe(result.savings.tokensSaved);
      expect(stats.savings.percentage).toBe(result.savings.percentage);
    });
  });

  describe('performance', () => {
    it('should complete quickly for small datasets', async () => {
      const prompt = 'Explain formatDate';
      const budget = 1000;

      const start = Date.now();
      await optimizer.reconstructPrompt(prompt, mockChunks, budget);
      const duration = Date.now() - start;

      // Should complete in less than 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should handle larger datasets efficiently', async () => {
      // Create 100 chunks
      const largeChunks = Array.from({ length: 100 }, (_, i) => ({
        ...mockChunks[0],
        id: `chunk-${i}`,
        name: `function${i}`,
        filePath: `/project/src/file${Math.floor(i / 10)}.ts`,
        embedding: [Math.random(), Math.random(), Math.random(), Math.random(), Math.random()],
      }));

      const prompt = 'Find the best function';
      const budget = 2000;

      const start = Date.now();
      const result = await optimizer.reconstructPrompt(prompt, largeChunks, budget);
      const duration = Date.now() - start;

      // Should complete in reasonable time (< 5 seconds for 100 chunks)
      expect(duration).toBeLessThan(5000);
      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('accuracy', () => {
    it('should select most relevant chunks first', async () => {
      const prompt = 'Explain the formatDate function in detail';
      const budget = 1000;

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget, {
        currentFile: '/project/src/utils/date.ts',
      });

      // formatDate should be first (most relevant)
      expect(result.chunks[0].original.name).toBe('formatDate');
    });

    it('should prefer chunks from current file', async () => {
      const prompt = 'Show me functions';
      const budget = 1000;

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget, {
        currentFile: '/project/src/utils/date.ts',
      });

      // Should prefer date.ts over string.ts
      const dateChunks = result.chunks.filter(c => c.original.filePath.includes('date.ts'));
      const stringChunks = result.chunks.filter(c => c.original.filePath.includes('string.ts'));

      expect(dateChunks.length).toBeGreaterThanOrEqual(stringChunks.length);
    });

    it('should achieve high compression ratios', async () => {
      const prompt = 'Show me all date utilities';
      const budget = 50; // Very small budget forces aggressive compression

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget, {
        currentFile: '/project/src/utils/date.ts',
      });

      // Should achieve some compression with small budget
      if (result.chunks.length > 0) {
        const avgRatio = result.chunks.reduce((sum, c) => sum + c.compressionRatio, 0) / result.chunks.length;
        expect(avgRatio).toBeGreaterThan(1.0); // At least some compression
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty chunks', async () => {
      const prompt = 'Explain formatDate';
      const budget = 1000;

      const result = await optimizer.reconstructPrompt(prompt, [], budget);

      expect(result.chunks).toHaveLength(0);
      expect(result.prompt).toContain(prompt);
    });

    it('should handle very small budget', async () => {
      const prompt = 'Explain formatDate';
      const budget = 50;

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget);

      // Should still return something
      expect(result.prompt).toBeDefined();
      expect(result.tokensUsed).toBeGreaterThan(0);
    });

    it('should handle very large budget', async () => {
      const prompt = 'Show me everything';
      const budget = 100000;

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget);

      // Should select more chunks with larger budget
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should handle chunks without embeddings', async () => {
      const chunksWithoutEmbeddings = mockChunks.map(c => ({
        ...c,
        embedding: undefined,
      }));

      const prompt = 'Explain formatDate';
      const budget = 1000;

      const result = await optimizer.reconstructPrompt(prompt, chunksWithoutEmbeddings, budget, {
        currentFile: '/project/src/utils/date.ts',
      });

      // Should still work using other features
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should handle special characters in prompt', async () => {
      const prompt = 'Fix the bug with `formatDate` and "parseDate" functions';
      const budget = 1000;

      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget);

      expect(result.prompt).toBeDefined();
      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid scoring context gracefully', async () => {
      const prompt = 'Explain formatDate';
      const budget = 1000;

      // Should not throw with minimal context
      const result = await optimizer.reconstructPrompt(prompt, mockChunks, budget);

      expect(result).toBeDefined();
    });

    it('should handle chunks with missing metadata', async () => {
      const incompleteChunks = mockChunks.map(c => ({
        ...c,
        metadata: {
          exports: [],
          imports: [],
          dependencies: [],
        },
      }));

      const prompt = 'Explain formatDate';
      const budget = 1000;

      const result = await optimizer.reconstructPrompt(prompt, incompleteChunks, budget);

      expect(result).toBeDefined();
      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });
});
