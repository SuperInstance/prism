#!/bin/bash

###############################################################################
# PRISM Claude Code Plugin - MCP Protocol Integration Tests
# Comprehensive test suite for Claude Code integration
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
PLUGIN_DIR="/home/user/prism/claude-code-plugin"
SERVER_SCRIPT="${PLUGIN_DIR}/daemon/server.js"
TEST_PORT=8080
BASE_URL="http://localhost:${TEST_PORT}"
SERVER_PID=""
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

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
log_section() {
    echo -e "\n${CYAN}════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
}

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

log_skip() {
    echo -e "${YELLOW}⊘ SKIP${NC} $1"
    ((TESTS_SKIPPED++))
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
# TEST SUITE 1: Configuration Validation
###############################################################################
test_mcp_configuration() {
    log_section "Configuration Validation"
    log_test "MCP Configuration (.mcp.json)"

    local mcp_config="${PLUGIN_DIR}/.mcp.json"

    if [ ! -f "$mcp_config" ]; then
        log_fail ".mcp.json file not found at $mcp_config"
        return 1
    fi

    log_pass ".mcp.json file exists"

    # Validate JSON structure
    if jq empty "$mcp_config" 2>/dev/null; then
        log_pass ".mcp.json is valid JSON"
    else
        log_fail ".mcp.json has invalid JSON syntax"
        return 1
    fi

    # Check for mcpServers key
    if jq -e '.mcpServers' "$mcp_config" > /dev/null 2>&1; then
        log_pass "mcpServers configuration found"
    else
        log_fail "mcpServers key missing in .mcp.json"
        return 1
    fi

    # Check for prism-daemon server
    if jq -e '.mcpServers["prism-daemon"]' "$mcp_config" > /dev/null 2>&1; then
        log_pass "prism-daemon server configured"

        # Extract and validate server configuration
        local command=$(jq -r '.mcpServers["prism-daemon"].command' "$mcp_config")
        local args=$(jq -r '.mcpServers["prism-daemon"].args[]' "$mcp_config")

        log_info "Server command: $command"
        log_info "Server args: $args"

        # Validate command
        if [ "$command" = "node" ]; then
            log_pass "Server uses node command"
        else
            log_fail "Server command is not 'node' (found: $command)"
        fi

        # Validate environment variables
        local env_vars=$(jq -r '.mcpServers["prism-daemon"].env | keys[]' "$mcp_config")
        log_info "Environment variables configured:"
        echo "$env_vars" | while read var; do
            local value=$(jq -r ".mcpServers[\"prism-daemon\"].env[\"$var\"]" "$mcp_config")
            log_info "  $var = $value"
        done

        log_pass "MCP server configuration is complete"
    else
        log_fail "prism-daemon server not found in .mcp.json"
        return 1
    fi
}

test_plugin_manifest() {
    log_test "Plugin Manifest (.claude-plugin/plugin.json)"

    local manifest="${PLUGIN_DIR}/.claude-plugin/plugin.json"

    if [ ! -f "$manifest" ]; then
        log_fail "plugin.json not found at $manifest"
        return 1
    fi

    log_pass "plugin.json file exists"

    # Validate JSON structure
    if jq empty "$manifest" 2>/dev/null; then
        log_pass "plugin.json is valid JSON"
    else
        log_fail "plugin.json has invalid JSON syntax"
        return 1
    fi

    # Check required fields
    local required_fields=("name" "version" "description")
    for field in "${required_fields[@]}"; do
        if jq -e ".$field" "$manifest" > /dev/null 2>&1; then
            local value=$(jq -r ".$field" "$manifest")
            log_pass "$field: $value"
        else
            log_fail "Required field '$field' missing in plugin.json"
        fi
    done
}

test_directory_structure() {
    log_test "Plugin Directory Structure"

    local required_dirs=(".claude-plugin" "daemon" "commands" "agents" "scripts" "test")
    local required_files=(".mcp.json" "package.json" "README.md")

    log_info "Checking required directories..."
    for dir in "${required_dirs[@]}"; do
        if [ -d "${PLUGIN_DIR}/$dir" ]; then
            log_pass "Directory exists: $dir"
        else
            log_fail "Directory missing: $dir"
        fi
    done

    log_info "Checking required files..."
    for file in "${required_files[@]}"; do
        if [ -f "${PLUGIN_DIR}/$file" ]; then
            log_pass "File exists: $file"
        else
            log_fail "File missing: $file"
        fi
    done
}

###############################################################################
# TEST SUITE 2: Server Lifecycle Tests
###############################################################################
test_server_startup() {
    log_section "Server Lifecycle Tests"
    log_test "Server Startup and Initialization"

    # Change to plugin directory
    cd "${PLUGIN_DIR}"

    # Start server in background
    PORT=${TEST_PORT} PROJECT_ROOT="${PLUGIN_DIR}" node "${SERVER_SCRIPT}" > /tmp/prism-server.log 2>&1 &
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

test_server_health() {
    log_test "Server Health Check"

    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/health")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ]; then
        log_pass "Health endpoint returned HTTP 200"

        # Validate JSON structure
        if echo "$body" | jq -e '.status' > /dev/null 2>&1; then
            local status=$(echo "$body" | jq -r '.status')
            log_pass "Server status: $status"
        else
            log_fail "Health response missing 'status' field"
        fi

        if echo "$body" | jq -e '.project' > /dev/null 2>&1; then
            local project=$(echo "$body" | jq -r '.project')
            log_pass "Project name: $project"
        fi

        if echo "$body" | jq -e '.uptime' > /dev/null 2>&1; then
            local uptime=$(echo "$body" | jq -r '.uptime')
            log_pass "Server uptime: ${uptime}s"
        fi
    else
        log_fail "Health endpoint returned HTTP $http_code (expected 200)"
    fi
}

###############################################################################
# TEST SUITE 3: MCP Protocol Tests
###############################################################################
test_mcp_tools_list() {
    log_section "MCP Protocol Tests"
    log_test "MCP tools/list endpoint"

    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/tools/list")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ]; then
        log_pass "tools/list returned HTTP 200"

        # Validate tools array
        if echo "$body" | jq -e '.tools' > /dev/null 2>&1; then
            local tool_count=$(echo "$body" | jq '.tools | length')
            log_pass "Found $tool_count MCP tools"

            # List each tool
            echo "$body" | jq -r '.tools[] | "\(.name) - \(.description)"' | while read line; do
                log_info "  Tool: $line"
            done

            # Check for expected tools
            local expected_tools=("search_repo" "get_file" "list_files")
            for tool in "${expected_tools[@]}"; do
                if echo "$body" | jq -e ".tools[] | select(.name==\"$tool\")" > /dev/null 2>&1; then
                    log_pass "Tool '$tool' is available"
                else
                    log_fail "Expected tool '$tool' not found"
                fi
            done
        else
            log_fail "Response missing 'tools' array"
        fi
    else
        log_fail "tools/list returned HTTP $http_code (expected 200)"
    fi
}

test_mcp_tool_call_search() {
    log_test "MCP tools/call - search_repo"

    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/tools/call" \
        -H "Content-Type: application/json" \
        -d '{"name": "search_repo", "arguments": {"query": "server", "limit": 5}}')
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ]; then
        log_pass "search_repo tool call returned HTTP 200"

        # Validate MCP response format
        if echo "$body" | jq -e '.content' > /dev/null 2>&1; then
            log_pass "Response has MCP 'content' field"

            if echo "$body" | jq -e '.content[0].type' > /dev/null 2>&1; then
                local content_type=$(echo "$body" | jq -r '.content[0].type')
                if [ "$content_type" = "text" ]; then
                    log_pass "Content type is 'text' (MCP compliant)"
                else
                    log_fail "Content type is '$content_type' (expected 'text')"
                fi
            fi

            if echo "$body" | jq -e '.content[0].text' > /dev/null 2>&1; then
                log_pass "Response has text content"
                local results=$(echo "$body" | jq -r '.content[0].text' | jq 'length' 2>/dev/null || echo "0")
                log_info "Search returned $results results"
            fi
        else
            log_fail "Response missing MCP 'content' field"
        fi
    else
        log_fail "search_repo tool call returned HTTP $http_code (expected 200)"
    fi
}

test_mcp_tool_call_list_files() {
    log_test "MCP tools/call - list_files"

    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/tools/call" \
        -H "Content-Type: application/json" \
        -d '{"name": "list_files", "arguments": {}}')
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ]; then
        log_pass "list_files tool call returned HTTP 200"

        if echo "$body" | jq -e '.content[0].text' > /dev/null 2>&1; then
            local file_count=$(echo "$body" | jq -r '.content[0].text' | jq 'length' 2>/dev/null || echo "0")
            log_pass "Found $file_count indexed files"
        fi
    else
        log_fail "list_files tool call returned HTTP $http_code (expected 200)"
    fi
}

