# Token Optimization Configuration Guide

**Component**: Token Optimizer
**Version**: 1.0.0
**Last Updated**: 2025-01-13

## Overview

The token optimizer can be configured to balance between context completeness and token efficiency. This guide explains all available settings and how to tune them for your use case.

## Configuration File

Configuration is stored in `~/.prism/config.yaml`:

```yaml
# Token Optimization Settings
optimization:
  # Primary token budget
  token_budget: 100000

  # Minimum relevance threshold
  min_relevance: 0.6

  # Maximum chunks to select
  max_chunks: 10

  # Compression aggressiveness
  compression_level: medium

  # Scoring feature weights
  weights:
    semantic: 0.40
    symbol_match: 0.25
    file_proximity: 0.20
    recency: 0.10
    usage_frequency: 0.05

  # Model routing preferences
  models:
    prefer_local: true
    ollama_base_url: http://localhost:11434
    local_model: deepseek-coder-v2

    # Cost thresholds
    haiku_threshold: 20000
    sonnet_threshold: 100000
    opus_threshold: 200000
```

## Token Budget Settings

### token_budget

**Default**: `100000`
**Range**: `1000 - 200000`
**Unit**: Tokens

The maximum number of tokens to use for code context (excluding the query itself).

#### When to Increase

- Complex refactoring tasks
- Multi-file changes
- Architecture decisions
- When you're getting "not enough context" responses

#### When to Decrease

- Simple bug fixes
- Single-file changes
- To reduce API costs
- When responses include too much irrelevant code

#### Examples

```yaml
# For simple fixes (save money)
optimization:
  token_budget: 20000  # ~20K tokens

# For complex tasks (more context)
optimization:
  token_budget: 150000  # ~150K tokens

# For maximum context (use all available)
optimization:
  token_budget: 180000  # ~180K tokens (leaves room for query + response)
```

### Budget Calculation

```
Total Context Window = 200,000 tokens (for Claude)
├── Query              = ~1,000 tokens
├── Code Context       = token_budget
├── System Prompt      = ~500 tokens
├── Response Headroom  = ~20,000 tokens
└── Safety Margin      = remainder

Recommended: token_budget = 150,000 (75% of window)
```

## Relevance Settings

### min_relevance

**Default**: `0.6`
**Range**: `0.0 - 1.0`
**Unit**: Score (0-1)

Minimum relevance score for a chunk to be considered. Chunks scoring below this are ignored.

#### Impact

| Setting | Chunks Considered | Precision | Recall |
|---------|-------------------|-----------|--------|
| 0.8 | Very few | High | Low |
| 0.6 | Moderate | Balanced | Balanced |
| 0.4 | Many | Low | High |

#### When to Adjust

```yaml
# Increase precision (reduce false positives)
optimization:
  min_relevance: 0.7  # Only highly relevant chunks

# Increase recall (reduce false negatives)
optimization:
  min_relevance: 0.4  # Include borderline chunks

# Default balanced
optimization:
  min_relevance: 0.6  # Good balance
```

### max_chunks

**Default**: `10`
**Range**: `1 - 50`
**Unit**: Number of chunks

Hard limit on the number of chunks to select, regardless of token budget.

#### When to Increase

- Need to see more files
- Complex dependencies
- Architecture overview

#### When to Decrease

- Focused changes
- Reduce noise
- Faster optimization

#### Examples

```yaml
# Laser focus (single function)
optimization:
  max_chunks: 3

# Balanced (default)
optimization:
  max_chunks: 10

# Broad context (multiple files)
optimization:
  max_chunks: 25
```

## Compression Settings

### compression_level

**Default**: `medium`
**Options**: `light`, `medium`, `aggressive`

How aggressively to compress selected chunks.

#### Light Compression

```yaml
optimization:
  compression_level: light
```

**What it does**: Remove comments only
**Savings**: ~15%
**Use when**: Code has lots of comments, need full implementation
**Example**: Explaining complex algorithms

#### Medium Compression (Recommended)

```yaml
optimization:
  compression_level: medium
```

**What it does**: Remove comments + collapse whitespace
**Savings**: ~40%
**Use when**: Most queries, balanced readability
**Example**: Bug fixes, feature adds

#### Aggressive Compression

```yaml
optimization:
  compression_level: aggressive
```

**What it does**: Signatures only + key logic
**Savings**: ~75%
**Use when**: Very tight budget, overview only
**Example**: Understanding architecture

#### Comparison

```
Original: 1,000 tokens
  Light:     850 tokens (15% savings)
  Medium:    600 tokens (40% savings)
  Aggressive: 250 tokens (75% savings)
```

## Feature Weights

