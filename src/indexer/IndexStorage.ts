/**
 * ============================================================================
 * INDEX STORAGE - Metadata Persistence Layer
 * ============================================================================
 *
 * Manages index metadata and enables incremental reindexing by tracking
 * file modification times and index statistics across runs.
 *
 * CORE RESPONSIBILITIES:
 *
 * 1. FILE MODIFICATION TRACKING
 *    - Stores last modified timestamp for each indexed file
 *    - Enables incremental indexing by comparing current vs stored mtime
 *    - Prevents reprocessing unchanged files
 *
 * 2. INDEX METADATA PERSISTENCE
 *    - Records when indexing was last run
 *    - Stores counts of files/chunks indexed
 *    - Tracks index version for migration support
 *
 * 3. INCREMENTAL INDEXING SUPPORT
 *    - Provides getLastModified/setLastModified for file comparison
 *    - Exports/import functionality for backup and migration
 *    - Validation methods for index integrity checking
 *
 * CURRENT IMPLEMENTATION (IN-MEMORY):
 * - Uses in-memory Map storage
 * - Data is lost when process exits
 * - Suitable for development and testing
 *
 * PRODUCTION MIGRATION PLAN:
 * - Cloudflare Workers KV: For metadata
 * - Cloudflare D1: For file modification records
 * - Schema:
 *   ```sql
 *   CREATE TABLE file_modifications (
 *     path TEXT PRIMARY KEY,
 *     last_modified INTEGER,
 *     file_size INTEGER,
 *     checksum TEXT,
 *     index_version TEXT
 *   );
 *
 *   CREATE TABLE index_metadata (
 *     index_id TEXT PRIMARY KEY,
 *     last_updated INTEGER,
 *     files_indexed INTEGER,
 *     chunks_indexed INTEGER,
 *     version TEXT
 *   );
 *   ```
 *
 * WHY TRACK FILE MODIFICATION TIMES:
 * - Incremental indexing: Only reprocess changed files
 * - Performance: 10-100x speedup for typical workflows
 * - Cost savings: Fewer embedding API calls
 *
 * LIMITATIONS:
 * - Mtime can be manually altered (git operations, file systems)
 * - No content hash verification yet (TODO: SHA-256)
 * - No cross-session persistence (TODO: KV/D1 integration)
 *
 * FUTURE ENHANCEMENTS:
 * - Content-based hashing (SHA-256) for integrity
 * - Persistent storage (Cloudflare KV/D1)
 * - Index versioning for schema migrations
 * - Compaction and cleanup of stale records
 *
 * @see IndexerOrchestrator.filterUnchangedFiles() for usage
 * @see docs/architecture/04-indexer-architecture.md for design
 */

import type { PrismConfig } from '../config/types/index.js';
import { createPrismError, ErrorCode } from '../core/types/index.js';

/**
 * Index metadata
 */
export interface IndexMetadata {
  /** Last update timestamp */
  lastUpdated: Date;

  /** Number of files indexed */
  filesIndexed: number;

  /** Number of chunks indexed */
  chunksIndexed?: number;

  /** Index version */
  version?: string;

  /** Index ID */
  indexId?: string;
}

/**
 * Index statistics
 */
export interface IndexStats {
  /** Total files indexed */
  totalFiles: number;

  /** Total chunks indexed */
  totalChunks: number;

  /** Total tokens indexed */
  totalTokens: number;

  /** Files by language */
  filesByLanguage: Record<string, number>;

  /** Chunks by language */
  chunksByLanguage: Record<string, number>;

  /** Last indexed timestamp */
  lastIndexed: Date;

  /** Index size in bytes */
  indexSize: number;
}

/**
 * File modification record
 */
interface FileModificationRecord {
  path: string;
  lastModified: string; // ISO date string
  fileSize: number;
  checksum?: string;
}

/**
 * Index storage manager
 *
 * Handles persistence of index metadata and file modification tracking.
 */
export class IndexStorage {
  private config: PrismConfig;
  private metadata: IndexMetadata | null = null;
  private fileModifications: Map<string, Date> = new Map();

