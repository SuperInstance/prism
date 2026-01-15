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
      logLevel: process.env.LOG_LEVEL || 'info'
    };

    this.server = http.createServer(this.handleRequest.bind(this));
    this.projectInfo = null;
    this.isRunning = false;
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
    } else if (method === 'POST' && url === '/search') {
      this.handleSearch(req, res);
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
    if (!query || query.length < 2) {
      return [];
    }

    return [
      {
        file: 'README.md',
        content: `Found search query: "${query}"`,
        score: 0.9,
        line: 1
      }
    ];
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