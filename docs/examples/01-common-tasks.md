# PRISM Examples Cookbook

**Component**: PRISM Usage Examples
**Version**: 0.1.0
**Last Updated**: 2026-01-13

## Overview

This cookbook provides practical examples for common PRISM workflows. Each example includes the command, expected output, and explanation of what's happening.

---

## Search Examples

### Basic Semantic Search

Find code by meaning, not just keywords.

```bash
prism search "how does user authentication work?"
```

**Why use this**: When you need to understand a system's functionality but don't know the exact function names.

**Output**:
```
Searching for "how does user authentication work?"...
Found 12 results (0.21s)

src/auth/login.ts (score: 0.94)
  Line 45: async function login(username, password) {
  Line 46:   const user = await db.users.findOne({ username });
  Line 47:   if (!user) throw new AuthError('User not found');
  Line 48:   if (!await bcrypt.compare(password, user.passwordHash)) {
  Line 49:     throw new AuthError('Invalid password');
  Line 50:   }
  Line 51:   return generateToken(user);
  Line 52: }

src/auth/middleware.ts (score: 0.91)
  Line 12: export function authMiddleware(req, res, next) {
  ...
```

---

### Find Error Handling

Search for how errors are handled in your codebase.

```bash
prism search "error handling and validation"
```

**Variations**:
```bash
# Search for specific error types
prism search "database error handling"

# Search for validation logic
prism search "input validation"

# Search for retry logic
prism search "retry on failure"
```

---

### Find API Endpoints

Discover all API routes and endpoints.

```bash
prism search "API endpoints and routes" --extensions .ts,.js
```

**Output**:
```
Searching for "API endpoints and routes"...
Found 28 results (0.19s)

src/api/routes/users.ts (score: 0.93)
  Line 12: router.get('/users', getUsers);
  Line 13: router.get('/users/:id', getUserById);
  Line 14: router.post('/users', createUser);
  Line 15: router.put('/users/:id', updateUser);
  Line 16: router.delete('/users/:id', deleteUser);

src/api/routes/auth.ts (score: 0.89)
  Line 8: router.post('/auth/login', login);
  Line 9: router.post('/auth/logout', logout);
  Line 10: router.post('/auth/refresh', refreshToken);
```

---

### Search Specific File Types

Focus your search on specific file types.

```bash
# Only TypeScript files
prism search "database connection" --extensions .ts

# Multiple file types
prism search "http client" --extensions .ts,.js,.tsx

# Exclude test files
prism search "user service" --exclude "test/**,spec/**"
```

---

### Search with Lower Threshold

Find more results, including less relevant ones.

```bash
prism search "configuration" --threshold 0.5 --limit 30
```

**When to use**: When you want to cast a wider net and see more potentially related code.

---

### Search Specific Directory

Limit search to a specific directory.

```bash
# Search only in src directory
prism search "database models" --paths "src/**"

# Search multiple directories
prism search "utilities" --paths "src/utils/**,lib/**"

# Exclude directories
prism search "api" --exclude "test/**,mocks/**,examples/**"
```

---

### JSON Output for Scripting

Use search results in scripts and automation.

```bash
prism search "authentication" --format json > auth_results.json
```

**Process with jq**:
```bash
# Count results
prism search "auth" --format json | jq '.totalResults'

# Extract file paths
prism search "database" --format json | jq -r '.results[].filePath'

# Sort by score
prism search "api" --format json | jq '.results | sort_by(.score) | reverse'

# Filter by score threshold
prism search "test" --format json | jq '.results[] | select(.score > 0.8)'
```

---

### Markdown Output for Documentation

Generate documentation from code.

```bash
prism search "public API methods" --format markdown --limit 50 > api_docs.md
```

**Output** (markdown):
```markdown
# Search Results: "public API methods"

## src/api/users.ts (score: 0.94)

\`\`\`typescript
Line 12: export async function getUsers(req: Request, res: Response) {
Line 13:   const users = await db.users.findMany();
Line 14:   return res.json(users);
Line 15: }
\`\`\`

## src/api/posts.ts (score: 0.91)
...
```

---

### Find Similar Functions

Find functions similar to one you know.

```bash
# First, find the function you know
prism search "createUser function"

# Then search for similar patterns
prism search "create entity with validation and save to database"
```

---

## Chat Examples

### Understand Architecture

Get high-level architecture overview.

```bash
prism chat "Explain the overall architecture of this application"
```

**Output**:
```
Query: Explain the overall architecture of this application

Optimizing context...
✓ Retrieved 31 relevant code chunks
✓ Selected 12 chunks within budget (8,234 tokens)
✓ Compressed to 3,456 tokens (58.0% reduction)

Answer:
This application follows a layered architecture:

1. **API Layer** (src/api/):
   - Express.js REST API
   - Route handlers in src/api/routes/
   - Middleware for auth, logging, error handling

2. **Service Layer** (src/services/):
   - Business logic separation
   - UserService, PostService, AuthService
   - Database interactions abstracted

3. **Data Layer** (src/db/):
   - PostgreSQL with Prisma ORM
   - Migrations in prisma/migrations/
   - Schema defined in prisma/schema.prisma

4. **Utilities** (src/utils/):
   - Shared helper functions
   - Logging, validation, formatting

Key patterns:
- Dependency injection for services
- Middleware for cross-cutting concerns
- Repository pattern for data access

---
Token Usage:
  Input: 3,456 tokens (saved: 27,544 tokens, 88.8%)
```

