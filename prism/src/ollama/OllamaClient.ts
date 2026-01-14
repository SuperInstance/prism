/**
 * Ollama Client
 *
 * HTTP client for interacting with Ollama API.
 */

import type {
  OllamaConfig,
  GenerateRequest,
  GenerateResponse,
  ChatRequest,
  ChatResponse,
  EmbeddingResponse,
  StreamChunk,
  ModelInfo,
} from './types.js';
import { OllamaError } from './types.js';

/**
 * Ollama API client
 */
export class OllamaClient {
  private readonly baseUrl: string;
  private readonly config: OllamaConfig;

  constructor(config: Partial<OllamaConfig> = {}) {
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 11434,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      enableStreaming: config.enableStreaming ?? true,
    };
    this.baseUrl = `http://${this.config.host}:${this.config.port}`;
  }

  /**
   * Generate text completion
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    return this.retryRequest(async () => {
      const response = await this.post('/api/generate', {
        ...request,
        stream: false,
      });

      if (!response.ok) {
        throw this.createError(response);
      }

      return await response.json() as GenerateResponse;
    });
  }

  /**
   * Generate text with streaming
   */
  async *generateStream(request: GenerateRequest): AsyncGenerator<string> {
    const response = await this.post('/api/generate', {
      ...request,
      stream: true,
    });

    if (!response.ok) {
      throw this.createError(response);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new OllamaError('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line) as StreamChunk;
              yield chunk.content;
              if (chunk.done) return;
            } catch (e) {
              console.error('Failed to parse streaming chunk:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Chat completion
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.retryRequest(async () => {
      const response = await this.post('/api/chat', {
        ...request,
        stream: false,
      });

      if (!response.ok) {
        throw this.createError(response);
      }

      return await response.json() as ChatResponse;
    });
  }

  /**
   * Chat with streaming
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<string> {
    const response = await this.post('/api/chat', {
      ...request,
      stream: true,
    });

    if (!response.ok) {
      throw this.createError(response);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new OllamaError('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line) as StreamChunk & { message?: { content: string } };
              yield chunk.message?.content || chunk.content;
              if (chunk.done) return;
            } catch (e) {
              console.error('Failed to parse streaming chunk:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Generate embeddings
   */
  async embed(texts: string | string[]): Promise<number[][]> {
    const textArray = Array.isArray(texts) ? texts : [texts];
    const embeddings: number[][] = [];

    for (const text of textArray) {
      const response = await this.retryRequest(async () => {
        const res = await this.post('/api/embeddings', {
          model: 'nomic-embed-text',
          prompt: text,
        });

        if (!res.ok) {
          throw this.createError(res);
        }

        return await res.json() as EmbeddingResponse;
      });

      embeddings.push(response.embedding);
    }

    return embeddings;
  }

  /**
   * List available models
   */
  async listModels(): Promise<ModelInfo[]> {
    return this.retryRequest(async () => {
      const response = await this.get('/api/tags');

      if (!response.ok) {
        throw this.createError(response);
      }

      const data = await response.json() as { models: ModelInfo[] };
      return data.models || [];
    });
  }

  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.get('/api/tags', { timeout: 2000 });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get Ollama version
   */
  async getVersion(): Promise<string> {
    try {
      const response = await this.get('/api/version');
      if (!response.ok) {
        throw this.createError(response);
      }
      const data = await response.json() as { version: string };
      return data.version;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Make a POST request
   */
  private async post(endpoint: string, data: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      return await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Make a GET request
   */
  private async get(endpoint: string, options?: { timeout?: number }): Promise<Response> {
    const controller = new AbortController();
    const timeout = options?.timeout || this.config.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      return await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Retry a request with exponential backoff
   */
  private async retryRequest<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.config.maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new OllamaError('Max retries exceeded');
  }

  /**
   * Create an error from response
   */
  private createError(response: Response): OllamaError {
    return new OllamaError(
      `Ollama request failed: ${response.statusText}`,
      response.status
    );
  }
}
