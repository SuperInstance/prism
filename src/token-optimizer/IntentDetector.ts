/**
 * ============================================================================
 * INTENT DETECTOR - QUERY ANALYSIS
 * ============================================================================
 *
 * Analyzes user queries to determine intent, extract entities, and estimate
 * complexity. This information guides the entire optimization pipeline.
 *
 * ============================================================================
 * INTENT CLASSIFICATION
 * ============================================================================
 *
 * Classifies queries into intent types using pattern matching:
 *
 * Intent Types and Patterns:
 *
 * 1. bug_fix (Weight: 1.0)
 *    Keywords: bug, error, fix, broken, crash, issue, problem, not working, fail, debug
 *    Optimization Strategy:
 *    - Prioritize recent code (bug fixes often involve recent changes)
 *    - Prioritize error handling, exception blocks
 *    - Include test files (test failures reveal bugs)
 *    - Use aggressive compression (need many files)
 *
 * 2. feature_add (Weight: 1.0)
 *    Keywords: add, implement, create, build, new, support, feature, functionality
 *    Optimization Strategy:
 *    - Prioritize extension points (interfaces, abstract classes)
 *    - Prioritize similar existing implementations (patterns to follow)
 *    - Include type definitions, interfaces
 *    - Use medium compression (need to see structure)
 *
 * 3. explain (Weight: 1.0)
 *    Keywords: how, what, why, explain, describe, tell me, show me, understand
 *    Optimization Strategy:
 *    - Prioritize documentation, comments
 *    - Prioritize clear naming conventions
 *    - Include examples, tests (usage demonstrations)
 *    - Use light compression (readability matters)
 *
 * 4. refactor (Weight: 1.0)
 *    Keywords: refactor, improve, optimize, clean, reorganize, restructure, better
 *    Optimization Strategy:
 *    - Prioritize complexity metrics (cyclomatic complexity, coupling)
 *    - Prioritize code smells (duplications, long functions)
 *    - Include dependency relationships
 *    - Use medium compression (need structure and relationships)
 *
 * 5. test (Weight: 1.0)
 *    Keywords: test, spec, verify, validate, check, assert, coverage
 *    Optimization Strategy:
 *    - Prioritize test files
 *    - Include test utilities, fixtures
 *    - Show assertions, expectations
 *    - Use light compression (test clarity important)
 *
 * 6. search (Weight: 0.8 - less specific)
 *    Keywords: find, search, look for, where, locate, show me, list
 *    Optimization Strategy:
 *    - Prioritize comprehensive results
 *    - Maximize diversity (different files, modules)
 *    - Include more chunks (maxChunks: 50)
 *    - Use light compression (show full context)
 *
 * 7. general (fallback)
 *    No specific patterns detected
 *    Optimization Strategy:
 *    - Balanced approach across all signals
 *    - Default compression: medium
 *    - Default maxChunks: 15
 *
 * ============================================================================
 * ENTITY EXTRACTION
 * ============================================================================
 *
 * Extracts structured entities from natural language queries:
 *
 * Entity Types:
 *
 * 1. symbol (Confidence: 0.9)
 *    Pattern: `identifier`, "identifier", 'identifier'
 *    Examples: `MyFunction`, "UserClass", 'connectToDB'
 *    Why: Backticks/quotes indicate explicit code references
 *    Confidence: High - user explicitly marked these
 *
 * 2. file (Confidence: 0.7)
 *    Pattern: filename.ext
 *    Examples: user.ts, handler.js, config.json
 *    Why: File extensions indicate file paths
 *    Confidence: Medium - could be other things
 *
 * 3. type (Confidence: 0.5)
 *    Pattern: PascalCase words
 *    Examples: UserService, HttpRequest, ConfigOptions
 *    Why: Type names follow PascalCase convention
 *    Confidence: Low - might be other capitalized words
 *
 * 4. keyword (Confidence: 0.6)
 *    Pattern: Technical terms
 *    Examples: function, class, method, interface
 *    Why: Common programming terms
 *    Confidence: Medium - context dependent
 *
 * Entity Usage:
 * - Symbol matching in scoring (25% weight)
 * - Scope determination (file refs → project scope)
 * - Query refinement for embeddings
 *
 * ============================================================================
 * SCOPE DETERMINATION
 * ============================================================================
 *
 * Determines the search scope based on query context:
 *
 * Scope Types:
 *
 * 1. current_file
 *    Indicators: "in this file", "current file"
 *    Strategy: Only search the file user is working on
 *    Budget multiplier: 0.5x (smaller scope = less context needed)
 *
 * 2. current_dir
 *    Indicators: "in this dir", "current directory", "here", symbol references
 *    Strategy: Search current directory and subdirectories
 *    Budget multiplier: 0.75x
 *
 * 3. project (default)
 *    Indicators: "in the project", "project-wide", file paths
 *    Strategy: Search entire codebase
 *    Budget multiplier: 1.0x (baseline)
 *
 * 4. global
 *    Indicators: Explicit global search terms
 *    Strategy: Search across projects/repositories
 *    Budget multiplier: 1.5x (need more context)
 *
 * Scope Heuristics:
 * - File paths suggest project scope
 * - Symbol references suggest current dir scope
 * - No indicators → default to project scope
 *
 * ============================================================================
 * COMPLEXITY ESTIMATION
 * ============================================================================
 *
 * Estimates query complexity on a scale of 0.0 to 1.0:
 *
 * Complexity Factors:
 *
 * 1. Length (Max: 0.3)
 *    Formula: min(0.3, word_count / 50)
 *    Why: Longer queries typically indicate complex requests
 *    Cap: 50 words = maximum length complexity
 *
 * 2. Entity Count (Max: 0.3)
 *    Formula: min(0.3, entity_count × 0.1)
 *    Why: More entities = more relationships to consider
 *    Cap: 3 entities = maximum entity complexity
 *
 * 3. Technical Terms (Max: 0.2)
 *    Keywords: algorithm, architecture, pattern, design, implementation
 *    Why: These terms indicate deeper technical understanding needed
 *    Binary: 0.2 if present, 0 if not
 *
 * 4. Multi-step (Max: 0.2)
 *    Keywords: and then, after that, also, additionally, plus
 *    Why: Indicates sequential operations
 *    Binary: 0.2 if present, 0 if not
 *
 * 5. History (Max: 0.1)
 *    Condition: conversation history length > 3
 *    Why: Contextual queries require understanding previous context
 *    Binary: 0.1 if true, 0 if false
 *
 * Total Complexity: Sum of all factors (capped at 1.0)
 *
 * Complexity Usage:
 * - Compression level selection
 *   * < 0.3: light compression
 *   * 0.3-0.7: medium compression
 *   * > 0.7: aggressive compression
 * - Budget adjustment: budget × (1 + complexity)
 * - Model routing: complexity + token count
 *
 * ============================================================================
 * CONVERSATION HISTORY NEEDS
 * ============================================================================
 *
 * Determines if conversation history is needed for context:
 *
 * Anaphora Detection:
 * - Words: it, that, this, they, those, the previous, the above
 * - Indicates references to previous context
 * - Examples: "fix it", "explain that", "how does it work"
 *
 * Follow-up Detection:
 * - Words: again, also, too, similarly, what about
 * - Indicates continuation of previous topic
 * - Examples: "do that again", "also add X", "what about Y"
 *
 * When History is Needed:
 * - Query contains anaphora
 * - Query contains follow-up indicators
 * - History is actually available (can't use what we don't have)
 *
 * When History is Not Needed:
 * - Self-contained queries
 * - No anaphora or follow-up words
 * - No history available
 *
 * ============================================================================
 * BUDGET ESTIMATION
 * ============================================================================
 *
 * Estimates token budget needed for the query:
 *
 * Base Budget by Intent:
 * - bug_fix: 8,000 tokens (need error context, stack traces)
 * - feature_add: 10,000 tokens (need patterns, interfaces)
 * - explain: 5,000 tokens (focused on specific code)
 * - refactor: 7,000 tokens (need structure, relationships)
 * - test: 6,000 tokens (need test files, assertions)
 * - search: 3,000 tokens (just finding things)
 * - general: 4,000 tokens (balanced)
 *
 * Scope Multipliers:
 * - current_file: 0.5x (narrow focus)
 * - current_dir: 0.75x (local focus)
 * - project: 1.0x (baseline)
 * - global: 1.5x (broad search)
 *
 * Complexity Multiplier:
 * - Formula: (1 + complexity_score)
 * - Range: 1.0x to 2.0x
 * - Why: Complex queries need more context
 *
 * Final Formula:
 * budget = base_budget[intent] × scope_multiplier × (1 + complexity)
 *
 * Example:
 * Intent: feature_add (10,000)
 * Scope: project (1.0)
 * Complexity: 0.5
 * Budget = 10,000 × 1.0 × 1.5 = 15,000 tokens
 *
 * ============================================================================
 * OPTIMIZATION OPTIONS
 * ============================================================================
 *
 * Determines optimization parameters based on intent, scope, and complexity:
 *
 * maxChunks: Maximum number of chunks to select
 * - bug_fix: 20 (focused on specific areas)
 * - feature_add: 30 (need patterns and examples)
 * - explain: 10 (focused explanation)
 * - refactor: 25 (need to see relationships)
 * - test: 15 (test files and code)
 * - search: 50 (comprehensive results)
 * - general: 15 (balanced)
 *
 * minRelevance: Minimum relevance score for selection (0-1)
 * - Default: 0.3 (filter out low-relevance chunks)
 * - Higher = more selective, fewer chunks
 * - Lower = more inclusive, more chunks
 *
 * preferDiversity: Whether to prioritize diverse files
 * - True for project scope (avoid clustering in one file)
 * - False for current file/dir scope (local focus)
 * - Helps maximize coverage of codebase
 *
 * compressionLevel: Aggressiveness of compression
 * - light (< 0.3 complexity): 1.1-1.5x reduction
 * - medium (0.3-0.7 complexity): 1.5-3x reduction
 * - aggressive (> 0.7 complexity): 3-10x reduction
 *
 * ============================================================================
 * ALGORITHM COMPLEXITY
 * ============================================================================
 *
 * Time Complexity: O(n × m)
 * - n: number of intent patterns (6-7)
 * - m: length of query (for keyword matching)
 * - Entity extraction: O(m) for regex matching
 * - Overall: Linear in query length
 *
 * Space Complexity: O(k)
 * - k: number of extracted entities
 * - Typically small (< 10 entities)
 *
 * Performance: < 1ms for typical queries
 *
 * ============================================================================
 * @see docs/architecture/02-token-optimizer.md for design details
 * ============================================================================
 */

