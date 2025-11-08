/**
 * Codex orchestration engine.
 * Port of codex-rs/core/src/codex.rs
 *
 * This is the main orchestration engine for the Codex agent system.
 * It manages conversation sessions, processes user input, executes tools,
 * and coordinates with the model client.
 *
 * **Status**: Section 1 complete (types and state helpers)
 * **TODO**: Implement Session class, event loop, and Op handlers in future sections
 */

// Core types
export * from "./types.js";

// State helpers
export * from "./session-state.js";
export * from "./turn-state.js";

// Section 2: Event loop and session orchestration
export * from "./codex.js";
export * from "./session.js";
export * from "./submission-loop.js";
export * as handlers from "./handlers.js";

// TODO: Section 3 - Tool integration (ToolRouter, tool execution)
// TODO: Section 4 - Turn processing (spawn_task, process_items)
// TODO: Section 5 - MCP & advanced features
// TODO: Section 6 - Spawn/resume logic
// TODO: Port Codex.spawn() factory method
