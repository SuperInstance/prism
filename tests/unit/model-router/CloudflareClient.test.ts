/**
 * Unit tests for CloudflareClient
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudflareClient } from '../../../src/model-router/CloudflareClient.js';
import type { AIRequest } from '../../../src/core/interfaces/index.js';

describe('CloudflareClient', () => {
  let client: CloudflareClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    client = new CloudflareClient({
      accountId: 'test-account',
      apiToken: 'test-token',
      timeout: 30000,
    });
  });

  describe('initialization', () => {
    it('should store account ID', () => {
      expect(client.getAccountId()).toBe('test-account');
    });

    it('should create without budget tracker by default', () => {
      expect(client.getBudgetTracker()).toBeUndefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is accessible', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ([]),
      });

      const available = await client.isAvailable();

      expect(available).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/test-account/ai/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should return false when API is not accessible', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

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

  describe('canAfford', () => {
    it('should return true when no budget tracker', () => {
      const canAfford = client.canAfford('@cf/meta/llama-3.1-8b-instruct', 1000000);

      expect(canAfford).toBe(true);
    });

    it('should check budget tracker when available', () => {
      const mockTracker = {
        canAfford: vi.fn().mockReturnValue(false),
      };

      const clientWithTracker = new CloudflareClient({
        accountId: 'test-account',
        apiToken: 'test-token',
        budgetTracker: mockTracker as any,
      });

      const canAfford = clientWithTracker.canAfford('@cf/meta/llama-3.1-8b-instruct', 1000);

      expect(mockTracker.canAfford).toHaveBeenCalledWith('@cf/meta/llama-3.1-8b-instruct', 1000);
      expect(canAfford).toBe(false);
    });
  });

  describe('getBudgetStats', () => {
    it('should return null when no budget tracker', () => {
      const stats = client.getBudgetStats();

      expect(stats).toBeNull();
    });

    it('should return budget tracker stats when available', () => {
      const mockStats = {
        used: 1000,
        remaining: 9000,
        percentage: 10,
        resetsAt: new Date(),
      };

      const mockTracker = {
        getStats: vi.fn().mockReturnValue(mockStats),
      };

      const clientWithTracker = new CloudflareClient({
        accountId: 'test-account',
        apiToken: 'test-token',
        budgetTracker: mockTracker as any,
      });

      const stats = clientWithTracker.getBudgetStats();

      expect(mockTracker.getStats).toHaveBeenCalled();
      expect(stats).toEqual(mockStats);
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
          result: {
            response: 'generated text',
          },
        }),
      });

      const result = await client.generate(request);

      expect(result.text).toBe('generated text');
      expect(result.cost).toBe(0);
      expect(result.model).toBe('cloudflare:@cf/meta/llama-3.1-8b-instruct');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should use custom model from request', async () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
        model: 'cloudflare:@cf/mistral/mistral-7b-instruct-v0.2',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            response: 'text',
          },
        }),
      });

      await client.generate(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/test-account/ai/run/@cf/mistral/mistral-7b-instruct-v0.2',
        expect.any(Object)
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
          result: {
            response: 'text',
          },
        }),
      });

      await client.generate(request);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.5);
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
          result: {
            response: 'text',
          },
        }),
      });

      await client.generate(request);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.stop).toEqual(['\n', '###']);
    });

    it('should use text field when response not available', async () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            text: 'generated text',
          },
        }),
      });

      const result = await client.generate(request);

      expect(result.text).toBe('generated text');
    });

    it('should throw on insufficient budget', async () => {
      const mockTracker = {
        canAfford: vi.fn().mockReturnValue(false),
      };

      const clientWithTracker = new CloudflareClient({
        accountId: 'test-account',
        apiToken: 'test-token',
        budgetTracker: mockTracker as any,
      });

      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
      };

      await expect(clientWithTracker.generate(request)).rejects.toThrow('Insufficient Cloudflare neuron budget');
    });

    it('should throw on non-ok response', async () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
      };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(client.generate(request)).rejects.toThrow();
    });

    it('should throw on API errors', async () => {
      const request: AIRequest = {
        prompt: 'test',
        maxTokens: 100,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          errors: [
            { message: 'Invalid request' },
          ],
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

    it('should handle missing result', async () => {
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

    it('should track usage when budget tracker exists', async () => {
      const mockTracker = {
        canAfford: vi.fn().mockReturnValue(true),
        trackUsage: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockReturnValue({
          used: 0,
          remaining: 10000,
          percentage: 0,
          resetsAt: new Date(),
        }),
      };

      const clientWithTracker = new CloudflareClient({
        accountId: 'test-account',
        apiToken: 'test-token',
        budgetTracker: mockTracker as any,
      });

      const request: AIRequest = {
        prompt: 'test prompt with more text',
        maxTokens: 100,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            response: 'text',
          },
        }),
      });

      await clientWithTracker.generate(request);

      expect(mockTracker.trackUsage).toHaveBeenCalledWith(
        '@cf/meta/llama-3.1-8b-instruct',
        expect.any(Number)
      );
    });
  });

  describe('getModels', () => {
    it('should return list of models', async () => {
      const mockModels = [
        { name: '@cf/meta/llama-3.1-8b-instruct', description: 'Llama 3.1 8B' },
        { name: '@cf/mistral/mistral-7b-instruct-v0.2', description: 'Mistral 7B' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ result: mockModels }),
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
});
