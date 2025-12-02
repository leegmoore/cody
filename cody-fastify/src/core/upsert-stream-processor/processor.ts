/**
 * StreamProcessor - Main processor class for transforming StreamEvents to Content/TurnEvents.
 *
 * Receives StreamEvents from adapters (Stream A) and emits Content/TurnEvents
 * to the UI layer (Stream B) with batching and backpressure handling.
 */

import type { StreamEvent, StreamEventPayload } from "../schema.js";
import type { BufferInfo } from "./content-buffer.js";
import { ContentBuffer } from "./content-buffer.js";
import type {
  Content,
  ContentType,
  Message,
  MessageOrigin,
  ProcessorOptions,
  Status,
  StreamMessage,
  Thinking,
  ToolCall,
  TurnComplete,
  TurnError,
  TurnEvent,
  TurnStarted,
  TurnStatus,
} from "./types.js";
import {
  calculateRetryDelay,
  generateEventId,
  parseJsonSafe,
  RetryExhaustedError,
  sleep,
} from "./utils.js";

// ---------------------------------------------------------------------------
// Payload type extraction helpers
// ---------------------------------------------------------------------------

type ExtractPayload<T extends StreamEventPayload["type"]> = Extract<
  StreamEventPayload,
  { type: T }
>;

type ResponseStartPayload = ExtractPayload<"response_start">;
type ItemStartPayload = ExtractPayload<"item_start">;
type ItemDeltaPayload = ExtractPayload<"item_delta">;
type ItemDonePayload = ExtractPayload<"item_done">;
type ItemErrorPayload = ExtractPayload<"item_error">;
type ItemCancelledPayload = ExtractPayload<"item_cancelled">;
type ResponseDonePayload = ExtractPayload<"response_done">;
type ResponseErrorPayload = ExtractPayload<"response_error">;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface TurnMetadata {
  turnId: string;
  threadId: string;
  modelId?: string;
  providerId?: string;
}

interface RequiredOptions {
  turnId: string;
  threadId: string;
  batchGradient: number[];
  batchTimeoutMs: number;
  onEmit: (message: StreamMessage) => Promise<void>;
  retryAttempts: number;
  retryBaseMs: number;
  retryMaxMs: number;
}

interface ToolCallMetadata {
  itemId: string;
  toolName: string;
  toolArguments: Record<string, unknown>;
  callId: string;
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_BATCH_TIMEOUT_MS = 1000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 1000;
const DEFAULT_RETRY_MAX_MS = 10000;
const DEFAULT_BATCH_GRADIENT = [
  10, 10, 10, 10, 20, 20, 20, 20, 50, 50, 50, 50, 100, 100, 200, 200, 500, 500,
  500, 500, 1000, 1000, 2000,
];

// ---------------------------------------------------------------------------
// StreamProcessor
// ---------------------------------------------------------------------------

export class StreamProcessor {
  private contentBuffers: Map<string, ContentBuffer> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private turnMetadata: TurnMetadata | null = null;
  private toolCallRegistry: Map<string, ToolCallMetadata> = new Map();
  private options: RequiredOptions;

  /**
   * Creates a new StreamProcessor.
   *
   * @param options - Configuration options for the processor
   */
  constructor(options: ProcessorOptions) {
    this.options = {
      turnId: options.turnId,
      threadId: options.threadId,
      batchGradient: options.batchGradient ?? DEFAULT_BATCH_GRADIENT,
      batchTimeoutMs: options.batchTimeoutMs ?? DEFAULT_BATCH_TIMEOUT_MS,
      onEmit: options.onEmit,
      retryAttempts: options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS,
      retryBaseMs: options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS,
      retryMaxMs: options.retryMaxMs ?? DEFAULT_RETRY_MAX_MS,
    };
  }

  // -------------------------------------------------------------------------
  // Public Methods
  // -------------------------------------------------------------------------

