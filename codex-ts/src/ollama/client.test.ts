/**
 * Tests for OllamaClient
 *
 * Ported from codex-rs/ollama/src/client.rs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OllamaClient } from "./client.js";
import type { PullEvent } from "./parser.js";
import type { PullProgressReporter } from "./pull.js";

describe("OllamaClient", () => {
  // Store original fetch
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe("fromBaseUrl", () => {
    it("should create client and probe server successfully", async () => {
      // Mock successful probe
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const client = await OllamaClient.fromBaseUrl("http://localhost:11434");

      expect(client).toBeInstanceOf(OllamaClient);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:11434/api/tags",
        expect.any(Object),
      );
    });

    it("should throw error when server is not reachable", async () => {
      // Mock failed probe
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      await expect(
        OllamaClient.fromBaseUrl("http://localhost:11434"),
      ).rejects.toThrow(/No running Ollama server/);
    });

    it("should use OpenAI-compatible endpoint for v1 URLs", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await OllamaClient.fromBaseUrl("http://localhost:11434/v1");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:11434/v1/models",
        expect.any(Object),
      );
    });
  });

  describe("fetchModels", () => {
    it("should return list of model names", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          models: [{ name: "llama3.2:3b" }, { name: "mistral" }],
        }),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new OllamaClient("http://localhost:11434");
      const models = await client.fetchModels();

      expect(models).toEqual(["llama3.2:3b", "mistral"]);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:11434/api/tags",
      );
    });

    it("should return empty array when models field is missing", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({}),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new OllamaClient("http://localhost:11434");
      const models = await client.fetchModels();

      expect(models).toEqual([]);
    });

    it("should return empty array on HTTP error", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new OllamaClient("http://localhost:11434");
      const models = await client.fetchModels();

      expect(models).toEqual([]);
    });

    it("should filter out non-string model names", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            { name: "valid" },
            { name: 123 },
            { name: null },
            { other: "field" },
          ],
        }),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new OllamaClient("http://localhost:11434");
      const models = await client.fetchModels();

      expect(models).toEqual(["valid"]);
    });
  });

  describe("pullModelStream", () => {
    it("should stream pull events", async () => {
      const mockBody = {
        getReader: () => {
          let index = 0;
          const lines = [
            '{"status": "pulling manifest"}\n',
            '{"status": "downloading", "digest": "abc", "total": 100, "completed": 50}\n',
            '{"status": "success"}\n',
          ];

          return {
            read: async () => {
              if (index >= lines.length) {
                return { done: true, value: undefined };
              }
              const value = new TextEncoder().encode(lines[index]);
              index++;
              return { done: false, value };
            },
            releaseLock: () => {},
          };
        },
      };

      const mockResponse = {
        ok: true,
        status: 200,
        body: mockBody,
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new OllamaClient("http://localhost:11434");
      const events: PullEvent[] = [];

      for await (const event of client.pullModelStream("llama3.2:3b")) {
        events.push(event);
      }

      // Should have status, chunk_progress, status, and success events
      expect(events.length).toBeGreaterThan(0);
      expect(events[events.length - 1]).toEqual({ type: "success" });
    });

    it("should handle error events", async () => {
      const mockBody = {
        getReader: () => {
          let index = 0;
          const lines = ['{"error": "Model not found"}\n'];

          return {
            read: async () => {
              if (index >= lines.length) {
                return { done: true, value: undefined };
              }
              const value = new TextEncoder().encode(lines[index]);
              index++;
              return { done: false, value };
            },
            releaseLock: () => {},
          };
        },
      };

      const mockResponse = {
        ok: true,
        status: 200,
        body: mockBody,
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new OllamaClient("http://localhost:11434");
      const events: PullEvent[] = [];

      for await (const event of client.pullModelStream("invalid")) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: "error",
        message: "Model not found",
      });
    });

    it("should throw error if pull fails to start", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new OllamaClient("http://localhost:11434");

      await expect(async () => {
        for await (const _ of client.pullModelStream("invalid")) {
          // Should not reach here
        }
      }).rejects.toThrow(/Failed to start pull/);
    });
  });

  describe("pullWithReporter", () => {
    it("should call reporter for each event", async () => {
      const mockBody = {
        getReader: () => {
          let index = 0;
          const lines = [
            '{"status": "downloading"}\n',
            '{"status": "success"}\n',
          ];

          return {
            read: async () => {
              if (index >= lines.length) {
                return { done: true, value: undefined };
              }
              const value = new TextEncoder().encode(lines[index]);
              index++;
              return { done: false, value };
            },
            releaseLock: () => {},
          };
        },
      };

      const mockResponse = {
        ok: true,
        status: 200,
        body: mockBody,
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new OllamaClient("http://localhost:11434");
      const events: PullEvent[] = [];

      const reporter: PullProgressReporter = {
        onEvent: (event: PullEvent) => {
          events.push(event);
        },
      };

      await client.pullWithReporter("llama3.2:3b", reporter);

      // Should have initial status, downloading status, and success
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toEqual({
        type: "status",
        status: "Pulling model llama3.2:3b...",
      });
      expect(events[events.length - 1]).toEqual({ type: "success" });
    });

    it("should throw error on pull failure", async () => {
      const mockBody = {
        getReader: () => {
          let index = 0;
          const lines = ['{"error": "Model not found"}\n'];

          return {
            read: async () => {
              if (index >= lines.length) {
                return { done: true, value: undefined };
              }
              const value = new TextEncoder().encode(lines[index]);
              index++;
              return { done: false, value };
            },
            releaseLock: () => {},
          };
        },
      };

      const mockResponse = {
        ok: true,
        status: 200,
        body: mockBody,
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new OllamaClient("http://localhost:11434");
      const reporter: PullProgressReporter = {
        onEvent: () => {},
      };

      await expect(
        client.pullWithReporter("invalid", reporter),
      ).rejects.toThrow(/Pull failed: Model not found/);
    });

    it("should throw error if stream ends without success", async () => {
      const mockBody = {
        getReader: () => {
          return {
            read: async () => {
              return { done: true, value: undefined };
            },
            releaseLock: () => {},
          };
        },
      };

      const mockResponse = {
        ok: true,
        status: 200,
        body: mockBody,
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new OllamaClient("http://localhost:11434");
      const reporter: PullProgressReporter = {
        onEvent: () => {},
      };

      await expect(client.pullWithReporter("test", reporter)).rejects.toThrow(
        /Pull stream ended unexpectedly/,
      );
    });
  });
});
