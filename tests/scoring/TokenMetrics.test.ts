/**
 * Token Metrics Tests
 *
 * Test suite for the token metrics tracking system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { TokenMetrics, type TokenSavings } from '../../prism/src/metrics/index.js';

describe('TokenMetrics', () => {
  let metrics: TokenMetrics;

  beforeEach(() => {
    metrics = new TokenMetrics({
      enablePersistence: false, // Disable file I/O for tests
      autoSave: false,
    });
  });

  afterEach(() => {
    metrics.cleanup();
  });

  describe('Basic Tracking', () => {
    it('should track a single query', () => {
      metrics.trackQuery(1000, 100, 'test');

      const report = metrics.getMetrics();

      expect(report.totalQueries).toBe(1);
      expect(report.totalOriginalTokens).toBe(1000);
      expect(report.totalOptimizedTokens).toBe(100);
      expect(report.totalSavedTokens).toBe(900);
    });

    it('should track multiple queries', () => {
      metrics.trackQuery(1000, 100, 'test');
      metrics.trackQuery(2000, 200, 'test');
      metrics.trackQuery(500, 50, 'search');

      const report = metrics.getMetrics();

      expect(report.totalQueries).toBe(3);
      expect(report.totalOriginalTokens).toBe(3500);
      expect(report.totalOptimizedTokens).toBe(350);
      expect(report.totalSavedTokens).toBe(3150);
    });

    it('should calculate compression ratio correctly', () => {
      metrics.trackQuery(1000, 100, 'test');

      const report = metrics.getMetrics();

      expect(report.averageCompressionRatio).toBe(10);
    });
  });

  describe('Query Type Metrics', () => {
    it('should track metrics per query type', () => {
      metrics.trackQuery(1000, 100, 'chat');
      metrics.trackQuery(800, 80, 'chat');
      metrics.trackQuery(500, 50, 'search');

      const chatMetrics = metrics.getQueryMetrics('chat');
      const searchMetrics = metrics.getQueryMetrics('search');

      expect(chatMetrics).toBeDefined();
      expect(chatMetrics?.count).toBe(2);
      expect(chatMetrics?.totalOriginalTokens).toBe(1800);
      expect(chatMetrics?.averageCompressionRatio).toBe(10);

      expect(searchMetrics).toBeDefined();
      expect(searchMetrics?.count).toBe(1);
      expect(searchMetrics?.totalOriginalTokens).toBe(500);
    });

    it('should track best and worst queries per type', () => {
      metrics.trackQuery(1000, 100, 'chat');
      metrics.trackQuery(500, 100, 'chat'); // Worse compression
      metrics.trackQuery(1000, 50, 'chat'); // Better compression

      const chatMetrics = metrics.getQueryMetrics('chat');

      expect(chatMetrics?.bestQuery.compressionRatio).toBe(20);
      expect(chatMetrics?.worstQuery.compressionRatio).toBe(5);
    });
  });

  describe('Time Series', () => {
    it('should track timestamps for queries', () => {
      const before = Date.now();
      metrics.trackQuery(1000, 100, 'test');
      const after = Date.now();

      const report = metrics.getMetrics();

      expect(report.timeSeries).toHaveLength(1);
      expect(report.timeSeries[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(report.timeSeries[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should get metrics for a time range', () => {
      const now = Date.now();

      metrics.trackQuery(1000, 100, 'test');
      const firstTimestamp = now;

      // Wait a bit to ensure different timestamps
      metrics.trackQuery(2000, 200, 'test');
      const secondTimestamp = Date.now();

      const rangeMetrics = metrics.getMetricsInRange(now, secondTimestamp);

      expect(rangeMetrics).toHaveLength(2);
      expect(rangeMetrics[0].timestamp).toBeGreaterThanOrEqual(now);
    });

    it('should get recent savings', () => {
      for (let i = 0; i < 10; i++) {
        metrics.trackQuery(1000, 100, 'test');
      }

      const recent = metrics.getRecentSavings(5);

      expect(recent).toHaveLength(5);
    });
  });

  describe('Import/Export', () => {
    it('should export metrics as JSON', () => {
      metrics.trackQuery(1000, 100, 'chat');
      metrics.trackQuery(500, 50, 'search');

      const exported = metrics.exportMetrics();
      const parsed = JSON.parse(exported);

      expect(parsed.totalQueries).toBe(2);
      expect(parsed.totalOriginalTokens).toBe(1500);
      expect(parsed.queryBreakdown).toHaveLength(2);
    });

    it('should import metrics from JSON', () => {
      const jsonData = JSON.stringify({
        savings: [
          {
            originalTokens: 1000,
            optimizedTokens: 100,
            savedTokens: 900,
            compressionRatio: 10,
            timestamp: Date.now(),
            queryType: 'chat',
          },
        ],
        queryBreakdown: [
          [
            'chat',
            {
              count: 1,
              totalOriginalTokens: 1000,
              totalOptimizedTokens: 100,
              totalSavedTokens: 900,
              averageCompressionRatio: 10,
              bestQuery: {
                originalTokens: 1000,
                optimizedTokens: 100,
                savedTokens: 900,
                compressionRatio: 10,
                timestamp: Date.now(),
                queryType: 'chat',
              },
              worstQuery: {
                originalTokens: 1000,
                optimizedTokens: 100,
                savedTokens: 900,
                compressionRatio: 10,
                timestamp: Date.now(),
                queryType: 'chat',
              },
            },
          ],
        ],
      });

      metrics.importMetrics(jsonData);

      const report = metrics.getMetrics();

      expect(report.totalQueries).toBe(1);
      expect(report.totalOriginalTokens).toBe(1000);
    });
  });

  describe('Statistics Summary', () => {
    it('should generate a readable summary', () => {
      metrics.trackQuery(1000, 100, 'chat');
      metrics.trackQuery(2000, 200, 'search');

      const summary = metrics.getStatsSummary();

      expect(summary).toContain('Total Queries: 2');
      expect(summary).toContain('Total Original Tokens:');
      expect(summary).toContain('Average Compression Ratio:');
    });

    it('should format large numbers correctly', () => {
      metrics.trackQuery(1000000, 100000, 'chat');

      const summary = metrics.getStatsSummary();

      // Should use K/M suffixes for large numbers
      expect(summary).toMatch(/Total Original Tokens: [0-9.]+[KM]/);
    });
  });

  describe('Reset Operations', () => {
    it('should reset all metrics', () => {
      metrics.trackQuery(1000, 100, 'chat');
      metrics.trackQuery(500, 50, 'search');

      metrics.resetMetrics();

      const report = metrics.getMetrics();

      expect(report.totalQueries).toBe(0);
      expect(report.totalOriginalTokens).toBe(0);
      expect(report.queryBreakdown.size).toBe(0);
    });
  });

  describe('Detailed Savings Tracking', () => {
    it('should track detailed savings with metadata', () => {
      const savings: TokenSavings = {
        originalTokens: 1000,
        optimizedTokens: 100,
        savedTokens: 900,
        compressionRatio: 10,
        timestamp: Date.now(),
        queryType: 'chat',
      };

      metrics.trackSavings(savings);

      const report = metrics.getMetrics();

      expect(report.totalQueries).toBe(1);
      expect(report.timeSeries[0].queryType).toBe('chat');
    });

    it('should calculate best and worst compression ratios', () => {
      metrics.trackQuery(1000, 100, 'test'); // 10x
      metrics.trackQuery(500, 50, 'test'); // 10x
      metrics.trackQuery(2000, 400, 'test'); // 5x (worst)
      metrics.trackQuery(1000, 50, 'test'); // 20x (best)

      const report = metrics.getMetrics();

      expect(report.bestCompressionRatio).toBe(20);
      expect(report.worstCompressionRatio).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero tokens gracefully', () => {
      metrics.trackQuery(0, 0, 'test');

      const report = metrics.getMetrics();

      expect(report.totalQueries).toBe(1);
      expect(report.totalOriginalTokens).toBe(0);
    });

    it('should handle queries with no savings', () => {
      metrics.trackQuery(1000, 1000, 'test'); // No compression

      const report = metrics.getMetrics();

      expect(report.totalSavedTokens).toBe(0);
      expect(report.averageCompressionRatio).toBe(1);
    });

    it('should handle empty metrics', () => {
      const report = metrics.getMetrics();

      expect(report.totalQueries).toBe(0);
      expect(report.totalOriginalTokens).toBe(0);
      expect(report.averageCompressionRatio).toBeNaN(); // 0/0
    });

    it('should handle unknown query types', () => {
      metrics.trackQuery(1000, 100, 'unknown-type-123');

      const unknownMetrics = metrics.getQueryMetrics('unknown-type-123');

      expect(unknownMetrics).toBeDefined();
      expect(unknownMetrics?.count).toBe(1);
    });
  });

  describe('Persistence (Disabled in Tests)', () => {
    it('should not save when persistence is disabled', async () => {
      const metricsNoPersist = new TokenMetrics({
        enablePersistence: false,
        autoSave: false,
      });

      metricsNoPersist.trackQuery(1000, 100, 'test');

      // Should not throw
      await metricsNoPersist.saveMetrics();

      metricsNoPersist.cleanup();
    });

    it('should not load when persistence is disabled', async () => {
      const metricsNoPersist = new TokenMetrics({
        enablePersistence: false,
        autoSave: false,
      });

      // Should not throw
      await metricsNoPersist.loadMetrics();

      const report = metricsNoPersist.getMetrics();
      expect(report.totalQueries).toBe(0);

      metricsNoPersist.cleanup();
    });
  });
});
