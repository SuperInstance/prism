#!/usr/bin/env node

/**
 * PRISM Delta Index Manager
 * Handles incremental indexing with change detection
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const WorkerFileProcessor = require('./worker-processor');

class DeltaIndexManager {
  constructor(config = {}) {
    this.config = {
      maxHistory: 50, // Keep last 50 index states
      enableDelta: true,
      deltaThreshold: 0.1, // Reindex if >10% of files changed
      ...config
    };

    this.lastIndexState = null;
    this.indexHistory = [];
    this.contentStore = new Map();
    this.changeTracker = new Map();
  }

  /**
   * Calculate SHA-256 hash of file content
   */
  async calculateChecksum(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Get file metadata for change detection
   */
  async getFileMetadata(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const hash = await this.calculateChecksum(content);

      return {
        path: filePath,
        size: stats.size,
        mtime: stats.mtime.getTime(),
        hash: hash,
        checksum: hash
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Compute delta between current files and last index
   */
  async computeDelta(files) {
    const changes = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: [],
      stats: {
        totalFiles: files.length,
        changedFiles: 0,
        changePercentage: 0
      }
    };

    // Get metadata for all current files
    const currentFiles = await Promise.all(
      files.map(file => this.getFileMetadata(file))
    );

    // Filter out files that couldn't be read
    const validFiles = currentFiles.filter(meta => meta !== null);
    const validFilePaths = validFiles.map(meta => meta.path);

    // Find added and modified files
    for (const fileMeta of validFiles) {
      const lastMeta = this.lastIndexState?.[fileMeta.path];

      if (!lastMeta) {
        // File was added
        changes.added.push(fileMeta.path);
      } else if (fileMeta.hash !== lastMeta.hash) {
        // File was modified
        changes.modified.push(fileMeta.path);
      } else {
        // File unchanged
        changes.unchanged.push(fileMeta.path);
      }
    }

    // Find deleted files
    if (this.lastIndexState) {
      for (const filePath of Object.keys(this.lastIndexState)) {
        if (!validFilePaths.includes(filePath)) {
          changes.deleted.push(filePath);
        }
      }
    }

    // Calculate change statistics
    changes.stats.changedFiles = changes.added.length + changes.modified.length;
    changes.stats.changePercentage = changes.stats.changedFiles / validFiles.length;

    // Store change tracking data
    this.trackChanges(changes);

    return changes;
  }

  /**
   * Track changes for analysis
   */
  trackChanges(changes) {
    const timestamp = Date.now();
    this.changeTracker.set(timestamp, {
      timestamp,
      changes: {
        added: changes.added.length,
        modified: changes.modified.length,
        deleted: changes.deleted.length,
        unchanged: changes.unchanged.length
      },
      totalFiles: changes.stats.totalFiles,
      changePercentage: changes.stats.changePercentage
    });

    // Keep only recent changes
    if (this.changeTracker.size > 100) {
      const oldestKey = this.changeTracker.keys().next().value;
      this.changeTracker.delete(oldestKey);
    }
  }

  /**
   * Apply delta to current index
   */
  async applyDelta(changes, currentIndex) {
    const newIndex = { ...currentIndex };
    const processingStartTime = performance.now();

    // Process deleted files first
    for (const filePath of changes.deleted) {
      delete newIndex[filePath];
      this.contentStore.delete(filePath);
    }

    // Process modified and added files
    const filesToProcess = [...changes.added, ...changes.modified];

    if (filesToProcess.length > 0) {
      console.log(`[PRISM Delta] Processing ${filesToProcess.length} changed files`);

      // Use worker processor for efficient file processing
      const processor = new WorkerFileProcessor({
        maxFileSize: 1024 * 1024, // 1MB
        memoryLimit: 50 * 1024 * 1024 // 50MB
      });

      const startTime = performance.now();

      // Process files in parallel
      const processPromises = filesToProcess.map(async (filePath) => {
        try {
          const fileData = await processor.processFile(filePath);
          if (fileData) {
            newIndex[filePath] = {
              content: fileData.content,
              size: fileData.size,
              mtime: fileData.mtime,
              hash: fileData.hash
            };

            // Store content for potential deduplication
            this.contentStore.set(filePath, fileData.content);
          }
        } catch (error) {
          console.error(`[PRISM Delta] Failed to process ${filePath}:`, error.message);
        }
      });

      await Promise.all(processPromises);

      const processingTime = performance.now() - startTime;
      console.log(`[PRISM Delta] Processing completed in ${processingTime.toFixed(2)}ms`);
    }

    // Update index state
    this.updateIndexState(newIndex);

    return {
      newIndex,
      processingTime: performance.now() - processingStartTime,
      stats: changes.stats
    };
  }

  /**
   * Update index state and maintain history
   */
  updateIndexState(indexState) {
    this.lastIndexState = { ...indexState };

    // Add to history
    this.indexHistory.push({
      timestamp: Date.now(),
      state: indexState,
      fileCount: Object.keys(indexState).length
    });

    // Keep history size limited
    if (this.indexHistory.length > this.config.maxHistory) {
      this.indexHistory = this.indexHistory.slice(-this.config.maxHistory);
    }
  }

  /**
   * Check if delta indexing should be used
   */
  shouldUseDelta(changes) {
    if (!this.config.enableDelta) return false;

    // Use delta if change percentage is below threshold
    return changes.stats.changePercentage < this.config.deltaThreshold;
  }

  /**
   * Get change history
   */
  getChangeHistory(limit = 10) {
    return this.indexHistory.slice(-limit);
  }

  /**
   * Get change statistics
   */
  getChangeStatistics() {
    if (this.changeTracker.size === 0) {
      return {
        totalChanges: 0,
        averageChangePercentage: 0,
        mostActivePeriod: null
      };
    }

    const changes = Array.from(this.changeTracker.values());
    const totalChanges = changes.reduce((sum, c) => sum + c.changes.added + c.changes.modified + c.changes.deleted, 0);
    const avgChangePercentage = changes.reduce((sum, c) => sum + c.changePercentage, 0) / changes.length;

    // Find most active period
    const mostActive = changes.reduce((max, current) =>
      current.changePercentage > max.changePercentage ? current : max
    );

    return {
      totalChanges,
      averageChangePercentage: avgChangePercentage * 100,
      mostActivePeriod: {
        timestamp: mostActive.timestamp,
        changePercentage: mostActive.changePercentage * 100,
        changes: mostActive.changes
      },
      trackingPeriod: {
        start: changes[0]?.timestamp,
        end: changes[changes.length - 1]?.timestamp,
        entries: changes.length
      }
    };
  }

  /**
   * Optimize delta processing based on history
   */
  optimizeDeltaStrategy() {
    const stats = this.getChangeStatistics();

    let recommendations = {
      useDelta: this.config.enableDelta,
      batchSize: 10,
      parallelism: 1
    };

    // Adjust delta threshold based on change patterns
    if (stats.averageChangePercentage > 0.3) {
      // High change rate, maybe disable delta
      recommendations.useDelta = false;
    } else if (stats.averageChangePercentage < 0.05) {
      // Low change rate, can optimize further
      recommendations.batchSize = 20;
      recommendations.parallelism = 2;
    }

    return {
      ...recommendations,
      reasoning: {
        averageChangePercentage: stats.averageChangePercentage,
        threshold: this.config.deltaThreshold,
        recommendation: recommendations.useDelta ? 'Use delta indexing' : 'Use full indexing'
      }
    };
  }

  /**
   * Save delta state to file
   */
  async saveState(filePath) {
    const stateData = {
      version: '1.0',
      lastIndexState: this.lastIndexState,
      indexHistory: this.indexHistory.slice(-10), // Save only recent history
      changeTracker: Array.from(this.changeTracker.entries()).slice(-20), // Save recent changes
      lastSaved: Date.now()
    };

    await fs.writeFile(filePath, JSON.stringify(stateData, null, 2));
  }

  /**
   * Load delta state from file
   */
  async loadState(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const stateData = JSON.parse(content);

      this.lastIndexState = stateData.lastIndexState || {};
      this.indexHistory = stateData.indexHistory || [];

      // Restore change tracker
      this.changeTracker.clear();
      for (const [timestamp, changes] of (stateData.changeTracker || [])) {
        this.changeTracker.set(timestamp, changes);
      }

      console.log(`[PRISM Delta] State loaded with ${Object.keys(this.lastIndexState).length} files`);
    } catch (error) {
      console.error('[PRISM Delta] Failed to load state:', error.message);
      // Initialize with empty state
      this.lastIndexState = {};
      this.indexHistory = [];
      this.changeTracker.clear();
    }
  }
}

module.exports = DeltaIndexManager;