/**
 * Unit tests for FileSystemService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FileSystemService } from '../../../src/core/services/FileSystem.js';

describe('FileSystemService', () => {
  let service: FileSystemService;

  beforeEach(() => {
    service = new FileSystemService();
  });

  describe('isSourceFile', () => {
    it('should recognize TypeScript files', () => {
      expect(service.isSourceFile('/path/to/file.ts')).toBe(true);
      expect(service.isSourceFile('/path/to/file.tsx')).toBe(true);
    });

    it('should recognize JavaScript files', () => {
      expect(service.isSourceFile('/path/to/file.js')).toBe(true);
      expect(service.isSourceFile('/path/to/file.jsx')).toBe(true);
    });

    it('should recognize Python files', () => {
      expect(service.isSourceFile('/path/to/file.py')).toBe(true);
      expect(service.isSourceFile('/path/to/file.pyi')).toBe(true);
    });

    it('should recognize Rust files', () => {
      expect(service.isSourceFile('/path/to/file.rs')).toBe(true);
    });

    it('should recognize Go files', () => {
      expect(service.isSourceFile('/path/to/file.go')).toBe(true);
    });

    it('should reject non-source files', () => {
      expect(service.isSourceFile('/path/to/file.txt')).toBe(false);
      expect(service.isSourceFile('/path/to/file.md')).toBe(false);
      expect(service.isSourceFile('/path/to/file.json')).toBe(false);
    });
  });

  describe('getLanguage', () => {
    it('should identify TypeScript', () => {
      expect(service.getLanguage('/path/to/file.ts')).toBe('typescript');
      expect(service.getLanguage('/path/to/file.tsx')).toBe('typescript');
    });

    it('should identify JavaScript', () => {
      expect(service.getLanguage('/path/to/file.js')).toBe('javascript');
      expect(service.getLanguage('/path/to/file.jsx')).toBe('javascript');
    });

    it('should identify Python', () => {
      expect(service.getLanguage('/path/to/file.py')).toBe('python');
    });

    it('should identify Rust', () => {
      expect(service.getLanguage('/path/to/file.rs')).toBe('rust');
    });

    it('should identify Go', () => {
      expect(service.getLanguage('/path/to/file.go')).toBe('go');
    });

    it('should return unknown for unrecognized extensions', () => {
      expect(service.getLanguage('/path/to/file.xyz')).toBe('unknown');
      expect(service.getLanguage('/path/to/file')).toBe('unknown');
    });

    it('should handle files with multiple dots', () => {
      expect(service.getLanguage('/path/to/file.test.ts')).toBe('typescript');
      expect(service.getLanguage('/path/to/file.spec.js')).toBe('javascript');
    });
  });

  describe('getStats', () => {
    it.skip('should parse file extension correctly', async () => {
      // This test requires actual file system access
      // Skipped in CI/testing environments without file system
      const stats = await service.getStats('/path/to/file.ts');

      expect(stats.extension).toBe('.ts');
    });
  });
});