  /**
   * Process a single incoming StreamEvent.
   * Routes to appropriate handler based on event type.
   *
   * @param event - The incoming event from adapter
   * @throws Error if all retry attempts exhausted on emit
   */
  async processEvent(event: StreamEvent): Promise<void> {
    const payload = event.payload;

    switch (payload.type) {
      case "response_start":
        await this.handleResponseStart(payload);
        break;
      case "item_start":
        await this.handleItemStart(payload);
        break;
      case "item_delta":
        await this.handleItemDelta(payload);
        break;
      case "item_done":
        await this.handleItemDone(payload);
        break;
      case "item_error":
        await this.handleItemError(payload);
        break;
      case "item_cancelled":
        await this.handleItemCancelled(payload);
        break;
      case "response_done":
        await this.handleResponseDone(payload);
        break;
      case "response_error":
        await this.handleResponseError(payload);
        break;
      // Ignore other event types (heartbeat, usage_update, etc.)
    }
  }

  /**
   * Force emit all pending buffered content.
   * Called on turn completion or when processor is being shut down.
   */
  async flush(): Promise<void> {
    for (const [itemId, buffer] of this.contentBuffers) {
      // Only emit if there's unemitted content
      if (
        buffer.getUnemittedTokenCount() > 0 ||
        !buffer.getHasEmittedCreate()
      ) {
        const status: Status = buffer.getHasEmittedCreate()
          ? "update"
          : "create";
        const content = this.buildContentFromBuffer(buffer, status);
        await this.emitContent(content);
        buffer.markEmitted();
        if (!buffer.getHasEmittedCreate()) {
          buffer.markCreateEmitted();
        }
      }
      this.clearBatchTimer(itemId);
    }
  }

  /**
   * Cleanup all resources.
   * Clears all timers, releases all buffers.
   * Must be called when processor is no longer needed.
   */
  destroy(): void {
    this.clearAllTimers();
    this.contentBuffers.clear();
    this.toolCallRegistry.clear();
  }

