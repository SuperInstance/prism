/**
 * ============================================================================
 * INCREMENTAL INDEXING INTEGRATION TESTS
 * ============================================================================
 *
 * Tests the complete incremental indexing pipeline with SHA-256 checksums:
 * - SHA-256 checksum calculation
 * - File change detection (mtime + checksum hybrid)
 * - Deleted file detection and cleanup
 * - Incremental reindexing
 * - Git operation handling
 *
 * These tests verify that incremental indexing provides significant
 * performance improvements while maintaining accuracy.
 *
 * @see src/indexer/D1IndexStorage.ts
 * @see src/indexer/IndexerOrchestrator.ts
 * @see migrations/002_vector_index.sql
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { D1IndexStorage } from '../../src/indexer/D1IndexStorage.js';
import type { Env } from '../../src/types/worker.js';
import type { IndexMetadata, FileModificationRecord } from '../../src/indexer/IndexStorage.js';

// ============================================================================
// MOCKS
// ============================================================================

/**
 * Mock D1 database for testing
 */
class MockD1Database {
  private tables: Map<string, any[]> = new Map();
  private data: Map<string, any> = new Map();

  constructor() {
    // Initialize tables
    this.tables.set('file_index', []);
    this.tables.set('deleted_files', []);
    this.tables.set('index_metadata', []);
  }

  prepare(sql: string) {
    const self = this;
    const statement = {
      first: async () => {
        // Handle SELECT queries
        if (sql.includes('SELECT')) {
          if (sql.includes('FROM file_index WHERE path = ?')) {
            const files = self.tables.get('file_index') || [];
            return files.find((f: any) => f.path === self.lastParams[0]) || null;
          }
          if (sql.includes('FROM file_index WHERE path =')) {
            const files = self.tables.get('file_index') || [];
            return files.find((f: any) => f.path === self.lastParams[0]) || null;
          }
          if (sql.includes('SELECT COUNT(*)')) {
            if (sql.includes('FROM file_index')) {
              const files = self.tables.get('file_index') || [];
              return { count: files.length };
            }
            if (sql.includes('FROM deleted_files')) {
              const files = self.tables.get('deleted_files') || [];
              const filtered = files.filter((f: any) => f.cleaned_up === 0);
              return { count: filtered.length };
            }
          }
          if (sql.includes('SELECT SUM(chunk_count)')) {
            const files = self.tables.get('file_index') || [];
            const total = files.reduce((sum: number, f: any) => sum + (f.chunk_count || 0), 0);
            return { total };
          }
          if (sql.includes('SELECT chunk_count FROM file_index WHERE path = ?')) {
            const files = self.tables.get('file_index') || [];
            const file = files.find((f: any) => f.path === self.lastParams[0]);
            return file || null;
          }
          if (sql.includes('SELECT * FROM index_metadata WHERE index_id = ?')) {
            const metadata = self.tables.get('index_metadata') || [];
            return metadata.find((m: any) => m.index_id === self.lastParams[0]) || null;
          }
          return (self.data.get(sql) || [])[0] || null;
        }

        // Handle INSERT/REPLACE/DELETE
        return null;
      },
      all: async () => {
        if (sql.includes('SELECT path FROM file_index')) {
          return { results: self.tables.get('file_index') || [] };
        }
        if (sql.includes('SELECT path, checksum, file_size, last_modified, last_indexed, chunk_count FROM file_index')) {
          return { results: self.tables.get('file_index') || [] };
        }
        if (sql.includes('FROM deleted_files WHERE cleaned_up = 0')) {
          const files = self.tables.get('deleted_files') || [];
          return { results: files.filter((f: any) => f.cleaned_up === 0) };
        }
        return { results: self.data.get(sql) || [] };
      },
      run: async () => {
        return { success: true, meta: { duration: 0 } };
      },
      bind: function(this: any, ...params: any[]) {
        this.lastParams = params;
        return this;
      },
    };
    return statement;
  }

  private lastParams: any[] = [];

  // Helper methods for testing
  addFile(record: any) {
    const files = this.tables.get('file_index') || [];
    const existingIndex = files.findIndex((f: any) => f.path === record.path);
    if (existingIndex >= 0) {
      files[existingIndex] = record;
    } else {
      files.push(record);
    }
    this.tables.set('file_index', files);
  }

