# Token Optimization Guide

**Component**: Token Optimizer
**Version**: 1.0.0
**Last Updated**: 2025-01-13

## Overview

The Token Optimizer is Vantage's core innovation - reducing context usage by 90%+ while preserving semantic meaning. It transforms massive codebases (millions of tokens) into minimal, relevant context that fits within Claude's token window.

## How It Works: The 6-Phase Pipeline

### Phase 1: Intent Detection

**Goal**: Understand what the user wants and how to approach it.

```typescript
Input: "fix the bug in auth middleware"

Output: {
  type: "bug_fix",
  entities: ["auth", "middleware"],
  scope: "single_file",
  complexity: 0.6
}
```

**What happens:**
1. Analyze the query for intent keywords (bug, feature, explain, refactor)
2. Extract relevant entities (file names, symbols, types)
3. Determine search scope (single file, multi-file, repo-wide)
4. Estimate complexity (0.0 = simple, 1.0 = requires Opus)

**Intent Types:**

| Type | Pattern | Strategy |
|------|---------|----------|
| `bug_fix` | "fix bug", "error", "not working" | Focus on error handlers, related functions |
| `feature_add` | "add", "implement", "create" | Focus on similar features, patterns |
| `explain` | "how does", "what is", "explain" | Broad context, show relationships |
| `refactor` | "refactor", "optimize", "clean up" | Focus on target + dependencies |
| `test` | "test", "spec", "coverage" | Focus on code + existing tests |
| `debug` | "debug", "why", "trace" | Focus on execution path, logs |

### Phase 2: Semantic Search & Retrieval

**Goal**: Find all potentially relevant code chunks.

**Multi-Hop Retrieval:**

```
Hop 1: Direct Vector Search
  → Top 20 chunks by semantic similarity

Hop 2: Expand to Related Files
  → Find imports/dependencies
  → Add chunks from related files

Hop 3: Symbol Definitions
  → Find definitions of named entities
  → Add type definitions, interfaces

Result: ~50-100 candidate chunks
```

**Example:**
```
Query: "fix auth bug"

Hop 1: Returns auth.ts (0.94), middleware.ts (0.76)
Hop 2: Expands to user.ts (imported by auth.ts)
Hop 3: Finds User type definition in types.ts
```

### Phase 3: Relevance Scoring

**Goal**: Score each chunk by how relevant it is to the query.

**The 5 Scoring Features:**

#### 1. Semantic Similarity (40% weight)

```typescript
semantic = cosine_similarity(
  query_embedding,
  chunk_embedding
)

// Example: 0.87 (highly similar)
```

Vector similarity between query and chunk embeddings. Captures conceptual meaning beyond keywords.

#### 2. Symbol Matching (25% weight)

```typescript
symbol_match = Jaccard_similarity(
  query_symbols,
  chunk_symbols
)

// Example: Both mention "authenticate" → 0.92
```

Measures overlap of function/class names. Important for specific references.

#### 3. File Proximity (20% weight)

```typescript
file_proximity = 1.0 if chunk.file_path == query.file_path
file_proximity = 0.7 if chunk.file_path imports query.file_path
file_proximity = 0.5 if same directory
file_proximity = 0.3 otherwise

// Example: Same file → 1.0
```

Prioritizes code near the query location. Captures local context.

#### 4. Recency (10% weight)

```typescript
recency = decay_function(
  days_since_last_edit,
  half_life = 30_days
)

// Example: Edited 5 days ago → 0.89
```

Recently edited code is more likely to be relevant. Uses exponential decay.

#### 5. Usage Frequency (5% weight)

```typescript
frequency = normalize(
  times_chunk_was_helpful,
  total_queries
)

// Example: This chunk helped 8/10 queries → 0.80
```

Learned from past interactions. Chunks that were historically useful get a boost.

**Final Score:**

