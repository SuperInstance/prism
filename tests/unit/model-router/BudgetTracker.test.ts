/**
 * Unit tests for BudgetTracker
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BudgetTracker, DAILY_NEURON_LIMIT } from '../../../src/model-router/BudgetTracker.js';

describe('BudgetTracker', () => {
  let tracker: BudgetTracker;

  beforeEach(() => {
    // Clear any persisted state from previous tests
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    tracker = new BudgetTracker(false); // Disable persistence for tests
  });

  describe('initialization', () => {
    it('should initialize with zero usage', () => {
      const stats = tracker.getStats();

      expect(stats.used).toBe(0);
      expect(stats.remaining).toBe(DAILY_NEURON_LIMIT);
      expect(stats.percentage).toBe(0);
    });

    it('should set reset time to next midnight', () => {
      const stats = tracker.getStats();
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      const diff = Math.abs(stats.resetsAt.getTime() - tomorrow.getTime());

      // Should be within 1 second
      expect(diff).toBeLessThan(1000);
    });
  });

  describe('canAfford', () => {
    it('should return true for small requests initially', () => {
      const canAfford = tracker.canAfford('@cf/meta/llama-3.1-8b-instruct', 1000);

      expect(canAfford).toBe(true);
    });

    it('should return false for requests exceeding limit', () => {
      // Need to calculate actual neuron cost
      // @cf/meta/llama-3.1-8b-instruct uses 8239 neurons per 1M tokens
      // So 1M tokens would cost 8239 neurons
      const canAfford = tracker.canAfford(
        '@cf/meta/llama-3.1-8b-instruct',
        DAILY_NEURON_LIMIT * 1_000_000 / 8239 + 1
      );

      expect(canAfford).toBe(false);
    });

    it('should return false when budget is exhausted', () => {
      // Track usage that exhausts the budget
      // Track enough neurons to use up the limit
      const costPerMillionTokens = 8239;
      const tokensToUse = (DAILY_NEURON_LIMIT / costPerMillionTokens) * 1_000_000;

      tracker.trackUsage('@cf/meta/llama-3.1-8b-instruct', tokensToUse);

      const canAfford = tracker.canAfford('@cf/meta/llama-3.1-8b-instruct', 100);

      expect(canAfford).toBe(false);
    });

    it('should handle unknown models', () => {
      const canAfford = tracker.canAfford('unknown:model', 1000);

      // Should use default model cost (8239 neurons per 1M tokens)
      expect(canAfford).toBe(true);
    });
  });

  describe('trackUsage', () => {
    it('should track usage correctly', async () => {
      await tracker.trackUsage('@cf/meta/llama-3.1-8b-instruct', 1000);

      const stats = tracker.getStats();

      expect(stats.used).toBeGreaterThan(0);
      expect(stats.remaining).toBeLessThan(DAILY_NEURON_LIMIT);
    });

    it('should accumulate usage', async () => {
      await tracker.trackUsage('@cf/meta/llama-3.1-8b-instruct', 1_000_000); // 1M tokens
      await tracker.trackUsage('@cf/meta/llama-3.1-8b-instruct', 1_000_000); // 1M tokens

      const stats = tracker.getStats();

      // Each 1M tokens costs 8239 neurons, so 2M tokens = 8238 neurons
      expect(stats.used).toBeGreaterThan(8000);
    });

    it('should update percentage correctly', async () => {
      // Use a fresh tracker for this test
      const freshTracker = new BudgetTracker(false);

      // Use 50% of the neuron limit
      // @cf/meta/llama-3.1-8b-instruct uses 8239 neurons per 1M tokens
      // To use 50% of 10000 neurons = 5000 neurons
      // 5000 / 8239 * 1M = ~607k tokens
      const tokens = (DAILY_NEURON_LIMIT * 0.5 / 8239) * 1_000_000;

      await freshTracker.trackUsage('@cf/meta/llama-3.1-8b-instruct', tokens);

      const stats = freshTracker.getStats();

      expect(stats.percentage).toBeCloseTo(50, 0);
    });

    it('should alert when approaching limit', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Use 95% of the neuron limit
      // 9500 / 8239 * 1M = ~2.3M tokens
      const tokens = (DAILY_NEURON_LIMIT * 0.95 / 8239) * 1_000_000;

      await tracker.trackUsage('@cf/meta/llama-3.1-8b-instruct', tokens);

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('Approaching Cloudflare neuron limit');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const stats = tracker.getStats();

      expect(stats).toHaveProperty('used');
      expect(stats).toHaveProperty('remaining');
      expect(stats).toHaveProperty('percentage');
      expect(stats).toHaveProperty('resetsAt');
    });

    it('should calculate remaining correctly', async () => {
      await tracker.trackUsage('@cf/meta/llama-3.1-8b-instruct', 1_000_000);

      const stats = tracker.getStats();

      expect(stats.remaining).toBe(DAILY_NEURON_LIMIT - stats.used);
    });

    it('should calculate percentage correctly', async () => {
      // Use a fresh tracker for this test
      const freshTracker = new BudgetTracker(false);

      // Use 25% of the neuron limit
      // @cf/meta/llama-3.1-8b-instruct uses 8239 neurons per 1M tokens
      // To use 25% of 10000 neurons = 2500 neurons
      // 2500 / 8239 * 1M = ~303k tokens
      const tokens = (DAILY_NEURON_LIMIT * 0.25 / 8239) * 1_000_000;

      await freshTracker.trackUsage('@cf/meta/llama-3.1-8b-instruct', tokens);

      const stats = freshTracker.getStats();

      expect(stats.percentage).toBeCloseTo(25, 0);
    });
  });

  describe('getCost', () => {
    it('should calculate cost for known models', () => {
      const cost1 = tracker.getCost('@cf/meta/llama-3.1-8b-instruct', 1_000_000);
      const cost2 = tracker.getCost('@cf/meta/llama-3.2-1b-instruct', 1_000_000);

      expect(cost1).toBeGreaterThan(cost2);
    });

    it('should return cost for unknown models', () => {
      const cost = tracker.getCost('unknown:model', 1000);

      expect(cost).toBeGreaterThan(0);
    });

    it('should scale with token count', () => {
      const cost1 = tracker.getCost('@cf/meta/llama-3.1-8b-instruct', 1000);
      const cost2 = tracker.getCost('@cf/meta/llama-3.1-8b-instruct', 10000);

      expect(cost2).toBeCloseTo(cost1 * 10, 1);
    });
  });

  describe('reset', () => {
    it('should reset usage to zero', async () => {
      await tracker.trackUsage('@cf/meta/llama-3.1-8b-instruct', 1_000_000);

      tracker.reset();

      const stats = tracker.getStats();

      expect(stats.used).toBe(0);
      expect(stats.remaining).toBe(DAILY_NEURON_LIMIT);
    });

    it('should update reset time', async () => {
      const oldStats = tracker.getStats();

      await new Promise((resolve) => setTimeout(resolve, 10));

      tracker.reset();

      const newStats = tracker.getStats();

      // Reset time should be at least the same (might be exactly same if called within same second)
      expect(newStats.resetsAt.getTime()).toBeGreaterThanOrEqual(oldStats.resetsAt.getTime());
    });
  });

  describe('auto reset', () => {
    it('should auto-reset when time passes', async () => {
      // Clear localStorage first
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }

      // Create tracker with a mocked getNextMidnight that returns a past time
      const pastMidnight = Date.now() - 1000; // 1 second ago
      const freshTracker = new BudgetTracker(false);

      // Override getNextMidnight to return past time and set reset time to past
      (freshTracker as any).state.dailyResetsAt = pastMidnight;

      await freshTracker.trackUsage('@cf/meta/llama-3.1-8b-instruct', 1_000_000);

      const stats = freshTracker.getStats();

      // Should have reset to 0 because checkReset() is called in getStats()
      expect(stats.used).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero usage', () => {
      const canAfford = tracker.canAfford('@cf/meta/llama-3.1-8b-instruct', 0);

      expect(canAfford).toBe(true);
    });

    it('should handle zero tokens', async () => {
      await tracker.trackUsage('@cf/meta/llama-3.1-8b-instruct', 0);

      const stats = tracker.getStats();

      expect(stats.used).toBe(0);
    });

    it('should handle very large token counts', () => {
      const canAfford = tracker.canAfford('@cf/meta/llama-3.1-8b-instruct', Number.MAX_SAFE_INTEGER);

      expect(canAfford).toBe(false);
    });
  });
});
