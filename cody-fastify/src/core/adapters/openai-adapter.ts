import { randomUUID } from "node:crypto";
import type { ToolSpec } from "codex-ts/src/core/client/client-common.js";
import {
  serializeFunctionCallOutputPayload,
  type FunctionCallOutputPayload,
} from "codex-ts/src/protocol/models.js";
import { toolRegistry } from "codex-ts/src/tools/registry.js";
import { RedisStream } from "../redis.js";
import {
  OutputItem,
  StreamEvent,
  StreamEventSchema,
  TraceContext,
} from "../schema.js";
import { formatToolsForResponsesApi } from "../tools/schema-formatter.js";
import { childTraceContext, createTraceContext } from "../tracing.js";

interface OpenAIAdapterOptions {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  providerId?: string;
  redis: RedisStream;
}

interface StreamParams {
  prompt: string;
  runId?: string;
  turnId?: string;
  threadId?: string;
  agentId?: string;
  traceContext?: TraceContext;
  tools?: ToolSpec[];
  reasoningEffort?: "low" | "medium" | "high";
}

type StreamableItemType = Extract<
  OutputItem["type"],
  "message" | "reasoning" | "function_call"
>;

type ItemAccumulator = {
  id: string;
  type: StreamableItemType;
  content: string[];
  name?: string;
  callId?: string;
  started?: boolean;
  argumentsChunks?: string[];
};

type PendingToolCall = {
  itemId: string;
  callId: string;
  name: string;
  arguments: string;
};

type UsageTotals = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const debugOpenAI = process.env.DEBUG_OPENAI === "1";

/**
 * Minimal OpenAI Responses API adapter that normalizes chunks into StreamEvents.
 * This keeps logic intentionally dumb: translate vendor chunks -> Redis events, nothing else.
 */
export class OpenAIStreamAdapter {
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly providerId: string;
  private readonly redis: RedisStream;

