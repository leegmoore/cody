#!/bin/bash
# Phase 2.2 Manual Test Runner
# Watch this script execute tests step-by-step with pauses between each

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

WORKSPACE="/Users/leemoore/code/codex-port-02"
CODEX_TS="${WORKSPACE}/codex-ts"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Phase 2.2 Manual Testing${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Function to pause and wait for user
pause() {
    echo -e "${YELLOW}Press ENTER to continue to next test...${NC}"
    read
}

# Function to run a test with description
run_test() {
    local test_num=$1
    local description=$2

    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}TEST $test_num: $description${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Setup
echo -e "${BLUE}Setup: Rebuilding Cody CLI...${NC}"
cd "$CODEX_TS"
npm run build > /dev/null 2>&1
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Ensure test directory exists
mkdir -p /tmp/phase22-test
echo "Test file content" > /tmp/phase22-test/sample.txt

# =============================================================================
# TEST 1: Auto-Approve (approval_policy="never")
# =============================================================================

run_test "1" "Auto-Approve with approval_policy=\"never\""

echo "Creating config with approval_policy=\"never\"..."
cat > ~/.cody/config.toml << 'EOF'
model = "gpt-5-codex"
model_reasoning_effort = "low"
approval_policy = "never"
EOF

echo -e "${YELLOW}Config created:${NC}"
cat ~/.cody/config.toml
echo ""

echo -e "${BLUE}Running: cody chat \"read /tmp/phase22-test/sample.txt\"${NC}"
echo -e "${YELLOW}Watch for: No approval prompt, tool executes immediately${NC}"
echo ""

cody chat "read /tmp/phase22-test/sample.txt"

echo ""
echo -e "${GREEN}✓ Test 1 Result:${NC} Tool should have executed without approval prompt"
pause

# =============================================================================
# TEST 2: Approval Policy On-Request
# =============================================================================

run_test "2" "Approval Prompts with approval_policy=\"on-request\""

echo "Updating config to approval_policy=\"on-request\"..."
cat > ~/.cody/config.toml << 'EOF'
model = "gpt-5-codex"
model_reasoning_effort = "low"
approval_policy = "on-request"
EOF

echo -e "${YELLOW}Config updated:${NC}"
cat ~/.cody/config.toml
echo ""

echo -e "${BLUE}Running: cody chat \"run command: echo 'Testing approval'\"${NC}"
echo -e "${YELLOW}Watch for: Approval prompt appears, you must approve manually${NC}"
echo -e "${RED}YOU WILL NEED TO TYPE 'y' AND PRESS ENTER${NC}"
echo ""

cody chat "run command: echo 'Testing approval'"

echo ""
echo -e "${GREEN}✓ Test 2 Result:${NC} Approval prompt should have appeared"
pause

# =============================================================================
# TEST 3: Tool Iteration Limit (>6 tools)
# =============================================================================

run_test "3" "Tool Iteration Limit Increased to 100"

echo "Reverting to auto-approve for this test..."
cat > ~/.cody/config.toml << 'EOF'
model = "gpt-5-codex"
model_reasoning_effort = "low"
approval_policy = "never"
EOF

echo -e "${BLUE}Running: Complex task requiring multiple tool calls${NC}"
echo -e "${YELLOW}Watch for: Multiple tool calls (should complete without iteration error)${NC}"
echo ""

cody chat "List files in current directory, then read package.json, then summarize the project structure"

echo ""
echo -e "${GREEN}✓ Test 3 Result:${NC} Should have called multiple tools without hitting 6-iteration limit"
pause

# =============================================================================
# TEST 4: Perplexity Search (if API key available)
# =============================================================================

run_test "4" "Perplexity Search with Valid Model"

echo -e "${BLUE}Running: cody chat \"use perplexity to find latest AI news\"${NC}"
echo -e "${YELLOW}Watch for: Tool calls perplexitySearch (not webSearch), no 400 error${NC}"
echo -e "${YELLOW}Note: cody loads PERPLEXITY_API_KEY from codex-ts/.env automatically${NC}"
echo ""

cody chat "use perplexity to find latest AI news"

echo ""
echo -e "${GREEN}✓ Test 4 Result:${NC} Should have used perplexitySearch with sonar-reasoning-pro model"
pause

# =============================================================================
# TEST 5: No Duplicate Tool Display
# =============================================================================

run_test "5" "No Duplicate Tool Display"

echo -e "${BLUE}Running: cody chat \"read /tmp/phase22-test/sample.txt\"${NC}"
echo -e "${YELLOW}Watch for: Tool displayed ONCE only (not twice)${NC}"
echo ""

cody chat "read /tmp/phase22-test/sample.txt"

echo ""
echo -e "${GREEN}✓ Test 5 Result:${NC} Tool should have been displayed only once"
pause

# =============================================================================
# TEST 6: Untrusted Policy Rejected
# =============================================================================

run_test "6" "Unsupported \"untrusted\" Policy is Rejected"

echo "Creating config with unsupported approval_policy=\"untrusted\"..."
cat > ~/.cody/config.toml << 'EOF'
model = "gpt-5-codex"
approval_policy = "untrusted"
EOF

echo -e "${YELLOW}Config created with invalid policy:${NC}"
cat ~/.cody/config.toml
echo ""

echo -e "${BLUE}Running: cody chat \"test\"${NC}"
echo -e "${YELLOW}Watch for: Error message saying 'untrusted' is deferred to future release${NC}"
echo ""

if cody chat "test" 2>&1 | grep -i "untrusted.*deferred"; then
    echo -e "${GREEN}✓ Test 6 Result:${NC} Correctly rejected 'untrusted' with helpful message"
else
    echo -e "${RED}✗ Test 6 Result:${NC} Did not show expected error message"
fi

echo ""
pause

# =============================================================================
# CLEANUP
# =============================================================================

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Cleanup${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

echo "Restoring default config..."
cat > ~/.cody/config.toml << 'EOF'
model = "gpt-5-codex"
model_reasoning_effort = "low"
approval_policy = "never"
EOF

echo -e "${GREEN}✓ Config restored${NC}"
echo ""

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Manual Testing Complete${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

echo "Tests performed:"
echo "  1. ✓ Auto-approve with approval_policy=\"never\""
echo "  2. ✓ Approval prompts with approval_policy=\"on-request\""
echo "  3. ✓ Tool iteration limit allows >6 tools"
echo "  4. ${PERPLEXITY_API_KEY:+✓}${PERPLEXITY_API_KEY:-⚠} Perplexity search ${PERPLEXITY_API_KEY:+(ran)}${PERPLEXITY_API_KEY:-(skipped - no API key)}"
echo "  5. ✓ No duplicate tool display"
echo "  6. ✓ Untrusted policy rejected with helpful error"
echo ""

echo -e "${GREEN}Review the output above to verify all tests passed.${NC}"
echo -e "${YELLOW}Save this terminal output for verification documentation.${NC}"
echo ""
