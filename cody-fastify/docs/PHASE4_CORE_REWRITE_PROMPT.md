# Phase 4: Feature Parity & Tool Execution

**High-Level Objective:** Give the Core 2.0 engine "Hands". Implement the Tool Execution loop and add support for Anthropic (Claude).

# Key Documentation (Source of Truth)
1.  **Blueprint:** `cody-fastify/docs/codex-core-2.0-tech-design.md` (Phase 4 section).
2.  **Script Harness:** `cody-fastify/docs/codex-enhancement-02.md` (for how to run QuickJS).

# Coding Standards
*   **Strict TypeScript.**
*   **No Mocks.**
*   **Reuse Legacy Tools:** Import tool logic (file ops, patching) from `codex-ts` or `cody-fastify/src/core/tools/` if migrated. Do not rewrite `grep`.

# Work Plan (Phase 4)

1.  **Tool Execution Worker (`src/workers/tool-worker.ts`):**
    *   Create a standalone worker.
    *   **Listen:** Subscribe to Redis stream `codex:run:*:events`.
    *   **Trigger:** When `item_done` is seen with `type: "function_call"`:
        1.  Parse the `arguments` JSON.
        2.  Dispatch to the requested tool (e.g., `fs_read_file`, `apply_patch`).
        3.  **Execute** the tool.
        4.  **Emit:** Publish `item_start` -> `item_done` (with `type: "function_call_output"`) back to the stream.
    *   **Entrypoint:** `src/workers/run_tool_worker.ts`.

2.  **Anthropic Adapter (`src/core/adapters/anthropic-adapter.ts`):**
    *   Implement `AnthropicStreamAdapter` implementing the same interface as `OpenAIStreamAdapter`.
    *   **Mapping:** Map Anthropic `content_block_delta` events to canonical `StreamEvent`s.
    *   **Config:** Read `ANTHROPIC_API_KEY`.

3.  **Script Harness Integration:**
    *   Ensure the Tool Worker can handle `script_execution` blocks (if applicable). If `codex-enhancement-02` logic exists, wire it up to the worker.

4.  **Verification:**
    *   Create `scripts/verify_tools.ts`.
    *   Flow:
        1.  Start Tool Worker.
        2.  Manually push a `function_call` event to Redis (simulating an AI request to "list files").
        3.  Wait for `function_call_output` event in Redis.
        4.  Assert the output contains file listing data.

# Developer Log
Maintain `DEVLOG.md`.
