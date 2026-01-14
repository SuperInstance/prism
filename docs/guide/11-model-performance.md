# Model Performance Guide

**Last Updated**: 2026-01-13
**Component**: Model Router / Performance Optimization
**Status**: Stable

## Overview

Choosing the right model isn't just about cost - it's also about speed, quality, and user experience. This guide compares model performance and helps you choose the best model for each task.

---

## Performance Benchmarks

### Speed Comparison (Average Latency)

| Model | Provider | Avg Latency | 95th Percentile | Best For |
|-------|----------|-------------|-----------------|----------|
| **Ollama** | Local | 500ms | 800ms | Offline, private |
| **Cloudflare** | Cloud | 300ms | 500ms | Fast cloud responses |
| **Haiku** | Anthropic | 200ms | 350ms | Speed-critical tasks |
| **Sonnet** | Anthropic | 400ms | 700ms | Balanced performance |
| **Opus** | Anthropic | 800ms | 1500ms | Quality-critical tasks |

### Quality Comparison (Task Success Rate)

| Model | Code Gen | Debugging | Explanation | Architecture |
|-------|----------|-----------|-------------|--------------|
| **Ollama (DeepSeek)** | 85% | 80% | 90% | 70% |
| **Cloudflare (Llama)** | 80% | 75% | 85% | 65% |
| **Haiku** | 90% | 85% | 95% | 75% |
| **Sonnet** | 95% | 92% | 98% | 90% |
| **Opus** | 98% | 97% | 99% | 95% |

### Resource Usage

| Model | Memory | CPU | GPU | Network |
|-------|--------|-----|-----|---------|
| **Ollama** | 16GB | High | Optional | None |
| **Cloudflare** | 0GB | None | None | Low |
| **Haiku** | 0GB | None | None | Low |
| **Sonnet** | 0GB | None | None | Medium |
| **Opus** | 0GB | None | None | Medium |

---

## When to Use Each Model

### Ollama (DeepSeek Coder V2)

**Best Use Cases:**
- Simple code explanations
- Basic debugging
- Syntax questions
- Offline development
- Privacy-sensitive work

**Strengths:**
- 100% free
- Works offline
- Private (local processing)
- Good for simple tasks

**Weaknesses:**
- Slower than cloud models
- Limited to simpler tasks
- Requires 16GB RAM
- Quality drops on complex tasks

**Example Tasks:**
```typescript
// Great for Ollama:
"Explain what this function does"
"How do I declare a variable in Rust?"
"What's the syntax for a for loop?"

// Not ideal for Ollama:
"Design a scalable microservice architecture"
"Optimize this 10,000-line codebase"
```

**Performance Profile:**
- Speed: 500ms average
- Quality: 80-90% on simple tasks
- Cost: $0

---

### Cloudflare Workers AI (Llama 3.1)

**Best Use Cases:**
- Medium complexity queries
- Batch processing
- Cloud workflows
- Cost-sensitive projects

**Strengths:**
- Free tier included
- Faster than Ollama
- No local setup
- Good quality for most tasks

**Weaknesses:**
- Requires Cloudflare account
- Requires internet
- Daily limits on free tier
- Not as smart as Claude

**Example Tasks:**
```typescript
// Great for Cloudflare:
"Create a basic REST API"
"Write unit tests for this function"
"Explain this error message"

// Not ideal for Cloudflare:
"Design a complex distributed system"
"Debug this race condition"
```

**Performance Profile:**
- Speed: 300ms average
- Quality: 75-85% on medium tasks
- Cost: $0 (free tier)

---

### Claude Haiku

**Best Use Cases:**
- Fast responses needed
- Simple to medium tasks
- Bulk operations
- Real-time applications

**Strengths:**
- Very fast (200ms)
- Inexpensive ($0.25/M input)
- 200K context window
- Good at following instructions

**Weaknesses:**
- Not as smart as Sonnet/Opus
- Can miss subtle issues
- May oversimplify complex problems

**Example Tasks:**
```typescript
// Great for Haiku:
"Summarize this code"
"What's the syntax for X?"
"Generate boilerplate code"
"Explain this error"

// Not ideal for Haiku:
"Optimize this algorithm"
"Design a complex system"
"Debug this race condition"
```

