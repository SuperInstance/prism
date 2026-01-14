# PRISM v1.0 Testing Strategy

**Version:** 1.0
**Last Updated:** 2025-01-14
**Status:** Active

---

## Executive Summary

This document defines the comprehensive testing strategy for PRISM v1.0, a codebase indexing and RAG engine. Our goal is to achieve **80%+ code coverage** for critical paths while maintaining fast, reliable, and maintainable tests.

### Key Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Overall Code Coverage | 80% | ~15% |
| Unit Test Coverage | 85% | ~20% |
| Integration Test Coverage | 70% | ~10% |
| E2E Test Coverage | 60% | ~5% |
| Test Execution Time | <30s | TBD |
| Critical Path Coverage | 95% | ~25% |

---

## Testing Philosophy

### Principles

1. **Fast Feedback**: Unit tests should run in milliseconds
2. **Isolation**: Tests should not depend on each other
3. **Determinism**: Same inputs = same outputs every time
4. **Clarity**: Tests should document expected behavior
5. **Maintainability**: Tests should be easy to update when code changes

### Test Pyramid

```
         E2E Tests (10%)
        ───────────────
       Integration Tests (30%)
      ────────────────────────
     Unit Tests (60%)
    ───────────────────────────────
```

- **Unit Tests**: Test individual functions and classes in isolation
- **Integration Tests**: Test interactions between components
- **E2E Tests**: Test complete user workflows

---

## Test Coverage Requirements

### Critical Path Coverage (95%+)

These are the core workflows that MUST work for PRISM to function:

1. **Indexing Workflow**
   - File discovery and filtering
   - Code parsing and chunking
   - Embedding generation
   - Vector storage

2. **Search Workflow**
   - Query processing
   - Vector similarity search
   - Result ranking and scoring
   - Context optimization

3. **Configuration Management**
   - Config loading and validation
   - Default value handling
   - User override behavior

### High Priority Coverage (80%+)

Important features that users interact with directly:

1. **CLI Commands**
   - `prism index`
   - `prism search`
   - `prism chat`
   - `prism stats`

2. **Token Optimization**
   - Chunk selection algorithms
   - Compression strategies
   - Budget management

3. **Vector Database**
   - CRUD operations
   - Search functionality
   - Performance optimizations

### Medium Priority Coverage (60%+)

Supporting functionality:

1. **Error Handling**
   - Validation errors
   - File system errors
   - Network errors

2. **Utilities**
   - Path manipulation
   - Token estimation
   - Formatting helpers

3. **Model Router**
   - Model selection logic
   - Fallback behavior

### Low Priority Coverage (40%+)

Nice-to-have features:

1. **MCP Server**
   - Tool registration
   - Request handling

2. **Metrics Collection**
   - Performance tracking
   - Statistics aggregation

3. **Ollama Integration**
   - Health checks
   - Model detection

---

## Test Organization

### Directory Structure

```
tests/
├── unit/                      # Unit tests
│   ├── core/
│   │   ├── PrismEngine.test.ts
│   │   └── types.test.ts
│   ├── vector-db/
│   │   └── SQLiteVectorDB.test.ts
│   ├── token-optimizer/
│   │   └── TokenOptimizer.test.ts
│   ├── scoring/
│   │   └── ScoringService.test.ts
│   ├── config/
│   │   └── loader.test.ts
│   ├── cli/
│   │   ├── index.test.ts
│   │   ├── search.test.ts
│   │   └── stats.test.ts
│   └── utils/
│       ├── tokenization.test.ts
│       └── formatting.test.ts
├── integration/               # Integration tests
│   ├── indexing-workflow.test.ts
│   ├── search-workflow.test.ts
│   └── config-workflow.test.ts
├── e2e/                       # End-to-end tests
│   ├── cli-index-search.test.ts
│   └── cli-chat.test.ts
├── fixtures/                  # Test data and fixtures
│   ├── code-samples/
│   │   ├── typescript/
│   │   ├── javascript/
│   │   └── python/
│   ├── mock-db.ts
│   └── test-config.ts
└── helpers/                   # Test utilities
    ├── test-helpers.ts
    └── assertions.ts
```

