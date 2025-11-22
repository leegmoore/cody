# Phase 4 Review: Tools & Feature Parity

**Role:** Senior QA/Reviewer.
**Context:** Phase 4 implemented the "Hands" of the agent: the Tool Execution Worker and the Anthropic Adapter.

# Review Standards

## 1. Tool Execution
*   **Worker:** Verify `src/workers/tool-worker.ts` (or similar) exists.
*   **Logic:** It must listen to Redis for `item_done: function_call`. It must **NOT** block the stream while executing (tools can be slow).
*   **Output:** It must write `function_call_output` back to the stream.
*   **Safety:** Does it respect the sandbox policy? (Or at least reuse the existing safe tool wrappers from `codex-ts`).

## 2. Anthropic Adapter
*   **Code:** Check `src/core/adapters/anthropic-adapter.ts`.
*   **Mapping:** Verify it correctly maps Anthropic's `content_block_start` / `delta` to our `StreamEvent`.
*   **Config:** Uses `ANTHROPIC_API_KEY`.

## 3. Operational Readiness
*   **Verification Script:** `scripts/verify_tools.ts` must pass. It should demonstrate a full loop: `Request Tool` -> `Worker Executes` -> `Output in Redis`.

# Execution Tasks

1.  `bun run format:check`
2.  `bun run lint`
3.  `bun run build`
4.  `bun run scripts/verify_tools.ts`

# Review Report Format

```markdown
# Phase 4 Review Report

## Execution Results
| Check | Status | Notes |
| :--- | :--- | :--- |
| Format | ✅/❌ | |
| Lint | ✅/❌ | |
| Build | ✅/❌ | |
| Verify Tools | ✅/❌ | |

## Findings Log
...

## Final Verdict
**Status:** [ACCEPTED / REJECTED]
```
