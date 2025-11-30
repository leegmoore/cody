/**
 * Type definitions for UpsertStreamProcessor module.
 *
 * These types define the UI-focused event shapes that are emitted
 * to Stream B (Redis) for consumption by the UI layer.
 */

// ---------------------------------------------------------------------------
// UIUpsert - Item-level updates for UI
// ---------------------------------------------------------------------------

export type UIUpsertItemType =
  | "message"
  | "reasoning"
  | "tool_call"
  | "tool_output"
  | "error";

export type UIUpsertChangeType = "created" | "updated" | "completed";

export type MessageOrigin = "user" | "agent" | "system";

export interface UIUpsert {
  type: "item_upsert";
  turnId: string;
  threadId: string;
  itemId: string;
  itemType: UIUpsertItemType;
  changeType: UIUpsertChangeType;
  content: string;

  // Message-specific
  origin?: MessageOrigin;

  // Reasoning-specific
  providerId?: string;

  // Tool call-specific
  toolName?: string;
  toolArguments?: Record<string, unknown>;
  callId?: string;

  // Tool output-specific
  toolOutput?: Record<string, unknown> | string;
  success?: boolean;

  // Error-specific
  errorCode?: string;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// UITurnEvent - Turn lifecycle events for UI
// ---------------------------------------------------------------------------

export type UITurnEventType = "turn_started" | "turn_completed" | "turn_error";

export type TurnStatus = "complete" | "error" | "aborted";

export interface UITurnEventUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface UITurnEventError {
  code: string;
  message: string;
}

export interface UITurnEvent {
  type: UITurnEventType;
  turnId: string;
  threadId: string;

  // turn_started
  modelId?: string;
  providerId?: string;

  // turn_completed
  status?: TurnStatus;
  usage?: UITurnEventUsage;

  // turn_error
  error?: UITurnEventError;
}

// ---------------------------------------------------------------------------
// StreamBMessage - Redis envelope for UI events
// ---------------------------------------------------------------------------

export type StreamBPayloadType = "item_upsert" | "turn_event";

export interface StreamBMessage {
  eventId: string;
  timestamp: number;
  turnId: string;
  payloadType: StreamBPayloadType;
  payload: string; // JSON serialized UIUpsert | UITurnEvent
}

// ---------------------------------------------------------------------------
// Processor configuration
// ---------------------------------------------------------------------------

export interface UpsertStreamProcessorOptions {
  turnId: string;
  threadId: string;
  batchGradient?: number[]; // Default: [10, 10, 20, 20, 50, 50, 50, 50, 100, 100, 200, 200, 500, 500, 1000, 1000, 2000]
  batchTimeoutMs?: number; // Default: 1000
  onEmit: (message: StreamBMessage) => Promise<void>;
  retryAttempts?: number; // Default: 3
  retryBaseMs?: number; // Default: 1000
  retryMaxMs?: number; // Default: 10000
}

// ---------------------------------------------------------------------------
// Buffer state types (for testing/debugging)
// ---------------------------------------------------------------------------

export interface BufferInfo {
  itemId: string;
  itemType: UIUpsertItemType;
  tokenCount: number;
  contentLength: number;
  batchIndex: number;
  isHeld: boolean;
  isComplete: boolean;
}

export interface ItemBufferState {
  itemId: string;
  itemType: UIUpsertItemType;
  content: string;
  tokenCount: number;
  batchIndex: number;
  emittedTokenCount: number;
  isComplete: boolean;
  isHeld: boolean;
  hasEmittedCreated: boolean;

  // Type-specific metadata
  origin?: MessageOrigin;
  providerId?: string;
  toolName?: string;
  callId?: string;
}
