import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type {
  OutputItem,
  Response,
  StreamEvent,
} from "../../../src/core/schema.js";
import { SmokeTestHarness } from "../../harness/smoke-harness.js";

const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY?.trim());
const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
const shouldSetup = hasOpenAIKey || hasAnthropicKey;
const STREAM_TIMEOUT_MS = 60_000;
const RESET_DELAY_MS = 1_000;

const openaiTest = hasOpenAIKey ? test : test.skip;
const anthropicTest = hasAnthropicKey ? test : test.skip;
const parityTest = hasOpenAIKey && hasAnthropicKey ? test : test.skip;

describe.sequential("Core 2.0 Smoke Tests - Real APIs", () => {
  const harness = new SmokeTestHarness();

  beforeAll(async () => {
    if (!shouldSetup) {
      console.warn(
        "Skipping real API smoke tests: OPENAI_API_KEY/ANTHROPIC_API_KEY not set.",
      );
      return;
    }
    await harness.setup();
  }, 120_000);

  afterAll(async () => {
    if (!shouldSetup) return;
    await harness.cleanup();
  }, 60_000);

  afterEach(async () => {
    if (!shouldSetup) return;
    await harness.reset();
    await sleep(RESET_DELAY_MS);
  }, 60_000);

  openaiTest(
    "TC-SMOKE-01: OpenAI basic message streams and persists",
    async () => {
      const tracker = createStreamTracker();
      const { response } = await executeRealRun({
        harness,
        prompt: "Say hello in one sentence.",
        providerId: "openai",
        model: "gpt-5-mini",
        tracker,
      });

      expectStreamingTimeline(tracker);
      expect(response.status).toBe("complete");
      expect(response.provider_id).toBe("openai");
      const message = findOutputItem(response, "message");
      expect(message).toBeDefined();
      expect(message?.content?.toLowerCase()).toMatch(/hello/);
      expect(response.output_items.length).toBeGreaterThan(0);
      expect(response.usage?.total_tokens ?? 0).toBeGreaterThan(0);
    },
    STREAM_TIMEOUT_MS,
  );

  anthropicTest(
    "TC-SMOKE-02: Anthropic basic message streams and persists",
    async () => {
      const tracker = createStreamTracker();
      const { response } = await executeRealRun({
        harness,
        prompt: "Say hello in one sentence.",
        providerId: "anthropic",
        model: "claude-haiku-4.5",
        tracker,
      });

      expectStreamingTimeline(tracker);
      expect(response.status).toBe("complete");
      expect(response.provider_id).toBe("anthropic");
      const message = findOutputItem(response, "message");
      expect(message).toBeDefined();
      expect(message?.content?.toLowerCase()).toMatch(/hello/);
      expect(response.usage?.total_tokens ?? 0).toBeGreaterThanOrEqual(0);
    },
    STREAM_TIMEOUT_MS,
  );

  openaiTest(
    "TC-SMOKE-03: OpenAI reasoning then answer",
    async () => {
      const tracker = createStreamTracker();
      const { response } = await executeRealRun({
        harness,
        prompt: "What is 7 * 8? Think step by step before answering.",
        providerId: "openai",
        model: "gpt-5-mini",
        tracker,
      });

      expectStreamingTimeline(tracker);
      const reasoning = findOutputItem(response, "reasoning");
      const message = findOutputItem(response, "message");
      expect(reasoning).toBeDefined();
      expect(message).toBeDefined();
      if (reasoning && message) {
        const reasoningIndex = response.output_items.findIndex(
          (item) => item.id === reasoning.id,
        );
        const messageIndex = response.output_items.findIndex(
          (item) => item.id === message.id,
        );
        expect(reasoningIndex).toBeLessThan(messageIndex);
      }
      expect(message?.content).toMatch(/56/);
    },
    STREAM_TIMEOUT_MS,
  );

  anthropicTest(
    "TC-SMOKE-04: Anthropic reasoning then answer",
    async () => {
      const tracker = createStreamTracker();
      const { response } = await executeRealRun({
        harness,
        prompt: "What is 7 * 8? Think step by step before answering.",
        providerId: "anthropic",
        model: "claude-haiku-4.5",
        tracker,
      });

      expectStreamingTimeline(tracker);
      const reasoning = findOutputItem(response, "reasoning");
      const message = findOutputItem(response, "message");
      expect(reasoning).toBeDefined();
      expect(message).toBeDefined();
      expect(message?.content).toMatch(/56/);
    },
    STREAM_TIMEOUT_MS,
  );

  openaiTest(
    "TC-SMOKE-05: OpenAI tool call and response",
    async () => {
      const tracker = createStreamTracker();
      const { response } = await executeRealRun({
        harness,
        prompt:
          "Read the project package.json using the readFile tool and summarize it.",
        providerId: "openai",
        model: "gpt-5-codex",
        tracker,
      });

      expectStreamingTimeline(tracker);
      const functionCall = findOutputItem(response, "function_call");
      const toolOutput = findOutputItem(response, "function_call_output");
      const finalMessage = findOutputItem(response, "message");

      expect(functionCall).toBeDefined();
      expect(toolOutput).toBeDefined();
      expect(finalMessage).toBeDefined();
      if (!functionCall || !toolOutput || !finalMessage) {
        throw new Error("Tool call pipeline did not emit expected items");
      }

      expect(functionCall).toMatchObject({
        type: "function_call",
        name: expect.stringMatching(/readFile/i),
      });

      expect(toolOutput).toMatchObject({
        type: "function_call_output",
        origin: "tool_harness",
        success: true,
      });
      expect(typeof toolOutput.output).toBe("string");
      expect(toolOutput.output?.length ?? 0).toBeGreaterThan(0);

      expect(finalMessage.content ?? "").toMatch(/package|file/i);
    },
    STREAM_TIMEOUT_MS,
  );

  parityTest(
    "TC-SMOKE-06: Cross-provider schema parity",
    async () => {
      const openaiTracker = createStreamTracker();
      const anthropicTracker = createStreamTracker();

      const openaiResult = await executeRealRun({
        harness,
        prompt: "Explain recursion in two short sentences.",
        providerId: "openai",
        model: "gpt-5-mini",
        tracker: openaiTracker,
      });

      // Small gap to avoid overlapping rate limits
      await sleep(500);

      const anthropicResult = await executeRealRun({
        harness,
        prompt: "Explain recursion in two short sentences.",
        providerId: "anthropic",
        model: "claude-haiku-4.5",
        tracker: anthropicTracker,
      });

      expectStreamingTimeline(openaiTracker);
      expectStreamingTimeline(anthropicTracker);

      const openaiTypes = new Set(
        openaiResult.response.output_items.map((item) => item.type),
      );
      const anthropicTypes = new Set(
        anthropicResult.response.output_items.map((item) => item.type),
      );

      expect(openaiTypes.has("message")).toBe(true);
      expect(anthropicTypes.has("message")).toBe(true);
      expect(openaiResult.response.status).toBe("complete");
      expect(anthropicResult.response.status).toBe("complete");

      const sharedKeys = intersectKeys(
        openaiResult.response,
        anthropicResult.response,
      );
      expect(sharedKeys).toContain("output_items");
      expect(sharedKeys).toContain("status");
      expect(sharedKeys).toContain("provider_id");
    },
    STREAM_TIMEOUT_MS,
  );
});

