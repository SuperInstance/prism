#!/bin/bash

###############################################################################
# PRISM Performance Benchmark Script
# Tests memory usage and search speed with various query types
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
DAEMON_PORT="${PORT:-8080}"
RESULTS_DIR="${PROJECT_ROOT}/.prism/benchmarks"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="${RESULTS_DIR}/benchmark_${TIMESTAMP}.json"

# Create results directory
mkdir -p "${RESULTS_DIR}"

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        PRISM Performance Benchmark Suite          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

###############################################################################
# Helper Functions
###############################################################################

# Start daemon
start_daemon() {
  echo -e "${YELLOW}[1/6]${NC} Starting PRISM daemon..."

  # Kill any existing daemon
  pkill -f "node.*daemon/server.js" 2>/dev/null || true
  sleep 1

  # Start daemon in background
  cd "${PROJECT_ROOT}"
  node daemon/server.js > /dev/null 2>&1 &
  DAEMON_PID=$!

  # Wait for daemon to be ready
  for i in {1..30}; do
    if curl -s "http://localhost:${DAEMON_PORT}/health" > /dev/null 2>&1; then
      echo -e "${GREEN}✓${NC} Daemon started (PID: ${DAEMON_PID})"
      return 0
    fi
    sleep 1
  done

  echo -e "${RED}✗${NC} Failed to start daemon"
  exit 1
}

# Stop daemon
stop_daemon() {
  if [ ! -z "${DAEMON_PID}" ]; then
    echo ""
    echo -e "${YELLOW}[6/6]${NC} Stopping daemon..."
    kill ${DAEMON_PID} 2>/dev/null || true
    wait ${DAEMON_PID} 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Daemon stopped"
  fi
}

