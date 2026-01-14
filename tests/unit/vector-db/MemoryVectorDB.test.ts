/**
 * Unit tests for MemoryVectorDB
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryVectorDB } from '../../../src/vector-db/MemoryVectorDB.js';
import type { CodeChunk } from '../../../src/core/types/index.js';

describe('MemoryVectorDB', () => {
  let db: MemoryVectorDB;

  beforeEach(() => {
    db = new MemoryVectorDB();
  });

  const createMockChunk = (
    id: string,
    content: string,
    embedding?: number[] | null
  ): CodeChunk => ({
    id,
    filePath: `/path/to/${id}.ts`,
    name: `function_${id}`,
    kind: 'function',
    startLine: 1,
    endLine: 10,
    content,
    language: 'typescript',
    // Use null to indicate no embedding, undefined to use default
    embedding: embedding === null ? undefined : (embedding ?? Array(384).fill(0).map(() => Math.random())),
    metadata: {
      exports: [],
      imports: [],
      dependencies: [],
    },
  });

  describe('insert', () => {
    it('should insert a chunk with embedding', async () => {
      const chunk = createMockChunk('test1', 'function test() {}', Array(384).fill(0.1));

      await expect(db.insert(chunk)).resolves.not.toThrow();
    });

    it('should reject chunk without embedding', async () => {
      const chunk = createMockChunk('test1', 'function test() {}', null);

      await expect(db.insert(chunk)).rejects.toThrow();
    });

    it('should reject chunk with empty embedding', async () => {
      const chunk = createMockChunk('test1', 'function test() {}', []);

      await expect(db.insert(chunk)).rejects.toThrow();
    });
  });

  describe('insertBatch', () => {
    it('should insert multiple chunks', async () => {
      const chunks = [
        createMockChunk('test1', 'function a() {}', Array(384).fill(0.1)),
        createMockChunk('test2', 'function b() {}', Array(384).fill(0.2)),
        createMockChunk('test3', 'function c() {}', Array(384).fill(0.3)),
      ];

      await expect(db.insertBatch(chunks)).resolves.not.toThrow();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // Insert test data
      const chunks = [
        createMockChunk('similar', 'function search() {}', Array(384).fill(0.5)),
        createMockChunk('different', 'function other() {}', Array(384).fill(0.1)),
      ];

      await db.insertBatch(chunks);
    });

    it('should return results sorted by relevance', async () => {
      const query = Array(384).fill(0.6); // Close to 'similar' chunk
      const results = await db.search(query, { limit: 10 });

      expect(results.chunks).toBeDefined();
      expect(results.chunks.length).toBeGreaterThan(0);
      expect(results.chunks[0].relevanceScore).toBeGreaterThanOrEqual(
        results.chunks[results.chunks.length - 1]?.relevanceScore || 0
      );
    });

    it('should respect limit parameter', async () => {
      const query = Array(384).fill(0.5);
      const results = await db.search(query, { limit: 1 });

      expect(results.chunks.length).toBeLessThanOrEqual(1);
    });

    it('should filter by language', async () => {
      const query = Array(384).fill(0.5);
      const results = await db.search(query, {
        languageFilter: 'python',
      });

      expect(results.chunks.length).toBe(0);
    });

    it('should include search time', async () => {
      const query = Array(384).fill(0.5);
      const results = await db.search(query);

      expect(results.searchTime).toBeGreaterThanOrEqual(0);
    });

    it('should track total evaluated', async () => {
      const query = Array(384).fill(0.5);
      const results = await db.search(query);

      expect(results.totalEvaluated).toBe(2);
    });
  });

  describe('get', () => {
    it('should return null for non-existent chunk', async () => {
      const result = await db.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should return chunk after insertion', async () => {
      const chunk = createMockChunk('test1', 'function test() {}', Array(384).fill(0.1));
      await db.insert(chunk);

      const result = await db.get('test1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test1');
    });

    it('should return a copy of the chunk', async () => {
      const chunk = createMockChunk('test1', 'function test() {}', Array(384).fill(0.1));
      await db.insert(chunk);

      const result = await db.get('test1');

      expect(result).not.toBe(chunk);
      expect(result?.id).toBe(chunk.id);
    });
  });

  describe('delete', () => {
    it('should remove chunk from database', async () => {
      const chunk = createMockChunk('test1', 'function test() {}', Array(384).fill(0.1));
      await db.insert(chunk);

      await db.delete('test1');

      const result = await db.get('test1');
      expect(result).toBeNull();
    });

    it('should not error when deleting non-existent chunk', async () => {
      await expect(db.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all chunks', async () => {
      const chunks = [
        createMockChunk('test1', 'function a() {}', Array(384).fill(0.1)),
        createMockChunk('test2', 'function b() {}', Array(384).fill(0.2)),
      ];

      await db.insertBatch(chunks);
      await db.clear();

      const stats = await db.getStats();
      expect(stats.totalChunks).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return stats for empty database', async () => {
      const stats = await db.getStats();

      expect(stats.totalChunks).toBe(0);
      expect(stats.indexSize).toBe(0);
      expect(stats.lastUpdated).toBeInstanceOf(Date);
    });

    it('should track chunk count by language', async () => {
      const chunks = [
        createMockChunk('test1', 'function a() {}', Array(384).fill(0.1)),
        createMockChunk('test2', 'function b() {}', Array(384).fill(0.2)),
        createMockChunk('test3', 'def c(): pass', Array(384).fill(0.3)),
      ];

      chunks[2].language = 'python';

      await db.insertBatch(chunks);

      const stats = await db.getStats();

      expect(stats.totalChunks).toBe(3);
      expect(stats.chunksByLanguage['typescript']).toBe(2);
      expect(stats.chunksByLanguage['python']).toBe(1);
    });

    it('should estimate index size', async () => {
      const chunk = createMockChunk('test1', 'function test() {}', Array(384).fill(0.1));
      await db.insert(chunk);

      const stats = await db.getStats();

      expect(stats.indexSize).toBeGreaterThan(0);
    });
  });
});
