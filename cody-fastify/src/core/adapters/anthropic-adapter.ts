import { randomUUID } from "node:crypto";
import { RedisStream } from "../redis.js";
import {
  OutputItem,
  StreamEvent,
  StreamEventSchema,
  TraceContext,
} from "../schema.js";
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
}

type ItemAccumulator = {
  id: string;
  type: OutputItem["type"];
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

    const reqBody = {
      model: this.model,
      max_output_tokens: this.maxOutputTokens,
      stream: true,
      messages: [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: params.prompt }],
        },
      ],
    };

    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
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
    const items = new Map<string, ItemAccumulator>();
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
        if (!dataJson) continue;

        switch (parsed.event) {
          case "content_block_start": {
            const blockInfo = asObject(dataJson.content_block);
            if (!blockInfo) break;
            const itemId = ensureItemId(blockInfo.id);
            if (blockInfo.type === "text") {
              const accumulator = ensureItem(items, itemId, "message");
              await this.publishItemStartIfNeeded(trace, runId, accumulator);
            } else if (blockInfo.type === "thinking") {
              const accumulator = ensureItem(items, itemId, "reasoning");
              await this.publishItemStartIfNeeded(trace, runId, accumulator);
            } else if (blockInfo.type === "tool_use") {
              const accumulator = ensureItem(items, itemId, "function_call");
              accumulator.name =
                typeof blockInfo.name === "string"
                  ? blockInfo.name
                  : "tool_use";
              accumulator.callId = itemId;
              accumulator.argumentsChunks = [];
              await this.publishItemStartIfNeeded(trace, runId, accumulator);
            }
            break;
          }

          case "content_block_delta": {
            const blockInfo = asObject(dataJson.content_block);
            const delta = asObject(dataJson.delta);
            if (!blockInfo || !delta) break;
            const itemId = ensureItemId(blockInfo.id);
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
            const blockInfo = asObject(dataJson.content_block);
            if (!blockInfo) break;
            const itemId = ensureItemId(blockInfo.id);
            const accumulator = items.get(itemId);
            if (!accumulator) break;

            if (accumulator.type === "function_call") {
              const finalArgs =
                accumulator.argumentsChunks?.join("") ??
                (typeof blockInfo.input === "string"
                  ? blockInfo.input
                  : JSON.stringify(blockInfo.input ?? {}));
              accumulator.content = [finalArgs];
              accumulator.callId = accumulator.callId ?? itemId;
            }
            await this.publishItemDone(trace, runId, accumulator);
            items.delete(itemId);
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
      const usageEvent = this.makeEvent(childTraceContext(baseTrace), runId, {
        type: "usage_update",
        response_id: runId,
        usage: usagePayload,
      });
      await this.redis.publish(usageEvent);
    }

    const responseDone = this.makeEvent(childTraceContext(baseTrace), runId, {
      type: "response_done",
      response_id: runId,
      status: "complete",
      usage: usagePayload,
      finish_reason: finishReason,
    });
    await this.redis.publish(responseDone);

    return { runId };
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
