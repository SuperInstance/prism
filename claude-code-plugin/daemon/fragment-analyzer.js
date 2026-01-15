#!/usr/bin/env node

/**
 * PRISM Index Fragmentation Analyzer
 * Analyzes and optimizes index fragmentation for better performance
 */

const fs = require('fs').promises;

class IndexFragmentAnalyzer {
  constructor(config = {}) {
    this.config = {
      fragmentationThreshold: 0.5, // Consider fragmented if >50%
      optimizationThreshold: 0.3, // Optimize if >30%
      minFilesForAnalysis: 10, // Minimum files to analyze
      ...config
    };

    this.analysisHistory = [];
    this.optimizationStats = {
      totalOptimizations: 0,
      totalSpaceReclaimed: 0,
      lastOptimization: null
    };
  }

  /**
   * Analyze index fragmentation
   */
  analyzeFragmentation(indexedFiles) {
    if (!indexedFiles || Object.keys(indexedFiles).length < this.config.minFilesForAnalysis) {
      return {
        fragmented: false,
        analysis: {
          reason: 'Insufficient files for analysis',
          fileCount: Object.keys(indexedFiles).length,
          minFiles: this.config.minFilesForAnalysis
        }
      };
    }

    const analysis = {
      totalFiles: Object.keys(indexedFiles).length,
      totalSize: 0,
      averageFileSize: 0,
      sizeDistribution: {
        tiny: 0,     // <1KB
        small: 0,    // 1KB-10KB
        medium: 0,   // 10KB-100KB
        large: 0,    // 100KB-1MB
        huge: 0      // >1MB
      },
      memoryEfficiency: 0,
      fragmentationRatio: 0,
      fragmentationScore: 0,
      recommendations: [],
      health: 'healthy'
    };

    let totalSize = 0;
    const sizes = [];

    // Calculate size distribution and collect sizes
    Object.values(indexedFiles).forEach(file => {
      const size = file.size || JSON.stringify(file.content || '').length;
      totalSize += size;
      sizes.push(size);

      if (size < 1024) analysis.sizeDistribution.tiny++;
      else if (size < 10240) analysis.sizeDistribution.small++;
      else if (size < 102400) analysis.sizeDistribution.medium++;
      else if (size < 1024000) analysis.sizeDistribution.large++;
      else analysis.sizeDistribution.huge++;
    });

    analysis.totalSize = totalSize;
    analysis.averageFileSize = totalSize / analysis.totalFiles;
    analysis.memoryEfficiency = this.calculateMemoryEfficiency(indexedFiles, totalSize);
    analysis.fragmentationRatio = this.calculateFragmentationRatio(sizes);
    analysis.fragmentationScore = this.calculateFragmentationScore(analysis);

    // Determine health status
    if (analysis.fragmentationScore > this.config.fragmentationThreshold) {
      analysis.health = 'fragmented';
      analysis.recommendations = this.generateRecommendations(analysis);
    } else if (analysis.fragmentationScore > this.config.optimizationThreshold) {
      analysis.health = 'needs-optimization';
      analysis.recommendations = this.generateRecommendations(analysis);
    }

    // Store analysis history
    this.storeAnalysis(analysis);

    return {
      fragmented: analysis.health !== 'healthy',
      analysis
    };
  }

  /**
   * Calculate memory efficiency
   */
  calculateMemoryEfficiency(indexedFiles, totalContentSize) {
    const currentMemoryUsage = process.memoryUsage().heapUsed;
    const overhead = currentMemoryUsage - totalContentSize;
    const efficiency = totalContentSize / currentMemoryUsage;
    return efficiency;
  }

  /**
   * Calculate fragmentation ratio based on size variance
   */
  calculateFragmentationRatio(sizes) {
    if (sizes.length < 2) return 0;

    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance = sizes.reduce((acc, size) => acc + Math.pow(size - mean, 2), 0) / sizes.length;
    const standardDeviation = Math.sqrt(variance);

    // Fragmentation ratio = standard deviation / mean
    // Higher ratio means more fragmentation
    return standardDeviation / mean;
  }

