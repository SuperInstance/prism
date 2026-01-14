#!/usr/bin/env bash
set -euo pipefail

# Test script for Prism
# Runs all tests with coverage

echo "🧪 Running Prism tests..."

# Parse arguments
TEST_TYPE=${1:-all}
COVERAGE=${COVERAGE:-false}

case $TEST_TYPE in
    unit)
        echo "Running unit tests..."
        npm run test:unit
        ;;
    integration)
        echo "Running integration tests..."
        npm run test:integration
        ;;
    coverage)
        echo "Running tests with coverage..."
        npm run test:coverage
        ;;
    all)
        echo "Running all tests..."
        npm run test
        ;;
    *)
        echo "Usage: $0 [unit|integration|coverage|all]"
        exit 1
        ;;
esac

echo "✅ Tests passed!"