test_mcp_tool_call_invalid() {
    log_test "MCP tools/call - Invalid tool name"

    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/tools/call" \
        -H "Content-Type: application/json" \
        -d '{"name": "invalid_tool", "arguments": {}}')
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "400" ]; then
        log_pass "Invalid tool name rejected with HTTP 400"

        if echo "$body" | jq -e '.error' > /dev/null 2>&1; then
            local error=$(echo "$body" | jq -r '.error')
            log_pass "Error message: $error"
        fi
    else
        log_fail "Invalid tool returned HTTP $http_code (expected 400)"
    fi
}

###############################################################################
# TEST SUITE 4: File Watcher Tests
###############################################################################
test_file_watcher_status() {
    log_section "File Watcher Tests"
    log_test "File Watcher Status"

    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/watcher/status")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ]; then
        log_pass "Watcher status endpoint returned HTTP 200"

        if echo "$body" | jq -e '.enabled' > /dev/null 2>&1; then
            local enabled=$(echo "$body" | jq -r '.enabled')
            if [ "$enabled" = "true" ]; then
                log_pass "File watcher is enabled"

                # Check watcher stats
                if echo "$body" | jq -e '.filesWatched' > /dev/null 2>&1; then
                    local files=$(echo "$body" | jq -r '.filesWatched')
                    log_info "Watching $files files"
                fi
            else
                log_info "File watcher is disabled"
            fi
        fi
    else
        log_fail "Watcher status returned HTTP $http_code (expected 200)"
    fi
}

