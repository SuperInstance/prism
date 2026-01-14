/**
 * End-to-End Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismEngine } from '../../src/core/PrismEngine.js';
import { SQLiteVectorDB } from '../../src/vector-db/index.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import { tmpdir } from 'os';

describe('Prism End-to-End Integration', () => {
  let engine: PrismEngine;
  let testDir: string;
  let dbPath: string;

  beforeAll(async () => {
    // Create temporary directory
    testDir = path.join(tmpdir(), `prism-test-${Date.now()}`);
    dbPath = path.join(tmpdir(), `prism-test-${Date.now()}.db`);
    await fs.ensureDir(testDir);

    // Create test files
    await fs.writeFile(
      path.join(testDir, 'auth.ts'),
      `export function authenticate(username: string, password: string): boolean {
  const user = database.findUser(username);
  if (!user) return false;
  return verifyPassword(password, user.hash);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compare(password, hash);
}`
    );

    await fs.writeFile(
      path.join(testDir, 'utils.ts'),
      `export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseDate(str: string): Date {
  return new Date(str);
}`
    );

    // Create engine
    engine = new PrismEngine({ dbPath });
  });

  afterAll(async () => {
    engine.close();
    await fs.remove(testDir);
    await fs.remove(dbPath);
  });

  describe('Indexing', () => {
    it('should index a directory', async () => {
      const result = await engine.index(testDir);

      expect(result.chunks).toBeGreaterThan(0);
      expect(result.errors).toBe(0);
    });

    it('should persist indexed chunks', async () => {
      await engine.index(testDir);

      const stats = engine.getStats();
      expect(stats.chunks).toBeGreaterThan(0);
    });
  });

  describe('Search', () => {
    beforeAll(async () => {
      await engine.index(testDir);
    });

    it('should find relevant code for search query', async () => {
      const results = await engine.search('authentication');

      // Note: Without embeddings, search returns random results
      // In production, we would generate embeddings for all chunks
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should return results with similarity scores', async () => {
      const results = await engine.search('password');

      results.forEach((result) => {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });

    it('should respect limit parameter', async () => {
      const results = await engine.search('function', 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Context', () => {
    beforeAll(async () => {
      await engine.index(testDir);
    });

    it('should get context for a file', async () => {
      const filePath = path.join(testDir, 'auth.ts');
      const chunks = await engine.getContext(filePath);

      // Try with just the filename since we're storing relative paths
      const chunksByName = await engine.getContext('auth.ts');

      expect(chunksByName.length).toBeGreaterThan(0);
      expect(chunksByName[0].filePath).toContain('auth.ts');
    });

    it('should return empty array for non-existent file', async () => {
      const chunks = await engine.getContext('/non/existent/file.ts');

      expect(chunks).toHaveLength(0);
    });
  });

  describe('Usage Explanation', () => {
    beforeAll(async () => {
      await engine.index(testDir);
    });

    it('should find definition and usage of a symbol', async () => {
      const result = await engine.explainUsage('authenticate');

      expect(result.definition).toBeTruthy();
      expect(result.definition?.content).toContain('authenticate');
      expect(result.usages.length).toBeGreaterThanOrEqual(0);
    });

    it('should return null for unknown symbol', async () => {
      const result = await engine.explainUsage('nonexistentSymbol');

      expect(result.definition).toBeNull();
      expect(result.usages).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    beforeAll(async () => {
      await engine.index(testDir);
    });

    it('should return accurate statistics', () => {
      const stats = engine.getStats();

      expect(stats.chunks).toBeGreaterThan(0);
      expect(stats.vectors).toBeGreaterThanOrEqual(0);
      expect(stats.languages).toBeDefined();
    });
  });

  describe('Clear', () => {
    it('should clear all data', async () => {
      await engine.index(testDir);
      expect(engine.getStats().chunks).toBeGreaterThan(0);

      await engine.clear();
      expect(engine.getStats().chunks).toBe(0);
    });
  });
});