---

## Unit Testing Strategy

### Framework: Vitest

**Why Vitest?**
- Native ESM support
- Fast execution (Vite-powered)
- Compatible with Jest API
- Built-in TypeScript support
- Good watch mode

### Configuration

```typescript
// vitest.config.ts
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
        'tests/',
      ],
    },
  },
});
```

### Unit Test Templates

#### Template 1: Pure Function Tests

```typescript
describe('functionName', () => {
  it('should handle normal input', () => {
    const result = functionName('normal input');
    expect(result).toBe('expected output');
  });

  it('should handle edge case', () => {
    const result = functionName('');
    expect(result).toBe('');
  });

  it('should throw on invalid input', () => {
    expect(() => functionName(null)).toThrow();
  });
});
```

#### Template 2: Class Tests

```typescript
describe('ClassName', () => {
  let instance: ClassName;

  beforeEach(() => {
    instance = new ClassName(config);
  });

  afterEach(() => {
    instance.cleanup?.();
  });

  describe('methodOne', () => {
    it('should do something', async () => {
      const result = await instance.methodOne(input);
      expect(result).toEqual(expected);
    });
  });
});
```

#### Template 3: Async Operation Tests

```typescript
describe('async operation', () => {
  it('should resolve with correct value', async () => {
    const result = await asyncOperation();
    expect(result).toBe(expected);
  });

  it('should reject with error', async () => {
    await expect(asyncOperation(invalid)).rejects.toThrow(Error);
  });

  it('should timeout after duration', async () => {
    await expect(asyncOperation(slowInput)).rejects.toThrow('timeout');
  });
});
```

---

## Integration Testing Strategy

### Scope

Integration tests verify that multiple components work together correctly. They should:

1. Test real interactions between components
2. Use real databases (in-memory)
3. Avoid mocking internal implementation
4. Focus on component boundaries

### Key Integration Flows

#### 1. Indexing Integration

```typescript
describe('Indexing Workflow', () => {
  it('should index a directory of files', async () => {
    const engine = new PrismEngine({ dbPath: ':memory:' });
    const result = await engine.index('./fixtures/test-code');
    expect(result.chunks).toBeGreaterThan(0);
    expect(result.errors).toBe(0);
  });
});
```

#### 2. Search Integration

```typescript
describe('Search Workflow', () => {
  let engine: PrismEngine;

  beforeEach(async () => {
    engine = new PrismEngine({ dbPath: ':memory:' });
    await engine.index('./fixtures/test-code');
  });

  it('should return relevant results', async () => {
    const results = await engine.search('function test');
    expect(results).toHaveLength(5);
    expect(results[0].score).toBeGreaterThan(0.5);
  });
});
```

#### 3. Configuration Integration

```typescript
describe('Configuration Workflow', () => {
  it('should load and validate config', async () => {
    const config = await loadConfig('./fixtures/test-config.yaml');
    expect(config.indexer.chunkSize).toBe(500);
  });

  it('should merge user config with defaults', async () => {
    const config = await loadConfig('./fixtures/partial-config.yaml');
    expect(config.vectorDB.type).toBe('sqlite');
  });
});
```

---

## End-to-End Testing Strategy

### Scope

E2E tests simulate real user workflows through the CLI:

1. Execute actual CLI commands
2. Use temporary directories
3. Verify output and side effects
4. Clean up after tests

### Key E2E Flows

#### 1. Index and Search

```typescript
describe('CLI: Index and Search', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTempDir();
    await copyFixtures(testDir);
  });

  it('should index and search code', async () => {
    // Index
    await execAsync(`prism index ${testDir}`);
    expect(await dbExists(testDir)).toBe(true);

    // Search
    const { stdout } = await execAsync(`prism search "test function"`);
    expect(stdout).toContain('results found');
  });
});
```

