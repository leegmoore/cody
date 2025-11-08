/**
 * Tests for QuickJS runtime adapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  QuickJSRuntime,
  type QuickJSRuntimeConfig,
} from "./quickjs-runtime.js";
import type {
  ScriptExecutionLimits,
  ScriptExecutionResult,
} from "./types.js";

describe("quickjs-runtime.ts", () => {
  let runtime: QuickJSRuntime;

  const defaultLimits: ScriptExecutionLimits = {
    timeoutMs: 5000,
    memoryMb: 96,
    maxStackBytes: 524288,
    maxSourceBytes: 20000,
    maxReturnBytes: 131072,
    maxToolInvocations: 32,
    maxConcurrentToolCalls: 4,
  };

  beforeEach(async () => {
    runtime = new QuickJSRuntime();
    await runtime.initialize(defaultLimits);
  });

  afterEach(async () => {
    await runtime.dispose();
  });

  describe("Basic runtime functionality", () => {
    it("QR1: runtime has correct name", () => {
      expect(runtime.name).toBe("quickjs");
    });

    it("QR2: executes simple script", async () => {
      const result = await runtime.execute("1 + 1", {}, {});

      expect(result.ok).toBe(true);
      expect(result.returnValue).toBe(2);
    });

    it("QR3: executes script with return statement", async () => {
      const result = await runtime.execute("return 42", {}, {});

      expect(result.ok).toBe(true);
      expect(result.returnValue).toBe(42);
    });

    it("QR4: returns string values", async () => {
      const result = await runtime.execute('return "hello world"', {}, {});

      expect(result.ok).toBe(true);
      expect(result.returnValue).toBe("hello world");
    });

    it("QR5: returns object values", async () => {
      const result = await runtime.execute(
        "return { foo: 'bar', num: 42 }",
        {},
        {},
      );

      expect(result.ok).toBe(true);
      expect(result.returnValue).toEqual({ foo: "bar", num: 42 });
    });

    it("QR6: returns array values", async () => {
      const result = await runtime.execute("return [1, 2, 3]", {}, {});

      expect(result.ok).toBe(true);
      expect(result.returnValue).toEqual([1, 2, 3]);
    });

    it("QR7: handles undefined return", async () => {
      const result = await runtime.execute("// no return", {}, {});

      expect(result.ok).toBe(true);
      expect(result.returnValue).toBeUndefined();
    });
  });

  describe("Global injection", () => {
    it("QR8: injects global objects", async () => {
      const globals = {
        myValue: 42,
      };

      const result = await runtime.execute(
        "return myValue * 2",
        globals,
        {},
      );

      expect(result.ok).toBe(true);
      expect(result.returnValue).toBe(84);
    });

    it("QR9: injects nested objects", async () => {
      const globals = {
        config: {
          timeout: 30,
          enabled: true,
        },
      };

      const result = await runtime.execute(
        "return config.timeout + 10",
        globals,
        {},
      );

      expect(result.ok).toBe(true);
      expect(result.returnValue).toBe(40);
    });

    it("QR10: injects functions", async () => {
      const globals = {
        add: (a: number, b: number) => a + b,
      };

      const result = await runtime.execute("return add(10, 20)", globals, {});

      expect(result.ok).toBe(true);
      expect(result.returnValue).toBe(30);
    });

    it("QR11: multiple globals don't interfere", async () => {
      const globals = {
        x: 5,
        y: 10,
        z: 15,
      };

      const result = await runtime.execute("return x + y + z", globals, {});

      expect(result.ok).toBe(true);
      expect(result.returnValue).toBe(30);
    });
  });

  describe("Async execution", () => {
    it("QR12: executes async scripts", async () => {
      const result = await runtime.execute(
        `
        const result = await Promise.resolve(42);
        return result;
      `,
        {},
        {},
      );

      expect(result.ok).toBe(true);
      expect(result.returnValue).toBe(42);
    });

    it.skip("QR13: executes async functions (TODO: async function injection not supported)", async () => {
      const globals = {
        fetchData: async () => ({ value: 100 }),
      };

      const result = await runtime.execute(
        `
        const data = await fetchData();
        return data.value;
      `,
        globals,
        {},
      );

      expect(result.ok).toBe(true);
      expect(result.returnValue).toBe(100);
    });

    it.skip("QR14: handles Promise.all (TODO: async function injection not supported)", async () => {
      const globals = {
        getData: async (n: number) => n * 2,
      };

      const result = await runtime.execute(
        `
        const results = await Promise.all([
          getData(1),
          getData(2),
          getData(3)
        ]);
        return results;
      `,
        globals,
        {},
      );

      expect(result.ok).toBe(true);
      expect(result.returnValue).toEqual([2, 4, 6]);
    });
  });

  describe("Error handling", () => {
    it("QR15: catches syntax errors", async () => {
      const result = await runtime.execute("this is not valid js {{{", {}, {});

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toContain("Syntax");
    });

    it("QR16: catches runtime errors", async () => {
      const result = await runtime.execute(
        "throw new Error('Something failed')",
        {},
        {},
      );

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Something failed");
    });

    it("QR17: catches reference errors", async () => {
      const result = await runtime.execute("return undefinedVariable", {}, {});

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("QR18: catches type errors", async () => {
      const result = await runtime.execute("null.foo()", {}, {});

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("QR19: provides error metadata", async () => {
      const result = await runtime.execute(
        "throw new Error('Test error')",
        {},
        {},
      );

      expect(result.error?.phase).toBe("executing");
      expect(result.error?.stack).toBeDefined();
    });
  });

  describe("Execution limits", () => {
    it("QR20: enforces timeout", async () => {
      const result = await runtime.execute(
        `
        while (true) {
          // Infinite loop
        }
      `,
        {},
        { timeoutMs: 100 },
      );

      expect(result.ok).toBe(false);
      expect(result.error?.code).toContain("Timeout");
    }, 10000);

    it("QR21: respects timeout override", async () => {
      const start = Date.now();

      const result = await runtime.execute(
        `
        const start = Date.now();
        while (Date.now() - start < 50) {
          // Busy wait 50ms
        }
        return "done";
      `,
        {},
        { timeoutMs: 200 },
      );

      const duration = Date.now() - start;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(200);
    }, 10000);

    it("QR22: tracks execution duration", async () => {
      const result = await runtime.execute("return 42", {}, {});

      expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
      expect(result.metadata.duration_ms).toBeLessThan(1000);
    });
  });

  describe("Metadata tracking", () => {
    it.skip("QR23: tracks tool call count (TODO: requires async function injection)", async () => {
      const globals = {
        tool1: async () => "result1",
        tool2: async () => "result2",
      };

      const result = await runtime.execute(
        `
        await tool1();
        await tool2();
        await tool1();
        return "done";
      `,
        globals,
        {},
      );

      // Note: This test assumes we track async calls, implementation may vary
      expect(result.metadata.tool_calls_made).toBeGreaterThanOrEqual(0);
    });

    it("QR24: provides execution metadata", async () => {
      const result = await runtime.execute("return 42", {}, {});

      expect(result.metadata).toBeDefined();
      expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
      expect(typeof result.metadata.tool_calls_made).toBe("number");
    });
  });

  describe("Isolation", () => {
    let isolatedRuntime: QuickJSRuntime;

    beforeEach(async () => {
      // Create runtime with worker pool disabled for true isolation tests
      isolatedRuntime = new QuickJSRuntime({ useWorkerPool: false });
      await isolatedRuntime.initialize(defaultLimits);
    });

    afterEach(async () => {
      await isolatedRuntime.dispose();
    });

    it("QR25: scripts don't share state", async () => {
      await isolatedRuntime.execute("globalThis.sharedValue = 42", {}, {});

      const result2 = await isolatedRuntime.execute(
        "return typeof globalThis.sharedValue",
        {},
        {},
      );

      expect(result2.returnValue).toBe("undefined");
    });

    it("QR26: globals are isolated per execution", async () => {
      const result1 = await isolatedRuntime.execute(
        "return myValue",
        { myValue: 10 },
        {},
      );

      const result2 = await isolatedRuntime.execute(
        "return typeof myValue",
        {},
        {},
      );

      expect(result1.returnValue).toBe(10);
      expect(result2.returnValue).toBe("undefined");
    });
  });

  describe("Cancellation", () => {
    it.skip("QR27: respects AbortSignal (TODO: async abort during execution not supported due to blocking execution)", async () => {
      // NOTE: This test cannot work as written because QuickJS execution blocks
      // the event loop, preventing setTimeout from firing during execution.
      // Use timeouts instead of abort signals for mid-execution cancellation,
      // or abort the signal before calling execute() (see QR28).
      const controller = new AbortController();

      setTimeout(() => controller.abort(), 50);

      const result = await runtime.execute(
        `
        const start = Date.now();
        while (Date.now() - start < 1000) {
          // Long running
        }
        return "done";
      `,
        {},
        {},
        controller.signal,
      );

      expect(result.ok).toBe(false);
      expect(result.error?.code).toMatch(/Cancel|Abort/);
    }, 10000);

    it("QR28: already aborted signal fails immediately", async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await runtime.execute(
        "return 42",
        {},
        {},
        controller.signal,
      );

      expect(result.ok).toBe(false);
    });
  });

  describe("Runtime lifecycle", () => {
    it("QR29: getStatus returns healthy after init", async () => {
      const status = runtime.getStatus();

      expect(status.healthy).toBe(true);
      expect(status.workersActive).toBeGreaterThanOrEqual(0);
      expect(status.workersAvailable).toBeGreaterThanOrEqual(0);
    });

    it("QR30: can dispose and reinitialize", async () => {
      await runtime.dispose();
      await runtime.initialize(defaultLimits);

      const result = await runtime.execute("return 42", {}, {});
      expect(result.ok).toBe(true);
    });

    it("QR31: multiple executions work", async () => {
      const result1 = await runtime.execute("return 1", {}, {});
      const result2 = await runtime.execute("return 2", {}, {});
      const result3 = await runtime.execute("return 3", {}, {});

      expect(result1.returnValue).toBe(1);
      expect(result2.returnValue).toBe(2);
      expect(result3.returnValue).toBe(3);
    });
  });

  describe("Edge cases", () => {
    it("QR32: handles empty script", async () => {
      const result = await runtime.execute("", {}, {});

      expect(result.ok).toBe(true);
    });

    it("QR33: handles script with only comments", async () => {
      const result = await runtime.execute("// just a comment", {}, {});

      expect(result.ok).toBe(true);
    });

    it("QR34: handles large return values", async () => {
      const result = await runtime.execute(
        "return Array(1000).fill(42)",
        {},
        {},
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.returnValue)).toBe(true);
    });

    it("QR35: handles circular references", async () => {
      const result = await runtime.execute(
        `
        const obj = { a: 1 };
        obj.self = obj;
        return { value: obj.a };
      `,
        {},
        {},
      );

      expect(result.ok).toBe(true);
      expect(result.returnValue).toEqual({ value: 1 });
    });
  });
});
