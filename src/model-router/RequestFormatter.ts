/**
 * Request Formatter
 *
 * Formats AI requests for different provider APIs (Ollama, Claude, Cloudflare).
 */

import type { AIRequest } from '../core/interfaces/index.js';

/**
 * Ollama API request format
 */
export interface OllamaRequest {
  /** Model name */
  model: string;

  /** Prompt text */
  prompt: string;

  /** Enable streaming */
  stream?: boolean;

  /** Generation options */
  options?: {
    /** Temperature (0-1) */
    temperature?: number;

    /** Maximum tokens to generate */
    num_predict?: number;

    /** Top-k sampling */
    top_k?: number;

    /** Top-p sampling */
    top_p?: number;

    /** Stop sequences */
    stop?: string[];
  };
}

/**
 * Ollama API response format
 */
export interface OllamaResponse {
  /** Generated text */
  response?: string;

  /** Prompt evaluation count */
  prompt_eval_count?: number;

  /** Generation count */
  eval_count?: number;

  /** Error message */
  error?: string;
}

/**
 * Claude API request format
 */
export interface ClaudeRequest {
  /** Model identifier */
  model: string;

  /** Maximum tokens to generate */
  max_tokens: number;

  /** Message history */
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;

  /** Temperature (0-1) */
  temperature?: number;

  /** Stop sequences */
  stop_sequences?: string[];

  /** Anthropic API version */
  anthropic_version?: string;
}

/**
 * Claude API response format
 */
export interface ClaudeResponse {
  /** Message content */
  content?: Array<{
    type: string;
    text: string;
  }>;

  /** Usage information */
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };

  /** Error information */
  error?: {
    message: string;
    type: string;
  };
}

/**
 * Cloudflare API request format
 */
export interface CloudflareRequest {
  /** Prompt text */
  prompt: string;

  /** Maximum tokens to generate */
  max_tokens?: number;

  /** Temperature (0-1) */
  temperature?: number;

  /** Stop sequences */
  stop?: string[];
}

/**
 * Cloudflare API response format
 */
export interface CloudflareResponse {
  /** Result object */
  result?: {
    /** Generated response */
    response?: string;

    /** Generated text */
    text?: string;
  };

  /** Errors array */
  errors?: Array<{
    message: string;
    code: number;
  }>;

  /** Success flag */
  success?: boolean;
}

/**
 * Request formatter
 */
