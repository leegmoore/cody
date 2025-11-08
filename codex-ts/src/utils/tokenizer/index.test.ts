import { describe, it, expect } from "vitest";
import { Tokenizer, EncodingKind } from "./index.js";

describe("Tokenizer", () => {
  it("cl100k_base roundtrip simple", () => {
    const tok = Tokenizer.new(EncodingKind.Cl100kBase);
    const s = "hello world";
    const ids = tok.encode(s, false);
    // Stable expectation for cl100k_base
    expect(ids).toEqual([15339, 1917]);
    const back = tok.decode(ids);
    expect(back).toBe(s);
  });

  it("preserves whitespace and special tokens flag", () => {
    const tok = Tokenizer.new(EncodingKind.Cl100kBase);
    const s = "This  has   multiple   spaces";
    const idsNoSpecial = tok.encode(s, false);
    const round = tok.decode(idsNoSpecial);
    expect(round).toBe(s);

    // With special tokens allowed, result may be identical for normal text,
    // but the API should still function.
    const idsWithSpecial = tok.encode(s, true);
    const round2 = tok.decode(idsWithSpecial);
    expect(round2).toBe(s);
  });

  it("model mapping builds tokenizer", () => {
    // Choose a long-standing model alias that maps to cl100k_base.
    const tok = Tokenizer.forModel("gpt-5");
    const ids = tok.encode("ok", false);
    const back = tok.decode(ids);
    expect(back).toBe("ok");
  });

  it("unknown model defaults to o200k_base", () => {
    const fallback = Tokenizer.new(EncodingKind.O200kBase);
    const tok = Tokenizer.forModel("does-not-exist");
    const text = "fallback please";
    expect(tok.encode(text, false)).toEqual(fallback.encode(text, false));
  });

  it("count returns token count", () => {
    const tok = Tokenizer.new(EncodingKind.Cl100kBase);
    const s = "hello world";
    const count = tok.count(s);
    expect(count).toBe(2);
  });

  it("try default creates o200k_base tokenizer", () => {
    const tok = Tokenizer.tryDefault();
    const s = "test";
    const count = tok.count(s);
    expect(count).toBeGreaterThan(0);
  });
});
