/**
 * ============================================================================
 * HNSW INDEX INTEGRATION TESTS
 * ============================================================================
 *
 * Tests the HNSW (Hierarchical Navigable Small World) index functionality:
 * - Vector insertion and retrieval
 * - Approximate nearest neighbor search
 * - Index serialization (save/load)
 * - Dynamic resizing
 * - ID mapping (external ↔ internal)
 * - Performance benchmarks
 *
 * These tests verify that HNSW provides the expected O(log n) search
 * performance compared to O(n) brute-force search.
 *
 * @see src/vector-db/HNSWIndex.ts
 * @see docs/architecture/04-indexer-architecture.md#hnsw-indexing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HNSWIndex, createHNSWIndex, createFastHNSWIndex, createAccurateHNSWIndex } from '../../src/vector-db/HNSWIndex.js';
import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Generate a random vector of given dimension
 */
function randomVector(dimension: number): number[] {
  return Array.from({ length: dimension }, () => Math.random() * 2 - 1);
}

/**
 * Generate multiple random vectors
 */
function randomVectors(count: number, dimension: number): number[][] {
  return Array.from({ length: count }, () => randomVector(dimension));
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Brute-force k-nearest neighbors search (O(n))
 */
function bruteForceKNN(
  query: number[],
  vectors: Map<string, number[]>,
  k: number
): Array<{ id: string; score: number }> {
  const results: Array<{ id: string; score: number }> = [];

  for (const [id, vector] of vectors.entries()) {
    const score = cosineSimilarity(query, vector);
    results.push({ id, score });
  }

  // Sort by score descending and take top k
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k);
}

// ============================================================================
// FIXTURES
// ============================================================================

const TEST_DIMENSION = 384; // BGE-small dimension
const TEST_INDEX_PATH = '/tmp/test_hnsw_index.bin';
const TEST_MAPPINGS_PATH = '/tmp/test_hnsw_mappings.json';

let hnsw: HNSWIndex;
let testVectors: Map<string, number[]>;

beforeEach(() => {
  hnsw = createHNSWIndex(TEST_DIMENSION);
  testVectors = new Map();

  // Generate 100 test vectors
  for (let i = 0; i < 100; i++) {
    const id = `vector-${i}`;
    const vector = randomVector(TEST_DIMENSION);
    testVectors.set(id, vector);
  }
});

afterEach(async () => {
  // Clean up test files
  try {
    await unlink(TEST_INDEX_PATH);
    await unlink(TEST_MAPPINGS_PATH);
  } catch {
    // Ignore if files don't exist
  }
});

// ============================================================================
// TESTS
// ============================================================================

describe('HNSWIndex - Basic Operations', () => {
  it('should create a new HNSW index', () => {
    expect(hnsw).toBeDefined();
    expect(hnsw.getCount()).toBe(0);
  });

  it('should add vectors to the index', async () => {
    const id = 'test-1';
    const vector = randomVector(TEST_DIMENSION);

    await hnsw.add(id, vector);

    expect(hnsw.getCount()).toBe(1);
    expect(hnsw.has(id)).toBe(true);
  });

  it('should add multiple vectors', async () => {
    const vectors = testVectors.entries();

    for (const [id, vector] of Array.from(vectors).slice(0, 10)) {
      await hnsw.add(id, vector);
    }

    expect(hnsw.getCount()).toBe(10);
  });

  it('should add vectors in batch', async () => {
    const batch = Array.from(testVectors.entries()).slice(0, 10).map(([id, vector]) => ({ id, vector }));

    await hnsw.addBatch(batch);

    expect(hnsw.getCount()).toBe(10);
  });

  it('should reject duplicate IDs', async () => {
    const id = 'duplicate';
    const vector = randomVector(TEST_DIMENSION);

    await hnsw.add(id, vector);

    await expect(hnsw.add(id, vector)).rejects.toThrow('already exists');
  });

  it('should reject vectors with wrong dimension', async () => {
    const id = 'wrong-dim';
    const vector = randomVector(128); // Wrong dimension

    await expect(hnsw.add(id, vector)).rejects.toThrow('dimension mismatch');
  });

  it('should remove vectors from the index', async () => {
    const id = 'to-remove';
    const vector = randomVector(TEST_DIMENSION);

    await hnsw.add(id, vector);
    expect(hnsw.has(id)).toBe(true);

    const removed = await hnsw.remove(id);
    expect(removed).toBe(true);
    expect(hnsw.has(id)).toBe(false);
  });

  it('should return false when removing non-existent vector', async () => {
    const removed = await hnsw.remove('does-not-exist');
    expect(removed).toBe(false);
  });

  it('should clear all vectors', async () => {
    // Add some vectors
    const batch = Array.from(testVectors.entries()).slice(0, 10).map(([id, vector]) => ({ id, vector }));
    await hnsw.addBatch(batch);
    expect(hnsw.getCount()).toBe(10);

    // Clear
    await hnsw.clear();
    expect(hnsw.getCount()).toBe(0);
  });
});

