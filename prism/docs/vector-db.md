# Vector Database Architecture

**Date**: 2025-01-13
**Status**: Complete
**Component**: Vector DB Module

## Overview

The Vector Database module provides persistent storage and semantic search capabilities for indexed code chunks. It supports both in-memory and SQLite-based storage with cosine similarity search.

## Purpose

- Store code chunks with their vector embeddings
- Enable fast semantic search using cosine similarity
- Provide persistent storage for large codebases
- Support efficient batch operations

## Architecture

### Components

```
vector-db/
├── index.ts              # Module exports and interfaces
├── SQLiteVectorDB.ts     # SQLite implementation
└── MemoryVectorDB.ts     # In-memory implementation (in index.ts)
```

### Data Model

#### IVectorDB Interface

```typescript
interface IVectorDB {
  insert(chunk: CodeChunk, embedding?: number[]): Promise<void>;
  insertBatch(chunks: CodeChunk[], embeddings?: number[][]): Promise<void>;
  search(query: number[], limit: number): Promise<SearchResult[]>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}
```

#### SearchResult

```typescript
interface SearchResult {
  chunk: CodeChunk;
  score: number;  // Cosine similarity (0-1)
}
```

### SQLite Schema

```sql
-- Chunks table
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  language TEXT NOT NULL,
  symbols TEXT,        -- JSON array
  dependencies TEXT,   -- JSON array
  metadata TEXT        -- JSON object
);

-- Vectors table
CREATE TABLE vectors (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL,
  embedding TEXT NOT NULL,  -- JSON array
  metadata TEXT,
  created_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_chunks_file_path ON chunks(file_path);
CREATE INDEX idx_chunks_language ON chunks(language);
CREATE INDEX idx_vectors_chunk_id ON vectors(chunk_id);
```

## Implementation Details

### SQLiteVectorDB

**Purpose**: Production-ready persistent vector database

**Features**:
- WAL mode for better concurrency
- Batch insert support
- Cosine similarity search
- Export/import functionality
- Statistics tracking

**Usage**:

```typescript
import { SQLiteVectorDB } from 'prism/vector-db';

// Create in-memory database
const db = new SQLiteVectorDB({ path: ':memory:' });

// Create file-based database
const db = new SQLiteVectorDB({ path: './vectors.db' });

// Insert with embedding
await db.insert(chunk, embedding);

// Batch insert
await db.insertBatch(chunks, embeddings);

// Search
const results = await db.search(queryEmbedding, 10);

// Get statistics
const stats = db.getStats();
console.log(stats.chunkCount, stats.vectorCount);

// Export database
db.exportToFile('./backup.db');

// Close connection
db.close();
```

### MemoryVectorDB

**Purpose**: Fast in-memory storage for testing and small datasets

**Features**:
- No setup required
- Fast operations
- Cosine similarity search
- Falls back to random results without embeddings

**Usage**:

```typescript
import { MemoryVectorDB } from 'prism/vector-db';

const db = new MemoryVectorDB();
await db.insert(chunk, embedding);
const results = await db.search(query, 10);
```

## Cosine Similarity

The vector database uses cosine similarity to find the most relevant chunks:

```
similarity(a, b) = (a · b) / (||a|| * ||b||)

where:
  a · b = Σ(a[i] * b[i])  (dot product)
  ||a|| = √(Σ(a[i]²))     (magnitude)
```

**Properties**:
- Range: [-1, 1], but typically [0, 1] for normalized embeddings
- 1 = identical direction
- 0 = orthogonal
- -1 = opposite direction

**Performance**:
- O(n) per search where n = number of chunks
- Suitable for up to 100K chunks
- For larger datasets, consider approximate nearest neighbor (ANN) algorithms

## Integration

### With Indexer

```typescript
import { Indexer } from 'prism/indexer';
import { SQLiteVectorDB } from 'prism/vector-db';
import { generateEmbeddings } from 'prism/embeddings';

const indexer = new Indexer();
const db = new SQLiteVectorDB({ path: './vectors.db' });

// Index codebase
const chunks = await indexer.index('./src');

// Generate embeddings
const embeddings = await generateEmbeddings(
  chunks.map(c => c.content)
);

// Store in database
await db.insertBatch(chunks, embeddings);
```

### With Search

```typescript
import { generateEmbedding } from 'prism/embeddings';

// Generate query embedding
const queryEmbedding = await generateEmbedding('authentication logic');

// Search for relevant code
const results = await db.search(queryEmbedding, 10);

results.forEach(({ chunk, score }) => {
  console.log(`Score: ${score.toFixed(3)}`);
  console.log(`File: ${chunk.filePath}`);
  console.log(`Lines: ${chunk.startLine}-${chunk.endLine}`);
  console.log(`Code: ${chunk.content}`);
});
```

## Performance Considerations

### Memory Usage

| Component | Memory (per 1K chunks) |
|-----------|----------------------|
| SQLiteVectorDB | ~5MB |
| MemoryVectorDB | ~3MB |
| Embeddings (384d) | ~1.5MB |

### Search Performance

| Database Size | Search Time |
|---------------|-------------|
| 1K chunks | ~5ms |
| 10K chunks | ~50ms |
| 100K chunks | ~500ms |

### Optimization Tips

1. **Use batch inserts**: 10-100x faster than individual inserts
2. **Limit results**: Use `limit` parameter to reduce processing
3. **Consider ANN**: For >100K chunks, use approximate algorithms
4. **Normalize embeddings**: Pre-normalize for faster cosine similarity

## Error Handling

```typescript
try {
  await db.insert(chunk, embedding);
} catch (error) {
  if (error.message.includes('UNIQUE constraint')) {
    // Chunk already exists
    await db.delete(chunk.id);
    await db.insert(chunk, embedding);
  } else {
    throw error;
  }
}
```

## Testing

See `/home/eileen/projects/claudes-friend/prism/tests/unit/vector-db.test.ts`

**Coverage**:
- ✅ Insert operations (single and batch)
- ✅ Search with cosine similarity
- ✅ Delete operations
- ✅ Clear operations
- ✅ Statistics tracking
- ✅ Edge cases (empty results, zero vectors, etc.)

## Future Enhancements

1. **Approximate Nearest Neighbor (ANN)**
   - Implement HNSW or IVF for faster search
   - Trade slight accuracy for 10-100x speedup

2. **Hybrid Search**
   - Combine semantic and keyword search
   - Boost results with exact matches

3. **Distributed Storage**
   - Support sharding across multiple databases
   - Enable horizontal scaling

4. **Caching Layer**
   - Cache frequent queries
   - Pre-compute similar chunks

5. **Advanced Indexing**
   - Support for filtering by language, path, etc.
   - Composite indexes for multi-criteria search

## Related Documentation

- [Token Optimizer](./token-optimizer.md) - Uses search results
- [Embeddings](./embeddings.md) - Generates vectors
- [Indexer](./indexer.md) - Creates chunks

## Files

- `/home/eileen/projects/claudes-friend/prism/src/vector-db/index.ts`
- `/home/eileen/projects/claudes-friend/prism/src/vector-db/SQLiteVectorDB.ts`
- `/home/eileen/projects/claudes-friend/prism/tests/unit/vector-db.test.ts`