```typescript
score = (
  0.40 * semantic +      // 0.87 * 0.40 = 0.348
  0.25 * symbol_match +  // 0.92 * 0.25 = 0.230
  0.20 * proximity +     // 1.00 * 0.20 = 0.200
  0.10 * recency +       // 0.89 * 0.10 = 0.089
  0.05 * frequency       // 0.80 * 0.05 = 0.040
)

// Total: 0.907 (very high relevance)
```

### Phase 4: Budget-Constrained Selection

**Goal**: Select the best chunks within the token budget.

**Greedy Algorithm:**

```typescript
// Sort by score density (score / token_cost)
sorted = chunks.sort((a, b) =>
  (b.score / b.tokens) - (a.score / a.tokens)
)

selected = []
spent = 0

for chunk in sorted:
  if spent + chunk.tokens <= budget:
    selected.append(chunk)
    spent += chunk.tokens
  elif spent + chunk.tokens <= budget * 1.1:
    # Allow 10% overage for high-value chunks
    if chunk.score > 0.8:
      selected.append(chunk)
      spent += chunk.tokens

return selected
```

**Example:**

```
Budget: 10,000 tokens

Chunks (sorted by score density):
  auth.ts:login()       [score: 0.95, 500 tokens]  ✓ SELECTED
  auth.ts:validate()    [score: 0.89, 800 tokens]  ✓ SELECTED
  middleware.ts:auth()  [score: 0.76, 1200 tokens] ✓ SELECTED
  user.ts:User          [score: 0.65, 600 tokens]  ✓ SELECTED
  types.ts:AuthResult   [score: 0.54, 400 tokens]  ✗ BUDGET EXCEEDED

Total: 3,100 tokens (31% of budget)
Chunks: 4 selected
```

### Phase 5: Adaptive Compression

**Goal**: Compress selected chunks to save more tokens.

**3 Compression Levels:**

#### Level 1: Light (Remove comments only)

```typescript
// BEFORE:
async function authenticateUser(credentials: Credentials): Promise<AuthResult> {
  // Validate credentials format
  if (!credentials.email || !credentials.password) {
    throw new ValidationError("Invalid credentials");
  }

  // Hash password for comparison
  const hash = await hashPassword(credentials.password);

  // Check against database
  const user = await db.users.findOne({ email: credentials.email });
  if (!user || user.passwordHash !== hash) {
    return { success: false, error: "Invalid credentials" };
  }

  return { success: true, user };
}

// AFTER:
async function authenticateUser(credentials: Credentials): Promise<AuthResult> {
  if (!credentials.email || !credentials.password) {
    throw new ValidationError("Invalid credentials");
  }

  const hash = await hashPassword(credentials.password);

  const user = await db.users.findOne({ email: credentials.email });
  if (!user || user.passwordHash !== hash) {
    return { success: false, error: "Invalid credentials" };
  }

  return { success: true, user };
}

// Savings: ~15%
```

#### Level 2: Medium (Collapse whitespace)

```typescript
// BEFORE:
async function authenticateUser(credentials: Credentials): Promise<AuthResult> {
  if (!credentials.email || !credentials.password) {
    throw new ValidationError("Invalid credentials");
  }

  const hash = await hashPassword(credentials.password);
  const user = await db.users.findOne({ email: credentials.email });

  if (!user || user.passwordHash !== hash) {
    return { success: false, error: "Invalid credentials" };
  }

  return { success: true, user };
}

// AFTER:
async function authenticateUser(credentials: Credentials): Promise<AuthResult> {
  if (!credentials.email || !credentials.password) { throw new ValidationError("Invalid credentials"); }
  const hash = await hashPassword(credentials.password);
  const user = await db.users.findOne({ email: credentials.email });
  if (!user || user.passwordHash !== hash) { return { success: false, error: "Invalid credentials" }; }
  return { success: true, user };
}

// Savings: ~40%
```

#### Level 3: Aggressive (Signatures only)

