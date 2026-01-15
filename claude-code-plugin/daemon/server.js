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
    this.config = {
      port: parseInt(process.env.PORT) || 8080,
      projectRoot: process.env.PROJECT_ROOT || process.cwd(),
      logLevel: process.env.LOG_LEVEL || 'info',
      maxFiles: 1000, // Maximum number of files to index
      maxFileSize: 1024 * 1024 // Maximum file size (1MB)
    };

    this.server = http.createServer(this.handleRequest.bind(this));
    this.projectInfo = null;
    this.isRunning = false;
    this.indexedFiles = null; // Store indexed files in memory
    this.lastIndexTime = null;
    this.searchCache = new Map(); // Simple LRU cache for search results
    this.maxCacheSize = 50; // Maximum cached search results
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
   * Index project files
   */
  async indexProject() {
    try {
      const files = await this.scanProjectFiles();
      const indexedFiles = {};

      let filesCount = 0;

      for (const filePath of files) {
        try {
          const fileData = await this.indexFile(filePath);
          if (fileData) {
            indexedFiles[filePath] = fileData;
            filesCount++;

            // Respect max files limit
            if (filesCount >= this.config.maxFiles) {
              break;
            }
          }
        } catch (error) {
          console.log(`[PRISM] Skipped file ${filePath}:`, error.message);
        }
      }

      this.indexedFiles = indexedFiles;
      this.lastIndexTime = Date.now();

      return { filesCount };

    } catch (error) {
      console.error('[PRISM] Indexing failed:', error.message);
      throw error;
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
   * Index a single file
   */
  async indexFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);

      return {
        content: content,
        size: stats.size,
        mtime: stats.mtime.getTime(),
        hash: this.simpleHash(content)
      };

    } catch (error) {
      return null;
    }
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
   * Simple file search implementation with real file indexing
   */
  simpleSearch(query) {
    if (!query || query.length < 2) {
      return [];
    }

    // Convert query to lowercase for case-insensitive search
    const lowerQuery = query.toLowerCase();

    // Search through indexed files
    const results = [];

    if (this.indexedFiles) {
      for (const [filePath, fileData] of Object.entries(this.indexedFiles)) {
        let score = 0;
        let contentSnippet = '';
        let matchLine = 1;

        // Search in file name
        if (filePath.toLowerCase().includes(lowerQuery)) {
          score += 0.3;
        }

        // Search in file content
        if (fileData.content) {
          const lines = fileData.content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(lowerQuery)) {
              score += 0.7;
              contentSnippet = lines[i].trim();
              matchLine = i + 1;

              // Only take first match per file for performance
              break;
            }
          }
        }

        if (score > 0) {
          results.push({
            file: filePath,
            content: contentSnippet || `File contains "${query}"`,
            score: Math.min(score, 1.0),
            line: matchLine
          });
        }
      }
    }

    // Sort by score (descending) and return top 10
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
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