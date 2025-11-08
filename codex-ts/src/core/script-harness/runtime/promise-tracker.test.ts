/**
 * Tests for Promise lifecycle tracking
 *
 * Phase 4.4 - Script Harness: Promise Tracker
 * Test scenarios from SCRIPT_HARNESS_DESIGN_FINAL.md Section 3.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PromiseTracker, DetachedPromiseError } from "./promise-tracker.js";

describe("Promise Tracker - Lifecycle Management", () => {
  let tracker: PromiseTracker;

  beforeEach(() => {
    tracker = new PromiseTracker("scr_test_123", 4);
    vi.useFakeTimers();
  });

  afterEach(() => {
    tracker.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Promise Registration", () => {
    it("should register a new promise with unique ID", () => {
      const controller = new AbortController();
      const promise = Promise.resolve("result");

      const id = tracker.register("testTool", promise, controller);

      expect(id).toBe("tool_0");
      expect(tracker.getPendingIds()).toContain(id);
    });

    it("should increment tool call count on registration", () => {
      const controller = new AbortController();
      const promise = Promise.resolve("result");

      tracker.register("tool1", promise, controller);
      tracker.register("tool2", promise, controller);

      expect(tracker.getToolCallCount()).toBe(2);
    });

    it("should generate sequential IDs", () => {
      const controller = new AbortController();
      const promise = Promise.resolve("result");

      const id1 = tracker.register("tool1", promise, controller);
      const id2 = tracker.register("tool2", promise, controller);
      const id3 = tracker.register("tool3", promise, controller);

      expect(id1).toBe("tool_0");
      expect(id2).toBe("tool_1");
      expect(id3).toBe("tool_2");
    });

    it("should track multiple pending promises", () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const promise1 = new Promise(() => {});
      const promise2 = new Promise(() => {});

      tracker.register("tool1", promise1, controller1);
      tracker.register("tool2", promise2, controller2);

      expect(tracker.getPendingIds()).toHaveLength(2);
    });
  });

  describe("Promise Resolution", () => {
    it("should move promise to completed on resolution", async () => {
      const controller = new AbortController();
      const promise = Promise.resolve("success");

      const id = tracker.register("testTool", promise, controller);

      // Wait for promise to settle
      await promise;
      await vi.advanceTimersByTimeAsync(10);

      expect(tracker.getPendingIds()).not.toContain(id);
      expect(tracker.getCompletedIds()).toContain(id);
    });

    it("should store result value on resolution", async () => {
      const controller = new AbortController();
      const promise = Promise.resolve({ data: "test" });

      const id = tracker.register("testTool", promise, controller);

      await promise;
      await vi.advanceTimersByTimeAsync(10);

      const info = tracker.getPromiseInfo(id);
      expect(info?.status).toBe("resolved");
      expect(info?.result).toEqual({ data: "test" });
    });

    it("should move promise to completed on rejection", async () => {
      const controller = new AbortController();
      const promise = Promise.reject(new Error("failed"));

      const id = tracker.register("testTool", promise, controller);

      await promise.catch(() => {});
      await vi.advanceTimersByTimeAsync(10);

      expect(tracker.getPendingIds()).not.toContain(id);
      expect(tracker.getCompletedIds()).toContain(id);
    });

    it("should store error on rejection", async () => {
      const controller = new AbortController();
      const error = new Error("test error");
      const promise = Promise.reject(error);

      const id = tracker.register("testTool", promise, controller);

      await promise.catch(() => {});
      await vi.advanceTimersByTimeAsync(10);

      const info = tracker.getPromiseInfo(id);
      expect(info?.status).toBe("rejected");
      expect(info?.error).toBe(error);
    });
  });

  describe("Manual Status Updates", () => {
    it("should mark promise as complete", () => {
      const controller = new AbortController();
      const promise = new Promise(() => {});

      const id = tracker.register("testTool", promise, controller);
      tracker.markComplete(id);

      expect(tracker.getPendingIds()).not.toContain(id);
      expect(tracker.getCompletedIds()).toContain(id);
    });

    it("should mark promise as failed", () => {
      const controller = new AbortController();
      const promise = new Promise(() => {});
      const error = new Error("tool failed");

      const id = tracker.register("testTool", promise, controller);
      tracker.markFailed(id, error);

      expect(tracker.getPendingIds()).not.toContain(id);
      expect(tracker.getCompletedIds()).toContain(id);

      const info = tracker.getPromiseInfo(id);
      expect(info?.status).toBe("rejected");
      expect(info?.error).toBe(error);
    });
  });

  describe("Promise Abortion", () => {
    it("should abort a specific promise", () => {
      const controller = new AbortController();
      const promise = new Promise(() => {});

      const id = tracker.register("testTool", promise, controller);
      tracker.abort(id, "Test abort");

      expect(controller.signal.aborted).toBe(true);
      expect(tracker.getPendingIds()).not.toContain(id);
      expect(tracker.getCompletedIds()).toContain(id);

      const info = tracker.getPromiseInfo(id);
      expect(info?.status).toBe("aborted");
    });

    it("should abort all pending promises", () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const controller3 = new AbortController();

      tracker.register("tool1", new Promise(() => {}), controller1);
      tracker.register("tool2", new Promise(() => {}), controller2);
      tracker.register("tool3", new Promise(() => {}), controller3);

      tracker.abortAll("Cleanup");

      expect(controller1.signal.aborted).toBe(true);
      expect(controller2.signal.aborted).toBe(true);
      expect(controller3.signal.aborted).toBe(true);
      expect(tracker.getPendingIds()).toHaveLength(0);
    });
  });

  describe("Orphaned Promise Detection - Scenario 1", () => {
    it("should detect orphaned promises after grace period", async () => {
      const controller = new AbortController();
      // Create a promise that doesn't settle
      const promise = new Promise(() => {});

      tracker.register("slowTool", promise, controller);

      // Attach handler to prevent unhandled rejection
      const settlePromise = tracker.ensureAllSettled(250).catch((e) => e);

      // Advance through grace period
      await vi.advanceTimersByTimeAsync(250);

      const result = await settlePromise;

      expect(result).toBeInstanceOf(DetachedPromiseError);
      expect((result as DetachedPromiseError).orphanedPromises).toHaveLength(1);
      expect((result as DetachedPromiseError).orphanedPromises[0]).toContain(
        "slowTool",
      );
    });

    it("should NOT throw if all promises settle within grace period", async () => {
      const controller = new AbortController();
      let resolver: (value: string) => void;
      const promise = new Promise<string>((resolve) => {
        resolver = resolve;
      });

      tracker.register("fastTool", promise, controller);

      const settlePromise = tracker.ensureAllSettled(250);

      // Resolve promise before grace period expires
      await vi.advanceTimersByTimeAsync(100);
      resolver!("done");
      await promise;
      await vi.advanceTimersByTimeAsync(150);

      await expect(settlePromise).resolves.toBeUndefined();
    });

    it("should abort non-awaited promises automatically", async () => {
      const controller = new AbortController();
      const promise = new Promise(() => {});

      tracker.register("orphaned", promise, controller);

      const _settlePromise = tracker.ensureAllSettled(100).catch((e) => e);
      await vi.advanceTimersByTimeAsync(100);

      expect(controller.signal.aborted).toBe(true);
    });
  });

  describe("Promise.race Scenario - Scenario 2", () => {
    it("should track winner and loser in Promise.race", async () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      let resolve1: (value: string) => void;
      let _resolve2: (value: string) => void;

      const promise1 = new Promise<string>((resolve) => {
        resolve1 = resolve;
      });
      const promise2 = new Promise<string>((resolve) => {
        _resolve2 = resolve;
      });

      const id1 = tracker.register("fast", promise1, controller1);
      const id2 = tracker.register("slow", promise2, controller2);

      // Simulate Promise.race by resolving one first
      resolve1!("winner");
      await promise1;
      await vi.advanceTimersByTimeAsync(10);

      // Winner should be completed
      expect(tracker.getCompletedIds()).toContain(id1);

      // Loser should still be pending until we abort it
      expect(tracker.getPendingIds()).toContain(id2);

      // Abort the loser (as Promise.race would)
      tracker.abort(id2, "Lost race");

      expect(tracker.getCompletedIds()).toContain(id2);
      expect(tracker.getPromiseInfo(id2)?.status).toBe("aborted");
    });
  });

  describe("Concurrency Limits", () => {
    it("should track concurrent promise count", () => {
      const controller = new AbortController();

      for (let i = 0; i < 3; i++) {
        tracker.register(`tool${i}`, new Promise(() => {}), controller);
      }

      const status = tracker.getStatus();
      expect(status.pending).toBe(3);
    });

    it("should detect when at concurrency limit", () => {
      const controller = new AbortController();

      // Tracker was created with maxConcurrent = 4
      for (let i = 0; i < 4; i++) {
        tracker.register(`tool${i}`, new Promise(() => {}), controller);
      }

      expect(tracker.isAtConcurrencyLimit()).toBe(true);
    });

    it("should allow more promises after completion", async () => {
      const controller = new AbortController();

      // Fill to limit
      for (let i = 0; i < 4; i++) {
        tracker.register(`tool${i}`, Promise.resolve(`result${i}`), controller);
      }

      expect(tracker.isAtConcurrencyLimit()).toBe(true);

      // Wait for all to complete
      await vi.advanceTimersByTimeAsync(10);

      expect(tracker.isAtConcurrencyLimit()).toBe(false);

      // Can register more
      tracker.register("tool4", Promise.resolve("result4"), controller);
      expect(tracker.getPendingIds()).toHaveLength(1);
    });
  });

  describe("Partial Results Collection", () => {
    it("should collect completed results", async () => {
      const controller = new AbortController();

      const _id1 = tracker.register(
        "tool1",
        Promise.resolve({ output: "result1" }),
        controller,
      );
      const _id2 = tracker.register(
        "tool2",
        Promise.resolve({ output: "result2" }),
        controller,
      );

      await vi.advanceTimersByTimeAsync(10);

      const results = tracker.getCompletedResults();
      expect(results).toHaveLength(2);
      expect(results[0].toolName).toBe("tool1");
      expect(results[0].result).toEqual({ output: "result1" });
      expect(results[1].toolName).toBe("tool2");
      expect(results[1].result).toEqual({ output: "result2" });
    });

    it("should only include successful results", async () => {
      const controller = new AbortController();

      tracker.register(
        "success",
        Promise.resolve({ output: "good" }),
        controller,
      );
      tracker.register("failure", Promise.reject(new Error("bad")), controller);

      await vi.advanceTimersByTimeAsync(10);

      const results = tracker.getCompletedResults();
      expect(results).toHaveLength(1);
      expect(results[0].toolName).toBe("success");
    });

    it("should provide partial results when script fails", async () => {
      const controller = new AbortController();

      // 3 tools complete successfully
      tracker.register("tool1", Promise.resolve("r1"), controller);
      tracker.register("tool2", Promise.resolve("r2"), controller);
      tracker.register("tool3", Promise.resolve("r3"), controller);

      // 1 tool fails
      tracker.register("tool4", Promise.reject(new Error("fail")), controller);

      // 1 tool never completes (orphaned)
      tracker.register("tool5", new Promise(() => {}), controller);

      await vi.advanceTimersByTimeAsync(10);

      const results = tracker.getCompletedResults();
      expect(results).toHaveLength(3);
      expect(results.map((r) => r.result)).toEqual(["r1", "r2", "r3"]);
    });
  });

  describe("Metrics and Status", () => {
    it("should track elapsed time", async () => {
      await vi.advanceTimersByTimeAsync(500);

      const elapsed = tracker.getElapsedMs();
      expect(elapsed).toBeGreaterThanOrEqual(500);
    });

    it("should track peak memory usage", () => {
      tracker.updatePeakMemory(10);
      tracker.updatePeakMemory(25);
      tracker.updatePeakMemory(15);

      expect(tracker.getPeakMemoryMb()).toBe(25);
    });

    it("should provide status summary", () => {
      const controller = new AbortController();

      tracker.register("tool1", new Promise(() => {}), controller);
      tracker.register("tool2", new Promise(() => {}), controller);

      const status = tracker.getStatus();
      expect(status.pending).toBe(2);
      expect(status.completed).toBe(0);
      expect(status.total).toBe(2);
      expect(status.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it("should get promise info by ID", async () => {
      const controller = new AbortController();
      const promise = Promise.resolve("result");

      const id = tracker.register("testTool", promise, controller);
      await promise;
      await vi.advanceTimersByTimeAsync(10);

      const info = tracker.getPromiseInfo(id);
      expect(info?.toolName).toBe("testTool");
      expect(info?.status).toBe("resolved");
      expect(info?.result).toBe("result");
    });
  });

  describe("Cleanup and Clear", () => {
    it("should clear all tracking data", () => {
      const controller = new AbortController();

      tracker.register("tool1", new Promise(() => {}), controller);
      tracker.register("tool2", new Promise(() => {}), controller);

      tracker.clear();

      expect(tracker.getPendingIds()).toHaveLength(0);
      expect(tracker.getCompletedIds()).toHaveLength(0);
      expect(tracker.getToolCallCount()).toBe(0);
    });

    it("should abort all promises when clearing", () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      tracker.register("tool1", new Promise(() => {}), controller1);
      tracker.register("tool2", new Promise(() => {}), controller2);

      tracker.clear();

      expect(controller1.signal.aborted).toBe(true);
      expect(controller2.signal.aborted).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle immediate resolution", async () => {
      const controller = new AbortController();
      const promise = Promise.resolve("immediate");

      const id = tracker.register("instant", promise, controller);

      await promise;
      await vi.advanceTimersByTimeAsync(10);

      expect(tracker.getCompletedIds()).toContain(id);
    });

    it("should handle ensureAllSettled with no pending promises", async () => {
      await expect(tracker.ensureAllSettled()).resolves.toBeUndefined();
    });

    it("should handle multiple ensureAllSettled calls", async () => {
      await expect(tracker.ensureAllSettled()).resolves.toBeUndefined();
      await expect(tracker.ensureAllSettled()).resolves.toBeUndefined();
    });

    it("should track promise with undefined result", async () => {
      const controller = new AbortController();
      const promise = Promise.resolve(undefined);

      const id = tracker.register("undef", promise, controller);
      await promise;
      await vi.advanceTimersByTimeAsync(10);

      const info = tracker.getPromiseInfo(id);
      expect(info?.status).toBe("resolved");
      expect(info?.result).toBeUndefined();
    });

    it("should handle abort of already completed promise", () => {
      const controller = new AbortController();
      const promise = Promise.resolve("done");

      const id = tracker.register("tool", promise, controller);
      tracker.markComplete(id);
      tracker.abort(id); // Should be no-op

      expect(tracker.getCompletedIds()).toContain(id);
    });
  });

  describe("Script ID Tracking", () => {
    it("should store script ID", () => {
      expect(tracker.scriptId).toBe("scr_test_123");
    });

    it("should use script ID in error context", async () => {
      const controller = new AbortController();
      tracker.register("orphan", new Promise(() => {}), controller);

      const settlePromise = tracker.ensureAllSettled(100).catch((e) => e);
      await vi.advanceTimersByTimeAsync(100);

      const result = await settlePromise;
      expect(result).toBeInstanceOf(DetachedPromiseError);
    });
  });
});
