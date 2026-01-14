/**
 * ============================================================================
 * SCORING SYSTEM TYPE DEFINITIONS
 * ============================================================================
 *
 * Defines the complete type system for PRISM's multi-feature relevance scoring.
 *
 * ============================================================================
 * TYPE SYSTEM ARCHITECTURE
 * ============================================================================
 *
 * The scoring type system is organized into layers:
 *
 * 1. INPUT LAYER (Query + Context)
 *    - QueryEmbedding: User query converted to vectors + entities
 *    - ScoringContext: Environment state (current file, time, history)
 *
 * 2. FEATURE LAYER (Individual Scores)
 *    - ScoreFeatures: Collection of 5 normalized feature scores
 *    - Each feature: 0.0 (no relevance) to 1.0 (perfect relevance)
 *
 * 3. OUTPUT LAYER (Final Results)
 *    - RelevanceScore: Final weighted score + feature breakdown
 *    - Enables debugging, analysis, and weight tuning
 *
 * 4. INTERFACE LAYER (Plugin System)
 *    - IScorer: Interface for implementing custom scorers
 *    - Enables extensibility and experimentation
 *
 * ============================================================================
 * DESIGN PRINCIPLES
 * ============================================================================
 *
 * 1. IMMUTABILITY: All inputs are readonly, preventing accidental mutation
 * 2. NORMALIZATION: All scores in [0.0, 1.0] for consistent interpretation
 * 3. COMPOSABILITY: Features can be combined with different weights
 * 4. DEBUGGABILITY: Full breakdown preserved for analysis
 * 5. EXTENSIBILITY: Interface allows custom scoring strategies
 *
 * ============================================================================
 * FEATURE WEIGHTS (Sum = 1.0)
 * ============================================================================
 *
 * The five features are weighted to reflect their relative importance:
 *
 * - Semantic:    40% (0.40) - Vector similarity, most robust signal
 * - Symbol:      25% (0.25) - Exact matches, high confidence
 * - Proximity:   20% (0.20) - Code locality, strong heuristic
 * - Recency:     10% (0.10) - Recent changes, time-based decay
 * - Frequency:    5% (0.05) - Usage patterns, learning signal
 *
 * Final Score = Σ(feature_i × weight_i) for all i
 *
 * ============================================================================
 * @see docs/architecture/02-token-optimizer.md for design details
 * @see src/scoring/scores/RelevanceScorer.ts for implementation
 * ============================================================================
 */

import { CodeChunk } from '../core/types/index.js';

/**
 * ============================================================================
 * QUERY EMBEDDING (Input Layer)
 * ============================================================================
 *
 * Represents a user query converted to a multi-dimensional representation
 * for semantic comparison with code chunks.
 *
 * ============================================================================
 * VECTOR EMBEDDING SPECIFICATIONS
 * ============================================================================
 *
 * Supported Embedding Models:
 *
 * 1. BGE-small (v1.5)
 *    - Dimensions: 384
 *    - Range: Normalized to unit length
 *    - Use: Fast, good quality, free tier friendly
 *
 * 2. BGE-base (v1.5)
 *    - Dimensions: 768
 *    - Range: Normalized to unit length
 *    - Use: Higher quality, more compute
 *
 * 3. Code-specific models (experimental)
 *    - CodeBERT, GraphCodeBERT, etc.
 *    - May have different dimensionality
 *
 * Embedding Generation Process:
 * 1. Text preprocessing (lowercase, remove special chars)
 * 2. Tokenization (model-specific tokenizer)
 * 3. Model inference (forward pass through neural network)
 * 4. Normalization (L2 norm to unit length)
 * 5. Storage as float32 array (384 or 768 dimensions)
 *
 * ============================================================================
 * ENTITY EXTRACTION
 * ============================================================================
 *
 * Entities are extracted from the query using NLP techniques:
 *
 * Extraction Methods:
 * 1. Symbol extraction: Identifiers (function names, class names)
 *    - Pattern: [A-Z][a-zA-Z0-9_]* (camelCase, PascalCase)
 *    - Example: "getUserById" → {type: 'symbol', value: 'getUserById'}
 *
 * 2. File extraction: File paths and extensions
 *    - Pattern: [a-zA-Z0-9_/\\-]+\.[a-z]+
 *    - Example: "auth/Login.tsx" → {type: 'file', value: 'auth/Login.tsx'}
 *
 * 3. Type extraction: Type annotations and generics
 *    - Pattern: [A-Z][a-zA-Z0-9_<>[\]]*
 *    - Example: "UserResponse" → {type: 'type', value: 'UserResponse'}
 *
 * 4. Keyword extraction: Programming keywords and operators
 *    - Pattern: (async|await|const|let|var|function|class|interface)
 *    - Example: "async function" → {type: 'keyword', value: 'async'}
 *
 * Entity Confidence:
 * - High confidence: Exact symbol matches from codebase
 * - Medium confidence: Type names and keywords
 * - Low confidence: Fuzzy matches, abbreviations
 *
 * ============================================================================
 * EXAMPLE
 * ============================================================================
 *
 * Input Query: "How does the authenticateUser function work?"
 *
 * QueryEmbedding:
 * {
 *   text: "How does the authenticateUser function work?",
 *   vector: [0.123, -0.456, 0.789, ...], // 384 dimensions
 *   entities: [
 *     { type: 'symbol', value: 'authenticateUser', confidence: 0.95 },
 *     { type: 'keyword', value: 'function', confidence: 0.80 }
 *   ]
 * }
 */
