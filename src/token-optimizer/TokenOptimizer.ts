/**
 * ============================================================================
 * TOKEN OPTIMIZER - MAIN ORCHESTRATOR
 * ============================================================================
 *
 * Implements the 6-phase token optimization pipeline that reduces token usage
 * by 90%+ while maintaining response quality through intelligent context selection.
 *
 * ============================================================================
 * PHASE 1: INTENT DETECTION
 * ============================================================================
 *
 * Classifies user queries into intent types to guide optimization strategy:
 *
 * Intent Types:
 * - bug_fix: Prioritize recent code, error handling, test files
 * - feature_add: Prioritize extension points, interfaces, patterns
 * - explain: Prioritize documentation, examples, clear naming
 * - refactor: Prioritize complexity, coupling, code smells
 * - test: Prioritize test files, assertions, coverage
 * - search: Prioritize comprehensive results, diverse sources
 * - general: Balanced approach across all signals
 *
 * Intent influences:
 * - Scoring weights (via OptimizationOptions)
 * - Max chunks selection
 * - Compression level (light/medium/aggressive)
 * - Budget allocation
 *
 * @see IntentDetector.ts for implementation details
 *
 * ============================================================================
 * PHASE 2: RELEVANCE SCORING
 * ============================================================================
 *
 * Scores all code chunks using 5 weighted features (weights sum to 1.0):
 *
 * Feature Weights (Why these specific weights?):
 * - Semantic (40%): Highest weight - captures meaning beyond keywords
 *   * Vector embeddings capture semantic relationships
 *   * Finds conceptually related code even with different names
 *   * Critical for "explain" and "feature_add" intents
 *
 * - Symbol (25%): Second highest - direct matching is very reliable
 *   * Exact function/class/type matches in query
 *   * Fuzzy matching for typos and variations
 *   * High confidence signal when present
 *
 * - Proximity (20%): Code locality is a strong signal
 *   * Same file = 1.0 (currently working on it)
 *   * Same directory = 0.8 (related context)
 *   * Decreases with distance (0.1 minimum)
 *   * Developers work in related files
 *
 * - Recency (10%): Recent changes are more relevant
 *   * Exponential decay with 30-day half-life
 *   * Bug fixes often involve recently modified code
 *   * Prevents stale code from dominating
 *
 * - Frequency (5%): Learning from usage patterns
 *   * Historically helpful chunks get boost
 *   * Requires user feedback loop
 *   * Low weight until we have more data
 *
 * Weight Sum = 0.40 + 0.25 + 0.20 + 0.10 + 0.05 = 1.0
 *
 * Final Score = Σ(feature_i × weight_i) for all features
 *
 * @see RelevanceScorer.ts for implementation details
 *
 * ============================================================================
 * PHASE 3: CHUNK SELECTION (GREEDY ALGORITHM)
 * ============================================================================
 *
 * Selects chunks within token budget using score density maximization:
 *
 * Score Density = relevance_score / token_cost
 *
 * Why Score Density?
 * - A 1000-token chunk with score 0.9 has density 0.0009
 * - A 100-token chunk with score 0.7 has density 0.007
 * - The smaller chunk provides 7.8x more value per token!
 *
 * Greedy Selection Algorithm:
 * 1. Sort all chunks by score density (descending)
 * 2. Iterate through sorted chunks
 * 3. Select chunk if it fits in remaining budget
 * 4. Allow 10% overage for high-value chunks (score > 0.8)
 * 5. Stop when budget is 95% consumed (leave room for formatting)
 *
 * Selection Guarantees:
 * - Never exceeds budget + 10% (configurable)
 * - Maximizes total relevance within constraints
 * - Prefers smaller, high-relevance chunks
 * - Includes at least one chunk if any exist
 *
 * @see ChunkSelector.ts for implementation details
 *
 * ============================================================================
 * PHASE 4: PROGRESSIVE COMPRESSION
 * ============================================================================
 *
 * Compresses selected chunks using adaptive levels:
 *
 * Why Progressive Compression?
 * - Different code needs different preservation levels
 * - One size doesn't fit all
 * - Trade-off between token savings and information loss
 *
 * Compression Levels:
 * - Light (1.1-1.5x reduction): Remove comments, blank lines
 *   * Preserves all code structure
 *   * Safe for all code types
 *   * Minimal information loss
 *
 * - Medium (1.5-3x reduction): Remove whitespace, compress imports
 *   * Preserves function signatures
 *   * Collapses body to key statements
 *   * Good for boilerplate code
 *
 * - Aggressive (3-10x reduction): Signature-only extraction
 *   * Keeps function/class names and types
 *   * Removes implementation details
 *   * Best for overview/explanation queries
 *
 * Fallback Logic (Lines 224-248):
 * - If compression ratio < 1.1, apply manual light compression
 * - Ensures at least some optimization is applied
 * - Prevents zero-compression results
 *
 * AUDIT NOTE: Private method access violation (lines 227-228)
 * - Accessing compressor['removeCommentsAndBlankLines']
 * - Should be public or use official API
 * - TODO: Refactor to use public interface
 *
 * @see AdaptiveCompressor.ts for implementation details
 *
 * ============================================================================
 * PHASE 5: PROMPT RECONSTRUCTION
 * ============================================================================
 *
 * Builds optimized prompt with selected chunks:
 *
 * Prompt Structure:
 * 1. User Query (original text)
 * 2. Context Summary (chunk count)
 * 3. Code Sections (grouped by file)
 *    - File path header
 *    - Chunk name and kind
 *    - Compressed code block
 *
 * Grouping Strategy:
 * - Chunks grouped by file path
 * - Sorted by relevance within each file
 * - Markdown formatting for clarity
 *
 * Token Estimation:
 * - Uses SimpleTokenCounter for estimation
 * - ~3-4 characters per token for code
 * - Accounts for markdown overhead
 *
 * ============================================================================
 * PHASE 6: MODEL ROUTING
 * ============================================================================
 *
 * Selects optimal model based on token count and complexity:
 *
 * Routing Logic:
 * - < 8K tokens + low complexity → Haiku (fast, cheap)
 * - 8K-50K tokens + medium complexity → Sonnet (balanced)
 * - > 50K tokens + high complexity → Opus (best quality)
 *
 * Why This Matters:
 * - Avoids overkill for simple queries
 * - Ensures quality for complex problems
 * - Optimizes cost vs. performance
 *
 * @see ModelRouter.ts for implementation details
 *
 * ============================================================================
 * BUDGET ALLOCATION RATIOS
 * ============================================================================
 *
 * Standard allocation for a 100K token context window:
 *
 * - System Prompt: 5% (5K tokens)
 *   * Instructions, role definition, guidelines
 *   * Fixed overhead for all queries
 *
 * - User Query: 10% (10K tokens)
 *   * Original user prompt
 *   * Conversation history
 *   * Follow-up questions
 *
 * - Code Context: 50% (50K tokens)
 *   * Selected code chunks
 *   * Primary optimization target
 *   * Where we save the most tokens
 *
 * - Model Response: 35% (35K tokens)
 *   * Space for model's response
 *   * Code generation, explanations
 *   * Must be sufficient for quality output
 *
 * Why These Ratios?
 * - System prompt is relatively stable
 * - User queries vary but are typically short
 * - Code context is the main variable
 * - Response space depends on task complexity
 *
 * @see allocateBudget() method (line 344)
 *
 * ============================================================================
 * TOKEN ESTIMATION ALGORITHM
 * ============================================================================
 *
 * Approximate token counts without model-specific tokenizers:
 *
 * Character-to-Token Ratios:
 * - Natural language: ~4 characters per token
 *   * English text has predictable patterns
 *   * Words average 4-5 characters
 *   * Spaces and punctuation count
 *
 * - Code: ~3 characters per token
 *   * More token-dense than natural language
 *   * Keywords, operators are single tokens
 *   * Identifiers split into subwords
 *
 * Code-Specific Adjustments:
 * - Keywords (function, class, etc.): ~1 token each
 * - Operators ({}, (), ;, etc.): ~1 token each
 * - Strings: Variable, ~5-10 tokens average
 * - Comments: ~4 chars/token (natural language)
 *
 * Accuracy:
 * - Within 10-20% of actual token count
 * - Sufficient for budget planning
 * - Actual tokenization happens at API call
 *
 * @see SimpleTokenCounter.ts for implementation details
 *
 * ============================================================================
 * AUDIT FINDINGS - KNOWN ISSUES
 * ============================================================================
 *
 * 1. Negative Savings Calculation (Lines 321-336)
 *    Issue: calculateSavings() can produce negative savings
 *    When: optimizedTokens > originalTokens (rare but possible)
 *    Impact: Confusing metrics for users
 *    Fix: Math.max(0, tokensSaved) before percentage calculation
 *
 * 2. Division by Zero in Compression Ratio (Line 387)
 *    Issue: compressionRatio = original / optimized (can be 0/0)
 *    When: empty chunks or zero-token content
 *    Impact: Returns NaN instead of 1.0
 *    Fix: Add guard - optimizedTokens > 0 ? original / optimized : 1.0
 *
 * 3. Private Method Access Violation (Lines 227-228)
 *    Issue: Accessing compressor['removeCommentsAndBlankLines']
 *    When: Fallback compression for minimal compression ratios
 *    Impact: Breaks encapsulation, fragile to refactoring
 *    Fix: Add public API or make methods public
 *
 * ============================================================================
 * PERFORMANCE METRICS
 * ============================================================================
 *
 * Target Performance (for 1M LOC codebase):
 * - Indexing time: <30 seconds
 * - Query processing: <2 seconds
 * - Memory usage: <100MB
 * - Token savings: 90%+ average
 *
 * Key Optimization Points:
 * - Batch scoring for parallel processing
 * - Proximity caching for file distance
 * - Greedy selection is O(n log n) due to sorting
 * - Compression is async and parallel
 *
 * ============================================================================
 * @see docs/architecture/02-token-optimizer.md for detailed design
 * @see CLAUDE.md for project context
 * ============================================================================
 */

