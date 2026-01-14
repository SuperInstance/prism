/**
 * Unit tests for ConfigurationService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigurationService } from '../../../src/config/ConfigurationService.js';

describe('ConfigurationService', () => {
  let service: ConfigurationService;

  beforeEach(() => {
    service = new ConfigurationService();
  });

  describe('load', () => {
    it('should load default configuration when no file exists', async () => {
      const config = await service.load();

      expect(config).toBeDefined();
      expect(config.cloudflare).toBeDefined();
      expect(config.ollama).toBeDefined();
      expect(config.indexing).toBeDefined();
      expect(config.optimization).toBeDefined();
    });

    it('should have valid default values', async () => {
      const config = await service.load();

      expect(config.cloudflare.accountId).toBe('');
      expect(config.ollama.enabled).toBe(false);
      expect(config.ollama.url).toBe('http://localhost:11434');
      expect(config.indexing.chunkSize).toBe(500);
      expect(config.optimization.tokenBudget).toBe(100000);
      expect(config.optimization.minRelevance).toBe(0.5);
      expect(config.mcp.port).toBe(3000);
    });

    it('should validate configuration structure', async () => {
      const config = await service.load();

      expect(config.indexing.chunking.strategy).toBeDefined();
      expect(config.indexing.embedding.provider).toBeDefined();
      expect(config.optimization.weights).toBeDefined();
      expect(config.cli.format).toBeDefined();
      expect(config.logging.level).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should accept valid configuration', () => {
      const result = service.validate({
        cloudflare: {
          accountId: 'test-account',
          apiKey: 'test-key',
        },
        ollama: {
          enabled: true,
          url: 'http://localhost:11434',
          model: 'test-model',
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
            model: 'test-model',
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
      });

      expect(result.valid).toBe(true);
    });

    it('should reject missing required sections', () => {
      const result = service.validate({
        cloudflare: {
          accountId: 'test',
          apiKey: 'test',
        },
      } as unknown);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should reject invalid scoring weights', () => {
      const result = service.validate({
        cloudflare: {
          accountId: 'test',
          apiKey: 'test',
        },
        ollama: {
          enabled: false,
          url: 'http://localhost:11434',
          model: 'test',
        },
        indexing: {
          include: [],
          exclude: [],
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
            model: 'test',
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
            semantic: 0.5,
            proximity: 0.5,
            symbol: 0.5,
            recency: 0.5,
            frequency: 0.5,
          },
        },
        mcp: {
          enabled: false,
          host: 'localhost',
          port: 3000,
          debug: false,
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
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path.includes('weights'))).toBe(true);
      }
    });
  });

  describe('get and set', () => {
    it('should throw error when config not loaded', () => {
      expect(() => service.get('cloudflare.accountId')).toThrow();
    });

    it('should get nested config values', async () => {
      await service.load();

      const accountId = service.get<string>('cloudflare.accountId');
      expect(accountId).toBeDefined();
    });

    it('should set nested config values', async () => {
      await service.load();

      service.set('ollama.enabled', true);
      const enabled = service.get<boolean>('ollama.enabled');
      expect(enabled).toBe(true);
    });
  });
});
