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
   * Handle search request
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
   * Simple file search implementation
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