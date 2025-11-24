import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const statusValue = v.union(
  v.literal("queued"),
  v.literal("in_progress"),
  v.literal("complete"),
  v.literal("error"),
  v.literal("aborted"),
);

const outputItemValue = v.union(
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
);

const usageValue = v.object({
  promptTokens: v.number(),
  completionTokens: v.number(),
  totalTokens: v.number(),
});

const errorValue = v.object({
  code: v.string(),
  message: v.string(),
  details: v.optional(v.any()),
});

type NormalizedOutputItem =
  | {
      id: string;
      type: "message";
      content: string;
      origin: string;
      correlation_id?: string;
    }
  | {
      id: string;
      type: "reasoning";
      content: string;
      origin: string;
      correlation_id?: string;
    }
  | {
      id: string;
      type: "function_call";
      name: string;
      arguments: string;
      call_id: string;
      origin: string;
      correlation_id?: string;
    }
  | {
      id: string;
      type: "function_call_output";
      call_id: string;
      output: string;
      success: boolean;
      origin: string;
      correlation_id?: string;
    }
  | {
      id: string;
      type: "cancelled";
      reason?: string;
      origin: string;
      correlation_id?: string;
    }
  | {
      id: string;
      type: "script_execution";
      code: string;
      origin: string;
      correlation_id?: string;
    }
  | {
      id: string;
      type: "script_execution_output";
      script_id: string;
      result: string;
      success: boolean;
      error?: {
        code: string;
        message: string;
        stack?: string;
      };
      origin: string;
      correlation_id?: string;
    }
  | {
      id: string;
      type: "error";
      code: string;
      message: string;
      details?: unknown;
      origin: string;
      correlation_id?: string;
    };

function isNormalizedOutputItem(value: unknown): value is NormalizedOutputItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.type !== "string") {
    return false;
  }

  switch (item.type) {
    case "message":
    case "reasoning":
      return typeof item.content === "string" && typeof item.origin === "string";
    case "function_call":
      return (
        typeof item.name === "string" &&
        typeof item.arguments === "string" &&
        typeof item.call_id === "string" &&
        typeof item.origin === "string"
      );
    case "function_call_output":
      return (
        typeof item.call_id === "string" &&
        typeof item.output === "string" &&
        typeof item.success === "boolean" &&
        typeof item.origin === "string"
      );
    case "cancelled":
      return typeof item.origin === "string";
    case "script_execution":
      return typeof item.code === "string" && typeof item.origin === "string";
    case "script_execution_output":
      return (
        typeof item.script_id === "string" &&
        typeof item.result === "string" &&
        typeof item.success === "boolean" &&
        typeof item.origin === "string"
      );
    case "error":
      return (
        typeof item.code === "string" &&
        typeof item.message === "string" &&
        typeof item.origin === "string"
      );
    default:
      return false;
  }
}

export const add = mutation({
  args: {
    conversationId: v.string(),
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

    await ctx.db.insert("legacyMessages", {
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

    await ctx.db.patch(thread._id, { updatedAt: Date.now() });
  },
});

export const list = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("legacyMessages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();
  },
});

export const listMessageIds = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("messages").collect();
    return docs.map((doc) => doc._id);
  },
});

export const persist = mutation({
  args: {
    runId: v.string(),
    turnId: v.string(),
    threadId: v.string(),
    agentId: v.optional(v.string()),
    modelId: v.string(),
    providerId: v.string(),
    status: statusValue,
    createdAt: v.number(),
    updatedAt: v.number(),
    outputItems: v.array(outputItemValue),
    usage: v.optional(usageValue),
    finishReason: v.optional(v.string()),
    error: v.optional(errorValue),
  },
  handler: async (ctx, args) => {
    const {
      runId,
      turnId,
      threadId,
      agentId,
      modelId,
      providerId,
      status,
      createdAt,
      updatedAt,
      outputItems,
      usage,
      finishReason,
      error,
    } = args;

    if (!turnId) {
      throw new Error("persist requires turnId");
    }
    if (!status) {
      throw new Error("persist requires status");
    }

    const existing = await ctx.db
      .query("messages")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .unique();

    if (!existing) {
      await ctx.db.insert("messages", {
        runId,
        turnId,
        threadId,
        agentId,
        modelId,
        providerId,
        status,
        createdAt,
        updatedAt,
        outputItems,
        usage,
        finishReason,
        error,
      });
      return;
    }

    await ctx.db.patch(existing._id, {
      turnId,
      threadId,
      agentId,
      modelId,
      providerId,
      status,
      updatedAt,
      outputItems,
      usage,
      finishReason,
      error,
    });
  },
});

