/**
 * ============================================================================
 * MODEL SELECTION DECISION TREE
 * ============================================================================
 *
 * Decision Flow:
 * 1. Check Ollama availability (free local LLM)
 * 2. Calculate token count + complexity score
 * 3. Select cheapest viable model:
 *    - tokens < 8K && complexity < 0.6 → Ollama deepseek-coder-v2 (FREE)
 *    - tokens < 50K && complexity < 0.7 → Cloudflare Llama 3.1 8B (FREE)
 *    - tokens < 50K && complexity < 0.6 → Claude Haiku ($0.25/M input)
 *    - tokens < 100K → Claude Sonnet ($3/M input)
 *    - tokens >= 100K → Claude Opus ($15/M input)
 *
 * Cost Optimization Formula:
 * cost = (input_tokens * input_price + output_tokens * output_price) / 1_000_000
 *
 * Why This Order?
 * ----------------
 * 1. FREE LOCAL (Ollama): Zero cost, no rate limits, runs on your machine
 * 2. FREE CLOUD (Cloudflare): Free tier 10K neurons/day, no API keys
 * 3. CHEAP PAID (Haiku): $0.25/M input, fast for simple tasks
 * 4. BALANCED (Sonnet): $3/M input, best value for most tasks
 * 5. PREMIUM (Opus): $15/M input, only for complex reasoning
 *
 * Cost Savings Examples:
 * ----------------------
 * Simple question (1K tokens, complexity 0.2):
 *   - Opus:  $0.015 (expensive overkill)
 *   - Sonnet: $0.003 (better)
 *   - Haiku:  $0.00025 (good)
 *   - Cloudflare/Ollama: $0 (FREE!)
 *
 * Code refactor (20K tokens, complexity 0.7):
 *   - Opus:  $0.30 (overkill)
 *   - Sonnet: $0.06 (optimal)
 *   - Haiku:  Not suitable (complexity too high)
 *
 * Architecture design (100K tokens, complexity 0.9):
 *   - Opus:  $1.50 (necessary for complex reasoning)
 *   - Sonnet: $0.30 (might miss edge cases)
 *
 * @see docs/architecture/03-model-router.md
 * @see https://docs.anthropic.com/claude/docs/models-overview
 */

import type {
  IModelRouter,
  AIRequest,
  AIResponse,
} from '../core/interfaces/index.js';
import type { ModelChoice } from '../core/types/index.js';
import { createPrismError, ErrorCode } from '../core/types/index.js';
import { ComplexityAnalyzer } from './ComplexityAnalyzer.js';
import { BudgetTracker } from './BudgetTracker.js';
import { RequestFormatter } from './RequestFormatter.js';
import { OllamaClient } from './OllamaClient.js';
import { CloudflareClient } from './CloudflareClient.js';

/**
 * ============================================================================
 * MODEL SPECIFICATIONS
 * ============================================================================
 *
 * Pricing (as of 2024):
 * - Ollama: FREE (local inference)
 * - Cloudflare: FREE tier (10K neurons/day)
 * - Haiku: $0.25/M input, $1.25/M output
 * - Sonnet: $3.00/M input, $15.00/M output
 * - Opus: $15.00/M input, $75.00/M output
 *
 * Context Windows:
 * - Ollama models: 16K tokens
 * - Cloudflare Llama 3.1: 128K tokens
 * - Claude models: 200K tokens
 *
 * Complexity Ranges:
 * - 0.0 - 0.3: Simple questions, explanations
 * - 0.3 - 0.6: Code generation, debugging
 * - 0.6 - 0.9: Architecture, refactoring, optimization
 * - 0.9 - 1.0: Complex reasoning, multi-step problems
 */
interface ModelSpec {
  /** Model identifier */
  id: string;

  /** Provider hosting the model */
  provider: 'ollama' | 'cloudflare' | 'anthropic';

  /** Maximum context window in tokens */
  maxTokens: number;

  /** Input price per million tokens (USD) */
  inputPrice: number;

  /** Output price per million tokens (USD) */
  outputPrice: number;

  /** Minimum recommended complexity (0-1) */
  minComplexity: number;

  /** Maximum recommended complexity (0-1) */
  maxComplexity: number;

  /** Average latency in milliseconds */
  avgLatency: number;
}

