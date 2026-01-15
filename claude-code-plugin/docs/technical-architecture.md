# Technical Architecture Documentation

> **Comprehensive Architecture Guide** - Current system design and components

---

## 🏗️ System Architecture Overview

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Code Plugin                          │
│                    (User Interface)                           │
└───────────────────────┬───────────────────────────────────────────┘
                       │ MCP Protocol
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PRISM Daemon                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  HTTP Server    │  │ Index Manager   │  │ Search Engine   │ │
│  │  (server.js)    │  │ (index*.js)     │  │ (search*.js)    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Compression     │  │ Memory Manager  │  │ Performance     │ │
│  │ (compressor.js) │  │ (memory*.js)    │  │ (benchmark.js)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Cleanup Manager │  │ Fragment        │  │ Delta Indexing  │ │
│  │ (cleanup*.js)   │  │ Analyzer        │  │ (delta*.js)     │ │
│  └─────────────────┘  │ (fragment*.js)  │  └─────────────────┘ │
│                       └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Local File System                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   .prism/       │  │   Project Files  │  │   Cache/        │ │
│  │   - index.json  │  │   - Source Code  │  │   - Search      │ │
│  │   - config      │  │   - Config      │  │   - Compression  │ │
│  │   - logs        │  │   - Docs        │  │   - Memory      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Core Design Principles
1. **Modularity**: Each feature is independently developed and testable
2. **Performance**: Optimized for speed and memory efficiency
3. **Simplicity**: Node.js core modules only, no external dependencies
4. **Reliability**: Comprehensive error handling and recovery
5. **Extensibility**: Plugin architecture for future enhancements

## 📁 Component Architecture

### 1. Core Daemon (`daemon/server.js`)
**Purpose**: Main HTTP server and API endpoint provider

**Key Responsibilities:**
- HTTP request handling and routing
- Configuration management
- Project detection and initialization
- Performance monitoring coordination
- Error handling and recovery

**Architecture:**
```javascript
class PRISMDaemon {
  constructor() {
    this.server = http.createServer();
    this.configManager = new ConfigManager();
    this.indexManager = new IndexManager();
    this.searchEngine = new SearchEngine();
    this.performanceMonitor = new PerformanceMonitor();
  }

  async start() {
    this.setupRoutes();
    this.startMonitoring();
    await this.initializeProject();
  }
}
```

**Endpoints:**
- `GET /health` - Health check
- `POST /index` - Index project
- `POST /search` - Search files
- `GET /cache/stats` - Cache statistics
- `GET /fragmentation` - Index fragmentation analysis
- `POST /optimize` - Optimize index
- `GET /cleanup` - Cleanup statistics
- `POST /cleanup/force` - Force cleanup
- `GET /delta/stats` - Delta indexing statistics

### 2. Index Management System

#### 2.1 Index Compressor (`daemon/index-compressor.js`)
**Purpose**: JSON compression and decompression for efficient storage

**Features:**
- zlib-based compression with configurable levels
- Smart compression threshold detection
- Compression ratio tracking and reporting
- Streaming support for large files

**Architecture:**
```javascript
class IndexCompressor {
  async compressIndex(indexData) {
    // Only compress if above threshold
    if (this.shouldCompress(indexData)) {
      const compressed = await this.gzip.compress(JSON.stringify(indexData));
      return {
        compressed: true,
        data: compressed.toString('base64'),
        ratio: this.calculateCompressionRatio(indexData, compressed)
      };
    }
    return { compressed: false, data: indexData };
  }
}
```

#### 2.2 Delta Index Manager (`daemon/delta-index-manager.js`)
**Purpose**: Incremental indexing with change detection

**Features:**
- SHA-256 checksum-based change detection
- File classification (added, modified, deleted, unchanged)
- Intelligent fallback to full indexing
- Delta statistics tracking

**Architecture:**
```javascript
class DeltaIndexManager {
  async computeDelta(files) {
    const changes = { added: [], modified: [], deleted: [], unchanged: [] };

    for (const file of files) {
      const currentMeta = await this.getFileMetadata(file);
      const lastMeta = this.lastIndexState?.[file];

      if (!lastMeta) {
        changes.added.push(file);
      } else if (currentMeta.hash !== lastMeta.hash) {
        changes.modified.push(file);
      } else {
        changes.unchanged.push(file);
      }
    }

    return changes;
  }
}
```

### 3. Search Engine System

#### 3.1 Fuzzy Search (`daemon/fuzzy-search.js`)
**Purpose**: Advanced search algorithms for code matching

**Features:**
- Levenshtein distance algorithm
- Jaro-Winkler similarity
- Soundex phonetic matching
- N-gram text analysis
- Prefix/suffix matching

**Architecture:**
```javascript
class FuzzySearchEngine {
  search(query, indexedFiles) {
    const results = [];

    for (const [filePath, fileData] of Object.entries(indexedFiles)) {
      const score = this.calculateRelevance(query, fileData);
      if (score > 0) {
        results.push({ filePath, score, ...fileData });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}
```

