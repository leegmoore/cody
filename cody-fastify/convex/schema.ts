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
    threadId: v.id("threads"),
    
    // Role: user, assistant, system
    role: v.string(),
    
    // Content (text)
    content: v.string(),
    
    // Optional: For grouping messages into a "Turn"
    turnId: v.optional(v.string()),
    
    // Type discriminator: "message", "tool_call", "tool_output"
    type: v.optional(v.string()),
    
    // Tool specific fields
    callId: v.optional(v.string()),
    toolName: v.optional(v.string()),
    toolArgs: v.optional(v.any()),
    toolOutput: v.optional(v.any()),
    status: v.optional(v.string()), // succeeded/failed
    
    createdAt: v.number(),
  })
  .index("by_threadId", ["threadId"])
  .index("by_callId", ["callId"]),
});
