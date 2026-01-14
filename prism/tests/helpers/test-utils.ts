/**
 * Test Utilities
 *
 * Helper functions and utilities for testing PRISM.
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import type { CodeChunk } from '../../src/core/types.js';

/**
 * Create a temporary directory for testing
 *
 * @returns Path to the created temporary directory
 */
export async function createTempDir(): Promise<string> {
  const tmp = os.tmpdir();
  const dir = path.join(tmp, `prism-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.ensureDir(dir);
  return dir;
}

/**
 * Clean up a temporary directory
 *
 * @param dir - Directory path to remove
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  if (await fs.pathExists(dir)) {
    await fs.remove(dir);
  }
}

/**
 * Create a mock code chunk for testing
 *
 * @param overrides - Optional fields to override defaults
 * @returns A mock CodeChunk object
 */
export function createMockChunk(overrides: Partial<CodeChunk> = {}): CodeChunk {
  return {
    id: `chunk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    filePath: '/test/mock-file.ts',
    content: 'function mockFunction() { return true; }',
    startLine: 1,
    endLine: 1,
    language: 'typescript',
    symbols: ['mockFunction'],
    dependencies: [],
    metadata: {},
    ...overrides,
  };
}

/**
 * Create multiple mock chunks for testing
 *
 * @param count - Number of chunks to create
 * @param overrides - Optional fields to override defaults
 * @returns Array of mock CodeChunk objects
 */
export function createMockChunks(count: number, overrides: Partial<CodeChunk> = {}): CodeChunk[] {
  return Array.from({ length: count }, (_, i) =>
    createMockChunk({
      ...overrides,
      id: `chunk-${i}`,
      filePath: overrides.filePath || `/test/file-${i}.ts`,
    })
  );
}

/**
 * Create a mock embedding vector
 *
 * @param dimension - Dimension of the vector (default: 384)
 * @returns A normalized embedding vector
 */
export function createMockEmbedding(dimension: number = 384): number[] {
  const vector = [];
  for (let i = 0; i < dimension; i++) {
    vector.push(Math.random());
  }
  return normalizeVector(vector);
}

/**
 * Create multiple mock embedding vectors
 *
 * @param count - Number of vectors to create
 * @param dimension - Dimension of each vector
 * @returns Array of normalized embedding vectors
 */
export function createMockEmbeddings(count: number, dimension: number = 384): number[][] {
  return Array.from({ length: count }, () => createMockEmbedding(dimension));
}

/**
 * Normalize a vector to unit length
 *
 * @param vector - Vector to normalize
 * @returns Normalized vector
 */
export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

/**
 * Calculate cosine similarity between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity score (0-1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vector dimensions must match');
  }

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
 * Wait for a specified duration
 *
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a temporary file with content
 *
 * @param dir - Directory to create file in
 * @param filename - Name of the file
 * @param content - Content to write
 * @returns Full path to created file
 */
export async function createTempFile(
  dir: string,
  filename: string,
  content: string
): Promise<string> {
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Copy fixture files to a directory
 *
 * @param fixtureDir - Source fixture directory
 * @param targetDir - Target directory
 */
export async function copyFixtures(fixtureDir: string, targetDir: string): Promise<void> {
  if (await fs.pathExists(fixtureDir)) {
    await fs.copy(fixtureDir, targetDir);
  }
}

/**
 * Create a mock PrismEngine with in-memory database
 *
 * @returns PrismEngine instance configured for testing
 */
export function createMockEngine(): any {
  // Lazy import to avoid circular dependencies
  const { PrismEngine } = require('../../src/core/PrismEngine.js');
  return new PrismEngine({ dbPath: ':memory:' });
}

/**
 * Assert that a value is within a range
 *
 * @param value - Value to check
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 */
export function assertInRange(value: number, min: number, max: number): void {
  if (value < min || value > max) {
    throw new Error(`Expected ${value} to be between ${min} and ${max}`);
  }
}

/**
 * Assert that a chunk is valid
 *
 * @param chunk - Chunk to validate
 */
export function assertValidChunk(chunk: CodeChunk): void {
  if (!chunk.id) {
    throw new Error('Chunk must have an id');
  }
  if (!chunk.filePath) {
    throw new Error('Chunk must have a filePath');
  }
  if (!chunk.content) {
    throw new Error('Chunk must have content');
  }
  if (chunk.startLine < 1) {
    throw new Error('Chunk startLine must be >= 1');
  }
  if (chunk.endLine < chunk.startLine) {
    throw new Error('Chunk endLine must be >= startLine');
  }
  if (!chunk.language) {
    throw new Error('Chunk must have a language');
  }
  if (!Array.isArray(chunk.symbols)) {
    throw new Error('Chunk symbols must be an array');
  }
  if (!Array.isArray(chunk.dependencies)) {
    throw new Error('Chunk dependencies must be an array');
  }
}

/**
 * Assert that a score is valid (0-1)
 *
 * @param score - Score to validate
 */
export function assertValidScore(score: number): void {
  if (score < 0 || score > 1) {
    throw new Error(`Score must be between 0 and 1, got ${score}`);
  }
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param delayMs - Initial delay in milliseconds
 * @returns Result of the function
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await delay(delayMs * Math.pow(2, i));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Measure execution time of a function
 *
 * @param fn - Function to measure
 * @returns Object with result and duration in milliseconds
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

/**
 * Create a spy for monitoring function calls
 *
 * @param fn - Function to spy on (optional)
 * @returns Spy function with call tracking
 */
export function createSpy<T extends (...args: any[]) => any>(fn?: T): T & {
  calls: Array<Parameters<T>>;
  callCount: number;
  reset: () => void;
} {
  const calls: Array<Parameters<T>> = [];

  const spy = ((...args: Parameters<T>) => {
    calls.push(args);
    return fn?.(...args);
  }) as T & {
    calls: Array<Parameters<T>>;
    callCount: number;
    reset: () => void;
  };

  spy.calls = calls;
  Object.defineProperty(spy, 'callCount', {
    get: () => calls.length,
  });
  spy.reset = () => {
    calls.length = 0;
  };

  return spy;
}
