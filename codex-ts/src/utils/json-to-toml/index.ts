/**
 * JSON value type that can be converted to TOML.
 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * TOML value type after conversion.
 */
export type TomlValue =
  | boolean
  | number
  | string
  | TomlValue[]
  | { [key: string]: TomlValue };

/**
 * Convert a JSON value into a semantically equivalent TOML value.
 *
 * This function recursively transforms JSON structures into TOML-compatible
 * structures, handling the differences between the two formats:
 * - JSON null becomes an empty string (TOML has no null)
 * - JSON objects become TOML tables
 * - JSON arrays become TOML arrays
 * - Primitives map directly
 *
 * @param value - The JSON value to convert
 * @returns The equivalent TOML value
 *
 * @example
 * ```typescript
 * jsonToToml({ name: 'test', value: 42 });
 * // { name: 'test', value: 42 }
 *
 * jsonToToml(null);
 * // ''
 *
 * jsonToToml([1, 2, 3]);
 * // [1, 2, 3]
 * ```
 */
export function jsonToToml(value: JsonValue): TomlValue {
  // Handle null - TOML doesn't have null, use empty string
  if (value === null) {
    return '';
  }

  // Handle boolean
  if (typeof value === 'boolean') {
    return value;
  }

  // Handle number (TOML distinguishes int vs float, but we keep it simple)
  if (typeof value === 'number') {
    return value;
  }

  // Handle string
  if (typeof value === 'string') {
    return value;
  }

  // Handle array
  if (Array.isArray(value)) {
    return value.map((item) => jsonToToml(item));
  }

  // Handle object (becomes TOML table)
  if (typeof value === 'object') {
    const result: { [key: string]: TomlValue } = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = jsonToToml(val);
    }
    return result;
  }

  // Fallback (shouldn't reach here with proper typing)
  return String(value);
}
