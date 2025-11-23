import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { Response } from "../../../src/core/schema.js";
import { Core2TestHarness } from "../../harness/core-harness.js";
import type { MockFixtureFile } from "../../mocks/mock-stream-adapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_ROOT = join(__dirname, "../../fixtures");

const PROMPTS = {
  largeResponse: "Edge: TC-ER-07 large payload",
  rapidStream: "Edge: TC-ER-08 rapid stream",
  outOfOrder: "Edge: TC-ER-09 out-of-order",
  highConcurrency: "Edge: TC-ER-10 concurrency",
  threadCollision: "Edge: TC-ER-11 collision",
  invalidSchema: "Edge: TC-ER-12 invalid schema",
} as const;

const FIXTURES = {
  openai: {
    largeResponse: join(FIXTURE_ROOT, "openai/large-response.json"),
    rapidStream: join(FIXTURE_ROOT, "openai/rapid-stream.json"),
    outOfOrder: join(FIXTURE_ROOT, "openai/out-of-order.json"),
    invalidSchema: join(FIXTURE_ROOT, "openai/invalid-schema.json"),
    simpleMessage: join(FIXTURE_ROOT, "openai/simple-message.json"),
  },
} as const;

const harness = new Core2TestHarness();

describe("Core 2.0 Edge Cases & Stress", () => {
  beforeAll(async () => {
    await registerFixtures();
    await harness.setup();
  }, 30_000);

  afterAll(async () => {
    await harness.cleanup();
  }, 30_000);

  afterEach(async () => {
    await harness.reset();
  }, 30_000);

  test("TC-ER-07: Handles 1MB+ streamed content without truncation", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = (await harness.loadFixtureFile(
      FIXTURES.openai.largeResponse,
    )) as StressFixtureFile;
    const expectedLength = getNumericMetadata(fixture, "final_content_length");
    const deltaCount = getNumericMetadata(fixture, "chunk_count");

    const submission = await harness.submit({
      prompt: PROMPTS.largeResponse,
      model: "gpt-5-mini",
      providerId: "openai",
      turnId,
      threadId,
    });

    const events = await harness.consumeSSE(submission.streamUrl, {
      timeoutMs: 45_000,
    });
    const deltas = events.filter(
      (event) => event.payload.type === "item_delta",
    );
    expect(deltas).toHaveLength(deltaCount);

    const response = await harness.hydrate(events);
    expect(response.status).toBe("complete");

    const message = response.output_items.find(
      (item) => item.type === "message",
    );
    expect(message).toBeDefined();
    expect(message?.content.length).toBe(expectedLength);
    expect(Buffer.byteLength(message?.content ?? "", "utf8")).toBe(
      expectedLength,
    );
    expect(message?.content?.startsWith("Chunk 0000:")).toBe(true);

    const persisted = await waitForPersisted(
      submission.runId,
      150_000,
      response.status,
    );
    expectPersistedMatches(response, persisted);
  }, 150_000);

  test("TC-ER-08: Rapid 1000-event stream preserves ordering and payloads", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = (await harness.loadFixtureFile(
      FIXTURES.openai.rapidStream,
    )) as StressFixtureFile;
    const deltaCount = getNumericMetadata(fixture, "delta_count");
    const expectedLength = getNumericMetadata(fixture, "final_content_length");

    const submission = await harness.submit({
      prompt: PROMPTS.rapidStream,
      model: "gpt-5-mini",
      providerId: "openai",
      turnId,
      threadId,
    });

    const events = await harness.consumeSSE(submission.streamUrl, {
      timeoutMs: 30_000,
    });
    const response = await harness.hydrate(events);
    expect(response.status).toBe("complete");

    const deltas = events.filter(
      (event) => event.payload.type === "item_delta",
    );
    expect(deltas).toHaveLength(deltaCount);
    expect(
      deltas.every((event, idx, arr) =>
        idx === 0 ? true : event.timestamp >= arr[idx - 1].timestamp,
      ),
    ).toBe(true);

    const message = response.output_items.find(
      (item) => item.type === "message",
    );
    expect(message).toBeDefined();
    expect(message?.content.length).toBe(expectedLength);

    const persisted = await waitForPersisted(
      submission.runId,
      15_000,
      response.status,
    );
    expectPersistedMatches(response, persisted);
  }, 35_000);

  test("TC-ER-09: Out-of-order events flag stream error and avoid corruption", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const submission = await harness.submit({
      prompt: PROMPTS.outOfOrder,
      model: "gpt-5-mini",
      providerId: "openai",
      turnId,
      threadId,
    });

    const events = await harness.consumeSSE(submission.streamUrl, {
      timeoutMs: 20_000,
    });
    expect(events[1]?.payload.type).toBe("item_delta");

    const response = await harness.hydrate(events);
    expect(response.status).toBe("error");
    expect(response.error).toMatchObject({
      code: "STREAM_SEQUENCE_ERROR",
    });
    expect(response.output_items).toHaveLength(0);

    const persisted = await waitForPersisted(submission.runId, 15_000, "error");
    expectPersistedMatches(response, persisted);
  }, 25_000);

  test("TC-ER-10: 50 concurrent turns complete without crosstalk", async () => {
    const concurrency = 50;
    const submissions = await Promise.all(
      Array.from({ length: concurrency }, (_, index) => {
        const turnId = randomUUID();
        const threadId = randomUUID();
        const prompt = `${PROMPTS.highConcurrency} #${index}`;
        return harness
          .submit({
            prompt,
            model: "gpt-5-mini",
            providerId: "openai",
            turnId,
            threadId,
          })
          .then((result) => ({ ...result, prompt, turnId, threadId }));
      }),
    );

    const results = await Promise.all(
      submissions.map(async (submission) => {
        const events = await harness.consumeSSE(submission.streamUrl, {
          timeoutMs: 60_000,
        });
        const response = await harness.hydrate(events);
        return { ...submission, response };
      }),
    );

    expect(new Set(results.map((res) => res.runId)).size).toBe(concurrency);
    for (const result of results) {
      expect(result.response.status).toBe("complete");
      expect(result.response.thread_id).toBe(result.threadId);
      expect(result.response.turn_id).toBe(result.turnId);
      const message = result.response.output_items.find(
        (item) => item.type === "message",
      );
      expect(message?.content).toContain("Fun fact");
    }

    const persisted = await Promise.all(
      results.map((result) =>
        waitForPersisted(result.runId, 20_000, "complete"),
      ),
    );
    persisted.forEach((doc, idx) => {
      const result = results[idx];
      expect(doc.runId).toBe(result.runId);
      expect(doc.threadId).toBe(result.threadId);
    });
  }, 70_000);

  test("TC-ER-11: Concurrent turns sharing thread avoid race condition", async () => {
    const sharedThreadId = randomUUID();
    const turnA = randomUUID();
    const turnB = randomUUID();

    const [submissionA, submissionB] = await Promise.all([
      harness.submit({
        prompt: PROMPTS.threadCollision,
        model: "gpt-5-mini",
        providerId: "openai",
        turnId: turnA,
        threadId: sharedThreadId,
      }),
      harness.submit({
        prompt: PROMPTS.threadCollision,
        model: "gpt-5-mini",
        providerId: "openai",
        turnId: turnB,
        threadId: sharedThreadId,
      }),
    ]);

    const [eventsA, eventsB] = await Promise.all([
      harness.consumeSSE(submissionA.streamUrl, { timeoutMs: 25_000 }),
      harness.consumeSSE(submissionB.streamUrl, { timeoutMs: 25_000 }),
    ]);

    const [responseA, responseB] = await Promise.all([
      harness.hydrate(eventsA),
      harness.hydrate(eventsB),
    ]);

    expect(responseA.thread_id).toBe(sharedThreadId);
    expect(responseB.thread_id).toBe(sharedThreadId);
    expect(responseA.turn_id).toBe(turnA);
    expect(responseB.turn_id).toBe(turnB);
    expect(responseA.status).toBe("complete");
    expect(responseB.status).toBe("complete");

    const [persistedA, persistedB] = await Promise.all([
      waitForPersisted(submissionA.runId, 15_000, "complete"),
      waitForPersisted(submissionB.runId, 15_000, "complete"),
    ]);
    expectPersistedMatches(responseA, persistedA);
    expectPersistedMatches(responseB, persistedB);
    expect(persistedA.threadId).toBe(persistedB.threadId);
  }, 35_000);

  test("TC-ER-12: Schema violations raise validation error response", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const submission = await harness.submit({
      prompt: PROMPTS.invalidSchema,
      model: "gpt-5-mini",
      providerId: "openai",
      turnId,
      threadId,
    });

    const events = await harness.consumeSSE(submission.streamUrl, {
      timeoutMs: 25_000,
    });
    const errorEvent = events.find(
      (event) => event.payload.type === "response_error",
    );
    expect(errorEvent).toBeDefined();

    const response = await harness.hydrate(events);
    expect(response.status).toBe("error");
    expect(response.error).toMatchObject({
      code: "MOCK_STREAM_VALIDATION_ERROR",
    });
    expect(response.error?.message).toContain("payload");

    const persisted = await waitForPersisted(submission.runId, 15_000, "error");
    expectPersistedMatches(response, persisted);
  }, 30_000);
});