import {
  IntentType,
  QueryIntent,
  QueryEntity,
  QueryScope,
  OptimizationOptions,
  Message,
} from './types.js';

/**
 * Pattern matching for intent classification
 */
interface IntentPattern {
  /** Intent type */
  type: IntentType;

  /** Keywords that trigger this intent */
  keywords: string[];

  /** Weight for scoring (higher = more specific) */
  weight: number;
}

/**
 * Intent detector for query analysis
 */
export class IntentDetector {
  /**
   * Intent patterns for classification
   */
  private readonly intentPatterns: IntentPattern[] = [
    {
      type: 'bug_fix',
      keywords: ['bug', 'error', 'fix', 'broken', 'crash', 'issue', 'problem', 'not working', 'fail', 'debug'],
      weight: 1.0,
    },
    {
      type: 'feature_add',
      keywords: ['add', 'implement', 'create', 'build', 'new', 'support', 'feature', 'functionality'],
      weight: 1.0,
    },
    {
      type: 'explain',
      keywords: ['how', 'what', 'why', 'explain', 'describe', 'tell me', 'show me', 'understand'],
      weight: 1.0,
    },
    {
      type: 'refactor',
      keywords: ['refactor', 'improve', 'optimize', 'clean', 'reorganize', 'restructure', 'better'],
      weight: 1.0,
    },
    {
      type: 'test',
      keywords: ['test', 'spec', 'verify', 'validate', 'check', 'assert', 'coverage'],
      weight: 1.0,
    },
    {
      type: 'search',
      keywords: ['find', 'search', 'look for', 'where', 'locate', 'show me', 'list'],
      weight: 0.8,
    },
  ];