export interface QueryEmbedding {
  /**
   * The original query text from the user
   *
   * Used for:
   * - Debugging and logging
   * - Entity extraction
   * - Cache key generation
   *
   * Stored as-is for reproducibility
   */
  text: string;

  /**
   * Vector embedding of the query
   *
   * Generated by embedding model (BGE-small, BGE-base, etc.)
   *
   * Specifications:
   * - Type: float32 array
   * - Dimensions: 384 (BGE-small) or 768 (BGE-base)
   * - Range: Normalized to unit length (L2 norm = 1.0)
   * - Purpose: Semantic similarity comparison
   *
   * Cosine Similarity Formula:
   * similarity = (A · B) / (||A|| × ||B||)
   *
   * Where:
   * - A = query.vector
   * - B = chunk.embedding
   * - Result in range [0.0, 1.0]
   */
  vector: number[];

  /**
   * Entities extracted from the query
   *
   * Used for symbol matching feature (25% weight)
   *
   * Extraction Process:
   * 1. Tokenize query text
   * 2. Identify programming constructs (symbols, files, types)
   * 3. Classify by entity type
   * 4. Extract value and position
   *
   * Entity Types:
   * - symbol: Function/class names, variables
   * - file: File paths and extensions
   * - type: Type annotations, generics
   * - keyword: Programming keywords, operators
   *
   * Matching Priority:
   * 1. Symbol (highest priority)
   * 2. Keyword
   * 3. Type
   * 4. File (lowest priority for code search)
   */
  entities: QueryEntity[];
}

/**
 * ============================================================================
 * QUERY ENTITY (Symbol Extraction)
 * ============================================================================
 *
 * Represents a single programming construct extracted from the user query.
 *
 * Used by the symbol matching feature to find exact or fuzzy matches
 * in code chunk names (functions, classes, variables).
 *
 * ============================================================================
 * ENTITY TYPE TAXONOMY
 * ============================================================================
 *
 * SYMBOL (Highest Priority)
 * - Definition: Identifiers representing code constructs
 * - Examples: getUserById, authenticateUser, MAX_RETRIES
 * - Matching: Exact match = 1.0, fuzzy = 0.6 × similarity
 * - Use case: "Find the login function"
 *
 * KEYWORD (Second Priority)
 * - Definition: Language keywords and operators
 * - Examples: async, await, const, interface, enum
 * - Matching: Exact match in chunk content
 * - Use case: "Show me async functions"
 *
 * TYPE (Third Priority)
 * - Definition: Type annotations and generic parameters
 * - Examples: UserResponse, Array<string>, Promise<void>
 * - Matching: Exact match in type definitions
 * - Use case: "Where is UserResponse defined?"
 *
 * FILE (Lowest Priority)
 * - Definition: File paths and extensions
 * - Examples: auth/Login.tsx, utils/helpers.ts
 * - Matching: Path prefix/suffix match
 * - Use case: "Show code in auth directory"
 *
 * ============================================================================
 * MATCHING BEHAVIOR
 * ============================================================================
 *
 * Exact Match (1.0):
 * - Entity value exactly equals chunk name
 * - Example: "getUserById" === "getUserById"
 *
 * Contains Match (0.8):
 * - One string contains the other
 * - Example: "User" in "getUserById"
 *
 * Fuzzy Match (0.6 × similarity):
 * - Levenshtein distance-based similarity
 * - Example: "authUser" vs "authenticateUser"
 * - Formula: 1 - (edit_distance / max_length)
 *
 * No Match (0.0):
 * - No similarity detected
 */
