#!/bin/bash
set -e

echo "🚀 Installing PRISM Plugin for Claude Code..."

# Determine plugin directory
PLUGIN_DIR="$HOME/.claude/plugins/prism-project-memory"

# Check if Claude Code is installed
if ! command -v claude &> /dev/null; then
    echo "❌ Claude Code CLI not found. Please install Claude Code first."
    echo "   Visit: https://claude.ai/download"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 14+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Create plugin directory
echo "📁 Creating plugin directory: $PLUGIN_DIR"
mkdir -p "$PLUGIN_DIR"

# Copy plugin files
echo "📦 Copying plugin files..."
cp -r .claude-plugin "$PLUGIN_DIR/"
cp -r daemon "$PLUGIN_DIR/"
cp .mcp.json "$PLUGIN_DIR/"
cp package.json "$PLUGIN_DIR/"
[ -f commands/prism.md ] && mkdir -p "$PLUGIN_DIR/commands" && cp commands/prism.md "$PLUGIN_DIR/commands/"
[ -f agents/prism-assistant.md ] && mkdir -p "$PLUGIN_DIR/agents" && cp agents/prism-assistant.md "$PLUGIN_DIR/agents/"

# Create .prism directory in plugin folder
mkdir -p "$PLUGIN_DIR/.prism"

echo "✅ Plugin installed to: $PLUGIN_DIR"
echo ""
echo "🎉 Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Restart Claude Code"
echo "  2. The plugin will auto-start and index your projects"
echo "  3. Test with: /prism status"
echo ""
echo "💡 Tip: The plugin creates a .prism/ folder in each project for local storage"