type StressFixtureFile = MockFixtureFile & {
  metadata?: Record<string, unknown>;
};

function getNumericMetadata(fixture: StressFixtureFile, key: string): number {
  const value = fixture.metadata?.[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Fixture ${fixture.description} missing numeric ${key}`);
  }
  return value;
}

async function registerFixtures(): Promise<void> {
  const register = async (
    prompt: string | undefined,
    fixturePath: string,
    scenarioId: string,
    options: { isDefault?: boolean } = {},
  ) => {
    await harness.registerFixture({
      providerId: "openai",
      model: "gpt-5-mini",
      prompt,
      filePath: fixturePath,
      scenarioId,
      isDefault: options.isDefault,
    });
  };

  await Promise.all([
    register(PROMPTS.largeResponse, FIXTURES.openai.largeResponse, "TC-ER-07"),
    register(PROMPTS.rapidStream, FIXTURES.openai.rapidStream, "TC-ER-08"),
    register(PROMPTS.outOfOrder, FIXTURES.openai.outOfOrder, "TC-ER-09"),
    register(PROMPTS.invalidSchema, FIXTURES.openai.invalidSchema, "TC-ER-12"),
    register(undefined, FIXTURES.openai.simpleMessage, "TC-ER-10-DEFAULT", {
      isDefault: true,
    }),
  ]);
}

async function waitForPersisted(
  runId: string,
  timeoutMs = 5_000,
  expectedStatus?: Response["status"],
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = (await harness.getPersistedResponse(
      runId,
    )) as PersistedResponse | null;
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
