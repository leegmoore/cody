# Phase 4 Review: Tools & Feature Parity Audit

**Role:** Senior QA/Security Reviewer.
**Context:** Phase 4 implemented the "Hands" of the agent: the Tool Execution Worker and the Anthropic Adapter. This is a high-risk phase because it involves executing code/commands and handling complex third-party streams.

# Review Standards

## 1. Tool Execution Architecture
*   **Isolation:** The `ToolWorker` must be a standalone process (or clearly separated module) listening to Redis. It must NOT be tightly coupled to the API server.
*   **Resilience:**
    *   **Crash Safety:** If a tool throws an error, does the worker crash? It MUST catch the error and emit an `item_start` (`function_call_output`) with `success: false`.
    *   **Concurrency:** Does the worker handle multiple tool calls in parallel (if designed that way) or sequentially without blocking other runs?
*   **Idempotency:** Does the worker handle duplicate `function_call` events gracefully? (Ideally yes, but check for gross negligence).

## 2. Security & Safety
*   **Sandbox Integrity:** Check `src/workers/tool-worker.ts`.
    *   **Requirement:** It MUST import tool logic from `codex-ts` or `src/core/tools/` (legacy wrappers).
    *   **Flag:** Any direct usage of `child_process.exec`, `fs.writeFile`, etc., without using the sanitized wrappers is a **CRITICAL SECURITY FAILURE**.
    *   **Verification:** Ensure no new "unsafe" tool implementations were added.

## 3. Anthropic Adapter Correctness
*   **File:** `src/core/adapters/anthropic-adapter.ts`.
*   **Mapping Logic:** Anthropic's `content_block_delta` is complex.
    *   Does it correctly handle interleaved `text_delta` and `input_json_delta`?
    *   Does it correctly assemble `input_json` chunks before parsing?
    *   Does it map `stop_reason: tool_use` to `response_done` (or intermediate state)?
*   **Config:** Ensure it uses `ANTHROPIC_API_KEY` from `process.env`.

## 4. Verification Depth
*   **Script:** `scripts/verify_tools.ts`
*   **Requirement:** The script must prove functional correctness, not just "it didn't crash".
    *   Did it execute a real tool (e.g., `fs_read_file` on `package.json`)?
    *   Did it assert the *content* of the output matches expectation?
    *   Did it see the `function_call_output` event in Redis?

# Execution Tasks

1.  **Static Analysis:** `bun run format:check` && `bun run lint`
2.  **Build:** `bun run build` (Crucial for type safety)
3.  **Integration:** `bun run scripts/verify_tools.ts`
    *   *Watch the logs:* Look for "Tool executed successfully" and actual file content output.

# Review Report Format

```markdown
# Phase 4 Review Report

## Execution Results
| Check | Status | Notes |
| :--- | :--- | :--- |
| Format | ✅/❌ | |
| Lint | ✅/❌ | |
| Build | ✅/❌ | |
| Verify Tools | ✅/❌ | Did it actually read a file? |

## Security & Safety Audit
| Check | Status | Notes |
| :--- | :--- | :--- |
| No Direct `exec` | ✅/❌ | |
| Legacy Tool Reuse | ✅/❌ | |
| Error Trapping | ✅/❌ | |

## Findings Log
(Sort by Severity)

### 1. [Issue Title]
...

## Final Verdict
**Status:** [ACCEPTED / REJECTED]
```