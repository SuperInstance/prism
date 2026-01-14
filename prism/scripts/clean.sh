#!/usr/bin/env bash
set -euo pipefail

# Clean script for Prism
# Removes all build artifacts and dependencies

echo "🧹 Cleaning Prism build artifacts..."

# Remove TypeScript build output
echo "  - Removing dist/"
rm -rf dist

# Remove WASM build output
echo "  - Removing prism-indexer/pkg/"
rm -rf prism-indexer/pkg

# Remove Rust build output
echo "  - Removing prism-indexer/target/"
rm -rf prism-indexer/target

# Remove test coverage
echo "  - Removing coverage/"
rm -rf coverage

# Remove cache directories
echo "  - Removing node_modules/.cache/"
rm -rf node_modules/.cache

# Remove IDE directories
echo "  - Removing .vscode/.rustfmt/"
rm -rf .vscode/.rustfmt

echo "✅ Clean complete!"
echo ""
echo "To remove node_modules, run: rm -rf node_modules"