**Performance Profile:**
- Speed: 200ms average
- Quality: 85-95% on simple tasks
- Cost: $0.25/M input

---

### Claude Sonnet

**Best Use Cases:**
- Most development tasks
- Code generation
- Debugging
- General assistance

**Strengths:**
- Excellent balance of speed and quality
- Great at coding tasks
- 200K context window
- Good at following complex instructions

**Weaknesses:**
- More expensive than Haiku
- Slower than Haiku
- Overkill for simple tasks

**Example Tasks:**
```typescript
// Great for Sonnet:
"Generate a complete API endpoint"
"Debug this complex function"
"Refactor this code for better performance"
"Write tests for this module"

// Not ideal for Sonnet:
"What is a variable?" (use Haiku)
"Design a novel architecture" (use Opus)
```

**Performance Profile:**
- Speed: 400ms average
- Quality: 92-98% on most tasks
- Cost: $3/M input

---

### Claude Opus

**Best Use Cases:**
- Complex architecture
- Deep debugging
- Research tasks
- Critical systems

**Strengths:**
- Smartest model available
- Excellent at complex reasoning
- 200K context window
- Best for difficult problems

**Weaknesses:**
- Very expensive ($15/M input)
- Slower (800ms)
- Overkill for most tasks

**Example Tasks:**
```typescript
// Great for Opus:
"Design a scalable distributed system"
"Debug this complex race condition"
"Optimize this algorithm for performance"
"Analyze security vulnerabilities"

// Not ideal for Opus:
"What is a variable?" (use Haiku)
"Generate a simple function" (use Sonnet)
```

**Performance Profile:**
- Speed: 800ms average
- Quality: 95-99% on all tasks
- Cost: $15/M input

---

## Performance Optimization

### 1. Use Caching

Cache repeated queries for instant responses:

```yaml
# prism.config.yaml
cache:
  enabled: true
  ttl: 3600  # 1 hour
  max_size: 1000
```

**Impact:**
- 0ms latency for cached responses
- 10-30% of typical queries are repeats
- Works with all models

---

### 2. Parallel Requests

Process multiple queries concurrently:

```typescript
// Instead of sequential (slow):
const a = await prism.ask("Query A");
const b = await prism.ask("Query B");
const c = await prism.ask("Query C");
// Total time: 1.2s (3 × 400ms)

// Use parallel (fast):
const [a, b, c] = await Promise.all([
  prism.ask("Query A"),
  prism.ask("Query B"),
  prism.ask("Query C"),
]);
// Total time: 400ms (all complete together)
```

**Impact:**
- 3x faster for batch operations
- Better resource utilization
- Lower perceived latency

---

### 3. Streaming Responses

Stream responses for better UX:

```typescript
const stream = await prism.stream("Explain this code");

for await (const chunk of stream) {
  console.log(chunk);  // Display as it arrives
}
```

**Impact:**
- Perceived latency: ~100ms (first chunk)
- Actual latency: 400ms (complete)
- Better user experience

---

### 4. Reduce Token Count

Fewer tokens = faster responses:

```yaml
# prism.config.yaml
token_optimizer:
  enabled: true
  target_reduction: 0.50  # 50% fewer tokens
```

**Impact:**
- 50% faster processing
- 50% lower costs
- Better quality (focused context)

---

### 5. Use Appropriate Models

Match model to task complexity:

```typescript
// Simple task → Haiku (200ms)
const simple = await prism.ask("What is X?");

// Medium task → Sonnet (400ms)
const medium = await prism.ask("Generate function");

// Complex task → Opus (800ms)
const complex = await prism.ask("Design system");
```

**Impact:**
- Faster responses for simple tasks
- Lower costs
- Better resource utilization

---

## Performance Comparison by Task Type

### Code Generation

