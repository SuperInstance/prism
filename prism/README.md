# Prism

> AI-powered codebase indexer and RAG engine for Claude Code

Prism is a super-agent plugin for Claude Code that indexes your entire codebase semantically, enabling intelligent code search and context-aware assistance.

## Features

- **Fast Code Indexing** - Index 100K+ LOC in seconds using Rust WASM
- **Semantic Search** - Find relevant code using vector embeddings
- **Token Optimization** - Reduce context usage by 90%+ through smart chunking
- **Multi-Language Support** - TypeScript, JavaScript, Python, Rust, Go, Java
- **Error Recovery** - Handles incomplete or buggy code gracefully
- **Local-First** - Works entirely offline with optional cloud sync

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Rust (latest stable)

### Installation

```bash
# Clone the repository
git clone https://github.com/claudes-friend/prism.git
cd prism

# Run setup
npm run setup

# Start development
npm run dev
```

## Usage

### CLI

```bash
# Index a codebase
prism index ./my-project

# Search indexed code
prism search "authentication logic"

# Start interactive mode
prism chat
```

### MCP Plugin

```typescript
// In your Claude Code configuration
{
  "mcpServers": {
    "prism": {
      "command": "npx",
      "args": ["prism", "mcp"]
    }
  }
}
```

## Architecture

```
prism/
├── src/
│   ├── cli/              # CLI commands
│   ├── core/             # Core interfaces
│   ├── indexer/          # Code indexer (Rust WASM wrapper)
│   ├── vector-db/        # Vector database
│   ├── token-optimizer/  # Token optimization
│   ├── model-router/     # Model routing logic
│   └── mcp/              # MCP server
├── prism-indexer/        # Rust project (WASM)
│   ├── src/
│   └── Cargo.toml
└── tests/
    ├── unit/
    └── integration/
```

## Development

### Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload

# Building
npm run build            # Build everything
npm run build:wasm       # Build WASM module only
npm run build:ts         # Build TypeScript only

# Testing
npm test                 # Run all tests
npm run test:unit        # Run unit tests
npm run test:integration # Run integration tests
npm run test:coverage    # Run with coverage

# Utilities
npm run clean            # Remove build artifacts
npm run lint             # Lint code
npm run format           # Format code
```

### Project Structure

- **`prism-indexer/`** - Rust project compiled to WASM for fast code parsing
- **`src/indexer/`** - TypeScript wrapper for the WASM module
- **`src/vector-db/`** - Vector database for semantic search
- **`src/token-optimizer/`** - Token optimization algorithms
- **`src/model-router/`** - Smart model routing logic
- **`src/mcp/`** - MCP server for Claude Code integration

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with [Tree-sitter](https://tree-sitter.github.io/) for fast parsing
- Uses [wasm-pack](https://rustwasm.github.io/docs/wasm-pack/) for WASM compilation
- Inspired by the need for better codebase understanding tools

---

Made with ❤️ by the Claude's Friend team
