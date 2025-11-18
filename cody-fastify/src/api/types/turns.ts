/**
 * Turn types for the API
 */

import type { EventMsg } from "codex-ts/src/protocol/protocol.ts";

/**
 * Status of a turn
 */
export type TurnStatus = "running" | "completed" | "error";

/**
 * Tool call information
 */
export interface ToolCall {
  name: string;
  callId: string;
  input: unknown;
  output: unknown;
}

/**
 * Turn record stored in memory
 */
export interface TurnRecord {
  turnId: string;
  conversationId: string;
  submissionId: string; // Codex submission ID
  status: TurnStatus;
  startedAt: string;
  completedAt: string | null;
  result: unknown | null; // Final assistant message/response
  thinking: Array<{ text: string }>; // Reasoning events
  toolCalls: ToolCall[]; // Tool execution events
  modelProviderId?: string;
  modelProviderApi?: string;
  model?: string;
  activeThinkingId?: string;
  pendingThinkingText?: string;
}

export type ClientEvent =
  | {
      type: "tool_call_begin";
      callId: string;
      toolName: string;
      arguments?: unknown;
    }
  | {
      type: "tool_call_end";
      callId: string;
      status: "succeeded" | "failed";
      output?: unknown;
    }
  | {
      type: "ts_exec_begin";
      execId: string;
      label?: string;
      source?: string;
    }
  | {
      type: "ts_exec_end";
      execId: string;
      status: "succeeded" | "failed";
      output?: unknown;
    }
  | {
      type: "thinking_started";
      thinkingId: string;
    }
  | {
      type: "thinking_delta";
      thinkingId: string;
      delta: string;
    }
  | {
      type: "thinking_completed";
      thinkingId: string;
      text: string;
    };

export type StreamMessage = EventMsg | ClientEvent;

/**
 * Stored event in the client stream
 */
export interface StoredEvent {
  id: number;
  msg: StreamMessage;
  timestamp: string;
}

