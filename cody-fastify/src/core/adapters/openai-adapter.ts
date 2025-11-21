import { randomUUID } from "node:crypto";
import { RedisStream } from "../redis.js";
import {
  OutputItem,
  StreamEvent,
  StreamEventSchema,
  TraceContext,
} from "../schema.js";
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

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const UUID_REGEX =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;

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
    const baseTrace = createTraceContext();

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

    const controller = new AbortController();
    const reqBody = {
      model: this.model,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: params.prompt }],
        },
      ],
      stream: true,
      reasoning: { effort: "medium" },
    };

    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const errorText = await res.text();
      const errEvent = this.makeEvent(baseTrace, runId, {
        type: "response_error",
        response_id: runId,
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
    const items = new Map<string, ItemAccumulator>();

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
      // Keep trailing partial block in buffer
      buffer.length = 0;
      if (blocks.length > 0) {
        const trailing = blocks.pop();
        if (trailing && trailing.trim().length > 0 && !trailing.trim().startsWith("data:")) {
          buffer.push(trailing);
        } else if (trailing && trailing.trim().startsWith("data:") && !trailing.trim().endsWith("}")) {
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

        await this.handleOpenAIEvent({
          runId,
          turnId,
          threadId,
          baseTrace,
          block: parsed,
          items,
        });
      }
    }

    // Final response_done event
    const responseDone = this.makeEvent(baseTrace, runId, {
      type: "response_done",
      response_id: runId,
      status: "complete",
      usage: undefined,
      finish_reason: null,
    });
    await this.redis.publish(responseDone);

    return { runId };
  }

  private async handleOpenAIEvent(input: {
    runId: string;
    turnId: string;
    threadId: string;
    baseTrace: TraceContext;
    block: { event: string; data: string };
    items: Map<string, ItemAccumulator>;
  }) {
    const { runId, baseTrace, block, items } = input;
    const trace = childTraceContext(baseTrace);
    const dataJson = safeJson(block.data);

    // Heuristic mapping for Responses API events
    if (block.event === "response.output_text.delta" && dataJson) {
      const itemId = ensureValidItemId(dataJson?.item?.id as string | undefined);
      const delta = typeof dataJson?.delta === "string" ? dataJson.delta : "";
      const item = ensureItem(items, itemId, "message");
      await this.publishItemStartIfNeeded(trace, runId, item);
      await this.publishItemDelta(trace, runId, itemId, delta);
      item.content.push(delta);
      return;
    }

    if (block.event === "response.output_tool_calls.delta" && dataJson) {
      const tool = dataJson?.tool_call;
      const callId = ensureValidItemId(
        (tool?.id as string | undefined) ?? (dataJson?.item?.id as string | undefined),
      );
      const name =
        (tool?.function?.name as string | undefined) ??
        (dataJson?.delta?.function?.name as string | undefined);
      const argsChunk =
        (dataJson?.delta?.function?.arguments as string | undefined) ?? "";
      const item = ensureItem(items, callId, "function_call");
      item.name = item.name ?? name;
      item.callId = callId;
      item.argumentsChunks = item.argumentsChunks ?? [];
      if (argsChunk) item.argumentsChunks.push(argsChunk);
      await this.publishItemStartIfNeeded(trace, runId, {
        ...item,
        name: item.name,
        callId: callId,
      });
      if (argsChunk) {
        await this.publishItemDelta(trace, runId, callId, argsChunk);
      }
      return;
    }

    if (block.event === "response.output_tool_calls.done" && dataJson) {
      const tool = dataJson?.tool_call;
      const callId = ensureValidItemId(
        (tool?.id as string | undefined) ?? (dataJson?.item?.id as string | undefined),
      );
      const item = ensureItem(items, callId, "function_call");
      item.name =
        item.name ??
        (tool?.function?.name as string | undefined) ??
        "function_call";
      item.callId = callId;
      const finalArgs =
        item.argumentsChunks?.join("") ??
        (tool?.function?.arguments as string | undefined) ??
        "";
      await this.publishItemDone(trace, runId, {
        ...item,
        content: [finalArgs],
      });
      return;
    }

    if (block.event === "response.reasoning.delta" && dataJson) {
      const itemId = ensureValidItemId(dataJson?.item?.id as string | undefined);
      const delta = typeof dataJson?.delta === "string" ? dataJson.delta : "";
      const item = ensureItem(items, itemId, "reasoning");
      await this.publishItemStartIfNeeded(trace, runId, item);
      await this.publishItemDelta(trace, runId, itemId, delta);
      item.content.push(delta);
      return;
    }

    if (block.event === "response.output_item.done" && dataJson) {
      const itemId = (dataJson?.item?.id as string) || "message-default";
      const item = items.get(itemId);
      if (item) {
        await this.publishItemDone(trace, runId, item);
      }
      return;
    }

    if (block.event === "response.completed" && dataJson?.usage) {
      const usageEvent = this.makeEvent(trace, runId, {
        type: "usage_update",
        response_id: runId,
        usage: {
          prompt_tokens: dataJson.usage.prompt_tokens ?? 0,
          completion_tokens: dataJson.usage.completion_tokens ?? 0,
          total_tokens: dataJson.usage.total_tokens ?? 0,
        },
      });
      await this.redis.publish(usageEvent);
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
        : {
            id: item.id,
            type: item.type,
            content: item.content.join(""),
            origin: "agent",
          } as OutputItem;

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
  if (rawId && UUID_REGEX.test(rawId)) {
    return rawId;
  }
  return randomUUID();
}