#### 2. Chat Workflow

```typescript
describe('CLI: Chat', () => {
  it('should provide context for chat', async () => {
    await execAsync(`prism index ./test-code`);
    const { stdout } = await execAsync(`prism chat "fix bug in auth"`);
    expect(stdout).toContain('relevant code');
  });
});
```

---

## Test Fixtures

### Code Samples

We need representative code samples for testing:

```
fixtures/
├── code-samples/
│   ├── typescript/
│   │   ├── simple-function.ts
│   │   ├── class-with-methods.ts
│   │   ├── complex-module.ts
│   │   └── edge-cases.ts
│   ├── javascript/
│   │   └── es6-code.js
│   └── python/
│       ├── simple-script.py
│       └── class-based.py
├── configs/
│   ├── valid-config.yaml
│   ├── partial-config.yaml
│   └── invalid-config.yaml
└── databases/
    └── empty.db
```

### Mock Data

```typescript
// fixtures/mock-data.ts
export const mockChunks: CodeChunk[] = [
  {
    id: 'chunk1',
    filePath: '/test/file1.ts',
    content: 'function test() { return true; }',
    startLine: 1,
    endLine: 1,
    language: 'typescript',
    symbols: ['test'],
    dependencies: [],
  },
  // ... more chunks
];

export const mockEmbeddings: number[][] = [
  [0.1, 0.2, 0.3, ...],
  [0.4, 0.5, 0.6, ...],
  // ... more embeddings
];
```

---

## Performance Testing

### Benchmarks

We need to ensure PRISM meets performance targets:

```typescript
describe('Performance', () => {
  it('should index 1M LOC in <30s', async () => {
    const start = Date.now();
    await engine.index('./fixtures/large-codebase');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(30000);
  });

  it('should search in <100ms', async () => {
    const start = Date.now();
    await engine.search('test query');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
```

### Load Testing

```typescript
describe('Load Testing', () => {
  it('should handle 100 concurrent searches', async () => {
    const promises = Array(100).fill(null).map(() =>
      engine.search('test query')
    );
    const results = await Promise.all(promises);
    expect(results).toHaveLength(100);
  });
});
```

---

## Security Testing

### Input Validation

```typescript
describe('Security', () => {
  it('should reject path traversal attempts', async () => {
    await expect(
      engine.index('../../../etc/passwd')
    ).rejects.toThrow();
  });

  it('should sanitize malicious queries', async () => {
    const results = await engine.search("'; DROP TABLE chunks; --");
    expect(results).toEqual([]);
  });

  it('should validate config before loading', async () => {
    await expect(
      loadConfig('./fixtures/malicious-config.yaml')
    ).rejects.toThrow();
  });
});
```

---

## Error Handling Tests

### Expected Errors

```typescript
describe('Error Handling', () => {
  it('should handle missing files gracefully', async () => {
    const result = await engine.index('/nonexistent/path');
    expect(result.errors).toBeGreaterThan(0);
  });

  it('should provide helpful error messages', async () => {
    try {
      await engine.search('');
    } catch (error) {
      expect(error.message).toContain('query cannot be empty');
    }
  });

  it('should recover from database errors', async () => {
    const db = new SQLiteVectorDB({ path: '/readonly/path' });
    await expect(db.insert(mockChunk)).rejects.toThrow();
    // Should fallback to alternative storage
  });
});
```

---

## Test Helpers

### Custom Assertions

```typescript
// helpers/assertions.ts
export function assertValidChunk(chunk: CodeChunk) {
  expect(chunk.id).toBeDefined();
  expect(chunk.content).toBeTruthy();
  expect(chunk.startLine).toBeGreaterThan(0);
  expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
}

export function assertValidScore(score: number) {
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(1);
}
```

### Test Utilities

