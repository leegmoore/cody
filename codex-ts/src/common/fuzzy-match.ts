/**
 * Simple case-insensitive subsequence matcher used for fuzzy filtering.
 *
 * Returns the indices (character positions) of the matched characters in the
 * ORIGINAL `haystack` string and a score where smaller is better.
 *
 * Unicode correctness: we perform the match on a lowercased copy of the
 * haystack and needle but maintain a mapping from each character in the
 * lowercased haystack back to the original character index in `haystack`.
 * This ensures the returned indices can be safely used with consumers that
 * iterate over the original string for highlighting, even when lowercasing
 * expands certain characters (e.g., ß → ss, İ → i̇).
 *
 * @param haystack - The string to search in
 * @param needle - The pattern to search for
 * @returns A tuple of [indices, score] where indices are character positions
 *          in the original haystack, and score is an integer where lower is better.
 *          Returns null if no match is found.
 */
export function fuzzyMatch(
  haystack: string,
  needle: string
): [number[], number] | null {
  if (needle.length === 0) {
    return [[], Number.MAX_SAFE_INTEGER];
  }

  // Build lowercased version of haystack with mapping back to original indices
  const loweredChars: string[] = [];
  const loweredToOrigCharIdx: number[] = [];

  let origIdx = 0;
  for (const ch of haystack) {
    for (const lc of ch.toLowerCase()) {
      loweredChars.push(lc);
      loweredToOrigCharIdx.push(origIdx);
    }
    origIdx++;
  }

  // Lowercase the needle
  const loweredNeedle = Array.from(needle.toLowerCase());

  // Find matching positions
  const resultOrigIndices: number[] = [];
  let lastLowerPos: number | null = null;
  let cur = 0;

  for (const nc of loweredNeedle) {
    let foundAt: number | null = null;

    while (cur < loweredChars.length) {
      if (loweredChars[cur] === nc) {
        foundAt = cur;
        cur++;
        break;
      }
      cur++;
    }

    if (foundAt === null) {
      return null; // No match found
    }

    const pos = foundAt;
    resultOrigIndices.push(loweredToOrigCharIdx[pos]);
    lastLowerPos = pos;
  }

  // Calculate score
  const firstLowerPos = resultOrigIndices.length === 0
    ? 0
    : loweredToOrigCharIdx.findIndex(
        (oi) => oi === resultOrigIndices[0]
      ) ?? 0;

  // last defaults to first for single-hit
  const finalLastLowerPos = lastLowerPos ?? firstLowerPos;

  // Score = extra span between first/last hit minus needle length (≥0)
  // Strongly reward prefix matches by subtracting 100 when the first hit is at index 0
  const window =
    finalLastLowerPos - firstLowerPos + 1 - loweredNeedle.length;
  let score = Math.max(window, 0);

  if (firstLowerPos === 0) {
    score -= 100;
  }

  // Deduplicate indices (important when lowercase expansion causes multiple lowered
  // characters to map to the same original character)
  const uniqueIndices = Array.from(new Set(resultOrigIndices)).sort(
    (a, b) => a - b
  );

  return [uniqueIndices, score];
}

/**
 * Convenience wrapper to get only the indices for a fuzzy match.
 *
 * @param haystack - The string to search in
 * @param needle - The pattern to search for
 * @returns An array of character indices in the original haystack, or null if no match
 */
export function fuzzyIndices(
  haystack: string,
  needle: string
): number[] | null {
  const result = fuzzyMatch(haystack, needle);
  if (result === null) {
    return null;
  }

  const [indices] = result;
  // Ensure indices are sorted and deduplicated
  return Array.from(new Set(indices)).sort((a, b) => a - b);
}
