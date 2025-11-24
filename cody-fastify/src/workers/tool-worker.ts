import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import {
  ROOT_CONTEXT,
  SpanStatusCode,
  propagation,
  trace,
} from "@opentelemetry/api";
import { ToolRouter } from "codex-ts/src/core/tools/tool-router.js";
import { QuickJSRuntime } from "codex-ts/src/core/script-harness/runtime/quickjs-runtime.js";
import {
  DEFAULT_SCRIPT_LIMITS,
  type ScriptExecutionLimits,
} from "codex-ts/src/core/script-harness/runtime/types.js";
import { parseScript } from "codex-ts/src/core/script-harness/parser.js";
import { PromiseTracker } from "codex-ts/src/core/script-harness/runtime/promise-tracker.js";
import {
  createScriptContext,
  type ContextSeed,
} from "codex-ts/src/core/script-harness/context.js";
import {
  createToolsProxy,
  SimpleApprovalBridge,
  type ToolDefinition as ScriptToolDefinition,
  type ToolRegistry as ScriptToolRegistry,
} from "codex-ts/src/core/script-harness/tool-facade.js";
import type { ResponseItem } from "codex-ts/src/protocol/models.js";
import {
  serializeFunctionCallOutputPayload,
  type FunctionCallOutputPayload,
} from "codex-ts/src/protocol/models.js";
import {
  toolRegistry as legacyToolRegistry,
  type ToolRegistry,
} from "codex-ts/src/tools/registry.js";
import { RedisStream, type RedisStreamGroupRecord } from "../core/redis.js";
import {
  StreamEventSchema,
  type OutputItem,
  type StreamEvent,
} from "../core/schema.js";
import { childTraceContext } from "../core/tracing.js";

const tracer = trace.getTracer("codex.tool-worker");

export interface ToolWorkerOptions {
  redisUrl?: string;
  streamPattern?: string;
  groupName?: string;
  consumerName?: string;
  discoveryIntervalMs?: number;
  scanCount?: number;
  blockMs?: number;
  batchSize?: number;
  reclaimIntervalMs?: number;
  reclaimMinIdleMs?: number;
  approximateMaxLen?: number;
  toolTimeoutMs?: number;
}

const DEFAULT_GROUP_NAME = "codex-tool-workers";

class LegacyToolRegistryAdapter implements ScriptToolRegistry {
  constructor(private readonly base: ToolRegistry = legacyToolRegistry) {}

  get(name: string): ScriptToolDefinition | undefined {
    const registered = this.base.get(name);
    if (!registered) return undefined;
    const requiresApprovalFlag = registered.metadata.requiresApproval ?? false;
    return {
      name: registered.metadata.name,
      description: registered.metadata.description,
      schema: registered.metadata.schema,
      requiresApproval: () => requiresApprovalFlag,
      execute: async (args: unknown) => {
        return registered.execute(args as never);
      },
    };
  }

  has(name: string): boolean {
    return this.base.has(name);
  }

  list(): string[] {
    return this.base.getToolNames();
  }
}

export class ToolWorker {
  private readonly toolRouter: ToolRouter;
  private readonly scriptRegistry: ScriptToolRegistry;
  private readonly approvalBridge = new SimpleApprovalBridge(true);
  private readonly scriptLimits: ScriptExecutionLimits = DEFAULT_SCRIPT_LIMITS;
  private readonly toolTimeoutMs: number;

  private redis: RedisStream | undefined;
  private running = false;
  private joinPromise: Promise<void> | undefined;
  private scriptRuntime: QuickJSRuntime | undefined;
  private scriptRuntimeInitialized = false;

  private readonly streamPattern: string;
  private readonly groupName: string;
  private readonly consumerName: string;
  private readonly options: Required<
    Pick<
      ToolWorkerOptions,
      | "discoveryIntervalMs"
      | "scanCount"
      | "blockMs"
      | "batchSize"
      | "reclaimIntervalMs"
      | "reclaimMinIdleMs"
    >
  >;
  private readonly processedItems = new Map<string, Set<string>>();
  private readonly streams = new Set<string>();
  private readonly streamOffsets = new Map<string, string>();
  private discoveryCursor = "0";