  /**
   * Returns current buffer state for all items.
   * Used for testing and debugging.
   *
   * @returns Map of item IDs to their buffer info
   */
  getBufferState(): Map<string, BufferInfo> {
    const result = new Map<string, BufferInfo>();
    for (const [itemId, buffer] of this.contentBuffers) {
      result.set(itemId, buffer.toBufferInfo());
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Event Handlers (Private)
  // -------------------------------------------------------------------------

  /**
   * Handles response_start event.
   * Stores turn metadata, emits turn_started event.
   */
  private async handleResponseStart(
    payload: ResponseStartPayload,
  ): Promise<void> {
    this.turnMetadata = {
      turnId: payload.turn_id,
      threadId: payload.thread_id,
      modelId: payload.model_id,
      providerId: payload.provider_id,
    };

    const turnStarted: TurnStarted = {
      type: "turn_started",
      turnId: this.options.turnId,
      threadId: this.options.threadId,
      modelId: payload.model_id,
      providerId: payload.provider_id,
    };

    await this.emitTurnEvent(turnStarted);
  }

  /**
   * Handles item_start event.
   * Creates new ContentBuffer, determines if item should be held.
   */
  private async handleItemStart(payload: ItemStartPayload): Promise<void> {
    const itemId = payload.item_id;
    const itemType = payload.item_type;

    // Skip function_call_output items - they don't create buffers
    if (itemType === "function_call_output") {
      return;
    }

    // Map input item_type to output content type
    const contentType = this.mapItemTypeToContentType(itemType);

    // Determine if this item should be held
    const isHeld =
      this.isUserMessage(itemId, payload) || itemType === "function_call";

    // Create the buffer
    const buffer = new ContentBuffer(itemId, contentType, {
      initialContent: payload.initial_content ?? "",
      isHeld,
      toolName: itemType === "function_call" ? payload.name : undefined,
      providerId: this.turnMetadata?.providerId,
    });

    this.contentBuffers.set(itemId, buffer);

    // Start batch timer if not held
    if (!isHeld) {
      this.startBatchTimer(itemId);
    }
  }

  /**
   * Handles item_delta event.
   * Appends content to buffer, checks batch threshold, may emit.
   */
  private async handleItemDelta(payload: ItemDeltaPayload): Promise<void> {
    const itemId = payload.item_id;
    const buffer = this.contentBuffers.get(itemId);

    if (!buffer) {
      // No buffer for this item - might be function_call_output
      return;
    }

    // Append content
    buffer.appendContent(payload.delta_content);

    // Don't emit if held
    if (buffer.getIsHeld()) {
      return;
    }

    // Check if we should emit
    if (this.shouldEmitBatch(buffer)) {
      const status: Status = buffer.getHasEmittedCreate() ? "update" : "create";
      const content = this.buildContentFromBuffer(buffer, status);
      await this.emitContent(content);

      if (!buffer.getHasEmittedCreate()) {
        buffer.markCreateEmitted();
      }
      buffer.markEmitted();

      // Advance batch index past all thresholds we've crossed
      this.advanceBatchIndexToMatch(buffer);
    }

    // Reset batch timer
    this.startBatchTimer(itemId);
  }

  /**
   * Handles item_done event.
   * Finalizes item, emits complete content, cleans up buffer.
   */
  private async handleItemDone(payload: ItemDonePayload): Promise<void> {
    const itemId = payload.item_id;
    const finalItem = payload.final_item;

    // Handle function_call_output specially
    if (finalItem.type === "function_call_output") {
      await this.handleFunctionCallOutput(payload);
      return;
    }

    // Handle function_call - emit create status
    if (finalItem.type === "function_call") {
      await this.handleFunctionCallDone(payload);
      return;
    }

    const buffer = this.contentBuffers.get(itemId);

    if (!buffer) {
      return;
    }

    // Get origin from final_item for messages
    let origin: MessageOrigin = "agent";
    if (finalItem.type === "message") {
      origin = finalItem.origin ?? "agent";
    }

    // Get content from final_item
    const finalContent =
      finalItem.type === "message"
        ? finalItem.content
        : finalItem.type === "reasoning"
          ? finalItem.content
          : buffer.getContent();

    // Build and emit complete content
    const state = buffer.getState();
    let content: Content;
    const baseContent = {
      turnId: this.options.turnId,
      threadId: this.options.threadId,
      itemId: itemId,
      status: "complete" as Status,
    };

    if (state.contentType === "message") {
      content = {
        ...baseContent,
        type: "message",
        content: finalContent,
        origin,
      } as Message;
    } else if (state.contentType === "thinking") {
      content = {
        ...baseContent,
        type: "thinking",
        content: finalContent,
        providerId: this.turnMetadata?.providerId ?? "",
      } as Thinking;
    } else {
      content = this.buildContentFromBuffer(buffer, "complete");
    }

    await this.emitContent(content);

    // Clean up
    this.clearBatchTimer(itemId);
    this.contentBuffers.delete(itemId);
  }

  /**
   * Handles function_call item_done - emits tool_call with create status
   */
  private async handleFunctionCallDone(
    payload: ItemDonePayload,
  ): Promise<void> {
    const itemId = payload.item_id;
    const finalItem = payload.final_item;

    if (finalItem.type !== "function_call") {
      return;
    }

    // Parse arguments
    const toolArguments = parseJsonSafe<Record<string, unknown>>(
      finalItem.arguments,
    );

    const metadata: ToolCallMetadata = {
      itemId,
      toolName: finalItem.name,
      toolArguments: typeof toolArguments === "string" ? {} : toolArguments,
      callId: finalItem.call_id,
    };

    // Store in registry for correlation with output
    this.toolCallRegistry.set(finalItem.call_id, metadata);

    // Emit tool_call with create status
    const toolCall: ToolCall = {
      type: "tool_call",
      turnId: this.options.turnId,
      threadId: this.options.threadId,
      itemId,
      status: "create",
      content: "",
      toolName: metadata.toolName,
      toolArguments: metadata.toolArguments,
      callId: metadata.callId,
    };

    await this.emitContent(toolCall);

    // Clean up buffer
    this.clearBatchTimer(itemId);
    this.contentBuffers.delete(itemId);
  }

  /**
   * Handles function_call_output item_done - emits tool_call with complete status
   */
  private async handleFunctionCallOutput(
    payload: ItemDonePayload,
  ): Promise<void> {
    const finalItem = payload.final_item;

    if (finalItem.type !== "function_call_output") {
      return;
    }

    const callId = finalItem.call_id;
    const metadata = this.toolCallRegistry.get(callId);

    if (!metadata) {
      // No matching function_call found
      return;
    }

    // Parse output
    const toolOutput = parseJsonSafe<Record<string, unknown>>(finalItem.output);

    // Emit tool_call with complete status, using original itemId
    const toolCall: ToolCall = {
      type: "tool_call",
      turnId: this.options.turnId,
      threadId: this.options.threadId,
      itemId: metadata.itemId,
      status: "complete",
      content: "",
      toolName: metadata.toolName,
      toolArguments: metadata.toolArguments,
      callId: metadata.callId,
      toolOutput: typeof toolOutput === "string" ? toolOutput : toolOutput,
      success: finalItem.success,
    };

    await this.emitContent(toolCall);

    // Clean up registry
    this.toolCallRegistry.delete(callId);
  }

  /**
   * Handles item_error event.
   * Emits error status on content, cleans up buffer.
   */
  private async handleItemError(payload: ItemErrorPayload): Promise<void> {
    const itemId = payload.item_id;
    const buffer = this.contentBuffers.get(itemId);

    if (!buffer) {
      return;
    }

    // Build content with error status
    const content = this.buildContentFromBuffer(buffer, "error");

    // Add error info
    const errorContent = {
      ...content,
      errorCode: payload.error.code,
      errorMessage: payload.error.message,
    };

    await this.emitContent(errorContent);

    // Clean up
    this.clearBatchTimer(itemId);
    this.contentBuffers.delete(itemId);
  }

  /**
   * Handles item_cancelled event.
   * Cleans up buffer for cancelled item without emitting.
   */
  private async handleItemCancelled(
    payload: ItemCancelledPayload,
  ): Promise<void> {
    const itemId = payload.item_id;
    this.clearBatchTimer(itemId);
    this.contentBuffers.delete(itemId);
  }

  /**
   * Handles response_done event.
   * Flushes all buffers, emits turn_complete.
   */
  private async handleResponseDone(
    payload: ResponseDonePayload,
  ): Promise<void> {
    // Flush any remaining content
    await this.flush();

    // Map status
    let status: TurnStatus = "complete";
    if (payload.status === "error") {
      status = "error";
    } else if (payload.status === "aborted") {
      status = "aborted";
    }

    // Build turn_complete
    const turnComplete: TurnComplete = {
      type: "turn_complete",
      turnId: this.options.turnId,
      threadId: this.options.threadId,
      status,
    };

    // Add usage if available
    if (payload.usage) {
      turnComplete.usage = {
        promptTokens: payload.usage.prompt_tokens,
        completionTokens: payload.usage.completion_tokens,
        totalTokens: payload.usage.total_tokens,
      };
    }

    await this.emitTurnEvent(turnComplete);
  }

  /**
   * Handles response_error event.
   * Flushes all buffers, emits turn_error.
   */
  private async handleResponseError(
    payload: ResponseErrorPayload,
  ): Promise<void> {
    // Flush any remaining content
    await this.flush();

    const turnError: TurnError = {
      type: "turn_error",
      turnId: this.options.turnId,
      threadId: this.options.threadId,
      error: {
        code: payload.error.code,
        message: payload.error.message,
      },
    };

    await this.emitTurnEvent(turnError);
  }

  // -------------------------------------------------------------------------
  // Batching Logic (Private)
  // -------------------------------------------------------------------------

  /**
   * Determines if batch threshold is reached for an item.
   * Threshold is EXCEEDED (not just met) to trigger emission.
   *
   * @param buffer - The content buffer to check
   * @returns true if should emit
   */
  private shouldEmitBatch(buffer: ContentBuffer): boolean {
    const threshold = this.getCumulativeThreshold(buffer.getBatchIndex());
    const tokenCount = buffer.getTokenCount();

    // Must EXCEED threshold, not just meet it
    return tokenCount > threshold;
  }

  /**
   * Returns the cumulative token threshold for current batch index.
   * Gradient values are cumulative, so threshold at index N is sum of gradient[0..N].
   *
   * @param batchIndex - The current batch index
   * @returns Cumulative token threshold
   */
  private getCumulativeThreshold(batchIndex: number): number {
    const gradient = this.options.batchGradient;
    let threshold = 0;

    // Sum up gradient values from 0 to batchIndex
    for (let i = 0; i <= batchIndex && i < gradient.length; i++) {
      threshold += gradient[i];
    }

    // If batchIndex exceeds gradient length, continue with last value
    if (batchIndex >= gradient.length) {
      const lastValue = gradient[gradient.length - 1];
      const extraSteps = batchIndex - gradient.length + 1;
      threshold += lastValue * extraSteps;
    }

    return threshold;
  }

  /**
   * Returns the token threshold for current batch index from gradient.
   *
   * @param buffer - The content buffer
   * @returns Token threshold for current batch
   */
  private getCurrentBatchThreshold(buffer: ContentBuffer): number {
    return this.getCumulativeThreshold(buffer.getBatchIndex());
  }

  /**
   * Advances batch index to match current token count.
   * Used when a single delta crosses multiple thresholds.
   */
  private advanceBatchIndexToMatch(buffer: ContentBuffer): void {
    const tokenCount = buffer.getTokenCount();

    // Keep advancing until we're at a threshold that hasn't been exceeded
    while (this.getCumulativeThreshold(buffer.getBatchIndex()) < tokenCount) {
      buffer.advanceBatchIndex();
    }
  }

  // -------------------------------------------------------------------------
  // Emission Logic (Private)
  // -------------------------------------------------------------------------

  /**
   * Wraps content in StreamMessage and calls onEmit with retry logic.
   *
   * @param content - The content to emit
   */
  private async emitContent(content: Content): Promise<void> {
    const message: StreamMessage = {
      eventId: generateEventId(),
      timestamp: Date.now(),
      turnId: this.options.turnId,
      payload: JSON.stringify(content),
    };

    await this.emitWithRetry(message);
  }

  /**
   * Wraps turn event in StreamMessage and calls onEmit with retry logic.
   *
   * @param event - The turn event to emit
   */
  private async emitTurnEvent(event: TurnEvent): Promise<void> {
    const message: StreamMessage = {
      eventId: generateEventId(),
      timestamp: Date.now(),
      turnId: this.options.turnId,
      payload: JSON.stringify(event),
    };

    await this.emitWithRetry(message);
  }

  /**
   * Emits a message with retry logic.
   *
   * @param message - The message to emit
   * @throws RetryExhaustedError if all retries fail
   */
  private async emitWithRetry(message: StreamMessage): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.retryAttempts; attempt++) {
      try {
        await this.options.onEmit(message);
        return;
      } catch (error) {
        lastError = error as Error;

        // Don't delay on last attempt
        if (attempt < this.options.retryAttempts) {
          const delay = calculateRetryDelay(
            attempt,
            this.options.retryBaseMs,
            this.options.retryMaxMs,
          );
          await sleep(delay);
        }
      }
    }

    // All retries exhausted
    throw new RetryExhaustedError(
      this.options.retryAttempts + 1,
      lastError ?? new Error("Unknown error"),
    );
  }

