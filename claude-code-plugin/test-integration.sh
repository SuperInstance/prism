#!/bin/bash

###############################################################################
# PRISM Claude Code Plugin - Comprehensive Integration Tests
# Tests server startup, endpoints, error handling, and graceful shutdown
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
PLUGIN_DIR="/home/user/prism/claude-code-plugin"
SERVER_SCRIPT="${PLUGIN_DIR}/daemon/server.js"
TEST_PORT=8080
BASE_URL="http://localhost:${TEST_PORT}"
SERVER_PID=""
TESTS_PASSED=0
TESTS_FAILED=0

# Cleanup function
cleanup() {
    echo -e "\n${BLUE}Cleaning up...${NC}"
    if [ -n "$SERVER_PID" ]; then
        echo "Stopping server (PID: $SERVER_PID)"
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi

    # Clean up any orphaned node processes on port 8080
    pkill -f "node.*server.js" 2>/dev/null || true

    echo -e "${BLUE}Cleanup complete${NC}"
}

# Set trap for cleanup
trap cleanup EXIT INT TERM

# Logging functions
log_test() {
    echo -e "\n${BLUE}[TEST]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}✓ PASS${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}✗ FAIL${NC} $1"
    ((TESTS_FAILED++))
}

log_info() {
    echo -e "${YELLOW}ℹ INFO${NC} $1"
}

# Check if jq is available for JSON validation
check_jq() {
    if ! command -v jq &> /dev/null; then
        log_info "jq not found, installing for JSON validation..."
        apt-get update -qq && apt-get install -y jq -qq 2>&1 | grep -v "debconf"
    fi
}

# Wait for server to be ready
wait_for_server() {
    local max_attempts=30
    local attempt=0

    log_info "Waiting for server to start on port ${TEST_PORT}..."

    while [ $attempt -lt $max_attempts ]; do
        if curl -s "${BASE_URL}/health" > /dev/null 2>&1; then
            log_info "Server is ready!"
            return 0
        fi
        sleep 1
        ((attempt++))
        echo -n "."
    done

    echo ""
    log_fail "Server failed to start within ${max_attempts} seconds"
    return 1
}

###############################################################################
# TEST 1: Server Startup
###############################################################################
test_server_startup() {
    log_test "Test 1: Server Startup"

    # Change to plugin directory
    cd "${PLUGIN_DIR}"

    # Start server in background
    PORT=${TEST_PORT} node "${SERVER_SCRIPT}" > /tmp/prism-server.log 2>&1 &
    SERVER_PID=$!

    log_info "Started server with PID: ${SERVER_PID}"

    # Wait for server to be ready
    if wait_for_server; then
        log_pass "Server started successfully on port ${TEST_PORT}"
        return 0
    else
        log_fail "Server failed to start"
        log_info "Server logs:"
        cat /tmp/prism-server.log
        return 1
    fi
}

###############################################################################
# TEST 2: Health Check Endpoint
###############################################################################
test_health_endpoint() {
    log_test "Test 2: Health Check Endpoint (GET /health)"

    # Test health endpoint
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/health")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ]; then
        log_pass "Health endpoint returned HTTP 200"

        # Validate JSON structure
        if echo "$body" | jq -e '.status' > /dev/null 2>&1; then
            log_pass "Health response contains 'status' field"
        else
            log_fail "Health response missing 'status' field"
        fi

        if echo "$body" | jq -e '.project' > /dev/null 2>&1; then
            log_pass "Health response contains 'project' field"
        else
            log_fail "Health response missing 'project' field"
        fi

        if echo "$body" | jq -e '.uptime' > /dev/null 2>&1; then
            log_pass "Health response contains 'uptime' field"
        else
            log_fail "Health response missing 'uptime' field"
        fi

        log_info "Health response: $body"
    else
        log_fail "Health endpoint returned HTTP $http_code (expected 200)"
    fi
}

