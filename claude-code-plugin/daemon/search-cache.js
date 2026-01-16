#!/usr/bin/env node

/**
 * PRISM Advanced Search Cache
 * Provides intelligent caching with multiple strategies and optimization
 */

const { performance } = require('perf_hooks');

class SearchCache {
  constructor(config) {
    this.config = config;

    // Multi-level cache structure
    this.cache = new Map(); // Primary cache (LRU)
    this.frequencyMap = new Map(); // Track query frequencies
    this.queryHistory = []; // Track recent queries for pattern analysis
    this.hotQueries = new Set(); // Frequently accessed queries

    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalQueries: 0,
      averageResponseTime: 0,
      cacheSize: 0
    };

    // Cache optimization strategies
    this.strategies = {
      lru: true,      // Least Recently Used
      lfu: false,     // Least Frequently Used (adaptive)
      adaptive: true, // Adaptive based on query patterns
      predictive: false // Predictive caching (future enhancement)
    };

    // Performance monitoring
    this.responseTimes = [];
    this.maxResponseTimeHistory = 100;
  }

  /**
   * Get cached result for a query
   */
  get(query) {
    const startTime = performance.now();
    this.stats.totalQueries++;

    // Generate cache key from query
    const cacheKey = this.generateCacheKey(query);

    // Check primary cache
    if (this.cache.has(cacheKey)) {
      const result = this.cache.get(cacheKey);

      // Update frequency tracking
      this.updateFrequency(cacheKey);

      // Update recency (move to end for LRU)
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, result);

      // Update statistics
      this.stats.hits++;
      this.recordResponseTime(startTime);

      return {
        ...result,
        cached: true,
        cacheHit: true
      };
    }

    // Check if query is "hot" but not in cache (adaptive strategy)
    if (this.hotQueries.has(cacheKey)) {
      // This might be a cache thrashing scenario
      this.stats.misses++;
      this.recordResponseTime(startTime);
      return null;
    }

    this.stats.misses++;
    this.recordResponseTime(startTime);
    return null;
  }

  /**
   * Set cache entry with intelligent eviction
   */
  set(query, result, options = {}) {
    const {
      ttl = this.config.cacheTTL || 60000, // Default 1 minute
      priority = 'normal',
      maxSize = this.config.maxCacheSize || 1000
    } = options;

    const cacheKey = this.generateCacheKey(query);
    const cacheEntry = {
      result,
      timestamp: Date.now(),
      ttl,
      priority,
      query,
      accessCount: 0,
      lastAccess: Date.now()
    };

    // Check cache size and evict if necessary
    if (this.cache.size >= maxSize) {
      this.evictEntries();
    }

    // Add to cache
    this.cache.set(cacheKey, cacheEntry);

    // Update frequency tracking
    this.updateFrequency(cacheKey);

    // Update cache size
    this.stats.cacheSize = this.cache.size;
  }

  /**
   * Generate optimized cache key
   */
  generateCacheKey(query) {
    // Normalize query for consistent hashing
    const normalized = query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^a-z0-9\s]/g, ''); // Remove special chars

    // Create hash for consistent key length
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  /**
   * Update frequency tracking
   */
  updateFrequency(cacheKey) {
    const currentFreq = this.frequencyMap.get(cacheKey) || 0;
    this.frequencyMap.set(cacheKey, currentFreq + 1);

    // Check if query should be marked as "hot"
    if (currentFreq + 1 >= 3) {
      this.hotQueries.add(cacheKey);
    }

    // Update query history
    this.queryHistory.push({
      key: cacheKey,
      timestamp: Date.now(),
      frequency: currentFreq + 1
    });

    // Keep history size limited
    if (this.queryHistory.length > 1000) {
      this.queryHistory = this.queryHistory.slice(-500);
    }
  }

  /**
   * Evict entries based on multiple strategies
   */
  evictEntries() {
    const entries = Array.from(this.cache.entries());
    const evictCount = Math.max(1, Math.floor(this.config.maxCacheSize * 0.1)); // Evict 10%

    // Sort by eviction priority
    entries.sort((a, b) => this.calculateEvictionPriority(a[1], b[1]));

    // Evict lowest priority entries
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
      this.frequencyMap.delete(entries[i][0]);
      this.hotQueries.delete(entries[i][0]);
      this.stats.evictions++;
    }

    // Update cache size
    this.stats.cacheSize = this.cache.size;
  }

  /**
   * Calculate eviction priority for cache entries
   */
  calculateEvictionPriority(entryA, entryB) {
    const now = Date.now();

    // LRU: Sort by last access time
    const lruDiff = entryA.lastAccess - entryB.lastAccess;

    // LFU: Sort by frequency
    const freqA = this.frequencyMap.get(this.findKeyByEntry(entryA)) || 0;
    const freqB = this.frequencyMap.get(this.findKeyByEntry(entryB)) || 0;
    const lfuDiff = freqA - freqB;

    // TTL: Consider expiration time
    const ttlA = entryA.timestamp + entryA.ttl;
    const ttlB = entryB.timestamp + entryB.ttl;
    const ttlDiff = ttlA - ttlB;

    // Priority weight combination
    const priorityA = (lruDiff * 0.4) + (lfuDiff * 0.4) + (ttlDiff * 0.2);
    const priorityB = 0;

    return priorityA - priorityB;
  }

  /**
   * Find cache key by entry (helper for eviction)
   */
  findKeyByEntry(entry) {
    for (const [key, value] of this.cache.entries()) {
      if (value === entry) return key;
    }
    return null;
  }

  /**
   * Record response time for performance analysis
   */
  recordResponseTime(startTime) {
    const responseTime = performance.now() - startTime;
    this.responseTimes.push(responseTime);

    // Keep history size limited
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes = this.responseTimes.slice(-this.maxResponseTimeHistory);
    }

    // Update average response time
    this.stats.averageResponseTime =
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.totalQueries > 0
      ? (this.stats.hits / this.stats.totalQueries) * 100
      : 0;

    return {
      ...this.stats,
      hitRate: hitRate.toFixed(2) + '%',
      averageResponseTime: this.stats.averageResponseTime.toFixed(2) + 'ms',
      cacheSize: this.stats.cacheSize,
      hotQueries: this.hotQueries.size,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Get cache optimization insights
   */
  getInsights() {
    const insights = [];

    // Cache hit rate analysis
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses);
    if (hitRate < 0.3) {
      insights.push({
        type: 'warning',
        message: `Low cache hit rate: ${(hitRate * 100).toFixed(1)}%. Consider increasing cache size or optimizing query patterns.`
      });
    } else if (hitRate > 0.7) {
      insights.push({
        type: 'success',
        message: `Excellent cache hit rate: ${(hitRate * 100).toFixed(1)}%. Cache is performing well.`
      });
    }

    // Response time analysis
    if (this.stats.averageResponseTime > 100) {
      insights.push({
        type: 'warning',
        message: `High average response time: ${this.stats.averageResponseTime.toFixed(2)}ms. Cache may be causing overhead.`
      });
    }

    // Eviction analysis
    if (this.stats.evictions > this.stats.cacheSize * 2) {
      insights.push({
        type: 'info',
        message: `High eviction rate: ${this.stats.evictions} evictions. Consider increasing cache size.`
      });
    }

    // Hot queries analysis
    if (this.hotQueries.size > this.config.maxCacheSize * 0.2) {
      insights.push({
        type: 'info',
        message: `Many hot queries: ${this.hotQueries.size}. This indicates good cache utilization.`
      });
    }

    return insights;
  }

  /**
   * Clear cache with option to keep hot entries
   */
  clear(options = {}) {
    const { keepHot = true } = options;

    if (keepHot) {
      // Keep hot queries in cache
      const newCache = new Map();
      for (const hotKey of this.hotQueries) {
        if (this.cache.has(hotKey)) {
          newCache.set(hotKey, this.cache.get(hotKey));
        }
      }
      this.cache = newCache;
    } else {
      // Clear everything
      this.cache.clear();
      this.hotQueries.clear();
    }

    // Reset statistics
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    this.stats.totalQueries = 0;
    this.responseTimes = [];

    console.log(`[PRISM Cache] Cache cleared. Remaining entries: ${this.cache.size}`);
  }

  /**
   * Export cache data for analysis
   */
  export() {
    return {
      cache: Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        timestamp: value.timestamp,
        ttl: value.ttl,
        accessCount: value.accessCount,
        lastAccess: value.lastAccess,
        priority: value.priority
      })),
      frequencyMap: Array.from(this.frequencyMap.entries()),
      hotQueries: Array.from(this.hotQueries),
      stats: this.getStats(),
      insights: this.getInsights(),
      exportTime: Date.now()
    };
  }

  /**
   * Adaptive cache optimization
   */
  optimize() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses);

    // Adjust cache size based on hit rate
    if (hitRate < 0.3 && this.config.maxCacheSize < 5000) {
      this.config.maxCacheSize = Math.min(this.config.maxCacheSize * 1.5, 5000);
      console.log(`[PRISM Cache] Increased cache size to ${this.config.maxCacheSize} due to low hit rate`);
    } else if (hitRate > 0.7 && this.config.maxCacheSize > 100) {
      this.config.maxCacheSize = Math.max(this.config.maxCacheSize * 0.8, 100);
      console.log(`[PRISM Cache] Reduced cache size to ${this.config.maxCacheSize} due to high hit rate`);
    }

    // Enable/disable strategies based on performance
    if (this.stats.averageResponseTime > 50) {
      this.strategies.lfu = true; // Enable LFU to reduce cache churn
      console.log('[PRISM Cache] Enabled LFU strategy due to high response times');
    }

    // Clean up old query history
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    this.queryHistory = this.queryHistory.filter(q => q.timestamp > cutoff);

    // Update hot queries based on recent activity
    this.updateHotQueries();
  }

  /**
   * Update hot queries based on recent frequency
   */
  updateHotQueries() {
    const recentCutoff = Date.now() - (60 * 60 * 1000); // Last hour
    const recentQueries = this.queryHistory.filter(q => q.timestamp > recentCutoff);

    // Count recent frequency
    const recentFreq = new Map();
    recentQueries.forEach(q => {
      recentFreq.set(q.key, (recentFreq.get(q.key) || 0) + 1);
    });

    // Update hot queries
    this.hotQueries.clear();
    for (const [key, freq] of recentFreq.entries()) {
      if (freq >= 5) { // 5+ accesses in the last hour
        this.hotQueries.add(key);
      }
    }
  }

  /**
   * Get cache health status
   */
  getHealthStatus() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses);
    let status = 'healthy';
    let score = 100;

    // Calculate health score
    if (hitRate < 0.2) score -= 30;
    else if (hitRate < 0.4) score -= 15;

    if (this.stats.averageResponseTime > 200) score -= 25;
    else if (this.stats.averageResponseTime > 100) score -= 10;

    if (this.stats.cacheSize > this.config.maxCacheSize * 0.9) score -= 15;

    if (score < 70) status = 'warning';
    if (score < 50) status = 'critical';

    return {
      status,
      score,
      hitRate: (hitRate * 100).toFixed(1) + '%',
      averageResponseTime: this.stats.averageResponseTime.toFixed(2) + 'ms',
      cacheUtilization: ((this.stats.cacheSize / this.config.maxCacheSize) * 100).toFixed(1) + '%'
    };
  }
}

module.exports = SearchCache;