/**
 * Fuzzy sequence matching for finding lines in files
 *
 * Attempts to find a sequence of pattern lines within a larger array of lines,
 * with decreasing strictness:
 * 1. Exact match
 * 2. Ignoring trailing whitespace
 * 3. Ignoring leading and trailing whitespace
 * 4. After normalizing Unicode punctuation to ASCII
 */

/**
 * Attempt to find the sequence of `pattern` lines within `lines` beginning at or after `start`.
 * Returns the starting index of the match or undefined if not found.
 *
 * When `eof` is true, we first try starting at the end-of-file (so that patterns intended
 * to match file endings are applied at the end), and fall back to searching from `start` if needed.
 *
 * Special cases handled defensively:
 * • Empty `pattern` → returns `start` (no-op match)
 * • `pattern.length > lines.length` → returns undefined (cannot match)
 */
export function seekSequence(
  lines: string[],
  pattern: string[],
  start: number,
  eof: boolean,
): number | undefined {
  if (pattern.length === 0) {
    return start;
  }

  // When the pattern is longer than the available input there is no possible match
  if (pattern.length > lines.length) {
    return undefined;
  }

  const searchStart =
    eof && lines.length >= pattern.length
      ? lines.length - pattern.length
      : start;

  // 1. Exact match first
  for (let i = searchStart; i <= lines.length - pattern.length; i++) {
    if (exactMatch(lines, pattern, i)) {
      return i;
    }
  }

  // 2. Then rstrip match (ignore trailing whitespace)
  for (let i = searchStart; i <= lines.length - pattern.length; i++) {
    if (rstripMatch(lines, pattern, i)) {
      return i;
    }
  }

  // 3. Trim both sides to allow more lenience
  for (let i = searchStart; i <= lines.length - pattern.length; i++) {
    if (trimMatch(lines, pattern, i)) {
      return i;
    }
  }

  // 4. Final, most permissive pass – attempt to match after normalising
  // common Unicode punctuation to their ASCII equivalents
  for (let i = searchStart; i <= lines.length - pattern.length; i++) {
    if (normalizeMatch(lines, pattern, i)) {
      return i;
    }
  }

  return undefined;
}

/**
 * Check exact match at position i
 */
function exactMatch(lines: string[], pattern: string[], i: number): boolean {
  for (let j = 0; j < pattern.length; j++) {
    if (lines[i + j] !== pattern[j]) {
      return false;
    }
  }
  return true;
}

/**
 * Check match ignoring trailing whitespace
 */
function rstripMatch(lines: string[], pattern: string[], i: number): boolean {
  for (let j = 0; j < pattern.length; j++) {
    if (lines[i + j].trimEnd() !== pattern[j].trimEnd()) {
      return false;
    }
  }
  return true;
}

/**
 * Check match ignoring leading and trailing whitespace
 */
function trimMatch(lines: string[], pattern: string[], i: number): boolean {
  for (let j = 0; j < pattern.length; j++) {
    if (lines[i + j].trim() !== pattern[j].trim()) {
      return false;
    }
  }
  return true;
}

/**
 * Check match after normalizing Unicode punctuation
 */
function normalizeMatch(
  lines: string[],
  pattern: string[],
  i: number,
): boolean {
  for (let j = 0; j < pattern.length; j++) {
    if (normalize(lines[i + j]) !== normalize(pattern[j])) {
      return false;
    }
  }
  return true;
}

/**
 * Normalize Unicode punctuation to ASCII equivalents
 */
function normalize(s: string): string {
  return s
    .trim()
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0);
      // Various dash / hyphen code-points → ASCII '-'
      if (
        code === 0x2010 || // HYPHEN
        code === 0x2011 || // NON-BREAKING HYPHEN
        code === 0x2012 || // FIGURE DASH
        code === 0x2013 || // EN DASH
        code === 0x2014 || // EM DASH
        code === 0x2015 || // HORIZONTAL BAR
        code === 0x2212 // MINUS SIGN
      ) {
        return "-";
      }
      // Fancy single quotes → "'"
      if (
        code === 0x2018 || // LEFT SINGLE QUOTATION MARK
        code === 0x2019 || // RIGHT SINGLE QUOTATION MARK
        code === 0x201a || // SINGLE LOW-9 QUOTATION MARK
        code === 0x201b // SINGLE HIGH-REVERSED-9 QUOTATION MARK
      ) {
        return "'";
      }
      // Fancy double quotes → '"'
      if (
        code === 0x201c || // LEFT DOUBLE QUOTATION MARK
        code === 0x201d || // RIGHT DOUBLE QUOTATION MARK
        code === 0x201e || // DOUBLE LOW-9 QUOTATION MARK
        code === 0x201f // DOUBLE HIGH-REVERSED-9 QUOTATION MARK
      ) {
        return '"';
      }
      // Non-breaking space and other odd spaces → normal space
      if (
        code === 0x00a0 || // NO-BREAK SPACE
        code === 0x2002 || // EN SPACE
        code === 0x2003 || // EM SPACE
        code === 0x2004 || // THREE-PER-EM SPACE
        code === 0x2005 || // FOUR-PER-EM SPACE
        code === 0x2006 || // SIX-PER-EM SPACE
        code === 0x2007 || // FIGURE SPACE
        code === 0x2008 || // PUNCTUATION SPACE
        code === 0x2009 || // THIN SPACE
        code === 0x200a || // HAIR SPACE
        code === 0x202f || // NARROW NO-BREAK SPACE
        code === 0x205f || // MEDIUM MATHEMATICAL SPACE
        code === 0x3000 // IDEOGRAPHIC SPACE
      ) {
        return " ";
      }
      return c;
    })
    .join("");
}
