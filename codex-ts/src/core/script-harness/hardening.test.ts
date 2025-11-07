/**
 * Tests for sandbox hardening utilities
 *
 * Phase 4.4 - Script Harness: Security Hardening
 * Test IDs: S1-S15 (Security tests from design)
 */

import { describe, it, expect } from "vitest";
import {
  generateHardeningPrelude,
  generateHardeningValidation,
  deepFreeze,
  freezeClone,
  scanForBannedIdentifiers,
  BANNED_IDENTIFIERS,
} from "./hardening.js";

describe("Hardening - Security", () => {
  describe("Prelude Generation", () => {
    it("should generate valid JavaScript code", () => {
      const prelude = generateHardeningPrelude();

      expect(prelude).toContain("use strict");
      expect(prelude).toContain("Object.freeze");
      expect(prelude).toContain("delete globalThis");
    });

    it("should freeze Object.prototype", () => {
      const prelude = generateHardeningPrelude();

      expect(prelude).toContain("Object.freeze(Object.prototype)");
    });

    it("should freeze Array.prototype", () => {
      const prelude = generateHardeningPrelude();

      expect(prelude).toContain("Object.freeze(Array.prototype)");
    });

    it("should freeze Function.prototype", () => {
      const prelude = generateHardeningPrelude();

      expect(prelude).toContain("Object.freeze(Function.prototype)");
    });

    it("should freeze Promise.prototype", () => {
      const prelude = generateHardeningPrelude();

      expect(prelude).toContain("Object.freeze(Promise.prototype)");
    });

    it("should delete eval", () => {
      const prelude = generateHardeningPrelude();

      expect(prelude).toContain("delete globalThis.eval");
    });

    it("should delete Function constructor", () => {
      const prelude = generateHardeningPrelude();

      expect(prelude).toContain("delete globalThis.Function");
    });

    it("should delete require", () => {
      const prelude = generateHardeningPrelude();

      expect(prelude).toContain("delete globalThis.require");
    });

    it("should delete process", () => {
      const prelude = generateHardeningPrelude();

      expect(prelude).toContain("delete globalThis.process");
    });

    it("should freeze globalThis", () => {
      const prelude = generateHardeningPrelude();

      expect(prelude).toContain("Object.freeze(globalThis)");
    });
  });

  describe("Validation Generation", () => {
    it("should generate validation code", () => {
      const validation = generateHardeningValidation();

      expect(validation).toContain("use strict");
      expect(validation).toContain("Object.isFrozen");
    });

    it("should check prototype freezing", () => {
      const validation = generateHardeningValidation();

      expect(validation).toContain("Object.isFrozen(proto)");
    });

    it("should check eval is undefined", () => {
      const validation = generateHardeningValidation();

      expect(validation).toContain('typeof eval !== "undefined"');
    });

    it("should check globalThis is frozen", () => {
      const validation = generateHardeningValidation();

      expect(validation).toContain("Object.isFrozen(globalThis)");
    });
  });

  describe("Deep Freeze", () => {
    it("should freeze simple object", () => {
      const obj = { a: 1, b: 2 };
      const frozen = deepFreeze(obj);

      expect(Object.isFrozen(frozen)).toBe(true);
    });

    it("should freeze nested objects", () => {
      const obj = { a: { b: { c: 1 } } };
      const frozen = deepFreeze(obj);

      expect(Object.isFrozen(frozen)).toBe(true);
      expect(Object.isFrozen(frozen.a)).toBe(true);
      expect(Object.isFrozen(frozen.a.b)).toBe(true);
    });

    it("should freeze arrays", () => {
      const arr = [1, 2, { nested: true }];
      const frozen = deepFreeze(arr);

      expect(Object.isFrozen(frozen)).toBe(true);
      expect(Object.isFrozen(frozen[2])).toBe(true);
    });

    it("should handle circular references", () => {
      const obj: any = { a: 1 };
      obj.self = obj;

      const frozen = deepFreeze(obj);

      expect(Object.isFrozen(frozen)).toBe(true);
      expect(frozen.self).toBe(frozen);
    });

    it("should freeze functions", () => {
      const obj = {
        fn: () => "test",
      };

      const frozen = deepFreeze(obj);

      expect(Object.isFrozen(frozen)).toBe(true);
      expect(Object.isFrozen(frozen.fn)).toBe(true);
    });

    it("should handle null values", () => {
      const obj = { a: null, b: undefined };
      const frozen = deepFreeze(obj);

      expect(Object.isFrozen(frozen)).toBe(true);
      expect(frozen.a).toBeNull();
      expect(frozen.b).toBeUndefined();
    });
  });

  describe("Freeze Clone", () => {
    it("should create frozen copy", () => {
      const original = { a: 1, b: { c: 2 } };
      const frozen = freezeClone(original);

      expect(Object.isFrozen(frozen)).toBe(true);
      expect(Object.isFrozen(frozen.b)).toBe(true);
      expect(Object.isFrozen(original)).toBe(false);
    });

    it("should not mutate original", () => {
      const original = { a: 1 };
      const frozen = freezeClone(original);

      expect(frozen).not.toBe(original);
      original.a = 2;
      expect(frozen.a).toBe(1);
    });
  });

  describe("Banned Identifier Scanning", () => {
    it("should detect require usage", () => {
      const code = 'const fs = require("fs");';
      const found = scanForBannedIdentifiers(code);

      expect(found).toContain("require");
    });

    it("should detect import usage", () => {
      const code = 'import fs from "fs";';
      const found = scanForBannedIdentifiers(code);

      expect(found).toContain("import");
    });

    it("should detect eval usage", () => {
      const code = 'eval("malicious code");';
      const found = scanForBannedIdentifiers(code);

      expect(found).toContain("eval");
    });

    it("should detect Function constructor usage", () => {
      const code = "new Function('return this')();";
      const found = scanForBannedIdentifiers(code);

      expect(found).toContain("Function");
    });

    it("should detect process access", () => {
      const code = "process.exit(1);";
      const found = scanForBannedIdentifiers(code);

      expect(found).toContain("process");
    });

    it("should detect __proto__ manipulation", () => {
      const code = "obj.__proto__ = malicious;";
      const found = scanForBannedIdentifiers(code);

      expect(found).toContain("__proto__");
    });

    it("should detect constructor access", () => {
      const code = "obj.constructor.constructor('return this')();";
      const found = scanForBannedIdentifiers(code);

      expect(found).toContain("constructor");
    });

    it("should detect prototype manipulation", () => {
      const code = "Object.prototype.hack = 1;";
      const found = scanForBannedIdentifiers(code);

      expect(found).toContain("prototype");
    });

    it("should ignore identifiers in string literals", () => {
      const code = 'const msg = "do not require this";';
      const found = scanForBannedIdentifiers(code);

      expect(found).not.toContain("require");
    });

    it("should ignore identifiers in template literals", () => {
      const code = "const msg = `eval is not used here`;";
      const found = scanForBannedIdentifiers(code);

      expect(found).not.toContain("eval");
    });

    it("should ignore identifiers in comments", () => {
      const code = `
        // This uses require
        /* const x = require('fs'); */
        const y = 1;
      `;
      const found = scanForBannedIdentifiers(code);

      expect(found).not.toContain("require");
    });

    it("should detect multiple violations", () => {
      const code = `
        const fs = require("fs");
        eval("code");
        process.exit(1);
      `;
      const found = scanForBannedIdentifiers(code);

      expect(found).toContain("require");
      expect(found).toContain("eval");
      expect(found).toContain("process");
    });

    it("should handle clean code with no violations", () => {
      const code = `
        const result = await tools.exec({ command: ["ls"] });
        return result.stdout;
      `;
      const found = scanForBannedIdentifiers(code);

      expect(found).toHaveLength(0);
    });
  });

  describe("Security Constants", () => {
    it("should define banned identifiers", () => {
      expect(BANNED_IDENTIFIERS).toContain("require");
      expect(BANNED_IDENTIFIERS).toContain("import");
      expect(BANNED_IDENTIFIERS).toContain("eval");
      expect(BANNED_IDENTIFIERS).toContain("Function");
      expect(BANNED_IDENTIFIERS).toContain("process");
    });
  });
});
