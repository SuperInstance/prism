/**
 * Unit tests for ProgressReporter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressReporter } from '../../../src/indexer/ProgressReporter.js';

describe('ProgressReporter', () => {
  let reporter: ProgressReporter;

  beforeEach(() => {
    reporter = new ProgressReporter();
  });

  describe('start', () => {
    it('should initialize tracking', () => {
      reporter.start(100);

      expect(reporter.getFilesProcessed()).toBe(0);
      expect(reporter.getTotalChunks()).toBe(0);
    });
  });

  describe('updateFile', () => {
    it('should track files processed', () => {
      reporter.start(10);
      reporter.updateFile('/path/to/file.ts', 5);

      expect(reporter.getFilesProcessed()).toBe(1);
      expect(reporter.getTotalChunks()).toBe(5);
    });

    it('should accumulate chunks', () => {
      reporter.start(10);
      reporter.updateFile('/path/to/file1.ts', 5);
      reporter.updateFile('/path/to/file2.ts', 3);

      expect(reporter.getTotalChunks()).toBe(8);
    });

    it('should track tokens and bytes', () => {
      reporter.start(10);
      reporter.updateFile('/path/to/file.ts', 5, 1000, 5000);

      const summary = reporter.complete();
      expect(summary.totalTokens).toBe(1000);
      expect(summary.totalBytes).toBe(5000);
    });
  });

  describe('getProgress', () => {
    it('should return 0 for no files', () => {
      reporter.start(0);
      expect(reporter.getProgress()).toBe(0);
    });

    it('should calculate progress percentage', () => {
      reporter.start(100);
      reporter.updateFile('/path/to/file1.ts', 5);
      reporter.updateFile('/path/to/file2.ts', 3);

      expect(reporter.getProgress()).toBe(2);
    });

    it('should cap at 100', () => {
      reporter.start(10);
      for (let i = 0; i < 15; i++) {
        reporter.updateFile(`/path/to/file${i}.ts`, 1);
      }

      expect(reporter.getProgress()).toBe(100);
    });
  });

  describe('getETA', () => {
    it('should return 0 for no progress', () => {
      reporter.start(10);
      expect(reporter.getETA()).toBe(0);
    });

    it('should estimate remaining time', () => {
      vi.useFakeTimers();
      try {
        reporter.start(100);

        // Process 50 files with simulated time
        for (let i = 0; i < 50; i++) {
          reporter.updateFile(`/path/to/file${i}.ts`, 1);
          vi.advanceTimersByTime(10); // 10ms per file
        }

        const eta = reporter.getETA();
        expect(eta).toBeGreaterThan(0);
        expect(eta).toBeLessThan(10000); // Should be reasonable
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('getETAString', () => {
    it('should format ETA in seconds', () => {
      reporter.start(100);
      reporter.updateFile('/path/to/file1.ts', 5);

      const eta = reporter.getETAString();
      expect(typeof eta).toBe('string');
    });

    it('should return unknown for no progress', () => {
      reporter.start(10);
      expect(reporter.getETAString()).toBe('unknown');
    });
  });

  describe('complete', () => {
    it('should generate summary', () => {
      vi.useFakeTimers();
      try {
        reporter.start(10);
        vi.advanceTimersByTime(100); // Simulate 100ms passing
        reporter.updateFile('/path/to/file1.ts', 5, 1000);
        vi.advanceTimersByTime(50); // Simulate 50ms passing
        reporter.updateFile('/path/to/file2.ts', 3, 500);
        vi.advanceTimersByTime(50); // Simulate 50ms passing

        const summary = reporter.complete();

        expect(summary.totalTokens).toBe(1500);
        expect(summary.avgChunksPerFile).toBe(4);
        expect(summary.duration).toBeGreaterThan(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should calculate files per second', () => {
      vi.useFakeTimers();
      try {
        reporter.start(10);
        for (let i = 0; i < 5; i++) {
          reporter.updateFile(`/path/to/file${i}.ts`, 1);
          vi.advanceTimersByTime(100); // Simulate 100ms per file
        }

        const summary = reporter.complete();
        expect(summary.filesPerSecond).toBeGreaterThan(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should handle zero files', () => {
      reporter.start(0);
      const summary = reporter.complete();

      expect(summary.avgChunksPerFile).toBe(0);
      expect(summary.filesPerSecond).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear all tracking data', () => {
      reporter.start(10);
      reporter.updateFile('/path/to/file.ts', 5);
      reporter.complete();

      reporter.reset();

      expect(reporter.getFilesProcessed()).toBe(0);
      expect(reporter.getTotalChunks()).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return complete status', () => {
      reporter.start(100);
      reporter.updateFile('/path/to/file1.ts', 5);
      reporter.updateFile('/path/to/file2.ts', 3);

      const status = reporter.getStatus();

      expect(status.progress).toBe(2);
      expect(status.filesProcessed).toBe(2);
      expect(status.totalFiles).toBe(100);
      expect(status.chunks).toBe(8);
      expect(status.eta).toBeDefined();
      expect(status.elapsed).toBeDefined();
    });
  });

  describe('updateLanguageStats', () => {
    it('should track chunks by language', () => {
      reporter.updateLanguageStats([
        {
          id: '1',
          filePath: '/path/to/file.ts',
          name: 'test',
          kind: 'function',
          startLine: 1,
          endLine: 10,
          content: 'code',
          language: 'typescript',
          metadata: { exports: [], imports: [], dependencies: [] },
        },
        {
          id: '2',
          filePath: '/path/to/file.py',
          name: 'test',
          kind: 'function',
          startLine: 1,
          endLine: 10,
          content: 'code',
          language: 'python',
          metadata: { exports: [], imports: [], dependencies: [] },
        },
      ]);

      const summary = reporter.complete();
      expect(summary.chunksByLanguage['typescript']).toBe(1);
      expect(summary.chunksByLanguage['python']).toBe(1);
    });

    it('should track chunks by type', () => {
      reporter.updateLanguageStats([
        {
          id: '1',
          filePath: '/path/to/file.ts',
          name: 'TestClass',
          kind: 'class',
          startLine: 1,
          endLine: 10,
          content: 'code',
          language: 'typescript',
          metadata: { exports: [], imports: [], dependencies: [] },
        },
        {
          id: '2',
          filePath: '/path/to/file.ts',
          name: 'testFunc',
          kind: 'function',
          startLine: 1,
          endLine: 10,
          content: 'code',
          language: 'typescript',
          metadata: { exports: [], imports: [], dependencies: [] },
        },
      ]);

      const summary = reporter.complete();
      expect(summary.chunksByType['class']).toBe(1);
      expect(summary.chunksByType['function']).toBe(1);
    });
  });
});
