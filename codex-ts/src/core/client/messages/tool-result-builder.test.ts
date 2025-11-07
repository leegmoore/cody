/**
 * Tests for tool result builder
 *
 * Phase 4.2 - Stage 9: Tool Round-Trip
 * Test IDs: TC-13 through TC-23 from design doc
 */

import { describe, it, expect } from "vitest";
import {
  buildToolResult,
  buildToolResultMessage,
  appendToolResults,
  type ToolExecutionResult,
} from "./tool-result-builder.js";

describe("Tool Result Builder - Stage 9", () => {
  describe("Basic Result Formatting", () => {
    // TC-13: Tool result marshaler formats success
    it("TC-13: should format successful string output", () => {
      const result: ToolExecutionResult = {
        toolUseId: "toolu_123",
        output: "Operation completed successfully",
        isError: false,
      };

      const toolResult = buildToolResult(result);

      expect(toolResult.type).toBe("tool_result");
      expect(toolResult.tool_use_id).toBe("toolu_123");
      expect(toolResult.content).toBe("Operation completed successfully");
      expect(toolResult.is_error).toBeUndefined();
    });

    // TC-14: Tool result marshaler formats JSON output
    it("TC-14: should format JSON object output", () => {
      const result: ToolExecutionResult = {
        toolUseId: "toolu_456",
        output: {
          status: "success",
          data: { temperature: 72, humidity: 65 },
          timestamp: "2025-11-07T00:00:00Z",
        },
      };

      const toolResult = buildToolResult(result);

      expect(toolResult.type).toBe("tool_result");
      expect(toolResult.tool_use_id).toBe("toolu_456");

      // Should be valid JSON string
      const parsed = JSON.parse(toolResult.content as string);
      expect(parsed.status).toBe("success");
      expect(parsed.data.temperature).toBe(72);
      expect((toolResult as any).mime_type).toBe("application/json");
    });

    // TC-15: Tool result marshaler flags error status
    it("TC-15: should flag error status when tool fails", () => {
      const result: ToolExecutionResult = {
        toolUseId: "toolu_789",
        output: "Error: File not found",
        isError: true,
      };

      const toolResult = buildToolResult(result);

      expect(toolResult.type).toBe("tool_result");
      expect(toolResult.is_error).toBe(true);
      expect(toolResult.content).toBe("Error: File not found");
    });

    // TC-16: Tool result marshaler handles binary data
    it("TC-16: should base64 encode binary output", () => {
      const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
      const result: ToolExecutionResult = {
        toolUseId: "toolu_binary",
        output: binaryData,
      };

      const toolResult = buildToolResult(result);

      expect(toolResult.type).toBe("tool_result");
      expect(toolResult.content).toBe("iVBORw=="); // Base64 of PNG header
      expect((toolResult as any).mime_type).toBe("application/octet-stream");
    });
  });

  describe("Tool Round-Trip", () => {
    // TC-17: Tool round-trip attaches call_id
    it("TC-17: should preserve tool_use_id in round-trip", () => {
      const originalToolUseId = "toolu_roundtrip_123";
      const result: ToolExecutionResult = {
        toolUseId: originalToolUseId,
        output: "Result data",
      };

      const toolResult = buildToolResult(result);

      expect(toolResult.tool_use_id).toBe(originalToolUseId);
    });

    // TC-18: Tool round-trip updates Prompt history
    it("TC-18: should append tool results to prompt history", () => {
      const initialPrompt = [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Use the weather tool" }],
        },
      ];

      const assistantMessage = {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "custom_tool_call",
            call_id: "toolu_weather",
            name: "get_weather",
            input: '{"location":"SF"}',
          },
        ],
      };

      const toolResults: ToolExecutionResult[] = [
        {
          toolUseId: "toolu_weather",
          output: "Temperature: 72°F, Sunny",
        },
      ];

      const updated = appendToolResults(
        initialPrompt,
        assistantMessage,
        toolResults,
      );

      // Should have 3 messages: user, assistant, user (with tool result)
      expect(updated.length).toBe(3);
      expect(updated[0].role).toBe("user");
      expect(updated[1].role).toBe("assistant");
      expect(updated[2].role).toBe("user");
      expect(updated[2].content[0].type).toBe("tool_result");
      expect(updated[2].content[0].tool_use_id).toBe("toolu_weather");
    });

    // TC-21: Parallel tool requests queued sequentially
    it("TC-21: should handle multiple tool results in order", () => {
      const results: ToolExecutionResult[] = [
        { toolUseId: "toolu_1", output: "Result 1" },
        { toolUseId: "toolu_2", output: "Result 2" },
        { toolUseId: "toolu_3", output: "Result 3" },
      ];

      const message = buildToolResultMessage(results);

      expect(message.role).toBe("user");
      expect(message.content).toHaveLength(3);
      expect((message.content[0] as any).tool_use_id).toBe("toolu_1");
      expect((message.content[1] as any).tool_use_id).toBe("toolu_2");
      expect((message.content[2] as any).tool_use_id).toBe("toolu_3");
    });
  });

  describe("Size Limits and Edge Cases", () => {
    // TC-22: Tool result size limits enforced
    it("TC-22: should truncate large outputs", () => {
      // Create output larger than 32KB
      const largeOutput = "x".repeat(40 * 1024); // 40KB
      const result: ToolExecutionResult = {
        toolUseId: "toolu_large",
        output: largeOutput,
      };

      const toolResult = buildToolResult(result);

      // Should be truncated to ~32KB
      expect(toolResult.content.length).toBeLessThan(33 * 1024);
      expect(toolResult.content).toContain(
        "[... output truncated due to size limit ...]",
      );
      expect((toolResult as any).was_truncated).toBe(true);
    });

    // TC-23: Tool result error surfaces
    it("TC-23: should preserve error information in result", () => {
      const result: ToolExecutionResult = {
        toolUseId: "toolu_error",
        output: "Exception: Invalid argument\nStack trace: ...",
        isError: true,
      };

      const toolResult = buildToolResult(result);

      expect(toolResult.is_error).toBe(true);
      expect(toolResult.content).toContain("Exception");
      expect(toolResult.content).toContain("Stack trace");
    });

    it("should handle empty output", () => {
      const result: ToolExecutionResult = {
        toolUseId: "toolu_empty",
        output: "",
      };

      const toolResult = buildToolResult(result);

      expect(toolResult.type).toBe("tool_result");
      expect(toolResult.content).toBe("");
    });

    it("should handle numeric output by converting to string", () => {
      const result: ToolExecutionResult = {
        toolUseId: "toolu_num",
        output: 42 as any,
      };

      const toolResult = buildToolResult(result);

      expect(toolResult.content).toBe("42");
    });

    it("should handle nested JSON structures", () => {
      const result: ToolExecutionResult = {
        toolUseId: "toolu_nested",
        output: {
          level1: {
            level2: {
              level3: {
                value: "deep",
              },
            },
          },
        },
      };

      const toolResult = buildToolResult(result);

      const parsed = JSON.parse(toolResult.content as string);
      expect(parsed.level1.level2.level3.value).toBe("deep");
    });
  });

  describe("Message Building", () => {
    it("should build user message with single tool result", () => {
      const results: ToolExecutionResult[] = [
        { toolUseId: "toolu_single", output: "Success" },
      ];

      const message = buildToolResultMessage(results);

      expect(message.role).toBe("user");
      expect(message.content).toHaveLength(1);
      expect((message.content[0] as any).type).toBe("tool_result");
    });

    it("should build user message with multiple tool results", () => {
      const results: ToolExecutionResult[] = [
        { toolUseId: "toolu_a", output: "Result A" },
        { toolUseId: "toolu_b", output: { data: "B" } },
        { toolUseId: "toolu_c", output: "Error C", isError: true },
      ];

      const message = buildToolResultMessage(results);

      expect(message.role).toBe("user");
      expect(message.content).toHaveLength(3);

      // Check each result
      const blocks = message.content as any[];
      expect(blocks[0].tool_use_id).toBe("toolu_a");
      expect(blocks[1].tool_use_id).toBe("toolu_b");
      expect(blocks[2].tool_use_id).toBe("toolu_c");
      expect(blocks[2].is_error).toBe(true);
    });

    it("should handle mix of successful and failed tool results", () => {
      const results: ToolExecutionResult[] = [
        { toolUseId: "toolu_ok", output: "OK" },
        { toolUseId: "toolu_fail", output: "Failed", isError: true },
        { toolUseId: "toolu_ok2", output: "Also OK" },
      ];

      const message = buildToolResultMessage(results);

      expect(message.content).toHaveLength(3);
      const blocks = message.content as any[];
      expect(blocks[0].is_error).toBeUndefined();
      expect(blocks[1].is_error).toBe(true);
      expect(blocks[2].is_error).toBeUndefined();
    });
  });
});