###############################################################################
# TEST 3: Project Detection Endpoint
###############################################################################
test_project_endpoint() {
    log_test "Test 3: Project Detection (GET /project)"

    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/project")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ]; then
        log_pass "Project endpoint returned HTTP 200"

        # Validate JSON structure
        if echo "$body" | jq -e '.name' > /dev/null 2>&1; then
            project_name=$(echo "$body" | jq -r '.name')
            log_pass "Project name detected: $project_name"
        else
            log_fail "Project response missing 'name' field"
        fi

        if echo "$body" | jq -e '.language' > /dev/null 2>&1; then
            language=$(echo "$body" | jq -r '.language')
            log_pass "Project language detected: $language"
        else
            log_fail "Project response missing 'language' field"
        fi

        if echo "$body" | jq -e '.type' > /dev/null 2>&1; then
            type=$(echo "$body" | jq -r '.type')
            log_pass "Project type detected: $type"
        else
            log_fail "Project response missing 'type' field"
        fi

        log_info "Project info: $body"
    else
        log_fail "Project endpoint returned HTTP $http_code (expected 200)"
    fi
}

###############################################################################
# TEST 4: Search Endpoint - Valid Query
###############################################################################
test_search_valid() {
    log_test "Test 4: Search Endpoint - Valid Query (POST /search)"

    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/search" \
        -H "Content-Type: application/json" \
        -d '{"query": "error handling"}')
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ]; then
        log_pass "Search endpoint returned HTTP 200"

        # Validate JSON structure
        if echo "$body" | jq -e '.results' > /dev/null 2>&1; then
            log_pass "Search response contains 'results' field"

            results_count=$(echo "$body" | jq '.results | length')
            log_info "Search returned $results_count results"

            # Check if results have expected structure
            if [ "$results_count" -gt 0 ]; then
                if echo "$body" | jq -e '.results[0].file' > /dev/null 2>&1; then
                    log_pass "Search results contain 'file' field"
                else
                    log_fail "Search results missing 'file' field"
                fi

                if echo "$body" | jq -e '.results[0].content' > /dev/null 2>&1; then
                    log_pass "Search results contain 'content' field"
                else
                    log_fail "Search results missing 'content' field"
                fi

                if echo "$body" | jq -e '.results[0].score' > /dev/null 2>&1; then
                    log_pass "Search results contain 'score' field"
                else
                    log_fail "Search results missing 'score' field"
                fi
            fi
        else
            log_fail "Search response missing 'results' field"
        fi

        log_info "Search response: $body"
    else
        log_fail "Search endpoint returned HTTP $http_code (expected 200)"
    fi
}

###############################################################################
# TEST 5: Search Endpoint - Empty Query
###############################################################################
test_search_empty() {
    log_test "Test 5: Search Endpoint - Empty Query"

    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/search" \
        -H "Content-Type: application/json" \
        -d '{"query": ""}')
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ]; then
        log_pass "Search endpoint handled empty query (HTTP 200)"

        results_count=$(echo "$body" | jq '.results | length')
        if [ "$results_count" = "0" ]; then
            log_pass "Empty query returned 0 results (as expected)"
        else
            log_info "Empty query returned $results_count results"
        fi
    else
        log_fail "Search endpoint returned HTTP $http_code for empty query"
    fi
}

###############################################################################
# TEST 6: Search Endpoint - Invalid JSON
###############################################################################
test_search_invalid_json() {
    log_test "Test 6: Search Endpoint - Invalid JSON"

    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/search" \
        -H "Content-Type: application/json" \
        -d '{invalid json')
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "400" ]; then
        log_pass "Invalid JSON rejected with HTTP 400"

        if echo "$body" | jq -e '.error' > /dev/null 2>&1; then
            error_msg=$(echo "$body" | jq -r '.error')
            log_pass "Error response contains error message: $error_msg"
        else
            log_fail "Error response missing 'error' field"
        fi
    else
        log_fail "Invalid JSON returned HTTP $http_code (expected 400)"
    fi
}

###############################################################################
# TEST 7: Search Endpoint - Query Too Long
###############################################################################
test_search_long_query() {
    log_test "Test 7: Search Endpoint - Query Too Long"

    # Generate a query longer than 10000 characters
    long_query=$(printf 'a%.0s' {1..10001})

    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/search" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"$long_query\"}")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "400" ]; then
        log_pass "Query too long rejected with HTTP 400"

        if echo "$body" | jq -e '.error' > /dev/null 2>&1; then
            error_msg=$(echo "$body" | jq -r '.error')
            log_pass "Error response: $error_msg"
        fi
    else
        log_fail "Long query returned HTTP $http_code (expected 400)"
    fi
}

