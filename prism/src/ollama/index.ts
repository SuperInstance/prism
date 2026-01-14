/**
 * Ollama Module
 *
 * Integration with Ollama for local LLM inference.
 */

export { OllamaClient } from './OllamaClient.js';
export { ModelDetector } from './ModelDetector.js';
export { OllamaHealthMonitor } from './HealthMonitor.js';

export type {
  // Config
  OllamaConfig,
  // Requests
  GenerateRequest,
  ChatRequest,
  EmbeddingRequest,
  // Responses
  GenerateResponse,
  ChatResponse,
  EmbeddingResponse,
  // Models
  ModelInfo,
  ModelCapabilities,
  AvailableModel,
  // Tasks
  TaskType,
  ModelRecommendation,
  // Health
  HealthStatus,
  HealthMetrics,
  // Messages
  ChatMessage,
  // Streaming
  StreamChunk,
  // Errors
  OllamaError,
} from './types.js';

export { DEFAULT_OLLAMA_CONFIG } from './types.js';
