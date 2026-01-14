/**
 * ============================================================================
 * MCP SERVER MODULE
 * ============================================================================
 *
 * This module exports the Model Context Protocol (MCP) server implementation
 * for integrating PRISM with Claude Code and other MCP-compatible clients.
 *
 * Main Export:
 * -----------
 * PrismMCPServer - The primary MCP server class
 *
 * Usage:
 * -----
 * import { PrismMCPServer } from './mcp/index.js';
 *
 * const server = new PrismMCPServer({
 *   vectorDB: new SQLiteVectorDB({ path: './prism.db' }),
 *   maxResults: 20
 * });
 *
 * await server.start(); // Blocks, listening on stdio
 *
 * @see docs/architecture/06-mcp-integration.md
 * @see https://modelcontextprotocol.io
 */

export { PrismMCPServer } from './PrismMCPServer.js';
export type { PrismMCPServerConfig } from './PrismMCPServer.js';

/**
 * ============================================================================
 * LEGACY EXPORTS (DEPRECATED)
 * ============================================================================
 *
 * The following exports are maintained for backward compatibility but are
 * deprecated. Use PrismMCPServer instead.
 */

/**
 * Legacy tool definition interface.
 *
 * This was used in an earlier version of the MCP implementation. The new
 * implementation uses the @modelcontextprotocol/sdk Tool type instead.
 *
 * @deprecated Use Tool from @modelcontextprotocol/sdk/types.js instead
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Legacy MCP server class.
 *
 * This was the original implementation before rebranding to PrismMCPServer.
 * It is kept for backward compatibility but throws an error if instantiated.
 *
 * @deprecated Use PrismMCPServer instead
 * @example
 * // Old (deprecated):
 * const server = new MCPServer(); // Throws error
 *
 * // New (recommended):
 * const server = new PrismMCPServer({ vectorDB });
 */
export class MCPServer {
  constructor() {
    console.warn('MCPServer is deprecated. Use PrismMCPServer instead.');
  }

  async start(): Promise<void> {
    throw new Error('MCPServer is deprecated. Use PrismMCPServer instead.');
  }
}
