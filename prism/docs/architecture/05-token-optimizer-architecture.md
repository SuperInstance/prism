# Token Optimizer Architecture

**Component**: Token Optimizer
**Status**: Core Algorithm
**Priority**: Critical for MVP
**Version**: 1.0.0
**Last Updated**: 2025-01-13

## Purpose

Transform massive codebases (millions of tokens) into minimal, relevant context that fits within Claude's token window while preserving semantic meaning.

**The Problem**: Traditional Claude Code sends entire files/repos as context, quickly hitting the 200K token limit.

**The Solution**: Intelligently compress context by 10-100x using semantic relevance, code analysis, and adaptive compression.

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INPUT                                         │
│  - Query: string                                                        │
│  - Codebase: CodeChunk[] (50,000+ chunks)                               │
│  - Budget: number (tokens)                                              │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 1: Intent Detection                                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ detectIntent(query, history) → QueryIntent                        │  │
│  │                                                                   │  │
│  │ 1. Generate query embedding                                       │  │
│  │ 2. Classify intent type (bug_fix, feature_add, etc)              │  │
│  │ 3. Extract entities (files, symbols, types)                       │  │
│  │ 4. Determine scope (single_file, multi_file, repo_wide)          │  │
│  │ 5. Estimate complexity (0.0 - 1.0)                                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 2: Semantic Search & Retrieval                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ retrieveRelevantCode(intent, codebase) → ScoredChunk[]           │  │
│  │                                                                   │  │
│  │ Hop 1: Vector Search                                              │  │
│  │   └─> vectorDB.search(embedding, top_k=20)                       │  │
│  │                                                                   │  │
│  │ Hop 2: Expand to Related Files                                    │  │
│  │   └─> findRelatedFiles(results) → imports/dependencies           │  │
│  │                                                                   │  │
│  │ Hop 3: Symbol Definitions                                         │  │
│  │   └─> findSymbolDefinitions(entities) → type definitions          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 3: Relevance Scoring                                             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ scoreRelevance(chunk, intent, context) → number (0-1)            │  │
│  │                                                                   │  │
│  │ Features:                                                         │  │
│  │  1. Semantic similarity (40%)    → cosine_similarity(embeddings) │  │
│  │  2. Symbol match (25%)           → Jaccard_similarity(symbols)   │  │
│  │  3. File proximity (20%)         → distance metric               │  │
│  │  4. Recency (10%)                → decay_function(days)          │  │
│  │  5. Usage frequency (5%)         → normalize(helpful_count)      │  │
│  │                                                                   │  │
│  │ Score = Σ(feature_i × weight_i)                                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 4: Budget-Constrained Selection                                  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ selectChunksWithinBudget(chunks, budget) → ScoredChunk[]         │  │
│  │                                                                   │  │
│  │ 1. Filter by min_relevance                                        │  │
│  │ 2. Sort by score density (score / tokens)                         │  │
│  │ 3. Greedy selection:                                              │  │
│  │    while spent + cost ≤ budget:                                   │  │
│  │      selected.append(highest_density_chunk)                       │  │
│  │      spent += chunk.tokens                                        │  │
│  │ 4. Optimize selection (swap if better combination exists)         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 5: Adaptive Compression                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ compressChunk(chunk, level) → CompressedChunk                    │  │
│  │                                                                   │  │
│  │ Light:    Remove comments (15% reduction)                        │  │
│  │ Medium:   Remove comments + collapse whitespace (40% reduction)  │  │
│  │ Aggressive: Signatures only (75% reduction)                      │  │
│  │                                                                   │  │
│  │ Add metadata header:                                              │  │
│  │   // file:lines | kind: name | reduction %                       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 6: Model Selection                                               │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ selectModel(tokens, complexity, ollamaAvailable) → ModelChoice   │  │
│  │                                                                   │  │
│  │ if ollama && tokens < 8000 && complexity < 0.6:                  │  │
│  │   → ollama:deepseek-coder-v2 (free)                              │  │
│  │                                                                   │  │
│  │ if tokens < 20000 && complexity < 0.4:                           │  │
│  │   → claude-3-haiku ($0.25/M)                                     │  │
│  │                                                                   │  │
│  │ if tokens < 100000 || complexity < 0.8:                          │  │
│  │   → claude-3.5-sonnet ($3/M)                                     │  │
│  │                                                                   │  │
│  │ else:                                                             │  │
│  │   → claude-3-opus ($15/M)                                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 7: Prompt Reconstruction                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ reconstructPrompt(query, chunks, intent) → string                │  │
│  │                                                                   │  │
│  │ 1. Group chunks by file                                           │  │
│  │ 2. Build context section:                                         │  │
│  │    // RELEVANT CODE CONTEXT                                       │  │
│  │    // File: path/to/file.ts                                       │  │
│  │    [compressed chunks]                                            │  │
│  │ 3. Add system prompt                                              │  │
│  │ 4. Append user query                                              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           OUTPUT                                        │
│  - prompt: string (optimized, ~2,000-50,000 tokens)                     │
│  - tokens: number                                                       │
│  - model: string                                                        │
│  - savings: { tokens_saved, percentage, cost_saved }                    │
│  - chunks_used: number                                                 │
│  - confidence: number (0-1)                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Structures