export interface QueryEntity {
  /**
   * Type of entity extracted from query
   *
   * Determines matching behavior and priority:
   *
   * 'symbol':
   *   - Function names, class names, variables
   *   - Highest priority for matching
   *   - Examples: getUserById, authenticateUser
   *
   * 'file':
   *   - File paths and extensions
   *   - Used for file-level filtering
   *   - Examples: auth/Login.tsx, utils/helpers.ts
   *
   * 'type':
   *   - Type annotations and generics
   *   - Used for type-based search
   *   - Examples: UserResponse, Array<string>
   *
   * 'keyword':
   *   - Language keywords and operators
   *   - Used for language-specific patterns
   *   - Examples: async, await, const, interface
   */
  type: 'symbol' | 'file' | 'type' | 'keyword';

  /**
   * The entity value (string to match against)
   *
   * Extraction Rules:
   * - Case-insensitive matching
   * - Trimmed whitespace
   * - Original casing preserved for display
   *
   * Examples:
   * - Symbol: "authenticateUser"
   * - File: "auth/Login.tsx"
   * - Type: "UserResponse"
   * - Keyword: "async"
   */
  value: string;

  /**
   * Position in the original query (for debugging)
   *
   * Zero-based character index where the entity starts
   *
   * Uses:
   * - Debugging entity extraction
   * - Highlighting matches in UI
   * - Entity disambiguation
   *
   * Optional: Not used in scoring, only for debugging
   */
  position?: number;
}

/**
 * ============================================================================
 * SCORING CONTEXT (Environment State)
 * ============================================================================
 *
 * Provides environmental context for scoring operations.
 *
 * Context enables features that depend on the current state:
 * - File proximity (where is the user working?)
 * - Recency scoring (what time is it now?)
 * - Frequency tracking (what has been helpful before?)
 *
 * ============================================================================
 * CONTEXT FIELDS
 * ============================================================================
 *
 * CURRENT FILE (Proximity Scoring)
 * - Path to the file the user is currently editing
 * - Used to calculate file proximity scores (20% weight)
 * - Same file = 1.0, same directory = 0.8, etc.
 *
 * CURRENT TIME (Recency Scoring)
 * - Unix timestamp (milliseconds since epoch)
 * - Used to calculate age of code modifications
 * - Enables exponential decay (30-day half-life)
 *
 * USAGE HISTORY (Frequency Scoring)
 * - Array of past chunk usages with feedback
 * - Used to boost historically helpful chunks (5% weight)
 * - Requires user feedback loop
 *
 * CWD (Fallback Proximity)
 * - Current working directory
 * - Used if currentFile is not available
 * - Provides approximate proximity scoring
 *
 * LANGUAGE (Future Enhancement)
 * - Language of the current file
 * - Could be used for language-specific scoring
 * - Not currently used in main scoring algorithm
 */
export interface ScoringContext {
  /**
   * Current file path for proximity calculation
   *
   * Used by file proximity feature (20% weight)
   *
   * Scoring Rules:
   * - Same file: 1.0 (actively working on it)
   * - Same directory: 0.8 (related context)
   * - Different directories: 0.8 - (distance × 0.1)
   * - No common ancestry: 0.05 (unrelated)
   *
   * Path Format:
   * - Absolute or relative paths supported
   * - Normalized to forward slashes
   * - Case-sensitive on Unix, insensitive on Windows
   *
   * Example:
   * - currentFile: "/home/user/project/src/auth/Login.tsx"
   * - chunk: "/home/user/project/src/auth/User.tsx"
   * - Score: 0.8 (same directory)
   *
   * Optional: If not provided, uses cwd as fallback
   */
  currentFile?: string;

