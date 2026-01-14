/**
 * Token Optimizer Type Definitions
 *
 * Defines interfaces for intent detection, query analysis,
 * and optimization operations.
 */

/**
 * Intent types for user queries
 */
export type IntentType =
  | 'bug_fix'
  | 'feature_add'
  | 'explain'
  | 'refactor'
  | 'test'
  | 'search'
  | 'general';

/**
 * Query scope
 */
export type QueryScope = 'current_file' | 'current_dir' | 'project' | 'global';

/**
 * Message in conversation history
 */
export interface Message {
  /** Role of message sender */
  role: 'user' | 'assistant' | 'system';

  /** Message content */
  content: string;

  /** Timestamp of message */
  timestamp?: number;
}

/**
 * Query intent with metadata
 */
export interface QueryIntent {
  /** Classified intent type */
  type: IntentType;

  /** The query text */
  query: string;

  /** Query embedding */
  embedding: number[];

  /** Entities extracted from query */
  entities: QueryEntity[];

  /** Scope of the query */
  scope: QueryScope;

  /** Complexity score (0-1) */
  complexity: number;

  /** Whether conversation history is needed */
  requiresHistory: boolean;

  /** Estimated token budget needed */
  estimatedBudget: number;

  /** Optimization options */
  options: OptimizationOptions;
}

/**
 * Entity extracted from query
 */
export interface QueryEntity {
  /** Type of entity */
  type: 'symbol' | 'file' | 'type' | 'keyword';

  /** The entity value */
  value: string;

  /** Confidence score (0-1) */
  confidence: number;

  /** Position in query */
  position?: number;
}

/**
 * Optimization options
 */
export interface OptimizationOptions {
  /** Maximum chunks to select */
  maxChunks?: number;

  /** Minimum relevance threshold */
  minRelevance?: number;

  /** Prefer diverse chunks */
  preferDiversity?: boolean;

  /** Compression aggressiveness */
  compressionLevel?: 'light' | 'medium' | 'aggressive';
}

/**
 * Token budget for optimization
 */
export interface TokenBudgetAllocation {
  /** Total budget */
  total: number;

  /** Reserved for system prompt */
  system: number;

  /** Reserved for user query */
  userQuery: number;

  /** Available for code context */
  context: number;

  /** Reserved for response */
  response: number;
}

/**
 * Scoring context for relevance calculation
 */
export interface ScoringContext {
  /** Current file path */
  currentFile?: string;

  /** Current working directory */
  cwd?: string;

  /** Current timestamp */
  now: number;

  /** Usage history */
  usageHistory: UsageEntry[];

  /** Current language */
  currentLanguage?: string;
}

/**
 * Usage history entry
 */
export interface UsageEntry {
  /** Chunk ID */
  chunkId: string;

  /** Timestamp */
  timestamp: number;

  /** Whether it was helpful */
  helpful: boolean;
}