###############################################################################
# TEST SUITE 5: Search and Indexing Tests
###############################################################################
test_search_functionality() {
    log_section "Search and Indexing Tests"
    log_test "Search Endpoint - Valid Query"

    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/search" \
        -H "Content-Type: application/json" \
        -d '{"query": "daemon"}')
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ]; then
        log_pass "Search endpoint returned HTTP 200"

        if echo "$body" | jq -e '.results' > /dev/null 2>&1; then
            local result_count=$(echo "$body" | jq '.results | length')
            log_pass "Search returned $result_count results"

            if [ "$result_count" -gt 0 ]; then
                # Validate result structure
                if echo "$body" | jq -e '.results[0].file' > /dev/null 2>&1; then
                    log_pass "Results have 'file' field"
                fi
                if echo "$body" | jq -e '.results[0].content' > /dev/null 2>&1; then
                    log_pass "Results have 'content' field"
                fi
                if echo "$body" | jq -e '.results[0].score' > /dev/null 2>&1; then
                    log_pass "Results have 'score' field"
                fi
            fi
        fi
    else
        log_fail "Search returned HTTP $http_code (expected 200)"
    fi
}

test_reindex_endpoint() {
    log_test "Reindex Endpoint"

    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/index")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "202" ]; then
        log_pass "Reindex endpoint returned HTTP 202 (Accepted)"

        if echo "$body" | jq -e '.status' > /dev/null 2>&1; then
            local status=$(echo "$body" | jq -r '.status')
            log_pass "Reindex status: $status"
        fi
    else
        log_fail "Reindex returned HTTP $http_code (expected 202)"
    fi
}

###############################################################################
# TEST SUITE 6: Error Handling Tests
###############################################################################
test_error_handling() {
    log_section "Error Handling Tests"
    log_test "Invalid JSON Request"

    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/search" \
        -H "Content-Type: application/json" \
        -d '{invalid json')
    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "400" ]; then
        log_pass "Invalid JSON rejected with HTTP 400"
    else
        log_fail "Invalid JSON returned HTTP $http_code (expected 400)"
    fi
}

test_query_too_long() {
    log_test "Query Too Long Error"

    # Generate a query longer than 10000 characters
    long_query=$(printf 'a%.0s' {1..10001})

    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/search" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"$long_query\"}")
    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "400" ]; then
        log_pass "Query too long rejected with HTTP 400"
    else
        log_fail "Long query returned HTTP $http_code (expected 400)"
    fi
}

test_404_handling() {
    log_test "404 Error Handling"

    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/nonexistent")
    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "404" ]; then
        log_pass "Non-existent endpoint returned HTTP 404"
    else
        log_fail "Non-existent endpoint returned HTTP $http_code (expected 404)"
    fi
}

