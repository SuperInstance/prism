# Cost Analysis Guide

**Last Updated**: 2026-01-13
**Component**: Model Router / Cost Management
**Status**: Stable

## Overview

Prism's intelligent model routing can reduce your AI costs by **90% or more** compared to always using the best model. This guide explains pricing, shows cost scenarios, and provides optimization strategies.

---

## Pricing Comparison

### Model Pricing (per million tokens)

| Model | Provider | Input Cost | Output Cost | Context | Best For |
|-------|----------|------------|-------------|---------|----------|
| **Ollama** | Local | **$0** | **$0** | 16K | Simple tasks |
| **Cloudflare** | Cloudflare | **$0** | **$0** | 128K | Medium tasks |
| **Haiku** | Anthropic | $0.25 | $1.25 | 200K | Fast, cheap |
| **Sonnet** | Anthropic | $3.00 | $15.00 | 200K | Balanced |
| **Opus** | Anthropic | $15.00 | $75.00 | 200K | Complex |

### Cost Comparison Examples

Assume 1,000 tokens input and 500 tokens output (typical query):

| Model | Input Cost | Output Cost | Total |
|-------|------------|-------------|-------|
| Ollama | $0.000 | $0.000 | **$0.000** |
| Cloudflare | $0.000 | $0.000 | **$0.000** |
| Haiku | $0.00025 | $0.000625 | **$0.000875** |
| Sonnet | $0.003 | $0.0075 | **$0.0105** |
| Opus | $0.015 | $0.0375 | **$0.0525** |

**Savings:** Using Ollama instead of Opus saves **$0.0525 per query** (100% savings).

---

## Cost Scenarios

### Scenario 1: Light Usage (Hobbyist)

**Profile:**
- 20 queries per day
- Mix of simple and medium complexity
- Primarily code explanations and debugging

**Without Prism (always Sonnet):**
```
20 queries × $0.0105 × 30 days = $6.30/month
```

**With Prism (intelligent routing):**
```
10 queries × Ollama ($0)     = $0.00
8 queries × Ollama ($0)      = $0.00
2 queries × Sonnet ($0.0105) = $0.21
----------------------------------------
Monthly total: $0.21
```

**Savings: $6.09 (97% reduction)**

---

### Scenario 2: Medium Usage (Professional Developer)

**Profile:**
- 100 queries per day
- Mix of code generation, debugging, architecture
- Some complex tasks

**Without Prism (always Sonnet):**
```
100 queries × $0.0105 × 30 days = $31.50/month
```

**With Prism (intelligent routing):**
```
40 queries × Ollama ($0)      = $0.00
30 queries × Cloudflare ($0)  = $0.00
25 queries × Sonnet ($0.0105) = $7.88
5 queries × Opus ($0.0525)    = $7.88
----------------------------------------
Monthly total: $15.76
```

**Savings: $15.74 (50% reduction)**

---

### Scenario 3: Heavy Usage (Team/Power User)

**Profile:**
- 1,000 queries per day (team of 10)
- Full-stack development, complex architecture
- Code review, testing, documentation

**Without Prism (always Sonnet):**
```
1000 queries × $0.0105 × 30 days = $315.00/month
```

**With Prism (intelligent routing):**
```
400 queries × Ollama ($0)      = $0.00
300 queries × Cloudflare ($0)  = $0.00
250 queries × Sonnet ($0.0105) = $78.75
50 queries × Opus ($0.0525)    = $78.75
----------------------------------------
Monthly total: $157.50
```

**Savings: $157.50 (50% reduction)**

**Note:** With Ollama and Cloudflare handling 70% of queries, you save $220.50/month.

---

### Scenario 4: Startup (Small Team, Budget Conscious)

**Profile:**
- 500 queries per day
- Mostly simple and medium tasks
- Strict budget requirements

**With Prism (optimized routing):**
```
300 queries × Ollama ($0)      = $0.00
150 queries × Cloudflare ($0)  = $0.00
40 queries × Haiku ($0.000875) = $1.05
10 queries × Sonnet ($0.0105)  = $3.15
----------------------------------------
Monthly total: $4.20
```

**Without Prism (Sonnet only):** $157.50/month
**Savings: $153.30 (97% reduction)**

---

## Budget Management

### Setting Budget Limits

Configure spending limits in `prism.config.yaml`:

```yaml
router:
  # Daily spending limit (USD)
  daily_budget: 10.00

  # Alert when approaching limit
  alert_threshold: 0.80  # Alert at 80% of budget

  # Block requests when limit reached
  deny_at_limit: true

  # Reset budget daily
  budget_period: daily
```

### Budget Alerts

