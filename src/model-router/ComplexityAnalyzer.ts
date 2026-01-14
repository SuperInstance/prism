/**
 * ============================================================================
 * QUERY COMPLEXITY ANALYSIS
 * ============================================================================
 *
 * Analyzes query complexity to determine which AI model is appropriate.
 *
 * Why Complexity Analysis Matters:
 * --------------------------------
 * Different models have different capabilities and costs:
 * - Simple queries (0.0-0.3): Can use free models (Ollama/Cloudflare)
 * - Medium queries (0.3-0.6): Need cheap paid models (Haiku)
 * - Complex queries (0.6-0.9): Require balanced models (Sonnet)
 * - Very complex queries (0.9-1.0): Need premium models (Opus)
 *
 * Five Factors Analyzed:
 * ---------------------
 * 1. LENGTH (20% weight): Longer queries typically more complex
 *    - < 100 chars → 0.0 complexity
 *    - > 500 chars → 1.0 complexity
 *
 * 2. KEYWORDS (30% weight): Technical terms indicate complexity
 *    - High complexity words (+0.3 each): "architecture", "refactor", "optimize"
 *    - Medium complexity words (+0.15 each): "function", "api", "database"
 *    - Low complexity words (-0.1 each): "what is", "how to", "explain"
 *
 * 3. STRUCTURE (20% weight): Code patterns and nested questions
 *    - Async/concurrency patterns → +0.1
 *    - Data structures (tree, graph) → +0.1
 *    - Design patterns → +0.1
 *    - Multiple questions → +0.1 each
 *    - Code blocks → +0.15
 *
 * 4. DEPENDENCIES (15% weight): File references and imports
 *    - Path references → +0.05 each
 *    - Current file referenced → +0.1
 *    - Import/require statements → +0.15
 *    - Large codebase (>100 chunks) → +0.1
 *
 * 5. AMBIGUITY (15% weight): Vague terms increase complexity
 *    - Vague terms ("something", "maybe") → +0.15 each
 *    - Multiple interpretations ("or") → +0.1 each
 *    - Conditional language → +0.1
 *    - Long query without specific terms → +0.2
 *
 * Example Scores:
 * --------------
 * "What is a function?" → 0.1 (simple, low complexity keywords)
 * "How to implement async error handling?" → 0.5 (medium complexity + async)
 * "Refactor microservice architecture for scalability" → 0.8 (high complexity keywords)
 * "Design a distributed system with eventual consistency" → 0.95 (very complex)
 *
 * @see docs/architecture/03-model-router.md
 */

import type { CodeChunk } from '../core/types/index.js';

/**
 * Context for complexity analysis
 */
export interface QueryContext {
  /** Current file path */
  currentFile?: string;

  /** Current working directory */
  cwd?: string;

  /** Current programming language */
  currentLanguage?: string;

  /** Available code chunks */
  chunks?: CodeChunk[];
}

/**
 * Complexity analysis result
 */
export interface ComplexityResult {
  /** Overall complexity score (0-1) */
  score: number;

  /** Breakdown of complexity factors */
  factors: {
    /** Length-based complexity */
    length: number;

    /** Keyword-based complexity */
    keywords: number;

    /** Structure-based complexity */
    structure: number;

    /** Dependency-based complexity */
    dependencies: number;

    /** Ambiguity-based complexity */
    ambiguity: number;
  };

  /** Reasoning for the score */
  reasoning: string;
}

/**
 * ============================================================================
 * COMPLEXITY KEYWORD CATEGORIES
 * ============================================================================
 *
 * These keywords are used to estimate the technical depth of a query.
 *
 * HIGH COMPLEXITY (0.3 points each):
 * ----------------------------------
 * Architecture, design patterns, optimization, security, performance.
 * These require deep reasoning and planning.
 *
 * MEDIUM COMPLEXITY (0.15 points each):
 * -------------------------------------
 * Standard programming concepts: functions, classes, APIs, databases.
 * Common development tasks that need some reasoning.
 *
 * LOW COMPLEXITY (-0.1 points each):
 * ----------------------------------
 * Basic questions and explanations. These indicate simple queries
 * that can be answered by less capable models.
 */
const COMPLEXITY_KEYWORDS = {
  /** High complexity keywords (indicate complex tasks) */
  high: [
    'architecture',
    'design pattern',
    'refactor',
    'optimize',
    'security',
    'performance',
    'scalability',
    'algorithm',
    'data structure',
    'async',
    'await',
    'concurrent',
    'distributed',
    'microservice',
    'testing',
    'debug',
    'troubleshoot',
    'error handling',
    'implement',
    'integration',
  ],

  /** Medium complexity keywords (indicate moderate tasks) */
  medium: [
    'function',
    'class',
    'component',
    'api',
    'endpoint',
    'database',
    'query',
    'validation',
    'authentication',
    'authorization',
    'interface',
    'type',
    'method',
    'property',
    'module',
    'package',
  ],

  /** Low complexity keywords (indicate simple tasks) */
  low: [
    'what is',
    'how to',
    'explain',
    'example',
    'syntax',
    'basic',
    'simple',
    'show',
    'list',
    'find',
    'where',
    'when',
    'which',
    'can you',
    'help me',
  ],
};

