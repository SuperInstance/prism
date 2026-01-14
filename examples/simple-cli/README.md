# Example 1: Simple CLI Usage

**Difficulty**: Beginner
**Time**: 5 minutes
**Goal**: Learn basic PRISM CLI commands

This example shows you how to use PRISM through the command-line interface to index, search, and ask questions about a codebase.

---

## What You'll Learn

- How to index a codebase
- How to perform semantic searches
- How to ask questions about your code
- How to view usage statistics

---

## Prerequisites

- Node.js 18+ installed
- PRISM installed globally:
  ```bash
  npm install -g @claudes-friend/prism
  ```
- (Optional) Cloudflare account for cloud features

---

## Setup

### 1. Navigate to Example Directory

```bash
cd examples/simple-cli
```

### 2. Explore the Sample Code

Take a look at the sample codebase we'll be working with:

```bash
# See the structure
tree sample-code/

# Or use ls
ls -la sample-code/
```

The sample code contains:
- `src/auth/` - Authentication module
- `src/database/` - Database utilities
- `src/api/` - API endpoints
- `src/utils/` - Helper functions

---

## Running the Example

### Automated Script

Run the complete example automatically:

```bash
# Linux/macOS
./run-example.sh

# Windows (Git Bash or WSL)
bash run-example.sh
```

### Manual Steps

Or follow these steps manually:

#### Step 1: Index the Codebase

```bash
prism index ./sample-code
```

**Expected Output**:
```
Indexing /path/to/examples/simple-cli/sample-code...
✓ Found 12 files matching criteria
✓ Parsed 12 files (0.8s)
✓ Extracted 45 code elements
✓ Generated 45 embeddings (2.1s)
✓ Indexed 45 chunks (0.3s)

Index complete!
Files: 12 | Chunks: 45 | Time: 3.2s
Storage: .prism/vectors.db (1.2 MB)
```

#### Step 2: Perform Semantic Searches

Now let's search for code using natural language:

```bash
# Search for authentication code
prism search "how do users log in?"
```

**Expected Output**:
```
Searching for "how do users log in?"...
Found 3 results (0.05s)

sample-code/src/auth/login.ts (score: 0.92)
  Line 5: export async function login(username: string, password: string) {
  Line 6:   const user = await database.users.findOne({ username });
  Line 7:   if (!user) {
  Line 8:     throw new AuthError('Invalid credentials');
  Line 9:   }
  Line 10:   if (!await verifyPassword(password, user.passwordHash)) {
  Line 11:     throw new AuthError('Invalid password');
  Line 12:   }
  Line 13:   return generateToken(user);
  Line 14: }

sample-code/src/auth/middleware.ts (score: 0.87)
  Line 3: export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  Line 4:   const token = req.headers.authorization?.split(' ')[1];
  Line 5:   if (!token) {
  Line 6:     return res.status(401).json({ error: 'No token provided' });
  Line 7:   }
  Line 8:   const decoded = verifyToken(token);
  Line 9:   req.user = decoded;
  Line 10:   next();
  Line 11: }
```

```bash
# Search for database code
prism search "database connection"
```

```bash
# Search for API endpoints
prism search "API endpoints for users"
```

#### Step 3: Ask Questions

Use PRISM to ask questions about your code:

```bash
prism chat "How does the authentication system work?"
```

**Expected Output**:
```
Query: How does the authentication system work?

Optimizing context...
✓ Retrieved 8 relevant code chunks
✓ Selected 5 chunks within budget (2,100 tokens)
✓ Selected model: claude-3.5-sonnet

Answer:
The authentication system works as follows:

1. **Login Flow** (src/auth/login.ts):
   - User provides username and password
   - System looks up user in database
   - Verifies password using bcrypt
   - Generates JWT token on success

2. **Token Verification** (src/auth/middleware.ts):
   - Middleware extracts token from Authorization header
   - Verifies token signature
   - Attaches user info to request object

3. **Error Handling** (src/auth/errors.ts):
   - Invalid credentials → 401 error
   - Missing token → 401 error
   - Invalid token → 403 error

---
Token Usage:
  Input: 2,100 tokens (saved: 18,900 tokens, 90%)
  Output: estimated 300-400 tokens
  Model: claude-3.5-sonnet
```

