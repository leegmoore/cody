/**
 * Number formatting utilities with locale support and SI suffixes.
 */

// Cache the formatter for performance
let cachedFormatter: Intl.NumberFormat | null = null;

function getFormatter(): Intl.NumberFormat {
  if (!cachedFormatter) {
    cachedFormatter = new Intl.NumberFormat("en-US");
  }
  return cachedFormatter;
}

/**
 * Format an integer with locale-aware digit separators.
 *
 * For en-US locale, this adds comma separators (e.g., "12345" -> "12,345").
 *
 * @param n - The integer to format
 * @returns Formatted string with digit separators
 *
 * @example
 * ```typescript
 * formatWithSeparators(12345);     // "12,345"
 * formatWithSeparators(1000000);   // "1,000,000"
 * ```
 */
export function formatWithSeparators(n: number): string {
  return getFormatter().format(n);
}

/**
 * Format numbers to 3 significant figures using base-10 SI suffixes.
 *
 * This is useful for displaying large token counts or byte sizes compactly.
 *
 * Examples (en-US):
 * - 999 -> "999"
 * - 1200 -> "1.20K"
 * - 123456789 -> "123M"
 *
 * @param n - The integer to format
 * @returns Formatted string with SI suffix (K, M, G)
 *
 * @example
 * ```typescript
 * formatSiSuffix(999);         // "999"
 * formatSiSuffix(1200);        // "1.20K"
 * formatSiSuffix(1234000);     // "1.23M"
 * formatSiSuffix(1234000000);  // "1.23G"
 * ```
 */
export function formatSiSuffix(n: number): string {
  // Clamp negative to 0 (matches Rust implementation)
  n = Math.max(0, n);

  if (n < 1000) {
    return getFormatter().format(n);
  }

  const units: Array<[number, string]> = [
    [1_000, "K"],
    [1_000_000, "M"],
    [1_000_000_000, "G"],
  ];

  // Helper to format with specific fractional digits
  const formatScaled = (
    value: number,
    scale: number,
    fracDigits: number,
  ): string => {
    const scaled = value / scale;
    return scaled.toFixed(fracDigits);
  };

  for (const [scale, suffix] of units) {
    // Check rounded values to match Rust's behavior
    if (Math.round((100.0 * n) / scale) < 1000) {
      return `${formatScaled(n, scale, 2)}${suffix}`;
    } else if (Math.round((10.0 * n) / scale) < 1000) {
      return `${formatScaled(n, scale, 1)}${suffix}`;
    } else if (Math.round(n / scale) < 1000) {
      return `${formatScaled(n, scale, 0)}${suffix}`;
    }
  }

  // Above 1000G, keep whole-G precision
  const gValue = Math.round(n / 1e9);
  return `${formatWithSeparators(gValue)}G`;
}
