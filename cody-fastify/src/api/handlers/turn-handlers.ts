import type { FastifyRequest, FastifyReply } from "fastify";
import type { TurnQueryParams, TurnStatusResponse } from "../schemas/turn.js";
import { NotFoundError } from "../errors/api-errors.js";
import { clientStreamManager } from "../client-stream/client-stream-manager.js";
import type { CodexRuntime } from "../services/codex-runtime.js";
import type {
  ClientEvent,
  StoredEvent,
  StreamMessage,
  TurnRecord,
} from "../types/turns.js";
// NOTE(Phase 2): Type fix for legacy compatibility
import type { ResponseItem } from "codex-ts/src/protocol/models.ts";

export function buildTurnHandlers(_codexRuntime: CodexRuntime) {
  return {
    async getStatus(
      req: FastifyRequest<{
        Params: { id: string };
        Querystring: TurnQueryParams;
      }>,
      reply: FastifyReply,
    ): Promise<void> {
      const turnId = req.params.id;
      const turn = await clientStreamManager.getTurn(turnId);

      if (!turn) {
        throw new NotFoundError(`Turn ${turnId} not found`);
      }

      // Build response based on query params
      const thinkingLevel = req.query.thinkingLevel;
      const toolLevel = req.query.toolLevel;

      const response: TurnStatusResponse = {
        turnId: turn.turnId,
        conversationId: turn.conversationId,
        status: turn.status,
        startedAt: turn.startedAt,
        completedAt: turn.completedAt,
      };

      // Include result if present
      if (turn.result) {
        response.result = turn.result;
      }

      // Include thinking based on thinkingLevel
      if (thinkingLevel !== "none") {
        response.thinking = turn.thinking;
      } else {
        response.thinking = [];
      }

      // Include toolCalls based on toolLevel
      if (toolLevel === "full") {
        response.toolCalls = turn.toolCalls;
      } else {
        response.toolCalls = [];
      }

      // Include model provider info if available
      if (turn.modelProviderId) {
        response.modelProviderId = turn.modelProviderId;
      }
      if (turn.modelProviderApi) {
        response.modelProviderApi = turn.modelProviderApi;
      }
      if (turn.model) {
        response.model = turn.model;
      }

      reply.code(200).send(response);
    },

    async streamEvents(
      req: FastifyRequest<{
        Params: { id: string };
        Querystring: TurnQueryParams;
      }>,
      reply: FastifyReply,
    ): Promise<void> {
      const turnId = req.params.id;
      const turn = await clientStreamManager.getTurn(turnId);

      if (!turn) {
        throw new NotFoundError(`Turn ${turnId} not found`);
      }

      // Parse Last-Event-ID header if present
      const lastEventIdHeader = req.headers["last-event-id"];
      const fromEventId = parseLastEventId(lastEventIdHeader);

      // Get query params
      const thinkingLevel = req.query.thinkingLevel;
      const toolLevel = req.query.toolLevel;
      const thinkingFormat =
        req.query.thinkingFormat ??
        (thinkingLevel === "none" ? "none" : "full");
      const toolFormat =
        req.query.toolFormat ?? (toolLevel === "full" ? "full" : "none");

      // Set SSE headers
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.write(`:keepalive\n\n`);

      // Helper to send events with filtering
      const sendEvents = (events: StoredEvent[]): boolean => {
        for (const storedEvent of events) {
          if (
            !shouldIncludeEvent(storedEvent.msg, thinkingFormat, toolFormat)
          ) {
            continue;
          }

          const eventType = mapEventMsgToSSEEventType(storedEvent.msg);
          const eventData = mapEventMsgToSSEData(
            storedEvent.msg,
            turn,
            toolFormat,
            thinkingFormat,
          );

          try {
            reply.raw.write(`id: ${turnId}:${storedEvent.id}\n`);
            reply.raw.write(`event: ${eventType}\n`);
            reply.raw.write(`data: ${JSON.stringify(eventData)}\n\n`);
          } catch {
            return false;
          }
        }

        return true;
      };

      // Send stored events first
      const initialEvents = await clientStreamManager.getEvents(
        turnId,
        fromEventId,
      );
      if (!sendEvents(initialEvents)) {
        return;
      }

      let lastEventId =
        initialEvents.length > 0
          ? initialEvents[initialEvents.length - 1].id
          : (fromEventId ?? 0);

      const finish = () => {
        try {
          reply.raw.end();
        } catch {
          // ignore
        }
      };

      // Set up keepalive timer
      const keepaliveInterval = setInterval(() => {
        try {
          reply.raw.write(`:keepalive\n\n`);
        } catch {
          clearInterval(keepaliveInterval);
        }
      }, 15000);

      // Poll for new events - continue polling even if turn appears completed
      // to catch any late-arriving events from async message processor
      let completedPollCount = 0;
      const maxCompletedPolls = 50; // Poll for up to 5 seconds after completion

      const pollInterval = setInterval(async () => {
        const newEvents = await clientStreamManager.getEvents(
          turnId,
          lastEventId,
        );
        if (newEvents.length > 0) {
          if (!sendEvents(newEvents)) {
            clearInterval(pollInterval);
            clearInterval(keepaliveInterval);
            return;
          }
          lastEventId = newEvents[newEvents.length - 1].id;
          completedPollCount = 0; // Reset counter if we got new events
        }

        const updatedTurn = await clientStreamManager.getTurn(turnId);
        if (updatedTurn && updatedTurn.status !== "running") {
          // Turn is completed, but continue polling for a short time
          // to catch any late-arriving events
          completedPollCount++;
          if (completedPollCount >= maxCompletedPolls) {
            // No new events for a while, safe to close
            clearInterval(pollInterval);
            clearInterval(keepaliveInterval);
            finish();
          }
        } else if (updatedTurn && updatedTurn.status === "running") {
          // Turn is still running, reset completed counter
          completedPollCount = 0;
        }
      }, 100);

      // Clean up on client disconnect
      req.raw.on("close", () => {
        clearInterval(pollInterval);
        clearInterval(keepaliveInterval);
      });
    },
  };
}

