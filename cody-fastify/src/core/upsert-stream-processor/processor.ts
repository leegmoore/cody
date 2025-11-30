/**
 * UpsertStreamProcessor - Main processor class for transforming StreamEvents to UIUpserts.
 *
 * Receives StreamEvents from adapters (Stream A) and emits UIUpserts/UITurnEvents
 * to the UI layer (Stream B) with batching and backpressure handling.
 */

import type { StreamEvent, StreamEventPayload } from "../schema.js";
import { ItemBuffer } from "./item-buffer.js";
import type {
  BufferInfo,
  StreamBMessage,
  UITurnEvent,
  UIUpsert,
  UIUpsertChangeType,
  UpsertStreamProcessorOptions,
} from "./types.js";
import { NotImplementedError } from "./utils.js";

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
  onEmit: (message: StreamBMessage) => Promise<void>;
  retryAttempts: number;
  retryBaseMs: number;
  retryMaxMs: number;
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_BATCH_TIMEOUT_MS = 1000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 1000;
const DEFAULT_RETRY_MAX_MS = 10000;
const DEFAULT_BATCH_GRADIENT = [
  10, 10, 20, 20, 50, 50, 50, 50, 100, 100, 200, 200, 500, 500, 1000, 1000,
  2000,
];

// ---------------------------------------------------------------------------
// UpsertStreamProcessor
// ---------------------------------------------------------------------------

export class UpsertStreamProcessor {
  private itemBuffers: Map<string, ItemBuffer> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private turnMetadata: TurnMetadata | null = null;
  private options: RequiredOptions;