  /**
   * Detect intent from user query
   *
   * @param prompt - User query
   * @param history - Optional conversation history
   * @returns Detected intent with metadata
   */
  async detect(prompt: string, history?: Message[]): Promise<QueryIntent> {
    // Normalize prompt
    const normalized = prompt.toLowerCase().trim();

    // Classify intent
    const type = this.classifyIntent(normalized);

    // Extract entities
    const entities = this.extractEntities(normalized);

    // Determine scope
    const scope = this.determineScope(normalized, entities);

    // Calculate complexity
    const complexity = this.calculateComplexity(normalized, entities, history);

    // Check if history is needed
    const requiresHistory = this.needsHistory(normalized, history);

    // Estimate budget
    const estimatedBudget = this.estimateBudget(type, complexity, scope);

    // Determine options
    const options = this.determineOptions(type, scope, complexity);

    return {
      type,
      query: prompt,
      embedding: [], // Will be filled by embeddings service
      entities,
      scope,
      complexity,
      requiresHistory,
      estimatedBudget,
      options,
    };
  }

  /**
   * Classify intent type from query
   *
   * @param query - Normalized query text
   * @returns Intent type
   */
  private classifyIntent(query: string): IntentType {
    // Score each intent type
    const scores = this.intentPatterns.map(pattern => {
      let score = 0;
      for (const keyword of pattern.keywords) {
        if (query.includes(keyword)) {
          score += pattern.weight;
        }
      }
      return { type: pattern.type, score };
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Return highest scoring intent, or 'general' if no matches
    if (scores[0].score > 0) {
      return scores[0].type;
    }

    return 'general';
  }

  /**
   * Extract entities from query
   *
   * Looks for symbols, file paths, types, and keywords.
   *
   * @param query - Normalized query text
   * @returns Extracted entities
   */
  private extractEntities(query: string): QueryEntity[] {
    const entities: QueryEntity[] = [];

    // Extract symbols (identifiers in backticks or quotes)
    const symbolMatches = query.match(/`([^`]+)`|"([^"]+)"|'([^']+)'/g);
    if (symbolMatches) {
      for (const match of symbolMatches) {
        const value = match.replace(/[`'"]/g, '');
        entities.push({
          type: 'symbol',
          value,
          confidence: 0.9,
          position: query.indexOf(match),
        });
      }
    }