/**
 * Model specifications
 */
const MODELS: Record<string, ModelSpec> = {
  // Ollama (local, free)
  'ollama:deepseek-coder-v2': {
    id: 'deepseek-coder-v2',
    provider: 'ollama',
    maxTokens: 16000,
    inputPrice: 0,
    outputPrice: 0,
    minComplexity: 0.0,
    maxComplexity: 0.6,
    avgLatency: 500,
  },
  'ollama:codellama': {
    id: 'codellama',
    provider: 'ollama',
    maxTokens: 16000,
    inputPrice: 0,
    outputPrice: 0,
    minComplexity: 0.0,
    maxComplexity: 0.5,
    avgLatency: 600,
  },

  // Cloudflare Workers AI
  'cloudflare:@cf/meta/llama-3.1-8b-instruct': {
    id: '@cf/meta/llama-3.1-8b-instruct',
    provider: 'cloudflare',
    maxTokens: 128000,
    inputPrice: 0,
    outputPrice: 0,
    minComplexity: 0.0,
    maxComplexity: 0.6,
    avgLatency: 300,
  },
  'cloudflare:@cf/mistral/mistral-7b-instruct-v0.2': {
    id: '@cf/mistral/mistral-7b-instruct-v0.2',
    provider: 'cloudflare',
    maxTokens: 32000,
    inputPrice: 0,
    outputPrice: 0,
    minComplexity: 0.0,
    maxComplexity: 0.7,
    avgLatency: 400,
  },

  // Anthropic Claude
  'anthropic:claude-3-haiku': {
    id: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    maxTokens: 200000,
    inputPrice: 0.25,
    outputPrice: 1.25,
    minComplexity: 0.0,
    maxComplexity: 0.6,
    avgLatency: 200,
  },
  'anthropic:claude-3.5-sonnet': {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    maxTokens: 200000,
    inputPrice: 3.0,
    outputPrice: 15.0,
    minComplexity: 0.4,
    maxComplexity: 0.9,
    avgLatency: 400,
  },
  'anthropic:claude-3-opus': {
    id: 'claude-3-opus-20240229',
    provider: 'anthropic',
    maxTokens: 200000,
    inputPrice: 15.0,
    outputPrice: 75.0,
    minComplexity: 0.7,
    maxComplexity: 1.0,
    avgLatency: 800,
  },
};

/**
 * ============================================================================
 * COMPLEXITY KEYWORDS
 * ============================================================================
 *
 * These keywords help estimate query complexity for model selection.
 * Used as a fallback when the full ComplexityAnalyzer is not available.
 *
 * HIGH COMPLEXITY: Architecture, performance, security
 * - Requires advanced reasoning and planning
 * - Best handled by Sonnet or Opus
 *
 * MEDIUM COMPLEXITY: Functions, APIs, databases
 * - Standard development tasks
 * - Well handled by Haiku or Sonnet
 *
 * LOW COMPLEXITY: Explanations, examples, syntax
 * - Simple informational queries
 * - Can use free models (Ollama/Cloudflare)
 */
const COMPLEXITY_KEYWORDS = {
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
    'concurrent',
    'distributed',
    'microservice',
    'testing',
    'debug',
    'error handling',
  ],
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
  ],
  low: [
    'what is',
    'how to',
    'explain',
    'example',
    'syntax',
    'basic',
    'simple',
  ],
};

/**
 * ============================================================================
 * MODEL ROUTER CONFIGURATION
 * ============================================================================
 *
 * Security Note:
 * -------------
 * API keys are stored in plaintext in memory. This is a security risk.
 *
 * Recommendations:
 * - Use environment variables for API keys
 * - Never commit API keys to version control
 * - Consider using a secret management system for production
 * - Implement key rotation for long-running applications
 *
 * Rate Limiting:
 * -------------
 * Rate limiting is NOT persistent across sessions. If the application restarts,
 * rate limits reset. For production, implement persistent rate limiting with:
 * - Redis or database-backed rate limiting
 * - Distributed rate limiting for multi-instance deployments
 * - Per-user rate limiting for multi-tenant applications
 *
 * Missing Features:
 * ----------------
 * - No authentication/authorization system
 * - No audit logging for API usage
 * - No cost alerts or budget caps
 * - No usage analytics or monitoring
 */
