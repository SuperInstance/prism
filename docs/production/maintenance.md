# PRISM Maintenance Guide

**Version:** 0.1.0
**Last Updated:** 2026-01-13
**Target Audience:** DevOps Engineers, System Administrators

## Table of Contents

1. [Overview](#overview)
2. [Daily Maintenance Tasks](#daily-maintenance-tasks)
3. [Weekly Maintenance Tasks](#weekly-maintenance-tasks)
4. [Monthly Maintenance Tasks](#monthly-maintenance-tasks)
5. [Index Updates](#index-updates)
6. [Database Cleanup](#database-cleanup)
7. [Log Rotation](#log-rotation)
8. [Backup Procedures](#backup-procedures)
9. [Health Monitoring](#health-monitoring)
10. [Performance Tuning](#performance-tuning)
11. [Troubleshooting](#troubleshooting)

---

## Overview

Regular maintenance is essential for keeping PRISM running smoothly. This guide provides a comprehensive maintenance schedule and procedures.

### Maintenance Philosophy

- **Preventive:** Fix issues before they cause problems
- **Automated:** Automate repetitive tasks
- **Documented:** Keep records of all maintenance
- **Tested:** Verify procedures before production

### Maintenance Schedule

```
┌─────────────────────────────────────────────────────┐
│           Maintenance Schedule                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Daily:    Health checks, log review                │
│  Weekly:   Index updates, cleanup                   │
│  Monthly:  Backup verification, performance review  │
│  Quarterly: Security audits, dependency updates     │
│  Annually: Architecture review, capacity planning   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Daily Maintenance Tasks

### 1. Health Checks (Automated)

**Script:** `scripts/daily-health-check.sh`

```bash
#!/bin/bash
# Daily health check for PRISM

echo "🏥 PRISM Daily Health Check - $(date)"
echo "======================================="

# Check 1: Worker health
echo "📊 Checking Worker health..."
HEALTH=$(curl -s https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/health)
STATUS=$(echo $HEALTH | jq -r '.status')

if [ "$STATUS" != "healthy" ]; then
  echo "❌ Worker unhealthy: $HEALTH"
  # Send alert
  send-alert "Worker health check failed"
else
  echo "✅ Worker healthy"
fi

# Check 2: Database connectivity
echo "🗄️  Checking database..."
DB_CHECK=$(wrangler d1 execute claudes-friend-db --command="SELECT 1" 2>&1)
if [ $? -ne 0 ]; then
  echo "❌ Database error: $DB_CHECK"
  send-alert "Database health check failed"
else
  echo "✅ Database connected"
fi

# Check 3: Vectorize status
echo "🔍 Checking Vectorize index..."
VECTOR_SIZE=$(wrangler vectorize describe claudes-companion 2>&1 | grep "Count" | awk '{print $2}')
if [ -z "$VECTOR_SIZE" ]; then
  echo "❌ Vectorize error"
  send-alert "Vectorize health check failed"
else
  echo "✅ Vectorize OK ($VECTOR_SIZE vectors)"
fi

# Check 4: Free tier usage
echo "📈 Checking free tier usage..."
USAGE=$(curl -s https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/metrics)
NEURONS_USED=$(echo $USAGE | jq -r '.resources.neurons_used')
NEURONS_LIMIT=$(echo $USAGE | jq -r '.resources.neurons_limit')
USAGE_PERCENT=$(echo "scale=2; $NEURONS_USED / $NEURONS_LIMIT * 100" | bc)

echo "   Neurons used: $NEURONS_USED / $NEURONS_LIMIT ($USAGE_PERCENT%)"

if (( $(echo "$USAGE_PERCENT > 80" | bc -l) )); then
  echo "⚠️  Usage above 80%"
  send-alert "Free tier usage at $USAGE_PERCENT%"
fi

echo "✅ Daily health check complete"
```

**Schedule:** Run via cron at 9:00 AM daily

```bash
# Add to crontab
0 9 * * * /path/to/scripts/daily-health-check.sh >> /var/log/prism/health.log 2>&1
```

### 2. Log Review

**Check for anomalies:**

```bash
# View last 24 hours of error logs
wrangler tail --since 24h --status error

# Check for specific error patterns
wrangler tail --since 24h | grep -i "error\|exception\|failed"

# Check rate limit violations
wrangler tail --since 24h | grep "rate limit"
```

**Key metrics to review:**
- Error rate (should be <0.5%)
- Response time (p95 should be <1s)
- Failed authentication attempts
- Rate limit violations

### 3. Resource Usage Check

```bash
# Check D1 usage
wrangler d1 info claudes-friend-db

# Check KV usage
wrangler kv:namespace list

# Check Vectorize usage
wrangler vectorize list

# Check Worker usage
wrangler deployments list --limit 1
```

---

## Weekly Maintenance Tasks

### 1. Index Updates

**Script:** `scripts/update-index.sh`

```bash
#!/bin/bash
# Weekly index update

echo "🔄 Updating PRISM index..."

# Get list of repositories to index
REPOS=$(cat prism.config.json | jq -r '.indexing.repos[]')

for repo in $REPOS; do
  echo "📦 Indexing $repo..."

  # Run indexer
  npm run index -- --repo $repo

  # Generate embeddings for new documents
  npm run embed -- --repo $repo

  echo "✅ Indexed $repo"
done

echo "🎉 Index update complete"

# Generate report
NEW_DOCS=$(wrangler d1 execute claudes-friend-db --command="
  SELECT COUNT(*) FROM documents WHERE created_at >= datetime('now', '-7 days')
" | grep -o '[0-9]*')

echo "📊 New documents indexed: $NEW_DOCS"
```

**Schedule:** Run weekly on Sunday at 2:00 AM

### 2. Cache Cleanup

**Script:** `scripts/cleanup-cache.sh`

```bash
#!/bin/bash
# Weekly cache cleanup

echo "🧹 Cleaning up cache..."

# Get cache keys with low hit rate
wrangler d1 execute claudes-friend-db --command="
  DELETE FROM cache_metadata
  WHERE hit_count < 5
    AND created_at < datetime('now', '-7 days')
"

# Clear expired entries
wrangler d1 execute claudes-friend-db --command="
  DELETE FROM cache_metadata
  WHERE expires_at < datetime('now')
"

echo "✅ Cache cleanup complete"
```

### 3. Database Vacuum (Optional)

```bash
# Optimize database
wrangler d1 execute claudes-friend-db --command="VACUUM"

# Analyze tables for query optimization
wrangler d1 execute claudes-friend-db --command="ANALYZE"
```

---

## Monthly Maintenance Tasks

### 1. Backup Verification

**Script:** `scripts/verify-backups.sh`

```bash
#!/bin/bash
# Monthly backup verification

echo "💾 Verifying backups..."

# Create backup
BACKUP_DIR="/backups/prism/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Backup D1 database
wrangler d1 export claudes-friend-db --output=$BACKUP_DIR/database.sql

# Backup Vectorize index
wrangler vectorize export claudes-companion > $BACKUP_DIR/vectors.json

# Backup KV namespace
wrangler kv:bulk list --namespace-id=CACHE_ID > $BACKUP_DIR/kv-keys.txt

# Verify backup integrity
if [ -f "$BACKUP_DIR/database.sql" ] && [ -s "$BACKUP_DIR/database.sql" ]; then
  echo "✅ Database backup verified"
else
  echo "❌ Database backup failed"
  exit 1
fi

if [ -f "$BACKUP_DIR/vectors.json" ] && [ -s "$BACKUP_DIR/vectors.json" ]; then
  echo "✅ Vector backup verified"
else
  echo "❌ Vector backup failed"
  exit 1
fi

# Upload to long-term storage (e.g., S3, Glacier)
aws s3 sync $BACKUP_DIR s3://prism-backups/$(date +%Y%m)/

echo "🎉 Backup verification complete"
```

### 2. Performance Review

**Generate monthly performance report:**

```bash
#!/bin/bash
# Monthly performance report

echo "📊 Generating performance report..."

# Get metrics for last month
METRICS=$(curl -s https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/metrics?period=30d)

# Parse metrics
TOTAL_REQUESTS=$(echo $METRICS | jq -r '.requests.total')
SUCCESS_RATE=$(echo $METRICS | jq -r '.requests.success_rate')
P95_LATENCY=$(echo $METRICS | jq -r '.performance.p95_latency_ms')
TOKEN_SAVINGS=$(echo $METRICS | jq -r '.tokens.saved')

# Generate report
cat > /reports/performance-$(date +%Y%m).md << EOF
# PRISM Performance Report - $(date +%Y-%m)

## Request Metrics
- Total Requests: $TOTAL_REQUESTS
- Success Rate: $SUCCESS_RATE
- P95 Latency: ${P95_LATENCY}ms

## Token Savings
- Tokens Saved: $TOKEN_SAVINGS
- Cost Savings: $$(echo "scale=2; $TOKEN_SAVINGS * 0.00001" | bc)

## Recommendations
EOF

# Add recommendations based on performance
if (( $(echo "$P95_LATENCY > 1000" | bc -l) )); then
  echo "- ⚠️  Latency above target. Consider caching optimization." >> /reports/performance-$(date +%Y%m).md
fi

echo "✅ Performance report generated"
```

### 3. Security Audit

```bash
#!/bin/bash
# Monthly security audit

echo "🔒 Running security audit..."

# Check for failed authentication attempts
FAILED_AUTH=$(wrangler d1 execute claudes-friend-db --command="
  SELECT COUNT(*) FROM security_events
  WHERE type = 'failed_login'
    AND created_at >= datetime('now', '-30 days')
" | grep -o '[0-9]*')

echo "Failed authentication attempts: $FAILED_AUTH"

if [ $FAILED_AUTH -gt 100 ]; then
  echo "⚠️  High number of failed auth attempts"
  # Investigate
fi

# Check for API key abuse
API_KEY_ERRORS=$(wrangler d1 execute claudes-friend-db --command="
  SELECT COUNT(*) FROM security_events
  WHERE type = 'api_key_abuse'
    AND created_at >= datetime('now', '-30 days')
" | grep -o '[0-9]*')

echo "API key abuse events: $API_KEY_ERRORS"

# Check dependency vulnerabilities
npm audit --audit-level=moderate

# Review access logs
wrangler tail --since 30d | grep -i "unauthorized\|forbidden"

echo "✅ Security audit complete"
```

### 4. Dependency Updates

```bash
# Update dependencies
npm update

# Check for vulnerabilities
npm audit

# Test after updates
npm test

# If tests pass, deploy
if [ $? -eq 0 ]; then
  npm run deploy
else
  echo "❌ Tests failed after dependency update"
  exit 1
fi
```

---

## Index Updates

### Manual Index Rebuild

```bash
#!/bin/bash
# Full index rebuild

echo "🔄 Rebuilding index..."

# 1. Clear existing index
echo "🗑️  Clearing old index..."
wrangler d1 execute claudes-friend-db --command="
  DELETE FROM document_chunks;
  DELETE FROM documents;
"

# 2. Delete vector index
echo "🗑️  Clearing vectors..."
wrangler vectorize delete claudes-companion

# 3. Recreate vector index
echo "📝 Creating new vector index..."
wrangler vectorize create claudes-companion \
  --dimensions=384 \
  --metric=cosine

# 4. Reindex all documents
echo "📦 Reindexing documents..."
npm run index -- --rebuild

# 5. Generate embeddings
echo "🔢 Generating embeddings..."
npm run embed -- --rebuild

echo "🎉 Index rebuild complete"
```

### Incremental Index Update

```bash
#!/bin/bash
# Incremental index update

echo "🔄 Updating index (incremental)..."

# Get list of changed files since last update
LAST_UPDATE=$(wrangler d1 execute claudes-friend-db --command="
  SELECT MAX(created_at) FROM documents
" | grep -o '[0-9:-]*')

echo "Last update: $LAST_UPDATE"

# Index changed files
npm run index -- --since "$LAST_UPDATE"

# Generate embeddings for new documents
npm run embed -- --since "$LAST_UPDATE"

echo "✅ Incremental update complete"
```

---

## Database Cleanup

### Cleanup Orphaned Data

```bash
#!/bin/bash
# Cleanup orphaned data

echo "🧹 Cleaning up orphaned data..."

# Remove orphaned chunks
wrangler d1 execute claudes-friend-db --command="
  DELETE FROM document_chunks
  WHERE document_id NOT IN (SELECT id FROM documents)
"

# Remove orphaned relationships
wrangler d1 execute claudes-friend-db --command="
  DELETE FROM document_relationships
  WHERE source_document_id NOT IN (SELECT id FROM documents)
    OR target_document_id NOT IN (SELECT id FROM documents)
"

# Remove expired cache entries
wrangler d1 execute claudes-friend-db --command="
  DELETE FROM cache_metadata
  WHERE expires_at < datetime('now')
"

# Remove old usage logs (older than 90 days)
wrangler d1 execute claudes-friend-db --command="
  DELETE FROM usage_log
  WHERE date < date('now', '-90 days')
"

echo "✅ Cleanup complete"
```

### Optimize Database

```bash
# Analyze query performance
wrangler d1 execute claudes-friend-db --command="
  EXPLAIN QUERY PLAN
  SELECT * FROM document_chunks
  WHERE document_id = 'xxx'
"

# Rebuild indexes if needed
wrangler d1 execute claudes-friend-db --command="
  REINDEX;
"

# Update statistics
wrangler d1 execute claudes-friend-db --command="
  ANALYZE;
"
```

---

## Log Rotation

### Worker Logs

Cloudflare Workers automatically manage log rotation. Logs are retained for 7 days by default.

### Application Logs

For custom log storage (e.g., R2, S3):

```bash
#!/bin/bash
# Rotate application logs

LOG_DIR="/var/log/prism"
ARCHIVE_DIR="/var/log/prism/archive"

# Create archive directory
mkdir -p $ARCHIVE_DIR

# Rotate logs older than 7 days
find $LOG_DIR -name "*.log" -mtime +7 -exec gzip {} \;

# Move compressed logs to archive
find $LOG_DIR -name "*.gz" -exec mv {} $ARCHIVE_DIR/ \;

# Delete archives older than 90 days
find $ARCHIVE_DIR -name "*.gz" -mtime +90 -delete

echo "✅ Log rotation complete"
```

---

## Backup Procedures

### Automated Daily Backups

```bash
#!/bin/bash
# Daily backup script

BACKUP_DIR="/backups/prism/daily/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Backup D1 database
wrangler d1 export claudes-friend-db \
  --output=$BACKUP_DIR/database.sql

# Backup metadata
wrangler d1 execute claudes-friend-db \
  --file=./scripts/backup-metadata.sql

# Upload to cloud storage
aws s3 sync $BACKUP_DIR s3://prism-backups/daily/$(date +%Y%m%d)/

# Keep last 30 days of daily backups
aws s3 ls s3://prism-backups/daily/ | while read -r line; do
  DIR_DATE=$(echo $line | awk '{print $2}')
  DIR_AGE=$(( ($(date +%s) - $(date -d "$DIR_DATE" +%s)) / 86400 ))

  if [ $DIR_AGE -gt 30 ]; then
    aws s3 rm s3://prism-backups/daily/$DIR_DATE --recursive
  fi
done
```

### Disaster Recovery

**Recovery Procedure:**

```bash
#!/bin/bash
# Disaster recovery script

echo "🚨 Starting disaster recovery..."

# 1. Stop traffic (optional)
# wrangler deploy --name claudes-friend-maintenance

# 2. Restore database
BACKUP_DATE=$1  # Pass backup date as argument

if [ -z "$BACKUP_DATE" ]; then
  echo "Usage: $0 <YYYYMMDD>"
  exit 1
fi

# Download backup
aws s3 sync s3://prism-backups/daily/$BACKUP_DATE/ /tmp/restore/

# Restore D1 database
wrangler d1 execute claudes-friend-db --file=/tmp/restore/database.sql

# Restore Vectorize index
wrangler vectorize delete claudes-companion
wrangler vectorize create claudes-companion \
  --dimensions=384 \
  --metric=cosine

wrangler vectorize insert claudes-companion \
  --file=/tmp/restore/vectors.json

# 3. Verify restoration
curl -f https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/health

if [ $? -eq 0 ]; then
  echo "✅ Recovery successful"
else
  echo "❌ Recovery failed"
  exit 1
fi

echo "🎉 Disaster recovery complete"
```

---

## Health Monitoring

### Continuous Monitoring

Implement continuous monitoring with health checks:

```typescript
// monitoring/health-check.ts
export async function continuousHealthCheck(): Promise<void> {
  const checks = [
    checkDatabase,
    checkVectorize,
    checkKV,
    checkWorkersAI
  ];

  const results = await Promise.allSettled(checks);

  for (const result of results) {
    if (result.status === 'rejected') {
      await sendAlert({
        severity: 'error',
        message: `Health check failed: ${result.reason}`
      });
    }
  }
}

async function checkDatabase(): Promise<void> {
  const result = await env.DB.prepare("SELECT 1").first();
  if (!result) throw new Error('Database unreachable');
}

async function checkVectorize(): Promise<void> {
  // Test vector query
  const testVector = new Array(384).fill(0);
  const results = await env.VECTORIZE.query(testVector, { topK: 1 });
  if (!results) throw new Error('Vectorize unreachable');
}

// Schedule checks every 5 minutes
setInterval(continuousHealthCheck, 5 * 60 * 1000);
```

### Dashboard Setup

Create monitoring dashboard with key metrics:

- **Health Status:** Overall system health
- **Request Metrics:** Total requests, success rate, latency
- **Resource Usage:** Neurons, D1 operations, KV operations
- **Cache Performance:** Hit rate, size, eviction rate
- **Token Savings:** Tokens saved, cost reduction

---

## Performance Tuning

### Regular Performance Reviews

**Monthly Review Checklist:**

- [ ] Review p95 latency trends
- [ ] Check cache hit rates
- [ ] Analyze slow queries
- [ ] Review error rates
- [ ] Check token optimization effectiveness
- [ ] Review user feedback

### Optimization Tasks

```bash
#!/bin/bash
# Performance optimization script

echo "⚡ Running performance optimization..."

# 1. Identify slow queries
wrangler d1 execute claudes-friend-db --command="
  SELECT query, AVG(duration_ms) as avg_duration
  FROM query_log
  WHERE timestamp >= datetime('now', '-7 days')
  GROUP BY query
  ORDER BY avg_duration DESC
  LIMIT 10
"

# 2. Check cache effectiveness
wrangler d1 execute claudes-friend-db --command="
  SELECT
    type,
    SUM(hit_count) as total_hits,
    COUNT(*) as total_entries,
    CAST(SUM(hit_count) AS FLOAT) / COUNT(*) as hit_rate
  FROM cache_metadata
  GROUP BY type
"

# 3. Review index usage
wrangler d1 execute claudes-friend-db --command="
  SELECT name, tbl_name
  FROM sqlite_master
  WHERE type = 'index'
    AND name NOT LIKE 'sqlite_%'
"

echo "✅ Performance optimization complete"
```

---

## Troubleshooting

### Common Issues

#### Issue 1: High Error Rate

**Symptoms:**
- Error rate >1%
- Many 5xx responses

**Investigation:**
```bash
# Check error logs
wrangler tail --status error --since 1h

# Check Worker status
curl https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/health

# Check dependencies
wrangler d1 execute claudes-friend-db --command="SELECT 1"
```

**Resolution:**
- Check for recent deployments
- Verify database connectivity
- Check resource limits
- Rollback if needed

#### Issue 2: Slow Performance

**Symptoms:**
- p95 latency >2s
- User complaints

**Investigation:**
```bash
# Check slow queries
wrangler d1 execute claudes-friend-db --command="
  SELECT query, duration_ms
  FROM query_log
  WHERE timestamp >= datetime('now', '-1 hour')
  ORDER BY duration_ms DESC
  LIMIT 10
"

# Check cache hit rate
curl https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/metrics | jq '.cache'
```

**Resolution:**
- Optimize slow queries
- Increase cache size
- Add indexes
- Reduce batch sizes

#### Issue 3: Resource Exhaustion

**Symptoms:**
- Free tier limit alerts
- Rate limit errors

**Investigation:**
```bash
# Check usage
curl https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/metrics | jq '.resources'

# Check rate limits
wrangler tail --since 1h | grep "rate limit"
```

**Resolution:**
- Implement caching
- Optimize queries
- Increase rate limits
- Consider upgrade to paid tier

---

## Maintenance Calendar

### Monthly Schedule

| Day | Task | Owner |
|-----|------|-------|
| 1 | Backup verification | DevOps |
| 1 | Performance review | DevOps |
| 7 | Dependency updates | DevOps |
| 7 | Security audit | Security |
| 15 | Index optimization | DevOps |
| 15 | Cache cleanup | DevOps |
| 21 | Log review | DevOps |
| 21 | Resource check | DevOps |
| 28 | Monthly report | DevOps |
| 28 | Capacity planning | Architect |

### Quarterly Schedule

| Quarter | Tasks |
|---------|-------|
| Q1 (Jan-Mar) | Architecture review, security audit |
| Q2 (Apr-Jun) | Performance optimization, scaling review |
| Q3 (Jul-Sep) | Dependency audit, backup testing |
| Q4 (Oct-Dec) | Yearly review, capacity planning |

---

## Next Steps

- **Deployment:** See [Deployment Guide](deployment.md)
- **Operations:** See [Operations Guide](operations.md)
- **Security:** See [Security Guide](security.md)

---

**Last Updated:** 2026-01-13
**Version:** 0.1.0
**Maintainer:** DevOps Team
