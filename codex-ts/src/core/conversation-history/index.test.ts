/**
 * Tests for conversation history management.
 * Ported from codex-rs/core/src/conversation_history.rs tests
 */

import { describe, it, expect } from "vitest";
import {
  ConversationHistory,
  formatOutputForModelBody,
  MODEL_FORMAT_MAX_BYTES,
  MODEL_FORMAT_MAX_LINES,
} from "./index";
import type { ResponseItem } from "../../protocol/models";

describe("ConversationHistory", () => {
  function assistantMsg(text: string): ResponseItem {
    return {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text }],
    };
  }

  function userMsg(text: string): ResponseItem {
    return {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text }],
    };
  }

  function systemMsg(text: string): ResponseItem {
    return {
      type: "message",
      role: "system",
      content: [{ type: "output_text", text }],
    };
  }

  function reasoningMsg(text: string): ResponseItem {
    return {
      type: "reasoning",
      summary: [{ text: "summary" }],
      content: [{ text }],
    };
  }

  function functionCall(callId: string, name: string): ResponseItem {
    return {
      type: "function_call",
      call_id: callId,
      name,
      arguments: "{}",
    };
  }

  function functionCallOutput(callId: string, content: string): ResponseItem {
    return {
      type: "function_call_output",
      call_id: callId,
      output: { content },
    };
  }

  function customToolCall(callId: string, name: string): ResponseItem {
    return {
      type: "custom_tool_call",
      call_id: callId,
      name,
      input: "{}",
    };
  }

  function customToolCallOutput(callId: string, output: string): ResponseItem {
    return {
      type: "custom_tool_call_output",
      call_id: callId,
      output,
    };
  }

  function localShellCall(callId: string): ResponseItem {
    return {
      type: "local_shell_call",
      call_id: callId,
      status: "pending",
      action: { type: "exec", command: ["ls"] },
    };
  }

  function ghostSnapshot(): ResponseItem {
    return {
      type: "ghost_snapshot",
      ghost_commit: { directory: "/", tree: [] },
    };
  }

  describe("Basic Operations", () => {
    it("should create empty history", () => {
      const history = new ConversationHistory();
      expect(history.getHistory()).toEqual([]);
    });

    it("should record API messages", () => {
      const history = new ConversationHistory();
      history.recordItems([userMsg("hello"), assistantMsg("hi")]);

      const items = history.getHistory();
      expect(items).toHaveLength(2);
      expect(items[0].type).toBe("message");
      expect(items[1].type).toBe("message");
    });

    it("should filter out system messages", () => {
      const history = new ConversationHistory();
      history.recordItems([systemMsg("system prompt"), userMsg("hello")]);

      const items = history.getHistory();
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("message");
      if (items[0].type === "message") {
        expect(items[0].role).toBe("user");
      }
    });

    it("should record reasoning items", () => {
      const history = new ConversationHistory();
      history.recordItems([reasoningMsg("thinking...")]);

      const items = history.getHistory();
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("reasoning");
    });

    it("should record ghost snapshots", () => {
      const history = new ConversationHistory();
      history.recordItems([ghostSnapshot(), userMsg("hello")]);

      const items = history.getHistory();
      expect(items).toHaveLength(2);
      expect(items[0].type).toBe("ghost_snapshot");
    });

    it("should remove ghost snapshots in getHistoryForPrompt", () => {
      const history = new ConversationHistory();
      history.recordItems([
        ghostSnapshot(),
        userMsg("hello"),
        assistantMsg("hi"),
      ]);

      const promptItems = history.getHistoryForPrompt();
      expect(promptItems).toHaveLength(2);
      expect(promptItems.every((i) => i.type !== "ghost_snapshot")).toBe(true);
    });
  });

  describe("Normalization - Missing Outputs", () => {
    it("should synthesize missing function call output", () => {
      const history = new ConversationHistory();
      history.recordItems([functionCall("call-1", "test")]);

      const items = history.getHistory();
      expect(items).toHaveLength(2);
      expect(items[0].type).toBe("function_call");
      expect(items[1].type).toBe("function_call_output");
      if (items[1].type === "function_call_output") {
        expect(items[1].call_id).toBe("call-1");
        expect(items[1].output.content).toBe("aborted");
      }
    });

    it("should synthesize missing custom tool call output", () => {
      const history = new ConversationHistory();
      history.recordItems([customToolCall("call-2", "custom")]);

      const items = history.getHistory();
      expect(items).toHaveLength(2);
      expect(items[0].type).toBe("custom_tool_call");
      expect(items[1].type).toBe("custom_tool_call_output");
      if (items[1].type === "custom_tool_call_output") {
        expect(items[1].call_id).toBe("call-2");
        expect(items[1].output).toBe("aborted");
      }
    });

    it("should synthesize missing local shell call output", () => {
      const history = new ConversationHistory();
      history.recordItems([localShellCall("call-3")]);

      const items = history.getHistory();
      expect(items).toHaveLength(2);
      expect(items[0].type).toBe("local_shell_call");
      expect(items[1].type).toBe("function_call_output");
      if (items[1].type === "function_call_output") {
        expect(items[1].call_id).toBe("call-3");
        expect(items[1].output.content).toBe("aborted");
      }
    });

    it("should not synthesize output if one exists", () => {
      const history = new ConversationHistory();
      history.recordItems([
        functionCall("call-1", "test"),
        functionCallOutput("call-1", "result"),
      ]);

      const items = history.getHistory();
      expect(items).toHaveLength(2);
      if (items[1].type === "function_call_output") {
        expect(items[1].output.content).toBe("result");
      }
    });

    it("should insert synthetic output immediately after call", () => {
      const history = new ConversationHistory();
      history.recordItems([
        functionCall("call-1", "test"),
        userMsg("hello"),
        functionCall("call-2", "test2"),
      ]);

      const items = history.getHistory();
      expect(items).toHaveLength(5); // call1, output1, user, call2, output2
      expect(items[0].type).toBe("function_call");
      expect(items[1].type).toBe("function_call_output");
      expect(items[2].type).toBe("message");
      expect(items[3].type).toBe("function_call");
      expect(items[4].type).toBe("function_call_output");
    });
  });

  describe("Normalization - Orphan Outputs", () => {
    it("should remove orphan function call output", () => {
      const history = new ConversationHistory();
      history.recordItems([functionCallOutput("call-1", "orphan")]);

      const items = history.getHistory();
      expect(items).toHaveLength(0);
    });

    it("should remove orphan custom tool call output", () => {
      const history = new ConversationHistory();
      history.recordItems([customToolCallOutput("call-2", "orphan")]);

      const items = history.getHistory();
      expect(items).toHaveLength(0);
    });

    it("should keep output with matching call", () => {
      const history = new ConversationHistory();
      history.recordItems([
        functionCall("call-1", "test"),
        functionCallOutput("call-1", "result"),
      ]);

      const items = history.getHistory();
      expect(items).toHaveLength(2);
    });

    it("should remove multiple orphan outputs", () => {
      const history = new ConversationHistory();
      history.recordItems([
        functionCallOutput("orphan-1", "result1"),
        userMsg("hello"),
        functionCallOutput("orphan-2", "result2"),
      ]);

      const items = history.getHistory();
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("message");
    });
  });

  describe("removeFirstItem", () => {
    it("should remove oldest item", () => {
      const history = new ConversationHistory();
      history.recordItems([
        userMsg("first"),
        userMsg("second"),
        userMsg("third"),
      ]);

      history.removeFirstItem();

      const items = history.getHistory();
      expect(items).toHaveLength(2);
      if (items[0].type === "message") {
        expect(items[0].content[0]).toEqual({
          type: "input_text",
          text: "second",
        });
      }
    });

    it("should remove paired output when removing call", () => {
      const history = new ConversationHistory();
      history.recordItems([
        functionCall("call-1", "test"),
        functionCallOutput("call-1", "result"),
        userMsg("hello"),
      ]);

      history.removeFirstItem(); // removes function_call

      const items = history.getHistory();
      expect(items).toHaveLength(1); // only user message remains
      expect(items[0].type).toBe("message");
    });

    it("should remove paired call when removing output", () => {
      const history = new ConversationHistory();
      history.recordItems([
        functionCall("call-1", "test"),
        functionCallOutput("call-1", "result"),
        userMsg("hello"),
      ]);

      history.removeFirstItem(); // removes call (and paired output via removeCorrespondingFor)

      const items = history.getHistory();
      expect(items).toHaveLength(1); // only user message
      expect(items[0].type).toBe("message");
    });

    it("should handle empty history", () => {
      const history = new ConversationHistory();
      history.removeFirstItem(); // should not throw

      expect(history.getHistory()).toEqual([]);
    });
  });

  describe("replace", () => {
    it("should replace entire history", () => {
      const history = new ConversationHistory();
      history.recordItems([userMsg("old1"), userMsg("old2")]);

      history.replace([userMsg("new1"), userMsg("new2"), userMsg("new3")]);

      const items = history.getHistory();
      expect(items).toHaveLength(3);
    });
  });

  describe("Token Tracking", () => {
    it("should initialize with no token info", () => {
      const history = new ConversationHistory();
      expect(history.getTokenInfo()).toBeUndefined();
    });

    it("should update token info", () => {
      const history = new ConversationHistory();
      history.updateTokenInfo(
        {
          input_tokens: 100,
          output_tokens: 50,
          cached_input_tokens: 0,
          reasoning_tokens: 0,
        },
        128000,
      );

      const info = history.getTokenInfo();
      expect(info).toBeDefined();
      expect(info?.total_token_usage.input_tokens).toBe(100);
      expect(info?.total_token_usage.output_tokens).toBe(50);
      expect(info?.model_context_window).toBe(128000);
    });

    it("should accumulate token usage", () => {
      const history = new ConversationHistory();
      history.updateTokenInfo(
        {
          input_tokens: 100,
          output_tokens: 50,
          cached_input_tokens: 0,
          reasoning_tokens: 0,
        },
        128000,
      );
      history.updateTokenInfo(
        {
          input_tokens: 200,
          output_tokens: 100,
          cached_input_tokens: 0,
          reasoning_tokens: 0,
        },
        128000,
      );

      const info = history.getTokenInfo();
      expect(info?.total_token_usage.input_tokens).toBe(300);
      expect(info?.total_token_usage.output_tokens).toBe(150);
    });

    it("should set token usage full", () => {
      const history = new ConversationHistory();
      history.setTokenUsageFull(128000);

      const info = history.getTokenInfo();
      expect(info?.total_token_usage.input_tokens).toBe(128000);
      expect(info?.model_context_window).toBe(128000);
    });
  });

  describe("Output Truncation", () => {
    it("should not truncate small output", () => {
      const history = new ConversationHistory();
      history.recordItems([
        functionCall("call-1", "test"),
        functionCallOutput("call-1", "short result"),
      ]);

      const items = history.getHistory();
      const output = items.find((i) => i.type === "function_call_output");
      expect(output).toBeDefined();
      if (output?.type === "function_call_output") {
        expect(output.output.content).toBe("short result");
      }
    });

    it("should truncate large output", () => {
      const history = new ConversationHistory();
      const largeOutput = "x".repeat(MODEL_FORMAT_MAX_BYTES + 1000);
      history.recordItems([
        functionCall("call-1", "test"),
        functionCallOutput("call-1", largeOutput),
      ]);

      const items = history.getHistory();
      const output = items.find((i) => i.type === "function_call_output");
      expect(output).toBeDefined();
      if (output?.type === "function_call_output") {
        expect(output.output.content.length).toBeLessThan(largeOutput.length);
        expect(output.output.content).toContain("Total output lines:");
      }
    });

    it("should truncate output with many lines", () => {
      const history = new ConversationHistory();
      const manyLines = Array(MODEL_FORMAT_MAX_LINES + 100)
        .fill("line")
        .join("\n");
      history.recordItems([
        functionCall("call-1", "test"),
        functionCallOutput("call-1", manyLines),
      ]);

      const items = history.getHistory();
      const output = items.find((i) => i.type === "function_call_output");
      expect(output).toBeDefined();
      if (output?.type === "function_call_output") {
        expect(output.output.content).toContain("Total output lines:");
        expect(output.output.content).toContain("omitted");
      }
    });
  });

  describe("formatOutputForModelBody", () => {
    it("should not modify small output", () => {
      const output = "Hello world";
      const result = formatOutputForModelBody(output);
      expect(result).toBe("Hello world");
    });

    it("should add line count for large output", () => {
      const output = "x".repeat(MODEL_FORMAT_MAX_BYTES + 100);
      const result = formatOutputForModelBody(output);
      expect(result).toContain("Total output lines:");
    });

    it("should show omitted lines marker", () => {
      const lines = Array(MODEL_FORMAT_MAX_LINES + 100).fill("line");
      const output = lines.join("\n");
      const result = formatOutputForModelBody(output);
      expect(result).toContain("omitted");
      expect(result).toContain("lines");
    });

    it("should preserve head and tail", () => {
      const lines = Array(MODEL_FORMAT_MAX_LINES + 100)
        .fill(0)
        .map((_, i) => `line ${i}`);
      const output = lines.join("\n");
      const result = formatOutputForModelBody(output);

      expect(result).toContain("line 0");
      expect(result).toContain(`line ${lines.length - 1}`);
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle mixed messages and tool calls", () => {
      const history = new ConversationHistory();
      history.recordItems([
        userMsg("hello"),
        assistantMsg("thinking..."),
        functionCall("call-1", "test"),
        functionCallOutput("call-1", "result"),
        assistantMsg("done"),
      ]);

      const items = history.getHistory();
      expect(items).toHaveLength(5);
      expect(items.map((i) => i.type)).toEqual([
        "message",
        "message",
        "function_call",
        "function_call_output",
        "message",
      ]);
    });

    it("should handle multiple tool calls", () => {
      const history = new ConversationHistory();
      history.recordItems([
        functionCall("call-1", "tool1"),
        functionCall("call-2", "tool2"),
        functionCallOutput("call-1", "result1"),
        functionCallOutput("call-2", "result2"),
      ]);

      const items = history.getHistory();
      expect(items).toHaveLength(4);
    });

    it("should normalize interleaved calls and outputs", () => {
      const history = new ConversationHistory();
      history.recordItems([
        functionCall("call-1", "tool1"),
        userMsg("waiting"),
        functionCall("call-2", "tool2"),
      ]);

      const items = history.getHistory();
      // Should have: call1, output1, user, call2, output2
      expect(items).toHaveLength(5);
      expect(items[1].type).toBe("function_call_output");
      expect(items[4].type).toBe("function_call_output");
    });
  });
});