#### 3.2 Search Cache (`daemon/search-cache.js`)
**Purpose**: Intelligent caching for search results

**Features:**
- Multi-level caching (LRU + LFU)
- Predictive caching based on patterns
- Hot query identification
- Cache statistics and management

**Architecture:**
```javascript
class SearchCache {
  constructor() {
    this.lruCache = new LRUCache(this.config.maxSize);
    this.lfuCache = new LFUCache(this.config.maxSize);
    this.queryPatterns = new Map();
  }

  async get(query) {
    // Check LRU first
    let result = this.lruCache.get(query);
    if (result) return result;

    // Check LFU
    result = this.lfuCache.get(query);
    if (result) {
      this.promoteToLRU(query, result);
      return result;
    }

    return null;
  }
}
```

### 4. Memory Management System

#### 4.1 Memory Manager (`daemon/memory-manager.js`)
**Purpose**: Advanced memory management and optimization

**Features:**
- Real-time memory monitoring
- Emergency garbage collection
- Predictive memory management
- Memory health scoring

**Architecture:**
```javascript
class MemoryManager {
  constructor() {
    this.thresholds = {
      warning: 0.8,
      critical: 0.95,
      emergency: 0.98
    };

    this.monitorMemoryUsage();
  }

  async handleMemoryPressure() {
    const usage = process.memoryUsage();
    const ratio = usage.heapUsed / usage.heapTotal;

    if (ratio > this.thresholds.emergency) {
      await this.emergencyCleanup();
    }
  }
}
```

#### 4.2 Cleanup Manager (`daemon/cleanup-manager.js`)
**Purpose**: Automatic cleanup of old and unused files

**Features:**
- Background cleanup processes
- Multi-strategy cleanup (age, frequency, pressure)
- Predictive optimization
- Cleanup statistics

**Architecture:**
```javascript
class CleanupManager {
  async performCleanup() {
    const tasks = [
      this.cleanupOldFiles(),
      this.cleanupUnusedFiles(),
      this.cleanupMemoryPressure(),
      this.compactIndex()
    ];

    const results = await Promise.allSettled(tasks);
    return this.summarizeResults(results);
  }
}
```

### 5. Performance Monitoring System

#### 5.1 Performance Monitor (`daemon/performance-monitor.js`)
**Purpose**: Real-time performance monitoring and metrics collection

**Features:**
- Performance metrics collection
- Health scoring system
- Trend analysis
- Performance insights

**Architecture:**
```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      indexing: [],
      search: [],
      memory: [],
      compression: []
    };

    this.startMonitoring();
  }

  recordMetric(type, duration, metadata = {}) {
    this.metrics[type].push({
      timestamp: Date.now(),
      duration,
      metadata
    });
  }
}
```

#### 5.2 Performance Benchmark (`daemon/performance-benchmark.js`)
**Purpose**: Comprehensive performance testing and benchmarking

**Features:**
- Multiple benchmark types (indexing, search, memory, compression)
- Statistical analysis
- Performance reporting
- Optimization recommendations

**Architecture:**
```javascript
class PerformanceBenchmark {
  async runIndexingBenchmark() {
    const results = [];

    for (let i = 0; i < this.config.benchmarkRuns; i++) {
      const start = performance.now();
      await this.indexTestProject();
      const duration = performance.now() - start;

      results.push({
        run: i + 1,
        duration,
        throughput: this.calculateThroughput(duration)
      });
    }

    return this.analyzeResults(results);
  }
}
```

### 6. Project Detection System

#### 6.1 Project Detector (`daemon/project-detector.js`)
**Purpose**: Intelligent project type detection and configuration

**Features:**
- Multi-language detection
- Framework identification
- Build tool detection
- Adaptive configuration

**Architecture:**
```javascript
class ProjectDetector {
  async detectProject(rootPath) {
    const config = {
      language: 'unknown',
      framework: 'unknown',
      buildTools: [],
      testFrameworks: [],
      dependencies: []
    };

    // Detect language by file patterns
    config.language = this.detectLanguage(rootPath);

    // Detect framework by specific files
    config.framework = this.detectFramework(rootPath, config.language);

    // Detect build tools
    config.buildTools = this.detectBuildTools(rootPath);

    return config;
  }
}
```

### 7. Analysis and Optimization Systems

#### 7.1 Fragment Analyzer (`daemon/fragment-analyzer.js`)
**Purpose**: Index fragmentation analysis and health monitoring

**Features:**
- Fragmentation detection and scoring
- Health recommendations
- Optimization suggestions
- Automatic optimization

