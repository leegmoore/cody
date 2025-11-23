import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  childTraceContext,
  createTraceContext,
} from "../../src/core/tracing.js";
import {
  streamKeyForRun,
  StreamEventSchema,
  type StreamEvent,
  type TraceContext,
} from "../../src/core/schema.js";
import { PROJECTOR_CONSUMER_GROUP } from "../../src/core/redis.js";
import { ZodError } from "zod";
import {
  type FixtureRegistration,
  type MockAdapterFactory,
  type MockAdapterFactoryInput,
  type StreamAdapter,
  type StreamAdapterParams,
} from "../../src/core/model-factory.js";

export interface MockFixtureFile {
  description: string;
  provider: string;
  model: string;
  chunks: string[];
  expected_response?: unknown;
  stream_config?: {
    event_delay_ms?: number;
  };
  metadata?: Record<string, unknown>;
}

interface PlaceholderContext {
  runId: string;
  turnId: string;
  threadId: string;
  agentId?: string;
  providerId: string;
  modelId: string;
}

interface MaterializeContext extends PlaceholderContext {
  traceContext: TraceContext;
  fixture: FixtureRegistration;
  eventIndex: number;
  totalEvents: number;
}

export class MockStreamAdapter implements StreamAdapter {
  private readonly providerId: string;
  private readonly modelId: string;
  private readonly redis: MockAdapterFactoryInput["redis"];
  private readonly resolveFixture: MockAdapterFactoryInput["resolveFixture"];

  constructor(input: MockAdapterFactoryInput) {
    this.providerId = input.providerId;
    this.modelId = input.model;
    this.redis = input.redis;
    this.resolveFixture = input.resolveFixture;
  }

  async stream(params: StreamAdapterParams): Promise<{ runId: string }> {
    const runId = params.runId ?? randomUUID();
    const turnId = params.turnId ?? randomUUID();
    const threadId = params.threadId ?? randomUUID();

    const registration = this.resolveFixture(params.prompt);
    if (!registration) {
      throw new Error(
        `No fixture registered for provider "${this.providerId}", model "${this.modelId}", prompt "${params.prompt}"`,
      );
    }

    const raw = await readFile(registration.filePath, "utf-8");
    const fixture = parseFixture(raw, registration.filePath);

    if (fixture.provider.toLowerCase() !== this.providerId) {
      throw new Error(
        `Fixture provider mismatch: expected "${this.providerId}", found "${fixture.provider}"`,
      );
    }
    if (fixture.model !== this.modelId) {
      throw new Error(
        `Fixture model mismatch: expected "${this.modelId}", found "${fixture.model}"`,
      );
    }

    const baseTrace = params.traceContext ?? createTraceContext();
    let currentTrace = baseTrace;
    const eventDelayMs =
      registration.eventDelayMs ?? fixture.stream_config?.event_delay_ms ?? 0;

    const placeholderContext: PlaceholderContext = {
      runId,
      turnId,
      threadId,
      agentId: params.agentId,
      providerId: this.providerId,
      modelId: this.modelId,
    };
    let emittedResponseStart = false;

    await this.redis.ensureGroup(
      streamKeyForRun(runId),
      PROJECTOR_CONSUMER_GROUP,
    );

    try {
      for (let idx = 0; idx < fixture.chunks.length; idx += 1) {
        const chunk = fixture.chunks[idx];
        const parsed = parseSseChunk(chunk);
        if (!parsed?.data || parsed.data === "[DONE]") {
          continue;
        }
        const rawEvent = safeJson(parsed.data, (error) => {
          const reason =
            error instanceof Error ? error.message : String(error ?? "unknown");
          console.warn(
            `[mock-stream-adapter] Skipping malformed chunk ${idx} from ${registration.filePath}: ${reason}`,
          );
        });
        if (!rawEvent) {
          continue;
        }

        const trace = isTraceContext(rawEvent.trace_context)
          ? (rawEvent.trace_context as TraceContext)
          : idx === 0
            ? baseTrace
            : childTraceContext(currentTrace);
        currentTrace = trace;

        const event = this.materializeEvent(rawEvent, {
          ...placeholderContext,
          traceContext: trace,
          fixture: registration,
          eventIndex: idx,
          totalEvents: fixture.chunks.length,
        });

        if (event.payload.type === "response_start") {
          emittedResponseStart = true;
        }

        const eventId = await this.redis.publish(event);
        const payload = event.payload;

        if (
          payload.type === "item_done" &&
          isPlainObject(payload.final_item) &&
          (payload.final_item as { type?: unknown }).type === "function_call"
        ) {
          const finalItem = payload.final_item as Extract<
            StreamEvent["payload"],
            { type: "item_done" }
          >["final_item"];
          const callId =
            (finalItem as { call_id?: string }).call_id ??
            (finalItem as { id?: string }).id ??
            "";
          if (callId) {
            await this.waitForFunctionCallOutput(
              placeholderContext.runId,
              callId,
              eventId,
            );
          }
        }

        if (eventDelayMs > 0) {
          await delay(eventDelayMs);
        }
      }
    } catch (error) {
      console.error(
        `[mock-stream-adapter] Fixture stream failed for ${registration.filePath}`,
        error,
      );
      await this.publishFatalStreamError({
        context: placeholderContext,
        traceContext: currentTrace,
        scenarioId: registration.scenarioId,
        emittedResponseStart,
        error,
      });
      throw error;
    }

    return { runId };
  }

