# PRISM - Production Deployment Guide

> **100% Production-Ready - Comprehensive Deployment Documentation**

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Security Hardening](#security-hardening)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Monitoring & Health Checks](#monitoring--health-checks)
7. [Performance Tuning](#performance-tuning)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

---

## Overview

PRISM is now 100% production-ready with enterprise-grade features:

### ✅ Security Features
- **CORS Protection**: Restricted to localhost only
- **Path Traversal Protection**: Full canonicalization and validation
- **Input Validation**: Port range, request size, query length limits
- **Atomic File Writes**: Prevents index corruption
- **Write Locking**: Prevents race conditions

### ✅ Reliability Features
- **Graceful Shutdown**: 5-second timeout with force-close
- **Watcher Auto-Restart**: Automatic recovery from errors
- **Connection Limits**: Max 100 concurrent connections
- **Request Timeout**: 30-second timeout per request
- **Error Handling**: Comprehensive try-catch blocks

### ✅ Observability Features
- **Health Endpoints**: `/health` (liveness) and `/ready` (readiness)
- **Metrics Endpoint**: `/metrics` with detailed statistics
- **Structured Logging**: Timestamps, error tracking, performance metrics
- **Memory Monitoring**: RSS, heap usage tracking

---

## Prerequisites

### System Requirements

- **Node.js**: v16+ recommended
- **Memory**: Minimum 512MB, recommended 1GB
- **Disk Space**: Varies by project size (index ~5-10% of project size)
- **Operating System**: Linux, macOS, or Windows

### Port Requirements

- Default port: `8080`
- Configurable range: `1024-65535` (validated)
- Ensure port is available and not blocked by firewall

---

## Security Hardening

### 1. Port Configuration

```bash
# Use non-privileged port (1024-65535)
export PORT=8080

# Invalid ports will be rejected:
# PORT=80    # Error: requires root
# PORT=0     # Error: invalid
# PORT=70000 # Error: out of range
```

### 2. CORS Protection

CORS is automatically restricted to localhost:
- `http://localhost:*`
- `http://127.0.0.1:*`

**No external websites can access the daemon.**

### 3. Path Traversal Protection

All file paths are:
1. Resolved to absolute paths
2. Canonicalized (symlinks resolved)
3. Validated to stay within `PROJECT_ROOT`

```javascript
// ✅ Valid: /project/src/file.js
// ❌ Invalid: /project/../../../etc/passwd
```

### 4. Request Limits

```javascript
{
  maxRequestSize: "1MB",      // Prevents memory exhaustion
  maxQueryLength: "10,000",   // Prevents DoS
  maxConnections: 100,        // Prevents connection flood
  requestTimeout: "30s"       // Prevents hanging requests
}
```

---

## Configuration

### Environment Variables

```bash
# Required
export PROJECT_ROOT=/path/to/your/project

# Optional (with defaults)
export PORT=8080                      # Server port (1024-65535)
export LOG_LEVEL=info                 # Logging level
export ENABLE_WATCHER=true            # File watcher (true/false)
export SHUTDOWN_TIMEOUT=5000          # Graceful shutdown timeout (ms)
```

### Configuration Validation

The daemon validates all configuration on startup:

```bash
# Port validation
✅ PORT=8080         # Valid
❌ PORT=abc          # Invalid (not a number)
❌ PORT=80           # Invalid (requires root)
❌ PORT=70000        # Invalid (out of range)

# Shutdown timeout validation
✅ SHUTDOWN_TIMEOUT=5000   # Valid
❌ SHUTDOWN_TIMEOUT=abc    # Falls back to default (5000)
```

---

## Deployment

### Method 1: Direct Execution

```bash
# Navigate to project
cd /path/to/your/project

# Set environment
export PROJECT_ROOT=$(pwd)
export PORT=8080

# Start daemon
node /path/to/prism/claude-code-plugin/daemon/server.js
```

### Method 2: systemd Service (Recommended for Production)

Create `/etc/systemd/system/prism.service`:

```ini
[Unit]
Description=PRISM Daemon - Project Memory for Claude Code
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/your/project
Environment="PROJECT_ROOT=/path/to/your/project"
Environment="PORT=8080"
Environment="LOG_LEVEL=info"
Environment="ENABLE_WATCHER=true"
ExecStart=/usr/bin/node /path/to/prism/claude-code-plugin/daemon/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/path/to/your/project/.prism

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable prism
sudo systemctl start prism

# Check status
sudo systemctl status prism

# View logs
sudo journalctl -u prism -f
```

### Method 3: Docker Container

Create `Dockerfile`:

```dockerfile
FROM node:16-alpine

WORKDIR /app

# Copy daemon files
COPY claude-code-plugin/daemon /app/daemon

# Install dependencies (if any)
# RUN npm install

# Expose port
EXPOSE 8080

# Set environment
ENV PORT=8080
ENV PROJECT_ROOT=/project

# Mount your project at /project
VOLUME ["/project"]

# Start daemon
CMD ["node", "/app/daemon/server.js"]
```

Build and run:

```bash
docker build -t prism-daemon .
docker run -d \
  -p 8080:8080 \
  -v /path/to/your/project:/project \
  --name prism \
  prism-daemon
```

---

## Monitoring & Health Checks

### Health Endpoints

#### 1. Liveness Check: `/health`

```bash
curl http://localhost:8080/health
```

**Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2026-01-15T12:00:00.000Z",
  "uptime": 3600
}
```

**Use Case**: Process is alive (Kubernetes liveness probe)

#### 2. Readiness Check: `/ready`

```bash
curl http://localhost:8080/ready
```

**Response** (200 OK when ready):
```json
{
  "status": "ready",
  "index_loaded": true,
  "project": "my-project",
  "watcher_status": "active",
  "file_count": 1234,
  "timestamp": "2026-01-15T12:00:00.000Z"
}
```

**Response** (503 Service Unavailable when not ready):
```json
{
  "status": "not_ready",
  "index_loaded": false,
  "watcher_status": "inactive",
  "message": "Service is still initializing",
  "timestamp": "2026-01-15T12:00:00.000Z"
}
```

**Use Case**: Service ready to handle requests (Kubernetes readiness probe)

#### 3. Metrics Endpoint: `/metrics`

```bash
curl http://localhost:8080/metrics
```

**Response** (200 OK):
```json
{
  "uptime_seconds": 3600,
  "requests": {
    "total": 1523,
    "search": 1200,
    "index": 5,
    "tools": 318,
    "requests_per_second": "0.42"
  },
  "errors": 3,
  "index": {
    "file_count": 1234,
    "loaded": true,
    "last_index_time": "2026-01-15T11:30:00.000Z"
  },
  "watcher": {
    "isWatching": true,
    "filesChanged": 45,
    "filesCreated": 12,
    "filesDeleted": 3,
    "errors": 0
  },
  "memory": {
    "rss_mb": "156.32",
    "heap_used_mb": "89.45",
    "heap_total_mb": "120.00"
  },
  "timestamp": "2026-01-15T12:00:00.000Z"
}
```

### Kubernetes Health Check Configuration

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: prism-daemon
spec:
  containers:
  - name: prism
    image: prism-daemon:latest
    ports:
    - containerPort: 8080
    livenessProbe:
      httpGet:
        path: /health
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 30
      timeoutSeconds: 5
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 3
```

### Monitoring Alerts

Set up alerts for:

1. **High Error Rate**: `errors > 10/minute`
2. **Memory Leak**: `memory.rss_mb > 500`
3. **Service Down**: `/health` returns non-200
4. **Service Not Ready**: `/ready` returns 503 for >60s
5. **Watcher Errors**: `watcher.errors > 5`

---

## Performance Tuning

### 1. Memory Management

```bash
# Monitor memory usage
curl http://localhost:8080/metrics | jq '.memory'

# If memory usage is high:
# - Reduce file content cache size (default: 50 files)
# - Reduce search cache size (default: 100 queries)
# - Restart daemon periodically (e.g., daily)
```

### 2. Connection Limits

Current limit: **100 concurrent connections**

```javascript
// Adjust if needed (in server.js constructor):
this.server.maxConnections = 200; // Increase for high traffic
```

### 3. Request Timeout

Current timeout: **30 seconds**

```javascript
// Adjust if needed (in server.js start method):
this.server.timeout = 60000; // Increase for large projects
```

### 4. File Watcher Performance

```bash
# Disable watcher if not needed (reduces resource usage)
export ENABLE_WATCHER=false

# Watcher statistics
curl http://localhost:8080/watcher/status
```

---

## Troubleshooting

### Port Already in Use

```bash
# Error: Port 8080 is already in use
[PRISM] Port 8080 is already in use

# Solution 1: Use different port
export PORT=8081

# Solution 2: Kill existing process
lsof -ti:8080 | xargs kill
```

### Index Not Loading

```bash
# Check readiness
curl http://localhost:8080/ready

# If not ready:
# - Check logs for indexing errors
# - Verify PROJECT_ROOT is correct
# - Check .prism directory permissions
# - Trigger manual reindex:
curl -X POST http://localhost:8080/index
```

### High Memory Usage

```bash
# Check metrics
curl http://localhost:8080/metrics | jq '.memory'

# If RSS > 500MB:
# - Restart daemon
# - Check for large files being indexed
# - Exclude unnecessary directories
# - Reduce cache sizes
```

### Watcher Not Working

```bash
# Check watcher status
curl http://localhost:8080/watcher/status

# If inactive:
# - Verify ENABLE_WATCHER=true
# - Check watcher errors in metrics
# - Manually restart watcher:
curl -X POST http://localhost:8080/watcher/enable
```

### Search Not Finding Results

```bash
# Check if index is loaded
curl http://localhost:8080/ready

# Trigger reindex
curl -X POST http://localhost:8080/index

# Wait for reindex to complete (check logs)
# Then retry search
```

---

## Maintenance

### Daily Tasks

1. **Monitor metrics**:
   ```bash
   curl http://localhost:8080/metrics
   ```

2. **Check health**:
   ```bash
   curl http://localhost:8080/health
   curl http://localhost:8080/ready
   ```

3. **Review logs** for errors:
   ```bash
   # systemd
   sudo journalctl -u prism --since today

   # Docker
   docker logs prism
   ```

### Weekly Tasks

1. **Review performance metrics**:
   - Request rate trends
   - Error rate analysis
   - Memory usage patterns

2. **Update exclusion patterns** if needed
3. **Verify backups** (if using persistent storage)

### Monthly Tasks

1. **Review and update** daemon version
2. **Performance optimization** based on metrics
3. **Security audit** of configurations

### Backup & Recovery

```bash
# Backup index
cp -r /path/to/project/.prism /backup/location/

# Restore index
cp -r /backup/location/.prism /path/to/project/

# Or simply reindex (fast with inverted index)
curl -X POST http://localhost:8080/index
```

---

## Production Checklist

Before deploying to production:

- [ ] Port configured and validated (1024-65535)
- [ ] PROJECT_ROOT environment variable set
- [ ] Service starts and stops cleanly
- [ ] `/health` endpoint returns 200
- [ ] `/ready` endpoint returns 200 after initialization
- [ ] `/metrics` endpoint provides accurate data
- [ ] CORS restricted to localhost
- [ ] Graceful shutdown works (SIGTERM/SIGINT)
- [ ] Watcher auto-restart verified
- [ ] Connection limits tested
- [ ] Request timeout works
- [ ] Logs are being collected
- [ ] Monitoring/alerts configured
- [ ] Backup strategy in place
- [ ] Documentation reviewed and updated

---

## Security Hardening Summary

### ✅ Implemented Security Features

1. **Input Validation**
   - Port range validation (1024-65535)
   - Request size limits (1MB)
   - Query length limits (10,000 chars)
   - JSON parsing with error handling

2. **Path Security**
   - Full path canonicalization
   - Directory traversal protection
   - Project root boundary enforcement
   - Symlink resolution

3. **Network Security**
   - CORS restricted to localhost
   - Connection limits (100 max)
   - Request timeouts (30s)
   - No external API access

4. **Data Integrity**
   - Atomic file writes
   - Write locking (prevents race conditions)
   - Index backup on write
   - Graceful error recovery

5. **Process Security**
   - Graceful shutdown handling
   - Error tracking and metrics
   - Resource cleanup
   - No privilege escalation

---

## Support

For issues or questions:

1. Check this guide's [Troubleshooting](#troubleshooting) section
2. Review metrics: `curl http://localhost:8080/metrics`
3. Check logs for error messages
4. Verify configuration environment variables
5. Test health endpoints

---

**Version**: 1.0 Production-Ready
**Last Updated**: 2026-01-15
**Status**: ✅ 100% Production-Ready
