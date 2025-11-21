import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Add a message to a thread
export const add = mutation({
  args: {
    conversationId: v.string(), // externalId
    role: v.string(),
    content: v.string(),
    turnId: v.optional(v.string()),
    type: v.optional(v.string()),
    callId: v.optional(v.string()),
    toolName: v.optional(v.string()),
    toolArgs: v.optional(v.any()),
    toolOutput: v.optional(v.any()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.conversationId))
      .unique();

    if (!thread) {
      throw new Error(`Thread not found: ${args.conversationId}`);
    }

    await ctx.db.insert("messages", {
      threadId: thread._id,
      role: args.role,
      content: args.content,
      turnId: args.turnId,
      type: args.type ?? "message",
      callId: args.callId,
      toolName: args.toolName,
      toolArgs: args.toolArgs,
      toolOutput: args.toolOutput,
      status: args.status,
      createdAt: Date.now(),
    });
    
    // Touch the thread's updatedAt
    await ctx.db.patch(thread._id, { updatedAt: Date.now() });
  },
});

// List messages for a thread
export const list = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();
  },
});

// Projector: store reduced run snapshot
export const projectRunSnapshot = mutation({
  args: {
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
      v.literal("aborted")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    outputItems: v.array(v.any()),
    usage: v.optional(v.object({
      prompt_tokens: v.number(),
      completion_tokens: v.number(),
      total_tokens: v.number(),
    })),
    finishReason: v.optional(v.string()),
    error: v.optional(v.object({
      code: v.string(),
      message: v.string(),
      details: v.optional(v.any()),
    })),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.threadId))
      .unique();

    if (!thread) {
      throw new Error(`Thread not found for threadId ${args.threadId}`);
    }

    await ctx.db.insert("messages", {
      threadId: thread._id,
      role: "assistant",
      content: "",
      turnId: args.turnId,
      type: "run_snapshot",
      callId: args.runId,
      toolName: undefined,
      toolArgs: undefined,
      toolOutput: args.outputItems,
      status: args.status,
      createdAt: args.createdAt,
    });

    await ctx.db.patch(thread._id, { updatedAt: args.updatedAt });
  },
});