| Model | Speed | Quality | Cost | Best For |
|-------|-------|---------|------|----------|
| Ollama | 500ms | 85% | $0 | Simple functions |
| Cloudflare | 300ms | 80% | $0 | Basic code |
| Haiku | 200ms | 90% | $0.01 | Quick generation |
| Sonnet | 400ms | 95% | $0.03 | Most tasks |
| Opus | 800ms | 98% | $0.15 | Complex logic |

**Winner:** Sonnet (best balance)

**Recommendation:**
- Simple snippets: Haiku or Ollama
- Most work: Sonnet
- Complex algorithms: Opus

---

### Debugging

| Model | Speed | Quality | Cost | Best For |
|-------|-------|---------|------|----------|
| Ollama | 500ms | 80% | $0 | Simple bugs |
| Cloudflare | 300ms | 75% | $0 | Basic issues |
| Haiku | 200ms | 85% | $0.01 | Quick fixes |
| Sonnet | 400ms | 92% | $0.03 | Most bugs |
| Opus | 800ms | 97% | $0.15 | Complex issues |

**Winner:** Sonnet (best balance)

**Recommendation:**
- Simple errors: Haiku or Ollama
- Most debugging: Sonnet
- Race conditions, subtle bugs: Opus

---

### Explanations

| Model | Speed | Quality | Cost | Best For |
|-------|-------|---------|------|----------|
| Ollama | 500ms | 90% | $0 | Learning |
| Cloudflare | 300ms | 85% | $0 | Quick answers |
| Haiku | 200ms | 95% | $0.005 | Fast responses |
| Sonnet | 400ms | 98% | $0.02 | Detailed |
| Opus | 800ms | 99% | $0.10 | Deep dives |

**Winner:** Haiku (fastest with good quality)

**Recommendation:**
- Quick questions: Haiku
- Learning: Ollama or Sonnet
- Deep understanding: Opus

---

### Architecture Design

| Model | Speed | Quality | Cost | Best For |
|-------|-------|---------|------|----------|
| Ollama | 500ms | 70% | $0 | Simple systems |
| Cloudflare | 300ms | 65% | $0 | Basic design |
| Haiku | 200ms | 75% | $0.01 | Small projects |
| Sonnet | 400ms | 90% | $0.05 | Most systems |
| Opus | 800ms | 95% | $0.25 | Complex systems |

**Winner:** Opus (best quality for critical tasks)

**Recommendation:**
- Simple apps: Sonnet or Haiku
- Production systems: Sonnet
- Enterprise architecture: Opus

---

## Real-World Performance Examples

### Example 1: Simple Code Explanation

**Task:** "Explain what this function does"

```typescript
// Haiku (200ms, $0.0003)
"✓ Clear explanation, slightly simplified"

// Sonnet (400ms, $0.002)
"✓ Detailed explanation with context"

// Opus (800ms, $0.01)
"✓ Comprehensive explanation with examples"
```

**Recommendation:** Use Haiku for speed, Sonnet for detail.

---

### Example 2: Debugging Complex Issue

**Task:** "Find the race condition in this async code"

```typescript
// Haiku (200ms, $0.001)
"✗ Missed the subtle timing issue"

// Sonnet (400ms, $0.005)
"✓ Identified the problem and suggested fix"

// Opus (800ms, $0.02)
"✓✓ Found edge cases Sonnet missed"
```

**Recommendation:** Use Sonnet first, escalate to Opus if needed.

---

### Example 3: Architecture Design

**Task:** "Design a scalable payment processing system"

```typescript
// Haiku (200ms, $0.002)
"✗ Oversimplified, missed key requirements"

// Sonnet (400ms, $0.01)
"✓ Solid design with good considerations"

// Opus (800ms, $0.05)
"✓✓ Comprehensive with edge cases and trade-offs"
```

**Recommendation:** Use Opus for critical systems, Sonnet for most projects.

---

## Performance Monitoring

### Track Response Times

```bash
# View performance stats
prism stats performance

# Output:
# Average Latency: 385ms
# P95 Latency: 720ms
# P99 Latency: 1200ms
#
# By Model:
#   Ollama:      520ms avg (52 queries)
#   Cloudflare:  310ms avg (38 queries)
#   Haiku:       195ms avg (21 queries)
#   Sonnet:      410ms avg (14 queries)
#   Opus:        850ms avg (2 queries)
```

