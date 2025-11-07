/**
 * Script parser and validator
 *
 * Validates and extracts TypeScript/JavaScript code from detected script blocks.
 * Performs security checks, size validation, and banned identifier scanning.
 *
 * Phase 4.4 - Script Harness: Detection & Parsing
 * Design reference: SCRIPT_HARNESS_DESIGN_FINAL.md Section 8.3
 */

import {
  scanForBannedIdentifiers,
  BANNED_IDENTIFIERS,
} from "./hardening.js";
import {
  BannedIdentifierError,
  ScriptSyntaxError,
  ScriptTooLargeError,
} from "./errors.js";
import { DEFAULT_SCRIPT_LIMITS, type ScriptExecutionLimits } from "./runtime/types.js";

/**
 * Parsed script with metadata
 */
export interface ParsedScript {
  /** Source code (validated and ready for execution) */
  sourceCode: string;

  /** SHA-256 hash of source code (for dedup/caching) */
  sourceHash: string;

  /** Detected language */
  language: "ts" | "js";

  /** Size in bytes */
  sizeBytes: number;

  /** Whether UTF-8 validation passed */
  isValidUtf8: boolean;
}

/**
 * Parse result with validation status
 */
export interface ParseResult {
  /** Whether parsing succeeded */
  success: boolean;

  /** Parsed script (if successful) */
  script?: ParsedScript;

  /** Error (if failed) */
  error?: Error;

  /** Validation warnings (non-fatal) */
  warnings: string[];
}

/**
 * Parse script code from a detected block
 *
 * Performs comprehensive validation:
 * - UTF-8 encoding check
 * - Size limit enforcement
 * - Banned identifier scanning
 * - Hash computation for caching
 *
 * @param code - Raw script code from detected block
 * @param limits - Execution limits for validation
 * @returns Parse result with script or error
 */
export function parseScript(
  code: string,
  limits: Partial<ScriptExecutionLimits> = {},
): ParseResult {
  const fullLimits = { ...DEFAULT_SCRIPT_LIMITS, ...limits };
  const warnings: string[] = [];

  try {
    // 1. Strip BOM if present (do this first before validation)
    let cleanCode = code;
    if (code.charCodeAt(0) === 0xfeff) {
      cleanCode = code.slice(1);
      warnings.push("Byte Order Mark (BOM) stripped from script");
    }

    // 2. Validate UTF-8 encoding
    const isValidUtf8 = isValidUtf8String(cleanCode);
    if (!isValidUtf8) {
      return {
        success: false,
        error: new ScriptSyntaxError("Invalid UTF-8 encoding in script"),
        warnings,
      };
    }

    // 3. Check size limit
    const sizeBytes = new Blob([cleanCode]).size;
    if (sizeBytes > fullLimits.maxSourceBytes) {
      return {
        success: false,
        error: new ScriptTooLargeError(sizeBytes, fullLimits.maxSourceBytes),
        warnings,
      };
    }

    // 4. Scan for banned identifiers
    const bannedIds = scanForBannedIdentifiers(cleanCode);
    if (bannedIds.length > 0) {
      return {
        success: false,
        error: new BannedIdentifierError(bannedIds),
        warnings,
      };
    }

    // 5. Basic syntax validation (lightweight check)
    const syntaxCheck = validateBasicSyntax(cleanCode);
    if (!syntaxCheck.valid) {
      return {
        success: false,
        error: new ScriptSyntaxError(syntaxCheck.error || "Invalid syntax"),
        warnings,
      };
    }

    // 6. Compute SHA-256 hash for caching/dedup
    const sourceHash = computeHash(cleanCode);

    // 7. Success!
    return {
      success: true,
      script: {
        sourceCode: cleanCode,
        sourceHash,
        language: "ts", // Always TypeScript for now
        sizeBytes,
        isValidUtf8: true,
      },
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      warnings,
    };
  }
}

/**
 * Validate UTF-8 encoding
 *
 * Ensures the string contains valid UTF-8 sequences.
 *
 * @param str - String to validate
 * @returns True if valid UTF-8
 */
function isValidUtf8String(str: string): boolean {
  try {
    // Try to encode and decode - will throw if invalid UTF-8
    const encoded = new TextEncoder().encode(str);
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(encoded);
    return decoded === str;
  } catch {
    return false;
  }
}

/**
 * Perform lightweight syntax validation
 *
 * This is NOT a full TypeScript parser - just catches obvious syntax errors
 * before sending to the sandbox. The QuickJS runtime will do full validation.
 *
 * Checks:
 * - Balanced braces, brackets, parentheses
 * - No unclosed strings
 * - No unclosed template literals
 * - No unclosed comments
 *
 * @param code - Code to validate
 * @returns Validation result
 */
