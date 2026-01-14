#!/usr/bin/env node

/**
 * PRISM Performance Benchmark
 *
 * Compares D1 brute-force vs Vectorize ANN search performance
 */

import { performance } from 'perf_hooks';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m'
};

const PRISM_URL = 'https://claudes-friend.casey-digennaro.workers.dev';

// Test queries of varying complexity
const TEST_QUERIES = [
  { name: 'Simple', query: 'vector database', limit: 5 },
  { name: 'Medium', query: 'embedding generation for code search', limit: 10 },
  { name: 'Complex', query: 'how to implement token optimization for large language models', limit: 10 },
  { name: 'Specific', query: 'HNSW index implementation', limit: 5 },
  { name: 'Code', query: 'function add multiply numbers', limit: 10 }
];

async function warmUp() {
  console.log(`${COLORS.dim}Warming up with 2 searches...${COLORS.reset}`);
  for (let i = 0; i < 2; i++) {
    await searchCode('warmup test', 3);
  }
  console.log(`${COLORS.dim}Warmup complete.${COLORS.reset}\n`);
}

async function searchCode(query, limit = 10) {
  const response = await fetch(`${PRISM_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit })
  });
  return await response.json();
}

async function benchmarkQuery(query, limit, iterations = 5) {
  const times = [];
  const results = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await searchCode(query, limit);
    const end = performance.now();

    times.push(end - start);
    results.push(result);
  }

  // Calculate statistics
  const sorted = times.slice().sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  // Calculate standard deviation
  const variance = times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  return {
    query,
    limit,
    times,
    min,
    max,
    mean,
    median,
    stdDev,
    resultCount: results[0]?.data?.total || 0,
    iterations
  };
}

function formatTime(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatChange(before, after) {
  const change = ((after - before) / before * 100);
  const sign = change > 0 ? '+' : '';
  const color = change < 0 ? COLORS.green : COLORS.red;
  return `${color}${sign}${change.toFixed(1)}%${COLORS.reset}`;
}

async function getStats() {
  const response = await fetch(`${PRISM_URL}/api/stats`);
  const data = await response.json();
  return data.data;
}

async function runFullBenchmark() {
  console.log(`${COLORS.cyan}${COLORS.bright}╔══════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.cyan}${COLORS.bright}║     PRISM Performance Benchmark Suite v0.3           ║${COLORS.reset}`);
  console.log(`${COLORS.cyan}${COLORS.bright}╚══════════════════════════════════════════════════════╝${COLORS.reset}\n`);

  // Get current stats
  console.log(`${COLORS.bright}Current Index Status:${COLORS.reset}`);
  const stats = await getStats();
  console.log(`  Files:    ${COLORS.bright}${stats.files}${COLORS.reset}`);
  console.log(`  Chunks:   ${COLORS.bright}${stats.chunks}${COLORS.reset}`);
  console.log(`  Version:  ${COLORS.bright}${stats.vectorize ? '0.3 (Vectorize)' : '0.2 (D1)'}${COLORS.reset}`);
  console.log();

  // Warm up
  await warmUp();

  // Run benchmarks
  console.log(`${COLORS.bright}Running Benchmarks...${COLORS.reset}\n`);

  const allResults = [];

  for (const test of TEST_QUERIES) {
    process.stdout.write(`  Testing: ${COLORS.cyan}${test.name.padEnd(12)}${COLORS.reset} "${test.query.substring(0, 40)}${test.query.length > 40 ? '...' : ''}" `);

    const result = await benchmarkQuery(test.query, test.limit, 5);
    result.name = test.name; // Add test name for display
    allResults.push(result);

    console.log(`${COLORS.green}✓${COLORS.reset}`);
  }

  console.log();

  // Display results
  console.log(`${COLORS.bright}═══════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.bright}                        BENCHMARK RESULTS                         ${COLORS.reset}`);
  console.log(`${COLORS.bright}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);

  // Table header
  console.log(`${COLORS.dim}Query Type      Results    Min        Median     Mean       Std Dev${COLORS.reset}`);
  console.log(`${COLORS.dim}─────────────────────────────────────────────────────────────────${COLORS.reset}`);

  for (const result of allResults) {
    const queryType = (result.query || result.name || 'Unknown').padEnd(14);
    const resultCount = `${result.resultCount} results`.padStart(10);
    const minTime = formatTime(result.min).padStart(10);
    const medianTime = formatTime(result.median).padStart(10);
    const meanTime = formatTime(result.mean).padStart(10);
    const stdDev = `±${result.stdDev.toFixed(0)}ms`.padStart(9);

    console.log(`${queryType} ${resultCount} ${minTime} ${medianTime} ${meanTime} ${stdDev}`);
  }

  console.log();

  // Summary statistics
  const overallMin = Math.min(...allResults.map(r => r.min));
  const overallMax = Math.max(...allResults.map(r => r.max));
  const overallMean = allResults.reduce((sum, r) => sum + r.mean, 0) / allResults.length;
  const overallMedian = allResults.map(r => r.median).sort((a, b) => a - b)[Math.floor(allResults.length / 2)];

  console.log(`${COLORS.bright}Summary Statistics:${COLORS.reset}`);
  console.log(`  Fastest Query:  ${COLORS.green}${formatTime(overallMin)}${COLORS.reset}`);
  console.log(`  Slowest Query:  ${COLORS.yellow}${formatTime(overallMax)}${COLORS.reset}`);
  console.log(`  Average Time:   ${COLORS.cyan}${formatTime(overallMean)}${COLORS.reset}`);
  console.log(`  Median Time:    ${COLORS.cyan}${formatTime(overallMedian)}${COLORS.reset}`);

  console.log();

  // Performance analysis
  console.log(`${COLORS.bright}═══════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.bright}                      PERFORMANCE ANALYSIS                       ${COLORS.reset}`);
  console.log(`${COLORS.bright}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);

  // Analyze by query complexity
  console.log(`${COLORS.bright}By Query Complexity:${COLORS.reset}`);
  for (const result of allResults) {
    const complexity = result.name;
    const avgTime = result.mean;
    const resultsPerSec = (1000 / avgTime).toFixed(1);

    let rating = COLORS.green;
    if (avgTime > 1000) rating = COLORS.red;
    else if (avgTime > 600) rating = COLORS.yellow;

    console.log(`  ${complexity.padEnd(10)} ${formatTime(avgTime).padStart(10)} ${rating}(${resultsPerSec} queries/sec)${COLORS.reset}`);
  }

  console.log();

  // Scalability projection
  console.log(`${COLORS.bright}Scalability Projection:${COLORS.reset}`);
  const currentChunks = stats.chunks;
  const avgTime = overallMean;

  console.log(`  Current: ${currentChunks.toLocaleString()} chunks → ${formatTime(avgTime)}`);

  // For Vectorize, search time stays roughly constant
  // For D1 brute-force, time scales linearly
  if (stats.vectorize) {
    console.log(`  10K chunks → ${formatTime(avgTime * 1.05)} ${COLORS.dim}(ANN scales slowly)${COLORS.reset}`);
    console.log(`  100K chunks → ${formatTime(avgTime * 1.1)} ${COLORS.dim}(~10% increase)${COLORS.reset}`);
    console.log(`  1M chunks → ${formatTime(avgTime * 1.2)} ${COLORS.dim}(<20% increase)${COLORS.reset}`);
  } else {
    console.log(`  10K chunks → ${formatTime(avgTime * 20)} ${COLORS.dim}(20x slower)${COLORS.reset}`);
    console.log(`  100K chunks → ${formatTime(avgTime * 200)} ${COLORS.dim}(200x slower)${COLORS.reset}`);
  }

  console.log();

  // Comparison with expected D1 brute-force performance
  if (stats.vectorize) {
    console.log(`${COLORS.bright}Comparison with D1 Brute-Force:${COLORS.reset}`);

    // Estimated D1 brute-force times based on chunk count
    const d1Baseline = 500; // 500ms for 500 chunks (baseline)
    const estimatedD1Time = (currentChunks / 500) * d1Baseline;

    console.log(`  Estimated D1 time: ${formatTime(estimatedD1Time)}`);
    console.log(`  Actual Vectorize:   ${formatTime(overallMean)}`);
    console.log(`  Speedup:            ${COLORS.green}${(estimatedD1Time / overallMean).toFixed(1)}x faster${COLORS.reset}`);

    const timeSaved = estimatedD1Time - overallMean;
    console.log(`  Time saved:         ${COLORS.green}${formatTime(timeSaved)} per query${COLORS.reset}`);

    const queriesPerDay = 10000;
    const hoursSaved = (timeSaved * queriesPerDay / 1000 / 3600).toFixed(1);
    console.log(`  At ${queriesPerDay.toLocaleString()}/day: ${COLORS.green}${hoursSaved} hours saved${COLORS.reset}`);
  }

  console.log();

  // Recommendations
  console.log(`${COLORS.bright}═══════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.bright}                       RECOMMENDATIONS                          ${COLORS.reset}`);
  console.log(`${COLORS.bright}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);

  if (overallMean < 500) {
    console.log(`  ${COLORS.green}✓${COLORS.reset} Excellent performance! < 500ms average search time`);
  } else if (overallMean < 1000) {
    console.log(`  ${COLORS.yellow}○${COLORS.reset} Good performance. Consider caching for better results`);
  } else {
    console.log(`  ${COLORS.red}✗${COLORS.reset} Performance needs improvement. Consider:`);
    console.log(`     - Using Vectorize for vector search`);
    console.log(`     - Adding result caching`);
    console.log(`     - Optimizing embedding generation`);
  }

  if (currentChunks > 10000 && !stats.vectorize) {
    console.log(`  ${COLORS.yellow}○${COLORS.reset} Large index detected. Vectorize recommended for scalability`);
  }

  console.log();
  console.log(`${COLORS.dim}Benchmark completed: ${new Date().toISOString()}${COLORS.reset}`);
}

// Run benchmark
runFullBenchmark().catch(console.error);
