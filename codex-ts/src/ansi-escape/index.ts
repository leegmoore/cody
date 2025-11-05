/**
 * ANSI escape code processing utilities.
 *
 * This module provides utilities for handling ANSI escape sequences in text,
 * particularly for terminal/TUI rendering. In TypeScript/Node.js, we rely on
 * libraries like ansi-regex or strip-ansi for parsing, while the Rust version
 * uses ansi-to-tui and ratatui.
 *
 * Note: This is a simplified port focused on tab expansion. Full ANSI parsing
 * would require additional dependencies like 'ansi-regex' or 'strip-ansi'.
 */

/**
 * Expand tabs in a best-effort way for transcript rendering.
 *
 * Tabs can interact poorly with left-gutter prefixes in our TUI and CLI
 * transcript views (e.g., `nl` separates line numbers from content with a tab).
 * Replacing tabs with spaces avoids odd visual artifacts without changing
 * semantics for our use cases.
 *
 * @param s - Input string that may contain tabs
 * @returns String with tabs replaced by 4 spaces
 */
export function expandTabs(s: string): string {
  if (s.includes('\t')) {
    // Keep it simple: replace each tab with 4 spaces.
    // We do not try to align to tab stops since most usages (like `nl`)
    // look acceptable with a fixed substitution and this avoids stateful math
    // across spans.
    return s.replace(/\t/g, '    ');
  }
  return s;
}

/**
 * Process a string containing ANSI escape codes for display.
 *
 * This simplified version only handles tab expansion. For full ANSI processing
 * including color codes and formatting, additional libraries would be needed.
 *
 * @param s - Input string with potential ANSI codes
 * @returns Processed string
 */
export function processAnsiEscape(s: string): string {
  return expandTabs(s);
}

/**
 * Process a single line containing ANSI escape codes.
 *
 * If the input contains multiple lines, a warning is logged and only the
 * first line is returned.
 *
 * @param s - Input string expected to be a single line
 * @returns Processed single line
 */
export function processAnsiEscapeLine(s: string): string {
  const processed = processAnsiEscape(s);
  const lines = processed.split('\n');

  if (lines.length === 0) {
    return '';
  } else if (lines.length === 1) {
    return lines[0];
  } else {
    // Warning: expected a single line but got multiple
    console.warn(
      `ansi_escape_line: expected a single line, got ${lines.length} lines`
    );
    return lines[0];
  }
}
