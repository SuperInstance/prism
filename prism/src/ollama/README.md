# Ollama Integration

Local LLM inference using [Ollama](https://ollama.com).

## Overview

This module provides integration with Ollama for free local LLM inference, enabling PRISM to use models like:
- **deepseek-coder-v2** - Code generation and completion
- **llama3.1** - General chat and reasoning
- **nomic-embed-text** - Embeddings for vector search
- **qwen2.5-coder** - Alternative code model

## Installation

### Quick Start

```bash
# Run the setup script
npm run setup:ollama
```

This will:
1. Install Ollama if not already installed
2. Start the Ollama service
3. Pull recommended models (deepseek-coder-v2, nomic-embed-text, llama3.1, qwen2.5-coder)
4. Test the installation

### Manual Installation

#### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve  # Start the service
ollama pull deepseek-coder-v2
ollama pull nomic-embed-text
```

#### macOS

```bash
brew install ollama
# Start Ollama application or run: ollama serve
ollama pull deepseek-coder-v2
ollama pull nomic-embed-text
```

#### Windows

1. Download from [ollama.com/download](https://ollama.com/download)
2. Run the installer
3. Start Ollama from the Start menu
4. Pull models in terminal:
   ```bash
   ollama pull deepseek-coder-v2
   ollama pull nomic-embed-text
   ```

## Usage

### Basic Usage

```typescript
import { OllamaClient } from 'prism';

// Create client
const ollama = new OllamaClient({
  host: 'localhost',
  port: 11434,
  timeout: 30000,
});

// Generate text
const response = await ollama.generate({
  model: 'deepseek-coder-v2',
  prompt: 'Write a hello world function in JavaScript:',
});

console.log(response.response);
```

### Chat Completion

```typescript
const response = await ollama.chat({
  model: 'llama3.1',
  messages: [
    { role: 'user', content: 'What is 2 + 2?' },
  ],
});

console.log(response.message.content);
```

### Streaming

```typescript
for await (const chunk of ollama.generateStream({
  model: 'deepseek-coder-v2',
  prompt: 'Count from 1 to 10:',
})) {
  process.stdout.write(chunk);
}
```

### Embeddings

```typescript
const embeddings = await ollama.embed([
  'Hello, world!',
  'How are you?',
]);

console.log(embeddings[0].length); // Embedding dimensions
```

### Model Detection

```typescript
import { ModelDetector } from 'prism';

const detector = new ModelDetector();

// Get available models
const models = await detector.detectAvailableModels();
console.log('Available models:', models);

// Recommend model for task
const recommendation = await detector.recommendModelForTask('code-generation');
console.log('Recommended model:', recommendation.model);
console.log('Reasoning:', recommendation.reasoning);
```

### Health Monitoring

```typescript
import { OllamaHealthMonitor } from 'prism';

const monitor = new OllamaHealthMonitor();

// Check health
const status = await monitor.check();
console.log('Available:', status.available);
console.log('Version:', status.version);

// Start periodic monitoring
await monitor.startMonitoring(30000); // Check every 30s

// Get metrics
const metrics = monitor.getMetrics();
console.log('Average latency:', metrics.averageLatency);
console.log('Error rate:', metrics.errorRate);
```

### Integration with Model Router

```typescript
import { ModelRouter } from 'prism';

const router = new ModelRouter({
  preferLocal: true,
  enableOllama: true,
});

// Route request
const decision = await router.route(5000, 0.3, 'code-generation');

if (decision.model === 'ollama') {
  // Use Ollama for free local inference
  const ollama = router.getOllamaClient()!;
  const response = await ollama.generate({
    model: decision.ollamaModel!,
    prompt: '...',
  });
} else {
  // Use Claude API
  // ...
}
```

## Configuration

### Ollama Client Options

```typescript
interface OllamaConfig {
  host: string;        // Default: 'localhost'
  port: number;        // Default: 11434
  timeout: number;     // Default: 30000 (30s)
  maxRetries: number;  // Default: 3
  enableStreaming: boolean; // Default: true
}
```

### Health Monitor Options

```typescript
interface HealthMonitorConfig {
  checkInterval: number;   // Default: 30000 (30s)
  maxLatency: number;      // Default: 5000 (5s)
  maxErrorRate: number;    // Default: 0.1 (10%)
  historySize: number;     // Default: 1000
}
```

## Supported Models

### Code Models
- **deepseek-coder-v2** - Best for code generation (16GB)
- **codellama** - Code completion (8GB)
- **qwen2.5-coder** - Alternative code model (8GB)

### Chat Models
- **llama3.1** - General chat (8GB, 128K context)
- **llama3** - Previous version (8GB, 8K context)
- **mixtral** - Advanced reasoning (48GB)

### Embedding Models
- **nomic-embed-text** - Text embeddings (1GB, 8192 tokens)
- **mxbai-embed-large** - Large embeddings (1GB, 512 tokens)

## Testing

Run Ollama integration tests:

```bash
npm run test:ollama
```

**Note:** Tests require Ollama to be installed and running. Tests will be skipped if Ollama is not available.

## API Reference

### OllamaClient

- `generate(request)` - Generate text completion
- `generateStream(request)` - Generate with streaming
- `chat(request)` - Chat completion
- `chatStream(request)` - Chat with streaming
- `embed(texts)` - Generate embeddings
- `listModels()` - List available models
- `isAvailable()` - Check if Ollama is running
- `getVersion()` - Get Ollama version

### ModelDetector

- `detectAvailableModels()` - Get all available models with capabilities
- `detectCapabilities(modelName)` - Get model capabilities
- `recommendModelForTask(taskType)` - Get model recommendation
- `isModelSupported(modelName)` - Check if model is available
- `getModelVersion(modelName)` - Get model version

### OllamaHealthMonitor

- `check()` - Perform health check
- `startMonitoring(interval)` - Start periodic checks
- `stopMonitoring()` - Stop monitoring
- `getMetrics()` - Get current metrics
- `getRequestCount()` - Get total request count
- `getAverageLatency()` - Get average latency
- `getErrorRate()` - Get error rate
- `isHealthy()` - Check if system is healthy

## Troubleshooting

### Ollama not available

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve
```

### Models not found

```bash
# List available models
ollama list

# Pull a model
ollama pull deepseek-coder-v2
```

### Port already in use

```bash
# Check what's using port 11434
lsof -i :11434

# Change port in Ollama config
# Or specify custom port when creating client:
const client = new OllamaClient({ port: 11435 });
```

### Slow performance

- Use smaller models (phi3, gemma2)
- Reduce context window in model options
- Ensure adequate RAM (8GB+ recommended)
- Consider GPU acceleration if available

## Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [Available Models](https://ollama.com/library)
- [Ollama API Reference](https://github.com/ollama/ollama/blob/main/docs/api.md)

## License

MIT
