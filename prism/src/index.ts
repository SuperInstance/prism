/**
 * Prism - Main entry point
 *
 * AI-powered codebase indexer and RAG engine for Claude Code
 */

export { CodeIndexer } from './indexer/index.js';
export { MemoryVectorDB, type IVectorDB, type SearchResult } from './vector-db/index.js';
export { TokenOptimizer } from './token-optimizer/index.js';
export { ModelRouter } from './model-router/index.js';
export { MCPServer } from './mcp/index.js';
export * from './core/index.js';
