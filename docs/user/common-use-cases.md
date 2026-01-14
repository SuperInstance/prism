# PRISM Common Use Cases

**Real-world examples of how developers use PRISM**

---

## Use Case 1: Onboarding to a New Codebase

**Scenario**: You joined a new team and need to understand a 100K+ LOC codebase quickly.

### The Old Way

```
1. Spend hours reading README files
2. Ask coworkers lots of questions
3. Get lost in file explorer
4. Still don't understand the architecture
5. Takes 2-3 weeks to become productive
```

### The PRISM Way

```bash
# Index the codebase (one-time setup)
prism index ./src

# Ask high-level questions
prism search "authentication system"
prism search "database models"
prism search "API endpoints"

# Understand architecture
prism chat "What is the overall architecture?"
prism chat "How are different modules organized?"

# Deep dive into specific areas
prism search "payment processing"
prism search "user management"
```

**Result**: You understand the codebase in 1-2 days instead of weeks.

---

## Use Case 2: Debugging Production Issues

**Scenario**: A bug is reported in production and you need to find and fix it fast.

### The Old Way

```
1. Read the error message
2. Grep for error keywords
3. Open 20+ files trying to find relevant code
4. Miss critical files
5. Spend 4+ hours investigating
6. Still not sure you have the full picture
```

### The PRISM Way

```bash
# Search for error-related code
prism search "permission denied" --limit 20

# Find specific functionality
prism search "user authentication"

# Ask about potential causes
prism chat "What could cause 'permission denied' in the user module?"

# Find related code
prism search "authorization check" --limit 30
```

**Result**: You find and fix the bug in 30-60 minutes with complete context.

---

## Use Case 3: Implementing New Features

**Scenario**: You need to add a new feature and want to follow existing patterns.

### The Old Way

```
1. Search for similar features using grep
2. Find some files, miss others
3. Try to understand patterns from incomplete code
4. Implement feature inconsistently
5. Code review: "This doesn't match our patterns"
```

### The PRISM Way

```bash
# Find similar functionality
prism search "CRUD operations for users"

# Understand existing patterns
prism chat "How are CRUD operations implemented in this codebase?"

# Find all related code
prism search "user model" --limit 20
prism search "user API endpoints"

# Ask about best practices
prism chat "What are the common patterns for creating new endpoints?"
```

**Result**: You implement the feature following existing patterns perfectly.

---

## Use Case 4: Code Reviews

**Scenario**: You're reviewing a PR and need to understand the changes and their impact.

### The Old Way

```
1. Read through each changed file
2. Try to understand the context
3. Miss related code in other files
4. Don't fully understand the impact
5. Approve with reservations
```

### The PRISM Way

```bash
# Index the PR branch
git checkout feature/new-auth
prism index --force

# Search for changed functionality
prism search "authentication" --limit 20

# Ask about impact
prism chat "What are the security implications of these changes?"

# Compare with main branch
git checkout main
prism index --force
prism search "authentication"

# Understand differences
prism chat "How does this PR change the authentication flow?"
```

**Result**: You understand the full impact of changes and can review confidently.

---

## Use Case 5: Reducing AI Token Usage

**Scenario**: You're using Claude/GPT to help with development but hitting token limits.

### The Old Way

```
1. Copy-paste random files into Claude
2. Hit context window limit
3. Have to be selective about what to include
4. Miss important files
5. Claude gives incomplete answers
6. Waste money on excess tokens
```

### The PRISM Way

```bash
# Search for relevant code
prism search "payment processing" --limit 10

# Copy the results into Claude
# Only the most relevant code, perfectly optimized

# Or use PRISM chat directly
prism chat "How does the payment system work?"
# PRISM automatically optimizes context
```

**Result**: 90%+ token savings, better answers, lower costs.

---

## Use Case 6: Finding and Fixing Bugs

**Scenario**: You need to find all instances of a pattern to fix a bug.

### The Old Way

```
1. Grep for pattern
2. Get 100+ results
3. Manually filter through them
4. Miss some instances
5. Bug persists
```

### The PRISM Way

```bash
# Search semantically
prism search "database connection handling" --limit 30

# Find all related code
prism search "database error handling" --threshold 0.6

# Ask about edge cases
prism chat "What are all the places where database connections are handled?"

# Find similar patterns
prism search "similar connection handling"
```

