# Claude PRISM Local JSON

Simple, stable project memory for Claude Code using local JSON storage.

## 🎯 Mission

Provide a rock-solid plugin that makes Claude Code significantly better without complexity.

### Why This Version Exists

Many projects don't need complex memory systems - they just need Claude Code to understand their project better. This version delivers:

- **One-click installation**: `/plugin install prism-project-memory@claude-plugins-official`
- **Zero configuration**: Works out of the box
- **Local JSON storage**: No external dependencies, no privacy concerns
- **Focus on essentials**: Search, memory, and context

## 🚀 Features

### Enhanced Search
- **Semantic code search**: Find what you need, not just keywords
- **File type detection**: Automatically recognizes your project type
- **Fast results**: Sub-second search times
- **Local indexing**: Everything stored locally

### Project Memory
- **Auto-detection**: Instantly understands project structure
- **Context retention**: Remembers project details between sessions
- **Change tracking**: Updates when files change
- **Lightweight**: Minimal memory footprint

### Seamless Integration
- **MCP tools**: Available in Claude Code automatically
- **Slash commands**: Easy manual control
- **Background operation**: Works while you code
- **Zero maintenance**: Install and forget

## 📦 Installation

### Quick Install
```bash
/plugin install prism-project-memory@claude-plugins-official
```

### Manual Install
```bash
# Clone the repository
git clone https://github.com/SuperInstance/Claude-prism-local-json.git
cd Claude-prism-local-json

# Install dependencies
npm install

# Install as Claude Code plugin
claude plugin install .
```

## 🎮 Usage

### Slash Commands
```bash
# Check plugin status
/prism status

# Search for code
/prism search "authentication middleware"

# Reindex project
/prism index

# View configuration
/prism config
```

### MCP Tools
The plugin automatically provides MCP tools to Claude Code:
- `search_code`: Search through your codebase
- `get_context`: Get project context information
- `find_usages`: Find usages of code symbols

## 🔧 Configuration

### Environment Variables
```bash
# Logging level
export LOG_LEVEL=info

# Port for HTTP API
export PORT=8080

# Project root (auto-detected)
export PROJECT_ROOT=/path/to/your/project
```

### Local Configuration
Create `.prism-config.json` in your project root:
```json
{
  "logLevel": "info",
  "excludePatterns": [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**"
  ],
  "indexPatterns": [
    "**/*.{js,ts,jsx,tsx}",
    "**/*.{py,go,rs,java,csharp,php,rb}",
    "**/*.{md,json,yaml,yml}"
  ]
}
```

## 🛠️ Development

### Running Locally
```bash
# Start the daemon
npm start

# Run in development mode
npm run dev

# Run tests
npm test
```

### Supported Languages
- **JavaScript/TypeScript** (Node.js, React, Vue, Angular)
- **Python** (Django, Flask, FastAPI)
- **Go** (Standard library, web frameworks)
- **Rust** (Actix, Rocket, Axum)
- **Java** (Spring, Jakarta EE)
- **C#** (ASP.NET Core)
- **PHP** (Laravel, Symfony)
- **Ruby** (Rails, Sinatra)

## 📊 Performance

### Memory Usage
- **Idle**: <50MB
- **Active**: <100MB
- **Peak**: <150MB (large projects)

### Response Times
- **Project detection**: <1s
- **Search results**: <100ms
- **Indexing**: <5s (typical projects)

### Storage
- **Compression**: JSON files compressed for efficiency
- **Cleanup**: Automatic removal of old data
- **Backup**: Built-in data safety mechanisms

## 🔍 How It Works

### Project Detection
The plugin automatically detects:
- **Language**: JavaScript, Python, Go, Rust, Java, C#, PHP, Ruby
- **Framework**: React, Vue, Angular, Django, Flask, Spring, etc.
- **Dependencies**: Package managers and libraries
- **Structure**: Project organization and patterns

### Search Indexing
```json
{
  "files": [
    {
      "path": "./src/App.js",
      "content": "React component...",
      "type": "component",
      "functions": ["App", "render"],
      "imports": ["react"]
    }
  ]
}
```

### Memory Storage
- **Local JSON files**: Stored in `.prism/` directory
- **Project metadata**: Name, type, dependencies, structure
- **Search index**: File contents and relationships
- **Cache data**: Frequently accessed information

## 🚨 Troubleshooting

### Common Issues

**Plugin not working:**
```bash
# Check plugin installation
/plugin list

# Check daemon status
/prism status

# Test HTTP API
curl http://localhost:8080/health
```

**Search results poor:**
```bash
# Reindex your project
/prism index

# Check what files are being indexed
/prism config
```

**High memory usage:**
```bash
# Check cache size
/prism config cache_size

# Clear cache if needed
rm -rf .prism/cache
```

### Getting Help
- **Issues**: https://github.com/SuperInstance/Claude-prism-local-json/issues
- **Discussions**: https://github.com/SuperInstance/Claude-prism-local-json/discussions
- **Documentation**: See [LOCAL-JSON-MISSION.md](LOCAL-JSON-MISSION.md)

## 🎯 Philosophy

### What We Say Yes To
- Simple, reliable functionality
- One-click installation
- Zero configuration
- Local JSON storage only
- Essential search and memory features
- Cross-platform compatibility

### What We Say No To
- Complex features and dependencies
- External services or APIs
- Heavy resource usage
- Manual configuration requirements
- Over-engineered solutions

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

We welcome contributions! Please keep the focus on simplicity and stability.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/simple-improvement`)
3. Make your changes (keeping it simple!)
4. Commit your changes (`git commit -m 'Add simple improvement'`)
5. Push to the branch (`git push origin feature/simple-improvement`)
6. Open a Pull Request

---

**Claude PRISM Local JSON** - Making Claude Code better, simply and reliably. 🚀

> For projects that need enhanced capabilities without complexity.