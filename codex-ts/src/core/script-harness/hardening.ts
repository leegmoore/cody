/**
 * Hardening utilities for script sandbox
 *
 * Generates code to freeze intrinsics and remove dangerous globals
 * from the sandbox environment to prevent escape attacks.
 *
 * Phase 4.4 - Script Harness: Security Hardening
 * Design reference: SCRIPT_HARNESS_DESIGN_FINAL.md Section 1.4
 */

/**
 * List of prototype objects to freeze
 *
 * Freezing prototypes prevents:
 * - Prototype pollution attacks
 * - Mutation of built-in behavior
 * - Adding properties that persist across scripts
 */
const PROTOTYPES_TO_FREEZE = [
  "Object.prototype",
  "Array.prototype",
  "Function.prototype",
  "Promise.prototype",
  "Map.prototype",
  "Set.prototype",
  "WeakMap.prototype",
  "WeakSet.prototype",
  "Date.prototype",
  "RegExp.prototype",
  "Error.prototype",
  "String.prototype",
  "Number.prototype",
  "Boolean.prototype",
] as const;

/**
 * List of dangerous globals to delete
 *
 * These provide potential sandbox escape vectors:
 * - eval/Function: dynamic code execution
 * - require/import: module system access
 * - process: Node.js process access
 */
const GLOBALS_TO_DELETE = [
  "eval",
  "Function",
  "require",
  "module",
  "process",
  "import",
  "importScripts",
  "Worker",
  "SharedArrayBuffer",
  "Atomics",
] as const;

/**
 * Generate hardening prelude code
 *
 * This code is executed once at the start of each script to:
 * 1. Freeze all built-in prototypes
 * 2. Delete dangerous globals
 * 3. Seal the global scope
 *
 * @returns JavaScript code string to execute in sandbox
 */
export function generateHardeningPrelude(): string {
  const freezePrototypes = PROTOTYPES_TO_FREEZE.map(
    (proto) => `  Object.freeze(${proto});`,
  ).join("\n");

  const deleteGlobals = GLOBALS_TO_DELETE.map(
    (global) => `  delete globalThis.${global};`,
  ).join("\n");

  return `\
(function() {
  "use strict";

  // Freeze all built-in prototypes to prevent mutation
${freezePrototypes}

  // Remove dangerous globals that could enable sandbox escape
${deleteGlobals}

  // Seal global scope to prevent new properties
  Object.freeze(globalThis);
})();
`;
}

/**
 * Validate that hardening has been applied correctly
 *
 * This code checks that:
 * - Prototypes are frozen
 * - Dangerous globals are undefined
 * - Global scope is frozen
 *
 * @returns Validation code that throws if hardening failed
 */
export function generateHardeningValidation(): string {
  return `\
(function() {
  "use strict";

  // Verify prototypes are frozen
  const prototypes = [
    Object.prototype,
    Array.prototype,
    Function.prototype,
    Promise.prototype,
  ];

  for (const proto of prototypes) {
    if (!Object.isFrozen(proto)) {
      throw new Error("Hardening failed: prototype not frozen");
    }
  }

  // Verify dangerous globals are undefined
  if (typeof eval !== "undefined") {
    throw new Error("Hardening failed: eval still accessible");
  }

  if (typeof Function !== "undefined" && Function.constructor) {
    throw new Error("Hardening failed: Function constructor accessible");
  }

  // Verify global is frozen
  if (!Object.isFrozen(globalThis)) {
    throw new Error("Hardening failed: globalThis not frozen");
  }
})();
`;
}

/**
 * Deep freeze an object and all its properties recursively
 *
 * Used to freeze injected context and tools objects before
 * passing them to the sandbox.
 *
 * @param obj - Object to freeze
 * @param visited - Set of already-visited objects (prevents cycles)
 * @returns Frozen object
 */
export function deepFreeze<T>(obj: T, visited = new Set<unknown>()): T {
  // Prevent infinite recursion on circular references
  if (visited.has(obj)) {
    return obj;
  }

  // Only freeze objects and functions
  if (obj === null || (typeof obj !== "object" && typeof obj !== "function")) {
    return obj;
  }

  visited.add(obj);

  // Freeze own properties first
  Object.freeze(obj);

  // Recursively freeze all property values
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as Record<string, unknown>)[prop];
    if (value && (typeof value === "object" || typeof value === "function")) {
      deepFreeze(value, visited);
    }
  });

  return obj;
}

/**
 * Create a frozen copy of an object
 *
 * Uses structuredClone to create a deep copy, then deep freezes it.
 * This ensures the original object is not mutated.
 *
 * @param obj - Object to clone and freeze
 * @returns Frozen clone
 */
export function freezeClone<T>(obj: T): T {
  const clone = structuredClone(obj);
  return deepFreeze(clone);
}

/**
 * List of banned identifiers in script source code
 *
 * Scripts are scanned for these tokens outside of string literals
 * to detect potential escape attempts before execution.
 */
export const BANNED_IDENTIFIERS = [
  "require",
  "import",
  "eval",
  "Function",
  "process",
  "__proto__",
  "constructor",
  "prototype",
] as const;

/**
 * Simple token scanner to detect banned identifiers
 *
 * This is a lightweight check before execution. Not a full parser.
 * Looks for banned tokens outside of string literals.
 *
 * @param sourceCode - Script source code to scan
 * @returns Array of banned identifiers found
 */
export function scanForBannedIdentifiers(sourceCode: string): string[] {
  const found: string[] = [];

  // Remove string literals and comments to avoid false positives
  const cleaned = sourceCode
    .replace(/"(?:[^"\\]|\\.)*"/g, '""') // Remove double-quoted strings
    .replace(/'(?:[^'\\]|\\.)*'/g, "''") // Remove single-quoted strings
    .replace(/`(?:[^`\\]|\\.)*`/g, "``") // Remove template literals
    .replace(/\/\/.*$/gm, "") // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ""); // Remove multi-line comments

  // Check for banned identifiers
  for (const identifier of BANNED_IDENTIFIERS) {
    // Use word boundary regex to match whole identifiers only
    const regex = new RegExp(`\\b${identifier}\\b`, "g");
    if (regex.test(cleaned)) {
      found.push(identifier);
    }
  }

  return found;
}