  constructor(opts: OpenAIAdapterOptions) {
    this.model = opts.model;
    this.apiKey = (opts.apiKey ?? process.env.OPENAI_API_KEY ?? "").trim();
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAI adapter");
    }
    this.baseUrl = opts.baseUrl ?? OPENAI_RESPONSES_URL;
    this.providerId = opts.providerId ?? "openai";
    this.redis = opts.redis;
  }

  async stream(params: StreamParams): Promise<{ runId: string }> {
    const runId = params.runId ?? randomUUID();
    const turnId = params.turnId ?? randomUUID();
    const threadId = params.threadId ?? randomUUID();
    const baseTrace = params.traceContext ?? createTraceContext();

    const responseStart = this.makeEvent(baseTrace, runId, {
      type: "response_start",
      response_id: runId,
      turn_id: turnId,
      thread_id: threadId,
      agent_id: params.agentId,
      model_id: this.model,
      provider_id: this.providerId,
      created_at: Date.now(),
    });
    await this.redis.publish(responseStart);

    const formattedTools =
      params.tools && params.tools.length > 0
        ? formatToolsForResponsesApi(params.tools)
        : undefined;
    const conversationInput: unknown[] = [
      {
        role: "user",
        content: [{ type: "input_text", text: params.prompt }],
      },
    ];

    const items = new Map<string, ItemAccumulator>();
    let usageTotals:
      | {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        }
      | undefined;
    const maxToolIterations =
      process.env.MAX_TOOL_ITERATIONS !== undefined
        ? parseInt(process.env.MAX_TOOL_ITERATIONS, 10)
        : 50;
    for (let iteration = 0; iteration < maxToolIterations; iteration++) {
      const pendingToolCalls: PendingToolCall[] = [];
      const iterationOutputItems: unknown[] = [];
      await this.runResponsesIteration({
        runId,
        turnId,
        threadId,
        baseTrace,
        conversation: conversationInput,
        formattedTools,
        reasoningEffort: params.reasoningEffort,
        items,
        pendingToolCalls,
        setUsageTotals: (usage) => {
          usageTotals = usage;
        },
        appendOutputItem: (item) => {
          iterationOutputItems.push(item);
        },
      });
      if (iterationOutputItems.length > 0) {
        conversationInput.push(...iterationOutputItems);
      }
      if (pendingToolCalls.length === 0) {
        break;
      }
      const continuationItems = await this.buildToolContinuationItems(
        pendingToolCalls,
        {
          runId,
          trace: baseTrace,
        },
      );
      conversationInput.push(...continuationItems);
    }

    // Final response_done event
    const responseDone = this.makeEvent(baseTrace, runId, {
      type: "response_done",
      response_id: runId,
      status: "complete",
      usage: usageTotals,
      finish_reason: null,
    });
    await this.redis.publish(responseDone);

    return { runId };
  }

  private async runResponsesIteration(options: {
    runId: string;
    turnId: string;
    threadId: string;
    baseTrace: TraceContext;
    conversation: unknown[];
    formattedTools?: unknown[];
    reasoningEffort?: "low" | "medium" | "high";
    items: Map<string, ItemAccumulator>;
    pendingToolCalls: PendingToolCall[];
    setUsageTotals: (usage: UsageTotals) => void;
    appendOutputItem: (item: unknown) => void;
  }): Promise<void> {
    const controller = new AbortController();
    const reqBody = {
      model: this.model,
      input: options.conversation,
      stream: true,
      ...(options.reasoningEffort && {
        reasoning: { effort: options.reasoningEffort, summary: "auto" },
      }),
      tools: options.formattedTools,
      tool_choice: options.formattedTools ? "auto" : undefined,
    };
    if (debugOpenAI) {
      console.log(
        "[openai] iteration conversation",
        JSON.stringify(options.conversation, null, 2),
      );
      console.log("[openai] request body:", JSON.stringify(reqBody, null, 2));
    }

    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const errorText = await res.text();
      const errEvent = this.makeEvent(options.baseTrace, options.runId, {
        type: "response_error",
        response_id: options.runId,
        error: {
          code: `HTTP_${res.status}`,
          message: errorText || "OpenAI response error",
        },
      });
      await this.redis.publish(errEvent);
      throw new Error(
        `OpenAI Responses API returned ${res.status}: ${errorText}`,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const buffer: string[] = [];

    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      if (readerDone) {
        done = true;
      }
      if (value) {
        buffer.push(decoder.decode(value, { stream: true }));
      }
      const joined = buffer.join("");
      const blocks = joined.split("\n\n");
      buffer.length = 0;
      if (blocks.length > 0) {
        const trailing = blocks.pop();
        if (
          trailing &&
          trailing.trim().length > 0 &&
          !trailing.trim().startsWith("data:")
        ) {
          buffer.push(trailing);
        } else if (
          trailing &&
          trailing.trim().startsWith("data:") &&
          !trailing.trim().endsWith("}")
        ) {
          buffer.push(trailing);
        }
      }

      for (const block of blocks) {
        const parsed = parseSseBlock(block);
        if (!parsed) continue;
        if (parsed.data === "[DONE]") {
          done = true;
          break;
        }

        if (debugOpenAI) {
          console.log(
            `[openai] SSE event: ${parsed.event}`,
            parsed.data.substring(0, 200),
          );
        }

        await this.handleOpenAIEvent({
          runId: options.runId,
          turnId: options.turnId,
          threadId: options.threadId,
          baseTrace: options.baseTrace,
          block: parsed,
          items: options.items,
          pendingToolCalls: options.pendingToolCalls,
          setUsageTotals: options.setUsageTotals,
          appendOutputItem: options.appendOutputItem,
        });
      }
    }

    await reader.cancel().catch(() => undefined);
    controller.abort();
  }

  private async buildToolContinuationItems(
    pendingCalls: PendingToolCall[],
    context: { runId: string; trace: TraceContext },
  ): Promise<unknown[]> {
    const continuationItems: unknown[] = [];
    for (const call of pendingCalls) {
      const payload = await this.executeToolForContinuation(call);
      const serializedOutput = this.serializeToolOutput(payload);
      await this.publishFunctionCallOutput(
        context.trace,
        context.runId,
        call.callId,
        serializedOutput,
        payload.success ?? true,
      );
      continuationItems.push({
        type: "function_call_output",
        call_id: call.callId,
        output: serializedOutput,
      });
    }
    return continuationItems;
  }

  private async executeToolForContinuation(
    call: PendingToolCall,
  ): Promise<FunctionCallOutputPayload> {
    try {
      const tool = toolRegistry.get(call.name);
      if (!tool) {
        throw new Error(`Tool "${call.name}" is not registered`);
      }
      const args =
        call.arguments && call.arguments.trim().length > 0
          ? JSON.parse(call.arguments)
          : {};
      const result = await tool.execute(args);
      return this.normalizeToolResult(result);
    } catch (error) {
      return {
        content: `Tool execution failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        success: false,
      };
    }
  }

  private normalizeToolResult(result: unknown): FunctionCallOutputPayload {
    if (result && typeof result === "object" && "content" in result) {
      const contentValue = (result as { content: unknown }).content;
      const successValue = (result as { success?: boolean }).success ?? true;
      return {
        content:
          typeof contentValue === "string"
            ? contentValue
            : JSON.stringify(contentValue),
        success: successValue,
      };
    }
    if (typeof result === "string") {
      return { content: result, success: true };
    }
    return {
      content: JSON.stringify(result),
      success: true,
    };
  }

  private async publishFunctionCallOutput(
    trace: TraceContext,
    runId: string,
    callId: string,
    output: string,
    success: boolean,
  ): Promise<void> {
    const redis = this.redis;
    const outputItemId = randomUUID();

    const startEvent = this.makeEvent(childTraceContext(trace), runId, {
      type: "item_start",
      item_id: outputItemId,
      item_type: "function_call_output",
    });
    await redis.publish(startEvent);

    const doneEvent = this.makeEvent(childTraceContext(trace), runId, {
      type: "item_done",
      item_id: outputItemId,
      final_item: {
        id: outputItemId,
        type: "function_call_output",
        call_id: callId,
        output,
        success,
        origin: "tool_harness",
      },
    });
    await redis.publish(doneEvent);
  }

  private serializeToolOutput(payload: FunctionCallOutputPayload): string {
    const serialized = serializeFunctionCallOutputPayload(payload);
    if (typeof serialized === "string") {
      return serialized;
    }
    return JSON.stringify(serialized, null, 2);
  }

  private async handleOpenAIEvent(input: {
    runId: string;
    turnId: string;
    threadId: string;
    baseTrace: TraceContext;
    block: { event: string; data: string };
    items: Map<string, ItemAccumulator>;
    pendingToolCalls: PendingToolCall[];
    setUsageTotals: (usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    }) => void;
    appendOutputItem: (item: unknown) => void;
  }) {
    const {
      runId,
      baseTrace,
      block,
      items,
      pendingToolCalls,
      setUsageTotals,
      appendOutputItem,
    } = input;
    const trace = childTraceContext(baseTrace);
    const dataJson = safeJson(block.data);

    // Heuristic mapping for Responses API events
    if (block.event === "response.output_text.delta" && dataJson) {
      if (debugOpenAI) {
        console.log("[openai] output_text.delta", dataJson);
      }
      const itemPayload = asObject(dataJson.item);
      const itemId = ensureValidItemId(
        getString(itemPayload?.id) ?? getString(dataJson.item_id),
      );
      const deltaValue = dataJson.delta;
      const delta =
        typeof deltaValue === "string"
          ? deltaValue
          : (getString((deltaValue as Record<string, unknown>)?.text) ?? "");
      const accumulator = ensureItem(items, itemId, "message");
      await this.publishItemStartIfNeeded(trace, runId, accumulator);
      await this.publishItemDelta(trace, runId, itemId, delta);
      accumulator.content.push(delta);
      return;
    }

    if (block.event === "response.output_tool_calls.delta" && dataJson) {
      const tool = asObject(dataJson.tool_call);
      const itemPayload = asObject(dataJson.item);
      const deltaPayload = asObject(dataJson.delta);
      const deltaFunction = asObject(deltaPayload?.function);
      const toolFunction = asObject(tool?.function);

      const callId = ensureValidItemId(
        getString(tool?.id) ?? getString(itemPayload?.id),
      );
      const name =
        getString(toolFunction?.name) ?? getString(deltaFunction?.name);
      const argsChunk = getString(deltaFunction?.arguments) ?? "";
      const accumulator = ensureItem(items, callId, "function_call");
      accumulator.name = accumulator.name ?? name;
      const payloadCallId = getString(toolFunction?.call_id);
      if (payloadCallId) {
        accumulator.callId = payloadCallId;
      } else if (!accumulator.callId) {
        accumulator.callId = callId;
      }
      accumulator.argumentsChunks = accumulator.argumentsChunks ?? [];
      if (argsChunk) accumulator.argumentsChunks.push(argsChunk);
      await this.publishItemStartIfNeeded(trace, runId, accumulator);
      if (argsChunk) {
        await this.publishItemDelta(trace, runId, callId, argsChunk);
      }
      return;
    }

    if (block.event === "response.function_call_arguments.delta" && dataJson) {
      const itemId = ensureValidItemId(getString(dataJson.item_id));
      const argsChunk = getString(dataJson.delta) ?? "";
      const accumulator = ensureItem(items, itemId, "function_call");
      const payloadCallId = getString(dataJson.call_id);
      if (payloadCallId) {
        accumulator.callId = payloadCallId;
      } else if (!accumulator.callId) {
        accumulator.callId = itemId;
      }
      accumulator.argumentsChunks = accumulator.argumentsChunks ?? [];
      if (argsChunk) {
        accumulator.argumentsChunks.push(argsChunk);
      }
      await this.publishItemStartIfNeeded(trace, runId, accumulator);
      if (argsChunk) {
        await this.publishItemDelta(trace, runId, itemId, argsChunk);
      }
      return;
    }

    if (block.event === "response.output_tool_calls.done" && dataJson) {
      const tool = asObject(dataJson.tool_call);
      const itemPayload = asObject(dataJson.item);
      const callId = ensureValidItemId(
        getString(tool?.id) ?? getString(itemPayload?.id),
      );
      const accumulator = ensureItem(items, callId, "function_call");
      const toolFunction = asObject(tool?.function);
      accumulator.name =
        accumulator.name ?? getString(toolFunction?.name) ?? "function_call";
      const payloadCallId =
        getString(toolFunction?.call_id) ?? getString(tool?.call_id);
      if (payloadCallId) {
        accumulator.callId = payloadCallId;
      } else if (!accumulator.callId) {
        accumulator.callId = callId;
      }
      const finalArgs =
        accumulator.argumentsChunks?.join("") ??
        getString(toolFunction?.arguments) ??
        "";
      accumulator.content = [finalArgs];
      await this.publishItemDone(trace, runId, accumulator);
      items.delete(callId);
      return;
    }

    if (block.event === "response.function_call_arguments.done" && dataJson) {
      const itemId = ensureValidItemId(getString(dataJson.item_id));
      const accumulator = ensureItem(items, itemId, "function_call");
      const finalArgs =
        accumulator.argumentsChunks?.join("") ??
        getString(dataJson.arguments) ??
        "";
      const payloadCallId = getString(dataJson.call_id);
      if (payloadCallId) {
        accumulator.callId = payloadCallId;
      } else if (!accumulator.callId) {
        accumulator.callId = itemId;
      }
      if (finalArgs) {
        accumulator.content = [finalArgs];
      }
      return;
    }

    if (block.event === "response.reasoning.delta" && dataJson) {
      if (debugOpenAI) {
        console.log("[openai] reasoning.delta received:", dataJson);
      }
      const itemPayload = asObject(dataJson.item);
      const itemId = ensureValidItemId(
        getString(itemPayload?.id) ?? getString(dataJson.item_id),
      );
      const delta = getString(dataJson.delta) ?? "";
      const accumulator = ensureItem(items, itemId, "reasoning");
      await this.publishItemStartIfNeeded(trace, runId, accumulator);
      await this.publishItemDelta(trace, runId, itemId, delta);
      accumulator.content.push(delta);
      if (debugOpenAI) {
        console.log(
          `[openai] reasoning item ${itemId} now has ${accumulator.content.length} chunks`,
        );
      }
      return;
    }

    if (block.event === "response.output_item.done" && dataJson) {
      const itemPayload = asObject(dataJson.item);
      const itemId = getString(itemPayload?.id) || "message-default";
      const itemType = getString(itemPayload?.type);
      let item = items.get(itemId);

      // Handle reasoning items that come with summary field (not content)
      if (itemType === "reasoning" && !item) {
        const summaryArray = itemPayload?.summary;
        if (Array.isArray(summaryArray) && summaryArray.length > 0) {
          // Extract text from summary array (usually [{type: "summary_text", text: "..."}])
          const summaryTexts = summaryArray
            .map((s: unknown) => {
              if (s && typeof s === "object" && "text" in s) {
                return String(s.text);
              }
              return "";
            })
            .filter(Boolean);
          const content = summaryTexts.join("\n");

          if (content) {
            // Publish item_start first (reducer requires it)
            const startEvent = this.makeEvent(trace, runId, {
              type: "item_start",
              item_id: itemId,
              item_type: "reasoning",
              initial_content: undefined,
            });
            await this.redis.publish(startEvent);

            // Create reasoning item from summary
            const reasoningItem: OutputItem = {
              id: itemId,
              type: "reasoning",
              content,
              origin: "agent",
            };
            const doneEvent = this.makeEvent(trace, runId, {
              type: "item_done",
              item_id: itemId,
              final_item: reasoningItem,
            });
            await this.redis.publish(doneEvent);
            if (itemPayload) {
              appendOutputItem(itemPayload);
            }
            return;
          }
        }
      }

      // For reasoning items, try to find by type if ID doesn't match
      if (!item && itemType === "reasoning") {
        for (const [id, candidate] of items.entries()) {
          if (candidate.type === "reasoning") {
            item = candidate;
            items.delete(id);
            break;
          }
        }
      }

      if (item) {
        if (item.type === "function_call") {
          item.name =
            item.name ?? getString(asObject(itemPayload)?.name) ?? undefined;
          const payloadCallId = getString(itemPayload?.call_id);
          if (payloadCallId) {
            item.callId = payloadCallId;
          } else if (!item.callId) {
            item.callId = itemId;
          }
          const argsText = getString(itemPayload?.arguments);
          if (
            argsText &&
            (!item.argumentsChunks || item.argumentsChunks.length === 0)
          ) {
            item.content = [argsText];
          }
          pendingToolCalls.push({
            itemId,
            callId: item.callId ?? itemId,
            name: item.name ?? "function_call",
            arguments:
              (item.argumentsChunks?.length
                ? item.argumentsChunks.join("")
                : item.content.join("")) ?? "",
          });
        }
        await this.publishItemDone(trace, runId, item);
        if (item.id !== itemId) {
          items.delete(item.id);
        }
      }
      if (itemPayload) {
        appendOutputItem(itemPayload);
      }
      return;
    }

    if (block.event === "response.completed" && dataJson) {
      const responsePayload = asObject(dataJson.response);
      const usage =
        asObject(dataJson.usage) ?? asObject(responsePayload?.usage);
      if (usage) {
        const promptTokens = getNumber(usage.prompt_tokens) ?? 0;
        const completionTokens = getNumber(usage.completion_tokens) ?? 0;
        const totalTokens = getNumber(usage.total_tokens) ?? 0;
        setUsageTotals({
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
        });
        const usageEvent = this.makeEvent(trace, runId, {
          type: "usage_update",
          response_id: runId,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
          },
        });
        await this.redis.publish(usageEvent);
      }
      // Finalize any remaining reasoning items that haven't been finalized yet
      const remainingReasoningItems = Array.from(items.entries()).filter(
        ([_, item]) => item.type === "reasoning",
      );
      if (debugOpenAI && remainingReasoningItems.length > 0) {
        console.log(
          `[openai] Finalizing ${remainingReasoningItems.length} remaining reasoning items`,
        );
      }
      for (const [itemId, item] of remainingReasoningItems) {
        await this.publishItemDone(trace, runId, item);
        items.delete(itemId);
      }
      return;
    }

    // Unknown event type; ignore but keep flow going.
  }

  private async publishItemStartIfNeeded(
    trace: TraceContext,
    runId: string,
    item: ItemAccumulator,
  ) {
    if (item.started) return;
    item.started = true;
    const payload =
      item.type === "function_call"
        ? {
            type: "item_start" as const,
            item_id: item.id,
            item_type: item.type,
            initial_content: undefined,
            name: item.name,
            arguments: undefined,
          }
        : {
            type: "item_start" as const,
            item_id: item.id,
            item_type: item.type,
            initial_content: undefined,
          };
    await this.redis.publish(this.makeEvent(trace, runId, payload));
  }

  private async publishItemDelta(
    trace: TraceContext,
    runId: string,
    itemId: string,
    delta: string,
  ) {
    const event = this.makeEvent(trace, runId, {
      type: "item_delta",
      item_id: itemId,
      delta_content: delta,
    });
    await this.redis.publish(event);
  }

  private async publishItemDone(
    trace: TraceContext,
    runId: string,
    item: ItemAccumulator,
  ) {
    const finalItem: OutputItem =
      item.type === "function_call"
        ? {
            id: item.id,
            type: "function_call",
            name: item.name ?? "unknown",
            arguments:
              (item.argumentsChunks?.length
                ? item.argumentsChunks.join("")
                : item.content.join("")) ?? "",
            call_id: item.callId ?? item.id,
            origin: "agent",
          }
        : ({
            id: item.id,
            type: item.type,
            content: item.content.join(""),
            origin: "agent",
          } as OutputItem);

    const event = this.makeEvent(trace, runId, {
      type: "item_done",
      item_id: item.id,
      final_item: finalItem,
    });
    await this.redis.publish(event);
  }

  private makeEvent(
    trace: TraceContext,
    runId: string,
    payload: StreamEvent["payload"],
  ): StreamEvent {
    const event: StreamEvent = {
      event_id: randomUUID(),
      timestamp: Date.now(),
      trace_context: trace,
      run_id: runId,
      type: payload.type,
      payload,
    };
    return StreamEventSchema.parse(event);
  }
}

function safeJson(input: unknown): Record<string, unknown> | undefined {
  if (typeof input !== "string") return undefined;
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

function parseSseBlock(
  block: string,
): { event: string; data: string } | undefined {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return undefined;

  let eventName = "message";
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

function ensureItem(
  items: Map<string, ItemAccumulator>,
  id: string,
  type: ItemAccumulator["type"],
): ItemAccumulator {
  const existing = items.get(id);
  if (existing) return existing;
  const created: ItemAccumulator = { id, type, content: [] };
  items.set(id, created);
  return created;
}

function ensureValidItemId(rawId: string | undefined): string {
  if (rawId && rawId.trim().length > 0) {
    return rawId;
  }
  return randomUUID();
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
