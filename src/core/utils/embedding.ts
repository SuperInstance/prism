/**
 * Embedding utilities
 *
 * Provides functions for working with vector embeddings,
 * including similarity calculations and vector operations.
 */

import { createPrismError, ErrorCode } from '../types/index.js';

/**
 * Calculate cosine similarity between two vectors
 *
 * Cosine similarity measures the cosine of the angle between two vectors,
 * ranging from -1 (opposite) to 1 (identical). For normalized embeddings,
 * this ranges from 0 to 1.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score from -1 to 1
 * @throws {PrismError} If vector dimensions don't match
 *
 * @example
 * ```ts
 * const a = [1, 2, 3];
 * const b = [1, 2, 3];
 * cosineSimilarity(a, b) // Returns 1.0 (identical)
 * ```
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw createPrismError(
      ErrorCode.INVALID_QUERY,
      `Vector dimensions must match: ${a.length} != ${b.length}`
    );
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    magnitudeA += ai * ai;
    magnitudeB += bi * bi;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Calculate Euclidean distance between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Distance (lower = more similar)
 * @throws {PrismError} If vector dimensions don't match
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw createPrismError(
      ErrorCode.INVALID_QUERY,
      `Vector dimensions must match: ${a.length} != ${b.length}`
    );
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    const diff = ai - bi;
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Calculate dot product of two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Dot product
 * @throws {PrismError} If vector dimensions don't match
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw createPrismError(
      ErrorCode.INVALID_QUERY,
      `Vector dimensions must match: ${a.length} != ${b.length}`
    );
  }

  let product = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    product += ai * bi;
  }

  return product;
}

/**
 * Calculate magnitude (L2 norm) of a vector
 *
 * @param vector - Vector to calculate magnitude for
 * @returns Magnitude
 */
export function magnitude(vector: number[]): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    const v = vector[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length
 *
 * @param vector - Vector to normalize
 * @returns Normalized vector
 */
export function normalize(vector: number[]): number[] {
  const mag = magnitude(vector);
  if (mag === 0) {
    return vector.map(() => 0);
  }
  return vector.map((v) => (v ?? 0) / mag);
}

/**
 * Add two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Sum of vectors
 * @throws {PrismError} If vector dimensions don't match
 */
export function addVectors(a: number[], b: number[]): number[] {
  if (a.length !== b.length) {
    throw createPrismError(
      ErrorCode.INVALID_QUERY,
      `Vector dimensions must match: ${a.length} != ${b.length}`
    );
  }

  const result = new Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = (a[i] ?? 0) + (b[i] ?? 0);
  }
  return result;
}

/**
 * Subtract two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Difference (a - b)
 * @throws {PrismError} If vector dimensions don't match
 */
export function subtractVectors(a: number[], b: number[]): number[] {
  if (a.length !== b.length) {
    throw createPrismError(
      ErrorCode.INVALID_QUERY,
      `Vector dimensions must match: ${a.length} != ${b.length}`
    );
  }

  const result = new Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = (a[i] ?? 0) - (b[i] ?? 0);
  }
  return result;
}

/**
 * Multiply vector by scalar
 *
 * @param vector - Vector to multiply
 * @param scalar - Scalar value
 * @returns Scaled vector
 */
export function scaleVector(vector: number[], scalar: number): number[] {
  return vector.map((v) => (v ?? 0) * scalar);
}

/**
 * Calculate average of multiple vectors
 *
 * @param vectors - Array of vectors to average
 * @returns Average vector
 * @throws {PrismError} If vectors have different dimensions
 */
export function averageVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    return [];
  }

  const dimension = vectors[0]?.length ?? 0;
  const result = new Array(dimension).fill(0);

  for (const vector of vectors) {
    if (vector.length !== dimension) {
      throw createPrismError(
        ErrorCode.INVALID_QUERY,
        'All vectors must have the same dimension'
      );
    }
    for (let i = 0; i < dimension; i++) {
      const v = vector[i] ?? 0;
      result[i] = (result[i] ?? 0) + v;
    }
  }

  return result.map((v) => (v ?? 0) / vectors.length);
}
