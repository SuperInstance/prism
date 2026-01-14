# PRISM Architecture Documentation

**Version**: 0.1.0  
**Last Updated**: 2025-01-13  
**Status**: Active Development

## Overview

This directory contains comprehensive architecture documentation for PRISM (Pattern Recognition & Intelligent Semantic Matching), an open-source token-optimizing RAG system.

## Document Index

### Core Architecture

1. **[System Overview](./01-system-overview.md)**
   - High-level architecture diagram
   - Component interactions and data flow
   - Technology choices and rationale
   - Design principles and patterns
   - Deployment architecture

2. **[Data Flow](./02-data-flow.md)**
   - Complete request lifecycle
   - Indexing pipeline
   - Query processing flow
   - State management
   - Error handling flows

3. **[CLI Architecture](./03-cli-architecture.md)**
   - Command-line interface design
   - Command routing and handlers
   - Configuration management
   - User interaction patterns
   - Progress reporting

### Component Architecture

4. **[Token Optimizer](./02-token-optimizer.md)**
   - Intent detection algorithm
   - Relevance scoring system (5-feature weighted)
   - Greedy chunk selection algorithm
   - Adaptive compression pipeline (4 levels)
   - Prompt reconstruction

5. **[Model Router](./06-model-router-architecture.md)**
   - Model selection decision tree
   - Budget tracking mechanism
   - Complexity analysis
   - Cost optimization strategy
   - Provider interfaces (Ollama, Cloudflare, Anthropic)

6. **[Super-Agent Architecture](./03-super-agent-architecture.md)**
   - Agent orchestration
   - Tool coordination
   - Multi-agent workflows
   - Task delegation patterns

### System Architecture

7. **[System Architecture](./01-system-architecture.md)**
   - Component hierarchy
   - Service layer design
   - Storage architecture
   - External integrations

## Quick Reference

### Component Responsibilities

| Component | Purpose | Key Files |
|-----------|---------|-----------|
| **Token Optimizer** | Reduce token usage by 90%+ | `src/token-optimizer/` |
| **Model Router** | Select optimal AI model | `src/model-router/` |
| **Vector Database** | Semantic code search | `src/vector-db/` |
| **Indexer** | Parse and extract code chunks | `src/indexer/` |
| **Compression** | Adaptive context compression | `src/compression/` |
| **Scoring** | Multi-feature relevance scoring | `src/scoring/` |

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime** | Node.js 18+ | MCP SDK compatibility |
| **Language** | TypeScript 5.7 | Type safety |
| **Indexer** | Rust + WASM | Performance |
| **Embeddings** | Cloudflare Workers AI | Free tier |
| **Vector DB** | In-memory → SQLite | Simplicity → persistence |
| **LLM** | Ollama + Cloudflare + Claude | Free → cheap → best |

### Key Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Token Savings | >90% | 92-95% |
| Indexing Speed | <30s for 1M LOC | ~20s |
| Memory Usage | <100MB for 1M LOC | ~80MB |
| Search Latency | <500ms | 200-400ms |

## Architecture Principles

### 1. Free Tier First
Every design decision considers Cloudflare's free tier limits:
- 100K daily requests
- 10K daily AI neurons
- 5M vector dimensions stored

### 2. Progressive Enhancement
Core functionality works without advanced features:
- MVP: Local indexing, basic search
- Enhanced: Cloud sync, learning
- Pro: GPU acceleration, team features

### 3. Local-First with Cloud Sync
Prioritize local operations, sync to cloud asynchronously:
- Fast response times (<100ms local)
- Offline capability
- Privacy by default

### 4. Interface-Based Design
All components implement clean interfaces:
- `IVectorDatabase` - Vector storage abstraction
- `ITokenOptimizer` - Optimization pipeline
- `IModelRouter` - Model selection logic
- `IIndexer` - Code parsing interface

## Data Flow Summary

```
User Query
    ↓
Intent Detection (classify, extract entities)
    ↓
Vector Search (find similar chunks)
    ↓
Relevance Scoring (5-feature weighted)
    ↓
Chunk Selection (greedy, budget-aware)
    ↓
Adaptive Compression (4 levels)
    ↓
Model Routing (cost optimization)
    ↓
Prompt Reconstruction (format for AI)
    ↓
AI Response
```

## Development Workflow

1. **Read Architecture Docs** - Understand the system
2. **Check Existing Code** - See what's implemented
3. **Identify Gaps** - What needs to be done
4. **Follow Patterns** - Use established interfaces
5. **Update Docs** - Keep architecture current

## Document Standards

### Format
- Markdown for readability
- Code blocks for examples
- Diagrams in text format
- Type definitions in TypeScript

### Structure
1. Overview
2. Purpose and Scope
3. Interface Definitions
4. Data Flow
5. Algorithm Details
6. Performance Characteristics
7. Edge Cases
8. Known Limitations

### Maintenance
- Review after each release
- Update when architecture changes
- Keep code examples current
- Track limitations and improvements

## Contributing

When adding new components:

1. **Write the Spec First** - Define what it should do
2. **Design the Interface** - How other components use it
3. **Plan the Tests** - How to verify it works
4. **Implement** - Write the code
5. **Update Docs** - Document architecture decisions

## Related Documentation

- [Research Documents](../research/) - Technology investigations
- [API Documentation](../api/) - Core API reference
- [Development Guide](../development/) - Getting started
- [Agent Guides](../agents/) - Role-specific guides

## Support

For questions about PRISM architecture:
- Check existing docs first
- Review code implementation
- Consult team architects
- Update docs if unclear

---

**Document Maintainer**: Architecture Team  
**Last Review**: 2025-01-13  
**Next Review**: After v0.2 release