**Result**: You find all instances and fix the bug completely.

---

## Use Case 7: Documentation Generation

**Scenario**: You need to document a complex system.

### The Old Way

```
1. Read through files manually
2. Try to understand architecture
3. Miss important components
4. Write incomplete documentation
5. Update it when you remember
```

### The PRISM Way

```bash
# Generate architecture overview
prism chat "Explain the overall system architecture" --save architecture.md

# Document specific modules
prism chat "How does the payment system work?" --save payment-flow.md
prism chat "How does authentication work?" --save auth-flow.md

# Create API documentation
prism chat "List all API endpoints with descriptions" --save api-docs.md

# Document data models
prism chat "What are all the data models in this system?" --save data-models.md
```

**Result**: Comprehensive documentation generated in minutes.

---

## Use Case 8: Refactoring

**Scenario**: You need to refactor a module and want to understand all dependencies.

### The Old Way

```
1. Find the module
2. Grep for imports/references
3. Miss some dependencies
4. Break things when refactoring
5. Spend time fixing bugs
```

### The PRISM Way

```bash
# Find the module and all related code
prism search "user authentication module" --limit 30

# Ask about dependencies
prism chat "What code depends on the authentication module?"

# Find all usage patterns
prism search "authentication function calls"

# Understand the impact
prism chat "What would break if I changed the authentication interface?"
```

**Result**: You understand all dependencies and refactor safely.

---

## Use Case 9: Learning from Codebases

**Scenario**: You want to learn how to implement a specific feature by looking at examples.

### The Old Way

```
1. Search GitHub for examples
2. Download repos
3. Grep through code
4. Find incomplete examples
5. Still not sure how to implement
```

### The PRISM Way**

```bash
# Clone an open-source repo
git clone https://github.com/example/react-app.git
cd react-app

# Index it
prism index

# Learn from it
prism search "state management patterns"
prism search "API integration"
prism chat "How is state management implemented?"

# Find specific patterns
prism search "React hooks usage"
prism search "error handling"
```

**Result**: You learn best practices from real-world codebases.

---

## Use Case 10: Security Audits

**Scenario**: You need to audit code for security issues.

### The Old Way

```
1. Manually review files
2. Search for common vulnerabilities
3. Miss some instances
4. Spend days on the audit
5. Still miss things
```

### The PRISM Way

```bash
# Find authentication code
prism search "user authentication" --limit 30

# Find input validation
prism search "input validation"

# Find database queries
prism search "database queries"

# Ask about security
prism chat "What are the potential security vulnerabilities in the authentication system?"

# Find sensitive data handling
prism search "password handling"
prism search "token management"
```

**Result**: Comprehensive security audit in hours instead of days.

---

## Bonus: Integrating with Claude Code

PRISM works seamlessly with Claude Code via MCP:

```bash
# Install MCP integration
prism mcp install

# Configure Claude Code
# Add to ~/.config/claude-code/config.json:
{
  "mcpServers": {
    "prism": {
      "command": "prism",
      "args": ["mcp", "server"]
    }
  }
}

# Use in Claude Code
# "Use prism_search to find authentication code"
# "Use prism_chat to explain the payment flow"
```

**Result**: PRISM becomes a first-class tool in your AI workflow.

---

## Summary

PRISM helps you:

1. **Understand codebases faster** - Onboard in days instead of weeks
2. **Debug more efficiently** - Find and fix bugs in minutes
3. **Implement features correctly** - Follow existing patterns
4. **Review code thoroughly** - Understand full impact of changes
5. **Save money on AI** - 90%+ token reduction
6. **Find all related code** - Never miss important files
7. **Generate documentation** - Create docs automatically
8. **Refactor safely** - Understand all dependencies
9. **Learn from examples** - Study best practices
10. **Audit for security** - Find vulnerabilities quickly

---

## Next Steps

- Try the [Simple CLI Example](../../examples/simple-cli/)
- Learn about [MCP Integration](./mcp-integration.md)
- Explore [Advanced Usage](./usage.md)
- Read the [FAQ](./faq.md)

---

**Document Status**: Complete
**Last Updated**: 2026-01-14
**Version**: 1.0.0
