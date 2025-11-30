/**
 * UpsertStreamProcessor module.
 *
 * Transforms StreamEvents from adapters (Stream A) into UIUpserts
 * for the UI layer (Stream B) with intelligent batching.
 */

// Re-export all public types
export type {
  BufferInfo,
  ItemBufferState,
  MessageOrigin,
  StreamBMessage,
  StreamBPayloadType,
  TurnStatus,
  UITurnEvent,
  UITurnEventError,
  UITurnEventType,
  UITurnEventUsage,
  UIUpsert,
  UIUpsertChangeType,
  UIUpsertItemType,
  UpsertStreamProcessorOptions,
} from "./types.js";

// Export main class
export { UpsertStreamProcessor } from "./processor.js";

// Export ItemBuffer class and its options
export { ItemBuffer } from "./item-buffer.js";
export type { ItemBufferOptions } from "./item-buffer.js";

// Export utilities
export {
  calculateRetryDelay,
  estimateTokenCount,
  generateEventId,
  NotImplementedError,
  parseJsonSafe,
  sleep,
} from "./utils.js";