export interface ModelRouterConfig {
  /** Ollama configuration */
  ollama?: {
    url?: string;
    timeout?: number;
    defaultModel?: string;
  };

  /** Anthropic configuration */
  anthropic?: {
    apiKey?: string;
  };

  /** Cloudflare configuration */
  cloudflare?: {
    accountId?: string;
    apiToken?: string;
  };

  /** Enable budget tracking */
  enableBudgetTracking?: boolean;
}

/**
 * ============================================================================
 * MODEL ROUTER IMPLEMENTATION
 * ============================================================================
 *
 * This class implements the core model selection logic that routes requests
 * to the most cost-effective model based on token count and complexity.
 *
 * Key Responsibilities:
 * ---------------------
 * 1. Analyze query complexity (using ComplexityAnalyzer)
 * 2. Select optimal model (using selectModel decision tree)
 * 3. Route requests to appropriate provider (Ollama/Cloudflare/Anthropic)
 * 4. Track budget usage (using BudgetTracker)
 * 5. Estimate costs before making requests
 *
 * Usage Example:
 * -------------
 * ```typescript
 * const router = new ModelRouter({
 *   anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
 *   cloudflare: {
 *     accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
 *     apiToken: process.env.CLOUDFLARE_API_TOKEN,
 *   },
 *   enableBudgetTracking: true,
 * });
 *
 * const choice = router.selectModel(5000, 0.4);
 * console.log(choice.model);    // 'ollama:deepseek-coder-v2'
 * console.log(choice.reason);   // 'Token count (5000)...'
 * console.log(choice.estimatedCost); // 0
 * ```
 */
export class ModelRouter implements IModelRouter {
  private ollamaClient: OllamaClient;
  private cloudflareClient?: CloudflareClient;
  private budgetTracker?: BudgetTracker;
  private formatter: RequestFormatter;
  private analyzer: ComplexityAnalyzer;
  private anthropicApiKey?: string;

  constructor(config?: ModelRouterConfig) {
    // Initialize Ollama client
    this.ollamaClient = new OllamaClient(config?.ollama);

    // Initialize Cloudflare client if credentials provided
    if (config?.cloudflare?.accountId && config?.cloudflare?.apiToken) {
      const budgetTracker = config?.enableBudgetTracking
        ? new BudgetTracker(true)
        : undefined;

      this.cloudflareClient = new CloudflareClient({
        accountId: config.cloudflare.accountId,
        apiToken: config.cloudflare.apiToken,
        budgetTracker,
      });

      this.budgetTracker = budgetTracker;
    }

    // Initialize other components
    this.formatter = new RequestFormatter();
    this.analyzer = new ComplexityAnalyzer();
    this.anthropicApiKey = config?.anthropic?.apiKey;
  }

