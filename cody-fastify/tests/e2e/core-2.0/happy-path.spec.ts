import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import {
  StreamEventSchema,
  type Response,
  type StreamEvent,
} from "../../../src/core/schema.js";
import { Core2TestHarness } from "../../harness/core-harness.js";
import type { MockFixtureFile } from "../../mocks/mock-stream-adapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_ROOT = join(__dirname, "../../fixtures");

const PROMPTS = {
  simpleFact: "Tell me a fun fact.",
  monads: "Explain the concept of monads step-by-step.",
  readmeSummary: "Summarize the content of README.md.",
  shortSummary: "Short summary.",
  runLs: "Run 'ls -l'.",
  turnOne: "What is the capital of France?",
  turnTwo: "And what is its most famous landmark?",
  reconnection: "Simulate SSE reconnection.",
  concurrentA: "Turn A",
  concurrentB: "Turn B",
} as const;

const FIXTURES = {
  openai: {
    simpleMessage: join(FIXTURE_ROOT, "openai/simple-message.json"),
    thinkingMessage: join(FIXTURE_ROOT, "openai/thinking-message.json"),
    toolCallOutputMessage: join(
      FIXTURE_ROOT,
      "openai/tool-call-output-message.json",
    ),
    usageMessage: join(FIXTURE_ROOT, "openai/usage-message.json"),
    simpleToolCall: join(FIXTURE_ROOT, "openai/simple-tool-call.json"),
    turn1Message: join(FIXTURE_ROOT, "openai/turn1-message.json"),
    turn2Message: join(FIXTURE_ROOT, "openai/turn2-message.json"),
    reconnection: join(FIXTURE_ROOT, "openai/reconnection.json"),
    concurrentA: join(FIXTURE_ROOT, "openai/concurrent-a.json"),
    concurrentB: join(FIXTURE_ROOT, "openai/concurrent-b.json"),
  },
  anthropic: {
    simpleMessage: join(FIXTURE_ROOT, "anthropic/simple-message.json"),
    thinkingMessage: join(FIXTURE_ROOT, "anthropic/thinking-message.json"),
  },
} as const;

const harness = new Core2TestHarness();