### QueryIntent

```typescript
interface QueryIntent {
  // Classification
  type: IntentType;

  // Query
  query: string;
  embedding: number[];  // Query vector

  // Extracted entities
  entities: Entity[];

  // Scope
  scope: SearchScope;

  // Complexity (0.0 = simple, 1.0 = complex)
  complexity: number;

  // Whether conversation history is needed
  requires_history: boolean;
}

type IntentType =
  | 'bug_fix'      // Fix errors, problems
  | 'feature_add'  // Add new functionality
  | 'explain'      // Explain how something works
  | 'refactor'     // Improve code quality
  | 'test'         // Write/generate tests
  | 'debug'        // Investigate issues;

type SearchScope =
  | 'single_file'   // Focus on one file
  | 'multi_file'    // Span multiple files
  | 'repo_wide';    // Entire repository

interface Entity {
  name: string;
  type: 'file' | 'symbol' | 'type' | 'pattern';
  confidence: number;
}
```

### ScoredChunk

```typescript
interface ScoredChunk extends CodeChunk {
  // Relevance score (0-1)
  relevance_score: number;

  // Estimated token count
  estimated_tokens: number;

  // Score components (for debugging)
  score_breakdown: {
    semantic: number;
    symbol_match: number;
    file_proximity: number;
    recency: number;
    usage_frequency: number;
  };

  // Where this chunk came from
  source: 'vector_search' | 'related_files' | 'symbol_definition';
}
```

### CompressedChunk

```typescript
interface CompressedChunk extends ScoredChunk {
  // Compressed content
  content: string;

  // Token counts
  tokens: number;              // After compression
  original_tokens: number;     // Before compression

  // Compression metrics
  compression_ratio: number;   // tokens / original_tokens
  compression_method: 'light' | 'medium' | 'aggressive';

  // Quality score (0-1)
  quality_score: number;
}
```

### OptimizedPrompt

```typescript
interface OptimizedPrompt {
  // Final prompt to send to LLM
  prompt: string;

  // Token counts
  tokens: number;
  original_tokens: number;

  // Model selection
  model: string;
  model_reasoning: string;

  // Savings metrics
  savings: {
    tokens_saved: number;
    percentage: number;
    cost_saved: number;
  };

  // Selection metrics
  chunks_used: number;
  chunks_considered: number;

  // Confidence (0-1)
  confidence: number;

  // Warnings (if any)
  warnings?: string[];
}
```

### SelectionContext

```typescript
interface SelectionContext {
  // Recently edited files
  recent_files: string[];

  // Usage history
  usage_history: Map<string, number>;  // chunk_id → helpful_count

  // Current working directory
  cwd: string;

  // Git branch
  branch: string;

  // Preferred language
  preferred_language?: string;
}
```

## Algorithms

### Intent Detection

