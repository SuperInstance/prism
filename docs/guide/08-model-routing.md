# Model Routing Guide

**Last Updated**: 2026-01-13
**Component**: Model Router
**Status**: Stable

## Overview

The Model Router is Prism's intelligent traffic cop for AI requests. It analyzes each query and automatically routes it to the most appropriate model based on:

- **Token count** - How much context is needed
- **Query complexity** - How difficult the task is
- **Cost considerations** - Minimizing API expenses
- **Availability** - What's currently accessible

This ensures you get the best results at the lowest cost, automatically.

---

## How Routing Works

### The Decision Flow

When you make a request, the router follows this decision tree:

```
┌─────────────────────────────────────┐
│  1. Analyze Request                 │
│     - Count tokens                  │
│     - Calculate complexity (0-1)    │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  2. Check Ollama (Local, Free)      │
│     Available?                      │
│     AND tokens < 8K?                │
│     AND complexity < 0.6?           │
└─────────────────┬───────────────────┘
                  │
        ┌─────────┴─────────┐
        │ Yes               │ No
        ▼                   ▼
  Use Ollama      ┌─────────────────────┐
  (Free!)         │ 3. Check Cloudflare │
                  │    Available?       │
                  │    AND tokens < 50K?│
                  └─────────┬───────────┘
                            │
                  ┌─────────┴─────────┐
                  │ Yes               │ No
                  ▼                   ▼
            Use Cloudflare    ┌─────────────────┐
            (Free!)           │ 4. Check Budget │
                              └─────────┬───────┘
                                        │
                              ┌─────────┴─────────┐
                              │ Available?       │ No
                              ▼                  ▼
                        ┌─────────────┐   Alert + Error
                        │ 5. Select   │   or Fallback
                        │    Claude   │
                        └──────┬──────┘
                               │
                  ┌────────────┼────────────┐
                  │            │            │
         tokens < 50K   tokens < 100K   Always
         complexity < 0.6
                  │            │            │
                  ▼            ▼            ▼
              Haiku        Sonnet        Opus
            ($0.25/M)     ($3/M)       ($15/M)
```

### Priority Order

1. **Ollama** (Free, Local) - Always first choice if suitable
2. **Cloudflare Workers AI** (Free) - Next best if Ollama unavailable
3. **Claude Haiku** (Cheap) - For simple, larger tasks
4. **Claude Sonnet** (Balanced) - For most real work
5. **Claude Opus** (Premium) - For complex problems only

### What is Complexity?

Complexity is a score from 0 (simple) to 1 (complex) calculated from:

- **Keywords** - Words like "architecture", "refactor", "async" increase complexity
- **Query length** - Longer queries are typically more complex
- **Code patterns** - Terms like "function", "class", "async" indicate programming tasks

**Examples:**
- "What is a variable?" → Complexity: 0.15 (Very Simple)
- "Create a REST API" → Complexity: 0.45 (Medium)
- "Design a scalable microservice architecture with async message queues" → Complexity: 0.85 (Complex)

---

## Model Options

### 1. Ollama (Free, Local)

**Best For:** Simple queries, development, offline work

**Models:**
- `deepseek-coder-v2` - Code-focused (default)
- `codellama` - General coding
- `llama3.2` - Chat and general tasks

**Pros:**
- 100% free
- Works offline
- Private (data never leaves your machine)
- Fast (no network latency)

**Cons:**
- Limited to simpler tasks (complexity < 0.6)
- Max 8K tokens
- Requires installation
- Quality varies by model

**When Used:**
```typescript
// Router automatically selects Ollama when:
tokens < 8000 && complexity < 0.6
```

---

### 2. Cloudflare Workers AI (Free, Cloud)

**Best For:** Medium-complexity tasks, cloud-based workflows

**Models:**
- `@cf/meta/llama-3.1-8b-instruct` - General purpose (default)
- `@cf/mistral/mistral-7b-instruct-v0.2` - Balanced performance

**Pros:**
- Free tier included with Cloudflare account
- No local setup required
- Good quality for most tasks
- Fast (edge deployment)

**Cons:**
- Requires Cloudflare account
- Requires internet connection
- Free tier has daily limits
- Not as smart as Claude models

**When Used:**
```typescript
// Router selects Cloudflare when:
Ollama unavailable OR
(tokens < 50000 && complexity < 0.7 && credentials configured)
```

---

### 3. Claude Haiku (Cheap, Cloud)

**Best For:** Fast responses, simple tasks, bulk operations

**Model:** `claude-3-haiku-20240307`

**Pricing:**
- Input: $0.25 per million tokens
- Output: $1.25 per million tokens

**Pros:**
- Very fast (~200ms latency)
- Inexpensive
- 200K context window
- Good for simple queries

**Cons:**
- Not as smart as Sonnet/Opus
- Can struggle with complex reasoning
- Still costs money

**When Used:**
```typescript
// Router selects Haiku when:
Ollama/Cloudflare unavailable AND
tokens < 50000 AND
complexity < 0.6
```

---

### 4. Claude Sonnet (Balanced, Cloud)

**Best For:** Most development tasks, code generation, debugging

**Model:** `claude-3-5-sonnet-20241022`

**Pricing:**
- Input: $3.00 per million tokens
- Output: $15.00 per million tokens

**Pros:**
- Excellent balance of speed and quality
- Great at coding tasks
- 200K context window
- Good at following instructions

**Cons:**
- More expensive than Haiku
- Slower than Haiku (~400ms latency)
- Overkill for simple tasks

**When Used:**
```typescript
// Router selects Sonnet when:
Ollama/Cloudflare unavailable AND
tokens < 100000
```

**Note:** This is the default for most real development work.