Tune how much each feature contributes to the final relevance score.

### semantic (0.40)

**Default**: `0.40`
**Range**: `0.0 - 1.0`

Weight for semantic similarity (vector similarity).

#### When to Adjust

```yaml
# Increase for conceptual queries
optimization:
  weights:
    semantic: 0.60  # Focus on meaning

# Decrease for specific references
optimization:
  weights:
    semantic: 0.20  # Focus on exact matches
```

**Use cases**:
- High (0.6): "How does authentication work?"
- Low (0.2): "Fix the authenticate() function"

### symbol_match (0.25)

**Default**: `0.25`
**Range**: `0.0 - 1.0`

Weight for symbol name matching (function/class names).

#### When to Adjust

```yaml
# Increase for specific function references
optimization:
  weights:
    symbol_match: 0.40  # Prioritize exact names

# Decrease for conceptual queries
optimization:
  weights:
    symbol_match: 0.10  # Ignore exact names
```

**Use cases**:
- High (0.4): "What does authenticateUser() do?"
- Low (0.1): "How do I handle user authentication?"

### file_proximity (0.20)

**Default**: `0.20`
**Range**: `0.0 - 1.0`

Weight for file location (same file > same dir > related).

#### When to Adjust

```yaml
# Increase for local changes
optimization:
  weights:
    file_proximity: 0.35  # Focus on nearby code

# Decrease for cross-repo changes
optimization:
  weights:
    file_proximity: 0.05  # Ignore location
```

**Use cases**:
- High (0.35): "Fix this function in this file"
- Low (0.05): "How is this pattern used across the codebase?"

### recency (0.10)

**Default**: `0.10`
**Range**: `0.0 - 1.0`

Weight for recently edited code.

#### When to Adjust

```yaml
# Increase for active development
optimization:
  weights:
    recency: 0.25  # Prioritize recent changes

# Decrease for stable codebase
optimization:
  weights:
    recency: 0.05  # Ignore edit time
```

**Use cases**:
- High (0.25): Active feature branch
- Low (0.05): Maintenance on legacy code

### usage_frequency (0.05)

**Default**: `0.05`
**Range**: `0.0 - 1.0`

Weight for historically helpful chunks.

#### When to Adjust

```yaml
# Increase to leverage learning
optimization:
  weights:
    usage_frequency: 0.20  # Learn from past

# Decrease to avoid feedback loops
optimization:
  weights:
    usage_frequency: 0.0  # Ignore history
```

**Use cases**:
- High (0.2): Long-term project with lots of queries
- Low (0.0): New project, no history yet

### Weight Summation

All weights must sum to approximately 1.0:

```yaml
# Good: sums to 1.0
optimization:
  weights:
    semantic: 0.40
    symbol_match: 0.25
    file_proximity: 0.20
    recency: 0.10
    usage_frequency: 0.05

# Bad: sums to 0.7 (scores will be too low)
optimization:
  weights:
    semantic: 0.30
    symbol_match: 0.20
    file_proximity: 0.20

# Bad: sums to 1.5 (scores will be too high)
optimization:
  weights:
    semantic: 0.60
    symbol_match: 0.40
    file_proximity: 0.30
    recency: 0.20
```

## Model Selection Settings

### prefer_local

**Default**: `true`
**Options**: `true`, `false`

Whether to use local models (Ollama) when available.

```yaml
# Use local models when possible (save money)
optimization:
  models:
    prefer_local: true

# Always use Claude (better quality)
optimization:
  models:
    prefer_local: false
```

### ollama_base_url

**Default**: `http://localhost:11434`

URL for Ollama API endpoint.

```yaml
# Default (local)
optimization:
  models:
    ollama_base_url: http://localhost:11434

# Remote Ollama server
optimization:
  models:
    ollama_base_url: http://ollama.example.com:11434
```

### local_model

**Default**: `deepseek-coder-v2`

Which Ollama model to use.

```yaml
# Coding focused
optimization:
  models:
    local_model: deepseek-coder-v2

# General purpose
optimization:
  models:
    local_model: llama2:70b

# Fast and lightweight
optimization:
  models:
    local_model: phi:2.7b
```

### Cost Thresholds

At what token count to switch between models.

#### haiku_threshold

**Default**: `20000`

```yaml
# Use Haiku for more tasks (save money)
optimization:
  models:
    haiku_threshold: 50000  # Up to 50K tokens

# Use Sonnet more often (better quality)
optimization:
  models:
    haiku_threshold: 5000   # Only for very small tasks
```

#### sonnet_threshold

**Default**: `100000`

