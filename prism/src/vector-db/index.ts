/**
 * Vector Database Module
 *
 * This module provides vector database functionality for semantic search.
 */

import type { CodeChunk } from '../core/types.js';

/**
 * Vector search result
 */
export interface SearchResult {
  chunk: CodeChunk;
  score: number;
}

/**
 * Vector database interface
 */
export interface IVectorDB {
  insert(chunk: CodeChunk, embedding?: number[]): Promise<void>;
  insertBatch(chunks: CodeChunk[], embeddings?: number[][]): Promise<void>;
  search(query: number[], limit: number): Promise<SearchResult[]>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * In-memory vector database for development
 */
export class MemoryVectorDB implements IVectorDB {
  private chunks: Map<string, CodeChunk> = new Map();
  private embeddings: Map<string, number[]> = new Map();

  async insert(chunk: CodeChunk, embedding?: number[]): Promise<void> {
    this.chunks.set(chunk.id, chunk);
    if (embedding) {
      this.embeddings.set(chunk.id, embedding);
    }
  }

  async insertBatch(chunks: CodeChunk[], embeddings?: number[][]): Promise<void> {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk) {
        await this.insert(chunk, embeddings?.[i]);
      }
    }
  }

  async search(query: number[], limit: number): Promise<SearchResult[]> {
    // If we have embeddings, use cosine similarity
    if (this.embeddings.size > 0) {
      const results: SearchResult[] = [];

      for (const [id, embedding] of this.embeddings.entries()) {
        const chunk = this.chunks.get(id);
        if (chunk) {
          const score = this.cosineSimilarity(query, embedding);
          results.push({ chunk, score });
        }
      }

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, limit);
    }

    // Fallback: return random results
    return Array.from(this.chunks.values())
      .slice(0, limit)
      .map((chunk) => ({ chunk, score: Math.random() }));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
      normA += (a[i] ?? 0) * (a[i] ?? 0);
      normB += (b[i] ?? 0) * (b[i] ?? 0);
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  async delete(id: string): Promise<void> {
    this.chunks.delete(id);
    this.embeddings.delete(id);
  }

  async clear(): Promise<void> {
    this.chunks.clear();
    this.embeddings.clear();
  }
}

// Re-export SQLite implementation
export { SQLiteVectorDB } from './SQLiteVectorDB.js';
export type { SQLiteVectorDBConfig } from './SQLiteVectorDB.js';
