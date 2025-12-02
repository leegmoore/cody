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
  ProcessorOptions,
  Status,
  StreamMessage,
  TurnEvent,
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
  10, 10, 20, 20, 50, 50, 50, 50, 100, 100, 200, 200, 500, 500, 1000, 1000,
  2000,
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
  async processEvent(_event: StreamEvent): Promise<void> {
    throw new NotImplementedError("StreamProcessor.processEvent");
  }

  /**
   * Force emit all pending buffered content.
   * Called on turn completion or when processor is being shut down.
   */
  async flush(): Promise<void> {
    throw new NotImplementedError("StreamProcessor.flush");
  }

  /**
   * Cleanup all resources.
   * Clears all timers, releases all buffers.
   * Must be called when processor is no longer needed.
   */
  destroy(): void {
    throw new NotImplementedError("StreamProcessor.destroy");
  }

  /**
   * Returns current buffer state for all items.
   * Used for testing and debugging.
   *
   * @returns Map of item IDs to their buffer info
   */
  getBufferState(): Map<string, BufferInfo> {
    throw new NotImplementedError("StreamProcessor.getBufferState");
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
    throw new NotImplementedError("StreamProcessor.handleResponseStart");
  }

  /**
   * Handles item_start event.
   * Creates new ContentBuffer, determines if item should be held.
   */
  private async handleItemStart(_payload: ItemStartPayload): Promise<void> {
    throw new NotImplementedError("StreamProcessor.handleItemStart");
  }

  /**
   * Handles item_delta event.
   * Appends content to buffer, checks batch threshold, may emit.
   */
  private async handleItemDelta(_payload: ItemDeltaPayload): Promise<void> {
    throw new NotImplementedError("StreamProcessor.handleItemDelta");
  }

  /**
   * Handles item_done event.
   * Finalizes item, emits complete content, cleans up buffer.
   */
  private async handleItemDone(_payload: ItemDonePayload): Promise<void> {
    throw new NotImplementedError("StreamProcessor.handleItemDone");
  }

  /**
   * Handles item_error event.
   * Emits error status on content, cleans up buffer.
   */
  private async handleItemError(_payload: ItemErrorPayload): Promise<void> {
    throw new NotImplementedError("StreamProcessor.handleItemError");
  }

  /**
   * Handles item_cancelled event.
   * Cleans up buffer for cancelled item without emitting.
   */
  private async handleItemCancelled(
    _payload: ItemCancelledPayload,
  ): Promise<void> {
    throw new NotImplementedError("StreamProcessor.handleItemCancelled");
  }

  /**
   * Handles response_done event.
   * Flushes all buffers, emits turn_complete.
   */
  private async handleResponseDone(
    _payload: ResponseDonePayload,
  ): Promise<void> {
    throw new NotImplementedError("StreamProcessor.handleResponseDone");
  }

  /**
   * Handles response_error event.
   * Flushes all buffers, emits turn_error.
   */
  private async handleResponseError(
    _payload: ResponseErrorPayload,
  ): Promise<void> {
    throw new NotImplementedError("StreamProcessor.handleResponseError");
  }

  // -------------------------------------------------------------------------
  // Batching Logic (Private)
  // -------------------------------------------------------------------------

  /**
   * Determines if batch threshold is reached for an item.
   *
   * @param buffer - The content buffer to check
   * @returns true if should emit
   */
  private shouldEmitBatch(_buffer: ContentBuffer): boolean {
    throw new NotImplementedError("StreamProcessor.shouldEmitBatch");
  }

  /**
   * Returns the token threshold for current batch index from gradient.
   *
   * @param buffer - The content buffer
   * @returns Token threshold for current batch
   */
  private getCurrentBatchThreshold(_buffer: ContentBuffer): number {
    throw new NotImplementedError("StreamProcessor.getCurrentBatchThreshold");
  }

  // -------------------------------------------------------------------------
  // Emission Logic (Private)
  // -------------------------------------------------------------------------

  /**
   * Wraps content in StreamMessage and calls onEmit with retry logic.
   *
   * @param content - The content to emit
   */
  private async emitContent(_content: Content): Promise<void> {
    throw new NotImplementedError("StreamProcessor.emitContent");
  }

  /**
   * Wraps turn event in StreamMessage and calls onEmit with retry logic.
   *
   * @param event - The turn event to emit
   */
  private async emitTurnEvent(_event: TurnEvent): Promise<void> {
    throw new NotImplementedError("StreamProcessor.emitTurnEvent");
  }

  /**
   * Constructs a Content object from the current buffer state.
   *
   * @param buffer - The content buffer
   * @param status - The status (create, update, complete, error)
   * @returns Constructed Content
   */
  private buildContentFromBuffer(
    _buffer: ContentBuffer,
    _status: Status,
  ): Content {
    throw new NotImplementedError("StreamProcessor.buildContentFromBuffer");
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
    throw new NotImplementedError("StreamProcessor.startBatchTimer");
  }

  /**
   * Clears the batch timeout timer for an item.
   *
   * @param itemId - The item ID
   */
  private clearBatchTimer(_itemId: string): void {
    throw new NotImplementedError("StreamProcessor.clearBatchTimer");
  }

  /**
   * Clears all batch timeout timers.
   */
  private clearAllTimers(): void {
    throw new NotImplementedError("StreamProcessor.clearAllTimers");
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
    throw new NotImplementedError("StreamProcessor.isUserMessage");
  }
}
