#!/bin/bash
# Benchmark Script - Run all performance benchmarks
# Tests scoring, compression, and end-to-end performance

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "================================================"
echo "PRISM Performance Benchmark Suite"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Track overall results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a benchmark
run_benchmark() {
    local name="$1"
    local command="$2"

    echo -e "${BLUE}Running: $name${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if eval "$command"; then
        echo -e "${GREEN}✓ $name passed${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ $name failed${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
}

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
echo "Scoring Benchmarks"
echo "================================================"
echo ""

run_benchmark "Scoring Service - 10K Chunks" \
    "cd prism && npm test -- tests/scoring/ScoringService.test.ts --reporter=dot --timeout 10000"

run_benchmark "Scoring Service - 100K Chunks" \
    "cd prism && npm test -- tests/scoring/ScoringService.test.ts -t 'should score 100K chunks' --reporter=dot --timeout 30000"

echo ""
echo "================================================"
echo "Compression Benchmarks"
echo "================================================"
echo ""

run_benchmark "Compression Library - All Levels" \
    "cd prism && npm test -- tests/scoring/CompressionLibrary.test.ts -t 'should achieve target compression ratios across levels' --reporter=dot --timeout 5000"

run_benchmark "Compression Library - 10K Chunks" \
    "cd prism && npm test -- tests/scoring/CompressionLibrary.test.ts -t 'should compress 10K chunks quickly' --reporter=dot --timeout 10000"

echo ""
echo "================================================"
echo "Metrics Benchmarks"
echo "================================================"
echo ""

run_benchmark "Token Metrics - Basic Tracking" \
    "cd prism && npm test -- tests/scoring/TokenMetrics.test.ts -t 'should track a single query' --reporter=dot --timeout 5000"

run_benchmark "Token Metrics - Import/Export" \
    "cd prism && npm test -- tests/scoring/TokenMetrics.test.ts -t 'should export metrics as JSON' --reporter=dot --timeout 5000"

echo ""
echo "================================================"
echo "Summary"
echo "================================================"
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}All benchmarks passed!${NC}"
    exit 0
else
    echo -e "${RED}Some benchmarks failed${NC}"
    exit 1
fi