  // In-memory storage (would be replaced with KV/D1 in production)
  private storage: {
    metadata: IndexMetadata | null;
    fileModifications: FileModificationRecord[];
  } = {
    metadata: null,
    fileModifications: [],
  };

  constructor(config: PrismConfig) {
    this.config = config;
  }

  /**
   * ============================================================================
   * Save index metadata to storage
   * ============================================================================
   *
   * Persists index metadata for incremental indexing support.
   *
   * CURRENT BEHAVIOR:
   * - Stores in memory only (lost on process exit)
   * - No persistence to disk or cloud
   *
   * PRODUCTION BEHAVIOR (TODO):
   * - Persist to Cloudflare KV or D1
   * - Implement retry logic for network failures
   * - Add transaction support for atomic updates
   *
   * @param metadata - IndexMetadata to persist
   * @throws {PrismError} If save operation fails
   *
   * @see loadIndex() for retrieval
   */
  async saveIndex(metadata: IndexMetadata): Promise<void> {
    try {
      this.storage.metadata = {
        ...metadata,
        lastUpdated: new Date(metadata.lastUpdated),
      };
      this.metadata = this.storage.metadata;

      // In production, this would persist to KV/D1
      // await this.env.PRISM_INDEX_METADATA.put(metadata.indexId, JSON.stringify(metadata));
    } catch (error) {
      throw createPrismError(
        ErrorCode.INDEXING_FAILED,
        `Failed to save index metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load index metadata
   *
   * @returns Index metadata or null if not found
   */
  async loadIndex(): Promise<IndexMetadata | null> {
    try {
      if (this.storage.metadata) {
        return {
          ...this.storage.metadata,
          lastUpdated: new Date(this.storage.metadata.lastUpdated),
        };
      }

      // In production, this would load from KV/D1
      // const data = await this.env.PRISM_INDEX_METADATA.get(indexId);
      // return data ? JSON.parse(data) : null;

      return null;
    } catch (error) {
      throw createPrismError(
        ErrorCode.INDEXING_FAILED,
        `Failed to load index metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update index statistics
   *
   * @param stats - Statistics to update
   */
  async updateIndexStats(stats: IndexStats): Promise<void> {
    try {
      if (this.storage.metadata) {
        this.storage.metadata.filesIndexed = stats.totalFiles;
        this.storage.metadata.chunksIndexed = stats.totalChunks;
        this.storage.metadata.lastUpdated = stats.lastIndexed;
      }
    } catch (error) {
      throw createPrismError(
        ErrorCode.INDEXING_FAILED,
        `Failed to update index stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get last modified time for a file
   *
   * @param filePath - Path to file
   * @returns Last modified date or null if not indexed
   */
  async getLastModified(filePath: string): Promise<Date | null> {
    try {
      const record = this.storage.fileModifications.find(
        (r) => r.path === filePath
      );

      if (record) {
        return new Date(record.lastModified);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set last modified time for a file
   *
   * @param filePath - Path to file
   * @param date - Modification date
   */
  async setLastModified(filePath: string, date: Date): Promise<void> {
    try {
      const existingIndex = this.storage.fileModifications.findIndex(
        (r) => r.path === filePath
      );

      const record: FileModificationRecord = {
        path: filePath,
        lastModified: date.toISOString(),
        fileSize: 0, // Would be populated if we had file stats
      };

      if (existingIndex >= 0) {
        this.storage.fileModifications[existingIndex] = record;
      } else {
        this.storage.fileModifications.push(record);
      }

      this.fileModifications.set(filePath, date);
    } catch (error) {
      throw createPrismError(
        ErrorCode.INDEXING_FAILED,
        `Failed to set last modified: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all tracked files
   *
   * @returns Map of file paths to modification dates
   */
  async getAllTrackedFiles(): Promise<Map<string, Date>> {
    return new Map(
      this.storage.fileModifications.map((r) => [r.path, new Date(r.lastModified)])
    );
  }

  /**
   * Remove file from tracking
   *
   * @param filePath - Path to file
   */
  async removeFile(filePath: string): Promise<void> {
    const index = this.storage.fileModifications.findIndex(
      (r) => r.path === filePath
    );

    if (index >= 0) {
      this.storage.fileModifications.splice(index, 1);
    }

    this.fileModifications.delete(filePath);
  }

  /**
   * Clear all index metadata
   */
  async clearIndex(): Promise<void> {
    this.storage.metadata = null;
    this.storage.fileModifications = [];
    this.fileModifications.clear();
    this.metadata = null;
  }

  /**
   * ============================================================================
   * Check if file needs reindexing
   * ============================================================================
   *
   * Determines if a file has been modified since last indexing by comparing
   * modification times. This is the core of incremental indexing.
   *
   * DECISION LOGIC:
   * 1. If no metadata exists → file never indexed → needs indexing
   * 2. If current mtime > stored mtime → file modified → needs indexing
   * 3. If current mtime <= stored mtime → file unchanged → skip
   *
   * EDGE CASES:
   * - Clock skew between systems can cause false positives
   * - Git operations can change mtime without content change
   * - TODO: Add content hash (SHA-256) to verify actual changes
   *
   * USAGE:
   * ```typescript
   * const stats = await fs.stat('/path/to/file.ts');
   * const needsReindex = await storage.needsReindexing('/path/to/file.ts', stats.mtime);
   * if (needsReindex) {
   *   // Reindex the file
   * }
   * ```
   *
   * @param filePath - Absolute path to file
   * @param currentModified - Current file modification time from filesystem
   * @returns true if file needs (re)indexing, false if unchanged
   *
   * @see IndexerOrchestrator.filterUnchangedFiles() for usage
   */
  async needsReindexing(filePath: string, currentModified: Date): Promise<boolean> {
    const lastModified = await this.getLastModified(filePath);

    if (!lastModified) {
      return true; // Never indexed
    }

    return currentModified > lastModified;
  }

  /**
   * Get index size estimate
   *
   * @returns Estimated size in bytes
   */
  getIndexSize(): number {
    const metadataSize = this.storage.metadata
      ? JSON.stringify(this.storage.metadata).length
      : 0;

    const recordsSize = JSON.stringify(this.storage.fileModifications).length;

    return metadataSize + recordsSize;
  }

  /**
   * Get statistics about tracked files
   *
   * @returns Tracking statistics
   */
  getTrackingStats(): {
    totalFiles: number;
    indexSize: number;
    lastUpdated: Date | null;
  } {
    return {
      totalFiles: this.storage.fileModifications.length,
      indexSize: this.getIndexSize(),
      lastUpdated: this.storage.metadata?.lastUpdated || null,
    };
  }

  /**
   * Export index data for backup/migration
   *
   * @returns Serialized index data
   */
  async exportIndex(): Promise<string> {
    const data = {
      metadata: this.storage.metadata,
      fileModifications: this.storage.fileModifications,
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import index data from backup
   *
   * @param data - Serialized index data
   */
  async importIndex(data: string): Promise<void> {
    try {
      const parsed = JSON.parse(data);

      if (parsed.metadata) {
        this.storage.metadata = {
          ...parsed.metadata,
          lastUpdated: new Date(parsed.metadata.lastUpdated),
        };
      }

      if (parsed.fileModifications) {
        this.storage.fileModifications = parsed.fileModifications;
      }

      // Rebuild in-memory map
      this.fileModifications.clear();
      for (const record of this.storage.fileModifications) {
        this.fileModifications.set(record.path, new Date(record.lastModified));
      }
    } catch (error) {
      throw createPrismError(
        ErrorCode.INDEXING_FAILED,
        `Failed to import index: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate index integrity
   *
   * @returns True if index is valid
   */
  async validateIndex(): Promise<boolean> {
    try {
      if (!this.storage.metadata) {
        return false;
      }

      // Check if metadata has required fields
      if (
        !this.storage.metadata.lastUpdated ||
        typeof this.storage.metadata.filesIndexed !== 'number'
      ) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get metadata (cached)
   *
   * @returns Current metadata or null
   */
  getMetadata(): IndexMetadata | null {
    return this.metadata;
  }

  /**
   * Get file modification records
   *
   * @returns Array of file modification records
   */
  getFileModifications(): FileModificationRecord[] {
    return [...this.storage.fileModifications];
  }
}