Prism alerts you when approaching limits:

```bash
# Alert example
⚠️  Budget Alert: 80% of daily budget used
   Current spending: $8.00 / $10.00
   Queries remaining: ~25
```

### Cost Tracking

Monitor your spending:

```bash
# View today's costs
prism stats costs today

# View monthly costs
prism stats costs month

# Breakdown by model
prism stats costs by-model

# Export to CSV
prism stats costs --format csv > costs.csv
```

### Usage by Model

Typical distribution with intelligent routing:

| Model | Queries | % | Cost |
|-------|---------|---|------|
| Ollama | 400 | 40% | $0.00 |
| Cloudflare | 300 | 30% | $0.00 |
| Haiku | 150 | 15% | $0.13 |
| Sonnet | 125 | 12.5% | $1.31 |
| Opus | 25 | 2.5% | $1.31 |
| **Total** | **1000** | **100%** | **$2.75** |

**Without routing (all Sonnet):** $10.50
**Savings: $7.75 (74% reduction)**

---

## Optimization Strategies

### 1. Enable Ollama (Highest Impact)

**Potential Savings: 40-60%**

Ollama handles simple queries for free:

```bash
# Install Ollama
prism setup ollama

# Pull recommended models
ollama pull deepseek-coder-v2
ollama pull nomic-embed-text
```

**Impact:**
- Handles 40-60% of typical queries
- 100% cost savings on those queries
- Best for: simple explanations, code snippets

---

### 2. Enable Cloudflare Workers AI

**Potential Savings: 20-30%**

Free cloud-based AI for medium tasks:

```bash
# Configure Cloudflare credentials
prism config set cloudflare.account_id YOUR_ID
prism config set cloudflare.api_token YOUR_TOKEN
```

**Impact:**
- Handles 20-30% of queries
- Free tier included with Cloudflare account
- Best for: medium complexity, batch processing

---

### 3. Use Token Optimization

**Potential Savings: 30-50%**

Reduce context size with smart compression:

```yaml
# prism.config.yaml
token_optimizer:
  enabled: true
  target_reduction: 0.50  # 50% reduction
  min_relevance: 0.60     # Only include relevant chunks
```

**Impact:**
- Fewer tokens = lower costs
- Better quality (focused context)
- Works with all models

---

### 4. Adjust Complexity Thresholds

**Potential Savings: 10-20%**

Tune when to use expensive models:

```yaml
# prism.config.yaml
router:
  complexity:
    # Use Ollama for complexity < 0.7 (default 0.6)
    ollama_threshold: 0.70

    # Use Haiku for complexity < 0.7 (default 0.6)
    haiku_threshold: 0.70

    # Use Opus only for complexity > 0.95 (default 0.9)
    opus_threshold: 0.95
```

**Impact:**
- More queries use cheaper models
- May reduce quality for edge cases
- Monitor and adjust based on your needs

---

### 5. Batch Similar Queries

**Potential Savings: 20-40%**

Process multiple queries together:

```typescript
// Instead of:
for (const file of files) {
  await prism.ask(`Explain ${file}`);
}

// Do this:
const summaries = await Promise.all(
  files.map(file => prism.ask(`Explain ${file}`))
);
```

**Impact:**
- Reduced overhead
- Better model selection
- Faster processing

---

### 6. Use Response Caching

**Potential Savings: 10-30%**

Cache repeated queries:

```yaml
# prism.config.yaml
cache:
  enabled: true
  ttl: 3600  # Cache for 1 hour
  max_size: 1000  # Max 1000 cached responses
```

**Impact:**
- No cost for cached responses
- Instant responses
- Best for: repeated questions, documentation lookups

---

## Cost Comparison: Prism vs. Alternatives

### vs. Claude Direct (No Routing)

| Approach | Monthly Cost (1000 queries/day) |
|----------|--------------------------------|
| **Claude Direct (Sonnet)** | $315.00 |
| **Prism (with routing)** | $157.50 |
| **Savings** | **$157.50 (50%)** |

### vs. Claude Code (Default)

| Approach | Monthly Cost (1000 queries/day) |
|----------|--------------------------------|
| **Claude Code (Opus)** | $1,575.00 |
| **Prism (with routing)** | $157.50 |
| **Savings** | **$1,417.50 (90%)** |

### vs. Other AI Coding Tools

| Tool | Monthly Cost | Notes |
|------|--------------|-------|
| **Prism (with Ollama)** | $0-50 | Free with local models |
| **Cursor Pro** | $20 | Unlimited Claude |
| **Cody** | $9 | Limited credits |
| **Codeium** | $0 | Limited features |
| **Copilot** | $10 | Code completion only |

