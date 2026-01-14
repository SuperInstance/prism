/**
 * Model Detector
 *
 * Detects available Ollama models and their capabilities.
 */

import { OllamaClient } from './OllamaClient.js';
import type {
  ModelInfo,
  ModelCapabilities,
  TaskType,
  ModelRecommendation,
} from './types.js';

/**
 * Available model with capabilities
 */
export interface AvailableModel extends ModelInfo {
  capabilities: ModelCapabilities;
}

/**
 * Model registry with known capabilities
 */
const MODEL_REGISTRY: Record<string, Partial<ModelCapabilities>> = {
  'deepseek-coder-v2': {
    type: 'code',
    maxContextLength: 16384,
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 16,
  },
  'codellama': {
    type: 'code',
    maxContextLength: 16384,
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 8,
  },
  'llama2': {
    type: 'chat',
    maxContextLength: 4096,
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 8,
  },
  'llama3': {
    type: 'chat',
    maxContextLength: 8192,
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 8,
  },
  'llama3.1': {
    type: 'chat',
    maxContextLength: 128000,
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 8,
  },
  'mistral': {
    type: 'general',
    maxContextLength: 8192,
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 8,
  },
  'mixtral': {
    type: 'general',
    maxContextLength: 32768,
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 48,
  },
  'nomic-embed-text': {
    type: 'embedding',
    maxContextLength: 8192,
    supportsStreaming: false,
    supportsEmbeddings: true,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 1,
  },
  'mxbai-embed-large': {
    type: 'embedding',
    maxContextLength: 512,
    supportsStreaming: false,
    supportsEmbeddings: true,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 1,
  },
  'gemma': {
    type: 'general',
    maxContextLength: 8192,
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 5,
  },
  'gemma2': {
    type: 'general',
    maxContextLength: 8192,
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 9,
  },
  'phi3': {
    type: 'general',
    maxContextLength: 12800,
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 4,
  },
  'qwen2': {
    type: 'code',
    maxContextLength: 32768,
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 8,
  },
  'qwen2.5': {
    type: 'code',
    maxContextLength: 32768,
    supportsStreaming: true,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
    estimatedMemoryGB: 8,
  },
};

/**
 * Default capabilities for unknown models
 */
const DEFAULT_CAPABILITIES: ModelCapabilities = {
  model: 'unknown',
  maxContextLength: 4096,
  supportsStreaming: true,
  supportsEmbeddings: false,
  supportsFunctionCalling: false,
  estimatedMemoryGB: 8,
  type: 'general',
};

/**
 * Model recommendations by task type
 */
const TASK_MODEL_PREFERENCES: Record<TaskType, string[]> = {
  'code-generation': ['deepseek-coder-v2', 'qwen2.5', 'codellama', 'mistral'],
  'code-completion': ['deepseek-coder-v2', 'qwen2.5', 'codellama'],
  'code-explanation': ['llama3.1', 'mixtral', 'mistral'],
  'code-review': ['llama3.1', 'mixtral', 'deepseek-coder-v2'],
  'chat': ['llama3.1', 'mixtral', 'mistral', 'llama3'],
  'summarization': ['llama3.1', 'mixtral', 'gemma2'],
  'embedding': ['nomic-embed-text', 'mxbai-embed-large'],
  'general': ['llama3.1', 'mixtral', 'mistral', 'gemma2'],
};

/**
 * Model detector class
 */
export class ModelDetector {
  private client: OllamaClient;
  private cachedModels: AvailableModel[] | undefined;

  constructor(client?: OllamaClient) {
    this.client = client || new OllamaClient();
  }

  /**
   * Detect all available models
   */
  async detectAvailableModels(): Promise<AvailableModel[]> {
    if (this.cachedModels) {
      return this.cachedModels;
    }

    const models = await this.client.listModels();
    this.cachedModels = models.map(model => ({
      ...model,
      capabilities: this.detectCapabilities(model.name),
    }));

    return this.cachedModels ?? [];
  }

  /**
   * Detect capabilities for a specific model
   */
  detectCapabilities(modelName: string): ModelCapabilities {
    // Extract base model name (remove tags like ":latest", ":7b", etc)
    const baseName = modelName.split(':')[0]?.toLowerCase() || modelName.toLowerCase();
    const registryInfo = MODEL_REGISTRY[baseName];

    if (registryInfo) {
      return {
        model: modelName,
        maxContextLength: registryInfo.maxContextLength ?? DEFAULT_CAPABILITIES.maxContextLength,
        supportsStreaming: registryInfo.supportsStreaming ?? DEFAULT_CAPABILITIES.supportsStreaming,
        supportsEmbeddings: registryInfo.supportsEmbeddings ?? DEFAULT_CAPABILITIES.supportsEmbeddings,
        supportsFunctionCalling: registryInfo.supportsFunctionCalling ?? DEFAULT_CAPABILITIES.supportsFunctionCalling,
        estimatedMemoryGB: registryInfo.estimatedMemoryGB ?? DEFAULT_CAPABILITIES.estimatedMemoryGB,
        type: registryInfo.type ?? DEFAULT_CAPABILITIES.type,
      };
    }

    // Try to infer capabilities from model name
    const inferred = this.inferCapabilities(baseName);
    return {
      ...DEFAULT_CAPABILITIES,
      ...inferred,
      model: modelName,
    };
  }