  /**
   * Current timestamp for recency calculation
   *
   * Unix timestamp in milliseconds since epoch
   *
   * Used by recency feature (10% weight) to calculate code age:
   * age_in_days = (now - chunk.lastModified) / (1000 × 60 × 60 × 24)
   *
   * Decay Formula:
   * decay = 0.5^(age_in_days / 30)
   * score = max(0.1, decay)
   *
   * Examples:
   * - Same day (age = 0): score = 1.0
   * - 30 days ago: score = 0.5
   * - 60 days ago: score = 0.25
   * - 90+ days ago: score = 0.1 (minimum)
   *
   * Required: Must be provided for recency scoring
   */
  now: number;

  /**
   * Usage history for frequency scoring
   *
   * Array of past chunk usages with user feedback
   *
   * Used by frequency feature (5% weight) to boost helpful chunks
   *
   * Scoring Algorithm:
   * 1. Filter history for this chunk ID
   * 2. Count helpful uses (user marked as useful)
   * 3. Calculate helpful_ratio = helpful / total
   * 4. Calculate frequency_boost = min(1.0, total / 10)
   * 5. Score = helpful_ratio × frequency_boost
   *
   * Cold Start Problem:
   * - New chunks have no history → score = 0.0
   * - Low weight (5%) until more data collected
   * - Will increase as system learns
   *
   * Example:
   * - Chunk used 15 times, 12 helpful
   * - helpful_ratio = 12/15 = 0.8
   * - frequency_boost = min(1.0, 15/10) = 1.0
   * - score = 0.8 × 1.0 = 0.8
   *
   * Required: Can be empty array, but must be provided
   */
  usageHistory: UsageEntry[];

  /**
   * Current working directory
   *
   * Used as fallback for proximity scoring if currentFile is not available
   *
   * Scoring Rules (when currentFile not available):
   * - Same directory: 0.8
   * - Parent/child directory: 0.7
   * - Sibling directory: 0.6
   * - Distant directories: 0.05
   *
   * Example:
   * - cwd: "/home/user/project"
   * - chunk: "/home/user/project/src/auth/User.tsx"
   * - Relative path: "src/auth/User.tsx"
   * - Score: 0.6 (subdirectory)
   *
   * Optional: Only used if currentFile is not provided
   */
  cwd?: string;

  /**
   * Language of the current file
   *
   * Examples: "typescript", "python", "rust", "go"
   *
   * Potential Uses:
   * - Language-specific scoring adjustments
   * - Syntax-aware matching
   * - Framework-specific patterns
   *
   * Current Status:
   * - Not used in main scoring algorithm
   * - Reserved for future enhancements
   * - Could be used for:
   *   - Boosting same-language chunks
   *   - Language-specific symbol matching
   *   - Framework-aware relevance
   *
   * Optional: Not currently used in scoring
   */
  currentLanguage?: string;
}

/**
 * ============================================================================
 * USAGE ENTRY (Feedback Tracking)
 * ============================================================================
 *
 * Records a single usage event with user feedback.
 *
 * Used by the frequency feature to learn which chunks are helpful
 * over time through explicit user feedback.
 *
 * ============================================================================
 * FEEDBACK LOOP
 * ============================================================================
 *
 * 1. User submits query
 * 2. System returns ranked chunks
 * 3. User selects/uses a chunk
 * 4. User marks as helpful or not (optional)
 * 5. System records usage entry
 * 6. Future queries boost helpful chunks
 *
 * ============================================================================
 * COLD START PROBLEM
 * ============================================================================
 *
 * Problem:
 * - New chunks have no usage history
 * - Frequency score = 0.0 for new chunks
 * - May unfairly penalize new code
 *
 * Solutions:
 * 1. Low weight (5%) - minimizes impact
 * 2. Frequency boost - rewards usage volume
 * 3. Time decay - recent uses matter more
 * 4. Neutral baseline - unknown = 0.0, not negative
 *
 * Future Improvements:
 * - Add time decay to usage entries
 * - Track query similarity (not just chunk ID)
 * - User personalization (individual preferences)
 * - Collaborative filtering (similar users)
 */
export interface UsageEntry {
  /**
   * Chunk ID that was used
   *
   * Links this usage to a specific code chunk
   *
   * Used to:
   * - Filter history for specific chunks
   * - Aggregate usage statistics
   * - Calculate helpful ratios
   *
   * Format:
   * - UUID or unique string identifier
   * - Must match CodeChunk.id exactly
   *
   * Example: "550e8400-e29b-41d4-a716-446655440000"
   */
  chunkId: string;

