/**
 * StreamProcessor module.
 *
 * Transforms StreamEvents from adapters (Stream A) into Content/TurnEvents
 * for the UI layer (Stream B) with intelligent batching.
 */

// Types
export type {
  Content,
  ContentType,
  Message,
  MessageOrigin,
  ProcessorOptions,
  Status,
  StreamMessage,
  StreamOutput,
  Thinking,
  ToolCall,
  TurnComplete,
  TurnError,
  TurnEvent,
  TurnStarted,
  TurnStatus,
} from "./types.js";

// Classes
export { StreamProcessor } from "./processor.js";
export {
  ContentBuffer,
  type BufferInfo,
  type BufferOptions,
  type BufferState,
} from "./content-buffer.js";

// Utilities
export { NotImplementedError, RetryExhaustedError } from "./utils.js";
export {
  calculateRetryDelay,
  estimateTokenCount,
  generateEventId,
  parseJsonSafe,
  sleep,
} from "./utils.js";
