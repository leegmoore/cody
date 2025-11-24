import { randomUUID } from "node:crypto";
import type { Doc } from "../../../convex/_generated/dataModel.js";
import { convexClient } from "./convex-client.js";
import { api } from "../../../convex/_generated/api.js";
import {
  ThreadCreateBody,
  ThreadListQuery,
  ThreadSummary,
  ThreadUpdateBody,
} from "../schemas/thread.js";
import { ResponseSchema, type Response } from "../../core/schema.js";

type ThreadDoc = Doc<"threads">;
type RunDoc = Doc<"messages">;

const DEFAULT_PROVIDER_ID = process.env.CORE2_PROVIDER_ID?.trim() ?? "openai";
const DEFAULT_PROVIDER_API =
  process.env.CORE2_PROVIDER_API?.trim() ?? "responses";
const DEFAULT_MODEL = process.env.CORE2_MODEL?.trim() ?? "gpt-5-mini";

function mapThread(doc: ThreadDoc): ThreadSummary {
  return {
    threadId: doc.externalId,
    title: doc.title ?? null,
    summary: doc.summary ?? null,
    tags: doc.tags ?? [],
    agentRole: doc.agentRole ?? null,
    modelProviderId: doc.modelProviderId ?? null,
    modelProviderApi: doc.modelProviderApi ?? null,
    model: doc.model ?? null,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

function normalizeModelConfig(body: Partial<ThreadCreateBody>) {
  return {
    modelProviderId: body.modelProviderId ?? DEFAULT_PROVIDER_ID,
    modelProviderApi: body.modelProviderApi ?? DEFAULT_PROVIDER_API,
    model: body.model ?? DEFAULT_MODEL,
  };
}

function mapRun(doc: RunDoc): Response {
  return ResponseSchema.parse({
    id: doc.runId,
    turn_id: doc.turnId,
    thread_id: doc.threadId,
    agent_id: doc.agentId ?? undefined,
    model_id: doc.modelId,
    provider_id: doc.providerId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
    status: doc.status,
    output_items: doc.outputItems,
    usage: doc.usage
      ? {
          prompt_tokens: doc.usage.promptTokens,
          completion_tokens: doc.usage.completionTokens,
          total_tokens: doc.usage.totalTokens,
        }
      : undefined,
    finish_reason: doc.finishReason ?? null,
    error: doc.error ?? null,
  });
}

export async function createThread(
  body: ThreadCreateBody,
  options: { externalId?: string } = {},
): Promise<ThreadSummary> {
  const externalId = options.externalId ?? randomUUID();
  const config = normalizeModelConfig(body);
  await convexClient.mutation(api.threads.create, {
    externalId,
    title: body.title,
    summary: body.summary,
    tags: body.tags ?? [],
    agentRole: body.agentRole,
    modelProviderId: config.modelProviderId,
    modelProviderApi: config.modelProviderApi,
    model: config.model,
  });

  const thread = await convexClient.query(api.threads.get, {
    externalId,
  });

  if (!thread) {
    throw new Error("Thread creation failed");
  }

  return mapThread(thread);
}

export async function ensureThreadExists(
  externalId: string,
  overrides: Partial<ThreadCreateBody> = {},
): Promise<void> {
  const existing = await convexClient.query(api.threads.get, {
    externalId,
  });
  if (existing) return;

  const config = normalizeModelConfig(overrides);
  await convexClient.mutation(api.threads.create, {
    externalId,
    title: overrides.title,
    summary: overrides.summary,
    tags: overrides.tags ?? [],
    agentRole: overrides.agentRole,
    modelProviderId: config.modelProviderId,
    modelProviderApi: config.modelProviderApi,
    model: config.model,
  });
}

export async function listThreads(query: ThreadListQuery) {
  const requestedLimit =
    typeof query.limit === "string"
      ? Number.parseInt(query.limit, 10)
      : query.limit;
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit ? requestedLimit : 50;

  const result = await convexClient.query(api.threads.list, {
    paginationOpts: {
      numItems: limit,
      cursor: query.cursor ?? null,
    },
  });

  return {
    threads: result.page.map(mapThread),
    nextCursor: result.isDone ? null : result.continueCursor,
  };
}

export async function getThreadSummary(
  threadId: string,
): Promise<ThreadSummary | null> {
  const doc = await convexClient.query(api.threads.get, {
    externalId: threadId,
  });
  return doc ? mapThread(doc) : null;
}

export async function getThreadWithRuns(threadId: string) {
  const doc = await convexClient.query(api.threads.get, {
    externalId: threadId,
  });
  if (!doc) {
    return null;
  }

  const runDocs = await convexClient.query(api.messages.listByThread, {
    threadId,
  });

  return {
    thread: mapThread(doc),
    runs: runDocs.map(mapRun),
  };
}

export async function updateThread(
  threadId: string,
  updates: ThreadUpdateBody,
): Promise<ThreadSummary> {
  const doc = await convexClient.query(api.threads.get, {
    externalId: threadId,
  });
  if (!doc) {
    throw new Error(`Thread ${threadId} not found`);
  }

  await convexClient.mutation(api.threads.update, {
    id: doc._id,
    title: updates.title,
    summary: updates.summary,
    tags: updates.tags,
    agentRole: updates.agentRole,
    model: updates.model,
    modelProviderId: updates.modelProviderId,
    modelProviderApi: updates.modelProviderApi,
  });

  const refreshed = await convexClient.query(api.threads.get, {
    externalId: threadId,
  });

  if (!refreshed) {
    throw new Error(`Thread ${threadId} disappeared after update`);
  }

  return mapThread(refreshed);
}

export async function deleteThread(threadId: string): Promise<boolean> {
  const deleted = await convexClient.mutation(api.threads.remove, {
    externalId: threadId,
  });

  if (deleted) {
    await convexClient.mutation(api.messages.deleteByThreadId, {
      threadId,
    });
  }

  return deleted;
}

export async function threadExists(threadId: string): Promise<boolean> {
  const exists = await convexClient.query(api.threads.get, {
    externalId: threadId,
  });
  return Boolean(exists);
}

export async function getRun(runId: string): Promise<Response | null> {
  const doc = await convexClient.query(api.messages.getByRunId, { runId });
  return doc ? mapRun(doc) : null;
}

export async function listRunsForThread(threadId: string): Promise<Response[]> {
  const docs = await convexClient.query(api.messages.listByThread, {
    threadId,
  });
  return docs.map(mapRun);
}
