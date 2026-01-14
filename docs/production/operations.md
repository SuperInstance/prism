# PRISM Operations Guide

**Version:** 0.1.0
**Last Updated:** 2026-01-13
**Target Audience:** DevOps Engineers, SREs, Platform Maintainers

## Table of Contents

1. [Overview](#overview)
2. [Monitoring](#monitoring)
3. [Metrics](#metrics)
4. [Logging](#logging)
5. [Alerting](#alerting)
6. [Health Checks](#health-checks)
7. [Incident Response](#incident-response)
8. [Performance Tuning](#performance-tuning)
9. [Debugging](#debugging)

---

## Overview

This guide covers operational procedures for running PRISM in production, including monitoring, alerting, logging, and incident response.

### Operational Architecture

```
┌─────────────────────────────────────────────────────┐
│              Cloudflare Monitoring                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Analytics│  │  Logs    │  │ Alerts   │         │
│  │ Engine   │  │  Tail    │  │  (Email) │         │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘         │
│       │             │             │                │
│       └─────────────┴─────────────┘                │
│                     │                               │
│            ┌────────▼────────┐                     │
│            │  PRISM Worker   │                     │
│            │  + D1 Database  │                     │
│            │  + Vectorize    │                     │
│            │  + KV Storage   │                     │
│            └─────────────────┘                     │
└─────────────────────────────────────────────────────┘
```

---

## Monitoring

### Cloudflare Analytics Dashboard

Access at: https://dash.cloudflare.com/→Workers→claudes-friend→Analytics

#### Key Metrics to Monitor

**Request Metrics:**
- Total requests (target: <100K/day for free tier)
- Success rate (target: >99.5%)
- Error rate (target: <0.5%)
- Response time (target: p50 <200ms, p95 <1s)

**Resource Metrics:**
- CPU time (target: <50ms per request)
- Memory usage (target: <128MB)
- Workers AI neurons (target: <10K/day)

**Database Metrics:**
- D1 query count (target: <5M reads/day, <100K writes/day)
- KV operations (target: <100K reads/day, <1K writes/day)
- Vectorize queries (target: <30M dimensions/day)

### Custom Monitoring Endpoints

#### 1. Health Status

```bash
curl https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2026-01-13T10:30:00Z",
  "uptime": 86400,
  "services": {
    "database": {
      "status": "connected",
      "latency_ms": 45,
      "connections": 5
    },
    "vectorize": {
      "status": "connected",
      "index_size": 15000,
      "dimensions": 384
    },
    "kv": {
      "status": "connected",
      "hit_rate": 0.85
    },
    "ai": {
      "status": "available",
      "model": "@cf/meta/llama-3.1-8b-instruct-fp8-fast"
    }
  }
}
```

#### 2. Metrics Endpoint

```bash
curl https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/metrics
```

**Response:**
```json
{
  "period": "24h",
  "requests": {
    "total": 45230,
    "success": 45012,
    "error": 218,
    "success_rate": 0.995
  },
  "performance": {
    "p50_latency_ms": 145,
    "p95_latency_ms": 890,
    "p99_latency_ms": 1200,
    "avg_cpu_time_ms": 38
  },
  "resources": {
    "neurons_used": 452300,
    "neurons_limit": 10000,
    "usage_percentage": 45.23
  },
  "cache": {
    "hit_rate": 0.85,
    "total_hits": 38445,
    "total_misses": 6785
  },
  "database": {
    "queries": 124500,
    "errors": 12,
    "avg_latency_ms": 23
  }
}
```

#### 3. Usage Summary

```bash
curl https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/api/v1/usage/summary
```

**Response:**
```json
{
  "date": "2026-01-13",
  "users": {
    "active": 234,
    "new": 12
  },
  "requests": {
    "total": 45230,
    "by_model": {
      "llama-3.1-8b": 32000,
      "qwen-2.5-coder": 8500,
      "llama-3.2-1b": 4730
    }
  },
  "tokens": {
    "input": 4523000,
    "output": 1245000,
    "saved": 3456000,
    "savings_percentage": 43.2
  },
  "cost": {
    "estimated_usd": 0.00,
    "free_tier_remaining": 0.55
  }
}
```

---

## Metrics

### Business Metrics

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **Token Savings** | % reduction in tokens vs. baseline | >40% | <30% |
| **Response Quality** | User satisfaction score | >4.0/5.0 | <3.5/5.0 |
| **Active Users** | Daily active users | Growth >5% MoM | Decline >10% WoW |
| **Cost Efficiency** | Cost per 1K tokens | <$0.01 | >$0.05 |

### Technical Metrics

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **Availability** | Uptime percentage | >99.5% | <99.0% |
| **Latency** | p95 response time | <1s | >2s |
| **Error Rate** | Failed requests / total | <0.5% | >1% |
| **Cache Hit Rate** | Cache hits / total | >80% | <70% |

### Resource Metrics

| Metric | Free Tier Limit | Warning (80%) | Critical (95%) |
|--------|----------------|---------------|----------------|
| **Workers Requests** | 100K/day | 80K | 95K |
| **AI Neurons** | 10K/day | 8K | 9.5K |
| **KV Reads** | 100K/day | 80K | 95K |
| **KV Writes** | 1K/day | 800 | 950 |
| **D1 Reads** | 5M/day | 4M | 4.75M |
| **D1 Writes** | 100K/day | 80K | 95K |
| **Vectorize Queried** | 30M dims/day | 24M | 28.5M |

### Metrics Collection

Enable Cloudflare Analytics Engine:

```toml
# wrangler.toml
[analytics]
enabled = true

# Or use Workers Analytics
[observability]
enabled = true
```

---

## Logging

### Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| **DEBUG** | Detailed diagnostic information | Function entry/exit, variable values |
| **INFO** | General informational messages | Request received, task completed |
| **WARN** | Warning messages for potential issues | High memory usage, slow query |
| **ERROR** | Error events that might be recoverable | API rate limit, cache miss |

### Log Format

Standard JSON log format:

```json
{
  "timestamp": "2026-01-13T10:30:45.123Z",
  "level": "INFO",
  "request_id": "abc-123-def-456",
  "user_id": "user-789",
  "message": "Request processed successfully",
  "duration_ms": 145,
  "endpoint": "/api/v1/chat",
  "method": "POST",
  "status_code": 200,
  "tokens": {
    "input": 1234,
    "output": 456,
    "saved": 678
  },
  "model": "llama-3.1-8b",
  "error": null
}
```

### Viewing Logs

#### Real-time Logs

```bash
# Tail logs in real-time
wrangler tail --format pretty --level debug

# Filter by status
wrangler tail --status error

# Filter by endpoint
wrangler tail --filter "/api/v1/chat"

# Save to file
wrangler tail > logs/production-$(date +%Y%m%d).log
```

#### Historical Logs

```bash
# Query logs from last hour
wrangler tail --since 1h

# Query specific time range
wrangler tail --since "2026-01-13T10:00:00Z" --until "2026-01-13T11:00:00Z"
```

### Log Aggregation

#### Option 1: Cloudflare Logpush (Recommended)

```bash
# Enable Logpush to R2
wrangler logpush create \
  --name=prism-logs \
  --destination=r2://claudes-friend-logs/logs \
  --format=json \
  --fields=Event,EventTimestampMs,Exceptions,Logs,Outcome,ScriptName
```

#### Option 2: Third-Party Services

**Datadog:**
```typescript
// Add to Worker
import { StatsD } from 'datadog-statsd';

const statsd = new StatsD();
statsd.increment('request.count');
statsd.timing('request.duration', 145);
```

**Loggly:**
```javascript
// Send logs to Loggly
fetch('https://logs-01.loggly.com/bulk/TOKEN/tag/single', {
  method: 'POST',
  body: JSON.stringify(logData)
});
```

### Log Analysis Queries

#### Most Common Errors (Last 24h)

```sql
-- Using Analytics Engine
SELECT
  error_message,
  COUNT(*) as error_count
FROM worker_logs
WHERE timestamp > NOW() - 24h
  AND level = 'ERROR'
GROUP BY error_message
ORDER BY error_count DESC
LIMIT 10
```

#### Slowest Endpoints

```sql
SELECT
  endpoint,
  AVG(duration_ms) as avg_duration,
  MAX(duration_ms) as max_duration,
  COUNT(*) as request_count
FROM worker_logs
WHERE timestamp > NOW() - 24h
GROUP BY endpoint
ORDER BY avg_duration DESC
```

#### Token Usage by Model

```sql
SELECT
  model,
  SUM(tokens_input) + SUM(tokens_output) as total_tokens,
  SUM(tokens_saved) as saved_tokens,
  AVG(savings_percentage) as avg_savings
FROM worker_logs
WHERE timestamp > NOW() - 24h
GROUP BY model
```

---

## Alerting

### Alert Configuration

#### Cloudflare Email Alerts

Visit: https://dash.cloudflare.com/→Workers→Settings→Notifications

Configure alerts for:
- Worker errors (>1% error rate)
- CPU time limit exceeded
- Request rate anomalies
- Free tier limit approaching (80%, 90%, 95%)

#### Custom Alert Endpoint

Implement `/api/v1/alerts` webhook:

```typescript
// alert-handler.ts
export async function handleAlert(alert: Alert): Promise<Response> {
  // Send to Slack
  await fetch('https://hooks.slack.com/YOUR/WEBHOOK', {
    method: 'POST',
    body: JSON.stringify({
      text: `🚨 PRISM Alert: ${alert.message}`,
      attachments: [{
        color: alert.severity === 'critical' ? 'danger' : 'warning',
        fields: [
          { title: 'Metric', value: alert.metric, short: true },
          { title: 'Value', value: alert.value, short: true },
          { title: 'Threshold', value: alert.threshold, short: true },
          { title: 'Time', value: alert.timestamp, short: true }
        ]
      }]
    })
  });

  // Send to PagerDuty
  await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routing_key: 'YOUR_PAGERDUTY_KEY',
      event_action: 'trigger',
      payload: {
        summary: alert.message,
        severity: alert.severity,
        source: 'prism-worker'
      }
    })
  });

  return Response.json({ success: true });
}
```

### Alert Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| **High Error Rate** | Error rate >1% for 5min | Critical | Page on-call |
| **Slow Responses** | p95 latency >2s for 5min | Warning | Email team |
| **Free Tier Limit** | Usage >80% of any limit | Warning | Email team |
| **Free Tier Critical** | Usage >95% of any limit | Critical | Page on-call |
| **Database Failure** | D1 errors >10/min | Critical | Page on-call |
| **AI Service Down** | Workers AI unavailable | Critical | Page on-call |
| **Cache Degraded** | Hit rate <70% for 15min | Warning | Email team |

### On-Call Procedures

#### Escalation Matrix

1. **Level 1 (Warning):** Email team, create ticket
2. **Level 2 (Critical):** Page on-call engineer, Slack alert
3. **Level 3 (Emergency):** Page entire team, executive notification

#### On-Call Rotation

```bash
# Set up pagerduty rotation
# Week 1: Engineer A
# Week 2: Engineer B
# Week 3: Engineer C
# Week 4: Backup

# Configure handoff:
# Friday 5pm - Monday 9am: Weekday on-call
# Monday 9am - Friday 5pm: Business hours only
```

---

## Health Checks

### Health Check Endpoints

#### 1. Liveness Probe

```bash
curl https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/health/live
```

**Purpose:** Is the Worker running?
**Expected:** 200 OK with minimal processing

#### 2. Readiness Probe

```bash
curl https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/health/ready
```

**Purpose:** Can the Worker handle requests?
**Expected:** 200 OK after checking dependencies

**Response:**
```json
{
  "ready": true,
  "checks": {
    "database": "pass",
    "vectorize": "pass",
    "kv": "pass",
    "ai": "pass"
  }
}
```

#### 3. Deep Health Check

```bash
curl https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/health/deep
```

**Purpose:** Comprehensive system health
**Expected:** 200 OK with detailed diagnostics

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "checks": {
    "database": {
      "status": "pass",
      "latency_ms": 45,
      "query_test": "SELECT 1 succeeded"
    },
    "vectorize": {
      "status": "pass",
      "index_size": 15000,
      "query_test": "vector search succeeded"
    },
    "kv": {
      "status": "pass",
      "read_test": "passed",
      "write_test": "passed"
    },
    "ai": {
      "status": "pass",
      "model": "llama-3.1-8b",
      "inference_test": "passed"
    }
  }
}
```

### Synthetic Monitoring

#### Uptime Monitoring

Use external services:
- **UptimeRobot** (free): https://uptimerobot.com
- **Pingdom** (paid): https://www.pingdom.com
- **StatusCake** (free tier): https://www.statuscake.com

Configure checks:
```yaml
monitors:
  - name: "PRISM API Health"
    url: "https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/health"
    interval: 300  # 5 minutes
    alert_threshold: 2  # Alert after 2 failures

  - name: "PRISM API Response Time"
    url: "https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/api/v1/health"
    interval: 300
    alert_threshold: 2000  # Alert if >2s
```

#### Synthetic Transactions

```bash
#!/bin/bash
# synthetic-test.sh
# Test critical user journeys

echo "Testing PRISM API..."

# Test 1: Health check
curl -f https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/health || exit 1

# Test 2: Authentication
curl -f -X POST https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/api/v1/auth/verify \
  -H "Authorization: Bearer YOUR_API_SECRET" || exit 1

# Test 3: Vector search
curl -f -X POST https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/api/v1/search \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "top_k": 5}' || exit 1

# Test 4: Chat completion
curl -f -X POST https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/api/v1/chat \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "model": "quick"}' || exit 1

echo "All tests passed!"
```

---

## Incident Response

### Incident Severity Levels

| Severity | Name | Description | Response Time |
|----------|------|-------------|---------------|
| **SEV-1** | Critical | Complete system outage | 15 min |
| **SEV-2** | High | Major feature broken | 1 hour |
| **SEV-3** | Medium | Degraded performance | 4 hours |
| **SEV-4** | Low | Minor issues | 1 business day |

### Incident Runbook

#### SEV-1: Complete Outage

**Detection:**
- Health check fails
- All requests return 5xx
- Alert: "Worker completely down"

**Immediate Actions (0-15 min):**
1. **Verify outage:**
   ```bash
   curl https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/health
   ```

2. **Check Cloudflare status:**
   - https://www.cloudflarestatus.com

3. **Check Worker logs:**
   ```bash
   wrangler tail --status error
   ```

4. **Begin rollback:**
   ```bash
   wrangler rollback --env production
   ```

5. **Communicate:**
   - Slack: #incidents channel
   - Status page: Update incident banner

**Investigation (15-60 min):**
1. Review recent deployments
2. Check error rates
3. Verify dependencies (D1, Vectorize, KV)
4. Review metrics dashboard

**Resolution (60+ min):**
1. Implement fix
2. Test in staging
3. Deploy to production
4. Monitor for 1 hour
5. Close incident

#### SEV-2: Major Feature Broken

**Example:** Vector search returns no results

**Detection:**
- Alert: "Vector search failure rate >50%"
- User reports: "Search not working"

**Actions:**
1. **Verify issue:**
   ```bash
   curl -X POST https://claudes-friend.YOUR_SUBDOMAIN.workers.dev/api/v1/search \
     -H "Authorization: Bearer YOUR_API_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"query": "test", "top_k": 5}'
   ```

2. **Check Vectorize status:**
   ```bash
   wrangler vectorize describe claudes-companion
   ```

3. **Check index health:**
   ```bash
   wrangler d1 execute claudes-friend-db --command="
     SELECT COUNT(*) FROM document_chunks
   "
   ```

4. **Implement workaround:**
   - Fallback to full-text search
   - Return reduced results

5. **Fix and deploy:**
   - Rebuild vector index
   - Deploy hotfix

#### SEV-3: Performance Degradation

**Example:** p95 latency >2s

**Detection:**
- Alert: "High latency detected"
- Dashboard: p95 latency spike

**Actions:**
1. **Investigate cause:**
   ```bash
   # Check slow queries
   wrangler d1 execute claudes-friend-db --command="
     SELECT query, AVG(duration_ms)
     FROM query_log
     WHERE timestamp > NOW() - 1h
     GROUP BY query
     ORDER BY AVG(duration_ms) DESC
     LIMIT 10
   "
   ```

2. **Implement optimizations:**
   - Increase cache size
   - Reduce batch size
   - Add indexes

3. **Monitor improvement:**
   ```bash
   wrangler tail --filter "/api/v1/search"
   ```

### Incident Communication Template

```markdown
## Incident: [Title]

**Severity:** SEV-1/2/3/4
**Status:** Investigating / Identified / Monitoring / Resolved
**Start Time:** YYYY-MM-DD HH:MM:SS UTC
**Duration:** X hours

### Impact
- [ ] Complete outage
- [ ] Major feature broken
- [ ] Performance degradation
- [ ] Minor issues

### Affected Services
- API: https://claudes-friend.YOUR_SUBDOMAIN.workers.dev
- Database: D1 (claudes-friend-db)
- Vector Index: Vectorize (claudes-companion)

### Current Status
[Brief description of current situation]

### Next Steps
1. [Action item]
2. [Action item]
3. [Action item]

### Updates
- HH:MM UTC - [Update]
- HH:MM UTC - [Update]

### Root Cause
[Post-incident analysis]

### Prevention
[Action items to prevent recurrence]
```

### Post-Incident Process

1. **Post-Mortem Meeting:** Within 48 hours
2. **Document Findings:** Create incident report
3. **Action Items:** Assign owners and due dates
4. **Follow-Up:** Review in next sprint

---

## Performance Tuning

### Optimization Strategies

#### 1. Reduce Cold Starts

```typescript
// Keep worker warm with periodic requests
// Add to cron triggers in wrangler.toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes

// Handler:
export async function scheduled(event: ScheduledEvent): Promise<void> {
  // Lightweight health check to keep worker warm
  await env.DB.prepare("SELECT 1").first();
}
```

#### 2. Optimize Database Queries

```typescript
// Bad: N+1 queries
for (const chunk of chunks) {
  const result = await env.DB.prepare(
    "SELECT * FROM document_chunks WHERE id = ?"
  ).bind(chunk.id).first();
}

// Good: Single query with IN clause
const ids = chunks.map(c => c.id);
const results = await env.DB.prepare(
  `SELECT * FROM document_chunks WHERE id IN (${ids.map(() => '?').join(',')})`
).bind(...ids).all();
```

#### 3. Increase Cache Hit Rate

```typescript
// Cache frequently accessed data
const cacheKey = `search:${queryHash}`;
let results = await env.KV.get(cacheKey, 'json');

if (!results) {
  results = await performVectorSearch(query);
  await env.KV.put(cacheKey, JSON.stringify(results), {
    expirationTtl: 3600  // 1 hour
  });
}
```

#### 4. Batch Embedding Requests

```typescript
// Bad: One embedding at a time
for (const chunk of chunks) {
  const embedding = await generateEmbedding(chunk.text);
}

// Good: Batch embeddings
const batchSize = 32;
for (let i = 0; i < chunks.length; i += batchSize) {
  const batch = chunks.slice(i, i + batchSize);
  const embeddings = await Promise.all(
    batch.map(chunk => generateEmbedding(chunk.text))
  );
}
```

---

## Debugging

### Common Issues and Solutions

#### Issue 1: Worker Throws Exceptions

**Symptom:**
```
Error: Worker threw exception
ReferenceError: xyz is not defined
```

**Debug Steps:**
```bash
# 1. Enable detailed logging
wrangler tail --format pretty --level debug

# 2. Check for uncaught exceptions
wrangler tail --filter "Error"

# 3. Deploy with source maps
wrangler deploy --env production --compatibility-date=2024-12-01
```

#### Issue 2: High Memory Usage

**Symptom:**
```
Error: Worker exceeded memory limit of 128MB
```

**Debug Steps:**
```bash
# 1. Profile memory usage
# Add memory tracking to Worker:
const memoryBefore = performance.memory?.usedJSHeapSize || 0;
// ... code ...
const memoryAfter = performance.memory?.usedJSSize || 0;
console.log(`Memory delta: ${memoryAfter - memoryBefore} bytes`);

# 2. Reduce payload sizes
# 3. Stream large responses
# 4. Clear caches periodically
```

#### Issue 3: Intermittent Failures

**Symptom:**
```
Error: Service unavailable (503)
Occurs randomly, 5-10% of requests
```

**Debug Steps:**
```bash
# 1. Check rate limits
wrangler d1 execute claudes-friend-db --command="
  SELECT COUNT(*) as request_count, date, hour
  FROM usage_log
  WHERE date >= date('now', '-1 day')
  GROUP BY date, hour
  ORDER BY request_count DESC
"

# 2. Implement retries with exponential backoff
# 3. Add circuit breaker pattern
# 4. Check for resource exhaustion
```

---

## Next Steps

- **Configure scaling:** See [Scaling Guide](scaling.md)
- **Secure deployment:** See [Security Guide](security.md)
- **Schedule maintenance:** See [Maintenance Guide](maintenance.md)

---

**Last Updated:** 2026-01-13
**Version:** 0.1.0
**Maintainer:** DevOps Team
