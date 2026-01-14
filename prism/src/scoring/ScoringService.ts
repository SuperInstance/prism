/**
 * Scoring Service Framework
 *
 * Pluggable architecture for calculating relevance scores of code chunks.
 * Supports multiple scoring strategies and parallel batch processing.
 */

import type { CodeChunk, PrismConfig } from '../core/types.js';

/**
 * Query embedding vector
 */
export interface QueryEmbedding {
  vector: number[];
  text: string;
  timestamp: number;
}

/**
 * Context for scoring calculations
 */
export interface ScoringContext {
  currentFile?: string;
  currentDirectory?: string;
  recentFiles: string[];
  userHistory?: string[];
  timestamp: number;
}

/**
 * Relevance score with breakdown
 */
export interface RelevanceScore {
  total: number;
  semantic: number;
  symbolMatch: number;
  fileProximity: number;
  recency: number;
  usageFrequency: number;
  metadata: Record<string, unknown>;
}

/**
 * Scored code chunk
 */
export interface ScoredChunk {
  chunk: CodeChunk;
  score: RelevanceScore;
  rank: number;
}

/**
 * Scorer plugin interface
 */
export interface IScorer {
  name: string;
  weight: number;
  calculate(
    chunk: CodeChunk,
    query: QueryEmbedding,
    context: ScoringContext
  ): Promise<number>;
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;
}

/**
 * Scoring result cache entry
 */
interface CacheEntry {
  score: RelevanceScore;
  timestamp: number;
  hitCount: number;
}

/**
 * Performance metrics for scoring
 */
export interface ScoringMetrics {
  totalChunksScored: number;
  averageTimePerChunk: number;
  cacheHitRate: number;
  scorerPerformance: Map<string, number>;
}

/**
 * Scoring service configuration
 */
export interface ScoringServiceConfig {
  enableCache: boolean;
  cacheSize: number;
  cacheTTL: number;
  parallelism: number;
  enableMetrics: boolean;
}

/**
 * Main scoring service class
 */
export class ScoringService {
  private config: ScoringServiceConfig;
  private scorers: Map<string, IScorer>;
  private cache: Map<string, CacheEntry>;
  private metrics: ScoringMetrics;
  private initialized = false;

  constructor(prismConfig: PrismConfig, config?: Partial<ScoringServiceConfig>) {
    // Prism config is stored for potential future use
    void prismConfig;
    this.config = {
      enableCache: true,
      cacheSize: 10000,
      cacheTTL: 60000, // 1 minute
      parallelism: 4,
      enableMetrics: true,
      ...config,
    };

    this.scorers = new Map();
    this.cache = new Map();
    this.metrics = {
      totalChunksScored: 0,
      averageTimePerChunk: 0,
      cacheHitRate: 0,
      scorerPerformance: new Map(),
    };
  }

  /**
   * Initialize the scoring service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize all registered scorers
    for (const scorer of this.scorers.values()) {
      if (scorer.initialize) {
        await scorer.initialize();
      }
    }

    this.initialized = true;
  }

  /**
   * Register a scorer plugin
   */
  registerScorer(scorer: IScorer): void {
    this.scorers.set(scorer.name, scorer);
  }

  /**
   * Unregister a scorer plugin
   */
  unregisterScorer(name: string): void {
    const scorer = this.scorers.get(name);
    if (scorer?.cleanup) {
      void scorer.cleanup();
    }
    this.scorers.delete(name);
  }

  /**
   * Calculate relevance score for a single chunk
   */
  async calculateRelevance(
    chunk: CodeChunk,
    query: QueryEmbedding,
    context: ScoringContext
  ): Promise<RelevanceScore> {
    if (!this.initialized) {
      await this.initialize();
    }

    const cacheKey = this.getCacheKey(chunk, query, context);

    // Check cache
    if (this.config.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
        cached.hitCount++;
        this.metrics.cacheHitRate =
          (this.metrics.cacheHitRate * this.metrics.totalChunksScored + 1) /
          (this.metrics.totalChunksScored + 1);
        this.metrics.totalChunksScored++;
        return cached.score;
      }
    }

    const startTime = performance.now();
    const scoreBreakdown: RelevanceScore = {
      total: 0,
      semantic: 0,
      symbolMatch: 0,
      fileProximity: 0,
      recency: 0,
      usageFrequency: 0,
      metadata: {},
    };

