import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

// Create a new thread
export const create = mutation({
  args: {
    externalId: v.string(),
    modelProviderId: v.string(),
    modelProviderApi: v.string(),
    model: v.string(),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    agentRole: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const threadId = await ctx.db.insert("threads", {
      externalId: args.externalId,
      modelProviderId: args.modelProviderId,
      modelProviderApi: args.modelProviderApi,
      model: args.model,
      title: args.title,
      summary: args.summary,
      tags: args.tags ?? [],
      agentRole: args.agentRole,
      createdAt: now,
      updatedAt: now,
    });
    return threadId;
  },
});

// Get a thread by its external UUID
export const get = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
    return thread;
  },
});

// List threads (descending by creation time) with pagination
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("threads")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

// Update thread metadata
export const update = mutation({
  args: {
    id: v.id("threads"),
    title: v.optional(v.string()),
    model: v.optional(v.string()),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    agentRole: v.optional(v.string()),
    modelProviderId: v.optional(v.string()),
    modelProviderApi: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    
    if (args.title !== undefined) updates.title = args.title;
    if (args.model !== undefined) updates.model = args.model;
    if (args.summary !== undefined) updates.summary = args.summary;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.agentRole !== undefined) updates.agentRole = args.agentRole;
    if (args.modelProviderId !== undefined) updates.modelProviderId = args.modelProviderId;
    if (args.modelProviderApi !== undefined) updates.modelProviderApi = args.modelProviderApi;
    
    await ctx.db.patch(args.id, updates);
  },
});

// Delete a thread
export const remove = mutation({
  args: {
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
      
    if (thread) {
      await ctx.db.delete(thread._id);
      return true;
    }
    return false;
  }
});

// Internal testing helper to wipe data
export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const threads = await ctx.db.query("threads").collect();
    for (const t of threads) await ctx.db.delete(t._id);
    
    const messages = await ctx.db.query("messages").collect();
    for (const m of messages) await ctx.db.delete(m._id);
  }
});
