/**
 * Tests for message history persistence.
 *
 * Tests the append-only message history file at ~/.codex/history.jsonl
 * including atomic writes, file locking, and lookup operations.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import {
  appendEntry,
  historyMetadata,
  lookup,
  readAllEntries,
  clearHistory,
  type HistoryEntry,
} from "./message-history.js";
import { Config } from "./config.js";
import { HistoryPersistence } from "./config.js";
import { ConversationId } from "../protocol/conversation-id/index.js";

describe("message-history", () => {
  let testConfig: Config;
  let testCodexHome: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testCodexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));

    // Create a minimal test config
    testConfig = {
      codexHome: testCodexHome,
      history: {
        persistence: HistoryPersistence.SaveAll,
        maxBytes: undefined,
      },
    } as Config;
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testCodexHome, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("appendEntry", () => {
    it("should create history file if it does not exist", async () => {
      const conversationId = ConversationId.new();
      const text = "Hello, world!";

      await appendEntry(text, conversationId, testConfig);

      const historyPath = path.join(testCodexHome, "history.jsonl");
      const exists = await fs
        .access(historyPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });

    it("should append entry with correct format", async () => {
      const conversationId = ConversationId.new();
      const text = "Test message";

      await appendEntry(text, conversationId, testConfig);

      const entries = await readAllEntries(testConfig);
      expect(entries).toHaveLength(1);

      const entry = entries[0];
      expect(entry.session_id).toBe(conversationId.toString());
      expect(entry.text).toBe(text);
      expect(entry.ts).toBeGreaterThan(0);
      expect(typeof entry.ts).toBe("number");
    });

    it("should append multiple entries sequentially", async () => {
      const conversationId = ConversationId.new();
      const messages = ["First message", "Second message", "Third message"];

      for (const msg of messages) {
        await appendEntry(msg, conversationId, testConfig);
      }

      const entries = await readAllEntries(testConfig);
      expect(entries).toHaveLength(3);

      entries.forEach((entry, idx) => {
        expect(entry.text).toBe(messages[idx]);
        expect(entry.session_id).toBe(conversationId.toString());
      });
    });

    it("should handle different conversation IDs", async () => {
      const conversationId1 = ConversationId.new();
      const conversationId2 = ConversationId.new();

      await appendEntry("Message from conv 1", conversationId1, testConfig);
      await appendEntry("Message from conv 2", conversationId2, testConfig);

      const entries = await readAllEntries(testConfig);
      expect(entries).toHaveLength(2);

      expect(entries[0].session_id).toBe(conversationId1.toString());
      expect(entries[1].session_id).toBe(conversationId2.toString());
    });

    it("should not write when persistence is None", async () => {
      const noPersistConfig = {
        ...testConfig,
        history: {
          persistence: HistoryPersistence.None,
          maxBytes: undefined,
        },
      };

      const conversationId = ConversationId.new();
      await appendEntry("Should not be saved", conversationId, noPersistConfig);

      const entries = await readAllEntries(noPersistConfig);
      expect(entries).toHaveLength(0);
    });

    it("should create parent directory if needed", async () => {
      const deepConfig = {
        ...testConfig,
        codexHome: path.join(testCodexHome, "deep", "nested", "path"),
      };

      const conversationId = ConversationId.new();
      await appendEntry("Test", conversationId, deepConfig);

      const entries = await readAllEntries(deepConfig);
      expect(entries).toHaveLength(1);
    });

    it("should handle special characters in text", async () => {
      const conversationId = ConversationId.new();
      const specialText = 'Special chars: "quotes", newlines\nand\ttabs';

      await appendEntry(specialText, conversationId, testConfig);

      const entries = await readAllEntries(testConfig);
      expect(entries).toHaveLength(1);
      expect(entries[0].text).toBe(specialText);
    });

    it("should handle empty text", async () => {
      const conversationId = ConversationId.new();
      await appendEntry("", conversationId, testConfig);

      const entries = await readAllEntries(testConfig);
      expect(entries).toHaveLength(1);
      expect(entries[0].text).toBe("");
    });

    it("should set correct Unix timestamp", async () => {
      const conversationId = ConversationId.new();
      const beforeTs = Math.floor(Date.now() / 1000);

      await appendEntry("Timestamp test", conversationId, testConfig);

      const afterTs = Math.floor(Date.now() / 1000);
      const entries = await readAllEntries(testConfig);

      expect(entries[0].ts).toBeGreaterThanOrEqual(beforeTs);
      expect(entries[0].ts).toBeLessThanOrEqual(afterTs);
    });
  });

  describe("historyMetadata", () => {
    it("should return zero count for non-existent file", async () => {
      const metadata = await historyMetadata(testConfig);

      expect(metadata.logId).toBe(0);
      expect(metadata.count).toBe(0);
    });

    it("should return correct count after appending entries", async () => {
      const conversationId = ConversationId.new();

      await appendEntry("First", conversationId, testConfig);
      await appendEntry("Second", conversationId, testConfig);
      await appendEntry("Third", conversationId, testConfig);

      const metadata = await historyMetadata(testConfig);

      expect(metadata.count).toBe(3);
    });

    it("should return non-zero logId on Unix systems", async () => {
      if (process.platform === "win32") {
        // Skip on Windows
        return;
      }

      const conversationId = ConversationId.new();
      await appendEntry("Test", conversationId, testConfig);

      const metadata = await historyMetadata(testConfig);

      // On Unix, logId should be the inode number (non-zero)
      expect(metadata.logId).toBeGreaterThan(0);
    });

    it("should track file changes", async () => {
      const conversationId = ConversationId.new();

      await appendEntry("First", conversationId, testConfig);
      const metadata1 = await historyMetadata(testConfig);

      await appendEntry("Second", conversationId, testConfig);
      const metadata2 = await historyMetadata(testConfig);

      expect(metadata2.count).toBe(metadata1.count + 1);
    });
  });

  describe("lookup", () => {
    it("should return undefined for non-existent file", async () => {
      const entry = await lookup(0, 0, testConfig);
      expect(entry).toBeUndefined();
    });

    it("should return entry at specified offset", async () => {
      const conversationId = ConversationId.new();
      const messages = ["Message 0", "Message 1", "Message 2"];

      for (const msg of messages) {
        await appendEntry(msg, conversationId, testConfig);
      }

      const metadata = await historyMetadata(testConfig);
      const entry = await lookup(metadata.logId, 1, testConfig);

      expect(entry).toBeDefined();
      expect(entry?.text).toBe("Message 1");
      expect(entry?.session_id).toBe(conversationId.toString());
    });

    it("should return undefined for out-of-bounds offset", async () => {
      const conversationId = ConversationId.new();
      await appendEntry("Only message", conversationId, testConfig);

      const metadata = await historyMetadata(testConfig);
      const entry = await lookup(metadata.logId, 10, testConfig);

      expect(entry).toBeUndefined();
    });

    it("should return first entry at offset 0", async () => {
      const conversationId = ConversationId.new();
      await appendEntry("First message", conversationId, testConfig);
      await appendEntry("Second message", conversationId, testConfig);

      const metadata = await historyMetadata(testConfig);
      const entry = await lookup(metadata.logId, 0, testConfig);

      expect(entry).toBeDefined();
      expect(entry?.text).toBe("First message");
    });

    it("should return undefined for mismatched logId on Unix", async () => {
      if (process.platform === "win32") {
        // Skip on Windows (no inode verification)
        return;
      }

      const conversationId = ConversationId.new();
      await appendEntry("Test", conversationId, testConfig);

      // Use a definitely incorrect logId
      const entry = await lookup(999999999, 0, testConfig);

      expect(entry).toBeUndefined();
    });
  });

  describe("readAllEntries", () => {
    it("should return empty array for non-existent file", async () => {
      const entries = await readAllEntries(testConfig);
      expect(entries).toEqual([]);
    });

    it("should return all entries in order", async () => {
      const conversationId = ConversationId.new();
      const messages = ["First", "Second", "Third", "Fourth"];

      for (const msg of messages) {
        await appendEntry(msg, conversationId, testConfig);
      }

      const entries = await readAllEntries(testConfig);
      expect(entries).toHaveLength(4);

      entries.forEach((entry, idx) => {
        expect(entry.text).toBe(messages[idx]);
      });
    });
  });

  describe("clearHistory", () => {
    it("should remove history file", async () => {
      const conversationId = ConversationId.new();
      await appendEntry("Test", conversationId, testConfig);

      // Verify file exists
      let entries = await readAllEntries(testConfig);
      expect(entries).toHaveLength(1);

      // Clear history
      await clearHistory(testConfig);

      // Verify file is gone
      entries = await readAllEntries(testConfig);
      expect(entries).toEqual([]);
    });

    it("should not throw when file does not exist", async () => {
      await expect(clearHistory(testConfig)).resolves.not.toThrow();
    });
  });

  describe("file format", () => {
    it("should write valid JSONL format", async () => {
      const conversationId = ConversationId.new();
      await appendEntry("Line 1", conversationId, testConfig);
      await appendEntry("Line 2", conversationId, testConfig);

      const historyPath = path.join(testCodexHome, "history.jsonl");
      const content = await fs.readFile(historyPath, "utf8");

      // Each line should be valid JSON
      const lines = content.split("\n").filter((line) => line.trim());
      expect(lines).toHaveLength(2);

      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it("should end each line with newline", async () => {
      const conversationId = ConversationId.new();
      await appendEntry("Test", conversationId, testConfig);

      const historyPath = path.join(testCodexHome, "history.jsonl");
      const content = await fs.readFile(historyPath, "utf8");

      expect(content.endsWith("\n")).toBe(true);
    });
  });

  describe("integration", () => {
    it("should handle complete write-read-lookup cycle", async () => {
      const conversationId1 = ConversationId.new();
      const conversationId2 = ConversationId.new();

      // Write entries from two conversations
      await appendEntry("Conv1 Msg1", conversationId1, testConfig);
      await appendEntry("Conv2 Msg1", conversationId2, testConfig);
      await appendEntry("Conv1 Msg2", conversationId1, testConfig);

      // Get metadata
      const metadata = await historyMetadata(testConfig);
      expect(metadata.count).toBe(3);

      // Lookup specific entries
      const entry0 = await lookup(metadata.logId, 0, testConfig);
      const entry1 = await lookup(metadata.logId, 1, testConfig);
      const entry2 = await lookup(metadata.logId, 2, testConfig);

      expect(entry0?.text).toBe("Conv1 Msg1");
      expect(entry0?.session_id).toBe(conversationId1.toString());

      expect(entry1?.text).toBe("Conv2 Msg1");
      expect(entry1?.session_id).toBe(conversationId2.toString());

      expect(entry2?.text).toBe("Conv1 Msg2");
      expect(entry2?.session_id).toBe(conversationId1.toString());
    });

    it("should maintain data integrity across operations", async () => {
      const conversationId = ConversationId.new();
      const testData = [
        "Simple message",
        'Message with "quotes"',
        "Message\nwith\nnewlines",
        "Unicode: 你好世界 🚀",
        "",
        "Very long message " + "x".repeat(1000),
      ];

      // Append all test data
      for (const text of testData) {
        await appendEntry(text, conversationId, testConfig);
      }

      // Read back and verify
      const entries = await readAllEntries(testConfig);
      expect(entries).toHaveLength(testData.length);

      entries.forEach((entry, idx) => {
        expect(entry.text).toBe(testData[idx]);
        expect(entry.session_id).toBe(conversationId.toString());
      });
    });
  });
});