describe("Core 2.0 Happy Path", () => {
  beforeAll(async () => {
    await registerFixtures();
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
  }, 20_000);


  test("TC-HP-01: Simple message turn (OpenAI)", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = await harness.loadFixtureFile(
      FIXTURES.openai.simpleMessage,
    );

    const submission = await harness.submit({
      prompt: PROMPTS.simpleFact,
      model: "gpt-5-mini",
      providerId: "openai",
      turnId,
      threadId,
    });

    const events = await harness.consumeSSE(submission.streamUrl);
    const response = await harness.hydrate(events);

    const expected = materializeExpectedResponse(fixture, {
      runId: submission.runId,
      turnId,
      threadId,
      modelId: "gpt-5-mini",
      providerId: "openai",
    });

    expect(response).toMatchObject(expected);

    const persisted = await waitForPersisted(
      submission.runId,
      5000,
      response.status,
    );
    expectPersistedMatches(response, persisted);
  });

  test("TC-HP-02: Simple message turn (Anthropic)", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = await harness.loadFixtureFile(
      FIXTURES.anthropic.simpleMessage,
    );

    const submission = await harness.submit({
      prompt: PROMPTS.simpleFact,
      model: "claude-haiku-4.5",
      providerId: "anthropic",
      turnId,
      threadId,
    });

    const events = await harness.consumeSSE(submission.streamUrl);
    const response = await harness.hydrate(events);

    const expected = materializeExpectedResponse(fixture, {
      runId: submission.runId,
      turnId,
      threadId,
      modelId: "claude-haiku-4.5",
      providerId: "anthropic",
    });

    expect(response).toMatchObject(expected);

    const persisted = await waitForPersisted(
      submission.runId,
      5000,
      response.status,
    );
    expectPersistedMatches(response, persisted);
  });

  test("TC-HP-03: Thinking block + message turn (OpenAI)", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = await harness.loadFixtureFile(
      FIXTURES.openai.thinkingMessage,
    );

    const submission = await harness.submit({
      prompt: PROMPTS.monads,
      model: "gpt-5-codex",
      providerId: "openai",
      turnId,
      threadId,
    });

    const events = await harness.consumeSSE(submission.streamUrl);
    const response = await harness.hydrate(events);

    const expected = materializeExpectedResponse(fixture, {
      runId: submission.runId,
      turnId,
      threadId,
      modelId: "gpt-5-codex",
      providerId: "openai",
    });

    expect(response).toMatchObject(expected);
    expect(response.output_items[0].type).toBe("reasoning");
    expect(response.output_items[1].type).toBe("message");

    const persisted = await waitForPersisted(
      submission.runId,
      5000,
      response.status,
    );
    expectPersistedMatches(response, persisted);
  });

  test("TC-HP-04: Thinking block + message turn (Anthropic)", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = await harness.loadFixtureFile(
      FIXTURES.anthropic.thinkingMessage,
    );

    const submission = await harness.submit({
      prompt: PROMPTS.monads,
      model: "claude-sonnet-4.5",
      providerId: "anthropic",
      turnId,
      threadId,
    });

    const events = await harness.consumeSSE(submission.streamUrl);
    const response = await harness.hydrate(events);

    const expected = materializeExpectedResponse(fixture, {
      runId: submission.runId,
      turnId,
      threadId,
      modelId: "claude-sonnet-4.5",
      providerId: "anthropic",
    });

    expect(response).toMatchObject(expected);
    expect(response.output_items[0].type).toBe("reasoning");
    expect(response.output_items[1].type).toBe("message");

    const persisted = await waitForPersisted(
      submission.runId,
      5000,
      response.status,
    );
    expectPersistedMatches(response, persisted);
  });

  test("TC-HP-05: Tool call, output, and message turn (OpenAI)", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = await harness.loadFixtureFile(
      FIXTURES.openai.toolCallOutputMessage,
    );

    const submission = await harness.submit({
      prompt: PROMPTS.readmeSummary,
      model: "gpt-5-codex",
      providerId: "openai",
      turnId,
      threadId,
    });

    const events = await harness.consumeSSE(submission.streamUrl);
    const response = await harness.hydrate(events);

    const expected = materializeExpectedResponse(fixture, {
      runId: submission.runId,
      turnId,
      threadId,
      modelId: "gpt-5-codex",
      providerId: "openai",
    });

    const { output_items: _expectedItems, ...expectedWithoutItems } = expected;
    expect(response).toMatchObject({
      ...expectedWithoutItems,
      updated_at: expect.any(Number),
      output_items: expect.any(Array),
    });

    expect(response.output_items.map((item) => item.type)).toEqual([
      "function_call",
      "function_call_output",
      "message",
    ]);

    const functionCall = response.output_items.find(
      (item) => item.type === "function_call",
    );
    expect(functionCall).toBeDefined();
    expect(functionCall).toMatchObject({
      type: "function_call",
      name: "readFile",
    });

    const toolOutput = response.output_items.find(
      (item) => item.type === "function_call_output",
    );
    expect(toolOutput).toBeDefined();
    expect(toolOutput).toMatchObject({
      type: "function_call_output",
      success: true,
      origin: "tool_harness",
      output: expect.stringContaining("# Cody Fastify"),
    });

    const finalMessage = response.output_items.find(
      (item) => item.type === "message",
    );
    expect(finalMessage).toBeDefined();
    expect(finalMessage).toMatchObject({
      content: expect.stringContaining("Fastify server"),
    });

    const persisted = await waitForPersisted(
      submission.runId,
      5000,
      response.status,
    );
    expectPersistedMatches(response, persisted);
  });

  test("TC-HP-06: Multi-turn conversation & context preservation", async () => {
    const threadId = randomUUID();
    const turnOneId = randomUUID();
    const turnTwoId = randomUUID();

    const turn1Fixture = await harness.loadFixtureFile(
      FIXTURES.openai.turn1Message,
    );
    const turn1 = await harness.submit({
      prompt: PROMPTS.turnOne,
      model: "gpt-5-mini",
      providerId: "openai",
      threadId,
      turnId: turnOneId,
    });
    const turn1Events = await harness.consumeSSE(turn1.streamUrl);
    const turn1Response = await harness.hydrate(turn1Events);
    const expectedTurn1 = materializeExpectedResponse(turn1Fixture, {
      runId: turn1.runId,
      turnId: turnOneId,
      threadId,
      modelId: "gpt-5-mini",
      providerId: "openai",
    });
    expect(turn1Response).toMatchObject(expectedTurn1);

    const turn2Fixture = await harness.loadFixtureFile(
      FIXTURES.openai.turn2Message,
    );
    const turn2 = await harness.submit({
      prompt: PROMPTS.turnTwo,
      model: "gpt-5-mini",
      providerId: "openai",
      threadId,
      turnId: turnTwoId,
    });
    const turn2Events = await harness.consumeSSE(turn2.streamUrl);
    const turn2Response = await harness.hydrate(turn2Events);
    const expectedTurn2 = materializeExpectedResponse(turn2Fixture, {
      runId: turn2.runId,
      turnId: turnTwoId,
      threadId,
      modelId: "gpt-5-mini",
      providerId: "openai",
    });
    expect(turn2Response).toMatchObject(expectedTurn2);

    const persisted1 = await waitForPersisted(
      turn1.runId,
      5000,
      turn1Response.status,
    );
    const persisted2 = await waitForPersisted(
      turn2.runId,
      5000,
      turn2Response.status,
    );
    expectPersistedMatches(turn1Response, persisted1);
    expectPersistedMatches(turn2Response, persisted2);
    expect(persisted1.threadId).toBe(threadId);
    expect(persisted2.threadId).toBe(threadId);
  });

  test("TC-HP-07: Usage metrics capture (OpenAI)", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = await harness.loadFixtureFile(FIXTURES.openai.usageMessage);

    const submission = await harness.submit({
      prompt: PROMPTS.shortSummary,
      model: "gpt-5-mini",
      providerId: "openai",
      turnId,
      threadId,
    });

    const events = await harness.consumeSSE(submission.streamUrl);
    const response = await harness.hydrate(events);

    const expected = materializeExpectedResponse(fixture, {
      runId: submission.runId,
      turnId,
      threadId,
      modelId: "gpt-5-mini",
      providerId: "openai",
    });

    expect(response).toMatchObject(expected);
    expect(response.usage).toEqual({
      prompt_tokens: 8,
      completion_tokens: 6,
      total_tokens: 14,
    });

    const persisted = await waitForPersisted(
      submission.runId,
      5000,
      response.status,
    );
    expectPersistedMatches(response, persisted);
    expect(persisted.usage).toEqual({
      promptTokens: 8,
      completionTokens: 6,
      totalTokens: 14,
    });
  });

  test("TC-HP-08: Tool call (simple)", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = await harness.loadFixtureFile(
      FIXTURES.openai.simpleToolCall,
    );

    const submission = await harness.submit({
      prompt: PROMPTS.runLs,
      model: "gpt-5-codex",
      providerId: "openai",
      turnId,
      threadId,
    });

    const events = await harness.consumeSSE(submission.streamUrl);
    const response = await harness.hydrate(events);

    const expected = materializeExpectedResponse(fixture, {
      runId: submission.runId,
      turnId,
      threadId,
      modelId: "gpt-5-codex",
      providerId: "openai",
    });

    const { output_items: _expectedItems, ...expectedWithoutItems } = expected;
    expect(response).toMatchObject({
      ...expectedWithoutItems,
      updated_at: expect.any(Number),
      output_items: expect.any(Array),
    });
    expect(response.output_items.map((item) => item.type)).toEqual([
      "function_call",
      "function_call_output",
    ]);

    const toolCall = response.output_items.find(
      (item) => item.type === "function_call",
    );
    expect(toolCall).toBeDefined();
    expect(toolCall).toMatchObject({
      type: "function_call",
      name: "exec",
    });

    const outputItem = response.output_items.find(
      (item) => item.type === "function_call_output",
    );
    expect(outputItem).toBeDefined();
    expect(outputItem).toMatchObject({
      type: "function_call_output",
      success: true,
      origin: "tool_harness",
      output: expect.stringContaining("total 384"), // Expect first line of ls -l output
    });

    const persisted = await waitForPersisted(
      submission.runId,
      5000,
      response.status,
    );
    expectPersistedMatches(response, persisted);
  });

  test("TC-HP-09: SSE reconnection", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = await harness.loadFixtureFile(FIXTURES.openai.reconnection);

    const submission = await harness.submit({
      prompt: PROMPTS.reconnection,
      model: "gpt-5-mini",
      providerId: "openai",
      turnId,
      threadId,
    });

    const streamUrl = harness.getStreamUrl(submission.streamUrl);
    const firstSession = await readSseStream(streamUrl, { limit: 3 });
    expect(firstSession.events).toHaveLength(3);
    expect(firstSession.lastEventId).toBeDefined();

    const resumeSession = await readSseStream(streamUrl, {
      lastEventId: firstSession.lastEventId,
    });

    const combinedEvents = [...firstSession.events, ...resumeSession.events];
    const response = await harness.hydrate(combinedEvents);

    const expected = materializeExpectedResponse(fixture, {
      runId: submission.runId,
      turnId,
      threadId,
      modelId: "gpt-5-mini",
      providerId: "openai",
    });

    expect(response).toMatchObject(expected);
    expect(combinedEvents).toHaveLength(fixture.chunks.length);

    const persisted = await waitForPersisted(
      submission.runId,
      5000,
      response.status,
    );
    expectPersistedMatches(response, persisted);
  });

  test("TC-HP-10: Concurrent turns", async () => {
    const threadA = randomUUID();
    const threadB = randomUUID();
    const turnAId = randomUUID();
    const turnBId = randomUUID();

    const fixtureA = await harness.loadFixtureFile(FIXTURES.openai.concurrentA);
    const fixtureB = await harness.loadFixtureFile(FIXTURES.openai.concurrentB);

    const submissionA = harness.submit({
      prompt: PROMPTS.concurrentA,
      model: "gpt-5-mini",
      providerId: "openai",
      turnId: turnAId,
      threadId: threadA,
    });
    const submissionB = harness.submit({
      prompt: PROMPTS.concurrentB,
      model: "gpt-5-mini",
      providerId: "openai",
      turnId: turnBId,
      threadId: threadB,
    });

    const [resultA, resultB] = await Promise.all([submissionA, submissionB]);

    const [eventsA, eventsB] = await Promise.all([
      harness.consumeSSE(resultA.streamUrl),
      harness.consumeSSE(resultB.streamUrl),
    ]);

    const [responseA, responseB] = await Promise.all([
      harness.hydrate(eventsA),
      harness.hydrate(eventsB),
    ]);

    const expectedA = materializeExpectedResponse(fixtureA, {
      runId: resultA.runId,
      turnId: turnAId,
      threadId: threadA,
      modelId: "gpt-5-mini",
      providerId: "openai",
    });
    const expectedB = materializeExpectedResponse(fixtureB, {
      runId: resultB.runId,
      turnId: turnBId,
      threadId: threadB,
      modelId: "gpt-5-mini",
      providerId: "openai",
    });

    expect(responseA).toMatchObject(expectedA);
    expect(responseB).toMatchObject(expectedB);

    const [persistedA, persistedB] = await Promise.all([
      waitForPersisted(resultA.runId, 5000, responseA.status),
      waitForPersisted(resultB.runId, 5000, responseB.status),
    ]);

    expectPersistedMatches(responseA, persistedA);
    expectPersistedMatches(responseB, persistedB);
    expect(persistedA.runId).not.toBe(persistedB.runId);
    expect(persistedA.threadId).not.toBe(persistedB.threadId);
  });
});