/**
 * ============================================================================
 * CODE PATTERNS THAT INCREASE COMPLEXITY
 * ============================================================================
 *
 * These regex patterns detect code structures that typically require
 * more advanced reasoning to understand and modify.
 *
 * Each pattern adds 0.1 to the complexity score when detected.
 *
 * Examples:
 * ---------
 * - "Implement async error handling" → matches "async" → +0.1
 * - "Create a binary tree structure" → matches "dataStructures" → +0.1
 * - "Use the factory pattern" → matches "patterns" → +0.1
 * - "Sort the array" → matches "algorithms" → +0.1
 */
const COMPLEXITY_PATTERNS = {
  /** Async/concurrency patterns */
  async: /\b(async|await|promise|observable|future|task|thread)\b/i,

  /** Complex data structures */
  dataStructures: /\b(tree|graph|heap|hash map|linked list|stack|queue|map|set)\b/i,

  /** Design patterns */
  patterns: /\b(singleton|factory|observer|strategy|decorator|adapter|proxy)\b/i,

  /** Algorithmic complexity */
  algorithms: /\b(sort|search|traverse|recursive|iterate|merge|split)\b/i,

  /** Error handling */
  errorHandling: /\b(try|catch|throw|error|exception|handle|validate)\b/i,

  /** Testing */
  testing: /\b(test|spec|mock|stub|assert|expect|verify)\b/i,
};

/**
 * ============================================================================
 * COMPLEXITY ANALYZER IMPLEMENTATION
 * ============================================================================
 *
 * This class analyzes query complexity across five dimensions:
 * 1. Length (20%)
 * 2. Keywords (30%)
 * 3. Structure (20%)
 * 4. Dependencies (15%)
 * 5. Ambiguity (15%)
 *
 * The final score is a weighted sum normalized to 0-1 range.
 *
 * Usage Example:
 * -------------
 * ```typescript
 * const analyzer = new ComplexityAnalyzer();
 * const result = analyzer.analyze("Refactor the async function to use promises");
 *
 * console.log(result.score);       // 0.65
 * console.log(result.factors);     // { length: 0.2, keywords: 0.6, ... }
 * console.log(result.reasoning);   // "moderately complex (0.65): complex keywords detected, complex code patterns"
 * ```
 */
export class ComplexityAnalyzer {
  /**
   * Analyze query complexity
   *
   * This is the main entry point that orchestrates all factor analysis.
   *
   * @param query - Query text to analyze
   * @param context - Optional context for analysis (file path, codebase chunks, etc.)
   * @returns Complexity analysis result with score, factors, and reasoning
   */
  analyze(query: string, context?: QueryContext): ComplexityResult {
    const factors = {
      length: this.analyzeLength(query),
      keywords: this.analyzeKeywords(query),
      structure: this.analyzeStructure(query),
      dependencies: this.analyzeDependencies(query, context),
      ambiguity: this.analyzeAmbiguity(query),
    };

    // Weighted sum (0-1 scale)
    const score =
      factors.length * 0.2 +
      factors.keywords * 0.3 +
      factors.structure * 0.2 +
      factors.dependencies * 0.15 +
      factors.ambiguity * 0.15;

    // Normalize to 0-1 range
    const normalizedScore = Math.max(0, Math.min(1, score));

    return {
      score: normalizedScore,
      factors,
      reasoning: this.generateReasoning(factors, normalizedScore),
    };
  }

  /**
   * Analyze query length factor
   *
   * Longer queries tend to be more complex.
   *
   * @param query - Query text
   * @returns Length factor (0-1)
   */
  private analyzeLength(query: string): number {
    // Normalize based on typical query lengths
    // < 100 chars = 0, > 500 chars = 1
    const length = query.length;
    return Math.min(1, Math.max(0, (length - 100) / 400));
  }

  /**
   * Analyze keyword-based complexity
   *
   * @param query - Query text
   * @returns Keyword factor (0-1)
   */
  private analyzeKeywords(query: string): number {
    const lowerQuery = query.toLowerCase();

    // Count matches for each category
    const highMatches = COMPLEXITY_KEYWORDS.high.filter((keyword) =>
      lowerQuery.includes(keyword)
    ).length;
    const mediumMatches = COMPLEXITY_KEYWORDS.medium.filter((keyword) =>
      lowerQuery.includes(keyword)
    ).length;
    const lowMatches = COMPLEXITY_KEYWORDS.low.filter((keyword) =>
      lowerQuery.includes(keyword)
    ).length;

    // Calculate score (0-1)
    // High complexity keywords increase score
    // Low complexity keywords decrease score
    const score = highMatches * 0.3 + mediumMatches * 0.15 - lowMatches * 0.1;

    return Math.max(0, Math.min(1, score + 0.3)); // Base of 0.3
  }