function shouldIncludeEvent(
  msg: StreamMessage,
  thinkingFormat: "none" | "summary" | "full",
  toolFormat: "none" | "summary" | "full",
): boolean {
  if (isClientEvent(msg)) {
    if (isThinkingClientEvent(msg)) {
      if (thinkingFormat === "none") {
        return false;
      }
      if (thinkingFormat === "summary" && msg.type === "thinking_delta") {
        return false;
      }
      return true;
    }

    if (isToolClientEvent(msg)) {
      if (toolFormat === "none") {
        return false;
      }
      return true;
    }

    return true;
  }

  if (
    thinkingFormat === "none" &&
    (msg.type === "agent_reasoning" ||
      msg.type === "agent_reasoning_delta" ||
      msg.type === "agent_reasoning_raw_content" ||
      msg.type === "agent_reasoning_raw_content_delta" ||
      msg.type === "reasoning_content_delta" ||
      msg.type === "reasoning_raw_content_delta")
  ) {
    return false;
  }

  if (
    toolFormat === "none" &&
    (msg.type === "exec_command_begin" ||
      msg.type === "exec_command_end" ||
      msg.type === "exec_command_output_delta" ||
      msg.type === "mcp_tool_call_begin" ||
      msg.type === "mcp_tool_call_end" ||
      (msg.type === "raw_response_item" &&
        msg.item &&
        isToolRawResponseItem(msg.item)))
  ) {
    return false;
  }

  return true;
}

/**
 * Map EventMsg type to SSE event type string
 */
function mapEventMsgToSSEEventType(msg: StreamMessage): string {
  if (isClientEvent(msg)) {
    return msg.type;
  }
  if (msg.type === "raw_response_item") {
    if (msg.item.type === "function_call") {
      return "exec_command_begin";
    }
    if (msg.item.type === "function_call_output") {
      return "exec_command_end";
    }
  }

  const typeMap: Record<string, string> = {
    task_started: "task_started",
    task_complete: "task_complete",
    agent_message: "agent_message",
    agent_message_delta: "agent_message",
    agent_message_content_delta: "agent_message",
    agent_reasoning: "agent_reasoning",
    agent_reasoning_delta: "agent_reasoning",
    agent_reasoning_raw_content: "agent_reasoning",
    agent_reasoning_raw_content_delta: "agent_reasoning",
    reasoning_content_delta: "agent_reasoning",
    reasoning_raw_content_delta: "agent_reasoning",
    exec_command_begin: "exec_command_begin",
    exec_command_end: "exec_command_end",
    exec_command_output_delta: "exec_command_output_delta",
    mcp_tool_call_begin: "mcp_tool_call_begin",
    mcp_tool_call_end: "mcp_tool_call_end",
    error: "error",
    stream_error: "error",
    turn_aborted: "turn_aborted",
  };

  return typeMap[msg.type] || "cody-event";
}

/**
 * Map EventMsg to SSE data payload
 */
