#!/usr/bin/env bash
set -euo pipefail

# Build script for Prism
# Builds TypeScript and WASM components

echo "🔨 Building Prism..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
npm run clean --silent

# Build WASM module
echo "🦀 Building WASM module (this may take a minute)..."
cd prism-indexer
if ! wasm-pack build --target web --release; then
    echo "❌ WASM build failed"
    exit 1
fi
echo "✅ WASM module built successfully"

# Check WASM size
WASM_SIZE=$(wc -c < pkg/prism_indexer_bg.wasm 2>/dev/null || echo 0)
echo "📦 WASM size: $(numfmt --to=iec-i --suffix=B $WASM_SIZE 2>/dev/null || echo ${WASM_SIZE}B)"

cd ..

# Build TypeScript
echo "📝 Building TypeScript..."
if ! npm run build:ts; then
    echo "❌ TypeScript build failed"
    exit 1
fi
echo "✅ TypeScript build completed"

# Check for type errors
echo "🔍 Type checking..."
if ! npm run typecheck; then
    echo "⚠️  Type errors found"
fi

echo "✨ Build complete!"
echo ""
echo "Output:"
echo "  - TypeScript: dist/"
echo "  - WASM: prism-indexer/pkg/"