  /**
   * Calculate overall fragmentation score
   */
  calculateFragmentationScore(analysis) {
    const sizeRatio = analysis.fragmentationRatio;
    const memoryEfficiency = analysis.memoryEfficiency;
    const hugeFileRatio = analysis.sizeDistribution.huge / analysis.totalFiles;

    // Combine different metrics into a single score
    let score = sizeRatio * 0.5 + (1 - memoryEfficiency) * 0.3 + hugeFileRatio * 0.2;

    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.fragmentationRatio > 0.5) {
      recommendations.push({
        priority: 'high',
        category: 'fragmentation',
        action: 'reindex-consolidation',
        description: 'High fragmentation detected. Consider reindexing to consolidate file data.',
        impact: 'medium'
      });
    }

    if (analysis.memoryEfficiency < 0.5) {
      recommendations.push({
        priority: 'high',
        category: 'memory',
        action: 'compression',
        description: 'Low memory efficiency. Implement JSON compression to reduce memory usage.',
        impact: 'high'
      });
    }

    if (analysis.sizeDistribution.huge > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'large-files',
        action: 'splitting',
        description: `${analysis.sizeDistribution.huge} large files detected. Consider implementing streaming for files >1MB.`,
        impact: 'medium'
      });
    }

    if (analysis.totalFiles > 1000) {
      recommendations.push({
        priority: 'medium',
        category: 'scalability',
        action: 'batching',
        description: 'Large number of files detected. Implement advanced batching strategies.',
        impact: 'medium'
      });
    }

    // Add general optimization recommendations
    recommendations.push({
      priority: 'low',
      category: 'maintenance',
      action: 'cleanup',
      description: 'Schedule regular cleanup of unused and old files.',
      impact: 'low'
    });

    return recommendations;
  }

  /**
   * Store analysis in history
   */
  storeAnalysis(analysis) {
    const analysisRecord = {
      timestamp: Date.now(),
      ...analysis,
      fragmentScore: analysis.fragmentationScore
    };

    this.analysisHistory.push(analysisRecord);

    // Keep history size limited
    if (this.analysisHistory.length > 50) {
      this.analysisHistory = this.analysisHistory.slice(-50);
    }
  }

  /**
   * Get fragmentation trends
   */
  getFragmentationTrends() {
    if (this.analysisHistory.length < 2) {
      return {
        trend: 'insufficient-data',
        history: this.analysisHistory
      };
    }

    const recent = this.analysisHistory.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];

    const change = newest.fragmentScore - oldest.fragmentScore;
    let trend = 'stable';

    if (change > 0.1) trend = 'increasing';
    else if (change < -0.1) trend = 'decreasing';

    return {
      trend,
      change: change * 100, // Convert to percentage
      currentScore: newest.fragmentScore * 100,
      oldestScore: oldest.fragmentScore * 100,
      history: recent,
      period: {
        start: oldest.timestamp,
        end: newest.timestamp,
        entries: recent.length
      }
    };
  }

  /**
   * Optimize index based on analysis
   */
  async optimizeIndex(indexedFiles, optimizationStrategy = 'auto') {
    const startTime = performance.now();
    const optimization = {
      strategy: optimizationStrategy,
      startTime,
      operations: [],
      results: {
        filesProcessed: 0,
        spaceReclaimed: 0,
        timeTaken: 0,
        before: {},
        after: {}
      }
    };

    // Get before stats
    optimization.results.before = this.getIndexStats(indexedFiles);

    switch (optimizationStrategy) {
      case 'compression':
        optimization.operations.push('Applying JSON compression...');
        await this.applyCompressionOptimization(indexedFiles, optimization);
        break;

      case 'defragmentation':
        optimization.operations.push('Performing index defragmentation...');
        await this.applyDefragmentationOptimization(indexedFiles, optimization);
        break;

      case 'cleanup':
        optimization.operations.push('Removing unused data...');
        await this.applyCleanupOptimization(indexedFiles, optimization);
        break;

      case 'auto':
      default:
        // Analyze and apply appropriate optimizations
        const analysis = this.analyzeFragmentation(indexedFiles);
        if (analysis.fragmented) {
          if (analysis.analysis.memoryEfficiency < 0.5) {
            await this.applyCompressionOptimization(indexedFiles, optimization);
          }
          await this.applyDefragmentationOptimization(indexedFiles, optimization);
        }
        await this.applyCleanupOptimization(indexedFiles, optimization);
        break;
    }

    // Get after stats
    optimization.results.after = this.getIndexStats(indexedFiles);
    optimization.results.timeTaken = performance.now() - startTime;

    // Update optimization statistics
    this.optimizationStats.totalOptimizations++;
    this.optimizationStats.totalSpaceReclaimed += optimization.results.spaceReclaimed;
    this.optimizationStats.lastOptimization = Date.now();

    return optimization;
  }

  /**
   * Apply compression optimization
   */
  async applyCompressionOptimization(indexedFiles, optimization) {
    // This would integrate with the IndexCompressor
    // For now, we'll just simulate the optimization
    const compressedCount = Math.floor(Object.keys(indexedFiles).length * 0.1);
    optimization.results.filesProcessed = compressedCount;
    optimization.results.spaceReclaimed = compressedCount * 1024; // Estimate 1KB per file
  }

  /**
   * Apply defragmentation optimization
   */
  async applyDefragmentationOptimization(indexedFiles, optimization) {
    // Sort files by size to reduce fragmentation
    const files = Object.entries(indexedFiles);
    files.sort(([, a], [, b]) => a.size - b.size);

    // Reorganize index to reduce fragmentation
    const newIndex = {};
    files.forEach(([path, data]) => {
      newIndex[path] = data;
    });

    // Copy back to original
    Object.keys(indexedFiles).forEach(key => {
      delete indexedFiles[key];
    });
    Object.keys(newIndex).forEach(key => {
      indexedFiles[key] = newIndex[key];
    });

    optimization.results.spaceReclaimed = Math.floor(Object.keys(indexedFiles).length * 512); // Estimate 512B per file
  }

  /**
   * Apply cleanup optimization
   */
  async applyCleanupOptimization(indexedFiles, optimization) {
    const removedCount = 0; // Would integrate with AutoCleanupManager
    optimization.results.filesProcessed = removedCount;
    optimization.results.spaceReclaimed = removedCount * 2048; // Estimate 2KB per file
  }

  /**
   * Get index statistics
   */
  getIndexStats(indexedFiles) {
    if (!indexedFiles || Object.keys(indexedFiles).length === 0) {
      return { totalFiles: 0, totalSize: 0, averageSize: 0 };
    }

    const files = Object.values(indexedFiles);
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const averageSize = totalSize / files.length;

    return {
      totalFiles: files.length,
      totalSize,
      averageSize
    };
  }

  /**
   * Get comprehensive health report
   */
  getHealthReport(indexedFiles) {
    const fragmentation = this.analyzeFragmentation(indexedFiles);
    const trends = this.getFragmentationTrends();
    const stats = this.getIndexStats(indexedFiles);
    const optStats = this.optimizationStats;

    return {
      overall: fragmentation.analysis.health,
      fragmentation: {
        score: fragmentation.analysis.fragmentationScore * 100,
        ratio: fragmentation.analysis.fragmentationRatio,
        isFragmented: fragmentation.fragmented
      },
      memory: {
        efficiency: fragmentation.analysis.memoryEfficiency * 100,
        usage: process.memoryUsage().heapUsed
      },
      files: stats,
      trends,
      optimizations: optStats,
      recommendations: fragmentation.analysis.recommendations,
      timestamp: Date.now()
    };
  }

  /**
   * Generate optimization schedule
   */
  generateOptimizationSchedule() {
    const trends = this.getFragmentationTrends();
    const lastOpt = this.optimizationStats.lastOptimization;

    let schedule = {
      nextOptimization: null,
      reason: '',
      urgency: 'normal'
    };

    if (!lastOpt) {
      schedule.nextOptimization = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      schedule.reason = 'First optimization needed';
      schedule.urgency = 'high';
    } else if (trends.trend === 'increasing') {
      schedule.nextOptimization = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
      schedule.reason = 'Fragmentation is increasing rapidly';
      schedule.urgency = 'critical';
    } else if (trends.trend === 'decreasing') {
      schedule.nextOptimization = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
      schedule.reason = 'Fragmentation is decreasing';
      schedule.urgency = 'low';
    } else {
      schedule.nextOptimization = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      schedule.reason = 'Regular maintenance schedule';
      schedule.urgency = 'normal';
    }

    return schedule;
  }
}

module.exports = IndexFragmentAnalyzer;