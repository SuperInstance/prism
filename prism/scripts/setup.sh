#!/usr/bin/env bash
set -euo pipefail

# Setup script for Prism
# One-time setup for development environment

echo "🔮 Prism Development Setup"
echo ""

# Check Node.js version
echo "📋 Checking Node.js version..."
NODE_VERSION=$(node -v 2>/dev/null || echo "not installed")
echo "  Node.js: $NODE_VERSION"

if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js is not installed. Please install Node.js >= 18.0.0"
    exit 1
fi

# Check npm version
NPM_VERSION=$(npm -v 2>/dev/null || echo "not installed")
echo "  npm: $NPM_VERSION"

# Check Rust installation
echo ""
echo "🦀 Checking Rust installation..."
if ! command -v rustc >/dev/null 2>&1; then
    echo "⚠️  Rust is not installed. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    RUST_VERSION=$(rustc -v 2>/dev/null | grep "rustc" | awk '{print $2}')
    echo "  Rust: $RUST_VERSION"
fi

# Add WASM target
echo ""
echo "🎯 Adding WASM target..."
if ! rustup target list --installed | grep -q "wasm32-unknown-unknown"; then
    rustup target add wasm32-unknown-unknown
    echo "  ✅ Added wasm32-unknown-unknown target"
else
    echo "  ✅ WASM target already installed"
fi

# Install wasm-pack
echo ""
echo "📦 Installing wasm-pack..."
if ! command -v wasm-pack >/dev/null 2>&1; then
    cargo install wasm-pack
    echo "  ✅ wasm-pack installed"
else
    WASM_PACK_VERSION=$(wasm-pack -V 2>/dev/null || echo "unknown")
    echo "  ✅ wasm-pack already installed: $WASM_PACK_VERSION"
fi

# Install npm dependencies
echo ""
echo "📥 Installing npm dependencies..."
npm install

# Make scripts executable
echo ""
echo "🔧 Making scripts executable..."
chmod +x scripts/*.sh

# Create .env file if it doesn't exist
echo ""
echo "🔐 Creating .env file..."
if [ ! -f .env ]; then
    cat > .env << 'EOF'
# Prism Environment Configuration
# Copy this file to .env.local and fill in your values

# Development
NODE_ENV=development

# API Keys (optional, for testing)
# ANTHROPIC_API_KEY=your-key-here

# Cloudflare (optional)
# CF_ACCOUNT_ID=your-account-id
# CF_API_TOKEN=your-api-token
EOF
    echo "  ✅ Created .env file (please review and update)"
else
    echo "  ✅ .env file already exists"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Review and update .env with your configuration"
echo "  2. Run: npm run dev"
echo "  3. Or build: npm run build"
