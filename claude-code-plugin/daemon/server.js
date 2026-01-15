#!/usr/bin/env node

/**
 * PRISM Simple Daemon
 * Provides basic project memory for Claude Code
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const SimpleProjectDetector = require('./simple-project-detector');

class PrismDaemon {
  constructor() {
    this.projectRoot = process.env.PROJECT_ROOT || process.cwd();
    this.adaptiveConfig = this.calculateAdaptiveConfig(this.projectRoot);

    this.config = {
      port: parseInt(process.env.PORT) || 8080,
      projectRoot: this.projectRoot,
      logLevel: process.env.LOG_LEVEL || 'info',
      maxFiles: this.adaptiveConfig.maxFiles,
      maxFileSize: this.adaptiveConfig.maxFileSize,
      incrementalIndexing: true, // Enable incremental indexing
      cacheTTL: 60000, // Cache metadata for 60 seconds
      parallelWorkers: this.adaptiveConfig.parallelWorkers,
      memoryLimit: this.adaptiveConfig.memoryLimit
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
  }

  /**
   * Calculate adaptive configuration based on project size
   */
  calculateAdaptiveConfig(projectRoot) {
    const baseConfig = {
      maxFiles: 1000,
      maxFileSize: 1024 * 1024, // 1MB
      parallelWorkers: 1,
      memoryLimit: 100 * 1024 * 1024, // 100MB
      cacheSize: 50
    };

    // Try to estimate project size
    const projectSize = this.estimateProjectSize(projectRoot);
    console.log(`[PRISM] Estimated project size: ${projectSize} files`);

    // Adjust configuration based on project size
    if (projectSize < 100) {
      // Small project
      return {
        ...baseConfig,
        maxFiles: 1000,
        cacheSize: 20
      };
    } else if (projectSize < 1000) {
      // Medium project
      return {
        ...baseConfig,
        maxFiles: 5000,
        maxFileSize: 2 * 1024 * 1024, // 2MB
        parallelWorkers: Math.min(2, require('os').cpus().length),
        memoryLimit: 200 * 1024 * 1024, // 200MB
        cacheSize: 100
      };
    } else if (projectSize < 10000) {
      // Large project
      return {
        ...baseConfig,
        maxFiles: 10000,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        parallelWorkers: Math.min(4, require('os').cpus().length),
        memoryLimit: 500 * 1024 * 1024, // 500MB
        cacheSize: 200
      };
    } else {
      // Very large project
      return {
        ...baseConfig,
        maxFiles: 20000,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        parallelWorkers: Math.min(8, require('os').cpus().length),
        memoryLimit: 1024 * 1024 * 1024, // 1GB
        cacheSize: 500
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
      await this.discoverProject();
      console.log(`[PRISM] Project: ${this.projectInfo?.name || 'Unknown'} (${this.projectInfo?.language || 'unknown'})`);
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
    } else if (method === 'POST' && url === '/search') {
      this.handleSearch(req, res);
    } else if (method === 'POST' && url === '/index') {
      this.handleIndex(req, res);
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
        const results = this.simpleSearch(query);

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
      const startTime = Date.now();
      const result = await this.indexProject();
      const duration = Date.now() - startTime;

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
   * Index project files with incremental support
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

      console.log(`[PRISM] Starting incremental indexing - ${files.length} files found`);

      for (const filePath of files) {
        try {
          // Check if file needs reindexing
          const needsReindex = await this.fileNeedsReindex(filePath);

          if (!needsReindex && this.indexedFiles?.[filePath]) {
            // Keep existing data
            indexedFiles[filePath] = this.indexedFiles[filePath];
            this.fileMetadataCache.set(filePath, this.getMetadataKey(filePath));
            skippedFiles++;
            continue;
          }

          // File needs reindexing
          const fileData = await this.indexFile(filePath);
          if (fileData) {
            indexedFiles[filePath] = fileData;
            this.fileMetadataCache.set(filePath, this.getMetadataKey(filePath));
            filesCount++;
            changedFiles++;

            // Respect max files limit
            if (filesCount >= this.config.maxFiles) {
              console.log(`[PRISM] Reached max files limit (${this.config.maxFiles})`);
              break;
            }
          }
        } catch (error) {
          console.log(`[PRISM] Skipped file ${filePath}:`, error.message);
        }
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
   * Scan project for files to index
   */
  async scanProjectFiles() {
    const files = [];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.cache', 'venv', '__pycache__'];

    async function scanDir(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip excluded directories
          if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name)) {
              await scanDir(fullPath);
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
              if (stats.size <= this.config.maxFileSize) {
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

      // Use streaming for large files to save memory
      let content;
      if (fileSize > 50 * 1024) { // 50KB+
        content = await this.streamReadFile(filePath, this.config.maxFileSize);
      } else {
        content = await fs.readFile(filePath, 'utf8');
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
      setTimeout(() => {
        if (!stream.destroyed) {
          stream.destroy();
          reject(new Error(`File read timeout: ${filePath}`));
        }
      }, 5000);
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
   * Enhanced search implementation with intelligent scoring
   */
  simpleSearch(query) {
    if (!query || query.length < 2) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery.split(/\s+/).filter(word => word.length > 0);
    const results = [];

    if (!this.indexedFiles) {
      return [];
    }

    for (const [filePath, fileData] of Object.entries(this.indexedFiles)) {
      let score = 0;
      let contentSnippet = '';
      let matchLine = 1;

      // Enhanced filename scoring
      score += this.scoreFilenameMatch(query, filePath, queryWords);

      // Enhanced content scoring
      if (fileData.content) {
        const contentScore = this.scoreContentMatch(query, fileData.content, queryWords);
        const { snippet, line } = this.getContentSnippet(fileData.content, queryWords);

        score += contentScore;
        contentSnippet = snippet || `File contains "${query}"`;
        matchLine = line;
      }

      // Contextual scoring based on project structure
      score += this.scoreContext(filePath);

      if (score > 0) {
        results.push({
          file: filePath,
          content: contentSnippet,
          score: Math.min(score, 1.0),
          line: matchLine
        });
      }
    }

    // Sort by score (descending) and return top 10
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
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

      this.server.listen(this.config.port, () => {
        console.log(`[PRISM] Server running on http://localhost:${this.config.port}`);
        console.log(`[PRISM] Health check: http://localhost:${this.config.port}/health`);
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