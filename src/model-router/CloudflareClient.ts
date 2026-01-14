/**
 * Cloudflare Client
 *
 * Client for interacting with Cloudflare Workers AI API.
 */

import type { AIRequest } from '../core/interfaces/index.js';
import { createPrismError, ErrorCode } from '../core/types/index.js';
import type { CloudflareRequest, CloudflareResponse } from './RequestFormatter.js';
import { BudgetTracker, DAILY_NEURON_LIMIT } from './BudgetTracker.js';

/**
 * Cloudflare client configuration
 */
export interface CloudflareClientConfig {
  /** Cloudflare account ID */
  accountId: string;

  /** Cloudflare API token */
  apiToken: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Optional budget tracker */
  budgetTracker?: BudgetTracker;
}

/**
 * Cloudflare client
 */
export class CloudflareClient {
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly timeout: number;
  private readonly baseUrl = 'https://api.cloudflare.com/client/v4';
  private readonly budgetTracker?: BudgetTracker;

  // Default models
  private readonly defaultModel = '@cf/meta/llama-3.1-8b-instruct';

  constructor(config: CloudflareClientConfig) {
    this.accountId = config.accountId;
    this.apiToken = config.apiToken;
    this.timeout = config.timeout || 30000;
    this.budgetTracker = config.budgetTracker;
  }

  /**
   * Check if Cloudflare API is accessible
   *
   * @returns True if API is accessible
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try to list available AI models
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/ai/models`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
          },
          signal: AbortSignal.timeout(5000),
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if we have sufficient budget for a request
   *
   * @param model - Model identifier
   * @param tokens - Estimated token count
   * @returns True if request is within budget
   */
  canAfford(model: string, tokens: number): boolean {
    if (!this.budgetTracker) {
      return true; // No budget tracking enabled
    }

    return this.budgetTracker.canAfford(model, tokens);
  }

  /**
   * Get budget statistics
   *
   * @returns Budget stats or null if no tracker
   */
  getBudgetStats(): {
    used: number;
    remaining: number;
    percentage: number;
    resetsAt: Date;
  } | null {
    if (!this.budgetTracker) {
      return null;
    }

    return this.budgetTracker.getStats();
  }

  /**
   * Generate text using Cloudflare Workers AI
   *
   * @param request - AI request
   * @returns Generated text and metadata
   */
  async generate(request: AIRequest): Promise<{
    text: string;
    tokensUsed: number;
    cost: number;
    model: string;
    duration: number;
  }> {
    const startTime = performance.now();

    try {
      const modelName = request.model?.replace('cloudflare:', '') || this.defaultModel;

      // Check budget before making request
      const estimatedTokens = this.estimateTokens(request.prompt);
      if (!this.canAfford(modelName, estimatedTokens)) {
        throw createPrismError(
          ErrorCode.MODEL_ROUTING_FAILED,
          'Insufficient Cloudflare neuron budget for this request'
        );
      }

      const cfRequest: CloudflareRequest = {
        prompt: request.prompt,
        max_tokens: request.maxTokens ?? 2048,
        temperature: request.temperature ?? 0.7,
        stop: request.stopSequences ?? [],
      };

      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/ai/run/${modelName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiToken}`,
          },
          body: JSON.stringify(cfRequest),
          signal: AbortSignal.timeout(this.timeout),
        }
      );

      if (!response.ok) {
        const errorData = await response.json() as { errors?: Array<{ message: string }> };
        throw new Error(`Cloudflare API error: ${errorData.errors?.[0]?.message || response.statusText}`);
      }

      const data = await response.json() as CloudflareResponse;

      // Check for errors in response
      if (data.errors && data.errors.length > 0) {
        throw new Error(`Cloudflare AI error: ${data.errors[0].message}`);
      }

      const duration = performance.now() - startTime;

      // Track usage
      if (this.budgetTracker) {
        await this.budgetTracker.trackUsage(modelName, estimatedTokens);
      }

      return {
        text: data.result?.response ?? data.result?.text ?? '',
        tokensUsed: estimatedTokens, // Cloudflare doesn't return actual count
        cost: 0, // Free tier
        model: `cloudflare:${modelName}`,
        duration,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'PrismError') {
        throw error;
      }

      throw createPrismError(
        ErrorCode.MODEL_ROUTING_FAILED,
        'Cloudflare API request failed',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * List available AI models
   *
   * @returns Array of model information
   */
  async getModels(): Promise<Array<{ name: string; description?: string }>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/ai/models`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
          },
          signal: AbortSignal.timeout(this.timeout),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json() as {
        result?: Array<{ name: string; description?: string }>;
      };

      return data.result || [];
    } catch (error) {
      throw createPrismError(
        ErrorCode.MODEL_ROUTING_FAILED,
        'Failed to fetch Cloudflare models',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Estimate token count for text
   *
   * Uses a simple heuristic (~4 chars per token).
   *
   * @param text - Text to estimate
   * @returns Estimated token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get account ID
   *
   * @returns Account ID
   */
  getAccountId(): string {
    return this.accountId;
  }

  /**
   * Get budget tracker
   *
   * @returns Budget tracker or undefined
   */
  getBudgetTracker(): BudgetTracker | undefined {
    return this.budgetTracker;
  }
}

/**
 * Create a Cloudflare client with default settings
 */
export function createCloudflareClient(config: CloudflareClientConfig): CloudflareClient {
  return new CloudflareClient(config);
}