  private async publishFatalStreamError(options: {
    context: PlaceholderContext;
    traceContext: TraceContext;
    scenarioId?: string;
    emittedResponseStart: boolean;
    error: unknown;
  }): Promise<void> {
    const { context, traceContext, scenarioId, emittedResponseStart, error } =
      options;
    const events: StreamEvent[] = [];
    const now = Date.now();

    try {
      if (!emittedResponseStart) {
        events.push(
          StreamEventSchema.parse({
            event_id: randomUUID(),
            timestamp: now,
            trace_context: traceContext,
            run_id: context.runId,
            type: "response_start",
            payload: {
              type: "response_start",
              response_id: context.runId,
              turn_id: context.turnId,
              thread_id: context.threadId,
              model_id: context.modelId,
              provider_id: context.providerId,
              created_at: now,
            },
          }),
        );
      }

      const errorMessage = formatFatalError(error);

      events.push(
        StreamEventSchema.parse({
          event_id: randomUUID(),
          timestamp: now + events.length + 1,
          trace_context: traceContext,
          run_id: context.runId,
          type: "response_error",
          payload: {
            type: "response_error",
            response_id: context.runId,
            error: {
              code: "MOCK_STREAM_VALIDATION_ERROR",
              message: errorMessage,
              details: {
                scenarioId,
                providerId: context.providerId,
                modelId: context.modelId,
              },
            },
          },
        }),
      );

      for (const event of events) {
        await this.redis.publish(event);
      }
    } catch (publishError) {
      console.error(
        "[mock-stream-adapter] Failed to publish fatal stream error",
        publishError,
      );
    }
  }

  private async waitForFunctionCallOutput(
    runId: string,
    callId: string,
    afterId: string,
    timeoutMs = 5000,
  ): Promise<void> {
    const streamKey = streamKeyForRun(runId);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const blockMs = Math.max(Math.min(remaining, 100), 1);
      const records = await this.redis.read(streamKey, afterId, blockMs, 20);

      if (records.length) {
        for (const record of records) {
          const payload = record.event.payload;
          if (
            payload.type === "item_done" &&
            isPlainObject(payload.final_item) &&
            (payload.final_item as { type?: unknown }).type ===
              "function_call_output" &&
            (payload.final_item as { call_id?: string }).call_id === callId
          ) {
            return;
          }
        }
        afterId = records[records.length - 1].id;
      }

      await delay(Math.min(remaining, 25));
    }
  }

  private materializeEvent(
    raw: Record<string, unknown>,
    context: MaterializeContext,
  ): StreamEvent {
    const replaced = resolvePlaceholders(deepClone(raw), context);
    const payload = replaced.payload;
    if (!isPlainObject(payload)) {
      throw new Error("Fixture event is missing payload object");
    }

    const payloadType =
      typeof payload.type === "string"
        ? (payload.type as StreamEvent["payload"]["type"])
        : typeof replaced.type === "string"
          ? (replaced.type as StreamEvent["payload"]["type"])
          : undefined;

    if (!payloadType) {
      throw new Error("Fixture event payload is missing a type field");
    }

    const normalizedPayload = applyPayloadDefaults(
      payload,
      payloadType,
      context,
    );

    const event: StreamEvent = {
      event_id:
        typeof replaced.event_id === "string"
          ? replaced.event_id
          : randomUUID(),
      timestamp:
        typeof replaced.timestamp === "number"
          ? replaced.timestamp
          : Date.now(),
      trace_context: isTraceContext(replaced.trace_context)
        ? (replaced.trace_context as TraceContext)
        : context.traceContext,
      run_id:
        typeof replaced.run_id === "string" ? replaced.run_id : context.runId,
      type: normalizedPayload.type,
      payload: normalizedPayload,
    };

    return StreamEventSchema.parse(event);
  }
}