async function registerFixtures(): Promise<void> {
  const register = async (
    providerId: "openai" | "anthropic",
    model: string,
    prompt: string,
    fixturePath: string,
    scenarioId: string,
  ) => {
    await harness.registerFixture({
      providerId,
      model,
      prompt,
      filePath: fixturePath,
      scenarioId,
    });
  };

  await Promise.all([
    register(
      "openai",
      "gpt-5-mini",
      PROMPTS.simpleFact,
      FIXTURES.openai.simpleMessage,
      "TC-HP-01",
    ),
    register(
      "anthropic",
      "claude-haiku-4.5",
      PROMPTS.simpleFact,
      FIXTURES.anthropic.simpleMessage,
      "TC-HP-02",
    ),
    register(
      "openai",
      "gpt-5-codex",
      PROMPTS.monads,
      FIXTURES.openai.thinkingMessage,
      "TC-HP-03",
    ),
    register(
      "anthropic",
      "claude-sonnet-4.5",
      PROMPTS.monads,
      FIXTURES.anthropic.thinkingMessage,
      "TC-HP-04",
    ),
    register(
      "openai",
      "gpt-5-codex",
      PROMPTS.readmeSummary,
      FIXTURES.openai.toolCallOutputMessage,
      "TC-HP-05",
    ),
    register(
      "openai",
      "gpt-5-mini",
      PROMPTS.turnOne,
      FIXTURES.openai.turn1Message,
      "TC-HP-06-TURN1",
    ),
    register(
      "openai",
      "gpt-5-mini",
      PROMPTS.turnTwo,
      FIXTURES.openai.turn2Message,
      "TC-HP-06-TURN2",
    ),
    register(
      "openai",
      "gpt-5-mini",
      PROMPTS.shortSummary,
      FIXTURES.openai.usageMessage,
      "TC-HP-07",
    ),
    register(
      "openai",
      "gpt-5-codex",
      PROMPTS.runLs,
      FIXTURES.openai.simpleToolCall,
      "TC-HP-08",
    ),
    register(
      "openai",
      "gpt-5-mini",
      PROMPTS.reconnection,
      FIXTURES.openai.reconnection,
      "TC-HP-09",
    ),
    register(
      "openai",
      "gpt-5-mini",
      PROMPTS.concurrentA,
      FIXTURES.openai.concurrentA,
      "TC-HP-10A",
    ),
    register(
      "openai",
      "gpt-5-mini",
      PROMPTS.concurrentB,
      FIXTURES.openai.concurrentB,
      "TC-HP-10B",
    ),
  ]);
}

