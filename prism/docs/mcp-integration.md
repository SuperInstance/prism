# MCP Integration Guide

**Date**: 2025-01-13
**Status**: Complete
**Component**: MCP Server Module

## Overview

Prism provides a Model Context Protocol (MCP) server that integrates with Claude Code, enabling AI-powered code search and context retrieval directly within the Claude Code interface.

## Purpose

- Enable Claude Code to search indexed codebases
- Provide context-aware code assistance
- Allow Claude Code to understand project structure
- Reduce token usage by retrieving only relevant code

## Architecture

### Components

```
mcp/
├── PrismMCPServer.ts    # Main MCP server implementation
├── cli.ts               # CLI entry point for MCP server
└── index.ts             # Module exports
```

### MCP Server Flow

```
Claude Code
    │
    │ stdio
    ▼
PrismMCPServer (stdio transport)
    │
    ├─► List available tools
    ├─► Call tool (search_repo, get_context, etc.)
    │       │
    │       ▼
    │   Vector DB
    │       │
    │       ▼
    │   Results
    │
    ▼
Formatted response
```

## Available Tools

### 1. search_repo

Search the indexed codebase using semantic search.

**Parameters**:
- `query` (string, required): Search query
- `limit` (number, optional): Max results (default: 10)
- `minScore` (number, optional): Minimum similarity score (default: 0.0)

**Example**:
```json
{
  "query": "authentication logic",
  "limit": 5,
  "minScore": 0.5
}
```

**Response**:
```
Found 5 result(s) for query: "authentication logic"

[95.3% match] ./src/auth/login.ts:15-25
Language: typescript | Symbols: authenticateUser, validateCredentials
  function authenticateUser(username, password) {
    const user = database.findUser(username);
    if (!user) return null;
    return verifyPassword(password, user.hash);
  }
```

### 2. get_context

Get all chunks from a specific file.

**Parameters**:
- `filePath` (string, required): File path

**Example**:
```json
{
  "filePath": "./src/auth/login.ts"
}
```

**Response**:
```
File: ./src/auth/login.ts
Language: typescript
Chunks: 3

Lines 1-14:
  import { database } from './database';
  import { verifyPassword } from './crypto';

Lines 15-25:
  function authenticateUser(username, password) {
    const user = database.findUser(username);
    if (!user) return null;
    return verifyPassword(password, user.hash);
  }

Lines 26-30:
  export { authenticateUser };
```

### 3. explain_usage

Get usage information for a symbol (function, class, variable).

**Parameters**:
- `symbol` (string, required): Symbol name
- `limit` (number, optional): Max results (default: 20)

**Example**:
```json
{
  "symbol": "authenticateUser",
  "limit": 20
}
```

**Response**:
```
Symbol: authenticateUser
Found in 5 chunk(s)

Definition:
  File: ./src/auth/login.ts
  Lines: 15-25
  Code:
    function authenticateUser(username, password) {
      const user = database.findUser(username);
      if (!user) return null;
      return verifyPassword(password, user.hash);
    }

Usage:
  1. ./src/routes/auth.ts:10-15
       authenticateUser(req.body.username, req.body.password)

  2. ./src/tests/auth.test.ts:5-10
       test('authenticateUser', () => { ... })
```

### 4. list_indexed_files

List all indexed files, grouped by language.

**Parameters**:
- `language` (string, optional): Filter by language

**Example**:
```json
{
  "language": "typescript"
}
```

**Response**:
```
Indexed Files: 15 file(s)

typescript (10 file(s)):
  - ./src/auth/login.ts (3 chunk(s))
  - ./src/routes/auth.ts (2 chunk(s))
  - ./src/models/user.ts (4 chunk(s))
  ...

python (5 file(s)):
  - ./src/api/auth.py (2 chunk(s))
  ...
```

### 5. get_chunk

Get a specific chunk by ID.

**Parameters**:
- `chunkId` (string, required): Chunk ID

**Example**:
```json
{
  "chunkId": "chunk_abc123"
}
```

**Response**:
```
Chunk ID: chunk_abc123
File: ./src/auth/login.ts
Lines: 15-25
Language: typescript
Symbols: authenticateUser, validateCredentials

Content:
function authenticateUser(username, password) {
  const user = database.findUser(username);
  if (!user) return null;
  return verifyPassword(password, user.hash);
}
```

## Setup

### 1. Index Your Codebase

First, index your codebase with Prism:

```bash
cd /path/to/your/project
prism index ./src
```

This creates a `prism.db` file in the current directory.

### 2. Configure Claude Code

Add the MCP server to your Claude Code settings (`~/.claude/config.json`):

```json
{
  "mcpServers": {
    "prism": {
      "command": "node",
      "args": [
        "/path/to/prism/dist/mcp/cli.js",
        "--db", "/path/to/your/project/prism.db"
      ]
    }
  }
}
```

**Options**:
- `--db <path>`: Path to vector database (default: ./prism.db)
- `--max-results <number>`: Maximum results per search (default: 10)
- `--verbose`: Enable verbose logging

### 3. Restart Claude Code

Restart Claude Code to load the MCP server.

### 4. Use in Claude Code

Now you can ask Claude Code to search your codebase:

```
You: Find the authentication logic in my codebase
Claude: [Uses search_repo tool]
```

