/**
 * Token Metrics Tracking System
 *
 * Tracks token usage, compression ratios, and savings over time.
 * Provides data for dashboards and analytics.
 */

/**
 * Token savings for a single query
 */
export interface TokenSavings {
  originalTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  compressionRatio: number;
  timestamp: number;
  queryType: string;
}

/**
 * Metrics summary report
 */
export interface MetricsReport {
  totalQueries: number;
  totalOriginalTokens: number;
  totalOptimizedTokens: number;
  totalSavedTokens: number;
  averageCompressionRatio: number;
  bestCompressionRatio: number;
  worstCompressionRatio: number;
  queryBreakdown: Map<string, QueryMetrics>;
  timeSeries: TokenSavings[];
}

/**
 * Per-query-type metrics
 */
export interface QueryMetrics {
  count: number;
  totalOriginalTokens: number;
  totalOptimizedTokens: number;
  totalSavedTokens: number;
  averageCompressionRatio: number;
  bestQuery: TokenSavings;
  worstQuery: TokenSavings;
}

/**
 * Metrics storage configuration
 */
export interface MetricsStorageConfig {
  enablePersistence: boolean;
  storagePath: string;
  autoSave: boolean;
  saveInterval: number;
}

/**
 * Token metrics class
 */
export class TokenMetrics {
  private savings: TokenSavings[];
  private queryMetrics: Map<string, QueryMetrics>;
  private config: MetricsStorageConfig;
  private saveTimer?: ReturnType<typeof setInterval> | undefined;

