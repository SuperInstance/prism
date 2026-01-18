# Model Router Architecture

**Last Updated**: 2026-01-13
**Component**: Model Router
**Status**: Stable

## Overview

The Model Router is Prism's intelligent traffic cop for AI requests. It analyzes each query and automatically routes it to the most appropriate model based on token count, query complexity, cost considerations, and availability.

## Purpose

The Model Router exists to:

1. **Minimize Costs** - Route to free/cheap models when possible
2. **Optimize Performance** - Balance speed and quality
3. **Ensure Reliability** - Fallback when services are unavailable
4. **Maximize Quality** - Use the best model for the task

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Request Flow                          │
└─────────────────────────────────────────────────────────────┘

  User Query
      │
      ▼
┌───────────────────────────────────────────────────────────┐
│  1. Request Analyzer                                       │
│     ├─ Count tokens (tokenizer)                           │
│     ├─ Calculate complexity (keyword analysis)            │
│     └─ Estimate cost (pricing model)                      │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────┐
│  2. Model Selector (Decision Engine)                      │
│     ├─ Check Ollama availability                          │
│     ├─ Check Cloudflare availability                      │
│     ├─ Check budget limits                                │
│     ├─ Apply routing rules                                │
│     └─ Select optimal model                               │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────┐
│  3. Request Formatter                                     │
│     ├─ Format for Ollama API                             │
│     ├─ Format for Anthropic API                          │
│     ├─ Format for Cloudflare API                         │
│     └─ Apply model-specific options                      │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────┐
│  4. Request Executor                                      │
│     ├─ Route to Ollama (HTTP, localhost)                 │
│     ├─ Route to Cloudflare (HTTP, API)                   │
│     └─ Route to Anthropic (HTTP, API)                    │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────┐
│  5. Response Handler                                      │
│     ├─ Parse response format                             │
│     ├─ Extract tokens used                               │
│     ├─ Calculate actual cost                             │
│     ├─ Measure duration                                  │
│     └─ Update budget tracking                            │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
                    Return to User
```

---

## Decision Tree

### Complete Routing Logic

```
START: selectModel(tokens, complexity)
  │
  ├─ Normalize complexity to [0, 1]
  │
  ├─ PRIORITY 1: Ollama (Free, Local)
  │  ├─ Is Ollama available?
  │  │  ├─ YES → Is tokens < 8000?
  │  │  │        ├─ YES → Is complexity < 0.6?
  │  │  │        │        ├─ YES → USE OLLAMA ✓
  │  │  │        │        └─ NO  → Continue to Priority 2
  │  │  │        └─ NO  → Continue to Priority 2
  │  │  └─ NO  → Continue to Priority 2
  │
  ├─ PRIORITY 2: Cloudflare (Free, Cloud)
  │  ├─ Is Cloudflare configured?
  │  │  ├─ YES → Is tokens < 50000?
  │  │  │        ├─ YES → Is complexity < 0.7?
  │  │  │        │        ├─ YES → USE CLOUDFLARE ✓
  │  │  │        │        └─ NO  → Continue to Priority 3
  │  │  │        └─ NO  → Continue to Priority 3
  │  │  └─ NO  → Continue to Priority 3
  │
  ├─ PRIORITY 3: Claude Haiku (Cheap)
  │  ├─ Is tokens < 50000?
  │  │  ├─ YES → Is complexity < 0.6?
  │  │  │        ├─ YES → Is budget available?
  │  │  │        │        ├─ YES → USE HAIKU ✓
  │  │  │        │        └─ NO  → Alert + Fallback
  │  │  │        └─ NO  → Continue to Priority 4
  │  │  └─ NO  → Continue to Priority 4
  │
  ├─ PRIORITY 4: Claude Sonnet (Balanced)
  │  ├─ Is tokens < 100000?
  │  │  ├─ YES → Is budget available?
  │  │  │        ├─ YES → USE SONNET ✓
  │  │  │        └─ NO  → Alert + Fallback
  │  │  └─ NO  → Continue to Priority 5
  │
  └─ PRIORITY 5: Claude Opus (Premium)
     ├─ Is budget available?
     │  ├─ YES → USE OPUS ✓
     │  └─ NO  → Alert + Error
```

---

## Data Flow

### 1. Request Analysis

```typescript
interface AIRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

// Step 1: Count tokens
const tokens = tokenizer.count(request.prompt);

// Step 2: Calculate complexity
const complexity = analyzer.calculateComplexity(request.prompt);

// Step 3: Estimate cost (for each model)
const costs = {
  ollama: estimateCost(tokens, MODELS.ollama),
  cloudflare: estimateCost(tokens, MODELS.cloudflare),
  haiku: estimateCost(tokens, MODELS.haiku),
  sonnet: estimateCost(tokens, MODELS.sonnet),
  opus: estimateCost(tokens, MODELS.opus),
};
```

### 2. Model Selection

```typescript
interface ModelChoice {
  model: string;           // Model identifier
  provider: 'ollama' | 'cloudflare' | 'anthropic';
  reason: string;          // Why this model was chosen
  estimatedCost: number;   // Estimated cost in USD
}

