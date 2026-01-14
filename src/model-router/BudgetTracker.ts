/**
 * ============================================================================
 * CLOUDFLARE WORKERS AI BUDGET TRACKING
 * ============================================================================
 *
 * Tracks daily neuron usage to stay within Cloudflare's free tier limits.
 *
 * Cloudflare Free Tier (as of 2024):
 * ----------------------------------
 * - 10,000 neurons per day
 * - Resets at midnight UTC
 * - Neurons are a proprietary metric (roughly correlates to token count)
 *
 * Budget Strategy:
 * ----------------
 * - Target: 5,000 neurons/day (50% of free tier for safety margin)
 * - Alert at: 9,000 neurons (90% of limit)
 * - Hard limit: 10,000 neurons (100% of free tier)
 *
 * Why 50% Target?
 * --------------
 * - Prevents unexpected overages
 * - Allows for burst usage during development
 * - Accounts for estimation errors
 * - Leaves buffer for production incidents
 *
 * Neuron Costs by Model (per 1M tokens):
 * --------------------------------------
 * - Llama 3.2 1B: 2,457 neurons
 * - Llama 3.1 8B (FP8): 4,119 neurons
 * - Llama 3.1 8B: 8,239 neurons
 * - Mistral 7B: 10,000 neurons
 * - DeepSeek R1: 16,384 neurons
 *
 * Cost Calculation Example:
 * -------------------------
 * For a 5,000 token request with Llama 3.1 8B:
 * - Neurons = (8,239 * 5,000) / 1,000,000 = 41.2 neurons
 * - With 5,000 neuron daily budget: ~121 requests per day
 * - With 10,000 neuron hard limit: ~243 requests per day
 *
 * Reset Behavior:
 * --------------
 * - Budget resets at midnight UTC every day
 * - State persisted to localStorage (browser) or file (Node.js)
 * - Automatic reset when accessed after midnight
 *
 * @see https://developers.cloudflare.com/workers-ai/
 */

/**
 * Daily neuron limits for Cloudflare Workers AI
 * Based on free tier as of 2024
 */
export const DAILY_NEURON_LIMIT = 10_000;

/**
 * Alert threshold (percentage of limit)
 */
const ALERT_THRESHOLD = 0.9;

/**
 * Storage key for budget persistence
 */
const STORAGE_KEY = 'prism-budget-tracker';

/**
 * Budget state
 */
interface BudgetState {
  /** Daily neuron usage */
  dailyNeurons: number;

  /** Unix timestamp when budget resets */
  dailyResetsAt: number;

  /** Last update timestamp */
  lastUpdated: number;
}

/**
 * ============================================================================
 * MODEL NEURON COSTS
 * ============================================================================
 *
 * These costs represent the neuron consumption per 1M tokens for each model.
 *
 * How Neurons Work:
 * ----------------
 * Neurons are Cloudflare's proprietary metric for AI inference cost.
 * They roughly correlate to:
 * - Model size (parameter count)
 * - Token count (input + output)
 * - Computational complexity
 *
 * Cost Formula:
 * -------------
 * neurons = (model_cost * tokens) / 1_000_000
 *
 * Example with Llama 3.1 8B:
 * - Cost: 8,239 neurons per 1M tokens
 * - For 5,000 tokens: (8,239 * 5,000) / 1,000,000 = 41.2 neurons
 *
 * Model Selection Strategy:
 * ------------------------
 * - Prefer smaller models (Llama 3.2 1B) for simple tasks
 * - Use medium models (Llama 3.1 8B) for general tasks
 * - Reserve larger models (Mistral 7B) for complex tasks
 * - This maximizes the number of requests within free tier
 */
const MODEL_COSTS: Record<string, number> = {
  '@cf/meta/llama-3.2-1b-instruct': 2457,
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast': 4119,
  '@cf/meta/llama-3.1-8b-instruct': 8239,
  '@cf/mistral/mistral-7b-instruct-v0.1': 10000,
  '@cf/mistral/mistral-7b-instruct-v0.2': 10000,
  '@cf/deepseek-ai/deepseek-r1': 16384,
};

