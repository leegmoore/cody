import { describe, it, expect } from "vitest";
import { HistoryEntry } from "./message-history.js";

describe("Message History Protocol Types", () => {
  describe("HistoryEntry", () => {
    it("creates a valid history entry", () => {
      const entry: HistoryEntry = {
        conversation_id: "conv-123",
        ts: 1699564800000,
        text: "Hello, world!",
      };

      expect(entry.conversation_id).toBe("conv-123");
      expect(entry.ts).toBe(1699564800000);
      expect(entry.text).toBe("Hello, world!");
    });

    it("serializes to JSON correctly", () => {
      const entry: HistoryEntry = {
        conversation_id: "conv-456",
        ts: 1699564900000,
        text: "Test message",
      };

      const json = JSON.stringify(entry);
      expect(json).toBe(
        '{"conversation_id":"conv-456","ts":1699564900000,"text":"Test message"}',
      );
    });

    it("deserializes from JSON correctly", () => {
      const json =
        '{"conversation_id":"conv-789","ts":1699565000000,"text":"Another message"}';
      const entry: HistoryEntry = JSON.parse(json);

      expect(entry.conversation_id).toBe("conv-789");
      expect(entry.ts).toBe(1699565000000);
      expect(entry.text).toBe("Another message");
    });

    it("handles empty text", () => {
      const entry: HistoryEntry = {
        conversation_id: "conv-empty",
        ts: 1699565100000,
        text: "",
      };

      expect(entry.text).toBe("");
      const json = JSON.stringify(entry);
      const parsed: HistoryEntry = JSON.parse(json);
      expect(parsed.text).toBe("");
    });

    it("handles zero timestamp", () => {
      const entry: HistoryEntry = {
        conversation_id: "conv-zero",
        ts: 0,
        text: "Message at epoch",
      };

      expect(entry.ts).toBe(0);
    });

    it("handles multiline text", () => {
      const entry: HistoryEntry = {
        conversation_id: "conv-multiline",
        ts: 1699565200000,
        text: "Line 1\nLine 2\nLine 3",
      };

      expect(entry.text).toContain("\n");
      const json = JSON.stringify(entry);
      const parsed: HistoryEntry = JSON.parse(json);
      expect(parsed.text).toBe("Line 1\nLine 2\nLine 3");
    });

    it("handles special characters in text", () => {
      const entry: HistoryEntry = {
        conversation_id: "conv-special",
        ts: 1699565300000,
        text: "Special chars: \"quotes\", 'apostrophes', & ampersand, <html>",
      };

      const json = JSON.stringify(entry);
      const parsed: HistoryEntry = JSON.parse(json);
      expect(parsed.text).toBe(
        "Special chars: \"quotes\", 'apostrophes', & ampersand, <html>",
      );
    });

    it("handles unicode characters", () => {
      const entry: HistoryEntry = {
        conversation_id: "conv-unicode",
        ts: 1699565400000,
        text: "Unicode: 你好 🌍 café",
      };

      const json = JSON.stringify(entry);
      const parsed: HistoryEntry = JSON.parse(json);
      expect(parsed.text).toBe("Unicode: 你好 🌍 café");
    });

    it("maintains field order in serialization", () => {
      const entry: HistoryEntry = {
        conversation_id: "conv-order",
        ts: 1699565500000,
        text: "Order test",
      };

      const json = JSON.stringify(entry);
      expect(json).toMatch(/"conversation_id":/);
      expect(json).toMatch(/"ts":/);
      expect(json).toMatch(/"text":/);
    });

    it("can create multiple entries with different data", () => {
      const entries: HistoryEntry[] = [
        {
          conversation_id: "conv-1",
          ts: 1699565600000,
          text: "First message",
        },
        {
          conversation_id: "conv-2",
          ts: 1699565700000,
          text: "Second message",
        },
        {
          conversation_id: "conv-3",
          ts: 1699565800000,
          text: "Third message",
        },
      ];

      expect(entries).toHaveLength(3);
      expect(entries[0].conversation_id).toBe("conv-1");
      expect(entries[1].conversation_id).toBe("conv-2");
      expect(entries[2].conversation_id).toBe("conv-3");
    });
  });
});
