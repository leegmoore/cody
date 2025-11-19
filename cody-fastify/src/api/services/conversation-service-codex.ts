/**
 * Conversation Service using Convex (migrated from FileRolloutStore)
 */

import type { CodexRuntime } from "./codex-runtime.js";
import type {
  CreateConversationBody,
  ConversationResponse,
  ListConversationsQuery,
  UpdateConversationBody,
} from "../schemas/conversation.js";
import { NotFoundError, ValidationError } from "../errors/api-errors.js";
import { convexClient } from "./convex-client.js";
import { api } from "../../../convex/_generated/api.js";

// Helper to map Convex message to API history format
function mapConvexMessageToHistory(msg: any): any {
  if (msg.type === "tool_call") {
    return {
      type: "tool_call",
      callId: msg.callId,
      toolName: msg.toolName,
      arguments: msg.toolArgs,
      status: msg.status || "in_progress",
      turnId: msg.turnId,
    };
  }
  if (msg.type === "tool_output") {
    return {
      type: "tool_output",
      callId: msg.callId,
      output: msg.toolOutput,
      status: "completed",
      turnId: msg.turnId,
    };
  }
  return {
    role: msg.role,
    content: msg.content,
    turnId: msg.turnId,
  };
}

/**
 * Create a new conversation.
 * MIGRATION NOTE: Creates both a legacy Codex file-based conversation AND a Convex thread.
 */
export async function createConversation(
  codexRuntime: CodexRuntime,
  body: CreateConversationBody,
): Promise<ConversationResponse> {
  // Validate provider/API combination
  const validation = validateProviderApi(
    body.modelProviderId,
    body.modelProviderApi,
  );
  if (!validation.valid) {
    throw new ValidationError(validation.error || "Invalid provider/API combination");
  }

  // 1. Create Legacy Conversation (File-based) - Required for CodexRuntime execution
  const result = await codexRuntime.createConversation({
    modelProviderId: body.modelProviderId,
    modelProviderApi: body.modelProviderApi,
    model: body.model,
    title: body.title,
    summary: body.summary,
    tags: body.tags,
    agentRole: body.agentRole,
    reasoningEffort: body.reasoningEffort as any,
  });

  // 2. Sync to Convex
  await convexClient.mutation(api.threads.create, {
    externalId: result.conversationId,
    modelProviderId: body.modelProviderId,
    modelProviderApi: body.modelProviderApi,
    model: body.model,
    title: body.title,
    summary: body.summary,
    tags: body.tags,
    agentRole: body.agentRole,
  });

  const now = new Date().toISOString();

  return {
    conversationId: result.conversationId,
    createdAt: now,
    updatedAt: now,
    modelProviderId: body.modelProviderId,
    modelProviderApi: body.modelProviderApi,
    model: body.model,
    title: body.title ?? null,
    summary: body.summary ?? null,
    parent: null,
    tags: body.tags ?? [],
    agentRole: body.agentRole ?? null,
    history: [],
  };
}

/**
 * List conversations from Convex.
 */
export async function listConversations(
  _codexRuntime: CodexRuntime,
  options?: ListConversationsQuery,
): Promise<{
  conversations: ConversationResponse[];
  nextCursor: string | null;
}> {
  const limit = typeof options?.limit === "string" ? parseInt(options.limit, 10) : options?.limit;
  
  const result = await convexClient.query(api.threads.list, {
    paginationOpts: {
      numItems: limit || 20,
      cursor: options?.cursor ?? null,
    }
  });

  // Fetch stats for each thread (inefficient N+1, but okay for local pod)
  const conversations = await Promise.all(
    result.page.map(async (thread) => {
      const messages = await convexClient.query(api.messages.list, {
        threadId: thread._id,
      });
      
      const firstUserMsg = messages.find(
        (m) => m.role === "user" && (!m.type || m.type === "message")
      );

      return {
        conversationId: thread.externalId,
        createdAt: new Date(thread.createdAt).toISOString(),
        updatedAt: new Date(thread.updatedAt).toISOString(),
        modelProviderId: thread.modelProviderId || "",
        modelProviderApi: thread.modelProviderApi || "",
        model: thread.model || "",
        title: thread.title ?? null,
        summary: thread.summary ?? null,
        parent: null,
        tags: thread.tags ?? [],
        agentRole: thread.agentRole ?? null,
        messageCount: messages.length,
        firstMessage: firstUserMsg?.content,
        history: [],
      };
    })
  );

  return {
    conversations,
    nextCursor: result.continueCursor === result.isDone ? null : result.continueCursor,
  };
}

