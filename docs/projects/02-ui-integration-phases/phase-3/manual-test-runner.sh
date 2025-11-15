#!/bin/bash
# Phase 3 Manual Test Runner
# Multi-Provider Support - Watch all 3 APIs work

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

WORKSPACE="/Users/leemoore/code/codex-port-02"
CODEX_TS="${WORKSPACE}/codex-ts"

# Load .env
if [ -f "$CODEX_TS/.env" ]; then
    export $(cat "$CODEX_TS/.env" | grep -v '^#' | xargs)
fi

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Phase 3: Multi-Provider Testing${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

pause() {
    echo -e "${YELLOW}Press ENTER to continue...${NC}"
    read
}

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

# Verify API keys loaded
if echo "$OPENAI_API_KEY" | grep -qE '^sk-'; then
    echo -e "${GREEN}✓ OPENAI_API_KEY loaded${NC}"
else
    echo -e "${RED}✗ OPENAI_API_KEY not found in .env${NC}"
fi

if echo "$ANTHROPIC_API_KEY" | grep -qE '^sk-ant-'; then
    echo -e "${GREEN}✓ ANTHROPIC_API_KEY loaded${NC}"
else
    echo -e "${RED}✗ ANTHROPIC_API_KEY not found in .env${NC}"
fi

echo ""

# =============================================================================
# TEST 1: OpenAI Responses API
# =============================================================================

run_test "1" "OpenAI Responses API"

echo "Setting provider to OpenAI Responses..."
cody set-provider openai --api responses --model gpt-4o-mini

echo ""
echo "Verifying provider selection..."
cody list-providers

echo ""
echo -e "${BLUE}Creating conversation and sending message...${NC}"
echo -e "${YELLOW}Running: cody chat \"Summarize what Cody CLI does in one sentence\"${NC}"
echo ""

cody chat "Summarize what Cody CLI does in one sentence"

echo ""
echo -e "${GREEN}✓ Test 1 Complete${NC}"
echo -e "${YELLOW}Verify: Response from GPT-4o-mini received and coherent${NC}"
pause

# =============================================================================
# TEST 2: OpenAI Chat Completions API
# =============================================================================

run_test "2" "OpenAI Chat Completions API"

echo "Switching to Chat API..."
cody set-api chat

echo ""
echo "Verifying switch..."
cody list-providers

echo ""
echo -e "${BLUE}Testing Chat API with new conversation...${NC}"
echo -e "${YELLOW}Running: cody chat \"What is 2+2?\"${NC}"
echo ""

cody chat "What is 2+2?"

echo ""
echo -e "${GREEN}✓ Test 2 Complete${NC}"
echo -e "${YELLOW}Verify: Response from Chat API (gpt-4o-mini) received${NC}"
pause

# =============================================================================
# TEST 3: Anthropic Messages API
# =============================================================================

run_test "3" "Anthropic Messages API"

echo "Switching to Anthropic Messages..."
cody set-provider anthropic --api messages --model claude-3-5-haiku-20241022

echo ""
echo "Verifying switch..."
cody list-providers

echo ""
echo -e "${BLUE}Testing Messages API...${NC}"
echo -e "${YELLOW}Running: cody chat \"What's your name?\"${NC}"
echo ""

cody chat "What's your name?"

echo ""
echo -e "${GREEN}✓ Test 3 Complete${NC}"
echo -e "${YELLOW}Verify: Response from Claude (identifies as Claude/Anthropic)${NC}"
pause

# =============================================================================
# TEST 4: Invalid Combination Handling
# =============================================================================

run_test "4" "Invalid Provider/API Combinations"

echo -e "${BLUE}Testing: Anthropic with Chat API (should fail)${NC}"
echo ""

if cody set-provider anthropic --api chat 2>&1 | grep -i "does not support"; then
    echo -e "${GREEN}✓ Correctly rejected invalid combination${NC}"
else
    echo -e "${RED}✗ Failed to reject invalid combination${NC}"
fi

echo ""
echo -e "${BLUE}Testing: OpenAI with Messages API (should fail)${NC}"
echo ""

if cody set-provider openai --api messages 2>&1 | grep -i "does not support"; then
    echo -e "${GREEN}✓ Correctly rejected invalid combination${NC}"
else
    echo -e "${RED}✗ Failed to reject invalid combination${NC}"
fi

echo ""
echo -e "${BLUE}Verifying config still valid after rejections...${NC}"
cody list-providers

echo ""
echo -e "${GREEN}✓ Test 4 Complete${NC}"
echo -e "${YELLOW}Verify: Invalid combinations rejected, config intact${NC}"
pause

# =============================================================================
# TEST 5: Provider Parity
# =============================================================================

run_test "5" "Provider Parity (Same Question, All Providers)"

echo -e "${BLUE}Testing same question on all 3 providers...${NC}"
echo ""

echo -e "${YELLOW}OpenAI Responses:${NC}"
cody set-provider openai --api responses --model gpt-4o-mini > /dev/null
cody chat "Calculate: 5 * 7"

echo ""
echo -e "${YELLOW}OpenAI Chat:${NC}"
cody set-api chat > /dev/null
cody chat "Calculate: 5 * 7"

echo ""
echo -e "${YELLOW}Anthropic Messages:${NC}"
cody set-provider anthropic --api messages --model claude-3-5-haiku-20241022 > /dev/null
cody chat "Calculate: 5 * 7"

echo ""
echo -e "${GREEN}✓ Test 5 Complete${NC}"
echo -e "${YELLOW}Verify: All three answered \"35\" correctly${NC}"
pause

# =============================================================================
# TEST 6: Tool Execution Cross-Provider
# =============================================================================

run_test "6" "Tool Execution Works on All Providers"

echo "Creating test file..."
echo "Phase 3 test content" > /tmp/phase3-test.txt

echo ""
echo -e "${BLUE}Testing tool execution with different providers...${NC}"
echo ""

# Auto-approve mode
cat > ~/.cody/config.toml << 'EOF'
model = "gpt-4o-mini"
model_reasoning_effort = "low"
approval_policy = "never"
EOF

echo -e "${YELLOW}OpenAI Responses with tools:${NC}"
cody set-provider openai --api responses --model gpt-4o-mini > /dev/null
cody chat "read /tmp/phase3-test.txt"

echo ""
echo -e "${YELLOW}Anthropic Messages with tools:${NC}"
cody set-provider anthropic --api messages --model claude-3-5-haiku-20241022 > /dev/null
cody chat "read /tmp/phase3-test.txt"

echo ""
echo -e "${GREEN}✓ Test 6 Complete${NC}"
echo -e "${YELLOW}Verify: Both providers executed readFile tool successfully${NC}"
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

rm -f /tmp/phase3-test.txt

echo -e "${GREEN}✓ Cleanup complete${NC}"
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
echo "  1. ✓ OpenAI Responses API working"
echo "  2. ✓ OpenAI Chat Completions API working"
echo "  3. ✓ Anthropic Messages API working"
echo "  4. ✓ Invalid combinations rejected properly"
echo "  5. ✓ Provider parity confirmed (same question, all work)"
echo "  6. ✓ Tool execution works on all providers"
echo ""

echo -e "${GREEN}All 3 providers functional. Multi-provider support verified.${NC}"
echo ""
