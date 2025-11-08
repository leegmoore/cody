import { describe, it, expect } from "vitest";
import {
  History,
  HistoryPersistence,
  UriBasedFileOpener,
  defaultHistory,
  getUriScheme,
  createDefaultConfig,
} from "./config";
import { ReasoningSummary } from "../protocol/config-types";

describe("Config", () => {
  describe("History", () => {
    it("should have correct default persistence", () => {
      const history = defaultHistory();
      expect(history.persistence).toBe(HistoryPersistence.SaveAll);
      expect(history.maxBytes).toBeUndefined();
    });

    it("should support SaveAll persistence mode", () => {
      const history: History = {
        persistence: HistoryPersistence.SaveAll,
        maxBytes: undefined,
      };
      expect(history.persistence).toBe(HistoryPersistence.SaveAll);
    });

    it("should support None persistence mode", () => {
      const history: History = {
        persistence: HistoryPersistence.None,
        maxBytes: undefined,
      };
      expect(history.persistence).toBe(HistoryPersistence.None);
    });

    it("should support optional max_bytes", () => {
      const history: History = {
        persistence: HistoryPersistence.SaveAll,
        maxBytes: 1024 * 1024, // 1MB
      };
      expect(history.maxBytes).toBe(1024 * 1024);
    });
  });

  describe("UriBasedFileOpener", () => {
    it("should support VSCode scheme", () => {
      expect(getUriScheme(UriBasedFileOpener.VsCode)).toBe("vscode");
    });

    it("should support VSCode Insiders scheme", () => {
      expect(getUriScheme(UriBasedFileOpener.VsCodeInsiders)).toBe(
        "vscode-insiders",
      );
    });

    it("should support Windsurf scheme", () => {
      expect(getUriScheme(UriBasedFileOpener.Windsurf)).toBe("windsurf");
    });

    it("should support Cursor scheme", () => {
      expect(getUriScheme(UriBasedFileOpener.Cursor)).toBe("cursor");
    });

    it("should return undefined for None", () => {
      expect(getUriScheme(UriBasedFileOpener.None)).toBeUndefined();
    });
  });

  describe("Config defaults", () => {
    it("should create config with required defaults", () => {
      const config = createDefaultConfig(
        "/home/user/.codex",
        "/home/user/project",
      );

      expect(config.codexHome).toBe("/home/user/.codex");
      expect(config.cwd).toBe("/home/user/project");
      expect(config.model).toBe("gpt-5-codex");
      expect(config.reviewModel).toBe("gpt-5-codex");
      expect(config.modelProviderId).toBe("openai");
      expect(config.approvalPolicy).toBe("on-failure");
      expect(config.history.persistence).toBe(HistoryPersistence.SaveAll);
      expect(config.fileOpener).toBe(UriBasedFileOpener.None);
      expect(config.hideAgentReasoning).toBe(false);
      expect(config.showRawAgentReasoning).toBe(false);
      expect(config.modelReasoningSummary).toBe(ReasoningSummary.Auto);
      expect(config.chatgptBaseUrl).toBe("https://chatgpt.com/backend-api/");
    });

    it("should set correct sandbox policy default", () => {
      const config = createDefaultConfig(
        "/home/user/.codex",
        "/home/user/project",
      );

      // Default is read-only policy
      expect(config.sandboxPolicy.mode).toBe("read-only");
    });

    it("should initialize empty MCP servers map", () => {
      const config = createDefaultConfig(
        "/home/user/.codex",
        "/home/user/project",
      );

      expect(config.mcpServers).toEqual(new Map());
    });

    it("should set project doc defaults", () => {
      const config = createDefaultConfig(
        "/home/user/.codex",
        "/home/user/project",
      );

      expect(config.projectDocMaxBytes).toBe(32 * 1024); // 32 KiB
      expect(config.projectDocFallbackFilenames).toEqual([]);
    });
  });

  describe("Config creation with custom values", () => {
    it("should allow custom model", () => {
      const config = createDefaultConfig(
        "/home/user/.codex",
        "/home/user/project",
      );
      config.model = "gpt-4";

      expect(config.model).toBe("gpt-4");
    });

    it("should allow custom approval policy", () => {
      const config = createDefaultConfig(
        "/home/user/.codex",
        "/home/user/project",
      );
      config.approvalPolicy = "never";

      expect(config.approvalPolicy).toBe("never");
    });

    it("should allow disabling history persistence", () => {
      const config = createDefaultConfig(
        "/home/user/.codex",
        "/home/user/project",
      );
      config.history = {
        persistence: HistoryPersistence.None,
        maxBytes: undefined,
      };

      expect(config.history.persistence).toBe(HistoryPersistence.None);
    });
  });

  describe("Config validation", () => {
    it("should require codex_home path", () => {
      expect(() => {
        createDefaultConfig("", "/home/user/project");
      }).toThrow();
    });

    it("should require cwd path", () => {
      expect(() => {
        createDefaultConfig("/home/user/.codex", "");
      }).toThrow();
    });
  });
});
