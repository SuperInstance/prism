# File Watcher Documentation

## Overview

The PRISM file watcher automatically monitors your project for file changes and keeps the index up-to-date without manual intervention. It uses Node.js's built-in `fs.watch` API (no external dependencies required) and implements intelligent debouncing to avoid excessive reindexing.

## Features

- **Automatic Reindexing**: Detects file creates, modifications, and deletions
- **Incremental Updates**: Only reindexes changed files, not the entire project
- **Debouncing**: Batches rapid changes to avoid excessive reindexing (500ms default)
- **Smart Filtering**: Respects include/exclude patterns (e.g., ignores `node_modules`)
- **Zero Dependencies**: Uses only Node.js built-in APIs
- **Low Overhead**: Minimal CPU and memory usage
- **Graceful Error Handling**: Continues working even if individual files fail

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                  File System                        │
└──────────┬──────────────────────────────────────────┘
           │ File Changes (create/modify/delete)
           ▼
┌─────────────────────────────────────────────────────┐
│              File Watcher                           │
│  - Monitor directories recursively                  │
│  - Filter by include/exclude patterns               │
│  - Debounce rapid changes (500ms)                   │
└──────────┬──────────────────────────────────────────┘
           │ Emit events (fileCreated/Changed/Deleted)
           ▼
┌─────────────────────────────────────────────────────┐
│            Event Handlers                           │
│  - fileCreated → indexer.updateFile()               │
│  - fileChanged → indexer.updateFile()               │
│  - fileDeleted → indexer.removeFile()               │
└──────────┬──────────────────────────────────────────┘
           │ Update index
           ▼
┌─────────────────────────────────────────────────────┐
│           File Indexer                              │
│  - Incremental index updates                        │
│  - Timestamp tracking                               │
│  - Efficient diff-based updates                     │
└─────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

The file watcher can be configured using environment variables in `.mcp.json`:

```json
{
  "mcpServers": {
    "prism-daemon": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/daemon/server.js"],
      "env": {
        "ENABLE_WATCHER": "true",
        "PROJECT_ROOT": "${PROJECT_ROOT:-${CLAUDE_PLUGIN_ROOT}}"
      }
    }
  }
}
```

**Available Options:**

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_WATCHER` | `true` | Enable/disable file watcher |
| `PROJECT_ROOT` | Current directory | Root directory to watch |

### Programmatic Configuration

You can also configure the watcher programmatically:

```javascript
const FileWatcher = require('./daemon/file-watcher');

const watcher = new FileWatcher(projectRoot, {
  debounceMs: 500,  // Debounce delay in milliseconds
  includePatterns: [
    /\.(js|ts|jsx|tsx|py|go|rs|java|cs|php|rb)$/,
    /\.(md|json|yaml|yml)$/
  ],
  excludePatterns: [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/
  ]
});

