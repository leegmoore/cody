import { randomUUID } from "node:crypto";
import type { EventMsg } from "codex-ts/src/protocol/protocol.ts";
import type { ResponseItem } from "codex-ts/src/protocol/models.ts";
import { redisClient } from "./redis-client.js";
import type {
  ClientEvent,
  StoredEvent,
  TurnRecord,
} from "../types/turns.js";

const TURN_META_PREFIX = "cs:turn";
const CONV_TURNS_KEY = "cs:conv";
const DEFAULT_TTL_SECONDS = Number.parseInt(
  process.env.CLIENT_STREAM_TTL_SECONDS || "",
  10,
) || 60 * 60 * 24;

function metaKey(turnId: string) {
  return `${TURN_META_PREFIX}:${turnId}:meta`;
}

function eventsKey(turnId: string) {
  return `${TURN_META_PREFIX}:${turnId}:events`;
}

function seqKey(turnId: string) {
  return `${TURN_META_PREFIX}:${turnId}:seq`;
}

function conversationListKey(conversationId: string) {
  return `${CONV_TURNS_KEY}:${conversationId}:turns`;
}

class RedisClientStreamManager {
  async createTurn(
    turnId: string,
    conversationId: string,
    submissionId: string,
    modelProviderId?: string,
    modelProviderApi?: string,
    model?: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const turn: TurnRecord = {
      turnId,
      conversationId,
      submissionId,
      status: "running",
      startedAt: now,
      completedAt: null,
      result: null,
      thinking: [],
      toolCalls: [],
      modelProviderId,
      modelProviderApi,
      model,
    };

    await redisClient
      .multi()
      .set(metaKey(turnId), JSON.stringify(turn))
      .del(eventsKey(turnId))
      .set(seqKey(turnId), "0")
      .rpush(conversationListKey(conversationId), turnId)
      .exec();

    await this.addEvent(turnId, { type: "task_started" });
  }

  async getTurn(turnId: string): Promise<TurnRecord | undefined> {
    const data = await redisClient.get(metaKey(turnId));
    if (!data) {
      return undefined;
    }
    return JSON.parse(data) as TurnRecord;
  }

  async updateTurnStatus(
    turnId: string,
    status: TurnRecord["status"],
    completedAt?: string,
  ): Promise<void> {
    const turn = await this.getTurn(turnId);
    if (!turn) {
      return;
    }
    turn.status = status;
    if (completedAt) {
      turn.completedAt = completedAt;
    } else if (status === "completed" || status === "error") {
      turn.completedAt = new Date().toISOString();
    }
    await redisClient.set(metaKey(turnId), JSON.stringify(turn));
    if (status !== "running") {
      await Promise.all([
        redisClient.expire(metaKey(turnId), DEFAULT_TTL_SECONDS),
        redisClient.expire(eventsKey(turnId), DEFAULT_TTL_SECONDS),
        redisClient.expire(seqKey(turnId), DEFAULT_TTL_SECONDS),
      ]);
    }
  }

  async addEvent(turnId: string, msg: EventMsg): Promise<number> {
    const turn = await this.getTurn(turnId);
    if (!turn) {
      throw new Error(`Turn ${turnId} not found`);
    }

    const syntheticEvents = this.applyEventToTurn(turn, msg);

    const seq = await redisClient.incr(seqKey(turnId));
    const stored: StoredEvent = {
      id: seq,
      msg,
      timestamp: new Date().toISOString(),
    };

    await redisClient
      .multi()
      .set(metaKey(turnId), JSON.stringify(turn))
      .zadd(eventsKey(turnId), seq, JSON.stringify(stored))
      .exec();

    for (const synthetic of syntheticEvents) {
      await this.appendSyntheticEvent(turnId, synthetic);
    }

    return seq;
  }

  async getEvents(
    turnId: string,
    fromEventId?: number,
  ): Promise<StoredEvent[]> {
    const min = fromEventId !== undefined ? `(${fromEventId}` : "-inf";
    const entries: string[] = await redisClient.zrangebyscore(
      eventsKey(turnId),
      min,
      "+inf",
    );
    return entries.map((entry) => JSON.parse(entry) as StoredEvent);
  }

  async removeTurn(turnId: string): Promise<void> {
    const turn = await this.getTurn(turnId);
    await redisClient.del(metaKey(turnId), eventsKey(turnId), seqKey(turnId));
    if (turn) {
      await redisClient.lrem(conversationListKey(turn.conversationId), 0, turnId);
    }
  }

