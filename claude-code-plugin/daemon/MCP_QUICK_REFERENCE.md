# MCP Tools Quick Reference

## Starting the Server

```bash
cd /home/user/prism/claude-code-plugin
node daemon/server.js
```

Server starts on: `http://localhost:8080`

## Available Endpoints

### Health Check
```bash
curl http://localhost:8080/health
```

### List Available Tools
```bash
curl http://localhost:8080/tools/list | jq '.'
```

## Tool Usage Examples

### 1. Search Repository

Search for code across the indexed project:

```bash
# Basic search
curl -X POST http://localhost:8080/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "search_repo",
    "arguments": {
      "query": "function"
    }
  }' | jq '.'

# Search with limit
curl -X POST http://localhost:8080/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "search_repo",
    "arguments": {
      "query": "error handling",
      "limit": 5
    }
  }' | jq '.'
```

### 2. Get File Contents

Retrieve full contents of a specific file:

```bash
# Get README
curl -X POST http://localhost:8080/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_file",
    "arguments": {
      "path": "README.md"
    }
  }' | jq -r '.content[0].text'

# Get JavaScript file
curl -X POST http://localhost:8080/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_file",
    "arguments": {
      "path": "daemon/server.js"
    }
  }' | jq -r '.content[0].text' | head -20
```

### 3. List Files

List all indexed files with optional filtering:

```bash
# List all files
curl -X POST http://localhost:8080/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list_files",
    "arguments": {}
  }' | jq '.content[0].text | fromjson'

# List only JavaScript files
curl -X POST http://localhost:8080/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list_files",
    "arguments": {
      "language": "javascript"
    }
  }' | jq '.content[0].text | fromjson'

# Count files by language
curl -X POST http://localhost:8080/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list_files",
    "arguments": {
      "language": "markdown"
    }
  }' | jq '.content[0].text | fromjson | length'
```

## Testing

Run the comprehensive test suite:

```bash
cd /home/user/prism/claude-code-plugin/daemon
./test-mcp-tools.sh
```

## Common Use Cases

### Find All Error Handling Code
```bash
curl -X POST http://localhost:8080/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name":"search_repo","arguments":{"query":"try catch","limit":10}}' \
  | jq '.content[0].text | fromjson'
```

### Get Package Information
```bash
curl -X POST http://localhost:8080/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name":"get_file","arguments":{"path":"package.json"}}' \
  | jq -r '.content[0].text | fromjson'
```

### Count Source Files
```bash
echo "JavaScript files:"
curl -s -X POST http://localhost:8080/tools/call \
  -d '{"name":"list_files","arguments":{"language":"javascript"}}' \
  | jq '.content[0].text | fromjson | length'

echo "Markdown files:"
curl -s -X POST http://localhost:8080/tools/call \
  -d '{"name":"list_files","arguments":{"language":"markdown"}}' \
  | jq '.content[0].text | fromjson | length'
```

## Error Handling

All errors return JSON with error details:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

Common error codes:
- `400` - Bad request (missing params, invalid input)
- `413` - Request too large
- `500` - Internal server error

## Integration with Claude Code

### From Claude Code Plugin

Claude Code can call these tools automatically once configured:

```javascript
// Tool discovery
const tools = await mcp.listTools();

// Execute search
const results = await mcp.callTool('search_repo', {
  query: 'authentication',
  limit: 5
});

// Get file
const content = await mcp.callTool('get_file', {
  path: 'src/auth.js'
});

// List files
const files = await mcp.callTool('list_files', {
  language: 'typescript'
});
```

## Performance Tips

1. **Use limits on searches** - Keep result sets manageable
2. **Filter by language** - Reduce list_files results
3. **Cache file contents** - Store frequently accessed files
4. **Batch requests** - Make multiple tool calls when needed

## Troubleshooting

### Server won't start
- Check if port 8080 is already in use: `lsof -i :8080`
- Try a different port: `PORT=8081 node daemon/server.js`

### No search results
- Verify index exists: `ls -la .prism/index.json`
- Reindex project: `curl -X POST http://localhost:8080/index`

### File not found errors
- Use relative paths from project root
- List files first to verify path: `curl ... list_files ...`

### Tool execution fails
- Check JSON syntax is valid
- Verify all required parameters are provided
- Check server logs for detailed errors

---

**Quick Start:** Run `./test-mcp-tools.sh` to see all tools in action!
