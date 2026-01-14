/**
 * ============================================================================
 * FREQUENCY SCORE FEATURE (5% weight)
 * ============================================================================
 *
 * Measures how often and how successfully chunks have been used.
 *
 * ============================================================================
 * WHY FREQUENCY MATTERS (EVENTUALLY)
 * ============================================================================
 *
 * 1. LEARNS FROM USER BEHAVIOR
 *    - Tracks which chunks are actually helpful
 *    - Adapts to individual usage patterns
 *    - Improves over time with feedback
 *
 * 2. CONFIRMATION OF RELEVANCE
 *    - High usage + high helpfulness = strong signal
 *    - Validates other scoring features
 *    - Boosts consistently useful results
 *
 * 3. PERSONALIZATION
 *    - Different users have different patterns
 *    - Team-specific relevance
 *    - Context-dependent helpfulness
 *
 * ============================================================================
 * COLD START PROBLEM
 * ============================================================================
 *
 * Problem:
 * - New chunks have no usage history
 * - Frequency score = 0.0 for all new code
 * - Unfairly penalizes recent additions
 *
 * Solutions:
 *
 * 1. LOW WEIGHT (5%)
 *    - Minimizes impact of missing data
 *    - Other features dominate initially
 *    - Frequency provides gentle boost, not penalty
 *
 * 2. FREQUENCY BOOST
 *    - Rewards usage volume, not just ratio
 *    - Encourages exploration (uses increase over time)
 *    - Balances quality (ratio) and quantity (volume)
 *
 * 3. NEUTRAL BASELINE
 *    - Missing history = 0.0, not negative
 *    - Doesn't punish new chunks
 *    - Only rewards established patterns
 *
 * 4. TIME DECAY (FUTURE)
 *    - Recent uses matter more than old uses
 *    - Adapt to changing codebases
 *    - Prevents staleness
 *
 * ============================================================================
 * SCORING ALGORITHM
 * ============================================================================
 *
 * Two-factor scoring:
 *
 * 1. HELPFUL RATIO (Quality)
 *    - helpful_ratio = helpful_count / total_count
 *    - Range: [0.0, 1.0]
 *    - High ratio = consistently helpful
 *    - Low ratio = often unhelpful
 *
 * 2. FREQUENCY BOOST (Quantity)
 *    - frequency_boost = min(1.0, total_count / 10)
 *    - Range: [0.0, 1.0]
 *    - Rewards usage volume
 *    - Caps at 10 uses (boost = 1.0)
 *
 * 3. FINAL SCORE
 *    - score = helpful_ratio × frequency_boost
 *    - Range: [0.0, 1.0]
 *    - Combines quality and quantity
 *
 * ============================================================================
 * SCORE INTERPRETATION
 * ============================================================================
 *
 * Scenario 1: High Quality, High Volume
 * - Uses: 15, Helpful: 12
 * - Helpful ratio: 12/15 = 0.8
 * - Frequency boost: min(1.0, 15/10) = 1.0
 * - Score: 0.8 × 1.0 = 0.8
 * - Interpretation: Excellent, boost significantly
 *
 * Scenario 2: High Quality, Low Volume
 * - Uses: 3, Helpful: 3
 * - Helpful ratio: 3/3 = 1.0
 * - Frequency boost: min(1.0, 3/10) = 0.3
 * - Score: 1.0 × 0.3 = 0.3
 * - Interpretation: Promising but needs more data
 *
 * Scenario 3: Low Quality, High Volume
 * - Uses: 20, Helpful: 5
 * - Helpful ratio: 5/20 = 0.25
 * - Frequency boost: min(1.0, 20/10) = 1.0
 * - Score: 0.25 × 1.0 = 0.25
 * - Interpretation: Often unhelpful, minimal boost
 *
 * Scenario 4: Low Quality, Low Volume
 * - Uses: 2, Helpful: 1
 * - Helpful ratio: 1/2 = 0.5
 * - Frequency boost: min(1.0, 2/10) = 0.2
 * - Score: 0.5 × 0.2 = 0.1
 * - Interpretation: Not enough data, minimal boost
 *
 * Scenario 5: No History (Cold Start)
 * - Uses: 0, Helpful: 0
 * - Helpful ratio: 0/0 = undefined → 0.0
 * - Frequency boost: min(1.0, 0/10) = 0.0
 * - Score: 0.0 × 0.0 = 0.0
 * - Interpretation: New chunk, no boost (yet)
 *
 * ============================================================================
 * FREQUENCY BOOST RATIONALE
 * ============================================================================
 *
 * Why cap at 10 uses?
 *
 * 1. ENCOURAGES EXPLORATION
 *    - First 10 uses matter most
 *    - Rewards initial usage
 *    - Doesn't require massive data
 *
 * 2. PREVENTS GAMING
 *    - Can't boost score by spamming uses
 *    - Diminishing returns after 10
 *    - Quality matters more than quantity
 *
 * 3. PRACTICAL THRESHOLD
 *    - 10 uses = statistically significant
 *    - Enough data to establish pattern
 *    - Achievable in typical usage
 *
 * ============================================================================
 * FEEDBACK COLLECTION
 * ============================================================================
 *
 * Explicit Feedback:
 * - User clicks "helpful" / "not helpful" button
 * - User rates result quality (1-5 stars)
 * - User selects result from multiple options
 *
 * Implicit Feedback:
 * - User copies code from result
 * - User navigates to result file
 * - User uses result in follow-up query
 * - User doesn't refine query (accepts result)
 *
 * Negative Feedback:
 * - User ignores result
 * - User refines query immediately
 * - User selects different result
 * - User closes results quickly
 *
 * ============================================================================
 * USAGE HISTORY TRACKING
 * ============================================================================
 *
 * Entry Structure:
 * {
 *   chunkId: "chunk-123",
 *   timestamp: 1704067200000,
 *   helpful: true
 * }
 *
 * Storage:
 * - In-memory array (fast, volatile)
 * - Database (persistent, slower)
 * - Hybrid (cache recent, persist all)
 *
 * Privacy:
 * - No query content stored
 * - Only chunk IDs and feedback
 * - Optional: anonymized user ID
 *
 * ============================================================================
 * FUTURE IMPROVEMENTS
 * ============================================================================
 *
 * 1. TIME DECAY
 *    - Recent uses matter more
 *    - Decay similar to recency feature
 *    - Adapt to changing codebases
 *
 * 2. CONTEXT SIMILARITY
 *    - Track query similarity
 *    - Boost chunks helpful for similar queries
 *    - More nuanced than just chunk ID
 *
 * 3. USER PERSONALIZATION
 *    - Per-user frequency scores
 *    - Different patterns for different users
 *    - Collaborative filtering (similar users)
 *
 * 4. CONFIDENCE INTERVALS
 *    - Statistical significance
 *    - Low data = low confidence
 *    - High data = high confidence
 *
 * ============================================================================
 * PERFORMANCE CHARACTERISTICS
 * ============================================================================
 *
 * Time Complexity: O(h)
 * - h = history length (number of usage entries)
 * - Linear scan through history to filter chunk entries
 * - Optimized with indexing (chunkId → entries)
 *
 * Space Complexity: O(h)
 * - Storage for usage history
 * - Grows over time
 * - Requires periodic cleanup/archiving
 *
 * Optimization Strategies:
 * 1. Index by chunkId (Map<chunkId, UsageEntry[]>)
 * 2. Limit history size (keep last N entries)
 * 3. Aggregate statistics (pre-compute helpful ratios)
 * 4. Periodic cleanup (remove old entries)
 *
 * ============================================================================
 * EDGE CASES AND HANDLING
 * ============================================================================
 *
 * 1. NO USAGE HISTORY
 *    - Empty history array
 *    - Return: 0.0 (no frequency signal)
 *    - Reason: Cold start, no data yet
 *
 * 2. CHUNK NOT IN HISTORY
 *    - No entries for this chunk ID
 *    - Return: 0.0 (no usage data)
 *    - Reason: New or rarely used chunk
 *
 * 3. ALL HELPFUL (100% ratio)
 *    - Helpful count = total count
 *    - Helpful ratio = 1.0
 *    - Score = 1.0 × frequency_boost
 *    - Interpretation: Perfect track record
 *
 * 4. NONE HELPFUL (0% ratio)
 *    - Helpful count = 0
 *    - Helpful ratio = 0.0
 *    - Score = 0.0 (regardless of frequency)
 *    - Interpretation: Consistently unhelpful
 *
 * 5. DIVISION BY ZERO
 *    - Total count = 0 (no uses)
 *    - Helpful ratio = 0/0 = undefined
 *    - Return: 0.0 (handle undefined case)
 *    - Reason: Cannot calculate ratio without data
 *
 * ============================================================================
 * USAGE EXAMPLE
 * ============================================================================
 *
 * ```typescript
 * import { frequencyScore } from './features/frequencyScore.js';
 *
 * const chunkId = 'chunk-123';
 * const usageHistory: UsageEntry[] = [
 *   { chunkId: 'chunk-123', timestamp: Date.now(), helpful: true },
 *   { chunkId: 'chunk-123', timestamp: Date.now(), helpful: true },
 *   { chunkId: 'chunk-123', timestamp: Date.now(), helpful: false },
 *   { chunkId: 'chunk-456', timestamp: Date.now(), helpful: true }, // Different chunk
 * ];
 *
 * const score = frequencyScore(chunkId, usageHistory);
 * console.log(`Frequency score: ${score.toFixed(3)}`);
 * // Output: Frequency score: 0.400
 * // Calculation: (2/3) × min(1.0, 3/10) = 0.667 × 0.3 = 0.2
 * ```
 *
 * ============================================================================
 * @see docs/architecture/02-token-optimizer.md for scoring design
 * ============================================================================
 */

