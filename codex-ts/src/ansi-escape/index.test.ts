import { describe, it, expect, vi } from "vitest";
import {
  expandTabs,
  processAnsiEscape,
  processAnsiEscapeLine,
} from "./index.js";

describe("expandTabs", () => {
  it("replaces tabs with 4 spaces", () => {
    expect(expandTabs("hello\tworld")).toBe("hello    world");
    expect(expandTabs("\ttab at start")).toBe("    tab at start");
    expect(expandTabs("tab at end\t")).toBe("tab at end    ");
  });

  it("handles multiple tabs", () => {
    expect(expandTabs("a\tb\tc")).toBe("a    b    c");
  });

  it("returns unchanged string when no tabs", () => {
    const input = "no tabs here";
    expect(expandTabs(input)).toBe(input);
  });

  it("handles empty string", () => {
    expect(expandTabs("")).toBe("");
  });
});

describe("processAnsiEscape", () => {
  it("expands tabs in input", () => {
    expect(processAnsiEscape("hello\tworld")).toBe("hello    world");
  });

  it("returns input unchanged when no tabs", () => {
    const input = "plain text";
    expect(processAnsiEscape(input)).toBe(input);
  });
});

describe("processAnsiEscapeLine", () => {
  it("processes a single line", () => {
    expect(processAnsiEscapeLine("hello\tworld")).toBe("hello    world");
  });

  it("returns first line when input has multiple lines", () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const result = processAnsiEscapeLine("line1\nline2\nline3");

    expect(result).toBe("line1");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("expected a single line"),
    );

    consoleWarnSpy.mockRestore();
  });

  it("handles empty input", () => {
    expect(processAnsiEscapeLine("")).toBe("");
  });
});
