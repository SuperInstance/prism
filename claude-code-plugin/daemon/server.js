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

class PrismDaemon {
  constructor() {
    this.config = {
      port: parseInt(process.env.PORT) || 8080,
      projectRoot: process.env.PROJECT_ROOT || process.cwd(),
      logLevel: process.env.LOG_LEVEL || 'info'
    };

    this.server = http.createServer(this.handleRequest.bind(this));
    this.projectInfo = null;
    this.isRunning = false;

    // Initialize file indexer
    this.indexer = new FileIndexer(
      this.config.projectRoot,
      path.join(this.config.projectRoot, '.prism')
    );
    this.indexLoaded = false;
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
    } else if (method === 'POST' && url === '/search') {
      this.handleSearch(req, res);
    } else if (method === 'POST' && url === '/index') {
      this.handleReindex(req, res);
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
        res.writeHead(200);
        res.end(JSON.stringify({ results }));
      } catch (error) {
        console.error('[PRISM] Search error:', error);
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
    res.writeHead(202);
    res.end(JSON.stringify({
      status: 'indexing',
      message: 'Reindexing started in background'
    }));

    // Index in background
    this.indexer.indexProject()
      .then(async () => {
        this.indexer.loadedIndex = await this.indexer.loadIndex();
        this.indexLoaded = true;
        console.log('[PRISM] Reindexing complete');
      })
      .catch(error => {
        console.error('[PRISM] Reindexing failed:', error);
      });
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

    // Security check: prevent path traversal
    if (filePath.includes('..') || filePath.startsWith('/')) {
      throw new Error('Invalid file path: path traversal not allowed');
    }

    try {
      const fullPath = path.join(this.config.projectRoot, filePath);
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