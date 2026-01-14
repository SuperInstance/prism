/**
 * Scoring Module
 *
 * Exports the scoring service and related types.
 */

export { ScoringService, createScoringService } from './ScoringService.js';
export type {
  QueryEmbedding,
  ScoringContext,
  RelevanceScore,
  ScoredChunk,
  IScorer,
  ScoringMetrics,
  ScoringServiceConfig,
} from './ScoringService.js';
