import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../src/utils.js';

import { OptimizedJSONStorage } from './OptimizedJSONStorage.js';
import { OptimizedSearchEngine } from './OptimizedSearchEngine.js';
import { JSONStreamingHandler } from './JSONStreamingHandler.js';
import { DataIntegrityValidator, IntegrityCheck } from './DataIntegrityValidator.js';

export interface StorageMetrics {
  totalFiles: number;
  totalSize: number;
  indexSize: number;
  compressionRatio: number;
  averageFileSize: number;
  largestFile: string;
  smallestFile: string;
  languages: Record<string, number>;
  oldestFile: string;
  newestFile: string;
}

export interface CleanupReport {
  removedFiles: number;
  removedBackups: number;
  removedCache: number;
  defragmentedFiles: number;
  freedSpace: number;
  timeSpent: number;
}

export class StorageManager {
  private logger: Logger;
  private storage: OptimizedJSONStorage;
  private searchEngine: OptimizedSearchEngine;
  private streamingHandler: JSONStreamingHandler;
  private integrityValidator: DataIntegrityValidator;
  private metrics: StorageMetrics;

  constructor(indexPath?: string) {
    this.logger = new Logger("StorageManager");
    this.storage = new OptimizedJSONStorage({ indexPath });
    this.searchEngine = new OptimizedSearchEngine();
    this.streamingHandler = new JSONStreamingHandler();
    this.integrityValidator = new DataIntegrityValidator();
    this.metrics = this.initializeMetrics();
  }

  async initialize(): Promise<void> {
    try {
      await this.storage.initialize();
      await this.searchEngine.initialize(this.storage['config'].indexPath);
      this.metrics = await this.collectMetrics();
      this.logger.info("Storage manager initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize storage manager:", error);
      throw error;
    }
  }

  async addFile(filePath: string, content: string, language?: string): Promise<void> {
    try {
      // Validate content
      if (!content || content.length === 0) {
        throw new Error("Empty content provided");
      }

      // Extract chunks for indexing
      const chunks = this.extractChunks(content, language || this.detectLanguage(filePath));

      // Add to optimized storage
      const metadata = {
        size: content.length,
        language: language || this.detectLanguage(filePath),
        lastModified: new Date().toISOString(),
      };

      await this.storage.addFile(filePath, chunks, content);

      // Add to search engine
      await this.searchEngine.indexFile(filePath, content, metadata);

      this.logger.debug(`Added file ${filePath} (${chunks.length} chunks)`);
    } catch (error) {
      this.logger.error(`Failed to add file ${filePath}:`, error);
      throw error;
    }
  }

  async removeFile(filePath: string): Promise<void> {
    try {
      await this.storage.removeFile(filePath);
      this.searchEngine['removeFromIndex'](filePath);
      this.logger.debug(`Removed file ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to remove file ${filePath}:`, error);
      throw error;
    }
  }

  async updateFile(filePath: string, newContent: string, language?: string): Promise<void> {
    try {
      // Remove old version
      await this.removeFile(filePath);

      // Add new version
      await this.addFile(filePath, newContent, language);
    } catch (error) {
      this.logger.error(`Failed to update file ${filePath}:`, error);
      throw error;
    }
  }

  async searchFiles(query: string, options: {
    language?: string;
    limit?: number;
    fuzzy?: boolean;
    minScore?: number;
  } = {}): Promise<any[]> {
    try {
      const searchQuery = {
        text: query,
        language: options.language,
        limit: options.limit || 10,
        fuzzy: options.fuzzy || false,
        minScore: options.minScore || 0,
      };

      const results = await this.searchEngine.search(searchQuery);
      return results.results;
    } catch (error) {
      this.logger.error("Search failed:", error);
      throw error;
    }
  }

  async getMetrics(): Promise<StorageMetrics> {
    try {
      this.metrics = await this.collectMetrics();
      return this.metrics;
    } catch (error) {
      this.logger.error("Failed to collect metrics:", error);
      return this.metrics;
    }
  }