  /**
   * Timestamp of usage
   *
   * Unix timestamp in milliseconds since epoch
   *
   * Used to:
   * - Calculate recency of usage
   * - Apply time decay (future feature)
   * - Detect usage patterns over time
   *
   * Current Status:
   * - Not currently used in scoring
   * - Reserved for future time-based decay
   *
   * Future Use:
   * - Recent uses matter more than old uses
   * - Decay similar to recency feature
   * - Helps adapt to changing codebases
   *
   * Example: 1704067200000 (Jan 1, 2024)
   */
  timestamp: number;

  /**
   * Whether the usage resulted in a successful outcome
   *
   * User feedback on whether the chunk was helpful
   *
   * Scoring Impact:
   * - true: Counts toward helpful_count
   * - false: Counts toward total_count but not helpful
   * - Used to calculate helpful_ratio = helpful / total
   *
   * Feedback Collection:
   * - Explicit: User clicks "helpful" button
   * - Implicit: User copies code, navigates to file
   * - Negative: User ignores result, refines query
   *
   * Example:
   * - 15 uses total, 12 helpful
   * - helpful_ratio = 12/15 = 0.8
   * - High ratio → High frequency score
   */
  helpful: boolean;
}

/**
 * ============================================================================
 * SCORE FEATURES (Feature Layer)
 * ============================================================================
 *
 * Collection of all five individual feature scores.
 *
 * Each feature is normalized to [0.0, 1.0] for consistent interpretation:
 * - 0.0: No relevance for this feature
 * - 1.0: Perfect relevance for this feature
 *
 * Features are combined using weighted sum:
 * final_score = Σ(feature_i × weight_i)
 *
 * ============================================================================
 * FEATURE BREAKDOWN
 * ============================================================================
 *
 * SEMANTIC (40% weight)
 * - Vector similarity using cosine similarity
 * - Range: [0.0, 1.0]
 * - Computation: O(d) where d = embedding dimension
 * - Robustness: High (works across terminology)
 *
 * PROXIMITY (20% weight)
 * - Path hierarchy distance
 * - Range: [0.05, 1.0]
 * - Computation: O(p) where p = path depth
 * - Robustness: Medium (depends on project structure)
 *
 * SYMBOL (25% weight)
 * - Exact and fuzzy string matching
 * - Range: [0.0, 1.0]
 * - Computation: O(e × l²) where e = entities, l = string length
 * - Robustness: High when present, low otherwise
 *
 * RECENCY (10% weight)
 * - Exponential decay based on modification time
 * - Range: [0.1, 1.0]
 * - Computation: O(1)
 * - Robustness: Medium (may miss old but relevant code)
 *
 * FREQUENCY (5% weight)
 * - Historical usage pattern
 * - Range: [0.0, 1.0]
 * - Computation: O(h) where h = history length
 * - Robustness: Low initially (cold start), improves over time
 *
 * ============================================================================
 * DEBUGGING AND TUNING
 * ============================================================================
 *
 * The breakdown enables:
 * 1. Debugging: Understand why a chunk scored high/low
 * 2. Tuning: Adjust weights based on feature effectiveness
 * 3. Analysis: Identify which features drive relevance
 * 4. Transparency: Show users why results were selected
 *
 * Example Breakdown:
 * {
 *   semantic: 0.85,    // High semantic similarity
 *   proximity: 1.0,    // Same file
 *   symbol: 0.9,       // Exact name match
 *   recency: 0.7,      // Modified recently
 *   frequency: 0.3     // Some usage history
 * }
 *
 * Final Score:
 * 0.85×0.40 + 1.0×0.20 + 0.9×0.25 + 0.7×0.10 + 0.3×0.05
 * = 0.34 + 0.20 + 0.225 + 0.07 + 0.015
 * = 0.85 (highly relevant)
 */