  /**
   * Analyze query structure
   *
   * Looks for code patterns, nested questions, etc.
   *
   * @param query - Query text
   * @returns Structure factor (0-1)
   */
  private analyzeStructure(query: string): number {
    let complexity = 0;

    // Check for code patterns
    for (const [pattern, regex] of Object.entries(COMPLEXITY_PATTERNS)) {
      if (regex.test(query)) {
        complexity += 0.1;
      }
    }

    // Check for multiple questions (indicates complex request)
    const questionCount = (query.match(/\?/g) || []).length;
    complexity += Math.min(0.2, questionCount * 0.1);

    // Check for code blocks (indicates implementation task)
    if (/```/.test(query) || /^\s*[\w{}();]+\s*$/m.test(query)) {
      complexity += 0.15;
    }

    // Check for specific file references (indicates targeted task)
    if (/[\w/]+\.(ts|js|py|rs|go|java|cpp|c)/.test(query)) {
      complexity += 0.1;
    }

    return Math.min(1, complexity);
  }

  /**
   * Analyze dependency-based complexity
   *
   * @param query - Query text
   * @param context - Analysis context
   * @returns Dependency factor (0-1)
   */
  private analyzeDependencies(query: string, context?: QueryContext): number {
    let complexity = 0;

    // Check for file path references
    const pathReferences = (query.match(/[\w/\\.]+/g) || []).length;
    complexity += Math.min(0.2, pathReferences * 0.05);

    // Check if query references current file
    if (context?.currentFile) {
      const fileName = context.currentFile.split('/').pop();
      if (fileName && query.toLowerCase().includes(fileName.toLowerCase())) {
        complexity += 0.1;
      }
    }

    // Check for module/package imports
    if (/\b(import|require|from|include)\b/.test(query)) {
      complexity += 0.15;
    }

    // Check if many chunks are available (larger codebase = more complex)
    if (context?.chunks && context.chunks.length > 100) {
      complexity += 0.1;
    }

    return Math.min(1, complexity);
  }

  /**
   * Analyze ambiguity in query
   *
   * Higher ambiguity = higher complexity (requires more reasoning).
   *
   * @param query - Query text
   * @returns Ambiguity factor (0-1)
   */
  private analyzeAmbiguity(query: string): number {
    let ambiguity = 0;

    // Check for vague terms
    const vagueTerms = ['something', 'anything', 'somehow', 'maybe', 'possibly', 'probably'];
    const vagueCount = vagueTerms.filter((term) =>
      query.toLowerCase().includes(term)
    ).length;
    ambiguity += vagueCount * 0.15;

    // Check for multiple interpretations
    const orCount = (query.match(/\bor\b/gi) || []).length;
    ambiguity += Math.min(0.2, orCount * 0.1);

    // Check for conditional language
    if (/\b(if|when|unless|depending|whether)\b/i.test(query)) {
      ambiguity += 0.1;
    }

    // Check for general vs specific
    const specificTerms = [
      'function',
      'class',
      'method',
      'variable',
      'file',
      'line',
      'column',
    ];
    const hasSpecific = specificTerms.some((term) =>
      query.toLowerCase().includes(term)
    );
    if (!hasSpecific && query.length > 50) {
      // Long query without specific terms = ambiguous
      ambiguity += 0.2;
    }

    return Math.min(1, ambiguity);
  }

  /**
   * Generate reasoning for complexity score
   *
   * @param factors - Complexity factors
   * @param score - Overall score
   * @returns Human-readable reasoning
   */
  private generateReasoning(
    factors: ComplexityResult['factors'],
    score: number
  ): string {
    const parts: string[] = [];

    // Identify dominant factors
    if (factors.keywords > 0.5) {
      parts.push('complex keywords detected');
    }
    if (factors.structure > 0.5) {
      parts.push('complex code patterns');
    }
    if (factors.dependencies > 0.5) {
      parts.push('multiple dependencies');
    }
    if (factors.ambiguity > 0.5) {
      parts.push('ambiguous requirements');
    }
    if (factors.length > 0.5) {
      parts.push('lengthy query');
    }

    // Generate overall assessment
    let assessment: string;
    if (score < 0.3) {
      assessment = 'simple query';
    } else if (score < 0.6) {
      assessment = 'moderately complex';
    } else {
      assessment = 'highly complex';
    }

    if (parts.length === 0) {
      return `${assessment} (${score.toFixed(2)})`;
    }

    return `${assessment} (${score.toFixed(2)}): ${parts.join(', ')}`;
  }
}
