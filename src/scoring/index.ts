/**
 * ============================================================================
 * SCORING MODULE EXPORTS
 * ============================================================================
 *
 * Complete scoring system for PRISM relevance calculation.
 *
 * Exports:
 * - Type definitions for scoring system
 * - RelevanceScorer (main implementation)
 * - Individual feature scoring functions
 *
 * ============================================================================
 * MODULE STRUCTURE
 * ============================================================================
 *
 * types/
 * - QueryEmbedding, ScoringContext, ScoreFeatures, etc.
 * - Interfaces for scoring system
 *
 * scores/
 * - RelevanceScorer: Main 5-feature scoring implementation
 *
 * features/
 * - Individual feature scoring functions
 * - Standalone utilities for each feature
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 * ```typescript
 * import { RelevanceScorer } from './scoring/index.js';
 *
 * const scorer = new RelevanceScorer();
 * const scores = await scorer.scoreBatch(chunks, query, context);
 * ```
 *
 * ============================================================================
 * @see docs/architecture/02-token-optimizer.md for scoring design
 * ============================================================================
 */

// Type definitions
export * from './types.js';

// Main scoring implementation
export * from './scores/RelevanceScorer.js';

// Individual feature functions
export * from './features/index.js';
