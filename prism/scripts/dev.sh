#!/usr/bin/env bash
set -euo pipefail

# Development script for Prism
# Starts development server with hot reload

echo "🔮 Starting Prism development server..."

# Check if required tools are installed
command -v node >/dev/null 2>&1 || {
    echo "❌ Node.js is not installed. Please install Node.js >= 18.0.0"
    exit 1
}

command -v cargo >/dev/null 2>&1 || {
    echo "❌ Rust/Cargo is not installed. Please install Rust"
    exit 1
}

# Parse arguments
WATCH=${WATCH:-true}
BUILD_WASM=${BUILD_WASM:-false}

if [ "$BUILD_WASM" = "true" ]; then
    echo "🦀 Building WASM module..."
    cd prism-indexer
    wasm-pack build --dev --target web
    cd ..
    echo "✅ WASM module built"
fi

# Start TypeScript dev server
echo "🚀 Starting TypeScript dev server..."
if [ "$WATCH" = "true" ]; then
    npm run dev
else
    node --import tsx src/cli/index.ts "$@"
fi
