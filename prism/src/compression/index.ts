/**
 * Compression Module
 *
 * Exports the compression library and related types.
 */

export { CompressionLibrary, createCompressionLibrary } from './CompressionLibrary.js';
export type {
  CompressedChunk,
  CompressionMetadata,
  CompressionLibraryConfig,
} from './CompressionLibrary.js';
export { CompressionLevel } from './CompressionLibrary.js';
