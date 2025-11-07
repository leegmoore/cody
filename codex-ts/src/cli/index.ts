/**
 * CLI utilities for Codex.
 *
 * This module provides utility functions extracted from the Codex CLI,
 * primarily for formatting and displaying sensitive information.
 */

/**
 * Safely format an API key for display by masking the middle portion.
 *
 * For keys longer than 13 characters, shows the first 8 characters,
 * followed by '***', followed by the last 5 characters.
 * For shorter keys, returns '***' to avoid revealing the key.
 *
 * @param key - The API key to format
 * @returns The safely formatted key string
 *
 * @example
 * ```typescript
 * safeFormatKey('sk-proj-1234567890ABCDE')
 * // Returns: 'sk-proj-***ABCDE'
 *
 * safeFormatKey('short')
 * // Returns: '***'
 * ```
 */
export function safeFormatKey(key: string): string {
  if (key.length <= 13) {
    return '***'
  }

  const prefix = key.slice(0, 8)
  const suffix = key.slice(-5)
  return `${prefix}***${suffix}`
}
