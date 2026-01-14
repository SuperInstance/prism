/**
 * ============================================================================
 * SCORING FEATURES MODULE
 * ============================================================================
 *
 * Individual feature scoring functions for PRISM's relevance system.
 *
 * Each feature represents a distinct signal for code relevance:
 * - Semantic similarity (40%): Vector embeddings
 * - Symbol matching (25%): Exact/fuzzy string matching
 * - File proximity (20%): Path hierarchy depth
 * - Recency score (10%): Modification time decay
 * - Frequency score (5%): Usage history patterns
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 * ```typescript
 * import { semanticSimilarity } from './features/semanticSimilarity.js';
 * import { symbolMatch } from './features/symbolMatch.js';
 * import { fileProximity } from './features/fileProximity.js';
 * import { recencyScore } from './features/recencyScore.js';
 * import { frequencyScore } from './features/frequencyScore.js';
 *
 * // Calculate individual feature scores
 * const semantic = semanticSimilarity(chunk, query);
 * const symbol = symbolMatch(chunk.name, query.entities);
 * const proximity = fileProximity(chunk, currentFile);
 * const recency = recencyScore(chunk.lastModified, Date.now());
 * const frequency = frequencyScore(chunk.id, usageHistory);
 *
 * // Combine with weights
 * const score = (semantic * 0.40) +
 *               (symbol * 0.25) +
 *               (proximity * 0.20) +
 *               (recency * 0.10) +
 *               (frequency * 0.05);
 * ```
 *
 * ============================================================================
 * @see docs/architecture/02-token-optimizer.md for scoring design
 * ============================================================================
 */

// Export all feature scoring functions
export { semanticSimilarity, cosineSimilarity } from './semanticSimilarity.js';
export { symbolMatch, exactMatch, containsMatch, levenshteinDistance } from './symbolMatch.js';
export { fileProximity, pathDistance, isSameDirectory, getCommonAncestor } from './fileProximity.js';
export { recencyScore, exponentialDecay, calculateAgeInDays, formatAge, recencyScoreWithParams } from './recencyScore.js';
export {
  frequencyScore,
  helpfulRatio,
  frequencyBoost,
  getUsageStats,
  addUsageEntry,
  pruneOldEntries,
} from './frequencyScore.js';
