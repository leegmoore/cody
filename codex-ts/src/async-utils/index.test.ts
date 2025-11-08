import { describe, it, expect } from "vitest";
import { CancelErr, orCancel } from "./index.js";

describe("orCancel", () => {
  it("returns Ok when future completes first", async () => {
    const abortController = new AbortController();
    const value = async () => 42;

    const result = await orCancel(value(), abortController.signal);

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("returns Err when signal aborted first", async () => {
    const abortController = new AbortController();

    // Cancel after 10ms
    const cancelPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        abortController.abort();
        resolve();
      }, 10);
    });

    // Future that takes 100ms
    const futurePromise = orCancel(
      new Promise<number>((resolve) => {
        setTimeout(() => resolve(7), 100);
      }),
      abortController.signal,
    );

    const result = await futurePromise;

    await cancelPromise;
    expect(result).toEqual({ ok: false, error: CancelErr.Cancelled });
  });

  it("returns Err when signal already aborted", async () => {
    const abortController = new AbortController();
    abortController.abort();

    const futurePromise = orCancel(
      new Promise<number>((resolve) => {
        setTimeout(() => resolve(5), 50);
      }),
      abortController.signal,
    );

    const result = await futurePromise;

    expect(result).toEqual({ ok: false, error: CancelErr.Cancelled });
  });

  it("handles synchronous completion", async () => {
    const abortController = new AbortController();

    const result = await orCancel(Promise.resolve(123), abortController.signal);

    expect(result).toEqual({ ok: true, value: 123 });
  });

  it("handles rejected promises", async () => {
    const abortController = new AbortController();
    const error = new Error("test error");

    try {
      await orCancel(Promise.reject(error), abortController.signal);
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBe(error);
    }
  });
});
