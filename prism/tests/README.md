# PRISM Test Suite

This directory contains the comprehensive test suite for PRISM v1.0.

## Test Structure

```
tests/
├── unit/                      # Unit tests
│   ├── core/                  # Core engine tests
│   ├── token-optimizer/       # Token optimizer tests
│   ├── scoring/               # Scoring service tests
│   ├── config/                # Configuration tests
│   ├── cli/                   # CLI command tests
│   └── utils/                 # Utility function tests
├── integration/               # Integration tests
│   ├── indexing-workflow.test.ts
│   └── search-workflow.test.ts
├── e2e/                       # End-to-end tests
│   └── cli-workflows.test.ts
├── fixtures/                  # Test data
│   ├── code-samples/          # Sample code files
│   └── configs/               # Sample configurations
└── helpers/                   # Test utilities
    └── test-utils.ts
```

## Running Tests

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

## Test Framework

We use **Vitest** as our test framework. Key features:

- Native ESM support
- Fast execution (Vite-powered)
- Compatible with Jest API
- Built-in TypeScript support
- Excellent watch mode

## Writing Tests

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YourClass } from '../../src/your-module.js';

describe('YourClass', () => {
  let instance: YourClass;

  beforeEach(() => {
    instance = new YourClass();
  });

  afterEach(() => {
    instance.cleanup?.();
  });

  describe('methodName', () => {
    it('should do something expected', () => {
      const result = instance.methodName('input');
      expect(result).toBe('expected output');
    });

    it('should handle edge case', () => {
      expect(() => instance.methodName(null)).toThrow();
    });
  });
});
```

### Integration Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDir, cleanupTempDir } from '../helpers/test-utils.js';

describe('Workflow Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should complete the workflow', async () => {
    // Setup
    await createTempFile(tempDir, 'test.ts', 'code');

    // Execute
    const result = await someWorkflow(tempDir);

    // Verify
    expect(result).toBeDefined();
  });
});
```

## Test Utilities

### createTempDir()

Create a temporary directory for testing:

```typescript
const tempDir = await createTempDir();
// Use tempDir for files
await cleanupTempDir(tempDir);
```

### createMockChunk(overrides?)

Create a mock CodeChunk object:

```typescript
const chunk = createMockChunk({
  content: 'custom content',
  language: 'python',
});
```

### createMockChunks(count, overrides?)

Create multiple mock chunks:

```typescript
const chunks = createMockChunks(10, {
  language: 'typescript',
});
```

### assertValidChunk(chunk)

Assert that a chunk has valid properties:

```typescript
assertValidChunk(chunk); // Throws if invalid
```

## Test Fixtures

### Code Samples

Located in `/tests/fixtures/code-samples/`:

- `typescript/` - TypeScript code samples
- `javascript/` - JavaScript code samples
- `python/` - Python code samples

### Configurations

Located in `/tests/fixtures/configs/`:

- `valid-config.yaml` - Valid configuration
- `partial-config.yaml` - Partial configuration (merges with defaults)
- `invalid-config.yaml` - Invalid configuration (for validation tests)

## Coverage Goals

| Module | Target | Status |
|--------|--------|--------|
| PrismEngine | 90% | 🟡 In Progress |
| SQLiteVectorDB | 85% | ✅ Complete |
| ScoringService | 80% | ✅ Complete |
| TokenOptimizer | 85% | ✅ Complete |
| Config Loader | 90% | ✅ Complete |
| CLI Commands | 75% | 🔄 Pending |
| Indexer | 85% | 🔄 Pending |
| Model Router | 70% | 🔄 Pending |

## Best Practices

### DO's

1. **Write tests before fixing bugs** - Ensures reproducibility
2. **Test edge cases** - Empty inputs, null values, boundaries
3. **Use descriptive test names** - `should return error when input is null`
4. **Keep tests independent** - Each test works in isolation
5. **Clean up resources** - Close connections, delete temp files

### DON'Ts

1. **Don't test implementation details** - Test behavior
2. **Don't write brittle tests** - Tests that break on refactoring
3. **Don't ignore tests** - Fix or delete failing tests
4. **Don't test third-party code** - Trust library authors
5. **Don't make tests too complex** - Complex tests are hard to maintain

## CI/CD Integration

Tests run automatically on:

- Every push to main branch
- Every pull request
- Before release

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: npm test
```

## Troubleshooting

### Tests Fail Locally but Pass in CI

- Check Node.js version matches CI
- Clear cache: `rm -rf node_modules/.cache`
- Install dependencies: `npm ci`

### Slow Tests

- Use `vi.useRealTimers()` to restore real timers
- Avoid unnecessary `await` in loops
- Use mock implementations for slow operations

### Flaky Tests

- Ensure proper cleanup in `afterEach`
- Avoid shared state between tests
- Use unique IDs for temp resources

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Strategy](/docs/development/testing-strategy-v1.md)
- [Project README](/README.md)

## Contributing Tests

When adding new features:

1. Write tests first (TDD)
2. Ensure new tests pass
3. Update coverage documentation
4. Add test fixtures if needed
5. Update this README if adding new test categories

## Questions?

See `/docs/development/testing-strategy-v1.md` for comprehensive testing guidelines.
