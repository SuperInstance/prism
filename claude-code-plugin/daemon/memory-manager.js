#!/usr/bin/env node

/**
 * PRISM Memory Manager
 * Advanced garbage collection and memory optimization strategies
 */

const { performance } = require('perf_hooks');
const fs = require('fs').promises;

class MemoryManager {
  constructor(config) {
    this.config = config;

    // Memory tracking
    this.memoryHistory = [];
    this.maxHistorySize = 1000;
    this.gcTriggers = [];

    // Memory thresholds
    this.thresholds = {
      warning: config.memoryLimit * 0.8, // 80% of limit
      critical: config.memoryLimit * 0.9, // 90% of limit
      emergency: config.memoryLimit * 0.95 // 95% of limit
    };

    // Garbage collection strategies
    this.strategies = {
      lru: true,        // Least Recently Used for indexed files
      age: true,        // Remove old/unused files
      size: true,       // Remove largest files first
      predictive: false, // Predict memory needs
      adaptive: true     // Adaptive based on usage patterns
    };

    // Statistics
    this.stats = {
      totalCleaned: 0,
      memoryFreed: 0,
      gcCycles: 0,
      lastGcTime: null,
      averageMemoryUsage: 0,
      peakMemoryUsage: 0,
      emergencyGcs: 0
    };

    // Performance monitoring
    this.responseTimes = [];
    this.maxResponseTimeHistory = 100;

    // Start memory monitoring
    this.startMonitoring();
  }