await watcher.start();
```

## API Endpoints

### GET /watcher/status

Get the current status and statistics of the file watcher.

**Response:**

```json
{
  "enabled": true,
  "isWatching": true,
  "filesChanged": 42,
  "filesCreated": 10,
  "filesDeleted": 3,
  "errors": 0,
  "lastChange": "2026-01-15T16:48:26.701Z",
  "watchedDirectories": 25,
  "pendingChanges": 0
}
```

**Example:**

```bash
curl http://localhost:8080/watcher/status
```

### POST /watcher/enable

Enable the file watcher (if it was disabled).

**Response:**

```json
{
  "status": "enabled",
  "message": "File watcher started"
}
```

**Example:**

```bash
curl -X POST http://localhost:8080/watcher/enable
```

### POST /watcher/disable

Disable the file watcher.

**Response:**

```json
{
  "status": "disabled",
  "message": "File watcher stopped"
}
```

**Example:**

```bash
curl -X POST http://localhost:8080/watcher/disable
```

## Include/Exclude Patterns

### Default Include Patterns

Files matching these extensions are automatically indexed:

- **JavaScript/TypeScript**: `.js`, `.jsx`, `.ts`, `.tsx`
- **Python**: `.py`
- **Go**: `.go`
- **Rust**: `.rs`
- **Java**: `.java`
- **C#**: `.cs`
- **PHP**: `.php`
- **Ruby**: `.rb`
- **Documentation**: `.md`
- **Config**: `.json`, `.yaml`, `.yml`

### Default Exclude Patterns

These directories are automatically excluded from watching:

- `node_modules/`
- `.git/`
- `dist/`
- `build/`
- `coverage/`
- `.next/`
- `.prism/`
- `.claude-plugin/`

### Custom Patterns

You can customize patterns by modifying the `FileWatcher` constructor options:

```javascript
const watcher = new FileWatcher(projectRoot, {
  includePatterns: [
    /\.(js|ts)$/,        // Only JavaScript/TypeScript
    /\.config\.js$/      // Config files
  ],
  excludePatterns: [
    /node_modules/,
    /test/,              // Exclude test directory
    /\.spec\.js$/        // Exclude spec files
  ]
});
```

## Performance

### Debouncing

The file watcher uses a 500ms debounce delay by default. This means:

- Rapid changes to the same file within 500ms are batched
- Only one reindex operation occurs per batch
- Reduces CPU usage during active development

### Memory Usage

The file watcher maintains:

- One watcher per directory (not per file)
- Debounce timers for pending changes (cleared after processing)
- Event listeners for file changes
- Typical memory overhead: <10MB for large projects

### CPU Usage

- Idle: <0.1% CPU usage
- During file changes: <2% CPU usage
- Indexing overhead: Only changed files are reindexed

## Incremental Indexing

The file watcher uses incremental indexing to minimize reindexing time:

### File Creation/Modification

```javascript
// Only the changed file is reindexed
await indexer.updateFile(fullPath);

// Steps:
// 1. Read file content
// 2. Parse and extract metadata
// 3. Update in-memory index
// 4. Save index to disk
```

### File Deletion

```javascript
// Only the deleted file is removed from index
await indexer.removeFile(fullPath);