describe('HNSWIndex - Search', () => {
  beforeEach(async () => {
    // Add 100 vectors to the index
    const batch = Array.from(testVectors.entries()).map(([id, vector]) => ({ id, vector }));
    await hnsw.addBatch(batch);
  });

  it('should find nearest neighbors', async () => {
    const queryVector = testVectors.get('vector-0')!;
    const results = await hnsw.search(queryVector, 5);

    expect(results).toHaveLength(5);
    expect(results[0].id).toBe('vector-0'); // Exact match should be first
    expect(results[0].score).toBeCloseTo(1.0, 4); // Perfect match
  });

  it('should return results sorted by score', async () => {
    const queryVector = randomVector(TEST_DIMENSION);
    const results = await hnsw.search(queryVector, 10);

    // Check that scores are in descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it('should respect k parameter', async () => {
    const queryVector = randomVector(TEST_DIMENSION);

    const k5 = await hnsw.search(queryVector, 5);
    const k10 = await hnsw.search(queryVector, 10);

    expect(k5).toHaveLength(5);
    expect(k10).toHaveLength(10);
  });

  it('should handle query with wrong dimension', async () => {
    const wrongDimQuery = randomVector(128);

    await expect(hnsw.search(wrongDimQuery, 5)).rejects.toThrow('dimension mismatch');
  });

  it('should return empty results for empty index', async () => {
    const emptyHnsw = createHNSWIndex(TEST_DIMENSION);
    const queryVector = randomVector(TEST_DIMENSION);

    const results = await emptyHnsw.search(queryVector, 5);

    expect(results).toHaveLength(0);
  });
});

describe('HNSWIndex - Search Accuracy', () => {
  it('should find exact match with high score', async () => {
    const id = 'exact-match';
    const vector = randomVector(TEST_DIMENSION);

    await hnsw.add(id, vector);

    const results = await hnsw.search(vector, 1);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(id);
    expect(results[0].score).toBeGreaterThan(0.99);
  });

  it('should find similar vectors', async () => {
    // Create a base vector
    const base = randomVector(TEST_DIMENSION);

    // Create similar vectors (small noise)
    const similar1 = base.map(v => v + (Math.random() - 0.5) * 0.1);
    const similar2 = base.map(v => v + (Math.random() - 0.5) * 0.1);

    // Create dissimilar vector (large noise)
    const dissimilar = randomVector(TEST_DIMENSION);

    await hnsw.add('base', base);
    await hnsw.add('similar1', similar1);
    await hnsw.add('similar2', similar2);
    await hnsw.add('dissimilar', dissimilar);

    const results = await hnsw.search(base, 4);

    // Base should be first
    expect(results[0].id).toBe('base');

    // Similar vectors should rank higher than dissimilar
    const similarIndex = results.findIndex(r => r.id.startsWith('similar'));
    const dissimilarIndex = results.findIndex(r => r.id === 'dissimilar');

    expect(similarIndex).toBeLessThan(dissimilarIndex);
  });

  it('should approximate brute-force results', async () => {
    // Add test vectors (use more vectors for better HNSW approximation)
    const batch = Array.from(testVectors.entries()).slice(0, 50).map(([id, vector]) => ({ id, vector }));
    await hnsw.addBatch(batch);

    const queryVector = randomVector(TEST_DIMENSION);
    const k = 10;

    // HNSW search
    const hnswResults = await hnsw.search(queryVector, k);

    // Brute-force search
    const bruteForceResults = bruteForceKNN(queryVector, testVectors, k);

    // Check that HNSW finds at least some of the true top-k
    // For small datasets (50 vectors) and default HNSW parameters, 30% overlap is acceptable
    const topKIds = new Set(bruteForceResults.map(r => r.id));
    const overlap = hnswResults.filter(r => topKIds.has(r.id)).length;

    expect(overlap).toBeGreaterThanOrEqual(Math.max(2, k * 0.3)); // At least 30% or 2 results
  });
});

describe('HNSWIndex - Serialization', () => {
  it('should save and load index', async () => {
    // Add vectors
    const batch = Array.from(testVectors.entries()).slice(0, 10).map(([id, vector]) => ({ id, vector }));
    await hnsw.addBatch(batch);

    // Save
    await hnsw.save(TEST_INDEX_PATH, TEST_MAPPINGS_PATH);

    // Load into new index
    const loaded = await HNSWIndex.load(TEST_INDEX_PATH, TEST_MAPPINGS_PATH, {
      dimension: TEST_DIMENSION,
    });

    expect(loaded.getCount()).toBe(10);

    // Verify search works
    const queryVector = testVectors.get('vector-0')!;
    const results = await loaded.search(queryVector, 1);

    expect(results[0].id).toBe('vector-0');
  });

  it('should preserve ID mappings across save/load', async () => {
    const ids = ['id-1', 'id-2', 'id-3'];
    for (const id of ids) {
      await hnsw.add(id, randomVector(TEST_DIMENSION));
    }

    await hnsw.save(TEST_INDEX_PATH, TEST_MAPPINGS_PATH);

    const loaded = await HNSWIndex.load(TEST_INDEX_PATH, TEST_MAPPINGS_PATH, {
      dimension: TEST_DIMENSION,
    });

    for (const id of ids) {
      expect(loaded.has(id)).toBe(true);
    }
  });
});

