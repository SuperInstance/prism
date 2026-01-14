#!/bin/bash
set -e

echo "🔨 Building PRISM Indexer to WASM..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "❌ wasm-pack not found. Install it with:"
    echo "   cargo install wasm-pack"
    exit 1
fi

# Build the WASM package
echo "📦 Building with wasm-pack..."
wasm-pack build \
    --target web \
    --out-dir pkg \
    --release

# Check if build succeeded
if [ ! -f "pkg/prism_indexer_bg.wasm" ]; then
    echo "❌ WASM build failed - no output file"
    exit 1
fi

# Get WASM file size
WASM_SIZE=$(du -h pkg/prism_indexer_bg.wasm | cut -f1)
echo "✅ WASM built: pkg/prism_indexer_bg.wasm ($WASM_SIZE)"

# Create dist directory
DIST_DIR="../../dist/wasm"
mkdir -p "$DIST_DIR"

# Copy WASM files to dist
echo "📋 Copying to dist/wasm/..."
cp pkg/prism_indexer_bg.wasm "$DIST_DIR/"
cp pkg/prism_indexer.js "$DIST_DIR/"
cp pkg/prism_indexer_bg.wasm.d.ts "$DIST_DIR/prism_indexer.d.ts" 2>/dev/null || true

echo "✅ Files copied to $DIST_DIR"
echo ""
echo "📊 Build artifacts:"
ls -lh "$DIST_DIR"
echo ""
echo "🎉 Build complete!"
