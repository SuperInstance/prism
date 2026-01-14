# Cloudflare Pricing & Free Tier Limits (2025)

Complete breakdown of Cloudflare's free tier offerings to maximize usage without costs.

## Overview Table

| Service | Free Tier Limits | Use Case | Monthly Equivalent |
|---------|------------------|----------|-------------------|
| **Workers** | 100K requests/day | Serverless functions | ~3M requests/month |
| **KV Namespace** | 1GB storage, 100K reads/day | Low-latency key-value storage | ~3M reads/month |
| **D1 Database** | 5GB storage, 5M reads/month | Serverless SQL database | 5M reads, 100K writes/month |
| **Durable Objects** | 400K GB-seconds, 100K requests/day | Real-time stateful applications | ~3M requests/month |
| **R2 Storage** | 10GB storage, 1M operations/month | S3-compatible object storage | 1M Class A operations |
| **Queues** | 10K messages/month | Worker-to-Worker messaging | 10K messages |
| **Workers AI** | 10,000 Neurons/day | Serverless GPU-powered ML | ~300K Neurons/month |
| **Vectorize** | 5M stored vector dimensions, 30M queried/month | Vector database for AI/RAG | Limited free tier |
| **Analytics Engine** | Included (unlimited cardinality) | Time-series data analytics | Unlimited |

## Detailed Service Breakdown

### Workers (Compute)

| Metric | Free Plan | Paid Plan |
|--------|-----------|-----------|
| Requests | 100,000/day | 10M/month + $0.30/M |
| Duration | No charge | No charge |
| CPU time | 10ms per request | 30M CPU ms/month + $0.02/M |
| Logs | 200,000/day (3 day retention) | 20M/month (7 day retention) |

**Key Insight:** Static asset requests are FREE and unlimited. Only dynamic Worker invocations count.

### Workers AI

| Metric | Value |
|--------|-------|
| Free Allocation | 10,000 Neurons per day |
| Paid Rate | $0.011 per 1,000 Neurons |
| Reset | Daily at 00:00 UTC |

**Neuron Costs by Model Category:**

| Model Type | Neurons per 1M tokens (input) | Neurons per 1M tokens (output) |
|------------|------------------------------|-------------------------------|
| Llama 3.2 1B | 2,457 | 18,252 |
| Llama 3.1 8B (fp8-fast) | 4,119 | 34,868 |
| Llama 3.3 70B | 26,668 | 204,805 |
| Mistral 7B | 10,000 | 17,300 |
| DeepSeek R1 32B | 45,170 | 443,756 |
| Embeddings (BGE-small) | 1,841 | - |
| Embeddings (BGE-large) | 18,582 | - |

**Free Tier Strategy:** Use smaller models (Llama 3.2 1B, Mistral 7B) for most operations. With 10K neurons/day, you can process approximately:
- ~4M input tokens/day using Llama 3.2 1B
- ~1M input tokens/day using Mistral 7B
- ~5.4M embeddings/day using BGE-small

### D1 Database (SQL)

| Metric | Free Plan | Paid Plan |
|--------|-----------|-----------|
| Rows read | 5M/day | 25B/month + $0.001/M |
| Rows written | 100K/day | 50M/month + $1.00/M |
| Storage | 5 GB | 5 GB + $0.75/GB-month |

**Monthly Free Tier:** ~150M rows read, ~3M rows written

### KV (Key-Value Storage)

| Metric | Free Plan | Paid Plan |
|--------|-----------|-----------|
| Keys read | 100K/day | 10M/month + $0.50/M |
| Keys written | 1K/day | 1M/month + $5.00/M |
| Keys deleted | 1K/day | 1M/month + $5.00/M |
| List requests | 1K/day | 1M/month + $5.00/M |
| Storage | 1 GB | 1 GB + $0.50/GB-month |

**Monthly Free Tier:** ~3M reads, ~30K writes

