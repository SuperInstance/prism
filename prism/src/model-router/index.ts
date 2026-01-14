/**
 * Model Router Module
 *
 * This module provides intelligent routing to optimal AI models.
 */

import { OllamaClient, ModelDetector, type TaskType } from '../ollama/index.js';

/**
 * Available AI models
 */
export type AIModel =
  | 'ollama' // Local Ollama model
  | 'claude-haiku'
  | 'claude-sonnet'
  | 'claude-opus';

/**
 * Model routing decision
 */
export interface RoutingDecision {
  model: AIModel;
  ollamaModel?: string; // Specific Ollama model to use
  reasoning: string;
  estimatedCost: number;
  estimatedLatency?: number; // Estimated response time in ms
}

/**
 * Model router configuration
 */
export interface RouterConfig {
  preferLocal: boolean;
  localEndpoint?: string;
  apiKey?: string;
  enableOllama?: boolean; // Enable Ollama integration
}

/**
 * Model router class
 */
export class ModelRouter {
  private config: RouterConfig;
  private ollamaClient?: OllamaClient;
  private modelDetector?: ModelDetector;
  private ollamaAvailable = false;

  constructor(config: RouterConfig) {
    this.config = config;

    // Initialize Ollama if enabled
    if (config.enableOllama !== false) {
      this.initializeOllama();
    }
  }

  /**
   * Initialize Ollama integration
   */
  private async initializeOllama(): Promise<void> {
    try {
      this.ollamaClient = new OllamaClient();
      this.modelDetector = new ModelDetector(this.ollamaClient);
      this.ollamaAvailable = await this.ollamaClient.isAvailable();

      if (this.ollamaAvailable) {
        console.log('✅ Ollama is available for local inference');
      }
    } catch (error) {
      console.warn('⚠️  Ollama initialization failed:', error);
      this.ollamaAvailable = false;
    }
  }

  /**
   * Route a request to the optimal model
   */
  async route(tokens: number, complexity: number, taskType?: TaskType): Promise<RoutingDecision> {
    // Ensure Ollama is initialized
    if (!this.ollamaClient && this.config.enableOllama !== false) {
      await this.initializeOllama();
    }

    // Prefer local models if available and configured
    if (this.config.preferLocal && this.ollamaAvailable && tokens < 16000) {
      try {
        const recommendation = await this.modelDetector!.recommendModelForTask(
          taskType || 'general'
        );

        return {
          model: 'ollama',
          ollamaModel: recommendation.model,
          reasoning: `${recommendation.reasoning} (free, local)`,
          estimatedCost: 0,
          estimatedLatency: tokens / (recommendation.estimatedTokensPerSecond || 30) * 1000,
        };
      } catch (error) {
        console.warn('Failed to get Ollama recommendation:', error);
      }
    }

    // Route to Claude models
    if (tokens < 20000 && complexity < 0.5) {
      return {
        model: 'claude-haiku',
        reasoning: 'Simple task, use fast model ($0.25/M input)',
        estimatedCost: (tokens / 1_000_000) * 0.25,
        estimatedLatency: 1000,
      };
    }

    if (tokens < 100000) {
      return {
        model: 'claude-sonnet',
        reasoning: 'Balanced model for most tasks ($3/M input)',
        estimatedCost: (tokens / 1_000_000) * 3.0,
        estimatedLatency: 2000,
      };
    }

    return {
      model: 'claude-opus',
      reasoning: 'Complex task, use best model ($15/M input)',
      estimatedCost: (tokens / 1_000_000) * 15.0,
      estimatedLatency: 3000,
    };
  }

  /**
   * Get the Ollama client (if available)
   */
  getOllamaClient(): OllamaClient | undefined {
    return this.ollamaClient;
  }

  /**
   * Get the model detector (if available)
   */
  getModelDetector(): ModelDetector | undefined {
    return this.modelDetector;
  }

  /**
   * Check if Ollama is available
   */
  isOllamaAvailable(): boolean {
    return this.ollamaAvailable;
  }
}
