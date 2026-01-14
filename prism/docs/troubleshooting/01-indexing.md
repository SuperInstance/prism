# Indexing Troubleshooting

**Last Updated**: 2026-01-13
**Version**: 0.1.0
**Status**: Beta

## Overview

This guide helps you diagnose and resolve common indexing issues with Prism.

---

## Common Issues

### 1. No Files Found

**Symptom:**
```bash
$ prism index
⚠ No files found to index

No files matched the include patterns.
Include patterns: **/*.{ts,tsx,js,jsx}
Exclude patterns: **/node_modules/**,**/dist/**
```

**Causes:**

1. **Wrong directory**
   ```bash
   # Wrong
   cd /home/user/project
   prism index /wrong/path

   # Correct
   prism index .
   ```

2. **Incorrect patterns**
   ```bash
   # Check current patterns
   prism index --verbose

   # Override with correct patterns
   prism index --include-patterns "**/*.ts"
   ```

3. **File extensions not supported**
   ```bash
   # Check if language is supported
   prism index --list-languages

   # Add custom extension (if language is supported)
   prism index --include-patterns "**/*.custom"
   ```

4. **All files excluded**
   ```bash
   # Check exclude patterns
   cat .prismrc.json

   # Temporarily disable excludes
   prism index --exclude-patterns ""
   ```

**Solution:**
```bash
# Verify files exist
ls -la src/*.ts

# Index with verbose output
prism index --verbose

# Override patterns
prism index --include-patterns "**/*.ts,**/*.tsx"
```

---

### 2. WASM Module Loading Failed

**Symptom:**
```bash
$ prism index
✗ Failed to load WASM module
Error: Cannot find module './prism_indexer_bg.wasm'
```

**Causes:**

1. **WASM not built**
   ```bash
   # Check if WASM exists
   ls -la prism-indexer/pkg/prism_indexer_bg.wasm
   ```

2. **Incorrect path**
   ```bash
   # Check WASM location
   find . -name "prism_indexer_bg.wasm"
   ```

3. **Build incomplete**
   ```bash
   # Check build output
   ls -la prism-indexer/pkg/
   ```

**Solutions:**

**Rebuild WASM:**
```bash
cd prism-indexer

# Install dependencies
cargo install wasm-pack

# Build WASM
wasm-pack build --target web --release

# Verify build
ls -la pkg/prism_indexer_bg.wasm
```

**Update import paths:**
```bash
# Check import in src/indexer/index.ts
cat src/indexer/index.ts | grep "prism_indexer"

# Should be:
# import init from '../../prism-indexer/pkg/prism_indexer.js';
```

**Clear npm cache:**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

### 3. Parsing Errors

**Symptom:**
```bash
$ prism index --verbose
✗ Failed to parse src/file.ts: Syntax error at line 42
Error: Unexpected token '}'
```

**Causes:**

1. **Syntax errors in source code**
   ```typescript
   // src/file.ts:42
   function broken() {
     return 42;  // Missing closing brace
   ```

2. **Experimental syntax not supported**
   ```typescript
   // Very new TypeScript features
   const weird = #!;  // May not parse
   ```

3. **Encoding issues**
   ```bash
   # Check file encoding
   file -bi src/file.ts

   # Should be: utf-8
   ```

**Solutions:**

**Fix syntax errors:**
```bash
# Use linter to find errors
npm run lint

# Use TypeScript compiler
npx tsc --noEmit

# Fix errors and re-index
prism index --force
```

**Continue despite errors:**
```bash
# Prism continues indexing even with errors
# Check error summary
prism index --verbose

# View error details
prism index --debug
```

**Exclude problematic files:**
```bash
# Temporarily skip broken files
prism index --exclude-patterns "**/broken-file.ts"

# Re-index after fixing
prism index --force --include-patterns "**/broken-file.ts"
```

---

### 4. Out of Memory

**Symptom:**
```bash
$ prism index
✗ JavaScript heap out of memory
<--- Last few GCs --->
[12345:0x12345678]    12345 ms: Mark-sweep 1234.5 (1234.6) -> 1234.5 (1234.6) MB, 99.9 % (1234.6 MB) heap limit
```

**Causes:**

1. **Large codebase (>1M LOC)**
   ```bash
   # Check LOC
   find src -name "*.ts" | xargs wc -l | tail -1
   ```

2. **Memory leak**
   ```bash
   # Check for leaks
   prism index --memory-profile
   ```

3. **Insufficient Node.js memory**
   ```bash
   # Check Node.js memory limit
   node -e "console.log(v8.getHeapStatistics().heap_size_limit / 1024 / 1024)"
   ```

**Solutions:**

**Increase Node.js memory:**
```bash
# Increase to 4GB
NODE_OPTIONS=--max-old-space-size=4096 prism index

# Increase to 8GB
NODE_OPTIONS=--max-old-space-size=8192 prism index

# Set permanently
export NODE_OPTIONS=--max-old-space-size=4096
```

