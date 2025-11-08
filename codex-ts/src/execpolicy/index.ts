/**
 * execpolicy: Execution policy checking
 *
 * This module validates proposed execv() calls against a security policy.
 * It classifies commands as: safe, match, forbidden, or unverified.
 *
 * Note: The Rust version uses Starlark for policy files. This TypeScript
 * version uses JSON for simplicity. The core checking logic is ported.
 */

export * from "./types.js";
export * from "./policy.js";
export * from "./checker.js";
export * from "./arg-types.js";