/**
 * ============================================================================
 * BUDGET TRACKER IMPLEMENTATION
 * ============================================================================
 *
 * This class tracks neuron usage to prevent exceeding Cloudflare's free tier.
 *
 * Persistence Strategy:
 * --------------------
 * - Browser: localStorage (survives page refreshes)
 * - Node.js: File system (TODO: not yet implemented)
 * - Disabled: In-memory only (resets on restart)
 *
 * Security Note:
 * -------------
 * - No authentication/authorization currently implemented
 * - Anyone with access to the storage can modify the budget
 * - For production, implement:
 *   - Server-side budget tracking
 *   - User-specific quotas
 *   - Audit logging
 *   - Rate limiting per user/API key
 *
 * Usage Example:
 * -------------
 * ```typescript
 * const tracker = new BudgetTracker(true); // Enable persistence
 *
 * // Check if we can afford a request
 * if (tracker.canAfford('@cf/meta/llama-3.1-8b-instruct', 5000)) {
 *   // Make the request
 *   const response = await cloudflare.generate(request);
 *
 *   // Track actual usage
 *   await tracker.trackUsage('@cf/meta/llama-3.1-8b-instruct', response.tokensUsed);
 * }
 *
 * // Get current stats
 * const stats = tracker.getStats();
 * console.log(`Used ${stats.percentage.toFixed(1)}% of daily budget`);
 * console.log(`Resets at ${stats.resetsAt.toISOString()}`);
 * ```
 */
export class BudgetTracker {
  private state: BudgetState;
  private persistEnabled: boolean;

  constructor(persistEnabled: boolean = true) {
    this.persistEnabled = persistEnabled;
    this.state = this.loadState();
  }

  /**
   * Check if we can afford a request
   *
   * This should be called BEFORE making a request to prevent overages.
   *
   * @param model - Model identifier (e.g., '@cf/meta/llama-3.1-8b-instruct')
   * @param tokens - Estimated token count for the request
   * @returns True if the request is within budget, false otherwise
   *
   * Example:
   * -------
   * ```typescript
   * // Check if we can afford a 5K token request with Llama 3.1 8B
   * if (tracker.canAfford('@cf/meta/llama-3.1-8b-instruct', 5000)) {
   *   // Cost: 41.2 neurons
   *   // Remaining: 9,958.8 neurons
   *   // Proceed with request
   * } else {
   *   // Not enough neurons, wait for reset or use different model
   * }
   * ```
   */
  canAfford(model: string, tokens: number): boolean {
    const cost = this.getCost(model, tokens);
    const remaining = this.getRemainingNeurons();
    return cost <= remaining;
  }

  /**
   * Track usage after a request
   *
   * This should be called AFTER a request completes with actual token count.
   *
   * Side Effects:
   * -------------
   * - Updates daily neuron usage
   * - Triggers alert at 90% of limit
   * - Persists state to storage (if enabled)
   *
   * @param model - Model identifier (e.g., '@cf/meta/llama-3.1-8b-instruct')
   * @param tokens - Actual token count used by the request
   *
   * Example:
   * -------
   * ```typescript
   * const response = await cloudflare.generate(request);
   * await tracker.trackUsage('@cf/meta/llama-3.1-8b-instruct', response.tokensUsed);
   * // If usage exceeds 9,000 neurons, an alert will be logged
   * ```
   */
  async trackUsage(model: string, tokens: number): Promise<void> {
    const cost = this.getCost(model, tokens);
    this.state.dailyNeurons += cost;
    this.state.lastUpdated = Date.now();

    // Check if approaching limit
    if (this.state.dailyNeurons > DAILY_NEURON_LIMIT * ALERT_THRESHOLD) {
      await this.alertApproachingLimit();
    }

    // Persist state if enabled
    if (this.persistEnabled) {
      this.saveState();
    }
  }

  /**
   * Get remaining neurons for today
   *
   * Automatically checks for midnight reset and updates if needed.
   *
   * @returns Remaining neuron count (0 to 10,000)
   *
   * Example:
   * -------
   * ```typescript
   * const remaining = tracker.getRemainingNeurons();
   * console.log(`Remaining: ${remaining} neurons`);
   * // Output: "Remaining: 9958.8 neurons"
   * ```
   */
  getRemainingNeurons(): number {
    this.checkReset();
    return Math.max(0, DAILY_NEURON_LIMIT - this.state.dailyNeurons);
  }

  /**
   * Get usage statistics
   *
   * Returns a snapshot of current budget usage.
   * Automatically checks for midnight reset.
   *
   * @returns Usage stats with used, remaining, percentage, and reset time
   *
   * Example:
   * -------
   * ```typescript
   * const stats = tracker.getStats();
   * console.log(`Used: ${stats.used} neurons`);
   * console.log(`Remaining: ${stats.remaining} neurons`);
   * console.log(`Percentage: ${stats.percentage.toFixed(1)}%`);
   * console.log(`Resets at: ${stats.resetsAt.toISOString()}`);
   * // Output:
   * // "Used: 41.2 neurons"
   * // "Remaining: 9958.8 neurons"
   * // "Percentage: 0.4%"
   * // "Resets at: 2024-01-14T00:00:00.000Z"
   * ```
   */
  getStats(): {
    used: number;
    remaining: number;
    percentage: number;
    resetsAt: Date;
  } {
    this.checkReset();

    return {
      used: this.state.dailyNeurons,
      remaining: this.getRemainingNeurons(),
      percentage: (this.state.dailyNeurons / DAILY_NEURON_LIMIT) * 100,
      resetsAt: new Date(this.state.dailyResetsAt),
    };
  }

