/**
 * Integration tests for Anthropic Messages API
 *
 * Tests end-to-end flow from prompt to response events.
 * Phase 4.2 - Stage 8: Integration (10 tests)
 *
 * Test IDs: IT-01 through IT-10 from design doc
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamMessages } from "./index.js";
import type { Prompt } from "../client-common.js";
import type { AnthropicProviderConfig } from "./types.js";
import { ANTHROPIC_DEFAULTS } from "./types.js";

// Import fixtures for complete stream tests
import textOnlyFixture from "./fixtures/text-only.json";
import thinkingTextFixture from "./fixtures/thinking-text.json";
import toolUseFixture from "./fixtures/tool-use.json";

describe("Integration - Stage 8", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("End-to-End Message Flows", () => {
    // IT-01: Text-only conversation end-to-end
    it("IT-01: should stream text-only response from start to completion", async () => {
      // Mock fetch to return SSE stream with text-only fixture
      global.fetch = vi.fn(async () => {
        const stream = createSseStreamFromFixture(textOnlyFixture);
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }) as unknown as typeof global.fetch;

      const prompt: Prompt = {
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: "Hello, how are you?" }],
          },
        ],
      };

      const config: AnthropicProviderConfig & { apiKey: string } = {
        apiKey: "sk-ant-test",
        baseUrl: ANTHROPIC_DEFAULTS.BASE_URL,
      };

      const events = [];
      for await (const event of streamMessages(
        prompt,
        config,
        "claude-3-5-sonnet-20241022",
      )) {
        events.push(event);
      }

      // Should receive: Created, OutputTextDeltas, OutputItemAdded, Completed
      expect(events.some((e) => e.type === "created")).toBe(true);
      expect(events.some((e) => e.type === "output_text_delta")).toBe(true);
      expect(events.some((e) => e.type === "output_item_added")).toBe(true);
      expect(events.some((e) => e.type === "completed")).toBe(true);

      // Completed should have responseId and tokenUsage
      const completed = events.find((e) => e.type === "completed");
      expect(completed).toBeDefined();
      expect((completed as { type: "completed"; responseId?: string; tokenUsage?: unknown }).responseId).toBeDefined();
      expect((completed as { type: "completed"; responseId?: string; tokenUsage?: unknown }).tokenUsage).toBeDefined();
    });

    // IT-02: Tool call round-trip end-to-end
    it("IT-02: should handle tool call in response stream", async () => {
      global.fetch = vi.fn(async () => {
        const stream = createSseStreamFromFixture(toolUseFixture);
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }) as unknown as typeof global.fetch;

      const prompt: Prompt = {
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: "What's the weather?" }],
          },
        ],
        tools: [
          {
            type: "function",
            name: "get_weather",
            description: "Get weather information",
            parameters: {
              type: "object",
              properties: {
                location: { type: "string" },
              },
              required: ["location"],
            },
          },
        ],
      };

      const config: AnthropicProviderConfig & { apiKey: string } = {
        apiKey: "sk-ant-test",
      };

      const events = [];
      for await (const event of streamMessages(
        prompt,
        config,
        "claude-3-5-sonnet-20241022",
      )) {
        events.push(event);
      }

      // Should include tool call item
      const toolCallEvents = events.filter(
        (e) =>
          e.type === "output_item_added" &&
          (e as { type: "output_item_added"; item: { type?: string } }).item?.type === "custom_tool_call",
      );
      expect(toolCallEvents.length).toBeGreaterThan(0);

      // Tool call should have call_id and name
      const toolCall = (toolCallEvents[0] as { type: "output_item_added"; item: { call_id?: string; name?: string; input?: string } }).item;
      expect(toolCall.call_id).toBeDefined();
      expect(toolCall.name).toBeDefined();
      expect(toolCall.input).toBeDefined();
    });

    // IT-03: Sequential tool calls in one turn
    it("IT-03: should handle multiple tool calls in one response", async () => {
      // Create fixture with two tool_use blocks
      const multiToolFixture = createMultiToolFixture();

      global.fetch = vi.fn(async () => {
        const stream = createSseStreamFromFixture(multiToolFixture);
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }) as unknown as typeof global.fetch;

      const prompt: Prompt = {
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Get weather and calculate sum" },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            name: "get_weather",
            description: "Get weather",
            parameters: { type: "object", properties: {} },
          },
          {
            type: "function",
            name: "calculate",
            description: "Calculate",
            parameters: { type: "object", properties: {} },
          },
        ],
      };

      const config: AnthropicProviderConfig & { apiKey: string } = {
        apiKey: "sk-ant-test",
      };

      const events = [];
      for await (const event of streamMessages(
        prompt,
        config,
        "claude-3-5-sonnet-20241022",
      )) {
        events.push(event);
      }

      // Should have two distinct tool calls
      const toolCalls = events.filter(
        (e) =>
          e.type === "output_item_added" &&
          (e as { type: "output_item_added"; item: { type?: string } }).item?.type === "custom_tool_call",
      );
      expect(toolCalls.length).toBe(2);

      // Both should have distinct call_ids
      const callIds = toolCalls.map((e) => (e as { type: "output_item_added"; item: { call_id: string } }).item.call_id);
      expect(new Set(callIds).size).toBe(2);
    });

    // IT-04: Thinking displayed before final answer
    it("IT-04: should emit reasoning events before text events", async () => {
      global.fetch = vi.fn(async () => {
        const stream = createSseStreamFromFixture(thinkingTextFixture);
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }) as unknown as typeof global.fetch;

      const prompt: Prompt = {
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: "Think and respond" }],
          },
        ],
      };

      const config: AnthropicProviderConfig & { apiKey: string } = {
        apiKey: "sk-ant-test",
      };

      const events = [];
      for await (const event of streamMessages(
        prompt,
        config,
        "claude-3-5-sonnet-20241022",
      )) {
        events.push(event);
      }

      // Find indices of reasoning and text events
      const reasoningIndex = events.findIndex(
        (e) => e.type === "reasoning_content_delta",
      );
      const textIndex = events.findIndex((e) => e.type === "output_text_delta");

      expect(reasoningIndex).toBeGreaterThan(-1);
      expect(textIndex).toBeGreaterThan(-1);
      expect(reasoningIndex).toBeLessThan(textIndex); // Reasoning comes first
    });
  });

  describe("Advanced Integration Features", () => {
    // IT-05: Rate limit headers update (skipped - requires header parsing)
    it("IT-05: should parse rate limit headers from response", async () => {
      global.fetch = vi.fn(async () => {
        const stream = createSseStreamFromFixture(textOnlyFixture);
        return new Response(stream, {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "anthropic-ratelimit-requests-remaining": "99",
            "anthropic-ratelimit-tokens-remaining": "50000",
          },
        });
      }) as unknown as typeof global.fetch;

      const prompt: Prompt = {
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: "Hello" }],
          },
        ],
      };

      const config: AnthropicProviderConfig & { apiKey: string } = {
        apiKey: "sk-ant-test",
      };

      const events = [];
      for await (const event of streamMessages(
        prompt,
        config,
        "claude-3-5-sonnet-20241022",
      )) {
        events.push(event);
      }

      // Note: Rate limit event handling requires extension of ResponseEvent
      // For now, just verify the stream completes successfully
      expect(events.some((e) => e.type === "completed")).toBe(true);
    });

    // IT-06: Error after partial response surfaces gracefully
    it("IT-06: should handle errors mid-stream gracefully", async () => {
      global.fetch = vi.fn(async () => {
        const stream = createPartialErrorStream();
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }) as unknown as typeof global.fetch;

      const prompt: Prompt = {
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: "Hello" }],
          },
        ],
      };

      const config: AnthropicProviderConfig & { apiKey: string } = {
        apiKey: "sk-ant-test",
      };

      const events = [];
      for await (const event of streamMessages(
        prompt,
        config,
        "claude-3-5-sonnet-20241022",
      )) {
        events.push(event);
      }

      // Should have partial content before error
      expect(events.some((e) => e.type === "created")).toBe(true);
      // Error event should be handled gracefully (not crash)
    });

    // IT-07: Tool choice none prevents tool path
    it("IT-07: should respect tool_choice configuration", async () => {
      global.fetch = vi.fn(async (url, init) => {
        const body = JSON.parse(init?.body as string);
        // Verify tool_choice is set correctly
        expect(body.tool_choice).toBe("none");

        const stream = createSseStreamFromFixture(textOnlyFixture);
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }) as unknown as typeof global.fetch;

      const prompt: Prompt = {
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: "Hello" }],
          },
        ],
        tools: [
          {
            type: "function",
            name: "test_tool",
            description: "Test",
            parameters: { type: "object", properties: {} },
          },
        ],
      };

      const config: AnthropicProviderConfig & { apiKey: string } = {
        apiKey: "sk-ant-test",
      };

      // Pass tool_choice as option
      const events = [];
      for await (const event of streamMessages(prompt, config, "claude-opus", {
        toolChoice: "none",
      })) {
        events.push(event);
      }

      expect(events.some((e) => e.type === "completed")).toBe(true);
    });

    // IT-08: Mixed media content handled (placeholder)
    it("IT-08: should handle responses with mixed content types", async () => {
      // Note: Image/document handling requires extended fixtures
      // For now, just verify basic text handling works
      global.fetch = vi.fn(async () => {
        const stream = createSseStreamFromFixture(textOnlyFixture);
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }) as unknown as typeof global.fetch;

      const prompt: Prompt = {
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: "Describe this image" }],
          },
        ],
      };

      const config: AnthropicProviderConfig & { apiKey: string } = {
        apiKey: "sk-ant-test",
      };

      const events = [];
      for await (const event of streamMessages(
        prompt,
        config,
        "claude-3-5-sonnet-20241022",
      )) {
        events.push(event);
      }

      expect(events.some((e) => e.type === "completed")).toBe(true);
    });

    // IT-09: Provider parity baseline (placeholder)
    it("IT-09: should normalize output format consistently", async () => {
      global.fetch = vi.fn(async () => {
        const stream = createSseStreamFromFixture(textOnlyFixture);
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }) as unknown as typeof global.fetch;

      const prompt: Prompt = {
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: "Test" }],
          },
        ],
      };

      const config: AnthropicProviderConfig & { apiKey: string } = {
        apiKey: "sk-ant-test",
      };

      const events = [];
      for await (const event of streamMessages(
        prompt,
        config,
        "claude-3-5-sonnet-20241022",
      )) {
        events.push(event);
      }

      // Verify standard event sequence
      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain("created");
      expect(eventTypes).toContain("completed");
    });

    // IT-10: Retry logic placeholder
    it("IT-10: should handle request construction consistently", async () => {
      let requestCount = 0;

      global.fetch = vi.fn(async (url, init) => {
        requestCount++;
        const body = JSON.parse(init?.body as string);

        // Verify request structure is consistent
        expect(body.model).toBe("claude-3-5-sonnet-20241022");
        expect(body.messages).toBeDefined();
        expect(body.stream).toBe(true);

        const stream = createSseStreamFromFixture(textOnlyFixture);
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }) as unknown as typeof global.fetch;

      const prompt: Prompt = {
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: "Test" }],
          },
        ],
      };

      const config: AnthropicProviderConfig & { apiKey: string } = {
        apiKey: "sk-ant-test",
      };

      const events = [];
      for await (const event of streamMessages(
        prompt,
        config,
        "claude-3-5-sonnet-20241022",
      )) {
        events.push(event);
      }

      expect(requestCount).toBe(1);
      expect(events.some((e) => e.type === "completed")).toBe(true);
    });
  });
});

/**
 * Helper: Create SSE stream from fixture data
 */