export const createMockStreamAdapter: MockAdapterFactory = (input) =>
  new MockStreamAdapter(input);

function parseFixture(raw: string, filePath: string): MockFixtureFile {
  try {
    const parsed = JSON.parse(raw) as MockFixtureFile;
    if (!Array.isArray(parsed.chunks)) {
      throw new Error("Fixture is missing chunks array");
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `Failed to parse fixture at "${filePath}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function parseSseChunk(
  chunk: string,
): { event?: string; data?: string } | undefined {
  const lines = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return undefined;

  let eventName: string | undefined;
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      data += line.slice("data:".length).trim();
    }
  }
  return { event: eventName, data };
}

function safeJson(
  value: unknown,
  onError?: (error: unknown) => void,
): Record<string, unknown> | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch (error) {
    onError?.(error);
    return undefined;
  }
}

function formatFatalError(error: unknown): string {
  if (error instanceof ZodError) {
    const details = error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "payload";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
    return `Fixture validation failed: ${details}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? "unknown error");
}

function resolvePlaceholders<T>(value: T, context: PlaceholderContext): T {
  if (typeof value === "string") {
    return replacePlaceholderString(value, context) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolvePlaceholders(item, context)) as T;
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = resolvePlaceholders(val, context);
    }
    return result as T;
  }
  return value;
}

function replacePlaceholderString(
  input: string,
  context: PlaceholderContext,
): string {
  return input.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, token) => {
    switch (token) {
      case "runId":
        return context.runId;
      case "turnId":
        return context.turnId;
      case "threadId":
        return context.threadId;
      case "agentId":
        return context.agentId ?? "";
      case "providerId":
        return context.providerId;
      case "modelId":
        return context.modelId;
      case "randomUUID":
        return randomUUID();
      default:
        return match;
    }
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isTraceContext(value: unknown): value is TraceContext {
  if (!isPlainObject(value)) return false;
  return typeof value.traceparent === "string";
}

function applyPayloadDefaults(
  payload: Record<string, unknown>,
  payloadType: StreamEvent["payload"]["type"],
  context: PlaceholderContext,
): StreamEvent["payload"] {
  const copy: Record<string, unknown> = { ...payload, type: payloadType };

  if (payloadType === "response_start") {
    copy.response_id =
      typeof copy.response_id === "string" ? copy.response_id : context.runId;
    copy.turn_id =
      typeof copy.turn_id === "string" ? copy.turn_id : context.turnId;
    copy.thread_id =
      typeof copy.thread_id === "string" ? copy.thread_id : context.threadId;
    copy.model_id =
      typeof copy.model_id === "string" ? copy.model_id : context.modelId;
    copy.provider_id =
      typeof copy.provider_id === "string"
        ? copy.provider_id
        : context.providerId;
    copy.created_at =
      typeof copy.created_at === "number" ? copy.created_at : Date.now();
    if (
      copy.agent_id !== undefined &&
      typeof copy.agent_id !== "string" &&
      copy.agent_id !== null
    ) {
      copy.agent_id = context.agentId;
    }
    if (copy.agent_id === undefined && context.agentId) {
      copy.agent_id = context.agentId;
    }
  }

  if (payloadType === "response_done") {
    copy.response_id =
      typeof copy.response_id === "string" ? copy.response_id : context.runId;
    copy.status = typeof copy.status === "string" ? copy.status : "complete";
    if (!("finish_reason" in copy)) {
      copy.finish_reason = null;
    }
  }

  return copy as StreamEvent["payload"];
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
