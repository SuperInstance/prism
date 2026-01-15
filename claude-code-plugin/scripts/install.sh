#!/bin/bash

# PRISM Cross-Platform Installation Script
# Works on macOS, Linux, and Windows (via Git Bash)

set -e

echo "🚀 PRISM Installation Starting..."
echo "=================================="

# Detect platform
PLATFORM="$(uname -s)"
case "$PLATFORM" in
    Linux)     PLATFORM="linux";;
    Darwin)    PLATFORM="macos";;
    CYGWIN*|MINGW*|MSYS*) PLATFORM="windows";;
    *)         PLATFORM="unknown";;
esac

echo "Detected platform: $PLATFORM"

# Check Node.js
echo "📋 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 14+ and try again."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)
if [ "$MAJOR_VERSION" -lt 14 ]; then
    echo "❌ Node.js version 14 or higher is required. Current version: $NODE_VERSION"
    exit 1
fi
echo "✅ Node.js: $NODE_VERSION"

# Check npm
echo "📋 Checking npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi
NPM_VERSION=$(npm --version)
echo "✅ npm: $NPM_VERSION"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d ".claude-plugin" ]; then
    echo "❌ This script must be run from the PRISM plugin root directory."
    echo "   Please cd to the directory containing package.json and .claude-plugin"
    exit 1
fi

echo "✅ Plugin directory verified"

# Create directories
echo "📁 Creating directories..."
mkdir -p cache
mkdir -p index
mkdir -p logs
mkdir -p temp

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    cat > .gitignore << EOF
# PRISM cache and temporary files
cache/
index/
logs/
temp/
*.log
*.tmp
.DS_Store
Thumbs.db
EOF
    echo "✅ Created .gitignore"
fi

# Install dependencies if needed
echo "📦 Checking dependencies..."
if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
elif [ -d "node_modules" ]; then
    echo "✅ Dependencies already installed"
else
    echo "⚠️  No package.json found, skipping dependency installation"
fi

# Run Node.js setup script
echo "⚙️  Running auto-setup..."
if command -v node &> /dev/null; then
    node scripts/install-setup.js
else
    echo "❌ Node.js not available for setup script"
    exit 1
fi

# Create platform-specific scripts
echo "🖥️  Creating platform scripts..."
case "$PLATFORM" in
    "macos"|"linux")
        # Create shell script
        cat > start-prism.sh << 'EOF'
#!/bin/bash
echo "Starting PRISM Daemon..."
cd "$(dirname "$0")"
node daemon/server.js
echo "PRISM Daemon stopped."
EOF
        chmod +x start-prism.sh
        echo "✅ Created start-prism.sh"

        # Create systemd service (Linux only)
        if [ "$PLATFORM" = "linux" ]; then
            sudo tee /etc/systemd/system/prism-daemon.service > /dev/null << EOF
[Unit]
Description=PRISM Daemon
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which node) daemon/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
            echo "✅ Created systemd service (run 'sudo systemctl enable prism-daemon' to enable)"
        fi
        ;;
    "windows")
        # Create batch script
        cat > start-prism.bat << 'EOF'
@echo off
echo Starting PRISM Daemon...
cd /d "%~dp0"
node daemon/server.js
echo PRISM Daemon stopped.
pause
EOF
        echo "✅ Created start-prism.bat"
        ;;
esac

# Create verification shortcut
echo "🔍 Creating verification script..."
cat > verify-install.sh << 'EOF'
#!/bin/bash
echo "🔍 Verifying PRISM Installation..."
node scripts/verify-install.js
EOF
chmod +x verify-install.sh
echo "✅ Created verify-install.sh"

echo ""
echo "🎉 Installation Complete!"
echo "========================"
echo ""
echo "📋 What's been done:"
echo "   ✅ Directories created"
echo "   ✅ Configuration files updated"
echo "   ✅ Platform scripts created"
echo "   ✅ Auto-detection enabled"
echo "   ✅ Zero-config setup complete"
echo ""
echo "🚀 Next Steps:"
echo "   1. Restart Claude Code to load the plugin"
echo "   2. Run './verify-install.sh' to verify installation"
echo "   3. Run 'prism index' to start indexing your project"
echo ""
echo "📖 Quick Commands:"
echo "   • Start daemon manually: ./start-prism.sh"
echo "   • Verify installation: ./verify-install.sh"
echo "   • View logs: tail -f logs/prism.log"
echo ""
echo "🔧 Configuration files:"
echo "   • .claude-plugin/plugin.json - Plugin manifest"
echo "   • .mcp.json - MCP server configuration"
echo "   • cache/ - Cache directory"
echo "   • index/ - Index storage"
echo ""
echo "Happy coding with PRISM! 🎯"