```typescript
async function detectIntent(
  query: string,
  history: Message[],
  context: SelectionContext
): Promise<QueryIntent> {

  // Step 1: Generate embedding
  const embedding = await generateEmbedding(
    query + ' ' +
    history.slice(-3).map(m => m.content).join('\n')
  );

  // Step 2: Classify intent type
  const type = classifyIntent(query);
  function classifyIntent(query: string): IntentType {
    const patterns = {
      bug_fix: /\b(fix|bug|error|not working|broken|fail)\b/i,
      feature_add: /\b(add|create|implement|build|new)\b/i,
      explain: /\b(how|what|why|explain|describe)\b/i,
      refactor: /\b(refactor|optimize|clean|improve)\b/i,
      test: /\b(test|spec|coverage|mock)\b/i,
      debug: /\b(debug|trace|investigate)\b/i,
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(query)) return type as IntentType;
    }
    return 'explain';  // Default
  }

  // Step 3: Extract entities
  const entities = extractEntities(query);
  function extractEntities(query: string): Entity[] {
    const entities: Entity[] = [];

    // File paths
    const fileMatches = query.match(/\b[\w/]+\.(ts|js|py|rs|go)\b/g);
    if (fileMatches) {
      entities.push(...fileMatches.map(f => ({
        name: f,
        type: 'file' as const,
        confidence: 0.9
      })));
    }

    // Symbols (camelCase or snake_case)
    const symbolMatches = query.match(/\b[a-z][a-z0-9]*([A-Z][a-z0-9]*)+\b/g);
    if (symbolMatches) {
      entities.push(...symbolMatches.map(s => ({
        name: s,
        type: 'symbol' as const,
        confidence: 0.7
      })));
    }

    return entities;
  }

  // Step 4: Determine scope
  const scope = determineScope(type, entities, context);
  function determineScope(
    type: IntentType,
    entities: Entity[],
    context: SelectionContext
  ): SearchScope {
    // Single file if explicitly mentioned
    if (entities.some(e => e.type === 'file' && e.confidence > 0.8)) {
      return 'single_file';
    }

    // Repo-wide for explain queries
    if (type === 'explain') {
      return 'repo_wide';
    }

    // Multi-file for bug fixes, feature adds
    return 'multi_file';
  }

  // Step 5: Estimate complexity
  const complexity = calculateComplexity(query, type, history);
  function calculateComplexity(
    query: string,
    type: IntentType,
    history: Message[]
  ): number {
    let complexity = 0.5;  // Base

    // Intent type
    const intentComplexity = {
      bug_fix: 0.5,
      feature_add: 0.6,
      explain: 0.3,
      refactor: 0.7,
      test: 0.4,
      debug: 0.6,
    };
    complexity += intentComplexity[type] - 0.5;

    // Query length
    complexity += Math.min(0.2, query.length / 1000);

    // Conversation depth
    complexity += Math.min(0.2, history.length / 20);

    // Keywords
    if (/\b(architecture|design|system|rethink)\b/i.test(query)) {
      complexity += 0.2;
    }

    return Math.max(0, Math.min(1, complexity));
  }

  return {
    type,
    query,
    embedding,
    entities,
    scope,
    complexity,
    requires_history: type === 'debug' || history.length > 3
  };
}
```

### Relevance Scoring

