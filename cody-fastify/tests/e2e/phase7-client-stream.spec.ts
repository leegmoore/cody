import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { createServer } from "../../src/server.ts";
import { clientStreamManager } from "../../src/api/client-stream/client-stream-manager.ts";
import { redisClient } from "../../src/api/client-stream/redis-client.ts";
import { processMessage } from "../../src/api/services/message-processor.ts";
import { convexClient } from "../../src/api/services/convex-client.ts";
import { api } from "../../convex/_generated/api.js";
import type { Conversation } from "codex-ts/src/core/conversation.ts";
import type { Event } from "codex-ts/src/protocol/protocol.ts";
import {
  parseSSE,
  SSEEvent,
  SSEStreamParser,
} from "./utils/sse";

interface RunningServer {
  app: FastifyInstance;
  baseUrl: string;
}

interface SeedTurnOptions {
  toolSucceeds?: boolean;
  includeThinking?: boolean;
  failureMessage?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe("Phase 7 - Client Stream Manager", () => {
  test.beforeEach(async () => {
    await redisClient.flushall();
  });

  test("TC-CSM-1: Multi-worker SSE (Redis)", async () => {
    const { turnId } = await seedTurn({
      toolSucceeds: true,
      includeThinking: true,
    });

    await withServers(2, async ([workerA, workerB]) => {
      const [streamA, streamB] = await Promise.all([
        collectFullStream(workerA.baseUrl, turnId, {
          query: { toolFormat: "full", thinkingFormat: "full" },
        }),
        collectFullStream(workerB.baseUrl, turnId, {
          query: { toolFormat: "full", thinkingFormat: "full" },
        }),
      ]);

      expect(streamA.events.length).toBeGreaterThan(0);
      expect(streamA.events.map((e) => e.id)).toEqual(
        streamB.events.map((e) => e.id),
      );
      expect(
        streamA.events.some((event) => event.event === "tool_call_begin"),
      ).toBe(true);
      expect(
        streamA.events.some((event) => event.event === "tool_call_end"),
      ).toBe(true);
    });
  });

  test("TC-CSM-2: Resume After Refresh", async () => {
    const { turnId } = await seedTurn({
      toolSucceeds: true,
      includeThinking: true,
    });

    await withServers(1, async ([worker]) => {
      const partial = await readPartialStream(worker.baseUrl, turnId, {
        take: 2,
        query: { toolFormat: "full", thinkingFormat: "full" },
      });

      const partialLastId = requireEventId(partial.lastEventId);

      const resumed = await collectFullStream(worker.baseUrl, turnId, {
        query: { toolFormat: "full", thinkingFormat: "full" },
        headers: { "Last-Event-ID": partialLastId },
      });

      expect(resumed.events.length).toBeGreaterThan(0);
      const firstResumedId = requireEventId(
        resumed.events.find((event) => event.id)?.id,
      );
      const resumedSeq = extractSequence(firstResumedId);
      const partialSeq = extractSequence(partialLastId);
      expect(resumedSeq).toBeGreaterThan(partialSeq);
      expect(
        resumed.events.some((event) => event.event === "task_complete"),
      ).toBe(true);
    });
  });

  test("TC-CSM-3: Concurrent Subscribers with Decorators", async () => {
    const { turnId } = await seedTurn({
      toolSucceeds: true,
      includeThinking: true,
    });

    await withServers(1, async ([worker]) => {
      const [full, summary] = await Promise.all([
        collectFullStream(worker.baseUrl, turnId, {
          query: { toolFormat: "full", thinkingFormat: "full" },
        }),
        collectFullStream(worker.baseUrl, turnId, {
          query: { toolFormat: "none", thinkingFormat: "summary" },
        }),
      ]);

      const fullEvents = full.events.map((event) => event.event);
      expect(fullEvents).toContain("tool_call_begin");
      expect(fullEvents).toContain("tool_call_end");
      expect(fullEvents).toContain("thinking_delta");

      const summaryEvents = summary.events.map((event) => event.event);
      expect(summaryEvents).not.toContain("tool_call_begin");
      expect(summaryEvents).not.toContain("tool_call_end");
      expect(summaryEvents).toContain("thinking_started");
      expect(summaryEvents).toContain("thinking_completed");
      expect(summaryEvents).not.toContain("thinking_delta");
    });
  });

  test("TC-CSM-4: Tool Failure Surfaces Error", async () => {
    const { turnId } = await seedTurn({
      toolSucceeds: false,
      includeThinking: true,
      failureMessage: "missing-phase7.txt not found",
    });

    await withServers(1, async ([worker]) => {
      const stream = await collectFullStream(worker.baseUrl, turnId, {
        query: { toolFormat: "full", thinkingFormat: "full" },
      });

      const failureEvent = stream.events.find(
        (event) => event.event === "tool_call_end",
      );
      expect(failureEvent).toBeTruthy();
      if (!failureEvent) {
        throw new Error("tool_call_end event missing");
      }
      const failurePayload = parseEventPayload(failureEvent);
      expect(failurePayload?.status).toBe("failed");

      const eventTypes = stream.events.map((event) => event.event);
      expect(eventTypes).toContain("error");
      expect(eventTypes).toContain("turn_aborted");

      const errorEvent = stream.events.find(
        (event) => event.event === "error",
      );
      expect(errorEvent).toBeTruthy();
      if (!errorEvent) {
        throw new Error("error event missing");
      }
      const errorPayload = parseEventPayload(errorEvent);
      expect(
        (errorPayload?.message as string | undefined)?.toLowerCase() ?? "",
      ).toContain("missing-phase7.txt");

      const turn = await fetchTurn(worker.baseUrl, turnId);
      expect(turn.status).toBe("error");
    });
  });

  test("TC-CSM-5: Tool & Thinking Events Emitted", async () => {
    const { turnId } = await seedTurn({
      toolSucceeds: true,
      includeThinking: true,
    });

    await withServers(1, async ([worker]) => {
      const stream = await collectFullStream(worker.baseUrl, turnId, {
        query: { toolFormat: "full", thinkingFormat: "full" },
      });

      const events = stream.events.map((event) => event.event);
      expect(events).toContain("tool_call_begin");
      expect(events).toContain("tool_call_end");
      expect(events).toContain("thinking_started");
      expect(events).toContain("thinking_delta");
      expect(events).toContain("thinking_completed");
    });
  });

  test("TC-CSM-8: Conversation history receives thinking entries", async () => {
    const { conversationId } = await seedConversationWithProcessMessage();

    await withServers(1, async ([worker]) => {
      const conversation = await fetchConversation(
        worker.baseUrl,
        conversationId,
      );

      expect(Array.isArray(conversation.history)).toBe(true);
      const thinkingEntries = conversation.history.filter(
        (item: { type?: string }) => item.type === "thinking",
      );

      expect(thinkingEntries.length).toBeGreaterThan(0);
      const mergedText = thinkingEntries
        .map((entry: { content?: string }) => entry.content ?? "")
        .join(" ");
      expect(mergedText).toContain("Initial thought");
      expect(mergedText).toContain("Next steps");
    });
  });

  test("TC-CSM-6: Redis Persistence Across Restart", async () => {
    const tempHome = await mkdtemp(join(tmpdir(), "phase7-restart-"));
    const previousHome = process.env.CODY_HOME;
    let worker = await startWorker(tempHome);
    const { turnId } = await seedTurn({
      toolSucceeds: true,
      includeThinking: true,
    });

    try {
      const partial = await readPartialStream(worker.baseUrl, turnId, {
        take: 2,
        query: { toolFormat: "full", thinkingFormat: "full" },
      });
      const partialLastId = requireEventId(partial.lastEventId);

      await worker.app.close();
      worker = await startWorker(tempHome);

      const resumed = await collectFullStream(worker.baseUrl, turnId, {
        query: { toolFormat: "full", thinkingFormat: "full" },
        headers: { "Last-Event-ID": partialLastId },
      });

      expect(resumed.events.length).toBeGreaterThan(0);
      expect(
        resumed.events.some((event) => event.event === "task_complete"),
      ).toBe(true);
    } finally {
      await worker.app.close();
      if (previousHome !== undefined) {
        process.env.CODY_HOME = previousHome;
      } else {
        delete process.env.CODY_HOME;
      }
      await rm(tempHome, { recursive: true, force: true });
    }
  });

  test("TC-CSM-7: Backpressure & Batching", async () => {
    const { turnId } = await seedTurn({
      toolSucceeds: true,
      includeThinking: true,
    });

    await withServers(1, async ([worker]) => {
      const events = await streamWithBackpressure(worker.baseUrl, turnId, {
        query: { toolFormat: "full", thinkingFormat: "full" },
        delayMs: 300,
      });

      expect(events.length).toBeGreaterThan(3);
      ensureMonotonicIds(events);
      expect(events.at(-1)?.event).toBe("task_complete");
    });
  });
});
async function withServers(
  count: number,
  fn: (servers: RunningServer[], context: { codyHome: string }) => Promise<void>,
) {
  const tempHome = await mkdtemp(join(tmpdir(), "phase7-home-"));
  const previousHome = process.env.CODY_HOME;
  const servers: RunningServer[] = [];

  try {
    for (let i = 0; i < count; i++) {
      servers.push(await startWorker(tempHome));
    }
    await fn(servers, { codyHome: tempHome });
  } finally {
    await Promise.all(servers.map((server) => server.app.close()));
    if (previousHome !== undefined) {
      process.env.CODY_HOME = previousHome;
    } else {
      delete process.env.CODY_HOME;
    }
    await rm(tempHome, { recursive: true, force: true });
  }
}

async function startWorker(codyHome: string): Promise<RunningServer> {
  const previousHome = process.env.CODY_HOME;
  process.env.CODY_HOME = codyHome;
  const app = await createServer();
  await app.listen({ port: 0, host: "127.0.0.1" });
  if (previousHome !== undefined) {
    process.env.CODY_HOME = previousHome;
  } else {
    delete process.env.CODY_HOME;
  }
  const address = app.server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { app, baseUrl };
}

async function seedTurn(
  options: SeedTurnOptions = {},
): Promise<{ turnId: string; conversationId: string }> {
  const turnId = randomUUID();
  const conversationId = randomUUID();
  const submissionId = randomUUID();

  await clientStreamManager.createTurn(
    turnId,
    conversationId,
    submissionId,
    "openai",
    "responses",
    "gpt-5-codex",
  );

  await clientStreamManager.addEvent(turnId, { type: "task_started" });

  if (options.includeThinking !== false) {
    await clientStreamManager.addEvent(turnId, {
      type: "agent_reasoning",
      text: "Planning tool usage",
    });
    await clientStreamManager.addEvent(turnId, {
      type: "agent_reasoning_delta",
      delta: "Reading file contents...",
    });
  }

  const callId = `call_${randomUUID()}`;
  await clientStreamManager.addEvent(turnId, {
    type: "raw_response_item",
    item: {
      type: "function_call",
      call_id: callId,
      name: "readFile",
      arguments: JSON.stringify({ filePath: "README.md" }),
    },
  });

  await clientStreamManager.addEvent(turnId, {
    type: "raw_response_item",
    item: {
      type: "function_call_output",
      call_id: callId,
      output:
        options.toolSucceeds === false
          ? {
              success: false,
              content:
                options.failureMessage ??
                "failed to read file: ENOENT missing-phase7.txt",
            }
          : {
              success: true,
              content: "Sample README contents",
            },
    },
  });

  if (options.toolSucceeds === false) {
    await clientStreamManager.addEvent(turnId, {
      type: "error",
      message: options.failureMessage ?? "Tool execution failed",
    });
    await clientStreamManager.addEvent(turnId, {
      type: "turn_aborted",
      reason: "replaced",
    });
    await clientStreamManager.updateTurnStatus(turnId, "error");
  } else {
    await clientStreamManager.addEvent(turnId, {
      type: "agent_message",
      message: "README summary complete.",
    });
    await clientStreamManager.addEvent(turnId, {
      type: "task_complete",
      last_agent_message: "README summary complete.",
    });
  }

  return { turnId, conversationId };
}

async function seedConversationWithProcessMessage() {
  const conversationId = randomUUID();
  const turnId = randomUUID();
  const submissionId = randomUUID();

  await convexClient.mutation(api.threads.create, {
    externalId: conversationId,
    modelProviderId: "openai",
    modelProviderApi: "responses",
    model: "gpt-5-codex",
    title: "Thinking Conversation",
    summary: "Seeded for tests",
  });

  await clientStreamManager.createTurn(
    turnId,
    conversationId,
    submissionId,
    "openai",
    "responses",
    "gpt-5-codex",
  );

  const events: Event[] = [
    { id: submissionId, msg: { type: "task_started" } },
    {
      id: submissionId,
      msg: { type: "agent_reasoning", text: "Initial thought: understand task." },
    },
    {
      id: submissionId,
      msg: { type: "agent_reasoning_delta", delta: " Next steps: read files." },
    },
    {
      id: submissionId,
      msg: { type: "agent_message", message: "All done." },
    },
    {
      id: submissionId,
      msg: { type: "task_complete", last_agent_message: "All done." },
    },
  ];

  const fakeConversation = createStubConversation(events);
  await processMessage(
    fakeConversation,
    submissionId,
    turnId,
    conversationId,
  );

  return { conversationId, turnId };
}

function createStubConversation(events: Event[]): Conversation {
  let index = 0;
  const stub = {
    async nextEvent() {
      if (index >= events.length) {
        throw new Error("No more events");
      }
      return events[index++];
    },
  };
  return stub as Conversation;
}
async function collectFullStream(
  baseUrl: string,
  turnId: string,
  options?: {
    query?: Record<string, string>;
    headers?: Record<string, string>;
  },
) {
  const url = buildUrl(
    baseUrl,
    `/api/v1/turns/${turnId}/stream-events`,
    options?.query,
  );
  const response = await fetch(url, { headers: options?.headers });
  expect(response.status).toBe(200);
  const text = await response.text();
  return { events: parseSSE(text), text };
}

async function readPartialStream(
  baseUrl: string,
  turnId: string,
  options: {
    take: number;
    query?: Record<string, string>;
  },
) {
  const url = buildUrl(
    baseUrl,
    `/api/v1/turns/${turnId}/stream-events`,
    options.query,
  );
  const controller = new AbortController();
  const response = await fetch(url, { signal: controller.signal });
  expect(response.status).toBe(200);

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("SSE stream did not provide a readable body.");
  }

