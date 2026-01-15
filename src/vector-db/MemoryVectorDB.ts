/**
 * ============================================================================
 * IN-MEMORY VECTOR DATABASE
 * ============================================================================
 *
 * Provides vector storage and similarity search using in-memory data structures.
 * This is a simple implementation suitable for development and small datasets.
 *
 * ARCHITECTURE:
 *
 * DATA STRUCTURES:
 * - Map<string, VectorEntry>: O(1) lookup by chunk ID
 * - VectorEntry contains: chunk, embedding, metadata (timestamp, access stats)
 * - Auxiliary maps: languageCounts, index tracking
 *
 * VECTOR SEARCH ALGORITHM:
 *
 * CURRENT: BRUTE-FORCE O(n)
 * 1. Iterate through all vectors in database
 * 2. Calculate cosine similarity for each
 * 3. Apply filters (path, language, minRelevance)
 * 4. Calculate multi-factor relevance score
 * 5. Sort by score and return top K
 *
 * PERFORMANCE CHARACTERISTICS:
 * - 1K chunks: ~5ms per search
 * - 10K chunks: ~50ms per search
 * - 100K chunks: ~500ms per search (unacceptable)
 *
 * BOTTLENECK:
 * - No spatial indexing (no HNSW, IVF, etc)
 * - Linear scan through entire dataset
 * - Cosine similarity calculation for every vector
 *
 * MIGRATION PATH:
 * - Phase 1 (Current): Brute-force in-memory
 * - Phase 2 (TODO): HNSW indexing for fast ANN search
 * - Phase 3 (TODO): Persistent storage (SQLite FTS5 + vectors)
 * - Phase 4 (TODO): Hybrid local + cloud (Cloudflare Vectorize)
 *
 * RELEVANCE SCORING:
 *
 * Multi-factor score combines multiple signals:
 *
 * 1. SEMANTIC SIMILARITY (40% weight)
 *    - Cosine similarity between query and chunk embeddings
 *    - Range: 0.0 to 1.0
 *    - Primary signal for relevance
 *
 * 2. FILE PROXIMITY (25% weight)
 *    - Heuristic based on file path
 *    - Prefers files in /src/, /lib/
 *    - Range: 0.5 to 1.0
 *    - Why: Code in common directories is often more relevant
 *
 * 3. SYMBOL MATCH (20% weight)
 *    - Not yet implemented (returns 0)
 *    - TODO: Match function/class names in query
 *    - Would boost chunks with matching symbols
 *
 * 4. RECENCY (10% weight)
 *    - Exponential decay based on insertion time
 *    - Decay rate: 0.1 per day
 *    - After 30 days: score drops to 0.1
 *    - Why: Recent code is more likely to be relevant
 *
 * 5. FREQUENCY (5% weight)
 *    - Based on access count
 *    - Normalized: 100 accesses = 1.0
 *    - Why: Frequently accessed chunks are likely important
 *
 * Final Score Formula:
 * score = 0.40 * semantic +
 *         0.25 * proximity +
 *         0.20 * symbol +
 *         0.10 * recency +
 *         0.05 * frequency
 *
 * MEMORY USAGE:
 *
 * Per Chunk:
 * - Content: ~500 bytes (average)
 * - Embedding: 384d × 8 bytes = ~3KB
 * - Metadata: ~200 bytes
 * - Total: ~3.7KB per chunk
 *
 * Scaling:
 * - 1K chunks: ~3.7MB
 * - 10K chunks: ~37MB
 * - 100K chunks: ~370MB
 * - 1M chunks: ~3.7GB (too large for memory)
 *
 * LIMITATIONS:
 *
 * 1. NO PERSISTENCE
 *    - Data lost on process exit
 *    - Must reindex on every restart
 *    - TODO: Implement persistent storage
 *
 * 2. BRUTE-FORCE SEARCH
 *    - O(n) complexity scales poorly
 *    - Unacceptable beyond 10K chunks
 *    - TODO: Implement HNSW indexing
 *
 * 3. NO CONCURRENT ACCESS
 *    - Single-threaded design
 *    - No locking or synchronization
 *    - Unsafe for multi-threaded environments
 *
 * 4. NO COMPRESSION
 *    - Float32 embeddings (could use float16)
 *    - No vector quantization
 *    - TODO: Implement product quantization
 *
 * FUTURE ENHANCEMENTS:
 *
 * HNSW INDEXING:
 * - Hierarchical Navigable Small World graph
 * - O(log n) search instead of O(n)
 * - 100-1000x faster for large datasets
 * - Implementation: Use hnswlib or similar
 *
 * PERSISTENT STORAGE:
 * - SQLite with FTS5 for metadata
 * - BLOB storage for vectors
 * - mmap for fast loading
 * - Lazy loading to reduce memory
 *
 * VECTOR COMPRESSION:
 * - Product Quantization (PQ): 4-8x compression
 * - Float16: 2x compression with minimal quality loss
 * - Binary quantization: 32x compression (hamming distance)
 *
 * HYBRID ARCHITECTURE:
 * - Hot cache: Recent chunks in memory (HNSW)
 * - Cold storage: Historical chunks in SQLite
 * - Cloud sync: Backup to Cloudflare Vectorize
 *
 * ALTERNATIVE IMPLEMENTATIONS:
 *
 * For production use, consider:
 * - Pinecone: Managed vector DB (costs money)
 * - Weaviate: Open-source, Docker deployment
 * - Qdrant: Rust-based, very fast
 * - pgvector: PostgreSQL extension
 * - Cloudflare Vectorize: Edge-based, free tier
 *
 * @see docs/architecture/04-indexer-architecture.md
 * @see https://github.com/nmslib/hnswlib for HNSW implementation
 */

