/**
 * Tests for core tools module
 */

import { describe, it, expect } from "vitest";
import {
  SandboxablePreference,
  TELEMETRY_PREVIEW_MAX_BYTES,
  TELEMETRY_PREVIEW_MAX_LINES,
  formatExecOutputStr,
  formatExecOutputForModel,
  truncateForPreview,
  type FormattedExecOutput,
} from "./index.js";
import type { ExecToolCallOutput } from "../exec/types.js";

describe("Tool Types", () => {
  it("should export SandboxablePreference enum", () => {
    expect(SandboxablePreference.Auto).toBe("auto");
    expect(SandboxablePreference.Require).toBe("require");
    expect(SandboxablePreference.Forbid).toBe("forbid");
  });

  it("should export telemetry constants", () => {
    expect(TELEMETRY_PREVIEW_MAX_BYTES).toBe(2048);
    expect(TELEMETRY_PREVIEW_MAX_LINES).toBe(64);
  });
});

describe("formatExecOutputStr", () => {
  it("should format normal output", () => {
    const output: ExecToolCallOutput = {
      exitCode: 0,
      stdout: { text: "hello" },
      stderr: { text: "" },
      aggregatedOutput: { text: "hello" },
      durationMs: 123,
      timedOut: false,
    };

    const result = formatExecOutputStr(output);
    expect(result).toBe("hello");
  });

  it("should add timeout message for timed out commands", () => {
    const output: ExecToolCallOutput = {
      exitCode: 124,
      stdout: { text: "" },
      stderr: { text: "" },
      aggregatedOutput: { text: "partial output" },
      durationMs: 5000,
      timedOut: true,
    };

    const result = formatExecOutputStr(output);
    expect(result).toContain("command timed out after 5000 milliseconds");
    expect(result).toContain("partial output");
  });

  it("should handle empty output", () => {
    const output: ExecToolCallOutput = {
      exitCode: 0,
      stdout: { text: "" },
      stderr: { text: "" },
      aggregatedOutput: { text: "" },
      durationMs: 10,
      timedOut: false,
    };

    const result = formatExecOutputStr(output);
    expect(result).toBe("");
  });

  it("should handle multiline output", () => {
    const output: ExecToolCallOutput = {
      exitCode: 0,
      stdout: { text: "line1\nline2\nline3" },
      stderr: { text: "" },
      aggregatedOutput: { text: "line1\nline2\nline3" },
      durationMs: 100,
      timedOut: false,
    };

    const result = formatExecOutputStr(output);
    expect(result).toBe("line1\nline2\nline3");
  });
});

describe("formatExecOutputForModel", () => {
  it("should format output with metadata", () => {
    const output: ExecToolCallOutput = {
      exitCode: 0,
      stdout: { text: "success" },
      stderr: { text: "" },
      aggregatedOutput: { text: "success" },
      durationMs: 1234,
      timedOut: false,
    };

    const result = formatExecOutputForModel(output);
    const parsed: FormattedExecOutput = JSON.parse(result);

    expect(parsed.output).toBe("success");
    expect(parsed.metadata.exitCode).toBe(0);
    expect(parsed.metadata.durationSeconds).toBe(1.2); // rounded to 1 decimal
  });

  it("should round duration to 1 decimal place", () => {
    const output: ExecToolCallOutput = {
      exitCode: 0,
      stdout: { text: "test" },
      stderr: { text: "" },
      aggregatedOutput: { text: "test" },
      durationMs: 1567, // 1.567 seconds
      timedOut: false,
    };

    const result = formatExecOutputForModel(output);
    const parsed: FormattedExecOutput = JSON.parse(result);

    expect(parsed.metadata.durationSeconds).toBe(1.6);
  });

  it("should include timeout message in output", () => {
    const output: ExecToolCallOutput = {
      exitCode: 124,
      stdout: { text: "" },
      stderr: { text: "" },
      aggregatedOutput: { text: "incomplete" },
      durationMs: 10000,
      timedOut: true,
    };

    const result = formatExecOutputForModel(output);
    const parsed: FormattedExecOutput = JSON.parse(result);

    expect(parsed.output).toContain(
      "command timed out after 10000 milliseconds",
    );
    expect(parsed.output).toContain("incomplete");
    expect(parsed.metadata.exitCode).toBe(124);
  });

  it("should handle non-zero exit codes", () => {
    const output: ExecToolCallOutput = {
      exitCode: 42,
      stdout: { text: "" },
      stderr: { text: "error message" },
      aggregatedOutput: { text: "error message" },
      durationMs: 500,
      timedOut: false,
    };

    const result = formatExecOutputForModel(output);
    const parsed: FormattedExecOutput = JSON.parse(result);

    expect(parsed.metadata.exitCode).toBe(42);
    expect(parsed.output).toBe("error message");
  });

  it("should handle very short durations", () => {
    const output: ExecToolCallOutput = {
      exitCode: 0,
      stdout: { text: "fast" },
      stderr: { text: "" },
      aggregatedOutput: { text: "fast" },
      durationMs: 5,
      timedOut: false,
    };

    const result = formatExecOutputForModel(output);
    const parsed: FormattedExecOutput = JSON.parse(result);

    expect(parsed.metadata.durationSeconds).toBe(0);
  });

  it("should handle very long durations", () => {
    const output: ExecToolCallOutput = {
      exitCode: 0,
      stdout: { text: "slow" },
      stderr: { text: "" },
      aggregatedOutput: { text: "slow" },
      durationMs: 123456,
      timedOut: false,
    };

    const result = formatExecOutputForModel(output);
    const parsed: FormattedExecOutput = JSON.parse(result);

    expect(parsed.metadata.durationSeconds).toBe(123.5);
  });
});

