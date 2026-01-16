#!/usr/bin/env node

/**
 * PRISM Automatic Cleanup Manager
 * Handles automatic cleanup of old and unused files
 */

const fs = require('fs').promises;
const path = require('path');

class AutoCleanupManager {
  constructor(config = {}) {
    this.config = {
      maxIndexAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
      maxUnusedFiles: 100,                   // Files not searched in 7 days
      cleanupInterval: 60 * 60 * 1000,       // 1 hour
      maxMemoryUsage: 100 * 1024 * 1024,     // 100MB
      cleanupThreshold: 0.8,                 // Clean when 80% of memory used
      enableAutoCleanup: true,
      ...config
    };

    this.lastCleanupTime = Date.now();
    this.accessTracker = new Map();
    this.cleanupStats = {
      totalCleaned: 0,
      totalReclaimed: 0,
      cleanupCount: 0,
      lastCleanupTime: null
    };

    this.startCleanupTimer();
  }

  /**
   * Track file access for cleanup decisions
   */
  trackAccess(filePath) {
    const now = Date.now();
    this.accessTracker.set(filePath, {
      lastAccess: now,
      accessCount: (this.accessTracker.get(filePath)?.accessCount || 0) + 1,
      firstAccess: this.accessTracker.get(filePath)?.firstAccess || now
    });
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    if (this.cleanupInterval) {
      this.timer = setInterval(() => {
        this.performCleanup().catch(error => {
          console.error('[AutoCleanup] Cleanup failed:', error.message);
        });
      }, this.cleanupInterval);

      console.log('[AutoCleanup] Automatic cleanup started');
    }
  }

