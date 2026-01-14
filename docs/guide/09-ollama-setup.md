# Ollama Setup Guide

**Last Updated**: 2026-01-13
**Component**: Model Router / Ollama Integration
**Status**: Stable

## Overview

Ollama is a local LLM runner that lets you run powerful AI models on your own machine. Prism integrates with Ollama to provide **free, private AI processing** for simple tasks.

**Benefits:**
- 100% free (no API costs)
- Works offline
- Private (data never leaves your machine)
- Fast (no network latency)

---

## Installation

### Option 1: Automatic Setup (Recommended)

The easiest way to install Ollama:

```bash
# Prism will detect and prompt for Ollama installation
prism setup

# Or explicitly:
prism setup ollama
```

This will:
1. Check if Ollama is installed
2. Download and install if missing
3. Start the Ollama service
4. Pull recommended models
5. Configure Prism to use Ollama

### Option 2: Manual Installation

#### Linux / WSL2

```bash
# Download and install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start the Ollama service
ollama serve &

# Verify installation
ollama --version
```

#### macOS

```bash
# Download Ollama for macOS
# Visit: https://ollama.com/download/mac

# Or use Homebrew
brew install ollama

# Start Ollama (it runs as a background service)
open -a Ollama
```

#### Windows

```bash
# Download Ollama for Windows
# Visit: https://ollama.com/download/windows

# Or use winget
winget install Ollama.Ollama

# Start Ollama from Start Menu
```

### Verification

After installation, verify Ollama is running:

```bash
# Check version
ollama --version

# List installed models
ollama list

# Test with a simple query
echo "Hello, Ollama!" | ollama run llama3.2
```

---

## Recommended Models

Prism works best with these Ollama models:

### 1. DeepSeek Coder V2 (Recommended for Code)

**Best for:** Programming tasks, code generation, debugging

```bash
ollama pull deepseek-coder-v2
```

**Specs:**
- Parameters: 16B (quantized)
- Context: 16K tokens
- Strengths: Code comprehension, generation, debugging
- Size: ~9GB

**Why this model:** Specifically trained for code, excellent at understanding programming concepts.

---

### 2. Nomic Embed Text (Required for Embeddings)

**Best for:** Vector embeddings, semantic search

```bash
ollama pull nomic-embed-text
```

**Specs:**
- Parameters: 338M
- Context: 8K tokens
- Output: 768-dimensional embeddings
- Size: ~276MB

**Why this model:** Fast, efficient embeddings for vector search. Required for Prism's RAG system.

---

### 3. Llama 3.2 (General Purpose)

**Best for:** Chat, explanations, general queries

```bash
ollama pull llama3.2
```

**Specs:**
- Parameters: 3B (lightweight version)
- Context: 128K tokens
- Strengths: General knowledge, reasoning
- Size: ~2GB

**Why this model:** Good balance of quality and speed for non-code tasks.

---

### Installing All Recommended Models

```bash
# Pull all three models at once
ollama pull deepseek-coder-v2
ollama pull nomic-embed-text
ollama pull llama3.2

# Verify installation
ollama list
```

Expected output:
```
NAME                    ID              SIZE      MODIFIED
deepseek-coder-v2:latest 0a8c266...    9.1 GB    2 minutes ago
nomic-embed-text:latest  0a109ff...    276 MB    5 minutes ago
llama3.2:latest         848a1ee...    2.0 GB    8 minutes ago
```

---

## Configuration

### Automatic Configuration

Prism auto-detects Ollama running on `http://localhost:11434`. No configuration needed!

### Manual Configuration

If Ollama is running on a different port or host:

```yaml
# prism.config.yaml
ollama:
  enabled: true
  url: http://localhost:11434
  model: deepseek-coder-v2
  timeout: 30000
  fallback: true
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable Ollama |
| `url` | string | `"http://localhost:11434"` | Ollama API endpoint |
| `model` | string | `"deepseek-coder-v2"` | Default model to use |
| `timeout` | number | `30000` | Request timeout in milliseconds |
| `fallback` | boolean | `true` | Fall back to cloud models if Ollama fails |

### Environment Variables

You can also configure via environment variables:

```bash
export PRISM_OLLAMA_URL="http://localhost:11434"
export PRISM_OLLAMA_MODEL="deepseek-coder-v2"
export PRISM_OLLAMA_TIMEOUT="30000"
```

---

## Usage

### Basic Usage

Once configured, Prism automatically uses Ollama for suitable requests:

```typescript
// This will automatically route to Ollama
const answer = await prism.ask("What is a closure in JavaScript?");
```

### Manual Selection

Force Ollama usage:

```typescript
const answer = await prism.ask("Explain async/await", {
  model: "ollama:deepseek-coder-v2",
});
```

### Checking Ollama Status

```bash
# Check if Ollama is available
prism doctor ollama