function validateBasicSyntax(code: string): { valid: boolean; error?: string } {
  // Check balanced brackets
  const braceBalance = checkBracketBalance(code);
  if (braceBalance.error) {
    return { valid: false, error: braceBalance.error };
  }

  // Check for unclosed strings
  const stringCheck = checkUnclosedStrings(code);
  if (stringCheck.error) {
    return { valid: false, error: stringCheck.error };
  }

  // Check for unclosed comments
  const commentCheck = checkUnclosedComments(code);
  if (commentCheck.error) {
    return { valid: false, error: commentCheck.error };
  }

  return { valid: true };
}

/**
 * Check if brackets/braces/parens are balanced
 *
 * @param code - Code to check
 * @returns Check result
 */
function checkBracketBalance(code: string): { valid: boolean; error?: string } {
  const stack: string[] = [];
  const pairs: Record<string, string> = {
    "{": "}",
    "[": "]",
    "(": ")",
  };
  const closers = new Set(Object.values(pairs));

  // Simple state machine - skip string literals and comments
  let inString: string | null = null;
  let inComment = false;
  let escaped = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const next = code[i + 1];

    // Handle escape sequences in strings
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }

    // Handle strings
    if ((char === '"' || char === "'" || char === "`") && !inComment) {
      if (inString === char) {
        inString = null; // Close string
      } else if (!inString) {
        inString = char; // Open string
      }
      continue;
    }

    // Skip everything inside strings
    if (inString) continue;

    // Handle comments
    if (char === "/" && next === "/" && !inComment) {
      // Single-line comment - skip to end of line
      while (i < code.length && code[i] !== "\n") i++;
      continue;
    }
    if (char === "/" && next === "*" && !inComment) {
      inComment = true;
      i++; // Skip '*'
      continue;
    }
    if (char === "*" && next === "/" && inComment) {
      inComment = false;
      i++; // Skip '/'
      continue;
    }
    if (inComment) continue;

    // Check brackets
    if (pairs[char]) {
      stack.push(char);
    } else if (closers.has(char)) {
      if (stack.length === 0) {
        return { valid: false, error: `Unexpected closing '${char}'` };
      }
      const last = stack.pop()!;
      if (pairs[last] !== char) {
        return {
          valid: false,
          error: `Mismatched brackets: '${last}' and '${char}'`,
        };
      }
    }
  }

  if (stack.length > 0) {
    return {
      valid: false,
      error: `Unclosed bracket: '${stack[stack.length - 1]}'`,
    };
  }

  return { valid: true };
}

/**
 * Check for unclosed strings
 *
 * @param code - Code to check
 * @returns Check result
 */
function checkUnclosedStrings(code: string): { valid: boolean; error?: string } {
  let inString: string | null = null;
  let escaped = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      if (inString === char) {
        inString = null;
      } else if (!inString) {
        inString = char;
      }
    }
  }

  if (inString) {
    return { valid: false, error: `Unclosed string: ${inString}` };
  }

  return { valid: true };
}

/**
 * Check for unclosed comments
 *
 * @param code - Code to check
 * @returns Check result
 */
function checkUnclosedComments(code: string): { valid: boolean; error?: string } {
  let inComment = false;

  for (let i = 0; i < code.length - 1; i++) {
    const char = code[i];
    const next = code[i + 1];

    if (char === "/" && next === "*") {
      inComment = true;
      i++; // Skip '*'
    } else if (char === "*" && next === "/") {
      inComment = false;
      i++; // Skip '/'
    }
  }

  if (inComment) {
    return { valid: false, error: "Unclosed comment: /*" };
  }

  return { valid: true };
}

/**
 * Compute SHA-256 hash of source code
 *
 * Used for:
 * - Deduplication (same script executed multiple times)
 * - Caching (compilation results)
 * - Audit logging (script identification)
 *
 * @param code - Source code to hash
 * @returns Hex-encoded SHA-256 hash
 */
function computeHash(code: string): string {
  // Use Node's crypto module for SHA-256
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(code, "utf8").digest("hex");
}

/**
 * Batch parse multiple scripts
 *
 * @param codes - Array of script codes to parse
 * @param limits - Execution limits
 * @returns Array of parse results
 */
export function parseScripts(
  codes: string[],
  limits?: Partial<ScriptExecutionLimits>,
): ParseResult[] {
  return codes.map((code) => parseScript(code, limits));
}

/**
 * Validate script without full parsing
 *
 * Quick check for obvious issues.
 *
 * @param code - Code to validate
 * @returns True if appears valid
 */
export function isValidScript(code: string): boolean {
  const result = parseScript(code);
  return result.success;
}