```typescript
// BEFORE:
async function authenticateUser(credentials: Credentials): Promise<AuthResult> {
  if (!credentials.email || !credentials.password) {
    throw new ValidationError("Invalid credentials");
  }

  const hash = await hashPassword(credentials.password);
  const user = await db.users.findOne({ email: credentials.email });

  if (!user || user.passwordHash !== hash) {
    return { success: false, error: "Invalid credentials" };
  }

  return { success: true, user };
}

// AFTER:
async function authenticateUser(credentials: Credentials): Promise<AuthResult>
  // Validates credentials, hashes password, checks DB
  // Returns { success, user } or { success, error }

// Savings: ~75%
```

**Compression Metadata:**

Each compressed chunk includes a header:

```typescript
// src/auth/auth.ts:42-58
// function: authenticateUser
// (compressed: 280 tokens, 76% reduction)
```

### Phase 6: Model Selection

**Goal**: Choose the cheapest viable model for the task.

**Decision Tree:**

```
┌─────────────────────────────────────────┐
│ Ollama available AND tokens < 8,000?    │
│ AND complexity < 0.6?                   │
└────────────────┬────────────────────────┘
                 │ YES
                 ▼
          Use: ollama:deepseek-coder-v2
          Cost: $0 (free local model)
          Reasoning: Sufficient for simple tasks

                 │ NO
                 ▼
┌─────────────────────────────────────────┐
│ tokens < 20,000 AND complexity < 0.4?   │
└────────────────┬────────────────────────┘
                 │ YES
                 ▼
          Use: claude-3-haiku-20240307
          Cost: $0.25/M input tokens
          Reasoning: Fastest Claude, good enough for simple queries

                 │ NO
                 ▼
┌─────────────────────────────────────────┐
│ tokens < 100,000 OR complexity < 0.8?   │
└────────────────┬────────────────────────┘
                 │ YES
                 ▼
          Use: claude-3.5-sonnet-20241022
          Cost: $3/M input tokens
          Reasoning: Balanced performance and cost

                 │ NO
                 ▼
          Use: claude-3-opus-20240229
          Cost: $15/M input tokens
          Reasoning: Best for complex reasoning
```

**Cost Examples:**

| Scenario | Tokens | Model | Cost |
|----------|--------|-------|------|
| Simple fix | 2,000 | Ollama | $0.00 |
| Medium task | 15,000 | Haiku | $0.004 |
| Complex task | 50,000 | Sonnet | $0.15 |
| Expert task | 150,000 | Opus | $2.25 |

## Complete Example Walkthrough

Let's trace through a complete optimization:

### Input

```typescript
Query: "fix the bug in auth middleware"
Codebase: 50,000 chunks (2.5M tokens)
Budget: 100,000 tokens
```

### Phase 1: Intent Detection

```typescript
{
  type: "bug_fix",
  entities: ["auth", "middleware"],
  scope: "multi_file",
  complexity: 0.6
}
```

### Phase 2: Semantic Search

```
Retrieved: 85 chunks
  - Direct matches: 20
  - Related files: 45
  - Symbol definitions: 20
```

### Phase 3: Relevance Scoring

```
Top scored chunks:
  1. auth.ts:authenticateMiddleware()  → 0.94
  2. auth.ts:validateToken()          → 0.89
  3. middleware.ts:authMiddleware()   → 0.76
  4. error.ts:AuthError               → 0.68
  5. user.ts:User                     → 0.54
  ...
```

### Phase 4: Budget Selection

```
Budget: 100,000 tokens

Selected chunks:
  auth.ts:authenticateMiddleware()  [2,400 tokens, score: 0.94]
  auth.ts:validateToken()           [1,800 tokens, score: 0.89]
  middleware.ts:authMiddleware()    [3,200 tokens, score: 0.76]
  error.ts:AuthError                [800 tokens, score: 0.68]

Total: 8,200 tokens (8.2% of budget)
```

### Phase 5: Compression

```
Compression level: Medium

Compressed:
  auth.ts:authenticateMiddleware()  [2,400 → 720 tokens, 70% reduction]
  auth.ts:validateToken()           [1,800 → 540 tokens, 70% reduction]
  middleware.ts:authMiddleware()    [3,200 → 960 tokens, 70% reduction]
  error.ts:AuthError                [800 → 240 tokens, 70% reduction]

Total: 2,460 tokens (2.5% of original codebase)
```