    // Calculate scores using all registered scorers
    const scorerPromises = Array.from(this.scorers.values()).map(async (scorer) => {
      const scorerStart = performance.now();
      const score = await scorer.calculate(chunk, query, context);
      const scorerTime = performance.now() - scorerStart;

      // Track scorer performance
      if (this.config.enableMetrics) {
        const existingTime = this.metrics.scorerPerformance.get(scorer.name) || 0;
        this.metrics.scorerPerformance.set(
          scorer.name,
          existingTime + scorerTime
        );
      }

      return { scorer, score };
    });

    const results = await Promise.all(scorerPromises);

    // Aggregate scores with weights
    let totalWeight = 0;
    let weightedSum = 0;

    for (const { scorer, score } of results) {
      const weight = scorer.weight;
      weightedSum += score * weight;
      totalWeight += weight;

      // Store in breakdown based on scorer name
      const scorerKey = scorer.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (scorerKey in scoreBreakdown) {
        (scoreBreakdown as unknown as Record<string, unknown>)[scorerKey] = score;
      } else {
        scoreBreakdown.metadata[scorer.name] = score;
      }
    }

    scoreBreakdown.total = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Update metrics
    const elapsed = performance.now() - startTime;
    if (this.config.enableMetrics) {
      this.metrics.totalChunksScored++;
      this.metrics.averageTimePerChunk =
        (this.metrics.averageTimePerChunk * (this.metrics.totalChunksScored - 1) +
          elapsed) /
        this.metrics.totalChunksScored;
      this.metrics.cacheHitRate =
        (this.metrics.cacheHitRate * (this.metrics.totalChunksScored - 1)) /
        this.metrics.totalChunksScored;
    }

    // Cache result
    if (this.config.enableCache) {
      this.evictOldCache();
      this.cache.set(cacheKey, {
        score: scoreBreakdown,
        timestamp: Date.now(),
        hitCount: 0,
      });
    }

    return scoreBreakdown;
  }

  /**
   * Calculate relevance scores for a batch of chunks in parallel
   */
  async scoreBatch(
    chunks: CodeChunk[],
    query: QueryEmbedding,
    context: ScoringContext
  ): Promise<ScoredChunk[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = performance.now();

    // Process chunks in parallel batches
    const results: ScoredChunk[] = [];
    const batchSize = this.config.parallelism;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchPromises = batch.map(async (chunk) => {
        const score = await this.calculateRelevance(chunk, query, context);
        return { chunk, score, rank: 0 };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Sort by score descending and assign ranks
    results.sort((a, b) => b.score.total - a.score.total);
    results.forEach((result, index) => {
      result.rank = index + 1;
    });

    const elapsed = performance.now() - startTime;
    if (this.config.enableMetrics && chunks.length > 0) {
      // Update metrics for batch processing
      const avgTime = elapsed / chunks.length;
      this.metrics.averageTimePerChunk =
        (this.metrics.averageTimePerChunk + avgTime) / 2;
    }

    return results;
  }

  /**
   * Get scoring metrics
   */
  getMetrics(): ScoringMetrics {
    return {
      totalChunksScored: this.metrics.totalChunksScored,
      averageTimePerChunk: this.metrics.averageTimePerChunk,
      cacheHitRate: this.metrics.cacheHitRate,
      scorerPerformance: new Map(this.metrics.scorerPerformance),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalChunksScored: 0,
      averageTimePerChunk: 0,
      cacheHitRate: 0,
      scorerPerformance: new Map(),
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Cleanup the scoring service
   */
  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Cleanup all scorers
    for (const scorer of this.scorers.values()) {
      if (scorer.cleanup) {
        await scorer.cleanup();
      }
    }

    this.clearCache();
    this.initialized = false;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(
    chunk: CodeChunk,
    query: QueryEmbedding,
    context: ScoringContext
  ): string {
    const keyData = {
      chunkId: chunk.id,
      queryHash: this.hashString(query.text),
      file: context.currentFile || '',
      dir: context.currentDirectory || '',
    };
    return JSON.stringify(keyData);
  }

  /**
   * Simple hash function for strings
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Evict old cache entries if cache is full
   */
  private evictOldCache(): void {
    if (this.cache.size >= this.config.cacheSize) {
      // Find and remove least recently used entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, Math.floor(this.config.cacheSize * 0.1));
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Factory function to create a scoring service with default scorers
 */
export async function createScoringService(
  config: PrismConfig,
  scorerConfig?: Partial<ScoringServiceConfig>
): Promise<ScoringService> {
  const service = new ScoringService(config, scorerConfig);

  // Default scorers will be registered by specific implementations
  // E.g., SemanticScorer, SymbolMatchScorer, etc.

  await service.initialize();
  return service;
}