---

### Debug Issues

Get help understanding and fixing bugs.

```bash
prism chat "I'm getting a 'permission denied' error in the user module. What could cause this?"
```

**Follow-up questions**:
```bash
prism chat "How do I add more detailed logging to the auth module?"
prism chat "What are the common edge cases in the payment flow?"
```

---

### Refactor Code

Get suggestions for code improvements.

```bash
prism chat "How can I refactor the user service to be more testable?"
```

**More refactoring examples**:
```bash
# Improve error handling
prism chat "Refactor the error handling to be more consistent"

# Extract reusable logic
prism chat "Extract common validation logic into utility functions"

# Improve performance
prism chat "Optimize the database queries in the post service"
```

---

### Add New Features

Understand how to add new functionality.

```bash
prism chat "I need to add email notifications. How should I integrate this?"
```

**More feature examples**:
```bash
# Add caching
prism chat "How do I add caching to the frequently accessed data?"

# Add pagination
prism chat "Implement pagination for the user list endpoint"

# Add testing
prism chat "What's the testing strategy used in this project?"
```

---

### Explain Complex Code

Get explanations of complicated logic.

```bash
prism chat "Explain how the state management works in the Redux store"
```

**More explanation examples**:
```bash
# Explain algorithms
prism chat "Walk me through how the search ranking algorithm works"

# Explain data flow
prism chat "Trace the data flow from user signup to database storage"

# Explain design patterns
prism chat "What design patterns are used in the authentication system?"
```

---

### Generate Documentation

Create documentation from code understanding.

```bash
prism chat "Write API documentation for the user endpoints" --budget 100000
```

**More documentation examples**:
```bash
# Generate README section
prism chat "Write a README section explaining how to run tests"

# Create architecture diagram description
prism chat "Describe the system architecture for a technical diagram"

# Generate migration guide
prism chat "Write a migration guide for moving from v1 to v2 API"
```

---

### Compare Approaches

Compare different implementation options.

```bash
prism chat "Compare the current database approach with using an ORM"
```

**More comparison examples**:
```bash
# Compare libraries
prism chat "Compare using Zustand vs Redux for state management"

# Compare architectures
prism chat "Compare monolithic vs microservices architecture for this app"

# Compare patterns
prism chat "Compare repository pattern vs active record pattern"
```

---

## Integration Examples

### With Git Aliases

Add PRISM to your Git workflow.

```bash
# Add to ~/.gitconfig
[alias]
  search = "!f() { prism search \"$1\"; }; f"
  explain = "!f() { prism chat \"Explain: $1\"; }; f"
```

**Usage**:
```bash
git search "authentication flow"
git explain "the commit message"
```

---

### With Shell Scripts

Automate common tasks.

```bash
#!/bin/bash
# scripts/search-and-explain.sh

QUERY=$1

echo "Searching for: $QUERY"
echo "---"

RESULTS=$(prism search "$QUERY" --format json)
COUNT=$(echo "$RESULTS" | jq '.totalResults')

echo "Found $COUNT results"
echo "---"

echo "Top result:"
echo "$RESULTS" | jq '.results[0]'

echo "---"
echo "Explanation:"
prism chat "Explain the top result for: $QUERY"
```

**Usage**:
```bash
./scripts/search-and-explain.sh "user authentication"
```

---

### With Makefile

Add PRISM commands to your Makefile.

```makefile
# Makefile
.PHONY: search explain index

search:
	@read -p "Search query: " query; \
	prism search "$$query"

explain:
	@read -p "Explain: " topic; \
	prism chat "Explain: $$topic"

index-force:
	prism index --force

stats:
	prism stats --period week
```

**Usage**:
```bash
make search
make explain
make index-force
make stats
```

---

### With VS Code Tasks

Integrate with VS Code tasks.

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "PRISM: Search",
      "type": "shell",
      "command": "prism",
      "args": [
        "search",
        "${input:query}"
      ],
      "problemMatcher": []
    },
    {
      "label": "PRISM: Reindex",
      "type": "shell",
      "command": "prism",
      "args": ["index", "--force"],
      "problemMatcher": []
    }
  ],
  "inputs": [
    {
      "id": "query",
      "type": "promptString",
      "description": "Search query"
    }
  ]
}
```

---

## Advanced Usage

### Combining Multiple Searches

Chain searches to narrow down results.

```bash
# First search: Find authentication files
prism search "authentication" --format json | jq -r '.results[].filePath' > auth_files.txt

# Second search: Within those files, find error handling
while read file; do
  prism search "error handling" --paths "$file"
