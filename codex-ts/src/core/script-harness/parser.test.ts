/**
 * Tests for script parser and validator
 *
 * Phase 4.4 - Script Harness: Parser
 */

import { describe, it, expect } from "vitest";
import {
  parseScript,
  parseScripts,
  isValidScript,
  type ParseResult,
} from "./parser.js";
import {
  BannedIdentifierError,
  ScriptSyntaxError,
  ScriptTooLargeError,
} from "./errors.js";

describe("Script Parser", () => {
  describe("Basic Parsing", () => {
    it("should parse valid TypeScript code", () => {
      const code = "const x = 1;\nreturn x;";
      const result = parseScript(code);

      expect(result.success).toBe(true);
      expect(result.script).toBeDefined();
      expect(result.script!.sourceCode).toBe(code);
      expect(result.script!.language).toBe("ts");
      expect(result.warnings).toHaveLength(0);
    });

    it("should compute source hash", () => {
      const code = "const x = 1;";
      const result = parseScript(code);

      expect(result.script!.sourceHash).toBeTruthy();
      expect(result.script!.sourceHash).toHaveLength(64); // SHA-256 hex is 64 chars
    });

    it("should compute same hash for same code", () => {
      const code = "const x = 1;";
      const result1 = parseScript(code);
      const result2 = parseScript(code);

      expect(result1.script!.sourceHash).toBe(result2.script!.sourceHash);
    });

    it("should compute different hash for different code", () => {
      const result1 = parseScript("const x = 1;");
      const result2 = parseScript("const x = 2;");

      expect(result1.script!.sourceHash).not.toBe(result2.script!.sourceHash);
    });

    it("should calculate size in bytes", () => {
      const code = "x".repeat(100);
      const result = parseScript(code);

      expect(result.script!.sizeBytes).toBe(100);
    });
  });

  describe("UTF-8 Validation", () => {
    it("should accept valid UTF-8", () => {
      const code = "const msg = 'Hello 世界';";
      const result = parseScript(code);

      expect(result.success).toBe(true);
      expect(result.script!.isValidUtf8).toBe(true);
    });

    it("should accept Unicode characters", () => {
      const code = "const 変数 = '日本語';";
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });

    it("should accept emoji", () => {
      const code = "const msg = '🚀💪';";
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });

    it("should strip BOM with warning", () => {
      const code = "\uFEFFconst x = 1;";
      const result = parseScript(code);

      expect(result.success).toBe(true);
      expect(result.script!.sourceCode).toBe("const x = 1;");
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("BOM");
    });
  });

  describe("Size Limits", () => {
    it("should reject scripts exceeding size limit", () => {
      const code = "x".repeat(25000);
      const result = parseScript(code, { maxSourceBytes: 20000 });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ScriptTooLargeError);
    });

    it("should accept scripts within size limit", () => {
      const code = "x".repeat(100);
      const result = parseScript(code, { maxSourceBytes: 20000 });

      expect(result.success).toBe(true);
    });

    it("should use default size limit", () => {
      const code = "x".repeat(30000);
      const result = parseScript(code); // Default is 20KB

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ScriptTooLargeError);
    });
  });

  describe("Banned Identifier Detection", () => {
    it("should reject script with 'require'", () => {
      const code = "const fs = require('fs');";
      const result = parseScript(code);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(BannedIdentifierError);
      expect((result.error as BannedIdentifierError).identifiers).toContain(
        "require",
      );
    });

    it("should reject script with 'eval'", () => {
      const code = "eval('malicious code');";
      const result = parseScript(code);

      expect(result.success).toBe(false);
      expect((result.error as BannedIdentifierError).identifiers).toContain(
        "eval",
      );
    });

    it("should reject script with 'process'", () => {
      const code = "process.exit(1);";
      const result = parseScript(code);

      expect(result.success).toBe(false);
      expect((result.error as BannedIdentifierError).identifiers).toContain(
        "process",
      );
    });

    it("should reject script with 'Function' constructor", () => {
      const code = "new Function('return this')();";
      const result = parseScript(code);

      expect(result.success).toBe(false);
      expect((result.error as BannedIdentifierError).identifiers).toContain(
        "Function",
      );
    });

    it("should reject script with '__proto__'", () => {
      const code = "obj.__proto__ = malicious;";
      const result = parseScript(code);

      expect(result.success).toBe(false);
      expect((result.error as BannedIdentifierError).identifiers).toContain(
        "__proto__",
      );
    });

    it("should allow banned identifiers in strings", () => {
      const code = 'const msg = "use require() for imports";';
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });

    it("should allow banned identifiers in comments", () => {
      const code = "// This uses require\nconst x = 1;";
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });
  });

  describe("Syntax Validation", () => {
    describe("Balanced Brackets", () => {
      it("should accept balanced braces", () => {
        const code = "{ const x = 1; }";
        const result = parseScript(code);

        expect(result.success).toBe(true);
      });

      it("should reject unclosed brace", () => {
        const code = "{ const x = 1;";
        const result = parseScript(code);

        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(ScriptSyntaxError);
        expect(result.error!.message).toContain("Unclosed");
      });

      it("should reject unexpected closing brace", () => {
        const code = "const x = 1; }";
        const result = parseScript(code);

        expect(result.success).toBe(false);
        expect(result.error!.message).toContain("Unexpected");
      });

      it("should reject mismatched brackets", () => {
        const code = "{ const x = [1, 2, 3}";
        const result = parseScript(code);

        expect(result.success).toBe(false);
        expect(result.error!.message).toContain("Mismatched");
      });

      it("should accept balanced parentheses", () => {
        const code = "const fn = (x, y) => (x + y);";
        const result = parseScript(code);

        expect(result.success).toBe(true);
      });

      it("should reject unclosed parenthesis", () => {
        const code = "const fn = (x, y => x + y;";
        const result = parseScript(code);

        expect(result.success).toBe(false);
      });

      it("should accept balanced square brackets", () => {
        const code = "const arr = [1, [2, 3], 4];";
        const result = parseScript(code);

        expect(result.success).toBe(true);
      });

      it("should reject unclosed square bracket", () => {
        const code = "const arr = [1, 2, 3;";
        const result = parseScript(code);

        expect(result.success).toBe(false);
      });
    });

    describe("String Validation", () => {
      it("should accept closed double quotes", () => {
        const code = 'const s = "hello";';
        const result = parseScript(code);

        expect(result.success).toBe(true);
      });

      it("should accept closed single quotes", () => {
        const code = "const s = 'hello';";
        const result = parseScript(code);

        expect(result.success).toBe(true);
      });

      it("should accept closed template literals", () => {
        const code = "const s = `hello ${name}`;";
        const result = parseScript(code);

        expect(result.success).toBe(true);
      });

      it("should reject unclosed double quote string", () => {
        const code = 'const s = "hello';
        const result = parseScript(code);

        expect(result.success).toBe(false);
        expect(result.error!.message).toContain("Unclosed string");
      });

      it("should reject unclosed single quote string", () => {
        const code = "const s = 'hello";
        const result = parseScript(code);

        expect(result.success).toBe(false);
      });

      it("should reject unclosed template literal", () => {
        const code = "const s = `hello";
        const result = parseScript(code);

        expect(result.success).toBe(false);
      });

      it("should handle escaped quotes", () => {
        const code = 'const s = "He said \\"Hi\\"";';
        const result = parseScript(code);

        expect(result.success).toBe(true);
      });

      it("should handle escaped backslash", () => {
        const code = 'const s = "path\\\\file";';
        const result = parseScript(code);

        expect(result.success).toBe(true);
      });
    });

    describe("Comment Validation", () => {
      it("should accept single-line comments", () => {
        const code = "// This is a comment\nconst x = 1;";
        const result = parseScript(code);

        expect(result.success).toBe(true);
      });

      it("should accept multi-line comments", () => {
        const code = "/* This is\na comment */\nconst x = 1;";
        const result = parseScript(code);

        expect(result.success).toBe(true);
      });

      it("should reject unclosed multi-line comment", () => {
        const code = "/* This is a comment\nconst x = 1;";
        const result = parseScript(code);

        expect(result.success).toBe(false);
        expect(result.error!.message).toContain("Unclosed comment");
      });

      it("should ignore brackets in comments", () => {
        const code = "/* { unclosed */ const x = 1;";
        const result = parseScript(code);

        expect(result.success).toBe(true);
      });

      it("should ignore brackets in strings", () => {
        const code = 'const s = "{ unclosed";';
        const result = parseScript(code);

        expect(result.success).toBe(true);
      });
    });
  });

  describe("Complex Code Patterns", () => {
    it("should parse async/await code", () => {
      const code = `
        const result = await tools.exec({ command: ["ls"] });
        return result.stdout;
      `;
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });

    it("should parse Promise code", () => {
      const code = `
        const results = await Promise.all([
          tools.exec({ command: ["ls"] }),
          tools.exec({ command: ["pwd"] })
        ]);
        return results;
      `;
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });

    it("should parse arrow functions", () => {
      const code = "const fn = (x) => x * 2;";
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });

    it("should parse object literals", () => {
      const code = "const obj = { a: 1, b: { c: 2 } };";
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });

    it("should parse array methods", () => {
      const code = "const arr = [1, 2, 3].map(x => x * 2);";
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });

    it("should parse destructuring", () => {
      const code = "const { a, b } = obj; const [x, y] = arr;";
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });

    it("should parse template literals with expressions", () => {
      const code = "const msg = `Value: ${x + 1}`;";
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });
  });

  describe("Batch Parsing", () => {
    it("should parse multiple scripts", () => {
      const codes = ["const x = 1;", "const y = 2;", "const z = 3;"];
      const results = parseScripts(codes);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it("should return individual results for each script", () => {
      const codes = ["const x = 1;", "invalid {", "const y = 2;"];
      const results = parseScripts(codes);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe("Validation Helper", () => {
    it("should return true for valid script", () => {
      expect(isValidScript("const x = 1;")).toBe(true);
    });

    it("should return false for invalid script", () => {
      expect(isValidScript("invalid {")).toBe(false);
    });

    it("should return false for script with banned identifiers", () => {
      expect(isValidScript("require('fs')")).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty code", () => {
      const result = parseScript("");

      expect(result.success).toBe(true);
      expect(result.script!.sizeBytes).toBe(0);
    });

    it("should handle whitespace-only code", () => {
      const result = parseScript("   \n\t  ");

      expect(result.success).toBe(true);
    });

    it("should handle very long lines", () => {
      const longLine = "const x = " + '"' + "a".repeat(1000) + '";';
      const result = parseScript(longLine);

      expect(result.success).toBe(true);
    });

    it("should handle nested brackets", () => {
      const code = "{ { { const x = [[[1, 2], 3], 4]; } } }";
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });

    it("should handle regex patterns", () => {
      const code = "const pattern = /[a-z]+/gi;";
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });

    it("should handle division operator vs regex", () => {
      const code = "const x = 10 / 2;";
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });
  });

  describe("Real-World Examples", () => {
    it("should parse typical tool usage", () => {
      const code = `
        const files = await tools.fileSearch({ pattern: "*.ts" });
        const results = await Promise.all(
          files.map(f => tools.exec({ command: ["cat", f.path] }))
        );
        return { count: files.length, results };
      `;
      const result = parseScript(code);

      expect(result.success).toBe(true);
      expect(result.script!.language).toBe("ts");
      expect(result.script!.sourceHash).toBeTruthy();
    });

    it("should parse error handling", () => {
      const code = `
        try {
          const result = await tools.exec({ command: ["rm", "file.txt"] });
          return { success: true };
        } catch (err) {
          if (err.name === 'ApprovalDeniedError') {
            return { success: false, reason: 'denied' };
          }
          throw err;
        }
      `;
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });

    it("should parse conditional logic", () => {
      const code = `
        const files = await tools.fileSearch({ pattern: "*.test.ts" });
        if (files.length > 0) {
          const results = await Promise.all(
            files.map(f => tools.exec({ command: ["npm", "test", f.path] }))
          );
          const failed = results.filter(r => r.exitCode !== 0);
          return { total: files.length, failed: failed.length };
        }
        return { total: 0, failed: 0 };
      `;
      const result = parseScript(code);

      expect(result.success).toBe(true);
    });
  });
});