**Key Insight:** Great for configuration, caching hot data. Write-heavy operations will hit limits quickly.

### Durable Objects

**Compute Billing:**

| Metric | Free Plan | Paid Plan |
|--------|-----------|-----------|
| Requests | 100K/day | 1M + $0.15/M |
| Duration | 13,000 GB-s/day | 400K GB-s + $12.50/M |

**Storage (SQLite backend):**

| Metric | Free Plan | Paid Plan |
|--------|-----------|-----------|
| Rows read | 5M/day | 25B/month + $0.001/M |
| Rows written | 100K/day | 50M/month + $1.00/M |
| Storage | 5 GB | 5 GB + $0.20/GB-month |

**Key Insight:** NEW in 2025 - Durable Objects now available on Free plan! Perfect for real-time collaboration, AI agents, stateful applications.

### Vectorize (Vector Database)

| Metric | Free Plan | Paid Plan |
|--------|-----------|-----------|
| Queried dimensions | 30M/month | 50M + $0.01/M |
| Stored dimensions | 5M total | 10M + $0.05/100M |

**Calculation:** `((queried_vectors + stored_vectors) * dimensions * $0.01/1M) + (stored_vectors * dimensions * $0.05/100M)`

**Example:**
- 10,000 vectors × 768 dimensions = 7.68M stored dimensions (within free tier)
- 30K queries/month × 768 dimensions = 23.04M queried dimensions (within free tier)

**Key Insight:** Limited free tier but usable for small to medium RAG applications.

### R2 Storage (Object Storage)

| Metric | Free Plan | Paid Plan |
|--------|-----------|-----------|
| Storage | 10 GB | $0.015/GB-month |
| Class A Operations | 1M/month | $4.50/M |
| Class B Operations | 10M/month | $0.36/M |

**Key Insight:** NO egress fees! Perfect for storing documents, images, model outputs.

### Queues

| Metric | Paid Plan Only |
|--------|----------------|
| Operations | 1M/month + $0.40/M |

**Key Insight:** Requires paid plan. Not recommended for free tier optimization.

## Paid Services (No Free Tier)

The following services require a paid Workers plan ($5/month minimum):
- Browser Rendering (Headless Chrome)
- Hyperdrive (SQL database acceleration) - though has free tier
- Images (Optimize/transform images)
- mTLS Certificates
- Pipeline (Real-time data streaming)

## Strategic Recommendations for Free Tier

### 1. Use Workers for Everything Possible
- Static assets are free and unlimited
- Only 100K dynamic requests/day = ~3M/month
- Use caching to minimize dynamic requests

### 2. Choose the Right AI Models
- For embeddings: `@cf/baai/bge-small-en-v1.5` (1,841 neurons/M tokens)
- For chat: `@cf/meta/llama-3.2-1b-instruct` (2,457 neurons/M input)
- For complex tasks: `@cf/mistral/mistral-7b-instruct-v0.1` (10K neurons/M input)

### 3. Storage Strategy
- **Hot data**: KV (fast but limited writes)
- **Structured data**: D1 (SQL, good read limits)
- **Cold data**: R2 (10GB free, no egress fees)
- **Vectors**: Vectorize (5M dimensions free)

### 4. Real-time Features
- Use Durable Objects (now free!) for WebSocket connections
- Implement stateful AI agents
- Real-time collaboration tools

### 5. Architecture Pattern
```
User Request
    ↓
Cloudflare Worker (compute)
    ↓
├── KV (hot config/cache)
├── D1 (structured queries)
├── Vectorize (semantic search)
├── Workers AI (embeddings/inference)
└── R2 (document storage)
```

## Sources

- [Cloudflare Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Vectorize Overview](https://developers.cloudflare.com/vectorize/)
- [Which Cloudflare Services Are Free? (2025 Free Tier Guide)](https://dev.to/ioniacob/which-cloudflare-services-are-free-2025-free-tier-guide-53jl)
