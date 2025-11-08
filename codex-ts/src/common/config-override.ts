/**
 * Support for `-c key=value` overrides shared across Codex CLI tools.
 *
 * This module provides a CliConfigOverrides class that can parse and apply
 * configuration overrides specified as `-c key=value` command-line arguments.
 * Each occurrence is collected as a raw string and can be converted into
 * key/value pairs, then applied onto a configuration object.
 *
 * Examples:
 *   - `-c model="o3"`
 *   - `-c 'sandbox_permissions=["disk-full-read-access"]'`
 *   - `-c shell_environment_policy.inherit=all`
 */

import * as toml from "@iarna/toml";

/**
 * Parse a TOML value from a string.
 *
 * The value is wrapped in a temporary TOML document to allow parsing of
 * any TOML value type (scalar, array, inline table, etc.).
 *
 * @param raw - Raw string to parse as TOML value
 * @returns Parsed value (primitive, array, or object)
 * @throws Error if the string cannot be parsed as valid TOML
 *
 * @example
 * ```typescript
 * parseTomlValue('42')           // 42
 * parseTomlValue('"hello"')      // "hello"
 * parseTomlValue('[1, 2, 3]')    // [1, 2, 3]
 * parseTomlValue('{a = 1, b = 2}') // {a: 1, b: 2}
 * ```
 */
export function parseTomlValue(raw: string): unknown {
  // Wrap the value in a temporary TOML document to parse it
  const wrapped = `_x_ = ${raw}`;
  try {
    const parsed = toml.parse(wrapped) as Record<string, unknown>;
    if (!("_x_" in parsed)) {
      throw new Error("missing sentinel key");
    }
    return parsed._x_;
  } catch (error) {
    throw new Error(`Failed to parse TOML value: ${error}`);
  }
}

/**
 * Configuration override parser for CLI `-c key=value` arguments.
 *
 * This class parses raw override strings and can apply them onto a
 * configuration object, creating nested structures as needed.
 */
export class CliConfigOverrides {
  private rawOverrides: string[];

  /**
   * Create a new CliConfigOverrides instance.
   *
   * @param rawOverrides - Array of raw override strings (e.g., ["model=o3", "count=42"])
   */
  constructor(rawOverrides: string[] = []) {
    this.rawOverrides = rawOverrides;
  }

  /**
   * Parse the raw strings into a list of (path, value) tuples.
   *
   * Each override is split on the first '=' character. The left side is
   * the dotted path, the right side is parsed as a TOML value. If TOML
   * parsing fails, the value is treated as a plain string.
   *
   * @returns Array of [path, value] tuples
   * @throws Error if an override is malformed (missing '=' or empty key)
   *
   * @example
   * ```typescript
   * const overrides = new CliConfigOverrides(['model=o3', 'count=42']);
   * const parsed = overrides.parseOverrides();
   * // [['model', 'o3'], ['count', 42]]
   * ```
   */
  parseOverrides(): Array<[string, unknown]> {
    return this.rawOverrides.map((s) => {
      // Split on the first '=' only, so values can contain '='
      const eqIndex = s.indexOf("=");
      if (eqIndex === -1) {
        throw new Error(`Invalid override (missing '='): ${s}`);
      }

      const key = s.slice(0, eqIndex).trim();
      const valueStr = s.slice(eqIndex + 1).trim();

      if (key.length === 0) {
        throw new Error(`Empty key in override: ${s}`);
      }

      // Attempt to parse as TOML. If that fails, treat it as a raw string.
      // This allows convenient usage such as `-c model=o3` without quotes.
      let value: unknown;
      try {
        value = parseTomlValue(valueStr);
      } catch {
        // Strip leading/trailing quotes if present
        const trimmed = valueStr.trim().replace(/^["']|["']$/g, "");
        value = trimmed;
      }

      return [key, value];
    });
  }

  /**
   * Apply all parsed overrides onto the target object.
   *
   * For each override, the dotted path is traversed, creating intermediate
   * objects as necessary. The value at the destination is replaced.
   *
   * @param target - Object to apply overrides onto (mutated in place)
   * @throws Error if parsing fails
   *
   * @example
   * ```typescript
   * const overrides = new CliConfigOverrides(['foo.bar=42']);
   * const config = {};
   * overrides.applyOnValue(config);
   * console.log(config); // {foo: {bar: 42}}
   * ```
   */
  applyOnValue(target: Record<string, unknown>): void {
    const overrides = this.parseOverrides();
    for (const [path, value] of overrides) {
      applySingleOverride(target, path, value);
    }
  }
}

/**
 * Apply a single override onto root, creating intermediate objects as necessary.
 *
 * @param root - Root object to apply override onto
 * @param path - Dotted path (e.g., "foo.bar.baz")
 * @param value - Value to set at the path
 */
function applySingleOverride(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = root;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;

    if (isLast) {
      // Set the final value
      if (
        typeof current === "object" &&
        current !== null &&
        !Array.isArray(current)
      ) {
        current[part] = value;
      } else {
        // Current is not an object, replace it
        const newObj: Record<string, unknown> = {};
        newObj[part] = value;
        // This overwrites the non-object value
        Object.assign(current, newObj);
      }
      return;
    }

    // Traverse or create intermediate object
    if (
      typeof current === "object" &&
      current !== null &&
      !Array.isArray(current)
    ) {
      if (
        !(part in current) ||
        typeof current[part] !== "object" ||
        Array.isArray(current[part])
      ) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    } else {
      // Current is not an object, replace the entire branch
      const newObj: Record<string, unknown> = {};
      current[part] = newObj;
      current = newObj;
    }
  }
}
