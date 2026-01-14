/**
 * ============================================================================
 * SEMANTIC SIMILARITY FEATURE (40% weight)
 * ============================================================================
 *
 * Measures vector similarity between query embedding and chunk embedding.
 *
 * ============================================================================
 * ALGORITHM: COSINE SIMILARITY
 * ============================================================================
 *
 * Cosine similarity measures the cosine of the angle between two vectors:
 *
 *                     A · B
 * similarity = -------------------
 *              ||A|| × ||B||
 *
 * Where:
 * - A = query embedding vector (384 or 768 dimensions)
 * - B = chunk embedding vector
 * - A · B = dot product (sum of element-wise multiplications)
 * - ||A|| = magnitude of A (square root of sum of squares)
 * - Result in range [-1, 1], normalized to [0, 1]
 *
 * ============================================================================
 * WHY COSINE SIMILARITY?
 * ============================================================================
 *
 * 1. LENGTH-INVARIANT: Measures angle, not magnitude
 *    - Robust to document length differences
 *    - Long code chunks not penalized
 *    - Short snippets not artificially boosted
 *
 * 2. SEMANTIC FOCUS: Captures meaning, not just keywords
 *    - "user authentication" matches "login", "signin", "auth"
 *    - Finds code with different names but same purpose
 *    - Enables conceptual search beyond exact terms
 *
 * 3. STANDARD APPROACH: Industry best practice
 *    - Used in information retrieval systems
 *    - Well-understood mathematical properties
 *    - Fast to compute (dot product + magnitudes)
 *
 * 4. NORMALIZED OUTPUT: Consistent [0, 1] range
 *    - Easy to interpret and combine with other features
 *    - Works well with weighted scoring
 *    - Enables threshold-based filtering
 *
 * ============================================================================
 * INTERPRETATION OF SCORES
 * ============================================================================
 *
 * Similarity Score Ranges:
 *
 * 1.0 - PERFECT MATCH
 *    - Vectors point in exact same direction
 *    - Identical semantic meaning
 *    - Rare in practice (requires exact duplicates)
 *
 * 0.8-0.9 - VERY HIGH SIMILARITY
 *    - Strong semantic relationship
 *    - Same concept, slightly different wording
 *    - High confidence match
 *
 * 0.5-0.7 - MODERATE SIMILARITY
 *    - Related concepts
 *    - Same domain, different focus
 *    - Good candidate for inclusion
 *
 * 0.3-0.5 - LOW SIMILARITY
 *    - Somewhat related
 *    - May share some context
 *    - Include if space permits
 *
 * < 0.3 - VERY LOW SIMILARITY
 *    - Weakly related or unrelated
 *    - Different domains or concepts
 *    - Exclude unless necessary
 *
 * ============================================================================
 * EMBEDDING DIMENSIONS
 * ============================================================================
 *
 * BGE-small (v1.5):
 * - Dimensions: 384
 * - Performance: Fast computation, good quality
 * - Memory: ~1.5KB per embedding (384 × 4 bytes)
 * - Use case: Free tier, large codebases
 *
 * BGE-base (v1.5):
 * - Dimensions: 768
 * - Performance: Higher quality, more compute
 * - Memory: ~3KB per embedding (768 × 4 bytes)
 * - Use case: Accuracy-critical applications
 *
 * Trade-offs:
 * - More dimensions = Better quality but slower
 * - Fewer dimensions = Faster but less accurate
 * - 384 dimensions is often "good enough" for code
 *
 * ============================================================================
 * PERFORMANCE CHARACTERISTICS
 * ============================================================================
 *
 * Time Complexity: O(d)
 * - d = embedding dimensions (384 or 768)
 * - Linear scan through vector elements
 * - Very fast for individual comparisons
 *
 * Space Complexity: O(1)
 * - No additional storage beyond input vectors
 * - Constant temporary memory for dot product and magnitudes
 *
 * Batch Performance:
 * - Single comparison: < 0.01ms
 * - 100 comparisons: < 1ms
 * - 1000 comparisons: < 10ms
 * - 10000 comparisons: < 100ms
 *
 * Optimizations:
 * - Pre-compute magnitudes for chunk embeddings
 * - Cache query magnitude (same for all comparisons)
 * - Use SIMD instructions if available (WebAssembly)
 *
 * ============================================================================
 * EDGE CASES AND HANDLING
 * ============================================================================
 *
 * 1. MISSING EMBEDDINGS
 *    - Chunk or query has no embedding vector
 *    - Return: 0.0 (no semantic signal)
 *    - Reason: Cannot compute similarity without vectors
 *
 * 2. DIMENSION MISMATCH
 *    - Chunk and query embeddings have different lengths
 *    - Return: 0.0 (incompatible embeddings)
 *    - Reason: Cannot compare vectors of different dimensions
 *    - Prevention: Ensure all embeddings use same model
 *
 * 3. ZERO MAGNITUDE
 *    - One or both vectors have zero length
 *    - Return: 0.0 (invalid vector)
 *    - Reason: Cannot normalize zero vector
 *    - Cause: Bug in embedding generation or storage
 *
 * 4. FLOATING POINT ERRORS
 *    - Cosine similarity slightly outside [-1, 1] range
 *    - Return: Clamped to [0, 1] using Math.max(0, Math.min(1, similarity))
 *    - Reason: Numerical precision issues in computation
 *
 * ============================================================================
 * MATHEMATICAL INTUITION
 * ============================================================================
 *
 * Geometric Interpretation:
 * - Embeddings are points in high-dimensional space
 * - Similar concepts are close together (small angle)
 * - Different concepts are far apart (large angle)
 *
 * Cosine Similarity vs Euclidean Distance:
 * - Cosine: Measures angle only (direction)
 * - Euclidean: Measures both angle and length
 * - For embeddings, angle is more important than length
 *
 * Example in 2D:
 * - A = [1, 0] (pointing right)
 * - B = [0, 1] (pointing up)
 * - Cosine similarity = 0 (90° angle, orthogonal)
 * - Meaning: Completely different concepts
 *
 * - C = [1, 0] (pointing right)
 * - D = [1, 0] (pointing right)
 * - Cosine similarity = 1.0 (0° angle, identical)
 * - Meaning: Same concept
 *
 * ============================================================================
 * USAGE EXAMPLE
 * ============================================================================
 *
 * ```typescript
 * import { semanticSimilarity } from './features/semanticSimilarity.js';
 *
 * const chunk: CodeChunk = {
 *   id: 'chunk-123',
 *   embedding: [0.123, -0.456, 0.789, ...], // 384 dimensions
 *   // ... other fields
 * };
 *
 * const query: QueryEmbedding = {
 *   text: 'user authentication',
 *   vector: [0.234, -0.567, 0.891, ...], // 384 dimensions
 *   // ... other fields
 * };
 *
 * const score = semanticSimilarity(chunk, query);
 * console.log(`Semantic similarity: ${score.toFixed(3)}`);
 * // Output: Semantic similarity: 0.856
 * ```
 *
 * ============================================================================
 * @see docs/research/06-embedding-model-comparison.md for model details
 * @see docs/architecture/02-token-optimizer.md for scoring design
 * ============================================================================
 */

