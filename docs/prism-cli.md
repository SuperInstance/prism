# PRISM CLI

Command-line interface for the PRISM code search and indexing service.

## Installation

```bash
# Install globally (from project root)
npm link

# Or run directly with npx
npx prism-cli <command>
```

## Commands

### `prism index <path> [options]`

Index files or directories to the remote PRISM service.

**Arguments:**
- `<path>` - File or directory path to index

**Options:**
- `-i, --incremental` - Use incremental indexing (skip unchanged files via SHA-256)

**Examples:**
```bash
# Index a single file
prism index src/utils.ts

# Index a directory
prism index src/

# Incremental indexing (faster for large codebases)
prism index src/ --incremental

# Index multiple files
prism index src/ lib/ tests/
```

**Supported Languages:**
- TypeScript (.ts, .tsx)
- JavaScript (.js, .jsx)
- Python (.py)
- Rust (.rs)
- Go (.go)
- Java (.java)
- C/C++ (.c, .cpp, .h)

### `prism search <query> [options]`

Search indexed code using semantic similarity.

**Arguments:**
- `<query>` - Search query (natural language or code)

**Options:**
- `--limit N` - Limit results (default: 10)
- `--min-score N` - Minimum similarity score 0-1 (default: 0)

**Examples:**
```bash
# Search for code
prism search "vector database HNSW"

# Limit results
prism search "user authentication" --limit 5

# Filter by relevance
prism search "file upload" --min-score 0.7
```

**Result Format:**
```
Searching for "vector database"...
Found 3 results

1. 80.1% vector-db/D1VectorDB.ts:301-350
   // SEARCH OPERATIONS
   async search(query: number[], options: SearchOptions = {})

2. 78.6% vector-db/HNSWIndex.ts:1-50
   HNSW (Hierarchical Navigable Small World) INDEX
```

### `prism stats`

Show index statistics.

```bash
prism stats
```

**Output:**
```
  PRISM Statistics

  Files indexed    58
  Chunks created   485
  Last indexed     1/13/2026, 7:55:38 PM
```

### `prism health`

Check service status.

```bash
prism health
```

**Output:**
```
  PRISM Status

  Status      healthy
  Version     0.2.0
  Environment production
  HNSW        true
```

### `prism help`

Show help information.

```bash
prism help
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PRISM_URL` | Worker URL | `https://claudes-friend.casey-digennaro.workers.dev` |

## NPM Scripts

```bash
# Using npm scripts from package.json
npm run prism                    # Show help
npm run prism:index <path>       # Index files
npm run prism:search <query>     # Search code
npm run prism:stats              # Show stats
npm run prism:health             # Check status
```

## Performance

### Indexing

| Operation | Time | Notes |
|-----------|------|-------|
| Single file | ~200ms | Depends on file size |
| Small project (10 files) | ~2s | Batch processing |
| Large project (100 files) | ~20s | ~200ms per file average |
| Incremental (unchanged) | ~30ms | 21x faster than full index |

### Search (v0.3 with Vectorize)

| Operation | Time | Notes |
|-----------|------|-------|
| Cold search | ~1.5s | First request + embedding |
| Warm search | ~400ms | Cached connection |
| Vectorize ANN | ~10ms | Approximate nearest neighbor |
| D1 metadata fetch | ~50ms | Retrieve content |
| Embedding generation | ~200ms | Workers AI |

**Scalability:** Vectorize maintains <10ms search time even with millions of vectors (vs ~500ms for brute-force D1 search at 100K chunks)

## How It Works

### Indexing Pipeline

```
1. Collect files → Find all source files in path
2. Read content  → Load file contents
3. Chunk files   → Split into 50-line chunks
4. Generate embeddings → Workers AI (BGE-small, 384d)
5. Store in Vectorize → Fast ANN vector index
6. Store in D1   → Metadata, SHA-256 checksums, full content
7. Update metadata → Track for incremental indexing
```

### Search Pipeline (v0.3 with Vectorize)

```
1. Query embedding → Generate embedding for query (~200ms)
2. Vectorize ANN search → Approximate nearest neighbor (~10ms)
3. Fetch metadata → Retrieve content from D1 (~50ms)
4. Filter results → Apply language/path filters
5. Return top K    → Limit results
```

**Total time:** ~400ms warm (vs ~2s cold)

### Incremental Indexing

```
1. Calculate SHA-256 of file content
2. Compare with stored checksum
3. If match → Skip (21x faster)
4. If different → Reindex
```

## Examples

### Index Your Project

```bash
# Initial index
prism index src/

# Later, after making changes
prism index src/ --incremental
```

### Search for Code

```bash
# Natural language query
prism search "how to authenticate user"

# Code-specific query
prism search "fetch API request"

# Find implementations
prism search "vector database implementation"
```

### Check Status

```bash
# See what's indexed
prism stats

# Check if service is healthy
prism health
```

## Troubleshooting

### "No files found to index"

- Check that the path exists
- Verify file extensions are supported
- Ensure files aren't in skipped directories (node_modules, .git, dist, etc.)

### "No matches found"

- Try a more general query
- Lower the `--min-score` threshold
- Check that files are indexed: `prism stats`

### "HTTP 429: Too Many Requests"

- You've hit the rate limit
- Wait a few minutes and try again
- Consider running your own instance

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  PRISM CLI                                              │
│  - File collection                                      │
│  - Batch processing                                     │
│  - Progress reporting                                   │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTP/JSON
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Worker (Remote)                             │
│  - /api/index   → Index files with embeddings           │
│  - /api/search  → Semantic search with Vectorize ANN   │
│  - /api/stats   → Index statistics                      │
│  - /health      → Service health check                  │
└──────┬────────────────────────────────┬─────────────────┘
       │                                │
       ▼                                ▼
┌──────────────────┐         ┌──────────────────────────┐
│  Vectorize       │         │  D1 Database             │
│  - ANN Index     │         │  - vector_chunks (BLOB)  │
│  - <10ms search  │         │  - file_index (SHA-256)  │
│  - 384d vectors  │         │  - Metadata & content    │
└──────────────────┘         └──────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  Workers AI                                             │
│  - BGE-small-en-v1.5 embeddings (384 dimensions)        │
└─────────────────────────────────────────────────────────┘
```

**Key Changes in v0.3:**
- **Vectorize Integration**: Fast ANN vector search (<10ms for millions of vectors)
- **Hybrid Storage**: Vectorize for vectors + D1 for metadata
- **Metadata Filtering**: Language, path prefix filtering in Vectorize
- **Dual Storage**: Embeddings stored in both Vectorize and D1 for fallback

## License

MIT