  /**
   * Creates a new UpsertStreamProcessor.
   *
   * @param options - Configuration options for the processor
   */
  constructor(options: UpsertStreamProcessorOptions) {
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
  async processEvent(_event: StreamEvent): Promise<void> {
    throw new NotImplementedError("UpsertStreamProcessor.processEvent");
  }

  /**
   * Force emit all pending buffered content.
   * Called on turn completion or when processor is being shut down.
   */
  async flush(): Promise<void> {
    throw new NotImplementedError("UpsertStreamProcessor.flush");
  }

  /**
   * Cleanup all resources.
   * Clears all timers, releases all buffers.
   * Must be called when processor is no longer needed.
   */
  destroy(): void {
    throw new NotImplementedError("UpsertStreamProcessor.destroy");
  }

  /**
   * Returns current buffer state for all items.
   * Used for testing and debugging.
   *
   * @returns Map of item IDs to their buffer info
   */
  getBufferState(): Map<string, BufferInfo> {
    throw new NotImplementedError("UpsertStreamProcessor.getBufferState");
  }

  // -------------------------------------------------------------------------
  // Event Handlers (Private)
  // -------------------------------------------------------------------------

  /**
   * Handles response_start event.
   * Stores turn metadata, emits turn_started event.
   */
  private async handleResponseStart(
    _payload: ResponseStartPayload,
  ): Promise<void> {
    throw new NotImplementedError("UpsertStreamProcessor.handleResponseStart");
  }

  /**
   * Handles item_start event.
   * Creates new ItemBuffer, determines if item should be held.
   */
  private async handleItemStart(_payload: ItemStartPayload): Promise<void> {
    throw new NotImplementedError("UpsertStreamProcessor.handleItemStart");
  }

  /**
   * Handles item_delta event.
   * Appends content to buffer, checks batch threshold, may emit.
   */
  private async handleItemDelta(_payload: ItemDeltaPayload): Promise<void> {
    throw new NotImplementedError("UpsertStreamProcessor.handleItemDelta");
  }

  /**
   * Handles item_done event.
   * Finalizes item, emits completed upsert, cleans up buffer.
   */
  private async handleItemDone(_payload: ItemDonePayload): Promise<void> {
    throw new NotImplementedError("UpsertStreamProcessor.handleItemDone");
  }

  /**
   * Handles item_error event.
   * Emits error upsert, cleans up buffer.
   */
  private async handleItemError(_payload: ItemErrorPayload): Promise<void> {
    throw new NotImplementedError("UpsertStreamProcessor.handleItemError");
  }

  /**
   * Handles item_cancelled event.
   * Cleans up buffer for cancelled item without emitting.
   */
  private async handleItemCancelled(
    _payload: ItemCancelledPayload,
  ): Promise<void> {
    throw new NotImplementedError("UpsertStreamProcessor.handleItemCancelled");
  }

  /**
   * Handles response_done event.
   * Flushes all buffers, emits turn_completed.
   */
  private async handleResponseDone(
    _payload: ResponseDonePayload,
  ): Promise<void> {
    throw new NotImplementedError("UpsertStreamProcessor.handleResponseDone");
  }

  /**
   * Handles response_error event.
   * Flushes all buffers, emits turn_error.
   */
  private async handleResponseError(
    _payload: ResponseErrorPayload,
  ): Promise<void> {
    throw new NotImplementedError("UpsertStreamProcessor.handleResponseError");
  }

  // -------------------------------------------------------------------------
  // Batching Logic (Private)
  // -------------------------------------------------------------------------

  /**
   * Determines if batch threshold is reached for an item.
   *
   * @param buffer - The item buffer to check
   * @returns true if should emit
   */
  private shouldEmitBatch(_buffer: ItemBuffer): boolean {
    throw new NotImplementedError("UpsertStreamProcessor.shouldEmitBatch");
  }

  /**
   * Returns the token threshold for current batch index from gradient.
   *
   * @param buffer - The item buffer
   * @returns Token threshold for current batch
   */
  private getCurrentBatchThreshold(_buffer: ItemBuffer): number {
    throw new NotImplementedError(
      "UpsertStreamProcessor.getCurrentBatchThreshold",
    );
  }

  // -------------------------------------------------------------------------
  // Emission Logic (Private)
  // -------------------------------------------------------------------------

  /**
   * Wraps upsert in StreamBMessage and calls onEmit with retry logic.
   *
   * @param upsert - The upsert to emit
   */
  private async emitUpsert(_upsert: UIUpsert): Promise<void> {
    throw new NotImplementedError("UpsertStreamProcessor.emitUpsert");
  }

  /**
   * Wraps turn event in StreamBMessage and calls onEmit with retry logic.
   *
   * @param event - The turn event to emit
   */
  private async emitTurnEvent(_event: UITurnEvent): Promise<void> {
    throw new NotImplementedError("UpsertStreamProcessor.emitTurnEvent");
  }

  /**
   * Constructs a UIUpsert from the current buffer state.
   *
   * @param buffer - The item buffer
   * @param changeType - The type of change (created, updated, completed)
   * @returns Constructed UIUpsert
   */
  private buildUpsertFromBuffer(
    _buffer: ItemBuffer,
    _changeType: UIUpsertChangeType,
  ): UIUpsert {
    throw new NotImplementedError(
      "UpsertStreamProcessor.buildUpsertFromBuffer",
    );
  }

  // -------------------------------------------------------------------------
  // Timer Management (Private)
  // -------------------------------------------------------------------------

  /**
   * Starts or resets the batch timeout timer for an item.
   *
   * @param itemId - The item ID
   */
  private startBatchTimer(_itemId: string): void {
    throw new NotImplementedError("UpsertStreamProcessor.startBatchTimer");
  }

  /**
   * Clears the batch timeout timer for an item.
   *
   * @param itemId - The item ID
   */
  private clearBatchTimer(_itemId: string): void {
    throw new NotImplementedError("UpsertStreamProcessor.clearBatchTimer");
  }

  /**
   * Clears all batch timeout timers.
   */
  private clearAllTimers(): void {
    throw new NotImplementedError("UpsertStreamProcessor.clearAllTimers");
  }

  // -------------------------------------------------------------------------
  // Utility Methods (Private)
  // -------------------------------------------------------------------------

  /**
   * Determines if an item is a user message that should be held.
   *
   * @param itemId - The item ID
   * @param payload - The item start or done payload
   * @returns true if the item is a user message
   */
  private isUserMessage(
    _itemId: string,
    _payload: ItemStartPayload | ItemDonePayload,
  ): boolean {
    throw new NotImplementedError("UpsertStreamProcessor.isUserMessage");
  }
}