  /**
   * ============================================================================
   * MODEL SELECTION LOGIC
   * ============================================================================
   *
   * This is the core decision tree that selects the optimal model.
   *
   * Algorithm:
   * ---------
   * 1. Normalize complexity to 0-1 range
   * 2. Check conditions in priority order (free → cheap → balanced → premium)
   * 3. Return selected model with reasoning and estimated cost
   *
   * Priority Order Rationale:
   * ------------------------
   * - FREE FIRST: Always prefer zero-cost options when viable
   * - COMPLEXITY CHECKS: Ensure model can handle the task
   * - TOKEN LIMITS: Respect context window constraints
   * - COST MINIMIZATION: Use cheapest model that meets requirements
   *
   * Example Decisions:
   * -----------------
   * - selectModel(1000, 0.2) → Ollama (free, simple)
   * - selectModel(10000, 0.4) → Cloudflare (free tier)
   * - selectModel(30000, 0.5) → Haiku (cheap, larger context)
   * - selectModel(60000, 0.7) → Sonnet (balanced, complex)
   * - selectModel(150000, 0.9) → Opus (premium, very complex)
   *
   * @param tokens - Estimated token count for the request
   * @param complexity - Query complexity score (0-1, from ComplexityAnalyzer)
   * @returns Selected model with provider, reasoning, and estimated cost
   */
  selectModel(tokens: number, complexity: number): ModelChoice {
    // Normalize complexity to 0-1 range
    const normalizedComplexity = Math.max(0, Math.min(1, complexity));

    // Define model selection logic
    let selectedModel: string;
    let reason: string;

    // Check Ollama availability (async, but we'll assume it's available for now)
    // Priority 1: Use Ollama if available and within limits
    if (tokens < 8000 && normalizedComplexity < 0.6) {
      selectedModel = 'ollama:deepseek-coder-v2';
      reason = `Token count (${tokens}) and complexity (${normalizedComplexity.toFixed(2)}) are within Ollama's capabilities. Using local model for zero cost.`;
    }
    // Priority 2: Use Cloudflare if available and within budget
    else if (
      this.cloudflareClient &&
      this.cloudflareClient.canAfford('@cf/meta/llama-3.1-8b-instruct', tokens) &&
      tokens < 50000 &&
      normalizedComplexity < 0.7
    ) {
      selectedModel = 'cloudflare:@cf/meta/llama-3.1-8b-instruct';
      reason = `Token count (${tokens}) and complexity (${normalizedComplexity.toFixed(2)}) are suitable for Cloudflare Workers AI. Using free tier.`;
    }
    // Priority 3: Use Claude Haiku for simple tasks
    else if (tokens < 50000 && normalizedComplexity < 0.6) {
      selectedModel = 'anthropic:claude-3-haiku';
      reason = `Token count (${tokens}) requires Haiku's larger context. Low complexity (${normalizedComplexity.toFixed(2)}) keeps costs down.`;
    }
    // Priority 4: Use Claude Sonnet for balanced performance
    else if (tokens < 100000) {
      selectedModel = 'anthropic:claude-3.5-sonnet';
      reason = `Token count (${tokens}) and complexity (${normalizedComplexity.toFixed(2)}) require Sonnet's balanced capabilities.`;
    }
    // Priority 5: Use Claude Opus for complex tasks
    else {
      selectedModel = 'anthropic:claude-3-opus';
      reason = `High complexity (${normalizedComplexity.toFixed(2)}) or large token count (${tokens}) requires Opus's advanced reasoning.`;
    }

    // Get model spec
    const spec = MODELS[selectedModel];
    if (!spec) {
      throw createPrismError(
        ErrorCode.MODEL_ROUTING_FAILED,
        `Selected model not found: ${selectedModel}`
      );
    }

    // Calculate estimated cost
    const estimatedCost = this.estimateCost(tokens, spec);

    return {
      model: spec.id,
      provider: spec.provider,
      reason,
      estimatedCost,
    };
  }

  /**
   * Route a request to Ollama (local model)
   *
   * @param request - AI request to process
   * @returns AI response from Ollama
   * @throws {PrismError} If Ollama is unavailable or request fails
   */
  async routeToOllama(request: AIRequest): Promise<AIResponse> {
    return await this.ollamaClient.generate(request);
  }