```typescript
function scoreRelevance(
  chunk: CodeChunk,
  intent: QueryIntent,
  context: SelectionContext,
  weights: ScoringWeights
): number {

  // Feature 1: Semantic similarity
  const semantic = chunk.embedding
    ? cosine_similarity(intent.embedding, chunk.embedding)
    : 0;

  // Feature 2: Symbol matching
  const symbol_match = calculateSymbolMatch(chunk, intent.entities);
  function calculateSymbolMatch(
    chunk: CodeChunk,
    entities: Entity[]
  ): number {
    const chunkSymbols = new Set([
      chunk.name,
      ...chunk.metadata?.exports || [],
      ...chunk.metadata?.imports || []
    ]);

    const entitySymbols = new Set(
      entities
        .filter(e => e.type === 'symbol')
        .map(e => e.name)
    );

    if (entitySymbols.size === 0) return 0;

    const intersection = new Set(
      [...chunkSymbols].filter(x => entitySymbols.has(x))
    );

    return intersection.size / entitySymbols.size;
  }

  // Feature 3: File proximity
  const file_proximity = calculateFileProximity(chunk, intent.entities, context);
  function calculateFileProximity(
    chunk: CodeChunk,
    entities: Entity[],
    context: SelectionContext
  ): number {
    // Same file (if entity is a file)
    if (entities.some(e =>
      e.type === 'file' &&
      chunk.file_path.includes(e.name)
    )) {
      return 1.0;
    }

    // Same directory
    if (entities.some(e =>
      e.type === 'file' &&
      path.dirname(chunk.file_path) === path.dirname(e.name)
    )) {
      return 0.7;
    }

    // Same directory as CWD
    if (chunk.file_path.startsWith(context.cwd)) {
      return 0.5;
    }

    return 0.3;
  }

  // Feature 4: Recency
  const recency = calculateRecency(chunk, context);
  function calculateRecency(
    chunk: CodeChunk,
    context: SelectionContext
  ): number {
    const days_ago = (chunk.metadata?.modified_at)
      ? (Date.now() - chunk.metadata.modified_at) / (1000 * 60 * 60 * 24)
      : 365;

    // Exponential decay with 30-day half-life
    return Math.exp(-days_ago / 30);
  }

  // Feature 5: Usage frequency
  const frequency = context.usage_history.get(chunk.id) || 0;
  const usage_frequency = Math.min(1.0, frequency / 10);

  // Weighted sum
  const score =
    semantic * weights.semantic +
    symbol_match * weights.symbol_match +
    file_proximity * weights.file_proximity +
    recency * weights.recency +
    usage_frequency * weights.usage_frequency;

  return Math.max(0, Math.min(1, score));
}
```

### Budget-Constrained Selection

```typescript
function selectChunksWithinBudget(
  chunks: ScoredChunk[],
  budget: number,
  min_relevance: number = 0.5
): ScoredChunk[] {

  // Filter by minimum relevance
  let candidates = chunks.filter(c => c.relevance_score >= min_relevance);

  if (candidates.length === 0) {
    // Fallback: return top chunks even if below threshold
    candidates = chunks.slice(0, 5);
  }

  // Sort by score density (score / token_cost)
  candidates.sort((a, b) =>
    (b.relevance_score / b.estimated_tokens) -
    (a.relevance_score / a.estimated_tokens)
  );

  // Greedy selection
  const selected: ScoredChunk[] = [];
  let spent = 0;

  for (const chunk of candidates) {
    const cost = chunk.estimated_tokens;

    if (spent + cost <= budget) {
      selected.push(chunk);
      spent += cost;
    } else if (spent + cost <= budget * 1.1) {
      // Allow 10% overage for high-value chunks
      if (chunk.relevance_score > 0.8) {
        selected.push(chunk);
        spent += cost;
      }
    }

    if (spent >= budget * 0.95) break;
  }

  // Optimize: try to swap for better combinations
  return optimizeSelection(selected, candidates, budget);
}

function optimizeSelection(
  selected: ScoredChunk[],
  candidates: ScoredChunk[],
  budget: number
): ScoredChunk[] {

  // Try swapping each selected chunk with a non-selected one
  let improved = true;
  while (improved) {
    improved = false;

    for (let i = 0; i < selected.length; i++) {
      for (const candidate of candidates) {
        if (selected.includes(candidate)) continue;

        const current_tokens = selected.reduce((sum, c) => sum + c.estimated_tokens, 0);
        const new_tokens = current_tokens
          - selected[i].estimated_tokens
          + candidate.estimated_tokens;

        if (new_tokens <= budget &&
            candidate.relevance_score > selected[i].relevance_score) {
          selected[i] = candidate;
          improved = true;
        }
      }
    }
  }

  return selected;
}
```

### Adaptive Compression

