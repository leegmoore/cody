/**
 * Transport layer tests for Anthropic Messages API
 *
 * Tests HTTP client with authentication, headers, and error handling.
 * Phase 4.2 - Stage 7: Transport Layer (12 tests)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createAnthropicTransport,
  type TransportOptions,
} from "./transport.js";
import type { MessagesApiRequest } from "./types.js";

describe("Transport Layer - Stage 7", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Header Construction", () => {
    it("should set x-api-key header from config", async () => {
      let capturedHeaders: Headers | undefined;

      global.fetch = vi.fn(async (url, init) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response('{"type":"message"}', { status: 200 });
      }) as any;

      const transport = createAnthropicTransport({
        apiKey: "sk-ant-test123",
      });

      const request: MessagesApiRequest = {
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "test" }],
        stream: true,
      };

      await transport.send(request);

      expect(capturedHeaders?.get("x-api-key")).toBe("sk-ant-test123");
    });

    it("should set anthropic-version header", async () => {
      let capturedHeaders: Headers | undefined;

      global.fetch = vi.fn(async (url, init) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response('{"type":"message"}', { status: 200 });
      }) as any;

      const transport = createAnthropicTransport({
        apiKey: "sk-ant-test",
        anthropicVersion: "2023-06-01",
      });

      const request: MessagesApiRequest = {
        model: "claude-3-5-sonnet-20241022",
        messages: [],
        stream: true,
      };

      await transport.send(request);

      expect(capturedHeaders?.get("anthropic-version")).toBe("2023-06-01");
    });

    it("should set content-type header to application/json", async () => {
      let capturedHeaders: Headers | undefined;

      global.fetch = vi.fn(async (url, init) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response('{"type":"message"}', { status: 200 });
      }) as any;

      const transport = createAnthropicTransport({ apiKey: "test" });

      await transport.send({
        model: "claude-3-5-sonnet-20241022",
        messages: [],
        stream: true,
      });

      expect(capturedHeaders?.get("content-type")).toBe("application/json");
    });

    it("should include beta headers when provided", async () => {
      let capturedHeaders: Headers | undefined;

      global.fetch = vi.fn(async (url, init) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response('{"type":"message"}', { status: 200 });
      }) as any;

      const transport = createAnthropicTransport({
        apiKey: "test",
        beta: ["prompt-caching-2024-07-31"],
      });

      await transport.send({
        model: "claude-3-5-sonnet-20241022",
        messages: [],
        stream: true,
      });

      expect(capturedHeaders?.get("anthropic-beta")).toBe(
        "prompt-caching-2024-07-31",
      );
    });
  });

  describe("Request Construction", () => {
    it("should POST to correct endpoint", async () => {
      let capturedUrl: string | undefined;

      global.fetch = vi.fn(async (url) => {
        capturedUrl = url.toString();
        return new Response('{"type":"message"}', { status: 200 });
      }) as any;

      const transport = createAnthropicTransport({
        apiKey: "test",
        baseUrl: "https://api.anthropic.com",
      });

      await transport.send({
        model: "claude-3-5-sonnet-20241022",
        messages: [],
        stream: true,
      });

      expect(capturedUrl).toBe("https://api.anthropic.com/v1/messages");
    });

    it("should send request body as JSON", async () => {
      let capturedBody: any;

      global.fetch = vi.fn(async (url, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response('{"type":"message"}', { status: 200 });
      }) as any;

      const transport = createAnthropicTransport({ apiKey: "test" });

      const request: MessagesApiRequest = {
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
        max_output_tokens: 1024,
      };

      await transport.send(request);

      expect(capturedBody.model).toBe("claude-3-5-sonnet-20241022");
      expect(capturedBody.messages[0].content).toBe("Hello");
      expect(capturedBody.stream).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should throw error on 401 authentication failure", async () => {
      global.fetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            type: "error",
            error: {
              type: "authentication_error",
              message: "Invalid API key",
            },
          }),
          { status: 401 },
        );
      }) as any;

      const transport = createAnthropicTransport({ apiKey: "bad-key" });

      await expect(
        transport.send({
          model: "claude-3-5-sonnet-20241022",
          messages: [],
          stream: true,
        }),
      ).rejects.toThrow(/authentication/i);
    });

    it("should throw error on 429 rate limit", async () => {
      global.fetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            type: "error",
            error: {
              type: "rate_limit_error",
              message: "Rate limit exceeded",
            },
          }),
          {
            status: 429,
            headers: {
              "anthropic-ratelimit-requests-remaining": "0",
              "retry-after": "60",
            },
          },
        );
      }) as any;

      const transport = createAnthropicTransport({ apiKey: "test" });

      await expect(
        transport.send({
          model: "claude-3-5-sonnet-20241022",
          messages: [],
          stream: true,
        }),
      ).rejects.toThrow(/rate limit/i);
    });

    it("should throw error on 500 server error", async () => {
      global.fetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            type: "error",
            error: {
              type: "api_error",
              message: "Internal server error",
            },
          }),
          { status: 500 },
        );
      }) as any;

      const transport = createAnthropicTransport({ apiKey: "test" });

      await expect(
        transport.send({
          model: "claude-3-5-sonnet-20241022",
          messages: [],
          stream: true,
        }),
      ).rejects.toThrow(/server error|api_error/i);
    });

    it("should handle network errors gracefully", async () => {
      global.fetch = vi.fn(async () => {
        throw new Error("Network failure");
      }) as any;

      const transport = createAnthropicTransport({ apiKey: "test" });

      await expect(
        transport.send({
          model: "claude-3-5-sonnet-20241022",
          messages: [],
          stream: true,
        }),
      ).rejects.toThrow(/network/i);
    });
  });

  describe("Streaming Support", () => {
    it("should return readable stream for streaming requests", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: test\n\n"));
          controller.close();
        },
      });

      global.fetch = vi.fn(async () => {
        return new Response(mockStream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }) as any;

      const transport = createAnthropicTransport({ apiKey: "test" });

      const response = await transport.send({
        model: "claude-3-5-sonnet-20241022",
        messages: [],
        stream: true,
      });

      expect(response.body).toBeDefined();
      expect(response.body).toBeInstanceOf(ReadableStream);
    });
  });

  describe("Configuration", () => {
    it("should use default base URL if not provided", async () => {
      let capturedUrl: string | undefined;

      global.fetch = vi.fn(async (url) => {
        capturedUrl = url.toString();
        return new Response("{}", { status: 200 });
      }) as any;

      const transport = createAnthropicTransport({ apiKey: "test" });

      await transport.send({
        model: "claude-3-5-sonnet-20241022",
        messages: [],
        stream: true,
      });

      expect(capturedUrl).toContain("https://api.anthropic.com");
    });
  });
});
