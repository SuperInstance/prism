# PRISM Examples

This directory contains complete, runnable examples demonstrating various ways to use PRISM.

## Available Examples

### 1. Simple CLI Usage (`simple-cli/`)
**Difficulty**: Beginner
**Time**: 5 minutes

Demonstrates basic PRISM usage through the command-line interface.
- Index a sample codebase
- Perform semantic searches
- Ask questions about code
- View usage statistics

**Run it**:
```bash
cd simple-cli
./run-example.sh
```

**What you'll learn**:
- How to index a codebase
- How to search semantically
- How to ask questions about your code
- How to interpret results

---

### 2. API Integration (`api-integration/`)
**Difficulty**: Intermediate
**Time**: 15 minutes

Shows how to integrate PRISM into your own applications using the REST API.
- Start PRISM as a service
- Index files via API
- Search via API
- Handle responses in different formats

**Run it**:
```bash
cd api-integration
npm install
node index.js
```

**What you'll learn**:
- PRISM API endpoints
- Request/response formats
- Error handling
- Integration patterns

---

### 3. MCP Integration (`mcp-integration/`)
**Difficulty**: Intermediate
**Time**: 10 minutes

Demonstrates how to use PRISM as an MCP server with Claude Code.
- Configure MCP integration
- Use PRISM tools in Claude Code
- Automate workflows
- Best practices

**Run it**:
```bash
cd mcp-integration
./setup.sh
# Then use in Claude Code
```

**What you'll learn**:
- MCP protocol basics
- Claude Code integration
- Tool usage patterns
- Workflow automation

---

### 4. IDE Integration (`ide-integration/`)
**Difficulty**: Advanced
**Time**: 20 minutes

Shows how to integrate PRISM into your development environment.
- VS Code tasks
- Git hooks
- Shell aliases
- Makefile targets

**Run it**:
```bash
cd ide-integration
./install.sh
```

**What you'll learn**:
- IDE integration patterns
- Automation techniques
- Workflow optimization
- Custom tooling

---

## Quick Start

### Prerequisites

All examples require:
- Node.js 18+ installed
- PRISM installed globally: `npm install -g @claudes-friend/prism`
- (Optional) Cloudflare account for cloud features

### Running Examples

Each example directory contains:
- `README.md` - Detailed instructions
- `run-example.sh` - Executable script (Linux/macOS)
- `run-example.bat` - Batch file (Windows)
- `sample-code/` - Sample codebase to index

### Common Workflow

```bash
# 1. Navigate to example directory
cd simple-cli

# 2. Read the instructions
cat README.md

# 3. Run the example
./run-example.sh

# 4. Experiment!
# Modify the sample code and try different searches
```

---

## Example Structure

Each example follows this structure:

```
example-name/
├── README.md              # Detailed instructions
├── run-example.sh         # Linux/macOS script
├── run-example.bat        # Windows script
├── sample-code/           # Code to index
│   ├── src/
│   ├── package.json
│   └── ...
├── queries.txt            # Sample queries to try
└── expected-output.txt    # Expected results
```

---

## Learning Path

We recommend following this order:

1. **Start here**: `simple-cli/` - Learn the basics
2. **Next**: `api-integration/` - Build custom tools
3. **Then**: `mcp-integration/` - Integrate with Claude Code
4. **Finally**: `ide-integration/` - Optimize your workflow

---

## Troubleshooting

### Example Won't Run

**Problem**: Script won't execute
```bash
# Solution: Make script executable
chmod +x run-example.sh
```

### PRISM Not Found

**Problem**: `prism: command not found`
```bash
# Solution: Install PRISM globally
npm install -g @claudes-friend/prism
```

### Port Already in Use

**Problem**: API example fails with "port in use"
```bash
# Solution: Change port in example
export PORT=8788
node index.js
```

### Cloudflare Errors

**Problem**: API call fails
```bash
# Solution: Check credentials
wrangler login
```

---

## Contributing Examples

Have a cool example? We'd love to add it!

### Example Guidelines

1. **Keep it simple**: Focus on one concept
2. **Make it runnable**: Test it yourself first
3. **Document well**: Explain what's happening
4. **Include sample data**: Don't require external files
5. **Cross-platform**: Support Linux, macOS, Windows

### Submitting Examples

1. Fork the repository
2. Create your example in `examples/your-example/`
3. Add documentation
4. Test on multiple platforms
5. Submit a pull request

---

## Additional Resources

- [Main Documentation](../docs/)
- [API Reference](../docs/api/01-core-api.md)
- [CLI Guide](../docs/user/usage.md)
- [GitHub Issues](https://github.com/SuperInstance/PRISM/issues)

---

**Need help?**

- Open an issue: https://github.com/SuperInstance/PRISM/issues
- Join the discussion: https://github.com/SuperInstance/PRISM/discussions
- Read the docs: https://docs.prism.ai

---

**Happy searching!**