export const getByRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("messages")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();
  },
});

export const listByThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();

    return docs.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const deleteByRunId = mutation({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const deleteByThreadId = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
  },
});

export const backfillMessage = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) {
      return { status: "missing" as const };
    }

    const createdAt =
      typeof doc.createdAt === "number" ? doc.createdAt : Date.now();
    const updatedAt =
      typeof doc.updatedAt === "number" ? doc.updatedAt : createdAt;
    const runId =
      typeof doc.runId === "string"
        ? doc.runId
        : typeof doc.turnId === "string"
          ? doc.turnId
          : `legacy-run-${args.id}`;
    const turnId =
      typeof doc.turnId === "string" ? doc.turnId : `legacy-turn-${args.id}`;
    const threadId =
      typeof doc.threadId === "string"
        ? doc.threadId
        : `legacy-thread-${args.id}`;

    const docRecord = doc as Record<string, unknown>;

    const legacyContent =
      typeof docRecord.content === "string" ? docRecord.content : "";

    const legacyRoleValue =
      typeof docRecord.role === "string" ? docRecord.role : undefined;

    const legacyRole: "user" | "assistant" | "system" =
      legacyRoleValue === "user"
        ? "user"
        : legacyRoleValue === "system"
          ? "system"
          : "assistant";

    const origin: "user" | "agent" | "system" =
      legacyRole === "user"
        ? "user"
        : legacyRole === "system"
          ? "system"
          : "agent";

    const rawOutputItems = Array.isArray(
      (doc as Record<string, unknown>).outputItems,
    )
      ? ((doc as { outputItems: unknown[] }).outputItems as unknown[])
      : [];

    const normalizedOutputItems: NormalizedOutputItem[] =
      rawOutputItems.filter(isNormalizedOutputItem);

    if (normalizedOutputItems.length === 0) {
      normalizedOutputItems.push({
        id: `${turnId}-legacy`,
        type: "message",
        content: legacyContent,
        origin,
      });
    }

    await ctx.db.replace(args.id, {
      runId,
      turnId,
      threadId,
      agentId:
        typeof doc.agentId === "string" ? doc.agentId : undefined,
      modelId:
        typeof doc.modelId === "string" ? doc.modelId : "legacy-model",
      providerId:
        typeof doc.providerId === "string" ? doc.providerId : "legacy",
      status:
        doc.status === "queued" ||
        doc.status === "in_progress" ||
        doc.status === "complete" ||
        doc.status === "error" ||
        doc.status === "aborted"
          ? doc.status
          : "complete",
      createdAt,
      updatedAt,
      outputItems: normalizedOutputItems,
      usage:
        doc.usage &&
        typeof doc.usage === "object" &&
        doc.usage !== null &&
        typeof (doc.usage as Record<string, unknown>).promptTokens === "number" &&
        typeof (doc.usage as Record<string, unknown>).completionTokens ===
          "number" &&
        typeof (doc.usage as Record<string, unknown>).totalTokens === "number"
          ? (doc.usage as {
              promptTokens: number;
              completionTokens: number;
              totalTokens: number;
            })
          : undefined,
      finishReason:
        typeof doc.finishReason === "string" ? doc.finishReason : undefined,
      error:
        doc.error && typeof doc.error === "object"
          ? (doc.error as {
              code: string;
              message: string;
              details?: unknown;
            })
          : undefined,
    });

    return { status: "updated" as const };
  },
});

export const purgeById = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
