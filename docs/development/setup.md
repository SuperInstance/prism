# Development Setup

**Component**: PRISM Development Guide
**Status**: Development Document
**Priority**: Foundational
**Last Updated**: 2026-01-13

## Purpose

This guide provides comprehensive instructions for setting up a complete development environment for PRISM, including all prerequisites, build tools, and IDE configuration.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone and Bootstrap](#2-clone-and-bootstrap)
3. [Development Environment](#3-development-environment)
4. [IDE Recommendations](#4-ide-recommendations)
5. [Build System Overview](#5-build-system-overview)
6. [Verification Steps](#6-verification-steps)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

### 1.1 Required Software

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Node.js** | 18.0+ | Runtime for TypeScript code | [nodejs.org](https://nodejs.org/) |
| **npm** | 9.0+ | Package manager | Included with Node.js |
| **Rust** | 1.70+ | Compiler for WASM indexer | [rust-lang.org](https://www.rust-lang.org/tools/install) |
| **wasm-pack** | 0.10+ | Build Rust → WASM | `cargo install wasm-pack` |
| **Git** | 2.30+ | Version control | [git-scm.com](https://git-scm.com/) |

### 1.2 Optional but Recommended

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Ollama** | Local LLM for testing | [ollama.ai](https://ollama.ai/) |
| **Docker** | Containerized testing | [docker.com](https://www.docker.com/) |
| **VS Code** | Recommended IDE | [code.visualstudio.com](https://code.visualstudio.com/) |

### 1.3 Cloudflare Tools (Optional)

For Cloudflare Workers deployment:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Authenticate
wrangler login
```

---

## 2. Clone and Bootstrap

### 2.1 Clone Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/prism.git
cd prism

# Verify repository structure
ls -la
# Should see: src/, prism-indexer/, docs/, tests/, etc.
```

### 2.2 Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Verify installation
npm list --depth=0
```

**Expected packages include:**
- `@modelcontextprotocol/sdk` - MCP protocol
- `@anthropic-ai/sdk` - Claude API
- `commander` - CLI framework
- `better-sqlite3` - Local vector database
- `chalk` - Terminal colors
- `ora` - Loading spinners
- `inquirer` - Interactive prompts
- `zod` - Runtime validation

### 2.3 Rust Toolchain Setup

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Verify Rust installation
rustc --version  # Should be 1.70.0 or higher
cargo --version

# Add WASM target
rustup target add wasm32-unknown-unknown

# Install wasm-pack
cargo install wasm-pack

# Verify wasm-pack
wasm-pack --version  # Should be 0.10.0 or higher
```

---

## 3. Development Environment

### 3.1 Environment Variables

Create a `.env` file in the project root:

```bash
cp .dev.vars.example .env
```

Edit `.env` with your configuration:

```bash
# Cloudflare (optional, for Workers deployment)
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token

# Ollama (optional, for local LLM)
OLLAMA_ENABLED=true
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=deepseek-coder-v2

# Development
LOG_LEVEL=debug
NODE_ENV=development

# Vector Database
VECTOR_DB_PATH=./data/vector.db
EMBEDDINGS_PROVIDER=workers_ai
```

### 3.2 Build WASM Indexer

```bash
# Navigate to indexer directory
cd prism-indexer

# Build WASM module for web
wasm-pack build --target web --release

# OR build for Node.js
wasm-pack build --target nodejs --release

# Verify build
ls -la pkg/
# Should see:
# - prism_indexer_bg.wasm (the WASM binary)
# - prism_indexer.js (JavaScript bindings)
# - prism_indexer.d.ts (TypeScript definitions)

# Return to project root
cd ..
```

**Expected output:**
```
[INFO]: Checking for the latest wasm-pack version...
[INFO]: Installing wasm-bindgen...
[INFO]: Compiling to Wasm...
   Compiling prism-indexer v0.1.0
    Finished release [optimized] target(s) in 45.2s
[INFO]: Optimizing wasm binaries with wasm-opt...
[INFO]: Optional fields missing from Cargo.toml: 'categories', 'license'
[INFO]: Waxing 🕯️  ...
[INFO]: Done waxing 🕯️  in 0.52s
[INFO]: 🔗  Your wasm pkg is ready to publish at ./pkg.
```

### 3.3 Build TypeScript

```bash
# Build TypeScript to JavaScript
npm run build

# Verify build
ls -la dist/
# Should see compiled JavaScript files
```

### 3.4 Link CLI for Development

```bash
# Link CLI globally (allows running `prism` from anywhere)
npm link

# Verify installation
prism --version
# Should output: prism/0.1.0
```

---

## 4. IDE Recommendations

### 4.1 Visual Studio Code

**Recommended Extensions:**

```bash
# Install from command line
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension rust-lang.rust-analyzer
code --install-extension tamasfe.even-better-toml
code --install-extension eamodio.gitlens
code --install-extension ms-vscode.test-adapter-converter
```

**VS Code Settings (`.vscode/settings.json`):**

```json
{
  // TypeScript
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.preferences.importModuleSpecifier": "relative",

  // Formatting
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },

  // Files
  "files.exclude": {
    "**/.git": true,
    "**/.DS_Store": true,
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true,
    "**/.wrangler": true
  },
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/dist/**": true,
    "**/target/**": true,
    "**/pkg/**": true
  },

  // Rust
  "rust-analyzer.cargo.features": "all",
  "rust-analyzer.checkOnSave.command": "clippy",

  // Testing
  "testing.automaticallyOpenPeekView": "never"
}
```

**VS Code Tasks (`.vscode/tasks.json`):**

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build WASM",
      "type": "shell",
      "command": "cd prism-indexer && wasm-pack build --target web --release",
      "group": "build",
      "problemMatcher": []
    },
    {
      "label": "Build TypeScript",
      "type": "npm",
      "script": "build:ts",
      "group": "build",
      "problemMatcher": ["$tsc"]
    },
    {
      "label": "Run Tests",
      "type": "npm",
      "script": "test",
      "group": "test",
      "problemMatcher": []
    },
    {
      "label": "Run Linter",
      "type": "npm",
      "script": "lint",
      "group": "test",
      "problemMatcher": ["$eslint-stylish"]
    }
  ]
}
```

**VS Code Launch (`.vscode/launch.json`):**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "Debug CLI",
      "type": "node",
      "request": "launch",
      "runtimeArgs": ["--inspect-brk", "-r", "tsx", "src/cli/index.ts"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "runtimeArgs": ["--inspect-brk"],
      "args": ["${workspaceFolder}/node_modules/.bin/vitest", "run", "${relativeFile}"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### 4.2 Other IDEs

**JetBrains IDEs (WebStorm, IntelliJ IDEA):**
- Built-in TypeScript support
- Rust plugin available
- Run configurations via npm scripts

**Neovim/Vim:**
```vim
" TypeScript
Plug 'leafgarland/typescript-vim'
Plug 'peitalin/vim-jsx-typescript'

" Rust
Plug 'rust-lang/rust.vim'

" LSP
Plug 'neovim/nvim-lspconfig'
Plug 'hrsh7th/nvim-cmp'

" Treesitter for syntax highlighting
Plug 'nvim-treesitter/nvim-treesitter'
```

**Emacs:**
```elisp
;; TypeScript
(use-package typescript-mode
  :mode "\\.ts\\'")

;; Rust
(use-package rust-mode
  :mode "\\.rs\\'")

;; LSP
(use-package lsp-mode
  :hook ((typescript-mode . lsp))
        :commands lsp)

(use-package lsp-ui
  :after lsp-mode
  :config (setq lsp-ui-doc-enable t))
```

---

## 5. Build System Overview

### 5.1 Build Scripts

The project uses npm scripts for building:

```json
{
  "scripts": {
    "dev": "tsx watch src/cli/index.ts",
    "build": "npm run build:ts && npm run build:wasm",
    "build:ts": "tsc",
    "build:wasm": "cd prism-indexer && wasm-pack build --target web --release",
    "build:node": "cd prism-indexer && wasm-pack build --target nodejs --release",
    "clean": "rm -rf dist prism-indexer/pkg prism-indexer/target node_modules/.cache"
  }
}
```

### 5.2 Build Process

```
Source Files
    │
    ├─→ prism-indexer/src/*.rs
    │       ├─→ cargo build (Rust compiler)
    │       ├─→ wasm-bindgen (generate bindings)
    │       └─→ wasm-opt (optimize)
    │           └─→ prism-indexer/pkg/*.wasm
    │
    └─→ src/**/*.ts
        ├─→ tsc (TypeScript compiler)
        ├─→ type checking
        └─→ dist/**/*.js
            └─→ Ready for Node.js
```

### 5.3 Build Targets

**Development Build:**
```bash
npm run build
```
- Includes source maps
- No minification
- Fast compilation

**Production Build:**
```bash
# Currently uses same build, but future will have:
npm run build:prod
```
- Minified WASM
- Optimized JavaScript
- Stripped debug symbols

### 5.4 WASM Build Optimization

The `prism-indexer/Cargo.toml` is configured for size optimization:

```toml
[profile.release]
opt-level = "z"        # Optimize for size
lto = true            # Link-time optimization
codegen-units = 1     # Better optimization
strip = true          # Remove debug symbols
panic = "abort"       # Reduce binary size

[profile.release.package."*"]
opt-level = "z"       # Optimize dependencies for size too

[package.metadata.wasm-pack.profile.release]
wasm-opt = ["-Oz", "--enable-mutable-globals"]
```

**Target WASM size:** <1MB

---

## 6. Verification Steps

### 6.1 Verify Prerequisites

```bash
# Check Node.js
node --version
# Expected: v18.0.0 or higher

# Check npm
npm --version
# Expected: 9.0.0 or higher

# Check Rust
rustc --version
# Expected: 1.70.0 or higher

# Check wasm-pack
wasm-pack --version
# Expected: 0.10.0 or higher
```

### 6.2 Verify Build

```bash
# Build WASM
cd prism-indexer && wasm-pack build --target web --release && cd ..

# Check WASM file exists and is reasonable size
ls -lh prism-indexer/pkg/prism_indexer_bg.wasm
# Expected: <1MB

# Build TypeScript
npm run build:ts

# Check JavaScript output exists
ls -la dist/
# Expected: Multiple .js and .d.ts files
```

### 6.3 Verify Tests

```bash
# Run all tests
npm test

# Expected: All tests pass
```

### 6.4 Verify CLI

```bash
# Link CLI
npm link

# Test CLI
prism --version
# Expected: prism/0.1.0

prism --help
# Expected: Help text with all commands
```

### 6.5 Verify Linting

```bash
# Run ESLint
npm run lint
# Expected: No errors

# Run Prettier check
npm run format:check
# Expected: No formatting issues

# Run TypeScript compiler
npm run typecheck
# Expected: No type errors
```

---

## 7. Troubleshooting

### 7.1 Rust/WASM Issues

**Problem: `wasm-pack: command not found`**
```bash
# Solution: Install wasm-pack
cargo install wasm-pack

# Add to PATH if needed
export PATH="$HOME/.cargo/bin:$PATH"
```

**Problem: WASM file >1MB**
```bash
# Check Cargo.toml has release profile
cat prism-indexer/Cargo.toml | grep -A 10 "\[profile.release\]"

# Rebuild with optimizations
cd prism-indexer
cargo clean
wasm-pack build --target web --release
```

**Problem: `error: linker 'lld' not found`**
```bash
# Solution: Install lld linker
# Ubuntu/Debian
sudo apt-get install lld

# macOS
brew install llvm
```

### 7.2 Node.js Issues

**Problem: `Cannot find module 'tsx'`**
```bash
# Solution: Install dependencies
npm install

# Or reinstall
rm -rf node_modules package-lock.json
npm install
```

**Problem: TypeScript compilation errors**
```bash
# Solution: Clean build
npm run clean
npm run build:ts
```

**Problem: better-sqlite3 native module fails**
```bash
# Solution: Rebuild native modules
npm rebuild better-sqlite3
```

### 7.3 Development Issues

**Problem: Changes not reflected**
```bash
# Solution: Rebuild
npm run build

# Or use dev mode with hot reload
npm run dev
```

**Problem: CLI not found after linking**
```bash
# Solution: Check npm global bin directory
npm config get prefix
# Add to PATH: export PATH="$npm_prefix/bin:$PATH"

# Or use npx
npx prism --version
```

**Problem: Tests fail with "Cannot find module"**
```bash
# Solution: Build WASM first
npm run build:wasm
npm test
```

### 7.4 Environment Issues

**Problem: `.env` file not loading**
```bash
# Solution: Ensure .env exists
ls -la .env

# Check dotenv is installed
npm list dotenv

# Manually source env file
export $(cat .env | xargs)
```

**Problem: Ollama connection refused**
```bash
# Solution: Start Ollama
ollama serve

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

---

## 8. Quick Start Checklist

Use this checklist to verify your setup:

- [ ] Node.js 18.0+ installed
- [ ] npm 9.0+ installed
- [ ] Rust 1.70+ installed
- [ ] wasm-pack installed
- [ ] Git installed
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] WASM target added (`rustup target add wasm32-unknown-unknown`)
- [ ] `.env` file configured
- [ ] WASM module built (`npm run build:wasm`)
- [ ] TypeScript compiled (`npm run build:ts`)
- [ ] CLI linked (`npm link`)
- [ ] Tests passing (`npm test`)
- [ ] Linter passing (`npm run lint`)
- [ ] Typecheck passing (`npm run typecheck`)
- [ ] CLI working (`prism --version`)

---

## 9. Next Steps

After completing setup:

1. **Read Architecture Documents:**
   - `docs/architecture/01-system-overview.md`
   - `docs/architecture/02-data-flow.md`

2. **Review Testing Strategy:**
   - `docs/development/02-testing-strategy.md`

3. **Explore the Codebase:**
   - Start with `src/index.ts` (main entry point)
   - Review `src/cli/` (CLI interface)
   - Study `src/core/` (core engine)

4. **Make Your First Contribution:**
   - Check existing issues
   - Set up your IDE
   - Make a small change
   - Run tests
   - Submit a PR

---

**Document Status**: Complete
**Last Updated**: 2026-01-13
**Next Review**: After major dependency updates
