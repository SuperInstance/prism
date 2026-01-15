#!/usr/bin/env node

/**
 * PRISM Performance Monitoring System
 * Tracks metrics, identifies bottlenecks, and provides analytics
 */

const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

class PerformanceMonitor {
  constructor(config) {
    this.config = config;
    this.metrics = {
      indexing: {
        totalFiles: 0,
        totalTime: 0,
        averageTime: 0,
        filesPerSecond: 0,
        lastIndexed: null,
        cacheHits: 0,
        cacheMisses: 0,
        workerUtilization: 0
      },
      search: {
        totalQueries: 0,
        totalTime: 0,
        averageTime: 0,
        queriesPerSecond: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageResults: 0
      },
      memory: {
        currentUsage: 0,
        peakUsage: 0,
        averageUsage: 0,
        samples: []
      },
      system: {
        uptime: 0,
        startTime: Date.now(),
        lastHealthCheck: null,
        errorCount: 0,
        warningCount: 0
      }
    };

    this.history = [];
    this.maxHistorySize = 1000;
    this.monitoringInterval = null;
  }

  /**
   * Start monitoring system
   */
  start() {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000); // Collect metrics every 5 seconds

    console.log('[PRISM Performance Monitor] Started collecting metrics');
  }

  /**
   * Stop monitoring system
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[PRISM Performance Monitor] Stopped collecting metrics');
    }
  }

  /**
   * Record indexing metrics
   */
  recordIndexing(filesCount, duration, workersUsed) {
    this.metrics.indexing.totalFiles += filesCount;
    this.metrics.indexing.totalTime += duration;
    this.metrics.indexing.averageTime = duration / filesCount;
    this.metrics.indexing.filesPerSecond = filesCount / (duration / 1000);
    this.metrics.indexing.lastIndexed = Date.now();
    this.metrics.indexing.workerUtilization = workersUsed / this.config.parallelWorkers;

    this.addToHistory({
      type: 'indexing',
      timestamp: Date.now(),
      filesCount,
      duration,
      workersUsed
    });
  }

  /**
   * Record search metrics
   */
  recordSearch(query, duration, resultsCount, cached) {
    this.metrics.search.totalQueries++;
    this.metrics.search.totalTime += duration;
    this.metrics.search.averageTime = this.metrics.search.totalTime / this.metrics.search.totalQueries;
    this.metrics.search.queriesPerSecond = this.metrics.search.totalQueries / ((Date.now() - this.metrics.system.startTime) / 1000);
    this.metrics.search.averageResults = (this.metrics.search.averageResults * (this.metrics.search.totalQueries - 1) + resultsCount) / this.metrics.search.totalQueries;

    if (cached) {
      this.metrics.search.cacheHits++;
    } else {
      this.metrics.search.cacheMisses++;
    }

    this.addToHistory({
      type: 'search',
      timestamp: Date.now(),
      query,
      duration,
      resultsCount,
      cached
    });
  }

  /**
   * Update memory metrics
   */
  updateMemoryMetrics() {
    const usage = process.memoryUsage();
    this.metrics.memory.currentUsage = usage.heapUsed;
    this.metrics.memory.peakUsage = Math.max(this.metrics.memory.peakUsage, usage.heapUsed);

    // Keep samples for rolling average
    this.metrics.memory.samples.push({
      timestamp: Date.now(),
      usage: usage.heapUsed
    });

    // Keep only last 60 samples (5 minutes)
    if (this.metrics.memory.samples.length > 60) {
      this.metrics.memory.samples = this.metrics.memory.samples.slice(-60);
    }

    this.metrics.memory.averageUsage = this.metrics.memory.samples.reduce((sum, s) => sum + s.usage, 0) / this.metrics.memory.samples.length;
  }

  /**
   * Record system event
   */
  recordSystemEvent(type, message) {
    this.metrics.system[type === 'error' ? 'errorCount' : 'warningCount']++;

    this.addToHistory({
      type: 'system',
      timestamp: Date.now(),
      eventType: type,
      message
    });
  }

  /**
   * Collect metrics
   */
  collectMetrics() {
    this.updateMemoryMetrics();
    this.metrics.system.uptime = Date.now() - this.metrics.system.startTime;
  }

  /**
   * Add event to history
   */
  addToHistory(event) {
    this.history.push(event);

    // Keep history size limited
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get current performance report
   */
  getReport() {
    const report = {
      timestamp: Date.now(),
      uptime: this.metrics.system.uptime,
      indexing: {
        ...this.metrics.indexing,
        cacheHitRate: this.metrics.indexing.cacheHits / (this.metrics.indexing.cacheHits + this.metrics.indexing.cacheMisses) || 0
      },
      search: {
        ...this.metrics.search,
        cacheHitRate: this.metrics.search.cacheHits / (this.metrics.search.cacheHits + this.metrics.search.cacheMisses) || 0
      },
      memory: {
        currentUsage: this.formatBytes(this.metrics.memory.currentUsage),
        peakUsage: this.formatBytes(this.metrics.memory.peakUsage),
        averageUsage: this.formatBytes(this.metrics.memory.averageUsage),
        percentage: (this.metrics.memory.currentUsage / this.config.memoryLimit) * 100
      },
      system: {
        ...this.metrics.system,
        uptimeFormatted: this.formatDuration(this.metrics.system.uptime)
      }
    };

    // Calculate performance insights
    report.insights = this.generateInsights();

    return report;
  }

  /**
   * Get performance insights
   */
  generateInsights() {
    const insights = [];

    // Indexing insights
    if (this.metrics.indexing.filesPerSecond < 10) {
      insights.push({
        type: 'warning',
        category: 'indexing',
        message: `Slow indexing speed: ${this.metrics.indexing.filesPerSecond.toFixed(1)} files/sec. Consider optimizing file I/O or increasing workers.`
      });
    }

    // Search insights
    if (this.metrics.search.averageTime > 100) {
      insights.push({
        type: 'warning',
        category: 'search',
        message: `Slow search response: ${this.metrics.search.averageTime.toFixed(1)}ms avg. Consider optimizing search algorithm or increasing cache size.`
      });
    }

    // Memory insights
    const memoryPercentage = this.metrics.memory.currentUsage / this.config.memoryLimit * 100;
    if (memoryPercentage > 80) {
      insights.push({
        type: 'error',
        category: 'memory',
        message: `High memory usage: ${memoryPercentage.toFixed(1)}%. Consider reducing memory limit or optimizing file processing.`
      });
    }

    // Cache insights
    const searchCacheHitRate = this.metrics.search.cacheHits / (this.metrics.search.cacheHits + this.metrics.search.cacheMisses) || 0;
    if (searchCacheHitRate < 0.5) {
      insights.push({
        type: 'info',
        category: 'cache',
        message: `Low search cache hit rate: ${(searchCacheHitRate * 100).toFixed(1)}%. Consider increasing cache size.`
      });
    }

    return insights;
  }

  /**
   * Get historical trends
   */
  getTrends(minutes = 30) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recentEvents = this.history.filter(event => event.timestamp > cutoff);

    const trends = {
      indexingSpeed: [],
      searchTime: [],
      memoryUsage: [],
      errorRate: []
    };

    recentEvents.forEach(event => {
      if (event.type === 'indexing') {
        trends.indexingSpeed.push({
          timestamp: event.timestamp,
          value: event.filesCount / (event.duration / 1000) // files per second
        });
      } else if (event.type === 'search') {
        trends.searchTime.push({
          timestamp: event.timestamp,
          value: event.duration
        });
      } else if (event.type === 'system') {
        trends.errorRate.push({
          timestamp: event.timestamp,
          value: event.eventType === 'error' ? 1 : 0
        });
      }
    });

    // Aggregate memory usage from samples
    const recentMemory = this.metrics.memory.samples
      .filter(sample => sample.timestamp > cutoff)
      .map(sample => ({
        timestamp: sample.timestamp,
        value: sample.usage
      }));

    trends.memoryUsage = recentMemory;

    return trends;
  }

  /**
   * Export metrics to file
   */
  async exportMetrics(filePath) {
    const exportData = {
      metrics: this.metrics,
      history: this.history,
      trends: this.getTrends(),
      report: this.getReport(),
      timestamp: Date.now()
    };

    try {
      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
      console.log(`[PRISM Performance Monitor] Metrics exported to ${filePath}`);
    } catch (error) {
      console.error(`[PRISM Performance Monitor] Failed to export metrics: ${error.message}`);
    }
  }

  /**
   * Performance diagnostics
   */
  getDiagnostics() {
    return {
      bottlenecks: this.identifyBottlenecks(),
      recommendations: this.getRecommendations(),
      health: this.getHealthStatus()
    };
  }

  /**
   * Identify performance bottlenecks
   */
  identifyBottlenecks() {
    const bottlenecks = [];

    if (this.metrics.indexing.filesPerSecond < 20) {
      bottlenecks.push({
        component: 'indexing',
        issue: 'slow file processing',
        impact: 'high',
        suggestion: 'Increase worker threads or optimize file I/O'
      });
    }

    if (this.metrics.search.averageTime > 200) {
      bottlenecks.push({
        component: 'search',
        issue: 'slow query response',
        impact: 'medium',
        suggestion: 'Optimize search algorithm or increase cache size'
      });
    }

    if (this.metrics.memory.percentage > 85) {
      bottlenecks.push({
        component: 'memory',
        issue: 'high memory usage',
        impact: 'high',
        suggestion: 'Reduce memory limit or optimize data structures'
      });
    }

    return bottlenecks;
  }

  /**
   * Get performance recommendations
   */
  getRecommendations() {
    const recommendations = [];

    // Worker thread recommendations
    const workerUtilization = this.metrics.indexing.workerUtilization;
    if (workerUtilization < 0.5) {
      recommendations.push({
        priority: 'low',
        action: 'Decrease worker threads',
        reason: `Current utilization is ${Math.round(workerUtilization * 100)}%, below optimal`
      });
    } else if (workerUtilization > 0.9) {
      recommendations.push({
        priority: 'medium',
        action: 'Increase worker threads',
        reason: `High worker utilization at ${Math.round(workerUtilization * 100)}% may cause bottlenecks`
      });
    }

    // Memory recommendations
    const memoryPercentage = this.metrics.memory.percentage;
    if (memoryPercentage > 90) {
      recommendations.push({
        priority: 'high',
        action: 'Reduce memory limit or optimize file processing',
        reason: `Critical memory usage at ${memoryPercentage.toFixed(1)}%`
      });
    } else if (memoryPercentage > 70) {
      recommendations.push({
        priority: 'medium',
        action: 'Monitor memory usage closely',
        reason: `High memory usage at ${memoryPercentage.toFixed(1)}%`
      });
    }

    // Cache recommendations
    const searchCacheHitRate = this.metrics.search.cacheHits / (this.metrics.search.cacheHits + this.metrics.search.cacheMisses) || 0;
    if (searchCacheHitRate < 0.3) {
      recommendations.push({
        priority: 'low',
        action: 'Increase cache size',
        reason: `Low cache hit rate at ${(searchCacheHitRate * 100).toFixed(1)}%`
      });
    }

    return recommendations;
  }

  /**
   * Get overall health status
   */
  getHealthStatus() {
    let score = 100;
    let status = 'healthy';

    // Deduct points for various issues
    if (this.metrics.indexing.filesPerSecond < 10) score -= 20;
    if (this.metrics.search.averageTime > 100) score -= 15;
    if (this.metrics.memory.percentage > 80) score -= 25;
    if (this.metrics.system.errorCount > 5) score -= 10;

    if (score < 80) status = 'warning';
    if (score < 60) status = 'critical';

    return {
      score,
      status,
      uptime: this.formatDuration(this.metrics.system.uptime),
      errors: this.metrics.system.errorCount,
      warnings: this.metrics.system.warningCount
    };
  }

  /**
   * Utility methods
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

module.exports = PerformanceMonitor;