  /**
   * Constructs a Content object from the current buffer state.
   *
   * @param buffer - The content buffer
   * @param status - The status (create, update, complete, error)
   * @returns Constructed Content
   */
  private buildContentFromBuffer(
    buffer: ContentBuffer,
    status: Status,
  ): Content {
    const state = buffer.getState();

    const baseContent = {
      turnId: this.options.turnId,
      threadId: this.options.threadId,
      itemId: state.itemId,
      status,
    };

    switch (state.contentType) {
      case "message":
        return {
          ...baseContent,
          type: "message",
          content: state.content,
          origin: state.origin ?? "agent",
        } as Message;

      case "thinking":
        return {
          ...baseContent,
          type: "thinking",
          content: state.content,
          providerId: state.providerId ?? this.turnMetadata?.providerId ?? "",
        } as Thinking;

      case "tool_call":
        return {
          ...baseContent,
          type: "tool_call",
          content: state.content,
          toolName: state.toolName ?? "",
          toolArguments: state.toolArguments ?? {},
          callId: state.callId ?? "",
        } as ToolCall;

      default:
        // Should never happen but satisfy TypeScript
        return {
          ...baseContent,
          type: "message",
          content: state.content,
          origin: "agent",
        } as Message;
    }
  }

  // -------------------------------------------------------------------------
  // Timer Management (Private)
  // -------------------------------------------------------------------------