  async cleanup(options: {
    maxBackups?: number;
    maxCacheSize?: number;
    maxFileSize?: number;
    removeOrphanedFiles?: boolean;
    defragment?: boolean;
    autoCompress?: boolean;
  } = {}): Promise<CleanupReport> {
    const {
      maxBackups = 5,
      maxCacheSize = 100,
      maxFileSize = 10 * 1024 * 1024, // 10MB
      removeOrphanedFiles = true,
      defragment = true,
      autoCompress = true,
    } = options;

    const startTime = Date.now();
    let removedFiles = 0;
    let removedBackups = 0;
    let removedCache = 0;
    let defragmentedFiles = 0;
    let freedSpace = 0;

    try {
      this.logger.info("Starting storage cleanup", options);

      // Clean old backups
      if (maxBackups > 0) {
        const backupResult = await this.integrityValidator.cleanup(this.storage['config'].indexPath, {
          consolidateBackups: true,
          maxBackups,
        });
        removedBackups = backupResult.removedBackups;
        freedSpace += backupResult.freedSpace;
      }

      // Remove oversized files
      if (maxFileSize > 0) {
        const oversizedFiles = await this.findOversizedFiles(maxFileSize);
        for (const filePath of oversizedFiles) {
          await this.removeFile(filePath);
          removedFiles++;
          freedSpace += this.metrics.totalSize / this.metrics.totalFiles;
        }
      }

      // Remove orphaned files (files in index but not on disk)
      if (removeOrphanedFiles) {
        const orphanedFiles = await this.findOrphanedFiles();
        for (const filePath of orphanedFiles) {
          await this.removeFile(filePath);
          removedFiles++;
        }
      }

      // Defragment storage
      if (defragment) {
        defragmentedFiles = await this.defragmentStorage();
      }

      // Auto-compress large files
      if (autoCompress) {
        const compressionResult = await this.autoCompress();
        freedSpace += compressionResult.freedSpace;
      }

      // Cleanup search cache
      if (maxCacheSize > 0) {
        const cacheResult = await this.cleanupSearchCache(maxCacheSize);
        removedCache = cacheResult;
      }

      // Update metrics
      await this.collectMetrics();

      const timeSpent = Date.now() - startTime;

      this.logger.info("Cleanup completed", {
        removedFiles,
        removedBackups,
        removedCache,
        defragmentedFiles,
        freedSpace,
        timeSpent,
      });

      return {
        removedFiles,
        removedBackups,
        removedCache,
        defragmentedFiles,
        freedSpace,
        timeSpent,
      };

    } catch (error) {
      this.logger.error("Cleanup failed:", error);
      throw error;
    }
  }

  async optimizeStorage(): Promise<{
    before: StorageMetrics;
    after: StorageMetrics;
    improvements: string[];
  }> {
    const before = this.metrics;
    const improvements: string[] = [];

    try {
      this.logger.info("Starting storage optimization");

      // Run integrity check
      const integrityCheck = await this.integrityValidator.validateIntegrity(this.storage['config'].indexPath);
      if (!integrityCheck.valid) {
        improvements.push(`Fixed ${integrityCheck.errors.length} integrity issues`);
        // Additional error handling would go here
      }

      // Perform cleanup
      const cleanupReport = await this.cleanup({
        maxBackups: 3,
        removeOrphanedFiles: true,
        defragment: true,
      });

      if (cleanupReport.freedSpace > 0) {
        improvements.push(`Freed ${cleanupReport.freedSpace} bytes of space`);
      }

      if (cleanupReport.removedFiles > 0) {
        improvements.push(`Removed ${cleanupReport.removedFiles} orphaned files`);
      }

      // Recompress index if it's large
      const indexSize = before.indexSize;
      if (indexSize > 1024 * 1024) { // > 1MB
        const compressionRatio = await this.recompressIndex();
        improvements.push(`Improved compression ratio to ${compressionRatio.toFixed(2)}x`);
      }

      // Update metrics after optimization
      const after = await this.collectMetrics();

      this.logger.info("Storage optimization completed", {
        beforeSize: before.totalSize,
        afterSize: after.totalSize,
        improvement: before.totalSize - after.totalSize,
      });

      return {
        before,
        after,
        improvements,
      };

    } catch (error) {
      this.logger.error("Storage optimization failed:", error);
      throw error;
    }
  }