import type { UsageEntry } from '../types.js';

/**
 * Calculate frequency score based on usage history
 *
 * Frequently used and helpful chunks get higher scores.
 * Combines helpful ratio with frequency boost.
 *
 * @param chunkId - ID of the chunk to score
 * @param usageHistory - Array of usage history entries
 * @returns Frequency score in range [0.0, 1.0]
 *
 * @example
 * ```typescript
 * const score = frequencyScore('chunk-123', [
 *   { chunkId: 'chunk-123', timestamp: Date.now(), helpful: true },
 *   { chunkId: 'chunk-123', timestamp: Date.now(), helpful: true }
 * ]);
 * // score = 0.2 (2 helpful, 0 unhelpful, 2 total uses)
 * // Calculation: (2/2) × min(1.0, 2/10) = 1.0 × 0.2 = 0.2
 * ```
 */
export function frequencyScore(chunkId: string, usageHistory: UsageEntry[]): number {
  // Handle missing or empty history
  if (!usageHistory || usageHistory.length === 0) {
    return 0.0;
  }

  // Filter entries for this chunk
  const chunkEntries = usageHistory.filter(entry => entry.chunkId === chunkId);

  if (chunkEntries.length === 0) {
    return 0.0;
  }

  // Count helpful uses
  const helpfulCount = chunkEntries.filter(entry => entry.helpful).length;
  const totalCount = chunkEntries.length;

  // Calculate helpful ratio
  const helpfulRatio = helpfulCount / totalCount;

  // Calculate frequency boost (caps at 10 uses)
  const frequencyBoost = Math.min(1.0, totalCount / 10);

  return helpfulRatio * frequencyBoost;
}