# Measure memory usage
measure_memory() {
  if [ ! -z "${DAEMON_PID}" ]; then
    ps -o rss= -p ${DAEMON_PID} 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

# Perform search and measure time
benchmark_search() {
  local query="$1"
  local description="$2"

  # Measure search time (in milliseconds)
  local start_time=$(date +%s%3N)
  local response=$(curl -s -X POST "http://localhost:${DAEMON_PORT}/search" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"${query}\"}")
  local end_time=$(date +%s%3N)

  local duration=$((end_time - start_time))
  local result_count=$(echo "${response}" | jq -r '.results | length' 2>/dev/null || echo "0")

  # Output for display
  echo "${duration}ms (${result_count} results)"

  # Store for later use (write to temp files)
  echo "${duration}" >> /tmp/prism_bench_times.txt
  echo "${result_count}" >> /tmp/prism_bench_counts.txt
}

###############################################################################
# Benchmark Tests
###############################################################################

# Trap to ensure daemon is stopped on exit
trap stop_daemon EXIT

# Start daemon
start_daemon

echo ""
echo -e "${YELLOW}[2/6]${NC} Measuring baseline memory usage..."
sleep 2  # Let memory stabilize
MEMORY_BASELINE=$(measure_memory)
MEMORY_BASELINE_MB=$(echo "scale=2; ${MEMORY_BASELINE} / 1024" | bc)
echo -e "${GREEN}✓${NC} Baseline memory: ${MEMORY_BASELINE_MB} MB"

echo ""
echo -e "${YELLOW}[3/6]${NC} Running index size analysis..."

# Get index information
INDEX_FILE="${PROJECT_ROOT}/.prism/index.json"
if [ -f "${INDEX_FILE}" ]; then
  INDEX_SIZE=$(du -k "${INDEX_FILE}" | cut -f1)
  INDEX_SIZE_KB=$INDEX_SIZE
  FILE_COUNT=$(jq -r '.file_count' "${INDEX_FILE}" 2>/dev/null || echo "0")
  INDEX_VERSION=$(jq -r '.version' "${INDEX_FILE}" 2>/dev/null || echo "unknown")
  echo -e "${GREEN}✓${NC} Index size: ${INDEX_SIZE_KB} KB"
  echo -e "${GREEN}✓${NC} Index version: ${INDEX_VERSION}"
  echo -e "${GREEN}✓${NC} Indexed files: ${FILE_COUNT}"
else
  echo -e "${RED}✗${NC} Index file not found"
  INDEX_SIZE_KB=0
  FILE_COUNT=0
  INDEX_VERSION="unknown"
fi

echo ""
echo -e "${YELLOW}[4/6]${NC} Running search performance tests..."
echo ""

# Test queries with different characteristics
declare -a QUERIES=(
  "function:Single keyword search"
  "const result:Multi-word phrase search"
  "async await:Common pattern search"
  "error handling:Domain-specific search"
  "optimization performance:Multi-term search"
)

# Clear temp files
rm -f /tmp/prism_bench_times.txt /tmp/prism_bench_counts.txt

# Run queries
for query_pair in "${QUERIES[@]}"; do
  IFS=':' read -r query description <<< "$query_pair"
  echo -n "  • ${description}: "
  benchmark_search "${query}" "${description}"
done

# Read results from temp files
declare -a SEARCH_TIMES=()
declare -a SEARCH_RESULTS=()

while IFS= read -r time; do
  SEARCH_TIMES+=("${time}")
done < /tmp/prism_bench_times.txt

while IFS= read -r count; do
  SEARCH_RESULTS+=("${count}")
done < /tmp/prism_bench_counts.txt

echo ""
echo -e "${YELLOW}[5/6]${NC} Measuring memory after searches..."
MEMORY_PEAK=$(measure_memory)
MEMORY_PEAK_MB=$(echo "scale=2; ${MEMORY_PEAK} / 1024" | bc)
echo -e "${GREEN}✓${NC} Peak memory: ${MEMORY_PEAK_MB} MB"

###############################################################################
# Calculate Statistics
###############################################################################

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Performance Report${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Calculate average search time
TOTAL_TIME=0
for time in "${SEARCH_TIMES[@]}"; do
  TOTAL_TIME=$((TOTAL_TIME + time))
done
AVG_TIME=$((TOTAL_TIME / ${#SEARCH_TIMES[@]}))

# Find min/max
MIN_TIME=999999
MAX_TIME=0
for time in "${SEARCH_TIMES[@]}"; do
  [ ${time} -lt ${MIN_TIME} ] && MIN_TIME=${time}
  [ ${time} -gt ${MAX_TIME} ] && MAX_TIME=${time}
done

# Display results
echo -e "${GREEN}Memory Usage:${NC}"
echo "  Baseline: ${MEMORY_BASELINE_MB} MB"
echo "  Peak:     ${MEMORY_PEAK_MB} MB"
echo ""

echo -e "${GREEN}Index Statistics:${NC}"
echo "  Version:    ${INDEX_VERSION}"
echo "  File count: ${FILE_COUNT}"
echo "  Index size: ${INDEX_SIZE_KB} KB"
echo "  Avg/file:   $(echo "scale=2; ${INDEX_SIZE_KB} / ${FILE_COUNT}" | bc) KB"
echo ""

echo -e "${GREEN}Search Performance:${NC}"
echo "  Average: ${AVG_TIME}ms"
echo "  Min:     ${MIN_TIME}ms"
echo "  Max:     ${MAX_TIME}ms"
echo "  Queries: ${#SEARCH_TIMES[@]}"
echo ""

# Performance targets
TARGET_MEMORY=100
TARGET_SEARCH=30

echo -e "${GREEN}Target Achievement:${NC}"
if (( $(echo "${MEMORY_PEAK_MB} < ${TARGET_MEMORY}" | bc -l) )); then
  echo -e "  Memory: ${GREEN}✓ PASS${NC} (${MEMORY_PEAK_MB} MB < ${TARGET_MEMORY} MB)"
else
  echo -e "  Memory: ${RED}✗ FAIL${NC} (${MEMORY_PEAK_MB} MB >= ${TARGET_MEMORY} MB)"
fi

if [ ${AVG_TIME} -lt ${TARGET_SEARCH} ]; then
  echo -e "  Search: ${GREEN}✓ PASS${NC} (${AVG_TIME}ms < ${TARGET_SEARCH}ms)"
else
  echo -e "  Search: ${YELLOW}⚠ WARN${NC} (${AVG_TIME}ms >= ${TARGET_SEARCH}ms)"
fi

echo ""

###############################################################################
# Save Results to JSON
###############################################################################

cat > "${RESULTS_FILE}" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "memory": {
    "baseline_mb": ${MEMORY_BASELINE_MB},
    "peak_mb": ${MEMORY_PEAK_MB},
    "target_mb": ${TARGET_MEMORY}
  },
  "index": {
    "version": "${INDEX_VERSION}",
    "file_count": ${FILE_COUNT},
    "size_kb": ${INDEX_SIZE_KB},
    "avg_per_file_kb": $(echo "scale=2; ${INDEX_SIZE_KB} / ${FILE_COUNT}" | bc)
  },
  "search": {
    "average_ms": ${AVG_TIME},
    "min_ms": ${MIN_TIME},
    "max_ms": ${MAX_TIME},
    "target_ms": ${TARGET_SEARCH},
    "query_count": ${#SEARCH_TIMES[@]}
  },
  "queries": [
$(for i in "${!QUERIES[@]}"; do
  IFS=':' read -r query description <<< "${QUERIES[$i]}"
  time="${SEARCH_TIMES[$i]}"
  count="${SEARCH_RESULTS[$i]}"
  echo "    {"
  echo "      \"query\": \"${query}\","
  echo "      \"description\": \"${description}\","
  echo "      \"time_ms\": ${time},"
  echo "      \"result_count\": ${count}"
  if [ $i -eq $((${#QUERIES[@]} - 1)) ]; then
    echo "    }"
  else
    echo "    },"
  fi
done)
  ]
}
EOF

# Clean up temp files
rm -f /tmp/prism_bench_times.txt /tmp/prism_bench_counts.txt

echo -e "${GREEN}✓${NC} Results saved to: ${RESULTS_FILE}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Exit successfully
exit 0