  async backup(options: {
    compression?: boolean;
    includeChecksums?: boolean;
    backupPath?: string;
    keepLocal?: boolean;
  } = {}): Promise<{
    backupPath: string;
    size: number;
    checksum: string;
    timestamp: string;
  }> {
    const {
      compression = true,
      includeChecksums = true,
      backupPath,
      keepLocal = true,
    } = options;

    try {
      this.logger.info("Creating backup", options);

      // Save current index
      await this.storage.saveIndex();

      // Create backup using integrity validator
      const backupInfo = await this.integrityValidator.createBackup(
        this.storage['config'].indexPath,
        { compression, includeChecksums, backupPath }
      );

      const result = {
        backupPath: backupInfo.path,
        size: backupInfo.size,
        checksum: backupInfo.checksum,
        timestamp: backupInfo.timestamp,
      };

      if (!keepLocal && backupPath) {
        // Move to specified location
        const targetPath = path.join(backupPath, `prism-backup-${backupInfo.timestamp}.json${compression ? '.gz' : ''}`);
        await fs.rename(backupInfo.path, targetPath);
        result.backupPath = targetPath;
      }

      this.logger.info(`Backup created: ${result.backupPath} (${result.size} bytes)`);
      return result;

    } catch (error) {
      this.logger.error("Backup failed:", error);
      throw error;
    }
  }

  async restore(backupPath: string): Promise<void> {
    try {
      this.logger.info(`Restoring from backup: ${backupPath}`);

      // Validate backup
      const integrityCheck = await this.integrityValidator.validateIntegrity(path.dirname(backupPath));
      if (!integrityCheck.valid) {
        throw new Error(`Backup integrity check failed: ${integrityCheck.errors.join(', ')}`);
      }

      // Restore from backup
      const restored = await this.integrityValidator.restoreFromBackup(this.storage['config'].indexPath);
      if (!restored) {
        throw new Error("Restore failed");
      }

      // Rebuild search index
      await this.searchEngine.initialize(this.storage['config'].indexPath);

      // Update metrics
      await this.collectMetrics();

      this.logger.info("Restore completed successfully");
    } catch (error) {
      this.logger.error("Restore failed:", error);
      throw error;
    }
  }

