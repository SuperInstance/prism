# Token Optimization Troubleshooting

**Component**: Token Optimizer
**Version**: 1.0.0
**Last Updated**: 2025-01-13

## Overview

This guide helps you diagnose and fix common issues with the token optimizer.

## Quick Diagnostics

Run this first to check system health:

```bash
# Check optimizer health
prism doctor

# Profile a test query
prism chat "test" --profile

# Show configuration
prism config show
```

## Common Issues

### Issue 1: Too Many Tokens Selected

**Symptoms**:
- Optimized prompt is still near token budget
- Getting "context too long" errors
- High API costs

**Diagnosis**:
```bash
prism chat "your query" --show-scores
```

**Possible Causes**:

#### Cause 1.1: min_relevance Too Low

```yaml
# Problem: Includes low-relevance chunks
optimization:
  min_relevance: 0.3  # Too low
```

**Solution**:
```yaml
# Increase threshold
optimization:
  min_relevance: 0.7  # Only highly relevant
```

#### Cause 1.2: max_chunks Too High

```yaml
# Problem: Selects too many chunks
optimization:
  max_chunks: 25  # Too many
```

**Solution**:
```yaml
# Reduce limit
optimization:
  max_chunks: 5  # Focus on best matches
```

#### Cause 1.3: Compression Not Working

```yaml
# Problem: Compression disabled
optimization:
  compression_level: none
```

**Solution**:
```yaml
# Enable compression
optimization:
  compression_level: medium  # or aggressive
```

**Verification**:
```bash
prism chat "test query" --show-compression

# Expected output:
# Chunk 1: 1,200 → 360 tokens (70% reduction)
# Chunk 2: 800 → 240 tokens (70% reduction)
# Total: 2,000 → 600 tokens (70% reduction)
```

### Issue 2: Wrong Chunks Selected

**Symptoms**:
- Selected chunks don't seem relevant
- Missing obvious relevant code
- Getting "I don't see that code here" responses

**Diagnosis**:
```bash
prism chat "your query" --show-scores --show-all

# Look at:
# - Are relevant chunks in the list?
# - What are their scores?
# - Why were they excluded?
```

**Possible Causes**:

#### Cause 2.1: Semantic Similarity Low

**Problem**: Vector embeddings don't capture meaning

**Diagnosis**:
```bash
# Check embedding quality
prism debug embeddings "your query"

# Output:
# Query: "fix auth bug"
# Embedding: [0.123, -0.456, ...]
#
# Top matches:
# 1. auth.ts:authenticate() (similarity: 0.94)
# 2. middleware.ts:auth() (similarity: 0.76)
# 3. ui.ts:AuthButton (similarity: 0.45)  # Not actually about auth
```

**Solution**:
```yaml
# Adjust semantic weight
optimization:
  weights:
    semantic: 0.60  # Increase (was 0.40)
    symbol_match: 0.20  # Decrease (was 0.25)
```

#### Cause 2.2: Symbol Match Not Working

**Problem**: Function names not matched

**Diagnosis**:
```bash
# Check symbol extraction
prism debug symbols "authenticateUser"

# Output:
# Found symbols:
# - authenticateUser (5 matches)
# - authenticate (12 matches)
# - auth (45 matches)
```

**Solution**:
```yaml
# Increase symbol weight
optimization:
  weights:
    semantic: 0.30  # Decrease
    symbol_match: 0.40  # Increase (was 0.25)
```

#### Cause 2.3: File Proximity Overriding

**Problem**: Local chunks favored over relevant distant ones

**Diagnosis**:
```bash
prism chat "fix auth" --show-scores

# Output:
# 1. currentFile.ts:helper() (score: 0.82)  # Local but not relevant
# 2. auth.ts:authenticate() (score: 0.76)  # Relevant but distant
```

**Solution**:
```yaml
# Reduce proximity weight
optimization:
  weights:
    file_proximity: 0.05  # Decrease (was 0.20)
    semantic: 0.50  # Increase (was 0.40)
```

#### Cause 2.4: Recency Bias

**Problem**: Old code ignored even if relevant

**Diagnosis**:
```bash
prism chat "fix bug" --show-scores --show-metadata

# Output:
# 1. newFeature.ts (score: 0.89, edited: 2 days ago)
# 2. oldAuth.ts (score: 0.65, edited: 2 years ago)  # Actually relevant
```

**Solution**:
```yaml
# Reduce recency weight
optimization:
  weights:
    recency: 0.02  # Decrease (was 0.10)
    semantic: 0.48  # Increase (was 0.40)
```

### Issue 3: Poor Compression Quality

**Symptoms**:
- Compressed code loses important details
- Claude misunderstands compressed code
- Comments that were important removed

**Diagnosis**:
```bash
prism chat "your query" --show-compression --output compressed.txt

# Review compressed.txt to see what was removed
```

**Possible Causes**:

#### Cause 3.1: Aggressive Compression

**Problem**: Too much removed

```yaml
# Problem setting
optimization:
  compression_level: aggressive
```

**Solution**:
```yaml
# Use lighter compression
optimization:
  compression_level: medium  # or light
```