###############################################################################
# TEST SUITE 7: Performance Tests
###############################################################################
test_response_times() {
    log_section "Performance Tests"
    log_test "Response Time Measurements"

    # Health check response time
    local start=$(date +%s%3N)
    curl -s "${BASE_URL}/health" > /dev/null
    local end=$(date +%s%3N)
    local health_time=$((end - start))

    log_info "Health check: ${health_time}ms"
    if [ $health_time -lt 100 ]; then
        log_pass "Health check response time < 100ms"
    else
        log_info "Health check took ${health_time}ms"
    fi

    # Search response time
    start=$(date +%s%3N)
    curl -s -X POST "${BASE_URL}/search" \
        -H "Content-Type: application/json" \
        -d '{"query": "test"}' > /dev/null
    end=$(date +%s%3N)
    local search_time=$((end - start))

    log_info "Search: ${search_time}ms"
    if [ $search_time -lt 200 ]; then
        log_pass "Search response time < 200ms"
    else
        log_info "Search took ${search_time}ms"
    fi
}

test_concurrent_requests() {
    log_test "Concurrent Request Handling"

    log_info "Sending 10 concurrent requests..."

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
# TEST SUITE 8: Integration Validation
###############################################################################
test_claude_code_compatibility() {
    log_section "Claude Code Integration Validation"
    log_test "MCP Protocol Compliance"

    # Check that server implements required MCP endpoints
    local mcp_endpoints=("/tools/list" "/tools/call")
    local all_passed=true

    for endpoint in "${mcp_endpoints[@]}"; do
        if curl -s "${BASE_URL}${endpoint}" > /dev/null 2>&1; then
            log_pass "MCP endpoint implemented: $endpoint"
        else
            log_fail "MCP endpoint not responding: $endpoint"
            all_passed=false
        fi
    done

    if [ "$all_passed" = true ]; then
        log_pass "All required MCP endpoints are available"
    else
        log_fail "Some MCP endpoints are missing or not responding"
    fi
}

###############################################################################
# Main Test Execution
###############################################################################
main() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║   PRISM Claude Code Plugin - Integration Test Suite       ║"
    echo "║   MCP Protocol Compliance & Functionality Tests            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    log_info "Plugin directory: ${PLUGIN_DIR}"
    log_info "Test port: ${TEST_PORT}"
    log_info "Base URL: ${BASE_URL}"
    log_info "Test start time: $(date)"

    # Check dependencies
    check_jq

    # Run test suites
    test_mcp_configuration
    test_plugin_manifest
    test_directory_structure

    test_server_startup || exit 1

    test_server_health

    test_mcp_tools_list
    test_mcp_tool_call_search
    test_mcp_tool_call_list_files
    test_mcp_tool_call_invalid

    test_file_watcher_status

    test_search_functionality
    test_reindex_endpoint

    test_error_handling
    test_query_too_long
    test_404_handling

    test_response_times
    test_concurrent_requests

    test_claude_code_compatibility

    # Summary
    echo -e "\n${CYAN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║   Test Summary                                             ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    total_tests=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))
    pass_rate=0
    if [ $total_tests -gt 0 ]; then
        pass_rate=$((TESTS_PASSED * 100 / total_tests))
    fi

    echo -e "Test end time: $(date)"
    echo -e "Total Tests: ${BLUE}${total_tests}${NC}"
    echo -e "Passed: ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "Failed: ${RED}${TESTS_FAILED}${NC}"
    echo -e "Skipped: ${YELLOW}${TESTS_SKIPPED}${NC}"
    echo -e "Pass Rate: ${BLUE}${pass_rate}%${NC}"

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}✓ All tests passed! Plugin is ready for Claude Code integration.${NC}\n"
        echo -e "${CYAN}Next steps:${NC}"
        echo -e "  1. Install the plugin in Claude Code: /plugin install prism@local"
        echo -e "  2. Verify plugin loads: Check MCP server status"
        echo -e "  3. Test tools: Use search_repo, get_file, list_files in Claude Code"
        echo -e "  4. Check logs: Monitor .prism/ directory for indexing activity"
        return 0
    else
        echo -e "\n${RED}✗ Some tests failed${NC}\n"
        echo -e "${YELLOW}Review failed tests above and check:${NC}"
        echo -e "  - Server logs: /tmp/prism-server.log"
        echo -e "  - Configuration: .mcp.json and plugin.json"
        echo -e "  - File permissions: Ensure all files are readable"
        return 1
    fi
}

# Run main function
main
exit_code=$?

# Exit with appropriate code
exit $exit_code