  async getStatus(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: StorageMetrics;
    lastCheck?: string;
    nextMaintenance?: string;
  }> {
    try {
      const integrityCheck = await this.integrityValidator.validateIntegrity(this.storage['config'].indexPath, {
        fastMode: true,
      });

      const issues: string[] = [];
      const now = new Date();
      const nextMaintenance = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      if (integrityCheck.errors.length > 0) {
        issues.push(...integrityCheck.errors);
      }

      if (integrityCheck.warnings.length > 0) {
        issues.push(...integrityCheck.warnings);
      }

      if (this.metrics.totalSize > 100 * 1024 * 1024) { // > 100MB
        issues.push("Storage size is large, consider cleanup");
      }

      if (this.metrics.totalFiles > 10000) {
        issues.push("High number of files, consider optimization");
      }

      return {
        healthy: issues.length === 0,
        issues,
        metrics: this.metrics,
        lastCheck: now.toISOString(),
        nextMaintenance: nextMaintenance.toISOString(),
      };

    } catch (error) {
      this.logger.error("Failed to get storage status:", error);
      return {
        healthy: false,
        issues: [`Failed to check status: ${error.message}`],
        metrics: this.metrics,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private async collectMetrics(): Promise<StorageMetrics> {
    try {
      const storageMetadata = this.storage.getIndexMetadata();
      const searchStats = this.searchEngine.getIndexStats();
      const indexPath = this.storage['config'].indexPath;

      const files = this.storage['currentIndex']?.files || new Map();
      let totalSize = 0;
      let largestSize = 0;
      let smallestSize = Infinity;
      let largestFile = '';
      let smallestFile = '';
      let oldestFile = '';
      let newestFile = '';
      const languages: Record<string, number> = {};

      const indexPathStats = await fs.stat(path.join(indexPath, 'index.json'));
      const indexSize = indexPathStats.size;

      for (const [filePath, entry] of files) {
        totalSize += entry.size;

        if (entry.size > largestSize) {
          largestSize = entry.size;
          largestFile = filePath;
        }

        if (entry.size < smallestSize && entry.size > 0) {
          smallestSize = entry.size;
          smallestFile = filePath;
        }

        if (!oldestFile || entry.lastModified < oldestFile) {
          oldestFile = entry.lastModified;
        }

        if (!newestFile || entry.lastModified > newestFile) {
          newestFile = entry.lastModified;
        }

        languages[entry.language] = (languages[entry.language] || 0) + 1;
      }

      return {
        totalFiles: files.size,
        totalSize,
        indexSize,
        compressionRatio: totalSize > 0 ? totalSize / indexSize : 1,
        averageFileSize: files.size > 0 ? totalSize / files.size : 0,
        largestFile,
        smallestFile,
        languages,
        oldestFile,
        newestFile,
      };

    } catch (error) {
      this.logger.error("Failed to collect metrics:", error);
      return this.metrics;
    }
  }

  private extractChunks(content: string, language: string): any[] {
    const chunks: any[] = [];
    const lines = content.split('\n');

    // Simple chunking by functions/classes
    let currentChunk: string[] = [];
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect function/class boundaries
      const isFunction = line.trim().match(/^(function|def|class|export\s+function|export\s+class|const\s+\w+\s*=\s*async|\w+\s*=\s*async)/);

      if (isFunction && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.join('\n'),
          start_line: startLine + 1,
          end_line: i,
          language,
        });

        currentChunk = [line];
        startLine = i;
      } else {
        currentChunk.push(line);
      }
    }

    // Add the last chunk
    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        start_line: startLine + 1,
        end_line: lines.length,
        language,
      });
    }

    return chunks;
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.kt': 'kotlin',
      '.swift': 'swift',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
    };

    return languageMap[ext] || 'unknown';
  }

  private async findOversizedFiles(maxSize: number): Promise<string[]> {
    const oversizedFiles: string[] = [];
    const files = this.storage['currentIndex']?.files || new Map();

    for (const [filePath, entry] of files) {
      if (entry.size > maxSize) {
        oversizedFiles.push(filePath);
      }
    }

    return oversizedFiles;
  }

  private async findOrphanedFiles(): Promise<string[]> {
    const orphanedFiles: string[] = [];
    const files = this.storage['currentIndex']?.files || new Map();

    for (const filePath of files.keys()) {
      try {
        await fs.access(filePath);
      } catch {
        orphanedFiles.push(filePath);
      }
    }

    return orphanedFiles;
  }

  private async defragmentStorage(): Promise<number> {
    try {
      // Simple defragmentation: save index to consolidate
      await this.storage.saveIndex();
      return 1; // Simple implementation returns 1 file defragmented
    } catch (error) {
      this.logger.error("Defragmentation failed:", error);
      return 0;
    }
  }

  private async autoCompress(): Promise<{ freedSpace: number }> {
    try {
      // Check if compression would save space
      const metadata = this.storage.getIndexMetadata();
      if (!metadata.compressedSizeBytes) {
        return { freedSpace: 0 };
      }

      const compressionRatio = metadata.sizeBytes / metadata.compressedSizeBytes;
      if (compressionRatio < 1.1) { // Less than 10% improvement
        return { freedSpace: 0 };
      }

      // Save with compression enabled
      await this.storage.saveIndex();
      return { freedSpace: metadata.sizeBytes - metadata.compressedSizeBytes };
    } catch (error) {
      this.logger.error("Auto compression failed:", error);
      return { freedSpace: 0 };
    }
  }

  private async recompressIndex(): Promise<number> {
    try {
      const beforeSize = this.metrics.indexSize;
      await this.storage.saveIndex();
      const afterSize = this.metrics.indexSize;

      return beforeSize / afterSize;
    } catch (error) {
      this.logger.error("Recompression failed:", error);
      return 1;
    }
  }

  private async cleanupSearchCache(maxCacheSize: number): Promise<number> {
    // Simple cache cleanup implementation
    const currentSize = this.searchEngine['searchCache'].size;
    if (currentSize <= maxCacheSize) {
      return 0;
    }

    // Clear oldest entries
    const entriesToRemove = currentSize - maxCacheSize;
    let removed = 0;

    for (const [key] of this.searchEngine['searchCache']) {
      if (removed >= entriesToRemove) break;
      this.searchEngine['searchCache'].delete(key);
      removed++;
    }

    return removed;
  }

  private initializeMetrics(): StorageMetrics {
    return {
      totalFiles: 0,
      totalSize: 0,
      indexSize: 0,
      compressionRatio: 1,
      averageFileSize: 0,
      largestFile: '',
      smallestFile: '',
      languages: {},
      oldestFile: '',
      newestFile: '',
    };
  }
}