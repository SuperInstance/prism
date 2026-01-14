#!/bin/bash
# Test Scoring Script - Test scoring accuracy and correctness
# Runs all scoring-related tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "================================================"
echo "PRISM Scoring Test Suite"
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
echo "Running Scoring Tests"
echo "================================================"
echo ""

# Run all scoring tests
echo -e "${BLUE}Testing Scoring Service...${NC}"
if npm test -- prism/tests/scoring/ScoringService.test.ts --reporter=dot; then
    echo -e "${GREEN}✓ Scoring Service tests passed${NC}"
else
    echo -e "${RED}✗ Scoring Service tests failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Testing Compression Library...${NC}"
if npm test -- prism/tests/scoring/CompressionLibrary.test.ts --reporter=dot; then
    echo -e "${GREEN}✓ Compression Library tests passed${NC}"
else
    echo -e "${RED}✗ Compression Library tests failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Testing Token Metrics...${NC}"
if npm test -- prism/tests/scoring/TokenMetrics.test.ts --reporter=dot; then
    echo -e "${GREEN}✓ Token Metrics tests passed${NC}"
else
    echo -e "${RED}✗ Token Metrics tests failed${NC}"
    exit 1
fi

echo ""
echo "================================================"
echo "Running Accuracy Tests"
echo "================================================"
echo ""

echo -e "${YELLOW}Testing ranking accuracy...${NC}"
npm test -- prism/tests/scoring/ScoringService.test.ts -t "should rank relevant chunks higher" --reporter=dot || {
    echo -e "${RED}✗ Ranking accuracy test failed${NC}"
    exit 1
}

echo -e "${YELLOW}Testing compression ratios...${NC}"
npm test -- prism/tests/scoring/CompressionLibrary.test.ts -t "should achieve 10-30x compression" --reporter=dot || {
    echo -e "${RED}✗ Compression ratio test failed${NC}"
    exit 1
}

echo ""
echo "================================================"
echo "${GREEN}All scoring tests passed!${NC}"
echo "================================================"
