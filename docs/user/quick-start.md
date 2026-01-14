# PRISM Quick Start Guide

**Get up and running with PRISM in 5 minutes**

---

## Prerequisites

You only need:
- **Node.js 18+** installed
- 5 minutes of your time

That's it!

---

## Installation (30 seconds)

```bash
npm install -g @claudes-friend/prism
```

Verify installation:

```bash
prism --version
# Expected output: prism version 1.0.0
```

---

## Cloudflare Setup (2 minutes)

PRISM uses Cloudflare's free tier for storage and AI. It takes 2 minutes to set up.

### Step 1: Install Wrangler

```bash
npm install -g wrangler
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This opens your browser. Click "Authorize" and you're done!

### Step 3: Deploy PRISM

```bash
# Clone the repository
git clone https://github.com/SuperInstance/PRISM.git
cd PRISM

# Install dependencies
npm install

# Deploy (creates everything automatically)
npm run deploy
```

**That's it!** PRISM will automatically:
- ✅ Create a free D1 database
- ✅ Create a free Vectorize index
- ✅ Deploy the Worker to Cloudflare's edge
- ✅ Configure everything for you

**Total cost: $0/month** (Cloudflare's free tier)

---

## Your First Search (2 minutes)

### Step 1: Navigate to Your Project

```bash
cd /path/to/your/project
```

### Step 2: Index Your Codebase

```bash
prism index ./src
```

**Expected Output**:
```
Indexing /path/to/your/project...
✓ Found 247 files matching criteria
✓ Parsed 247 files (3.2s)
✓ Extracted 3,456 code elements
✓ Generated 3,456 embeddings (18.4s)
✓ Indexed 3,456 chunks (1.2s)

Index complete!
Files: 247 | Chunks: 3,456 | Time: 22.8s
Storage: .prism/vectors.db (12.4 MB)
```

### Step 3: Search!

```bash
prism search "how do users authenticate?"
```

**Expected Output**:
```
Searching for "how do users authenticate?"...
Found 8 results (0.18s)

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
  Line 13:   const token = req.headers.authorization?.split(' ')[1];
  Line 14:   if (!token) return res.status(401).json({ error: 'No token' });
  Line 15:   const decoded = verifyToken(token);
  Line 16:   req.user = decoded;
  Line 17:   next();
  Line 18: }

src/types/auth.ts (score: 0.76)
  Line 8: export interface User {
  Line 9:   id: string;
  Line 10:   username: string;
  Line 11:   email: string;
  Line 12:   roles: Role[];
  Line 13: }
```

---

## Using with Claude (30 seconds)

Copy the search results and paste them into Claude:

```
[User]
I'm working on an authentication bug. Here's the relevant code:

[paste PRISM search results]

Can you help me understand how the authentication flow works?
```

**Result**: Claude gives you a perfect answer because it has exactly the right context!

---

## Common Use Cases

### Use Case 1: Understanding Code

```bash
# Search for functionality
prism search "user authentication flow"
prism search "database connection"
prism search "error handling"
```

### Use Case 2: Finding Related Code

```bash
# Find all authentication code
prism search "authentication" --limit 20

# Find all database code
prism search "database operations"
```

### Use Case 3: Debugging

```bash
# Find error-related code
prism search "error handling" --limit 30

# Find specific functionality
prism search "user permissions check"
```

---

## Next Steps

Now that you have PRISM running:

1. **Try more searches**: Experiment with different queries
2. **Integrate with Claude Code**: See [MCP Integration Guide](./mcp-integration.md)
3. **Customize configuration**: See [Configuration Guide](./configuration.md)
4. **Explore examples**: Check out `/examples/` directory

---

## Troubleshooting

### "prism: command not found"

**Solution**: Install PRISM globally
```bash
npm install -g @claudes-friend/prism
```

### "Index not found"

**Solution**: Create the index first
```bash
prism index ./src
```

### No search results

**Solution**: Lower the similarity threshold
```bash
prism search "query" --threshold 0.6
```

### Cloudflare errors

**Solution**: Make sure you're logged in
```bash
wrangler login
npm run deploy
```

---

## Need Help?

- **Documentation**: https://docs.prism.ai
- **GitHub Issues**: https://github.com/SuperInstance/PRISM/issues
- **Discussions**: https://github.com/SuperInstance/PRISM/discussions

---

**You're all set! Happy searching!**

---

**Document Status**: Complete
**Last Updated**: 2026-01-14
**Version**: 1.0.0