**Prism Advantage:** Free tier with Ollama, pay only when needed.

---

## ROI Calculation

### Break-Even Analysis

**Initial Setup:**
- Ollama installation: 30 minutes
- Configuration: 10 minutes
- Total: 40 minutes

**Ongoing Savings:**
- Light user (20 queries/day): $6/month
- Medium user (100 queries/day): $31.50/month
- Heavy user (1000 queries/day): $315/month

**Time to Break Even:**
- Light user: 1 month saves $6 vs. 40 minutes setup
- Medium user: 1 month saves $31.50 vs. 40 minutes setup
- Heavy user: 1 month saves $315 vs. 40 minutes setup

**Conclusion:** Pays for itself in the first month for any usage level.

---

## Real-World Examples

### Example 1: Solo Developer

**Before Prism:**
- Used Claude directly
- ~50 queries/day
- Monthly cost: ~$15

**After Prism:**
- Installed Ollama
- 30 queries to Ollama (free)
- 15 queries to Cloudflare (free)
- 5 queries to Sonnet ($0.50)
- **Monthly cost: $0.50**

**Savings: $14.50 (97% reduction)**

---

### Example 2: Startup Team

**Before Prism:**
- Team of 5, 200 queries/day
- Used Claude Opus for everything
- Monthly cost: ~$315

**After Prism:**
- Installed Ollama on each machine
- 100 queries to Ollama (free)
- 60 queries to Cloudflare (free)
- 30 queries to Sonnet ($9.45)
- 10 queries to Opus ($15.75)
- **Monthly cost: $25.20**

**Savings: $289.80 (92% reduction)**

**Annual savings: $3,477.60**

---

## Monitoring & Reporting

### Daily Cost Report

```bash
prism report costs --period today
```

Output:
```
Today's Cost Report
===================

Total Queries: 127
Total Cost: $1.23

By Model:
  Ollama:      52 queries (41%) - $0.00
  Cloudflare:  38 queries (30%) - $0.00
  Haiku:       21 queries (17%) - $0.02
  Sonnet:      14 queries (11%) - $0.15
  Opus:        2 queries (1%)  - $0.11

Budget: $10.00/day
Remaining: $8.77 (88%)
```

### Monthly Cost Report

```bash
prism report costs --period month
```

Output:
```
Monthly Cost Report
===================

Total Queries: 3,847
Total Cost: $31.45

By Model:
  Ollama:      1,539 queries (40%) - $0.00
  Cloudflare:  1,154 queries (30%) - $0.00
  Haiku:       654 queries (17%)  - $0.57
  Sonnet:      423 queries (11%)  - $4.44
  Opus:        77 queries (2%)    - $4.04

Budget: $300/month
Remaining: $268.55 (90%)

Savings vs. all-Sonnet: $298.55 (90%)
```

---

## Cost Alerts & Notifications

### Setting Up Alerts

```yaml
# prism.config.yaml
alerts:
  cost:
    enabled: true

    # Alert thresholds
    daily: 5.00      # Alert at $5/day
    weekly: 25.00    # Alert at $25/week
    monthly: 100.00  # Alert at $100/month

    # Notification method
    method: console  # or: email, slack, webhook

    # Webhook URL (if method is webhook)
    webhook_url: https://hooks.slack.com/...
```

### Alert Examples

```
⚠️  Cost Alert: Daily threshold exceeded
   Current: $5.23 / $5.00
   Queries today: 127
```

```
⚠️  Cost Alert: Weekly threshold approaching
   Current: $23.50 / $25.00 (94%)
   Remaining: ~50 queries at current rate
```

---

## Best Practices

### 1. Start with Ollama

Enable Ollama first for maximum savings:

```bash
prism setup ollama
```

### 2. Monitor Your Spending

Check costs regularly:

```bash
prism stats costs
```

### 3. Set Budget Limits

Prevent overspending:

```yaml
router:
  daily_budget: 10.00
```

### 4. Adjust Complexity Thresholds

Fine-tune for your use case:

```yaml
router:
  complexity:
    ollama_threshold: 0.70  # Use Ollama more
```

### 5. Use Token Optimization

Reduce tokens, reduce costs:

```yaml
token_optimizer:
  enabled: true
  target_reduction: 0.50
```

---

## Next Steps

- **Setup Ollama** - See [Ollama Setup Guide](./09-ollama-setup.md)
- **Understand Routing** - See [Model Routing Guide](./08-model-routing.md)
- **Compare Performance** - See [Model Performance Guide](./11-model-performance.md)
- **Architecture Details** - See [Model Router Architecture](../architecture/06-model-router-architecture.md)
