# Contributing to Prism

Thank you for your interest in contributing to Prism! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Rust (latest stable)
- wasm-pack

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/prism.git
   cd prism
   ```
3. Install dependencies:
   ```bash
   npm run setup
   ```
4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Making Changes

1. Write code following our [Coding Standards](#coding-standards)
2. Add/update tests as described in [Testing Guidelines](#testing-guidelines)
3. Ensure all tests pass:
   ```bash
   npm test
   ```
4. Build the project:
   ```bash
   npm run build
   ```
5. Commit your changes with a clear message
6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests
- `perf/` - Performance improvements

## Coding Standards

### TypeScript

- Use strict type checking
- Follow the existing code style
- Use ESNext features when appropriate
- Add JSDoc comments for public APIs
- Prefer `const` over `let`
- Use template literals for string concatenation

### Rust

- Follow Rust naming conventions
- Use `cargo fmt` before committing
- Use `cargo clippy` to catch common mistakes
- Document public APIs with rustdoc
- Prefer `Result` to `Option` when errors are meaningful
- Use `thiserror` for error types

### Code Organization

```
src/
├── cli/              # CLI commands (TypeScript)
├── core/             # Core interfaces
├── indexer/          # Code indexer (Rust WASM wrapper)
├── vector-db/        # Vector database
├── token-optimizer/  # Token optimization
├── model-router/     # Model routing logic
└── mcp/              # MCP server
```

## Testing Guidelines

### Unit Tests

- Write unit tests for all new functions
- Aim for >80% code coverage
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Integration Tests

- Test interactions between components
- Use real dependencies where appropriate
- Clean up after tests
- Mock external services

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage
npm run test:coverage
```

## Submitting Changes

### Pull Request Process

1. Ensure your PR description clearly describes the problem and solution
2. Include the relevant issue number (e.g., "Fixes #123")
3. Update documentation if needed
4. Ensure all tests pass
5. Request review from maintainers

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review performed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests added/updated
- [ ] All tests pass locally
- [ ] Dependent changes merged

## Reporting Issues

### Before Reporting

1. Search existing issues to avoid duplicates
2. Check if the issue is fixed in the latest version
3. Gather relevant information (error messages, reproduction steps, etc.)

### Issue Report Template

- **Description**: Clear description of the problem
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: OS, versions, etc.
- **Screenshots/Code**: If applicable

## Questions?

Feel free to open an issue with the `question` label, or reach out to maintainers.

Thank you for contributing to Prism!
