/**
 * ContentBuffer - Manages the state for a single content item being processed.
 *
 * Each item (message, thinking, tool_call, etc.) has its own buffer
 * that accumulates content and tracks emission state.
 */

import type { ContentType, MessageOrigin } from "./types.js";
import { NotImplementedError } from "./utils.js";

// ---------------------------------------------------------------------------
// Buffer State Types (internal to this module)
// ---------------------------------------------------------------------------

export interface BufferState {
  itemId: string;
  contentType: ContentType;
  content: string;
  tokenCount: number;
  batchIndex: number;
  emittedTokenCount: number;
  isComplete: boolean;
  isHeld: boolean;
  hasEmittedCreate: boolean;
  origin?: MessageOrigin;
  providerId?: string;
  toolName?: string;
  callId?: string;
  toolArguments?: Record<string, unknown>;
}

export interface BufferInfo {
  itemId: string;
  contentType: ContentType;
  tokenCount: number;
  contentLength: number;
  batchIndex: number;
  isHeld: boolean;
  isComplete: boolean;
}

// ---------------------------------------------------------------------------
// Buffer Options
// ---------------------------------------------------------------------------

export interface BufferOptions {
  initialContent?: string;
  origin?: MessageOrigin;
  providerId?: string;
  toolName?: string;
  callId?: string;
  toolArguments?: Record<string, unknown>;
  isHeld?: boolean;
}

// ---------------------------------------------------------------------------
// ContentBuffer Class
// ---------------------------------------------------------------------------

export class ContentBuffer {
  private state: BufferState;

  /**
   * Creates a new ContentBuffer for tracking a content item's state.
   *
   * @param itemId - Unique identifier for this item
   * @param contentType - Type of content (message, thinking, tool_call)
   * @param options - Optional configuration including initial content and metadata
   */
  constructor(
    itemId: string,
    contentType: ContentType,
    options?: BufferOptions,
  ) {
    this.state = {
      itemId,
      contentType,
      content: options?.initialContent ?? "",
      tokenCount: 0,
      batchIndex: 0,
      emittedTokenCount: 0,
      isComplete: false,
      isHeld: options?.isHeld ?? false,
      hasEmittedCreate: false,
      origin: options?.origin,
      providerId: options?.providerId,
      toolName: options?.toolName,
      callId: options?.callId,
      toolArguments: options?.toolArguments,
    };
  }

  /**
   * Appends delta content to the buffer and updates token count.
   *
   * @param delta - Content to append
   */
  appendContent(_delta: string): void {
    throw new NotImplementedError("ContentBuffer.appendContent");
  }

  /**
   * Returns the full accumulated content.
   *
   * @returns Full content string
   */
  getContent(): string {
    throw new NotImplementedError("ContentBuffer.getContent");
  }

  /**
   * Returns the current estimated token count (characters / 4).
   *
   * @returns Estimated tokens
   */
  getTokenCount(): number {
    throw new NotImplementedError("ContentBuffer.getTokenCount");
  }

  /**
   * Returns tokens accumulated since last emit.
   *
   * @returns Tokens since last emit
   */
  getUnemittedTokenCount(): number {
    throw new NotImplementedError("ContentBuffer.getUnemittedTokenCount");
  }

  /**
   * Updates emittedTokenCount to current tokenCount after an emit.
   */
  markEmitted(): void {
    throw new NotImplementedError("ContentBuffer.markEmitted");
  }

  /**
   * Increments the batch index (moves to next gradient level).
   */
  advanceBatchIndex(): void {
    throw new NotImplementedError("ContentBuffer.advanceBatchIndex");
  }

  /**
   * Returns current position in batch gradient.
   *
   * @returns Current batch index
   */
  getBatchIndex(): number {
    throw new NotImplementedError("ContentBuffer.getBatchIndex");
  }

  /**
   * Marks the item as complete.
   */
  markComplete(): void {
    throw new NotImplementedError("ContentBuffer.markComplete");
  }

  /**
   * Returns whether item is marked complete.
   *
   * @returns true if item is complete
   */
  isComplete(): boolean {
    throw new NotImplementedError("ContentBuffer.isComplete");
  }

  /**
   * Returns whether item is being held (user messages).
   *
   * @returns true if item is held
   */
  isHeld(): boolean {
    throw new NotImplementedError("ContentBuffer.isHeld");
  }

  /**
   * Sets the held state.
   *
   * @param held - Whether to hold the item
   */
  setHeld(_held: boolean): void {
    throw new NotImplementedError("ContentBuffer.setHeld");
  }

  /**
   * Returns whether a 'create' emission has been made for this item.
   *
   * @returns true if create status has been emitted
   */
  hasEmittedCreate(): boolean {
    throw new NotImplementedError("ContentBuffer.hasEmittedCreate");
  }

  /**
   * Marks that 'create' status has been emitted.
   */
  markCreateEmitted(): void {
    throw new NotImplementedError("ContentBuffer.markCreateEmitted");
  }

  /**
   * Returns full internal state (for debugging/testing).
   *
   * @returns Full BufferState
   */
  getState(): BufferState {
    throw new NotImplementedError("ContentBuffer.getState");
  }

  /**
   * Returns public buffer info (for getBufferState).
   *
   * @returns BufferInfo for external inspection
   */
  toBufferInfo(): BufferInfo {
    throw new NotImplementedError("ContentBuffer.toBufferInfo");
  }
}