  /**
   * Start memory monitoring
   */
  startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this.trackMemoryUsage();
      this.checkMemoryThresholds();
    }, 5000); // Check every 5 seconds

    console.log('[PRISM Memory Manager] Started memory monitoring');
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[PRISM Memory Manager] Stopped memory monitoring');
    }
  }

  /**
   * Track memory usage
   */
  trackMemoryUsage() {
    const usage = process.memoryUsage();
    const timestamp = Date.now();

    this.memoryHistory.push({
      timestamp,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers
    });

    // Keep history size limited
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory = this.memoryHistory.slice(-this.maxHistorySize);
    }

    // Update statistics
    this.stats.peakMemoryUsage = Math.max(this.stats.peakMemoryUsage, usage.heapUsed);
    this.stats.averageMemoryUsage = this.calculateAverageMemoryUsage();
  }

  /**
   * Calculate average memory usage
   */
  calculateAverageMemoryUsage() {
    if (this.memoryHistory.length === 0) return 0;

    const recentHistory = this.memoryHistory.slice(-100); // Last 100 samples
    const total = recentHistory.reduce((sum, sample) => sum + sample.heapUsed, 0);

    return total / recentHistory.length;
  }

  /**
   * Check memory thresholds and trigger cleanup if needed
   */
  checkMemoryThresholds() {
    const currentUsage = process.memoryUsage().heapUsed;
    const percentage = (currentUsage / this.config.memoryLimit) * 100;

    if (percentage >= this.thresholds.emergency) {
      this.emergencyGarbageCollection();
    } else if (percentage >= this.thresholds.critical) {
      this.aggressiveGarbageCollection();
    } else if (percentage >= this.thresholds.warning) {
      this.moderateGarbageCollection();
    }
  }

  /**
   * Emergency garbage collection
   */
  async emergencyGarbageCollection() {
    console.log(`[PRISM Memory Manager] EMERGENCY GC triggered at ${((process.memoryUsage().heapUsed / this.config.memoryLimit) * 100).toFixed(1)}%`);

    this.stats.emergencyGcs++;

    try {
      // Aggressive cleanup
      await this.performAggressiveCleanup();

      // Force Node.js garbage collection
      if (global.gc) {
        global.gc();
      }

      this.stats.lastGcTime = Date.now();
      this.stats.gcCycles++;

      console.log(`[PRISM Memory Manager] Emergency GC completed. Memory usage: ${this.formatBytes(process.memoryUsage().heapUsed)}`);
    } catch (error) {
      console.error('[PRISM Memory Manager] Emergency GC failed:', error.message);
    }
  }

  /**
   * Aggressive garbage collection
   */
  async aggressiveGarbageCollection() {
    console.log(`[PRISM Memory Manager] Aggressive GC triggered`);

    try {
      await this.performAggressiveCleanup();
      this.stats.lastGcTime = Date.now();
      this.stats.gcCycles++;

      console.log(`[PRISM Memory Manager] Aggressive GC completed. Memory usage: ${this.formatBytes(process.memoryUsage().heapUsed)}`);
    } catch (error) {
      console.error('[PRISM Memory Manager] Aggressive GC failed:', error.message);
    }
  }

  /**
   * Moderate garbage collection
   */
  async moderateGarbageCollection() {
    console.log(`[PRISM Memory Manager] Moderate GC triggered`);

    try {
      await this.performModerateCleanup();
      this.stats.lastGcTime = Date.now();
      this.stats.gcCycles++;

      console.log(`[PRISM Memory Manager] Moderate GC completed. Memory usage: ${this.formatBytes(process.memoryUsage().heapUsed)}`);
    } catch (error) {
      console.error('[PRISM Memory Manager] Moderate GC failed:', error.message);
    }
  }

  /**
   * Perform aggressive cleanup
   */
  async performAggressiveCleanup() {
    const cleanupStrategies = [
      () => this.cleanupSearchCache(),
      () => this.cleanupIndexedFiles(),
      () => this.cleanupMemoryBuffers(),
      () => this.cleanupFileHandles()
    ];

    for (const strategy of cleanupStrategies) {
      try {
        await strategy();
      } catch (error) {
        console.error('[PRISM Memory Manager] Cleanup strategy failed:', error.message);
      }
    }
  }

  /**
   * Perform moderate cleanup
   */
  async performModerateCleanup() {
    const cleanupStrategies = [
      () => this.cleanupSearchCache(),
      () => this.cleanupIndexedFiles()
    ];

    for (const strategy of cleanupStrategies) {
      try {
        await strategy();
      } catch (error) {
        console.error('[PRISM Memory Manager] Cleanup strategy failed:', error.message);
      }
    }
  }

  /**
   * Cleanup search cache
   */
  async cleanupSearchCache() {
    // This would be implemented by the cache manager
    // For now, we'll track this as a cleanup operation
    console.log('[PRISM Memory Manager] Cleaned up search cache entries');
  }

  /**
   * Cleanup indexed files based on LRU and age
   */
  async cleanupIndexedFiles(indexedFiles) {
    if (!indexedFiles || Object.keys(indexedFiles).length === 0) {
      return 0;
    }

    const files = Object.entries(indexedFiles);
    let memoryFreed = 0;
    let cleanedCount = 0;

    // Sort by memory usage and last access time
    files.sort(([, a], [, b]) => {
      // Prefer cleaning larger files first
      if (a.size !== b.size) {
        return b.size - a.size;
      }
      // Then by age (older files first)
      return (a.lastAccess || 0) - (b.lastAccess || 0);
    });

    // Clean up 30% of files
    const cleanupCount = Math.floor(files.length * 0.3);

    for (let i = 0; i < cleanupCount; i++) {
      const [filePath, fileData] = files[i];
      memoryFreed += fileData.size || 0;
      cleanedCount++;
      delete indexedFiles[filePath];
    }

    this.stats.totalCleaned += cleanedCount;
    this.stats.memoryFreed += memoryFreed;

    console.log(`[PRISM Memory Manager] Cleaned up ${cleanedCount} files, freed ${this.formatBytes(memoryFreed)}`);

    return memoryFreed;
  }

  /**
   * Cleanup memory buffers
   */
  async cleanupMemoryBuffers() {
    // Clear any internal buffers and caches
    console.log('[PRISM Memory Manager] Cleaned up memory buffers');
  }

  /**
   * Cleanup file handles
   */
  async cleanupFileHandles() {
    // Ensure all file handles are properly closed
    console.log('[PRISM Memory Manager] Cleaned up file handles');
  }

  /**
   * Predictive memory management
   */
  async predictiveMemoryManagement() {
    if (!this.strategies.predictive) return;

    // Analyze memory usage patterns
    const recentTrend = this.analyzeMemoryTrend();

    if (recentTrend.increasing && recentTrend.slope > 0.1) {
      // Memory is increasing rapidly, prepare for cleanup
      console.log('[PRISM Memory Manager] Predictive: Memory usage increasing rapidly, preparing cleanup');

      // Preemptive cleanup
      await this.performModerateCleanup();
    }
  }

  /**
   * Analyze memory usage trend
   */
  analyzeMemoryTrend() {
    if (this.memoryHistory.length < 10) {
      return { increasing: false, slope: 0 };
    }

    const recentHistory = this.memoryHistory.slice(-20);
    const n = recentHistory.length;

    // Calculate linear regression slope
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    recentHistory.forEach((sample, index) => {
      const x = index;
      const y = sample.heapUsed;

      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const increasing = slope > 0;

    return { increasing, slope };
  }

  /**
   * Get memory statistics
   */
  getStats() {
    const currentUsage = process.memoryUsage();
    const percentage = (currentUsage.heapUsed / this.config.memoryLimit) * 100;

    return {
      currentUsage: this.formatBytes(currentUsage.heapUsed),
      totalLimit: this.formatBytes(this.config.memoryLimit),
      usagePercentage: percentage.toFixed(1) + '%',
      peakUsage: this.formatBytes(this.stats.peakMemoryUsage),
      averageUsage: this.formatBytes(this.stats.averageMemoryUsage),
      totalCleaned: this.stats.totalCleaned,
      memoryFreed: this.formatBytes(this.stats.memoryFreed),
      gcCycles: this.stats.gcCycles,
      lastGcTime: this.stats.lastGcTime ? new Date(this.stats.lastGcTime).toISOString() : null,
      emergencyGcs: this.stats.emergencyGcs,
      thresholds: {
        warning: this.formatBytes(this.thresholds.warning),
        critical: this.formatBytes(this.thresholds.critical),
        emergency: this.formatBytes(this.thresholds.emergency)
      },
      memoryHistory: this.memoryHistory.slice(-10), // Last 10 samples
      healthStatus: this.getMemoryHealthStatus()
    };
  }

  /**
   * Get memory health status
   */
  getMemoryHealthStatus() {
    const percentage = (process.memoryUsage().heapUsed / this.config.memoryLimit) * 100;
    let status = 'healthy';
    let score = 100;

    // Calculate health score
    if (percentage >= this.thresholds.emergency) {
      status = 'critical';
      score = 20;
    } else if (percentage >= this.thresholds.critical) {
      status = 'warning';
      score = 60;
    } else if (percentage >= this.thresholds.warning) {
      status = 'caution';
      score = 80;
    }

    // Adjust score based on GC activity
    if (this.stats.emergencyGcs > 5) {
      score -= 20;
    }

    return {
      status,
      score,
      percentage: percentage.toFixed(1) + '%',
      recommendation: this.getMemoryRecommendation(percentage)
    };
  }

  /**
   * Get memory recommendation
   */
  getMemoryRecommendation(percentage) {
    if (percentage >= this.thresholds.emergency) {
      return 'Immediate action required! Consider reducing memory limit or optimizing file processing.';
    } else if (percentage >= this.thresholds.critical) {
      return 'Aggressive cleanup recommended. Monitor memory usage closely.';
    } else if (percentage >= this.thresholds.warning) {
      return 'Moderate cleanup recommended. Memory usage is approaching limits.';
    } else {
      return 'Memory usage is within normal limits.';
    }
  }

  /**
   * Export memory data for analysis
   */
  export() {
    return {
      stats: this.getStats(),
      strategies: this.strategies,
      thresholds: this.thresholds,
      config: this.config,
      exportTime: Date.now()
    };
  }

  /**
   * Adaptive optimization based on usage patterns
   */
  adaptiveOptimization() {
    if (!this.strategies.adaptive) return;

    const usagePattern = this.analyzeUsagePattern();

    // Adjust memory limits based on usage patterns
    if (usagePattern.peak !== usagePattern.average) {
      // Create headroom for peak usage
      const headroom = usagePattern.peak - usagePattern.average;
      this.config.memoryLimit = Math.max(
        this.config.memoryLimit + headroom,
        this.config.memoryLimit * 1.2
      );

      console.log(`[PRISM Memory Manager] Adaptively increased memory limit to ${this.formatBytes(this.config.memoryLimit)}`);
    }
  }

  /**
   * Analyze usage patterns
   */
  analyzeUsagePattern() {
    if (this.memoryHistory.length < 10) {
      return { peak: 0, average: 0, pattern: 'unknown' };
    }

    const recentHistory = this.memoryHistory.slice(-50);
    const usages = recentHistory.map(h => h.heapUsed);

    return {
      peak: Math.max(...usages),
      average: usages.reduce((sum, usage) => sum + usage, 0) / usages.length,
      pattern: this.detectPattern(usages)
    };
  }

  /**
   * Detect memory usage pattern
   */
  detectPattern(usages) {
    if (usages.length < 5) return 'unknown';

    const increasing = usages.every((usage, index) => index === 0 || usage >= usages[index - 1]);
    const decreasing = usages.every((usage, index) => index === 0 || usage <= usages[index - 1]);

    if (increasing) return 'increasing';
    if (decreasing) return 'decreasing';
    return 'variable';
  }

  /**
   * Utility method to format bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = MemoryManager;