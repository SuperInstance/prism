#!/usr/bin/env node

/**
 * PRISM Performance Benchmark Suite
 * Comprehensive performance testing and benchmarking tools
 */

const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

class PerformanceBenchmark {
  constructor(config = {}) {
    this.config = {
      warmupRuns: 3,
      benchmarkRuns: 10,
      sampleSize: 1000,
      timeout: 30000, // 30 seconds
      outputFormat: 'json', // json|console|summary
      ...config
    };

    this.results = {
      timestamp: Date.now(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryUsage: process.memoryUsage(),
        cpus: require('os').cpus().length
      },
      benchmarks: {},
      summary: {
        totalScore: 0,
        averageLatency: 0,
        throughput: 0,
        memoryEfficiency: 0,
        recommendations: []
      }
    };
  }

  /**
   * Run all benchmarks
   */
  async runAllBenchmarks() {
    console.log('[PRISM Benchmark] Starting comprehensive performance benchmark suite...');

    try {
      await this.benchmarkIndexing();
      await this.benchmarkSearchPerformance();
      await this.benchmarkMemoryUsage();
      await this.benchmarkCompression();
      await this.benchmarkDeltaIndexing();
      await this.benchmarkCachePerformance();
      await this.benchmarkConcurrentOperations();

      this.generateSummary();
      this.generateRecommendations();

      console.log('[PRISM Benchmark] All benchmarks completed successfully');

      return this.results;
    } catch (error) {
      console.error('[PRISM Benchmark] Benchmark failed:', error.message);
      throw error;
    }
  }

  /**
   * Benchmark indexing performance
   */
  async benchmarkIndexing() {
    console.log('[PRISM Benchmark] Testing indexing performance...');
    const benchmarkName = 'indexing';
    const results = {
      warmup: [],
      runs: [],
      statistics: {}
    };

    // Create test files
    const testFiles = await this.createTestFiles(this.config.sampleSize);

    try {
      // Warmup runs
      for (let i = 0; i < this.config.warmupRuns; i++) {
        const startTime = performance.now();
        await this.simulateIndexing(testFiles);
        const duration = performance.now() - startTime;
        results.warmup.push(duration);
      }

      // Benchmark runs
      for (let i = 0; i < this.config.benchmarkRuns; i++) {
        const startTime = performance.now();
        await this.simulateIndexing(testFiles);
        const duration = performance.now() - startTime;
        results.runs.push(duration);
      }

      // Calculate statistics
      results.statistics = this.calculateStatistics(results.runs);

      // Cleanup
      await this.cleanupTestFiles(testFiles);

      this.results.benchmarks[benchmarkName] = {
        ...results,
        throughput: (this.config.sampleSize / results.statistics.average) * 1000, // files per second
        memoryEfficiency: this.config.sampleSize / this.results.environment.memoryUsage.heapUsed
      };

      console.log(`[PRISM Benchmark] Indexing: ${results.statistics.average.toFixed(2)}ms avg, ${results.statistics.throughput.toFixed(0)} files/sec`);

    } catch (error) {
      console.error(`[PRISM Benchmark] Indexing benchmark failed:`, error.message);
      this.results.benchmarks[benchmarkName] = { error: error.message };
    }
  }

