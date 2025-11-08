/**
 * Tests for tool-converters module
 *
 * Ported from: codex-rs/core/src/tools/spec.rs
 */

import { describe, it, expect } from "vitest";
import {
  createToolsJsonForResponsesApi,
  createToolsJsonForChatCompletionsApi,
} from "./tool-converters.js";
import type { ToolSpec } from "./client-common.js";

describe("tool-converters", () => {
  describe("createToolsJsonForResponsesApi", () => {
    it("should convert empty tools array", () => {
      const tools: ToolSpec[] = [];
      const result = createToolsJsonForResponsesApi(tools);

      expect(result).toEqual([]);
    });

    it("should convert function tool", () => {
      const tools: ToolSpec[] = [
        {
          type: "function",
          name: "search",
          description: "Search for information",
          strict: true,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
            },
          },
        },
      ];

      const result = createToolsJsonForResponsesApi(tools);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "function",
        name: "search",
        description: "Search for information",
        strict: true,
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
        },
      });
    });

    it("should convert local_shell tool", () => {
      const tools: ToolSpec[] = [
        {
          type: "local_shell",
        },
      ];

      const result = createToolsJsonForResponsesApi(tools);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: "local_shell" });
    });

    it("should convert web_search tool", () => {
      const tools: ToolSpec[] = [
        {
          type: "web_search",
        },
      ];

      const result = createToolsJsonForResponsesApi(tools);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: "web_search" });
    });

    it("should convert custom (freeform) tool", () => {
      const tools: ToolSpec[] = [
        {
          type: "custom",
          name: "apply_patch",
          description: "Apply a patch",
          format: {
            type: "bash_command",
            syntax: "bash",
            definition: "patch definition",
          },
        },
      ];

      const result = createToolsJsonForResponsesApi(tools);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "custom",
        name: "apply_patch",
        description: "Apply a patch",
        format: {
          type: "bash_command",
          syntax: "bash",
          definition: "patch definition",
        },
      });
    });

    it("should convert multiple tools", () => {
      const tools: ToolSpec[] = [
        {
          type: "function",
          name: "search",
          description: "Search",
          strict: false,
          parameters: { type: "object", properties: {} },
        },
        {
          type: "local_shell",
        },
        {
          type: "web_search",
        },
      ];

      const result = createToolsJsonForResponsesApi(tools);

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe("function");
      expect(result[1].type).toBe("local_shell");
      expect(result[2].type).toBe("web_search");
    });
  });

  describe("createToolsJsonForChatCompletionsApi", () => {
    it("should convert empty tools array", () => {
      const tools: ToolSpec[] = [];
      const result = createToolsJsonForChatCompletionsApi(tools);

      expect(result).toEqual([]);
    });

    it("should convert function tool to chat format", () => {
      const tools: ToolSpec[] = [
        {
          type: "function",
          name: "search",
          description: "Search for information",
          strict: true,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
            },
          },
        },
      ];

      const result = createToolsJsonForChatCompletionsApi(tools);

      expect(result).toHaveLength(1);
      // Chat completions format wraps function details
      expect(result[0]).toMatchObject({
        type: "function",
        function: {
          name: "search",
          description: "Search for information",
          strict: true,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
            },
          },
        },
      });
    });

    it("should filter out non-function tools", () => {
      const tools: ToolSpec[] = [
        {
          type: "function",
          name: "search",
          description: "Search",
          strict: false,
          parameters: { type: "object", properties: {} },
        },
        {
          type: "local_shell",
        },
        {
          type: "web_search",
        },
      ];

      const result = createToolsJsonForChatCompletionsApi(tools);

      // Only function tools are included for Chat API
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("function");
      expect(result[0].function.name).toBe("search");
    });

    it("should convert multiple function tools", () => {
      const tools: ToolSpec[] = [
        {
          type: "function",
          name: "search",
          description: "Search",
          strict: false,
          parameters: { type: "object", properties: {} },
        },
        {
          type: "function",
          name: "calculate",
          description: "Calculate",
          strict: true,
          parameters: {
            type: "object",
            properties: {
              expression: { type: "string" },
            },
          },
        },
      ];

      const result = createToolsJsonForChatCompletionsApi(tools);

      expect(result).toHaveLength(2);
      expect(result[0].function.name).toBe("search");
      expect(result[1].function.name).toBe("calculate");
    });
  });
});
