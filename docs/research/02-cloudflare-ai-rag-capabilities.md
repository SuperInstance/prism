# Cloudflare AI & RAG Capabilities

Complete guide to building AI-powered applications with Cloudflare's AI ecosystem.

## Workers AI Overview

Workers AI is Cloudflare's serverless GPU-powered ML platform, allowing you to run machine learning models on Cloudflare's global network without managing infrastructure.

### Key Features
- **Serverless GPU execution** - No provisioning, scaling, or GPU management
- **Global edge deployment** - Models run close to users worldwide
- **Pay-per-use** - Only pay for what you use (measured in "Neurons")
- **Built-in models** - No API keys or external services needed
- **Direct integration** - Works seamlessly with Workers, KV, D1, R2, and Vectorize

## Available Model Categories

### 1. Large Language Models (LLMs)

#### Text Generation Models

| Model | Parameters | Use Case | Neurons (Input/Output per 1M tokens) |
|-------|-----------|----------|-------------------------------------|
| `@cf/meta/llama-3.2-1b-instruct` | 1B | Fast chat, simple tasks | 2,457 / 18,252 |
| `@cf/meta/llama-3.2-3b-instruct` | 3B | Balanced chat/applications | 4,625 / 30,475 |
| `@cf/meta/llama-3.1-8b-instruct-fp8-fast` | 8B | General purpose, fast | 4,119 / 34,868 |
| `@cf/meta/llama-3.2-11b-vision-instruct` | 11B | Multimodal (text + images) | 4,410 / 61,493 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 70B | Complex reasoning | 26,668 / 204,805 |
| `@cf/mistral/mistral-7b-instruct-v0.1` | 7B | General purpose | 10,000 / 17,300 |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 24B | Advanced applications | 31,876 / 50,488 |
| `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | 32B | Reasoning-heavy tasks | 45,170 / 443,756 |
| `@cf/ibm-granite/granite-4.0-h-micro` | ~2B | Lightweight, efficient | 1,542 / 10,158 |
| `@cf/qwen/qwen2.5-coder-32b-instruct` | 32B | Code generation | 60,000 / 90,909 |

#### Recommended Models by Use Case

**For Claude Code Companion:**
- **Primary chat**: `@cf/meta/llama-3.1-8b-instruct-fp8-fast` - Best balance of speed/capability
- **Quick responses**: `@cf/meta/llama-3.2-1b-instruct` - Maximum throughput
- **Code tasks**: `@cf/qwen/qwen2.5-coder-32b-instruct` - Optimized for code
- **Complex reasoning**: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` - When needed

### 2. Embedding Models

Embeddings convert text into numerical vectors for semantic search and RAG.

| Model | Dimensions | Neurons per 1M tokens | Use Case |
|-------|-----------|----------------------|----------|
| `@cf/baai/bge-small-en-v1.5` | 384 | 1,841 | Fast, efficient |
| `@cf/baai/bge-base-en-v1.5` | 768 | 6,058 | Balanced |
| `@cf/baai/bge-large-en-v1.5` | 1024 | 18,582 | High quality |
| `@cf/baai/bge-m3` | 1024 | 1,075 | **Best value!** Multi-lingual |
| `@cf/qwen/qwen3-embedding-0.6b` | Variable | 1,075 | Lightweight |

**Recommended for RAG:**
- **Default choice**: `@cf/baai/bge-m3` - Best performance/cost ratio (1,075 neurons/M)
- **English only**: `@cf/baai/bge-small-en-v1.5` - Smallest dimensions (384)
- **High quality**: `@cf/baai/bge-large-en-v1.5` - Best semantic understanding

### 3. Vision Models

| Model | Type | Neurons | Use Case |
|-------|------|---------|----------|
| `@cf/meta/llama-3.2-11b-vision-instruct` | Multimodal LLM | 4,410/61,493 | Image understanding + chat |
| `@cf/black-forest-labs/flux-1-schnell` | Image generation | 4.80 per tile | Generate images |
| `@cf/black-forest-labs/flux-2-dev` | Image generation | 18.75/37.50 | High quality generation |
| `@cf/microsoft/resnet-50` | Image classification | 228,055 per M images | Classify images |

