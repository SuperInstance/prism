/**
 * Integration test for full indexing pipeline
 *
 * Tests the complete flow from file collection to vector storage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IndexerOrchestrator } from '../../src/indexer/IndexerOrchestrator.js';
import { EmbeddingService } from '../../src/embeddings/EmbeddingService.js';
import { FileSystemService } from '../../src/core/services/FileSystem.js';
import { WasmIndexer } from '../../src/indexer/WasmIndexer.js';
import { MemoryVectorDB } from '../../src/vector-db/MemoryVectorDB.js';
import type { PrismConfig } from '../../src/config/types/index.js';
import type { CodeChunk } from '../../src/core/types/index.js';

describe('Indexing Pipeline Integration', () => {
  let config: PrismConfig;
  let orchestrator: IndexerOrchestrator;
  let fileSystem: FileSystemService;
  let parser: WasmIndexer;
  let embeddings: EmbeddingService;
  let vectorDB: MemoryVectorDB;

  beforeEach(() => {
    config = {
      cloudflare: {
        accountId: 'test-account',
        apiKey: 'test-key',
        apiEndpoint: 'https://api.cloudflare.com/client/v4',
      },
      ollama: {
        enabled: true,
        url: 'http://localhost:11434',
        model: 'nomic-embed-text',
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
      },
      indexing: {
        include: ['**/*.ts', '**/*.js'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        watch: false,
        chunkSize: 500,
        maxFileSize: 1024 * 1024,
        languages: [],
        chunking: {
          strategy: 'function',
          minSize: 100,
          maxSize: 1000,
          overlap: 50,
          preserveBoundaries: true,
        },
        embedding: {
          provider: 'cloudflare',
          model: '@cf/baai/bge-small-en-v1.5',
          batchSize: 32,
          dimensions: 384,
          cache: true,
        },
      },
      optimization: {
        tokenBudget: 100000,
        minRelevance: 0.5,
        maxChunks: 50,
        compressionLevel: 5,
        weights: {
          semantic: 0.40,
          proximity: 0.25,
          symbol: 0.20,
          recency: 0.10,
          frequency: 0.05,
        },
      },
      mcp: {
        enabled: false,
        host: 'localhost',
        port: 3000,
        debug: false,
        maxConnections: 10,
        timeout: 30000,
      },
      cli: {
        format: 'text',
        color: true,
        progress: true,
        confirm: true,
      },
      logging: {
        level: 'info',
        format: 'pretty',
      },
    };

    // Create services
    fileSystem = new FileSystemService();
    parser = new WasmIndexer();
    embeddings = new EmbeddingService(config);
    vectorDB = new MemoryVectorDB();

    orchestrator = new IndexerOrchestrator(
      fileSystem,
      parser,
      embeddings,
      vectorDB,
      config
    );
  });

  describe('Full Pipeline', () => {
    it('should index a directory end-to-end', async () => {
      // Mock file system operations
      vi.spyOn(fileSystem, 'listFiles').mockResolvedValue([
        '/project/src/file1.ts',
        '/project/src/file2.ts',
      ]);

      vi.spyOn(fileSystem, 'readFile').mockImplementation(async (path) => {
        if (path === '/project/src/file1.ts') {
          return 'export function test1() { return 1; }';
        }
        if (path === '/project/src/file2.ts') {
          return 'export function test2() { return 2; }';
        }
        throw new Error('File not found');
      });

      vi.spyOn(fileSystem, 'getStats').mockResolvedValue({
        size: 1000,
        modified: new Date(),
        isDirectory: false,
        extension: '.ts',
      });

      // Mock parser
      vi.spyOn(parser, 'index').mockImplementation(async (path) => {
        return [
          {
            id: `chunk-${path}`,
            filePath: path,
            name: 'testFunction',
            kind: 'function',
            startLine: 1,
            endLine: 5,
            content: `function from ${path}`,
            language: 'typescript',
            metadata: {
              exports: [],
              imports: [],
              dependencies: [],
            },
          },
        ];
      });

      // Mock embeddings
      const mockEmbedding = Array(384).fill(0.1);
      vi.spyOn(embeddings, 'embedBatch').mockResolvedValue([
        mockEmbedding,
        mockEmbedding,
      ]);

      // Mock vector DB
      vi.spyOn(vectorDB, 'insertBatch').mockResolvedValue();

      // Run indexing
      const result = await orchestrator.indexDirectory('/project/src', {
        include: ['**/*.ts'],
        exclude: [],
      });

      // Verify results
      expect(result.files).toBe(2);
      expect(result.chunks).toBe(2);
      expect(result.errors).toBe(0);
      expect(result.failedFiles).toHaveLength(0);
      expect(result.duration).toBeGreaterThan(0);

      // Verify embeddings were called
      expect(embeddings.embedBatch).toHaveBeenCalledTimes(1);

      // Verify vector DB was called
      expect(vectorDB.insertBatch).toHaveBeenCalledTimes(1);
    });

    it('should handle indexing errors gracefully', async () => {
      // Mock file system to return files
      vi.spyOn(fileSystem, 'listFiles').mockResolvedValue([
        '/project/src/good.ts',
        '/project/src/bad.ts',
      ]);

      // Mock file reading - fail on bad.ts
      vi.spyOn(fileSystem, 'readFile').mockImplementation(async (path) => {
        if (path === '/project/src/good.ts') {
          return 'export function good() { return 1; }';
        }
        throw new Error('Cannot read file');
      });

      vi.spyOn(fileSystem, 'getStats').mockResolvedValue({
        size: 1000,
        modified: new Date(),
        isDirectory: false,
        extension: '.ts',
      });

      // Mock parser for good file
      vi.spyOn(parser, 'index').mockResolvedValue([
        {
          id: 'chunk-good',
          filePath: '/project/src/good.ts',
          name: 'good',
          kind: 'function',
          startLine: 1,
          endLine: 5,
          content: 'function good',
          language: 'typescript',
          metadata: {
            exports: [],
            imports: [],
            dependencies: [],
          },
        },
      ]);

      // Mock embeddings
      const mockEmbedding = Array(384).fill(0.1);
      vi.spyOn(embeddings, 'embedBatch').mockResolvedValue([mockEmbedding]);

      // Mock vector DB
      vi.spyOn(vectorDB, 'insertBatch').mockResolvedValue();

      // Run indexing
      const result = await orchestrator.indexDirectory('/project/src', {
        include: ['**/*.ts'],
        exclude: [],
      });

      // Verify partial success
      expect(result.files).toBe(1);
      expect(result.errors).toBe(1);
      expect(result.failedFiles).toContain('/project/src/bad.ts');
    });

    it('should report progress during indexing', async () => {
      const progressUpdates: Array<{ progress: number; message: string }> = [];

      // Mock file system
      vi.spyOn(fileSystem, 'listFiles').mockResolvedValue([
        '/project/src/file1.ts',
      ]);

      vi.spyOn(fileSystem, 'readFile').mockResolvedValue('export function test() {}');

      vi.spyOn(fileSystem, 'getStats').mockResolvedValue({
        size: 1000,
        modified: new Date(),
        isDirectory: false,
        extension: '.ts',
      });

      // Mock parser
      vi.spyOn(parser, 'index').mockResolvedValue([
        {
          id: 'chunk-1',
          filePath: '/project/src/file1.ts',
          name: 'test',
          kind: 'function',
          startLine: 1,
          endLine: 5,
          content: 'function test',
          language: 'typescript',
          metadata: {
            exports: [],
            imports: [],
            dependencies: [],
          },
        },
      ]);

      // Mock embeddings
      const mockEmbedding = Array(384).fill(0.1);
      vi.spyOn(embeddings, 'embedBatch').mockResolvedValue([mockEmbedding]);

      // Mock vector DB
      vi.spyOn(vectorDB, 'insertBatch').mockResolvedValue();

      // Run indexing with progress callback
      await orchestrator.indexDirectory('/project/src', {
        include: ['**/*.ts'],
        exclude: [],
        onProgress: (progress, message) => {
          progressUpdates.push({ progress, message });
        },
      });

      // Verify progress was reported
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].progress).toBe(0);
      expect(progressUpdates[progressUpdates.length - 1].progress).toBe(100);
    });
  });

  describe('Incremental Indexing', () => {
    it('should skip unchanged files when incremental is enabled', async () => {
      // Mock file system
      vi.spyOn(fileSystem, 'listFiles').mockResolvedValue([
        '/project/src/unchanged.ts',
        '/project/src/changed.ts',
      ]);

      vi.spyOn(fileSystem, 'readFile').mockResolvedValue('export function test() {}');

      vi.spyOn(fileSystem, 'getStats').mockResolvedValue({
        size: 1000,
        modified: new Date('2025-01-13T12:00:00Z'),
        isDirectory: false,
        extension: '.ts',
      });

      // Mock parser
      vi.spyOn(parser, 'index').mockResolvedValue([
        {
          id: 'chunk-test',
          filePath: '/project/src/test.ts',
          name: 'test',
          kind: 'function',
          startLine: 1,
          endLine: 5,
          content: 'function test',
          language: 'typescript',
          metadata: {
            exports: [],
            imports: [],
            dependencies: [],
          },
        },
      ]);

      // Mock embeddings
      const mockEmbedding = Array(384).fill(0.1);
      vi.spyOn(embeddings, 'embedBatch').mockResolvedValue([mockEmbedding]);

      // Mock vector DB
      vi.spyOn(vectorDB, 'insertBatch').mockResolvedValue();

      // First pass - index all files
      const result1 = await orchestrator.indexDirectory('/project/src', {
        include: ['**/*.ts'],
        exclude: [],
        incremental: false,
      });

      expect(result1.files).toBe(2);

      // Second pass - incremental (should skip unchanged)
      const result2 = await orchestrator.indexDirectory('/project/src', {
        include: ['**/*.ts'],
        exclude: [],
        incremental: true,
      });

      // Incremental should skip all files since they haven't changed
      expect(result2.files).toBe(0);
    });
  });

  describe('Vector DB Integration', () => {
    it('should store chunks with embeddings in vector DB', async () => {
      // Create test chunks
      const chunks: CodeChunk[] = [
        {
          id: 'chunk-1',
          filePath: '/test.ts',
          name: 'test1',
          kind: 'function',
          startLine: 1,
          endLine: 5,
          content: 'function test1',
          language: 'typescript',
          embedding: Array(384).fill(0.1),
          metadata: {
            exports: [],
            imports: [],
            dependencies: [],
          },
        },
        {
          id: 'chunk-2',
          filePath: '/test.ts',
          name: 'test2',
          kind: 'function',
          startLine: 6,
          endLine: 10,
          content: 'function test2',
          language: 'typescript',
          embedding: Array(384).fill(0.2),
          metadata: {
            exports: [],
            imports: [],
            dependencies: [],
          },
        },
      ];

      // Insert chunks
      await vectorDB.insertBatch(chunks);

      // Verify chunks are stored
      const stats = await vectorDB.getStats();
      expect(stats.totalChunks).toBe(2);

      // Test search
      const queryEmbedding = Array(384).fill(0.15);
      const results = await vectorDB.search(queryEmbedding, {
        limit: 10,
      });

      expect(results.chunks).toBeDefined();
      expect(results.totalEvaluated).toBeGreaterThanOrEqual(0);
    });
  });
});