```typescript
// helpers/test-utils.ts
export async function createTempDir(): Promise<string> {
  const tmp = os.tmpdir();
  const dir = path.join(tmp, `prism-test-${Date.now()}`);
  await fs.ensureDir(dir);
  return dir;
}

export async function cleanupTempDir(dir: string): Promise<void> {
  await fs.remove(dir);
}

export function createMockEngine(): PrismEngine {
  return new PrismEngine({ dbPath: ':memory:' });
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm run test:unit
      - name: Run integration tests
        run: npm run test:integration
      - name: Generate coverage
        run: npm run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Coverage Goals by Module

| Module | Target Coverage | Priority |
|--------|----------------|----------|
| PrismEngine | 90% | Critical |
| SQLiteVectorDB | 85% | High |
| ScoringService | 80% | High |
| TokenOptimizer | 85% | High |
| Config Loader | 90% | Critical |
| CLI Commands | 75% | Medium |
| Indexer | 85% | High |
| Model Router | 70% | Medium |
| MCP Server | 60% | Low |
| Utilities | 80% | Medium |

---

## Testing Best Practices

### DO's

1. **Write tests before fixing bugs** - This ensures the bug is reproducible
2. **Test edge cases** - Empty inputs, null values, boundary conditions
3. **Use descriptive test names** - `should return error when input is null`
4. **Keep tests independent** - Each test should work in isolation
5. **Mock external dependencies** - Network calls, file system
6. **Clean up resources** - Close database connections, delete temp files

### DON'Ts

1. **Don't test implementation details** - Test behavior, not code
2. **Don't write brittle tests** - Tests that break on refactoring
3. **Don't ignore tests** - Fix or delete failing tests immediately
4. **Don't test third-party code** - Trust library authors to test their code
5. **Don't make tests too complex** - Complex tests are hard to maintain

---

## Continuous Improvement

### Weekly Reviews

1. Review coverage reports
2. Identify untested critical paths
3. Add tests for high-risk areas
4. Remove or update outdated tests

### Monthly Audits

1. Analyze test flakiness
2. Optimize slow tests
3. Refactor duplicated test code
4. Update fixtures and mocks

### Quarterly Goals

1. Achieve coverage targets
2. Reduce test execution time
3. Improve test reliability
4. Expand E2E test suite

---

## Test Execution

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only

```bash
npm run test:unit
```

### Run Integration Tests Only

```bash
npm run test:integration
```

### Run with Coverage

```bash
npm run test:coverage
```

### Run Specific Test File

```bash
npx vitest tests/unit/core/PrismEngine.test.ts
```

### Run in Watch Mode

```bash
npx vitest --watch
```

---

## Success Criteria

PRISM v1.0 is considered "test-ready" when:

- [ ] Overall code coverage > 80%
- [ ] All critical paths have > 95% coverage
- [ ] Test suite runs in < 30 seconds
- [ ] Zero flaky tests in CI/CD
- [ ] All E2E tests pass consistently
- [ ] Performance benchmarks meet targets
- [ ] Security tests pass
- [ ] Documentation is complete

---

## Appendix: Test Checklist

### Pre-Commit Checklist

- [ ] All new code has tests
- [ ] All tests pass locally
- [ ] Coverage hasn't decreased
- [ ] No console warnings in tests
- [ ] Tests are fast (< 5s per file)

### Pre-Merge Checklist

- [ ] CI/CD tests pass
- [ ] Coverage report reviewed
- [ ] No flaky tests introduced
- [ ] Documentation updated
- [ ] Performance impact assessed

---

**Next Steps:**

1. Implement missing unit tests (see `/tests/unit/` for existing tests)
2. Create integration test suite
3. Add E2E tests for CLI workflows
4. Set up CI/CD pipeline
5. Establish coverage reporting
6. Create test fixtures and helpers

---

**Questions?** Refer to:
- `/docs/architecture/` for system design details
- `/CLAUDE.md` for development guidelines
- `/README.md` for project overview