export interface ScoreFeatures {
  /**
   * Semantic similarity from vector comparison
   *
   * Algorithm: Cosine similarity between embeddings
   * Formula: (A · B) / (||A|| × ||B||)
   * Range: [0.0, 1.0] (clamped, handles floating point errors)
   *
   * Intuition:
   * - 1.0: Identical vectors (perfect match)
   * - 0.8-0.9: Very similar concepts
   * - 0.5-0.7: Related concepts
   * - 0.3-0.5: Somewhat related
   * - < 0.3: Weakly related or unrelated
   *
   * Edge Cases:
   * - Missing embeddings: 0.0
   * - Dimension mismatch: 0.0
   * - Zero magnitude: 0.0
   *
   * Weight: 40% (highest)
   * Performance: O(d) where d = 384 or 768
   */
  semantic: number;

  /**
   * File proximity to current location
   *
   * Algorithm: Path hierarchy depth
   * Range: [0.05, 1.0]
   *
   * Scoring Rules:
   * - Same file: 1.0 (actively working on it)
   * - Same directory: 0.8 (related context)
   * - Different directories: 0.8 - (distance × 0.1)
   * - No common ancestry: 0.05 (unrelated)
   *
   * Distance Calculation:
   * - Split paths into directories
   * - Find common prefix length
   * - Distance = (chunk_depth - common) + (current_depth - common)
   *
   * Example:
   * - Chunk: /src/components/Button.tsx
   * - Current: /src/components/Input.tsx
   * - Common: /src/components/
   * - Score: 0.8 (same directory)
   *
   * Weight: 20%
   * Performance: O(p) where p = path depth (cached)
   */
  proximity: number;

  /**
   * Symbol/name matching score
   *
   * Algorithm: Exact and fuzzy string matching
   * Range: [0.0, 1.0]
   *
   * Matching Priority:
   * 1. Exact match: 1.0 (chunkName === entity)
   * 2. Contains match: 0.8 (one contains the other)
   * 3. Fuzzy match: 0.6 × levenshtein_similarity
   *
   * Levenshtein Distance:
   * - Minimum edit distance between strings
   * - Operations: insert, delete, substitute (cost = 1)
   * - Similarity = 1 - (distance / max_length)
   *
   * Example:
   * - Chunk: "authenticateUser"
   * - Entity: "authUser"
   * - Distance: 6 edits
   * - Similarity: 1 - (6/15) = 0.6
   * - Score: 0.6 × 0.6 = 0.36
   *
   * Weight: 25%
   * Performance: O(e × l²) where e = entities, l = string length
   */
  symbol: number;

  /**
   * Recency based on modification time
   *
   * Algorithm: Exponential decay with 30-day half-life
   * Range: [0.1, 1.0]
   *
   * Formula:
   * - age_in_days = (now - lastModified) / (1000 × 60 × 60 × 24)
   * - decay = 0.5^(age_in_days / 30)
   * - score = max(0.1, decay)
   *
   * Decay Examples:
   * - Today (age = 0): score = 1.0
   * - 30 days ago: score = 0.5
   * - 60 days ago: score = 0.25
   * - 90+ days ago: score = 0.1 (minimum)
   *
   * Edge Cases:
   * - Missing lastModified: 0.5 (neutral)
   * - Future timestamps: 1.0 (very recent)
   *
   * Weight: 10%
   * Performance: O(1)
   */
  recency: number;

  /**
   * Historical usage frequency
   *
   * Algorithm: Helpful ratio × frequency boost
   * Range: [0.0, 1.0]
   *
   * Formula:
   * - helpful_ratio = helpful_count / total_count
   * - frequency_boost = min(1.0, total_count / 10)
   * - score = helpful_ratio × frequency_boost
   *
   * Intuition:
   * - High helpful ratio + high frequency → High score
   * - Low helpful ratio + high frequency → Low score
   * - High helpful ratio + low frequency → Medium score
   * - Low helpful ratio + low frequency → Low score
   *
   * Example:
   * - 15 uses total, 12 helpful
   * - helpful_ratio = 12/15 = 0.8
   * - frequency_boost = min(1.0, 15/10) = 1.0
   * - score = 0.8 × 1.0 = 0.8
   *
   * Weight: 5% (lowest, due to cold start)
   * Performance: O(h) where h = history length
   */
  frequency: number;
}

