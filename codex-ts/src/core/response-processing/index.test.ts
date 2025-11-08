/**
 * Tests for response processing module.
 * Ported from codex-rs/core/src/response_processing.rs
 */

import { describe, it, expect } from "vitest";
import { processItems, createProcessedItem } from "./index";
import type { ResponseItem, ResponseInputItem } from "../../protocol/models";

describe("response_processing", () => {
  describe("processItems", () => {
    it("should record assistant messages without responses", () => {
      const item: ResponseItem = {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Hello!" }],
      };

      const result = processItems([createProcessedItem(item)]);

      expect(result.itemsToRecord).toHaveLength(1);
      expect(result.itemsToRecord[0]).toEqual(item);
      expect(result.responsesToSend).toHaveLength(0);
    });

    it("should pair function call with output", () => {
      const call: ResponseItem = {
        type: "function_call",
        name: "read_file",
        arguments: '{"path": "test.txt"}',
        call_id: "call-123",
      };

      const response: ResponseInputItem = {
        type: "function_call_output",
        call_id: "call-123",
        output: {
          content: [{ type: "text", text: "File contents" }],
        },
      };

      const result = processItems([createProcessedItem(call, response)]);

      expect(result.itemsToRecord).toHaveLength(2);
      expect(result.itemsToRecord[0]).toEqual(call);
      expect(result.itemsToRecord[1]).toEqual({
        type: "function_call_output",
        call_id: "call-123",
        output: response.output,
      });
      expect(result.responsesToSend).toHaveLength(1);
      expect(result.responsesToSend[0]).toEqual(response);
    });

    it("should pair custom tool call with output", () => {
      const call: ResponseItem = {
        type: "custom_tool_call",
        name: "custom_tool",
        input: '{"param": "value"}',
        call_id: "call-456",
      };

      const response: ResponseInputItem = {
        type: "custom_tool_call_output",
        call_id: "call-456",
        output: "Tool result",
      };

      const result = processItems([createProcessedItem(call, response)]);

      expect(result.itemsToRecord).toHaveLength(2);
      expect(result.itemsToRecord[0]).toEqual(call);
      expect(result.itemsToRecord[1]).toEqual({
        type: "custom_tool_call_output",
        call_id: "call-456",
        output: "Tool result",
      });
      expect(result.responsesToSend).toHaveLength(1);
    });

    it("should pair local shell call with output", () => {
      const call: ResponseItem = {
        type: "local_shell_call",
        call_id: "shell-789",
        status: "pending",
        action: {
          type: "exec",
          command: ["ls", "-la"],
        },
      };

      const response: ResponseInputItem = {
        type: "function_call_output",
        call_id: "shell-789",
        output: {
          content: [{ type: "text", text: "file1.txt\nfile2.txt" }],
        },
      };

      const result = processItems([createProcessedItem(call, response)]);

      expect(result.itemsToRecord).toHaveLength(2);
      expect(result.itemsToRecord[0]).toEqual(call);
      expect(result.itemsToRecord[1].type).toBe("function_call_output");
      expect(result.responsesToSend).toHaveLength(1);
    });

    it("should record reasoning items without responses", () => {
      const item: ResponseItem = {
        type: "reasoning",
        summary: [{ text: "Thinking about this..." }],
        content: [{ text: "Detailed reasoning" }],
      };

      const result = processItems([createProcessedItem(item)]);

      expect(result.itemsToRecord).toHaveLength(1);
      expect(result.itemsToRecord[0]).toEqual(item);
      expect(result.responsesToSend).toHaveLength(0);
    });

    it("should process multiple items", () => {
      const message: ResponseItem = {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Let me check that file" }],
      };

      const call: ResponseItem = {
        type: "function_call",
        name: "read_file",
        arguments: "{}",
        call_id: "call-1",
      };

      const response: ResponseInputItem = {
        type: "function_call_output",
        call_id: "call-1",
        output: { content: [] },
      };

      const reasoning: ResponseItem = {
        type: "reasoning",
        summary: [{ text: "Analyzing..." }],
      };

      const result = processItems([
        createProcessedItem(message),
        createProcessedItem(call, response),
        createProcessedItem(reasoning),
      ]);

      // Should have: message + call + call_output + reasoning = 4 items
      expect(result.itemsToRecord).toHaveLength(4);
      expect(result.responsesToSend).toHaveLength(1);
    });

    it("should handle empty input", () => {
      const result = processItems([]);
      expect(result.itemsToRecord).toHaveLength(0);
      expect(result.responsesToSend).toHaveLength(0);
    });

    it("should preserve call_id matching between calls and outputs", () => {
      const call1: ResponseItem = {
        type: "function_call",
        name: "tool1",
        arguments: "{}",
        call_id: "call-A",
      };

      const call2: ResponseItem = {
        type: "function_call",
        name: "tool2",
        arguments: "{}",
        call_id: "call-B",
      };

      const response1: ResponseInputItem = {
        type: "function_call_output",
        call_id: "call-A",
        output: { content: [{ type: "text", text: "Result A" }] },
      };

      const response2: ResponseInputItem = {
        type: "function_call_output",
        call_id: "call-B",
        output: { content: [{ type: "text", text: "Result B" }] },
      };

      const result = processItems([
        createProcessedItem(call1, response1),
        createProcessedItem(call2, response2),
      ]);

      expect(result.itemsToRecord).toHaveLength(4);

      // Check first pair
      expect(result.itemsToRecord[0]).toEqual(call1);
      const output1 = result.itemsToRecord[1];
      if (output1.type === "function_call_output") {
        expect(output1.call_id).toBe("call-A");
      }

      // Check second pair
      expect(result.itemsToRecord[2]).toEqual(call2);
      const output2 = result.itemsToRecord[3];
      if (output2.type === "function_call_output") {
        expect(output2.call_id).toBe("call-B");
      }
    });

    it("should handle assistant messages with reasoning", () => {
      const message: ResponseItem = {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Based on my reasoning..." }],
      };

      const reasoning: ResponseItem = {
        type: "reasoning",
        id: "reason-1",
        summary: [{ text: "I analyzed the problem" }],
        content: [{ text: "Step 1: Consider X" }],
      };

      const result = processItems([
        createProcessedItem(reasoning),
        createProcessedItem(message),
      ]);

      expect(result.itemsToRecord).toHaveLength(2);
      expect(result.itemsToRecord[0].type).toBe("reasoning");
      expect(result.itemsToRecord[1].type).toBe("message");
    });
  });

  describe("createProcessedItem", () => {
    it("should create item without response", () => {
      const item: ResponseItem = {
        type: "message",
        role: "assistant",
        content: [],
      };

      const processed = createProcessedItem(item);
      expect(processed.item).toEqual(item);
      expect(processed.response).toBeUndefined();
    });

    it("should create item with response", () => {
      const item: ResponseItem = {
        type: "function_call",
        name: "test",
        arguments: "{}",
        call_id: "call-1",
      };

      const response: ResponseInputItem = {
        type: "function_call_output",
        call_id: "call-1",
        output: { content: [] },
      };

      const processed = createProcessedItem(item, response);
      expect(processed.item).toEqual(item);
      expect(processed.response).toEqual(response);
    });
  });
});