  /**
   * Route a request to Claude (Anthropic API)
   *
   * @param request - AI request to process
   * @returns AI response from Claude
   * @throws {PrismError} If API call fails
   */
  async routeToClaude(request: AIRequest): Promise<AIResponse> {
    const startTime = performance.now();

    try {
      if (!this.anthropicApiKey) {
        throw createPrismError(
          ErrorCode.MODEL_ROUTING_FAILED,
          'Anthropic API key not configured'
        );
      }

      // Use Claude 3.5 Sonnet by default
      const model = 'claude-3-5-sonnet-20241022';
      const spec = MODELS[`anthropic:${model}`];

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens,
          messages: [
            {
              role: 'user',
              content: request.prompt,
            },
          ],
          temperature: request.temperature ?? 0.7,
          stop_sequences: request.stopSequences ?? [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string; errors?: Array<{ message: string }> };
        const errorMessage = errorData.message || errorData.errors?.[0]?.message || response.statusText;
        throw new Error(`Anthropic API error: ${errorMessage}`);
      }

      const data = await response.json() as {
        content?: Array<{ text: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const duration = performance.now() - startTime;
      const inputTokens = data.usage?.input_tokens ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;

      // Calculate cost
      const cost =
        (inputTokens / 1_000_000) * (spec?.inputPrice || 3) +
        (outputTokens / 1_000_000) * (spec?.outputPrice || 15);

      return {
        text: data.content?.[0]?.text ?? '',
        tokensUsed: inputTokens + outputTokens,
        cost,
        model: `anthropic:${model}`,
        duration,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'PrismError') {
        throw error;
      }
      throw createPrismError(
        ErrorCode.MODEL_ROUTING_FAILED,
        'Claude API request failed',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Route a request to Cloudflare Workers AI
   *
   * @param request - AI request to process
   * @returns AI response from Cloudflare
   * @throws {PrismError} If API call fails
   */
  async routeToCloudflare(request: AIRequest): Promise<AIResponse> {
    if (!this.cloudflareClient) {
      throw createPrismError(
        ErrorCode.MODEL_ROUTING_FAILED,
        'Cloudflare client not configured'
      );
    }

    return await this.cloudflareClient.generate(request);
  }

  /**
   * Check if a model is available
   *
   * @param model - Model identifier
   * @returns True if model is available
   */
  async isAvailable(model: string): Promise<boolean> {
    const spec = MODELS[model];
    if (!spec) {
      return false;
    }

    switch (spec.provider) {
      case 'ollama':
        return await this.ollamaClient.isAvailable();

      case 'anthropic':
        return !!this.anthropicApiKey;

      case 'cloudflare':
        return this.cloudflareClient
          ? await this.cloudflareClient.isAvailable()
          : false;

      default:
        return false;
    }
  }

  /**
   * Calculate query complexity from text
   *
   * @param query - Query text to analyze
   * @returns Complexity score from 0 (simple) to 1 (complex)
   */
  private calculateComplexity(query: string): number {
    const result = this.analyzer.analyze(query);
    return result.score;
  }

  /**
   * ============================================================================
   * COST ESTIMATION
   * ============================================================================
   *
   * Estimates the cost of a request before making it.
   *
   * Formula:
   * --------
   * cost = (input_tokens * input_price + output_tokens * output_price) / 1_000_000
   *
   * Assumptions:
   * ------------
   * - 70% input tokens (user prompt, context, code)
   * - 30% output tokens (model response)
   * - This is a rough estimate based on typical usage patterns
   *
   * Example Calculations:
   * --------------------
   * For 10,000 total tokens with Claude Sonnet ($3/M input, $15/M output):
   * - input: 7,000 tokens → (7,000 / 1,000,000) * $3 = $0.021
   * - output: 3,000 tokens → (3,000 / 1,000,000) * $15 = $0.045
   * - total: $0.066
   *
   * For 100,000 total tokens with Claude Opus ($15/M input, $75/M output):
   * - input: 70,000 tokens → (70,000 / 1,000,000) * $15 = $1.05
   * - output: 30,000 tokens → (30,000 / 1,000,000) * $75 = $2.25
   * - total: $3.30
   *
   * @param tokens - Total estimated token count (input + output)
   * @param spec - Model specification with pricing
   * @returns Estimated cost in USD
   */
  private estimateCost(tokens: number, spec: ModelSpec): number {
    // Assume 70% input, 30% output for estimation
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;

    return (
      (inputTokens / 1_000_000) * spec.inputPrice +
      (outputTokens / 1_000_000) * spec.outputPrice
    );
  }

  /**
   * Get complexity score for a query
   *
   * @param query - Query text
   * @returns Complexity score from 0 to 1
   */
  getComplexity(query: string): number {
    return this.calculateComplexity(query);
  }

  /**
   * Get budget statistics for Cloudflare
   *
   * @returns Budget stats or null if not configured
   */
  getBudgetStats(): {
    used: number;
    remaining: number;
    percentage: number;
    resetsAt: Date;
  } | null {
    return this.cloudflareClient?.getBudgetStats() ?? null;
  }

  /**
   * Get the Ollama client
   *
   * @returns Ollama client instance
   */
  getOllamaClient(): OllamaClient {
    return this.ollamaClient;
  }

  /**
   * Get the Cloudflare client
   *
   * @returns Cloudflare client instance or undefined
   */
  getCloudflareClient(): CloudflareClient | undefined {
    return this.cloudflareClient;
  }

  /**
   * Get the budget tracker
   *
   * @returns Budget tracker or undefined
   */
  getBudgetTracker(): BudgetTracker | undefined {
    return this.budgetTracker;
  }
}
