import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ToolRegistry } from "codex-ts/src/tools/registry.js"; // Import ToolRegistry class

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import type { Response } from "../../../src/core/schema.js";
import { Core2TestHarness } from "../../harness/core-harness.js";
import type { MockFixtureFile } from "../../mocks/mock-stream-adapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_ROOT = join(__dirname, "../../fixtures");

const PROMPTS = {
  llmError: "Trigger error",
  toolFailure: "Read missing file",
  toolTimeout: "Call slow tool",
  malformedChunk: "Malformed chunk stream",
  emptyMessage: "Send empty message",
} as const;

const FIXTURES = {
  openai: {
    errorResponse: join(FIXTURE_ROOT, "openai/error-response.json"),
    toolError: join(FIXTURE_ROOT, "openai/tool-error.json"),
    toolTimeout: join(FIXTURE_ROOT, "openai/tool-timeout.json"),
    malformedChunk: join(FIXTURE_ROOT, "openai/malformed-chunk.json"),
    emptyMessage: join(FIXTURE_ROOT, "openai/empty-message.json"),
  },
} as const;

// Create a test-specific tool registry
const testToolRegistry = new ToolRegistry();

// Register slowTool with the test-specific registry
testToolRegistry.register({
  metadata: {
    name: "slowTool",
    description: "A tool that sleeps for 5 seconds",
    requiresApproval: false,
    schema: {
      type: "object",
      properties: {},
    },
  },
  execute: async () => {
    await sleep(5000);
    return { success: true, output: "done" };
  },
});

const harness = new Core2TestHarness(testToolRegistry); // Pass the test-specific registry to the harness

describe("Core 2.0 Error Handling", () => {
  beforeAll(async () => {
    await registerFixtures();
    await harness.setup();
  });

  afterAll(async () => {
    // We don't need to clear the legacyToolRegistry here because we're using a test-specific one.
    await harness.cleanup();
  }, 20_000);

  afterEach(async () => {
    await harness.reset();
  }, 20_000);

  test("TC-ER-01: LLM response_error surfaces error details", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = await harness.loadFixtureFile(
      FIXTURES.openai.errorResponse,
    );

    const submission = await harness.submit({
      prompt: PROMPTS.llmError,
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
    expect(response.error).toEqual(expected.error);
    expect(response.output_items).toHaveLength(0);

    const persisted = await waitForPersisted(submission.runId, 5000, "error");
    expectPersistedMatches(response, persisted);
  });

  test("TC-ER-02: Tool failure propagates structured error", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = await harness.loadFixtureFile(FIXTURES.openai.toolError);

    const submission = await harness.submit({
      prompt: PROMPTS.toolFailure,
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

    const { output_items: _ignored, ...expectedWithoutItems } = expected;
    expect(response).toMatchObject({
      ...expectedWithoutItems,
      updated_at: expect.any(Number),
      output_items: expect.any(Array),
    });

    const callOutput = response.output_items.find(
      (item) => item.type === "function_call_output",
    );
    expect(callOutput).toBeDefined();
    expect(callOutput).toMatchObject({
      type: "function_call_output",
      success: false,
      origin: "tool_harness",
    });
    expect(callOutput?.output).toContain("ENOENT");

    const persisted = await waitForPersisted(
      submission.runId,
      5000,
      response.status,
    );
    expectPersistedMatches(response, persisted);
  });

  test("TC-ER-03: Tool timeout emits failure output", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = await harness.loadFixtureFile(FIXTURES.openai.toolTimeout);

    const submission = await harness.submit({
      prompt: PROMPTS.toolTimeout,
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

    const { output_items: _expectedItems, ...baseExpected } = expected;
    expect(response).toMatchObject({
      ...baseExpected,
      updated_at: expect.any(Number),
      output_items: expect.any(Array),
    });

    expect(response.output_items.map((item) => item.type)).toEqual([
      "function_call",
      "function_call_output",
    ]);

    const timeoutOutput = response.output_items.find(
      (item) => item.type === "function_call_output",
    );
    expect(timeoutOutput).toMatchObject({
      success: false,
    });
    expect(timeoutOutput?.output).toContain("timed out");

    const persisted = await waitForPersisted(
      submission.runId,
      5000,
      response.status,
    );
    expectPersistedMatches(response, persisted);
  });

  test("TC-ER-04: Malformed SSE chunk is skipped without crashing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = await harness.loadFixtureFile(
      FIXTURES.openai.malformedChunk,
    );

    try {
      const submission = await harness.submit({
        prompt: PROMPTS.malformedChunk,
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
      expect(response.output_items).toHaveLength(1);
      const expectedMessage = expected.output_items[0];
      if (!expectedMessage || expectedMessage.type !== "message") {
        throw new Error(
          "Malformed malformed-chunk fixture: expected message output",
        );
      }
      expect(response.output_items[0]).toMatchObject({
        type: "message",
        content: expectedMessage.content,
      });

      const persisted = await waitForPersisted(
        submission.runId,
        5000,
        response.status,
      );
      expectPersistedMatches(response, persisted);

      const warned = warnSpy.mock.calls.some((call) => {
        const [message] = call;
        return (
          typeof message === "string" &&
          message.includes("Skipping malformed chunk") &&
          message.includes("malformed-chunk.json")
        );
      });
      expect(warned).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test("TC-ER-05: Empty message content remains valid", async () => {
    const turnId = randomUUID();
    const threadId = randomUUID();
    const fixture = await harness.loadFixtureFile(FIXTURES.openai.emptyMessage);

    const submission = await harness.submit({
      prompt: PROMPTS.emptyMessage,
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
    expect(response.output_items).toHaveLength(1);
    expect(response.output_items[0]).toMatchObject({
      type: "message",
      content: "",
    });

    const persisted = await waitForPersisted(
      submission.runId,
      5000,
      response.status,
    );
    expectPersistedMatches(response, persisted);
  });

  test("TC-ER-06: Invalid provider/model combination returns 400", async () => {
    try {
      await harness.submit({
        prompt: PROMPTS.llmError,
        model: "claude-haiku-4.5",
        providerId: "openai",
      });
      throw new Error("Expected submit to fail for invalid model");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Expected submit to fail for invalid model"
      ) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("INVALID_MODEL");
      expect(message).toContain("claude-haiku-4.5");
      expect(message).toContain("openai");
    }
  });
});

async function registerFixtures(): Promise<void> {
  const register = async (
    providerId: "openai",
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
      PROMPTS.llmError,
      FIXTURES.openai.errorResponse,
      "TC-ER-01",
    ),
    register(
      "openai",
      "gpt-5-mini",
      PROMPTS.toolFailure,
      FIXTURES.openai.toolError,
      "TC-ER-02",
    ),
    register(
      "openai",
      "gpt-5-mini",
      PROMPTS.toolTimeout,
      FIXTURES.openai.toolTimeout,
      "TC-ER-03",
    ),
    register(
      "openai",
      "gpt-5-mini",
      PROMPTS.malformedChunk,
      FIXTURES.openai.malformedChunk,
      "TC-ER-04",
    ),
    register(
      "openai",
      "gpt-5-mini",
      PROMPTS.emptyMessage,
      FIXTURES.openai.emptyMessage,
      "TC-ER-05",
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
