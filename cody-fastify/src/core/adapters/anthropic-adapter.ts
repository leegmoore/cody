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
import { formatToolsForAnthropicMessages } from "../tools/schema-formatter.js";
import { childTraceContext, createTraceContext } from "../tracing.js";

interface AnthropicAdapterOptions {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  providerId?: string;
  redis: RedisStream;
  maxOutputTokens?: number;
}

interface StreamParams {
  prompt: string;
  runId?: string;
  turnId?: string;
  threadId?: string;
  agentId?: string;
  traceContext?: TraceContext;
  tools?: ToolSpec[];
  thinkingBudget?: number;
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

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

export class AnthropicStreamAdapter {
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly providerId: string;
  private readonly redis: RedisStream;
  private readonly maxOutputTokens: number;

  constructor(opts: AnthropicAdapterOptions) {
    this.model = opts.model;
    this.apiKey = (opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "").trim();
    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required for Anthropic adapter");
    }
    this.baseUrl = opts.baseUrl ?? ANTHROPIC_MESSAGES_URL;
    this.providerId = opts.providerId ?? "anthropic";
    this.redis = opts.redis;
    this.maxOutputTokens = opts.maxOutputTokens ?? 2048;
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
        ? formatToolsForAnthropicMessages(params.tools)
        : undefined;

    // Build initial conversation
    const conversationMessages: Array<{
      role: "user" | "assistant";
      content: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: unknown }
        | { type: "tool_result"; tool_use_id: string; content: string }
      >;
    }> = [
      {
        role: "user" as const,
        content: [{ type: "text" as const, text: params.prompt }],
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
      const iterationContentBlocks: Array<{
        type: "text" | "tool_use";
        id?: string;
        text?: string;
        name?: string;
        input?: unknown;
      }> = [];
      const pendingToolCalls: Array<{
        callId: string;
        toolUseId: string;
        name: string;
        input: unknown;
      }> = [];

      // Run one iteration
      const iterationResult = await this.runIteration({
        runId,
        turnId,
        threadId,
        baseTrace,
        conversationMessages,
        formattedTools,
        thinkingBudget: params.thinkingBudget,
        items,
        iterationContentBlocks,
        pendingToolCalls,
        setUsageTotals: (usage) => {
          usageTotals = usage;
        },
      });

      // Add assistant message with content blocks to conversation
      if (iterationContentBlocks.length > 0) {
        conversationMessages.push({
          role: "assistant" as const,
          content: iterationContentBlocks.map((block) => {
            if (block.type === "text") {
              return { type: "text" as const, text: block.text ?? "" };
            } else {
              return {
                type: "tool_use" as const,
                id: block.id ?? "",
                name: block.name ?? "",
                input: block.input ?? {},
              };
            }
          }),
        });
      }

      // If no tool calls, we're done
      // Also check finishReason - if it's not "tool_use", we're done
      if (
        pendingToolCalls.length === 0 ||
        (iterationResult.finishReason &&
          iterationResult.finishReason !== "tool_use")
      ) {
        break;
      }

      // Inline tool execution (OpenAI parity): execute tools now, publish outputs, then add tool_result blocks
      const toolResultsInline: Array<{
        toolUseId: string;
        output: string;
        isError?: boolean;
      }> = [];
      for (const call of pendingToolCalls) {
        try {
          const tool = toolRegistry.get(call.name);
          if (!tool) {
            throw new Error(`Tool "${call.name}" is not registered`);
          }
          const args = call.input ?? {};
          const result = await tool.execute(args as never);
          const payload = this.normalizeToolResult(result);
          const serializedOutput = this.serializeToolOutput(payload);
          // Publish function_call_output for reducers/persistence
          await this.publishFunctionCallOutput(
            baseTrace,
            runId,
            call.callId,
            serializedOutput,
            payload.success ?? true,
          );
          toolResultsInline.push({
            toolUseId: call.toolUseId,
            output: serializedOutput,
            isError: payload.success === false,
          });
        } catch (error) {
          const content = `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`;
          await this.publishFunctionCallOutput(
            baseTrace,
            runId,
            call.callId,
            content,
            false,
          );
          toolResultsInline.push({
            toolUseId: call.toolUseId,
            output: content,
            isError: true,
          });
        }
      }

      if (toolResultsInline.length > 0) {
        // Add user message with tool_result blocks for next Anthropic iteration
        conversationMessages.push({
          role: "user" as const,
          content: toolResultsInline.map((result) => ({
            type: "tool_result" as const,
            tool_use_id: result.toolUseId,
            content: result.output,
            is_error: result.isError ?? false,
          })),
        });
      }
    }

    // Final response_done event
    const responseDone = this.makeEvent(childTraceContext(baseTrace), runId, {
      type: "response_done",
      response_id: runId,
      status: "complete",
      usage: usageTotals,
      finish_reason: null,
    });
    await this.redis.publish(responseDone);

    return { runId };
  }