export class RequestFormatter {
  /**
   * Format request for Ollama API
   *
   * @param request - Original AI request
   * @param context - Optional context chunks
   * @returns Formatted Ollama request
   */
  formatForOllama(request: AIRequest, context?: string[]): OllamaRequest {
    const model = request.model?.replace('ollama:', '') || 'deepseek-coder-v2';

    return {
      model,
      prompt: this.buildPrompt(request, context),
      stream: false, // TODO: Support streaming in future
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? 2048,
        top_k: 40,
        top_p: 0.9,
        stop: request.stopSequences ?? [],
      },
    };
  }

  /**
   * Format request for Claude API
   *
   * @param request - Original AI request
   * @param context - Optional context chunks
   * @returns Formatted Claude request
   */
  formatForClaude(request: AIRequest, context?: string[]): ClaudeRequest {
    const model = request.model?.replace('anthropic:', '') || 'claude-3-5-sonnet-20241022';

    return {
      model,
      max_tokens: request.maxTokens ?? 4096,
      messages: [
        {
          role: 'user',
          content: this.buildPrompt(request, context),
        },
      ],
      temperature: request.temperature ?? 0.7,
      stop_sequences: request.stopSequences ?? [],
      anthropic_version: '2023-06-01',
    };
  }

  /**
   * Format request for Cloudflare API
   *
   * @param request - Original AI request
   * @param context - Optional context chunks
   * @returns Formatted Cloudflare request
   */
  formatForCloudflare(request: AIRequest, context?: string[]): CloudflareRequest {
    return {
      prompt: this.buildPrompt(request, context),
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
      stop: request.stopSequences ?? [],
    };
  }

  /**
   * Build prompt with optional context
   *
   * @param request - AI request
   * @param context - Optional context chunks
   * @returns Built prompt
   */
  private buildPrompt(request: AIRequest, context?: string[]): string {
    if (!context || context.length === 0) {
      return request.prompt;
    }

    // Build context section
    const contextText = context.join('\n\n');

    return `Context:
${contextText}

Query:
${request.prompt}`;
  }

  /**
   * Format Ollama response to AIResponse
   *
   * @param response - Ollama API response
   * @param model - Model identifier
   * @param duration - Request duration in ms
   * @returns Formatted AI response
   */
  formatOllamaResponse(
    response: OllamaResponse,
    model: string,
    duration: number
  ): { text: string; tokensUsed: number; cost: number; model: string; duration: number } {
    return {
      text: response.response || '',
      tokensUsed: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
      cost: 0, // Ollama is free
      model: `ollama:${model}`,
      duration,
    };
  }

  /**
   * Format Claude response to AIResponse
   *
   * @param response - Claude API response
   * @param model - Model identifier
   * @param duration - Request duration in ms
   * @param inputPrice - Input price per million tokens
   * @param outputPrice - Output price per million tokens
   * @returns Formatted AI response
   */
  formatClaudeResponse(
    response: ClaudeResponse,
    model: string,
    duration: number,
    inputPrice: number = 3.0,
    outputPrice: number = 15.0
  ): { text: string; tokensUsed: number; cost: number; model: string; duration: number } {
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    // Calculate cost
    const cost =
      (inputTokens / 1_000_000) * inputPrice +
      (outputTokens / 1_000_000) * outputPrice;

    return {
      text: response.content?.[0]?.text ?? '',
      tokensUsed: inputTokens + outputTokens,
      cost,
      model: `anthropic:${model}`,
      duration,
    };
  }

  /**
   * Format Cloudflare response to AIResponse
   *
   * @param response - Cloudflare API response
   * @param model - Model identifier
   * @param duration - Request duration in ms
   * @returns Formatted AI response
   */
  formatCloudflareResponse(
    response: CloudflareResponse,
    model: string,
    duration: number
  ): { text: string; tokensUsed: number; cost: number; model: string; duration: number } {
    return {
      text: response.result?.response ?? response.result?.text ?? '',
      tokensUsed: 0, // Cloudflare doesn't return token count
      cost: 0, // Free tier
      model: `cloudflare:${model}`,
      duration,
    };
  }

  /**
   * Extract error from Ollama response
   *
   * @param response - Ollama API response
   * @returns Error message or null
   */
  extractOllamaError(response: OllamaResponse): string | null {
    return response.error ?? null;
  }

  /**
   * Extract error from Claude response
   *
   * @param response - Claude API response
   * @returns Error message or null
   */
  extractClaudeError(response: ClaudeResponse): string | null {
    return response.error?.message ?? null;
  }

  /**
   * Extract error from Cloudflare response
   *
   * @param response - Cloudflare API response
   * @returns Error message or null
   */
  extractCloudflareError(response: CloudflareResponse): string | null {
    return response.errors?.[0]?.message ?? null;
  }

  /**
   * Check if Ollama response is successful
   *
   * @param response - Ollama API response
   * @returns True if successful
   */
  isOllamaSuccess(response: OllamaResponse): boolean {
    return !response.error && !!response.response;
  }

  /**
   * Check if Claude response is successful
   *
   * @param response - Claude API response
   * @returns True if successful
   */
  isClaudeSuccess(response: ClaudeResponse): boolean {
    return !response.error && !!response.content?.[0]?.text;
  }

  /**
   * Check if Cloudflare response is successful
   *
   * @param response - Cloudflare API response
   * @returns True if successful
   */
  isCloudflareSuccess(response: CloudflareResponse): boolean {
    return !!(response.success !== false && response.result);
  }
}

/**
 * Create a request formatter with default settings
 */
export function createRequestFormatter(): RequestFormatter {
  return new RequestFormatter();
}
