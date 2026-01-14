#!/bin/bash
# Profile Scoring Script - Performance profiling for scoring system
# Generates detailed performance reports

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "================================================"
echo "PRISM Scoring Performance Profiler"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Build the project first
echo -e "${BLUE}Building Prism...${NC}"
cd prism
npm run build || {
    echo -e "${RED}Build failed${NC}"
    exit 1
}
cd ..

echo ""
echo "================================================"
echo "Performance Profiling"
echo "================================================"
echo ""

# Create a temporary profiling script
cat > /tmp/prism-profile.ts << 'EOF'
import { ScoringService } from './prism/src/scoring/index.js';
import type { CodeChunk } from './prism/src/core/types.js';
import type { PrismConfig } from './prism/src/config/index.js';

// Mock scorer for profiling
class MockScorer {
  name = 'mock';
  weight = 1.0;

  async calculate(chunk: CodeChunk, query: any): Promise<number> {
    const chunkText = chunk.text.toLowerCase();
    const queryText = query.text.toLowerCase();
    let overlap = 0;

    for (const word of queryText.split(/\s+/)) {
      if (chunkText.includes(word)) {
        overlap++;
      }
    }

    return overlap / queryText.split(/\s+/).length;
  }
}

const config: PrismConfig = {
  indexer: {
    chunkSize: 100,
    overlap: 0,
    languages: ['typescript'],
    includePatterns: ['**/*.ts'],
    excludePatterns: [],
  },
  vectorDB: {
    type: 'sqlite',
    path: ':memory:',
  },
  tokenOptimizer: {
    maxTokens: 8000,
    targetCompression: 10,
    preserveSignatures: true,
  },
  modelRouter: {
    preferLocal: false,
  },
};

async function profile() {
  const service = new ScoringService(config, {
    enableCache: true,
    enableMetrics: true,
    parallelism: 4,
  });

  service.registerScorer(new MockScorer());
  await service.initialize();

  const sizes = [1000, 5000, 10000, 50000, 100000];

  console.log('\nScoring Performance Profile');
  console.log('==========================\n');

  for (const size of sizes) {
    const chunks: CodeChunk[] = Array.from({ length: size }, (_, i) => ({
      id: `chunk-${i}`,
      text: `function func${i}() { return ${i}; }`,
      startLine: i,
      endLine: i,
      tokens: 10,
      language: 'typescript',
      functions: [],
      classes: [],
      dependencies: [],
    }));

    const query = {
      vector: [],
      text: 'function test',
      timestamp: Date.now(),
    };

    const context = {
      recentFiles: [],
      timestamp: Date.now(),
    };

    // Warm-up run
    await service.scoreBatch(chunks.slice(0, 100), query, context);

    // Profiled run
    const start = performance.now();
    await service.scoreBatch(chunks, query, context);
    const elapsed = performance.now() - start;

    const avgTime = elapsed / size;
    const throughput = size / (elapsed / 1000);

    console.log(`Batch Size: ${size.toString().padEnd(10)} | Time: ${elapsed.toFixed(2).padEnd(10)}ms | Avg: ${avgTime.toFixed(4).padEnd(10)}ms/chunk | Throughput: ${throughput.toFixed(0).padEnd(10)} chunks/s`);

    // Get metrics
    const metrics = service.getMetrics();
    console.log(`  Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(2)}%`);
    console.log(`  Avg Time/Chunk: ${metrics.averageTimePerChunk.toFixed(4)}ms`);
    console.log('');
  }

  await service.cleanup();
}

profile().catch(console.error);
EOF

echo -e "${BLUE}Running performance profiles...${NC}"
npx tsx /tmp/prism-profile.ts || {
    echo -e "${RED}Profiling failed${NC}"
    exit 1
}

echo ""
echo "================================================"
echo "Memory Usage Profile"
echo "================================================"
echo ""

# Create memory profiling script
cat > /tmp/prism-memory.ts << 'EOF'
import { ScoringService } from './prism/src/scoring/index.js';
import type { CodeChunk } from './prism/src/core/types.js';
import type { PrismConfig } from './prism/src/config/index.js';

class MockScorer {
  name = 'mock';
  weight = 1.0;

  async calculate(chunk: CodeChunk, query: any): Promise<number> {
    return 0.5;
  }
}

const config: PrismConfig = {
  indexer: {
    chunkSize: 100,
    overlap: 0,
    languages: ['typescript'],
    includePatterns: ['**/*.ts'],
    excludePatterns: [],
  },
  vectorDB: {
    type: 'sqlite',
    path: ':memory:',
  },
  tokenOptimizer: {
    maxTokens: 8000,
    targetCompression: 10,
    preserveSignatures: true,
  },
  modelRouter: {
    preferLocal: false,
  },
};

async function profileMemory() {
  const service = new ScoringService(config, {
    enableCache: true,
    enableMetrics: true,
    parallelism: 4,
  });

  service.registerScorer(new MockScorer());
  await service.initialize();

  const sizes = [1000, 10000, 50000, 100000];

  console.log('Memory Usage Profile\n');
  console.log('Batch Size | Memory (MB) | Memory per 1K chunks (MB)');
  console.log('-----------|-------------|---------------------------');

  for (const size of sizes) {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const chunks: CodeChunk[] = Array.from({ length: size }, (_, i) => ({
      id: `chunk-${i}`,
      text: `function func${i}() { return ${i}; }`,
      startLine: i,
      endLine: i,
      tokens: 10,
      language: 'typescript',
      functions: [],
      classes: [],
      dependencies: [],
    }));

    const query = {
      vector: [],
      text: 'function test',
      timestamp: Date.now(),
    };

    const context = {
      recentFiles: [],
      timestamp: Date.now(),
    };

    const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;

    await service.scoreBatch(chunks, query, context);

    const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
    const memUsed = memAfter - memBefore;
    const memPer1k = (memUsed / size) * 1000;

    console.log(
      `${size.toString().padEnd(10)} | ${memUsed.toFixed(2).padEnd(11)} | ${memPer1k.toFixed(4)}`
    );
  }

  await service.cleanup();
}

profileMemory().catch(console.error);
EOF

echo -e "${BLUE}Running memory profiles...${NC}"
npx tsx /tmp/prism-memory.ts || {
    echo -e "${RED}Memory profiling failed${NC}"
    exit 1
}

echo ""
echo "================================================"
echo "${GREEN}Profiling Complete!${NC}"
echo "================================================"
echo ""
echo "Performance reports generated above."
echo ""
echo "Recommendations:"
echo "- Monitor cache hit rates for optimal performance"
echo "- Ensure average time per chunk is <0.01ms for production"
echo "- Memory usage should scale linearly with batch size"
echo "- Throughput should be >10,000 chunks/second"
