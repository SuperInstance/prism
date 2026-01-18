#!/usr/bin/env node

/**
 * PRISM Simple Daemon
 * Provides basic project memory for Claude Code
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const SimpleProjectDetector = require('./simple-project-detector');
const FileIndexer = require('./file-indexer');
const FileWatcher = require('./file-watcher');

class PrismDaemon {
  constructor() {
    // Validate and parse port
    const portEnv = parseInt(process.env.PORT, 10);
    const port = (portEnv && !isNaN(portEnv) && portEnv >= 1024 && portEnv <= 65535) ? portEnv : 8080;

    this.config = {
      port,
      projectRoot: process.env.PROJECT_ROOT || process.cwd(),
      logLevel: process.env.LOG_LEVEL || 'info',
      enableWatcher: process.env.ENABLE_WATCHER !== 'false', // Default: enabled
      gracefulShutdownTimeout: parseInt(process.env.SHUTDOWN_TIMEOUT, 10) || 5000
    };

    this.server = http.createServer(this.handleRequest.bind(this));
    this.projectInfo = null;
    this.isRunning = false;

    // Metrics tracking
    this.metrics = {
      requests: {
        total: 0,
        search: 0,
        index: 0,
        tools: 0
      },
      errors: 0,
      lastIndexTime: null,
      startTime: Date.now()
    };

    // Initialize file indexer
    this.indexer = new FileIndexer(
      this.config.projectRoot,
      path.join(this.config.projectRoot, '.prism')
    );
    this.indexLoaded = false;

    // Initialize file watcher
    this.watcher = null;
    if (this.config.enableWatcher) {
      this.watcher = new FileWatcher(this.config.projectRoot);
      this.setupWatcherHandlers();
    }
  }

  /**
   * Setup file watcher event handlers
   */
  setupWatcherHandlers() {
    if (!this.watcher) return;

    this.watcher.on('fileChanged', async ({ fullPath }) => {
      try {
        await this.indexer.updateFile(fullPath);
        console.log('[PRISM] Index updated after file change');
      } catch (error) {
        console.error('[PRISM] Failed to update index after file change:', error.message);
      }
    });

    this.watcher.on('fileCreated', async ({ fullPath }) => {
      try {
        await this.indexer.updateFile(fullPath);
        console.log('[PRISM] Index updated after file creation');
      } catch (error) {
        console.error('[PRISM] Failed to update index after file creation:', error.message);
      }
    });

    this.watcher.on('fileDeleted', async ({ fullPath }) => {
      try {
        await this.indexer.removeFile(fullPath);
        console.log('[PRISM] Index updated after file deletion');
      } catch (error) {
        console.error('[PRISM] Failed to update index after file deletion:', error.message);
      }
    });
  }

  /**
   * Initialize the daemon
   */
  async initialize() {
    try {
      // Discover project and estimate size
      await this.discoverProject();

      // Load or create index
      const existingIndex = await this.indexer.loadIndex();
      if (existingIndex) {
        this.indexer.loadedIndex = existingIndex;
        this.indexLoaded = true;
        console.log(`[PRISM] Loaded index with ${existingIndex.file_count} files`);
      } else {
        console.log('[PRISM] No index found, indexing project...');
        await this.indexer.indexProject();
        this.indexer.loadedIndex = await this.indexer.loadIndex();
        this.indexLoaded = true;
      }

      // Start file watcher
      if (this.watcher && this.config.enableWatcher) {
        await this.watcher.start();
        console.log('[PRISM] File watcher enabled');
      }

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

    // CORS headers - restrict to localhost only for security
    res.setHeader('Content-Type', 'application/json');
    const origin = req.headers.origin;
    if (origin && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (method === 'GET' && url === '/health') {
      this.sendHealthResponse(res);
    } else if (method === 'GET' && url === '/ready') {
      this.sendReadinessResponse(res);
    } else if (method === 'GET' && url === '/metrics') {
      this.sendMetricsResponse(res);
    } else if (method === 'GET' && url === '/project') {
      this.sendProjectResponse(res);
    } else if (method === 'GET' && url === '/stats') {
      this.sendStatsResponse(res);
    } else if (method === 'GET' && url === '/performance') {
      this.sendPerformanceResponse(res);
    } else if (method === 'POST' && url === '/search') {
      this.handleSearch(req, res);
    } else if (method === 'POST' && url === '/index') {
      this.handleReindex(req, res);
    } else if (method === 'GET' && url === '/watcher/status') {
      this.handleWatcherStatus(res);
    } else if (method === 'POST' && url === '/watcher/enable') {
      this.handleWatcherEnable(res);
    } else if (method === 'POST' && url === '/watcher/disable') {
      this.handleWatcherDisable(res);
    } else if (method === 'GET' && url === '/tools/list') {
      this.handleToolsList(res);
    } else if (method === 'POST' && url === '/tools/call') {
      this.handleToolsCall(req, res);
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
  }

  /**
   * Send liveness check response (is the process alive?)
   */
  sendHealthResponse(res) {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime())
    }));
  }

  /**
   * Send readiness check response (is the service ready to handle requests?)
   */
  sendReadinessResponse(res) {
    const isReady = this.indexLoaded && this.projectInfo !== null;
    const watcherStatus = this.watcher ? (this.watcher.isWatching ? 'active' : 'inactive') : 'disabled';

    if (isReady) {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ready',
        index_loaded: this.indexLoaded,
        project: this.projectInfo?.name || 'Unknown',
        watcher_status: watcherStatus,
        file_count: this.indexer.loadedIndex?.file_count || 0,
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(503);
      res.end(JSON.stringify({
        status: 'not_ready',
        index_loaded: this.indexLoaded,
        watcher_status: watcherStatus,
        message: 'Service is still initializing',
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Send metrics response for monitoring
   */
  sendMetricsResponse(res) {
    const uptime = Math.floor((Date.now() - this.metrics.startTime) / 1000);
    const watcherStats = this.watcher ? this.watcher.getStats() : null;

    res.writeHead(200);
    res.end(JSON.stringify({
      uptime_seconds: uptime,
      requests: {
        total: this.metrics.requests.total,
        search: this.metrics.requests.search,
        index: this.metrics.requests.index,
        tools: this.metrics.requests.tools,
        requests_per_second: (this.metrics.requests.total / uptime).toFixed(2)
      },
      errors: this.metrics.errors,
      index: {
        file_count: this.indexer.loadedIndex?.file_count || 0,
        loaded: this.indexLoaded,
        last_index_time: this.metrics.lastIndexTime
      },
      watcher: watcherStats,
      memory: {
        rss_mb: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
        heap_used_mb: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
        heap_total_mb: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)
      },
      timestamp: new Date().toISOString()
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
    const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB limit
    let data = '';
    let bytesReceived = 0;

    req.on('data', chunk => {
      bytesReceived += chunk.length;

      // Check if request exceeds size limit
      if (bytesReceived > MAX_REQUEST_SIZE) {
        req.destroy();
        res.writeHead(413);
        res.end(JSON.stringify({
          error: 'Request too large',
          message: `Request size exceeds ${MAX_REQUEST_SIZE} bytes limit`
        }));
        return;
      }

      data += chunk;
    });

    req.on('end', () => {
      try {
        let requestBody;
        try {
          requestBody = JSON.parse(data);
        } catch (parseError) {
          res.writeHead(400);
          res.end(JSON.stringify({
            error: 'Invalid JSON',
            message: 'Request body must be valid JSON'
          }));
          return;
        }

        const searchQuery = requestBody.query || '';

        // Validate query length
        if (searchQuery.length > 10000) {
          res.writeHead(400);
          res.end(JSON.stringify({
            error: 'Query too long',
            message: 'Search query must be less than 10000 characters'
          }));
          return;
        }

        const results = this.simpleSearch(searchQuery);

        // Track metrics
        this.metrics.requests.total++;
        this.metrics.requests.search++;

        res.writeHead(200);
        res.end(JSON.stringify({ results }));

      } catch (error) {
        console.error('[PRISM] Search error:', error);

        // Track error
        this.metrics.errors++;

        res.writeHead(500);
        res.end(JSON.stringify({
          error: 'Internal server error',
          message: 'An error occurred while processing search request'
        }));
      }
    });

    req.on('error', (error) => {
      console.error('[PRISM] Request error:', error);
      res.writeHead(400);
      res.end(JSON.stringify({
        error: 'Bad request',
        message: 'Request connection error'
      }));
    });
  }

  /**
   * Handle index request with progress indicators
   */
  async handleIndex(req, res) {
    try {
      // Check if already indexed recently (within last minute)
      if (this.indexedFiles && this.lastIndexTime &&
          (Date.now() - this.lastIndexTime) < 60000) {
        res.writeHead(200);
        res.end(JSON.stringify({
          message: 'Already indexed recently',
          files: Object.keys(this.indexedFiles).length,
          cached: true
        }));
        return;
      }

      // Perform indexing with progress tracking
      const startTime = performance.now();
      const progressCallback = (progress) => {
        // Send progress updates via WebSocket-like mechanism (for future enhancement)
        console.log(`[PRISM Indexing Progress] ${progress.percentage}% - ${progress.current}/${progress.total} files`);
      };

      const result = await this.indexProjectWithProgress(progressCallback);
      const duration = performance.now() - startTime;

      res.writeHead(200);
      res.end(JSON.stringify({
        message: 'Indexing completed',
        filesIndexed: result.filesCount,
        changedFiles: result.changedFiles,
        skippedFiles: result.skippedFiles,
        duration: `${duration.toFixed(2)}ms`,
        throughput: `${(result.filesCount / (duration / 1000)).toFixed(1)} files/sec`,
        lastIndexed: new Date().toISOString(),
        cacheSize: this.fileMetadataCache.size
      }));

    } catch (error) {
      console.error('[PRISM] Index error:', error.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Indexing failed', details: error.message }));
    }
  }

  /**
   * Index project files with parallel processing
   */
  async indexProject() {
    try {
      const files = await this.scanProjectFiles();
      const startTime = performance.now();

      // v0.6: Use delta indexing for incremental updates
      const changes = await this.deltaIndexManager.computeDelta(files);

      // Check if we should use delta indexing
      const useDelta = this.deltaIndexManager.shouldUseDelta(changes);

      if (useDelta) {
        console.log(`[PRISM] Using delta indexing - ${changes.stats.changedFiles} changed files (${(changes.stats.changePercentage * 100).toFixed(1)}%)`);

        // Apply delta to current index
        if (this.indexedFiles) {
          const deltaResult = await this.deltaIndexManager.applyDelta(changes, this.indexedFiles);
          this.indexedFiles = deltaResult.newIndex;

          // Track search access for cleanup
          Object.keys(this.indexedFiles).forEach(filePath => {
            this.cleanupManager.trackAccess(filePath);
          });

          const processingTime = performance.now() - startTime;
          console.log(`[PRISM] Delta indexing completed in ${processingTime.toFixed(2)}ms`);

          return {
            filesCount: Object.keys(this.indexedFiles).length,
            changedFiles: changes.stats.changedFiles,
            skippedFiles: changes.unchanged.length,
            cacheSize: this.fileMetadataCache.size,
            processingTime,
            isDelta: true,
            changePercentage: changes.stats.changePercentage * 100
          };
        }
      }

      // Fall back to full indexing if no delta available or too many changes
      console.log(`[PRISM] Using full indexing - ${files.length} files found, ${this.config.parallelWorkers} workers`);

      const indexedFiles = {};
      let filesCount = 0;
      let changedFiles = 0;
      let skippedFiles = 0;

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

      // Track search access for cleanup
      Object.keys(this.indexedFiles).forEach(filePath => {
        this.cleanupManager.trackAccess(filePath);
      });

      const processingTime = performance.now() - startTime;
      console.log(`[PRISM] Full indexing completed - ${changedFiles} changed, ${skippedFiles} unchanged, ${filesCount} total in ${processingTime.toFixed(2)}ms`);

      return {
        filesCount: Object.keys(indexedFiles).length,
        changedFiles,
        skippedFiles,
        cacheSize: this.fileMetadataCache.size,
        processingTime,
        isDelta: false
      };

    } catch (error) {
      console.error('[PRISM] Indexing failed:', error.message);
      throw error;
    }
  }

  /**
   * Index project files with progress tracking
   */
  async indexProjectWithProgress(progressCallback) {
    const files = await this.scanProjectFiles();
    const indexedFiles = {};
    let filesCount = 0;
    let changedFiles = 0;
    let skippedFiles = 0;

    console.log(`[PRISM] Starting parallel indexing with progress - ${files.length} files found, ${this.config.parallelWorkers} workers`);

    // Report initial progress
    this.reportProgress(progressCallback, 0, files.length, 'Scanning files...');

    // Separate files into batches for parallel processing
    const workerBatches = this.createWorkerBatches(files);
    const processor = new WorkerFileProcessor(this.config);

    // Process batches with progress tracking
    const totalBatches = workerBatches.length;
    let completedBatches = 0;

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

      completedBatches++;
      const overallProgress = Math.round((completedBatches / totalBatches) * 100);
      const fileProgress = Math.round((filesCount / files.length) * 100);

      // Report progress
      this.reportProgress(progressCallback, fileProgress, files.length,
        `Processing batch ${completedBatches}/${totalBatches} (${filesCount} files processed)`);

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

    // Report completion
    this.reportProgress(progressCallback, 100, files.length,
      `Indexing completed - ${changedFiles} changed, ${skippedFiles} unchanged, ${filesCount} total`);

    console.log(`[PRISM] Indexing completed - ${changedFiles} changed, ${skippedFiles} unchanged, ${filesCount} total`);

    return {
      filesCount: Object.keys(indexedFiles).length,
      changedFiles,
      skippedFiles,
      cacheSize: this.fileMetadataCache.size
    };
  }

  /**
   * Report progress to callback
   */
  reportProgress(progressCallback, percentage, current, message) {
    if (progressCallback) {
      progressCallback({
        percentage: Math.min(percentage, 100),
        current,
        total: current + (100 - percentage), // Estimated total
        message,
        timestamp: Date.now()
      });
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
   * Send cache response
   */
  sendCacheResponse(res) {
    const cacheInfo = {
      status: this.searchCache.getHealthStatus(),
      stats: this.searchCache.getStats(),
      insights: this.searchCache.getInsights(),
      size: this.searchCache.cache.size
    };

    res.writeHead(200);
    res.end(JSON.stringify(cacheInfo, null, 2));
  }

  /**
   * Handle cache clear request
   */
  handleCacheClear(req, res) {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        const options = JSON.parse(data) || {};
        this.searchCache.clear(options);

        res.writeHead(200);
        res.end(JSON.stringify({
          message: 'Cache cleared successfully',
          remainingEntries: this.searchCache.cache.size,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('[PRISM] Cache clear error:', error.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to clear cache' }));
      }
    });
  }

  /**
   * Send cache statistics response
   */
  sendCacheStatsResponse(res) {
    const stats = {
      search: this.searchCache.getStats(),
      performance: this.performanceMonitor.getReport(),
      insights: this.searchCache.getInsights()
    };

    res.writeHead(200);
    res.end(JSON.stringify(stats, null, 2));
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
   * Send fragmentation analysis response
   */
  sendFragmentationResponse(res) {
    const fragmentation = this.fragmentAnalyzer.analyzeFragmentation(this.indexedFiles);
    const healthReport = this.fragmentAnalyzer.getHealthReport(this.indexedFiles);
    const trends = this.fragmentAnalyzer.getFragmentationTrends();

    res.writeHead(200);
    res.end(JSON.stringify({
      fragmented: fragmentation.fragmented,
      analysis: fragmentation.analysis,
      healthReport,
      trends,
      recommendations: fragmentation.analysis.recommendations
    }, null, 2));
  }

  /**
   * Handle index optimization request
   */
  handleOptimize(req, res) {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', async () => {
      try {
        const { strategy = 'auto' } = JSON.parse(data) || {};

        const optimization = await this.optimizeIndex(strategy);

        res.writeHead(200);
        res.end(JSON.stringify({
          message: 'Index optimization completed',
          optimization,
          timestamp: Date.now()
        }, null, 2));
      } catch (error) {
        console.error('[PRISM] Optimization error:', error.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to optimize index' }));
      }
    });
  }

  /**
   * Send cleanup statistics response
   */
  sendCleanupResponse(res) {
    const cleanupStats = this.cleanupManager.getCleanupStats();
    const memoryPressure = this.cleanupManager.getMemoryPressure();

    res.writeHead(200);
    res.end(JSON.stringify({
      cleanup: cleanupStats,
      memory: memoryPressure,
      timestamp: Date.now()
    }, null, 2));
  }

  /**
   * Handle force cleanup request
   */
  async handleForceCleanup(req, res) {
    try {
      const result = await this.cleanupManager.forceCleanup();

      res.writeHead(200);
      res.end(JSON.stringify({
        message: 'Force cleanup completed',
        result,
        timestamp: Date.now()
      }, null, 2));
    } catch (error) {
      console.error('[PRISM] Force cleanup error:', error.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to perform force cleanup' }));
    }
  }

  /**
   * Send delta statistics response
   */
  sendDeltaStatsResponse(res) {
    const deltaStats = this.deltaIndexManager.getChangeStatistics();
    const recommendations = this.deltaIndexManager.optimizeDeltaStrategy();

    res.writeHead(200);
    res.end(JSON.stringify({
      statistics: deltaStats,
      recommendations,
      history: this.deltaIndexManager.getChangeHistory(),
      timestamp: Date.now()
    }, null, 2));
  }

  /**
   * Enhanced search implementation with fuzzy matching
   */
  simpleSearch(query) {
    if (!this.indexLoaded) {
      return [{
        file: 'ERROR',
        content: 'Index not loaded. Please wait for indexing to complete.',
        score: 0,
        line: 1
      }];
    }

    return this.indexer.searchIndex(query);
  }

  /**
   * Handle reindex request
   */
  handleReindex(req, res) {
    // Track metrics
    this.metrics.requests.total++;
    this.metrics.requests.index++;

    res.writeHead(202);
    res.end(JSON.stringify({
      status: 'indexing',
      message: 'Reindexing started in background'
    }));

    // Index in background
    const startTime = Date.now();
    this.indexer.indexProject()
      .then(async () => {
        this.indexer.loadedIndex = await this.indexer.loadIndex();
        this.indexLoaded = true;
        this.metrics.lastIndexTime = new Date().toISOString();
        const duration = Date.now() - startTime;
        console.log(`[PRISM] Reindexing complete in ${duration}ms`);
      })
      .catch(error => {
        console.error('[PRISM] Reindexing failed:', error);
        this.metrics.errors++;
      });
  }

  /**
   * Handle watcher status request
   */
  handleWatcherStatus(res) {
    if (!this.watcher) {
      res.writeHead(200);
      res.end(JSON.stringify({
        enabled: false,
        message: 'File watcher is not configured'
      }));
      return;
    }

    const stats = this.watcher.getStats();
    res.writeHead(200);
    res.end(JSON.stringify({
      enabled: true,
      ...stats
    }));
  }

  /**
   * Handle watcher enable request
   */
  async handleWatcherEnable(res) {
    if (!this.watcher) {
      res.writeHead(400);
      res.end(JSON.stringify({
        error: 'File watcher not configured'
      }));
      return;
    }

    try {
      if (this.watcher.isWatching) {
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'already_enabled',
          message: 'File watcher is already running'
        }));
        return;
      }

      await this.watcher.start();
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'enabled',
        message: 'File watcher started'
      }));
    } catch (error) {
      console.error('[PRISM] Failed to enable watcher:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        error: 'Failed to start file watcher',
        message: error.message
      }));
    }
  }

  /**
   * Handle watcher disable request
   */
  handleWatcherDisable(res) {
    if (!this.watcher) {
      res.writeHead(400);
      res.end(JSON.stringify({
        error: 'File watcher not configured'
      }));
      return;
    }

    if (!this.watcher.isWatching) {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'already_disabled',
        message: 'File watcher is not running'
      }));
      return;
    }

    this.watcher.stop();
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'disabled',
      message: 'File watcher stopped'
    }));
  }

  /**
   * Handle MCP tools/list request
   * Returns list of available tools following MCP protocol
   */
  handleToolsList(res) {
    const tools = [
      {
        name: 'search_repo',
        description: 'Search the indexed codebase for relevant code chunks',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query (keywords or natural language)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 10
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_file',
        description: 'Retrieve the full contents of a specific file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path to the file'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'list_files',
        description: 'List all indexed files in the project',
        inputSchema: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              description: 'Filter by programming language (optional)'
            }
          }
        }
      }
    ];

    res.writeHead(200);
    res.end(JSON.stringify({ tools }));
  }

  /**
   * Handle MCP tools/call request
   * Executes tool calls and returns results in MCP format
   */
  handleToolsCall(req, res) {
    const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB limit
    let data = '';
    let bytesReceived = 0;

    req.on('data', chunk => {
      bytesReceived += chunk.length;

      // Check if request exceeds size limit
      if (bytesReceived > MAX_REQUEST_SIZE) {
        req.destroy();
        res.writeHead(413);
        res.end(JSON.stringify({
          error: 'Request too large',
          message: `Request size exceeds ${MAX_REQUEST_SIZE} bytes limit`
        }));
        return;
      }

      data += chunk;
    });

    req.on('end', async () => {
      try {
        let requestBody;
        try {
          requestBody = JSON.parse(data);
        } catch (parseError) {
          res.writeHead(400);
          res.end(JSON.stringify({
            error: 'Invalid JSON',
            message: 'Request body must be valid JSON'
          }));
          return;
        }

        const { name, arguments: args } = requestBody;

        // Validate tool name
        if (!name) {
          res.writeHead(400);
          res.end(JSON.stringify({
            error: 'Missing tool name',
            message: 'Request must include a "name" field'
          }));
          return;
        }

        // Execute tool and get result
        let result;
        try {
          result = await this.executeTool(name, args || {});
        } catch (toolError) {
          res.writeHead(400);
          res.end(JSON.stringify({
            error: 'Tool execution failed',
            message: toolError.message
          }));
          return;
        }

        // Return result in MCP format
        res.writeHead(200);
        res.end(JSON.stringify({
          content: [{
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }]
        }));
      } catch (error) {
        console.error('[PRISM] Tool call error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({
          error: 'Internal server error',
          message: 'An error occurred while processing tool call'
        }));
      }
    });

    req.on('error', (error) => {
      console.error('[PRISM] Request error:', error);
      res.writeHead(400);
      res.end(JSON.stringify({
        error: 'Bad request',
        message: 'Request connection error'
      }));
    });
  }

  /**
   * Execute a specific tool
   */
  async executeTool(name, args) {
    switch (name) {
      case 'search_repo':
        return this.toolSearchRepo(args);

      case 'get_file':
        return this.toolGetFile(args);

      case 'list_files':
        return this.toolListFiles(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Tool: search_repo
   * Search the codebase for relevant code
   */
  toolSearchRepo(args) {
    const { query, limit } = args;

    // Validate required parameters
    if (!query) {
      throw new Error('Missing required parameter: query');
    }

    // Validate limit if provided
    const searchLimit = limit !== undefined ? parseInt(limit) : 10;
    if (isNaN(searchLimit) || searchLimit < 1 || searchLimit > 100) {
      throw new Error('Limit must be a number between 1 and 100');
    }

    // Perform search
    const results = this.simpleSearch(query);
    return results.slice(0, searchLimit);
  }

  /**
   * Tool: get_file
   * Retrieve full contents of a file
   */
  async toolGetFile(args) {
    const { path: filePath } = args;

    // Validate required parameters
    if (!filePath) {
      throw new Error('Missing required parameter: path');
    }

    try {
      // Security check: prevent path traversal with canonicalization
      const fullPath = path.resolve(this.config.projectRoot, filePath);
      const projectRoot = path.resolve(this.config.projectRoot);

      // Ensure the resolved path is within project root
      if (!fullPath.startsWith(projectRoot + path.sep) && fullPath !== projectRoot) {
        throw new Error('Invalid file path: path traversal not allowed');
      }

      const content = await fs.readFile(fullPath, 'utf8');
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Tool: list_files
   * List all indexed files
   */
  toolListFiles(args) {
    const { language } = args;

    if (!this.indexLoaded || !this.indexer.loadedIndex) {
      return [];
    }

    const files = this.indexer.loadedIndex.files || [];

    // Map to simplified format
    let result = files.map(f => ({
      path: f.path,
      language: f.language,
      lines: f.lines,
      size: f.size
    }));

    // Filter by language if specified
    if (language) {
      result = result.filter(f => f.language === language);
    }

    return result;
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

      // Set connection limits
      this.server.maxConnections = 100;

      // Set request timeout (30 seconds)
      this.server.timeout = 30000;

      // Handle server errors
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`[PRISM] Port ${this.config.port} is already in use`);
          process.exit(1);
        } else if (error.code === 'EACCES') {
          console.error(`[PRISM] Permission denied to bind to port ${this.config.port}`);
          process.exit(1);
        } else {
          console.error('[PRISM] Server error:', error);
          this.metrics.errors++;
        }
      });

      this.server.listen(this.config.port, () => {
        console.log(`[PRISM] Server running on http://localhost:${this.config.port}`);
        console.log(`[PRISM] Health check: http://localhost:${this.config.port}/health`);
        console.log(`[PRISM] Readiness check: http://localhost:${this.config.port}/ready`);
        console.log(`[PRISM] Metrics: http://localhost:${this.config.port}/metrics`);
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

    console.log('[PRISM] Stopping daemon...');

    // Stop file watcher
    if (this.watcher) {
      this.watcher.stop();
    }

    // Close server with timeout
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('[PRISM] Server shutdown timeout - forcing close');
        this.server.unref();
        this.isRunning = false;
        resolve();
      }, this.config.gracefulShutdownTimeout);

      this.server.close(() => {
        clearTimeout(timeout);
        console.log('[PRISM] Server stopped gracefully');
        this.isRunning = false;
        resolve();
      });
    });
  }

  /**
   * Save compressed index to file
   */
  async saveIndex(filePath) {
    if (!this.indexedFiles || Object.keys(this.indexedFiles).length === 0) {
      throw new Error('No index data to save');
    }

    try {
      console.log(`[PRISM] Saving compressed index with ${Object.keys(this.indexedFiles).length} files`);

      // Apply compression before saving
      const compressionResult = await this.indexCompressor.saveToFile(filePath, this.indexedFiles);

      console.log(`[PRISM] Index saved with ${((1 - compressionResult.compressionRatio) * 100).toFixed(1)}% compression`);

      return {
        success: true,
        originalSize: compressionResult.originalSize,
        compressedSize: compressionResult.compressedSize,
        compressionRatio: compressionResult.compressionRatio,
        fileCount: Object.keys(this.indexedFiles).length
      };
    } catch (error) {
      console.error('[PRISM] Failed to save index:', error.message);
      throw error;
    }
  }

  /**
   * Load compressed index from file
   */
  async loadIndex(filePath) {
    try {
      console.log(`[PRISM] Loading index from ${filePath}`);

      // Load and decompress the index
      const loadResult = await this.indexCompressor.loadFromFile(filePath);

      this.indexedFiles = loadResult.data;
      this.lastIndexTime = Date.now();

      // Track access for cleanup
      Object.keys(this.indexedFiles).forEach(filePath => {
        this.cleanupManager.trackAccess(filePath);
      });

      console.log(`[PRISM] Index loaded with ${Object.keys(this.indexedFiles).length} files`);

      return {
        success: true,
        fileCount: Object.keys(this.indexedFiles).length,
        metadata: loadResult.metadata
      };
    } catch (error) {
      console.error('[PRISM] Failed to load index:', error.message);
      // Initialize with empty index
      this.indexedFiles = {};
      return {
        success: false,
        error: error.message,
        fileCount: 0
      };
    }
  }

  /**
   * Get index fragmentation analysis
   */
  async analyzeIndexFragmentation() {
    if (!this.indexedFiles) {
      return {
        fragmented: false,
        analysis: {
          reason: 'No index data available'
        }
      };
    }

    const analysis = this.fragmentAnalyzer.analyzeFragmentation(this.indexedFiles);
    const healthReport = this.fragmentAnalyzer.getHealthReport(this.indexedFiles);

    return {
      fragmented: analysis.fragmented,
      analysis: analysis.analysis,
      healthReport
    };
  }

  /**
   * Optimize index based on fragmentation analysis
   */
  async optimizeIndex(strategy = 'auto') {
    if (!this.indexedFiles) {
      throw new Error('No index data to optimize');
    }

    console.log(`[PRISM] Starting index optimization with strategy: ${strategy}`);

    const optimization = await this.fragmentAnalyzer.optimizeIndex(this.indexedFiles, strategy);

    console.log(`[PRISM] Index optimization completed in ${optimization.results.timeTaken.toFixed(2)}ms`);

    return optimization;
  }
}

module.exports = PrismDaemon;

// Only start daemon if run directly
if (require.main === module) {
  // Start the server
  const daemon = new PrismDaemon();

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[PRISM] Received SIGTERM - shutting down...');
    try {
      await daemon.stop();
      process.exit(0);
    } catch (error) {
      console.error('[PRISM] Error during shutdown:', error);
      process.exit(1);
    }
  });

  process.on('SIGINT', async () => {
    console.log('[PRISM] Received SIGINT - shutting down...');
    try {
      await daemon.stop();
      process.exit(0);
    } catch (error) {
      console.error('[PRISM] Error during shutdown:', error);
      process.exit(1);
    }
  });

  daemon.start().catch(() => process.exit(1));
}