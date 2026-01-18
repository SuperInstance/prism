#!/bin/bash

echo "======================================"
echo "PRISM MCP Tools Integration Test"
echo "======================================"
echo ""

BASE_URL="http://localhost:8080"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TOTAL=0
PASSED=0
FAILED=0

# Function to run a test
run_test() {
    local test_name=$1
    local command=$2
    local expected_pattern=$3

    TOTAL=$((TOTAL + 1))
    echo -e "${YELLOW}Test $TOTAL: $test_name${NC}"

    result=$(eval "$command" 2>&1)

    if echo "$result" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "Expected pattern: $expected_pattern"
        echo "Got: $result"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

echo "Testing MCP Protocol Endpoints"
echo "------------------------------"

# Test 1: Health check
run_test "Health check" \
    "curl -s $BASE_URL/health" \
    '"status":"ok"'

# Test 2: Tools list endpoint
run_test "GET /tools/list returns tool definitions" \
    "curl -s $BASE_URL/tools/list" \
    '"search_repo"'

# Test 3: Verify all three tools are listed
run_test "All three tools are listed" \
    "curl -s $BASE_URL/tools/list | jq -r '.tools[].name' | wc -l" \
    "3"

echo "Testing search_repo Tool"
echo "------------------------"

# Test 4: search_repo with valid query
run_test "search_repo executes successfully" \
    "curl -s -X POST $BASE_URL/tools/call -H 'Content-Type: application/json' -d '{\"name\":\"search_repo\",\"arguments\":{\"query\":\"function\"}}'" \
    '"content"'

# Test 5: search_repo respects limit parameter
run_test "search_repo respects limit parameter" \
    "curl -s -X POST $BASE_URL/tools/call -H 'Content-Type: application/json' -d '{\"name\":\"search_repo\",\"arguments\":{\"query\":\"error\",\"limit\":5}}'" \
    '"type":"text"'

# Test 6: search_repo returns MCP format
run_test "search_repo returns proper MCP format" \
    "curl -s -X POST $BASE_URL/tools/call -H 'Content-Type: application/json' -d '{\"name\":\"search_repo\",\"arguments\":{\"query\":\"test\"}}' | jq -r '.content[0].type'" \
    "text"

echo "Testing get_file Tool"
echo "---------------------"

# Test 7: get_file retrieves file contents
run_test "get_file retrieves README.md" \
    "curl -s -X POST $BASE_URL/tools/call -H 'Content-Type: application/json' -d '{\"name\":\"get_file\",\"arguments\":{\"path\":\"README.md\"}}'" \
    '"content"'

# Test 8: get_file returns actual file content
run_test "get_file returns actual file content" \
    "curl -s -X POST $BASE_URL/tools/call -H 'Content-Type: application/json' -d '{\"name\":\"get_file\",\"arguments\":{\"path\":\"README.md\"}}' | jq -r '.content[0].text'" \
    "PRISM"

echo "Testing list_files Tool"
echo "------------------------"

# Test 9: list_files returns file list
run_test "list_files returns file list" \
    "curl -s -X POST $BASE_URL/tools/call -H 'Content-Type: application/json' -d '{\"name\":\"list_files\",\"arguments\":{}}'" \
    'path.*language'

# Test 10: list_files with language filter
run_test "list_files filters by language" \
    "curl -s -X POST $BASE_URL/tools/call -H 'Content-Type: application/json' -d '{\"name\":\"list_files\",\"arguments\":{\"language\":\"javascript\"}}'" \
    'language.*javascript'

echo "Testing Error Handling"
echo "----------------------"

# Test 11: Invalid tool name
run_test "Rejects invalid tool name" \
    "curl -s -X POST $BASE_URL/tools/call -H 'Content-Type: application/json' -d '{\"name\":\"invalid_tool\",\"arguments\":{}}'" \
    '"error"'

# Test 12: Missing required parameter
run_test "Validates required parameters" \
    "curl -s -X POST $BASE_URL/tools/call -H 'Content-Type: application/json' -d '{\"name\":\"search_repo\",\"arguments\":{}}'" \
    'Missing required parameter'

# Test 13: Path traversal attempt
run_test "Blocks path traversal attempts" \
    "curl -s -X POST $BASE_URL/tools/call -H 'Content-Type: application/json' -d '{\"name\":\"get_file\",\"arguments\":{\"path\":\"../../etc/passwd\"}}'" \
    'path traversal not allowed'

# Test 14: Invalid JSON
run_test "Rejects invalid JSON" \
    "curl -s -X POST $BASE_URL/tools/call -H 'Content-Type: application/json' -d 'invalid json'" \
    'Invalid JSON'

# Test 15: Missing tool name
run_test "Rejects missing tool name" \
    "curl -s -X POST $BASE_URL/tools/call -H 'Content-Type: application/json' -d '{\"arguments\":{}}'" \
    'Missing tool name'

echo "======================================"
echo "Test Results Summary"
echo "======================================"
echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
else
    echo "Failed: $FAILED"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
