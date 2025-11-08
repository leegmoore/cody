import { describe, it, expect } from "vitest";
import { formatWithSeparators, formatSiSuffix } from "./index.js";

describe("formatWithSeparators", () => {
  it("formats numbers with thousand separators", () => {
    expect(formatWithSeparators(12345)).toBe("12,345");
    expect(formatWithSeparators(1000000)).toBe("1,000,000");
    expect(formatWithSeparators(999)).toBe("999");
  });

  it("handles zero", () => {
    expect(formatWithSeparators(0)).toBe("0");
  });

  it("handles negative numbers", () => {
    expect(formatWithSeparators(-12345)).toBe("-12,345");
  });
});

describe("formatSiSuffix", () => {
  it("formats numbers under 1000 as-is", () => {
    expect(formatSiSuffix(0)).toBe("0");
    expect(formatSiSuffix(999)).toBe("999");
  });

  it("formats thousands with K suffix", () => {
    expect(formatSiSuffix(1000)).toBe("1.00K");
    expect(formatSiSuffix(1200)).toBe("1.20K");
    expect(formatSiSuffix(10000)).toBe("10.0K");
    expect(formatSiSuffix(100000)).toBe("100K");
  });

  it("formats millions with M suffix", () => {
    expect(formatSiSuffix(999500)).toBe("1.00M");
    expect(formatSiSuffix(1000000)).toBe("1.00M");
    expect(formatSiSuffix(1234000)).toBe("1.23M");
    expect(formatSiSuffix(12345678)).toBe("12.3M");
  });

  it("formats billions with G suffix", () => {
    expect(formatSiSuffix(999950000)).toBe("1.00G");
    expect(formatSiSuffix(1000000000)).toBe("1.00G");
    expect(formatSiSuffix(1234000000)).toBe("1.23G");
  });

  it("formats above 1000G with whole G precision", () => {
    expect(formatSiSuffix(1234000000000)).toBe("1,234G");
  });

  it("handles negative numbers", () => {
    // Negative numbers are clamped to 0 per Rust implementation
    expect(formatSiSuffix(-100)).toBe("0");
  });
});
