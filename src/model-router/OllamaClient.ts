/**
 * Ollama Client
 *
 * Client for interacting with Ollama API (local LLM server).
 */

import type { AIRequest } from '../core/interfaces/index.js';
import { createPrismError, ErrorCode } from '../core/types/index.js';
import type { OllamaRequest, OllamaResponse } from './RequestFormatter.js';

/**
 * Ollama client configuration
 */
export interface OllamaClientConfig {
  /** Ollama server URL */
  url?: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Default model to use */
  defaultModel?: string;
}

/**
 * Ollama model information
 */
export interface OllamaModel {
  /** Model name */
  name: string;

  /** Model size in bytes */
  size?: number;

  /** Quantization level */
  quantization_level?: string;

  /** Last modified timestamp */
  modified_at?: string;
}

/**
 * Ollama client
 */
export class OllamaClient {
  private readonly url: string;
  private readonly timeout: number;
  private readonly defaultModel: string;

  constructor(config?: OllamaClientConfig) {
    this.url = config?.url || 'http://localhost:11434';
    this.timeout = config?.timeout || 30000;
    this.defaultModel = config?.defaultModel || 'deepseek-coder-v2';
  }

  /**
   * Check if Ollama is available
   *
   * @returns True if Ollama is running and accessible
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.url}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available models
   *
   * @returns Array of model information
   */
  async getModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.url}/api/tags`, {
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json() as { models?: OllamaModel[] };

      return data.models || [];
    } catch (error) {
      throw createPrismError(
        ErrorCode.MODEL_ROUTING_FAILED,
        'Failed to fetch Ollama models',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Check if a specific model is available
   *
   * @param modelName - Model name to check
   * @returns True if model is available
   */
  async hasModel(modelName: string): Promise<boolean> {
    try {
      const models = await this.getModels();
      return models.some((model) => model.name.includes(modelName));
    } catch {
      return false;
    }
  }

  /**
   * Generate text using Ollama
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
      const modelName = request.model?.replace('ollama:', '') || this.defaultModel;

      const ollamaRequest: OllamaRequest = {
        model: modelName,
        prompt: request.prompt,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 2048,
          stop: request.stopSequences ?? [],
        },
      };

      const response = await fetch(`${this.url}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ollamaRequest),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as OllamaResponse;

      if (data.error) {
        throw new Error(`Ollama error: ${data.error}`);
      }

      const duration = performance.now() - startTime;

      return {
        text: data.response || '',
        tokensUsed: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
        cost: 0, // Ollama is free
        model: `ollama:${modelName}`,
        duration,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'PrismError') {
        throw error;
      }

      throw createPrismError(
        ErrorCode.MODEL_ROUTING_FAILED,
        'Ollama request failed',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Generate text with streaming (not yet implemented)
   *
   * @param request - AI request
   * @returns Async generator of text chunks
   */
  async *stream(request: AIRequest): AsyncGenerator<string, void, unknown> {
    // TODO: Implement streaming support
    throw new Error('Streaming not yet implemented for Ollama');
  }

  /**
   * Pull a model from Ollama registry
   *
   * @param modelName - Model name to pull
   * @param onProgress - Optional progress callback
   */
  async pullModel(
    modelName: string,
    onProgress?: (status: string, digest?: string, total?: number, completed?: number) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.url}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modelName,
          stream: true,
        }),
        signal: AbortSignal.timeout(300000), // 5 minute timeout for pulling
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      // Stream the response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as {
              status?: string;
              digest?: string;
              total?: number;
              completed?: number;
            };

            if (onProgress) {
              onProgress(data.status, data.digest, data.total, data.completed);
            }
          } catch {
            // Ignore invalid JSON lines
          }
        }
      }
    } catch (error) {
      throw createPrismError(
        ErrorCode.MODEL_ROUTING_FAILED,
        'Failed to pull Ollama model',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get Ollama server version
   *
   * @returns Version string
   */
  async getVersion(): Promise<string> {
    try {
      const response = await fetch(`${this.url}/api/version`, {
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to get version: ${response.statusText}`);
      }

      const data = await response.json() as { version?: string };

      return data.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get server URL
   *
   * @returns Server URL
   */
  getUrl(): string {
    return this.url;
  }

  /**
   * Get default model
   *
   * @returns Default model name
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }
}

/**
 * Create an Ollama client with default settings
 */
export function createOllamaClient(config?: OllamaClientConfig): OllamaClient {
  return new OllamaClient(config);
}