### 4. Audio Models

| Model | Type | Neurons | Use Case |
|-------|------|---------|----------|
| `@cf/openai/whisper` | Speech-to-text | 41.14 per minute | Transcribe audio |
| `@cf/openai/whisper-large-v3-turbo` | Speech-to-text | 46.63 per minute | Better accuracy |
| `@cf/deepgram/aura-1` | Text-to-speech | 1,363.64 per 1K chars | Generate speech |
| `@cf/myshell-ai/melotts` | Text-to-speech | 18.63 per minute | Efficient TTS |

### 5. Specialized Models

| Model | Type | Neurons | Use Case |
|-------|------|---------|----------|
| `@cf/baai/bge-reranker-base` | Reranking | 283 per M tokens | Improve search results |
| `@cf/meta/m2m100-1.2b` | Translation | 31,050 per M | Translate text |
| `@cf/meta/llama-guard-3-8b` | Content moderation | 44,003/2,730 | Filter content |
| `@cf/huggingface/distilbert-sst-2-int8` | Sentiment | 2,394 per M | Analyze sentiment |

## Vectorize (Vector Database)

Vectorize is Cloudflare's globally distributed vector database for AI applications.

### Key Features
- **Global distribution** - Vectors stored and queried close to users
- **Integrated with Workers** - No separate API or service needed
- **Works with any embeddings** - Workers AI, OpenAI, Cohere, etc.
- **Automatic indexing** - Optimized for vector similarity search

### Vectorize Pricing

| Metric | Free Tier | Paid |
|--------|-----------|------|
| Queried dimensions | 30M/month | 50M + $0.01/M |
| Stored dimensions | 5M total | 10M + $0.05/100M |

### Dimension Costs

To calculate stored dimensions: `vectors × dimensions`

| Embedding Model | Dimensions | Vectors for 5M Free Tier |
|----------------|-----------|--------------------------|
| BGE-small | 384 | ~13,000 vectors |
| BGE-base | 768 | ~6,500 vectors |
| BGE-large | 1,024 | ~4,880 vectors |
| BGE-m3 | 1,024 | ~4,880 vectors |

**Strategy:** Use smaller dimension models (BGE-small) for free tier optimization.

### Vectorize Operations

```javascript
// Create index
await env.VECTORIZE.createIndex({
  name: "claude-companion",
  dimensions: 384, // Match your embedding model
  metric: "cosine" // or "euclidean", "dotproduct"
});

// Insert vectors
await env.VECTORIZE.insert([
  { id: "1", vector: [...], metadata: { title: "..." } }
]);

// Query vectors
const results = await env.VECTORIZE.query([...], {
  topK: 10,
  namespace: "docs",
  filter: { type: "code" }
});
```

## Building RAG with Cloudflare

### Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Worker                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User Query → Workers AI (Generate Embedding)            │
│         ↓                                                    │
│  2. Vectorize (Search Similar Vectors)                      │
│         ↓                                                    │
│  3. Retrieve Full Content from R2/D1/KV                     │
│         ↓                                                    │
│  4. Workers AI (Generate Response with Context)             │
│         ↓                                                    │
│  5. Return Answer                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### RAG Implementation Steps

#### Step 1: Document Processing

```javascript
// Process documents and create embeddings
async function indexDocument(text, metadata) {
  // Split into chunks
  const chunks = chunkText(text, 500);

  // Generate embeddings for each chunk
  const embeddings = await Promise.all(
    chunks.map(chunk =>
      env.AI.run('@cf/baai/bge-small-en-v1.5', { text: chunk })
    )
  );

  // Store in Vectorize
  const vectors = embeddings.map((emb, i) => ({
    id: `${metadata.id}-${i}`,
    vector: emb.data[0],
    metadata: { ...metadata, chunkIndex: i, text: chunks[i] }
  }));

  await env.VECTORIZE.upsert(vectors);

  // Store full document in R2
  await env.R2.put(`docs/${metadata.id}`, JSON.stringify({
    text, metadata, chunks
  }));
}
```

#### Step 2: Query Processing

