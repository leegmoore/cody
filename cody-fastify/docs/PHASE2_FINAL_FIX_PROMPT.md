# Phase 2 Final Fixes: Hardening & Review Feedback

**Status:** Phase 2 is functionally complete and almost accepted. The mock issue is resolved, and verification passes. The only remaining item is to formally address the API isolation concern.
**Role:** You are the same Senior Engineer finishing Phase 2.

## Final Task: Annotate Legacy API Changes (Housekeeping)

The reviewer flagged modifications to `src/api/handlers/turn-handlers.ts` and `src/api/services/conversation-service-codex.ts` as an isolation breach. Upon re-review, these changes appear to be necessary type adjustments due to schema evolution, rather than a premature integration of Core 2.0 logic.

*   **Action:** Add the following comment to the top of both `src/api/handlers/turn-handlers.ts` and `src/api/services/conversation-service-codex.ts` (if the comment isn't already there):
    ```typescript
    // NOTE: This legacy service/handler was updated during Core 2.0 Phase 2
    // to align with the new Convex Schema and maintain type compatibility.
    // It does NOT use the new Core 2.0 pipeline logic yet.
    ```

## Execution Plan

1.  **Add Annotation:** Add the specified comment to the two legacy API files.
2.  **Run Final Checks:**
    *   `bun run format`
    *   `bun run lint`
    *   `bun run build`
    *   `bun run verify:pipeline` -> MUST pass and show status: "complete".

**Do not stop until these comments are added and all checks pass.**