# CODER PROMPT: Service Mock Tests - Slice 4 - Test Data Management

**Generated:** 2025-11-24
**Target Model:** gpt-5.1-codex-max
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`
**Slice:** 4 of 7 (Deterministic Tool Output)

---

## ROLE

You are a senior TypeScript/Node.js developer implementing **test data management** for deterministic tool execution testing. Your focus is creating controlled test files/directories so real tool execution produces predictable, verifiable output.

---

## PROJECT CONTEXT

**Current State:**
- ✅ **Slices 1-3 Complete**: Infrastructure, persistence, tool execution all working
- ✅ Real tools executing (readFile, exec)
- ⚠️ **Output is unpredictable**: Tests expect specific strings that might change
- ⚠️ **Brittle assertions**: "total 384", "# Cody Fastify" - fragile if files change

**The Problem:**
Current tests rely on existing project files (README.md, cody-fastify directory). If these change, tests break. We need **controlled test data** that tests create/own/cleanup.

---

## CURRENT PHASE

**Phase:** Service Mock Tests - Slice 4
**Objective:** Create test data management system for deterministic tool output validation.

**FUNCTIONAL OUTCOME:**
After this slice, tool execution tests (TC-HP-05, TC-HP-08) create their own test files/directories before running, execute real tools against this controlled data, verify expected output, and clean up afterward. Tests are deterministic and don't depend on changing project files.

---

## TASK SPECIFICATION

### **Task 1: Create Test Data Directory** (~15 min)

**Create structure:**
```
tests/fixtures/test-data/
├── .gitignore          # Ignore all test data
├── README.md           # Explain this directory
└── (test files created/deleted by tests)
```

**Files:**

1. `tests/fixtures/test-data/.gitignore`
```
# Test data directory
# All files here are created by tests and cleaned up automatically
*
!.gitignore
!README.md
```

2. `tests/fixtures/test-data/README.md`
```markdown
# Test Data Directory

This directory contains test files created dynamically by the test suite.

- Files are created in beforeEach/before hooks
- Files are deleted in afterEach/after hooks
- Do not commit test data files (only .gitignore and this README)

## Purpose

Provides controlled, predictable test data for real tool execution validation.
```

---

### **Task 2: Update Tool Test Fixtures** (~30 min)

**Update fixtures to reference test data files:**

**File:** `tests/fixtures/openai/simple-tool-call.json`

**Current** (probably):
```json
{
  "arguments": "{\"command\": [\"ls\", \"-la\"]}"
}
```

**Update to use test data directory:**
```json
{
  "arguments": "{\"command\": [\"ls\", \"-la\", \"tests/fixtures/test-data\"]}"
}
```

**File:** `tests/fixtures/openai/tool-call-output-message.json`

**Current** (probably):
```json
{
  "arguments": "{\"filePath\": \"README.md\"}"
}
```

**Update to test file:**
```json
{
  "arguments": "{\"filePath\": \"tests/fixtures/test-data/tc-hp-05-readme.md\"}"
}
```

---

### **Task 3: Add Test Data Setup/Teardown** (~45 min)

**File:** `tests/e2e/core-2.0/happy-path.spec.ts`

**Add helper functions:**
```typescript
import { writeFile, unlink, mkdir, rmdir } from "node:fs/promises";

const TEST_DATA_DIR = join(__dirname, "../../fixtures/test-data");

async function setupTestData() {
  // Ensure directory exists
  await mkdir(TEST_DATA_DIR, { recursive: true });

  // TC-HP-05: Create test README file
  await writeFile(
    join(TEST_DATA_DIR, "tc-hp-05-readme.md"),
    "# Test README for TC-HP-05\n\nThis is controlled test content.\nUsed to validate readFile tool execution.",
    "utf-8"
  );

  // TC-HP-08: Directory already exists (test-data itself)
  // ls will list contents we control
}

