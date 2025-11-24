import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  threads: defineTable({
    // External ID (UUIDv7) used in URLs
    externalId: v.string(),
    
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    userId: v.optional(v.string()),
    
    // Config snapshots
    modelProviderId: v.optional(v.string()),
    modelProviderApi: v.optional(v.string()),
    model: v.optional(v.string()),
    agentRole: v.optional(v.string()),
    
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_externalId", ["externalId"])
  .index("by_userId", ["userId"]),

  messages: defineTable({
    runId: v.string(),
    turnId: v.string(),
    threadId: v.string(),
    agentId: v.optional(v.string()),
    modelId: v.string(),
    providerId: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("in_progress"),
      v.literal("complete"),
      v.literal("error"),
      v.literal("aborted"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    outputItems: v.array(
      v.union(
        v.object({
          id: v.string(),
          type: v.literal("message"),
          content: v.string(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("reasoning"),
          content: v.string(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("function_call"),
          name: v.string(),
          arguments: v.string(),
          call_id: v.string(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("function_call_output"),
          call_id: v.string(),
          output: v.string(),
          success: v.boolean(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("cancelled"),
          reason: v.optional(v.string()),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("script_execution"),
          code: v.string(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("script_execution_output"),
          script_id: v.string(),
          result: v.string(),
          success: v.boolean(),
          error: v.optional(
            v.object({
              code: v.string(),
              message: v.string(),
              stack: v.optional(v.string()),
            }),
          ),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("error"),
          code: v.string(),
          message: v.string(),
          details: v.optional(v.any()),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
      ),
    ),
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
      }),
    ),
    finishReason: v.optional(v.string()),
    error: v.optional(
      v.object({
        code: v.string(),
        message: v.string(),
        details: v.optional(v.any()),
      }),
    ),
  })
    .index("by_runId", ["runId"])
    .index("by_threadId", ["threadId"])
    .index("by_turnId", ["turnId"]),

  legacyMessages: defineTable({
    threadId: v.id("threads"),
    role: v.string(),
    content: v.string(),
    turnId: v.optional(v.string()),
    type: v.optional(v.string()),
    callId: v.optional(v.string()),
    toolName: v.optional(v.string()),
    toolArgs: v.optional(v.any()),
    toolOutput: v.optional(v.any()),
    status: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_callId", ["callId"]),
});