/**
 * Get a single conversation by ID from Convex.
 */
export async function getConversation(
  _codexRuntime: CodexRuntime,
  conversationId: string,
): Promise<ConversationResponse | null> {
  const thread = await convexClient.query(api.threads.get, {
    externalId: conversationId,
  });

  if (!thread) {
    return null;
  }

  const messages = await convexClient.query(api.messages.list, {
    threadId: thread._id,
  });

  const history = messages.map(mapConvexMessageToHistory);

  return {
    conversationId: thread.externalId,
    createdAt: new Date(thread.createdAt).toISOString(),
    updatedAt: new Date(thread.updatedAt).toISOString(),
    modelProviderId: thread.modelProviderId || "",
    modelProviderApi: thread.modelProviderApi || "",
    model: thread.model || "",
    title: thread.title ?? null,
    summary: thread.summary ?? null,
    parent: null,
    tags: thread.tags ?? [],
    agentRole: thread.agentRole ?? null,
    history,
  };
}

/**
 * Update conversation metadata in Convex.
 */
export async function updateConversation(
  _codexRuntime: CodexRuntime,
  conversationId: string,
  updates: UpdateConversationBody,
): Promise<ConversationResponse> {
  const thread = await convexClient.query(api.threads.get, {
    externalId: conversationId,
  });

  if (!thread) {
    throw new NotFoundError(`Conversation ${conversationId} not found`);
  }

  // Validate provider/API combination if updating model config
  if (
    updates.modelProviderId ||
    updates.modelProviderApi ||
    updates.model
  ) {
    const providerId = updates.modelProviderId ?? thread.modelProviderId ?? "";
    const api = updates.modelProviderApi ?? thread.modelProviderApi ?? "";

    const validation = validateProviderApi(providerId, api);
    if (!validation.valid) {
      throw new ValidationError(validation.error || "Invalid provider/API combination");
    }
  }

  await convexClient.mutation(api.threads.update, {
    id: thread._id,
    title: updates.title,
    model: updates.model,
    summary: updates.summary,
    tags: updates.tags,
    agentRole: updates.agentRole,
    modelProviderId: updates.modelProviderId,
    modelProviderApi: updates.modelProviderApi,
  });

  return (await getConversation(_codexRuntime, conversationId))!;
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(
  codexRuntime: CodexRuntime,
  conversationId: string,
): Promise<boolean> {
  // Delete from Convex
  const deleted = await convexClient.mutation(api.threads.remove, {
    externalId: conversationId
  });
  
  // Delete from Legacy File Store (for cleanup)
  if (deleted) {
    await codexRuntime.removeConversation(conversationId);
  }
  
  return deleted;
}

/**
 * Get minimal metadata for a conversation.
 */
export async function getConversationMetadataSummary(
  _codexRuntime: CodexRuntime,
  conversationId: string,
): Promise<{
  modelProviderId: string;
  modelProviderApi: string;
  model: string;
} | null> {
  const thread = await convexClient.query(api.threads.get, {
    externalId: conversationId,
  });

  if (!thread) {
    return null;
  }

  return {
    modelProviderId: thread.modelProviderId || "",
    modelProviderApi: thread.modelProviderApi || "",
    model: thread.model || "",
  };
}

/**
 * Valid provider/API combinations
 */
const VALID_COMBINATIONS: Record<string, string[]> = {
  openai: ["responses", "chat"],
  anthropic: ["messages"],
  openrouter: ["chat"],
};

/**
 * Validate provider/API combination
 */
export function validateProviderApi(
  providerId: string,
  api: string,
): { valid: boolean; error?: string } {
  const supportedApis = VALID_COMBINATIONS[providerId];
  if (!supportedApis) {
    return {
      valid: false,
      error: `Unsupported provider: ${providerId}. Supported providers: ${Object.keys(VALID_COMBINATIONS).join(", ")}`,
    };
  }

  if (!supportedApis.includes(api)) {
    return {
      valid: false,
      error: `Provider ${providerId} does not support API ${api}. Supported APIs: ${supportedApis.join(", ")}`,
    };
  }

  return { valid: true };
}