function selectModel(tokens: number, complexity: number): ModelChoice {
  // Apply decision tree
  // Return selected model with reasoning
}
```

### 3. Request Formatting

```typescript
// Format for Ollama
interface OllamaRequest {
  model: string;
  prompt: string;
  stream: boolean;
  options: {
    temperature: number;
    num_predict: number;
    stop: string[];
  };
}

// Format for Anthropic
interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  stop_sequences: string[];
}

// Format for Cloudflare
interface CloudflareRequest {
  prompt: string;
  max_tokens: number;
  temperature: number;
  stop: string[];
}
```

### 4. Response Handling

```typescript
interface AIResponse {
  text: string;            // Response text
  tokensUsed: number;      // Actual tokens consumed
  cost: number;            // Actual cost in USD
  model: string;           // Model used
  duration: number;        // Response time in ms
}

// Parse response based on provider
// Extract usage information
// Calculate actual cost
// Track metrics
```

---

## Interfaces

### IModelRouter

```typescript
interface IModelRouter {
  /**
   * Select the best model for a request
   *
   * @param tokens - Estimated token count
   * @param complexity - Query complexity score (0-1)
   * @returns Selected model with reasoning
   */
  selectModel(tokens: number, complexity: number): ModelChoice;

  /**
   * Route a request to Ollama
   *
   * @param request - AI request to process
   * @returns AI response from Ollama
   */
  routeToOllama(request: AIRequest): Promise<AIResponse>;

  /**
   * Route a request to Claude
   *
   * @param request - AI request to process
   * @returns AI response from Claude
   */
  routeToClaude(request: AIRequest): Promise<AIResponse>;

  /**
   * Route a request to Cloudflare
   *
   * @param request - AI request to process
   * @returns AI response from Cloudflare
   */
  routeToCloudflare(request: AIRequest): Promise<AIResponse>;

  /**
   * Check if a model is available
   *
   * @param model - Model identifier
   * @returns True if model is available
   */
  isAvailable(model: string): Promise<boolean>;

  /**
   * Get complexity score for a query
   *
   * @param query - Query text
   * @returns Complexity score from 0 to 1
   */
  getComplexity(query: string): number;
}
```

### ModelSpec

```typescript
interface ModelSpec {
  /** Model identifier */
  id: string;

  /** Provider hosting the model */
  provider: 'ollama' | 'cloudflare' | 'anthropic';

  /** Maximum context window in tokens */
  maxTokens: number;

  /** Input price per million tokens (USD) */
  inputPrice: number;

  /** Output price per million tokens (USD) */
  outputPrice: number;

  /** Minimum recommended complexity (0-1) */
  minComplexity: number;

  /** Maximum recommended complexity (0-1) */
  maxComplexity: number;