  /**
   * Stop automatic cleanup timer
   */
  stopCleanupTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[AutoCleanup] Automatic cleanup stopped');
    }
  }

  /**
   * Perform comprehensive cleanup
   */
  async performCleanup() {
    const now = Date.now();
    if (now - this.lastCleanupTime < this.cleanupInterval) return;

    console.log('[AutoCleanup] Starting cleanup cycle');

    const cleanupTasks = [
      this.cleanupOldFiles(),
      this.cleanupUnusedFiles(),
      this.cleanupMemoryPressure(),
      this.compactIndex()
    ];

    const results = await Promise.allSettled(cleanupTasks);
    const summary = {
      timestamp: now,
      tasks: [],
      totalCleaned: 0,
      totalReclaimed: 0
    };

    results.forEach((result, index) => {
      const taskNames = ['oldFiles', 'unusedFiles', 'memoryPressure', 'compactIndex'];
      const taskName = taskNames[index];

      if (result.status === 'fulfilled') {
        summary.tasks.push({
          task: taskName,
          success: true,
          ...result.value
        });
        summary.totalCleaned += result.value.cleanedFiles || 0;
        summary.totalReclaimed += result.value.reclaimedMemory || 0;
      } else {
        summary.tasks.push({
          task: taskName,
          success: false,
          error: result.reason.message
        });
        console.error(`[AutoCleanup] ${taskName} failed:`, result.reason.message);
      }
    });

    // Update cleanup statistics
    this.cleanupStats.totalCleaned += summary.totalCleaned;
    this.cleanupStats.totalReclaimed += summary.totalReclaimed;
    this.cleanupStats.cleanupCount++;
    this.cleanupStats.lastCleanupTime = now;

    this.lastCleanupTime = now;

    console.log(`[AutoCleanup] Cleanup completed: ${summary.totalCleaned} files cleaned, ${this.formatBytes(summary.totalReclaimed)} reclaimed`);

    return summary;
  }

  /**
   * Clean up old files based on modification time
   */
  async cleanupOldFiles() {
    const maxAge = this.config.maxIndexAge;
    const now = Date.now();
    let cleanedFiles = 0;
    let reclaimedMemory = 0;

    const filesToClean = [];

    for (const [filePath, accessData] of this.accessTracker) {
      const fileAge = now - accessData.lastAccess;
      if (fileAge > maxAge) {
        filesToClean.push({
          filePath,
          age: fileAge,
          lastAccess: accessData.lastAccess
        });
      }
    }

    // Sort by age (oldest first)
    filesToClean.sort((a, b) => b.age - a.age);

    // Clean oldest files first
    const maxFilesToClean = Math.max(0, this.accessTracker.size - 50);
    const filesToRemove = filesToClean.slice(0, maxFilesToClean);

    for (const file of filesToRemove) {
      reclaimedMemory += await this.removeFile(file.filePath);
      cleanedFiles++;
    }

    return { cleanedFiles, reclaimedMemory, type: 'age-based' };
  }

  /**
   * Clean up unused files based on access patterns
   */
  async cleanupUnusedFiles() {
    const maxUnused = this.config.maxUnusedFiles;
    const now = Date.now();
    const unusedFiles = [];

    // Find files not accessed recently
    for (const [filePath, accessData] of this.accessTracker) {
      const daysSinceAccess = (now - accessData.lastAccess) / (24 * 60 * 60 * 1000);
      if (daysSinceAccess > 7) { // Not accessed in 7 days
        unusedFiles.push({
          filePath,
          lastAccess: accessData.lastAccess,
          accessCount: accessData.accessCount,
          age: now - accessData.firstAccess
        });
      }
    }

    // Sort by last access time (oldest first)
    unusedFiles.sort((a, b) => a.lastAccess - b.lastAccess);

    // Calculate how many files to remove
    const currentUnused = unusedFiles.length;
    const filesToRemove = Math.max(0, currentUnused - maxUnused);

    let reclaimedMemory = 0;
    for (let i = 0; i < filesToRemove; i++) {
      reclaimedMemory += await this.removeFile(unusedFiles[i].filePath);
    }

    return {
      cleanedFiles: filesToRemove,
      reclaimedMemory,
      type: 'access-based',
      unusedFiles: currentUnused,
      maxAllowed: maxUnused
    };
  }

  /**
   * Clean up files based on memory pressure
   */
  async cleanupMemoryPressure() {
    const maxMemory = this.config.maxMemoryUsage;
    const memoryPressureThreshold = this.config.cleanupThreshold;
    const currentMemory = process.memoryUsage().heapUsed;

    if (currentMemory < maxMemory * memoryPressureThreshold) {
      return { cleanedFiles: 0, reclaimedMemory: 0, type: 'memory-pressure' };
    }

    const memoryPressure = currentMemory / maxMemory;
    console.log(`[AutoCleanup] Memory pressure detected: ${(memoryPressure * 100).toFixed(1)}%`);

    // Calculate how much memory to reclaim
    const targetMemory = maxMemory * (memoryPressureThreshold - 0.1); // 10% below threshold
    const memoryToReclaim = currentMemory - targetMemory;

    // Find largest files to remove
    const fileSizes = [];
    for (const [filePath, accessData] of this.accessTracker) {
      // Estimate file size based on last access pattern
      const estimatedSize = this.estimateFileSize(filePath, accessData);
      fileSizes.push({
        filePath,
        size: estimatedSize,
        lastAccess: accessData.lastAccess,
        accessCount: accessData.accessCount
      });
    }

    // Sort by size (largest first)
    fileSizes.sort((a, b) => b.size - a.size);

    let reclaimedMemory = 0;
    let cleanedFiles = 0;

    for (const file of fileSizes) {
      if (reclaimedMemory >= memoryToReclaim) break;

      reclaimedMemory += file.size;
      cleanedFiles++;
      await this.removeFile(file.filePath);
    }

    return {
      cleanedFiles,
      reclaimedMemory,
      type: 'memory-pressure',
      pressureLevel: memoryPressure * 100,
      targetReclaimed: memoryToReclaim
    };
  }

  /**
   * Compact index by removing fragmented data
   */
  async compactIndex() {
    const now = Date.now();
    let compactedFiles = 0;
    let reclaimedMemory = 0;

    // Remove entries from access tracker that no longer exist
    const existingFiles = new Set(this.accessTracker.keys());
    const trackedFiles = Array.from(this.accessTracker.keys());

    for (const filePath of trackedFiles) {
      try {
        await fs.access(filePath);
        // File still exists
      } catch (error) {
        // File doesn't exist, clean up
        const size = this.estimateFileSize(filePath, this.accessTracker.get(filePath));
        reclaimedMemory += size;
        this.accessTracker.delete(filePath);
        compactedFiles++;
      }
    }

    // Clean up old access data
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    const oldEntries = [];

    for (const [filePath, accessData] of this.accessTracker) {
      const entryAge = now - accessData.lastAccess;
      if (entryAge > maxAge) {
        oldEntries.push(filePath);
      }
    }

    // Remove oldest entries if we have too many
    const maxEntries = this.config.maxUnusedFiles * 2;
    if (this.accessTracker.size > maxEntries) {
      const entriesToRemove = this.accessTracker.size - maxEntries;
      for (let i = 0; i < entriesToRemove; i++) {
        const oldestFile = this.findOldestAccess();
        if (oldestFile) {
          this.accessTracker.delete(oldestFile);
          compactedFiles++;
        }
      }
    }

    return {
      cleanedFiles: compactedFiles,
      reclaimedMemory,
      type: 'compaction',
      trackedFiles: this.accessTracker.size
    };
  }

  /**
   * Remove a file from tracking
   */
  async removeFile(filePath) {
    try {
      // Try to get file size for accounting
      let size = 0;
      try {
        const stats = await fs.stat(filePath);
        size = stats.size;
      } catch (error) {
        // File already gone, use estimate
        size = this.estimateFileSize(filePath, this.accessTracker.get(filePath));
      }

      // Remove from access tracker
      this.accessTracker.delete(filePath);

      return size;
    } catch (error) {
      console.error(`[AutoCleanup] Failed to remove file ${filePath}:`, error.message);
      return 0;
    }
  }

  /**
   * Estimate file size based on access patterns
   */
  estimateFileSize(filePath, accessData) {
    if (!accessData) return 1024; // Default 1KB

    // Base size on access frequency and age
    const baseSize = 1024; // 1KB minimum
    const accessBonus = accessData.accessCount * 100; // 100 bytes per access
    const ageBonus = Math.min((Date.now() - accessData.firstAccess) / (24 * 60 * 60 * 1000), 30) * 50; // Up to 50 bytes per day

    return baseSize + accessBonus + ageBonus;
  }

  /**
   * Find the file with oldest access time
   */
  findOldestAccess() {
    let oldestFile = null;
    let oldestTime = Infinity;

    for (const [filePath, accessData] of this.accessTracker) {
      if (accessData.lastAccess < oldestTime) {
        oldestTime = accessData.lastAccess;
        oldestFile = filePath;
      }
    }

    return oldestFile;
  }

  /**
   * Get cleanup statistics
   */
  getCleanupStats() {
    return {
      ...this.cleanupStats,
      currentTrackedFiles: this.accessTracker.size,
      lastCleanup: this.cleanupStats.lastCleanupTime ?
        new Date(this.cleanupStats.lastCleanupTime).toISOString() : null
    };
  }

  /**
   * Get current memory pressure
   */
  getMemoryPressure() {
    const currentMemory = process.memoryUsage().heapUsed;
    const maxMemory = this.config.maxMemoryUsage;
    const pressure = currentMemory / maxMemory;

    return {
      currentMemory: this.formatBytes(currentMemory),
      maxMemory: this.formatBytes(maxMemory),
      pressurePercentage: (pressure * 100).toFixed(1) + '%',
      status: pressure > this.config.cleanupThreshold ? 'warning' : 'healthy'
    };
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Force cleanup immediately
   */
  async forceCleanup() {
    this.lastCleanupTime = 0; // Force cleanup
    return await this.performCleanup();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    // Restart timer if interval changed
    this.stopCleanupTimer();
    if (this.config.enableAutoCleanup) {
      this.startCleanupTimer();
    }
  }
}

module.exports = AutoCleanupManager;