describe("truncateForPreview", () => {
  it("should not truncate short text", () => {
    const text = "short text";
    const result = truncateForPreview(text);
    expect(result).toBe("short text");
  });

  it("should truncate by line count", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
    const result = truncateForPreview(lines, 100000, 10);

    const resultLines = result.split("\n");
    expect(resultLines.length).toBe(11); // 10 lines + truncation notice
    expect(result).toContain("[... truncated ...]");
  });

  it("should truncate by byte count", () => {
    const text = "x".repeat(5000);
    const result = truncateForPreview(text, 1000);

    const encoder = new TextEncoder();
    const bytes = encoder.encode(result);
    expect(bytes.length).toBeLessThanOrEqual(1000);
    expect(result).toContain("[... truncated ...]");
  });

  it("should use custom truncation notice", () => {
    const text = "x".repeat(5000);
    const customNotice = "[CUSTOM TRUNCATE]";
    const result = truncateForPreview(text, 1000, 100, customNotice);

    expect(result).toContain(customNotice);
  });

  it("should handle empty text", () => {
    const result = truncateForPreview("");
    expect(result).toBe("");
  });

  it("should handle text with newlines at boundary", () => {
    const lines = Array.from({ length: 5 }, (_, i) => `line ${i}`).join("\n");
    const result = truncateForPreview(lines, 100000, 3);

    expect(result).toContain("line 0");
    expect(result).toContain("line 1");
    expect(result).toContain("line 2");
    expect(result).not.toContain("line 3");
    expect(result).toContain("[... truncated ...]");
  });

  it("should preserve text exactly at limit", () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n");
    const result = truncateForPreview(lines, 100000, 10);

    // Should not add truncation notice if exactly at limit
    expect(result.split("\n").length).toBe(10);
  });

  it("should handle unicode characters", () => {
    const text = "😀".repeat(1000);
    const result = truncateForPreview(text, 100);

    // Should truncate properly without breaking unicode
    const encoder = new TextEncoder();
    const bytes = encoder.encode(result);
    expect(bytes.length).toBeLessThanOrEqual(100);
  });

  it("should prioritize line truncation over byte truncation", () => {
    const lines = Array.from({ length: 100 }, () => "x".repeat(10)).join("\n");
    const result = truncateForPreview(lines, 100000, 5);

    const resultLines = result.split("\n");
    expect(resultLines.length).toBe(6); // 5 lines + truncation notice
  });
});

describe("Integration Tests", () => {
  it("should format and truncate exec output for telemetry", () => {
    const longOutput = "x".repeat(10000);
    const output: ExecToolCallOutput = {
      exitCode: 0,
      stdout: { text: longOutput },
      stderr: { text: "" },
      aggregatedOutput: { text: longOutput },
      durationMs: 1000,
      timedOut: false,
    };

    const formatted = formatExecOutputStr(output);
    const truncated = truncateForPreview(
      formatted,
      TELEMETRY_PREVIEW_MAX_BYTES,
      TELEMETRY_PREVIEW_MAX_LINES,
    );

    const encoder = new TextEncoder();
    const bytes = encoder.encode(truncated);
    expect(bytes.length).toBeLessThanOrEqual(TELEMETRY_PREVIEW_MAX_BYTES);
  });

  it("should handle full workflow: exec -> format -> JSON", () => {
    const output: ExecToolCallOutput = {
      exitCode: 42,
      stdout: { text: "stdout content" },
      stderr: { text: "stderr content" },
      aggregatedOutput: { text: "stdout content\nstderr content" },
      durationMs: 2500,
      timedOut: false,
    };

    const jsonResult = formatExecOutputForModel(output);
    const parsed: FormattedExecOutput = JSON.parse(jsonResult);

    expect(parsed.output).toBe("stdout content\nstderr content");
    expect(parsed.metadata.exitCode).toBe(42);
    expect(parsed.metadata.durationSeconds).toBe(2.5);
  });
});
