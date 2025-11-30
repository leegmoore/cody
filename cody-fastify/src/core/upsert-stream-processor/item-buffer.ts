/**
 * ItemBuffer - Manages the state for a single item being processed.
 *
 * Each item (message, reasoning, tool_call, etc.) has its own buffer
 * that accumulates content and tracks emission state.
 */

import type {
  BufferInfo,
  ItemBufferState,
  MessageOrigin,
  UIUpsertItemType,
} from "./types.js";
import { NotImplementedError } from "./utils.js";

export interface ItemBufferOptions {
  initialContent?: string;
  origin?: MessageOrigin;
  providerId?: string;
  toolName?: string;
  callId?: string;
  isHeld?: boolean;
}

export class ItemBuffer {
  private state: ItemBufferState;

  /**
   * Creates a new ItemBuffer for tracking an item's content and state.
   *
   * @param itemId - Unique identifier for this item
   * @param itemType - Type of item (message, reasoning, tool_call, etc.)
   * @param options - Optional configuration including initial content and metadata
   */
  constructor(
    itemId: string,
    itemType: UIUpsertItemType,
    options?: ItemBufferOptions,
  ) {
    this.state = {
      itemId,
      itemType,
      content: options?.initialContent ?? "",
      tokenCount: 0,
      batchIndex: 0,
      emittedTokenCount: 0,
      isComplete: false,
      isHeld: options?.isHeld ?? false,
      hasEmittedCreated: false,
      origin: options?.origin,
      providerId: options?.providerId,
      toolName: options?.toolName,
      callId: options?.callId,
    };
  }

  /**
   * Appends delta content to the buffer and updates token count.
   *
   * @param delta - Content to append
   */
  appendContent(_delta: string): void {
    throw new NotImplementedError("ItemBuffer.appendContent");
  }

  /**
   * Returns the full accumulated content.
   *
   * @returns Full content string
   */
  getContent(): string {
    throw new NotImplementedError("ItemBuffer.getContent");
  }

  /**
   * Returns the current estimated token count (characters / 4).
   *
   * @returns Estimated tokens
   */
  getTokenCount(): number {
    throw new NotImplementedError("ItemBuffer.getTokenCount");
  }

  /**
   * Returns tokens accumulated since last emit.
   *
   * @returns Tokens since last emit
   */
  getUnemittedTokenCount(): number {
    throw new NotImplementedError("ItemBuffer.getUnemittedTokenCount");
  }

  /**
   * Updates emittedTokenCount to current tokenCount after an emit.
   */
  markEmitted(): void {
    throw new NotImplementedError("ItemBuffer.markEmitted");
  }

  /**
   * Increments the batch index (moves to next gradient level).
   */
  advanceBatchIndex(): void {
    throw new NotImplementedError("ItemBuffer.advanceBatchIndex");
  }

  /**
   * Returns current position in batch gradient.
   *
   * @returns Current batch index
   */
  getBatchIndex(): number {
    throw new NotImplementedError("ItemBuffer.getBatchIndex");
  }

  /**
   * Marks the item as complete.
   */
  markComplete(): void {
    throw new NotImplementedError("ItemBuffer.markComplete");
  }

  /**
   * Returns whether item is marked complete.
   *
   * @returns true if item is complete
   */
  isComplete(): boolean {
    throw new NotImplementedError("ItemBuffer.isComplete");
  }

  /**
   * Returns whether item is being held (user messages).
   *
   * @returns true if item is held
   */
  isHeld(): boolean {
    throw new NotImplementedError("ItemBuffer.isHeld");
  }

  /**
   * Sets the held state.
   *
   * @param held - Whether to hold the item
   */
  setHeld(_held: boolean): void {
    throw new NotImplementedError("ItemBuffer.setHeld");
  }

  /**
   * Returns whether a 'created' upsert has been emitted for this item.
   *
   * @returns true if created upsert has been emitted
   */
  hasEmittedCreated(): boolean {
    throw new NotImplementedError("ItemBuffer.hasEmittedCreated");
  }

  /**
   * Marks that 'created' upsert has been emitted.
   */
  markCreatedEmitted(): void {
    throw new NotImplementedError("ItemBuffer.markCreatedEmitted");
  }

  /**
   * Returns full internal state (for debugging/testing).
   *
   * @returns Full ItemBufferState
   */
  getState(): ItemBufferState {
    throw new NotImplementedError("ItemBuffer.getState");
  }

  /**
   * Returns public buffer info (for getBufferState).
   *
   * @returns BufferInfo for external inspection
   */
  toBufferInfo(): BufferInfo {
    throw new NotImplementedError("ItemBuffer.toBufferInfo");
  }
}