/**
 * ============================================================================
 * RELEVANCE SCORE (Output Layer)
 * ============================================================================
 *
 * Final result of scoring a code chunk against a query.
 *
 * Contains both the final score and detailed feature breakdown
 * for debugging, analysis, and transparency.
 *
 * ============================================================================
 * SCORE INTERPRETATION
 * ============================================================================
 *
 * Score Range: [0.0, 1.0]
 *
 * Score Ranges:
 * - > 0.7: Highly relevant (include immediately)
 * - 0.5-0.7: Moderately relevant (good candidate)
 * - 0.3-0.5: Somewhat relevant (consider if space)
 * - < 0.3: Weak relevance (exclude unless needed)
 *
 * ============================================================================
 * BREAKDOWN ANALYSIS
 * ============================================================================
 *
 * The breakdown enables understanding which features drove the score:
 *
 * Example 1: Perfect Match
 * {
 *   semantic: 0.95,    // Very high semantic similarity
 *   proximity: 1.0,    // Same file
 *   symbol: 1.0,       // Exact match
 *   recency: 0.9,      // Very recent
 *   frequency: 0.8     // Often helpful
 * }
 * → Score: 0.93 (include immediately)
 *
 * Example 2: Semantic Match, Distant File
 * {
 *   semantic: 0.85,    // High semantic similarity
 *   proximity: 0.2,    // Different module
 *   symbol: 0.3,       // Partial name match
 *   recency: 0.5,      // Modified recently
 *   frequency: 0.4     // Some helpfulness
 * }
 * → Score: 0.52 (good candidate)
 *
 * Example 3: Weak Match
 * {
 *   semantic: 0.3,     // Somewhat related
 *   proximity: 0.05,   // Different project
 *   symbol: 0.0,       // No name match
 *   recency: 0.1,      // Very old
 *   frequency: 0.0     // No history
 * }
 * → Score: 0.16 (exclude)
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 * 1. Sorting: Rank chunks by score descending
 * 2. Filtering: Exclude chunks below threshold (e.g., 0.3)
 * 3. Budgeting: Select top N chunks within token budget
 * 4. Debugging: Inspect breakdown to understand ranking
 * 5. Tuning: Adjust weights based on feature effectiveness
 */
export interface RelevanceScore {
  /**
   * The chunk being scored
   *
   * Reference to the original CodeChunk object
   *
   * Used to:
   * - Retrieve chunk content for inclusion
   * - Display results to user
   * - Link back to source file
   *
   * Contains:
   * - id: Unique identifier
   * - filePath: Source file path
   * - name: Function/class name
   * - content: Code content
   * - embedding: Vector embedding
   * - metadata: Additional info (language, startLine, etc.)
   */
  chunk: CodeChunk;

  /**
   * Overall relevance score (0-1)
   *
   * Weighted sum of all five features:
   * score = (semantic × 0.40) +
   *         (symbol × 0.25) +
   *         (proximity × 0.20) +
   *         (recency × 0.10) +
   *         (frequency × 0.05)
   *
   * Range: [0.0, 1.0]
   * - 0.0: No relevance (all features zero)
   * - 1.0: Perfect relevance (all features max)
   *
   * Interpretation:
   * - > 0.7: Highly relevant
   * - 0.5-0.7: Moderately relevant
   * - 0.3-0.5: Somewhat relevant
   * - < 0.3: Weak relevance
   *
   * Used for:
   * - Sorting results (descending)
   * - Filtering by threshold
   * - Selecting top N within budget
   */
  score: number;

  /**
   * Detailed breakdown of scoring
   *
   * Individual scores for each of the five features
   *
   * Used for:
   * - Debugging: Understand why chunk scored this way
   * - Analysis: Identify which features drive relevance
   * - Tuning: Adjust weights based on effectiveness
   * - Transparency: Show users why result was selected
   *
   * Feature Weights:
   * - semantic: 40% (highest)
   * - symbol: 25%
   * - proximity: 20%
   * - recency: 10%
   * - frequency: 5% (lowest)
   *
   * All values in [0.0, 1.0]
   */
  breakdown: ScoreFeatures;
}