---

### 5. Claude Opus (Premium, Cloud)

**Best For:** Complex architecture, deep debugging, research

**Model:** `claude-3-opus-20240229`

**Pricing:**
- Input: $15.00 per million tokens
- Output: $75.00 per million tokens

**Pros:**
- Smartest model available
- Excellent at complex reasoning
- 200K context window
- Best for difficult problems

**Cons:**
- Very expensive
- Slower (~800ms latency)
- Overkill for most tasks

**When Used:**
```typescript
// Router selects Opus when:
tokens >= 100000 OR
complexity is very high (>0.9)
```

**Note:** Only used when necessary due to cost.

---

## Routing Rules

### Complete Decision Matrix

| Tokens | Complexity | Ollama Available | Cloudflare Available | Selected Model | Cost |
|--------|------------|------------------|----------------------|----------------|------|
| < 8K | < 0.6 | Yes | Any | Ollama | Free |
| < 8K | < 0.6 | No | Yes | Cloudflare | Free |
| < 8K | < 0.6 | No | No | Haiku | $0.25/M |
| < 50K | < 0.7 | No | Yes | Cloudflare | Free |
| < 50K | < 0.6 | Any | No | Haiku | $0.25/M |
| < 100K | Any | Any | Any | Sonnet | $3/M |
| ≥ 100K | Any | Any | Any | Opus | $15/M |

### Examples

#### Example 1: Simple Query
```typescript
Query: "What is a closure in JavaScript?"
Tokens: 150
Complexity: 0.25
→ Routes to: Ollama (deepseek-coder-v2)
→ Cost: $0.00
```

#### Example 2: Medium Code Generation
```typescript
Query: "Create a REST API with authentication"
Tokens: 5,000
Complexity: 0.55
→ Routes to: Ollama (if available)
→ Cost: $0.00
```

#### Example 3: Complex Architecture
```typescript
Query: "Design a scalable microservice architecture with async message queues, circuit breakers, and distributed tracing"
Tokens: 25,000
Complexity: 0.85
→ Routes to: Sonnet (Ollama too simple, Cloudflare unavailable)
→ Cost: ~$0.08
```

#### Example 4: Large Codebase Analysis
```typescript
Query: [50K tokens of code] + "Optimize this codebase for performance"
Tokens: 55,000
Complexity: 0.75
→ Routes to: Sonnet (over token limit for Haiku)
→ Cost: ~$0.17
```

#### Example 5: Very Complex Task
```typescript
Query: [100K+ tokens] + "Redesign this entire system for better scalability"
Tokens: 120,000
Complexity: 0.95
→ Routes to: Opus (requires best model)
→ Cost: ~$1.80
```

---

## Budget Management

### Daily Limits

If you're using Cloudflare's free tier, you have limits:

```typescript
const CLOUDFLARE_LIMITS = {
  neurons_per_day: 10_000,  // ~10M tokens
  requests_per_day: 100_000,
};

// Router tracks usage and falls back to Ollama if approaching limits
```

### Cost Tracking

The router provides cost estimates before making requests:

```typescript
const choice = router.selectModel(50000, 0.7);

console.log(choice.model);        // "claude-3-5-sonnet-20241022"
console.log(choice.reason);       // "Token count (50000) and complexity..."
console.log(choice.estimatedCost); // 0.105 (dollars)
```

### Budget Alerts

You can set budget limits:

```yaml
# prism.config.yaml
router:
  daily_budget: 10.00  # $10 per day
  alert_at: 8.00       # Alert when 80% used
  deny_at: 10.00       # Block requests when limit reached
```

---

## Manual Overrides

You can override automatic routing when needed:

```typescript
// Force a specific model
const response = await prism.ask("Explain this code", {
  model: "anthropic:claude-3-opus",  // Force Opus
});

// Prefer local models
const response = await prism.ask("Simple question", {
  preferLocal: true,  // Use Ollama even if Cloudflare available
});

// Set cost limit
const response = await prism.ask("Help me", {
  maxCost: 0.01,  // Only use free/cheap models
});
```

---

## Best Practices

### 1. Let the Router Decide

Most of the time, automatic routing is optimal:

```typescript
// Good - let router choose
const answer = await prism.ask(question);

// Bad - micromanaging
const answer = await prism.ask(question, { model: "..." });
```

### 2. Use Ollama When Possible

For development and simple tasks, Ollama is ideal:

- 100% cost savings
- Works offline
- Privacy (local processing)

### 3. Reserve Opus for Hard Problems

Opus is expensive. Use it only when:

- Complexity > 0.9
- Tokens > 100K
- Previous models failed

### 4. Monitor Costs

Check your spending regularly:

```bash
prism stats costs
```

---

## Troubleshooting

### "Model unavailable" Error

**Cause:** Selected model is not configured

**Solution:**
```bash
# Check what's available
prism doctor models

# Configure missing credentials
prism config set anthropic.api_key YOUR_KEY
```

### High Costs

**Cause:** Router selecting expensive models

**Solutions:**
1. Enable Ollama for free local processing
2. Set a lower complexity threshold
3. Use `preferLocal: true` option

### Slow Responses

**Cause:** Network latency or overloaded service

**Solutions:**
1. Use Ollama (no network)
2. Try Haiku instead of Sonnet/Opus
3. Check your internet connection

---

## Next Steps

- **Setup Ollama** - See [Ollama Setup Guide](./09-ollama-setup.md)
- **Understand Costs** - See [Cost Analysis](./10-cost-analysis.md)
- **Compare Performance** - See [Model Performance Guide](./11-model-performance.md)
- **Architecture Details** - See [Model Router Architecture](../architecture/06-model-router-architecture.md)
