/**
 * Unit tests for OllamaClient
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaClient } from '../../../src/model-router/OllamaClient.js';
import type { AIRequest } from '../../../src/core/interfaces/index.js';

describe('OllamaClient', () => {
  let client: OllamaClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new OllamaClient({
      url: 'http://localhost:11434',
      timeout: 30000,
      defaultModel: 'deepseek-coder-v2',
    });

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe('initialization', () => {
    it('should use default URL if not provided', () => {
      const defaultClient = new OllamaClient();

      expect(defaultClient.getUrl()).toBe('http://localhost:11434');
    });

    it('should use custom URL if provided', () => {
      const customClient = new OllamaClient({ url: 'http://custom:11434' });

      expect(customClient.getUrl()).toBe('http://custom:11434');
    });

    it('should use default model if not provided', () => {
      const defaultClient = new OllamaClient();

      expect(defaultClient.getDefaultModel()).toBe('deepseek-coder-v2');
    });

    it('should use custom model if provided', () => {
      const customClient = new OllamaClient({ defaultModel: 'codellama' });

      expect(customClient.getDefaultModel()).toBe('codellama');
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is running', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });

      const available = await client.isAvailable();

      expect(available).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should return false when Ollama is not running', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });

    it('should return false when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
      });

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });
  });

  describe('getModels', () => {
    it('should return list of models', async () => {
      const mockModels = [
        { name: 'deepseek-coder-v2' },
        { name: 'codellama' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ models: mockModels }),
      });

      const models = await client.getModels();

      expect(models).toEqual(mockModels);
    });

    it('should return empty array when no models', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const models = await client.getModels();

      expect(models).toEqual([]);
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.getModels()).rejects.toThrow();
    });

    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(client.getModels()).rejects.toThrow();
    });
  });

  describe('hasModel', () => {
    it('should return true for existing model', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: 'deepseek-coder-v2:latest' },
            { name: 'codellama:latest' },
          ],
        }),
      });

      const hasModel = await client.hasModel('deepseek-coder-v2');

      expect(hasModel).toBe(true);
    });

    it('should return false for non-existing model', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'codellama:latest' }],
        }),
      });

      const hasModel = await client.hasModel('deepseek-coder-v2');

      expect(hasModel).toBe(false);
    });

    it('should return false on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const hasModel = await client.hasModel('deepseek-coder-v2');

      expect(hasModel).toBe(false);
    });
  });

  describe('generate', () => {
    it('should generate text successfully', async () => {
      const request: AIRequest = {
        prompt: 'test prompt',
        maxTokens: 100,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'generated text',
          prompt_eval_count: 10,
          eval_count: 20,
        }),
      });

      const result = await client.generate(request);

      expect(result.text).toBe('generated text');
      expect(result.tokensUsed).toBe(30);
      expect(result.cost).toBe(0);
      expect(result.model).toBe('ollama:deepseek-coder-v2');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should use custom model from request', async () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
        model: 'ollama:codellama',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'text',
          prompt_eval_count: 10,
          eval_count: 10,
        }),
      });

      await client.generate(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          body: expect.stringContaining('"model":"codellama"'),
        })
      );
    });

    it('should include temperature', async () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
        temperature: 0.5,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'text',
          prompt_eval_count: 10,
          eval_count: 10,
        }),
      });

      await client.generate(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          body: expect.stringContaining('"temperature":0.5'),
        })
      );
    });

    it('should include stop sequences', async () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
        stopSequences: ['\n', '###'],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'text',
          prompt_eval_count: 10,
          eval_count: 10,
        }),
      });

      await client.generate(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          body: expect.stringContaining('"stop":["\\n","###"]'),
        })
      );
    });

    it('should throw on non-ok response', async () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.generate(request)).rejects.toThrow();
    });

    it('should throw on API error', async () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          error: 'Model not found',
        }),
      });

      await expect(client.generate(request)).rejects.toThrow();
    });

    it('should throw on network error', async () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
      };

      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.generate(request)).rejects.toThrow();
    });

    it('should handle missing response', async () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await client.generate(request);

      expect(result.text).toBe('');
    });
  });

  describe('getVersion', () => {
    it('should return version string', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ version: '0.1.0' }),
      });

      const version = await client.getVersion();

      expect(version).toBe('0.1.0');
    });

    it('should return unknown on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const version = await client.getVersion();

      expect(version).toBe('unknown');
    });

    it('should return unknown when version missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const version = await client.getVersion();

      expect(version).toBe('unknown');
    });
  });
});
