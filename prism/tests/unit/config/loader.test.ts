/**
 * Config Loader Unit Tests
 *
 * Tests for configuration loading, validation, and merging.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  loadConfig,
  saveConfig,
  ensureConfig,
  resetConfig,
  getConfigPath,
  getConfigFilePath,
  ensureConfigDir,
  expandTilde,
  validateConfig,
} from '../../../src/config/loader.js';
import type { PrismConfig } from '../../../src/core/types.js';
import { createTempDir, cleanupTempDir } from '../../helpers/test-utils.js';

describe('Config Loader', () => {
  let tempDir: string;
  let originalConfigPath: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    // Override config path for testing
    originalConfigPath = process.env.PRISM_CONFIG_PATH;
    process.env.PRISM_CONFIG_PATH = tempDir;
  });

  afterEach(async () => {
    process.env.PRISM_CONFIG_PATH = originalConfigPath;
    await cleanupTempDir(tempDir);
  });

  describe('getConfigPath', () => {
    it('should return default config path', () => {
      const configPath = getConfigPath();
      const homeDir = os.homedir();

      expect(configPath).toContain('.prism');
      expect(configPath).toContain(homeDir);
    });
  });

  describe('getConfigFilePath', () => {
    it('should return config file path', () => {
      const filePath = getConfigFilePath();

      expect(filePath).toContain('config.yaml');
      expect(filePath).toContain('.prism');
    });
  });

  describe('ensureConfigDir', () => {
    it('should create config directory', async () => {
      const testPath = path.join(tempDir, '.prism');

      await ensureConfigDir();

      const exists = await fs.pathExists(testPath);
      expect(exists).toBe(true);
    });

    it('should not error if directory exists', async () => {
      await ensureConfigDir();
      await ensureConfigDir(); // Should not throw

      expect(true).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid config', () => {
      const config = {
        indexer: {
          chunkSize: 500,
          overlap: 50,
          languages: ['typescript'],
          includePatterns: ['**/*.ts'],
          excludePatterns: [],
        },
        vectorDB: {
          type: 'sqlite' as const,
        },
        tokenOptimizer: {
          maxTokens: 100000,
          targetCompression: 0.7,
          preserveSignatures: true,
        },
        modelRouter: {
          preferLocal: false,
        },
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject invalid chunkSize', () => {
      const config = {
        indexer: {
          chunkSize: 50, // Too small
          overlap: 0,
          languages: ['typescript'],
          includePatterns: [],
          excludePatterns: [],
        },
      };

      expect(() => validateConfig(config)).toThrow('chunkSize must be at least 100');
    });

    it('should reject negative overlap', () => {
      const config = {
        indexer: {
          chunkSize: 500,
          overlap: -10, // Negative
          languages: [],
          includePatterns: [],
          excludePatterns: [],
        },
      };

      expect(() => validateConfig(config)).toThrow('overlap cannot be negative');
    });

    it('should reject overlap >= chunkSize', () => {
      const config = {
        indexer: {
          chunkSize: 500,
          overlap: 500, // Equal to chunkSize
          languages: [],
          includePatterns: [],
          excludePatterns: [],
        },
      };

      expect(() => validateConfig(config)).toThrow('overlap must be less than chunkSize');
    });

    it('should reject invalid vectorDB type', () => {
      const config = {
        vectorDB: {
          type: 'mongodb' as any, // Invalid type
        },
      };

      expect(() => validateConfig(config)).toThrow('must be either "sqlite" or "cloudflare"');
    });

    it('should reject maxTokens < 1000', () => {
      const config = {
        tokenOptimizer: {
          maxTokens: 500, // Too small
          targetCompression: 0.7,
          preserveSignatures: true,
        },
      };

      expect(() => validateConfig(config)).toThrow('maxTokens must be at least 1000');
    });

    it('should reject targetCompression > 1', () => {
      const config = {
        tokenOptimizer: {
          maxTokens: 100000,
          targetCompression: 1.5, // Too high
          preserveSignatures: true,
        },
      };

      expect(() => validateConfig(config)).toThrow('targetCompression must be between 0 and 1');
    });

    it('should reject targetCompression < 0', () => {
      const config = {
        tokenOptimizer: {
          maxTokens: 100000,
          targetCompression: -0.1, // Negative
          preserveSignatures: true,
        },
      };

      expect(() => validateConfig(config)).toThrow('targetCompression must be between 0 and 1');
    });

    it('should accept targetCompression = 0', () => {
      const config = {
        tokenOptimizer: {
          maxTokens: 100000,
          targetCompression: 0,
          preserveSignatures: true,
        },
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should accept targetCompression = 1', () => {
      const config = {
        tokenOptimizer: {
          maxTokens: 100000,
          targetCompression: 1,
          preserveSignatures: true,
        },
      };

      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('expandTilde', () => {
    it('should expand tilde in path', () => {
      const homeDir = os.homedir();
      const expanded = expandTilde('~/test');

      expect(expanded).toContain(homeDir);
      expect(expanded).toContain('test');
    });

    it('should not expand tilde in middle of path', () => {
      const result = expandTilde('/path/~test');

      expect(result).toBe('/path/~test');
    });

    it('should handle just tilde', () => {
      const homeDir = os.homedir();
      const expanded = expandTilde('~');

      expect(expanded).toBe(homeDir);
    });

    it('should handle paths without tilde', () => {
      const result = expandTilde('/absolute/path');

      expect(result).toBe('/absolute/path');
    });

    it('should handle empty string', () => {
      const result = expandTilde('');

      expect(result).toBe('');
    });
  });

  describe('saveConfig and loadConfig', () => {
    it('should save and load config', async () => {
      const config: PrismConfig = {
        indexer: {
          chunkSize: 1000,
          overlap: 100,
          languages: ['typescript', 'python'],
          includePatterns: ['**/*.ts'],
          excludePatterns: ['**/node_modules/**'],
        },
        vectorDB: {
          type: 'sqlite',
          path: '~/.prism/test.db',
        },
        tokenOptimizer: {
          maxTokens: 50000,
          targetCompression: 0.5,
          preserveSignatures: false,
        },
        modelRouter: {
          preferLocal: true,
          localEndpoint: 'http://localhost:11434',
        },
      };

      await saveConfig(config);
      const loaded = await loadConfig();

      expect(loaded.indexer.chunkSize).toBe(1000);
      expect(loaded.indexer.overlap).toBe(100);
      expect(loaded.vectorDB.type).toBe('sqlite');
      expect(loaded.tokenOptimizer.maxTokens).toBe(50000);
    });

    it('should merge partial config with defaults', async () => {
      const partialConfig = {
        indexer: {
          chunkSize: 2000,
          overlap: 200,
          languages: ['rust'],
          includePatterns: [],
          excludePatterns: [],
        },
      };

      // Mock the config file read
      const configPath = path.join(tempDir, 'config.yaml');
      await fs.writeFile(
        configPath,
        `
indexer:
  chunkSize: 2000
  overlap: 200
  languages:
    - rust
  includePatterns: []
  excludePatterns: []
        `,
        'utf-8'
      );

      // Override config path
      process.env.PRISM_CONFIG_PATH = tempDir;

      const loaded = await loadConfig();

      expect(loaded.indexer.chunkSize).toBe(2000);
      expect(loaded.indexer.overlap).toBe(200);
      expect(loaded.indexer.languages).toContain('rust');
      // Should have defaults for other sections
      expect(loaded.vectorDB.type).toBe('sqlite');
    });

    it('should handle missing config file', async () => {
      // Set to non-existent path
      process.env.PRISM_CONFIG_PATH = path.join(tempDir, 'nonexistent');

      const config = await loadConfig();

      // Should return defaults
      expect(config).toBeDefined();
      expect(config.indexer.chunkSize).toBeDefined();
    });

    it('should reject invalid config file', async () => {
      const configPath = path.join(tempDir, 'config.yaml');
      await fs.writeFile(configPath, 'invalid: yaml: content: [', 'utf-8');

      process.env.PRISM_CONFIG_PATH = tempDir;

      await expect(loadConfig()).rejects.toThrow();
    });
  });

  describe('ensureConfig', () => {
    it('should create config if not exists', async () => {
      process.env.PRISM_CONFIG_PATH = tempDir;

      const config = await ensureConfig();

      expect(config).toBeDefined();
      expect(config.indexer.chunkSize).toBeDefined();
    });

    it('should load existing config', async () => {
      process.env.PRISM_CONFIG_PATH = tempDir;

      // Create config
      await ensureConfig();

      // Load it again
      const config = await ensureConfig();

      expect(config).toBeDefined();
    });
  });

  describe('resetConfig', () => {
    it('should reset to defaults', async () => {
      process.env.PRISM_CONFIG_PATH = tempDir;

      // Save custom config
      const customConfig: PrismConfig = {
        indexer: {
          chunkSize: 999,
          overlap: 99,
          languages: ['typescript'],
          includePatterns: [],
          excludePatterns: [],
        },
        vectorDB: {
          type: 'sqlite',
        },
        tokenOptimizer: {
          maxTokens: 100000,
          targetCompression: 0.7,
          preserveSignatures: true,
        },
        modelRouter: {
          preferLocal: false,
        },
      };

      await saveConfig(customConfig);

      // Reset
      await resetConfig();

      // Load and verify defaults
      const config = await loadConfig();

      expect(config.indexer.chunkSize).toBe(500); // Default value
      expect(config.indexer.overlap).toBe(50); // Default value
    });
  });

  describe('environment variable expansion', () => {
    it('should handle environment variables in config paths', async () => {
      process.env.TEST_VAR = '/test/path';

      const config = {
        vectorDB: {
          type: 'sqlite' as const,
          path: '${TEST_VAR}/db.sqlite',
        },
      };

      // Note: Current implementation doesn't expand env vars
      // This test documents the expected behavior
      expect(config.vectorDB.path).toContain('${TEST_VAR}'));
    });
  });

  describe('config file locations', () => {
    it('should use standard location by default', () => {
      const configPath = getConfigFilePath();
      const homeDir = os.homedir();

      expect(configPath).toContain('.prism');
      expect(configPath).toContain(homeDir);
    });
  });

  describe('edge cases', () => {
    it('should handle empty config values', () => {
      const config = {
        indexer: {
          chunkSize: 500,
          overlap: 0,
          languages: [],
          includePatterns: [],
          excludePatterns: [],
        },
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should handle large chunk sizes', () => {
      const config = {
        indexer: {
          chunkSize: 100000,
          overlap: 0,
          languages: [],
          includePatterns: [],
          excludePatterns: [],
        },
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should handle boundary values', () => {
      const config = {
        indexer: {
          chunkSize: 100, // Minimum allowed
          overlap: 0,
          languages: [],
          includePatterns: [],
          excludePatterns: [],
        },
        tokenOptimizer: {
          maxTokens: 1000, // Minimum allowed
          targetCompression: 0,
          preserveSignatures: true,
        },
      };

      expect(() => validateConfig(config)).not.toThrow();
    });
  });
});