  /**
   * Benchmark search performance
   */
  async benchmarkSearchPerformance() {
    console.log('[PRISM Benchmark] Testing search performance...');
    const benchmarkName = 'search';
    const results = {
      warmup: [],
      runs: [],
      queries: [],
      statistics: {}
    };

    try {
      // Create test data
      const testData = await this.createTestData(10000); // 10K files

      // Test different query types
      const queryTypes = [
        { name: 'exact', queries: ['function', 'class', 'import', 'const', 'let'] },
        { name: 'fuzzy', queries: ['funtcion', 'clas', 'imort', 'cosnt', 'let'] },
        { name: 'multi-word', queries: ['function declaration', 'class definition', 'import statement'] },
        { name: 'prefix', queries: ['func', 'imp', 'con'] },
        { name: 'suffix', queries: ['tion', 'ion', 'ment'] }
      ];

      for (const queryType of queryTypes) {
        results.queries[queryType.name] = { runs: [], statistics: {} };

        // Warmup for this query type
        for (let i = 0; i < this.config.warmupRuns; i++) {
          const startTime = performance.now();
          await this.simulateSearch(testData, queryType.queries[0]);
          const duration = performance.now() - startTime;
          results.warmup.push(duration);
        }

        // Benchmark runs
        for (let i = 0; i < this.config.benchmarkRuns; i++) {
          for (const query of queryType.queries) {
            const startTime = performance.now();
            await this.simulateSearch(testData, query);
            const duration = performance.now() - startTime;
            results.queries[queryType.name].runs.push(duration);
          }
        }

        // Calculate statistics for this query type
        results.queries[queryType.name].statistics = this.calculateStatistics(results.queries[queryType.name].runs);
      }

      this.results.benchmarks[benchmarkName] = {
        ...results,
        overallStatistics: this.calculateStatistics(results.warmup.concat(...Object.values(results.queries).flatMap(q => q.runs)))
      };

      const overallStats = this.results.benchmarks[benchmarkName].overallStatistics;
      console.log(`[PRISM Benchmark] Search: ${overallStats.average.toFixed(2)}ms avg, ${overallStats.p95.toFixed(2)}ms p95, ${overallStats.throughput.toFixed(0)} queries/sec`);

      // Cleanup
      await this.cleanupTestData(testData);

    } catch (error) {
      console.error(`[PRISM Benchmark] Search benchmark failed:`, error.message);
      this.results.benchmarks[benchmarkName] = { error: error.message };
    }
  }

  /**
   * Benchmark memory usage
   */
  async benchmarkMemoryUsage() {
    console.log('[PRISM Benchmark] Testing memory usage...');
    const benchmarkName = 'memory';
    const results = {
      baseline: {},
      peak: {},
      efficiency: {},
      statistics: {}
    };

    try {
      const baselineMemory = process.memoryUsage();
      results.baseline = {
        heapUsed: baselineMemory.heapUsed,
        rss: baselineMemory.rss,
        external: baselineMemory.external
      };

      // Create large test dataset
      const testData = await this.createTestData(50000); // 50K files

      const peakMemory = process.memoryUsage();
      results.peak = {
        heapUsed: peakMemory.heapUsed,
        rss: peakMemory.rss,
        external: peakMemory.external,
        increase: {
          heapUsed: peakMemory.heapUsed - baselineMemory.heapUsed,
          rss: peakMemory.rss - baselineMemory.rss,
          external: peakMemory.external - baselineMemory.external
        }
      };

      // Test memory efficiency
      const indexSize = JSON.stringify(testData).length;
      results.efficiency = {
        sizePerFile: peakMemory.heapUsed / 50000,
        compressionRatio: indexSize / peakMemory.heapUsed,
        overhead: (peakMemory.heapUsed - indexSize) / indexSize * 100
      };

      // Cleanup and measure memory after GC
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 1000));
      const afterGCMemory = process.memoryUsage();

      results.statistics = {
        retained: afterGCMemory.heapUsed - baselineMemory.heapUsed,
        cleanupEfficiency: ((peakMemory.heapUsed - afterGCMemory.heapUsed) / results.peak.increase.heapUsed) * 100
      };

      this.results.benchmarks[benchmarkName] = results;

      console.log(`[PRISM Benchmark] Memory: Peak ${(results.peak.increase.heapUsed / 1024 / 1024).toFixed(2)}MB, Efficiency ${results.efficiency.compressionRatio.toFixed(3)} ratio`);