import type { CodeChunk } from '../../core/types/index.js';
import type { QueryEmbedding } from '../types.js';

/**
 * Calculate semantic similarity using cosine similarity
 *
 * Measures the angle between query and chunk embedding vectors.
 * Higher values indicate more semantically similar code.
 *
 * @param chunk - Code chunk with embedding vector
 * @param query - Query embedding with vector
 * @returns Similarity score in range [0.0, 1.0]
 *
 * @example
 * ```typescript
 * const score = semanticSimilarity(chunk, query);
 * // score = 0.85 (high semantic similarity)
 * ```
 */
export function semanticSimilarity(
  chunk: CodeChunk,
  query: QueryEmbedding
): number {
  // Handle missing embeddings
  if (!chunk.embedding || !query.vector) {
    return 0.0;
  }

  // Ensure embeddings have same dimension
  if (chunk.embedding.length !== query.vector.length) {
    return 0.0;
  }

  // Calculate cosine similarity: (A . B) / (||A|| * ||B||)
  const dotProduct = calculateDotProduct(chunk.embedding, query.vector);
  const magnitudeChunk = calculateMagnitude(chunk.embedding);
  const magnitudeQuery = calculateMagnitude(query.vector);

  // Handle zero magnitude (invalid vectors)
  if (magnitudeChunk === 0 || magnitudeQuery === 0) {
    return 0.0;
  }

  const similarity = dotProduct / (magnitudeChunk * magnitudeQuery);

  // Clamp to [0, 1] and handle floating point errors
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Calculate dot product of two vectors
 *
 * Dot product = sum of element-wise multiplications
 *
 * Formula: A · B = Σ(A[i] × B[i]) for i in [0, n)
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Dot product (scalar value)
 *
 * Time Complexity: O(n) where n = vector length
 * Space Complexity: O(1) - constant temporary storage
 *
 * @example
 * ```typescript
 * const a = [1, 2, 3];
 * const b = [4, 5, 6];
 * const dot = calculateDotProduct(a, b);
 * // dot = 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
 * ```
 */
function calculateDotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Calculate magnitude (L2 norm) of a vector
 *
 * Magnitude = square root of sum of squares
 *
 * Formula: ||A|| = sqrt(Σ(A[i]²)) for i in [0, n)
 *
 * Also known as:
 * - Euclidean norm
 * - L2 norm
 * - Vector length
 *
 * @param vector - Vector to measure
 * @returns Magnitude (non-negative scalar)
 *
 * Time Complexity: O(n) where n = vector length
 * Space Complexity: O(1) - constant temporary storage
 *
 * @example
 * ```typescript
 * const v = [3, 4];
 * const mag = calculateMagnitude(v);
 * // mag = sqrt(9 + 16) = sqrt(25) = 5
 * ```
 */
function calculateMagnitude(vector: number[]): number {
  let sum = 0;
  for (const v of vector) {
    sum += v * v;
  }
  return Math.sqrt(sum);
}

/**
 * Calculate cosine similarity between two vectors (standalone version)
 *
 * This is a convenience function that combines the above steps.
 * Useful for one-off calculations without chunk/query objects.
 *
 * @param vectorA - First vector
 * @param vectorB - Second vector
 * @returns Cosine similarity in range [-1, 1], clamped to [0, 1]
 *
 * @example
 * ```typescript
 * const a = [1, 0, 0];
 * const b = [0, 1, 0];
 * const sim = cosineSimilarity(a, b);
 * // sim = 0 (orthogonal vectors, 90° angle)
 * ```
 */
export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    return 0.0;
  }

  const dotProduct = calculateDotProduct(vectorA, vectorB);
  const magnitudeA = calculateMagnitude(vectorA);
  const magnitudeB = calculateMagnitude(vectorB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0.0;
  }

  const similarity = dotProduct / (magnitudeA * magnitudeB);
  return Math.max(0, Math.min(1, similarity));
}