**Reduce memory usage:**
```bash
# Smaller batch size
prism index --batch-size 50  # Default: 100

# Stream embeddings
prism index --stream

# Index in chunks
prism index src/ && prism index lib/
```

**Index incrementally:**
```bash
# Use watch mode
prism index --watch

# Index specific directories
prism index src/components
prism index src/utils
prism index src/server
```

---

### 5. Slow Indexing

**Symptom:**
```bash
$ prism index
Indexing files...
  ████████████████░░░░░░░░  40%  (57/142 files)
# ... takes forever ...
```

**Causes:**

1. **Too many files**
   ```bash
   # Count files
   find src -name "*.ts" | wc -l
   ```

2. **Large files**
   ```bash
   # Find large files
   find src -name "*.ts" -exec wc -c {} \; | sort -rn | head -10
   ```

3. **Slow I/O**
   ```bash
   # Check disk speed
   dd if=/dev/zero of=test bs=1M count=100 oflag=direct
   ```

4. **CPU bottleneck**
   ```bash
   # Check CPU usage
   htop  # or top
   ```

**Solutions:**

**Exclude unnecessary files:**
```bash
# Skip tests, builds, dependencies
prism index \
  --exclude-patterns "**/*.test.ts,**/*.spec.ts" \
  --exclude-patterns "**/dist/**,**/build/**" \
  --exclude-patterns "**/node_modules/**"
```

**Increase parallelism:**
```bash
# Use more CPU cores
prism index --parallelism 8  # Default: 4

# Check available cores
nproc  # Linux
sysctl -n hw.ncpu  # macOS
```

**Skip large files:**
```bash
# Set max file size (1MB)
prism index --max-file-size 1048576

# Or chunk large files
prism index --chunk-large-files
```

**Use faster storage:**
```bash
# Move index to SSD
prism index --output /ssd/prism/index.db

# Use RAM disk (Linux)
sudo mount -t tmpfs -o size=1G tmpfs /tmp/prism
prism index --output /tmp/prism/index.db
```

---

### 6. Embedding Generation Failed

**Symptom:**
```bash
$ prism index
✗ Failed to generate embeddings
Error: Cloudflare API error: Rate limit exceeded
```

**Causes:**

1. **Cloudflare rate limit**
   ```bash
   # Check quota
   prism index --check-quota
   ```

2. **Network issues**
   ```bash
   # Test connectivity
   curl https://api.cloudflare.com/client/v4/user
   ```

3. **Invalid API key**
   ```bash
   # Check configuration
   cat ~/.prism/config.json
   ```

**Solutions:**

**Check Cloudflare quota:**
```bash
# View current usage
prism index --quota-status

# Free tier limits:
# - 10,000 neurons/day
# - ~50 chunks/day
```

**Use local embeddings:**
```bash
# Use Ollama instead of Cloudflare
prism index --embeddings local --model ollama:nomic-embed-text
```

**Reduce API calls:**
```bash
# Smaller batch size
prism index --embedding-batch-size 10

# Index incrementally
prism index --watch
```

**Wait and retry:**
```bash
# Retry tomorrow (quota resets daily)
prism index --force

# Or upgrade plan
# https://dash.cloudflare.com
```

---

### 7. Vector Database Errors

**Symptom:**
```bash
$ prism index
✗ Failed to store vectors
Error: SQLite database is locked
```

**Causes:**

1. **Database locked**
   ```bash
   # Check if another process is using it
   lsof ~/.prism/vector.db
   ```

2. **Corrupted database**
   ```bash
   # Check database integrity
   sqlite3 ~/.prism/vector.db "PRAGMA integrity_check;"
   ```

3. **Insufficient permissions**
   ```bash
   # Check permissions
   ls -la ~/.prism/vector.db
   ```

**Solutions:**

**Unlock database:**
```bash
# Kill other processes
killall prism

# Remove lock file
rm ~/.prism/vector.db.lock

# Re-index
prism index --force
```

**Repair database:**
```bash
# Backup and recreate
mv ~/.prism/vector.db ~/.prism/vector.db.backup
prism index --force

# Or use SQLite repair
sqlite3 ~/.prism/vector.db ".recover" | sqlite3 repaired.db
mv repaired.db ~/.prism/vector.db
```

**Fix permissions:**
```bash
# Change ownership
sudo chown $USER:$USER ~/.prism/vector.db

# Change permissions
chmod 644 ~/.prism/vector.db
```

---

### 8. Configuration Issues

**Symptom:**
```bash
$ prism index
✗ Failed to load configuration
Error: Invalid JSON in .prismrc.json
```

**Causes:**

1. **Syntax errors in config**
   ```bash
   # Validate JSON
   cat .prismrc.json | jq .
   ```

2. **Invalid values**
   ```bash
   # Check configuration schema
   prism config --schema
   ```

3. **Conflicting configs**
   ```bash
   # Check all configs
   prism config --list
   ```

**Solutions:**

**Validate JSON:**
```bash
# Use jq to validate
cat .prismrc.json | jq .

# Fix errors manually
vim .prismrc.json

# Or regenerate config
prism config init
```