  private async runIteration(options: {
    runId: string;
    turnId: string;
    threadId: string;
    baseTrace: TraceContext;
    conversationMessages: Array<{
      role: "user" | "assistant";
      content: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: unknown }
        | { type: "tool_result"; tool_use_id: string; content: string }
      >;
    }>;
    formattedTools?: ReturnType<typeof formatToolsForAnthropicMessages>;
    thinkingBudget?: number;
    items: Map<string, ItemAccumulator>;
    iterationContentBlocks: Array<{
      type: "text" | "tool_use";
      id?: string;
      text?: string;
      name?: string;
      input?: unknown;
    }>;
    pendingToolCalls: Array<{
      callId: string;
      toolUseId: string;
      name: string;
      input: unknown;
    }>;
    setUsageTotals: (usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    }) => void;
  }): Promise<{ finishReason: string | null }> {
    const {
      runId,
      turnId: _turnId,
      threadId: _threadId,
      baseTrace,
      conversationMessages,
      formattedTools,
      thinkingBudget,
      items,
      iterationContentBlocks,
      pendingToolCalls,
      setUsageTotals,
    } = options;

    const reqBody: {
      model: string;
      max_tokens: number;
      stream: true;
      messages: Array<{
        role: "user" | "assistant";
        content: Array<
          | { type: "text"; text: string }
          | { type: "tool_use"; id: string; name: string; input: unknown }
          | { type: "tool_result"; tool_use_id: string; content: string }
        >;
      }>;
      tools?: ReturnType<typeof formatToolsForAnthropicMessages>;
      thinking?: { type: "enabled"; budget_tokens: number };
    } = {
      model: this.model,
      max_tokens: this.maxOutputTokens,
      stream: true,
      messages: conversationMessages,
      tools: formattedTools,
      ...(thinkingBudget && {
        thinking: {
          type: "enabled" as const,
          budget_tokens: thinkingBudget,
        },
      }),
    };

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
    };
    if (formattedTools) {
      headers["anthropic-beta"] =
        process.env.ANTHROPIC_BETA_TOOLS ?? "tools-2024-04-04";
    }
    if (thinkingBudget) {
      headers["anthropic-beta"] =
        process.env.ANTHROPIC_BETA_THINKING ??
        "interleaved-thinking-2025-05-14";
    }

    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody),
    });

    if (!res.ok || !res.body) {
      const errorText = await res.text();
      const errEvent = this.makeEvent(baseTrace, runId, {
        type: "response_error",
        response_id: runId,
        error: {
          code: `HTTP_${res.status}`,
          message: errorText || "Anthropic response error",
        },
      });
      await this.redis.publish(errEvent);
      throw new Error(
        `Anthropic Messages API returned ${res.status}: ${errorText}`,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const buffer: string[] = [];
    const blockIndexToItemId = new Map<number, string>();
    const blockIndexToContentBlock = new Map<
      number,
      {
        type: "text" | "tool_use";
        id?: string;
        text?: string;
        name?: string;
        input?: unknown;
      }
    >();
    let finishReason: string | null = null;
    let usage: { input_tokens?: number; output_tokens?: number } | undefined;

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
          trailing.trim() &&
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

        const trace = childTraceContext(baseTrace);
        const dataJson = safeJson(parsed.data);
        if (!dataJson) {
          continue;
        }

        switch (parsed.event) {
          case "content_block_start": {
            const blockInfo = asObject(dataJson.content_block);
            if (!blockInfo) {
              break;
            }
            const blockIndex = getNumber(dataJson.index);
            const existingId =
              typeof blockIndex === "number"
                ? blockIndexToItemId.get(blockIndex)
                : undefined;
            const itemId = existingId ?? ensureItemId(getString(blockInfo?.id));
            if (typeof blockIndex === "number") {
              blockIndexToItemId.set(blockIndex, itemId);
            }
            if (blockInfo.type === "text") {
              const accumulator = ensureItem(items, itemId, "message");
              await this.publishItemStartIfNeeded(trace, runId, accumulator);
              if (typeof blockIndex === "number") {
                blockIndexToContentBlock.set(blockIndex, {
                  type: "text",
                  text: "",
                });
              }
            } else if (blockInfo.type === "thinking") {
              const accumulator = ensureItem(items, itemId, "reasoning");
              await this.publishItemStartIfNeeded(trace, runId, accumulator);
            } else if (blockInfo.type === "tool_use") {
              const accumulator = ensureItem(items, itemId, "function_call");
              const toolUseId = getString(blockInfo?.id) ?? itemId;
              accumulator.name =
                typeof blockInfo.name === "string"
                  ? blockInfo.name
                  : "tool_use";
              accumulator.callId = toolUseId;
              accumulator.argumentsChunks = [];
              await this.publishItemStartIfNeeded(trace, runId, accumulator);
              if (typeof blockIndex === "number") {
                blockIndexToContentBlock.set(blockIndex, {
                  type: "tool_use",
                  id: toolUseId,
                  name: accumulator.name,
                  input: {},
                });
              }
            }
            break;
          }

          case "content_block_delta": {
            const delta = asObject(dataJson.delta);
            if (!delta) {
              break;
            }
            const blockIndex = getNumber(dataJson.index);
            const itemId =
              typeof blockIndex === "number"
                ? blockIndexToItemId.get(blockIndex)
                : undefined;
            if (!itemId) break;
            const accumulator = items.get(itemId);
            if (!accumulator) break;

            if (
              accumulator.type === "message" ||
              accumulator.type === "reasoning"
            ) {
              const text =
                typeof delta.text === "string"
                  ? delta.text
                  : typeof delta.thinking === "string"
                    ? delta.thinking
                    : "";
              if (text) {
                await this.publishItemDelta(trace, runId, itemId, text);
                accumulator.content.push(text);
                if (
                  typeof blockIndex === "number" &&
                  accumulator.type === "message"
                ) {
                  const contentBlock = blockIndexToContentBlock.get(blockIndex);
                  if (contentBlock && contentBlock.type === "text") {
                    contentBlock.text = (contentBlock.text ?? "") + text;
                  }
                }
              }
            } else if (accumulator.type === "function_call") {
              if (!accumulator.argumentsChunks) {
                accumulator.argumentsChunks = [];
              }
              const partial =
                typeof delta.partial_json === "string"
                  ? delta.partial_json
                  : "";
              if (partial) {
                accumulator.argumentsChunks.push(partial);
                await this.publishItemDelta(trace, runId, itemId, partial);
              }
            }
            break;
          }

          case "content_block_stop": {
            const blockIndex = getNumber(dataJson.index);
            const itemId =
              typeof blockIndex === "number"
                ? blockIndexToItemId.get(blockIndex)
                : undefined;
            if (!itemId) {
              break;
            }
            const accumulator = items.get(itemId);
            if (!accumulator) {
              break;
            }
            const blockInfo = asObject(dataJson.content_block);

            if (accumulator.type === "function_call") {
              const finalArgs =
                accumulator.argumentsChunks?.join("") ??
                (typeof blockInfo?.input === "string"
                  ? blockInfo.input
                  : JSON.stringify(blockInfo?.input ?? {}));
              accumulator.content = [finalArgs];
              // Ensure we use the Anthropic tool_use block id if available
              const anthropicToolUseId = getString(blockInfo?.id);
              accumulator.callId =
                anthropicToolUseId ?? accumulator.callId ?? itemId;
              const toolUseId = accumulator.callId;
              let input: unknown;
              try {
                input = JSON.parse(finalArgs);
              } catch {
                input = finalArgs;
              }
              pendingToolCalls.push({
                callId: toolUseId,
                toolUseId,
                name: accumulator.name ?? "tool_use",
                input,
              });
              if (typeof blockIndex === "number") {
                const contentBlock = blockIndexToContentBlock.get(blockIndex);
                if (contentBlock && contentBlock.type === "tool_use") {
                  contentBlock.input = input;
                }
              }
            }
            await this.publishItemDone(trace, runId, accumulator);
            items.delete(itemId);
            if (typeof blockIndex === "number") {
              blockIndexToItemId.delete(blockIndex);
            }
            break;
          }

          case "message_delta": {
            const delta = asObject(dataJson.delta);
            if (delta?.stop_reason) {
              finishReason = String(delta.stop_reason);
            }
            break;
          }

          case "message_stop": {
            const message = asObject(dataJson.message);
            const usageInfo = asObject(message?.usage);
            if (usageInfo) {
              usage = {
                input_tokens:
                  typeof usageInfo.input_tokens === "number"
                    ? usageInfo.input_tokens
                    : undefined,
                output_tokens:
                  typeof usageInfo.output_tokens === "number"
                    ? usageInfo.output_tokens
                    : undefined,
              };
            }
            // Also check stop_reason from message_stop event
            if (message?.stop_reason && !finishReason) {
              finishReason = String(message.stop_reason);
            }
            break;
          }

          case "error": {
            const errorInfo = asObject(dataJson.error);
            const errEvent = this.makeEvent(trace, runId, {
              type: "response_error",
              response_id: runId,
              error: {
                code:
                  typeof errorInfo?.type === "string"
                    ? errorInfo.type
                    : "ANTHROPIC_ERROR",
                message:
                  typeof errorInfo?.message === "string"
                    ? errorInfo.message
                    : "Anthropic stream error",
              },
            });
            await this.redis.publish(errEvent);
            break;
          }

          default:
            break;
        }
      }
    }

    // Add content blocks to iteration result
    for (const [_, contentBlock] of blockIndexToContentBlock) {
      iterationContentBlocks.push(contentBlock);
    }

    // Publish usage update
    const usagePayload =
      usage && (usage.input_tokens ?? usage.output_tokens ?? 0) > 0
        ? {
            prompt_tokens: usage.input_tokens ?? 0,
            completion_tokens: usage.output_tokens ?? 0,
            total_tokens:
              (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
          }
        : undefined;

    if (usagePayload) {
      setUsageTotals(usagePayload);
      const usageEvent = this.makeEvent(childTraceContext(baseTrace), runId, {
        type: "usage_update",
        response_id: runId,
        usage: usagePayload,
      });
      await this.redis.publish(usageEvent);
    }

    return { finishReason };
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
            name: item.name,
            arguments: "",
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
    if (!delta) return;
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
            name: item.name ?? "tool_use",
            arguments: item.argumentsChunks?.length
              ? item.argumentsChunks.join("")
              : item.content.join(""),
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

  private serializeToolOutput(payload: FunctionCallOutputPayload): string {
    const serialized = serializeFunctionCallOutputPayload(payload);
    if (typeof serialized === "string") {
      return serialized;
    }
    return JSON.stringify(serialized, null, 2);
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

function safeJson(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value);
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
      const value = line.slice("data:".length).trim();
      data += value;
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

function ensureItemId(rawId: unknown): string {
  if (typeof rawId === "string" && rawId.trim().length > 0) {
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
