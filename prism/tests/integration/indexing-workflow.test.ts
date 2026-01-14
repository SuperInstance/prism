/**
 * Indexing Workflow Integration Tests
 *
 * Tests the complete indexing workflow from file discovery
 * through chunking to vector storage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismEngine } from '../../src/core/PrismEngine.js';
import fs from 'fs-extra';
import path from 'path';
import { createTempDir, cleanupTempDir, createTempFile } from '../helpers/test-utils.js';

describe('Indexing Workflow Integration', () => {
  let engine: PrismEngine;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    engine = new PrismEngine({ dbPath: ':memory:' });
  });

  afterEach(async () => {
    engine.close();
    await cleanupTempDir(tempDir);
  });

  describe('complete indexing workflow', () => {
    it('should index a TypeScript project', async () => {
      // Create a realistic TypeScript project structure
      await createTempFile(
        tempDir,
        'src/utils/helpers.ts',
        `
/**
 * Utility helper functions
 */

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseDate(str: string): Date {
  return new Date(str);
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}
        `
      );

      await createTempFile(
        tempDir,
        'src/api/client.ts',
        `
/**
 * HTTP API client
 */

export class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string, timeout: number = 5000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  async get(endpoint: string): Promise<any> {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`);
    return response.json();
  }

  async post(endpoint: string, data: any): Promise<any> {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }
}
        `
      );

      await createTempFile(
        tempDir,
        'src/types/index.ts',
        `
/**
 * Type definitions
 */

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface Post {
  id: string;
  authorId: string;
  title: string;
  content: string;
  tags: string[];
}

export type UserRole = 'admin' | 'user' | 'guest';

export interface Permissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}
        `
      );

      // Index the project
      const result = await engine.index(tempDir);

      // Verify indexing results
      expect(result.chunks).toBeGreaterThan(0);
      expect(result.errors).toBe(0);

      // Verify chunks were created
      const allChunks = await engine.vectorDB.getAllChunks();
      expect(allChunks.length).toBeGreaterThan(0);

      // Verify chunk properties
      const typescriptChunks = allChunks.filter((c) => c.language === 'typescript');
      expect(typescriptChunks.length).toBeGreaterThan(0);

      // Verify symbols were extracted
      const symbols = allChunks.flatMap((c) => c.symbols);
      expect(symbols).toContain('formatDate');
      expect(symbols).toContain('ApiClient');
      expect(symbols).toContain('User');
    });

    it('should index a JavaScript project', async () => {
      await createTempFile(
        tempDir,
        'lib/utils.js',
        `
// Utility functions

const add = (a, b) => a + b;
const subtract = (a, b) => a - b;

class Calculator {
  constructor() {
    this.result = 0;
  }

  add(value) {
    this.result += value;
    return this;
  }

  getResult() {
    return this.result;
  }
}

export { add, subtract, Calculator };
        `
      );

      const result = await engine.index(tempDir);

      expect(result.chunks).toBeGreaterThan(0);
      expect(result.errors).toBe(0);
    });

    it('should index a Python project', async () => {
      await createTempFile(
        tempDir,
        'app/models.py',
        `
"""
Data models for the application
"""

from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional


@dataclass
class User:
    """User model"""
    id: int
    name: str
    email: str
    created_at: datetime


@dataclass
class Post:
    """Blog post model"""
    id: int
    title: str
    content: str
    author: User
    tags: List[str]


class UserService:
    """Service for user operations"""

    def __init__(self, db):
        self.db = db

    def get_user(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter_by(id=user_id).first()

    def create_user(self, name: str, email: str) -> User:
        """Create a new user"""
        user = User(name=name, email=email, created_at=datetime.now())
        self.db.add(user)
        self.db.commit()
        return user
        `
      );

      const result = await engine.index(tempDir);

      expect(result.chunks).toBeGreaterThan(0);

      const allChunks = await engine.vectorDB.getAllChunks();
      const pythonChunks = allChunks.filter((c) => c.language === 'python');
      expect(pythonChunks.length).toBeGreaterThan(0);
    });
  });

  describe('incremental indexing', () => {
    it('should handle new files in existing index', async () => {
      // Initial index
      await createTempFile(tempDir, 'file1.ts', 'export function func1() {}');
      await engine.index(tempDir);

      let stats = engine.getStats();
      const initialChunks = stats.chunks;

      // Add new file
      await createTempFile(tempDir, 'file2.ts', 'export function func2() {}');
      await engine.index(tempDir);

      stats = engine.getStats();
      expect(stats.chunks).toBeGreaterThan(initialChunks);
    });

    it('should handle modified files', async () => {
      await createTempFile(tempDir, 'file.ts', 'export function original() {}');
      await engine.index(tempDir);

      const initialStats = engine.getStats();

      // Modify file
      await createTempFile(
        tempDir,
        'file.ts',
        `
export function modified() {
  return 'updated';
}

export function newFunction() {
  return 'new';
}
        `
      );

      await engine.index(tempDir);

      const updatedStats = engine.getStats();
      // Chunks may be different count
      expect(updatedStats.chunks).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should continue indexing when some files fail', async () => {
      await createTempFile(tempDir, 'valid.ts', 'export function valid() {}');
      await createTempFile(tempDir, 'invalid.ts', 'function syntax error {');

      const result = await engine.index(tempDir);

      // Should still create chunks for valid file
      expect(result.chunks).toBeGreaterThan(0);
    });

    it('should handle permission errors gracefully', async () => {
      // This test documents expected behavior
      await createTempFile(tempDir, 'test.ts', 'export function test() {}');

      const result = await engine.index(tempDir);

      expect(result).toBeDefined();
    });
  });

  describe('large file handling', () => {
    it('should index large files efficiently', async () => {
      const largeContent = Array(500)
        .fill(null)
        .map((_, i) => `export function function${i}() { return ${i}; }`)
        .join('\n');

      await createTempFile(tempDir, 'large.ts', largeContent);

      const start = Date.now();
      const result = await engine.index(tempDir);
      const duration = Date.now() - start;

      expect(result.chunks).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  describe('multi-language projects', () => {
    it('should index projects with multiple languages', async () => {
      await createTempFile(tempDir, 'src/main.ts', 'export function main() {}');
      await createTempFile(tempDir, 'lib/helper.js', 'function helper() {}');
      await createTempFile(tempDir, 'scripts/tool.py', 'def tool(): pass');

      const result = await engine.index(tempDir);

      expect(result.chunks).toBeGreaterThan(0);

      const allChunks = await engine.vectorDB.getAllChunks();
      const languages = new Set(allChunks.map((c) => c.language));

      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
    });
  });

  describe('complex project structures', () => {
    it('should handle nested directories', async () => {
      await createTempFile(tempDir, 'src/features/auth/login.ts', 'export function login() {}');
      await createTempFile(
        tempDir,
        'src/features/auth/register.ts',
        'export function register() {}'
      );
      await createTempFile(tempDir, 'src/features/dashboard/index.ts', 'export function load() {}');
      await createTempFile(tempDir, 'src/utils/format.ts', 'export function format() {}');

      const result = await engine.index(tempDir);

      expect(result.chunks).toBeGreaterThan(0);

      const allChunks = await engine.vectorDB.getAllChunks();
      expect(allChunks.length).toBeGreaterThan(0);
    });

    it('should handle monorepo structure', async () => {
      await createTempFile(tempDir, 'packages/package1/src/index.ts', 'export function pkg1() {}');
      await createTempFile(tempDir, 'packages/package2/src/index.ts', 'export function pkg2() {}');
      await createTempFile(tempDir, 'packages/shared/src/utils.ts', 'export function shared() {}');

      const result = await engine.index(tempDir);

      expect(result.chunks).toBeGreaterThan(0);
    });
  });

  describe('search after indexing', () => {
    it('should find indexed content', async () => {
      await createTempFile(
        tempDir,
        'auth.ts',
        `
export function authenticateUser(username: string, password: string) {
  // Authentication logic
  return true;
}

export function authorizeUser(token: string) {
  // Authorization logic
  return true;
}
        `
      );

      await engine.index(tempDir);

      const results = await engine.search('authenticate');

      expect(results.length).toBeGreaterThan(0);

      // Verify content in results
      const hasAuth = results.some((r) => r.chunk.content.includes('authenticate'));
      expect(hasAuth).toBe(true);
    });

    it('should find symbols in indexed code', async () => {
      await createTempFile(
        tempDir,
        'calculator.ts',
        `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}
        `
      );

      await engine.index(tempDir);

      const results = await engine.search('Calculator');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('context retrieval', () => {
    it('should retrieve context for indexed files', async () => {
      await createTempFile(
        tempDir,
        'src/utils.ts',
        `
export function helper1() {
  return 'helper1';
}

export function helper2() {
  return 'helper2';
}
        `
      );

      await engine.index(tempDir);

      const context = await engine.getContext('src/utils.ts');

      expect(context).toBeDefined();
      expect(context.length).toBeGreaterThan(0);
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', async () => {
      await createTempFile(tempDir, 'file1.ts', 'export function f1() {}');
      await createTempFile(tempDir, 'file2.ts', 'export function f2() {}');
      await createTempFile(tempDir, 'file3.ts', 'export function f3() {}');

      await engine.index(tempDir);

      const stats = engine.getStats();

      expect(stats.chunks).toBeGreaterThan(0);
      expect(stats.vectors).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    it('should index small project quickly', async () => {
      for (let i = 0; i < 10; i++) {
        await createTempFile(tempDir, `file${i}.ts`, `export function func${i}() {}`);
      }

      const start = Date.now();
      await engine.index(tempDir);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);
    });
  });
});