**Reset to defaults:**
```bash
# Backup current config
mv .prismrc.json .prismrc.json.backup

# Generate new config
prism config init

# Edit as needed
vim .prismrc.json
```

**Check configuration priority:**
```bash
# View effective configuration
prism config --show-effective

# View all configs
prism config --list-all
```

---

## Debug Mode

### Enable Verbose Output

```bash
# Show detailed progress
prism index --verbose

# Show all parsing details
prism index --debug

# Save debug log to file
prism index --debug 2> debug.log
```

### Memory Profiling

```bash
# Profile memory usage
prism index --memory-profile

# Generate heap snapshot
prism index --heap-snapshot

# Analyze with Chrome
# 1. Open chrome://inspect
# 2. Load heap snapshot
# 3. Analyze memory usage
```

### CPU Profiling

```bash
# Profile CPU usage
node --prof prism index

# Process profile
node --prof-process isolate-*.log > profile.txt

# View profile
cat profile.txt
```

### Tracing

```bash
# Enable tracing
prism index --trace

# Trace specific operations
prism index --trace=parse,chunk,embed

# Save trace to file
prism index --trace --trace-file trace.json
```

---

## Recovery

### Clear Index

**Start fresh:**

```bash
# Remove index database
rm ~/.prism/vector.db

# Re-index from scratch
prism index --force
```

### Partial Reindexing

**Re-index specific files:**

```bash
# Re-index changed files (git)
git diff --name-only | prism index --files-from -

# Re-index specific directory
prism index src/utils --force

# Re-index specific file type
prism index --include-patterns "**/*.test.ts" --force
```

### Restore from Backup

```bash
# List backups
prism backup --list

# Restore specific backup
prism backup --restore 2024-01-13

# Restore from manual backup
cp ~/.prism/vector.db.backup ~/.prism/vector.db
prism index --check
```

### Emergency Recovery

**If nothing works:**

```bash
# 1. Clear everything
rm -rf ~/.prism/*

# 2. Reinstall Prism
npm uninstall -g @prism/cli
npm install -g @prism/cli

# 3. Rebuild WASM
cd prism-indexer
cargo clean
wasm-pack build --target web --release

# 4. Re-index
prism index --force
```

---

## Getting Help

### Collect Diagnostic Information

```bash
# Generate diagnostic report
prism diagnose > diagnostic.txt

# Include in bug report
cat diagnostic.txt
```

**Diagnostic report includes:**
- Prism version
- Node.js version
- OS information
- Configuration files
- Error logs
- Performance metrics

### Common Solutions Summary

| Issue | Quick Fix |
|-------|-----------|
| No files found | `prism index --verbose` |
| WASM error | `cd prism-indexer && wasm-pack build` |
| Parse error | Fix syntax or `--exclude` file |
| Out of memory | `NODE_OPTIONS=--max-old-space-size=4096 prism index` |
| Slow indexing | `prism index --parallelism 8` |
| Embedding failed | Wait for quota reset or use local |
| DB locked | `rm ~/.prism/vector.db.lock` |
| Config error | `prism config init` |

### Still Stuck?

1. **Check documentation**
   - [Indexing Guide](../user-guide/03-indexing.md)
   - [Performance Guide](../guide/05-performance.md)
   - [Language Support](../guide/04-language-support.md)

2. **Search issues**
   - [GitHub Issues](https://github.com/prism/prism/issues)
   - Use keywords from error message

3. **Ask for help**
   - Discord: [https://discord.gg/prism](https://discord.gg/prism)
   - Email: support@prism.dev

4. **Create bug report**
   ```bash
   # Generate template
   prism bug-report > bug-report.md

   # Fill in details
   vim bug-report.md

   # Submit
   gh issue create --body-file bug-report.md
   ```

---

## Prevention

### Best Practices

1. **Regular indexing**
   ```bash
   # Index on every push (git hook)
   echo 'prism index' > .git/hooks/post-commit
   chmod +x .git/hooks/post-commit
   ```

2. **Watch mode**
   ```bash
   # Automatically re-index on changes
   prism index --watch
   ```

3. **Configuration management**
   ```bash
   # Commit .prismrc.json to git
   git add .prismrc.json
   git commit -m "Add Prism config"
   ```

4. **Regular backups**
   ```bash
   # Backup index daily
   0 0 * * * prism backup --auto
   ```

### Health Checks

```bash
# Check index health
prism index --health

# Expected output:
# ✓ Index database: OK
# ✓ Vector count: 1,234
# ✓ Embeddings: OK
# ✓ Configuration: OK
```

---

**Next Steps:**
- **Learn indexing**: [Indexing Guide](../user-guide/03-indexing.md)
- **Optimize performance**: [Performance Guide](../guide/05-performance.md)
- **Understand architecture**: [Indexer Architecture](../architecture/04-indexer-architecture.md)

---

**Need Help?**
- GitHub: [https://github.com/prism/prism/issues](https://github.com/prism/prism/issues)
- Discord: [https://discord.gg/prism](https://discord.gg/prism)
- Email: support@prism.dev
