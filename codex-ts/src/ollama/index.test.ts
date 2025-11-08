/**
 * Integration tests for ollama module exports
 */

import { describe, it, expect } from "vitest";
import {
  OllamaClient,
  CliProgressReporter,
  TuiProgressReporter,
  pullEventsFromValue,
  baseUrlToHostRoot,
  isOpenAiCompatibleBaseUrl,
  DEFAULT_OSS_MODEL,
} from "./index.js";

describe("ollama module exports", () => {
  it("should export OllamaClient", () => {
    expect(OllamaClient).toBeDefined();
    expect(typeof OllamaClient).toBe("function");
  });

  it("should export progress reporters", () => {
    expect(CliProgressReporter).toBeDefined();
    expect(TuiProgressReporter).toBeDefined();
    expect(typeof CliProgressReporter).toBe("function");
    expect(typeof TuiProgressReporter).toBe("function");
  });

  it("should export parser utilities", () => {
    expect(pullEventsFromValue).toBeDefined();
    expect(typeof pullEventsFromValue).toBe("function");
  });

  it("should export URL utilities", () => {
    expect(baseUrlToHostRoot).toBeDefined();
    expect(isOpenAiCompatibleBaseUrl).toBeDefined();
    expect(typeof baseUrlToHostRoot).toBe("function");
    expect(typeof isOpenAiCompatibleBaseUrl).toBe("function");
  });

  it("should export DEFAULT_OSS_MODEL constant", () => {
    expect(DEFAULT_OSS_MODEL).toBe("gpt-oss:20b");
  });

  it("should allow creating OllamaClient instance", () => {
    const client = new OllamaClient("http://localhost:11434");
    expect(client).toBeInstanceOf(OllamaClient);
  });

  it("should allow creating progress reporters", () => {
    const cliReporter = new CliProgressReporter();
    const tuiReporter = new TuiProgressReporter();

    expect(cliReporter).toBeInstanceOf(CliProgressReporter);
    expect(tuiReporter).toBeInstanceOf(TuiProgressReporter);
  });

  it("should parse pull events correctly", () => {
    const events = pullEventsFromValue({ status: "downloading" });
    expect(events).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
  });

  it("should detect OpenAI-compatible URLs", () => {
    expect(isOpenAiCompatibleBaseUrl("http://localhost:11434/v1")).toBe(true);
    expect(isOpenAiCompatibleBaseUrl("http://localhost:11434/api")).toBe(false);
  });

  it("should convert base URL to host root", () => {
    // baseUrlToHostRoot only strips /v1, not arbitrary paths
    expect(baseUrlToHostRoot("http://localhost:11434/v1")).toBe(
      "http://localhost:11434",
    );
    expect(baseUrlToHostRoot("http://localhost:11434")).toBe(
      "http://localhost:11434",
    );
  });
});
