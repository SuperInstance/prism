# WASM Indexer - Quick Reference

## 🚀 Quick Start

### Prerequisites Check
```bash
rustc --version     # Need 1.70+
cargo --version
wasm-pack --version # Need 0.10+
```

### Install Missing Tools
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install wasm-pack
cargo install wasm-pack
```

## 🔨 Build Commands

### Full Build
```bash
cd /home/eileen/projects/claudes-friend
npm run build
```

### Individual Builds
```bash
npm run build:wasm    # Build Rust to WASM
npm run build:ts      # Build TypeScript
```

### Manual WASM Build
```bash
cd prism/prism-indexer
./build.sh
```

## 🧪 Testing

```bash
# Run WASM tests
npm test -- tests/wasm/indexer.test.ts

# Run with coverage
npm run test:coverage -- tests/wasm/
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `prism/prism-indexer/src/lib.rs` | WASM exports |
| `prism/prism-indexer/build.sh` | Build script |
| `src/indexer/WasmIndexer.ts` | Node.js wrapper |
| `tests/wasm/indexer.test.ts` | Integration tests |
| `docs/ROUND3_BUILD_GUIDE.md` | Detailed guide |

## 📊 Expected Output

```
dist/wasm/
├── prism_indexer_bg.wasm    # ~800KB
├── prism_indexer.js         # ~12KB
└── prism_indexer.d.ts       # ~2KB
```

## 🐛 Troubleshooting

### wasm-pack not found
```bash
cargo install wasm-pack
```

### WASM too large
Check `prism/prism-indexer/Cargo.toml` has release optimizations.

### Node.js can't load WASM
Ensure Node.js 18+ and WASM file exists in `dist/wasm/`.

## ✅ Success Criteria

- [ ] WASM file <1MB
- [ ] `npm run build` succeeds
- [ ] Tests pass
- [ ] Node.js can load WASM

## 📖 Documentation

- Build Guide: `docs/ROUND3_BUILD_GUIDE.md`
- Completion Report: `ROUND3_COMPLETE.md`
- Architecture: `docs/architecture/`