type StreamTracker = {
  eventTypes: StreamEvent["payload"]["type"][];
  arrivalTimes: number[];
  record: (event: StreamEvent) => void;
};

function createStreamTracker(): StreamTracker {
  const eventTypes: StreamEvent["payload"]["type"][] = [];
  const arrivalTimes: number[] = [];
  return {
    eventTypes,
    arrivalTimes,
    record: (event: StreamEvent) => {
      eventTypes.push(event.payload.type);
      arrivalTimes.push(Date.now());
    },
  };
}

function expectStreamingTimeline(tracker: StreamTracker, minDurationMs = 100) {
  expect(tracker.eventTypes.length).toBeGreaterThan(3);
  expect(tracker.eventTypes[0]).toBe("response_start");
  const lastType = tracker.eventTypes.at(-1);
  expect(lastType === "response_done" || lastType === "response_error").toBe(
    true,
  );
  expect(tracker.eventTypes.includes("item_delta")).toBe(true);
  if (tracker.arrivalTimes.length >= 2) {
    const duration =
      tracker.arrivalTimes[tracker.arrivalTimes.length - 1] -
      tracker.arrivalTimes[0];
    expect(duration).toBeGreaterThanOrEqual(minDurationMs);
  } else {
    throw new Error("Insufficient streaming events captured");
  }
}

async function executeRealRun(options: {
  harness: SmokeTestHarness;
  prompt: string;
  providerId: string;
  model: string;
  tracker: StreamTracker;
  timeoutMs?: number;
}) {
  const { harness, prompt, providerId, model, tracker } = options;
  return harness.withThread(async (session) => {
    const turnId = randomUUID();

    const submission = await session.submit({
      prompt,
      model,
      providerId,
      turnId,
    });

    const events = await harness.consumeSSE(submission.streamUrl, {
      timeoutMs: options.timeoutMs ?? STREAM_TIMEOUT_MS,
      onEvent: tracker.record,
    });

    const response = await harness.hydrate(events);
    expect(response.turn_id).toBe(turnId);
    expect(response.provider_id).toBe(providerId);

    const persisted = (await waitForPersisted(
      harness,
      submission.runId,
      STREAM_TIMEOUT_MS,
      response.status,
    )) as PersistedResponse;
    expectPersistedMatches(response, persisted);

    return { submission, response, events };
  });
}

async function waitForPersisted(
  harness: SmokeTestHarness,
  runId: string,
  timeoutMs = 10_000,
  expectedStatus?: Response["status"],
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = (await harness.getPersistedResponse(
      runId,
    )) as PersistedResponse | null;
    if (doc && (!expectedStatus || doc.status === expectedStatus)) {
      return doc;
    }
    await sleep(250);
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
  expect(persisted.providerId).toBe(response.provider_id);
  expect(persisted.modelId).toBe(response.model_id);
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
  providerId: string;
  modelId: string;
  status: Response["status"];
  outputItems: Response["output_items"];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  [key: string]: unknown;
};

function findOutputItem<T extends OutputItem["type"]>(
  response: Response,
  type: T,
): Extract<OutputItem, { type: T }> | undefined {
  return response.output_items.find(
    (item): item is Extract<OutputItem, { type: T }> => item.type === type,
  );
}

function intersectKeys(a: Response, b: Response) {
  const aKeys = new Set(Object.keys(a));
  return Object.keys(b).filter((key) => aKeys.has(key));
}