async function waitForPersisted(
  runId: string,
  timeoutMs = 5000,
  expectedStatus?: Response["status"],
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = await harness.getPersistedResponse(runId);
    if (
      doc &&
      (!expectedStatus || (doc as PersistedResponse).status === expectedStatus)
    ) {
      return doc as PersistedResponse;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for persisted response for ${runId}`);
}

function materializeExpectedResponse(
  fixture: MockFixtureFile,
  context: PlaceholderContext,
) {
  if (!fixture.expected_response) {
    throw new Error(
      `Fixture ${fixture.description ?? "unknown"} is missing expected_response`,
    );
  }
  return materializePlaceholders(
    fixture.expected_response,
    context,
  ) as Response;
}

function materializePlaceholders<T>(value: T, context: PlaceholderContext): T {
  if (typeof value === "string") {
    return value.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, token) => {
      return context[token as keyof PlaceholderContext] ?? match;
    }) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => materializePlaceholders(entry, context)) as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = materializePlaceholders(val, context);
    }
    return result as T;
  }
  return value;
}

function expectPersistedMatches(
  response: Response,
  persisted: PersistedResponse,
) {
  expect(persisted.runId).toBe(response.id);
  expect(persisted.turnId).toBe(response.turn_id);
  expect(persisted.threadId).toBe(response.thread_id);
  expect(persisted.modelId).toBe(response.model_id);
  expect(persisted.providerId).toBe(response.provider_id);
  expect(persisted.status).toBe(response.status);
  expect(persisted.outputItems).toEqual(response.output_items);
  if (response.usage) {
    expect(persisted.usage).toEqual({
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    });
  } else {
    expect(persisted.usage).toBeUndefined();
  }
}

async function readSseStream(
  streamUrl: string,
  options: { limit?: number; lastEventId?: string } = {},
) {
  const controller = new AbortController();
  const headers: Record<string, string> = {};
  if (options.lastEventId) {
    headers["Last-Event-ID"] = options.lastEventId;
  }

  const events: StreamEvent[] = [];
  let lastEventId: string | undefined;

  try {
    const response = await fetch(streamUrl, {
      headers: Object.keys(headers).length ? headers : undefined,
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      const text = await response.text();
      throw new Error(
        `SSE request failed with status ${response.status}: ${text || "unknown error"}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const buffer: string[] = [];
    let stop = false;

    while (!stop) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        buffer.push(decoder.decode(value, { stream: true }));
      }
      const joined = buffer.join("");
      const blocks = joined.split("\n\n");
      buffer.length = 0;
      const trailing = blocks.pop();
      if (trailing) buffer.push(trailing);
      for (const block of blocks) {
        const { id, data } = parseSseBlock(block);
        if (id) {
          lastEventId = id;
        }
        if (!data || data === "[DONE]") {
          stop = true;
          break;
        }
        const event = StreamEventSchema.parse(JSON.parse(data));
        events.push(event);
        if (
          event.payload.type === "response_done" ||
          event.payload.type === "response_error"
        ) {
          stop = true;
          break;
        }
        if (options.limit && events.length >= options.limit) {
          controller.abort();
          stop = true;
          break;
        }
      }
    }
    await reader.cancel().catch(() => undefined);
  } catch (error) {
    if (!controller.signal.aborted) {
      throw error;
    }
  }

  return { events, lastEventId };
}

function parseSseBlock(block: string) {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let id: string | undefined;
  let data = "";
  for (const line of lines) {
    if (line.startsWith("id:")) {
      id = line.slice("id:".length).trim();
    } else if (line.startsWith("data:")) {
      data += line.slice("data:".length).trim();
    }
  }
  return { id, data };
}

type PlaceholderContext = {
  runId: string;
  turnId: string;
  threadId: string;
  modelId: string;
  providerId: string;
};

type PersistedResponse = {
  runId: string;
  turnId: string;
  threadId: string;
  modelId: string;
  providerId: string;
  status: Response["status"];
  outputItems: Response["output_items"];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  [key: string]: unknown;
};