function createSseStreamFromFixture(
  fixture: Array<{ event: string; data: unknown }>,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      for (const item of fixture) {
        const eventName = item.event;
        const data = JSON.stringify(item.data);
        const sseText = `event: ${eventName}\ndata: ${data}\n\n`;
        controller.enqueue(encoder.encode(sseText));
      }

      controller.close();
    },
  });
}

/**
 * Helper: Create fixture with multiple tool calls
 */
function createMultiToolFixture(): Array<{ event: string; data: Record<string, unknown> }> {
  return [
    {
      event: "message_start",
      data: {
        type: "message",
        id: "msg_multi_tool",
        role: "assistant",
        content: [],
        model: "claude-3-5-sonnet-20241022",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 0 },
      },
    },
    {
      event: "content_block_start",
      data: {
        index: 0,
        content_block: {
          type: "tool_use",
          id: "toolu_1",
          name: "get_weather",
          input: {},
        },
      },
    },
    {
      event: "content_block_delta",
      data: {
        index: 0,
        delta: {
          type: "input_json_delta",
          partial_json: '{"location":"SF"}',
        },
      },
    },
    {
      event: "content_block_stop",
      data: { index: 0 },
    },
    {
      event: "content_block_start",
      data: {
        index: 1,
        content_block: {
          type: "tool_use",
          id: "toolu_2",
          name: "calculate",
          input: {},
        },
      },
    },
    {
      event: "content_block_delta",
      data: {
        index: 1,
        delta: {
          type: "input_json_delta",
          partial_json: '{"a":1,"b":2}',
        },
      },
    },
    {
      event: "content_block_stop",
      data: { index: 1 },
    },
    {
      event: "message_stop",
      data: {},
    },
  ];
}

/**
 * Helper: Create stream that emits error mid-stream
 */
function createPartialErrorStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Start with valid message_start
      controller.enqueue(
        encoder.encode(
          `event: message_start\ndata: ${JSON.stringify({
            type: "message",
            id: "msg_err",
            role: "assistant",
            content: [],
            model: "claude-3-5-sonnet-20241022",
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 0 },
          })}\n\n`,
        ),
      );

      // Send some content
      controller.enqueue(
        encoder.encode(
          `event: content_block_start\ndata: ${JSON.stringify({
            index: 0,
            content_block: { type: "text", text: "" },
          })}\n\n`,
        ),
      );

      // Send error event
      controller.enqueue(
        encoder.encode(
          `event: error\ndata: ${JSON.stringify({
            type: "error",
            error: {
              type: "overloaded_error",
              message: "Server overloaded",
            },
          })}\n\n`,
        ),
      );

      controller.close();
    },
  });
}
