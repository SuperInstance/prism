/**
 * Prism Engine - Main orchestration layer
 *
 * Coordinates all components to provide a complete RAG system.
 */

import { SQLiteVectorDB } from '../vector-db/index.js';
import type { CodeChunk } from './types.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import { globby } from 'globby';

/**
 * Prism Engine configuration
 */
export interface PrismEngineConfig {
  /** Database path */
  dbPath?: string;
  /** Maximum results for search */
  maxResults?: number;
}

/**
 * Prism Engine - Main API for Prism
 */
export class PrismEngine {
  private vectorDB: SQLiteVectorDB;
  private maxResults: number;

  constructor(config: PrismEngineConfig = {}) {
    this.vectorDB = new SQLiteVectorDB({ path: config.dbPath || './prism.db' });
    this.maxResults = config.maxResults || 10;
  }

  /**
   * Index a directory
   */
  async index(targetPath: string): Promise<{ chunks: number; errors: number }> {
    const chunks: CodeChunk[] = [];
    const errors: string[] = [];

    // Find all code files
    const files = await globby(['**/*.{ts,tsx,js,jsx,py,go,rs,java}'], {
      cwd: targetPath,
      absolute: true,
      gitignore: true,
    });

    // Process each file
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const ext = path.extname(file);
        const language = this.getLanguage(ext);

        // Create chunks (simple line-based chunking for now)
        const lines = content.split('\n');
        const chunkSize = 50;
        for (let i = 0; i < lines.length; i += chunkSize) {
          const chunkLines = lines.slice(i, i + chunkSize);
          const chunkContent = chunkLines.join('\n');

          // Extract symbols (simple function/class detection)
          const symbols = this.extractSymbols(chunkContent);

          chunks.push({
            id: `chunk_${file}_${i}_${Date.now()}`,
            filePath: path.relative(targetPath, file),
            content: chunkContent,
            startLine: i + 1,
            endLine: Math.min(i + chunkSize, lines.length),
            language,
            symbols,
            dependencies: [],
            metadata: {},
          });
        }
      } catch (error) {
        errors.push(`${file}: ${error}`);
      }
    }

    // Store chunks in database
    await this.vectorDB.insertBatch(chunks);

    return {
      chunks: chunks.length,
      errors: errors.length,
    };
  }

  /**
   * Get language from file extension
   */
  private getLanguage(ext: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.rs': 'rust',
      '.go': 'go',
      '.java': 'java',
    };
    return languageMap[ext] || 'unknown';
  }

  /**
   * Extract symbols from code
   */
  private extractSymbols(code: string): string[] {
    const symbols: string[] = [];

    // Match function declarations
    const functionMatches = code.match(/function\s+(\w+)/g);
    if (functionMatches) {
      functionMatches.forEach((match) => {
        const name = match.replace(/function\s+/, '');
        symbols.push(name);
      });
    }

    // Match class declarations
    const classMatches = code.match(/class\s+(\w+)/g);
    if (classMatches) {
      classMatches.forEach((match) => {
        const name = match.replace(/class\s+/, '');
        symbols.push(name);
      });
    }

    // Match const/let declarations (functions)
    const constMatches = code.match(/(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|\([^)]*\)\s*=>)/g);
    if (constMatches) {
      constMatches.forEach((match) => {
        const name = match.replace(/(?:const|let)\s+/, '').replace(/\s*=.*/, '');
        symbols.push(name);
      });
    }

    return symbols;
  }

  /**
   * Search for relevant code
   */
  async search(query: string, limit?: number): Promise<Array<{ chunk: CodeChunk; score: number }>> {
    // Generate query embedding (simple hash-based for now)
    const queryEmbedding = this.generateEmbedding(query);

    // Search vector database
    const results = await this.vectorDB.search(queryEmbedding, limit || this.maxResults);

    return results;
  }

  /**
   * Get context for a file
   */
  async getContext(filePath: string): Promise<CodeChunk[]> {
    const allChunks = await this.vectorDB.getAllChunks();

    return allChunks.filter((chunk) => {
      const normalizedPath = chunk.filePath.replace(/\\/g, '/');
      const normalizedQuery = filePath.replace(/\\/g, '/');
      return normalizedPath === normalizedQuery || normalizedPath.endsWith(normalizedQuery);
    });
  }

  /**
   * Explain usage of a symbol
   */
  async explainUsage(symbol: string, limit = 20): Promise<{
    definition: CodeChunk | null;
    usages: CodeChunk[];
  }> {
    const allChunks = await this.vectorDB.getAllChunks();

    const matching = allChunks.filter((chunk) => {
      if (chunk.symbols && chunk.symbols.includes(symbol)) {
        return true;
      }
      const regex = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(chunk.content);
    });

    const definition = matching.find((c) => c.symbols && c.symbols.includes(symbol)) || null;
    const usages = matching.filter((c) => c.id !== definition?.id).slice(0, limit);

    return { definition, usages };
  }

  /**
   * Get statistics
   */
  getStats(): {
    chunks: number;
    vectors: number;
    languages: Record<string, number>;
  } {
    const dbStats = this.vectorDB.getStats();

    // Count by language (this is expensive, so we might want to cache this)
    const languages: Record<string, number> = {};

    return {
      chunks: dbStats.chunkCount,
      vectors: dbStats.vectorCount,
      languages,
    };
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    await this.vectorDB.clear();
  }

  /**
   * Close the engine
   */
  close(): void {
    this.vectorDB.close();
  }

  /**
   * Simple embedding generation (placeholder)
   */
  private generateEmbedding(text: string): number[] {
    const embedding = new Array(384).fill(0);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
      embedding[i % 384] = (hash % 1000) / 1000;
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => (norm > 0 ? v / norm : 0));
  }
}
