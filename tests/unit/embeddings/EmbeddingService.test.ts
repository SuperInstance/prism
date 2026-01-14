/**
 * Unit tests for EmbeddingService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbeddingService } from '../../../src/embeddings/EmbeddingService.js';
import { ErrorCode } from '../../../src/core/types/index.js';
import type { PrismConfig } from '../../../src/config/types/index.js';

describe('EmbeddingService', () => {
  let config: PrismConfig;
  let service: EmbeddingService;

  beforeEach(() => {
    config = {
      cloudflare: {
        accountId: 'test-account',
        apiKey: 'test-key',
        apiEndpoint: 'https://api.cloudflare.com/client/v4',
      },
      ollama: {
        enabled: true,
        url: 'http://localhost:11434',
        model: 'nomic-embed-text',
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
      },
      indexing: {
        include: ['**/*.ts'],
        exclude: ['**/node_modules/**'],
        watch: false,
        chunkSize: 500,
        maxFileSize: 1024 * 1024,
        languages: [],
        chunking: {
          strategy: 'function',
          minSize: 100,
          maxSize: 1000,
          overlap: 50,
          preserveBoundaries: true,
        },
        embedding: {
          provider: 'cloudflare',
          model: '@cf/baai/bge-small-en-v1.5',
          batchSize: 32,
          dimensions: 384,
          cache: true,
        },
      },
      optimization: {
        tokenBudget: 100000,
        minRelevance: 0.5,
        maxChunks: 50,
        compressionLevel: 5,
        weights: {
          semantic: 0.40,
          proximity: 0.25,
          symbol: 0.20,
          recency: 0.10,
          frequency: 0.05,
        },
      },
      mcp: {
        enabled: false,
        host: 'localhost',
        port: 3000,
        debug: false,
        maxConnections: 10,
        timeout: 30000,
      },
      cli: {
        format: 'text',
        color: true,
        progress: true,
        confirm: true,
      },
      logging: {
        level: 'info',
        format: 'pretty',
      },
    };

    service = new EmbeddingService(config);
  });

  describe('embed', () => {
    it('should throw error for empty text', async () => {
      await expect(service.embed('')).rejects.toMatchObject({
        code: ErrorCode.EMBEDDING_FAILED,
      });
    });

    it('should generate embedding for single text', async () => {
      // Mock fetch to return valid response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            shape: [1, 384],
            data: [[0.1, 0.2, 0.3, /* ...384 dimensions */]],
          },
        }),
      });

      // Generate 384 dimensions for mock - flat array as expected by the code
      const mockEmbedding = Array(384).fill(0.1);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            shape: [1, 384],
            data: mockEmbedding, // Flat array, not nested
          },
        }),
      });

      const result = await service.embed('test code');

      expect(result).toHaveLength(384);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('embedBatch', () => {
    it('should return empty array for empty input', async () => {
      const result = await service.embedBatch([]);
      expect(result).toEqual([]);
    });

    it('should filter out empty texts', async () => {
      const mockEmbedding = Array(384).fill(0.1);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            shape: [1, 384],
            data: mockEmbedding.flat(),
          },
        }),
      });

      const result = await service.embedBatch(['valid text', '', '  ']);

      expect(result).toHaveLength(1);
    });

    it('should process in batches', async () => {
      const mockEmbedding = Array(384).fill(0.1);
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            result: {
              shape: [32, 384], // Batch size
              data: Array(32).fill(mockEmbedding).flat(),
            },
          }),
        });
      });

      // Create 65 texts (should require 2 batches with batch size 32)
      const texts = Array(65).fill('test');

      await service.embedBatch(texts);

      expect(callCount).toBe(3); // 3 batches: 32 + 32 + 1
    });
  });

  describe('getDimension', () => {
    it('should return configured dimension', () => {
      expect(service.getDimension()).toBe(384);
    });
  });

  describe('rate limiting', () => {
    it('should track neurons used', async () => {
      const mockEmbedding = Array(384).fill(0.1);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            shape: [1, 384],
            data: mockEmbedding.flat(),
          },
        }),
      });

      await service.embed('test');

      const status = service.getRateLimitStatus();
      expect(status.neuronsToday).toBe(384);
    });

    it('should reset rate limit tracking', () => {
      service.resetRateLimit();
      const status = service.getRateLimitStatus();
      expect(status.neuronsToday).toBe(0);
    });
  });

  describe('Cloudflare provider', () => {
    it('should call Cloudflare API with correct parameters', async () => {
      const mockEmbedding = Array(384).fill(0.1);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            shape: [1, 384],
            data: mockEmbedding.flat(),
          },
        }),
      });

      await service.embed('test');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('cloudflare'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('test-key'),
          }),
        })
      );
    });

    it('should handle Cloudflare API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
      });

      await expect(service.embed('test')).rejects.toMatchObject({
        code: ErrorCode.EMBEDDING_FAILED,
      });
    });
  });

  describe('Ollama fallback', () => {
    beforeEach(() => {
      // Configure to use Ollama
      config.indexing.embedding.provider = 'ollama';
      service = new EmbeddingService(config);
    });

    it('should use Ollama when configured', async () => {
      const mockEmbedding = Array(384).fill(0.1);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          embedding: mockEmbedding,
        }),
      });

      await service.embed('test');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('localhost:11434'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle Ollama timeout', async () => {
      global.fetch = vi.fn().mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AbortError')), 100)
        )
      );

      await expect(service.embed('test')).rejects.toMatchObject({
        code: ErrorCode.EMBEDDING_FAILED,
      });
    });
  });
});