# Test Ollama connection
prism test ollama
```

---

## Troubleshooting

### Issue: "Ollama not available"

**Symptoms:**
```
Error: Ollama request failed
```

**Solutions:**

1. **Check if Ollama is running:**
   ```bash
   ps aux | grep ollama
   ```

2. **Start Ollama if not running:**
   ```bash
   ollama serve &
   ```

3. **Check if port 11434 is accessible:**
   ```bash
   curl http://localhost:11434/api/tags
   ```

4. **Verify model is installed:**
   ```bash
   ollama list
   ```

---

### Issue: "Model not found"

**Symptoms:**
```
Error: model 'deepseek-coder-v2' not found
```

**Solutions:**

1. **Pull the missing model:**
   ```bash
   ollama pull deepseek-coder-v2
   ```

2. **Verify installation:**
   ```bash
   ollama list | grep deepseek
   ```

3. **Use a different model:**
   ```typescript
   await prism.ask("Help me", {
     model: "ollama:llama3.2",
   });
   ```

---

### Issue: Slow responses

**Symptoms:** Ollama takes 10+ seconds to respond

**Possible Causes:**

1. **Insufficient RAM**
   - Check available memory: `free -h`
   - DeepSeek Coder V2 needs ~16GB RAM
   - Try smaller model: `ollama pull codellama:7b`

2. **No GPU acceleration**
   - Ollama uses CPU by default
   - Install GPU drivers for acceleration
   - Check GPU support: `ollama run deepseek-coder-v2 --verbose`

3. **First-run warmup**
   - First query is slower (model loading)
   - Subsequent queries are faster

---

### Issue: Connection refused

**Symptoms:**
```
Error: connect ECONNREFUSED localhost:11434
```

**Solutions:**

1. **Start Ollama service:**
   ```bash
   ollama serve &
   ```

2. **Check firewall settings:**
   ```bash
   # Linux
   sudo ufw allow 11434

   # macOS
   # Allow Ollama in Security & Privacy settings
   ```

3. **Verify correct port:**
   ```bash
   netstat -an | grep 11434
   ```

---

### Issue: Out of memory

**Symptoms:**
```
Error: failed to allocate memory
```

**Solutions:**

1. **Use smaller model:**
   ```bash
   # Instead of deepseek-coder-v2 (16B)
   ollama pull codellama:7b
   ollama pull phi3
   ```

2. **Close other applications:**
   ```bash
   # Check memory usage
   free -h

   # Close memory-heavy apps
   ```

3. **Reduce context size:**
   ```typescript
   await prism.ask("Explain this", {
     model: "ollama:deepseek-coder-v2",
     maxTokens: 2000,  // Reduce from default
   });
   ```

---

## Advanced Configuration

### Custom Models

You can use any Ollama model with Prism:

```bash
# Pull a custom model
ollama pull mistral:7b

# Use it in Prism
await prism.ask("Help me", {
  model: "ollama:mistral:7b",
});
```

### Model-Specific Settings

Configure per-model settings:

```yaml
# prism.config.yaml
ollama:
  models:
    deepseek-coder-v2:
      temperature: 0.7
      num_ctx: 16000
    llama3.2:
      temperature: 0.5
      num_ctx: 128000
```

### GPU Acceleration

Enable GPU for faster inference:

```bash
# Check if GPU is available
ollama show deepseek-coder-v2 --verbose

# Ollama automatically uses GPU if available
# No configuration needed
```

### Quantization

Use quantized models for lower memory usage:

```bash
# Pull quantized version (Q4_K_M)
ollama pull deepseek-coder-v2:q4

# Use in Prism
await prism.ask("Help", {
  model: "ollama:deepseek-coder-v2:q4",
});
```

---

## Performance Tips

### 1. Keep Models in Memory

Ollama loads models on first use. Keep them loaded:

```bash
# Pre-load model
ollama run deepseek-coder-v2 "Hello"

# Now subsequent queries are faster
```

### 2. Use Appropriate Models

- **Code tasks:** `deepseek-coder-v2`
- **Chat:** `llama3.2`
- **Embeddings:** `nomic-embed-text`

### 3. Adjust Context Size

Reduce context for faster responses:

```typescript
await prism.ask("Quick question", {
  model: "ollama:deepseek-coder-v2",
  maxTokens: 1000,  // Faster than default
});
```

### 4. Batch Similar Queries

Process multiple queries at once:

```typescript
const answers = await Promise.all([
  prism.ask("Question 1"),
  prism.ask("Question 2"),
  prism.ask("Question 3"),
]);
```

---

## Uninstallation

### Remove Ollama

```bash
# Linux
sudo systemctl stop ollama
sudo systemctl disable ollama
rm -rf /usr/local/bin/ollama
rm -rf ~/.ollama

# macOS
rm -rf /Applications/Ollama.app
rm -rf ~/.ollama

# Windows
# Use "Add or Remove Programs" in Settings
```

### Disable Ollama in Prism

```yaml
# prism.config.yaml
ollama:
  enabled: false
```

---

## Next Steps

- **Configure Cloud Models** - See [Model Routing Guide](./08-model-routing.md)
- **Understand Costs** - See [Cost Analysis](./10-cost-analysis.md)
- **Compare Performance** - See [Model Performance Guide](./11-model-performance.md)
- **Architecture Details** - See [Model Router Architecture](../architecture/06-model-router-architecture.md)