```javascript
async function queryRAG(query, topK = 5) {
  // Generate query embedding
  const queryEmbedding = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
    text: query
  });

  // Search Vectorize
  const results = await env.VECTORIZE.query(queryEmbedding.data[0], {
    topK,
    returnMetadata: true
  });

  // Build context from retrieved chunks
  const context = results.matches
    .map(m => m.metadata.text)
    .join('\n\n');

  // Generate answer with context
  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8-fast', {
    messages: [
      {
        role: "system",
        content: `You are a helpful coding assistant. Use the following context to answer questions:\n\n${context}`
      },
      { role: "user", content: query }
    ]
  });

  return response;
}
```

### Free Tier RAG Optimization

With 10K neurons/day and 5M stored vector dimensions:

**Recommended Setup:**
- **Embedding model**: `@cf/baai/bge-small-en-v1.5` (384 dimensions, 1,841 neurons/M)
- **Max vectors**: ~13,000 documents chunks (5M ÷ 384)
- **Daily queries**:
  - 10K neurons ÷ 1,841 neurons/M = ~5.4M tokens for embeddings
  - ~5.4M tokens ÷ avg 50 words/query = **~108K queries/day for embeddings**
  - Plus ~4-5 chat completions with Llama 3.1 8B

**Storage Strategy:**
- Store document chunks in Vectorize (for search)
- Store full documents in R2 (for retrieval)
- Use KV for hot config/cache

### Advanced RAG Techniques

#### 1. Hybrid Search (Vector + Keyword)

```javascript
async function hybridSearch(query) {
  // Vector search
  const vectorResults = await vectorSearch(query);

  // Keyword search (using D1 FULLTEXT)
  const keywordResults = await keywordSearch(query);

  // Combine and rerank
  const combined = mergeResults(vectorResults, keywordResults);

  // Rerank using BGE reranker
  const reranked = await env.AI.run('@cf/baai/bge-reranker-base', {
    query,
    documents: combined.map(r => r.text)
  });

  return reranked;
}
```

#### 2. Metadata Filtering

```javascript
const results = await env.VECTORIZE.query(embedding, {
  topK: 10,
  filter: {
    language: "javascript",
    framework: "react",
    version: { $gt: "18.0.0" }
  }
});
```

#### 3. Multi-Vector Strategy

```javascript
// Store different embedding models for different purposes
await env.VECTORIZE.upsert([
  {
    id: `doc-${id}-semantic`,
    vector: semanticEmbedding,
    metadata: { type: 'semantic', docId: id }
  },
  {
    id: `doc-${id}-keyword`,
    vector: keywordEmbedding,
    metadata: { type: 'keyword', docId: id }
  }
]);
```

## AI Gateway (Optional)

Cloudflare offers AI Gateway for analytics and caching (may require paid plan).

Features:
- **Request logging** - Track all AI requests
- **Caching** - Cache common responses
- **Rate limiting** - Control usage
- **Analytics** - Monitor model performance

## Example: Complete RAG Worker

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/query') {
      const query = await request.json();
      const results = await queryRAG(query.text, env);
      return Response.json(results);
    }

    if (path === '/index') {
      const doc = await request.json();
      await indexDocument(doc.text, doc.metadata, env);
      return Response.json({ success: true });
    }
  }
};

async function queryRAG(query, env) {
  // Generate query embedding
  const queryEmb = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
    text: query
  });

  // Search
  const results = await env.VECTORIZE.query(queryEmb.data[0], {
    topK: 5,
    returnMetadata: true
  });

  // Build context
  const context = results.matches
    .map(m => m.metadata.text)
    .join('\n---\n');

  // Generate response
  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8-fast', {
    messages: [
      {
        role: 'system',
        content: `Context:\n${context}\n\nAnswer the question based on the context.`
      },
      { role: 'user', content: query }
    ]
  });

  return {
    answer: response.response,
    sources: results.matches.map(m => m.metadata)
  };
}
```

## Sources

- [Workers AI Documentation](https://developers.cloudflare.com/workers-ai/)
- [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Vectorize Documentation](https://developers.cloudflare.com/vectorize/)
- [AI Week 2025 Updates](https://www.cloudflare.com/innovation-week/ai-week-2025/updates/)
