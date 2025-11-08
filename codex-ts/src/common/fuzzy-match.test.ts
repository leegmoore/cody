import { describe, it, expect } from "vitest";
import { fuzzyMatch, fuzzyIndices } from "./fuzzy-match.js";

describe("fuzzyMatch", () => {
  it("matches basic ASCII subsequence with indices", () => {
    const result = fuzzyMatch("hello", "hl");
    expect(result).toBeTruthy();
    if (result) {
      const [idx, score] = result;
      expect(idx).toEqual([0, 2]);
      // 'h' at 0, 'l' at 2 -> window 1; start-of-string bonus applies (-100)
      expect(score).toBe(-99);
    }
  });

  it("handles Unicode dotted İ (Istanbul) highlighting correctly", () => {
    const result = fuzzyMatch("İstanbul", "is");
    expect(result).toBeTruthy();
    if (result) {
      const [idx, score] = result;
      expect(idx).toEqual([0, 1]);
      // Matches at lowered positions 0 and 2 -> window 1; start-of-string bonus applies
      expect(score).toBe(-99);
    }
  });

  it("handles German sharp s (ß) casefold correctly", () => {
    // ß lowercases to "ss", but "strasse" has 7 chars while "straße" has 6
    // This test verifies that lowercase expansion is handled correctly
    const result = fuzzyMatch("straße", "strasse");
    expect(result).toBeNull();
  });

  it("prefers contiguous match over spread", () => {
    const resultA = fuzzyMatch("abc", "abc");
    const resultB = fuzzyMatch("a-b-c", "abc");

    expect(resultA).toBeTruthy();
    expect(resultB).toBeTruthy();

    if (resultA && resultB) {
      const [, scoreA] = resultA;
      const [, scoreB] = resultB;

      // Contiguous window -> 0; start-of-string bonus -> -100
      expect(scoreA).toBe(-100);
      // Spread over 5 chars for 3-letter needle -> window 2; with bonus -> -98
      expect(scoreB).toBe(-98);
      expect(scoreA).toBeLessThan(scoreB);
    }
  });

  it("applies start-of-string bonus", () => {
    const resultA = fuzzyMatch("file_name", "file");
    const resultB = fuzzyMatch("my_file_name", "file");

    expect(resultA).toBeTruthy();
    expect(resultB).toBeTruthy();

    if (resultA && resultB) {
      const [, scoreA] = resultA;
      const [, scoreB] = resultB;

      // Start-of-string contiguous -> window 0; bonus -> -100
      expect(scoreA).toBe(-100);
      // Non-prefix contiguous -> window 0; no bonus -> 0
      expect(scoreB).toBe(0);
      expect(scoreA).toBeLessThan(scoreB);
    }
  });

  it("matches empty needle with max score and no indices", () => {
    const result = fuzzyMatch("anything", "");
    expect(result).toBeTruthy();
    if (result) {
      const [idx, score] = result;
      expect(idx).toEqual([]);
      expect(score).toBe(Number.MAX_SAFE_INTEGER);
    }
  });

  it("performs case insensitive matching", () => {
    const result = fuzzyMatch("FooBar", "foO");
    expect(result).toBeTruthy();
    if (result) {
      const [idx, score] = result;
      expect(idx).toEqual([0, 1, 2]);
      // Contiguous prefix match (case-insensitive) -> window 0 with bonus
      expect(score).toBe(-100);
    }
  });

  it("dedups indices for multichar lowercase expansion", () => {
    // İ lowercases to "i" + combining dot above (two characters)
    const needle = "\u{0069}\u{0307}"; // "i" + combining dot above
    const result = fuzzyMatch("İ", needle);
    expect(result).toBeTruthy();
    if (result) {
      const [idx, score] = result;
      expect(idx).toEqual([0]);
      // Lowercasing 'İ' expands to two chars; contiguous prefix -> window 0 with bonus
      expect(score).toBe(-100);
    }
  });

  it("returns null when no match is found", () => {
    const result = fuzzyMatch("hello", "xyz");
    expect(result).toBeNull();
  });
});

describe("fuzzyIndices", () => {
  it("returns only the indices without score", () => {
    const result = fuzzyIndices("hello", "hl");
    expect(result).toEqual([0, 2]);
  });

  it("returns null when no match", () => {
    const result = fuzzyIndices("hello", "xyz");
    expect(result).toBeNull();
  });

  it("returns empty array for empty needle", () => {
    const result = fuzzyIndices("anything", "");
    expect(result).toEqual([]);
  });
});
