export function seekSequence(
  haystack: readonly string[],
  needle: readonly string[],
  startIndex: number,
  preferEndOfFile: boolean,
): number | null {
  if (needle.length === 0) {
    return startIndex;
  }

  if (needle.length > haystack.length) {
    return null;
  }

  const maxStart = haystack.length - needle.length;
  const normalizedStart = preferEndOfFile
    ? maxStart
    : clampStartIndex(startIndex);

  if (normalizedStart > maxStart) {
    return null;
  }

  const passes: Comparator[] = [
    (a, b) => a === b,
    (a, b) => a.trimEnd() === b.trimEnd(),
    (a, b) => a.trim() === b.trim(),
    (a, b) => normalizeForComparison(a) === normalizeForComparison(b),
  ];

  for (const comparator of passes) {
    const match = searchWithComparator(
      haystack,
      needle,
      normalizedStart,
      maxStart,
      comparator,
    );
    if (match !== null) {
      return match;
    }
  }

  return null;
}

type Comparator = (hay: string, needle: string) => boolean;

function clampStartIndex(index: number): number {
  if (!Number.isFinite(index)) {
    return 0;
  }
  if (index <= 0) {
    return 0;
  }
  return Math.floor(index);
}

function searchWithComparator(
  haystack: readonly string[],
  needle: readonly string[],
  start: number,
  limit: number,
  comparator: Comparator,
): number | null {
  for (let offset = start; offset <= limit; offset += 1) {
    if (matchesAt(haystack, needle, offset, comparator)) {
      return offset;
    }
  }
  return null;
}

function matchesAt(
  haystack: readonly string[],
  needle: readonly string[],
  offset: number,
  comparator: Comparator,
): boolean {
  for (let index = 0; index < needle.length; index += 1) {
    const hayLine = haystack[offset + index];
    const needleLine = needle[index];
    if (hayLine === undefined || !comparator(hayLine, needleLine)) {
      return false;
    }
  }
  return true;
}

function normalizeForComparison(value: string): string {
  const trimmed = value.trim();
  let result = "";
  for (const char of trimmed) {
    switch (char) {
      case "‐":
      case "‑":
      case "‒":
      case "–":
      case "—":
      case "―":
      case "−":
        result += "-";
        break;
      case "‘":
      case "’":
      case "‚":
      case "‛":
        result += "'";
        break;
      case "“":
      case "”":
      case "„":
      case "‟":
        result += '"';
        break;
      case " ":
      case " ":
      case " ":
      case " ":
      case " ":
      case " ":
      case " ":
      case " ":
      case " ":
      case " ":
      case " ":
      case " ":
      case "　":
        result += " ";
        break;
      default:
        result += char;
        break;
    }
  }
  return result;
}
