import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import { promisify } from 'util';
import { Logger } from '../src/utils.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface StorageConfig {
  indexPath: string;
  compression: boolean;
  chunkSize: number;
  maxFileSize: number;
  backupCount: number;
  cacheSize: number;
}

export interface IndexMetadata {
  version: string;
  created: string;
  modified: string;
  totalFiles: number;
  totalChunks: number;
  languages: Record<string, number>;
  sizeBytes: number;
  compressedSizeBytes?: number;
}

export interface IndexPathEntry {
  filePath: string;
  chunks: number;
  size: number;
  lastModified: string;
  hash: string;
  language: string;
  compressed: boolean;
}

export interface OptimizedIndex {
  metadata: IndexMetadata;
  files: Map<string, IndexPathEntry>;
  textIndex: Map<string, Set<string>>;
  languageIndex: Map<string, Set<string>>;
}

const DEFAULT_CONFIG: StorageConfig = {
  indexPath: './.prism-index',
  compression: true,
  chunkSize: 1024 * 1024, // 1MB chunks
  maxFileSize: 10 * 1024 * 1024, // 10MB max per file
  backupCount: 5,
  cacheSize: 1000,
};

export class OptimizedJSONStorage {
  private logger: Logger;
  private config: StorageConfig;
  private currentIndex: OptimizedIndex | null = null;
  private fileCache = new Map<string, Buffer>();
  private textIndexCache = new Map<string, Set<string>>();
  private compressionEnabled: boolean = true;

  constructor(config?: Partial<StorageConfig>) {
    this.logger = new Logger("OptimizedJSONStorage");
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.compressionEnabled = this.config.compression;
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.config.indexPath, { recursive: true });

      // Create backup directory
      const backupDir = path.join(this.config.indexPath, 'backups');
      await fs.mkdir(backupDir, { recursive: true });

      // Create cache directory
      const cacheDir = path.join(this.config.indexPath, 'cache');
      await fs.mkdir(cacheDir, { recursive: true });

      // Load existing index
      await this.loadIndex();

