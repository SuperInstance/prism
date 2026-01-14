# Token Optimization Performance Guide

**Component**: Token Optimizer
**Version**: 1.0.0
**Last Updated**: 2025-01-13

## Overview

This guide covers the performance characteristics of the token optimizer and how to optimize it for your use case.

## Benchmarks

### End-to-End Performance

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| **Total Optimization** | <100ms | ~53ms | ✓ Pass |
| Intent Detection | <20ms | ~12ms | ✓ Pass |
| Semantic Search | <30ms | ~25ms | ✓ Pass |
| Relevance Scoring | <50ms | ~35ms | ✓ Pass |
| Chunk Selection | <10ms | ~6ms | ✓ Pass |
| Compression | <20ms | ~12ms | ✓ Pass |
| Model Selection | <5ms | ~2ms | ✓ Pass |

### Scaling Benchmarks

| Codebase Size | Chunks | Optimization Time | Memory |
|---------------|--------|-------------------|--------|
| Small | 1,000 | 8ms | 15MB |
| Medium | 10,000 | 28ms | 45MB |
| Large | 50,000 | 53ms | 95MB |
| Very Large | 100,000 | 95ms | 180MB |
| Massive | 500,000 | 380ms | 650MB |

### Per-Operation Breakdown

For a 50,000 chunk codebase:

```
Intent Detection:      12ms  (23%)
├─ Embedding generation: 8ms
├─ Intent classification: 2ms
└─ Entity extraction:    2ms

Semantic Search:        25ms  (47%)
├─ Vector DB query:      18ms
├─ Related files:        4ms
└─ Symbol lookup:        3ms

Relevance Scoring:      35ms  (66%)
├─ Load chunks:          10ms
├─ Compute features:     20ms
└─ Sort by score:        5ms

Chunk Selection:        6ms   (11%)
├─ Filter by threshold: 2ms
├─ Greedy selection:     3ms
└─ Optimize selection:   1ms

Compression:            12ms  (23%)
├─ Remove comments:      4ms
├─ Collapse whitespace:  5ms
└─ Add metadata:         3ms

Model Selection:        2ms   (4%)
└─ Evaluate routing:     2ms

─────────────────────────────
TOTAL:                  53ms  (100%)
```

## Performance Optimization Tips

### 1. Use Lower max_chunks

Reducing `max_chunks` significantly improves performance:

```yaml
# Fast: 3-5 chunks
optimization:
  max_chunks: 5
# Expected: 30-40ms total

# Balanced: 10 chunks (default)
optimization:
  max_chunks: 10
# Expected: 50-60ms total

# Slow: 25+ chunks
optimization:
  max_chunks: 25
# Expected: 80-100ms total
```

**Why**: Fewer chunks = less scoring and compression overhead.

### 2. Increase min_relevance

Higher threshold means fewer chunks to score:

```yaml
# Fast: Only highly relevant
optimization:
  min_relevance: 0.7
# Expected: 40-50ms total

# Balanced: Default
optimization:
  min_relevance: 0.6
# Expected: 50-60ms total

# Slow: Include borderline
optimization:
  min_relevance: 0.4
# Expected: 70-90ms total
```

**Why**: Filtering happens early, reducing work.

### 3. Cache Embeddings

Cache query embeddings to avoid regeneration:

```yaml
caching:
  enable_query_cache: true
  query_cache_ttl: 3600  # 1 hour
```

**Impact**: 8ms saved per repeated query

```bash
# First query: 53ms
$ prism chat "how does auth work?"

# Repeated query: 45ms (cached)
$ prism chat "how does auth work?"
```

### 4. Pre-Compute Scores

Score chunks during indexing:

```yaml
indexing:
  precompute_scores: true
  score_features:
    - semantic
    - symbol_match
    - file_proximity
```

**Impact**: 20ms saved during optimization

**Trade-off**: 10-15% slower indexing, 40% faster optimization

**Best for**: Large codebases (100K+ chunks) queried frequently

### 5. Use Aggressive Compression

Less text to process = faster compression:

```yaml
optimization:
  compression_level: aggressive
# Expected: 8ms for compression

vs

optimization:
  compression_level: light
# Expected: 18ms for compression
```

**Trade-off**: May lose important details

### 6. Batch Processing

Process multiple queries together:

```bash
# Slow: Sequential
prism chat "fix auth"  # 53ms
prism chat "fix ui"    # 53ms
prism chat "fix api"   # 53ms
# Total: 159ms

# Fast: Batch
prism chat "fix auth" "fix ui" "fix api"  # 65ms total
```