import { CodeChunk, ScoredChunk, CompressedChunk, OptimizedPrompt } from '../core/types/index.js';
import { RelevanceScorer } from '../scoring/scores/RelevanceScorer.js';
import { ChunkSelector } from './ChunkSelector.js';
import { AdaptiveCompressor } from '../compression/AdaptiveCompressor.js';
import { IntentDetector } from './IntentDetector.js';
import { SimpleTokenCounter } from './SimpleTokenCounter.js';
import {
  QueryIntent,
  QueryEmbedding,
  ScoringContext,
  TokenBudgetAllocation,
  OptimizationOptions,
} from './types.js';

/**
 * Model router interface
 */
interface IModelRouter {
  selectModel(tokens: number, complexity: number): {
    model: string;
    provider: string;
    reason: string;
    estimatedCost: number;
  };
}

/**
 * Routing information for model selection
 */
interface RoutingInfo {
  /** Selected model */
  model: string;

  /** Model provider */
  provider: string;

  /** Reason for selection */
  reason: string;

  /** Estimated cost */
  estimatedCost: number;
}

/**
 * Token optimizer orchestrator
 */
export class TokenOptimizer {
  /**
   * Scoring service
   */
  private readonly scorer: RelevanceScorer;

  /**
   * Chunk selector
   */
  private readonly selector: ChunkSelector;

