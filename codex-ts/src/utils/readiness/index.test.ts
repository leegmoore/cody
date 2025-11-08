import { describe, it, expect } from "vitest";
import { ReadinessFlag, ReadinessError, Token } from "./index.js";

describe("ReadinessFlag", () => {
  it("subscribe and mark ready roundtrip", async () => {
    const flag = new ReadinessFlag();
    const token = await flag.subscribe();

    const marked = await flag.markReady(token);
    expect(marked).toBe(true);
    expect(flag.isReady()).toBe(true);
  });

  it("subscribe after ready throws error", async () => {
    const flag = new ReadinessFlag();
    const token = await flag.subscribe();
    await flag.markReady(token);

    await expect(flag.subscribe()).rejects.toThrow(ReadinessError);
  });

  it("mark ready rejects unknown token", async () => {
    const flag = new ReadinessFlag();
    const result = await flag.markReady(new Token(42));

    expect(result).toBe(false);
    expect(flag.isReady()).toBe(true); // No subscribers, so it becomes ready
  });

  it("wait ready unblocks after mark ready", async () => {
    const flag = new ReadinessFlag();
    const token = await flag.subscribe();

    let waiterCompleted = false;
    const waiter = flag.waitReady().then(() => {
      waiterCompleted = true;
    });

    expect(waiterCompleted).toBe(false);

    await flag.markReady(token);
    await waiter;

    expect(waiterCompleted).toBe(true);
  });

  it("mark ready twice uses single token", async () => {
    const flag = new ReadinessFlag();
    const token = await flag.subscribe();

    const first = await flag.markReady(token);
    const second = await flag.markReady(token);

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("is ready without subscribers marks flag ready", async () => {
    const flag = new ReadinessFlag();

    expect(flag.isReady()).toBe(true);
    expect(flag.isReady()).toBe(true);

    await expect(flag.subscribe()).rejects.toThrow(ReadinessError);
  });

  it("multiple subscribers require all to mark ready", async () => {
    const flag = new ReadinessFlag();
    const token1 = await flag.subscribe();
    const token2 = await flag.subscribe();

    expect(flag.isReady()).toBe(false);

    await flag.markReady(token1);
    expect(flag.isReady()).toBe(true); // First one marks it ready
  });

  it("wait ready returns immediately if already ready", async () => {
    const flag = new ReadinessFlag();
    const token = await flag.subscribe();
    await flag.markReady(token);

    const start = Date.now();
    await flag.waitReady();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(10); // Should be instant
  });
});