  constructor(
    private readonly config: ToolWorkerOptions = {},
    registry?: ToolRegistry,
  ) {
    const effectiveRegistry = registry ?? legacyToolRegistry;
    this.toolRouter = new ToolRouter({ registry: effectiveRegistry });
    this.scriptRegistry = new LegacyToolRegistryAdapter(effectiveRegistry);
    this.toolTimeoutMs = config.toolTimeoutMs ?? 30_000;

    this.streamPattern = config.streamPattern ?? "codex:run:*:events";
    this.groupName = config.groupName ?? DEFAULT_GROUP_NAME;
    this.consumerName =
      config.consumerName ?? `tool-worker-${process.pid}-${randomUUID()}`;

    this.options = {
      discoveryIntervalMs: config.discoveryIntervalMs ?? 1500,
      scanCount: config.scanCount ?? 100,
      blockMs: config.blockMs ?? 5000,
      batchSize: config.batchSize ?? 25,
      reclaimIntervalMs: config.reclaimIntervalMs ?? 15000,
      reclaimMinIdleMs: config.reclaimMinIdleMs ?? 60000,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.redis = await RedisStream.connect({
      url: this.config.redisUrl,
      approximateMaxLen: this.config.approximateMaxLen,
    });
    this.running = true;

    await this.fullDiscoveryCycle();

    const consume = this.consumeLoop();
    const discover = this.discoveryLoop();
    const reclaim = this.reclaimLoop();
    this.joinPromise = Promise.all([consume, discover, reclaim]).then(() => {});
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.joinPromise;
    await this.redis?.close();
    this.redis = undefined;
    await this.disposeScriptRuntime();
    this.streams.clear();
    this.streamOffsets.clear();
    this.processedItems.clear();
    this.discoveryCursor = "0";
  }

  async join(): Promise<void> {
    await this.joinPromise;
  }

  private async discoveryLoop(): Promise<void> {
    while (this.running) {
      await sleep(this.options.discoveryIntervalMs);
      if (!this.running) break;
      try {
        await this.discoverOnce();
      } catch (error) {
        console.error("[tool-worker] discovery error", error);
      }
    }
  }

  private async reclaimLoop(): Promise<void> {
    while (this.running) {
      await sleep(this.options.reclaimIntervalMs);
      if (!this.running) break;
      const redis = this.redis;
      if (!redis) continue;
      for (const stream of this.streams) {
        if (!this.running) break;
        try {
          const records = await redis.autoClaim(
            stream,
            this.groupName,
            this.consumerName,
            this.options.reclaimMinIdleMs,
          );
          if (!records.length) continue;
          for (const record of records) {
            await this.processAndAck(record);
            if (!this.running) break;
          }
        } catch (error) {
          console.error("[tool-worker] auto-claim error", error);
        }
      }
    }
  }

  private async consumeLoop(): Promise<void> {
    while (this.running) {
      const redis = this.redis;
      if (!redis) break;
      if (!this.streams.size) {
        await sleep(250);
        continue;
      }

      const streams = Array.from(this.streams);
      const offsets = streams.map(
        (stream) => this.streamOffsets.get(stream) ?? ">",
      );

      try {
        const records = await redis.readGroup(
          streams,
          this.groupName,
          this.consumerName,
          offsets,
          this.options.blockMs,
          this.options.batchSize,
        );

        for (const stream of streams) {
          this.streamOffsets.set(stream, ">");
        }

        if (!records.length) {
          continue;
        }

        for (const record of records) {
          await this.processAndAck(record);
          if (!this.running) break;
        }
      } catch (error) {
        console.error("[tool-worker] readGroup error", error);
        await sleep(1000);
      }
    }
  }

  private async processAndAck(record: RedisStreamGroupRecord): Promise<void> {
    const redis = this.redis;
    if (!redis) return;
    try {
      await this.processRecord(record);
      await redis.ack(record.stream, this.groupName, record.id);
    } catch (error) {
      console.error("[tool-worker] failed to process event", error);
      // Leave message pending so it can be retried.
    }
  }

  private async processRecord(record: RedisStreamGroupRecord): Promise<void> {
    const { event } = record;
    const runId = event.run_id;
    const carrier = {
      traceparent: event.trace_context.traceparent,
      ...(event.trace_context.tracestate
        ? { tracestate: event.trace_context.tracestate }
        : {}),
    };
    const parentCtx = propagation.extract(ROOT_CONTEXT, carrier);

    await tracer.startActiveSpan(
      `tool-worker.${event.payload.type}`,
      {
        attributes: {
          "codex.run_id": runId,
          "codex.stream_key": record.stream,
          "codex.event_id": record.id,
          "codex.event_type": event.payload.type,
        },
      },
      parentCtx,
      async (span) => {
        try {
          const payload = event.payload;
          switch (payload.type) {
            case "item_done": {
              const finalItem = payload.final_item;
              if (finalItem.type === "function_call") {
                await this.handleFunctionCall(record, finalItem);
              } else if (finalItem.type === "script_execution") {
                await this.handleScriptExecution(
                  record,
                  finalItem,
                  payload.item_id,
                );
              }
              break;
            }
            case "response_done":
            case "response_error":
            case "turn_aborted_by_user": {
              this.clearRunState(runId);
              break;
            }
            default:
              break;
          }
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  private async handleFunctionCall(
    record: RedisStreamGroupRecord,
    finalItem: Extract<OutputItem, { type: "function_call" }>,
  ): Promise<void> {
    const redis = this.redis;
    if (!redis) {
      throw new Error("Redis connection not initialized");
    }

    const runId = record.event.run_id;
    const parentTrace = record.event.trace_context;
    const callId = finalItem.call_id ?? finalItem.id ?? randomUUID();
    const processedKey = `call:${callId}`;

    if (this.isItemProcessed(runId, processedKey)) {
      return;
    }

    this.markItemProcessed(runId, processedKey);

    const callItem: Extract<ResponseItem, { type: "function_call" }> = {
      type: "function_call",
      name: finalItem.name,
      arguments: finalItem.arguments ?? "",
      call_id: callId,
    };

    const outputItemId = randomUUID();

    const startEvent = this.makeEvent(childTraceContext(parentTrace), runId, {
      type: "item_start",
      item_id: outputItemId,
      item_type: "function_call_output",
    });
    await redis.publish(startEvent);

    let output: ResponseItem | undefined;
    try {
      output = await this.executeFunctionCallWithTimeout(callItem);
    } catch (error) {
      output = this.buildToolFailure(callId, error);
    }

    const toolOutput: Extract<ResponseItem, { type: "function_call_output" }> =
      output && output.type === "function_call_output"
        ? output
        : this.buildToolFailure(callId, new Error("Unknown tool error"));

    const payload = this.serializeToolOutput(toolOutput.output);
    const success = toolOutput.output.success ?? true;

    const outputItem: OutputItem = {
      id: outputItemId,
      type: "function_call_output",
      call_id: callId,
      output: payload,
      success,
      origin: "tool_harness",
    };

    const doneEvent = this.makeEvent(childTraceContext(parentTrace), runId, {
      type: "item_done",
      item_id: outputItemId,
      final_item: outputItem,
    });
    await redis.publish(doneEvent);
  }

  private async executeFunctionCallWithTimeout(
    callItem: Extract<ResponseItem, { type: "function_call" }>,
  ): Promise<ResponseItem> {
    const results = await withTimeout(
      this.toolRouter.executeFunctionCalls([callItem], {
        skipApproval: true,
      }),
      this.toolTimeoutMs,
      `Tool execution timed out after ${this.toolTimeoutMs}ms`,
    );
    if (!results.length) {
      throw new Error("Tool router returned no output");
    }
    return results[0];
  }

  private serializeToolOutput(payload: FunctionCallOutputPayload): string {
    const serialized = serializeFunctionCallOutputPayload(payload);
    if (typeof serialized === "string") {
      return serialized;
    }
    return JSON.stringify(serialized, null, 2);
  }

  private buildToolFailure(
    callId: string,
    error: unknown,
  ): Extract<ResponseItem, { type: "function_call_output" }> {
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    return {
      type: "function_call_output",
      call_id: callId,
      output: {
        content: `Tool execution failed: ${message}`,
        success: false,
      },
    };
  }

  private async handleScriptExecution(
    record: RedisStreamGroupRecord,
    finalItem: Extract<OutputItem, { type: "script_execution" }>,
    itemId: string,
  ): Promise<void> {
    const redis = this.redis;
    if (!redis) {
      throw new Error("Redis connection not initialized");
    }

    const runId = record.event.run_id;
    const parentTrace = record.event.trace_context;
    const scriptId = finalItem.id ?? itemId;
    const processedKey = `script:${scriptId}`;

    if (this.isItemProcessed(runId, processedKey)) {
      return;
    }
    this.markItemProcessed(runId, processedKey);

    const startEvent = this.makeEvent(childTraceContext(parentTrace), runId, {
      type: "script_execution_start",
      item_id: scriptId,
      code: finalItem.code,
    });
    await redis.publish(startEvent);

    const outputItemId = randomUUID();
    const outputStart = this.makeEvent(childTraceContext(parentTrace), runId, {
      type: "item_start",
      item_id: outputItemId,
      item_type: "script_execution_output",
    });
    await redis.publish(outputStart);

    try {
      await this.ensureScriptRuntime();
      const runtime = this.scriptRuntime;
      if (!runtime) {
        throw new Error("Script runtime not initialized");
      }

      const parseResult = parseScript(finalItem.code, this.scriptLimits);
      if (!parseResult.success || !parseResult.script) {
        const error = parseResult.error ?? new Error("Invalid script");
        await this.publishScriptError(
          parentTrace,
          runId,
          scriptId,
          outputItemId,
          error,
        );
        return;
      }

      const allowedTools = this.scriptRegistry.list();
      const tracker = new PromiseTracker(
        scriptId,
        this.scriptLimits.maxConcurrentToolCalls,
      );

      const contextSeed: ContextSeed = {
        conversationId: runId,
        sessionId: runId,
        turnId: runId,
        workingDirectory: process.cwd(),
        provider: "script_harness",
        model: "script_harness",
        availableTools: allowedTools,
        approvalsRequired: false,
        mode: "enabled",
      };

      const context = createScriptContext(contextSeed, {
        scriptId,
        limits: this.scriptLimits,
        remainingToolBudget: this.scriptLimits.maxToolInvocations,
        onProgress: (message, kind) => {
          console.debug(`[script ${scriptId}] ${kind ?? "info"}: ${message}`);
        },
      });

      const tools = createToolsProxy(
        this.scriptRegistry,
        tracker,
        {
          allowedTools,
          maxToolInvocations: this.scriptLimits.maxToolInvocations,
          maxConcurrentToolCalls: this.scriptLimits.maxConcurrentToolCalls,
          scriptId,
          mode: "enabled",
        },
        this.approvalBridge,
      );

      const execution = await runtime.execute(
        parseResult.script.sourceCode,
        { context, tools },
        this.scriptLimits,
      );

      await tracker.ensureAllSettled();

      const summary = {
        success: execution.ok,
        returnValue: execution.ok ? (execution.returnValue ?? null) : null,
        error: execution.ok ? undefined : execution.error,
        metadata: execution.metadata,
      };
      const resultString = JSON.stringify(summary, null, 2);

      if (execution.ok) {
        await this.publishScriptSuccess(
          parentTrace,
          runId,
          scriptId,
          outputItemId,
          resultString,
        );
      } else {
        await this.publishScriptError(
          parentTrace,
          runId,
          scriptId,
          outputItemId,
          execution.error ?? new Error("Script execution failed"),
          resultString,
        );
      }
    } catch (error) {
      await this.publishScriptError(
        parentTrace,
        runId,
        scriptId,
        outputItemId,
        error,
      );
    }
  }

  private async publishScriptSuccess(
    parentTrace: StreamEvent["trace_context"],
    runId: string,
    scriptId: string,
    outputItemId: string,
    result: string,
  ): Promise<void> {
    const redis = this.redis;
    if (!redis) {
      throw new Error("Redis connection not initialized");
    }

    const finalItem: OutputItem = {
      id: outputItemId,
      type: "script_execution_output",
      script_id: scriptId,
      result,
      success: true,
      origin: "script_harness",
    };

    const doneEvent = this.makeEvent(childTraceContext(parentTrace), runId, {
      type: "item_done",
      item_id: outputItemId,
      final_item: finalItem,
    });
    await redis.publish(doneEvent);

    const completeEvent = this.makeEvent(
      childTraceContext(parentTrace),
      runId,
      {
        type: "script_execution_done",
        item_id: scriptId,
        result,
        success: true,
      },
    );
    await redis.publish(completeEvent);
  }

  private async publishScriptError(
    parentTrace: StreamEvent["trace_context"],
    runId: string,
    scriptId: string,
    outputItemId: string,
    error: unknown,
    resultOverride?: string,
  ): Promise<void> {
    const redis = this.redis;
    if (!redis) {
      throw new Error("Redis connection not initialized");
    }

    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "Unknown script error");

    const errorDetails = {
      code: err.name || "ScriptError",
      message: err.message || "Script execution failed",
      stack: err.stack,
    };

    const finalItem: OutputItem = {
      id: outputItemId,
      type: "script_execution_output",
      script_id: scriptId,
      result:
        resultOverride ??
        JSON.stringify({ success: false, error: errorDetails }, null, 2),
      success: false,
      error: {
        code: errorDetails.code,
        message: errorDetails.message,
        stack: errorDetails.stack,
      },
      origin: "script_harness",
    };

    const doneEvent = this.makeEvent(childTraceContext(parentTrace), runId, {
      type: "item_done",
      item_id: outputItemId,
      final_item: finalItem,
    });
    await redis.publish(doneEvent);

    const errorEvent = this.makeEvent(childTraceContext(parentTrace), runId, {
      type: "script_execution_error",
      item_id: scriptId,
      error: {
        code: errorDetails.code,
        message: errorDetails.message,
        stack: errorDetails.stack,
      },
    });
    await redis.publish(errorEvent);
  }

  private async ensureScriptRuntime(): Promise<void> {
    if (!this.scriptRuntime) {
      this.scriptRuntime = new QuickJSRuntime();
    }
    if (!this.scriptRuntimeInitialized) {
      await this.scriptRuntime.initialize(this.scriptLimits);
      this.scriptRuntimeInitialized = true;
    }
  }

  private async disposeScriptRuntime(): Promise<void> {
    if (this.scriptRuntime && this.scriptRuntimeInitialized) {
      await this.scriptRuntime.dispose();
    }
    this.scriptRuntime = undefined;
    this.scriptRuntimeInitialized = false;
  }

  private makeEvent(
    traceContext: StreamEvent["trace_context"],
    runId: string,
    payload: StreamEvent["payload"],
  ): StreamEvent {
    const event: StreamEvent = {
      event_id: randomUUID(),
      timestamp: Date.now(),
      trace_context: traceContext,
      run_id: runId,
      type: payload.type,
      payload,
    };
    return StreamEventSchema.parse(event);
  }

  private async discoverOnce(): Promise<void> {
    const redis = this.redis;
    if (!redis) return;
    const { cursor, keys } = await redis.scanStreams(
      this.streamPattern,
      this.discoveryCursor,
      this.options.scanCount,
    );
    this.discoveryCursor = cursor;
    for (const key of keys) {
      if (!this.streams.has(key)) {
        await redis.ensureGroup(key, this.groupName);
        this.streams.add(key);
        this.streamOffsets.set(key, "0");
      }
    }
  }

  private async fullDiscoveryCycle(): Promise<void> {
    this.discoveryCursor = "0";
    do {
      await this.discoverOnce();
    } while (this.running && this.discoveryCursor !== "0");
  }

  private isItemProcessed(runId: string, key: string): boolean {
    const set = this.processedItems.get(runId);
    return set?.has(key) ?? false;
  }

  private markItemProcessed(runId: string, key: string): void {
    let set = this.processedItems.get(runId);
    if (!set) {
      set = new Set<string>();
      this.processedItems.set(runId, set);
    }
    set.add(key);
  }

  private clearRunState(runId: string): void {
    this.processedItems.delete(runId);
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    (timer as NodeJS.Timeout).unref?.();
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