  /**
   * Get cost for a model and token count
   *
   * Calculates the neuron cost for a request using the model's base cost.
   *
   * Formula:
   * --------
   * neurons = (base_cost * tokens) / 1_000_000
   *
   * Note:
   * -----
   * Unlike Anthropic's pricing (separate input/output), Cloudflare's neurons
   * are a single metric for the entire request. We don't separate input/output.
   *
   * @param model - Model identifier (e.g., '@cf/meta/llama-3.1-8b-instruct')
   * @param tokens - Token count for the request
   * @returns Neuron cost for the request
   *
   * Example:
   * -------
   * ```typescript
   * const cost = tracker.getCost('@cf/meta/llama-3.1-8b-instruct', 5000);
   * console.log(`Cost: ${cost} neurons`);
   * // Output: "Cost: 41.195 neurons"
   *
   * const costLarge = tracker.getCost('@cf/meta/llama-3.1-8b-instruct', 50000);
   * console.log(`Cost: ${costLarge} neurons`);
   * // Output: "Cost: 411.95 neurons"
   * ```
   */
  getCost(model: string, tokens: number): number {
    // Get base cost per 1M tokens
    const baseCost = MODEL_COSTS[model] || MODEL_COSTS['@cf/meta/llama-3.1-8b-instruct'];

    // Calculate cost (assume 70% input, 30% output)
    // Note: Neurons are roughly per 1M tokens, not per input/output
    return (baseCost * tokens) / 1_000_000;
  }

  /**
   * Reset daily budget
   */
  reset(): void {
    this.state.dailyNeurons = 0;
    this.state.dailyResetsAt = this.getNextMidnight();
    this.state.lastUpdated = Date.now();

    if (this.persistEnabled) {
      this.saveState();
    }
  }

  /**
   * Check if budget needs reset
   */
  private checkReset(): void {
    const now = Date.now();
    if (now >= this.state.dailyResetsAt) {
      this.reset();
    }
  }

  /**
   * Get next midnight UTC timestamp
   *
   * Calculates the Unix timestamp for the next midnight UTC.
   * This is when the daily budget resets.
   *
   * Algorithm:
   * ----------
   * 1. Get current date/time
   * 2. Add 1 day
   * 3. Set time to 00:00:00.000 UTC
   *
   * Example:
   * -------
   * If current time is 2024-01-13T15:30:00Z:
   * - Next midnight is 2024-01-14T00:00:00Z
   * - Unix timestamp: 1705200000000
   *
   * @returns Unix timestamp (milliseconds since epoch)
   */
  private getNextMidnight(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  /**
   * Alert when approaching limit
   */
  private async alertApproachingLimit(): Promise<void> {
    const stats = this.getStats();
    const message = `⚠️  Approaching Cloudflare neuron limit: ${stats.percentage.toFixed(1)}% used (${stats.used.toLocaleString()} / ${DAILY_NEURON_LIMIT.toLocaleString()} neurons). Resets at ${stats.resetsAt.toISOString()}.`;

    // Log to console
    console.warn(message);

    // In a real implementation, you might:
    // - Send a notification
    // - Store in a log file
    // - Emit an event
    // - Show a UI alert
  }

  /**
   * Load state from storage
   *
   * @returns Budget state
   */
  private loadState(): BudgetState {
    // Always return fresh state when persistence is disabled
    if (!this.persistEnabled) {
      return {
        dailyNeurons: 0,
        dailyResetsAt: this.getNextMidnight(),
        lastUpdated: Date.now(),
      };
    }

    try {
      // Try to load from localStorage (browser) or file (Node.js)
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as BudgetState;
          // Check if reset is needed
          if (Date.now() >= parsed.dailyResetsAt) {
            return {
              dailyNeurons: 0,
              dailyResetsAt: this.getNextMidnight(),
              lastUpdated: Date.now(),
            };
          }
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load budget state:', error);
    }

    // Return default state
    return {
      dailyNeurons: 0,
      dailyResetsAt: this.getNextMidnight(),
      lastUpdated: Date.now(),
    };
  }

  /**
   * Save state to storage
   */
  private saveState(): void {
    if (!this.persistEnabled) {
      return;
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
      // In Node.js, you might write to a file here
    } catch (error) {
      console.warn('Failed to save budget state:', error);
    }
  }
}

/**
 * Create a budget tracker with default settings
 */
export function createBudgetTracker(persistEnabled: boolean = true): BudgetTracker {
  return new BudgetTracker(persistEnabled);
}
