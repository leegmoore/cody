import { describe, it, expect } from "vitest";
import {
  takeBytesAtCharBoundary,
  takeLastBytesAtCharBoundary,
} from "./index.js";

describe("takeBytesAtCharBoundary", () => {
  it("returns full string when within byte budget", () => {
    expect(takeBytesAtCharBoundary("hello", 10)).toBe("hello");
    expect(takeBytesAtCharBoundary("hello", 5)).toBe("hello");
  });

  it("returns empty string for empty input", () => {
    expect(takeBytesAtCharBoundary("", 10)).toBe("");
  });

  it("truncates at char boundary for ASCII", () => {
    expect(takeBytesAtCharBoundary("hello world", 5)).toBe("hello");
    expect(takeBytesAtCharBoundary("hello world", 6)).toBe("hello ");
  });

  it("truncates at char boundary for multi-byte UTF-8", () => {
    // '你好世界' - each Chinese character is 3 bytes
    expect(takeBytesAtCharBoundary("你好世界", 3)).toBe("你");
    expect(takeBytesAtCharBoundary("你好世界", 6)).toBe("你好");
    expect(takeBytesAtCharBoundary("你好世界", 9)).toBe("你好世");
    expect(takeBytesAtCharBoundary("你好世界", 12)).toBe("你好世界");
  });

  it("does not break in middle of multi-byte character", () => {
    // If budget is 4 bytes but next char is 3 bytes, should only take 3 bytes
    expect(takeBytesAtCharBoundary("你好", 4)).toBe("你");
    expect(takeBytesAtCharBoundary("你好", 5)).toBe("你");
  });

  it("handles mixed ASCII and multi-byte", () => {
    const text = "hello你好world";
    // 'hello' = 5 bytes
    expect(takeBytesAtCharBoundary(text, 5)).toBe("hello");
    // 'hello' + '你' = 5 + 3 = 8 bytes
    expect(takeBytesAtCharBoundary(text, 8)).toBe("hello你");
    // 'hello' + '你好' = 5 + 6 = 11 bytes
    expect(takeBytesAtCharBoundary(text, 11)).toBe("hello你好");
  });

  it("handles emoji correctly", () => {
    // '😀' is 4 bytes in UTF-8
    expect(takeBytesAtCharBoundary("😀😀", 4)).toBe("😀");
    expect(takeBytesAtCharBoundary("😀😀", 8)).toBe("😀😀");
    expect(takeBytesAtCharBoundary("😀😀", 5)).toBe("😀");
  });

  it("handles zero budget", () => {
    expect(takeBytesAtCharBoundary("hello", 0)).toBe("");
  });
});

describe("takeLastBytesAtCharBoundary", () => {
  it("returns full string when within byte budget", () => {
    expect(takeLastBytesAtCharBoundary("hello", 10)).toBe("hello");
    expect(takeLastBytesAtCharBoundary("hello", 5)).toBe("hello");
  });

  it("returns empty string for empty input", () => {
    expect(takeLastBytesAtCharBoundary("", 10)).toBe("");
  });

  it("takes suffix at char boundary for ASCII", () => {
    expect(takeLastBytesAtCharBoundary("hello world", 5)).toBe("world");
    expect(takeLastBytesAtCharBoundary("hello world", 6)).toBe(" world");
  });

  it("takes suffix at char boundary for multi-byte UTF-8", () => {
    // '你好世界' - each Chinese character is 3 bytes
    expect(takeLastBytesAtCharBoundary("你好世界", 3)).toBe("界");
    expect(takeLastBytesAtCharBoundary("你好世界", 6)).toBe("世界");
    expect(takeLastBytesAtCharBoundary("你好世界", 9)).toBe("好世界");
    expect(takeLastBytesAtCharBoundary("你好世界", 12)).toBe("你好世界");
  });

  it("does not break in middle of multi-byte character", () => {
    // If budget is 4 bytes but next char (from right) is 3 bytes, should only take 3 bytes
    expect(takeLastBytesAtCharBoundary("你好", 4)).toBe("好");
    expect(takeLastBytesAtCharBoundary("你好", 5)).toBe("好");
  });

  it("handles mixed ASCII and multi-byte", () => {
    const text = "hello你好world";
    // 'world' = 5 bytes
    expect(takeLastBytesAtCharBoundary(text, 5)).toBe("world");
    // '好world' = 3 + 5 = 8 bytes
    expect(takeLastBytesAtCharBoundary(text, 8)).toBe("好world");
    // '你好world' = 6 + 5 = 11 bytes
    expect(takeLastBytesAtCharBoundary(text, 11)).toBe("你好world");
  });

  it("handles emoji correctly", () => {
    // '😀' is 4 bytes in UTF-8
    expect(takeLastBytesAtCharBoundary("😀😀", 4)).toBe("😀");
    expect(takeLastBytesAtCharBoundary("😀😀", 8)).toBe("😀😀");
    expect(takeLastBytesAtCharBoundary("😀😀", 5)).toBe("😀");
  });

  it("handles zero budget", () => {
    expect(takeLastBytesAtCharBoundary("hello", 0)).toBe("");
  });
});
