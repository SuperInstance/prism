#!/bin/bash

# PRISM Plugin Uninstallation Script
# Cleanly removes PRISM plugin and optionally backs up user data

set -e

echo "🗑️  PRISM Uninstallation Starting..."
echo "===================================="

# Detect platform
PLATFORM="$(uname -s)"
case "$PLATFORM" in
    Linux)     PLATFORM="linux";;
    Darwin)    PLATFORM="macos";;
    CYGWIN*|MINGW*|MSYS*) PLATFORM="windows";;
    *)         PLATFORM="unknown";;
esac

echo "Detected platform: $PLATFORM"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d ".claude-plugin" ]; then
    echo "❌ This script must be run from the PRISM plugin root directory."
    echo "   Please cd to the directory containing package.json and .claude-plugin"
    exit 1
fi

# Get plugin directory
PLUGIN_DIR="$(pwd)"
PLUGIN_NAME=$(node -pe "require('./package.json').name")

echo "Plugin directory: $PLUGIN_DIR"
echo "Plugin name: $PLUGIN_NAME"

# Ask for confirmation
echo ""
echo "⚠️  WARNING: This will remove the PRISM plugin from your system."
echo ""
read -p "Do you want to backup your data before uninstalling? (y/n): " BACKUP_CHOICE
echo ""

# Backup user data if requested
if [ "$BACKUP_CHOICE" = "y" ] || [ "$BACKUP_CHOICE" = "Y" ]; then
    BACKUP_DIR="$HOME/prism-backup-$(date +%Y%m%d-%H%M%S)"
    echo "📦 Creating backup at: $BACKUP_DIR"

    mkdir -p "$BACKUP_DIR"

    # Backup cache, index, and logs
    if [ -d "cache" ]; then
        echo "   Backing up cache..."
        cp -r cache "$BACKUP_DIR/" 2>/dev/null || echo "   ⚠️  Cache backup failed"
    fi

    if [ -d "index" ]; then
        echo "   Backing up index..."
        cp -r index "$BACKUP_DIR/" 2>/dev/null || echo "   ⚠️  Index backup failed"
    fi

    if [ -d "logs" ]; then
        echo "   Backing up logs..."
        cp -r logs "$BACKUP_DIR/" 2>/dev/null || echo "   ⚠️  Logs backup failed"
    fi

    if [ -d ".prism" ]; then
        echo "   Backing up .prism directory..."
        cp -r .prism "$BACKUP_DIR/" 2>/dev/null || echo "   ⚠️  .prism backup failed"
    fi

    echo "✅ Backup complete: $BACKUP_DIR"
    echo ""
fi

# Ask for final confirmation
read -p "Are you sure you want to uninstall PRISM? (yes/no): " CONFIRM
echo ""

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Uninstallation cancelled."
    exit 0
fi

# Stop daemon if running
echo "🛑 Stopping PRISM daemon..."

case "$PLATFORM" in
    "linux")
        # Stop systemd service if it exists
        if systemctl is-active --quiet prism-daemon 2>/dev/null; then
            echo "   Stopping systemd service..."
            sudo systemctl stop prism-daemon
            sudo systemctl disable prism-daemon
            sudo rm -f /etc/systemd/system/prism-daemon.service
            sudo systemctl daemon-reload
            echo "   ✅ Systemd service stopped and removed"
        fi

        # Kill process by name
        pkill -f "prism.*daemon" 2>/dev/null && echo "   ✅ Daemon process stopped" || echo "   ℹ️  No daemon process running"
        ;;

    "macos")
        # Kill process by name
        pkill -f "prism.*daemon" 2>/dev/null && echo "   ✅ Daemon process stopped" || echo "   ℹ️  No daemon process running"
        ;;

    "windows")
        # Kill process on Windows
        taskkill //F //IM node.exe //FI "WINDOWTITLE eq PRISM*" 2>/dev/null && echo "   ✅ Daemon process stopped" || echo "   ℹ️  No daemon process running"
        ;;
esac

# Remove cache and temporary directories
echo "🗑️  Removing cache and temporary files..."

DIRS_TO_REMOVE=("cache" "index" "logs" "temp" ".prism" "node_modules")

for dir in "${DIRS_TO_REMOVE[@]}"; do
    if [ -d "$dir" ]; then
        echo "   Removing $dir..."
        rm -rf "$dir"
    fi
done

# Remove generated scripts
echo "🗑️  Removing generated scripts..."

FILES_TO_REMOVE=("start-prism.sh" "start-prism.bat" "verify-install.sh")

for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        echo "   Removing $file..."
        rm -f "$file"
    fi
done

# Remove log files
echo "🗑️  Removing log files..."
find . -maxdepth 1 -name "*.log" -type f -delete 2>/dev/null

# Ask if user wants to remove the entire plugin directory
echo ""
read -p "Do you want to remove the entire plugin directory? (y/n): " REMOVE_DIR
echo ""

if [ "$REMOVE_DIR" = "y" ] || [ "$REMOVE_DIR" = "Y" ]; then
    echo "🗑️  Removing plugin directory..."
    cd ..
    rm -rf "$PLUGIN_DIR"
    echo "✅ Plugin directory removed"
else
    echo "ℹ️  Plugin directory kept. You can manually delete it later."
fi

# Clean npm cache (optional)
if command -v npm &> /dev/null; then
    echo ""
    read -p "Do you want to clean npm cache? (y/n): " CLEAN_NPM

    if [ "$CLEAN_NPM" = "y" ] || [ "$CLEAN_NPM" = "Y" ]; then
        echo "🧹 Cleaning npm cache..."
        npm cache clean --force 2>/dev/null || echo "   ⚠️  Failed to clean npm cache"
    fi
fi

# Final message
echo ""
echo "🎉 Uninstallation Complete!"
echo "=========================="
echo ""

if [ "$BACKUP_CHOICE" = "y" ] || [ "$BACKUP_CHOICE" = "Y" ]; then
    echo "📦 Your data has been backed up to:"
    echo "   $BACKUP_DIR"
    echo ""
fi

echo "📋 What's been done:"
echo "   ✅ Daemon stopped"
echo "   ✅ Cache and temporary files removed"
echo "   ✅ Generated scripts removed"
echo "   ✅ Log files cleaned"

if [ "$REMOVE_DIR" = "y" ] || [ "$REMOVE_DIR" = "Y" ]; then
    echo "   ✅ Plugin directory removed"
fi

echo ""
echo "ℹ️  To reinstall PRISM, run:"
echo "   /plugin install $PLUGIN_NAME@claude-plugins-official"
echo ""
echo "Thank you for using PRISM! 👋"
