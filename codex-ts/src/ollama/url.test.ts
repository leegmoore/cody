import { describe, it, expect } from "vitest";
import { isOpenAiCompatibleBaseUrl, baseUrlToHostRoot } from "./url.js";

describe("isOpenAiCompatibleBaseUrl", () => {
  it("identifies OpenAI-compatible base URLs", () => {
    expect(isOpenAiCompatibleBaseUrl("http://localhost:11434/v1")).toBe(true);
    expect(isOpenAiCompatibleBaseUrl("http://localhost:11434/v1/")).toBe(true);
    expect(isOpenAiCompatibleBaseUrl("https://api.example.com/v1")).toBe(true);
  });

  it("identifies non-OpenAI-compatible URLs", () => {
    expect(isOpenAiCompatibleBaseUrl("http://localhost:11434")).toBe(false);
    expect(isOpenAiCompatibleBaseUrl("http://localhost:11434/v2")).toBe(false);
    expect(isOpenAiCompatibleBaseUrl("http://localhost:11434/api")).toBe(false);
  });
});

describe("baseUrlToHostRoot", () => {
  it("converts OpenAI-compatible URLs to host root", () => {
    expect(baseUrlToHostRoot("http://localhost:11434/v1")).toBe(
      "http://localhost:11434",
    );
    expect(baseUrlToHostRoot("http://localhost:11434/v1/")).toBe(
      "http://localhost:11434",
    );
    expect(baseUrlToHostRoot("https://api.example.com/v1")).toBe(
      "https://api.example.com",
    );
  });

  it("leaves non-OpenAI URLs unchanged", () => {
    expect(baseUrlToHostRoot("http://localhost:11434")).toBe(
      "http://localhost:11434",
    );
    expect(baseUrlToHostRoot("http://localhost:11434/")).toBe(
      "http://localhost:11434",
    );
  });

  it("handles trailing slashes", () => {
    expect(baseUrlToHostRoot("http://localhost:11434/")).toBe(
      "http://localhost:11434",
    );
    expect(baseUrlToHostRoot("http://localhost:11434///")).toBe(
      "http://localhost:11434",
    );
  });
});