###############################################################################
# TEST 8: Non-existent Endpoint
###############################################################################
test_404_endpoint() {
    log_test "Test 8: Non-existent Endpoint (404 handling)"

    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/nonexistent")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "404" ]; then
        log_pass "Non-existent endpoint returned HTTP 404"

        if echo "$body" | jq -e '.error' > /dev/null 2>&1; then
            error_msg=$(echo "$body" | jq -r '.error')
            log_pass "404 response contains error: $error_msg"
        fi
    else
        log_fail "Non-existent endpoint returned HTTP $http_code (expected 404)"
    fi
}

###############################################################################
# TEST 9: CORS Headers
###############################################################################
test_cors_headers() {
    log_test "Test 9: CORS Headers"

    headers=$(curl -s -I "${BASE_URL}/health")

    if echo "$headers" | grep -qi "Access-Control-Allow-Origin"; then
        log_pass "CORS header 'Access-Control-Allow-Origin' present"
    else
        log_fail "CORS header 'Access-Control-Allow-Origin' missing"
    fi

    if echo "$headers" | grep -qi "Access-Control-Allow-Methods"; then
        log_pass "CORS header 'Access-Control-Allow-Methods' present"
    else
        log_fail "CORS header 'Access-Control-Allow-Methods' missing"
    fi

    if echo "$headers" | grep -qi "Content-Type.*application/json"; then
        log_pass "Content-Type header is application/json"
    else
        log_fail "Content-Type header is not application/json"
    fi
}

###############################################################################
# TEST 10: Server Process Health
###############################################################################
test_server_process() {
    log_test "Test 10: Server Process Health"

    if kill -0 $SERVER_PID 2>/dev/null; then
        log_pass "Server process is running (PID: $SERVER_PID)"
    else
        log_fail "Server process is not running"
        return 1
    fi

    # Check memory usage (if ps is available)
    if command -v ps &> /dev/null; then
        mem_kb=$(ps -o rss= -p $SERVER_PID 2>/dev/null || echo "0")
        mem_mb=$((mem_kb / 1024))
        log_info "Server memory usage: ${mem_mb}MB"

        if [ $mem_mb -lt 100 ]; then
            log_pass "Memory usage is under 100MB (${mem_mb}MB)"
        else
            log_info "Memory usage: ${mem_mb}MB"
        fi
    fi
}

###############################################################################
# TEST 11: Concurrent Requests
###############################################################################
test_concurrent_requests() {
    log_test "Test 11: Concurrent Requests (Load Test)"

    log_info "Sending 10 concurrent health check requests..."

    for i in {1..10}; do
        curl -s "${BASE_URL}/health" > /dev/null &
    done

    wait

    # Check if server is still responsive
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/health")
    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "200" ]; then
        log_pass "Server handled concurrent requests successfully"
    else
        log_fail "Server failed after concurrent requests"
    fi
}

###############################################################################
# TEST 12: OPTIONS Request (CORS Preflight)
###############################################################################
test_options_request() {
    log_test "Test 12: OPTIONS Request (CORS Preflight)"

    response=$(curl -s -w "\n%{http_code}" -X OPTIONS "${BASE_URL}/search")
    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "200" ]; then
        log_pass "OPTIONS request handled successfully"
    else
        log_fail "OPTIONS request returned HTTP $http_code (expected 200)"
    fi
}

###############################################################################
# Main Test Execution
###############################################################################
main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║   PRISM Claude Code Plugin - Integration Tests            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    log_info "Plugin directory: ${PLUGIN_DIR}"
    log_info "Test port: ${TEST_PORT}"
    log_info "Base URL: ${BASE_URL}"

    # Check dependencies
    check_jq

    # Run tests
    test_server_startup || exit 1

    test_health_endpoint
    test_project_endpoint
    test_search_valid
    test_search_empty
    test_search_invalid_json
    test_search_long_query
    test_404_endpoint
    test_cors_headers
    test_server_process
    test_concurrent_requests
    test_options_request

    # Summary
    echo -e "\n${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║   Test Summary                                             ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    total_tests=$((TESTS_PASSED + TESTS_FAILED))
    pass_rate=$((TESTS_PASSED * 100 / total_tests))

    echo -e "Total Tests: ${BLUE}${total_tests}${NC}"
    echo -e "Passed: ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "Failed: ${RED}${TESTS_FAILED}${NC}"
    echo -e "Pass Rate: ${BLUE}${pass_rate}%${NC}"

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}✓ All tests passed!${NC}\n"
        return 0
    else
        echo -e "\n${RED}✗ Some tests failed${NC}\n"
        return 1
    fi
}

# Run main function
main
exit_code=$?

# Exit with appropriate code
exit $exit_code