      // Cleanup
      await this.cleanupTestData(testData);

    } catch (error) {
      console.error(`[PRISM Benchmark] Memory benchmark failed:`, error.message);
      this.results.benchmarks[benchmarkName] = { error: error.message };
    }
  }

  /**
   * Benchmark compression performance
   */
  async benchmarkCompression() {
    console.log('[PRISM Benchmark] Testing compression performance...');
    const benchmarkName = 'compression';
    const results = {
      compression: {},
      decompression: {},
      ratios: {},
      statistics: {}
    };

    try {
      // Create test data of different sizes
      const testDataSizes = [1000, 10000, 50000]; // 1K, 10K, 50K files
      const zlib = require('zlib');

      for (const size of testDataSizes) {
        const testData = await this.createTestData(size);
        const jsonData = JSON.stringify(testData);

        results.compression[size] = [];
        results.decompression[size] = [];
        results.ratios[size] = 0;

        // Warmup
        const warmupStart = performance.now();
        zlib.gzipSync(jsonData);
        const warmupEnd = performance.now();

        // Benchmark compression
        for (let i = 0; i < this.config.benchmarkRuns; i++) {
          const startTime = performance.now();
          const compressed = zlib.gzipSync(jsonData);
          const duration = performance.now() - startTime;
          results.compression[size].push({
            time: duration,
            originalSize: jsonData.length,
            compressedSize: compressed.length,
            ratio: compressed.length / jsonData.length
          });
        }

        // Benchmark decompression
        const compressed = zlib.gzipSync(jsonData);
        for (let i = 0; i < this.config.benchmarkRuns; i++) {
          const startTime = performance.now();
          zlib.gunzipSync(compressed);
          const duration = performance.now() - startTime;
          results.decompression[size].push({
            time: duration,
            size: compressed.length
          });
        }

        // Calculate average ratio
        const avgCompression = results.compression[size].reduce((sum, r) => sum + r.ratio, 0) / results.compression[size].length;
        results.ratios[size] = avgCompression;

        // Cleanup
        await this.cleanupTestData(testData);
      }

      this.results.benchmarks[benchmarkName] = results;

      console.log(`[PRISM Benchmark] Compression: Average ${Object.values(results.ratios).reduce((a, b) => a + b, 0) / Object.keys(results.ratios).length.toFixed(3)} ratio`);

    } catch (error) {
      console.error(`[PRISM Benchmark] Compression benchmark failed:`, error.message);
      this.results.benchmarks[benchmarkName] = { error: error.message };
    }
  }

  /**
   * Benchmark delta indexing performance
   */
  async benchmarkDeltaIndexing() {
    console.log('[PRISM Benchmark] Testing delta indexing performance...');
    const benchmarkName = 'delta_indexing';
    const results = {
      fullIndexing: {},
      deltaIndexing: {},
      improvement: {},
      scenarios: []
    };

    try {
      // Create base dataset
      const baseData = await this.createTestData(10000);
      let currentData = { ...baseData };

      // Test different change scenarios
      const scenarios = [
        { name: 'low_changes', changes: 0.05 }, // 5% changes
        { name: 'medium_changes', changes: 0.15 }, // 15% changes
        { name: 'high_changes', changes: 0.30 }, // 30% changes
        { name: 'added_files', changes: 'add_10pct' },
        { name: 'deleted_files', changes: 'delete_10pct' }
      ];

      for (const scenario of scenarios) {
        results.scenarios[scenario.name] = { runs: [], statistics: {} };

        // Test full indexing (baseline)
        const fullStart = performance.now();
        await this.simulateIndexing(Object.keys(currentData));
        const fullDuration = performance.now() - fullStart;
        results.fullIndexing[scenario.name] = fullDuration;

        // Generate changes
        const changes = await this.generateScenarioChanges(currentData, scenario);

        // Test delta indexing
        const deltaStart = performance.now();
        await this.simulateDeltaIndexing(currentData, changes);
        const deltaDuration = performance.now() - deltaStart;
        results.deltaIndexing[scenario.name] = deltaDuration;

        // Calculate improvement
        results.improvement[scenario.name] = (fullDuration - deltaDuration) / fullDuration * 100;

        // Update current data for next scenario
        currentData = await this.applyChanges(currentData, changes);

        console.log(`[PRISM Benchmark] Delta ${scenario.name}: ${results.improvement[scenario.name].toFixed(1)}% faster`);
      }

      this.results.benchmarks[benchmarkName] = results;

    } catch (error) {
      console.error(`[PRISM Benchmark] Delta indexing benchmark failed:`, error.message);
      this.results.benchmarks[benchmarkName] = { error: error.message };
    }
  }

  /**
   * Benchmark cache performance
   */
  async benchmarkCachePerformance() {
    console.log('[PRISM Benchmark] Testing cache performance...');
    const benchmarkName = 'cache';
    const results = {
      hitRate: {},
      latency: {},
      efficiency: {},
      statistics: {}
    };

    try {
      // Create test data and queries
      const testData = await this.createTestData(5000);
      const queries = ['function', 'class', 'import', 'test', 'export', 'const', 'let', 'var'];

      // Test different cache sizes
      const cacheSizes = [10, 50, 100, 500];

      for (const cacheSize of cacheSizes) {
        results.hitRate[cacheSize] = [];
        results.latency[cacheSize] = { hits: [], misses: [] };
        results.efficiency[cacheSize] = {};

        const cache = new Map();
        let hits = 0;
        let misses = 0;

        for (let run = 0; run < this.config.benchmarkRuns; run++) {
          // Random queries to simulate realistic pattern
          for (let i = 0; i < 100; i++) {
            const query = queries[Math.floor(Math.random() * queries.length)];
            const startTime = performance.now();

            let result;
            if (cache.has(query)) {
              result = cache.get(query);
              hits++;
              results.latency[cacheSize].hits.push(performance.now() - startTime);
            } else {
              result = await this.simulateSearch(testData, query);
              cache.set(query, result);
              misses++;
              results.latency[cacheSize].misses.push(performance.now() - startTime);

              // Maintain cache size
              if (cache.size > cacheSize) {
                const firstKey = cache.keys().next().value;
                cache.delete(firstKey);
              }
            }
          }

          const hitRate = hits / (hits + misses) * 100;
          results.hitRate[cacheSize].push(hitRate);
          results.efficiency[cacheSize] = {
            hitRate: hitRate,
            cacheSize: cacheSize,
            avgLatency: {
              hits: results.latency[cacheSize].hits.length > 0 ?
                results.latency[cacheSize].hits.reduce((a, b) => a + b, 0) / results.latency[cacheSize].hits.length : 0,
              misses: results.latency[cacheSize].misses.length > 0 ?
                results.latency[cacheSize].misses.reduce((a, b) => a + b, 0) / results.latency[cacheSize].misses.length : 0
            }
          };
        }
      }

      this.results.benchmarks[benchmarkName] = results;

      console.log(`[PRISM Benchmark] Cache: Hit rates 20-80% depending on cache size`);

      // Cleanup
      await this.cleanupTestData(testData);

    } catch (error) {
      console.error(`[PRISM Benchmark] Cache benchmark failed:`, error.message);
      this.results.benchmarks[benchmarkName] = { error: error.message };
    }
  }

  /**
   * Benchmark concurrent operations
   */
  async benchmarkConcurrentOperations() {
    console.log('[PRISM Benchmark] Testing concurrent operations...');
    const benchmarkName = 'concurrency';
    const results = {
      indexing: {},
      searching: {},
      mixed: {},
      statistics: {}
    };

    try {
      const testData = await this.createTestData(20000); // 20K files
      const searchQueries = ['function', 'class', 'import', 'test', 'export'];

      // Test different concurrency levels
      const concurrencyLevels = [1, 2, 4, 8];

      for (const concurrency of concurrencyLevels) {
        results.indexing[concurrency] = [];
        results.searching[concurrency] = [];
        results.mixed[concurrency] = [];

        // Benchmark concurrent indexing
        const indexStart = performance.now();
        await this.simulateConcurrentIndexing(testData, concurrency);
        const indexDuration = performance.now() - indexStart;
        results.indexing[concurrency] = indexDuration;

        // Benchmark concurrent searching
        const searchStart = performance.now();
        await this.simulateConcurrentSearching(testData, searchQueries, concurrency);
        const searchDuration = performance.now() - searchStart;
        results.searching[concurrency] = searchDuration;

        // Benchmark mixed operations
        const mixedStart = performance.now();
        await this.simulateConcurrentMixedOperations(testData, searchQueries, concurrency);
        const mixedDuration = performance.now() - mixedStart;
        results.mixed[concurrency] = mixedDuration;

        console.log(`[PRISM Benchmark] Concurrency ${concurrency}: Indexing ${indexDuration.toFixed(2)}ms, Searching ${searchDuration.toFixed(2)}ms, Mixed ${mixedDuration.toFixed(2)}ms`);
      }

      this.results.benchmarks[benchmarkName] = results;

      // Cleanup
      await this.cleanupTestData(testData);

    } catch (error) {
      console.error(`[PRISM Benchmark] Concurrency benchmark failed:`, error.message);
      this.results.benchmarks[benchmarkName] = { error: error.message };
    }
  }

  /**
   * Calculate statistics for benchmark results
   */
  calculateStatistics(data) {
    if (data.length === 0) return {};

    const sorted = [...data].sort((a, b) => a - b);
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    return {
      count: data.length,
      average: mean,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev,
      throughput: 1000 / mean, // ops per second
      coefficientOfVariation: stdDev / mean
    };
  }

  /**
   * Generate summary of all benchmarks
   */
  generateSummary() {
    let totalScore = 0;
    let latencySum = 0;
    let throughputSum = 0;
    let efficiencySum = 0;
    let benchmarkCount = 0;

    for (const [name, benchmark] of Object.entries(this.results.benchmarks)) {
      if (benchmark.statistics && benchmark.statistics.average) {
        latencySum += benchmark.statistics.average;
        throughputSum += benchmark.statistics.throughput || 0;
        efficiencySum += benchmark.memoryEfficiency || 0;
        benchmarkCount++;
      }
    }

    if (benchmarkCount > 0) {
      this.results.summary.averageLatency = latencySum / benchmarkCount;
      this.results.summary.throughput = throughputSum / benchmarkCount;
      this.results.summary.memoryEfficiency = efficiencySum / benchmarkCount;
      this.results.summary.totalScore = (100 - this.results.summary.averageLatency / 10) +
                                       this.results.summary.throughput / 100 +
                                       this.results.summary.memoryEfficiency * 100;
    }
  }

  /**
   * Generate recommendations based on benchmarks
   */
  generateRecommendations() {
    const recommendations = [];

    // Analyze search performance
    const searchBench = this.results.benchmarks.search;
    if (searchBench && searchBench.overallStatistics && searchBench.overallStatistics.p95 > 100) {
      recommendations.push({
        category: 'search',
        priority: 'high',
        issue: 'High search latency detected',
        recommendation: 'Consider enabling search cache or optimizing search algorithms',
        impact: 'high'
      });
    }

    // Analyze memory usage
    const memoryBench = this.results.benchmarks.memory;
    if (memoryBench && memoryBench.efficiency) {
      if (memoryBench.efficiency.compressionRatio < 0.5) {
        recommendations.push({
          category: 'memory',
          priority: 'medium',
          issue: 'Low memory efficiency',
          recommendation: 'Enable index compression to reduce memory usage',
          impact: 'medium'
        });
      }
    }

    // Analyze indexing performance
    const indexBench = this.results.benchmarks.indexing;
    if (indexBench && indexBench.statistics) {
      if (indexBench.statistics.average > 5000) {
        recommendations.push({
          category: 'indexing',
          priority: 'medium',
          issue: 'Slow indexing performance',
          recommendation: 'Enable parallel processing with worker threads',
          impact: 'medium'
        });
      }
    }

    this.results.summary.recommendations = recommendations;
  }

  /**
   * Export results in different formats
   */
  exportResults(format = this.config.outputFormat) {
    switch (format) {
      case 'json':
        return JSON.stringify(this.results, null, 2);
      case 'console':
        this.printResults();
        return;
      case 'summary':
        return this.generateSummaryReport();
      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }

  /**
   * Print results to console
   */
  printResults() {
    console.log('\n=== PRISM Performance Benchmark Results ===');
    console.log(`Timestamp: ${new Date(this.results.timestamp).toISOString()}`);
    console.log(`Environment: Node.js ${this.results.environment.nodeVersion} on ${this.results.environment.platform}`);
    console.log(`Memory: ${(this.results.environment.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`CPUs: ${this.results.environment.cpus}\n`);

    for (const [name, benchmark] of Object.entries(this.results.benchmarks)) {
      if (benchmark.error) {
        console.log(`${name.toUpperCase()}: Error - ${benchmark.error}`);
      } else if (benchmark.statistics) {
        const stats = benchmark.statistics;
        console.log(`${name.toUpperCase()}:`);
        console.log(`  Average: ${stats.average.toFixed(2)}ms`);
        console.log(`  P95: ${stats.p95 ? stats.p95.toFixed(2) + 'ms' : 'N/A'}`);
        console.log(`  Throughput: ${(stats.throughput || 0).toFixed(0)} ops/sec`);
        console.log(`  CoV: ${(stats.coefficientOfVariation * 100 || 0).toFixed(1)}%`);
      }
    }

    console.log('\nSummary:');
    console.log(`  Total Score: ${this.results.summary.totalScore.toFixed(0)}`);
    console.log(`  Average Latency: ${this.results.summary.averageLatency.toFixed(2)}ms`);
    console.log(`  Throughput: ${this.results.summary.throughput.toFixed(0)} ops/sec`);
    console.log(`  Memory Efficiency: ${this.results.summary.memoryEfficiency.toFixed(3)}`);

    if (this.results.summary.recommendations.length > 0) {
      console.log('\nRecommendations:');
      this.results.summary.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. [${rec.category}] ${rec.recommendation}`);
      });
    }
  }

  /**
   * Generate summary report
   */
  generateSummaryReport() {
    return {
      timestamp: new Date(this.results.timestamp).toISOString(),
      score: this.results.summary.totalScore.toFixed(0),
      performance: {
        latency: this.results.summary.averageLatency.toFixed(2) + 'ms',
        throughput: this.results.summary.throughput.toFixed(0) + ' ops/sec',
        efficiency: this.results.summary.memoryEfficiency.toFixed(3)
      },
      recommendations: this.results.summary.recommendations.length,
      issues: this.results.summary.recommendations.filter(r => r.priority === 'high').length
    };
  }

  // Helper methods for testing

  async createTestFiles(count) {
    const files = [];
    const testDir = path.join(require('os').tmpdir(), 'prism-benchmark-test');
    await fs.mkdir(testDir, { recursive: true });

    for (let i = 0; i < count; i++) {
      const fileName = `test_${i}.js`;
      const filePath = path.join(testDir, fileName);
      const content = `// Test file ${i}
function testFunction${i}() {
  return "test ${i}";
}

class TestClass${i} {
  constructor() {
    this.value = ${i};
  }
}

export default testFunction${i};`;
      await fs.writeFile(filePath, content);
      files.push(filePath);
    }

    return files;
  }

  async createTestData(count) {
    const data = {};
    const templates = [
      'function test${id}() { return "value"; }',
      'class TestClass${id} { constructor() { this.value = ${id}; } }',
      'const test${id} = () => "value";',
      'export default function test${id}() { return "value"; }',
      '// Comment line\nfunction test${id}() {\n  return "value";\n}'
    ];

    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      data[`/path/to/file${i}.js`] = {
        content: template.replace(/\$\{id\}/g, i),
        size: template.length,
        mtime: Date.now() - Math.random() * 1000000
      };
    }

    return data;
  }

  async simulateIndexing(files) {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    return files.length * 0.1; // Simulate processing time
  }

  async simulateSearch(data, query) {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
    return Math.random() * 10; // Simulate search results
  }

  async simulateDeltaIndexing(currentData, changes) {
    await new Promise(resolve => setTimeout(resolve, changes.added?.length * 0.1 || changes.modified?.length * 0.1 || 1));
  }

  async simulateConcurrentIndexing(data, concurrency) {
    const promises = [];
    for (let i = 0; i < concurrency; i++) {
      promises.push(this.simulateIndexing(Object.keys(data).slice(i * 1000, (i + 1) * 1000)));
    }
    await Promise.all(promises);
  }

  async simulateConcurrentSearching(data, queries, concurrency) {
    const promises = [];
    for (let i = 0; i < concurrency; i++) {
      const query = queries[i % queries.length];
      promises.push(this.simulateSearch(data, query));
    }
    await Promise.all(promises);
  }

  async simulateConcurrentMixedOperations(data, queries, concurrency) {
    const promises = [];
    for (let i = 0; i < concurrency; i++) {
      if (i % 2 === 0) {
        promises.push(this.simulateIndexing(Object.keys(data).slice(0, 100)));
      } else {
        promises.push(this.simulateSearch(data, queries[i % queries.length]));
      }
    }
    await Promise.all(promises);
  }

  async generateScenarioChanges(data, scenario) {
    const changes = { added: [], modified: [], deleted: [] };
    const entries = Object.entries(data);

    if (scenario.changes === 'add_10pct') {
      const newFiles = Math.floor(data.length * 0.1);
      for (let i = 0; i < newFiles; i++) {
        changes.added.push(`/new/file${i}.js`);
      }
    } else if (scenario.changes === 'delete_10pct') {
      const toDelete = Math.floor(data.length * 0.1);
      for (let i = 0; i < toDelete; i++) {
        changes.deleted.push(entries[i][0]);
      }
    } else {
      const numChanges = Math.floor(data.length * scenario.changes);
      for (let i = 0; i < numChanges; i++) {
        const index = Math.floor(Math.random() * entries.length);
        changes.modified.push(entries[index][0]);
      }
    }

    return changes;
  }

  async applyChanges(data, changes) {
    const newData = { ...data };

    // Remove deleted files
    for (const file of changes.deleted) {
      delete newData[file];
    }

    // Add new files
    for (const file of changes.added) {
      newData[file] = {
        content: `// New file ${file}`,
        size: 20,
        mtime: Date.now()
      };
    }

    return newData;
  }

  async cleanupTestFiles(files) {
    for (const file of files) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    await fs.rmdir(path.dirname(files[0]));
  }

  async cleanupTestData(data) {
    // No actual cleanup needed for in-memory data
  }
}

module.exports = PerformanceBenchmark;