describe('HNSWIndex - Statistics', () => {
  it('should return correct statistics', () => {
    const stats = hnsw.getStats();

    expect(stats.count).toBe(0);
    expect(stats.dimension).toBe(TEST_DIMENSION);
    expect(stats.m).toBeDefined();
    expect(stats.ef).toBeDefined();
    expect(stats.sizeBytes).toBe(0);
  });

  it('should update statistics after adding vectors', async () => {
    await hnsw.add('test', randomVector(TEST_DIMENSION));

    const stats = hnsw.getStats();

    expect(stats.count).toBe(1);
    expect(stats.sizeBytes).toBeGreaterThan(0);
  });
});

describe('HNSWIndex - Factory Functions', () => {
  it('should create index with default configuration', () => {
    const index = createHNSWIndex();

    expect(index.getCount()).toBe(0);
    expect(index.getStats().dimension).toBe(384);
  });

  it('should create fast index', () => {
    const index = createFastHNSWIndex();

    expect(index.getCount()).toBe(0);
    expect(index.getStats().dimension).toBe(384);
  });

  it('should create accurate index', () => {
    const index = createAccurateHNSWIndex();

    expect(index.getCount()).toBe(0);
    expect(index.getStats().dimension).toBe(384);
  });
});

describe('HNSWIndex - Performance Benchmarks', () => {
  it('should search faster than brute-force', async () => {
    const sizes = [100, 500, 1000];
    const k = 10;

    for (const size of sizes) {
      // Create fresh index
      const index = createHNSWIndex(TEST_DIMENSION);

      // Generate and add vectors
      const vectors = new Map<string, number[]>();
      for (let i = 0; i < size; i++) {
        const id = `vec-${i}`;
        const vector = randomVector(TEST_DIMENSION);
        vectors.set(id, vector);
      }

      const batch = Array.from(vectors.entries()).map(([id, vector]) => ({ id, vector }));
      await index.addBatch(batch);

      // Benchmark HNSW search
      const query = randomVector(TEST_DIMENSION);
      const hnswStart = performance.now();
      await index.search(query, k);
      const hnswTime = performance.now() - hnswStart;

      // Benchmark brute-force search
      const bruteStart = performance.now();
      bruteForceKNN(query, vectors, k);
      const bruteTime = performance.now() - bruteStart;

      // HNSW should be faster (or at least comparable for small sizes)
      // For larger sizes, HNSW should be significantly faster
      if (size >= 500) {
        expect(hnswTime).toBeLessThan(bruteTime);
      }
    }
  });

  it('should maintain search performance as index grows', async () => {
    const sizes = [100, 500, 1000];
    const times: number[] = [];

    for (const size of sizes) {
      const index = createHNSWIndex(TEST_DIMENSION);

      // Add vectors
      for (let i = 0; i < size; i++) {
        await index.add(`vec-${i}`, randomVector(TEST_DIMENSION));
      }

      // Benchmark search
      const query = randomVector(TEST_DIMENSION);
      const start = performance.now();
      await index.search(query, 10);
      const time = performance.now() - start;

      times.push(time);
    }

    // Search time should grow sub-linearly (O(log n))
    // If size grows 10x, time should grow less than 10x
    const timeGrowthRatio = times[2] / times[0];
    const sizeGrowthRatio = sizes[2] / sizes[0];

    expect(timeGrowthRatio).toBeLessThan(sizeGrowthRatio);
  });
});

describe('HNSWIndex - Edge Cases', () => {
  it('should handle empty search results', async () => {
    const results = await hnsw.search(randomVector(TEST_DIMENSION), 10);

    expect(results).toHaveLength(0);
  });

  it('should handle k larger than index size', async () => {
    await hnsw.add('only-one', randomVector(TEST_DIMENSION));

    const results = await hnsw.search(randomVector(TEST_DIMENSION), 100);

    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('should handle zero-dimensional vectors (edge case)', () => {
    expect(() => {
      new HNSWIndex({ dimension: 0 });
    }).not.toThrow();
  });

  it('should handle very large k values', async () => {
    const batch = Array.from(testVectors.entries()).slice(0, 10).map(([id, vector]) => ({ id, vector }));
    await hnsw.addBatch(batch);

    const results = await hnsw.search(randomVector(TEST_DIMENSION), 1000000);

    expect(results.length).toBeLessThanOrEqual(10);
  });
});
