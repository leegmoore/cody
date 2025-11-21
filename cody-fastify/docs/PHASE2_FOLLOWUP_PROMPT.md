# Phase 2 Follow-Up: Stabilization & Fixes

**Status:** Phase 2 is structurally complete but failing verification gates.
**Role:** You are the same Senior Engineer continuing Phase 2.

## Current Blockers (Must Fix)

### 1. CRITICAL: Convex `messages:persist` Not Found
The verification script fails with `Could not find public function for 'messages:persist'`.
*   **Diagnosis:** You defined `persist` in `convex/messages.ts`, but it may not be exported correctly or the dev server hasn't picked it up.
*   **Action:**
    *   Ensure `export const persist = mutation(...)` is correct in `convex/messages.ts`.
    *   Verify `_generated/api.d.ts` reflects this new mutation.
    *   Restart the Convex dev server if necessary (or ask the user to).

### 2. HIGH: Formatting Gate Failed
`bun run format:check` failed with 25+ unformatted files.
*   **Action:** Run `bun run format` immediately to fix all style issues.

### 3. HIGH: Isolation Breach in Legacy API
You modified `src/api/handlers/turn-handlers.ts` and `src/api/services/conversation-service-codex.ts`.
*   **Requirement:** Phase 2 must remain **ISOLATED** from the legacy API.
*   **Action:**
    *   Review these changes.
    *   If they are purely for type compatibility (due to schema changes), add a comment: `// NOTE(Phase 2): Type fix for legacy compatibility`.
    *   If they wire up logic, **REVERT THEM**. The legacy API should not use the new Persistence Worker yet.

## Execution Plan

1.  **Fix Formatting:** `bun run format`.
2.  **Fix Convex Export:** Ensure `persist` is callable.
3.  **Review/Revert API Changes:** Enforce isolation.
4.  **Verify:** Run `bun run verify:pipeline`.
    *   **Success Criteria:** The script MUST output "trace: verification complete" and "trace: convex snapshot stored".
5.  **Final Check:** Run `bun run build` and `bun run lint`.

**Do not stop until `bun run verify:pipeline` succeeds.**