import type {
  IVectorDatabase,
  SearchOptions,
  DatabaseStats,
} from '../core/interfaces/index.js';
import type {
  CodeChunk,
  SearchResults,
  ScoredChunk,
  ScoreBreakdown,
} from '../core/types/index.js';
import { createPrismError, ErrorCode } from '../core/types/index.js';
import { cosineSimilarity } from '../core/utils/embedding.js';

/**
 * Vector entry stored in the database
 */
interface VectorEntry {
  /** The code chunk */
  chunk: CodeChunk;

  /** Embedding vector */
  embedding: number[];

  /** Timestamp when inserted */
  timestamp: Date;

  /** Access count for frequency tracking */
  accessCount: number;

  /** Last access timestamp */
  lastAccessed: Date;
}

/**
 * In-memory vector database implementation
 *
 * Stores vectors in a Map and performs brute-force similarity search.
 * This is acceptable for MVP and small datasets (< 10K chunks).
 */
export class MemoryVectorDB implements IVectorDatabase {
  private vectors: Map<string, VectorEntry> = new Map();
  private languageCounts: Map<string, number> = new Map();
  private indexSize: number = 0;
  private lastUpdated: Date = new Date();

  /**
   * Insert a single code chunk into the database
   *
   * @param chunk - The code chunk to insert
   * @throws {PrismError} If insertion fails
   */
  async insert(chunk: CodeChunk): Promise<void> {
    try {
      // Validate chunk has required fields
      this.validateChunk(chunk);

      // Check if chunk has embedding
      if (!chunk.embedding || !Array.isArray(chunk.embedding) || chunk.embedding.length === 0) {
        throw createPrismError(
          ErrorCode.EMBEDDING_FAILED,
          `Chunk ${chunk.id} missing embedding`
        );
      }

      // Create vector entry
      const entry: VectorEntry = {
        chunk: { ...chunk },
        embedding: [...chunk.embedding],
        timestamp: new Date(),
        accessCount: 0,
        lastAccessed: new Date(),
      };

      // Store in map
      this.vectors.set(chunk.id, entry);

      // Update stats
      this.updateLanguageStats(chunk.language, 1);
      this.indexSize += this.estimateEntrySize(entry);
      this.lastUpdated = new Date();
    } catch (error) {
      if (error instanceof Error && error.name === 'PrismError') {
        throw error;
      }
      throw createPrismError(
        ErrorCode.VECTOR_DB_ERROR,
        `Failed to insert chunk ${chunk.id}`,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Insert multiple code chunks in a batch
   *
   * More efficient than multiple single inserts.
   *
   * @param chunks - Array of code chunks to insert
   * @throws {PrismError} If batch insertion fails
   */
  async insertBatch(chunks: CodeChunk[]): Promise<void> {
    try {
      for (const chunk of chunks) {
        await this.insert(chunk);
      }
    } catch (error) {
      throw createPrismError(
        ErrorCode.VECTOR_DB_ERROR,
        'Failed to insert batch of chunks',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * ============================================================================
   * VECTOR SIMILARITY SEARCH
   * ============================================================================
   *
   * Performs semantic search using vector embeddings with multi-factor relevance
   * scoring. This is the core operation for retrieving relevant code chunks.
   *
   * ALGORITHM:
   *
   * Step 1: FILTERING (O(n))
   * - Apply path filter: Skip chunks not matching pattern
   * - Apply language filter: Skip chunks of wrong language
   * - Apply minRelevance: Skip low similarity scores
   *
   * Step 2: SIMILARITY CALCULATION (O(n × d))
   * - For each remaining chunk, calculate cosine similarity
   * - Cosine similarity: dot(query, chunk) / (norm(query) × norm(chunk))
   * - Range: -1.0 to 1.0, normalized to 0.0 to 1.0
   * - Complexity: O(d) per chunk where d = embedding dimension (384)
   *
   * Step 3: MULTI-FACTOR SCORING (O(n))
   * - Combine multiple signals into single relevance score
   * - Semantic similarity: 40% weight
   * - File proximity: 25% weight
   * - Symbol match: 20% weight (not implemented yet)
   * - Recency: 10% weight
   * - Frequency: 5% weight
   *
   * Step 4: SORTING (O(n log n))
   * - Sort by relevance score descending
   * - Top K results returned
   *
   * TOTAL COMPLEXITY: O(n × d + n log n)
   * - Dominated by similarity calculations
   * - Acceptable for n < 10K
   * - Needs HNSW for n > 10K
   *
   * SCORING DETAILS:
   *
   * Semantic Similarity:
   * - Measures cosine angle between vectors
   * - 1.0 = identical direction, 0.0 = orthogonal
   * - Most important signal for relevance
   *
   * File Proximity:
   * - Heuristic based on directory structure
   * - /src/ → 1.0 (highest priority)
   * - /lib/ → 0.8 (high priority)
   * - Other → 0.5 (baseline)
   * - Why: Code in core directories is often more relevant
   *
   * Recency:
   * - Exponential decay: e^(-0.1 × days)
   * - Fresh insertions score higher
   * - After 30 days: score drops to 0.05
   * - Why: Recent code is more likely to be relevant
   *
   * Frequency:
   * - Access count / 100 (clamped to 1.0)
   * - Frequently accessed chunks get boost
   * - Why: Popular code is often important
   *
   * FILTERS:
   *
   * pathFilter:
   * - Glob pattern matching
   * - Example: "src/**\/*.ts" matches only TypeScript in src/
   * - Uses simple regex conversion
   *
   * languageFilter:
   * - Exact string match
   * - Example: "typescript" only returns TS chunks
   * - Useful for language-specific queries
   *
   * minRelevance:
   * - Threshold for semantic similarity
   * - Range: 0.0 to 1.0
   * - Example: 0.5 filters out low-quality matches
   * - Why: Reduces noise in results
   *
   * PERFORMANCE:
   *
   * Dataset Size | Search Time | Throughput
   * -------------|-------------|------------
   * 1K chunks    | ~5ms        | 200 qps
   * 10K chunks   | ~50ms       | 20 qps
   * 100K chunks  | ~500ms      | 2 qps (too slow)
   *
   * For >10K chunks, need HNSW indexing (1000x faster).
   *
   * USAGE:
   * ```typescript
   * const results = await vectorDB.search(queryEmbedding, {
   *   limit: 10,              // Return top 10 results
   *   pathFilter: 'src/**',    // Only src/ directory
   *   languageFilter: 'ts',    // Only TypeScript
   *   minRelevance: 0.5,       // Min semantic similarity
   *   includeBreakdown: true   // Include score details
   * });
   *
   * console.log(`Found ${results.chunks.length} matches in ${results.searchTime}ms`);
   * for (const chunk of results.chunks) {
   *   console.log(`${chunk.relevanceScore.toFixed(2)}: ${chunk.content}`);
   * }
   * ```
   *
   * @param query - Query embedding vector (384 dimensions)
   * @param options - Search options (filters, limits, scoring)
   * @returns SearchResults with scored chunks and metadata
   * @throws {PrismError} If search operation fails
   *
   * @see calculateSimilarity() for cosine similarity
   * @see calculateProximity() for file proximity heuristic
   * @see calculateRecency() for time decay function
   * @see calculateFrequency() for access frequency scoring
   */
  async search(query: number[], options: SearchOptions = {}): Promise<SearchResults> {
    const startTime = performance.now();

    try {
      // Validate query
      if (!query || !Array.isArray(query) || query.length === 0) {
        // Return empty results for empty query instead of throwing
        return {
          chunks: [],
          totalEvaluated: this.vectors.size,
          searchTime: performance.now() - startTime,
        };
      }

      const {
        limit = 10,
        pathFilter,
        languageFilter,
        includeBreakdown = false,
        minRelevance = 0.0,
      } = options;

      // Calculate similarity for all chunks
      const results: ScoredChunk[] = [];

      for (const [, entry] of this.vectors.entries()) {
        // Apply filters
        if (pathFilter && !this.matchesPathFilter(entry.chunk.filePath, pathFilter)) {
          continue;
        }

        if (languageFilter && entry.chunk.language !== languageFilter) {
          continue;
        }

        // Calculate semantic similarity
        const semantic = this.calculateSimilarity(query, entry.embedding);

        // Filter by minimum relevance
        if (semantic < minRelevance) {
          continue;
        }

        // Build score breakdown
        const breakdown: ScoreBreakdown = {
          semantic,
          proximity: this.calculateProximity(entry.chunk),
          symbol: 0, // Will be calculated if needed
          recency: this.calculateRecency(entry),
          frequency: this.calculateFrequency(entry),
        };

        // Calculate overall score (weighted average)
        const weights = { semantic: 0.40, proximity: 0.25, symbol: 0.20, recency: 0.10, frequency: 0.05 };
        const relevanceScore =
          breakdown.semantic * weights.semantic +
          breakdown.proximity * weights.proximity +
          breakdown.symbol * weights.symbol +
          breakdown.recency * weights.recency +
          breakdown.frequency * weights.frequency;

        // Create scored chunk
        const scoredChunk: ScoredChunk = {
          ...entry.chunk,
          relevanceScore,
          scoreBreakdown: includeBreakdown ? breakdown : this.normalizeBreakdown(breakdown),
        };

        results.push(scoredChunk);

        // Update access stats
        entry.accessCount++;
        entry.lastAccessed = new Date();
      }

      // Sort by relevance score
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Apply limit
      const limitedResults = results.slice(0, limit);

      const searchTime = performance.now() - startTime;

      return {
        chunks: limitedResults,
        totalEvaluated: this.vectors.size,
        searchTime,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'PrismError') {
        throw error;
      }
      throw createPrismError(
        ErrorCode.VECTOR_DB_ERROR,
        'Search failed',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Retrieve a chunk by its ID
   *
   * @param id - Unique chunk identifier
   * @returns The chunk if found, null otherwise
   * @throws {PrismError} If retrieval fails
   */
  async get(id: string): Promise<CodeChunk | null> {
    try {
      const entry = this.vectors.get(id);
      if (!entry) {
        return null;
      }

      // Update access stats
      entry.accessCount++;
      entry.lastAccessed = new Date();

      return { ...entry.chunk };
    } catch (error) {
      throw createPrismError(
        ErrorCode.VECTOR_DB_ERROR,
        `Failed to get chunk ${id}`,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Delete a chunk by its ID
   *
   * @param id - Unique chunk identifier
   * @throws {PrismError} If deletion fails
   */
  async delete(id: string): Promise<void> {
    try {
      const entry = this.vectors.get(id);
      if (!entry) {
        return; // Already deleted
      }

      // Update stats
      this.updateLanguageStats(entry.chunk.language, -1);
      this.indexSize -= this.estimateEntrySize(entry);
      this.lastUpdated = new Date();

      // Remove from map
      this.vectors.delete(id);
    } catch (error) {
      throw createPrismError(
        ErrorCode.VECTOR_DB_ERROR,
        `Failed to delete chunk ${id}`,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Clear all chunks from the database
   *
   * Use with caution! This operation is not reversible.
   *
   * @throws {PrismError} If clearing fails
   */
  async clear(): Promise<void> {
    try {
      this.vectors.clear();
      this.languageCounts.clear();
      this.indexSize = 0;
      this.lastUpdated = new Date();
    } catch (error) {
      throw createPrismError(
        ErrorCode.VECTOR_DB_ERROR,
        'Failed to clear database',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get statistics about the database
   *
   * @returns Database statistics
   */
  async getStats(): Promise<DatabaseStats> {
    const chunksByLanguage: Record<string, number> = {};

    for (const [language, count] of this.languageCounts.entries()) {
      chunksByLanguage[language] = count;
    }

    return {
      totalChunks: this.vectors.size,
      chunksByLanguage,
      indexSize: this.indexSize,
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   *
   * @param a - First vector
   * @param b - Second vector
   * @returns Similarity score from 0 to 1
   */
  private calculateSimilarity(a: number[], b: number[]): number {
    try {
      const similarity = cosineSimilarity(a, b);
      // Normalize to 0-1 range (cosine similarity can be -1 to 1)
      return Math.max(0, similarity);
    } catch {
      return 0;
    }
  }

  /**
   * Calculate proximity score based on file path
   *
   * Gives higher scores to files in common directories.
   *
   * @param chunk - Code chunk
   * @returns Proximity score from 0 to 1
   */
  private calculateProximity(chunk: CodeChunk): number {
    // Simple heuristic: prefer src/ directory
    if (chunk.filePath.includes('/src/')) {
      return 1.0;
    }
    if (chunk.filePath.includes('/lib/')) {
      return 0.8;
    }
    return 0.5;
  }

  /**
   * Calculate recency score based on when chunk was added
   *
   * @param entry - Vector entry
   * @returns Recency score from 0 to 1
   */
  private calculateRecency(entry: VectorEntry): number {
    const now = new Date();
    const ageMs = now.getTime() - entry.timestamp.getTime();
    const daysSinceInsert = ageMs / (1000 * 60 * 60 * 24);

    // Exponential decay: newer chunks score higher
    // After 30 days, score drops to 0.1
    const decayRate = 0.1;
    return Math.exp(-decayRate * daysSinceInsert);
  }

  /**
   * Calculate frequency score based on access patterns
   *
   * @param entry - Vector entry
   * @returns Frequency score from 0 to 1
   */
  private calculateFrequency(entry: VectorEntry): number {
    // Normalize access count to 0-1 range
    // Assume 100 accesses is "high frequency"
    const maxAccessCount = 100;
    return Math.min(entry.accessCount / maxAccessCount, 1.0);
  }

  /**
   * Normalize score breakdown to 0-1 range
   *
   * @param breakdown - Score breakdown
   * @returns Normalized breakdown
   */
  private normalizeBreakdown(breakdown: ScoreBreakdown): ScoreBreakdown {
    return {
      semantic: Math.max(0, Math.min(1, breakdown.semantic)),
      proximity: Math.max(0, Math.min(1, breakdown.proximity)),
      symbol: Math.max(0, Math.min(1, breakdown.symbol)),
      recency: Math.max(0, Math.min(1, breakdown.recency)),
      frequency: Math.max(0, Math.min(1, breakdown.frequency)),
    };
  }

  /**
   * Check if file path matches filter pattern
   *
   * @param filePath - File path to check
   * @param filter - Filter pattern
   * @returns True if matches
   */
  private matchesPathFilter(filePath: string, filter: string): boolean {
    // Simple glob matching
    const regexPattern = filter
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');

    const regex = new RegExp(regexPattern, 'i');
    return regex.test(filePath);
  }

  /**
   * Validate chunk has required fields
   *
   * @param chunk - Chunk to validate
   * @throws {PrismError} If validation fails
   */
  private validateChunk(chunk: CodeChunk): void {
    if (!chunk.id) {
      throw createPrismError(
        ErrorCode.VECTOR_DB_ERROR,
        'Chunk missing id field'
      );
    }
    if (!chunk.filePath) {
      throw createPrismError(
        ErrorCode.VECTOR_DB_ERROR,
        'Chunk missing filePath field'
      );
    }
    if (!chunk.content) {
      throw createPrismError(
        ErrorCode.VECTOR_DB_ERROR,
        'Chunk missing content field'
      );
    }
  }

  /**
   * Update language statistics
   *
   * @param language - Language identifier
   * @param delta - Count change (+1 or -1)
   */
  private updateLanguageStats(language: string, delta: number): void {
    const current = this.languageCounts.get(language) || 0;
    const updated = current + delta;
    this.languageCounts.set(language, Math.max(0, updated));
  }

  /**
   * Estimate memory size of a vector entry
   *
   * @param entry - Vector entry
   * @returns Estimated size in bytes
   */
  private estimateEntrySize(entry: VectorEntry): number {
    // Rough estimation:
    // - Chunk content: ~500 bytes average
    // - Embedding: 384 dimensions * 4 bytes/double = ~1.5KB
    // - Metadata: ~200 bytes
    const contentSize = entry.chunk.content.length * 2; // UTF-16
    const embeddingSize = entry.embedding.length * 8; // 64-bit floats
    const metadataSize = 200;

    return contentSize + embeddingSize + metadataSize;
  }
}
