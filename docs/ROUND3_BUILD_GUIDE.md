# Round 3: WASM Indexer Build Guide

## Overview

This document provides complete instructions for building and testing the Rust/WASM indexer for PRISM.

## Prerequisites

### Required Tools

1. **Rust** (1.70+)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```

2. **wasm-pack** (for building Rust to WASM)
   ```bash
   cargo install wasm-pack
   ```

3. **Node.js** (18+) - Already installed
4. **npm** - Already installed

### Verification

```bash
rustc --version    # Should be 1.70 or higher
cargo --version    # Should be latest
wasm-pack --version # Should be 0.10+
node --version     # Should be 18+
npm --version      # Should be latest
```

## Build Process

### Step 1: Build Rust to WASM

```bash
cd /home/eileen/projects/claudes-friend
cd prism/prism-indexer
./build.sh
```

This will:
- Compile Rust code to WASM using wasm-pack
- Optimize for size (target: <1MB)
- Copy WASM files to `dist/wasm/`

Expected output:
```
🔨 Building PRISM Indexer to WASM...
📦 Building with wasm-pack...
✅ WASM built: pkg/prism_indexer_bg.wasm (800KB)
📋 Copying to dist/wasm/...
✅ Files copied to ../../dist/wasm/

📊 Build artifacts:
-rw-r--r-- 1 user user 800K Jan 13 12:00 prism_indexer_bg.wasm
-rw-r--r-- 1 user user  12K Jan 13 12:00 prism_indexer.js
-rw-r--r-- 1 user user 2.1K Jan 13 12:00 prism_indexer.d.ts

🎉 Build complete!
```

### Step 2: Build TypeScript

```bash
cd /home/eileen/projects/claudes-friend
npm run build:ts
```

This compiles all TypeScript to the `dist/` directory.

### Step 3: Combined Build

```bash
npm run build
```

This runs both WASM and TypeScript builds in sequence.

## File Structure

After building, your project should have:

```
/home/eileen/projects/claudes-friend/
├── dist/
│   └── wasm/
│       ├── prism_indexer_bg.wasm      # Compiled WASM (<1MB)
│       ├── prism_indexer.js           # JS loader
│       └── prism_indexer.d.ts         # TypeScript definitions
│
├── prism/prism-indexer/
│   ├── src/
│   │   ├── lib.rs                     # WASM exports
│   │   ├── parser.rs                  # Tree-sitter parser
│   │   ├── chunker.rs                 # Code chunking
│   │   ├── extractor.rs               # AST extraction
│   │   ├── error.rs                   # Error types
│   │   └── types.rs                   # Shared types
│   ├── pkg/                           # wasm-pack output
│   ├── build.sh                       # Build script
│   └── Cargo.toml                     # Rust config
│
├── src/indexer/
│   ├── WasmIndexer.ts                 # Node.js WASM wrapper
│   ├── IndexerOrchestrator.ts         # Pipeline orchestration
│   ├── IndexStorage.ts                # Index metadata
│   ├── ProgressReporter.ts            # Progress tracking
│   ├── types.ts                       # Type definitions
│   └── index.ts                       # Module exports
│
└── tests/wasm/
    └── indexer.test.ts                # Integration tests
```

## Testing

### Run WASM Tests

```bash
npm test -- tests/wasm/indexer.test.ts
```

### Test Coverage

```bash
npm run test:coverage -- tests/wasm/
```

### Manual Testing

Create a test file `test-indexer.mjs`:

```javascript
import { WasmIndexer } from './dist/indexer/WasmIndexer.js';

async function test() {
  const indexer = new WasmIndexer();
  await indexer.init();

  console.log('Supported languages:', indexer.getSupportedLanguages());
  console.log('Version:', indexer.getVersion());

  const code = `
    function hello(name: string): string {
      return \`Hello, \${name}!\`;
    }
  `;

  const result = await indexer.parseFile(code, 'typescript');
  console.log('Parsed:', result);
  console.log('Functions:', result.functions.length);
  console.log('Chunks:', result.chunks.length);
}

test().catch(console.error);
```

Run with:
```bash
node test-indexer.mjs
```

## Troubleshooting

### Issue: wasm-pack not found

**Solution:**
```bash
cargo install wasm-pack
```

### Issue: WASM file too large (>1MB)

**Solution:** Check `prism-indexer/Cargo.toml` has:
```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = true
panic = "abort"
```

### Issue: Node.js can't load WASM

**Solution:** Ensure:
1. WASM file exists in `dist/wasm/`
2. File permissions are correct
3. Node.js version is 18+

### Issue: Tests fail with "WASM not initialized"

**Solution:** Ensure `await indexer.init()` is called before other methods.

## Performance Targets

The WASM indexer should achieve:

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| WASM Size | <1MB | Fast loading, low memory |
| Parse Speed | >10K LOC/s | Index large repos quickly |
| Memory Usage | <100MB | Run in constrained environments |
| Init Time | <100ms | Low startup overhead |

## Integration with PRISM

The WasmIndexer integrates with the full PRISM pipeline:

```
WasmIndexer (parse)
    ↓
IndexerOrchestrator (coordinate)
    ↓
EmbeddingService (embed)
    ↓
VectorDatabase (store)
    ↓
TokenOptimizer (optimize)
```

Example usage:

```typescript
import { getIndexer } from './indexer/index.js';
import { IndexerOrchestrator } from './indexer/index.js';

// Get indexer instance
const indexer = await getIndexer();

// Index a directory
const orchestrator = new IndexerOrchestrator(
  fileSystem,
  indexer,
  embeddings,
  vectorDB,
  config
);

const result = await orchestrator.indexDirectory('/path/to/code', {
  incremental: true,
  onProgress: (progress, message) => {
    console.log(`${progress}%: ${message}`);
  }
});

console.log(`Indexed ${result.files} files, ${result.chunks} chunks`);
```

## Next Steps

After successful build and testing:

1. ✅ Indexer compiles to WASM
2. ✅ WASM file <1MB
3. ✅ Node.js can load WASM
4. ✅ Tests pass
5. ⏭️ Implement embedding generation (Round 4)
6. ⏭️ Add more language support (Round 5)
7. ⏭️ Optimize chunking algorithm (Round 6)

## Additional Resources

- [wasm-pack documentation](https://rustwasm.github.io/wasm-pack/)
- [Tree-sitter languages](https://tree-sitter.github.io/tree-sitter/#available-parsers)
- [WebAssembly in Node.js](https://nodejs.org/api/wasm.html)

---

**Last Updated:** 2025-01-13
**Status:** Ready for Build