done < auth_files.txt
```

---

### Automated Code Review

Create automated code review reports.

```bash
#!/bin/bash
# scripts/code-review.sh

# Index current branch
prism index --force

# Check for common issues
echo "=== Security Issues ==="
prism search "SQL injection" --limit 10

echo "=== Error Handling ==="
prism search "unhandled error" --limit 10

echo "=== TODO Comments ==="
prism search "TODO FIXME" --limit 20

echo "=== Complex Functions ==="
prism chat "List the 10 most complex functions and suggest refactoring"
```

---

### Performance Profiling

Profile your codebase for optimization opportunities.

```bash
# Find large functions
prism search "long function with complex logic" --limit 20

# Get optimization suggestions
prism chat "Identify performance bottlenecks in the data processing pipeline"

# Find database queries
prism search "database query" --extensions .ts,.js --limit 30
```

---

### Dependency Analysis

Understand dependencies and coupling.

```bash
# Find what depends on a module
prism search "imports UserService" --limit 20

# Analyze module dependencies
prism chat "What are the main modules and how do they depend on each other?"

# Find circular dependencies
prism chat "Are there any circular dependencies in the codebase?"
```

---

## Troubleshooting Examples

### No Search Results

When search returns no results:

```bash
# Try lowering threshold
prism search "your query" --threshold 0.5

# Check if index exists
prism stats

# Rebuild index
prism index --force

# Try different query terms
prism search "alternative terms for your query"
```

---

### Slow Performance

When PRISM is slow:

```bash
# Check what's being indexed
prism index --verbose

# Reduce indexing scope
prism index --exclude "node_modules/**,dist/**,build/**"

# Use fewer workers
prism index --workers 2

# Check cache performance
prism stats --verbose
```

---

### Memory Issues

When running out of memory:

```bash
# Reduce workers
prism index --workers 2

# Reduce batch size
# Add to config:
# embeddings:
#   batchSize: 5

# Index in smaller chunks
prism index --path ./src
```

---

## Tips and Tricks

### 1. Use Natural Language

PRISM understands natural language queries.

```bash
# GOOD
prism search "how does the payment system handle refunds?"

# LESS EFFECTIVE
prism search "payment refund"
```

---

### 2. Iterate on Queries

Refine your queries based on results.

```bash
# Start broad
prism search "database"

# Narrow down
prism search "database connection configuration"

# Get specific
prism search "PostgreSQL connection pool setup"
```

---

### 3. Use Context

Provide more context for better results.

```bash
# Vague
prism search "error handling"

# Better
prism search "error handling in async functions"

# Best
prism search "how to handle errors in async database operations"
```

---

### 4. Combine with Grep

Use PRISM for semantic search, grep for keyword search.

```bash
# Semantic search
prism search "user authentication"

# Keyword search
grep -r "authenticate" src/

# Combine: Find results from both
prism search "authentication" --format json | jq -r '.results[].filePath' | xargs grep -l "token"
```

---

### 5. Save Common Queries

Create aliases for frequent searches.

```bash
# Add to ~/.bashrc or ~/.zshrc
alias prism-auth='prism search "authentication"'
alias prism-db='prism search "database"'
alias prism-api='prism search "API endpoint"'
```

---

## Real-World Scenarios

### Scenario 1: Onboarding to New Project

```bash
# First, index the codebase
prism index

# Understand architecture
prism chat "Explain the overall architecture"

# Find key functionality
prism search "user management"
prism search "API endpoints"

# Understand data models
prism chat "What are the main data models and how do they relate?"

# Review common patterns
prism chat "What are the common design patterns used?"
```

---

### Scenario 2: Implementing New Feature

```bash
# Find similar existing features
prism search "user creation with validation"

# Understand the pattern
prism chat "How are new features typically added?"

# Find relevant modules
prism search "notification system"

# Get implementation guidance
prism chat "How should I integrate a new notification type?"
```

---

### Scenario 3: Debugging Production Issue

```bash
# Search for error-related code
prism search "error handling in payment processing"

# Understand the flow
prism chat "Trace the payment processing flow"

# Find potential issues
prism chat "What could cause payment processing to fail silently?"

# Find logging
prism search "logging and monitoring"
```

---

### Scenario 4: Refactoring Large Codebase

```bash
# Identify complex areas
prism chat "What are the most complex parts of the codebase?"

# Find coupling
prism chat "Which modules have high coupling?"

# Find refactoring opportunities
prism search "long function with multiple responsibilities"

# Get refactoring plan
prism chat "Create a refactoring plan to improve code quality"
```

---

### Scenario 5: Preparing for Code Review

```bash
# Find related code
prism search "user permissions and access control"

# Understand implications
prism chat "What are the security implications of changing the auth system?"

# Find test coverage
prism search "test for authentication"

# Generate review checklist
prism chat "What should I review in a PR that changes the authentication system?"
```

---

**Document Status**: Complete
**Last Updated**: 2026-01-13
**Next Review**: After v0.2.0 release