// Steps:
// 1. Find file in index
// 2. Remove from in-memory index
// 3. Update file_count
// 4. Save index to disk
```

### Timestamp Tracking

The index includes a `file_timestamps` map for efficient change detection:

```json
{
  "version": "1.0",
  "file_count": 42,
  "indexed_at": "2026-01-15T16:48:26.701Z",
  "file_timestamps": {
    "src/index.js": "2026-01-15T16:45:00.000Z",
    "src/utils.js": "2026-01-15T16:47:00.000Z"
  },
  "files": [...]
}
```

## Error Handling

The file watcher implements graceful error handling:

### Directory Access Errors

```javascript
// Silently skip directories without access
try {
  await watchDirectory(dir);
} catch (error) {
  if (error.code !== 'ENOENT' && error.code !== 'EACCES') {
    console.warn(`Failed to watch ${dir}:`, error.message);
  }
}
```

### File Processing Errors

```javascript
// Continue watching even if individual files fail
try {
  await indexer.updateFile(filePath);
} catch (error) {
  console.error('Failed to update file:', error.message);
  // Watcher continues running
}
```

### Statistics Tracking

All errors are tracked in watcher statistics:

```javascript
const stats = watcher.getStats();
console.log(`Errors: ${stats.errors}`);
```

## Troubleshooting

### Watcher Not Starting

**Problem**: File watcher doesn't start automatically

**Solution**:
1. Check `ENABLE_WATCHER` environment variable:
   ```bash
   curl http://localhost:8080/watcher/status
   ```

2. Enable manually if disabled:
   ```bash
   curl -X POST http://localhost:8080/watcher/enable
   ```

3. Check logs for error messages

### Changes Not Detected

**Problem**: File changes are not triggering reindexing

**Solution**:
1. Verify file matches include patterns (check extension)
2. Verify file is not in excluded directories
3. Check watcher status:
   ```bash
   curl http://localhost:8080/watcher/status
   ```

4. Check for errors in statistics:
   ```javascript
   const stats = watcher.getStats();
   if (stats.errors > 0) {
     // Review error logs
   }
   ```

### High CPU Usage

**Problem**: File watcher using excessive CPU

**Solution**:
1. Increase debounce delay:
   ```javascript
   const watcher = new FileWatcher(projectRoot, {
     debounceMs: 1000  // Increase to 1 second
   });
   ```

2. Add more exclude patterns:
   ```javascript
   excludePatterns: [
     /node_modules/,
     /\.git/,
     /large-data-dir/  // Add large directories
   ]
   ```

3. Disable watcher temporarily:
   ```bash
   curl -X POST http://localhost:8080/watcher/disable
   ```

### Memory Leaks

**Problem**: Memory usage grows over time

**Solution**:
1. Check pending changes:
   ```bash
   curl http://localhost:8080/watcher/status
   # Look at "pendingChanges" field
   ```

2. Reset statistics periodically:
   ```javascript
   watcher.resetStats();
   ```

3. Restart daemon if necessary:
   ```bash
   # Stop and start the daemon
   ```

## Testing

### Run Tests

```bash
cd claude-code-plugin
node test/test-file-watcher.js
```

### Run Demo

```bash
cd claude-code-plugin
node test/demo-file-watcher.js
```

### Test Coverage

The file watcher test suite covers:

- [x] File creation detection
- [x] File modification detection
- [x] File deletion detection
- [x] Debouncing behavior
- [x] Include/exclude patterns
- [x] Integration with FileIndexer
- [x] Statistics tracking
- [x] Memory leak prevention
- [x] Graceful start/stop

## Best Practices

### 1. Use Appropriate Debounce Delay

```javascript
// For development (fast feedback)
debounceMs: 300

// For production (reduce overhead)
debounceMs: 1000
```

### 2. Exclude Large Directories

```javascript
excludePatterns: [
  /node_modules/,
  /\.git/,
  /large-dataset/,    // Exclude data directories
  /vendor/,           // Exclude vendor directories
  /public\/assets/    // Exclude asset directories
]
```

### 3. Monitor Statistics

```javascript
// Periodically check watcher health
setInterval(async () => {
  const stats = watcher.getStats();
  if (stats.errors > 10) {
    console.warn('File watcher has errors:', stats.errors);
  }
}, 60000); // Check every minute
```

### 4. Handle Daemon Restarts

```javascript
// Gracefully stop watcher on shutdown
process.on('SIGTERM', () => {
  watcher.stop();
  process.exit(0);
});
```

## Advanced Usage

### Custom Event Handlers

```javascript
const watcher = new FileWatcher(projectRoot);

// Listen to specific events
watcher.on('fileCreated', ({ path, fullPath }) => {
  console.log(`New file: ${path}`);
  // Custom logic here
});

watcher.on('fileChanged', ({ path, fullPath }) => {
  console.log(`File changed: ${path}`);
  // Custom logic here
});

watcher.on('fileDeleted', ({ path, fullPath }) => {
  console.log(`File deleted: ${path}`);
  // Custom logic here
});

await watcher.start();
```

### Conditional Watching

```javascript
// Only watch specific directories
const watcher = new FileWatcher(path.join(projectRoot, 'src'), {
  includePatterns: [/\.ts$/]  // Only TypeScript files
});
```

### Dynamic Pattern Updates

```javascript
// Update patterns at runtime
watcher.options.excludePatterns.push(/temp/);
```

## Roadmap

Future enhancements planned:

- [ ] Configurable patterns via API
- [ ] Watch multiple project roots
- [ ] Batch reindexing for bulk changes
- [ ] Custom event filters
- [ ] Performance profiling tools
- [ ] Integration with IDE plugins

## License

MIT License - See LICENSE file for details