/**
 * ============================================================================
 * SCORER INTERFACE (Plugin System)
 * ============================================================================
 *
 * Defines the contract for implementing custom scoring strategies.
 *
 * Enables:
 * 1. Extensibility: Add new scoring algorithms
 * 2. Experimentation: A/B test different approaches
 * 3. Specialization: Domain-specific scorers
 * 4. Composition: Combine multiple scorers
 *
 * ============================================================================
 * IMPLEMENTATION GUIDELINES
 * ============================================================================
 *
 * Required Methods:
 * 1. score(): Score a single chunk
 * 2. scoreBatch(): Score multiple chunks efficiently
 *
 * Optional Methods:
 * 1. initialize(): Async setup (load models, connect to DB)
 * 2. cleanup(): Async teardown (free resources)
 *
 * Best Practices:
 * - Batch scoring should be parallelized (Promise.all)
 * - Scores must be normalized to [0.0, 1.0]
 * - Deterministic: Same inputs → same outputs
 * - Efficient: Cache expensive operations
 * - Document: Explain scoring algorithm
 *
 * ============================================================================
 * EXAMPLE IMPLEMENTATIONS
 * ============================================================================
 *
 * 1. RelevanceScorer: Multi-feature weighted combination
 * 2. SemanticScorer: Pure semantic similarity
 * 3. KeywordScorer: Keyword matching only
 * 4. HybridScorer: Combines multiple scorers
 * 5. LearningScorer: ML-based relevance prediction
 *
 * ============================================================================
 * USAGE
 * ============================================================================
 *
 * ```typescript
 * class CustomScorer implements IScorer {
 *   async initialize(): Promise<void> {
 *     // Load models, connect to services
 *   }
 *
 *   async score(
 *     chunk: CodeChunk,
 *     query: QueryEmbedding,
 *     context: ScoringContext
 *   ): Promise<RelevanceScore> {
 *     // Calculate score
 *     const score = this.calculateScore(chunk, query, context);
 *
 *     return {
 *       chunk,
 *       score,
 *       breakdown: { ... }
 *     };
 *   }
 *
 *   async scoreBatch(
 *     chunks: CodeChunk[],
 *     query: QueryEmbedding,
 *     context: ScoringContext
 *   ): Promise<RelevanceScore[]> {
 *     // Score in parallel
 *     return Promise.all(
 *       chunks.map(chunk => this.score(chunk, query, context))
 *     );
 *   }
 *
 *   async cleanup(): Promise<void> {
 *     // Free resources
 *   }
 * }
 * ```
 */
export interface IScorer {
  /**
   * Score a chunk against a query
   *
   * Calculates relevance score for a single code chunk
   *
   * Parameters:
   * - chunk: The code chunk to score
   * - query: The user query (text + vector + entities)
   * - context: Environmental state (current file, time, history)
   *
   * Returns:
   * - RelevanceScore with final score and feature breakdown
   *
   * Requirements:
   * - Score must be in [0.0, 1.0]
   * - Must include breakdown for all features
   * - Must be deterministic (same inputs → same output)
   * - Must handle edge cases (missing data, invalid inputs)
   *
   * Performance:
   * - Should be < 1ms per chunk
   * - Cache expensive operations
   * - Avoid blocking operations
   *
   * Example:
   * ```typescript
   * const score = await scorer.score(chunk, query, context);
   * console.log(`Score: ${score.score}`);
   * console.log(`Semantic: ${score.breakdown.semantic}`);
   * ```
   */
  score(
    chunk: CodeChunk,
    query: QueryEmbedding,
    context: ScoringContext
  ): Promise<RelevanceScore>;

  /**
   * Score multiple chunks in batch
   *
   * Calculates relevance scores for multiple chunks efficiently
   *
   * Parameters:
   * - chunks: Array of code chunks to score
   * - query: The user query (same for all chunks)
   * - context: Environmental state (same for all chunks)
   *
   * Returns:
   * - Array of RelevanceScore (one per chunk)
   *
   * Optimization Requirements:
   * - Parallelize scoring (Promise.all)
   * - Cache shared calculations (proximity, query parsing)
   * - Minimize redundant work
   * - Clear cache between batches
   *
   * Performance Targets:
   * - 100 chunks: < 50ms
   * - 1000 chunks: < 500ms
   * - Throughput: > 2000 chunks/second
   *
   * Example:
   * ```typescript
   * const scores = await scorer.scoreBatch(chunks, query, context);
   *
   * // Sort by relevance
   * scores.sort((a, b) => b.score - a.score);
   *
   * // Get top 10
   * const top10 = scores.slice(0, 10);
   * ```
   */
  scoreBatch(
    chunks: CodeChunk[],
    query: QueryEmbedding,
    context: ScoringContext
  ): Promise<RelevanceScore[]>;
}