```
You: What files do I have in my project?
Claude: [Uses list_indexed_files tool]
```

```
You: How is the authenticateUser function implemented?
Claude: [Uses explain_usage tool]
```

## Usage Examples

### Example 1: Understanding Code

```
You: Show me how authentication works in this project
Claude: I'll search for authentication-related code.

[Claude calls search_repo with "authentication"]

Found 5 results:
- ./src/auth/login.ts: authenticateUser function
- ./src/middleware/auth.ts: auth middleware
- ./src/routes/auth.ts: auth routes
...

Let me get the full context of the main auth file:

[Claude calls get_context with "./src/auth/login.ts"]

Here's how authentication works:
1. authenticateUser validates credentials
2. auth middleware checks session tokens
3. auth routes expose login/logout endpoints
...
```

### Example 2: Finding Usages

```
You: Where is the database connection used?
Claude: Let me search for database usage.

[Claude calls explain_usage with "database"]

Found in 12 files:

Definition:
- ./src/db/connection.ts: establishConnection

Usage:
- ./src/models/user.ts:7 - database.query('SELECT * FROM users')
- ./src/routes/api.ts:15 - database.transaction(...)
- ./src/services/data.ts:3 - const db = database.connect()
...
```

### Example 3: Code Navigation

```
You: What's in the utils directory?
Claude: Let me check what files are indexed.

[Claude calls list_indexed_files]

Indexed Files: 45 file(s)

javascript (5 file(s)):
  - ./src/utils/helpers.js (2 chunks)
  - ./src/utils/format.js (1 chunk)
  - ./src/utils/validate.js (3 chunks)
  ...
```

## Implementation Details

### PrismMCPServer Class

```typescript
import { PrismMCPServer } from 'prism/mcp';
import { SQLiteVectorDB } from 'prism/vector-db';

const vectorDB = new SQLiteVectorDB({ path: './prism.db' });

const server = new PrismMCPServer({
  vectorDB,
  maxResults: 10,
});

await server.start(); // Starts stdio server
```

### Custom Tools

You can extend the MCP server with custom tools:

```typescript
class CustomMCPServer extends PrismMCPServer {
  protected getToolDefinitions(): Tool[] {
    const baseTools = super.getToolDefinitions();

    return [
      ...baseTools,
      {
        name: 'custom_tool',
        description: 'My custom tool',
        inputSchema: { /* ... */ },
      },
    ];
  }

  protected async executeTool(name: string, args: any): Promise<string> {
    if (name === 'custom_tool') {
      return await this.handleCustomTool(args);
    }
    return await super.executeTool(name, args);
  }
}
```

## Error Handling

The MCP server handles errors gracefully:

```typescript
// Database not found
Error: Database file not found: ./prism.db
Please index your codebase first: prism index <path>

// Empty database
Error: Database is empty (./prism.db)
Please index your codebase first: prism index <path>

// Invalid query
Error: Query is required

// Symbol not found
No usage found for symbol: "nonExistentSymbol"
```

## Performance

### Latency

| Operation | Latency |
|-----------|---------|
| search_repo (10K chunks) | ~50ms |
| get_context (file with 100 chunks) | ~10ms |
| explain_usage (full scan) | ~100ms |
| list_indexed_files (1000 files) | ~20ms |

### Optimization Tips

1. **Limit results**: Use `limit` parameter to reduce processing
2. **Minimum score**: Use `minScore` to filter low-quality results
3. **Database location**: Keep database on fast storage (SSD)
4. **Rebuild periodically**: Re-index after major changes

## Troubleshooting

### Server not starting

**Problem**: MCP server fails to start

**Solutions**:
- Check database path exists
- Verify database has indexed chunks
- Enable verbose logging with `--verbose`

```bash
node dist/mcp/cli.js --db ./prism.db --verbose
```

### No results in search

**Problem**: Search returns empty results

**Solutions**:
- Check database has chunks: `prism stats`
- Try broader search query
- Lower `minScore` threshold
- Re-index codebase: `prism index ./src --force`

### Claude Code not connecting

**Problem**: Claude Code doesn't show Prism tools

**Solutions**:
- Verify Claude Code settings path is correct
- Check node executable is in PATH
- Restart Claude Code completely
- Check Claude Code logs for errors

## Testing

Manual testing with MCP inspector:

```bash
npx @modelcontextprotocol/inspector node dist/mcp/cli.js --db ./prism.db
```

This opens a web UI to test all MCP tools.

## Future Enhancements

1. **Streaming Results**: Send results as they're found
2. **Caching**: Cache frequent queries
3. **Index Monitoring**: Watch for file changes and auto-reindex
4. **Multi-Database**: Support multiple databases in one server
5. **Custom Tools**: Allow users to define custom tools

## Related Documentation

- [Vector DB](./vector-db.md) - Storage layer
- [Indexer](./indexer.md) - Creating chunks
- [Embeddings](./embeddings.md) - Vector generation

## Files

- `/home/eileen/projects/claudes-friend/prism/src/mcp/PrismMCPServer.ts`
- `/home/eileen/projects/claudes-friend/prism/src/mcp/cli.ts`
- `/home/eileen/projects/claudes-friend/prism/src/mcp/index.ts`