    // Extract file paths
    const fileMatches = query.match(/[\w.-]+\.[a-z]{2,4}/gi);
    if (fileMatches) {
      for (const match of fileMatches) {
        if (!entities.some(e => e.value === match)) {
          entities.push({
            type: 'file',
            value: match,
            confidence: 0.7,
            position: query.indexOf(match),
          });
        }
      }
    }

    // Extract type references (TypeScript/Java style)
    const typeMatches = query.match(/\b[A-Z]\w*\b/g);
    if (typeMatches) {
      for (const match of typeMatches) {
        if (!entities.some(e => e.value === match)) {
          entities.push({
            type: 'type',
            value: match,
            confidence: 0.5,
            position: query.indexOf(match),
          });
        }
      }
    }

    // Extract technical keywords
    const keywords = ['function', 'class', 'method', 'variable', 'interface', 'type', 'component'];
    for (const keyword of keywords) {
      if (query.includes(keyword)) {
        entities.push({
          type: 'keyword',
          value: keyword,
          confidence: 0.6,
        });
      }
    }

    return entities;
  }

  /**
   * Determine query scope
   *
   * @param query - Normalized query text
   * @param entities - Extracted entities
   * @returns Query scope
   */
  private determineScope(query: string, entities: QueryEntity[]): QueryScope {
    // Check for explicit scope indicators
    if (query.includes('in this file') || query.includes('current file')) {
      return 'current_file';
    }

    if (query.includes('in this dir') || query.includes('current directory') || query.includes('here')) {
      return 'current_dir';
    }

    if (query.includes('in the project') || query.includes('project-wide')) {
      return 'project';
    }

    // Check for file paths (suggests project scope)
    const hasFilePath = entities.some(e => e.type === 'file');
    if (hasFilePath) {
      return 'project';
    }

    // Check for symbol references (suggests current file or dir)
    const hasSymbols = entities.some(e => e.type === 'symbol');
    if (hasSymbols) {
      return 'current_dir';
    }

    // Default to project scope
    return 'project';
  }

  /**
   * Calculate complexity score (0-1)
   *
   * @param query - Normalized query text
   * @param entities - Extracted entities
   * @param history - Conversation history
   * @returns Complexity score
   */
  private calculateComplexity(
    query: string,
    entities: QueryEntity[],
    history?: Message[]
  ): number {
    let complexity = 0.0;

    // Length complexity (longer queries = more complex)
    const length = query.split(' ').length;
    complexity += Math.min(0.3, length / 50);

    // Entity complexity (more entities = more complex)
    complexity += Math.min(0.3, entities.length * 0.1);

    // Technical terms complexity
    const technicalTerms = ['algorithm', 'architecture', 'pattern', 'design', 'implementation'];
    const hasTechnicalTerms = technicalTerms.some(term => query.includes(term));
    if (hasTechnicalTerms) {
      complexity += 0.2;
    }

    // Multi-step complexity
    const multiStepWords = ['and then', 'after that', 'also', 'additionally', 'plus'];
    const hasMultiStep = multiStepWords.some(word => query.includes(word));
    if (hasMultiStep) {
      complexity += 0.2;
    }

    // History complexity (contextual queries)
    if (history && history.length > 3) {
      complexity += 0.1;
    }

    return Math.min(1.0, complexity);
  }

  /**
   * Determine if conversation history is needed
   *
   * @param query - Normalized query text
   * @param history - Conversation history
   * @returns Whether history is needed
   */
  private needsHistory(query: string, history?: Message[]): boolean {
    // Anaphora references
    const anaphora = ['it', 'that', 'this', 'they', 'those', 'the previous', 'the above'];
    const hasAnaphora = anaphora.some(word => query.includes(word));

    if (hasAnaphora) {
      return true;
    }

    // Follow-up indicators
    const followUp = ['again', 'also', 'too', 'similarly', 'what about'];
    const hasFollowUp = followUp.some(word => query.includes(word));

    if (hasFollowUp) {
      return true;
    }

    // If no history available, can't use it
    if (!history || history.length === 0) {
      return false;
    }

    return false;
  }

  /**
   * Estimate token budget needed
   *
   * @param type - Intent type
   * @param complexity - Complexity score
   * @param scope - Query scope
   * @returns Estimated token budget
   */
  private estimateBudget(type: IntentType, complexity: number, scope: QueryScope): number {
    // Base budget by intent type
    const baseBudget: Record<IntentType, number> = {
      bug_fix: 8000,
      feature_add: 10000,
      explain: 5000,
      refactor: 7000,
      test: 6000,
      search: 3000,
      general: 4000,
    };

    // Scope multiplier
    const scopeMultiplier: Record<QueryScope, number> = {
      current_file: 0.5,
      current_dir: 0.75,
      project: 1.0,
      global: 1.5,
    };

    // Calculate budget
    const budget = baseBudget[type] * scopeMultiplier[scope] * (1 + complexity);

    return Math.round(budget);
  }

  /**
   * Determine optimization options
   *
   * @param type - Intent type
   * @param scope - Query scope
   * @param complexity - Complexity score
   * @returns Optimization options
   */
  private determineOptions(
    type: IntentType,
    scope: QueryScope,
    complexity: number
  ): OptimizationOptions {
    // Max chunks by intent
    const maxChunks: Record<IntentType, number> = {
      bug_fix: 20,
      feature_add: 30,
      explain: 10,
      refactor: 25,
      test: 15,
      search: 50,
      general: 15,
    };

    // Compression level by complexity
    let compressionLevel: 'light' | 'medium' | 'aggressive' = 'medium';
    if (complexity > 0.7) {
      compressionLevel = 'aggressive';
    } else if (complexity < 0.3) {
      compressionLevel = 'light';
    }

    return {
      maxChunks: maxChunks[type],
      minRelevance: 0.3,
      preferDiversity: scope === 'project',
      compressionLevel,
    };
  }

  /**
   * Get embedding for query
   *
   * This is a placeholder - actual embedding generation
   * should be done by the embeddings service.
   *
   * @param query - Query text
   * @returns Query embedding (empty array for now)
   */
  private async getEmbedding(query: string): Promise<number[]> {
    // This will be replaced with actual embedding generation
    return [];
  }
}