  const decoder = new TextDecoder();
  const parser = new SSEStreamParser();
  const events: SSEEvent[] = [];
  let lastEventId: string | undefined;

  try {
    while (events.length < options.take) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      for (const event of parser.feed(chunk)) {
        events.push(event);
        if (event.id) {
          lastEventId = event.id;
        }
        if (events.length >= options.take) {
          controller.abort();
          break;
        }
      }
    }
  } catch (error) {
    if ((error as { name?: string }).name !== "AbortError") {
      throw error;
    }
  }

  parser.flush().forEach((event) => {
    if (events.length < options.take) {
      events.push(event);
      if (event.id) {
        lastEventId = event.id;
      }
    }
  });

  return { events, lastEventId };
}

async function streamWithBackpressure(
  baseUrl: string,
  turnId: string,
  options: {
    query?: Record<string, string>;
    delayMs?: number;
  },
) {
  const url = buildUrl(
    baseUrl,
    `/api/v1/turns/${turnId}/stream-events`,
    options.query,
  );
  const response = await fetch(url);
  expect(response.status).toBe(200);

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("SSE stream did not provide a readable body.");
  }

  const parser = new SSEStreamParser();
  const decoder = new TextDecoder();
  const events: SSEEvent[] = [];

  let finished = false;
  while (!finished) {
    const { done, value } = await reader.read();
    if (done) {
      finished = true;
      break;
    }
    if (options.delayMs) {
      await delay(options.delayMs);
    }
    const chunk = decoder.decode(value, { stream: true });
    events.push(...parser.feed(chunk));
  }

  events.push(...parser.flush());
  return events;
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | undefined>,
) {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

function parseEventPayload(event: SSEEvent) {
  if (!event.data) {
    return undefined;
  }
  try {
    return JSON.parse(event.data);
  } catch {
    return undefined;
  }
}

function extractSequence(id: string): number {
  const parts = id.split(":");
  return Number.parseInt(parts.at(-1) ?? "0", 10);
}

function ensureMonotonicIds(events: SSEEvent[]) {
  const ids = events
    .map((event) => event.id)
    .filter((id): id is string => Boolean(id))
    .map(extractSequence);
  for (let i = 1; i < ids.length; i++) {
    expect(ids[i]).toBeGreaterThan(ids[i - 1]);
  }
}

function requireEventId(id?: string): string {
  if (!id) {
    throw new Error("Expected Last-Event-ID to be present");
  }
  return id;
}

async function fetchTurn(baseUrl: string, turnId: string) {
  const response = await fetch(`${baseUrl}/api/v1/turns/${turnId}`);
  expect(response.status).toBe(200);
  return response.json() as Promise<{
    status: string;
    result?: unknown;
  }>;
}

async function fetchConversation(baseUrl: string, conversationId: string) {
  const response = await fetch(
    `${baseUrl}/api/v1/conversations/${conversationId}`,
  );
  expect(response.status).toBe(200);
  return response.json() as Promise<{
    history: Array<Record<string, unknown>>;
  }>;
}