async function cleanupTestData() {
  // Delete test files
  try {
    await unlink(join(TEST_DATA_DIR, "tc-hp-05-readme.md"));
  } catch (error) {
    // File might not exist, that's ok
  }
}
```

**Add to test suite:**
```typescript
describe("Core 2.0 Happy Path", () => {
  beforeAll(async () => {
    await setupTestData(); // ← ADD
    await registerFixtures();
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
    await cleanupTestData(); // ← ADD
  }, 20_000);

  // ... tests ...
});
```

---

### **Task 4: Update Test Assertions** (~30 min)

**TC-HP-05: Update for controlled test data**

**File:** `tests/e2e/core-2.0/happy-path.spec.ts`

**Find TC-HP-05** (around line 230-290):

**Update assertion for function_call_output:**
```typescript
const toolOutput = response.output_items.find(
  (item): item is Extract<typeof item, { type: "function_call_output" }> =>
    item.type === "function_call_output",
);

expect(toolOutput).toBeDefined();
expect(toolOutput).toMatchObject({
  type: "function_call_output",
  success: true,
  origin: "tool_harness",
  // Expect REAL content from our test file
  output: expect.stringContaining("# Test README for TC-HP-05"),
});

// Also verify it contains our controlled content
expect(toolOutput.output).toContain("controlled test content");
```

**TC-HP-08: Update for test data directory**

**Find TC-HP-08** (around line 420-460):

**Update assertion:**
```typescript
expect(outputItem).toMatchObject({
  type: "function_call_output",
  success: true,
  origin: "tool_harness",
  // ls of test-data directory should show our test file
  output: expect.stringContaining("tc-hp-05-readme.md"),
});

// Also check for directory listing format
expect(outputItem.output).toMatch(/total \d+/); // ls -la format
expect(outputItem.output).toContain(".gitignore"); // Known file
```

---

## WORKFLOW STEPS

1. **Create test-data directory structure**
   ```bash
   mkdir -p tests/fixtures/test-data
   ```

2. **Create .gitignore and README.md** in test-data/

3. **Update fixtures** to reference test data files

4. **Add setup/cleanup helpers** to happy-path.spec.ts

5. **Update TC-HP-05 and TC-HP-08 assertions** for controlled output

6. **Test individually:**
   ```bash
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-05"
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-08"
   ```

7. **Verify test data cleanup:**
   ```bash
   ls tests/fixtures/test-data/
   # Should only show .gitignore and README.md after tests
   ```

8. **Run full suite** to ensure no regressions

9. **Remove diagnostic logging** from ToolWorker

10. **Document and commit**

---

## WORKFLOW RULES

### **Mandatory Rules:**

1. **Real tool execution against real test data**
   - Tools execute against files we create
   - Output is real (actual file contents, actual ls output)
   - Assertions verify real output matches expectations

2. **Test data must be isolated**
   - Create in tests/fixtures/test-data/ only
   - Don't create in project root or src/
   - Clean up in afterAll hook
   - Tests don't pollute each other

3. **Assertions must be specific but flexible**
   - Check for expected content (our test strings)
   - But don't require exact byte-for-byte match
   - Use stringContaining, toMatch regex for flexibility

---

## CODE QUALITY STANDARDS

### **Verification Command:**
```bash
npm run format && \
npm run lint && \
npx tsc --noEmit && \
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-0[58]"
```

**Plus cleanup verification:**
```bash
# After tests, check for leftover files
ls tests/fixtures/test-data/
# Should only see .gitignore and README.md
```

---

## STARTING POINT

**BEGIN by:**
1. Creating test-data directory structure
2. Adding setup/cleanup helpers
3. Running TC-HP-05 to see current behavior
4. Updating fixture and assertions for controlled data

---

## EXPECTED OUTCOME

After this session:
- ✅ Test data directory exists with .gitignore
- ✅ TC-HP-05 uses controlled test file
- ✅ TC-HP-08 uses controlled test directory
- ✅ Tests create data before, clean after
- ✅ Both tests pass with deterministic output
- ✅ No test data pollution between runs

**Mocking verification:**
- [ ] NO tool implementations mocked
- [ ] Test data is REAL files on disk
- [x] Tools execute against REAL data
