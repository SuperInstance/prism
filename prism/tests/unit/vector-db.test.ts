/**
 * Vector Database Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryVectorDB, SQLiteVectorDB } from '../../src/vector-db/index.js';
import type { CodeChunk } from '../../src/core/types.js';

describe('Vector Database', () => {
  describe('MemoryVectorDB', () => {
    let db: MemoryVectorDB;
    let testChunks: CodeChunk[];
    let testEmbeddings: number[][];

    beforeEach(() => {
      db = new MemoryVectorDB();

      // Create test chunks
      testChunks = [
        {
          id: 'chunk1',
          filePath: '/test/file1.ts',
          content: 'function hello() { console.log("hello"); }',
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          symbols: ['hello'],
          dependencies: [],
          metadata: {},
        },
        {
          id: 'chunk2',
          filePath: '/test/file2.ts',
          content: 'function world() { console.log("world"); }',
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          symbols: ['world'],
          dependencies: [],
          metadata: {},
        },
        {
          id: 'chunk3',
          filePath: '/test/file3.ts',
          content: 'const x = 42;',
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          symbols: ['x'],
          dependencies: [],
          metadata: {},
        },
      ];

      // Create test embeddings (normalized vectors)
      testEmbeddings = [
        normalize([1, 0, 0]),
        normalize([0, 1, 0]),
        normalize([0, 0, 1]),
      ];
    });

    describe('insert', () => {
      it('should insert a single chunk without embedding', async () => {
        await db.insert(testChunks[0]);
        const results = await db.search(normalize([1, 0, 0]), 10);
        expect(results).toHaveLength(1);
        expect(results[0].chunk.id).toBe('chunk1');
      });

      it('should insert a single chunk with embedding', async () => {
        await db.insert(testChunks[0], testEmbeddings[0]);
        const results = await db.search(normalize([1, 0, 0]), 10);
        expect(results).toHaveLength(1);
        expect(results[0].score).toBeCloseTo(1, 5);
      });

      it('should insert multiple chunks', async () => {
        await db.insert(testChunks[0], testEmbeddings[0]);
        await db.insert(testChunks[1], testEmbeddings[1]);
        await db.insert(testChunks[2], testEmbeddings[2]);

        const results = await db.search(normalize([1, 0, 0]), 10);
        expect(results).toHaveLength(3);
      });
    });

    describe('insertBatch', () => {
      it('should insert multiple chunks at once', async () => {
        await db.insertBatch(testChunks, testEmbeddings);
        const results = await db.search(normalize([1, 0, 0]), 10);
        expect(results).toHaveLength(3);
      });

      it('should handle empty batch', async () => {
        await db.insertBatch([], []);
        const results = await db.search(normalize([1, 0, 0]), 10);
        expect(results).toHaveLength(0);
      });
    });

    describe('search', () => {
      beforeEach(async () => {
        await db.insertBatch(testChunks, testEmbeddings);
      });

      it('should return results sorted by similarity', async () => {
        // Query similar to chunk1
        const query = normalize([0.9, 0.1, 0]);
        const results = await db.search(query, 10);

        expect(results[0].chunk.id).toBe('chunk1');
        expect(results[0].score).toBeGreaterThan(results[1].score);
      });

      it('should respect limit parameter', async () => {
        const results = await db.search(normalize([1, 0, 0]), 2);
        expect(results).toHaveLength(2);
      });

      it('should return correct similarity scores', async () => {
        // Exact match for chunk1
        const results = await db.search(normalize([1, 0, 0]), 10);
        expect(results[0].score).toBeCloseTo(1, 5);
        expect(results[0].chunk.id).toBe('chunk1');
      });

      it('should handle zero vectors', async () => {
        const results = await db.search([0, 0, 0], 10);
        expect(results).toHaveLength(3);
        // All scores should be 0 or very close
        results.forEach((r) => {
          expect(r.score).toBe(0);
        });
      });

      it('should work without embeddings (fallback)', async () => {
        const dbNoEmbed = new MemoryVectorDB();
        await dbNoEmbed.insert(testChunks[0]);
        const results = await dbNoEmbed.search([1, 0, 0], 10);
        expect(results).toHaveLength(1);
        expect(results[0].chunk.id).toBe('chunk1');
      });
    });

    describe('delete', () => {
      it('should delete a chunk by ID', async () => {
        await db.insert(testChunks[0], testEmbeddings[0]);
        await db.delete('chunk1');

        const results = await db.search(normalize([1, 0, 0]), 10);
        expect(results).toHaveLength(0);
      });

      it('should handle deleting non-existent chunk', async () => {
        await db.insert(testChunks[0], testEmbeddings[0]);
        await db.delete('nonexistent');

        const results = await db.search(normalize([1, 0, 0]), 10);
        expect(results).toHaveLength(1);
      });
    });

    describe('clear', () => {
      it('should clear all data', async () => {
        await db.insertBatch(testChunks, testEmbeddings);
        await db.clear();

        const results = await db.search(normalize([1, 0, 0]), 10);
        expect(results).toHaveLength(0);
      });
    });
  });

  describe('SQLiteVectorDB', () => {
    let db: SQLiteVectorDB;
    let testChunks: CodeChunk[];
    let testEmbeddings: number[][];

    beforeEach(() => {
      db = new SQLiteVectorDB({ path: ':memory:' });

      // Create test chunks
      testChunks = [
        {
          id: 'chunk1',
          filePath: '/test/file1.ts',
          content: 'function hello() { console.log("hello"); }',
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          symbols: ['hello'],
          dependencies: [],
          metadata: {},
        },
        {
          id: 'chunk2',
          filePath: '/test/file2.ts',
          content: 'function world() { console.log("world"); }',
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          symbols: ['world'],
          dependencies: [],
          metadata: {},
        },
        {
          id: 'chunk3',
          filePath: '/test/file3.ts',
          content: 'const x = 42;',
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          symbols: ['x'],
          dependencies: [],
          metadata: {},
        },
      ];

      // Create test embeddings
      testEmbeddings = [
        normalize([1, 0, 0]),
        normalize([0, 1, 0]),
        normalize([0, 0, 1]),
      ];
    });

    describe('insert', () => {
      it('should insert a single chunk without embedding', async () => {
        await db.insert(testChunks[0]);
        const chunk = await db.getChunk('chunk1');
        expect(chunk).toBeTruthy();
        expect(chunk?.id).toBe('chunk1');
      });

      it('should insert a single chunk with embedding', async () => {
        await db.insert(testChunks[0], testEmbeddings[0]);
        const results = await db.search(testEmbeddings[0], 10);
        expect(results).toHaveLength(1);
        expect(results[0].chunk.id).toBe('chunk1');
      });

      it('should insert multiple chunks', async () => {
        await db.insert(testChunks[0], testEmbeddings[0]);
        await db.insert(testChunks[1], testEmbeddings[1]);
        await db.insert(testChunks[2], testEmbeddings[2]);

        const stats = db.getStats();
        expect(stats.chunkCount).toBe(3);
        expect(stats.vectorCount).toBe(3);
      });
    });

    describe('insertBatch', () => {
      it('should insert multiple chunks at once', async () => {
        await db.insertBatch(testChunks, testEmbeddings);

        const stats = db.getStats();
        expect(stats.chunkCount).toBe(3);
        expect(stats.vectorCount).toBe(3);
      });

      it('should handle empty batch', async () => {
        await db.insertBatch([], []);

        const stats = db.getStats();
        expect(stats.chunkCount).toBe(0);
        expect(stats.vectorCount).toBe(0);
      });
    });

    describe('search', () => {
      beforeEach(async () => {
        await db.insertBatch(testChunks, testEmbeddings);
      });

      it('should return results sorted by similarity', async () => {
        // Query similar to chunk1
        const query = normalize([0.9, 0.1, 0]);
        const results = await db.search(query, 10);

        expect(results[0].chunk.id).toBe('chunk1');
        expect(results[0].score).toBeGreaterThan(results[1].score);
      });

      it('should respect limit parameter', async () => {
        const results = await db.search(normalize([1, 0, 0]), 2);
        expect(results).toHaveLength(2);
      });

      it('should return correct similarity scores', async () => {
        // Exact match for chunk1
        const results = await db.search(testEmbeddings[0], 10);
        expect(results[0].score).toBeCloseTo(1, 5);
        expect(results[0].chunk.id).toBe('chunk1');
      });
    });

    describe('delete', () => {
      it('should delete a chunk by ID', async () => {
        await db.insert(testChunks[0], testEmbeddings[0]);
        await db.delete('chunk1');

        const chunk = await db.getChunk('chunk1');
        expect(chunk).toBeNull();

        const stats = db.getStats();
        expect(stats.chunkCount).toBe(0);
        expect(stats.vectorCount).toBe(0);
      });

      it('should handle deleting non-existent chunk', async () => {
        await db.insert(testChunks[0], testEmbeddings[0]);
        await db.delete('nonexistent');

        const stats = db.getStats();
        expect(stats.chunkCount).toBe(1);
      });
    });

    describe('clear', () => {
      it('should clear all data', async () => {
        await db.insertBatch(testChunks, testEmbeddings);
        await db.clear();

        const stats = db.getStats();
        expect(stats.chunkCount).toBe(0);
        expect(stats.vectorCount).toBe(0);
      });
    });

    describe('getChunk', () => {
      it('should get a chunk by ID', async () => {
        await db.insert(testChunks[0]);

        const chunk = await db.getChunk('chunk1');
        expect(chunk).toBeTruthy();
        expect(chunk?.id).toBe('chunk1');
        expect(chunk?.content).toBe(testChunks[0].content);
      });

      it('should return null for non-existent chunk', async () => {
        const chunk = await db.getChunk('nonexistent');
        expect(chunk).toBeNull();
      });
    });

    describe('getAllChunks', () => {
      it('should get all chunks', async () => {
        await db.insertBatch(testChunks, testEmbeddings);

        const chunks = await db.getAllChunks();
        expect(chunks).toHaveLength(3);
        expect(chunks.map((c) => c.id)).toContain('chunk1');
        expect(chunks.map((c) => c.id)).toContain('chunk2');
        expect(chunks.map((c) => c.id)).toContain('chunk3');
      });
    });

    describe('getStats', () => {
      it('should return correct statistics', async () => {
        await db.insertBatch(testChunks, testEmbeddings);

        const stats = db.getStats();
        expect(stats.chunkCount).toBe(3);
        expect(stats.vectorCount).toBe(3);
      });

      it('should return zero for empty database', () => {
        const stats = db.getStats();
        expect(stats.chunkCount).toBe(0);
        expect(stats.vectorCount).toBe(0);
      });
    });

    describe('close', () => {
      it('should close the database connection', () => {
        expect(() => db.close()).not.toThrow();
      });
    });
  });
});

/**
 * Helper function to normalize a vector
 */
function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}