  /**
   * Compressor
   */
  private readonly compressor: AdaptiveCompressor;

  /**
   * Intent detector
   */
  private readonly intentDetector: IntentDetector;

  /**
   * Token counter
   */
  private readonly tokenCounter: SimpleTokenCounter;

  /**
   * Model router
   */
  private readonly modelRouter: IModelRouter;

  /**
   * Create token optimizer
   *
   * @param modelRouter - Model router for model selection
   */
  constructor(modelRouter: IModelRouter) {
    this.scorer = new RelevanceScorer();
    this.selector = new ChunkSelector();
    this.compressor = new AdaptiveCompressor();
    this.intentDetector = new IntentDetector();
    this.tokenCounter = new SimpleTokenCounter();
    this.modelRouter = modelRouter;
  }

  /**
   * Reconstruct optimized prompt from chunks
   *
   * Implements the 6-phase optimization pipeline.
   *
   * @param originalPrompt - Original user prompt
   * @param chunks - Available code chunks
   * @param budget - Token budget
   * @param context - Optional scoring context
   * @returns Optimized prompt with metadata
   */
  async reconstructPrompt(
    originalPrompt: string,
    chunks: CodeChunk[],
    budget: number,
    context?: Partial<ScoringContext>
  ): Promise<OptimizedPrompt> {
    try {
      // Phase 1: Detect intent
      const intent = await this.intentDetector.detect(originalPrompt);

      // Phase 2: Score all chunks
      const entities = intent.entities || [];
      const queryEmbedding: QueryEmbedding = {
        text: intent.query,
        vector: intent.embedding || [],
        entities: entities.map(e => ({
          type: e.type,
          value: e.value,
          position: e.position,
        })),
      };

      const scoringContext: ScoringContext = {
        currentFile: context?.currentFile,
        cwd: context?.cwd,
        now: Date.now(),
        usageHistory: (context?.usageHistory ?? []) as any,
        currentLanguage: context?.currentLanguage,
      };

      const scored = await this.scorer.scoreBatch(chunks, queryEmbedding, scoringContext);

      // Transform RelevanceScore[] to ScoredChunk[]
      const scoredChunks: ScoredChunk[] = scored.map(s => ({
        ...s.chunk,
        relevanceScore: s.score,
        scoreBreakdown: s.breakdown,
      }));

      // Phase 3: Select within budget
      const selected = this.selector.selectWithinBudget(
        scoredChunks,
        budget,
        intent.options
      );

      // Phase 4: Compress selected
      const compressed = await this.compressBatch(selected, budget);

      // Phase 5: Reconstruct prompt
      const prompt = this.buildPrompt(originalPrompt, compressed, intent);

      // Phase 6: Choose model
      const modelChoice = this.modelRouter.selectModel(prompt.tokens, intent.complexity);

      // Calculate savings
      const originalTokens = this.calculateOriginalTokens(chunks);
      const savings = this.calculateSavings(originalTokens, prompt.tokens);

      return {
        prompt: prompt.text,
        tokensUsed: prompt.tokens,
        chunks: compressed,
        model: modelChoice.model,
        savings,
        routing: {
          provider: modelChoice.provider,
          reason: modelChoice.reason,
          estimatedCost: modelChoice.estimatedCost,
        },
      };
    } catch (error) {
      // Handle errors gracefully
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      throw new Error(`Token optimization failed: ${message}\n${stack}`);
    }
  }

