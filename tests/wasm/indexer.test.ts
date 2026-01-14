/**
 * WASM Indexer integration tests
 *
 * These tests verify that the Rust/WASM parser works correctly
 * when called from Node.js.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { WasmIndexer } from '../../src/indexer/WasmIndexer.js';

describe('WasmIndexer', () => {
  let indexer: WasmIndexer;

  beforeAll(async () => {
    indexer = new WasmIndexer();

    try {
      await indexer.init();
    } catch (error) {
      console.error('Failed to initialize WASM indexer:', error);
      throw error;
    }
  });

  describe('initialization', () => {
    it('should initialize WASM module', async () => {
      expect(indexer).toBeDefined();
      expect(indexer['initialized']).toBe(true);
    });

    it('should return supported languages', () => {
      const languages = indexer.getSupportedLanguages();
      expect(Array.isArray(languages)).toBe(true);
      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
    });

    it('should return version information', () => {
      const version = indexer.getVersion();
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });
  });

  describe('parsing', () => {
    it('should parse TypeScript code', async () => {
      const code = `
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}

class Greeter {
  greet(name: string) {
    return hello(name);
  }
}
      `.trim();

      const result = await indexer.parseFile(code, 'typescript');

      expect(result).toBeDefined();
      expect(result.has_errors).toBe(false);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should parse JavaScript code', async () => {
      const code = `
function add(a, b) {
  return a + b;
}

const subtract = (a, b) => a - b;
      `.trim();

      const result = await indexer.parseFile(code, 'javascript');

      expect(result).toBeDefined();
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should parse Python code', async () => {
      const code = `
def greet(name):
    return f"Hello, {name}!"

class Greeter:
    def hello(self, name):
        return greet(name)
      `.trim();

      const result = await indexer.parseFile(code, 'python');

      expect(result).toBeDefined();
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should extract functions from TypeScript', async () => {
      const code = `
function test1() { return 1; }
function test2() { return 2; }
      `.trim();

      const result = await indexer.parseFile(code, 'typescript');

      expect(result.functions.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract classes from TypeScript', async () => {
      const code = `
class TestClass {
  method() { return true; }
}
      `.trim();

      const result = await indexer.parseFile(code, 'typescript');

      expect(result.classes.length).toBeGreaterThanOrEqual(1);
      if (result.classes.length > 0) {
        expect(result.classes[0].name).toBe('TestClass');
      }
    });

    it('should handle syntax errors gracefully', async () => {
      const code = `
function broken( {
  // Missing parameter
}
      `.trim();

      const result = await indexer.parseFile(code, 'typescript');

      expect(result).toBeDefined();
      // Should have error information
      expect(result.has_errors).toBe(true);
    });
  });

  describe('chunking', () => {
    it('should extract chunks from parsed code', async () => {
      const code = `
function chunkTest() {
  const data = [1, 2, 3];
  return data.map(x => x * 2);
}
      `.trim();

      const result = await indexer.parseFile(code, 'typescript');
      const chunks = await indexer.extractChunks(result);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].id).toBeDefined();
      expect(chunks[0].content).toContain('function');
      expect(chunks[0].language).toBe('typescript');
    });

    it('should respect max_size option', async () => {
      const code = `
// A very long function
function longFunction() {
  ${Array.from({ length: 100 }, (_, i) => `const line${i} = ${i};`).join('\n')}
  return true;
}
      `.trim();

      const result = await indexer.parseFile(code, 'typescript');
      const chunks = await indexer.extractChunks(result, { max_size: 50 });

      // Should split into smaller chunks if needed
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('language detection', () => {
    it('should detect TypeScript from .ts extension', () => {
      const indexer2 = new WasmIndexer();
      const language = indexer2['detectLanguage']('test.ts');
      expect(language).toBe('typescript');
    });

    it('should detect Python from .py extension', () => {
      const indexer2 = new WasmIndexer();
      const language = indexer2['detectLanguage']('test.py');
      expect(language).toBe('python');
    });

    it('should detect JavaScript from .js extension', () => {
      const indexer2 = new WasmIndexer();
      const language = indexer2['detectLanguage']('test.js');
      expect(language).toBe('javascript');
    });
  });

  describe('error handling', () => {
    it('should fail to parse unsupported language', async () => {
      const code = 'some code';

      await expect(indexer.parseFile(code, 'unknown'))
        .rejects
        .toThrow();
    });

    it('should throw if not initialized', async () => {
      const uninitializedIndexer = new WasmIndexer();

      await expect(uninitializedIndexer.parseFile('code', 'typescript'))
        .rejects
        .toThrow();
    });
  });

  describe('integration', () => {
    it('should handle real-world TypeScript code', async () => {
      const code = `
import { readFile } from 'fs/promises';

interface Config {
  path: string;
  encoding: BufferEncoding;
}

async function loadConfig(path: string): Promise<Config> {
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

class ConfigManager {
  private config: Config | null = null;

  async initialize(path: string) {
    this.config = await loadConfig(path);
  }

  get(): Config {
    if (!this.config) {
      throw new Error('Config not initialized');
    }
    return this.config;
  }
}
      `.trim();

      const result = await indexer.parseFile(code, 'typescript');

      expect(result.has_errors).toBe(false);
      expect(result.functions.length).toBeGreaterThan(0);
      expect(result.classes.length).toBeGreaterThan(0);
    });
  });
});