  private applyEventToTurn(turn: TurnRecord, msg: EventMsg): ClientEvent[] {
    const synthetic: ClientEvent[] = [];
    switch (msg.type) {
      case "task_started":
        break;
      case "agent_message":
        this.completeActiveThinkingBlock(turn, synthetic);
        turn.result = { type: "message", content: msg.message };
        break;
      case "agent_message_delta":
      case "agent_message_content_delta": {
        if (!turn.result || typeof turn.result !== "object") {
          turn.result = { type: "message", content: msg.delta };
        } else {
          const current =
            (turn.result as { content?: string }).content ?? "";
          (turn.result as { content?: string }).content = current + msg.delta;
        }
        break;
      }
      case "agent_reasoning":
      case "agent_reasoning_raw_content": {
        const text = msg.text;
        turn.thinking.push({ text });
        const thinkingId = randomUUID();
        synthetic.push(
          { type: "thinking_started", thinkingId },
          { type: "thinking_delta", thinkingId, delta: text },
          { type: "thinking_completed", thinkingId, text },
        );
        break;
      }
      case "agent_reasoning_delta":
      case "agent_reasoning_raw_content_delta":
      case "reasoning_content_delta":
      case "reasoning_raw_content_delta": {
        const delta = "delta" in msg ? msg.delta : "";
        this.appendThinkingDelta(turn, delta);
        if (!turn.activeThinkingId) {
          turn.activeThinkingId = randomUUID();
          turn.pendingThinkingText = "";
          synthetic.push({
            type: "thinking_started",
            thinkingId: turn.activeThinkingId,
          });
        }
        turn.pendingThinkingText =
          (turn.pendingThinkingText ?? "") + delta;
        synthetic.push({
          type: "thinking_delta",
          thinkingId: turn.activeThinkingId!,
          delta,
        });
        break;
      }
      case "exec_command_begin":
        turn.toolCalls.push({
          name: "exec_command",
          callId: msg.call_id,
          input: {
            command: msg.command,
            cwd: msg.cwd,
            stdin: msg.stdin,
            env: msg.env,
          },
          output: null,
        });
        break;
      case "exec_command_end": {
        const execCall = turn.toolCalls.find(
          (tc) => tc.callId === msg.call_id,
        );
        if (execCall) {
          execCall.output = {
            stdout: msg.stdout,
            stderr: msg.stderr,
            exit_code: msg.exit_code,
            signal: msg.signal,
            timed_out: msg.timed_out,
          };
        }
        break;
      }
      case "mcp_tool_call_begin":
        turn.toolCalls.push({
          name: msg.invocation.tool_name,
          callId: msg.invocation.call_id,
          input: JSON.parse(msg.invocation.arguments),
          output: null,
        });
        break;
      case "mcp_tool_call_end": {
        const mcpCall = turn.toolCalls.find(
          (tc) => tc.callId === msg.invocation.call_id,
        );
        if (mcpCall) {
          mcpCall.output = msg.result ?? msg.error;
        }
        break;
      }
      case "task_complete":
        this.completeActiveThinkingBlock(turn, synthetic);
        turn.status = "completed";
        turn.completedAt = new Date().toISOString();
        if (msg.last_agent_message) {
          turn.result = { type: "message", content: msg.last_agent_message };
        }
        break;
      case "turn_aborted":
      case "error":
        this.completeActiveThinkingBlock(turn, synthetic);
        turn.status = "error";
        turn.completedAt = new Date().toISOString();
        break;
      case "raw_response_item": {
        const additional = this.handleRawResponseItem(turn, msg.item);
        synthetic.push(...additional);
        break;
      }
    }

    return synthetic;
  }

  private handleRawResponseItem(
    turn: TurnRecord,
    item: ResponseItem | undefined,
  ): ClientEvent[] {
    const synthetic: ClientEvent[] = [];
    if (!item) {
      return synthetic;
    }
    if (item.type === "function_call") {
      const callId = item.call_id ?? item.id ?? randomUUID();
      let parsedArgs: unknown = item.arguments;
      try {
        parsedArgs = item.arguments ? JSON.parse(item.arguments) : item.arguments;
      } catch {
        parsedArgs = item.arguments;
      }

      const existing = turn.toolCalls.find((tc) => tc.callId === callId);
      if (existing) {
        existing.input = parsedArgs;
        return synthetic;
      }

      turn.toolCalls.push({
        name: item.name,
        callId,
        input: parsedArgs ?? null,
        output: null,
      });

      synthetic.push({
        type: "tool_call_begin",
        callId,
        toolName: item.name,
        arguments: parsedArgs,
      });
      return synthetic;
    }

    if (item.type === "function_call_output") {
      const callId = item.call_id;
      const toolCall =
        turn.toolCalls.find((tc) => tc.callId === callId) ??
        (() => {
          const fallback = {
            name: "function_call",
            callId,
            input: null,
            output: null,
          };
          turn.toolCalls.push(fallback);
          return fallback;
        })();

      toolCall.output = item.output ?? null;

      const status = item.output?.success === false ? "failed" : "succeeded";

      synthetic.push({
        type: "tool_call_end",
        callId,
        status,
        output: item.output,
      });
    }

    return synthetic;
  }

  private async appendSyntheticEvent(
    turnId: string,
    msg: ClientEvent,
  ): Promise<void> {
    const seq = await redisClient.incr(seqKey(turnId));
    const stored: StoredEvent = {
      id: seq,
      msg,
      timestamp: new Date().toISOString(),
    };
    await redisClient.zadd(eventsKey(turnId), seq, JSON.stringify(stored));
  }

  private appendThinkingDelta(turn: TurnRecord, delta: string): void {
    if (!delta) {
      return;
    }
    if (turn.thinking.length > 0) {
      const last = turn.thinking[turn.thinking.length - 1];
      last.text += delta;
    } else {
      turn.thinking.push({ text: delta });
    }
  }

  private completeActiveThinkingBlock(
    turn: TurnRecord,
    synthetic: ClientEvent[],
  ): void {
    if (!turn.activeThinkingId) {
      return;
    }
    synthetic.push({
      type: "thinking_completed",
      thinkingId: turn.activeThinkingId,
      text: turn.pendingThinkingText ?? "",
    });
    delete turn.activeThinkingId;
    delete turn.pendingThinkingText;
  }
}

export const clientStreamManager = new RedisClientStreamManager();

