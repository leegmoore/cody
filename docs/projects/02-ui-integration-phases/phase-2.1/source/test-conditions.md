# Phase 2.1: Test Conditions

## Test 1: Approval Policy Loading

**Functional:** Config file with approval_policy="never" results in tools executing without prompts.

**Setup:**
- Create test config.toml with approval_policy="never"
- Load config via loadCliConfig()

**Execute:**
- Check loaded.core.approvalPolicy

**Verify:**
- Equals "never" (not default "on-failure")

## Test 2: Invalid Approval Policy

**Functional:** Invalid approval_policy value throws clear error.

**Setup:**
- Config with approval_policy="invalid-value"

**Execute:**
- loadCliConfig()

**Verify:**
- Throws ConfigurationError
- Error message lists valid values

## Test 3: Sandbox Policy Loading

**Functional:** sandbox_policy from config is applied.

**Setup:**
- Config with sandbox_policy="full-access"

**Execute:**
- Load config

**Verify:**
- core.sandboxPolicy reflects full-access mode

## Test 4: Reasoning Effort Loading

**Functional:** model_reasoning_effort from config is applied.

**Setup:**
- Config with model_reasoning_effort="low"

**Execute:**
- Load config

**Verify:**
- core.modelReasoningEffort === "low"
