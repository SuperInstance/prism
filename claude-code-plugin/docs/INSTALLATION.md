# PRISM Installation Guide

🚀 **Zero-Friction Installation** - Automatic setup with intelligent defaults

## Quick Start (Recommended)

### One-Click Installation

1. **Download and Extract**
   ```bash
   # Download the latest release
   wget https://github.com/SuperInstance/Claude-prism-local-json/releases/latest/download/prism.tar.gz
   tar -xzf prism.tar.gz
   cd prism
   ```

2. **Run Auto-Setup**
   ```bash
   # Linux/macOS
   chmod +x scripts/install.sh
   ./scripts/install.sh

   # Windows
   powershell -ExecutionPolicy Bypass -File scripts/install.ps1
   ```

3. **Verify Installation**
   ```bash
   # Verify everything is working
   ./verify-install.sh  # Linux/macOS
   .\verify-install.ps1  # Windows
   ```

4. **Restart Claude Code**
   - Restart Claude Code to load the plugin
   - PRISM will automatically detect your project type and configure itself

### Manual Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/SuperInstance/Claude-prism-local-json.git
   cd Claude-prism-local-json
   ```

2. **Run Setup Script**
   ```bash
   # Linux/macOS
   node scripts/install-setup.js

   # Windows
   node scripts/install-setup.js
   ```

3. **Configure Claude Code**
   - Place the `.claude-plugin` directory in your project root
   - The `.mcp.json` file will be automatically configured

## Platform-Specific Instructions

### Windows

#### Method 1: PowerShell Script (Recommended)
```powershell
# Run the installer
powershell -ExecutionPolicy Bypass -File scripts/install.ps1

# This will:
# ✅ Check Node.js compatibility
# ✅ Create necessary directories
# ✅ Generate Windows scripts
# ✅ Create desktop shortcut (optional)
# ✅ Verify installation
```

#### Method 2: Manual Installation
```powershell
# Create directories
mkdir cache, index, logs, temp

# Create start script
@echo off
echo Starting PRISM Daemon...
cd /d "%~dp0"
node daemon/server.js
echo PRISM Daemon stopped.
pause
```

#### Method 3: Git Bash
```bash
# Use Linux-style scripts
chmod +x scripts/install.sh
./scripts/install.sh
```

### macOS

#### Method 1: Shell Script (Recommended)
```bash
# Run the installer
./scripts/install.sh

# This will:
# ✅ Check macOS compatibility
# ✅ Create directories
# ✅ Generate .command file for double-click launch
# ✅ Create optional systemd service
```

#### Method 2: Manual Installation
```bash
#!/bin/bash
echo "Starting PRISM Daemon..."
cd "$(dirname "$0")"
node daemon/server.js
echo "PRISM Daemon stopped."
chmod +x start-prism.command
```

#### Method 3: Homebrew (Future)
```bash
# When available
brew install prism-project-memory
```

### Linux

#### Method 1: Shell Script (Recommended)
```bash
# Run the installer
./scripts/install.sh

# This will:
# ✅ Check Linux compatibility
# ✅ Create directories
# ✅ Generate systemd service
# ✅ Enable auto-start on boot
```

#### Method 2: Manual Installation
```bash
#!/bin/bash
echo "Starting PRISM Daemon..."
cd "$(dirname "$0")"
node daemon/server.js
echo "PRISM Daemon stopped."
chmod +x start-prism.sh

# Optional: Create systemd service
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

sudo systemctl enable prism-daemon
sudo systemctl start prism-daemon
```

## Configuration

### Automatic Configuration (Zero-Config)

PRISM automatically detects and configures:

- **Project Type**: JavaScript, TypeScript, Python, Go, Rust, Java, C#, PHP, Ruby
- **Framework**: React, Vue, Angular, Django, Flask, Spring, etc.
- **Build Tools**: Webpack, Vite, Gradle, Maven, npm, yarn, pnpm
- **Test Frameworks**: Jest, Vitest, PyTest, etc.
- **Package Managers**: npm, yarn, pnpm, pip, pipenv, poetry

### Manual Configuration

If you need to customize the configuration:

1. **Plugin Configuration** (`.claude-plugin/plugin.json`)
   ```json
   {
     "name": "prism-project-memory",
     "version": "1.0.0",
     "autoStart": true,
     "mcpServers": "./.mcp.json"
   }
   ```

2. **MCP Server Configuration** (`.mcp.json`)
   ```json
   {
     "mcpServers": {
       "prism-daemon": {
         "command": "node",
         "args": ["${CLAUDE_PLUGIN_ROOT}/daemon/server.js"],
         "env": {
           "PLUGIN_ROOT": "${CLAUDE_PLUGIN_ROOT}",
           "PROJECT_ROOT": "${PROJECT_ROOT:-${CLAUDE_PLUGIN_ROOT}}",
           "AUTO_DETECT": "true",
           "AUTO_INDEX": "true"
         }
       }
     }
   }
   ```

3. **Environment Variables**
   ```bash
   # Custom configuration
   export LOG_LEVEL=debug
   export PORT=8081
   export CACHE_DIR=/custom/cache/path
   ```

## Supported Project Types

### JavaScript/TypeScript
- ✅ Node.js
- ✅ React
- ✅ Vue
- ✅ Angular
- ✅ Next.js
- ✅ Nuxt.js
- ✅ Vite
- ✅ Webpack

### Python
- ✅ Django
- ✅ Flask
- ✅ FastAPI
- ✅ pytest
- ✅ pip
- ✅ poetry
- ✅ pipenv

### Other Languages
- ✅ Go (standard)
- ✅ Rust (cargo)
- ✅ Java (Maven/Gradle)
- ✅ C# (.NET Core)
- ✅ PHP (composer)
- ✅ Ruby (gems)

## Verification

### Installation Check
```bash
# Run verification script
./verify-install.sh           # Linux/macOS
.\verify-install.ps1          # Windows

