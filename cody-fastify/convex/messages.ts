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
