/**
 * Ollama client for local model management
 *
 * This module provides utilities for interacting with a local Ollama instance,
 * including model listing, downloading, and progress reporting.
 *
 * Ported from codex-rs/ollama/
 */

// Client
export { OllamaClient } from "./client.js";

// Parser
export { pullEventsFromValue } from "./parser.js";
export type { PullEvent } from "./parser.js";

// Progress reporting
export { CliProgressReporter, TuiProgressReporter } from "./pull.js";
export type { PullProgressReporter } from "./pull.js";

// URL utilities
export { baseUrlToHostRoot, isOpenAiCompatibleBaseUrl } from "./url.js";

/**
 * Default OSS model to use when `--oss` is passed without an explicit `-m`.
 */
export const DEFAULT_OSS_MODEL = "gpt-oss:20b";