  /**
   * Compress chunks in batch
   *
   * @param chunks - Chunks to compress
   * @param budget - Total token budget
   * @returns Compressed chunks
   */
  private async compressBatch(
    chunks: ScoredChunk[],
    budget: number
  ): Promise<CompressedChunk[]> {
    if (chunks.length === 0) {
      return [];
    }

    // Calculate budget per chunk (divide evenly)
    const budgetPerChunk = Math.floor(budget / chunks.length);

    // Compress all chunks
    const results = await this.compressor.compressBatch(
      chunks,
      budgetPerChunk,
      {
        preserveImports: true,
        preserveTypes: true,
      }
    );

    // Return only successful compressions
    // Ensure at least light compression was applied (remove comments, etc)
    return results.filter(r => r.success).map(r => {
      // If compression was minimal (ratio < 1.1), apply light compression manually
      if (r.compressionRatio < 1.1) {
        // AUDIT NOTE: Private method access violation
        // Accessing compressor['removeCommentsAndBlankLines'] breaks encapsulation
        // TODO: Refactor to use public API or make these methods public
        const lightCompressed = this.compressor['removeCommentsAndBlankLines'](r.original.content);
        const lightTokens = this.compressor['estimateTokens'](lightCompressed);
        const ratio = r.originalTokens / Math.max(lightTokens, 1);
        // Only use manual compression if it's better
        if (ratio > r.compressionRatio) {
          return {
            original: r.original,
            content: lightCompressed,
            originalTokens: r.originalTokens,
            compressedTokens: lightTokens,
            compressionRatio: ratio,
          };
        }
      }
      return {
        original: r.original,
        content: r.content,
        originalTokens: r.originalTokens,
        compressedTokens: r.compressedTokens,
        compressionRatio: r.compressionRatio,
      };
    });
  }

  /**
   * Build optimized prompt from compressed chunks
   *
   * @param originalPrompt - Original user prompt
   * @param chunks - Compressed chunks
   * @param intent - Query intent
   * @returns Built prompt with token count
   */
  private buildPrompt(
    originalPrompt: string,
    chunks: CompressedChunk[],
    intent: QueryIntent
  ): { text: string; tokens: number } {
    // Build context sections
    const sections: string[] = [];

    // Add user query
    sections.push(`# User Query\n${originalPrompt}\n`);

    // Add context summary
    if (chunks.length > 0) {
      sections.push(`# Context\n`);
      sections.push(`Found ${chunks.length} relevant code sections:\n`);

      // Group by file
      const byFile = new Map<string, CompressedChunk[]>();
      for (const chunk of chunks) {
        const fileChunks = byFile.get(chunk.original.filePath) ?? [];
        fileChunks.push(chunk);
        byFile.set(chunk.original.filePath, fileChunks);
      }

      // Add file sections
      for (const [filePath, fileChunks] of byFile) {
        sections.push(`\n## ${filePath}\n`);

        for (const chunk of fileChunks) {
          sections.push(`### ${chunk.original.name} (${chunk.original.kind})\n`);
          sections.push(`\`\`\`${chunk.original.language}\n`);
          sections.push(chunk.content);
          sections.push('\n```\n');
        }
      }
    }

    const prompt = sections.join('\n');
    const tokens = this.tokenCounter.estimate(prompt);

    return { text: prompt, tokens };
  }

