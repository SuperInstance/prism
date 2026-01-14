# PRISM FAQ (Frequently Asked Questions)

**Version**: 0.1.0
**Last Updated**: 2026-01-13

---

## General Questions

### What is PRISM?

PRISM is an AI-powered codebase indexer and semantic search engine for Claude Code. It:

- Indexes your entire codebase into vector embeddings
- Retrieves only relevant code for each query
- Optimizes context to fit token limits
- Routes to optimal AI models (local or cloud)
- Saves 90%+ on tokens and costs

**Learn more**: [Getting Started Guide](getting-started.md)

---

### How does PRISM work?

PRISM uses a four-step process:

1. **Indexing**: Parse code with Tree-sitter, extract functions/classes
2. **Embedding**: Generate vector embeddings with AI models
3. **Retrieval**: Search vectors semantically to find relevant code
4. **Optimization**: Compress context to fit token budget

**Learn more**: [Architecture Docs](../architecture/01-system-overview.md)

---

### What languages does PRISM support?

PRISM supports these languages out of the box:

- **JavaScript/TypeScript** (.js, .ts, .jsx, .tsx)
- **Python** (.py)
- **Rust** (.rs)
- **Go** (.go)
- **Java** (.java)

Additional languages can be added by configuring the indexer.

**Learn more**: [Configuration Guide](configuration.md#indexing-options)

---

### Is PRISM free?

Yes! PRISM is open-source and free to use. You can:

- Use local embeddings (Ollama) for 100% free operation
- Use Cloudflare's free tier (up to 10K neurons/day)
- Use local LLMs (Ollama) for free chat

**Cost breakdown**: [Cost Analysis Guide](../guide/10-cost-analysis.md)

---

### What are the system requirements?

**Minimum**:
- Node.js 18+
- 100MB RAM
- 50MB disk space

**Recommended**:
- Node.js 20+ LTS
- 1GB RAM
- 500MB disk space

**Check your system**:
```bash
node --version  # Should be v18+
```

---

## Installation & Setup

### How do I install PRISM?

```bash
npm install -g @claudes-friend/prism
```

**Alternative methods**:
```bash
# yarn
yarn global add @claudes-friend/prism

# pnpm
pnpm add -g @claudes-friend/prism

# From source
git clone https://github.com/claudes-friend/prism.git
cd prism && npm install && npm run build && npm link
```

**Learn more**: [Getting Started Guide](getting-started.md#installation)

---

### How do I verify installation?

```bash
prism --version
# Expected output: prism version 0.1.0
```

---

### Do I need API keys?

**Depends on your setup**:

- **Local-only (Ollama)**: No API keys needed
- **Cloudflare embeddings**: Need Cloudflare credentials
- **Claude chat**: Need Anthropic API key

**Learn more**: [Configuration Guide](configuration.md#environment-variables)

---

### How do I get API keys?

**Cloudflare**:
1. Account ID: https://dash.cloudflare.com → Workers & Pages
2. API Token: https://dash.cloudflare.com → My Profile → API Tokens

**Anthropic**:
1. API Key: https://console.anthropic.com/

---

## Indexing

### How long does indexing take?

**Typical times**:

| Codebase Size | Files | Index Time |
|---------------|-------|------------|
| Small (10K LOC) | 45 | 3-5 seconds |
| Medium (100K LOC) | 347 | 20-30 seconds |
| Large (500K LOC) | 1,847 | 90-120 seconds |
| X-Large (1M LOC) | 3,847 | 180-240 seconds |

**Speed up indexing**:
```bash
prism index --workers 8 --max-size 0.5
```

---

### How often should I re-index?

**Recommended**:

- **After git pull**: If significant changes
- **After large changes**: When you modify many files
- **Watch mode**: Automatic updates
  ```bash
  prism index --watch
  ```

---

### Can I index multiple projects?

Yes! Use project-specific configurations:

```bash
cd project1
prism index --output .prism/project1.db

cd ../project2
prism index --output .prism/project2.db
```

---

### What files are indexed by default?

**Included**:
- Source code files (.ts, .js, .py, .rs, .go, .java)
- Configuration files (if in include list)

**Excluded**:
- node_modules/
- .git/
- dist/
- build/
- Test files (*.test.ts, *.spec.ts)

**Customize**: [Configuration Guide](configuration.md#indexing-options)

---

### How do I exclude files from indexing?

**Via config**:
```yaml
# .prism/config.yaml
indexing:
  exclude:
    - node_modules/**
    - "**/*.test.ts"
    - "src/generated/**"
```

**Via command line**:
```bash
prism index --exclude "node_modules/**,test/**"
```

---

### Can I index generated files?

Yes, but be careful:

```yaml
# Include generated files
indexing:
  exclude:
    - node_modules/**
    # Don't exclude generated files
```

**Note**: Generated files can bloat your index. Consider:
- Excluding very large generated files
- Using `--max-size` to limit file size
- Excluding `dist/` and `build/` directories

---

## Search

### Why am I getting no search results?

**Possible causes**:

1. **Index not built**: Run `prism index`
2. **Threshold too high**: Lower it
   ```bash
   prism search "query" --threshold 0.6
   ```
3. **Wrong file types**: Specify extensions
   ```bash
   prism search "query" --extensions .ts,.js
   ```
4. **Query too vague**: Be more specific
   ```bash
   # Bad
   prism search "code"

   # Good
   prism search "user authentication JWT validation"
   ```

---

### What is the similarity threshold?

The similarity threshold (0-1) determines how similar results must be to your query:

- **0.9+**: Very similar, precise matches
- **0.7-0.9**: Good similarity (default)
- **0.5-0.7**: Somewhat similar, broader results
- **<0.5**: Weak similarity, noisy results

**Adjust based on needs**:
```bash
# Precision: Fewer, better results
prism search "function" --threshold 0.8

# Recall: More results
prism search "function" --threshold 0.6
```

---

### How do I get more search results?

```bash
prism search "query" --limit 20
```

Default is 10 results. Maximum recommended is 50.

---

### Can I search across multiple indexes?

Yes, specify the index path:

```bash
prism search "query" --index /path/to/index.db
```

---

## Chat

### Why is chat using so many tokens?

**Possible causes**:

1. **Budget too high**: Lower it
   ```bash
   prism chat "question" --budget 20000
   ```

2. **Too much context**: PRISM retrieved too much
   ```bash
   # Check what's being retrieved
   prism chat "question" --verbose
   ```

3. **History enabled**: Disable for isolated questions
   ```bash
   prism chat "question" --no-history
   ```

**Learn more**: [Cost Analysis Guide](../guide/10-cost-analysis.md)

---

### How do I choose the right model?

**Guidelines**:

- **Simple questions** (facts, definitions): Use `haiku`
- **Most development tasks**: Use `sonnet` (default)
- **Complex analysis**: Use `opus`
- **Offline/cost-sensitive**: Use `ollama`

**Or let PRISM choose**:
```bash
prism chat "question" --model auto
```

**Learn more**: [Model Performance Guide](../guide/11-model-performance.md)

---

### What is the token budget?

The token budget is the maximum number of tokens PRISM will send to the LLM:

- **10K-20K**: Simple questions
- **30K-50K**: Medium complexity (default)
- **80K-100K**: Complex architecture questions
- **150K+**: System-wide understanding

**Set budget**:
```bash
prism chat "question" --budget 50000
```

**Learn more**: [Configuration Guide](configuration.md#chat-options)

---

### How does conversation history work?

PRISM maintains conversation history for context:

- **Default**: Last 10 turns
- **Can be configured**: Set `historyLength` in config
- **Can be disabled**: Use `--no-history` flag

**Configure**:
```yaml
# ~/.prism/config.yaml
chat:
  history: true
  historyLength: 10
```

---

## Performance

### Why is indexing slow?

**Possible causes**:

1. **Too many files**: Exclude more
   ```bash
   prism index --exclude "node_modules/**,dist/**,coverage/**"
   ```

2. **Files too large**: Reduce max size
   ```bash
   prism index --max-size 0.5
   ```

3. **Network latency** (Cloudflare): Use local Ollama
   ```bash
   prism index --embeddings ollama
   ```

4. **Not enough workers**: Increase parallelism
   ```bash
   prism index --workers 8
   ```

---

### Why is search slow?

**Possible causes**:

1. **Large index**: Consider splitting into multiple indexes
2. **Low similarity threshold**: Increase to reduce results
3. **Corrupted index**: Rebuild
   ```bash
   prism index --force
   ```

**Typical search times**: 0.1-0.5 seconds

---

### How can I reduce memory usage?

**Options**:

1. **Reduce workers**:
   ```bash
   prism index --workers 2
   ```

2. **Reduce batch size**:
   ```bash
   prism index --batch-size 5
   ```

3. **Index in batches**:
   ```bash
   prism index --path ./src
   prism index --path ./lib --output .prism/lib.db
   ```

4. **Increase Node.js memory**:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

---

## Integration

### How do I integrate with Claude Code?

PRISM works as an MCP server:

1. **Install MCP plugin**:
   ```bash
   prism mcp install
   ```

2. **Configure Claude Code**:
   ```json
   // ~/.config/claude-code/config.json
   {
     "mcpServers": {
       "prism": {
         "command": "prism",
         "args": ["mcp", "server"]
       }
     }
   }
   ```

3. **Use in Claude Code**:
   ```
   "Use prism_search to find authentication code"
   ```

**Learn more**: [Getting Started Guide](getting-started.md#integration-with-claude-code)

---

### Can I use PRISM with other AI tools?

Yes! PRISM can work with any tool that supports:

- **MCP protocol**: Native integration
- **CLI**: Run PRISM commands
- **API**: Direct integration (coming soon)

**Examples**:
- Cursor: Use MCP integration
- Continue: Use CLI commands
- Custom tools: Use PRISM API

---

## Troubleshooting

### "Index not found" error

**Solution**:
```bash
prism index
```

Or specify index path:
```bash
prism search "query" --index /path/to/index.db
```

---

### "Embedding generation failed" error

**Solutions**:

1. **Check internet connection** (for Cloudflare)
2. **Switch to local Ollama**:
   ```bash
   prism index --embeddings ollama
   ```
3. **Check API quota**:
   ```bash
   prism stats --verbose
   ```

---

### "No API key found" error

**Solutions**:

1. **Set environment variable**:
   ```bash
   export ANTHROPIC_API_KEY=your-key
   ```

2. **Add to config**:
   ```yaml
   chat:
     apiKey: your-key-here
   ```

3. **Use local Ollama**:
   ```bash
   prism chat "question" --model ollama
   ```

---

### Out of memory errors

**Solutions**:

1. **Reduce workers**:
   ```bash
   prism index --workers 2
   ```

2. **Increase Node.js memory**:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

3. **Index in smaller batches**:
   ```bash
   prism index --path ./src
   ```

---

## Limitations

### What are the limitations of PRISM?

**Current limitations**:

1. **Maximum file size**: 100MB (configurable)
2. **Maximum index size**: ~1M chunks (practical limit)
3. **Supported languages**: 5 major languages (extensible)
4. **Embedding models**: Limited to supported models

**Planned improvements**:
- More language support
- Larger index support
- More embedding models
- GPU acceleration

---

### Can PRISM handle very large codebases?

Yes, with optimizations:

**For 500K+ LOC**:
```yaml
# .prism/config.yaml
indexing:
  workers: 8
  maxSize: 0.5

storage:
  type: vectorize  # Use cloud storage

chat:
  budget: 100000  # Higher budget
```

**For 1M+ LOC**:
- Consider splitting into multiple indexes
- Use Vectorize for storage
- Exclude test/generated files
- Increase workers

---

### Is PRISM suitable for CI/CD?

Yes! Use CI-specific configuration:

```yaml
# ~/.prism/config.yaml
logging:
  level: warn
  console: false

chat:
  model: haiku  # Cheapest
  budget: 20000
```

---

## Security & Privacy

### Is my code sent to external servers?

**Depends on configuration**:

- **Local Ollama**: No external calls
- **Cloudflare**: Code sent for embeddings only
- **Claude API**: Optimized context sent for chat

**Best practice**: Use local Ollama for sensitive codebases.

---

### Where is my data stored?

**Local storage**:
- SQLite database: `.prism/vectors.db`
- Embeddings cache: `.prism/cache/embeddings`
- Logs: `~/.prism/logs/`

**Cloud storage** (if enabled):
- Cloudflare Vectorize: Encrypted at rest

**Never stored**:
- Your source code (only embeddings)
- API keys (in config only)

---

### How do I secure my API keys?

**Best practices**:

1. **Use environment variables**:
   ```bash
   export ANTHROPIC_API_KEY=your-key
   ```

2. **Never commit keys**:
   ```gitignore
   .prism/config.yaml
   ```

3. **Use variable substitution**:
   ```yaml
   chat:
     apiKey: ${ANTHROPIC_API_KEY}
   ```

---

## Comparison

### PRISM vs. grep/ripgrep

| Feature | PRISM | grep/ripgrep |
|---------|-------|--------------|
| **Search type** | Semantic | Keyword |
| **Understands meaning** | Yes | No |
| **Finds related code** | Yes | No |
| **Requires exact match** | No | Yes |
| **Best for** | Understanding | Finding |

---

### PRISM vs. GitHub Copilot

| Feature | PRISM | Copilot |
|---------|-------|---------|
| **Codebase awareness** | Full index | Limited context |
| **Token optimization** | 90%+ savings | None |
| **Cost** | Free or cheap | Subscription |
| **Offline** | Yes (Ollama) | No |
| **Best for** | Understanding | Generating |

---

### PRISM vs. Sourcegraph

| Feature | PRISM | Sourcegraph |
|---------|-------|-------------|
| **Setup** | 5 minutes | Hours/days |
| **Cost** | Free | Enterprise pricing |
| **Local** | Yes | No |
| **Best for** | Individual developers | Teams |

---

## Getting Help

### Where can I get help?

**Resources**:

- **Documentation**: https://docs.prism.ai
- **GitHub Issues**: https://github.com/claudes-friend/prism/issues
- **Discussions**: https://github.com/claudes-friend/prism/discussions
- **Discord**: https://discord.gg/prism

---

### How do I report bugs?

1. **Check existing issues**: https://github.com/claudes-friend/prism/issues
2. **Create new issue**: Include:
   - PRISM version (`prism --version`)
   - Error message
   - Steps to reproduce
   - Configuration (redact secrets)
   - Debug output (`prism --verbose`)

---

### How do I request features?

1. **Check existing requests**: GitHub Issues
2. **Create feature request**: Include:
   - Use case
   - Proposed solution
   - Alternatives considered
   - Priority (low/medium/high)

---

### How can I contribute?

**Ways to contribute**:

1. **Report bugs**: GitHub Issues
2. **Suggest features**: GitHub Discussions
3. **Submit PRs**: Fix bugs, add features
4. **Improve docs**: Edit documentation
5. **Share**: Tell others about PRISM

**Contribution guide**: [CONTRIBUTING.md](../CONTRIBUTING.md)

---

**Document Status**: Complete
**Last Updated**: 2026-01-13
**Version**: 0.1.0
