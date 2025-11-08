/**
 * Tests for ResponseItem to TurnItem conversion.
 * Ported from codex-rs/core/src/event_mapping.rs
 */

import { describe, it, expect } from "vitest";
import { parseTurnItem } from "./parse-turn-item";
import type { ResponseItem } from "../../protocol/models";

describe("parseTurnItem", () => {
  describe("user messages", () => {
    it("should parse user message with text content", () => {
      const item: ResponseItem = {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Hello, world!" }],
      };

      const result = parseTurnItem(item);
      expect(result).toBeDefined();
      expect(result?.type).toBe("user_message");
      if (result?.type === "user_message") {
        expect(result.item.content).toHaveLength(1);
        expect(result.item.content[0]).toEqual({
          type: "text",
          text: "Hello, world!",
        });
        expect(result.item.id).toBeDefined();
      }
    });

    it("should parse user message with image content", () => {
      const item: ResponseItem = {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: "Check this image:" },
          { type: "input_image", image_url: "https://example.com/image.png" },
        ],
      };

      const result = parseTurnItem(item);
      expect(result?.type).toBe("user_message");
      if (result?.type === "user_message") {
        expect(result.item.content).toHaveLength(2);
        expect(result.item.content[0]).toEqual({
          type: "text",
          text: "Check this image:",
        });
        expect(result.item.content[1]).toEqual({
          type: "image",
          image_url: "https://example.com/image.png",
        });
      }
    });

    it("should filter out user messages with session prefix", () => {
      const item: ResponseItem = {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: "<!-- session --> Internal message" },
        ],
      };

      const result = parseTurnItem(item);
      expect(result).toBeUndefined();
    });

    it("should filter out empty user messages", () => {
      const item: ResponseItem = {
        type: "message",
        role: "user",
        content: [],
      };

      const result = parseTurnItem(item);
      expect(result).toBeUndefined();
    });
  });

  describe("agent messages", () => {
    it("should parse agent message with text content", () => {
      const item: ResponseItem = {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Here is my response." }],
      };

      const result = parseTurnItem(item);
      expect(result).toBeDefined();
      expect(result?.type).toBe("agent_message");
      if (result?.type === "agent_message") {
        expect(result.item.content).toHaveLength(1);
        expect(result.item.content[0]).toEqual({
          type: "text",
          text: "Here is my response.",
        });
        expect(result.item.id).toBeDefined();
      }
    });

    it("should use provided ID for agent message", () => {
      const item: ResponseItem = {
        type: "message",
        role: "assistant",
        id: "custom-id-123",
        content: [{ type: "output_text", text: "Response" }],
      };

      const result = parseTurnItem(item);
      if (result?.type === "agent_message") {
        expect(result.item.id).toBe("custom-id-123");
      }
    });

    it("should generate ID if not provided for agent message", () => {
      const item: ResponseItem = {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Response" }],
      };

      const result = parseTurnItem(item);
      if (result?.type === "agent_message") {
        expect(result.item.id).toBeDefined();
        expect(typeof result.item.id).toBe("string");
      }
    });
  });

  describe("system messages", () => {
    it("should filter out system messages", () => {
      const item: ResponseItem = {
        type: "message",
        role: "system",
        content: [{ type: "output_text", text: "System prompt" }],
      };

      const result = parseTurnItem(item);
      expect(result).toBeUndefined();
    });
  });

  describe("reasoning items", () => {
    it("should parse reasoning with summary", () => {
      const item: ResponseItem = {
        type: "reasoning",
        summary: [{ text: "I need to analyze this problem" }],
      };

      const result = parseTurnItem(item);
      expect(result).toBeDefined();
      expect(result?.type).toBe("reasoning");
      if (result?.type === "reasoning") {
        expect(result.item.summary_text).toEqual([
          "I need to analyze this problem",
        ]);
        expect(result.item.id).toBeDefined();
      }
    });

    it("should parse reasoning with summary and content", () => {
      const item: ResponseItem = {
        type: "reasoning",
        id: "reasoning-123",
        summary: [{ text: "Summary 1" }, { text: "Summary 2" }],
        content: [
          { text: "Raw reasoning step 1" },
          { text: "Raw reasoning step 2" },
        ],
      };

      const result = parseTurnItem(item);
      if (result?.type === "reasoning") {
        expect(result.item.id).toBe("reasoning-123");
        expect(result.item.summary_text).toEqual(["Summary 1", "Summary 2"]);
        expect(result.item.raw_content).toEqual([
          "Raw reasoning step 1",
          "Raw reasoning step 2",
        ]);
      }
    });

    it("should handle reasoning without content", () => {
      const item: ResponseItem = {
        type: "reasoning",
        summary: [{ text: "Summary" }],
        content: undefined,
      };

      const result = parseTurnItem(item);
      if (result?.type === "reasoning") {
        expect(result.item.summary_text).toEqual(["Summary"]);
        expect(result.item.raw_content).toEqual([]);
      }
    });
  });

  describe("web search items", () => {
    it("should parse web search with query", () => {
      const item: ResponseItem = {
        type: "web_search_call",
        id: "search-123",
        action: { type: "search", query: "TypeScript best practices" },
      };

      const result = parseTurnItem(item);
      expect(result).toBeDefined();
      expect(result?.type).toBe("web_search");
      if (result?.type === "web_search") {
        expect(result.item.id).toBe("search-123");
        expect(result.item.query).toBe("TypeScript best practices");
      }
    });

    it("should filter out web search with other action", () => {
      const item: ResponseItem = {
        type: "web_search_call",
        action: { type: "other" },
      };

      const result = parseTurnItem(item);
      expect(result).toBeUndefined();
    });
  });

  describe("other item types", () => {
    it("should filter out function calls", () => {
      const item: ResponseItem = {
        type: "function_call",
        name: "test",
        arguments: "{}",
        call_id: "call-123",
      };

      const result = parseTurnItem(item);
      expect(result).toBeUndefined();
    });

    it("should filter out function call outputs", () => {
      const item: ResponseItem = {
        type: "function_call_output",
        call_id: "call-123",
        output: { type: "success", content: [] },
      };

      const result = parseTurnItem(item);
      expect(result).toBeUndefined();
    });

    it("should filter out custom tool calls", () => {
      const item: ResponseItem = {
        type: "custom_tool_call",
        call_id: "call-123",
        name: "test_tool",
        input: "{}",
      };

      const result = parseTurnItem(item);
      expect(result).toBeUndefined();
    });

    it("should filter out ghost snapshots", () => {
      const item: ResponseItem = {
        type: "ghost_snapshot",
        ghost_commit: {
          directory: "/",
          tree: [],
        },
      };

      const result = parseTurnItem(item);
      expect(result).toBeUndefined();
    });

    it("should filter out other types", () => {
      const item: ResponseItem = {
        type: "other",
      };

      const result = parseTurnItem(item);
      expect(result).toBeUndefined();
    });
  });
});
