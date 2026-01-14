/**
 * Ollama Integration Tests
 *
 * Tests for Ollama client, model detector, and health monitor.
 *
 * Note: These tests require Ollama to be installed and running.
 * Tests will be skipped if Ollama is not available.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { OllamaClient } from '../../src/ollama/OllamaClient.js';
import { ModelDetector } from '../../src/ollama/ModelDetector.js';
import { OllamaHealthMonitor } from '../../src/ollama/HealthMonitor.js';

let ollama: OllamaClient;
let detector: ModelDetector;
let monitor: OllamaHealthMonitor;
let ollamaAvailable = false;

describe('Ollama Integration', () => {
  beforeAll(async () => {
    ollama = new OllamaClient();
    detector = new ModelDetector(ollama);
    monitor = new OllamaHealthMonitor(ollama);

    // Check if Ollama is available
    try {
      ollamaAvailable = await ollama.isAvailable();
      if (!ollamaAvailable) {
        console.warn('⚠️  Ollama is not available. Skipping integration tests.');
        console.warn('   To run these tests, install Ollama: https://ollama.com');
        console.warn('   Then run: npm run setup:ollama');
      }
    } catch (error) {
      console.warn('⚠️  Failed to check Ollama availability:', error);
      ollamaAvailable = false;
    }
  });

  describe('OllamaClient', () => {
    it('should check if Ollama is available', async () => {
      const isAvailable = await ollama.isAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });

    it.skipIf(!ollamaAvailable)('should get Ollama version', async () => {
      const version = await ollama.getVersion();
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
      console.log('  Ollama version:', version);
    });

    it.skipIf(!ollamaAvailable)('should list available models', async () => {
      const models = await ollama.listModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      console.log('  Available models:', models.map(m => m.name).join(', '));
    });

    it.skipIf(!ollamaAvailable)('should generate text completion', async () => {
      // Try with common models
      const models = await ollama.listModels();
      const codeModel = models.find(m =>
        m.name.toLowerCase().includes('coder') ||
        m.name.toLowerCase().includes('llama') ||
        m.name.toLowerCase().includes('qwen')
      ) || models[0];

      expect(codeModel).toBeDefined();

      const response = await ollama.generate({
        model: codeModel.name,
        prompt: 'Write a hello world function in JavaScript:',
        options: {
          num_predict: 50,
        },
      });

      expect(response).toBeDefined();
      expect(response.response).toBeTruthy();
      expect(response.response.length).toBeGreaterThan(0);
      console.log('  Generated text preview:', response.response.substring(0, 100) + '...');
    }, 15000);

    it.skipIf(!ollamaAvailable)('should generate text with streaming', async () => {
      const models = await ollama.listModels();
      const model = models[0];

      const chunks: string[] = [];
      for await (const chunk of ollama.generateStream({
        model: model.name,
        prompt: 'Count from 1 to 5:',
        options: {
          num_predict: 30,
        },
      })) {
        chunks.push(chunk);
      }

      const fullResponse = chunks.join('');
      expect(fullResponse.length).toBeGreaterThan(0);
      expect(chunks.length).toBeGreaterThan(0);
      console.log('  Stream chunks received:', chunks.length);
    }, 15000);

    it.skipIf(!ollamaAvailable)('should handle chat completion', async () => {
      const models = await ollama.listModels();
      const chatModel = models.find(m =>
        m.name.toLowerCase().includes('llama') ||
        m.name.toLowerCase().includes('mistral') ||
        m.name.toLowerCase().includes('gemma')
      ) || models[0];

      const response = await ollama.chat({
        model: chatModel.name,
        messages: [
          { role: 'user', content: 'What is 2 + 2?' },
        ],
        options: {
          num_predict: 20,
        },
      });

      expect(response).toBeDefined();
      expect(response.message).toBeDefined();
      expect(response.message.content).toBeTruthy();
      console.log('  Chat response:', response.message.content.substring(0, 100));
    }, 15000);

    it.skipIf(!ollamaAvailable)('should generate embeddings', async () => {
      // Check if embedding model is available
      const models = await ollama.listModels();
      const embedModel = models.find(m =>
        m.name.toLowerCase().includes('embed')
      );

      if (!embedModel) {
        console.warn('  No embedding model found. Skipping test.');
        return;
      }

      const embeddings = await ollama.embed('Hello, world!');
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(1);
      expect(Array.isArray(embeddings[0])).toBe(true);
      expect(embeddings[0].length).toBeGreaterThan(0);
      console.log('  Embedding dimensions:', embeddings[0].length);
    }, 15000);

    it.skipIf(!ollamaAvailable)('should generate multiple embeddings', async () => {
      const models = await ollama.listModels();
      const embedModel = models.find(m =>
        m.name.toLowerCase().includes('embed')
      );

      if (!embedModel) {
        return;
      }

      const texts = ['Hello', 'World', 'Test'];
      const embeddings = await ollama.embed(texts);

      expect(embeddings.length).toBe(3);
      expect(embeddings[0].length).toBe(embeddings[1].length);
      expect(embeddings[1].length).toBe(embeddings[2].length);
    }, 15000);
  });

  describe('ModelDetector', () => {
    it.skipIf(!ollamaAvailable)('should detect available models', async () => {
      const models = await detector.detectAvailableModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // Check that each model has capabilities
      models.forEach(model => {
        expect(model.capabilities).toBeDefined();
        expect(model.capabilities.type).toBeDefined();
        expect(model.capabilities.maxContextLength).toBeGreaterThan(0);
      });

      console.log('  Detected models:', models.length);
      models.forEach(m => {
        console.log(`    - ${m.name} (${m.capabilities.type}, ${m.capabilities.maxContextLength} ctx)`);
      });
    });

    it('should detect capabilities for known models', () => {
      const capabilities = detector.detectCapabilities('deepseek-coder-v2');
      expect(capabilities).toBeDefined();
      expect(capabilities.type).toBe('code');
      expect(capabilities.maxContextLength).toBe(16384);
      expect(capabilities.supportsStreaming).toBe(true);
    });

    it('should detect capabilities for embedding models', () => {
      const capabilities = detector.detectCapabilities('nomic-embed-text');
      expect(capabilities).toBeDefined();
      expect(capabilities.type).toBe('embedding');
      expect(capabilities.supportsEmbeddings).toBe(true);
    });

    it('should infer capabilities for unknown models', () => {
      const capabilities = detector.detectCapabilities('unknown-coder-model');
      expect(capabilities).toBeDefined();
      expect(capabilities.type).toBe('code'); // Inferred from 'coder' in name
    });

    it.skipIf(!ollamaAvailable)('should recommend model for code generation', async () => {
      const recommendation = await detector.recommendModelForTask('code-generation');
      expect(recommendation).toBeDefined();
      expect(recommendation.model).toBeTruthy();
      expect(recommendation.confidence).toBeGreaterThan(0);
      expect(recommendation.reasoning).toBeTruthy();
      console.log('  Recommended model:', recommendation.model);
      console.log('  Reasoning:', recommendation.reasoning);
    });

    it.skipIf(!ollamaAvailable)('should recommend model for embeddings', async () => {
      const recommendation = await detector.recommendModelForTask('embedding');
      expect(recommendation).toBeDefined();
      expect(recommendation.model).toBeTruthy();
      console.log('  Recommended embedding model:', recommendation.model);
    });

    it.skipIf(!ollamaAvailable)('should check if model is supported', async () => {
      const models = await ollama.listModels();
      if (models.length > 0) {
        const isSupported = await detector.isModelSupported(models[0].name);
        expect(isSupported).toBe(true);
      }
    });

    it.skipIf(!ollamaAvailable)('should get model version', async () => {
      const models = await ollama.listModels();
      if (models.length > 0) {
        const version = await detector.getModelVersion(models[0].name);
        expect(typeof version).toBe('string');
        console.log('  Model version:', version);
      }
    });
  });

  describe('OllamaHealthMonitor', () => {
    it.skipIf(!ollamaAvailable)('should perform health check', async () => {
      const status = await monitor.check();
      expect(status).toBeDefined();
      expect(status.available).toBe(true);
      expect(status.version).toBeTruthy();
      console.log('  Ollama version:', status.version);
      console.log('  Loaded models:', status.loadedModels);
    });

    it.skipIf(!ollamaAvailable)('should record requests', () => {
      monitor.recordRequest(true, 100);
      monitor.recordRequest(true, 150);
      monitor.recordRequest(false, 200);

      const count = monitor.getRequestCount();
      expect(count).toBe(3);

      const avgLatency = monitor.getAverageLatency();
      expect(avgLatency).toBe(125); // (100 + 150) / 2

      const errorRate = monitor.getErrorRate();
      expect(errorRate).toBeCloseTo(0.333, 2); // 1/3
    });

    it.skipIf(!ollamaAvailable)('should get metrics', () => {
      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      console.log('  Total requests:', metrics.totalRequests);
      console.log('  Average latency:', metrics.averageLatency, 'ms');
      console.log('  Error rate:', (metrics.errorRate * 100).toFixed(1), '%');
    });

    it.skipIf(!ollamaAvailable)('should check if healthy', () => {
      monitor.resetMetrics();
      monitor.recordRequest(true, 100);
      monitor.recordRequest(true, 150);

      const isHealthy = monitor.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it.skipIf(!ollamaAvailable)('should get detailed status', async () => {
      const status = await monitor.getDetailedStatus();
      expect(status).toBeDefined();
      expect(status.available).toBe(true);
      expect(status.metrics).toBeDefined();
      expect(status.healthy).toBeDefined();
      console.log('  Healthy:', status.healthy);
    });

    it.skipIf(!ollamaAvailable)('should get request history', () => {
      const history = monitor.getRequestHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });

    it.skipIf(!ollamaAvailable)('should get recent requests', () => {
      const recent = monitor.getRecentRequests(2);
      expect(Array.isArray(recent)).toBe(true);
      expect(recent.length).toBeLessThanOrEqual(2);
    });

    it.skipIf(!ollamaAvailable)('should reset metrics', () => {
      monitor.resetMetrics();
      const metrics = monitor.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.averageLatency).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      // Use invalid port to force error
      const badClient = new OllamaClient({ port: 9999 });
      const isAvailable = await badClient.isAvailable();
      expect(isAvailable).toBe(false);
    });

    it.skipIf(!ollamaAvailable)('should handle invalid model names', async () => {
      await expect(
        ollama.generate({
          model: 'non-existent-model-xyz',
          prompt: 'test',
        })
      ).rejects.toThrow();
    }, 10000);
  });
});