      this.logger.info(`Optimized storage initialized with config:`, {
        indexPath: this.config.indexPath,
        compression: this.compressionEnabled,
        chunkSize: this.config.chunkSize,
      });
    } catch (error) {
      this.logger.error("Failed to initialize storage:", error);
      throw error;
    }
  }

  async loadIndex(): Promise<void> {
    try {
      const indexPath = this.getIndexFilePath();
      const indexPathStats = await fs.stat(indexPath);

      this.logger.debug(`Loading index from ${indexPath} (${indexPathStats.size} bytes)`);

      const compressed = this.compressionEnabled && indexPathStats.size > this.config.chunkSize;
      let content: Buffer;

      if (compressed) {
        const compressedContent = await fs.readFile(indexPath);
        content = await gunzip(compressedContent);
        this.logger.debug(`Decompressed index from ${indexPathStats.size} to ${content.length} bytes`);
      } else {
        content = await fs.readFile(indexPath);
      }

      const jsonString = content.toString('utf-8');
      const indexData = JSON.parse(jsonString);

      // Validate and construct optimized index
      this.currentIndex = this.validateAndConstructIndex(indexData);

      // Load cache
      await this.loadCache();

      this.logger.info(`Loaded index with ${this.currentIndex.files.size} files`);
    } catch (error) {
      this.logger.debug("No existing index found, creating new one");
      this.currentIndex = this.createNewIndex();
    }
  }

  async saveIndex(): Promise<void> {
    if (!this.currentIndex) {
      throw new Error("No index loaded");
    }

    try {
      const indexPath = this.getIndexFilePath();
      const backupDir = path.join(this.config.indexPath, 'backups');

      // Create backup
      await this.createBackup(indexPath);

      // Prepare JSON content
      const jsonString = JSON.stringify(this.currentIndex, null, 2);
      let content = Buffer.from(jsonString, 'utf-8');

      // Compress if enabled and size exceeds threshold
      if (this.compressionEnabled && content.length > this.config.chunkSize) {
        content = await gzip(content);
        this.logger.debug(`Compressed index from ${jsonString.length} to ${content.length} bytes`);
      }

      // Write to disk
      await fs.writeFile(indexPath, content);

      // Update cache
      await this.saveCache();

      this.logger.info(`Saved index with ${this.currentIndex.files.size} files`);
    } catch (error) {
      this.logger.error("Failed to save index:", error);
      throw error;
    }
  }

  async addFile(filePath: string, chunks: any[], content: string): Promise<void> {
    if (!this.currentIndex) {
      throw new Error("Index not loaded");
    }

    try {
      const stats = await fs.stat(filePath);
      const hash = await this.calculateHash(content);

      // Check file size limit
      if (stats.size > this.config.maxFileSize) {
        this.logger.warn(`File ${filePath} exceeds size limit, skipping`);
        return;
      }

      // Create file entry
      const entry: IndexPathEntry = {
        filePath,
        chunks: chunks.length,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        hash,
        language: this.detectLanguage(filePath),
        compressed: this.compressionEnabled,
      };

      // Add to files map
      this.currentIndex.files.set(filePath, entry);

      // Update metadata
      this.currentIndex.metadata.totalFiles++;
      this.currentIndex.metadata.totalChunks += chunks.length;
      this.currentIndex.metadata.sizeBytes += stats.size;
      this.currentIndex.metadata.modified = new Date().toISOString();

      // Update language index
      const language = entry.language;
      if (!this.currentIndex.languageIndex.has(language)) {
        this.currentIndex.languageIndex.set(language, new Set());
      }
      this.currentIndex.languageIndex.get(language)!.add(filePath);

      // Update text index with chunk content
      for (const chunk of chunks) {
        await this.updateTextIndex(filePath, chunk.content);
      }

      // Cache the file content
      if (this.fileCache.size < this.config.cacheSize) {
        this.fileCache.set(filePath, Buffer.from(content, 'utf-8'));
      }

      this.logger.debug(`Added file ${filePath} with ${chunks.length} chunks`);
    } catch (error) {
      this.logger.error(`Failed to add file ${filePath}:`, error);
      throw error;
    }
  }

  async removeFile(filePath: string): Promise<void> {
    if (!this.currentIndex) {
      throw new Error("Index not loaded");
    }

    try {
      const entry = this.currentIndex.files.get(filePath);
      if (!entry) {
        this.logger.debug(`File ${filePath} not found in index`);
        return;
      }

      // Remove from files map
      this.currentIndex.files.delete(filePath);

      // Update metadata
      this.currentIndex.metadata.totalFiles--;
      this.currentIndex.metadata.totalChunks -= entry.chunks;
      this.currentIndex.metadata.sizeBytes -= entry.size;
      this.currentIndex.metadata.modified = new Date().toISOString();

      // Remove from language index
      const languageSet = this.currentIndex.languageIndex.get(entry.language);
      if (languageSet) {
        languageSet.delete(filePath);
        if (languageSet.size === 0) {
          this.currentIndex.languageIndex.delete(entry.language);
        }
      }

      // Remove from text index
      this.removeTextIndex(filePath);

      // Remove from cache
      this.fileCache.delete(filePath);

      this.logger.debug(`Removed file ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to remove file ${filePath}:`, error);
      throw error;
    }
  }

  async getFileContent(filePath: string): Promise<string | null> {
    if (!this.currentIndex) {
      return null;
    }

    // Check cache first
    if (this.fileCache.has(filePath)) {
      const content = this.fileCache.get(filePath)!;
      return content.toString('utf-8');
    }

    try {
      // For large files, read directly
      const stats = await fs.stat(filePath);
      if (stats.size > this.config.chunkSize) {
        const content = await fs.readFile(filePath, 'utf-8');
        this.fileCache.set(filePath, Buffer.from(content));
        return content;
      }

      return null; // Let caller handle actual file reading
    } catch (error) {
      this.logger.error(`Failed to get file content for ${filePath}:`, error);
      return null;
    }
  }

  searchFiles(query: string, options: {
    language?: string;
    limit?: number;
    minScore?: number;
  } = {}): Array<{ filePath: string; score: number; entry: IndexPathEntry }> {
    if (!this.currentIndex) {
      return [];
    }

    const results: Array<{ filePath: string; score: number; entry: IndexPathEntry }> = [];
    const normalizedQuery = query.toLowerCase();
    const { language, limit = 10, minScore = 0 } = options;

    // Search through text index
    const matchingFiles = new Set<string>();

    // Get files containing query terms
    const queryTerms = normalizedQuery.split(/\s+/).filter(term => term.length > 2);

    for (const term of queryTerms) {
      const files = this.textIndexCache.get(term);
      if (files) {
        files.forEach(file => matchingFiles.add(file));
      }
    }

    // Calculate scores and apply filters
    for (const filePath of matchingFiles) {
      const entry = this.currentIndex.files.get(filePath);
      if (!entry) continue;

      // Apply language filter
      if (language && entry.language !== language) continue;

      // Calculate relevance score
      const score = this.calculateRelevanceScore(filePath, normalizedQuery);

      if (score >= minScore) {
        results.push({ filePath, score, entry });
      }
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  async getFilesByLanguage(language: string): Promise<IndexPathEntry[]> {
    if (!this.currentIndex) {
      return [];
    }

    const files = this.currentIndex.languageIndex.get(language);
    if (!files) {
      return [];
    }

    return Array.from(files).map(filePath => this.currentIndex!.files.get(filePath)!);
  }

  getIndexMetadata(): IndexMetadata | null {
    return this.currentIndex?.metadata || null;
  }

  async validateIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
    stats: {
      totalFiles: number;
      totalChunks: number;
      totalSize: number;
      languages: number;
      duplicates: number;
    };
  }> {
    if (!this.currentIndex) {
      return {
        valid: false,
        issues: ['No index loaded'],
        stats: {
          totalFiles: 0,
          totalChunks: 0,
          totalSize: 0,
          languages: 0,
          duplicates: 0,
        },
      };
    }

    const issues: string[] = [];
    const fileHashes = new Map<string, string[]>();
    let duplicates = 0;

    // Check for duplicate files
    for (const [filePath, entry] of this.currentIndex.files) {
      if (!fileHashes.has(entry.hash)) {
        fileHashes.set(entry.hash, []);
      }
      fileHashes.get(entry.hash)!.push(filePath);
    }

    // Count duplicates
    for (const [hash, files] of fileHashes) {
      if (files.length > 1) {
        duplicates++;
        issues.push(`Duplicate content found in: ${files.join(', ')}`);
      }
    }

    // Validate metadata
    let calculatedTotalFiles = 0;
    let calculatedTotalChunks = 0;
    let calculatedTotalSize = 0;

    for (const entry of this.currentIndex.files.values()) {
      calculatedTotalFiles++;
      calculatedTotalChunks += entry.chunks;
      calculatedTotalSize += entry.size;
    }

    if (calculatedTotalFiles !== this.currentIndex.metadata.totalFiles) {
      issues.push(`Metadata mismatch: files count`);
    }

    if (calculatedTotalChunks !== this.currentIndex.metadata.totalChunks) {
      issues.push(`Metadata mismatch: chunks count`);
    }

    if (calculatedTotalSize !== this.currentIndex.metadata.sizeBytes) {
      issues.push(`Metadata mismatch: size calculation`);
    }

    return {
      valid: issues.length === 0,
      issues,
      stats: {
        totalFiles: calculatedTotalFiles,
        totalChunks: calculatedTotalChunks,
        totalSize: calculatedTotalSize,
        languages: this.currentIndex.languageIndex.size,
        duplicates,
      },
    };
  }

  async cleanup(): Promise<{
    removedFiles: number;
    freedSpace: number;
  }> {
    if (!this.currentIndex) {
      return { removedFiles: 0, freedSpace: 0 };
    }

    const removedFiles: string[] = [];
    let freedSpace = 0;

    // Remove files that no longer exist
    for (const [filePath, entry] of this.currentIndex.files.entries()) {
      try {
        await fs.access(filePath);
      } catch {
        // File doesn't exist, remove from index
        removedFiles.push(filePath);
        freedSpace += entry.size;
      }
    }

    // Remove non-existent files
    for (const filePath of removedFiles) {
      await this.removeFile(filePath);
    }

    // Clean old backups
    await this.cleanupOldBackups();

    return {
      removedFiles: removedFiles.length,
      freedSpace,
    };
  }

  private async createBackup(indexPath: string): Promise<void> {
    const backupDir = path.join(this.config.indexPath, 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `index-${timestamp}.json${this.compressionEnabled ? '.gz' : ''}`);

    try {
      // Copy current index
      const content = await fs.readFile(indexPath);
      await fs.writeFile(backupPath, content);

      this.logger.debug(`Created backup: ${backupPath}`);
    } catch (error) {
      this.logger.warn(`Failed to create backup: ${error.message}`);
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    const backupDir = path.join(this.config.indexPath, 'backups');
    try {
      const files = await fs.readdir(backupDir);
      const backups = files
        .filter(f => f.startsWith('index-'))
        .map(f => ({ name: f, path: path.join(backupDir, f) }))
        .sort((a, b) => b.path.localeCompare(a.path));

      // Remove old backups
      while (backups.length > this.config.backupCount) {
        const backup = backups.pop()!;
        await fs.unlink(backup.path);
        this.logger.debug(`Removed old backup: ${backup.name}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup backups: ${error.message}`);
    }
  }

  private async loadCache(): Promise<void> {
    const cacheDir = path.join(this.config.indexPath, 'cache');
    try {
      const files = await fs.readdir(cacheDir);
      for (const file of files) {
        const filePath = path.join(cacheDir, file);
        const content = await fs.readFile(filePath);
        this.fileCache.set(file, content);
      }
    } catch (error) {
      this.logger.debug(`No cache found or failed to load: ${error.message}`);
    }
  }

  private async saveCache(): Promise<void> {
    const cacheDir = path.join(this.config.indexPath, 'cache');
    try {
      // Clear existing cache
      await fs.rm(cacheDir, { recursive: true, force: true });
      await fs.mkdir(cacheDir, { recursive: true });

      // Save current cache
      for (const [filePath, content] of this.fileCache.entries()) {
        const fileName = path.basename(filePath) + '.cache';
        await fs.writeFile(path.join(cacheDir, fileName), content);
      }
    } catch (error) {
      this.logger.warn(`Failed to save cache: ${error.message}`);
    }
  }

  private async updateTextIndex(filePath: string, content: string): Promise<void> {
    const words = content.toLowerCase().split(/\W+/).filter(word => word.length > 2);

    for (const word of words) {
      if (!this.textIndexCache.has(word)) {
        this.textIndexCache.set(word, new Set());
      }
      this.textIndexCache.get(word)!.add(filePath);
    }
  }

  private removeTextIndex(filePath: string): void {
    for (const files of this.textIndexCache.values()) {
      files.delete(filePath);
    }
  }

  private calculateRelevanceScore(filePath: string, query: string): number {
    // Simple relevance scoring based on query term frequency
    const content = this.fileCache.get(filePath);
    if (!content) return 0;

    const text = content.toString('utf-8').toLowerCase();
    const queryTerms = query.split(/\s+/).filter(term => term.length > 2);

    let score = 0;
    for (const term of queryTerms) {
      const occurrences = (text.match(new RegExp(term, 'g')) || []).length;
      score += occurrences;
    }

    // Normalize by file length
    return score / text.length;
  }

  private async calculateHash(content: string): Promise<string> {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex').substring(0, 16); // Shortened hash for performance
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

  private getIndexFilePath(): string {
    return path.join(this.config.indexPath, `index.json${this.compressionEnabled ? '.gz' : ''}`);
  }

  private validateAndConstructIndex(data: any): OptimizedIndex {
    if (!data || !data.metadata || !data.files) {
      throw new Error('Invalid index format');
    }

    return {
      metadata: {
        version: data.metadata.version || '1.0.0',
        created: data.metadata.created || new Date().toISOString(),
        modified: data.metadata.modified || new Date().toISOString(),
        totalFiles: data.metadata.totalFiles || 0,
        totalChunks: data.metadata.totalChunks || 0,
        languages: data.metadata.languages || {},
        sizeBytes: data.metadata.sizeBytes || 0,
        compressedSizeBytes: data.metadata.compressedSizeBytes,
      },
      files: new Map(Object.entries(data.files)),
      textIndex: new Map(Object.entries(data.textIndex || {})),
      languageIndex: new Map(Object.entries(data.languageIndex || {})),
    };
  }

  private createNewIndex(): OptimizedIndex {
    return {
      metadata: {
        version: '1.0.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        totalFiles: 0,
        totalChunks: 0,
        languages: {},
        sizeBytes: 0,
      },
      files: new Map(),
      textIndex: new Map(),
      languageIndex: new Map(),
    };
  }
}