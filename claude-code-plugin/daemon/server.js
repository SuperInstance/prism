#!/usr/bin/env node

/**
 * PRISM Simple Daemon
 * Provides basic project memory for Claude Code
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const WorkerFileProcessor = require('./worker-processor');
const FuzzySearch = require('./fuzzy-search');
const PerformanceMonitor = require('./performance-monitor');
const { Worker } = require('worker_threads');
const { performance } = require('perf_hooks');

class PrismDaemon {
  constructor() {
    this.projectRoot = process.env.PROJECT_ROOT || process.cwd();

    // Initialize with default config, will be updated after project size estimation
    this.adaptiveConfig = {
      maxFiles: 1000,
      maxFileSize: 1024 * 1024,
      parallelWorkers: 1,
      memoryLimit: 100 * 1024 * 1024,
      cacheSize: 50
    };

    this.config = {
      port: parseInt(process.env.PORT) || 8080,
      projectRoot: this.projectRoot,
      logLevel: process.env.LOG_LEVEL || 'info',
      maxFiles: this.adaptiveConfig.maxFiles,
      maxFileSize: this.adaptiveConfig.maxFileSize,
      incrementalIndexing: true, // Enable incremental indexing
      cacheTTL: 60000, // Cache metadata for 60 seconds
      parallelWorkers: this.adaptiveConfig.parallelWorkers,
      memoryLimit: this.adaptiveConfig.memoryLimit,
      useWorkers: this.adaptiveConfig.parallelWorkers > 1
    };

    this.server = http.createServer(this.handleRequest.bind(this));
    this.projectInfo = null;
    this.isRunning = false;
    this.indexedFiles = null; // Store indexed files in memory
    this.fileMetadataCache = new Map(); // Store file metadata for change detection
    this.lastIndexTime = null;
    this.searchCache = new Map(); // Simple LRU cache for search results
    this.maxCacheSize = this.adaptiveConfig.cacheSize;
    this.currentMemoryUsage = 0;
    this.fuzzySearch = new FuzzySearch();
    this.performanceMonitor = new PerformanceMonitor(this.config);
  }

  /**
   * Calculate adaptive configuration based on project size
   */
  calculateAdaptiveConfig(projectSize) {
    const cpuCount = require('os').cpus().length;
    const baseConfig = {
      maxFiles: 1000,
      maxFileSize: 1024 * 1024, // 1MB
      parallelWorkers: 1,
      memoryLimit: 100 * 1024 * 1024, // 100MB
      cacheSize: 50,
      // Large monorepo optimizations
      monorepoOptimization: false,
      prioritizeSrcFiles: true,
      largeFileThreshold: 1024 * 1024, // 1MB
      batchSize: 50
    };

    console.log(`[PRISM] Estimated project size: ${projectSize} files`);

    // Adjust configuration based on project size
    if (projectSize < 100) {
      // Small project
      return {
        ...baseConfig,
        maxFiles: 1000,
        cacheSize: 20,
        parallelWorkers: 1
      };
    } else if (projectSize < 1000) {
      // Medium project
      return {
        ...baseConfig,
        maxFiles: 5000,
        maxFileSize: 2 * 1024 * 1024, // 2MB
        parallelWorkers: Math.min(2, cpuCount),
        memoryLimit: 200 * 1024 * 1024, // 200MB
        cacheSize: 100,
        batchSize: 25
      };
    } else if (projectSize < 10000) {
      // Large project
      return {
        ...baseConfig,
        maxFiles: 10000,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        parallelWorkers: Math.min(4, cpuCount),
        memoryLimit: 500 * 1024 * 1024, // 500MB
        cacheSize: 200,
        batchSize: 20,
        prioritizeSrcFiles: true
      };
    } else if (projectSize < 50000) {
      // Very large project (monorepo scale)
      return {
        ...baseConfig,
        maxFiles: 30000,
        maxFileSize: 8 * 1024 * 1024, // 8MB
        parallelWorkers: Math.min(cpuCount, 8),
        memoryLimit: 1024 * 1024 * 1024, // 1GB
        cacheSize: 500,
        batchSize: 15,
        monorepoOptimization: true,
        prioritizeSrcFiles: true,
        largeFileThreshold: 2 * 1024 * 1024 // 2MB
      };
    } else {
      // Huge project (>50K files)
      return {
        ...baseConfig,
        maxFiles: 50000,
        maxFileSize: 15 * 1024 * 1024, // 15MB
        parallelWorkers: Math.min(cpuCount, 12),
        memoryLimit: 2048 * 1024 * 1024, // 2GB
        cacheSize: 1000,
        batchSize: 10,
        monorepoOptimization: true,
        prioritizeSrcFiles: true,
        largeFileThreshold: 5 * 1024 * 1024 // 5MB
      };
    }
  }

  /**
   * Estimate project size quickly
   */
  async estimateProjectSize(projectRoot) {
    let totalFiles = 0;
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.cache', 'venv', '__pycache__', 'vendor'];

    try {
      const entries = await fs.readdir(projectRoot, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Only count immediate subdirectories to speed up estimation
          if (!excludeDirs.includes(entry.name)) {
            try {
              const subFiles = await fs.readdir(path.join(projectRoot, entry.name));
              totalFiles += subFiles.length;

              // Early exit for very large projects
              if (totalFiles > 50000) break;
            } catch (error) {
              // Skip unreadable directories
            }
          }
        } else {
          totalFiles++;
        }

        // Early exit for very large projects
        if (totalFiles > 50000) break;
      }
    } catch (error) {
      // Return conservative estimate if we can't read the directory
      return 1000;
    }

    return totalFiles;
  }

  /**
   * Initialize the daemon
   */
  async initialize() {
    try {
      // Discover project and estimate size
      await this.discoverProject();

      // Set adaptive configuration based on project size
      const projectSize = await this.estimateProjectSize(this.projectRoot);
      this.adaptiveConfig = this.calculateAdaptiveConfig(projectSize);

      // Update config with adaptive values
      this.config.maxFiles = this.adaptiveConfig.maxFiles;
      this.config.maxFileSize = this.adaptiveConfig.maxFileSize;
      this.config.parallelWorkers = this.adaptiveConfig.parallelWorkers;
      this.config.memoryLimit = this.adaptiveConfig.memoryLimit;
      this.maxCacheSize = this.adaptiveConfig.cacheSize;

      console.log(`[PRISM] Project: ${this.projectInfo?.name || 'Unknown'} (${this.projectInfo?.language || 'unknown'})`);
      console.log(`[PRISM] Adaptive config: ${projectSize} files, max ${this.config.maxFiles} files, ${this.config.maxFileSize / 1024 / 1024}MB max file size`);
    } catch (error) {
      console.error('[PRISM] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Auto-discover project structure and type
   */
  async discoverProject() {
    try {
      const detector = new SimpleProjectDetector(this.config.projectRoot);
      this.projectInfo = await detector.detect();
    } catch (error) {
      this.projectInfo = {
        name: path.basename(this.config.projectRoot),
        language: 'unknown',
        type: 'generic'
      };
    }
  }

  /**
   * Handle HTTP requests with simple routing
   */
  handleRequest(req, res) {
    const { method, url } = req;

    // CORS headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (method === 'GET' && url === '/health') {
      this.sendHealthResponse(res);
    } else if (method === 'GET' && url === '/project') {
      this.sendProjectResponse(res);
    } else if (method === 'GET' && url === '/stats') {
      this.sendStatsResponse(res);
    } else if (method === 'GET' && url === '/performance') {
      this.sendPerformanceResponse(res);
    } else if (method === 'POST' && url === '/search') {
      this.handleSearch(req, res);
    } else if (method === 'POST' && url === '/index') {
      this.handleIndex(req, res);
    } else if (method === 'GET' && url === '/health') {
      this.sendHealthResponse(res);
    } else if (method === 'GET' && url === '/diagnostics') {
      this.sendDiagnosticsResponse(res);
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
  }

  /**
   * Send health check response
   */
  sendHealthResponse(res) {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      project: this.projectInfo?.name || 'Unknown',
      uptime: Math.floor(process.uptime())
    }));
  }

  /**
   * Send project info response
   */
  sendProjectResponse(res) {
    res.writeHead(200);
    res.end(JSON.stringify(this.projectInfo || {}));
  }

  /**
   * Handle search request with caching
   */
  handleSearch(req, res) {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        const { query } = JSON.parse(data);

        if (!query || query.length < 2) {
          res.writeHead(200);
          res.end(JSON.stringify({ results: [] }));
          return;
        }

        // Check cache first
        const cacheKey = query.toLowerCase();
        if (this.searchCache.has(cacheKey)) {
          const cachedResult = this.searchCache.get(cacheKey);
          res.writeHead(200);
          res.end(JSON.stringify({
            results: cachedResult.results,
            cached: true,
            timestamp: cachedResult.timestamp
          }));
          return;
        }

        // Perform search
        const searchStart = performance.now();
        const results = this.simpleSearch(query);
        const searchDuration = performance.now() - searchStart;

        // Record search metrics
        this.performanceMonitor.recordSearch(
          query,
          searchDuration,
          results.length,
          this.searchCache.has(cacheKey)
        );

        // Cache the result (LRU eviction)
        if (this.searchCache.size >= this.maxCacheSize) {
          const firstKey = this.searchCache.keys().next().value;
          this.searchCache.delete(firstKey);
        }

        this.searchCache.set(cacheKey, {
          results,
          timestamp: Date.now()
        });

        res.writeHead(200);
        res.end(JSON.stringify({ results }));

      } catch (error) {
        console.error('[PRISM] Search error:', error.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Invalid search request' }));
      }
    });
  }

  /**
   * Handle index request
   */
  async handleIndex(req, res) {
    try {
      // Check if already indexed recently (within last minute)
      if (this.indexedFiles && this.lastIndexTime &&
          (Date.now() - this.lastIndexTime) < 60000) {
        res.writeHead(200);
        res.end(JSON.stringify({
          message: 'Already indexed recently',
          files: Object.keys(this.indexedFiles).length
        }));
        return;
      }

      // Perform indexing
      const startTime = performance.now();
      const result = await this.indexProject();
      const duration = performance.now() - startTime;

      res.writeHead(200);
      res.end(JSON.stringify({
        message: 'Indexing completed',
        filesIndexed: result.filesCount,
        duration: `${duration}ms`,
        lastIndexed: new Date().toISOString()
      }));

    } catch (error) {
      console.error('[PRISM] Index error:', error.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Indexing failed' }));
    }
  }

  /**
   * Index project files with parallel processing
   */
  async indexProject() {
    try {
      const files = await this.scanProjectFiles();
      const indexedFiles = {};
      let filesCount = 0;
      let changedFiles = 0;
      let skippedFiles = 0;

      // Check if we have existing metadata cache
      const hasCache = this.fileMetadataCache.size > 0;

      console.log(`[PRISM] Starting parallel indexing - ${files.length} files found, ${this.config.parallelWorkers} workers`);

      // Separate files into batches for parallel processing
      const workerBatches = this.createWorkerBatches(files);
      const processor = new WorkerFileProcessor(this.config);

      // Process batches in parallel
      for (const batch of workerBatches) {
        if (batch.length === 0) continue;

        const batchResults = await this.processFileBatch(batch, processor);

        // Process results
        for (const result of batchResults) {
          if (result.fileData) {
            indexedFiles[result.filePath] = result.fileData;
            this.fileMetadataCache.set(result.filePath, this.getMetadataKey(result.filePath));
            filesCount++;
            changedFiles++;
          } else if (result.skipped) {
            // Keep existing data
            if (this.indexedFiles?.[result.filePath]) {
              indexedFiles[result.filePath] = this.indexedFiles[result.filePath];
              this.fileMetadataCache.set(result.filePath, this.getMetadataKey(result.filePath));
            }
            skippedFiles++;
          }
        }

        // Respect max files limit
        if (filesCount >= this.config.maxFiles) {
          console.log(`[PRISM] Reached max files limit (${this.config.maxFiles})`);
          break;
        }

        // Reset memory between batches
        processor.resetMemory();
      }

      this.indexedFiles = indexedFiles;
      this.lastIndexTime = Date.now();

      // Clean up metadata cache for files that no longer exist
      this.cleanupMetadataCache(files);

      console.log(`[PRISM] Indexing completed - ${changedFiles} changed, ${skippedFiles} unchanged, ${filesCount} total`);

      return {
        filesCount: Object.keys(indexedFiles).length,
        changedFiles,
        skippedFiles,
        cacheSize: this.fileMetadataCache.size
      };

    } catch (error) {
      console.error('[PRISM] Indexing failed:', error.message);
      throw error;
    }
  }

  /**
   * Create worker batches for parallel processing with optimization for large projects
   */
  createWorkerBatches(files) {
    const batchSize = this.config.batchSize;
    const batches = [];

    // For very large projects, create smaller batches to prevent memory issues
    if (files.length > 10000 && this.config.monorepoOptimization) {
      console.log(`[PRISM] Using optimized batch size of ${batchSize} for ${files.length} files`);
    }

    // Create batches based on the configured size
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + Math.min(batchSize, files.length - i));
      batches.push(batch);
    }

    // Balance batch sizes for better worker utilization
    if (batches.length > 1 && batches.length <= this.config.parallelWorkers * 2) {
      // Rebalance batches to be more evenly sized
      const totalFiles = files.length;
      const targetBatchSize = Math.ceil(totalFiles / this.config.parallelWorkers);
      const rebalancedBatches = [];

      let currentBatch = [];
      let currentSize = 0;

      for (const batch of batches) {
        for (const file of batch) {
          currentBatch.push(file);
          currentSize++;

          if (currentSize >= targetBatchSize) {
            rebalancedBatches.push(currentBatch);
            currentBatch = [];
            currentSize = 0;
          }
        }
      }

      // Add remaining files
      if (currentBatch.length > 0) {
        rebalancedBatches.push(currentBatch);
      }

      return rebalancedBatches;
    }

    return batches;
  }

  /**
   * Process a batch of files with worker thread
   */
  async processFileBatch(batch, processor) {
    if (!this.config.useWorkers || batch.length < 3) {
      // Sequential processing for small batches or when workers disabled
      return await this.processBatchSequentially(batch);
    }

    return await this.processBatchWithWorker(batch, processor);
  }

  /**
   * Process batch sequentially (fallback)
   */
  async processBatchSequentially(batch) {
    const results = [];

    for (const filePath of batch) {
      try {
        const needsReindex = await this.fileNeedsReindex(filePath);

        if (!needsReindex && this.indexedFiles?.[filePath]) {
          results.push({ filePath, fileData: null, skipped: true });
          continue;
        }

        const fileData = await this.indexFile(filePath);
        results.push({ filePath, fileData, skipped: false });
      } catch (error) {
        console.log(`[PRISM] Skipped file ${filePath}:`, error.message);
        results.push({ filePath, fileData: null, skipped: true });
      }
    }

    return results;
  }

  /**
   * Process batch with worker thread for parallel execution
   */
  async processBatchWithWorker(batch, processor) {
    return new Promise((resolve, reject) => {
      const worker = new Worker('./daemon/worker-processor.js', {
        workerData: {
          batch,
          config: this.config,
          fileMetadataCache: Array.from(this.fileMetadataCache.entries())
        }
      });

      worker.on('message', (result) => {
        resolve(result);
      });

      worker.on('error', (error) => {
        console.error('[PRISM] Worker error:', error.message);
        // Fallback to sequential processing
        this.processBatchSequentially(batch).then(resolve).catch(reject);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`[PRISM] Worker stopped with exit code ${code}`);
          // Fallback to sequential processing
          this.processBatchSequentially(batch).then(resolve).catch(reject);
        }
      });
    });
  }

  /**
   * Check if a file needs reindexing
   */
  async fileNeedsReindex(filePath) {
    if (!this.config.incrementalIndexing) {
      return true; // Always reindex if incremental indexing is disabled
    }

    try {
      const stats = await fs.stat(filePath);
      const currentKey = this.getMetadataKey(filePath);
      const cachedKey = this.fileMetadataCache.get(filePath);

      // If not in cache or different, needs reindexing
      if (!cachedKey || cachedKey !== currentKey) {
        return true;
      }

      // Check if file was modified since last index
      if (this.indexedFiles?.[filePath]?.mtime) {
        const lastIndexed = new Date(this.indexedFiles[filePath].mtime);
        const fileModified = new Date(stats.mtime);

        return fileModified > lastIndexed;
      }

      return true;

    } catch (error) {
      // If we can't stat the file, assume it needs reindexing
      return true;
    }
  }

  /**
   * Get metadata key for change detection
   */
  async getMetadataKey(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const simpleHash = this.simpleHash(content);

      return `${stats.mtime.getTime()}_${stats.size}_${simpleHash}`;
    } catch (error) {
      return null;
    }
  }

  /**
   * Simplified metadata key for performance
   */
  getSimpleMetadataKey(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return `${stats.mtime.getTime()}_${stats.size}`;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cleanup metadata cache for files that no longer exist
   */
  cleanupMetadataCache(existingFiles) {
    const existingFileSet = new Set(existingFiles);
    const staleFiles = [];

    for (const filePath of this.fileMetadataCache.keys()) {
      if (!existingFileSet.has(filePath)) {
        staleFiles.push(filePath);
      }
    }

    for (const filePath of staleFiles) {
      this.fileMetadataCache.delete(filePath);
      if (this.indexedFiles?.[filePath]) {
        delete this.indexedFiles[filePath];
      }
    }

    if (staleFiles.length > 0) {
      console.log(`[PRISM] Cleaned up ${staleFiles.length} stale files from cache`);
    }
  }

  /**
   * Scan project for files to index with monorepo optimizations
   */
  async scanProjectFiles() {
    const files = [];
    const excludeDirs = [
      'node_modules', '.git', 'dist', 'build', '.cache', 'venv', '__pycache__',
      '.next', '.nuxt', '.out', '.tsc', 'coverage', 'e2e', 'test-results'
    ];

    // Large monorepo patterns to exclude
    const largeExcludePatterns = [
      '/vendor/',
      '/bower_components/',
      '/.yarn/',
      '/node_modules/.cache/',
      '/build-artifacts/',
      '/dist-newlib/',
      '/dist-gcc/',
      '/.gradle/',
      '/target/',
      '/venv/',
      '/env/',
      '/site-packages/'
    ];

    async function scanDir(dir, depth = 0) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        // For very large directories, limit scanning depth
        if (depth > 10) return;

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip excluded directories
          if (entry.isDirectory()) {
            // Check if this should be excluded for large monorepos
            if (this.config.monorepoOptimization) {
              const relativePath = path.relative(this.config.projectRoot, fullPath);

              // Skip vendor directories in monorepos
              if (largeExcludePatterns.some(pattern => relativePath.includes(pattern))) {
                continue;
              }

              // Skip non-essential directories in very large projects
              if (this.config.maxFiles > 10000) {
                if (['docs', 'examples', 'samples', 'benchmarks', 'fixtures'].includes(entry.name)) {
                  // Only scan top-level directories with these names
                  if (depth === 0) {
                    await scanDir.call(this, fullPath, depth + 1);
                  }
                  continue;
                }
              }
            }

            if (!excludeDirs.includes(entry.name)) {
              await scanDir.call(this, fullPath, depth + 1);
            }
            continue;
          }

          // Check file extension
          const ext = path.extname(entry.name).toLowerCase();
          const supportedExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.cs', '.php', '.rb', '.md', '.txt', '.json', '.yaml', '.yml'];

          if (supportedExts.includes(ext)) {
            // Check file size
            try {
              const stats = await fs.stat(fullPath);

              // Monorepo file size optimization
              if (stats.size > this.config.maxFileSize) {
                console.log(`[PRISM] Skipping large file: ${fullPath} (${stats.size / 1024 / 1024}MB)`);
                continue;
              }

              // Prioritize src/lib directories
              if (this.config.prioritizeSrcFiles) {
                const relativePath = path.relative(this.config.projectRoot, fullPath);
                const srcPriority = relativePath.includes('/src/') || relativePath.includes('/lib/');
                const testFile = relativePath.includes('/test/') || relativePath.includes('/tests/');

                if (testFile && this.config.maxFiles > 10000) {
                  // De-prioritize test files in large projects
                  continue;
                }

                if (srcPriority) {
                  files.unshift(fullPath); // Add to beginning for priority processing
                } else {
                  files.push(fullPath);
                }
              } else {
                files.push(fullPath);
              }

            } catch (error) {
              // Skip if we can't stat the file
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    await scanDir.call(this, this.config.projectRoot);
    return files;
  }

  /**
   * Index a single file with memory management
   */
  async indexFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      // Check memory constraints
      if (this.currentMemoryUsage + fileSize > this.config.memoryLimit) {
        console.log(`[PRISM] Skipping ${filePath} - memory limit would be exceeded`);
        return null;
      }

      // Use regular file reading for now (streaming to be implemented later)
      let content;
      try {
        content = await fs.readFile(filePath, 'utf8');
      } catch (error) {
        console.log(`[PRISM] Error reading file ${filePath}:`, error.message);
        return null;
      }

      // Update memory usage
      this.currentMemoryUsage += fileSize;

      return {
        content: content,
        size: fileSize,
        mtime: stats.mtime.getTime(),
        hash: this.simpleHash(content),
        memoryUsage: fileSize
      };

    } catch (error) {
      console.log(`[PRISM] Error indexing file ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Stream read large files with proper error handling
   */
  async streamReadFile(filePath, maxSize) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let totalLength = 0;

      try {
        const stream = fs.createReadStream(filePath, { encoding: 'utf8' });

        stream.on('data', (chunk) => {
          totalLength += chunk.length;

          // Respect max file size
          if (totalLength > maxSize) {
            stream.destroy();
            reject(new Error(`File too large: ${filePath}`));
            return;
          }

          chunks.push(chunk);
        });

        stream.on('end', () => {
          resolve(chunks.join(''));
        });

        stream.on('error', (error) => {
          reject(error);
        });

        // Handle timeout
        const timeout = setTimeout(() => {
          if (!stream.destroyed) {
            stream.destroy();
            reject(new Error(`File read timeout: ${filePath}`));
          }
        }, 5000);

        stream.on('close', () => {
          clearTimeout(timeout);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Cleanup memory after indexing
   */
  cleanupMemory() {
    this.currentMemoryUsage = 0;
    console.log(`[PRISM] Memory usage reset for next indexing operation`);
  }

  /**
   * Simple hash function for content
   */
  simpleHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Send performance response
   */
  sendPerformanceResponse(res) {
    const report = this.performanceMonitor.getReport();

    res.writeHead(200);
    res.end(JSON.stringify(report, null, 2));
  }

  /**
   * Send diagnostics response
   */
  sendDiagnosticsResponse(res) {
    const diagnostics = this.performanceMonitor.getDiagnostics();

    res.writeHead(200);
    res.end(JSON.stringify(diagnostics, null, 2));
  }

  /**
   * Send statistics response
   */
  sendStatsResponse(res) {
    const stats = {
      project: this.projectInfo?.name || 'Unknown',
      indexedFiles: this.indexedFiles ? Object.keys(this.indexedFiles).length : 0,
      lastIndexed: this.lastIndexTime ? new Date(this.lastIndexTime).toISOString() : null,
      searchCacheSize: this.searchCache.size,
      uptime: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage()
    };

    res.writeHead(200);
    res.end(JSON.stringify(stats));
  }

  /**
   * Enhanced search implementation with fuzzy matching
   */
  simpleSearch(query) {
    if (!query || query.length < 2) {
      return [];
    }

    // Use advanced fuzzy search with smart defaults
    if (!this.indexedFiles) {
      return [];
    }

    return this.fuzzySearch.advancedSearch(query, this.indexedFiles, {
      threshold: 0.2, // Lower threshold for better matches
      maxResults: 10,
      fuzzy: true,
      stem: true
    });
  }

  /**
   * Enhanced filename matching with better scoring
   */
  scoreFilenameMatch(query, filePath, queryWords) {
    let score = 0;
    const fileName = path.basename(filePath).toLowerCase();
    const dirName = path.dirname(filePath).toLowerCase();

    // Exact filename match gets highest score
    if (fileName === query.toLowerCase()) {
      score += 0.5;
    }

    // Partial filename match
    for (const word of queryWords) {
      if (fileName.includes(word)) {
        score += 0.2;
        // Bonus for word boundary match (less partial matches)
        if (fileName.split(/\s+/).some(fileWord => fileWord === word)) {
          score += 0.1;
        }
      }
    }

    // Directory name matching (lower weight)
    for (const word of queryWords) {
      if (dirName.includes(word)) {
        score += 0.05;
      }
    }

    return Math.min(score, 0.5); // Cap filename scoring at 0.5
  }

  /**
   * Enhanced content matching with word frequency
   */
  scoreContentMatch(query, content, queryWords) {
    const contentLower = content.toLowerCase();
    const contentWords = contentLower.split(/\s+/);
    let score = 0;

    // Word frequency analysis
    for (const queryWord of queryWords) {
      let matches = 0;

      for (const contentWord of contentWords) {
        if (contentWord.includes(queryWord)) {
          matches++;

          // Bonus for exact word match
          if (contentWord === queryWord) {
            score += 0.02;
          }
        }
      }

      // Score based on frequency but with diminishing returns
      const frequencyScore = Math.log(matches + 1) * 0.1;
      score += frequencyScore;
    }

    // Bonus for multiple query words found
    const uniqueWordsFound = new Set();
    for (const queryWord of queryWords) {
      if (contentLower.includes(queryWord)) {
        uniqueWordsFound.add(queryWord);
      }
    }

    const coverage = uniqueWordsFound.size / queryWords.length;
    score += coverage * 0.2; // Bonus for finding multiple query words

    return Math.min(score, 0.7); // Cap content scoring at 0.7
  }

  /**
   * Get content snippet with first match
   */
  getContentSnippet(content, queryWords) {
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      for (const queryWord of queryWords) {
        if (line.includes(queryWord)) {
          return {
            snippet: lines[i].trim(),
            line: i + 1
          };
        }
      }
    }

    return { snippet: '', line: 1 };
  }

  /**
   * Contextual scoring based on project structure
   */
  scoreContext(filePath) {
    let score = 0;
    const lowerPath = filePath.toLowerCase();

    // Prefer source code files over documentation
    if (lowerPath.includes('/src/') || lowerPath.includes('/lib/')) {
      score += 0.1;
    }

    // Prefer documentation slightly for help queries
    if (lowerPath.includes('/docs/') || filePath.endsWith('.md')) {
      score += 0.05;
    }

    // Penalize test files unless query includes "test"
    if (lowerPath.includes('/test/') || lowerPath.includes('/tests/')) {
      score -= 0.05;
    }

    // Prefer files closer to project root
    const pathDepth = filePath.split(path.sep).length;
    const depthBonus = Math.max(0, 0.1 - (pathDepth - 3) * 0.02);
    score += depthBonus;

    return Math.max(0, score); // Ensure no negative scores
  }

  /**
   * Start the server
   */
  async start() {
    if (this.isRunning) {
      console.log('[PRISM] Already running');
      return;
    }

    try {
      await this.initialize();

      // Start performance monitoring
      this.performanceMonitor.start();

      this.server.listen(this.config.port, () => {
        console.log(`[PRISM] Server running on http://localhost:${this.config.port}`);
        console.log(`[PRISM] Health check: http://localhost:${this.config.port}/health`);
        console.log(`[PRISM] Performance monitoring enabled`);
        this.isRunning = true;
      });

    } catch (error) {
      console.error('[PRISM] Failed to start:', error.message);
      process.exit(1);
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    // Clear search cache
    this.searchCache.clear();
    this.indexedFiles = null;
    this.lastIndexTime = null;

    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('[PRISM] Server stopped');
        this.isRunning = false;
        resolve();
      });
    });
  }
}

// Handle graceful shutdown (only if daemon is defined)
if (typeof daemon !== 'undefined') {
  process.on('SIGTERM', async () => {
    console.log('[PRISM] Shutting down...');
    await daemon.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[PRISM] Shutting down...');
    await daemon.stop();
    process.exit(0);
  });
}

module.exports = PrismDaemon;

// Only start daemon if run directly
if (require.main === module) {
  // Start the server
  const daemon = new PrismDaemon();
  daemon.start().catch(() => process.exit(1));
}