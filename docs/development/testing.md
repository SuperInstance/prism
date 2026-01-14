# Testing Guide

**Component**: PRISM Development Guide
**Status**: Development Document
**Priority**: Foundational
**Last Updated**: 2026-01-13

## Purpose

This document provides comprehensive guidance for testing PRISM, including the test framework (Vitest), writing unit and integration tests, test coverage requirements, running tests locally, and CI/CD pipeline integration.

---

## Table of Contents

1. [Testing Framework](#1-testing-framework)
2. [Writing Unit Tests](#2-writing-unit-tests)
3. [Writing Integration Tests](#3-writing-integration-tests)
4. [Test Coverage Requirements](#4-test-coverage-requirements)
5. [Running Tests Locally](#5-running-tests-locally)
6. [CI/CD Pipeline](#6-ci-cd-pipeline)
7. [Test Data Management](#7-test-data-management)
8. [Best Practices](#8-best-practices)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Testing Framework

### 1.1 Framework Overview

PRISM uses **Vitest** as the primary testing framework:

**Why Vitest?**
- Native ESM support
- Fast execution with Vite
- Jest-compatible API
- Built-in TypeScript support
- Excellent watch mode
- Great for monorepo setups

**Alternative frameworks considered:**
- Jest (slower for large codebases)
- Mocha/Chai (more setup required)
- AVA (less familiar API)

### 1.2 Configuration

**`vitest.config.ts`:**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'prism-indexer/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
});
```

**`package.json` scripts:**

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:ollama": "vitest run tests/ollama",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch"
  }
}
```

### 1.3 Test Structure

```
tests/
├── unit/                   # Unit tests
│   ├── indexer/
│   │   └── index.test.ts
│   ├── vector-db/
│   │   └── storage.test.ts
│   └── token-optimizer/
│       └── optimizer.test.ts
│
├── integration/            # Integration tests
│   ├── indexing.test.ts
│   ├── search.test.ts
│   └── e2e.test.ts
│
├── ollama/                 # Ollama-specific tests
│   └── ollama-integration.test.ts
│
├── fixtures/               # Test fixtures
│   ├── code-samples.ts
│   └── test-data.json
│
└── helpers/                # Test utilities
    ├── mocks.ts
    └── fixtures.ts
```

---

## 2. Writing Unit Tests

### 2.1 Unit Test Philosophy

**What to test:**
- Public APIs and interfaces
- Business logic
- Data transformations
- Error handling
- Edge cases

**What NOT to test:**
- Private methods (test via public API)
- Third-party libraries
- Implementation details

### 2.3 Basic Unit Test Structure

```typescript
// tests/unit/vector-db/storage.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VectorStorage } from '@/vector-db/storage';

describe('VectorStorage', () => {
  let storage: VectorStorage;

  beforeEach(() => {
    // Setup before each test
    storage = new VectorStorage(':memory:');
  });

  afterEach(async () => {
    // Cleanup after each test
    await storage.close();
  });

  describe('search', () => {
    it('should return empty array when no vectors exist', async () => {
      const results = await storage.search(generateRandomVector(), { topK: 10 });

      expect(results).toEqual([]);
      expect(results).toHaveLength(0);
    });

    it('should return vectors sorted by similarity', async () => {
      // Arrange
      const query = [1, 0, 0];
      await storage.upsert([
        { id: '1', values: [1, 0, 0], metadata: {} },
        { id: '2', values: [0, 1, 0], metadata: {} },
        { id: '3', values: [0, 0, 1], metadata: {} },
      ]);

      // Act
      const results = await storage.search(query, { topK: 10 });

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('1');
      expect(results[0].score).toBeCloseTo(1.0);
      expect(results[1].score).toBeLessThan(results[0].score);
    });

    it('should respect topK limit', async () => {
      const query = [1, 0, 0];
      await storage.upsert(generateTestVectors(20));

      const results = await storage.search(query, { topK: 5 });

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should handle empty query vector', async () => {
      await expect(
        storage.search([], { topK: 10 })
      ).rejects.toThrow('Invalid query vector');
    });
  });

  describe('upsert', () => {
    it('should insert new vectors', async () => {
      const vectors = generateTestVectors(5);
      const count = await storage.upsert(vectors);

      expect(count).toBe(5);
    });

    it('should update existing vectors', async () => {
      await storage.upsert([{ id: '1', values: [1, 0, 0], metadata: {} }]);

      // Update same vector
      await storage.upsert([{ id: '1', values: [0, 1, 0], metadata: {} }]);

      const results = await storage.search([0, 1, 0], { topK: 1 });
      expect(results[0].id).toBe('1');
    });
  });
});
```

### 2.3 Test Matchers

**Common matchers:**

```typescript
// Equality
expect(value).toBe(expected);           // Strict equality (===)
expect(value).toEqual(expected);        // Deep equality
expect(value).toStrictEqual(expected);  // Strict deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeUndefined();
expect(value).toBeNull();
expect(value).toBeNaN();

// Numbers
expect(value).toBeGreaterThan(5);
expect(value).toBeLessThanOrEqual(10);
expect(value).toBeCloseTo(0.1, 2);  // 2 decimal places

// Strings
expect(str).toContain('substring');
expect(str).toMatch(/regex/);

// Arrays
expect(arr).toHaveLength(5);
expect(arr).toContain(item);
expect(arr).toContainEqual({ id: 1 });  // Deep equality

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toMatchObject({ key: 'value' });

// Functions
expect(fn).toHaveBeenCalled();
expect(fn).toHaveBeenCalledTimes(3);
expect(fn).toHaveBeenCalledWith(arg1, arg2);
expect(fn).toHaveReturned();

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow('Error message');

// Custom matchers
expect.customMatchers = {
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  }
};
```

### 2.4 Mocking

**Function mocking:**

```typescript
import { vi } from 'vitest';

// Create a mock function
const mockFn = vi.fn();

// Configure mock
mockFn.mockReturnValue('default');
mockFn.mockResolvedValue('async value');
mockFn.mockImplementation((arg) => arg * 2);

// Test calls
expect(mockFn).toHaveBeenCalledWith('arg');
expect(mockFn).toHaveReturnedWith(20);

// Reset mock
mockFn.mockReset();
mockFn.mockClear();
```

**Module mocking:**

```typescript
import { vi } from 'vitest';

// Mock entire module
vi.mock('@/vector-db/embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

// Mock partially
vi.mock('@/vector-db/embeddings', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  };
});
```

**Class mocking:**

```typescript
// Mock class
class MockVectorDatabase implements IVectorDatabase {
  async search() { return []; }
  async upsert() { return 0; }
}

// Use mock in test
const mockDb = new MockVectorDatabase();
const service = new SearchService(mockDb);
```

### 2.5 Test Utilities

**Helper functions:**

```typescript
// tests/helpers/fixtures.ts
export function generateRandomVector(dimensions = 384): number[] {
  return Array.from({ length: dimensions }, () => Math.random());
}

export function generateTestVectors(count: number): Vector[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `vec-${i}`,
    values: generateRandomVector(),
    metadata: { index: i },
  }));
}

export function createMockChunk(overrides?: Partial<CodeChunk>): CodeChunk {
  return {
    id: 'chunk-1',
    content: 'function test() { return true; }',
    filePath: '/test/file.ts',
    startLine: 1,
    endLine: 3,
    metadata: {},
    ...overrides,
  };
}
```

---

## 3. Writing Integration Tests

### 3.1 Integration Test Philosophy

**What to test:**
- Component interactions
- Service integration
- Database operations
- API endpoints
- End-to-end workflows

### 3.2 Basic Integration Test

```typescript
// tests/integration/indexing.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IndexerOrchestrator } from '@/indexer/IndexerOrchestrator';
import { VectorDatabase } from '@/vector-db/VectorDatabase';
import { EmbeddingService } from '@/embeddings/EmbeddingService';
import { tmpdir } from 'os';
import { mkdtemp, rmdir, writeFile } from 'fs/promises';
import { join } from 'path';

describe('Indexer Integration', () => {
  let testDir: string;
  let orchestrator: IndexerOrchestrator;
  let vectorDB: VectorDatabase;

  beforeAll(async () => {
    // Create temporary directory
    testDir = await mkdtemp(join(tmpdir(), 'prism-test-'));

    // Setup test files
    await writeFile(join(testDir, 'test.ts'), `
      export function add(a: number, b: number): number {
        return a + b;
      }
    `);

    // Initialize services
    vectorDB = new VectorDatabase(':memory:');
    const embeddings = new EmbeddingService();
    orchestrator = new IndexerOrchestrator(
      vectorDB,
      embeddings,
      { chunkSize: 100 }
    );
  });

  afterAll(async () => {
    // Cleanup
    await orchestrator.close();
    await vectorDB.close();
    await rmdir(testDir, { recursive: true });
  });

  it('should index directory and generate embeddings', async () => {
    const result = await orchestrator.indexDirectory(testDir);

    expect(result.success).toBe(true);
    expect(result.stats.filesIndexed).toBeGreaterThan(0);
    expect(result.stats.chunksCreated).toBeGreaterThan(0);

    // Verify vectors were created
    const vectors = await vectorDB.count();
    expect(vectors).toBeGreaterThan(0);
  });

  it('should handle incremental updates', async () => {
    // Initial index
    const result1 = await orchestrator.indexDirectory(testDir);
    const initialFiles = result1.stats.filesIndexed;

    // Add new file
    await writeFile(join(testDir, 'new.ts'), 'export const x = 1;');

    // Re-index
    const result2 = await orchestrator.indexDirectory(testDir);

    expect(result2.stats.filesIndexed).toBe(initialFiles + 1);
  });

  it('should search indexed code', async () => {
    await orchestrator.indexDirectory(testDir);

    const results = await orchestrator.search('add function');

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('function add');
  });
});
```

### 3.3 Database Integration Tests

```typescript
describe('Vector Database Integration', () => {
  let db: VectorDatabase;

  beforeAll(async () => {
    db = new VectorDatabase(':memory:');
    await db.initialize();
  });

  afterAll(async () => {
    await db.close();
  });

  it('should persist and retrieve vectors', async () => {
    const vectors = generateTestVectors(10);
    await db.upsert(vectors);

    const results = await db.search(vectors[0].values, { topK: 5 });

    expect(results).not.toHaveLength(0);
    expect(results[0].score).toBeGreaterThan(0.9);
  });

  it('should handle metadata filtering', async () => {
    await db.upsert([
      { id: '1', values: [1, 0], metadata: { type: 'function' } },
      { id: '2', values: [0, 1], metadata: { type: 'class' } },
    ]);

    const results = await db.search([1, 0], {
      topK: 10,
      filter: { type: 'function' }
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });
});
```

### 3.4 API Integration Tests

```typescript
describe('MCP Server Integration', () => {
  let server: MCPServer;
  let client: MCPClient;

  beforeAll(async () => {
    server = new MCPServer();
    await server.start();

    client = new MCPClient(server.transport);
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
    await server.stop();
  });

  it('should list available tools', async () => {
    const tools = await client.listTools();

    expect(tools).toContainEqual({
      name: 'search_repo',
      description: expect.any(String),
    });
  });

  it('should execute search tool', async () => {
    const result = await client.callTool('search_repo', {
      query: 'authentication',
      limit: 10,
    });

    expect(result.success).toBe(true);
    expect(result.data.results).toBeInstanceOf(Array);
  });
});
```

---

## 4. Test Coverage Requirements

### 4.1 Coverage Thresholds

**Current targets:**

```typescript
// vitest.config.ts
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 75,
    statements: 80,
  },
  // Per-module targets
  perFile: true,
}
```

**Module-specific targets:**

| Component | Lines | Functions | Branches | Priority |
|-----------|-------|-----------|----------|----------|
| `src/core/` | 90% | 90% | 85% | High |
| `src/indexer/` | 85% | 85% | 80% | High |
| `src/vector-db/` | 85% | 85% | 80% | High |
| `src/token-optimizer/` | 90% | 90% | 85% | High |
| `src/cli/` | 80% | 80% | 75% | Medium |
| `src/mcp/` | 85% | 85% | 80% | High |
| `src/utils/` | 75% | 75% | 70% | Low |

### 4.2 Generating Coverage Reports

```bash
# Run tests with coverage
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html

# Check specific file coverage
npm run test:coverage -- tests/unit/vector-db/
```

**Coverage report formats:**
- `text` - Console output
- `json` - Machine-readable
- `html` - Interactive browser report
- `lcov` - For CI/CD integration

### 4.3 Coverage Exclusions

```typescript
// vitest.config.ts
coverage: {
  exclude: [
    'node_modules/',
    'dist/',
    'prism-indexer/',
    'tests/',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/*.d.ts',
    '**/types.ts',  // Type definition files
    '**/index.ts',  // Barrel exports
  ],
}
```

---

## 5. Running Tests Locally

### 5.1 Basic Test Commands

```bash
# Run all tests
npm test

# Run tests once
npm run test:unit

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/vector-db/storage.test.ts

# Run tests matching pattern
npm test -- --grep "VectorStorage"

# Run tests with verbose output
npm test -- --reporter=verbose
```

### 5.2 Debugging Tests

```bash
# Run with Node debugger
node --inspect-brk node_modules/.bin/vitest --run tests/unit/vector-db/

# Or use VS Code debugger
# Set breakpoint in test, then press F5

# Run with debug output
DEBUG=* npm test

# Run specific test with debugging
npm test -- tests/unit/vector-db/storage.test.ts --reporter=verbose
```

### 5.3 Test Modes

**Watch mode:**
```bash
npm run test:watch
```
- Reruns tests on file changes
- Fast feedback during development
- Press `q` to quit

**Interactive mode:**
```bash
npm test -- --inspect
```
- Opens browser debugger
- Set breakpoints in code

**Profile mode:**
```bash
npm test -- --reporter=verbose --coverage
```
- Shows slowest tests
- Helps identify performance issues

---

## 6. CI/CD Pipeline

### 6.1 GitHub Actions Workflow

**`.github/workflows/test.yml`:**

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          toolchain: stable
          targets: wasm32-unknown-unknown

      - name: Install wasm-pack
        run: cargo install wasm-pack

      - name: Build WASM
        run: npm run build:wasm

      - name: Build TypeScript
        run: npm run build:ts

      - name: Run linter
        run: npm run lint

      - name: Run type checker
        run: npm run typecheck

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Generate coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  test-ollama:
    runs-on: ubuntu-latest

    services:
      ollama:
        image: ollama/ollama
        ports:
          - 11434:11434

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18.x'

      - name: Install dependencies
        run: npm ci

      - name: Pull Ollama model
        run: docker exec ${{ job.services.ollama.id }} ollama pull deepseek-coder-v2

      - name: Run Ollama tests
        run: npm run test:ollama
        env:
          OLLAMA_ENDPOINT: http://localhost:11434
```

### 6.2 Pre-commit Hooks

**`.husky/pre-commit`:**

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run linter
npm run lint -- --fix

# Run type checker
npm run typecheck

# Run unit tests
npm test -- --passWithNoTests

# Check formatting
npm run format -- --check
```

### 6.3 Pre-push Hooks

**`.husky/pre-push`:**

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run all tests
npm test

# Run integration tests
npm run test:integration

# Check coverage
npm run test:coverage
```

---

## 7. Test Data Management

### 7.1 Fixtures

**Code sample fixtures:**

```typescript
// tests/fixtures/code-samples.ts
export const FIXTURES = {
  typescript: {
    simple: `
      function add(a: number, b: number): number {
        return a + b;
      }
    `,
    complex: `
      export class UserService {
        constructor(private db: Database) {}

        async findUser(id: string): Promise<User | null> {
          const result = await this.db.query(
            'SELECT * FROM users WHERE id = ?',
            [id]
          );
          return result.rows[0] || null;
        }
      }
    `,
  },
  python: {
    simple: `
      def add(a, b):
          return a + b
    `,
  },
};
```

### 7.2 Test Database Setup

```typescript
// tests/helpers/database.ts
export async function setupTestDatabase(): Promise<VectorDatabase> {
  const db = new VectorDatabase(':memory:');

  // Seed with test data
  await db.upsert([
    { id: 'test-1', values: [1, 0, 0], metadata: { name: 'test' } },
    { id: 'test-2', values: [0, 1, 0], metadata: { name: 'test' } },
    { id: 'test-3', values: [0, 0, 1], metadata: { name: 'test' } },
  ]);

  return db;
}

export async function cleanupTestDatabase(db: VectorDatabase): Promise<void> {
  await db.close();
}
```

### 7.3 Temporary File Management

```typescript
// tests/helpers/files.ts
import { mkdtemp, rmdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export async function createTempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'prism-test-'));
}

export async function cleanupTempDir(dir: string): Promise<void> {
  await rmdir(dir, { recursive: true });
}

export async function createTestFile(
  dir: string,
  name: string,
  content: string
): Promise<void> {
  await writeFile(join(dir, name), content);
}
```

---

## 8. Best Practices

### 8.1 DO's

**DO write descriptive test names:**
```typescript
it('should return empty array when no vectors match query', () => { });
```

**DO use arrange-act-assert pattern:**
```typescript
it('should calculate token savings', () => {
  // Arrange
  const original = 10000;
  const optimized = 1000;

  // Act
  const savings = calculateSavings(original, optimized);

  // Assert
  expect(savings.percentage).toBe(90);
});
```

**DO test edge cases:**
```typescript
it('should handle empty input', () => { });
it('should handle null values', () => { });
it('should handle maximum allowed values', () => { });
```

**DO mock external dependencies:**
```typescript
vi.mock('@cloudflare/workers-types', () => ({
  // Mock implementation
}));
```

**DO keep tests independent:**
```typescript
// Each test should setup and cleanup its own state
beforeEach(() => {
  // Setup
});
afterEach(() => {
  // Cleanup
});
```

### 8.2 DON'Ts

**DON'T test implementation details:**
```typescript
// Bad
it('should call the database twice', () => {
  expect(db.query).toHaveBeenCalledTimes(2);
});

// Good
it('should return cached result on second call', () => {
  const result1 = await service.getData();
  const result2 = await service.getData();
  expect(result1).toEqual(result2);
});
```

**DON'T write fragile tests:**
```typescript
// Bad - depends on exact timing
it('should complete in 100ms', async () => {
  const start = Date.now();
  await operation();
  expect(Date.now() - start).toBeLessThan(100);
});

// Good - uses reasonable timeout
it('should complete quickly', async () => {
  await expect(operation()).resolves.toBeDefined();
}, 200);
```

**DON'T skip tests without reason:**
```typescript
// Bad
it.skip('should handle large files', () => { });

// Good
it('should handle large files', () => {
  // Implementation
}, 30000); // 30s timeout for large file test
```

---

## 9. Troubleshooting

### 9.1 Common Issues

**Issue: "Cannot find module"**
```bash
# Solution: Build TypeScript first
npm run build:ts
npm test
```

**Issue: "WASM module not initialized"**
```bash
# Solution: Build WASM first
npm run build:wasm
npm test
```

**Issue: Tests timeout**
```bash
# Solution: Increase timeout for specific tests
it('slow test', () => { }, 30000); // 30s timeout
```

**Issue: Mocks not working**
```bash
# Solution: Clear module cache
vi.clearAllMocks();
vi.resetModules();
```

### 9.2 Debug Commands

```bash
# Run with verbose output
npm test -- --reporter=verbose

# Run with debug logging
DEBUG=vitest* npm test

# Run specific test file
npm test -- path/to/test.test.ts

# Run tests matching pattern
npm test -- --grep "VectorStorage"
```

---

**Document Status**: Complete
**Last Updated**: 2026-01-13
**Next Review**: After major framework updates