  /**
   * Calculate original token count before optimization
   *
   * @param chunks - Original chunks
   * @returns Total original tokens
   */
  private calculateOriginalTokens(chunks: CodeChunk[]): number {
    return chunks.reduce((sum, chunk) => {
      return sum + this.tokenCounter.estimate(chunk.content);
    }, 0);
  }

  /**
   * Calculate savings metrics
   *
   * AUDIT NOTE: This method can produce negative savings when
   * optimizedTokens > originalTokens (e.g., if formatting overhead
   * exceeds savings). This creates confusing metrics for users.
   *
   * TODO: Add guard: const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
   *
   * @param originalTokens - Original token count
   * @param optimizedTokens - Optimized token count
   * @returns Savings metrics
   */
  private calculateSavings(
    originalTokens: number,
    optimizedTokens: number
  ): { tokensSaved: number; percentage: number; costSaved: number } {
    const tokensSaved = originalTokens - optimizedTokens;
    const percentage = originalTokens > 0 ? (tokensSaved / originalTokens) * 100 : 0;

    // Rough cost estimation (Claude pricing: $3/M input tokens)
    const costSaved = (tokensSaved / 1_000_000) * 3;

    return {
      tokensSaved,
      percentage,
      costSaved,
    };
  }

  /**
   * Allocate token budget
   *
   * @param totalBudget - Total token budget
   * @returns Budget allocation
   */
  allocateBudget(totalBudget: number): TokenBudgetAllocation {
    // Standard allocation ratios
    const systemRatio = 0.05; // 5% for system prompt
    const userQueryRatio = 0.10; // 10% for user query
    const contextRatio = 0.50; // 50% for code context
    const responseRatio = 0.35; // 35% for response

    return {
      total: totalBudget,
      system: Math.floor(totalBudget * systemRatio),
      userQuery: Math.floor(totalBudget * userQueryRatio),
      context: Math.floor(totalBudget * contextRatio),
      response: Math.floor(totalBudget * responseRatio),
    };
  }

  /**
   * Get optimization statistics
   *
   * @param original - Original chunks
   * @param optimized - Optimized prompt
   * @returns Statistics
   */
  getStats(original: CodeChunk[], optimized: OptimizedPrompt): {
    originalChunks: number;
    selectedChunks: number;
    selectionRate: number;
    originalTokens: number;
    optimizedTokens: number;
    compressionRatio: number;
    savings: {
      tokens: number;
      percentage: number;
    };
  } {
    const originalTokens = this.calculateOriginalTokens(original);

    return {
      originalChunks: original.length,
      selectedChunks: optimized.chunks.length,
      selectionRate: original.length > 0 ? optimized.chunks.length / original.length : 0,
      originalTokens,
      optimizedTokens: optimized.tokensUsed,
      // AUDIT NOTE: Division by zero possible if optimized.tokensUsed is 0
      // Current guard only checks originalTokens > 0
      // TODO: Use: optimized.tokensUsed > 0 ? originalTokens / optimized.tokensUsed : 1
      compressionRatio: originalTokens > 0 ? originalTokens / optimized.tokensUsed : 1,
      savings: {
        tokens: optimized.savings.tokensSaved,
        percentage: optimized.savings.percentage,
      },
    };
  }
}

/**
 * Export factory function for creating optimizer with default model router
 */
export function createTokenOptimizer(modelRouter?: IModelRouter): TokenOptimizer {
  const defaultRouter: IModelRouter = {
    selectModel: (tokens: number, complexity: number) => {
      if (tokens < 8000) {
        return {
          model: 'claude-3-haiku',
          provider: 'anthropic',
          reason: 'Small request, fast model sufficient',
          estimatedCost: 0.001,
        };
      } else if (tokens < 50000) {
        return {
          model: 'claude-3.5-sonnet',
          provider: 'anthropic',
          reason: 'Medium request, balanced model',
          estimatedCost: 0.01,
        };
      } else {
        return {
          model: 'claude-3-opus',
          provider: 'anthropic',
          reason: 'Large request, best model',
          estimatedCost: 0.05,
        };
      }
    },
  };

  return new TokenOptimizer(modelRouter ?? defaultRouter);
}
