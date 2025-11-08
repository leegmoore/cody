/**
 * Sandbox management for secure command execution
 *
 * Provides platform-specific sandboxing capabilities including:
 * - macOS Seatbelt sandbox
 * - Linux Seccomp/Landlock sandbox
 * - Windows Restricted Token sandbox (experimental)
 *
 * The SandboxManager class handles selecting appropriate sandboxes and
 * transforming portable CommandSpec into platform-specific ExecEnv.
 */

export * from "./types.js";
export * from "./platform.js";
export * from "./manager.js";
export * from "./wrappers.js";