```typescript
function compressChunk(
  chunk: CodeChunk,
  level: 'light' | 'medium' | 'aggressive'
): CompressedChunk {

  const original_tokens = estimateTokens(chunk.content);
  let compressed = chunk.content;

  // Level 1: Remove comments (all levels except 'none')
  if (level !== 'none') {
    compressed = compressed
      .replace(/\/\*[\s\S]*?\*\//g, '')  // Block comments
      .replace(/\/\/.*/g, '')              // Line comments
      .replace(/#.*/g, '')                 // Python comments
      .trim();
  }

  // Level 2: Collapse whitespace (medium and aggressive)
  if (level === 'medium' || level === 'aggressive') {
    compressed = compressed.replace(/\s+/g, ' ');
  }

  // Level 3: Signatures only (aggressive)
  if (level === 'aggressive') {
    const lines = compressed.split('\n');
    const signature = lines[0];

    // Keep first and last few lines of body
    const body_lines = lines.slice(1);
    const n = Math.min(3, body_lines.length / 2);

    const key_lines = [
      ...body_lines.slice(0, n),
      ...body_lines.slice(-n)
    ];

    compressed = signature + '\n' + key_lines.join('\n');
  }

  // Add metadata header
  const header = `// ${chunk.file_path}:${chunk.start_line}-${chunk.end_line}\n` +
    `// ${chunk.kind}: ${chunk.name}\n` +
    `// (compressed: ${compressed.length} chars, ` +
    `${((1 - estimateTokens(compressed) / original_tokens) * 100).toFixed(0)}% reduction)\n`;

  compressed = header + compressed;

  const compressed_tokens = estimateTokens(compressed);

  return {
    ...chunk,
    content: compressed,
    tokens: compressed_tokens,
    original_tokens,
    compression_ratio: compressed_tokens / original_tokens,
    compression_method: level,
    quality_score: calculateCompressionQuality(chunk, compressed)
  };
}

function calculateCompressionQuality(
  original: CodeChunk,
  compressed: string
): number {
  // Check if key elements preserved
  const original_content = original.content;

  // Signature preserved?
  const signature_preserved =
    original_content.split('\n')[0].trim() ===
    compressed.split('\n')[3].trim();  // After 3-line header

  // Exports preserved?
  const exports_preserved =
    original.metadata?.exports?.every(e => compressed.includes(e)) ?? true;

  // Length reasonable?
  const length_ok = compressed.length > original.content.length * 0.1;

  return (signature_preserved ? 0.4 : 0) +
         (exports_preserved ? 0.4 : 0) +
         (length_ok ? 0.2 : 0);
}
```

### Model Selection

```typescript
function selectModel(
  tokens: number,
  complexity: number,
  ollama_available: boolean,
  config: ModelConfig
): ModelChoice {

  // Ollama: Free but limited capability
  if (ollama_available &&
      tokens < config.ollama_threshold &&
      complexity < config.ollama_complexity_threshold) {
    return {
      model: config.local_model || 'ollama:deepseek-coder-v2',
      reasoning: 'Free local model, sufficient for simple tasks',
      cost: 0
    };
  }

  // Haiku: Fast and cheap
  if (tokens < config.haiku_threshold &&
      complexity < config.haiku_complexity_threshold) {
    return {
      model: 'claude-3-haiku-20240307',
      reasoning: 'Cheapest Claude, fast enough for simple queries',
      cost: estimateCost(tokens, 0.00025)
    };
  }

  // Sonnet: Balanced
  if (tokens < config.sonnet_threshold ||
      complexity < config.sonnet_complexity_threshold) {
    return {
      model: 'claude-3.5-sonnet-20241022',
      reasoning: 'Balanced performance and cost',
      cost: estimateCost(tokens, 0.003)
    };
  }

  // Opus: Best quality
  return {
    model: 'claude-3-opus-20240229',
    reasoning: 'Best for complex reasoning, worth the cost',
    cost: estimateCost(tokens, 0.015)
  };
}

