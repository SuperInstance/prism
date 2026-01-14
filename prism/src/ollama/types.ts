/**
 * Ollama Types and Interfaces
 *
 * Type definitions for Ollama API integration.
 */

/**
 * Ollama configuration
 */
export interface OllamaConfig {
  /** Ollama server hostname */
  host: string;
  /** Ollama server port */
  port: number;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Maximum retries for failed requests */
  maxRetries: number;
  /** Enable streaming responses */
  enableStreaming: boolean;
}

/**
 * Default Ollama configuration
 */
export const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  host: 'localhost',
  port: 11434,
  timeout: 30000,
  maxRetries: 3,
  enableStreaming: true,
};

/**
 * Generate request parameters
 */
export interface GenerateRequest {
  /** Model name */
  model: string;
  /** Prompt text */
  prompt: string;
  /** System prompt */
  system?: string;
  /** Temperature (0.0 - 1.0) */
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    repeat_penalty?: number;
    repeat_last_n?: number;
    seed?: number;
    num_ctx?: number; // Context window size
  };
  /** Format (json or text) */
  format?: 'json' | 'text';
}

/**
 * Generate response
 */
export interface GenerateResponse {
  /** Generated text */
  response: string;
  /** Generation context */
  context?: number[];
  /** Time taken in milliseconds */
  total_duration?: number;
  /** Load time in milliseconds */
  load_duration?: number;
  /** Number of tokens in prompt */
  prompt_eval_count?: number;
  /** Time to evaluate prompt in nanoseconds */
  prompt_eval_duration?: number;
  /** Number of tokens generated */
  eval_count?: number;
  /** Time to generate in nanoseconds */
  eval_duration?: number;
}

/**
 * Chat message
 */
export interface ChatMessage {
  /** Message role */
  role: 'system' | 'user' | 'assistant';
  /** Message content */
  content: string;
}

/**
 * Chat request
 */
export interface ChatRequest {
  /** Model name */
  model: string;
  /** Chat messages */
  messages: ChatMessage[];
  /** Generation options */
  options?: GenerateRequest['options'];
  /** Stream response */
  stream?: boolean;
}

/**
 * Chat response
 */
export interface ChatResponse {
  /** Message content */
  message: ChatMessage;
  /** Generation context */
  context?: number[];
  /** Time taken in milliseconds */
  total_duration?: number;
  /** Load time in milliseconds */
  load_duration?: number;
  /** Number of tokens in prompt */
  prompt_eval_count?: number;
  /** Time to evaluate prompt in nanoseconds */
  prompt_eval_duration?: number;
  /** Number of tokens generated */
  eval_count?: number;
  /** Time to generate in nanoseconds */
  eval_duration?: number;
}

/**
 * Embedding request
 */
export interface EmbeddingRequest {
  /** Model name (e.g., 'nomic-embed-text') */
  model: string;
  /** Text to embed */
  prompt: string;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  /** Embedding vector */
  embedding: number[];
}

/**
 * Model information
 */
export interface ModelInfo {
  /** Model name */
  name: string;
  /** Model size in bytes */
  size: number;
  /** Digest hash */
  digest: string;
  /** Model details */
  details: {
    /** Model format */
    format: string;
    /** Model family */
    family: string;
    /** Model families */
    families: string[];
    /** Parameter size */
    parameter_size: string;
    /** Quantization level */
    quantization_level: string;
  };
  /** Model expiration */
  expires_at?: string;
  /** Model size (estimated) */
  size_virt?: string;
}

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  /** Model name */
  model: string;
  /** Maximum context length */
  maxContextLength: number;
  /** Supports streaming */
  supportsStreaming: boolean;
  /** Supports embeddings */
  supportsEmbeddings: boolean;
  /** Supports function calling */
  supportsFunctionCalling: boolean;
  /** Estimated memory usage in GB */
  estimatedMemoryGB: number;
  /** Model type */
  type: 'code' | 'chat' | 'embedding' | 'general';
}

/**
 * Available model with capabilities
 */
export interface AvailableModel extends ModelInfo {
  capabilities: ModelCapabilities;
}

/**
 * Health status
 */
export interface HealthStatus {
  /** Is Ollama available */
  available: boolean;
  /** Server version */
  version?: string;
  /** Uptime in seconds */
  uptime?: number;
  /** Number of loaded models */
  loadedModels?: number;
  /** Total memory used in bytes */
  memoryUsed?: number;
  /** Total memory available in bytes */
  memoryTotal?: number;
  /** Error message if unavailable */
  error?: string;
}

/**
 * Task type for model recommendation
 */
export type TaskType =
  | 'code-generation'
  | 'code-completion'
  | 'code-explanation'
  | 'code-review'
  | 'chat'
  | 'summarization'
  | 'embedding'
  | 'general';

/**
 * Model recommendation
 */
export interface ModelRecommendation {
  /** Recommended model */
  model: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasoning for recommendation */
  reasoning: string;
  /** Estimated tokens per second */
  estimatedTokensPerSecond?: number;
  /** Estimated memory usage */
  estimatedMemoryGB?: number;
}

/**
 * Health metrics
 */
export interface HealthMetrics {
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Average latency in milliseconds */
  averageLatency: number;
  /** Minimum latency in milliseconds */
  minLatency: number;
  /** Maximum latency in milliseconds */
  maxLatency: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Last check timestamp */
  lastCheck: Date;
  /** Last successful request timestamp */
  lastSuccess?: Date;
  /** Last failure timestamp */
  lastFailure?: Date;
}

/**
 * Streaming chunk
 */
export interface StreamChunk {
  /** Chunk content */
  content: string;
  /** Is done */
  done: boolean;
}

/**
 * Ollama error
 */
export class OllamaError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'OllamaError';
  }
}