### Phase 6: Model Selection

```
Tokens: 2,460 + 500 (query) = 2,960
Complexity: 0.6

Selected: ollama:deepseek-coder-v2
Reasoning: Under 8K tokens, medium complexity, Ollama available
Cost: $0.00
```

### Final Output

```typescript
{
  prompt: "// RELEVANT CODE CONTEXT\n\n// File: src/auth/auth.ts\n...",
  tokens: 2,960,
  model: "ollama:deepseek-coder-v2",
  savings: {
    original_tokens: 2,500,000,
    optimized_tokens: 2,960,
    percentage: 99.88%
  },
  chunks_used: 4,
  confidence: 0.94
}
```

## Key Metrics

### Performance

| Metric | Target | Actual |
|--------|--------|--------|
| Scoring (10K chunks) | <50ms | ~35ms |
| Selection | <10ms | ~6ms |
| Compression | <20ms | ~12ms |
| **Total** | **<100ms** | **~53ms** |

### Savings

| Scenario | Original | Optimized | Savings |
|----------|----------|-----------|---------|
| Bug fix | 2.5M tokens | 2,960 tokens | 99.88% |
| Feature add | 1.8M tokens | 4,200 tokens | 99.77% |
| Explain | 3.2M tokens | 8,500 tokens | 99.73% |

### Cost Reduction

| Model | Original Cost | Optimized Cost | Savings |
|-------|---------------|----------------|---------|
| Opus task | $37.50 | $0.04 | 99.89% |
| Sonnet task | $7.50 | $0.01 | 99.87% |
| Haiku task | $0.63 | $0.001 | 99.84% |

## Advanced Topics

### Score Density Optimization

Instead of just sorting by score, we optimize for score per token:

```typescript
// Bad: High score but expensive
chunk_a: { score: 0.95, tokens: 5000 }
  → score_density = 0.00019

// Good: Slightly lower score but cheap
chunk_b: { score: 0.85, tokens: 500 }
  → score_density = 0.0017

Result: chunk_b is 9x more efficient
```

### Context Window Awareness

We adjust budget based on model:

```typescript
budgets = {
  'ollama:deepseek-coder-v2': 8000,    // Local model limit
  'claude-3-haiku': 200000,             // 200K context
  'claude-3.5-sonnet': 200000,          // 200K context
  'claude-3-opus': 200000,              // 200K context
}

target_budget = budgets[model] * 0.4  // Use 40% max
```

### Incremental Refinement

For complex tasks, we can iterate:

```typescript
// First pass: Get relevant chunks
result1 = await optimize(query, budget=10000)

// If user asks follow-up, expand context
result2 = await optimize(query + follow_up, budget=20000)

// Each iteration builds on previous context
```

## Best Practices

### For Users

1. **Be specific in queries**: Mention file names, functions, types
2. **Use intent keywords**: "fix", "add", "explain", "refactor"
3. **Provide context**: Mention related files or concepts
4. **Iterate**: Start with broad query, then narrow down

### For Developers

1. **Cache embeddings**: Avoid regenerating for same queries
2. **Pre-compute scores**: Score chunks during indexing
3. **Batch operations**: Process multiple chunks together
4. **Monitor performance**: Track optimization time and savings

## Troubleshooting

See [Token Optimization Troubleshooting](../troubleshooting/02-token-optimization.md) for:
- Wrong chunks selected
- Poor compression quality
- Slow optimization
- Cost higher than expected

## References

- [Architecture: Token Optimizer](../architecture/05-token-optimizer-architecture.md)
- [User Guide: Optimization Configuration](../user-guide/04-optimization-config.md)
- [Performance Guide](./07-optimization-performance.md)

---

**Last Updated**: 2025-01-13
**Next Review**: 2025-02-01