  /**
   * Starts or resets the batch timeout timer for an item.
   *
   * @param itemId - The item ID
   */
  private startBatchTimer(itemId: string): void {
    // Clear existing timer
    this.clearBatchTimer(itemId);

    const timer = setTimeout(() => {
      void this.handleBatchTimeout(itemId);
    }, this.options.batchTimeoutMs);

    this.batchTimers.set(itemId, timer);
  }

  /**
   * Handles batch timeout - emits buffered content.
   */
  private async handleBatchTimeout(itemId: string): Promise<void> {
    const buffer = this.contentBuffers.get(itemId);

    if (!buffer || buffer.getIsHeld() || buffer.getIsComplete()) {
      return;
    }

    // Only emit if there's content
    if (buffer.getContent().length > 0) {
      const status: Status = buffer.getHasEmittedCreate() ? "update" : "create";
      const content = this.buildContentFromBuffer(buffer, status);
      await this.emitContent(content);

      if (!buffer.getHasEmittedCreate()) {
        buffer.markCreateEmitted();
      }
      buffer.markEmitted();
      this.advanceBatchIndexToMatch(buffer);
    }
  }

  /**
   * Clears the batch timeout timer for an item.
   *
   * @param itemId - The item ID
   */
  private clearBatchTimer(itemId: string): void {
    const timer = this.batchTimers.get(itemId);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(itemId);
    }
  }

  /**
   * Clears all batch timeout timers.
   */
  private clearAllTimers(): void {
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();
  }

  // -------------------------------------------------------------------------
  // Utility Methods (Private)
  // -------------------------------------------------------------------------

  /**
   * Determines if an item is a user message that should be held.
   *
   * @param itemId - The item ID
   * @param _payload - The item start or done payload
   * @returns true if the item is a user message
   */
  private isUserMessage(
    itemId: string,
    _payload: ItemStartPayload | ItemDonePayload,
  ): boolean {
    // Check if itemId contains "user-prompt" pattern
    return itemId.includes("user-prompt");
  }

  /**
   * Maps input item_type to output content type.
   */
  private mapItemTypeToContentType(
    itemType: ItemStartPayload["item_type"],
  ): ContentType {
    switch (itemType) {
      case "message":
        return "message";
      case "reasoning":
        return "thinking";
      case "function_call":
        return "tool_call";
      default:
        return "message";
    }
  }
}
