# File Watcher Quick Reference

## Overview
Automatic reindexing when files change - zero configuration required.

## Status & Control

### Check Status
```bash
curl http://localhost:8080/watcher/status
```

**Response:**
```json
{
  "enabled": true,
  "isWatching": true,
  "filesChanged": 42,
  "filesCreated": 10,
  "filesDeleted": 3,
  "watchedDirectories": 25
}
```

### Enable Watcher
```bash
curl -X POST http://localhost:8080/watcher/enable
```

### Disable Watcher
```bash
curl -X POST http://localhost:8080/watcher/disable
```

## Configuration

### Environment Variables (in .mcp.json)
```json
{
  "mcpServers": {
    "prism-daemon": {
      "env": {
        "ENABLE_WATCHER": "true",
        "PROJECT_ROOT": "${PROJECT_ROOT}"
      }
    }
  }
}
```

## What Gets Watched

### ✅ Included Files
- JavaScript/TypeScript: `.js`, `.jsx`, `.ts`, `.tsx`
- Python: `.py`
- Go: `.go`
- Rust: `.rs`
- Java: `.java`
- C#: `.cs`
- PHP: `.php`
- Ruby: `.rb`
- Docs: `.md`
- Config: `.json`, `.yaml`, `.yml`

### ❌ Excluded Directories
- `node_modules/`
- `.git/`
- `dist/`, `build/`
- `coverage/`
- `.next/`
- `.prism/`, `.claude-plugin/`

## How It Works

1. **File Changes Detected** → Debounced (500ms)
2. **Event Emitted** → fileCreated/Changed/Deleted
3. **Index Updated** → Only affected files
4. **Ready for Search** → Instant results

## Performance

| Metric | Value |
|--------|-------|
| CPU (idle) | <0.1% |
| CPU (active) | <2% |
| Memory | <10MB |
| Debounce | 500ms |
| Update time | <100ms |

## Troubleshooting

### Changes Not Detected
1. Check file extension matches included patterns
2. Verify file not in excluded directory
3. Check watcher status
4. Review error count in statistics

### High CPU Usage
1. Increase debounce delay
2. Add more exclude patterns
3. Temporarily disable watcher

### Restart Watcher
```bash
curl -X POST http://localhost:8080/watcher/disable
curl -X POST http://localhost:8080/watcher/enable
```

## Testing

### Run Tests
```bash
node test/test-file-watcher.js
```

### Run Demo
```bash
node test/demo-file-watcher.js
```

## Full Documentation
See [FILE_WATCHER.md](FILE_WATCHER.md) for complete documentation.