#### Step 4: View Statistics

Check your usage and savings:

```bash
prism stats
```

**Expected Output**:
```
PRISM Statistics

Files indexed    12
Chunks created   45
Last indexed     1/14/2026, 8:30:45 PM

Session (since 5 minutes ago):
  Searches: 3
  Chat queries: 1
  Total tokens used: 2,450
  Total tokens saved: 19,550
  Average savings: 88.9%
```

---

## Try These Queries

Experiment with these searches:

### Semantic Searches

```bash
# Find error handling
prism search "error handling"

# Find validation code
prism search "input validation"

# Find database queries
prism search "database queries"

# Find API routes
prism search "HTTP endpoints"

# Find utility functions
prism search "helper functions"
```

### Questions to Ask

```bash
# Architecture questions
prism chat "What is the overall architecture?"

# Data flow questions
prism chat "How does data flow through the system?"

# Security questions
prism chat "What security measures are in place?"

# Best practices
prism chat "What are the coding patterns used?"
```

---

## Advanced Options

### Filter by File Type

```bash
# Only search TypeScript files
prism search "authentication" --extensions .ts

# Only search JavaScript files
prism search "database" --extensions .js
```

### Get More Results

```bash
# Get 20 results instead of 10
prism search "API" --limit 20
```

### Lower Similarity Threshold

```bash
# Get more results, even less similar
prism search "function" --threshold 0.6
```

### JSON Output

```bash
# Get results in JSON format
prism search "authentication" --format json
```

---

## Understanding the Output

### Search Results

```
sample-code/src/auth/login.ts (score: 0.92)
  Line 5: export async function login(username: string, password: string) {
  ...
```

- **File path**: `sample-code/src/auth/login.ts`
- **Similarity score**: `0.92` (92% similar to your query)
- **Line numbers**: Shows where the code is located
- **Code snippet**: Shows the relevant code

### Chat Output

```
✓ Retrieved 8 relevant code chunks
✓ Selected 5 chunks within budget (2,100 tokens)
✓ Selected model: claude-3.5-sonnet
```

- **Retrieved**: Total chunks found
- **Selected**: Chunks sent to AI (optimized for token budget)
- **Model**: AI model used

---

## Common Issues

### "Index not found" Error

**Problem**:
```
Error: No index found for current directory
```

**Solution**:
```bash
# Create the index first
prism index ./sample-code
```

### No Search Results

**Problem**: Search returns 0 results

**Solutions**:
```bash
# Lower the threshold
prism search "query" --threshold 0.6

# Check if index exists
prism stats

# Rebuild index
prism index --force
```

### Chat Not Working

**Problem**: Chat returns error

**Solutions**:
```bash
# Check if you have an API key
export ANTHROPIC_API_KEY=your-key-here

# Or use local Ollama (if installed)
prism chat "question" --model ollama
```

---

## Next Steps

Now that you understand the basics:

1. **Try the API Integration example**: Learn how to use PRISM in your own applications
2. **Try the MCP Integration example**: Use PRISM with Claude Code
3. **Try the IDE Integration example**: Optimize your development workflow
4. **Index your own codebase**:
   ```bash
   cd /path/to/your/project
   prism index
   prism search "your query"
   ```

---

## Clean Up

Remove the example index:

```bash
rm -rf .prism/
```

---

**Having trouble?**

- Check the [main documentation](../../../docs/)
- Open an issue: https://github.com/SuperInstance/PRISM/issues
- Join the discussion: https://github.com/SuperInstance/PRISM/discussions

---

**Next example**: [API Integration](../api-integration/)