/**
 * Calculate helpful ratio (quality score)
 *
 * Returns the proportion of helpful uses to total uses.
 *
 * @param chunkId - ID of the chunk
 * @param usageHistory - Array of usage history entries
 * @returns Helpful ratio in range [0.0, 1.0], or 0.0 if no history
 *
 * @example
 * ```typescript
 * const ratio = helpfulRatio('chunk-123', [
 *   { chunkId: 'chunk-123', timestamp: Date.now(), helpful: true },
 *   { chunkId: 'chunk-123', timestamp: Date.now(), helpful: false },
 *   { chunkId: 'chunk-123', timestamp: Date.now(), helpful: true }
 * ]);
 * // ratio = 0.667 (2 helpful out of 3 total)
 * ```
 */
export function helpfulRatio(chunkId: string, usageHistory: UsageEntry[]): number {
  if (!usageHistory || usageHistory.length === 0) {
    return 0.0;
  }

  const chunkEntries = usageHistory.filter(entry => entry.chunkId === chunkId);

  if (chunkEntries.length === 0) {
    return 0.0;
  }

  const helpfulCount = chunkEntries.filter(entry => entry.helpful).length;
  return helpfulCount / chunkEntries.length;
}

/**
 * Calculate frequency boost (quantity score)
 *
 * Returns a boost based on usage volume, capped at 10 uses.
 *
 * @param chunkId - ID of the chunk
 * @param usageHistory - Array of usage history entries
 * @param cap - Usage count cap (default: 10)
 * @returns Frequency boost in range [0.0, 1.0]
 *
 * @example
 * ```typescript
 * const boost = frequencyBoost('chunk-123', [
 *   { chunkId: 'chunk-123', timestamp: Date.now(), helpful: true },
 *   // ... 15 more entries
 * ]);
 * // boost = 1.0 (capped at 10 uses)
 * ```
 */
