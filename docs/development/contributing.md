# Contributing Guide

**Component**: PRISM Development Guide
**Status**: Development Document
**Priority**: Foundational
**Last Updated**: 2026-01-13

## Purpose

This document provides comprehensive guidelines for contributing to PRISM, including code of conduct, pull request process, code style guidelines, commit message conventions, and review checklist.

---

## Table of Contents

1. [Code of Conduct](#1-code-of-conduct)
2. [Getting Started](#2-getting-started)
3. [Pull Request Process](#3-pull-request-process)
4. [Code Style Guidelines](#4-code-style-guidelines)
5. [Commit Message Conventions](#5-commit-message-conventions)
6. [Review Checklist](#6-review-checklist)
7. [Getting Help](#7-getting-help)

---

## 1. Code of Conduct

### 1.1 Our Pledge

We are committed to making participation in our project a harassment-free experience for everyone, regardless of level of experience, gender, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

### 1.2 Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- The use of sexualized language or imagery
- Trolling, insulting/derogatory comments, or personal/political attacks
- Public or private harassment
- Publishing others' private information (such as physical or electronic addresses) without explicit permission
- Other unethical or unprofessional conduct

### 1.3 Responsibilities

Project maintainers are responsible for clarifying the standards of acceptable behavior and are expected to take appropriate and fair corrective action in response to any instances of unacceptable behavior.

### 1.4 Scope

This Code of Conduct applies both within project spaces and in public spaces when an individual is representing the project or its community.

### 1.5 Reporting

If you witness or experience unacceptable behavior, please contact the project team at [INSERT CONTACT EMAIL]. All complaints will be reviewed and investigated and will result in a response that is deemed necessary and appropriate to the circumstances.

---

## 2. Getting Started

### 2.1 Finding Issues to Work On

**Good First Issues:**
- Look for issues labeled `good first issue`
- These are typically smaller, well-scoped tasks
- Perfect for new contributors

**Help Wanted:**
- Issues labeled `help wanted` need community help
- May require more experience but are valuable contributions

**Feature Requests:**
- Discuss major features in issues first
- Get feedback from maintainers before starting
- Avoid wasted effort on features that won't be accepted

### 2.2 Setting Up Your Development Environment

Follow the [Development Setup Guide](setup.md) to get your environment ready.

### 2.3 Understanding the Codebase

**Read these first:**
1. `README.md` - Project overview
2. `docs/architecture/01-system-overview.md` - System architecture
3. `docs/architecture/02-data-flow.md` - Data flow overview

**Key modules to understand:**
- `src/core/` - Core PRISM engine
- `src/indexer/` - Code indexing pipeline
- `src/vector-db/` - Vector database abstraction
- `src/token-optimizer/` - Token optimization logic
- `src/cli/` - Command-line interface
- `prism-indexer/` - Rust WASM indexer

---

## 3. Pull Request Process

### 3.1 Workflow Overview

```
1. Find/Create Issue → 2. Fork & Branch → 3. Make Changes →
4. Test → 5. Commit → 6. Push → 7. Create PR → 8. Address Review → 9. Merge
```

### 3.2 Step-by-Step Process

#### Step 1: Find or Create an Issue

```bash
# Search for existing issues
gh issue list --label "good first issue"

# Or create a new issue (for bugs or feature requests)
gh issue create --title "Short description" --body "Detailed description"
```

#### Step 2: Fork and Branch

```bash
# Fork the repository on GitHub
# Then clone your fork

git clone https://github.com/YOUR_USERNAME/prism.git
cd prism

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/prism.git

# Create a feature branch
git checkout -b feature/your-feature-name
# Or for bugs: git checkout -b fix/your-bug-fix
```

**Branch naming conventions:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests
- `perf/` - Performance improvements
- `chore/` - Build process or auxiliary tool changes

#### Step 3: Make Changes

```bash
# Make your changes
# ... edit files ...

# Check what changed
git status
git diff
```

#### Step 4: Test Your Changes

```bash
# Run linter
npm run lint

# Run type checker
npm run typecheck

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# If you changed Rust code, rebuild WASM
npm run build:wasm
```

**Testing requirements:**
- All tests must pass
- New features must include tests
- Bug fixes must include regression tests
- Maintain or improve test coverage

#### Step 5: Commit Changes

```bash
# Stage your changes
git add .

# Commit with conventional commit message (see Section 5)
git commit -m "feat(indexer): add support for Python files"
```

#### Step 6: Push to Your Fork

```bash
# Push your branch
git push origin feature/your-feature-name

# Keep your branch up to date with upstream
git fetch upstream
git rebase upstream/main
git push origin feature/your-feature-name --force-with-lease
```

#### Step 7: Create Pull Request

```bash
# Create PR via GitHub CLI
gh pr create --title "feat(indexer): add support for Python files" \
             --body "Detailed description of changes"

# Or create PR on GitHub web interface
```

**PR Template:**
```markdown
## Description
Brief description of what this PR does and why it's needed.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issue
Fixes #123
Related to #456

## Changes Made
- Added Python language support to indexer
- Updated tests to cover Python parsing
- Updated documentation

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] All tests pass locally

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added to complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
- [ ] Coverage maintained or improved

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Additional Notes
Any additional information reviewers should know.
```

#### Step 8: Address Review Feedback

```bash
# Make requested changes
git add .
git commit -m "fix: address review feedback"

# Push updates
git push origin feature/your-feature-name

# Continue iterating until approved
```

**Responding to review:**
- Address all review comments
- Explain reasoning if you disagree
- Mark comments as resolved
- Be respectful and professional

#### Step 9: Merge

Once your PR is approved:
- Maintainer will squash and merge
- Your branch will be deleted
- You can delete your local branch
```bash
git checkout main
git branch -d feature/your-feature-name
```

### 3.3 PR Review Guidelines

**For Reviewers:**
- Be constructive and respectful
- Explain reasoning for suggestions
- Approve if changes are good enough (not perfect)
- Test changes locally if possible
- Respond within 48 hours

**For Authors:**
- Respond to all review comments
- Make requested changes promptly
- Ask for clarification if needed
- Be patient with review process

---

## 4. Code Style Guidelines

### 4.1 TypeScript Style

**Naming Conventions:**

```typescript
// Classes: PascalCase
class VectorDatabase { }

// Interfaces: PascalCase with 'I' prefix
interface IVectorDatabase {
  search(query: number[]): Promise<SearchResult[]>;
}

// Types: PascalCase
type SearchResult = {
  id: string;
  score: number;
};

// Functions: camelCase
function searchVector() { }

// Constants: UPPER_SNAKE_CASE
const MAX_RESULTS = 100;
const DEFAULT_TIMEOUT = 5000;

// Private members: underscore prefix
class Example {
  private _internal: string;
  private readonly _config: Config;
}

// Enums: PascalCase
enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Error = 'error',
}
```

**File Organization:**

```typescript
// 1. Imports (grouped and sorted)
// External dependencies
import { promises as fs } from 'fs';
import path from 'path';

// Internal modules
import { IVectorDatabase } from './vector-db';
import { logger } from './utils/logger';

// Types
import type { Config } from './types';

// 2. Type definitions
interface MyInterface {
  property: string;
}

type MyType = string | number;

// 3. Constants
const CONSTANT = 'value';

// 4. Class/function implementation
class MyClass implements IMyInterface {
  // Public properties
  public prop: string;

  // Constructor
  constructor(prop: string) {
    this.prop = prop;
  }

  // Public methods
  public doSomething(): void {
    // Implementation
  }

  // Private methods
  private _helper(): void {
    // Implementation
  }
}

// 5. Exports
export { MyClass };
export type { MyType };
```

**Best Practices:**

```typescript
// Use async/await over Promises
async function getData(): Promise<Data> {
  const response = await fetch(url);
  return response.json();
}

// Use const/let over var
const data = [];
for (let i = 0; i < 10; i++) {
  data.push(i);
}

// Use template literals over string concatenation
const message = `Hello ${name}, you have ${count} messages`;

// Use arrow functions for callbacks
array.forEach(item => console.log(item));

// Use destructuring
const { name, age } = user;
const [first, second] = array;

// Use spread operator over Object.assign
const merged = { ...obj1, ...obj2 };

// Use nullish coalescing over ||
const value = input ?? defaultValue;

// Use optional chaining
const value = object?.property?.nested;

// Use type guards
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Use enums for constants
enum LogLevel {
  Debug = 'debug',
  Info = 'info',
}

// Avoid 'any'
const data: unknown = getInput();  // Better than any

// Use readonly for immutable data
interface Config {
  readonly name: string;
  readonly values: readonly string[];
}
```

**Code Formatting:**

- Use Prettier for automatic formatting
- Configure `.prettierrc` in project root
- Run `npm run format` to format all files

**Default Prettier configuration:**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### 4.2 Rust Style

**Naming Conventions:**

```rust
// Functions: snake_case
fn parse_file() { }

// Structs: PascalCase
struct CodeElement { }

// Constants: UPPER_SNAKE_CASE
const MAX_SIZE: usize = 1024;

// Type parameters: PascalCase, short (T, U, E)
fn generic<T>(value: T) { }

// Macro names: snake_case (with snake_case! for macros)
macro_rules! vec_map { }
```

**Best Practices:**

```rust
// Use Result for errors
fn parse_code(code: &str) -> Result<ParsedCode, ParseError> {
    // Implementation
}

// Use Option for nullable values
fn get_item(id: usize) -> Option<Item> {
    // Implementation
}

// Use ? operator for error propagation
fn read_file(path: &Path) -> Result<String, io::Error> {
    let content = fs::read_to_string(path)?;
    Ok(content)
}

// Use iterators over loops
let sum: i32 = (0..10).map(|x| x * 2).sum();

// Use match for multiple conditions
match value {
    1 => println!("one"),
    2 => println!("two"),
    _ => println!("other"),
}

// Use if let for simple pattern matching
if let Some(value) = optional {
    println!("Got: {}", value);
}

// Use impl Trait for arguments
fn process(item: impl Display) { }

// Avoid unwrap() in production code
// Bad: let value = optional.unwrap();
// Good: let value = optional.expect("Value should exist");
```

### 4.3 Documentation Style

**Function Documentation:**

```typescript
/**
 * Search for similar vectors in the database.
 *
 * @param query - The query vector to search for
 * @param options - Search options including topK and filters
 * @returns Promise resolving to array of search results
 * @throws {VectorDatabaseError} If search fails
 *
 * @example
 * ```typescript
 * const results = await vectorDB.search(
 *   [0.1, 0.2, 0.3],
 *   { topK: 10, filter: { type: 'function' } }
 * );
 * ```
 */
async function search(
  query: number[],
  options: SearchOptions
): Promise<SearchResult[]> {
  // Implementation
}
```

**Code Comments:**

```typescript
// Good: Explain WHY, not WHAT
// We use cosine similarity instead of euclidean distance because
// it's more efficient for high-dimensional vectors
function similarity(a: number[], b: number[]): number {
  // Implementation
}

// Bad: Explains what is obvious
// Calculate similarity
function similarity(a: number[], b: number[]): number {
  // Implementation
}

// Good: Explain complex logic
// This algorithm uses a greedy approach with 10% lookahead
// to balance speed (O(n)) with quality (within 5% of optimal)
function optimize(chunks: CodeChunk[]): CodeChunk[] {
  // Implementation
}
```

---

## 5. Commit Message Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### 5.1 Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 5.2 Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(indexer): add support for Go language` |
| `fix` | Bug fix | `fix(vector): handle empty search results correctly` |
| `docs` | Documentation changes | `docs(api): update token optimizer interface` |
| `style` | Code style changes (formatting, etc) | `style(cli): fix indentation in help text` |
| `refactor` | Code refactoring | `refactor(optimizer): simplify scoring algorithm` |
| `test` | Adding or updating tests | `test(indexer): add tests for error handling` |
| `chore` | Build process or auxiliary tool changes | `chore: upgrade to Node.js 18` |
| `perf` | Performance improvements | `perf(wasm): reduce binary size by 20%` |

### 5.3 Scopes

Common scopes:
- `indexer` - Code indexing
- `vector` - Vector database
- `optimizer` - Token optimizer
- `cli` - Command-line interface
- `mcp` - MCP server
- `wasm` - WASM module
- `docs` - Documentation
- `tests` - Tests

### 5.4 Examples

**Good commit messages:**

```bash
# New feature
git commit -m "feat(indexer): add support for Python files

- Added tree-sitter-python parser
- Implemented Python-specific AST extraction
- Added tests for Python indexing
- Updated documentation

Closes #123"

# Bug fix
git commit -m "fix(vector): handle missing embeddings gracefully

When a chunk has no embedding, skip it instead of crashing.
This can happen during incremental indexing.

Fixes #456"

# Documentation
git commit -m "docs(contributing): add code style guide

Added comprehensive code style guidelines for TypeScript and Rust.
Includes examples and best practices."

# Refactoring
git commit -m "refactor(optimizer): extract scoring logic into separate module

The scoring algorithm is now in its own module for better
testability and reusability. No functional changes."

# Tests
git commit -m "test(indexer): add integration tests for incremental indexing

Tests verify that:
- Only changed files are re-indexed
- Deleted files are removed from database
- Metadata is updated correctly"
```

**Bad commit messages:**

```bash
# Too vague
git commit -m "update stuff"

# No context
git commit -m "fix bug"

# Mixed changes (should be separate commits)
git commit -m "add features and fix bugs"

# No period at end (required by conventional commits)
git commit -m "add new feature"
```

### 5.5 Commit Message Hooks

We use Husky for Git hooks:

**Pre-commit hook:**
- Runs linter (`npm run lint -- --fix`)
- Runs type checker (`npm run typecheck`)
- Runs tests (`npm test -- --passWithNoTests`)
- Checks formatting (`npm run format -- --check`)

**Pre-push hook:**
- Runs all tests (`npm test`)
- Runs integration tests
- Checks test coverage

**Commit message hook:**
- Validates commit message format
- Checks for conventional commits format

---

## 6. Review Checklist

### 6.1 Before Submitting PR

- [ ] **Code Quality**
  - [ ] Code follows style guidelines
  - [ ] No console.log or debug statements
  - [ ] No commented-out code
  - [ ] No TODOs without tracking issue
  - [ ] Complex code has comments explaining WHY

- [ ] **Testing**
  - [ ] All tests pass locally
  - [ ] New features have tests
  - [ ] Bug fixes have regression tests
  - [ ] Test coverage not decreased
  - [ ] Edge cases tested

- [ ] **Documentation**
  - [ ] README updated if needed
  - [ ] API docs updated if needed
  - [ ] Type definitions updated
  - [ ] Examples provided for new features

- [ ] **Build**
  - [ ] TypeScript compiles without errors
  - [ ] WASM builds successfully (if changed)
  - [ ] Linter passes with no errors
  - [ ] Formatter passes with no issues
  - [ ] No new warnings introduced

- [ ] **Performance**
  - [ ] No obvious performance regressions
  - [ ] Memory usage reasonable
  - [ ] No unnecessary allocations
  - [ ] Efficient algorithms used

- [ ] **Security**
  - [ ] No hardcoded secrets
  - [ ] No unsafe operations (eval, etc)
  - [ ] Input validation
  - [ ] Error handling

### 6.2 During Review

**For Reviewers:**

- [ ] **Code Review**
  - [ ] Logic is correct
  - [ ] Edge cases handled
  - [ ] Error handling appropriate
  - [ ] No unnecessary complexity
  - [ ] Good performance characteristics

- [ ] **Testing**
  - [ ] Tests are comprehensive
  - [ ] Tests are maintainable
  - [ ] Tests are not brittle
  - [ ] Mocks used appropriately

- [ ] **Documentation**
  - [ ] Changes are documented
  - [ ] Comments are clear
  - [ ] Examples work

- [ ] **Compatibility**
  - [ ] No breaking changes (or documented)
  - [ ] Backward compatible
  - [ ] Version updated if needed

### 6.3 Before Merge

- [ ] **All approvals received**
- [ ] **All review comments addressed**
- [ ] **CI checks passing**
- [ ] **No merge conflicts**
- [ ] **Documentation complete**
- [ ] **Changelog updated**
- [ ] **Version bumped (if needed)**

---

## 7. Getting Help

### 7.1 Community Resources

**GitHub Issues:**
- Bug reports: github.com/YOUR_USERNAME/prism/issues
- Feature requests: github.com/YOUR_USERNAME/prism/issues
- Questions: Use Discussions tab

**Documentation:**
- Architecture docs: `docs/architecture/`
- API docs: `docs/api/`
- Development guides: `docs/development/`

### 7.2 Asking Questions

**Before asking:**
1. Search existing issues and discussions
2. Read relevant documentation
3. Try to solve it yourself first

**When asking:**
- Be specific about your problem
- Provide context and code samples
- Share what you've tried
- Include error messages
- Specify your environment (OS, Node version, etc)

**Good question example:**
```markdown
## Issue
When indexing Python files, I get a parse error for type annotations.

## Context
- Node.js v18.17.0
- Rust 1.70.0
- PRISM v0.1.0

## Code
```python
def greet(name: str) -> str:
    return f"Hello {name}"
```

## Error
```
Error: Unexpected token ':'
  at line 1, col 12
```

## What I've tried
- Checked that tree-sitter-python is installed
- Verified WASM built successfully
- Tested with simpler Python files (works)

## Expected behavior
Should parse Python type annotations correctly.
```

### 7.3 Contact

**For security issues:** Please report privately to [SECURITY EMAIL]

**For general questions:** Use GitHub Discussions

**For PR reviews:** Tag maintainers in PR comments

---

## 8. Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes for significant contributions
- Credited in relevant documentation

Thank you for contributing to PRISM!

---

**Document Status**: Complete
**Last Updated**: 2026-01-13
**Next Review**: Quarterly or after major process changes