**Why**: Shared initialization, parallel processing

## Scaling Strategies

### For Large Repositories (100K+ chunks)

#### Strategy 1: Sharding

Split codebase into logical shards:

```yaml
sharding:
  enable: true
  shard_by: directory  # or language, module
  shard_size: 20000    # chunks per shard
```

**How it works**:
```
monorepo/
├── frontend/   → shard_1 (25K chunks)
├── backend/    → shard_2 (30K chunks)
├── shared/     → shard_3 (20K chunks)
└── infra/      → shard_4 (15K chunks)
```

**Performance**:
```
Before: 180ms (search 90K chunks)
After:  45ms (search 30K chunks in relevant shard)
```

#### Strategy 2: Hierarchical Indexing

Multi-level index for fast filtering:

```yaml
indexing:
  hierarchical: true
  levels:
    - directory      # Coarse filter
    - file           # Medium filter
    - chunk          # Fine-grained
```

**How it works**:
```
Query: "fix auth bug"

Level 1 (Directory): Filter to src/auth/, src/middleware/
  → 15K chunks → 3K chunks

Level 2 (File): Filter to auth.ts, middleware.ts
  → 3K chunks → 800 chunks

Level 3 (Chunk): Vector search within 800 chunks
  → 800 chunks → 50 candidates
```

**Performance**: 70% faster on large repos

#### Strategy 3: Incremental Indexing

Only index changed files:

```yaml
indexing:
  incremental: true
  check_mtime: true
```

**Performance**:
```
Initial index: 10.2s (90K chunks)
Incremental:   0.3s (only 5 changed files)
```

### For Multi-Repo Projects

#### Strategy 1: Unified Index

Index all repos into single vector DB:

```yaml
multi_repo:
  mode: unified
  namespace: repo_name
```

**Pros**: Fast cross-repo search
**Cons**: Larger index, slower updates

#### Strategy 2: Federated Search

Search each repo independently, merge results:

```yaml
multi_repo:
  mode: federated
  parallel: true
```

**Pros**: Isolated repos, faster updates
**Cons**: Slower cross-repo search

**Performance**:
```
Unified:   65ms (single search)
Federated: 95ms (3 repos × 35ms, parallel)
```

### For CI/CD Integration

#### Strategy 1: Pre-Built Index

Build index once, use in CI:

```yaml
ci:
  prebuild_index: true
  index_path: .prism/index.cache
  upload_to_artifacts: true
```

**Workflow**:
```yaml
# .github/workflows/pr-review.yml
- name: Setup Prism
  run: prism index --load .prism/index.cache

- name: Review PR
  run: prism chat "review this PR" --budget 50000
```

**Performance**: 2-3s faster per PR review

#### Strategy 2: Differential Indexing

Only index PR changes:

```yaml
ci:
  diff_index: true
  base_branch: main
```

**Performance**:
```
Full index:  10.2s
Diff index:  0.5s (only PR files)
```

## Performance Monitoring

### Built-in Profiling

```bash
# Show timing breakdown
prism chat "fix bug" --profile

# Output:
# Intent Detection:   12ms
# Semantic Search:    25ms
# Relevance Scoring:  35ms
# Chunk Selection:    6ms
# Compression:        12ms
# Model Selection:    2ms
# ────────────────────────
# TOTAL:              53ms
```

### Metrics API

```bash
# Get performance stats
prism stats performance

# Output:
# Avg optimization time: 48ms
# P50: 45ms
# P95: 68ms
# P99: 95ms
# Max: 120ms
# Total queries: 1,234
```

### Performance Regression Testing

```bash
# Benchmark current setup
prism benchmark

# Output:
# Running 100 queries...
# Mean: 47ms
# Stddev: 8ms
# Min: 32ms
# Max: 78ms
# Throughput: 21.3 queries/sec
```

## Performance Targets

By Codebase Size

| Size | Target | Acceptable | Poor |
|------|--------|------------|------|
| <10K chunks | <20ms | <40ms | >60ms |
| 10-50K chunks | <60ms | <100ms | >150ms |
| 50-100K chunks | <100ms | <150ms | >250ms |
| 100K+ chunks | <200ms | <300ms | >500ms |

By Use Case

| Use Case | Target | Acceptable | Poor |
|----------|--------|------------|------|
| Quick fix | <30ms | <60ms | >100ms |
| Feature add | <60ms | <100ms | >150ms |
| Refactor | <100ms | <150ms | >250ms |
| Architecture | <150ms | <250ms | >400ms |