### Identify Slow Queries

```bash
# Find queries taking >1s
prism stats performance --slow

# Output:
# Slow Queries (>1000ms):
#   1. "Design distributed system" - 1520ms (Opus)
#   2. "Optimize database queries" - 1180ms (Sonnet)
#   3. "Explain microservices" - 1050ms (Ollama)
```

### Performance Optimization Tips

```bash
# Get optimization suggestions
prism doctor performance

# Output:
# Performance Recommendations:
# ✓ 52% of queries go to Ollama (good!)
# ⚠ Consider using Haiku for simple queries (faster)
# ⚠ 2 queries exceeded 1s (consider Opus for complex tasks)
# ✓ Token optimization enabled (50% reduction)
```

---

## Best Practices

### 1. Start Fast, Escalate as Needed

```typescript
// Try Haiku first (fast)
let answer = await prism.ask(complexQuery, {
  model: "anthropic:claude-3-haiku",
});

// If unsatisfactory, escalate to Sonnet
if (!isSatisfactory(answer)) {
  answer = await prism.ask(complexQuery, {
    model: "anthropic:claude-3.5-sonnet",
  });
}

// Final escalation to Opus
if (!isSatisfactory(answer)) {
  answer = await prism.ask(complexQuery, {
    model: "anthropic:claude-3-opus",
  });
}
```

### 2. Use Streaming for Better UX

```typescript
// Stream responses for perceived speed
const stream = await prism.stream(longQuery);

for await (const chunk of stream) {
  updateUI(chunk);  // Show progress
}
```

### 3. Batch Similar Queries

```typescript
// Process in parallel for speed
const results = await Promise.all(
  files.map(file => prism.ask(`Analyze ${file}`))
);
```

### 4. Cache When Possible

```typescript
// Enable caching for repeated queries
const answer = await prism.ask(question, {
  cache: true,  // Check cache first
});
```

---

## Performance Troubleshooting

### Issue: Slow Responses

**Symptoms:** Queries taking >2s

**Solutions:**

1. **Check model selection:**
   ```bash
   prism stats performance --by-model
   ```

2. **Use faster model:**
   ```typescript
   await prism.ask(query, {
     model: "anthropic:claude-3-haiku",  // Faster than Sonnet
   });
   ```

3. **Reduce token count:**
   ```yaml
   token_optimizer:
     enabled: true
     target_reduction: 0.70
   ```

4. **Check internet connection:**
   ```bash
   ping api.anthropic.com
   ```

---

### Issue: Poor Quality Responses

**Symptoms:** Incorrect or unhelpful answers

**Solutions:**

1. **Escalate to better model:**
   ```typescript
   await prism.ask(query, {
     model: "anthropic:claude-3-opus",  // Best quality
   });
   ```

2. **Provide more context:**
   ```typescript
   await prism.ask(query, {
     context: relevantCode,  // Add context
   });
   ```

3. **Adjust temperature:**
   ```typescript
   await prism.ask(query, {
     temperature: 0.3,  // Lower = more focused
   });
   ```

---

### Issue: High Latency on Ollama

**Symptoms:** Ollama taking >2s

**Solutions:**

1. **Check RAM usage:**
   ```bash
   free -h
   ```

2. **Use smaller model:**
   ```bash
   ollama pull codellama:7b  # Smaller than deepseek-coder-v2
   ```

3. **Enable GPU acceleration:**
   ```bash
   # Install GPU drivers
   # Ollama will auto-detect and use GPU
   ```

4. **Reduce context size:**
   ```typescript
   await prism.ask(query, {
     maxTokens: 1000,  # Reduce from default
   });
   ```

---

## Next Steps

- **Setup Ollama** - See [Ollama Setup Guide](./09-ollama-setup.md)
- **Understand Routing** - See [Model Routing Guide](./08-model-routing.md)
- **Analyze Costs** - See [Cost Analysis](./10-cost-analysis.md)
- **Architecture Details** - See [Model Router Architecture](../architecture/06-model-router-architecture.md)