#### Cause 3.2: Important Comments Removed

**Problem**: Critical comments deleted

**Example**:
```typescript
// BEFORE:
// CRITICAL: Never cache this value due to security implications
async function getToken() {
  return fetch("/api/token");
}

// AFTER (aggressive):
async function getToken() { return fetch("/api/token"); }
// Lost important warning!
```

**Solution 1**: Use lighter compression
```yaml
optimization:
  compression_level: light  # Keep comments
```

**Solution 2**: Preserve specific patterns
```yaml
compression:
  preserve_patterns:
    - "CRITICAL:"
    - "TODO:"
    - "FIXME:"
    - "HACK:"
    - "WARNING:"
```

#### Cause 3.3: Whitespace Collapse Breaking Code

**Problem**: Code becomes unreadable

**Example**:
```typescript
// BEFORE:
if (user) {
  if (user.isAdmin) {
    return "admin";
  } else {
    return "user";
  }
}

// AFTER (aggressive):
if (user) { if (user.isAdmin) { return "admin"; } else { return "user"; } }
// Hard to read!
```

**Solution**:
```yaml
optimization:
  compression_level: medium  # Preserve some structure
```

### Issue 4: Slow Optimization

**Symptoms**:
- Queries take >200ms to optimize
- Noticeable lag before Claude responds

**Diagnosis**:
```bash
prism chat "test" --profile

# Look for bottlenecks
```

**Possible Causes**:

#### Cause 4.1: Too Many Chunks Scored

**Problem**: Scoring 100K+ chunks

**Diagnosis**:
```bash
# Profile output shows:
# Relevance Scoring: 180ms  # Too slow!
```

**Solutions**:

**Solution 1**: Increase min_relevance
```yaml
optimization:
  min_relevance: 0.7  # Filter earlier
```

**Solution 2**: Enable pre-computed scores
```yaml
indexing:
  precompute_scores: true
```

**Solution 3**: Use sharding
```yaml
sharding:
  enable: true
  shard_by: directory
```

#### Cause 4.2: Slow Vector Search

**Problem**: Vector DB queries are slow

**Diagnosis**:
```bash
# Profile output shows:
# Semantic Search: 85ms  # Too slow!
```

**Solutions**:

**Solution 1**: Use HNSW index
```yaml
vector_db:
  index_type: hnsw
  ef_construction: 200
  m: 16
```

**Solution 2**: Reduce top_k
```yaml
vector_db:
  top_k: 10  # Was 20
```

**Solution 3**: Enable sharding
```yaml
sharding:
  enable: true
```

#### Cause 4.3: No Caching

**Problem**: Re-computing everything

**Diagnosis**:
```bash
# Run same query twice
time prism chat "test query"  # First run
time prism chat "test query"  # Second run (should be faster)

# If same time, caching not working
```

**Solution**:
```yaml
caching:
  enable_query_cache: true
  query_cache_ttl: 3600
  embedding_cache_ttl: 86400
```

### Issue 5: High API Costs

**Symptoms**:
- Unexpectedly high Claude API bills
- Cost higher than estimated

**Diagnosis**:
```bash
# Check cost breakdown
prism stats costs --period 30d

# Output:
# Total cost: $45.67
# By model:
#   - opus: $38.90 (85%)
#   - sonnet: $5.40 (12%)
#   - haiku: $1.37 (3%)
```

**Possible Causes**:

#### Cause 5.1: Always Using Opus

**Problem**: Routing defaults to Opus too often

**Diagnosis**:
```bash
# Check model distribution
prism stats models

# Output:
# opus: 234 queries (82%)
# sonnet: 45 queries (16%)
# haiku: 6 queries (2%)
```

**Solution**:
```yaml
optimization:
  models:
    prefer_local: true  # Use Ollama when possible
    opus_threshold: 150000  # Increase (was 100000)
```

#### Cause 5.2: Large Token Budget

**Problem**: Sending too many tokens

**Diagnosis**:
```bash
prism chat "test" --show-tokens

# Output:
# Original: 2,500,000 tokens
# Optimized: 180,000 tokens  # Still large!
# Budget: 180,000
```

**Solution**:
```yaml
optimization:
  token_budget: 50000  # Reduce (was 180000)
  compression_level: aggressive  # Compress more
```

#### Cause 5.3: Not Using Local Models

**Problem**: Always paying for Claude

**Diagnosis**:
```bash
# Check Ollama availability
prism doctor

# Output:
# Ollama: NOT AVAILABLE
# Status: Not running
```

**Solution**:
```bash
# Install and start Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve &

# Pull a model
ollama pull deepseek-coder-v2

# Configure Prism
prism config set models.ollama_base_url http://localhost:11434
prism config set models.prefer_local true
```

### Issue 6: Model Selection Wrong

**Symptoms**:
- Simple tasks use Opus (expensive)
- Complex tasks use Haiku (poor quality)
- Ollama not being used when available

**Diagnosis**:
```bash
prism chat "your query" --show-model-selection

# Output:
# Tokens: 3,000
# Complexity: 0.3
# Ollama available: true
# Selected: claude-3-opus  # Wrong! Should use Ollama
```

