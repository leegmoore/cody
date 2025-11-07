/**
 * SSE parser tests for Anthropic Messages API
 *
 * Tests parsing of Server-Sent Events from Anthropic streaming responses.
 * Phase 4.2 - Stage 4: SSE Parser (15 tests)
 */

import { describe, it, expect } from "vitest";
import { parseSseStream, createSseStream } from "./sse-parser.js";
import type { AnthropicSseEvent } from "./types.js";

// Import test fixtures
import textOnlyFixture from "./fixtures/text-only.json";
import thinkingTextFixture from "./fixtures/thinking-text.json";
import toolUseFixture from "./fixtures/tool-use.json";

describe("SSE Parser - Stage 4", () => {
  describe("Basic SSE Parsing", () => {
    it("should parse message_start event", async () => {
      const events = [textOnlyFixture[0]];
      const stream = createMockSseStream(events);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe("message_start");
      if (parsed[0].type === "message_start") {
        expect(parsed[0].message.id).toBe("msg_01ABC");
        expect(parsed[0].message.role).toBe("assistant");
        expect(parsed[0].message.usage.input_tokens).toBe(10);
      }
    });

    it("should parse content_block_start event", async () => {
      const events = [textOnlyFixture[1]];
      const stream = createMockSseStream(events);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe("content_block_start");
      if (parsed[0].type === "content_block_start") {
        expect(parsed[0].index).toBe(0);
        expect(parsed[0].content_block.type).toBe("text");
      }
    });

    it("should parse content_block_delta events", async () => {
      const events = textOnlyFixture.slice(2, 5); // Get all 3 text deltas
      const stream = createMockSseStream(events);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      expect(parsed).toHaveLength(3);
      expect(parsed[0].type).toBe("content_block_delta");
      if (
        parsed[0].type === "content_block_delta" &&
        parsed[0].delta.type === "text_delta"
      ) {
        expect(parsed[0].delta.text).toBe("Hello");
      }
      if (
        parsed[1].type === "content_block_delta" &&
        parsed[1].delta.type === "text_delta"
      ) {
        expect(parsed[1].delta.text).toBe(" world");
      }
    });

    it("should parse content_block_stop event", async () => {
      const events = [textOnlyFixture[5]];
      const stream = createMockSseStream(events);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe("content_block_stop");
      if (parsed[0].type === "content_block_stop") {
        expect(parsed[0].index).toBe(0);
      }
    });

    it("should parse message_delta event with usage", async () => {
      const events = [textOnlyFixture[6]];
      const stream = createMockSseStream(events);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe("message_delta");
      if (parsed[0].type === "message_delta") {
        expect(parsed[0].delta.stop_reason).toBe("end_turn");
        expect(parsed[0].usage?.output_tokens).toBe(3);
      }
    });

    it("should parse message_stop event", async () => {
      const events = [textOnlyFixture[7]];
      const stream = createMockSseStream(events);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe("message_stop");
    });
  });

  describe("Complete Stream Parsing", () => {
    it("should parse complete text-only stream", async () => {
      const stream = createMockSseStream(textOnlyFixture);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      expect(parsed).toHaveLength(8);
      expect(parsed.map((e) => e.type)).toEqual([
        "message_start",
        "content_block_start",
        "content_block_delta",
        "content_block_delta",
        "content_block_delta",
        "content_block_stop",
        "message_delta",
        "message_stop",
      ]);
    });

    it("should parse thinking + text stream", async () => {
      const stream = createMockSseStream(thinkingTextFixture);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      expect(parsed.length).toBeGreaterThan(0);

      // Check for thinking content
      const thinkingDelta = parsed.find(
        (e) =>
          e.type === "content_block_delta" &&
          "delta" in e &&
          e.delta.type === "thinking_delta",
      );
      expect(thinkingDelta).toBeDefined();

      // Check for text content
      const textDelta = parsed.find(
        (e) =>
          e.type === "content_block_delta" &&
          "delta" in e &&
          e.delta.type === "text_delta",
      );
      expect(textDelta).toBeDefined();
    });

    it("should parse tool use stream", async () => {
      const stream = createMockSseStream(toolUseFixture);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      // Should have tool_use content_block_start
      const toolStart = parsed.find(
        (e) =>
          e.type === "content_block_start" &&
          "content_block" in e &&
          e.content_block.type === "tool_use",
      );
      expect(toolStart).toBeDefined();

      // Should have input_json_delta events
      const jsonDeltas = parsed.filter(
        (e) =>
          e.type === "content_block_delta" &&
          "delta" in e &&
          e.delta.type === "input_json_delta",
      );
      expect(jsonDeltas.length).toBeGreaterThan(0);

      // Final delta should have stop_reason of tool_use
      const messageDelta = parsed.find((e) => e.type === "message_delta");
      expect(messageDelta).toBeDefined();
      if (messageDelta && messageDelta.type === "message_delta") {
        expect(messageDelta.delta.stop_reason).toBe("tool_use");
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty stream gracefully", async () => {
      const stream = createMockSseStream([]);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      expect(parsed).toHaveLength(0);
    });

    it("should handle ping events (no-op)", async () => {
      const events = [
        {
          event: "ping",
          data: {},
        },
      ];
      const stream = createMockSseStream(events);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe("ping");
    });

    it("should parse error event", async () => {
      const events = [
        {
          event: "error",
          data: {
            error: {
              type: "rate_limit_error",
              message: "Rate limit exceeded",
            },
          },
        },
      ];
      const stream = createMockSseStream(events);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe("error");
      if (parsed[0].type === "error") {
        expect(parsed[0].error.type).toBe("rate_limit_error");
        expect(parsed[0].error.message).toBe("Rate limit exceeded");
      }
    });

    it("should aggregate multi-part JSON deltas for tool input", async () => {
      // Extract just the tool deltas
      const toolDeltas = toolUseFixture.filter(
        (e) => e.event === "content_block_delta",
      );
      const stream = createMockSseStream(toolDeltas);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      expect(parsed).toHaveLength(2);
      // Both should be input_json_delta events
      expect(
        parsed.every(
          (e) =>
            e.type === "content_block_delta" &&
            "delta" in e &&
            e.delta.type === "input_json_delta",
        ),
      ).toBe(true);
    });

    it("should preserve event index information", async () => {
      const events = [
        {
          event: "content_block_start",
          data: {
            index: 5,
            content_block: {
              type: "text",
              text: "",
            },
          },
        },
      ];
      const stream = createMockSseStream(events);

      const parsed = [];
      for await (const event of parseSseStream(stream)) {
        parsed.push(event);
      }

      expect(parsed).toHaveLength(1);
      if (parsed[0].type === "content_block_start") {
        expect(parsed[0].index).toBe(5);
      }
    });
  });
});

/**
 * Helper to create a mock SSE stream from fixture events
 */
function createMockSseStream(events: any[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < events.length) {
        const event = events[index++];
        const eventName = event.event;
        const data = JSON.stringify(event.data);

        // Format as SSE
        const sseText = `event: ${eventName}\ndata: ${data}\n\n`;
        controller.enqueue(encoder.encode(sseText));
      } else {
        controller.close();
      }
    },
  });
}
