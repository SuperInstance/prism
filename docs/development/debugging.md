# Debugging Guide

**Component**: PRISM Development Guide
**Status**: Development Document
**Priority**: Foundational
**Last Updated**: 2026-01-13

## Purpose

This document provides comprehensive guidance for debugging PRISM, including common debugging techniques, logging configuration, performance profiling, and troubleshooting issues.

---

## Table of Contents

1. [Debugging Techniques](#1-debugging-techniques)
2. [Logging Configuration](#2-logging-configuration)
3. [Performance Profiling](#3-performance-profiling)
4. [Troubleshooting Common Issues](#4-troubleshooting-common-issues)
5. [Debugging Tools](#5-debugging-tools)
6. [Memory Profiling](#6-memory-profiling)
7. [Network Debugging](#7-network-debugging)
8. [Production Debugging](#8-production-debugging)

---

## 1. Debugging Techniques

### 1.1 Debug Mode

Enable debug logging with environment variable:

```bash
# Enable debug logging
LOG_LEVEL=debug prism index --path ./test-project

# Enable trace logging (even more verbose)
LOG_LEVEL=trace prism index --path ./test-project

# Set log level for specific module
DEBUG=prism:indexer prism index
```

**Log levels:**
- `trace` - Extremely verbose logging
- `debug` - Detailed debugging information
- `info` - General informational messages (default)
- `warn` - Warning messages
- `error` - Error messages only
- `silent` - No output

### 1.2 Verbose Mode

CLI commands support `--verbose` flag:

```bash
# Enable verbose output
prism index --verbose --path ./test-project

# Enable very verbose output
prism index --verbose --verbose --path ./test-project
```

### 1.3 Dry Run Mode

Test commands without making changes:

```bash
# Dry run indexing (shows what would be indexed)
prism index --dry-run --path ./test-project

# Dry run search (shows query without executing)
prism search --dry-run "authentication"
```

### 1.4 Step-by-Step Debugging

**Using Node.js debugger:**

```bash
# Run with debugger
node --inspect-brk dist/cli/index.js index --path ./test-project

# Or using npm
npm run dev -- --inspect-brk index --path ./test-project
```

Then connect with:
- Chrome DevTools: `chrome://inspect`
- VS Code: Press F5 with launch configuration
- JetBrains: Create Node.js debug configuration

**Using VS Code:**

Create `.vscode/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "Debug CLI",
      "type": "node",
      "request": "launch",
      "runtimeArgs": ["--inspect-brk", "-r", "tsx", "src/cli/index.ts"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "args": ["index", "--path", "./test-project"]
    }
  ]
}
```

**Using Chrome DevTools:**

```bash
# Start with debugger
node --inspect-brk dist/cli/index.js index --path ./test-project

# Open Chrome DevTools
# Navigate to chrome://inspect
# Click "inspect" on the target
# Set breakpoints and debug
```

### 1.5 Console Debugging

**Add console.log statements:**

```typescript
// Simple logging
console.log('Variable value:', variable);

// Formatted logging
console.log('Indexing file %s with options %o', filePath, options);

// Error logging
console.error('Error occurred:', error);

// Stack trace
console.trace('Here is the stack trace');

// Table for structured data
console.table({ name: 'PRISM', version: '0.1.0' });
```

**Better: Use debug module:**

```typescript
import createDebug from 'debug';

const debug = createDebug('prism:indexer');

debug('Indexing file: %s', filePath);
debug('Options: %O', options);
debug('Error: %o', error);
```

---

## 2. Logging Configuration

### 2.1 Logger Setup

PRISM uses a custom logger (`src/utils/logger.ts`):

```typescript
import { Logger } from '@/utils/logger';

const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  format: 'pretty',  // or 'json'
  destination: process.stdout,
});

logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');
```

### 2.2 Log Formats

**Pretty format (development):**

```bash
[2026-01-13 10:30:45] INFO  prism:indexer Indexing file: /path/to/file.ts
[2026-01-13 10:30:45] DEBUG prism:indexer Extracted 5 functions
[2026-01-13 10:30:45] INFO  prism:indexer Indexed 100 files in 5.2s
```

**JSON format (production):**

```json
{"timestamp":"2026-01-13T10:30:45.000Z","level":"info","module":"prism:indexer","message":"Indexing file","filePath":"/path/to/file.ts"}
```

### 2.3 Structured Logging

```typescript
logger.info('File indexed', {
  filePath: '/path/to/file.ts',
  functions: 5,
  classes: 2,
  duration: 150,
  tokens: 1250,
});
```

### 2.4 Log Levels by Module

```bash
# Set different levels for different modules
LOG_LEVEL=info              # Default level
DEBUG=prism:indexer:debug   # Indexer at debug level
DEBUG=prism:vector-db:trace # Vector DB at trace level
```

### 2.5 Log to File

```typescript
import { createWriteStream } from 'fs';

const logFile = createWriteStream('./prism-debug.log');
const logger = new Logger({
  level: 'debug',
  destination: logFile,
});
```

Or using environment:

```bash
# Redirect all output to file
prism index --path ./test-project 2>&1 | tee prism-debug.log

# Or only errors
prism index --path ./test-project 2> prism-errors.log
```

---

## 3. Performance Profiling

### 3.1 Built-in Profiling

**Profile indexing:**

```bash
# Enable profiling
prism index --profile --path ./test-project

# Output includes timing information
# ┌─────────────────┬──────────┬─────────┐
# │ Operation       │ Duration │ % Total │
# ├─────────────────┼──────────┼─────────┤
# │ Parsing         │ 1.2s     │ 24%     │
# │ Embeddings      │ 2.5s     │ 50%     │
# │ Storage         │ 0.8s     │ 16%     │
# │ Other           │ 0.5s     │ 10%     │
# └─────────────────┴──────────┴─────────┘
```

### 3.2 Node.js Profiler

**CPU profiling:**

```bash
# Run with CPU profiler
node --prof dist/cli/index.js index --path ./test-project

# Analyze results
node --prof-process isolate-0xnnnnnnnnnnnn-v8.log > profile.txt
```

**Tick profiler:**

```bash
# Generate ticks
node --prof dist/cli/index.js index --path ./test-project

# Process ticks
node --prof-process isolate-*.log > profile.txt

# View profile
cat profile.txt
```

### 3.3 Clinic.js

Advanced Node.js profiling:

```bash
# Install clinic
npm install -g clinic

# Doctor (overall health)
clinic doctor -- on -- dist/cli/index.js index --path ./test-project

# Heap profiler
clinic heapprofiler -- on -- dist/cli/index.js index --path ./test-project

# Flame graph
clinic flame -- on -- dist/cli/index.js index --path ./test-project
```

### 3.4 Custom Performance Metrics

```typescript
import { Performance } from '@/utils/metrics';

const perf = new Performance();

// Start timer
perf.start('indexing');

// Do work
await indexer.indexDirectory(path);

// End timer
perf.end('indexing');

// Get metrics
console.log(perf.getMetrics());
// { indexing: { duration: 5234, memory: 45678912 } }
```

### 3.5 Benchmarking

Compare performance:

```typescript
import { Benchmark } from '@/utils/benchmark';

const bench = new Benchmark();

await bench.run({
  name: 'Indexing 1000 files',
  iterations: 10,
  fn: async () => {
    await indexer.indexDirectory('./test-project');
  },
});

// Output:
// Running Indexing 1000 files... 10 iterations
// Average: 5.2s (min: 4.8s, max: 5.6s)
```

---

## 4. Troubleshooting Common Issues

### 4.1 Build Issues

**Problem: TypeScript compilation fails**

```bash
# Error
error TS2307: Cannot find module '@/utils/logger'

# Solution: Check tsconfig.json paths
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}

# Or rebuild
npm run clean
npm run build
```

**Problem: WASM module not found**

```bash
# Error
Error: Cannot find module 'prism-indexer/pkg/prism_indexer.js'

# Solution: Build WASM first
cd prism-indexer
wasm-pack build --target web --release
cd ..

# Or check file exists
ls -la prism-indexer/pkg/prism_indexer.js
```

**Problem: Native module fails**

```bash
# Error
Error: The module './node_modules/better-sqlite3/build/Release/better_sqlite3.node'

# Solution: Rebuild native modules
npm rebuild better-sqlite3

# Or reinstall
rm -rf node_modules package-lock.json
npm install
```

### 4.2 Runtime Issues

**Problem: "Cannot read property of undefined"**

```bash
# Debug steps:
# 1. Enable stack traces
node --trace-uncaught dist/cli/index.js

# 2. Add debug logging
LOG_LEVEL=trace prism index

# 3. Use debugger
node --inspect-brk dist/cli/index.js

# 4. Check undefined variables
console.log('Variable:', variable);
```

**Problem: "Maximum call stack size exceeded"**

```bash
# Caused by infinite recursion

# Debug with:
node --stack-trace-limit=100 dist/cli/index.js

# Or increase stack size
node --stack-size=10000 dist/cli/index.js

# Find recursion source:
# Add console.log at function entry
# Look for repeated patterns in stack trace
```

**Problem: Memory leak**

```bash
# Detect with:
node --inspect dist/cli/index.js
# Then open Chrome DevTools > Memory > Take heap snapshot

# Or use clinic
clinic heapprofiler -- on -- dist/cli/index.js

# Look for:
# - Growing heap over time
# - Detached DOM nodes
# - Unclosed event emitters
# - Uncleared intervals/timeouts
```

### 4.3 Indexing Issues

**Problem: Indexing is slow**

```bash
# Profile to find bottleneck
prism index --profile --path ./test-project

# Common causes:
# 1. Too many files (use .prismignore)
# 2. Large files (chunking is slow)
# 3. Slow embeddings (use Ollama instead of Workers AI)
# 4. Slow disk (use SSD)
# 5. Single-threaded (WASM is single-threaded)

# Solutions:
# - Exclude unnecessary files
# - Increase chunk size
# - Use local embeddings
# - Use faster storage
# - Enable parallel indexing (when implemented)
```

**Problem: Files not indexed**

```bash
# Check file is supported
prism index --verbose --path ./test-project | grep unsupported

# Check file extension
ls -la file.unknown

# Add extension to supported list
# In src/indexer/types.ts
export const SUPPORTED_EXTENSIONS = [
  '.ts', '.js', '.py', '.rs', '.go', '.java',
  '.your-extension',  // Add here
];

# Check .prismignore
cat .prismignore
```

**Problem: Incremental indexing not working**

```bash
# Force full re-index
prism index --force --path ./test-project

# Check file modification times
ls -la --time-style=full-iso

# Clear index cache
rm -rf .prism/index.db
prism index --path ./test-project
```

### 4.4 Search Issues

**Problem: No results found**

```bash
# Check query is being processed
prism search --verbose "your query"

# Check embeddings were generated
prism stats | grep "Vectors"

# Check query embedding
LOG_LEVEL=debug prism search "your query"

# Try simpler query
prism search "function"

# Check database
sqlite3 .prism/index.db "SELECT COUNT(*) FROM vectors;"
```

**Problem: Irrelevant results**

```bash
# Check embeddings quality
prism search --verbose "your query"

# Common causes:
# 1. Poor embeddings (try different model)
# 2. Low topK (increase limit)
# 3. Wrong filters (remove filters)
# 4. Database corruption (re-index)

# Solutions:
# - Use better embedding model
# - Increase topK: prism search --limit 20
# - Remove filters: prism search --no-filter
# - Re-index: prism index --force
```

### 4.5 Database Issues

**Problem: Database locked**

```bash
# Error: database is locked

# Cause: Another process using database

# Solution: Close other processes
ps aux | grep prism
kill <pid>

# Or use WAL mode
# In src/vector-db/adapters/SQLite.ts
db.pragma('journal_mode = WAL');
```

**Problem: Database corrupted**

```bash
# Error: database disk image is malformed

# Solution: Rebuild database
rm .prism/index.db
prism index --path ./test-project

# Or try to recover
sqlite3 .prism/index.db "PRAGMA integrity_check;"
```

### 4.6 Network Issues

**Problem: Ollama connection refused**

```bash
# Error: connect ECONNREFUSED localhost:11434

# Check Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve

# Check endpoint
echo $OLLAMA_ENDPOINT
export OLLAMA_ENDPOINT=http://localhost:11434

# Check model is available
curl http://localhost:11434/api/tags
```

**Problem: Cloudflare API timeout**

```bash
# Error: Request timed out

# Check credentials
echo $CLOUDFLARE_API_TOKEN

# Test connection
curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/user/tokens/verify

# Increase timeout
# In src/embeddings/providers/WorkersAI.ts
const response = await fetch(url, {
  signal: AbortSignal.timeout(30000),  // 30s
});
```

---

## 5. Debugging Tools

### 5.1 Node.js Inspector

```bash
# Start with inspector
node --inspect dist/cli/index.js index --path ./test-project

# Open DevTools
chrome://inspect

# Or use VS Code debugger
# Set breakpoints in code
# Press F5
```

### 5.2 ndb (Improved Node Debugger)

```bash
# Install ndb
npm install -g ndb

# Debug with ndb
ndb dist/cli/index.js index --path ./test-project
```

### 5.3 Chrome DevTools

**Features:**
- Breakpoints
- Step through code
- Inspect variables
- View call stack
- Performance profiling
- Memory profiling

**Usage:**
```bash
node --inspect-brk dist/cli/index.js
# Open chrome://inspect
# Click "inspect"
```

### 5.4 VS Code Debugger

**Setup `.vscode/launch.json`:**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "Debug PRISM",
      "type": "node",
      "request": "launch",
      "runtimeArgs": ["--inspect-brk", "-r", "tsx", "src/cli/index.ts"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### 5.5 Debug Tests

```bash
# Debug single test file
node --inspect-brk node_modules/.bin/vitest run tests/unit/vector-db/

# Or use VS Code
# Set breakpoints in test file
# Press F5 with test configuration
```

---

## 6. Memory Profiling

### 6.1 Heap Snapshots

```bash
# Take heap snapshot
node --heapsnapshot-signal=SIGUSR2 dist/cli/index.js

# Send signal to take snapshot
kill -USR2 <pid>

# Analyze snapshot
chrome://inspect > Profiling > Load snapshot
```

### 6.2 Memory Leaks

**Common causes:**
- Unclosed connections
- Event listeners not removed
- Caches growing unbounded
- Closures retaining references

**Detection:**
```typescript
// Track memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory:', {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    external: Math.round(usage.external / 1024 / 1024) + 'MB',
  });
}, 1000);

// Look for:
// - Continuous growth
// - No garbage collection
// - Growing heapUsed
```

**Fixing leaks:**
```typescript
// 1. Close connections
await connection.close();

// 2. Remove event listeners
eventEmitter.removeListener('event', handler);

// 3. Clear caches
cache.clear();

// 4. Nullify references
obj.ref = null;
```

### 6.3 Garbage Collection

**Force garbage collection:**

```bash
# Run with GC flag
node --expose-gc dist/cli/index.js

# In code
if (global.gc) {
  global.gc();
}
```

---

## 7. Network Debugging

### 7.1 HTTP Debugging

**Debug HTTP requests:**

```typescript
import { debug } from 'debug';

// Enable request logging
debug.enable('axios');

// Or manually log
const response = await fetch(url);
console.log('Request:', {
  url: response.url,
  status: response.status,
  headers: Object.fromEntries(response.headers),
});
```

### 7.2 Proxy Debugging

**Use proxy to inspect traffic:**

```bash
# Install mitmproxy
pip install mitmproxy

# Start proxy
mitmproxy -p 8080

# Use proxy
export HTTP_PROXY=http://localhost:8080
export HTTPS_PROXY=http://localhost:8080

prism index --path ./test-project
```

### 7.3 Ollama Debugging

```bash
# Enable Ollama logging
OLLAMA_DEBUG=1 prism index

# Check Ollama logs
ollama logs

# Test Ollama directly
curl http://localhost:11434/api/generate -d '{
  "model": "deepseek-coder-v2",
  "prompt": "test"
}'
```

---

## 8. Production Debugging

### 8.1 Debugging in Production

**Enable debug logging:**

```bash
# Set log level
LOG_LEVEL=debug prism index

# Or write to file
LOG_LEVEL=debug prism index 2>&1 > production-debug.log
```

**Remote debugging:**

```bash
# Start with inspector listening
node --inspect=0.0.0.0:9229 dist/cli/index.js

# Connect from remote machine
ssh -L 9229:localhost:9229 user@remote-machine
# Then open chrome://inspect
```

### 8.2 Error Tracking

**Use error tracking service:**

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

### 8.3 Performance Monitoring

**Track performance:**

```typescript
import { Performance } from '@/utils/metrics';

const perf = new Performance();

// In production
perf.start('operation');
await operation();
perf.end('operation');

// Send to monitoring service
sendToMonitoring(perf.getMetrics());
```

---

## 9. Debug Checklist

Before asking for help, check:

- [ ] Enabled debug logging (`LOG_LEVEL=debug`)
- [ ] Checked error messages
- [ ] Reviewed stack traces
- [ ] Verified file permissions
- [ ] Checked disk space
- [ ] Verified environment variables
- [ ] Rebuilt project (`npm run build`)
- [ ] Ran tests (`npm test`)
- [ ] Checked documentation
- [ ] Searched existing issues

---

## 10. Getting Help

**Resources:**
- Documentation: `docs/`
- GitHub Issues: [github.com/YOUR_USERNAME/prism/issues](https://github.com/YOUR_USERNAME/prism/issues)
- Discussions: [github.com/YOUR_USERNAME/prism/discussions](https://github.com/YOUR_USERNAME/prism/discussions)

**When asking for help, include:**
- PRISM version (`prism --version`)
- Node.js version (`node --version`)
- Operating system
- Error messages and stack traces
- Steps to reproduce
- Debug logs (`LOG_LEVEL=debug prism command 2>&1 > debug.log`)

---

**Document Status**: Complete
**Last Updated**: 2026-01-13
**Next Review**: After major debugging improvements