export function frequencyBoost(
  chunkId: string,
  usageHistory: UsageEntry[],
  cap: number = 10
): number {
  if (!usageHistory || usageHistory.length === 0) {
    return 0.0;
  }

  const totalCount = usageHistory.filter(entry => entry.chunkId === chunkId).length;

  if (totalCount === 0) {
    return 0.0;
  }

  return Math.min(1.0, totalCount / cap);
}

/**
 * Calculate usage statistics for a chunk
 *
 * Returns detailed statistics about chunk usage.
 *
 * @param chunkId - ID of the chunk
 * @param usageHistory - Array of usage history entries
 * @returns Usage statistics object
 *
 * @example
 * ```typescript
 * const stats = getUsageStats('chunk-123', usageHistory);
 * // {
 * //   totalUses: 15,
 * //   helpfulUses: 12,
 * //   helpfulRatio: 0.8,
 * //   frequencyBoost: 1.0,
 * //   frequencyScore: 0.8
 * // }
 * ```
 */
export function getUsageStats(
  chunkId: string,
  usageHistory: UsageEntry[]
): {
  totalUses: number;
  helpfulUses: number;
  helpfulRatio: number;
  frequencyBoost: number;
  frequencyScore: number;
} {
  if (!usageHistory || usageHistory.length === 0) {
    return {
      totalUses: 0,
      helpfulUses: 0,
      helpfulRatio: 0.0,
      frequencyBoost: 0.0,
      frequencyScore: 0.0,
    };
  }

  const chunkEntries = usageHistory.filter(entry => entry.chunkId === chunkId);

  if (chunkEntries.length === 0) {
    return {
      totalUses: 0,
      helpfulUses: 0,
      helpfulRatio: 0.0,
      frequencyBoost: 0.0,
      frequencyScore: 0.0,
    };
  }

  const totalUses = chunkEntries.length;
  const helpfulUses = chunkEntries.filter(entry => entry.helpful).length;
  const helpfulRatioValue = helpfulUses / totalUses;
  const frequencyBoostValue = Math.min(1.0, totalUses / 10);
  const frequencyScoreValue = helpfulRatioValue * frequencyBoostValue;

  return {
    totalUses,
    helpfulUses,
    helpfulRatio: helpfulRatioValue,
    frequencyBoost: frequencyBoostValue,
    frequencyScore: frequencyScoreValue,
  };
}

/**
 * Add usage entry to history
 *
 * Records a new usage event with feedback.
 *
 * @param chunkId - ID of the chunk that was used
 * @param helpful - Whether the usage was helpful
 * @param usageHistory - Existing usage history (modified in place)
 * @returns Updated usage history
 *
 * @example
 * ```typescript
 * const history = [];
 * const updated = addUsageEntry('chunk-123', true, history);
 * // updated = [{ chunkId: 'chunk-123', timestamp: ..., helpful: true }]
 * ```
 */
export function addUsageEntry(
  chunkId: string,
  helpful: boolean,
  usageHistory: UsageEntry[]
): UsageEntry[] {
  const entry: UsageEntry = {
    chunkId,
    timestamp: Date.now(),
    helpful,
  };

  usageHistory.push(entry);
  return usageHistory;
}

/**
 * Prune old usage entries
 *
 * Removes entries older than specified days to limit history size.
 *
 * @param usageHistory - Existing usage history (modified in place)
 * @param maxAge - Maximum age in days (default: 90)
 * @returns Pruned usage history
 *
 * @example
 * ```typescript
 * const history = [/* ... *\/];
 * const pruned = pruneOldEntries(history, 90);
 * // Removes entries older than 90 days
 * ```
 */
export function pruneOldEntries(
  usageHistory: UsageEntry[],
  maxAge: number = 90
): UsageEntry[] {
  const cutoff = Date.now() - (maxAge * 24 * 60 * 60 * 1000);

  // Filter out old entries
  const pruned = usageHistory.filter(entry => entry.timestamp >= cutoff);

  return pruned;
}
