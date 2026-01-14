#!/usr/bin/env node
/**
 * ============================================================================
 * PRISM MCP SERVER CLI
 * ============================================================================
 *
 * This is the command-line entry point for running PRISM as a Model Context
 * Protocol (MCP) server. It provides a stdio-based interface that integrates
 * with Claude Code and other MCP-compatible clients.
 *
 * How It Works:
 * ------------
 * 1. Parse command-line arguments (database path, max results, verbose mode)
 * 2. Validate database exists and contains indexed code
 * 3. Initialize vector database connection
 * 4. Create and start MCP server
 * 5. Listen for JSON-RPC requests on stdin/stdout
 *
 * Integration with Claude Code:
 * ----------------------------
 * Add this to Claude Code's settings.json:
 *
 * {
 *   "mcpServers": {
 *     "prism": {
 *       "command": "node",
 *       "args": [
 *         "/path/to/prism/dist/mcp/cli.js",
 *         "--db", "./prism.db",
 *         "--max-results", "20"
 *       ]
 *     }
 *   }
 * }
 *
 * Command-Line Options:
 * --------------------
 * --db <path>         Path to vector database file (default: ./prism.db)
 * --max-results <n>   Maximum results per search (default: 10)
 * --verbose           Enable debug logging to stderr
 * --help              Show help message
 * --version           Show version number
 *
 * Usage Examples:
 * --------------
 * # Start with default settings
 * node dist/mcp/cli.js
 *
 * # Specify custom database path
 * node dist/mcp/cli.js --db ./my-codebase.db
 *
 * # Enable verbose logging
 * node dist/mcp/cli.js --db ./prism.db --verbose
 *
 * # Increase result limit
 * node dist/mcp/cli.js --db ./prism.db --max-results 20
 *
 * Lifecycle:
 * ---------
 * 1. Parse CLI arguments with commander
 * 2. Check database file exists
 * 3. Check database has indexed content
 * 4. Initialize SQLiteVectorDB
 * 5. Create PrismMCPServer instance
 * 6. Start server (blocks, listening on stdio)
 *
 * Error Handling:
 * --------------
 * - Database not found: Exit with error message, suggest running 'prism index'
 * - Empty database: Exit with error message, suggest running 'prism index'
 * - Invalid options: commander shows usage and exits
 * - Runtime errors: Caught and logged to stderr
 *
 * Verbosity:
 * ---------
 * When --verbose is enabled, diagnostic information is sent to stderr:
 * - Database path and stats
 * - Chunk and vector counts
 * - Server startup confirmation
 *
 * Note: stderr is used for logging (not stdout) because stdout is used for
 * JSON-RPC protocol messages.
 *
 * Exit Codes:
 * ----------
 * 0 - Success (server started normally)
 * 1 - Error (database missing, empty, or other failure)
 *
 * @see docs/architecture/06-mcp-integration.md
 */

import { PrismMCPServer } from './PrismMCPServer.js';
import { SQLiteVectorDB } from '../vector-db/index.js';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// COMMAND-LINE INTERFACE SETUP
// ============================================================================

/**
 * Configure CLI options using commander.
 *
 * Commander handles:
 * - Parsing command-line arguments
 * - Generating help text
 * - Validating option types
 * - Showing version information
 */
const program = new Command();

program
  .name('prism-mcp')
  .description('Prism MCP Server for Claude Code')
  .version('0.1.0')
  .option('-d, --db <path>', 'Path to vector database file', './prism.db')
  .option('-m, --max-results <number>', 'Maximum results per search', '10')
  .option('-v, --verbose', 'Enable verbose logging')
  .parse(process.argv);

// Parsed command-line options
const options = program.opts();

// ============================================================================
// MAIN EXECUTION
// ============================================================================

/**
 * Main entry point for the MCP server CLI.
 *
 * This function:
 * 1. Validates the database file exists
 * 2. Checks the database contains indexed content
 * 3. Initializes the vector database connection
 * 4. Creates and starts the MCP server
 * 5. Blocks indefinitely listening for requests
 *
 * Error Handling:
 * - All errors are logged to stderr (not stdout)
 * - Process exits with code 1 on any error
 * - Suggests running 'prism index' for database issues
 *
 * @async
 */
async function main() {
  // Resolve database path to absolute path
  const dbPath = path.resolve(options.db);
  const maxResults = parseInt(options.maxResults, 10);

  // ------------------------------------------------------------------------
  // Validation: Database file must exist
  // ------------------------------------------------------------------------
  // The database is created by 'prism index' command
  // If it doesn't exist, user needs to index their codebase first
  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Database file not found: ${dbPath}`);
    console.error('');
    console.error('Please index your codebase first:');
    console.error('  prism index <path>');
    console.error('');
    console.error('The database will be created at:', dbPath);
    process.exit(1);
  }

  // ------------------------------------------------------------------------
  // Initialize vector database connection
  // ------------------------------------------------------------------------
  const vectorDB = new SQLiteVectorDB({ path: dbPath });

  // ------------------------------------------------------------------------
  // Validation: Database must contain indexed content
  // ------------------------------------------------------------------------
  // Empty database means 'prism index' was run but no files were indexed
  // (or index failed partway through)
  const stats = vectorDB.getStats();
  if (stats.chunkCount === 0) {
    console.error(`Error: Database is empty (${dbPath})`);
    console.error('');
    console.error('Please index your codebase first:');
    console.error('  prism index <path>');
    process.exit(1);
  }

  // ------------------------------------------------------------------------
  // Verbose logging (to stderr, not stdout)
  // ------------------------------------------------------------------------
  // stderr is used because stdout is reserved for JSON-RPC messages
  if (options.verbose) {
    console.error(`Prism MCP Server starting...`);
    console.error(`Database: ${dbPath}`);
    console.error(`Chunks: ${stats.chunkCount}`);
    console.error(`Vectors: ${stats.vectorCount}`);
    console.error('');
  }

  // ------------------------------------------------------------------------
  // Create and start MCP server
  // ------------------------------------------------------------------------
  // The server will listen for JSON-RPC requests on stdin
  // and write responses to stdout
  const server = new PrismMCPServer({
    vectorDB,
    maxResults,
  });

  await server.start();

  if (options.verbose) {
    console.error('Prism MCP Server running. Waiting for connections...');
  }

  // Server is now running and blocking on stdio
  // Process will exit when Claude Code closes the pipe
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Global error handler for the MCP server process.
 *
 * Catches any unhandled errors in the main() function and:
 * 1. Logs error details to stderr
 * 2. Exits with error code 1
 *
 * This ensures the process doesn't hang if an error occurs.
 */
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