**Architecture:**
```javascript
class FragmentAnalyzer {
  analyzeFragmentation(indexedFiles) {
    const analysis = {
      totalFiles: Object.keys(indexedFiles).length,
      totalSize: this.calculateTotalSize(indexedFiles),
      averageFileSize: this.calculateAverageFileSize(indexedFiles),
      fragmentationRatio: this.calculateFragmentationRatio(indexedFiles),
      fragmentationScore: this.calculateFragmentationScore(indexedFiles)
    };

    analysis.recommendations = this.generateRecommendations(analysis);
    return analysis;
  }
}
```

## 🔄 Data Flow Architecture

### Indexing Flow
```
1. Project Detection
   ↓
2. File System Scan
   ↓
3. Delta Indexing (SHA-256 check)
   ↓
4. Content Processing & Chunking
   ↓
5. Compression (if applicable)
   ↓
6. Index Storage
   ↓
7. Cache Update
   ↓
8. Performance Metrics Update
```

### Search Flow
```
1. Query Reception
   ↓
2. Query Analysis & Normalization
   ↓
3. Cache Lookup (LRU/LFU)
   ↓
4. If Miss → Search Engine Processing
   ↓
5. Fuzzy Matching Algorithms
   ↓
6. Result Ranking & Scoring
   ↓
7. Cache Store (if applicable)
   ↓
8. Response Return
```

### Memory Management Flow
```
1. Memory Usage Monitoring
   ↓
2. Threshold Checking
   ↓
3. If Warning → Predictive Actions
   ↓
4. If Critical → Cleanup Triggers
   ↓
5. If Emergency → Garbage Collection
   ↓
6. Performance Metrics Update
   ↓
7. Health Assessment
```

## 🛡️ Error Handling Architecture

### Error Classification
1. **System Errors**: File system, network, memory
2. **Application Errors**: Configuration, validation, logic
3. **User Errors**: Invalid input, permissions
4. **Recovery Errors**: Failed recovery attempts

### Error Handling Strategy
```javascript
class ErrorHandler {
  async handleError(error, context) {
    const classification = this.classifyError(error);
    const severity = this.assessSeverity(error, context);

    // Log error
    this.logError(error, classification, severity);

    // Attempt recovery
    const recovery = await this.attemptRecovery(error, classification);

    // User notification
    this.notifyUser(error, classification, recovery);

    return { classification, severity, recovery };
  }
}
```

## 📊 Performance Architecture

### Performance Metrics Collection
```javascript
class MetricsCollector {
  collectMetrics() {
    return {
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime()
      },
      application: {
        indexing: this.getIndexingMetrics(),
        search: this.getSearchMetrics(),
        cache: this.getCacheMetrics()
      },
      custom: this.getCustomMetrics()
    };
  }
}
```

### Performance Optimization Strategies
1. **Caching**: Multi-level caching with intelligent eviction
2. **Compression**: On-the-fly compression for storage efficiency
3. **Parallel Processing**: Worker threads for CPU-intensive tasks
4. **Lazy Loading**: Load data only when needed
5. **Resource Pooling**: Reuse expensive resources

## 🔧 Configuration Architecture

### Configuration Hierarchy
```
1. Environment Variables (Highest Priority)
2. Configuration File (.prism-config.json)
3. Project Detection Defaults
4. System Defaults (Lowest Priority)
```

### Configuration Management
```javascript
class ConfigManager {
  loadConfiguration() {
    return {
      // Environment overrides
      ...this.loadEnvironmentConfig(),

      // File configuration
      ...this.loadFileConfig(),

      // Project-specific defaults
      ...this.loadProjectDefaults(),

      // System defaults
      ...this.getDefaultConfig()
    };
  }
}
```

## 🌐 HTTP API Architecture

### Request Flow
```
1. HTTP Request Reception
   ↓
2. Authentication & Authorization
   ↓
3. Request Validation
   ↓
4. Route Handling
   ↓
5. Business Logic Processing
   ↓
6. Response Generation
   ↓
7. Error Handling
   ↓
8. HTTP Response Send
```

### API Design Principles
1. **RESTful Design**: Standard HTTP methods and status codes
2. **Consistent Responses**: Standardized response format
3. **Error Handling**: Clear error messages and status codes
4. **Performance**: Efficient request processing
5. **Security**: Input validation and sanitization

---

## 🚀 Future Architecture Considerations

### Scaling Considerations
1. **Horizontal Scaling**: Multiple daemon instances
2. **Load Balancing**: Request distribution
3. **Caching Layers**: Distributed caching
4. **Database Integration**: Persistent storage options

### Extensibility Points
1. **Plugin System**: Third-party extensions
2. **Custom Search Algorithms**: Pluggable search backends
3. **Multiple Storage Backends**: Flexible storage options
4. **Advanced Analytics**: Extended monitoring capabilities

### Integration Opportunities
1. **IDE Integration**: Editor-specific features
2. **CI/CD Integration**: Automated testing and deployment
3. **Collaboration Features**: Multi-user support
4. **Advanced AI Integration**: Enhanced intelligence features

---

This architecture documentation provides a comprehensive view of the current PRISM system design, making it easier to understand individual components and their interactions for future development and maintenance.