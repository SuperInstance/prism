const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * FileWatcher - Watch for file changes and trigger reindexing
 * Uses Node.js fs.watch (no external dependencies)
 */
class FileWatcher extends EventEmitter {
  constructor(projectRoot, options = {}) {
    super();

    this.projectRoot = projectRoot;
    this.options = {
      debounceMs: options.debounceMs || 500,
      includePatterns: options.includePatterns || [
        /\.(js|ts|jsx|tsx|py|go|rs|java|cs|php|rb)$/,
        /\.(md|json|yaml|yml)$/
      ],
      excludePatterns: options.excludePatterns || [
        /node_modules/,
        /\.git/,
        /dist/,
        /build/,
        /coverage/,
        /\.next/,
        /\.prism/,
        /\.claude-plugin/
      ]
    };

    this.watchers = new Map();
    this.debounceTimers = new Map();
    this.isWatching = false;
    this.stats = {
      filesChanged: 0,
      filesCreated: 0,
      filesDeleted: 0,
      errors: 0,
      lastChange: null
    };
  }

  /**
   * Start watching the project directory
   */
  async start() {
    if (this.isWatching) {
      console.log('[FileWatcher] Already watching');
      return;
    }

    try {
      console.log('[FileWatcher] Starting file watcher...');
      await this.watchDirectory(this.projectRoot);
      this.isWatching = true;
      console.log('[FileWatcher] File watcher started');
      this.emit('started');
    } catch (error) {
      console.error('[FileWatcher] Failed to start:', error.message);
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Stop watching all directories
   */
  stop() {
    if (!this.isWatching) {
      return;
    }

    console.log('[FileWatcher] Stopping file watcher...');

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close all watchers
    for (const watcher of this.watchers.values()) {
      try {
        watcher.close();
      } catch (error) {
        console.warn('[FileWatcher] Error closing watcher:', error.message);
      }
    }
    this.watchers.clear();

    this.isWatching = false;
    console.log('[FileWatcher] File watcher stopped');
    this.emit('stopped');
  }

  /**
   * Restart a specific watcher after an error
   */
  async restartWatcher(dir) {
    console.log(`[FileWatcher] Restarting watcher for ${dir}...`);

    // Close existing watcher if present
    const existingWatcher = this.watchers.get(dir);
    if (existingWatcher) {
      try {
        existingWatcher.close();
      } catch (error) {
        // Ignore close errors
      }
      this.watchers.delete(dir);
    }

    // Wait a bit before restarting to avoid rapid restart loops
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Restart watching this directory
    await this.watchDirectory(dir);
    console.log(`[FileWatcher] Watcher restarted for ${dir}`);
  }

  /**
   * Watch a directory recursively
   */
  async watchDirectory(dir) {
    // Check if directory should be excluded
    const relativePath = path.relative(this.projectRoot, dir);
    if (this.shouldExclude(relativePath)) {
      return;
    }

    try {
      // Check if directory exists
      const stats = await fs.promises.stat(dir);
      if (!stats.isDirectory()) {
        return;
      }

      // Create watcher for this directory
      const watcher = fs.watch(dir, { recursive: false }, (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(dir, filename);
        this.handleFileChange(eventType, fullPath);
      });

      watcher.on('error', (error) => {
        console.warn(`[FileWatcher] Watcher error for ${dir}:`, error.message);
        this.stats.errors++;

        // Auto-restart watcher on error
        this.restartWatcher(dir).catch(err => {
          console.error(`[FileWatcher] Failed to restart watcher for ${dir}:`, err.message);
        });
      });

      this.watchers.set(dir, watcher);

      // Recursively watch subdirectories
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDir = path.join(dir, entry.name);
          await this.watchDirectory(subDir);
        }
      }
    } catch (error) {
      // Silently skip directories we can't access
      if (error.code !== 'ENOENT' && error.code !== 'EACCES') {
        console.warn(`[FileWatcher] Failed to watch ${dir}:`, error.message);
        this.stats.errors++;
      }
    }
  }

  /**
   * Handle file change events with debouncing
   */
  handleFileChange(eventType, fullPath) {
    const relativePath = path.relative(this.projectRoot, fullPath);

    // Check if file should be excluded
    if (this.shouldExclude(relativePath)) {
      return;
    }

    // Clear existing debounce timer for this file
    if (this.debounceTimers.has(fullPath)) {
      clearTimeout(this.debounceTimers.get(fullPath));
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(fullPath);
      this.processFileChange(eventType, fullPath, relativePath);
    }, this.options.debounceMs);

    this.debounceTimers.set(fullPath, timer);
  }

  /**
   * Process file change after debounce
   */
  async processFileChange(eventType, fullPath, relativePath) {
    try {
      // Check if file exists
      let exists = false;
      let isDirectory = false;

      try {
        const stats = await fs.promises.stat(fullPath);
        exists = true;
        isDirectory = stats.isDirectory();
      } catch (error) {
        exists = false;
      }

      if (isDirectory) {
        // Handle directory changes
        if (exists && eventType === 'rename') {
          // New directory created, start watching it
          await this.watchDirectory(fullPath);
          this.emit('directoryCreated', { path: relativePath });
        }
        return;
      }

      // Handle file changes
      const filename = path.basename(fullPath);

      if (!this.shouldInclude(filename)) {
        return;
      }

      if (!exists) {
        // File deleted
        this.stats.filesDeleted++;
        this.stats.lastChange = new Date().toISOString();
        console.log(`[FileWatcher] File deleted: ${relativePath}`);
        this.emit('fileDeleted', { path: relativePath, fullPath });
      } else if (eventType === 'rename') {
        // File created
        this.stats.filesCreated++;
        this.stats.lastChange = new Date().toISOString();
        console.log(`[FileWatcher] File created: ${relativePath}`);
        this.emit('fileCreated', { path: relativePath, fullPath });
      } else {
        // File modified
        this.stats.filesChanged++;
        this.stats.lastChange = new Date().toISOString();
        console.log(`[FileWatcher] File changed: ${relativePath}`);
        this.emit('fileChanged', { path: relativePath, fullPath });
      }
    } catch (error) {
      console.warn(`[FileWatcher] Error processing change for ${relativePath}:`, error.message);
      this.stats.errors++;
    }
  }

  /**
   * Check if file should be included based on patterns
   */
  shouldInclude(filename) {
    return this.options.includePatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Check if path should be excluded based on patterns
   */
  shouldExclude(relativePath) {
    // Normalize path for consistent matching
    const normalizedPath = relativePath.replace(/\\/g, '/');
    return this.options.excludePatterns.some(pattern => pattern.test(normalizedPath));
  }

  /**
   * Get watcher statistics
   */
  getStats() {
    return {
      ...this.stats,
      isWatching: this.isWatching,
      watchedDirectories: this.watchers.size,
      pendingChanges: this.debounceTimers.size
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      filesChanged: 0,
      filesCreated: 0,
      filesDeleted: 0,
      errors: 0,
      lastChange: null
    };
  }
}

module.exports = FileWatcher;
