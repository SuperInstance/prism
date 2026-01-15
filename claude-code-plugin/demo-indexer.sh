#!/bin/bash

# Demo script for the file indexer
# Shows real-world usage of the new indexing and search functionality

echo "🎬 PRISM File Indexer Demo"
echo "======================================"
echo ""

# Start the server in background
echo "📦 Starting PRISM daemon..."
cd /home/user/prism/claude-code-plugin
node daemon/server.js > /tmp/prism-demo.log 2>&1 &
SERVER_PID=$!
sleep 3

echo "✅ Server started on http://localhost:8080"
echo ""

# Show index stats
echo "📊 Index Statistics:"
jq '{file_count, indexed_at, sample_languages: [.files[].language] | unique}' .prism/index.json
echo ""

# Demo 1: Basic search
echo "🔍 Demo 1: Search for 'FileIndexer'"
echo "-----------------------------------"
curl -s -X POST http://localhost:8080/search -d '{"query":"FileIndexer"}' \
  | jq '.results[0] | {file, line, score, content: (.content | .[0:60])}'
echo ""

# Demo 2: Search with multiple results
echo "🔍 Demo 2: Search for 'async function' (top 3)"
echo "-----------------------------------------------"
curl -s -X POST http://localhost:8080/search -d '{"query":"async function"}' \
  | jq '.results[0:3] | map({file, line, score: (.score | tostring | .[0:5])})'
echo ""

# Demo 3: List files by language
echo "📁 Demo 3: List JavaScript files"
echo "--------------------------------"
curl -s -X POST http://localhost:8080/tools/call \
  -d '{"name":"list_files","arguments":{"language":"javascript"}}' \
  | jq '.content[0].text | fromjson | map(.path) | .[0:5]'
echo ""

# Demo 4: Get file contents
echo "📄 Demo 4: Get package.json contents"
echo "-------------------------------------"
curl -s -X POST http://localhost:8080/tools/call \
  -d '{"name":"get_file","arguments":{"path":"package.json"}}' \
  | jq '.content[0].text | fromjson | {name, version, description}'
echo ""

# Demo 5: Reindex
echo "🔄 Demo 5: Manual reindexing"
echo "----------------------------"
curl -s -X POST http://localhost:8080/index | jq '.'
echo ""

# Demo 6: Health check
echo "💚 Demo 6: Health check"
echo "-----------------------"
curl -s http://localhost:8080/health | jq '.'
echo ""

# Cleanup
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null || true

echo ""
echo "✅ Demo complete!"
echo ""
echo "Try it yourself:"
echo "  node daemon/server.js"
echo "  curl -X POST http://localhost:8080/search -d '{\"query\":\"YOUR_QUERY\"}'"