  constructor(config?: Partial<MetricsStorageConfig>) {
    this.config = {
      enablePersistence: true,
      storagePath: '.prism-metrics.json',
      autoSave: true,
      saveInterval: 60000, // 1 minute
      ...config,
    };

    this.savings = [];
    this.queryMetrics = new Map();

    if (this.config.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Track token usage for a query
   */
  trackQuery(original: number, optimized: number, queryType = 'unknown'): void {
    const saving: TokenSavings = {
      originalTokens: original,
      optimizedTokens: optimized,
      savedTokens: original - optimized,
      compressionRatio: original / optimized,
      timestamp: Date.now(),
      queryType,
    };

    this.savings.push(saving);
    this.updateQueryMetrics(saving);
  }

  /**
   * Track token savings with full details
   */
  trackSavings(savings: TokenSavings): void {
    this.savings.push(savings);
    this.updateQueryMetrics(savings);
  }

  /**
   * Get comprehensive metrics report
   */
  getMetrics(): MetricsReport {
    const totalQueries = this.savings.length;
    const totalOriginalTokens = this.savings.reduce((sum, s) => sum + s.originalTokens, 0);
    const totalOptimizedTokens = this.savings.reduce((sum, s) => sum + s.optimizedTokens, 0);
    const totalSavedTokens = this.savings.reduce((sum, s) => sum + s.savedTokens, 0);
    const averageCompressionRatio = totalOriginalTokens / totalOptimizedTokens;

    const compressionRatios = this.savings.map((s) => s.compressionRatio);
    const bestCompressionRatio = Math.max(...compressionRatios);
    const worstCompressionRatio = Math.min(...compressionRatios);

    return {
      totalQueries,
      totalOriginalTokens,
      totalOptimizedTokens,
      totalSavedTokens,
      averageCompressionRatio,
      bestCompressionRatio,
      worstCompressionRatio,
      queryBreakdown: new Map(this.queryMetrics),
      timeSeries: [...this.savings],
    };
  }

  /**
   * Get metrics for a specific query type
   */
  getQueryMetrics(queryType: string): QueryMetrics | undefined {
    return this.queryMetrics.get(queryType);
  }

  /**
   * Get recent token savings (last N entries)
   */
  getRecentSavings(count: number): TokenSavings[] {
    return this.savings.slice(-count);
  }

  /**
   * Get metrics for a time range
   */
  getMetricsInRange(startTime: number, endTime: number): TokenSavings[] {
    return this.savings.filter((s) => s.timestamp >= startTime && s.timestamp <= endTime);
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.savings = [];
    this.queryMetrics.clear();
  }

  /**
   * Save metrics to persistent storage
   */
  async saveMetrics(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    try {
      const data = {
        savings: this.savings,
        queryMetrics: Array.from(this.queryMetrics.entries()),
        lastSaved: Date.now(),
      };

      // Use fs module instead of Bun for compatibility
      const fs = await import('fs/promises');
      await fs.writeFile(this.config.storagePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save metrics:', error);
      throw error;
    }
  }

  /**
   * Load metrics from persistent storage
   */
  async loadMetrics(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    try {
      // Use fs module instead of Bun for compatibility
      const fs = await import('fs/promises');
      try {
        const text = await fs.readFile(this.config.storagePath, 'utf-8');
        const data = JSON.parse(text);

        this.savings = data.savings || [];
        this.queryMetrics = new Map(data.queryMetrics || []);
      } catch (err) {
        // File doesn't exist or is invalid - start fresh
        const fsError = err as { code?: string };
        if (fsError.code !== 'ENOENT') {
          throw err;
        }
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
      throw error;
    }
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    const report = this.getMetrics();
    return JSON.stringify(
      {
        ...report,
        queryBreakdown: Array.from(report.queryBreakdown.entries()),
        exportedAt: Date.now(),
      },
      null,
      2
    );
  }

  /**
   * Import metrics from JSON
   */
  importMetrics(json: string): void {
    try {
      const data = JSON.parse(json);

      if (data.savings) {
        this.savings = data.savings;
      }

      if (data.queryBreakdown) {
        this.queryMetrics = new Map(data.queryBreakdown);
      }
    } catch (error) {
      console.error('Failed to import metrics:', error);
      throw error;
    }
  }

  /**
   * Get statistics summary
   */
  getStatsSummary(): string {
    const report = this.getMetrics();

    const formatNumber = (n: number): string => {
      if (n >= 1000000) {
        return `${(n / 1000000).toFixed(1)}M`;
      }
      if (n >= 1000) {
        return `${(n / 1000).toFixed(1)}K`;
      }
      return n.toString();
    };

    return `
Token Metrics Summary
====================
Total Queries: ${report.totalQueries}
Total Original Tokens: ${formatNumber(report.totalOriginalTokens)}
Total Optimized Tokens: ${formatNumber(report.totalOptimizedTokens)}
Total Saved Tokens: ${formatNumber(report.totalSavedTokens)}
Average Compression Ratio: ${report.averageCompressionRatio.toFixed(2)}x
Best Compression: ${report.bestCompressionRatio.toFixed(2)}x
Worst Compression: ${report.worstCompressionRatio.toFixed(2)}x

Query Types:
${Array.from(report.queryBreakdown.entries())
  .map(([type, metrics]) => {
    return `  ${type}: ${metrics.count} queries, ${metrics.averageCompressionRatio.toFixed(2)}x avg`;
  })
  .join('\n')}
    `.trim();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.saveTimer !== undefined) {
      clearInterval(this.saveTimer);
      this.saveTimer = undefined;
    }

    if (this.config.autoSave) {
      void this.saveMetrics();
    }
  }

  /**
   * Update query metrics for a specific query type
   */
  private updateQueryMetrics(savings: TokenSavings): void {
    const existing = this.queryMetrics.get(savings.queryType);

    if (existing) {
      existing.count++;
      existing.totalOriginalTokens += savings.originalTokens;
      existing.totalOptimizedTokens += savings.optimizedTokens;
      existing.totalSavedTokens += savings.savedTokens;
      existing.averageCompressionRatio =
        existing.totalOriginalTokens / existing.totalOptimizedTokens;

      if (savings.compressionRatio > existing.bestQuery.compressionRatio) {
        existing.bestQuery = savings;
      }

      if (savings.compressionRatio < existing.worstQuery.compressionRatio) {
        existing.worstQuery = savings;
      }
    } else {
      this.queryMetrics.set(savings.queryType, {
        count: 1,
        totalOriginalTokens: savings.originalTokens,
        totalOptimizedTokens: savings.optimizedTokens,
        totalSavedTokens: savings.savedTokens,
        averageCompressionRatio: savings.compressionRatio,
        bestQuery: savings,
        worstQuery: savings,
      });
    }
  }

  /**
   * Start automatic saving
   */
  private startAutoSave(): void {
    if (this.saveTimer !== undefined) {
      return;
    }

    this.saveTimer = setInterval(() => {
      void this.saveMetrics();
    }, this.config.saveInterval);
  }
}

/**
 * Factory function to create a token metrics tracker
 */
export function createTokenMetrics(
  config?: Partial<MetricsStorageConfig>
): TokenMetrics {
  return new TokenMetrics(config);
}