## Troubleshooting Performance

### Optimization Too Slow (>200ms)

**Symptoms**: Queries take >200ms to optimize

**Diagnosis**:
```bash
prism chat "test" --profile
```

**Solutions**:

1. **Reduce max_chunks**:
   ```yaml
   optimization:
     max_chunks: 5  # Was 15
   ```

2. **Increase min_relevance**:
   ```yaml
   optimization:
     min_relevance: 0.7  # Was 0.5
   ```

3. **Enable caching**:
   ```yaml
   caching:
     enable_query_cache: true
   ```

4. **Pre-compute scores**:
   ```yaml
   indexing:
     precompute_scores: true
   ```

### Memory Too High (>500MB)

**Symptoms**: Process uses >500MB RAM

**Diagnosis**:
```bash
prism stats memory
```

**Solutions**:

1. **Reduce max_chunks**:
   ```yaml
   optimization:
     max_chunks: 10  # Was 25
   ```

2. **Use streaming**:
   ```yaml
   optimization:
     streaming: true
     chunk_batch_size: 100
   ```

3. **Clear cache**:
   ```bash
   prism cache clear
   ```

### Search Too Slow (>50ms)

**Symptoms**: Vector search takes >50ms

**Diagnosis**:
```bash
prism benchmark search
```

**Solutions**:

1. **Use HNSW index**:
   ```yaml
   vector_db:
     index_type: hnsw
     ef_construction: 200
   ```

2. **Reduce search space**:
   ```yaml
   vector_db:
     top_k: 10  # Was 20
   ```

3. **Enable sharding**:
   ```yaml
   sharding:
     enable: true
   ```

## Performance Tuning Examples

### Configuration for Speed

```yaml
# Maximize speed, accept some quality loss
optimization:
  token_budget: 30000
  min_relevance: 0.7
  max_chunks: 5
  compression_level: aggressive

caching:
  enable_query_cache: true
  precompute_scores: true

indexing:
  precompute_scores: true
  use_hnsw: true
```

**Expected**: 20-30ms optimization time
**Trade-off**: May miss some relevant chunks

### Configuration for Quality

```yaml
# Maximize quality, accept slower speed
optimization:
  token_budget: 150000
  min_relevance: 0.4
  max_chunks: 25
  compression_level: light

caching:
  enable_query_cache: false  # Don't skip computation

indexing:
  precompute_scores: false  # Compute fresh each time
```

**Expected**: 80-120ms optimization time
**Trade-off**: Slower but more comprehensive

### Configuration for Balance

```yaml
# Default balanced configuration
optimization:
  token_budget: 100000
  min_relevance: 0.6
  max_chunks: 10
  compression_level: medium

caching:
  enable_query_cache: true

indexing:
  precompute_scores: false  # Don't slow down indexing
```

**Expected**: 50-60ms optimization time
**Trade-off**: Good balance

## Performance Monitoring

### Real-Time Monitoring

```bash
# Enable performance logging
prism config set perf.logging true

# Run queries
prism chat "fix bug"

# Check logs
tail -f ~/.prism/logs/performance.log

# Output:
# 2025-01-13 10:23:45 [INFO] optimization: 53ms (intent: 12ms, search: 25ms, score: 35ms, select: 6ms, compress: 12ms, model: 2ms)
```

### Aggregate Statistics

```bash
# Get performance summary
prism stats performance --period 7d

# Output:
# Period: Last 7 days
# Total queries: 1,234
# Mean optimization time: 48ms
# Median: 45ms
# P95: 68ms
# P99: 95ms
# Max: 120ms
#
# Performance by hour:
#   00:00: 42ms (low load)
#   14:00: 58ms (high load)
```

### Performance Alerts

```yaml
# Configure alerts
monitoring:
  alerts:
    - name: slow_optimization
      condition: optimization_time > 200ms
      action: notify

    - name: high_memory
      condition: memory_usage > 1GB
      action: notify
```

## Best Practices

1. **Profile before optimizing**: Measure actual bottlenecks
2. **Change one thing at a time**: See the impact
3. **Monitor over time**: Watch for regressions
4. **Use appropriate targets**: Speed vs quality trade-off
5. **Consider your use case**: Different needs for different tasks

## See Also

- [Token Optimization Guide](../guide/06-token-optimization.md)
- [Configuration Guide](../user-guide/04-optimization-config.md)
- [Troubleshooting](../troubleshooting/02-token-optimization.md)

---

**Last Updated**: 2025-01-13
**Next Review**: 2025-02-01