**Possible Causes**:

#### Cause 6.1: Thresholds Wrong

**Problem**: Model routing thresholds misconfigured

**Diagnosis**:
```yaml
# Current config
optimization:
  models:
    haiku_threshold: 5000  # Too low
    sonnet_threshold: 15000  # Too low
```

**Solution**:
```yaml
# Adjust thresholds
optimization:
  models:
    haiku_threshold: 20000  # Default
    sonnet_threshold: 100000  # Default
```

#### Cause 6.2: Ollama Not Detected

**Problem**: Ollama running but not detected

**Diagnosis**:
```bash
# Check Ollama
curl http://localhost:11434/api/tags

# If this fails, Ollama not running or wrong port
```

**Solution**:
```bash
# Start Ollama
ollama serve &

# Verify connection
curl http://localhost:11434/api/tags

# Update Prism config
prism config set models.ollama_base_url http://localhost:11434
```

#### Cause 6.3: Complexity Misestimated

**Problem**: Query complexity wrong

**Diagnosis**:
```bash
prism chat "your query" --show-complexity

# Output:
# Query: "fix bug"
# Detected complexity: 0.8  # Too high for simple bug fix
# Expected: 0.4-0.5
```

**Solution**:
```yaml
# Adjust complexity detection
optimization:
  complexity:
    simple_keywords: ["fix", "bug", "error"]
    complex_keywords: ["architecture", "redesign", "refactor system"]
    threshold_simple: 0.3
    threshold_complex: 0.7
```

## Debug Mode Commands

### Enable Debug Logging

```bash
# Enable debug logging
prism config set logging.level debug

# Run query
prism chat "your query"

# Check logs
tail -f ~/.prism/logs/debug.log

# Disable when done
prism config set logging.level info
```

### Show All Scores

```bash
# Show scores for all chunks (not just selected)
prism chat "your query" --show-scores --show-all

# Output:
# All chunks scored:
# 1. auth.ts:authenticate() [0.94] ✓ SELECTED
# 2. auth.ts:validate() [0.89] ✓ SELECTED
# 3. middleware.ts:auth() [0.76] ✓ SELECTED
# 4. error.ts:AuthError [0.68] ✓ SELECTED
# 5. user.ts:User [0.54] ✗ NOT SELECTED (score too low)
# 6. types.ts:AuthResult [0.42] ✗ NOT SELECTED (score too low)
```

### Show Compression Details

```bash
# Show compression for each chunk
prism chat "your query" --show-compression

# Output:
# Chunk 1: auth.ts:authenticate()
#   Original: 1,200 tokens
#   Compressed: 360 tokens
#   Reduction: 70%
#   Method: medium (comments removed, whitespace collapsed)
#
# Chunk 2: middleware.ts:auth()
#   Original: 3,200 tokens
#   Compressed: 960 tokens
#   Reduction: 70%
#   Method: medium
```

### Explain Selection

```bash
# Show why chunks were selected/excluded
prism chat "your query" --explain-selection

# Output:
# Chunk: auth.ts:authenticate()
#   Status: SELECTED
#   Final score: 0.94
#   Score breakdown:
#     Semantic similarity: 0.87 × 0.40 = 0.348
#     Symbol match: 0.92 × 0.25 = 0.230
#     File proximity: 1.00 × 0.20 = 0.200
#     Recency: 0.89 × 0.10 = 0.089
#     Usage frequency: 0.80 × 0.05 = 0.040
#   Rank: 1
#
# Chunk: user.ts:User
#   Status: NOT SELECTED
#   Final score: 0.54
#   Reason: Score below min_relevance (0.6)
```

## Performance Tuning

### If Optimization is Too Slow

See [Performance Guide](../guide/07-optimization-performance.md) for detailed tuning.

Quick fixes:

```yaml
# Reduce work
optimization:
  max_chunks: 5
  min_relevance: 0.7

# Enable caching
caching:
  enable_query_cache: true

# Pre-compute during indexing
indexing:
  precompute_scores: true
```

### If Quality is Too Low

Quick fixes:

```yaml
# Increase context
optimization:
  token_budget: 150000
  min_relevance: 0.4
  max_chunks: 20

# Lighter compression
optimization:
  compression_level: light

# Better model
optimization:
  models:
    opus_threshold: 50000  # Use Opus more often
```

## Getting Help

If you can't resolve the issue:

1. **Collect diagnostics**:
   ```bash
   prism doctor > diagnostics.txt
   prism config show > config.txt
   prism chat "test" --profile > profile.txt
   ```

2. **Check logs**:
   ```bash
   cat ~/.prism/logs/debug.log > debug.log
   ```

3. **Create issue**:
   - Upload diagnostics.txt, config.txt, profile.txt, debug.log
   - Describe the problem
   - Include expected vs actual behavior

## See Also

- [Token Optimization Guide](../guide/06-token-optimization.md)
- [Configuration Guide](../user-guide/04-optimization-config.md)
- [Performance Guide](../guide/07-optimization-performance.md)

---

**Last Updated**: 2025-01-13
**Next Review**: 2025-02-01
