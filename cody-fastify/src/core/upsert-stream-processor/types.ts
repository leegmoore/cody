/**
 * Stream processor output types.
 * These shapes are emitted to Stream B for xapi/UI consumption.
 */

// ---------------------------------------------------------------------------
// Common Types
// ---------------------------------------------------------------------------

export type Status = "create" | "update" | "complete" | "error";

export type MessageOrigin = "user" | "agent" | "system";

export type TurnStatus = "complete" | "error" | "aborted";

// ---------------------------------------------------------------------------
// Content Types
// ---------------------------------------------------------------------------

interface ContentBase {
  turnId: string;
  threadId: string;
  itemId: string;
  status: Status;
  errorCode?: string;
  errorMessage?: string;
}

export interface Message extends ContentBase {
  type: "message";
  content: string;
  origin: MessageOrigin;
}

export interface Thinking extends ContentBase {
  type: "thinking";
  content: string;
  providerId: string;
}

export interface ToolCall extends ContentBase {
  type: "tool_call";
  content: string;
  toolName: string;
  toolArguments: Record<string, unknown>;
  callId: string;
  toolOutput?: Record<string, unknown> | string;
  success?: boolean;
}

export type Content = Message | Thinking | ToolCall;

export type ContentType = Content["type"];

// ---------------------------------------------------------------------------
// Turn Events
// ---------------------------------------------------------------------------

export interface TurnStarted {
  type: "turn_started";
  turnId: string;
  threadId: string;
  modelId?: string;
  providerId?: string;
}

export interface TurnComplete {
  type: "turn_complete";
  turnId: string;
  threadId: string;
  status: TurnStatus;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface TurnError {
  type: "turn_error";
  turnId: string;
  threadId: string;
  error: {
    code: string;
    message: string;
  };
}

export type TurnEvent = TurnStarted | TurnComplete | TurnError;

// ---------------------------------------------------------------------------
// Stream Output
// ---------------------------------------------------------------------------

export type StreamOutput = Content | TurnEvent;

export interface StreamMessage {
  eventId: string;
  timestamp: number;
  turnId: string;
  payload: string; // JSON serialized StreamOutput
}

// ---------------------------------------------------------------------------
// Processor Configuration
// ---------------------------------------------------------------------------

export interface ProcessorOptions {
  turnId: string;
  threadId: string;
  batchGradient?: number[];
  batchTimeoutMs?: number;
  onEmit: (message: StreamMessage) => Promise<void>;
  retryAttempts?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
}