  /** Average latency in milliseconds */
  avgLatency: number;
}
```

---

## Algorithms

### Complexity Calculation

```typescript
function calculateComplexity(query: string): number {
  let complexity = 0;
  const lowerQuery = query.toLowerCase();

  // High-complexity keywords (+0.15 each)
  const highKeywords = [
    'architecture', 'design pattern', 'refactor',
    'optimize', 'security', 'performance',
  ];
  complexity += countMatches(lowerQuery, highKeywords) * 0.15;

  // Medium-complexity keywords (+0.08 each)
  const mediumKeywords = [
    'function', 'class', 'component',
    'api', 'endpoint', 'database',
  ];
  complexity += countMatches(lowerQuery, mediumKeywords) * 0.08;

  // Low-complexity keywords (-0.05 each)
  const lowKeywords = [
    'what is', 'how to', 'explain',
    'example', 'syntax', 'basic',
  ];
  complexity -= countMatches(lowerQuery, lowKeywords) * 0.05;

  // Query length factor (max +0.2)
  complexity += Math.min(query.length / 500, 1) * 0.2;

  // Code patterns (+0.1)
  if (/\b(function|class|async|await)\b/i.test(query)) {
    complexity += 0.1;
  }

  // Normalize to [0, 1]
  return Math.max(0, Math.min(1, complexity));
}
```

### Cost Estimation

```typescript
function estimateCost(tokens: number, spec: ModelSpec): number {
  // Assume 70% input, 30% output
  const inputTokens = tokens * 0.7;
  const outputTokens = tokens * 0.3;

  // Calculate cost
  const inputCost = (inputTokens / 1_000_000) * spec.inputPrice;
  const outputCost = (outputTokens / 1_000_000) * spec.outputPrice;

  return inputCost + outputCost;
}
```

### Availability Check

```typescript
async function isAvailable(model: string): Promise<boolean> {
  const spec = MODELS[model];

  switch (spec.provider) {
    case 'ollama':
      try {
        const response = await fetch(`${ollamaUrl}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });
        const data = await response.json();
        return data.models?.some((m: { name: string }) =>
          m.name.includes(spec.id)
        );
      } catch {
        return false;
      }

    case 'anthropic':
      return !!anthropicApiKey;

    case 'cloudflare':
      return !!(cloudflareAccountId && cloudflareApiToken);

    default:
      return false;
  }
}
```

---

## Model Specifications

### Ollama Models

```typescript
const OLLAMA_MODELS: Record<string, ModelSpec> = {
  'ollama:deepseek-coder-v2': {
    id: 'deepseek-coder-v2',
    provider: 'ollama',
    maxTokens: 16000,
    inputPrice: 0,
    outputPrice: 0,
    minComplexity: 0.0,
    maxComplexity: 0.6,
    avgLatency: 500,
  },
  'ollama:codellama': {
    id: 'codellama',
    provider: 'ollama',
    maxTokens: 16000,
    inputPrice: 0,
    outputPrice: 0,
    minComplexity: 0.0,
    maxComplexity: 0.5,
    avgLatency: 600,
  },
};
```

### Cloudflare Models

```typescript
const CLOUDFLARE_MODELS: Record<string, ModelSpec> = {
  'cloudflare:@cf/meta/llama-3.1-8b-instruct': {
    id: '@cf/meta/llama-3.1-8b-instruct',
    provider: 'cloudflare',
    maxTokens: 128000,
    inputPrice: 0,
    outputPrice: 0,
    minComplexity: 0.0,
    maxComplexity: 0.6,
    avgLatency: 300,
  },
  'cloudflare:@cf/mistral/mistral-7b-instruct-v0.2': {
    id: '@cf/mistral/mistral-7b-instruct-v0.2',
    provider: 'cloudflare',
    maxTokens: 32000,
    inputPrice: 0,
    outputPrice: 0,
    minComplexity: 0.0,
    maxComplexity: 0.7,
    avgLatency: 400,
  },
};
```

### Anthropic Models

```typescript
const ANTHROPIC_MODELS: Record<string, ModelSpec> = {
  'anthropic:claude-3-haiku': {
    id: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    maxTokens: 200000,
    inputPrice: 0.25,
    outputPrice: 1.25,
    minComplexity: 0.0,
    maxComplexity: 0.6,
    avgLatency: 200,
  },
  'anthropic:claude-3.5-sonnet': {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    maxTokens: 200000,
    inputPrice: 3.0,
    outputPrice: 15.0,
    minComplexity: 0.4,
    maxComplexity: 0.9,
    avgLatency: 400,
  },
  'anthropic:claude-3-opus': {
    id: 'claude-3-opus-20240229',
    provider: 'anthropic',
    maxTokens: 200000,
    inputPrice: 15.0,
    outputPrice: 75.0,
    minComplexity: 0.7,
    maxComplexity: 1.0,
    avgLatency: 800,
  },
};
```

---

## Error Handling

### Error Scenarios

```typescript
// 1. Model unavailable
if (!(await isAvailable(selectedModel))) {
  // Fallback to next best model
  // Or error if no alternatives
}

// 2. Budget exceeded
if (currentCost > dailyBudget) {
  // Alert user
  // Block request or fallback to free models
}

// 3. Request timeout
if (duration > timeout) {
  // Retry with backup model
  // Or return partial result
}

// 4. API error
if (response.status === 429) {
  // Rate limited - wait and retry
  // Or fallback to different provider
}
```

### Fallback Strategy

```
Primary Model Fails
  │
  ├─ Is there a free alternative?
  │  ├─ YES → Use Ollama or Cloudflare
  │  └─ NO  → Continue
  │
  ├─ Is there a cheaper model?
  │  ├─ YES → Use Haiku instead of Sonnet
  │  └─ NO  → Continue
  │
  └─ Return error with suggestions
```

---

## Performance Considerations

### Latency Sources

1. **Token Counting**: ~10ms (local)
2. **Complexity Analysis**: ~5ms (local)
3. **Model Selection**: ~1ms (local)
4. **Request Formatting**: ~5ms (local)
5. **Network Latency**:
   - Ollama: 0ms (local)
   - Cloudflare: ~100ms
   - Anthropic: ~200ms
6. **Model Inference**:
   - Ollama: ~500ms (CPU-bound)
   - Cloudflare: ~200ms
   - Haiku: ~200ms
   - Sonnet: ~400ms
   - Opus: ~800ms

### Optimization Strategies

1. **Cache Model Availability**: Check once per session
2. **Parallel Availability Checks**: Check all providers simultaneously
3. **Pre-compute Complexity**: Cache complexity for repeated queries
4. **Batch Requests**: Process multiple queries together
5. **Stream Responses**: Return partial results for better UX

---

## Testing Strategy

### Unit Tests

```typescript
describe('ModelRouter', () => {
  it('should select Ollama for small, simple requests', () => {
    const choice = router.selectModel(1000, 0.3);
    expect(choice.provider).toBe('ollama');
  });

  it('should select Sonnet for medium complexity', () => {
    const choice = router.selectModel(50000, 0.7);
    expect(choice.provider).toBe('anthropic');
    expect(choice.model).toBe('claude-3-5-sonnet-20241022');
  });

  it('should calculate complexity correctly', () => {
    const complexity = router.getComplexity('design architecture');
    expect(complexity).toBeGreaterThan(0.5);
  });
});
```

### Integration Tests

```typescript
describe('ModelRouter Integration', () => {
  it('should successfully route to Ollama', async () => {
    const response = await router.routeToOllama({
      prompt: 'What is a function?',
      maxTokens: 100,
    });
    expect(response.text).toBeDefined();
    expect(response.cost).toBe(0);
  });

  it('should fallback on error', async () => {
    // Mock Ollama failure
    const response = await router.routeToOllama({
      prompt: 'Test',
      maxTokens: 100,
    });
    // Should fallback to Cloudflare or Haiku
  });
});
```

### Performance Tests

```typescript
describe('ModelRouter Performance', () => {
  it('should select model in <10ms', () => {
    const start = performance.now();
    router.selectModel(10000, 0.5);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10);
  });

  it('should calculate complexity in <5ms', () => {
    const start = performance.now();
    router.getComplexity('design scalable architecture');
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(5);
  });
});
```

---

## Configuration

### Environment Variables

```bash
# Ollama
PRISM_OLLAMA_URL="http://localhost:11434"
PRISM_OLLAMA_TIMEOUT="30000"

# Anthropic
ANTHROPIC_API_KEY="sk-ant-..."

# Cloudflare
CLOUDFLARE_ACCOUNT_ID="..."
CLOUDFLARE_API_TOKEN="..."
```

### Config File

```yaml
# prism.config.yaml
router:
  # Model preferences
  preferLocal: true
  defaultModel: "anthropic:claude-3.5-sonnet"

  # Complexity thresholds
  complexity:
    ollama: 0.6
    cloudflare: 0.7
    haiku: 0.6
    sonnet: 1.0
    opus: 0.9

  # Budget limits
  daily_budget: 10.00
  alert_threshold: 0.80

  # Fallback behavior
  fallback: true
  fallbackOnError: true
```

---

## Monitoring & Observability

### Metrics to Track

1. **Model Selection Distribution**
   - How often each model is chosen
   - Reasons for selection
   - Fallback rate

2. **Cost Tracking**
   - Per-model costs
   - Daily/weekly/monthly totals
   - Cost vs. budget

3. **Performance Metrics**
   - Response time by model
   - Token usage
   - Error rate

4. **Quality Metrics**
   - User satisfaction
   - Response relevance
   - Error correction rate

### Logging

```typescript
// Log routing decisions
logger.info('Model selected', {
  model: choice.model,
  provider: choice.provider,
  tokens,
  complexity,
  reason: choice.reason,
  estimatedCost: choice.estimatedCost,
});

// Log API calls
logger.info('API request', {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet',
  tokensIn: usage.input_tokens,
  tokensOut: usage.output_tokens,
  cost: response.cost,
  duration: response.duration,
});
```

---

## Future Enhancements

### Planned Features

1. **Learning System**
   - Track user preferences
   - Learn from feedback
   - Optimize routing over time

2. **A/B Testing**
   - Test different models for same query
   - Compare quality and cost
   - Optimize selection

3. **Custom Models**
   - Support for user-deployed models
   - Fine-tuned models
   - Domain-specific models

4. **Advanced Fallback**
   - Automatic retry with different models
   - Quality-based escalation
   - Cost-based de-escalation

5. **Budget Optimization**
   - Predictive cost analysis
   - Query batching
   - Off-peak processing

---

## References

- **Implementation**: `/home/eileen/projects/claudes-friend/src/model-router/ModelRouter.ts`
- **Tests**: `/home/eileen/projects/claudes-friend/tests/unit/model-router/ModelRouter.test.ts`
- **User Guide**: `/home/eileen/projects/claudes-friend/docs/guide/08-model-routing.md`
- **Ollama Setup**: `/home/eileen/projects/claudes-friend/docs/guide/09-ollama-setup.md`
- **Cost Analysis**: `/home/eileen/projects/claudes-friend/docs/guide/10-cost-analysis.md`
- **Performance**: `/home/eileen/projects/claudes-friend/docs/guide/11-model-performance.md`