  /**
   * Infer capabilities from model name patterns
   */
  private inferCapabilities(modelName: string): Partial<ModelCapabilities> {
    const name = modelName.toLowerCase();

    // Embedding models
    if (name.includes('embed')) {
      return {
        type: 'embedding',
        supportsEmbeddings: true,
        supportsStreaming: false,
        estimatedMemoryGB: 1,
      };
    }

    // Code models
    if (name.includes('coder') || name.includes('code') || name.includes('qwen')) {
      return {
        type: 'code',
        maxContextLength: 16384,
        estimatedMemoryGB: 8,
      };
    }

    // Chat models
    if (name.includes('chat') || name.includes('instruct')) {
      return {
        type: 'chat',
        maxContextLength: 8192,
        estimatedMemoryGB: 8,
      };
    }

    // Large models
    if (name.includes('mixtral') || name.includes('70b') || name.includes('8x7b')) {
      return {
        type: 'general',
        maxContextLength: 32768,
        estimatedMemoryGB: 48,
      };
    }

    // Small models
    if (name.includes('phi') || name.includes('tiny') || name.includes('small')) {
      return {
        type: 'general',
        maxContextLength: 8192,
        estimatedMemoryGB: 4,
      };
    }

    return {};
  }

  /**
   * Recommend a model for a specific task
   */
  async recommendModelForTask(task: TaskType): Promise<ModelRecommendation> {
    const availableModels = await this.detectAvailableModels();
    const preferences = TASK_MODEL_PREFERENCES[task] || TASK_MODEL_PREFERENCES['general'];

    // Find the best available model
    for (const preferredModel of preferences) {
      const available = availableModels.find(m =>
        m.name.toLowerCase().includes(preferredModel.toLowerCase())
      );

      if (available) {
        const capabilities = available.capabilities;
        return {
          model: available.name,
          confidence: 0.9,
          reasoning: `Recommended ${available.name} for ${task} based on model capabilities`,
          estimatedTokensPerSecond: this.estimateTokensPerSecond(capabilities),
          estimatedMemoryGB: capabilities.estimatedMemoryGB,
        };
      }
    }

    // Fallback to any available model that supports the task type
    const fallbackModel = availableModels.find(m => {
      if (task === 'embedding') {
        return m.capabilities.supportsEmbeddings;
      }
      return m.capabilities.type === 'code' || m.capabilities.type === 'general';
    });

    if (fallbackModel) {
      return {
        model: fallbackModel.name,
        confidence: 0.5,
        reasoning: `Using ${fallbackModel.name} as fallback for ${task}`,
        estimatedTokensPerSecond: this.estimateTokensPerSecond(fallbackModel.capabilities),
        estimatedMemoryGB: fallbackModel.capabilities.estimatedMemoryGB,
      };
    }

    // No models available
    throw new Error('No suitable models found for task: ' + task);
  }

  /**
   * Estimate tokens per second based on model size
   */
  private estimateTokensPerSecond(capabilities: ModelCapabilities): number {
    // Rough estimates based on model memory usage
    if (capabilities.estimatedMemoryGB <= 4) {
      return 50; // Small models are faster
    } else if (capabilities.estimatedMemoryGB <= 16) {
      return 30; // Medium models
    } else {
      return 15; // Large models are slower
    }
  }

  /**
   * Check if a model is supported
   */
  async isModelSupported(modelName: string): Promise<boolean> {
    try {
      const models = await this.detectAvailableModels();
      return models.some(m => m.name === modelName);
    } catch {
      return false;
    }
  }

  /**
   * Get model version information
   */
  async getModelVersion(modelName: string): Promise<string> {
    try {
      const models = await this.detectAvailableModels();
      const model = models.find(m => m.name === modelName);

      if (model) {
        // Extract version from tag (e.g., "model:latest" -> "latest")
        const parts = model.name.split(':');
        return parts[1] || 'unknown';
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Clear cached models
   */
  clearCache(): void {
    this.cachedModels = undefined;
  }

  /**
   * Get cached models (if available)
   */
  getCachedModels(): AvailableModel[] | undefined {
    return this.cachedModels;
  }
}