# Or use Node.js script
node scripts/verify-install.js
```

### Manual Verification
```bash
# Check if all files exist
ls -la .claude-plugin/ daemon/ scripts/
ls -la cache/ index/ logs/

# Check MCP server
curl http://localhost:8080/health

# Test project detection
node -e "const detector = require('./daemon/project-detector'); console.log(require('./daemon/project-detector').detectAll())"
```

## Troubleshooting

### Common Issues

#### 1. Node.js Version Error
```bash
# Check Node.js version
node --version

# Install required version (v14+)
nvm install 16
nvm use 16
```

#### 2. Permission Denied
```bash
# Linux/macOS
chmod +x scripts/*.sh
chmod +x *.command

# Windows
Run as Administrator
```

#### 3. MCP Server Won't Start
```bash
# Check logs
tail -f logs/prism.log

# Test server manually
node daemon/server.js

# Check port conflicts
netstat -tulpn | grep :8080
```

#### 4. Project Detection Failed
```bash
# Manually detect project type
node -e "
const detector = require('./daemon/project-detector');
const d = new detector(process.cwd());
d.detectAll().then(console.log);
"
```

### Reset Installation
```bash
# Clean reinstall
rm -rf cache/ index/ logs/ temp/
rm -f .mcp.json
node scripts/install-setup.js
```

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=debug

# Start with verbose output
node daemon/server.js
```

## Advanced Setup

### Development Installation
```bash
# Install development dependencies
npm install

# Build TypeScript (if applicable)
npm run build

# Run in development mode
npm run dev
```

### Docker Support
```dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN node scripts/install-setup.js

EXPOSE 8080
CMD ["node", "daemon/server.js"]
```

### Systemd Service (Linux)
```ini
[Unit]
Description=PRISM Daemon
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/path/to/prism
ExecStart=/usr/bin/node daemon/server.js
Restart=always
RestartSec=10
Environment=LOG_LEVEL=info

[Install]
WantedBy=multi-user.target
```

## API Endpoints

Once installed, PRISM provides these endpoints:

- `GET /health` - Health check
- `POST /index` - Index files
- `POST /search` - Search project

Example usage:
```bash
# Health check
curl http://localhost:8080/health

# Index project
curl -X POST http://localhost:8080/index -H "Content-Type: application/json" -d '{"paths": ["src/"]}'

# Search
curl -X POST http://localhost:8080/search -H "Content-Type: application/json" -d '{"query": "function user"}'
```

## Performance

### Optimization Tips
1. **SSD Storage**: Use SSD for better index performance
2. **RAM**: 8GB+ recommended for large projects
3. **Network**: Fast internet for cloud features
4. **Monitoring**: Check `logs/prism.log` for performance issues

### Resource Usage
- Memory: 50-200MB (depending on project size)
- CPU: Low when idle, spikes during indexing
- Storage: 10-500MB (index size varies by project)

## Security

### File Permissions
- Read-only access to project files
- Write access to cache/index directories only
- No network access required (unless using cloud features)

### Environment Variables
- `PLUGIN_ROOT` - Plugin installation directory
- `PROJECT_ROOT` - Project being analyzed
- `LOG_LEVEL` - Logging verbosity (debug/info/warn/error)

### Data Privacy
- All indexing happens locally
- No data sent to external servers
- Index files stored in project directory

## Updates

### Update PRISM
```bash
# Pull latest changes
git pull origin main

# Re-run setup
node scripts/install-setup.js

# Restart Claude Code
```

### Backup Configuration
```bash
# Backup important files
cp .claude-plugin/plugin.json plugin-backup.json
cp .mcp.json mcp-backup.json

# Restore from backup
cp plugin-backup.json .claude-plugin/plugin.json
cp mcp-backup.json .mcp.json
```

## Support

### Getting Help
1. Check the troubleshooting section above
2. Run compatibility test: `node scripts/test-compatibility.js`
3. Check logs: `tail -f logs/prism.log`
4. Create an issue on GitHub

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Bug Reports
When reporting bugs, please include:
- Operating system and version
- Node.js version
- PRISM version
- Error messages
- Steps to reproduce

---

**Happy coding with PRISM! 🎯**