/**
 * Indexer module exports
 *
 * This module provides fast code indexing using Rust/WASM
 * and orchestrates the complete indexing pipeline.
 */

// WASM Indexer (from Round 2)
export { WasmIndexer, getIndexer } from './WasmIndexer.js';
export type {
  ParseResult,
  ErrorNode,
  SourceLocation,
  FunctionInfo,
  ClassInfo,
  ImportInfo,
  ChunkOptions,
  IndexOptions as WasmIndexOptions,
  LanguageDetection,
} from './types.js';

// Indexing Pipeline (Round 3)
export { IndexerOrchestrator } from './IndexerOrchestrator.js';
export type { IndexOptions, IndexResult, IndexSummary } from './IndexerOrchestrator.js';

export { ProgressReporter } from './ProgressReporter.js';

export { IndexStorage } from './IndexStorage.js';
export type { IndexMetadata, IndexStats } from './IndexStorage.js';
