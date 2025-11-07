/**
 * Tests for script block detection
 *
 * Phase 4.4 - Script Harness: Detector
 */

import { describe, it, expect } from "vitest";
import {
  detectScriptBlocks,
  segmentText,
  validateXmlStructure,
  hasScriptBlocks,
  extractScriptCode,
  countScriptBlocks,
  removeScriptBlocks,
  replaceScriptBlocks,
  type ScriptBlock,
  type SegmentedText,
} from "./detector.js";

describe("Script Block Detector", () => {
  describe("Basic Detection", () => {
    it("should detect single script block", () => {
      const text = "<tool-calls>const x = 1;</tool-calls>";
      const blocks = detectScriptBlocks(text);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].format).toBe("xml");
      expect(blocks[0].code).toBe("const x = 1;");
      expect(blocks[0].language).toBe("ts");
    });

    it("should detect multiple script blocks", () => {
      const text = `
        <tool-calls>const x = 1;</tool-calls>
        Some text here
        <tool-calls>const y = 2;</tool-calls>
      `;
      const blocks = detectScriptBlocks(text);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].code).toBe("const x = 1;");
      expect(blocks[1].code).toBe("const y = 2;");
    });

    it("should handle multiline script code", () => {
      const text = `<tool-calls>
        const result = await tools.exec({
          command: ["ls", "-la"]
        });
        return result.stdout;
      </tool-calls>`;

      const blocks = detectScriptBlocks(text);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toContain("await tools.exec");
      expect(blocks[0].code).toContain("return result.stdout");
    });

    it("should trim whitespace from code", () => {
      const text = "<tool-calls>\n  const x = 1;  \n</tool-calls>";
      const blocks = detectScriptBlocks(text);

      expect(blocks[0].code).toBe("const x = 1;");
    });

    it("should return empty array for no scripts", () => {
      const text = "Just some regular text here";
      const blocks = detectScriptBlocks(text);

      expect(blocks).toHaveLength(0);
    });

    it("should handle empty text", () => {
      const blocks = detectScriptBlocks("");

      expect(blocks).toHaveLength(0);
    });

    it("should capture start and end indices", () => {
      const text = "Before <tool-calls>code</tool-calls> After";
      const blocks = detectScriptBlocks(text);

      expect(blocks[0].startIndex).toBe(7); // "Before "
      expect(blocks[0].endIndex).toBe(36); // Length of tag + code
    });
  });

  describe("Text Segmentation", () => {
    it("should segment text with no scripts", () => {
      const text = "Just plain text";
      const result = segmentText(text);

      expect(result.scripts).toHaveLength(0);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0]).toEqual({
        type: "text",
        content: "Just plain text",
        index: 0,
      });
    });

    it("should segment text with single script", () => {
      const text = "Before <tool-calls>code</tool-calls> After";
      const result = segmentText(text);

      expect(result.scripts).toHaveLength(1);
      expect(result.segments).toHaveLength(3);
      expect(result.segments[0]).toEqual({
        type: "text",
        content: "Before ",
        index: 0,
      });
      expect(result.segments[1]).toEqual({
        type: "script",
        scriptIndex: 0,
        index: 1,
      });
      expect(result.segments[2]).toEqual({
        type: "text",
        content: " After",
        index: 2,
      });
    });

    it("should segment text with multiple scripts", () => {
      const text =
        "A <tool-calls>x</tool-calls> B <tool-calls>y</tool-calls> C";
      const result = segmentText(text);

      expect(result.scripts).toHaveLength(2);
      expect(result.segments).toHaveLength(5);
      expect(result.segments[0].type).toBe("text");
      expect(result.segments[1].type).toBe("script");
      expect(result.segments[2].type).toBe("text");
      expect(result.segments[3].type).toBe("script");
      expect(result.segments[4].type).toBe("text");
    });

    it("should handle script at start", () => {
      const text = "<tool-calls>code</tool-calls> After";
      const result = segmentText(text);

      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].type).toBe("script");
      expect(result.segments[1].type).toBe("text");
    });

    it("should handle script at end", () => {
      const text = "Before <tool-calls>code</tool-calls>";
      const result = segmentText(text);

      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].type).toBe("text");
      expect(result.segments[1].type).toBe("script");
    });

    it("should handle consecutive scripts", () => {
      const text = "<tool-calls>x</tool-calls><tool-calls>y</tool-calls>";
      const result = segmentText(text);

      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].type).toBe("script");
      expect(result.segments[1].type).toBe("script");
    });

    it("should handle empty string", () => {
      const result = segmentText("");

      expect(result.scripts).toHaveLength(0);
      expect(result.segments).toHaveLength(0);
    });

    it("should maintain chronological order", () => {
      const text = "A <tool-calls>1</tool-calls> B <tool-calls>2</tool-calls> C";
      const result = segmentText(text);

      // Check indices are sequential
      for (let i = 0; i < result.segments.length; i++) {
        expect(result.segments[i].index).toBe(i);
      }
    });
  });

  describe("XML Validation", () => {
    it("should validate correct structure", () => {
      const text = "Text <tool-calls>code</tool-calls> more text";
      const result = validateXmlStructure(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect nested blocks", () => {
      const text =
        "<tool-calls>outer <tool-calls>nested</tool-calls></tool-calls>";
      const result = validateXmlStructure(text);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Nested");
    });

    it("should detect unbalanced opening tags", () => {
      const text = "<tool-calls>code <tool-calls>more</tool-calls>";
      const result = validateXmlStructure(text);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Unbalanced"))).toBe(true);
    });

    it("should detect unbalanced closing tags", () => {
      const text = "<tool-calls>code</tool-calls></tool-calls>";
      const result = validateXmlStructure(text);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Unbalanced");
    });

    it("should detect malformed pairs", () => {
      const text = "<tool-calls>code</other-tag>";
      const result = validateXmlStructure(text);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle multiple valid blocks", () => {
      const text = "<tool-calls>x</tool-calls> <tool-calls>y</tool-calls>";
      const result = validateXmlStructure(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate text with no blocks", () => {
      const text = "Just regular text";
      const result = validateXmlStructure(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Utility Functions", () => {
    describe("hasScriptBlocks", () => {
      it("should return true when scripts present", () => {
        expect(hasScriptBlocks("<tool-calls>code</tool-calls>")).toBe(true);
      });

      it("should return false when no scripts", () => {
        expect(hasScriptBlocks("Just text")).toBe(false);
      });

      it("should return false for empty string", () => {
        expect(hasScriptBlocks("")).toBe(false);
      });

      it("should return true for partial tag", () => {
        expect(hasScriptBlocks("<tool-calls>incomplete")).toBe(true);
      });
    });

    describe("extractScriptCode", () => {
      it("should extract single script code", () => {
        const text = "<tool-calls>const x = 1;</tool-calls>";
        const codes = extractScriptCode(text);

        expect(codes).toHaveLength(1);
        expect(codes[0]).toBe("const x = 1;");
      });

      it("should extract multiple script codes", () => {
        const text = "<tool-calls>x</tool-calls> <tool-calls>y</tool-calls>";
        const codes = extractScriptCode(text);

        expect(codes).toHaveLength(2);
        expect(codes[0]).toBe("x");
        expect(codes[1]).toBe("y");
      });

      it("should return empty array for no scripts", () => {
        const codes = extractScriptCode("Just text");

        expect(codes).toHaveLength(0);
      });
    });

    describe("countScriptBlocks", () => {
      it("should count zero scripts", () => {
        expect(countScriptBlocks("Just text")).toBe(0);
      });

      it("should count one script", () => {
        expect(countScriptBlocks("<tool-calls>code</tool-calls>")).toBe(1);
      });

      it("should count multiple scripts", () => {
        const text = "<tool-calls>x</tool-calls> <tool-calls>y</tool-calls>";
        expect(countScriptBlocks(text)).toBe(2);
      });

      it("should count unclosed tags too", () => {
        const text = "<tool-calls>x <tool-calls>y</tool-calls>";
        expect(countScriptBlocks(text)).toBe(2); // Counts opening tags
      });
    });

    describe("removeScriptBlocks", () => {
      it("should remove single script", () => {
        const text = "Before <tool-calls>code</tool-calls> After";
        const result = removeScriptBlocks(text);

        expect(result).toBe("Before  After");
      });

      it("should remove multiple scripts", () => {
        const text = "A <tool-calls>x</tool-calls> B <tool-calls>y</tool-calls> C";
        const result = removeScriptBlocks(text);

        expect(result).toBe("A  B  C");
      });

      it("should use custom replacement", () => {
        const text = "Before <tool-calls>code</tool-calls> After";
        const result = removeScriptBlocks(text, "[SCRIPT]");

        expect(result).toBe("Before [SCRIPT] After");
      });

      it("should handle no scripts", () => {
        const text = "Just text";
        const result = removeScriptBlocks(text);

        expect(result).toBe("Just text");
      });
    });

    describe("replaceScriptBlocks", () => {
      it("should replace with placeholder", () => {
        const text = "<tool-calls>code</tool-calls>";
        const result = replaceScriptBlocks(text, (i) => `[Script ${i}]`);

        expect(result).toBe("[Script 0]");
      });

      it("should replace multiple with indexed placeholders", () => {
        const text = "<tool-calls>x</tool-calls> <tool-calls>y</tool-calls>";
        const result = replaceScriptBlocks(text, (i) => `[${i}]`);

        expect(result).toBe("[0] [1]");
      });

      it("should handle complex placeholder function", () => {
        const text = "Before <tool-calls>code</tool-calls> After";
        const result = replaceScriptBlocks(
          text,
          (i) => `<executed script ${i}>`,
        );

        expect(result).toBe("Before <executed script 0> After");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle code with angle brackets", () => {
      const text = "<tool-calls>if (x < 5 && y > 3) {}</tool-calls>";
      const blocks = detectScriptBlocks(text);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toContain("x < 5");
      expect(blocks[0].code).toContain("y > 3");
    });

    it("should handle code with escaped characters", () => {
      const text = '<tool-calls>const s = "test\\n";</tool-calls>';
      const blocks = detectScriptBlocks(text);

      expect(blocks[0].code).toContain('test\\n');
    });

    it("should handle code with HTML-like content", () => {
      const text =
        "<tool-calls>const html = '<div>test</div>';</tool-calls>";
      const blocks = detectScriptBlocks(text);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toContain("<div>");
    });

    it("should handle very long scripts", () => {
      const longCode = "x".repeat(10000);
      const text = `<tool-calls>${longCode}</tool-calls>`;
      const blocks = detectScriptBlocks(text);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].code.length).toBe(10000);
    });

    it("should handle script with only whitespace", () => {
      const text = "<tool-calls>   \n\t  </tool-calls>";
      const blocks = detectScriptBlocks(text);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toBe(""); // Trimmed to empty
    });

    it("should handle text with tool-calls in string literals", () => {
      const text = 'const msg = "Use <tool-calls> for scripts";';
      const blocks = detectScriptBlocks(text);

      // This is a tricky case - it will detect it as a partial match
      // In practice, the parser will validate proper closure
      expect(blocks).toHaveLength(0);
    });

    it("should handle Unicode in script code", () => {
      const text = "<tool-calls>const 変数 = '日本語';</tool-calls>";
      const blocks = detectScriptBlocks(text);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toContain("変数");
      expect(blocks[0].code).toContain("日本語");
    });

    it("should handle newlines in various formats", () => {
      const text =
        "<tool-calls>line1\nline2\r\nline3\rline4</tool-calls>";
      const blocks = detectScriptBlocks(text);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toContain("line1");
      expect(blocks[0].code).toContain("line4");
    });
  });

  describe("Real-World Examples", () => {
    it("should handle typical LLM response with thinking + script + text", () => {
      const text = `Let me help you with that task.

<thinking>
I'll need to search for files and then process them in parallel.
</thinking>

<tool-calls>
const files = await tools.fileSearch({ pattern: "*.ts", limit: 10 });
const results = await Promise.all(
  files.map(f => tools.exec({ command: ["cat", f.path] }))
);
return { files: files.length, results: results.length };
</tool-calls>

I found 10 TypeScript files and processed them successfully!`;

      const blocks = detectScriptBlocks(text);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toContain("fileSearch");
      expect(blocks[0].code).toContain("Promise.all");

      const segmented = segmentText(text);
      expect(segmented.segments[0].type).toBe("text"); // Before script
      expect(segmented.segments[1].type).toBe("script");
      expect(segmented.segments[2].type).toBe("text"); // After script
    });

    it("should handle multiple sequential operations", () => {
      const text = `First step:
<tool-calls>const data1 = await tools.exec({ command: ["ls"] });</tool-calls>

Second step:
<tool-calls>const data2 = await tools.exec({ command: ["pwd"] });</tool-calls>

Done!`;

      const blocks = detectScriptBlocks(text);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].code).toContain("ls");
      expect(blocks[1].code).toContain("pwd");
    });
  });
});
