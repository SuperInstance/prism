# PRISM - Project Memory for Claude Code

**Give Claude Code memory of your entire codebase. Install once, forget about it.**

---

## What It Does

PRISM automatically indexes your code so Claude Code can search and understand your project without you manually copying files. It's completely automatic and runs in the background.

### The Problem
- Claude Code can only see limited context at once
- You waste time finding and copying relevant code
- Claude doesn't understand your full project structure

### The Solution
- PRISM indexes your entire project automatically
- Claude can search your codebase instantly
- No manual work required after installation

---

## Installation (30 seconds)

### Linux / macOS
```bash
git clone https://github.com/SuperInstance/prism.git
cd prism/claude-code-plugin
chmod +x install.sh
./install.sh
```

### Windows
```bash
git clone https://github.com/SuperInstance/prism.git
cd prism/claude-code-plugin
install.bat
```

**That's it.** Restart Claude Code and the plugin starts automatically.

---

## What Happens After Install

1. **Auto-starts** when you open Claude Code
2. **Auto-indexes** your project files in the background
3. **Auto-updates** when you change code
4. **Each project gets its own index** (stored in `.prism/` folder)

You don't need to do anything. It just works.

---

## How It Works

```
┌─────────────────┐
│  Your Project   │
│  (any language) │
└────────┬────────┘
         │
         ↓
    ┌────────┐
    │ PRISM  │ ← Indexes files automatically
    │ Plugin │
    └───┬────┘
        │
        ↓
┌──────────────┐
│ Claude Code  │ ← Searches when needed
│   (now has   │
│   memory!)   │
└──────────────┘
```

**What gets indexed:**
- All code files (`.js`, `.ts`, `.py`, `.go`, `.rs`, `.java`, etc.)
- Your project structure and organization
- File paths and content for searching

**What's ignored:**
- `node_modules/`, `.git/`, `dist/`, build artifacts
- Binary files, images, videos
- Large generated files

**Where it's stored:**
- `.prism/` folder in your project (local JSON files)
- Zero external dependencies or cloud services
- Safe to add `.prism/` to your `.gitignore`

---

## Usage

No commands needed! Claude Code automatically uses PRISM when it needs to search your project.

### Optional Commands

If you want manual control:

```bash
/prism status    # Check what's indexed
/prism search <query>   # Search manually
/prism index     # Force re-index
```

---

## Performance

- **Memory:** <50MB per project
- **Search speed:** <10ms
- **Installation:** <60 seconds
- **Disk space:** 1-10MB per project (depends on size)
- **CPU usage:** Minimal background processing

---

## Multiple Projects

PRISM automatically switches between projects. Each project gets its own `.prism/` folder with its own index. No confusion between projects.

Open Project A → PRISM uses Project A's index
Open Project B → PRISM uses Project B's index

---

## Supported Languages

JavaScript, TypeScript, Python, Go, Rust, Java, C#, PHP, Ruby, and more.

PRISM indexes any text-based code files.

---

## Troubleshooting

**Plugin not starting?**
```bash
# Check if installed
ls ~/.claude/plugins/prism-project-memory

# Check if Node.js is installed
node --version  # Should be 14+
```

**Not indexing files?**
- Check `.prism/` folder exists in your project
- Restart Claude Code
- Run `/prism status` to see what's indexed

**Still having issues?**
- Open an issue: https://github.com/SuperInstance/prism/issues
- Check logs in `.prism/logs/` if they exist

---

## Technical Details

- **Storage:** Local JSON files (no database required)
- **Dependencies:** None (pure Node.js core modules)
- **Network:** Zero external calls (100% local)
- **Privacy:** All data stays on your machine
- **Platform:** Cross-platform (Linux, macOS, Windows)

---

## License

MIT License - See [LICENSE](LICENSE) file

---

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

**That's all you need to know. Install it, forget about it, enjoy faster coding with Claude Code.**