function mapEventMsgToSSEData(
  msg: StreamMessage,
  turn: TurnRecord,
  toolFormat: "none" | "summary" | "full",
  thinkingFormat: "none" | "summary" | "full",
): Record<string, unknown> {
  const eventType = mapEventMsgToSSEEventType(msg);

  if (isClientEvent(msg)) {
    return {
      event: eventType,
      modelProviderId: turn.modelProviderId,
      modelProviderApi: turn.modelProviderApi,
      model: turn.model,
      ...formatClientEventPayload(msg, toolFormat, thinkingFormat),
    };
  }

  if (msg.type === "raw_response_item" && msg.item) {
    const base = {
      event: eventType,
      modelProviderId: turn.modelProviderId,
      modelProviderApi: turn.modelProviderApi,
      model: turn.model,
      rawResponseItemType: msg.item.type,
    };

    if (isFunctionCallItem(msg.item)) {
      const item = msg.item;
      return {
        ...base,
        callId: item.call_id ?? item.id,
        toolName: item.name,
        arguments: safeParseJson(item.arguments),
      };
    }

    if (isFunctionCallOutputItem(msg.item)) {
      const item = msg.item;
      const toolName =
        turn.toolCalls.find((tc) => tc.callId === item.call_id)?.name ??
        item.call_id;

      return {
        ...base,
        callId: item.call_id,
        toolName,
        output: item.output,
      };
    }

    return {
      ...base,
      raw: msg.item,
    };
  }

  return {
    event: eventType,
    ...msg,
    modelProviderId: turn.modelProviderId,
    modelProviderApi: turn.modelProviderApi,
    model: turn.model,
  };
}

function isToolRawResponseItem(
  item: ResponseItem,
): item is Extract<
  ResponseItem,
  { type: "function_call" | "function_call_output" }
> {
  return item.type === "function_call" || item.type === "function_call_output";
}

function safeParseJson(value: string | undefined): unknown {
  if (!value) {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isFunctionCallItem(
  item: ResponseItem | undefined,
): item is Extract<ResponseItem, { type: "function_call" }> {
  return item?.type === "function_call";
}

function isFunctionCallOutputItem(
  item: ResponseItem | undefined,
): item is Extract<ResponseItem, { type: "function_call_output" }> {
  return item?.type === "function_call_output";
}

function isClientEvent(msg: StreamMessage): msg is ClientEvent {
  return (
    msg.type === "tool_call_begin" ||
    msg.type === "tool_call_end" ||
    msg.type === "ts_exec_begin" ||
    msg.type === "ts_exec_end" ||
    msg.type === "thinking_started" ||
    msg.type === "thinking_delta" ||
    msg.type === "thinking_completed"
  );
}

function isThinkingClientEvent(
  event: ClientEvent,
): event is Extract<
  ClientEvent,
  { type: "thinking_started" | "thinking_delta" | "thinking_completed" }
> {
  return (
    event.type === "thinking_started" ||
    event.type === "thinking_delta" ||
    event.type === "thinking_completed"
  );
}

function isToolClientEvent(event: ClientEvent): event is Extract<
  ClientEvent,
  {
    type: "tool_call_begin" | "tool_call_end" | "ts_exec_begin" | "ts_exec_end";
  }
> {
  return (
    event.type === "tool_call_begin" ||
    event.type === "tool_call_end" ||
    event.type === "ts_exec_begin" ||
    event.type === "ts_exec_end"
  );
}

function formatClientEventPayload(
  event: ClientEvent,
  toolFormat: "none" | "summary" | "full",
  thinkingFormat: "none" | "summary" | "full",
): Record<string, unknown> {
  switch (event.type) {
    case "tool_call_begin":
      return {
        callId: event.callId,
        toolName: event.toolName,
        ...(toolFormat === "full" ? { arguments: event.arguments } : {}),
      };
    case "tool_call_end":
      return {
        callId: event.callId,
        status: event.status,
        ...(toolFormat === "full" ? { output: event.output } : {}),
      };
    case "ts_exec_begin":
      return {
        execId: event.execId,
        label: event.label,
        ...(toolFormat === "full" ? { source: event.source } : {}),
      };
    case "ts_exec_end":
      return {
        execId: event.execId,
        status: event.status,
        ...(toolFormat === "full" ? { output: event.output } : {}),
      };
    case "thinking_started":
      return {
        thinkingId: event.thinkingId,
      };
    case "thinking_delta":
      if (thinkingFormat !== "full") {
        return { thinkingId: event.thinkingId };
      }
      return {
        thinkingId: event.thinkingId,
        delta: event.delta,
      };
    case "thinking_completed":
      return {
        thinkingId: event.thinkingId,
        ...(thinkingFormat !== "none" ? { text: event.text } : {}),
      };
  }
}

function parseLastEventId(
  header: string | string[] | undefined,
): number | undefined {
  if (!header) {
    return undefined;
  }
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) {
    return undefined;
  }
  const parts = value.split(":");
  const numericPart = parts[parts.length - 1];
  const parsed = Number.parseInt(numericPart, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
