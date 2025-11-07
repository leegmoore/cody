/**
 * App Server constants and types for Codex.
 *
 * This module exports constants from the Codex app-server, which is an IDE
 * integration server that communicates via JSON-RPC over stdin/stdout.
 *
 * **Note:** The app-server itself (6,737 lines of Rust) is IDE-specific
 * infrastructure for running Codex as a background service. Library consumers
 * typically do not need to implement or use the app-server directly.
 *
 * This module provides only the reusable constants that may be useful when
 * working with JSON-RPC error codes or understanding the app-server architecture.
 */

/**
 * JSON-RPC error code for invalid request (-32600).
 *
 * This error is returned when the server receives a malformed JSON-RPC request.
 */
export const INVALID_REQUEST_ERROR_CODE = -32600

/**
 * JSON-RPC error code for internal error (-32603).
 *
 * This error is returned when the server encounters an internal processing error.
 */
export const INTERNAL_ERROR_CODE = -32603

/**
 * Channel capacity for message queues in the app-server.
 *
 * This defines the buffer size for bounded channels used to communicate
 * between tasks. A value of 128 balances throughput and memory usage for
 * an interactive CLI application.
 */
export const CHANNEL_CAPACITY = 128

/**
 * The app-server implementation is intentionally not ported.
 *
 * The Codex app-server is a complete IDE integration server (6,737 lines of
 * Rust) that handles JSON-RPC communication, message processing, conversation
 * management, and more. This is infrastructure specific to running Codex as
 * an IDE background service.
 *
 * Library consumers should use the `@openai/codex-core` library directly
 * rather than running the app-server. If IDE integration is needed, consider:
 *
 * 1. Using the Codex CLI directly
 * 2. Building a custom integration using the library APIs
 * 3. Implementing a lightweight RPC layer using the protocol types from
 *    `app-server-protocol`
 *
 * For reference, the app-server provides:
 * - JSON-RPC message processing over stdin/stdout
 * - Conversation lifecycle management
 * - Request/response handling
 * - Notification broadcasting
 * - Configuration management
 * - Telemetry and logging integration
 */
export const APP_SERVER_IMPLEMENTATION = undefined