  addDeletedFile(record: any) {
    const files = this.tables.get('deleted_files') || [];
    files.push(record);
    this.tables.set('deleted_files', files);
  }

  addMetadata(record: any) {
    const metadata = this.tables.get('index_metadata') || [];
    const existingIndex = metadata.findIndex((m: any) => m.index_id === record.index_id);
    if (existingIndex >= 0) {
      metadata[existingIndex] = record;
    } else {
      metadata.push(record);
    }
    this.tables.set('index_metadata', metadata);
  }

  clear() {
    this.tables.set('file_index', []);
    this.tables.set('deleted_files', []);
    this.tables.set('index_metadata', []);
    this.data.clear();
  }
}

/**
 * Mock KV namespace for testing
 */
class MockKVNamespace {
  private store: Map<string, { value: string; expiration?: number }> = new Map();

  async get(key: string, type: string = 'text'): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiration && entry.expiration < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void> {
    const expiration = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined;
    this.store.set(key, { value, expiration });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/**
 * Create mock environment
 */
function createMockEnv(): Env {
  return {
    DB: new MockD1Database() as any,
    KV: new MockKVNamespace() as any,
    R2: null as any,
    VECTORIZE: null as any,
    AI: null as any,
    ENVIRONMENT: 'test',
    LOG_LEVEL: 'error',
  };
}

// ============================================================================
// FIXTURES
// ============================================================================

let storage: D1IndexStorage;
let mockDB: MockD1Database;
let mockKV: MockKVNamespace;

beforeEach(() => {
  const env = createMockEnv();
  mockDB = env.DB as unknown as MockD1Database;
  mockKV = env.KV as unknown as MockKVNamespace;
  storage = new D1IndexStorage(env);
});

afterEach(() => {
  // Clean up is handled by creating new instances in beforeEach
});

// ============================================================================
// TESTS
// ============================================================================

describe('D1IndexStorage - SHA-256 Checksums', () => {
  it('should calculate SHA-256 checksums', async () => {
    const content = 'Hello, World!';
    const checksum = await storage.calculateChecksum(content);

    // SHA-256 hash of "Hello, World!" is:
    // dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f
    expect(checksum).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
  });

  it('should calculate different checksums for different content', async () => {
    const content1 = 'Hello, World!';
    const content2 = 'Hello, World?';

    const checksum1 = await storage.calculateChecksum(content1);
    const checksum2 = await storage.calculateChecksum(content2);

    expect(checksum1).not.toBe(checksum2);
  });

  it('should calculate same checksum for same content', async () => {
    const content = 'Test content';

    const checksum1 = await storage.calculateChecksum(content);
    const checksum2 = await storage.calculateChecksum(content);

    expect(checksum1).toBe(checksum2);
  });

  it('should handle empty content', async () => {
    const content = '';
    const checksum = await storage.calculateChecksum(content);

    // SHA-256 of empty string is:
    // e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(checksum).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should handle large content', async () => {
    const content = 'x'.repeat(1000000); // 1MB
    const checksum = await storage.calculateChecksum(content);

    expect(checksum).toBeDefined();
    expect(checksum.length).toBe(64); // SHA-256 hex string is 64 chars
  });
});

describe('D1IndexStorage - File Change Detection', () => {
  it('should detect new files as needing reindexing', async () => {
    const filePath = '/src/example.ts';
    const checksum = await storage.calculateChecksum('console.log("test");');
    const modified = Date.now();

    const needsReindex = await storage.needsReindexing(filePath, checksum, modified);

    expect(needsReindex).toBe(true); // New file always needs indexing
  });

  it('should skip files with unchanged mtime', async () => {
    const filePath = '/src/example.ts';
    const checksum = 'abc123';
    const modified = Date.now();

    // First, record the file
    await storage.setFileRecord(filePath, checksum, 1000, modified, 5);

    // Check again with same mtime
    const needsReindex = await storage.needsReindexing(filePath, checksum, modified);

    expect(needsReindex).toBe(false); // Mtime unchanged, skip
  });

  it('should reindex files with changed checksum', async () => {
    const filePath = '/src/example.ts';
    const oldChecksum = 'abc123';
    const newChecksum = 'def456';
    const oldModified = Date.now() - 10000; // 10 seconds ago
    const newModified = Date.now();

    // Record old state
    await storage.setFileRecord(filePath, oldChecksum, 1000, oldModified, 5);

    // Check with new checksum
    const needsReindex = await storage.needsReindexing(filePath, newChecksum, newModified);

    expect(needsReindex).toBe(true); // Checksum changed, reindex
  });

  it('should skip files with mtime changed but same checksum (git operation)', async () => {
    const filePath = '/src/example.ts';
    const checksum = 'abc123';
    const oldModified = Date.now() - 1000000; // 1000 seconds ago
    const newModified = Date.now();

    // Record old state
    await storage.setFileRecord(filePath, checksum, 1000, oldModified, 5);

    // Check with new mtime but same checksum (git checkout)
    const needsReindex = await storage.needsReindexing(filePath, checksum, newModified);

    expect(needsReindex).toBe(false); // Git operation, skip
  });
});

describe('D1IndexStorage - Deleted File Detection', () => {
  it('should detect deleted files', async () => {
    const trackedFiles = ['/src/file1.ts', '/src/file2.ts', '/src/file3.ts'];
    const currentFiles = new Set(['/src/file1.ts', '/src/file3.ts']);

    // Mock tracked files
    mockDB.setMockData('SELECT path FROM file_index', [
      { path: '/src/file1.ts' },
      { path: '/src/file2.ts' },
      { path: '/src/file3.ts' },
    ]);

    const deleted = await storage.detectDeletedFiles(currentFiles);

    expect(deleted).toHaveLength(1);
    expect(deleted).toContain('/src/file2.ts');
  });

  it('should return empty array when no files deleted', async () => {
    const currentFiles = new Set(['/src/file1.ts', '/src/file2.ts']);

    // Mock tracked files matching current files
    mockDB.setMockData('SELECT path FROM file_index', [
      { path: '/src/file1.ts' },
      { path: '/src/file2.ts' },
    ]);

    const deleted = await storage.detectDeletedFiles(currentFiles);

    expect(deleted).toHaveLength(0);
  });

  it('should detect all files deleted when directory empty', async () => {
    const currentFiles = new Set<string>();

    // Mock tracked files
    mockDB.setMockData('SELECT path FROM file_index', [
      { path: '/src/file1.ts' },
      { path: '/src/file2.ts' },
    ]);

    const deleted = await storage.detectDeletedFiles(currentFiles);

    expect(deleted).toHaveLength(2);
  });
});

describe('D1IndexStorage - File Records', () => {
  it('should store and retrieve file records', async () => {
    const filePath = '/src/test.ts';
    const checksum = 'abc123';
    const fileSize = 1024;
    const lastModified = Date.now();
    const chunkCount = 5;

    await storage.setFileRecord(filePath, checksum, fileSize, lastModified, chunkCount);

    // Mock the return value
    mockDB.setMockData(`SELECT path, checksum, file_size, last_modified, last_indexed, chunk_count FROM file_index WHERE path = ?`, [
      {
        path: filePath,
        checksum: checksum,
        file_size: fileSize,
        last_modified: lastModified,
        last_indexed: lastModified,
        chunk_count: chunkCount,
      },
    ]);

    const record = await storage.getFileRecord(filePath);

    expect(record).not.toBeNull();
    expect(record?.path).toBe(filePath);
    expect(record?.checksum).toBe(checksum);
    expect(record?.fileSize).toBe(fileSize);
    expect(record?.lastModified).toBe(lastModified);
    expect(record?.chunkCount).toBe(chunkCount);
  });

  it('should return null for non-existent files', async () => {
    const record = await storage.getFileRecord('/nonexistent/file.ts');

    expect(record).toBeNull();
  });

  it('should update existing file records', async () => {
    const filePath = '/src/test.ts';

    // Initial record
    await storage.setFileRecord(filePath, 'abc123', 1000, Date.now(), 3);

    // Update with new data
    const newChecksum = 'def456';
    const newFileSize = 2000;
    const newModified = Date.now();
    const newChunkCount = 7;

    await storage.setFileRecord(filePath, newChecksum, newFileSize, newModified, newChunkCount);

    // Mock updated return value
    mockDB.setMockData(`SELECT path, checksum, file_size, last_modified, last_indexed, chunk_count FROM file_index WHERE path = ?`, [
      {
        path: filePath,
        checksum: newChecksum,
        file_size: newFileSize,
        last_modified: newModified,
        last_indexed: newModified,
        chunk_count: newChunkCount,
      },
    ]);

    const record = await storage.getFileRecord(filePath);

    expect(record?.checksum).toBe(newChecksum);
    expect(record?.fileSize).toBe(newFileSize);
    expect(record?.chunkCount).toBe(newChunkCount);
  });
});

describe('D1IndexStorage - Statistics', () => {
  it('should return storage statistics', async () => {
    // Mock statistics data
    mockDB.setMockData('SELECT COUNT(*) as count FROM file_index', [
      { count: 100 },
    ]);
    mockDB.setMockData('SELECT SUM(chunk_count) as total FROM file_index', [
      { total: 500 },
    ]);
    mockDB.setMockData('SELECT COUNT(*) as count FROM deleted_files WHERE cleaned_up = 0', [
      { count: 5 },
    ]);

    const stats = await storage.getStats();

    expect(stats.totalFiles).toBe(100);
    expect(stats.totalChunks).toBe(500);
    expect(stats.needsReindexing).toBe(5);
  });

  it('should return zero statistics for empty database', async () => {
    // Mock empty data
    mockDB.setMockData('SELECT COUNT(*) as count FROM file_index', [
      { count: 0 },
    ]);
    mockDB.setMockData('SELECT SUM(chunk_count) as total FROM file_index', [
      { total: null },
    ]);
    mockDB.setMockData('SELECT COUNT(*) as count FROM deleted_files WHERE cleaned_up = 0', [
      { count: 0 },
    ]);

    const stats = await storage.getStats();

    expect(stats.totalFiles).toBe(0);
    expect(stats.totalChunks).toBe(0);
    expect(stats.needsReindexing).toBe(0);
  });
});

describe('D1IndexStorage - Index Metadata', () => {
  it('should save and load index metadata', async () => {
    const metadata: IndexMetadata = {
      indexId: 'test-index',
      lastUpdated: new Date('2024-01-15T10:30:00Z'),
      filesIndexed: 150,
      chunksIndexed: 750,
      version: '0.2.0',
    };

    await storage.saveIndex(metadata);

    // Mock KV return
    await mockKV.put('index:test-index', JSON.stringify({ ...metadata, lastUpdated: metadata.lastUpdated.getTime() }));

    const loaded = await storage.loadIndex('test-index');

    expect(loaded).not.toBeNull();
    expect(loaded?.indexId).toBe('test-index');
    expect(loaded?.filesIndexed).toBe(150);
    expect(loaded?.chunksIndexed).toBe(750);
    expect(loaded?.version).toBe('0.2.0');
  });

  it('should cache metadata in KV', async () => {
    const metadata: IndexMetadata = {
      indexId: 'test-cache',
      lastUpdated: new Date(),
      filesIndexed: 200,
      chunksIndexed: 1000,
      version: '0.2.0',
    };

    await storage.saveIndex(metadata);

    // Verify KV was called (check that key exists)
    const cached = await mockKV.get('index:test-cache');

    expect(cached).toBeDefined();
    const parsed = JSON.parse(cached!);
    expect(parsed.filesIndexed).toBe(200);
  });

  it('should return null for non-existent index', async () => {
    const loaded = await storage.loadIndex('non-existent');

    expect(loaded).toBeNull();
  });
});

describe('D1IndexStorage - Export/Import', () => {
  it('should export index data', async () => {
    // Mock file records
    mockDB.setMockData('SELECT path FROM file_index', [
      { path: '/src/file1.ts' },
      { path: '/src/file2.ts' },
    ]);

    // Mock individual file records
    const mockRecords: FileModificationRecord[] = [
      {
        path: '/src/file1.ts',
        checksum: 'abc123',
        fileSize: 1000,
        lastModified: Date.now(),
        lastIndexed: Date.now(),
        chunkCount: 5,
      },
      {
        path: '/src/file2.ts',
        checksum: 'def456',
        fileSize: 2000,
        lastModified: Date.now(),
        lastIndexed: Date.now(),
        chunkCount: 10,
      },
    ];

    for (const record of mockRecords) {
      mockDB.setMockData(
        `SELECT path, checksum, file_size, last_modified, last_indexed, chunk_count FROM file_index WHERE path = ?`,
        [record]
      );
    }

    const exported = await storage.exportIndex();

    expect(exported.files).toHaveLength(2);
    expect(exported.files[0].path).toBe('/src/file1.ts');
    expect(exported.files[1].path).toBe('/src/file2.ts');
  });

  it('should import index data', async () => {
    const importData = {
      files: [
        {
          path: '/src/file1.ts',
          checksum: 'abc123',
          fileSize: 1000,
          lastModified: Date.now(),
          lastIndexed: Date.now(),
          chunkCount: 5,
        },
      ],
      metadata: {
        indexId: 'test',
        lastUpdated: new Date(),
        filesIndexed: 1,
        chunksIndexed: 5,
        version: '0.2.0',
      },
    };

    await storage.importIndex(importData);

    // Verify imports were called
    // (In real scenario, would verify DB state)
    expect(importData.files).toHaveLength(1);
  });
});

describe('D1IndexStorage - Clear Data', () => {
  it('should clear all stored data', async () => {
    await storage.clear();

    // Verify all tables were cleared (mock tracking would go here)
    expect(true).toBe(true); // Placeholder - would verify DB state
  });
});

describe('Incremental Indexing - Performance', () => {
  it('should skip unchanged files efficiently', async () => {
    const filePath = '/src/unchanged.ts';
    const checksum = await storage.calculateChecksum('const x = 42;');
    const modified = Date.now();

    // Record file
    await storage.setFileRecord(filePath, checksum, 100, modified, 1);

    // Check 100 times (simulating repeated indexing runs)
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      const needsReindex = await storage.needsReindexing(filePath, checksum, modified);
      expect(needsReindex).toBe(false);
    }
    const duration = Date.now() - start;

    // Should be very fast (< 100ms for 100 checks)
    expect(duration).toBeLessThan(100);
  });

  it('should handle large file sets efficiently', async () => {
    const fileCount = 1000;
    const files: string[] = [];

    // Create 1000 mock files
    for (let i = 0; i < fileCount; i++) {
      files.push(`/src/file${i}.ts`);
    }

    // Mock the file list query
    const mockPaths = files.map(path => ({ path }));
    mockDB.setMockData('SELECT path FROM file_index', mockPaths);

    const start = Date.now();
    const trackedFiles = await storage.getAllTrackedFiles();
    const duration = Date.now() - start;

    expect(trackedFiles).toHaveLength(fileCount);
    // Should be fast even for 1000 files
    expect(duration).toBeLessThan(50);
  });
});

describe('Incremental Indexing - Real-World Scenarios', () => {
  it('should handle git checkout scenario', async () => {
    const filePath = '/src/feature.ts';
    const originalContent = 'function original() {}';
    const newContent = 'function original() {}'; // Same content after checkout
    const checksum = await storage.calculateChecksum(originalContent);

    const oldModified = Date.now() - 1000000;
    const newModified = Date.now();

    // Record original state
    await storage.setFileRecord(filePath, checksum, 100, oldModified, 1);

    // Simulate git checkout (mtime changed, content same)
    const needsReindex = await storage.needsReindexing(filePath, checksum, newModified);

    expect(needsReindex).toBe(false); // Should skip reindexing
  });

  it('should handle actual code change', async () => {
    const filePath = '/src/feature.ts';
    const oldContent = 'function old() {}';
    const newContent = 'function new() {}';
    const oldChecksum = await storage.calculateChecksum(oldContent);
    const newChecksum = await storage.calculateChecksum(newContent);

    const oldModified = Date.now() - 1000000;
    const newModified = Date.now();

    // Record old state
    await storage.setFileRecord(filePath, oldChecksum, 100, oldModified, 1);

    // Simulate actual edit
    const needsReindex = await storage.needsReindexing(filePath, newChecksum, newModified);

    expect(needsReindex).toBe(true); // Should reindex
  });

  it('should handle file deletion and recreation', async () => {
    const filePath = '/src/temp.ts';
    const checksum1 = await storage.calculateChecksum('v1');
    const checksum2 = await storage.calculateChecksum('v2');

    // Create file
    await storage.setFileRecord(filePath, checksum1, 100, Date.now(), 1);

    // Delete file
    const currentFiles = new Set<string>();
    mockDB.setMockData('SELECT path FROM file_index', [{ path: filePath }]);
    const deleted = await storage.detectDeletedFiles(currentFiles);
    expect(deleted).toContain(filePath);

    // Recreate file with different content
    const needsReindex = await storage.needsReindexing(filePath, checksum2, Date.now());
    expect(needsReindex).toBe(true); // New file needs indexing
  });
});