```yaml
# Use Sonnet more liberally
optimization:
  models:
    sonnet_threshold: 150000  # Up to 150K tokens

# Prefer Opus for complex tasks
optimization:
  models:
    sonnet_threshold: 50000   # Switch to Opus earlier
```

#### opus_threshold

**Default**: `200000`

```yaml
# Never use Opus (save money)
optimization:
  models:
    opus_threshold: 999999  # Effectively never

# Use Opus more often
optimization:
  models:
    opus_threshold: 75000   # For complex tasks
```

## Example Configurations

### Configuration for Cost Optimization

```yaml
# Save money at the expense of some quality
optimization:
  token_budget: 20000
  min_relevance: 0.7
  max_chunks: 5
  compression_level: aggressive

  models:
    prefer_local: true
    haiku_threshold: 100000  # Always use Haiku
    sonnet_threshold: 999999  # Never use Sonnet
    opus_threshold: 999999   # Never use Opus
```

**Expected savings**: 95%+ cost reduction vs. default
**Trade-off**: May miss some relevant context

### Configuration for Maximum Quality

```yaml
# Get the best possible answers, cost is no object
optimization:
  token_budget: 180000
  min_relevance: 0.4  # Include borderline chunks
  max_chunks: 50
  compression_level: light

  weights:
    semantic: 0.30  # More balanced scoring
    symbol_match: 0.30
    file_proximity: 0.20
    recency: 0.15
    usage_frequency: 0.05

  models:
    prefer_local: false  # Always use Claude
    haiku_threshold: 1000  # Almost never use Haiku
    sonnet_threshold: 50000
    opus_threshold: 100000  # Use Opus for complex tasks
```

**Expected quality**: Maximum context, best model
**Trade-off**: 10-20x higher cost

### Configuration for Active Development

```yaml
# Working on a feature branch, need recent code
optimization:
  token_budget: 80000
  min_relevance: 0.6
  max_chunks: 15
  compression_level: medium

  weights:
    semantic: 0.35
    symbol_match: 0.30  # Prioritize exact names
    file_proximity: 0.25  # Focus on local changes
    recency: 0.30  # Prioritize recent edits
    usage_frequency: 0.00  # Ignore history (new code)

  models:
    prefer_local: true  # Use local when possible
```

**Optimized for**: Fast iteration on new features
**Focus**: Recent, local changes

### Configuration for Legacy Code Maintenance

```yaml
# Maintaining old codebase, need broad understanding
optimization:
  token_budget: 120000
  min_relevance: 0.5  # Lower threshold
  max_chunks: 20
  compression_level: medium

  weights:
    semantic: 0.50  # Focus on meaning
    symbol_match: 0.20  # Names may have changed
    file_proximity: 0.10  # Ignore location
    recency: 0.05  # Ignore edit time
    usage_frequency: 0.15  # Learn from past maintenance

  models:
    prefer_local: false  # Use Claude for quality
    haiku_threshold: 10000
    sonnet_threshold: 100000
```

**Optimized for**: Understanding old, complex code
**Focus**: Semantic meaning over specific references

## Runtime Overrides

You can override config at runtime:

```bash
# Single query with custom budget
prism chat "fix auth bug" --budget 50000

# Use specific model
prism chat "explain architecture" --model opus

# Disable compression
prism chat "show full code" --no-compress

# Show scores for debugging
prism chat "fix bug" --show-scores
```

## Validation

Prism validates your config on startup:

```bash
$ prism chat

Error: Invalid configuration
  - optimization.weights sum to 0.7, expected 1.0
  - optimization.token_budget (500000) exceeds maximum (200000)

Fix these issues and restart.
```

## Reset to Defaults

```bash
# Remove config file
rm ~/.prism/config.yaml

# Restart Prism (will recreate with defaults)
prism chat
```

## Best Practices

1. **Start with defaults**: They're tuned for most use cases
2. **Adjust one setting at a time**: See the impact
3. **Monitor your costs**: Check `prism stats`
4. **Use profiles**: Create different configs for different projects
5. **Document custom settings**: Add comments in config.yaml

## Profiles

You can maintain multiple configurations:

```bash
# Use profile for cost-sensitive project
prism chat --config ~/.prism/config-cost-optimized.yaml

# Use profile for quality-sensitive project
prism chat --config ~/.prism/config-quality-optimized.yaml

# Set default profile
prism config set-profile cost-optimized
```

## See Also

- [Token Optimization Guide](../guide/06-token-optimization.md)
- [Performance Guide](../guide/07-optimization-performance.md)
- [Troubleshooting](../troubleshooting/02-token-optimization.md)

---

**Last Updated**: 2025-01-13
**Next Review**: 2025-02-01
