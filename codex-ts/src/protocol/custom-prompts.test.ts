import { describe, it, expect } from "vitest";
import { PROMPTS_CMD_PREFIX, CustomPrompt } from "./custom-prompts.js";

describe("Custom Prompts Protocol Types", () => {
  describe("PROMPTS_CMD_PREFIX", () => {
    it("has correct value", () => {
      expect(PROMPTS_CMD_PREFIX).toBe("prompts");
    });

    it("can be used to construct command tokens", () => {
      const name = "mycommand";
      const commandToken = `${PROMPTS_CMD_PREFIX}:${name}`;
      expect(commandToken).toBe("prompts:mycommand");
    });

    it("can be used to construct slash prefixes", () => {
      const slashPrefix = `/${PROMPTS_CMD_PREFIX}:`;
      expect(slashPrefix).toBe("/prompts:");
    });
  });

  describe("CustomPrompt", () => {
    it("creates a valid custom prompt", () => {
      const prompt: CustomPrompt = {
        name: "review",
        path: "/home/user/.config/prompts/review.md",
        content: "Review the following code...",
        description: "Code review prompt",
        argument_hint: "<file>",
      };

      expect(prompt.name).toBe("review");
      expect(prompt.path).toBe("/home/user/.config/prompts/review.md");
      expect(prompt.content).toBe("Review the following code...");
      expect(prompt.description).toBe("Code review prompt");
      expect(prompt.argument_hint).toBe("<file>");
    });

    it("allows optional description to be undefined", () => {
      const prompt: CustomPrompt = {
        name: "test",
        path: "/prompts/test.md",
        content: "Test content",
      };

      expect(prompt.description).toBeUndefined();
      expect(prompt.argument_hint).toBeUndefined();
    });

    it("serializes to JSON correctly", () => {
      const prompt: CustomPrompt = {
        name: "explain",
        path: "/prompts/explain.md",
        content: "Explain this code",
        description: "Code explanation",
      };

      const json = JSON.stringify(prompt);
      expect(json).toContain('"name":"explain"');
      expect(json).toContain('"path":"/prompts/explain.md"');
      expect(json).toContain('"content":"Explain this code"');
      expect(json).toContain('"description":"Code explanation"');
    });

    it("deserializes from JSON correctly", () => {
      const json =
        '{"name":"test","path":"/test.md","content":"Test","description":"A test"}';
      const prompt: CustomPrompt = JSON.parse(json);

      expect(prompt.name).toBe("test");
      expect(prompt.path).toBe("/test.md");
      expect(prompt.content).toBe("Test");
      expect(prompt.description).toBe("A test");
    });

    it("handles multiline content", () => {
      const prompt: CustomPrompt = {
        name: "multiline",
        path: "/prompts/multi.md",
        content: "Line 1\nLine 2\nLine 3",
      };

      const json = JSON.stringify(prompt);
      const parsed: CustomPrompt = JSON.parse(json);
      expect(parsed.content).toBe("Line 1\nLine 2\nLine 3");
    });

    it("handles empty strings", () => {
      const prompt: CustomPrompt = {
        name: "",
        path: "",
        content: "",
        description: "",
        argument_hint: "",
      };

      expect(prompt.name).toBe("");
      expect(prompt.path).toBe("");
      expect(prompt.content).toBe("");
      expect(prompt.description).toBe("");
      expect(prompt.argument_hint).toBe("");
    });

    it("handles windows-style paths", () => {
      const prompt: CustomPrompt = {
        name: "windows",
        path: "C:\\Users\\user\\prompts\\test.md",
        content: "Windows prompt",
      };

      expect(prompt.path).toBe("C:\\Users\\user\\prompts\\test.md");
      const json = JSON.stringify(prompt);
      const parsed: CustomPrompt = JSON.parse(json);
      expect(parsed.path).toBe("C:\\Users\\user\\prompts\\test.md");
    });

    it("can create multiple prompts", () => {
      const prompts: CustomPrompt[] = [
        {
          name: "review",
          path: "/prompts/review.md",
          content: "Review code",
        },
        {
          name: "explain",
          path: "/prompts/explain.md",
          content: "Explain code",
        },
        {
          name: "test",
          path: "/prompts/test.md",
          content: "Write tests",
        },
      ];

      expect(prompts).toHaveLength(3);
      expect(prompts[0].name).toBe("review");
      expect(prompts[1].name).toBe("explain");
      expect(prompts[2].name).toBe("test");
    });

    it("handles special characters in content", () => {
      const prompt: CustomPrompt = {
        name: "special",
        path: "/prompts/special.md",
        content: "Special: \"quotes\", 'apostrophes', <html>, & ampersand",
      };

      const json = JSON.stringify(prompt);
      const parsed: CustomPrompt = JSON.parse(json);
      expect(parsed.content).toBe(
        "Special: \"quotes\", 'apostrophes', <html>, & ampersand",
      );
    });
  });
});