function estimateCost(tokens: number, price_per_million: number): number {
  return (tokens / 1_000_000) * price_per_million;
}
```

## Edge Cases

### No Relevant Code Found

```typescript
if (scoredChunks.length === 0 || scoredChunks[0].relevance_score < 0.3) {
  return {
    prompt: originalPrompt,
    warning: 'No highly relevant code found. Proceeding without context.',
    confidence: 0.3,
    chunks_used: 0
  };
}
```

### Budget Too Small

```typescript
if (budget < 1000) {
  const signatures = chunks.map(c => ({
    file: c.file_path,
    name: c.name,
    signature: c.signature
  }));

  return {
    prompt: `CODEBASE SIGNATURES:\n${JSON.stringify(signatures, null, 2)}\n\n${originalPrompt}`,
    warning: 'Budget too small for full context. Providing signatures only.',
    confidence: 0.5
  };
}
```

### Very Large Files

```typescript
if (chunk.end_line - chunk.start_line > 500) {
  const subChunks = splitLargeChunk(chunk, 100);
  return subChunks.map(sc => scoreRelevance(sc, intent, context, weights));
}
```

### Circular Dependencies

```typescript
if (hasCircularDependency(selectedChunks)) {
  const cycle = findCycle(selectedChunks);
  const lowestScore = cycle.reduce((min, c) =>
    c.relevance_score < min.relevance_score ? c : min
  );

  selectedChunks = selectedChunks.filter(c => c !== lowestScore);
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('TokenOptimizer', () => {
  test('estimates tokens accurately', () => {
    const text = 'function hello() { return "world"; }';
    expect(estimateTokens(text)).toBeCloseTo(15, 5);
  });

  test('selects chunks within budget', () => {
    const chunks = createMockChunks(100, { avgTokens: 500 });
    const selected = selectChunksWithinBudget(chunks, 10000);
    const totalTokens = selected.reduce((sum, c) => sum + c.estimated_tokens, 0);
    expect(totalTokens).toBeLessThanOrEqual(10000);
  });

  test('prioritizes high-relevance chunks', () => {
    const chunks = [
      createChunk({ relevance_score: 0.9, estimated_tokens: 1000 }),
      createChunk({ relevance_score: 0.5, estimated_tokens: 100 }),
      createChunk({ relevance_score: 0.8, estimated_tokens: 500 }),
    ];
    const selected = selectChunksWithinBudget(chunks, 600);
    expect(selected).toHaveLength(2);
    expect(selected[0].relevance_score).toBeGreaterThanOrEqual(0.8);
  });
});
```

### Integration Tests

```typescript
describe('TokenOptimizer Integration', () => {
  test('handles real codebase', async () => {
    const codebase = await indexRepo('./fixtures/react-app');
    const result = await reconstructPrompt('fix the auth bug', codebase, 50000);

    expect(result.tokens).toBeLessThan(50000);
    expect(result.savings.percentage).toBeGreaterThan(90);
  });

  test('routes to appropriate model', () => {
    expect(selectModel(5000, 0.3, true).model).toContain('ollama');
    expect(selectModel(50000, 0.8, false).model).toContain('sonnet');
  });
});
```

### Performance Tests

```typescript
describe('TokenOptimizer Performance', () => {
  test('processes 50K chunks in <2s', async () => {
    const chunks = createMockChunks(50000);
    const start = Date.now();
    await reconstructPrompt('test query', chunks, 50000);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  test('scores 10K chunks in <50ms', () => {
    const chunks = createMockChunks(10000);
    const start = Date.now();
    chunks.forEach(c => scoreRelevance(c, mockIntent, mockContext, defaultWeights));
    expect(Date.now() - start).toBeLessThan(50);
  });
});
```

## Optimization Opportunities

### 1. Cached Embeddings

```typescript
const cacheKey = hashPrompt(prompt);
let cached = await kv.get(`embedding:${cacheKey}`);
if (!cached) {
  cached = await generateEmbedding(prompt);
  await kv.put(`embedding:${cacheKey}`, cached, { expirationTtl: 86400 });
}
```

**Impact**: 8ms saved per repeated query

### 2. Pre-Computed Scores

```typescript
interface PreComputedScore {
  chunk_id: string;
  avg_relevance: number;
  usage_frequency: number;
}

// Score during indexing
// Look up during optimization
```

**Impact**: 20ms saved per query

### 3. Early Termination

```typescript
if (chunk.relevance_score > 0.95 && chunk.estimated_tokens < budget * 0.1) {
  return [chunk];  // Perfect match, stop searching
}
```

**Impact**: 30ms saved on exact matches

## References

- [Token Optimization Guide](../guide/06-token-optimization.md)
- [Configuration Guide](../user-guide/04-optimization-config.md)
- [Performance Guide](../guide/07-optimization-performance.md)
- [Cloudflare Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Context Compression for LLMs](https://arxiv.org/abs/2305.14314)

---

**Last Updated**: 2025-01-13
**Status**: Ready for Implementation
**Priority**: Critical (MVP blocker)
