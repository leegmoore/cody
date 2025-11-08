/**
 * apply-patch: Parse and apply file patches
 *
 * This module provides functionality to parse patch text and apply changes to files.
 * Supports three types of operations:
 * - Add File: Create a new file with content
 * - Delete File: Remove an existing file
 * - Update File: Modify an existing file with chunks of changes
 */

export * from "./types.js";
export * from "./parser.js";
export * from "./seek-sequence.js";
export * from "./apply.js";
export * from "./bash-parser.js";
