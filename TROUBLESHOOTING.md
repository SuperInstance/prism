# PRISM Troubleshooting Guide

Solutions to common problems and issues.

---

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Server/Worker Issues](#serverworker-issues)
3. [Indexing Issues](#indexing-issues)
4. [Search Issues](#search-issues)
5. [Performance Issues](#performance-issues)
6. [Network Issues](#network-issues)
7. [Integration Issues](#integration-issues)
8. [Error Messages](#error-messages)
9. [Debugging Tips](#debugging-tips)

---

## Installation Issues

### Problem: npm install fails

**Symptoms:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solutions:**

1. **Clear npm cache:**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Use correct Node version:**
   ```bash
   # Check version
   node --version  # Should be 18.0.0 or higher

   # Install/use Node 18+
   nvm install 18
   nvm use 18
   npm install
   ```

3. **Force install:**
   ```bash
   npm install --force
   ```

4. **Try with legacy peer deps:**
   ```bash
   npm install --legacy-peer-deps
   ```

---

### Problem: Wrangler not found after install

**Symptoms:**
```bash
$ wrangler
command not found: wrangler
```

**Solutions:**

1. **Install globally:**
   ```bash
   npm install -g wrangler
   ```

2. **Use npx:**
   ```bash
   npx wrangler login
   npx wrangler deploy
   ```

3. **Add npm global bin to PATH:**
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   export PATH="$PATH:$(npm config get prefix)/bin"
   source ~/.bashrc
   ```

4. **Check installation:**
   ```bash
   npm list -g wrangler
   which wrangler
   ```

---

### Problem: Permission denied during install

**Symptoms:**
```
npm ERR! code EACCES
npm ERR! Error: EACCES: permission denied
```

**Solutions:**

1. **Don't use sudo (recommended):**
   ```bash
   # Configure npm to use a directory you own
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'

   # Add to PATH in ~/.bashrc or ~/.zshrc
   export PATH=~/.npm-global/bin:$PATH
   source ~/.bashrc

   # Reinstall
   npm install -g @claudes-friend/prism
   ```

2. **Fix permissions:**
   ```bash
   sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
   ```

3. **Use nvm (best practice):**
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   npm install -g @claudes-friend/prism
   ```

---

## Server/Worker Issues

### Problem: Worker won't deploy

**Symptoms:**
```
✘ [ERROR] A request to the Cloudflare API failed
```

**Solutions:**

1. **Login to Cloudflare:**
   ```bash
   wrangler login
   ```

2. **Check account ID:**
   ```bash
   # Get account ID
   wrangler whoami

   # Add to wrangler.toml
   # account_id = "your-account-id-here"
   ```

3. **Verify resources exist:**
   ```bash
   # Check D1 database
   wrangler d1 list

   # Check Vectorize index
   wrangler vectorize list

   # Create if missing
   npm run db:create
   npm run vectorize:create
   ```

4. **Check Cloudflare status:**
   Visit [cloudflarestatus.com](https://www.cloudflarestatus.com/)

5. **Redeploy:**
   ```bash
   npm run deploy
   ```

---

### Problem: "No worker URL configured"

**Symptoms:**
```
Error: PRISM_URL environment variable not set
```

**Solutions:**

1. **Set environment variable:**
   ```bash
   export PRISM_URL=https://claudes-friend.your-username.workers.dev
   ```

2. **Add to shell profile:**
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   echo 'export PRISM_URL=https://your-worker.workers.dev' >> ~/.bashrc
   source ~/.bashrc
   ```

3. **Get worker URL from deployment:**
   ```bash
   # Redeploy and copy URL from output
   npm run deploy

   # Or check Cloudflare dashboard
   # Go to Workers & Pages > Overview
   ```

4. **Verify URL:**
   ```bash
   curl $PRISM_URL/health
   ```

---

### Problem: Worker returns 500 errors

**Symptoms:**
```json
{
  "success": false,
  "error": "Internal Server Error"
}
```

**Solutions:**

1. **Check worker logs:**
   ```bash
   wrangler tail
   ```

2. **Verify bindings:**
   ```bash
   # Check wrangler.toml has all required bindings:
   # - DB (D1)
   # - VECTORIZE (Vectorize)
   # - AI (Workers AI)
   # - KV (KV namespace)
   ```

3. **Run migrations:**
   ```bash
   wrangler d1 execute claudes-friend-db --file=./migrations/002_vector_index.sql
   ```

4. **Check environment variables:**
   ```bash
   # Verify in wrangler.toml [vars] section
   ENVIRONMENT = "production"
   LOG_LEVEL = "info"
   EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5"
   ```

5. **Redeploy:**
   ```bash
   npm run deploy
   ```

---

### Problem: "Failed to connect to worker"

**Symptoms:**
```
Error: Failed to connect to https://your-worker.workers.dev
```

**Solutions:**

1. **Check internet connection:**
   ```bash
   ping 1.1.1.1
   curl https://www.cloudflare.com
   ```

2. **Verify worker is running:**
   ```bash
   curl https://your-worker.workers.dev/health
   ```

3. **Check firewall/proxy:**
   ```bash
   # Try without proxy
   unset HTTP_PROXY HTTPS_PROXY
   prism health
   ```

4. **Verify worker URL:**
   ```bash
   echo $PRISM_URL
   # Should be: https://claudes-friend.your-username.workers.dev
   ```

5. **Test locally:**
   ```bash
   npm run dev
   # Use http://localhost:8788 for testing
   export PRISM_URL=http://localhost:8788
   prism health
   ```

---

## Indexing Issues

### Problem: Indexing fails with no error

**Symptoms:**
```
Indexing src/...
✓ Processed 0 files
```

**Solutions:**

1. **Check file extensions:**
   ```bash
   # List files that would be indexed
   find ./src -type f \( -name "*.ts" -o -name "*.js" -o -name "*.py" \)

   # Specify extensions explicitly
   prism index ./src --extensions .ts,.tsx,.js,.jsx
   ```

2. **Check exclude patterns:**
   ```bash
   # Try without excludes
   prism index ./src --verbose

   # Or specify custom excludes
   prism index ./src --exclude node_modules
   ```

3. **Verify path exists:**
   ```bash
   ls -la ./src
   cd src && pwd
   ```

4. **Use absolute path:**
   ```bash
   prism index /full/path/to/src
   ```

---

### Problem: "Embedding generation failed"

**Symptoms:**
```
Error: Embedding generation failed: Workers AI quota exceeded
```

**Solutions:**

1. **Check quota:**
   - Go to Cloudflare Dashboard
   - Navigate to Workers & Pages > Overview
   - Check "Workers AI" usage

2. **Wait for quota reset:**
   - Free tier: 10,000 embeddings/day
   - Resets: Midnight UTC
   - Check remaining: `curl $PRISM_URL/api/stats`

3. **Upgrade plan:**
   - Paid plan: 100,000 embeddings/day
   - Go to Cloudflare Dashboard > Workers & Pages > Plans

4. **Retry later:**
   ```bash
   # Wait 1 hour and retry
   sleep 3600
   prism index ./src --incremental
   ```

5. **Reduce batch size:**
   ```bash
   # Index smaller directories
   prism index ./src/auth
   prism index ./src/database
   prism index ./src/api
   ```

---

### Problem: "File too large" error

**Symptoms:**
```
Error: File exceeds maximum size limit (1MB)
File: src/large-data.ts (5.2MB)
```

**Solutions:**

1. **Increase size limit:**
   ```bash
   prism index ./src --max-size 10  # 10MB limit
   ```

2. **Exclude large files:**
   ```bash
   prism index ./src --exclude "**/*large-data.ts"
   ```

3. **Split large files:**
   - Break into smaller modules
   - Use ES6 imports/exports
   - Extract data to separate files

4. **Skip specific files:**
   ```bash
   # Create .prismignore file
   echo "src/large-data.ts" > .prismignore
   echo "**/*.min.js" >> .prismignore
   ```

---

### Problem: Slow indexing performance

**Symptoms:**
- Indexing takes several minutes
- CPU usage is high
- Progress seems stuck

**Solutions:**

1. **Use incremental indexing:**
   ```bash
   prism index ./src --incremental
   # 21x faster for unchanged files
   ```

2. **Exclude unnecessary files:**
   ```bash
   prism index ./src \
     --exclude node_modules \
     --exclude dist \
     --exclude coverage \
     --exclude "**/*.test.ts"
   ```

3. **Index in smaller batches:**
   ```bash
   # Split by directory
   prism index ./src/auth --incremental
   prism index ./src/api --incremental
   prism index ./src/database --incremental
   ```

4. **Check network speed:**
   ```bash
   # Test upload speed to Cloudflare
   curl -o /dev/null -w "Time: %{time_total}s\n" \
     -X POST $PRISM_URL/health
   ```

5. **Use local dev mode:**
   ```bash
   # Run worker locally
   npm run dev
   export PRISM_URL=http://localhost:8788
   prism index ./src
   ```

---

## Search Issues

### Problem: No search results found

**Symptoms:**
```
Found 0 results for "authentication flow"
```

**Solutions:**

1. **Check if index exists:**
   ```bash
   prism stats
   # Should show files and chunks
   ```

2. **Verify index has content:**
   ```bash
   curl $PRISM_URL/api/stats
   # Check "chunks" count > 0
   ```

3. **Lower similarity threshold:**
   ```bash
   prism search "auth" --min-score 0.5
   # Default is 0.7
   ```

4. **Try broader query:**
   ```bash
   # Too specific:
   prism search "authenticateUserWithJWTToken"

   # Better:
   prism search "authentication"
   prism search "user login"
   ```

5. **Check filters:**
   ```bash
   # Remove filters
   prism search "auth"

   # Instead of:
   prism search "auth" --lang python --path src/api/
   ```

6. **Reindex:**
   ```bash
   prism index ./src --force
   prism search "authentication"
   ```

---

### Problem: Irrelevant search results

**Symptoms:**
- Results don't match query intent
- Low relevance scores
- Wrong files returned

**Solutions:**

1. **Increase minimum score:**
   ```bash
   prism search "auth" --min-score 0.8
   # Only high-confidence matches
   ```

2. **Use more specific query:**
   ```bash
   # Vague:
   prism search "user"

   # Better:
   prism search "user authentication and session management"
   ```

3. **Add filters:**
   ```bash
   prism search "database" \
     --lang typescript \
     --path src/database/
   ```

4. **Check indexed content:**
   ```bash
   prism stats
   # Verify expected files are indexed
   ```

5. **Use different embedding model:**
   ```toml
   # Edit wrangler.toml
   [vars]
   EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5"
   # Better quality, slower
   ```

---

### Problem: Search timeout or slow

**Symptoms:**
- Search takes >5 seconds
- Timeout errors
- High latency

**Solutions:**

1. **Reduce result limit:**
   ```bash
   prism search "auth" --limit 5
   # Faster than --limit 100
   ```

2. **Add filters:**
   ```bash
   prism search "auth" --lang typescript
   # Reduces search space
   ```

3. **Check worker performance:**
   ```bash
   wrangler tail
   # Look for slow queries
   ```

4. **Verify Vectorize is healthy:**
   ```bash
   curl $PRISM_URL/health
   # Check vectorize status
   ```

5. **Check network latency:**
   ```bash
   ping -c 5 $(echo $PRISM_URL | sed 's/https:\/\///')
   ```

---

## Performance Issues

### Problem: High memory usage

**Symptoms:**
- System slows down during indexing
- Out of memory errors
- Swap usage increases

**Solutions:**

1. **Index in smaller batches:**
   ```bash
   # Instead of:
   prism index ./

   # Do:
   prism index ./src
   prism index ./lib
   prism index ./packages
   ```

2. **Exclude large directories:**
   ```bash
   prism index ./src --exclude node_modules,dist
   ```

3. **Use incremental mode:**
   ```bash
   prism index ./src --incremental
   ```

4. **Close other applications:**
   - Free up RAM before indexing
   - Check with: `free -h` or `top`

---

### Problem: High CPU usage

**Symptoms:**
- CPU at 100% during operations
- System becomes unresponsive
- Fan runs constantly

**Solutions:**

1. **Index incrementally:**
   ```bash
   prism index ./src --incremental
   ```

2. **Rate limit operations:**
   ```bash
   # Add delays between batches
   prism index ./src/auth && sleep 5
   prism index ./src/api && sleep 5
   ```

3. **Check for infinite loops:**
   ```bash
   # Look for stuck processes
   ps aux | grep prism
   kill <PID>  # If necessary
   ```

---

### Problem: Slow network requests

**Symptoms:**
- API calls take >2 seconds
- Timeouts
- Connection errors

**Solutions:**

1. **Check internet speed:**
   ```bash
   # Test connection to Cloudflare
   curl -w "@curl-format.txt" -o /dev/null $PRISM_URL/health
   ```

2. **Use CDN:**
   - Cloudflare Workers are already on CDN
   - Requests should be <100ms

3. **Check proxy settings:**
   ```bash
   echo $HTTP_PROXY
   echo $HTTPS_PROXY
   # Unset if causing issues
   unset HTTP_PROXY HTTPS_PROXY
   ```

4. **Test locally:**
   ```bash
   npm run dev
   export PRISM_URL=http://localhost:8788
   ```

---

## Network Issues

### Problem: CORS errors

**Symptoms:**
```
Access to fetch at '...' has been blocked by CORS policy
```

**Solutions:**

1. **Check allowed origins:**
   ```typescript
   // In src/worker-vectorize.ts
   const ALLOWED_ORIGINS = [
     'http://localhost:3000',
     'https://yourdomain.com'
   ];
   ```

2. **Add your origin:**
   ```typescript
   // Edit and redeploy
   const ALLOWED_ORIGINS = [
     'http://localhost:3000',
     'https://yourdomain.com',
     'https://your-app.com'  // Add this
   ];
   ```

3. **Use CLI instead:**
   ```bash
   # CLI doesn't have CORS issues
   prism search "auth"
   ```

4. **Proxy requests:**
   ```javascript
   // Use your backend as proxy
   fetch('/api/prism/search', {
     method: 'POST',
     body: JSON.stringify({ query })
   });
   ```

---

### Problem: SSL/TLS errors

**Symptoms:**
```
Error: self signed certificate in certificate chain
```

**Solutions:**

1. **Update Node.js:**
   ```bash
   nvm install 18
   nvm use 18
   ```

2. **Update CA certificates:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install ca-certificates

   # macOS
   brew install ca-certificates
   ```

3. **Use secure connection:**
   ```bash
   # Always use HTTPS
   export PRISM_URL=https://your-worker.workers.dev
   ```

---

## Integration Issues

### Problem: MCP tools not working

**Symptoms:**
- Tools not showing in Claude Code
- Tool execution fails
- No response from tools

**Solutions:**

1. **Check MCP configuration:**
   ```json
   // In Claude Code settings
   {
     "mcpServers": {
       "prism": {
         "url": "https://your-worker.workers.dev"
       }
     }
   }
   ```

2. **Verify worker supports MCP:**
   ```bash
   curl $PRISM_URL/api/search \
     -H "Content-Type: application/json" \
     -d '{"query":"test"}'
   ```

3. **Check tool schema:**
   - Tools must follow MCP protocol
   - Verify input/output formats

4. **Test tools directly:**
   ```bash
   # Test search tool
   prism search "test"
   ```

---

### Problem: Claude Code integration issues

**Symptoms:**
- PRISM not available in Claude
- Search results not appearing
- Context not optimized

**Solutions:**

1. **Install MCP plugin:**
   - Follow [MCP Integration Guide](./docs/architecture/05-mcp-plugin-spec.md)

2. **Verify plugin is loaded:**
   - Check Claude Code settings
   - Look for PRISM in available tools

3. **Test with CLI first:**
   ```bash
   prism search "test"
   # Verify basic functionality works
   ```

4. **Check logs:**
   - Enable debug mode in Claude Code
   - Look for MCP errors

---

## Error Messages

### "Invalid request body"

**Cause:** Malformed JSON or missing required fields

**Fix:**
```bash
# Correct format:
curl -X POST $PRISM_URL/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"auth"}'

# Not:
curl -X POST $PRISM_URL/api/search \
  -d 'query=auth'  # Missing JSON format
```

---

### "Vectorize query failed"

**Cause:** Vectorize service issue

**Fix:**
1. Check Cloudflare status
2. Retry after a few minutes
3. Check worker logs: `wrangler tail`

---

### "D1 query failed"

**Cause:** Database connection issue

**Fix:**
1. Verify D1 binding in wrangler.toml
2. Check database exists:
   ```bash
   wrangler d1 list
   ```
3. Run migrations:
   ```bash
   npm run db:migrate
   ```

---

### "Workers AI quota exceeded"

**Cause:** Free tier limit reached (10,000/day)

**Fix:**
1. Wait for reset (midnight UTC)
2. Upgrade to paid plan
3. Use incremental indexing to reduce embeddings

---

## Debugging Tips

### Enable Verbose Logging

```bash
# CLI verbose mode
prism index ./src --verbose
prism search "auth" --verbose

# Worker logs
wrangler tail

# With filters
wrangler tail --status error
wrangler tail --grep "embedding"
```

### Check Worker Status

```bash
# Health check
curl $PRISM_URL/health | jq

# Statistics
curl $PRISM_URL/api/stats | jq

# Recent deployments
wrangler deployments list
```

### Test Individual Components

```bash
# Test D1
wrangler d1 execute claudes-friend-db --command="SELECT COUNT(*) FROM hnsw_metadata"

# Test Vectorize
wrangler vectorize list

# Test Workers AI
wrangler ai run @cf/baai/bge-small-en-v1.5 --text="test"
```

### Debug Locally

```bash
# Run worker locally
npm run dev

# Set local URL
export PRISM_URL=http://localhost:8788

# Test
prism health
prism search "test"
```

### Check Configuration

```bash
# View environment
env | grep PRISM

# View wrangler config
cat wrangler.toml

# Validate JSON
cat request.json | jq
```

### Collect Debug Information

```bash
# For bug reports, collect:
echo "PRISM Version: $(prism --version)"
echo "Node Version: $(node --version)"
echo "OS: $(uname -a)"
echo "Worker URL: $PRISM_URL"

# Test health
curl $PRISM_URL/health

# Check stats
prism stats

# Recent searches
prism history
```

---

## Getting More Help

### 1. Check Documentation

- [User Guide](./USER_GUIDE.md)
- [API Reference](./API_REFERENCE.md)
- [Configuration](./CONFIGURATION.md)
- [Architecture Docs](./docs/architecture/)

### 2. Search Issues

- GitHub: [github.com/SuperInstance/prism/issues](https://github.com/SuperInstance/prism/issues)
- Search existing issues before creating new ones

### 3. Ask Community

- Discussions: [github.com/SuperInstance/prism/discussions](https://github.com/SuperInstance/prism/discussions)
- Discord: [Join our Discord](#) (coming soon)

### 4. Report Bugs

When reporting bugs, include:

1. **Environment:**
   - PRISM version
   - Node.js version
   - Operating system
   - Cloudflare account type (free/paid)

2. **Steps to reproduce:**
   ```bash
   # Example:
   prism index ./src
   prism search "authentication"
   # Error appears here
   ```

3. **Expected vs actual behavior:**
   - What you expected to happen
   - What actually happened

4. **Logs:**
   ```bash
   wrangler tail > logs.txt
   # Attach logs.txt
   ```

5. **Configuration:**
   ```bash
   # Sanitize sensitive data
   cat wrangler.toml
   echo $PRISM_URL
   ```

---

**Last Updated:** 2026-01-15
**Version:** 0.3.2

Need immediate help? Check our [FAQ](./USER_GUIDE.md#faq) or [open an issue](https://github.com/SuperInstance/prism/issues).
