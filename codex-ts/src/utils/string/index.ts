/**
 * Get the byte length of a UTF-8 encoded string.
 * In JavaScript, this requires converting to a UTF-8 buffer.
 */
function getUtf8ByteLength(str: string): number {
  // Use TextEncoder to get accurate UTF-8 byte count
  return new TextEncoder().encode(str).length;
}

/**
 * Truncate a string to a byte budget at a character boundary (prefix).
 *
 * This function ensures that the returned string does not exceed the specified
 * byte budget when encoded as UTF-8, and that it doesn't break in the middle
 * of a multi-byte character.
 *
 * @param s - The input string
 * @param maxb - Maximum number of UTF-8 bytes
 * @returns The truncated string
 */
export function takeBytesAtCharBoundary(s: string, maxb: number): string {
  if (maxb === 0) {
    return "";
  }

  // Fast path: if the entire string fits, return it
  const totalBytes = getUtf8ByteLength(s);
  if (totalBytes <= maxb) {
    return s;
  }

  // Iterate through characters and track byte count
  let lastOk = 0;
  let byteCount = 0;

  for (const char of s) {
    const charBytes = getUtf8ByteLength(char);
    if (byteCount + charBytes > maxb) {
      break;
    }
    byteCount += charBytes;
    lastOk += char.length; // char.length accounts for surrogate pairs
  }

  return s.slice(0, lastOk);
}

/**
 * Take a suffix of a string within a byte budget at a character boundary.
 *
 * This function returns the last part of the string that fits within the
 * specified byte budget when encoded as UTF-8, ensuring it doesn't break
 * in the middle of a multi-byte character.
 *
 * @param s - The input string
 * @param maxb - Maximum number of UTF-8 bytes
 * @returns The suffix string
 */
export function takeLastBytesAtCharBoundary(s: string, maxb: number): string {
  if (maxb === 0) {
    return "";
  }

  // Fast path: if the entire string fits, return it
  const totalBytes = getUtf8ByteLength(s);
  if (totalBytes <= maxb) {
    return s;
  }

  // Build array of characters in reverse order
  const chars: string[] = Array.from(s);

  let start = chars.length;
  let byteCount = 0;

  // Iterate from the end
  for (let i = chars.length - 1; i >= 0; i--) {
    const charBytes = getUtf8ByteLength(chars[i]);
    if (byteCount + charBytes > maxb) {
      break;
    }
    byteCount += charBytes;
    start = i;
  }

  return chars.slice(start).join("");
}
