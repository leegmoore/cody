import { z } from "zod";

/**
 * Canonical domain schemas for Core 2.0.
 * Derived from docs/codex-core-2.0-tech-design.md (Appendix A).
 */

// ---------------------------------------------------------------------------
// OutputItem variants
// ---------------------------------------------------------------------------
export const MessageItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("message"),
  content: z.string(),
  origin: z.enum(["user", "agent", "system"]).default("agent"),
  correlation_id: z.string().uuid().optional(),
});

export const ReasoningItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("reasoning"),
  content: z.string(),
  origin: z.enum(["agent", "system"]).default("agent"),
  correlation_id: z.string().uuid().optional(),
});

export const FunctionCallItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("function_call"),
  name: z.string(),
  arguments: z.string(), // JSON string
  call_id: z.string().uuid(),
  origin: z.enum(["agent"]).default("agent"),
  correlation_id: z.string().uuid().optional(),
});

export const FunctionCallOutputItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("function_call_output"),
  call_id: z.string().uuid(),
  output: z.string(),
  success: z.boolean(),
  origin: z.enum(["system", "tool_harness"]).default("system"),
  correlation_id: z.string().uuid().optional(),
});

export const ScriptExecutionItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("script_execution"),
  code: z.string(),
  origin: z.enum(["agent"]).default("agent"),
  correlation_id: z.string().uuid().optional(),
});

export const ScriptExecutionOutputItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("script_execution_output"),
  script_id: z.string().uuid(),
  result: z.string(), // JSON string
  success: z.boolean(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
  origin: z.enum(["system", "script_harness"]).default("system"),
  correlation_id: z.string().uuid().optional(),
});

export const ErrorItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("error"),
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
  origin: z.enum(["agent", "system", "provider"]).default("system"),
  correlation_id: z.string().uuid().optional(),
});

export const OutputItemSchema = z.discriminatedUnion("type", [
  MessageItemSchema,
  ReasoningItemSchema,
  FunctionCallItemSchema,
  FunctionCallOutputItemSchema,
  ScriptExecutionItemSchema,
  ScriptExecutionOutputItemSchema,
  ErrorItemSchema,
]);

// ---------------------------------------------------------------------------
// Response object
// ---------------------------------------------------------------------------
export const ResponseSchema = z.object({
  id: z.string().uuid(),
  turn_id: z.string().uuid(),
  thread_id: z.string().uuid(),
  agent_id: z.string().uuid().optional(),
  model_id: z.string(),
  provider_id: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
  status: z.enum(["queued", "in_progress", "complete", "error", "aborted"]),
  output_items: z.array(OutputItemSchema),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    })
    .optional(),
  finish_reason: z.string().nullable(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Stream event (Redis/SSE wire protocol)
// ---------------------------------------------------------------------------
export const TraceContextSchema = z.object({
  traceparent: z.string(),
  tracestate: z.string().optional(),
});

export const ErrorObjectSchema = z.object({
  code: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  details: z.any().optional(),
});

const StreamEventPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("response_start"),
    response_id: z.string().uuid(),
    turn_id: z.string().uuid(),
    thread_id: z.string().uuid(),
    agent_id: z.string().uuid().optional(),
    model_id: z.string(),
    provider_id: z.string(),
    created_at: z.number(),
  }),
  z.object({
    type: z.literal("item_start"),
    item_id: z.string().uuid(),
    item_type: z.enum([
      "message",
      "reasoning",
      "function_call",
      "function_call_output",
      "script_execution",
      "script_execution_output",
      "error",
    ]),
    initial_content: z.string().optional(),
    name: z.string().optional(),
    arguments: z.string().optional(),
    code: z.string().optional(),
  }),
  z.object({
    type: z.literal("item_delta"),
    item_id: z.string().uuid(),
    delta_content: z.string(),
  }),
  z.object({
    type: z.literal("item_done"),
    item_id: z.string().uuid(),
    final_item: OutputItemSchema,
  }),
  z.object({
    type: z.literal("item_error"),
    item_id: z.string().uuid(),
    error: ErrorObjectSchema,
  }),
  z.object({
    type: z.literal("item_cancelled"),
    item_id: z.string().uuid(),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal("script_execution_start"),
    item_id: z.string().uuid(),
    code: z.string(),
  }),
  z.object({
    type: z.literal("script_execution_done"),
    item_id: z.string().uuid(),
    result: z.string(),
    success: z.boolean(),
  }),
  z.object({
    type: z.literal("script_execution_error"),
    item_id: z.string().uuid(),
    error: ErrorObjectSchema,
  }),
  z.object({
    type: z.literal("response_done"),
    response_id: z.string().uuid(),
    status: ResponseSchema.shape.status,
    usage: ResponseSchema.shape.usage.optional(),
    finish_reason: ResponseSchema.shape.finish_reason,
  }),
  z.object({
    type: z.literal("response_error"),
    response_id: z.string().uuid(),
    error: ErrorObjectSchema,
  }),
  z.object({
    type: z.literal("usage_update"),
    response_id: z.string().uuid(),
    usage: ResponseSchema.shape.usage,
  }),
  z.object({
    type: z.literal("heartbeat"),
  }),
  z.object({
    type: z.literal("turn_aborted_by_user"),
    turn_id: z.string().uuid(),
    reason: z.string(),
  }),
]);

export const STREAM_EVENT_TYPES = [
  "response_start",
  "item_start",
  "item_delta",
  "item_done",
  "item_error",
  "item_cancelled",
  "script_execution_start",
  "script_execution_done",
  "script_execution_error",
  "response_done",
  "response_error",
  "usage_update",
  "heartbeat",
  "turn_aborted_by_user",
] as const;

const StreamEventTypeSchema = z.enum(STREAM_EVENT_TYPES);

export const StreamEventSchema = z.object({
  event_id: z.string().uuid(),
  timestamp: z.number(),
  trace_context: TraceContextSchema,
  run_id: z.string().uuid(),
  type: StreamEventTypeSchema,
  payload: StreamEventPayloadSchema,
});

// ---------------------------------------------------------------------------
// Derived types
// ---------------------------------------------------------------------------
export type OutputItem = z.infer<typeof OutputItemSchema>;
export type Response = z.infer<typeof ResponseSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;
export type StreamEventPayload = z.infer<typeof StreamEventPayloadSchema>;
export type TraceContext = z.infer<typeof TraceContextSchema>;
export type ErrorObject = z.infer<typeof ErrorObjectSchema>;
export type StreamEventType = (typeof STREAM_EVENT_TYPES)[number];

// Constants / helpers
export const REDIS_STREAM_KEY_PREFIX = "codex:run";

export function streamKeyForRun(runId: string): string {
  return `${REDIS_STREAM_KEY_PREFIX}:${runId}:events`;
}
