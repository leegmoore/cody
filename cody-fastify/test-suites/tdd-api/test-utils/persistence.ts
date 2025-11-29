import { expect } from "bun:test";
import type { ThreadBody } from "./types";
import { DEFAULT_PERSISTENCE_TIMEOUT, DEFAULT_RETRY_INTERVAL } from "./index";

/**
 * Poll thread endpoint until run(s) reach terminal status
 */
export async function waitForPersistence(
  baseUrl: string,
  threadId: string,
  options?: {
    expectedRunCount?: number;
    timeoutMs?: number;
    retryIntervalMs?: number;
  },
): Promise<ThreadBody> {
  const expectedRunCount = options?.expectedRunCount ?? 1;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_PERSISTENCE_TIMEOUT;
  const retryIntervalMs = options?.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL;

  const startTime = Date.now();

  let threadBody: ThreadBody = {
    thread: {} as ThreadBody["thread"],
    runs: [],
  };

  // Poll thread endpoint until run(s) appear with terminal status
  let runsComplete = false;
  while (!runsComplete) {
    const threadRes = await fetch(`${baseUrl}/api/v2/threads/${threadId}`);
    expect(threadRes.status).toBe(200);
    threadBody = (await threadRes.json()) as ThreadBody;

    // Check if all expected runs have been persisted with terminal status
    if (threadBody.runs.length >= expectedRunCount) {
      const completeRuns = threadBody.runs.filter(
        (run) =>
          run.status === "complete" ||
          run.status === "error" ||
          run.status === "aborted",
      );
      if (completeRuns.length >= expectedRunCount) {
        runsComplete = true;
        break;
      }
    }

    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      const runStatuses = threadBody.runs.map((r) => r.status).join(", ");
      throw new Error(
        `Timeout waiting for run persistence. Thread has ${threadBody.runs.length} runs with statuses: [${runStatuses}]. Expected ${expectedRunCount} complete runs.`,
      );
    }

    // Wait before retry
    await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
  }

  return threadBody;
}
