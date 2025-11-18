/**
 * Conversation Service using Codex
 * 
 * Provides conversation CRUD operations using CodexRuntime and RolloutStore.
 */

import type { CodexRuntime } from "./codex-runtime.js";
import type {
  CreateConversationBody,
  ConversationResponse,
  ListConversationsQuery,
  UpdateConversationBody,
} from "../schemas/conversation.js";
import {
  FileRolloutStore,
  RolloutRecorder,
  type SessionMeta,
} from "codex-ts/src/core/rollout.ts";
import type { ResponseItem } from "codex-ts/src/protocol/models.ts";
import { NotFoundError, ValidationError } from "../errors/api-errors.js";

/**
 * Convert ResponseItem[] to history array format expected by API.
 */
function responseItemsToHistory(items: ResponseItem[]): Array<{
  role: string;
  content: string;
}> {
  const history: Array<{ role: string; content: string }> = [];

  for (const item of items) {
    if (item.type === "message") {
      // Extract text content from content array
      const textParts: string[] = [];
      for (const contentItem of item.content) {
        if (contentItem.type === "input_text" || contentItem.type === "output_text") {
          textParts.push(contentItem.text);
        }
      }
      if (textParts.length > 0) {
        history.push({
          role: item.role,
          content: textParts.join("\n"),
        });
      }
    }
  }

  return history;
}

type ExtendedSessionMeta = SessionMeta & {
  title?: string;
  summary?: string;
  tags?: string[];
  agentRole?: string;
  parent?: string;
};

/**
 * Create a new conversation using Codex.
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

  const result = await codexRuntime.createConversation({
    modelProviderId: body.modelProviderId,
    modelProviderApi: body.modelProviderApi,
    model: body.model,
    title: body.title,
    summary: body.summary,
    tags: body.tags,
    agentRole: body.agentRole,
  });

  // Update rollout file with extended metadata if provided
  if (body.title || body.summary || body.tags || body.agentRole) {
    const rolloutStore = new FileRolloutStore();
    const codexHome = codexRuntime.getConfig().codexHome;
    const path = await rolloutStore.findConversationPathById(
      codexHome,
      result.conversationId,
    );

    if (path) {
      // Read existing rollout
      const lines = await RolloutRecorder.readRolloutHistory(path);
      
      // Find and update session_meta line
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].item.type === "session_meta") {
          const meta = lines[i].item.data as ExtendedSessionMeta;
          if (body.title !== undefined) meta.title = body.title;
          if (body.summary !== undefined) meta.summary = body.summary;
          if (body.tags !== undefined) meta.tags = body.tags;
          if (body.agentRole !== undefined) meta.agentRole = body.agentRole;
          
          // Rewrite the file with updated metadata
          const { writeFile } = await import("node:fs/promises");
          const updatedLines = lines.map((line, idx) => {
            if (idx === i) {
              return JSON.stringify({
                timestamp: line.timestamp,
                item: { type: "session_meta", data: meta },
              });
            }
            return JSON.stringify(line);
          });
          await writeFile(path, updatedLines.join("\n") + "\n", "utf-8");
          break;
        }
      }
    }
  }

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
    history: [], // Empty for new conversation
  };
}

/**
 * List conversations with pagination.
 */
export async function listConversations(
  codexRuntime: CodexRuntime,
  options?: ListConversationsQuery,
): Promise<{
  conversations: ConversationResponse[];
  nextCursor: string | null;
}> {
  const limit =
    typeof options?.limit === "string"
      ? parseInt(options.limit, 10)
      : options?.limit;

  const result = await codexRuntime.listConversations({
    cursor: options?.cursor,
    limit,
  });

  // Convert ConversationMetadata[] to ConversationResponse[]
  const conversations: ConversationResponse[] = await Promise.all(
    result.conversations.map(async (meta) => {
      // Try to load full conversation to get metadata
      const rolloutStore = new FileRolloutStore();
      const codexHome = codexRuntime.getConfig().codexHome;
      const path = await rolloutStore.findConversationPathById(
        codexHome,
        meta.id,
      );

      let sessionMeta: ExtendedSessionMeta | undefined;

      if (path) {
        const rollout = await rolloutStore.readConversation(path);
        if (rollout.meta) {
          sessionMeta = rollout.meta as ExtendedSessionMeta;
        }
      }

      return {
        conversationId: meta.id,
        createdAt:
          sessionMeta?.timestamp || new Date(meta.updatedAt).toISOString(),
        updatedAt: new Date(meta.updatedAt).toISOString(),
        modelProviderId: sessionMeta?.modelProvider || meta.provider || "",
        modelProviderApi: sessionMeta?.modelProviderApi || "",
        model: sessionMeta?.model || meta.model || "",
        title: sessionMeta?.title ?? null,
        summary: sessionMeta?.summary ?? null,
        parent: null,
        tags: sessionMeta?.tags ?? [],
        agentRole: sessionMeta?.agentRole ?? null,
        history: [], // History loaded separately in getConversation
      };
    }),
  );

  return {
    conversations,
    nextCursor: result.nextCursor,
  };
}

/**
 * Get a single conversation by ID.
 */
export async function getConversation(
  codexRuntime: CodexRuntime,
  conversationId: string,
): Promise<ConversationResponse | null> {
  const rolloutStore = new FileRolloutStore();
  const codexHome = codexRuntime.getConfig().codexHome;
  const path = await rolloutStore.findConversationPathById(
    codexHome,
    conversationId,
  );

  if (!path) {
    return null;
  }

  const rollout = await rolloutStore.readConversation(path);
  const meta = rollout.meta as ExtendedSessionMeta | undefined;

  if (!meta) {
    return null;
  }

  // Build history from turns
  const historyItems: ResponseItem[] = [];
  for (const turn of rollout.turns) {
    historyItems.push(...turn.items);
  }
  const history = responseItemsToHistory(historyItems);

  return {
    conversationId: meta.id,
    createdAt: meta.timestamp,
    updatedAt: meta.timestamp, // TODO: Track updatedAt separately
    modelProviderId: meta.modelProvider || "",
    modelProviderApi: meta.modelProviderApi || "",
    model: meta.model || "",
    title: meta.title ?? null,
    summary: meta.summary ?? null,
    parent: meta.parent ?? null,
    tags: meta.tags ?? [],
    agentRole: meta.agentRole ?? null,
    history,
  };
}

/**
 * Update conversation metadata.
 */
export async function updateConversation(
  codexRuntime: CodexRuntime,
  conversationId: string,
  updates: UpdateConversationBody,
): Promise<ConversationResponse> {
  const rolloutStore = new FileRolloutStore();
  const codexHome = codexRuntime.getConfig().codexHome;
  const path = await rolloutStore.findConversationPathById(
    codexHome,
    conversationId,
  );

  if (!path) {
    throw new NotFoundError(`Conversation ${conversationId} not found`);
  }

  const rollout = await rolloutStore.readConversation(path);
  const meta = rollout.meta;

  if (!meta) {
    throw new NotFoundError(`Conversation ${conversationId} not found`);
  }

  // Validate provider/API combination if updating model config
  if (
    updates.modelProviderId ||
    updates.modelProviderApi ||
    updates.model
  ) {
    const providerId = updates.modelProviderId ?? meta.modelProvider ?? "";
    const api = updates.modelProviderApi ?? meta.modelProviderApi ?? "";

    const validation = validateProviderApi(providerId, api);
    if (!validation.valid) {
      throw new ValidationError(validation.error || "Invalid provider/API combination");
    }
  }

  // Update metadata in rollout file
  const lines = await RolloutRecorder.readRolloutHistory(path);
  let updatedMeta: ExtendedSessionMeta = { ...meta };
  
  // Find and update session_meta line
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].item.type === "session_meta") {
      const metaData = lines[i].item.data as ExtendedSessionMeta;
      updatedMeta = {
        ...meta,
        modelProvider: updates.modelProviderId ?? meta.modelProvider,
        modelProviderApi: updates.modelProviderApi ?? meta.modelProviderApi,
        model: updates.model ?? meta.model,
        title: updates.title !== undefined ? updates.title : metaData.title,
        summary: updates.summary !== undefined ? updates.summary : metaData.summary,
        tags: updates.tags !== undefined ? updates.tags : metaData.tags,
        agentRole: updates.agentRole !== undefined ? updates.agentRole : metaData.agentRole,
      };
      
      // Write updated metadata back to file
      const { writeFile } = await import("node:fs/promises");
      const updatedLines = lines.map((line, idx) => {
        if (idx === i) {
          return JSON.stringify({
            timestamp: line.timestamp,
            item: { type: "session_meta", data: updatedMeta },
          });
        }
        return JSON.stringify(line);
      });
      await writeFile(path, updatedLines.join("\n") + "\n", "utf-8");
      break;
    }
  }

  // Re-read rollout to get updated data
  const updatedRollout = await rolloutStore.readConversation(path);
  
  // Build history
  const historyItems: ResponseItem[] = [];
  for (const turn of updatedRollout.turns) {
    historyItems.push(...turn.items);
  }
  const history = responseItemsToHistory(historyItems);

  const now = new Date().toISOString();

  return {
    conversationId: updatedMeta.id,
    createdAt: updatedMeta.timestamp,
    updatedAt: now,
    modelProviderId: updatedMeta.modelProvider || "",
    modelProviderApi: updatedMeta.modelProviderApi || "",
    model: updatedMeta.model || "",
    title: updatedMeta.title ?? null,
    summary: updatedMeta.summary ?? null,
    parent: null,
    tags: updatedMeta.tags ?? [],
    agentRole: updatedMeta.agentRole ?? null,
    history,
  };
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(
  codexRuntime: CodexRuntime,
  conversationId: string,
): Promise<boolean> {
  // Attempt to remove via manager; if this fails (invalid ID, etc.), fall back to file deletion
  let removedByManager = false;
  try {
    removedByManager = await codexRuntime.removeConversation(conversationId);
  } catch {
    removedByManager = false;
  }

  // Always attempt to delete the rollout file if present to ensure it is removed from listings
  const rolloutStore = new FileRolloutStore();
  const codexHome = codexRuntime.getConfig().codexHome;
  const path = await rolloutStore.findConversationPathById(
    codexHome,
    conversationId,
  );

  let removedByFile = false;
  if (path) {
    const { unlink } = await import("node:fs/promises");
    try {
      await unlink(path);
      removedByFile = true;
    } catch {
      removedByFile = false;
    }
  }

  return removedByManager || removedByFile;
}

/**
 * Get minimal metadata for a conversation (provider/model info).
 */
export async function getConversationMetadataSummary(
  codexRuntime: CodexRuntime,
  conversationId: string,
): Promise<{
  modelProviderId: string;
  modelProviderApi: string;
  model: string;
} | null> {
  const rolloutStore = new FileRolloutStore();
  const codexHome = codexRuntime.getConfig().codexHome;
  const path = await rolloutStore.findConversationPathById(
    codexHome,
    conversationId,
  );

  if (!path) {
    return null;
  }

  const rollout = await rolloutStore.readConversation(path);
  const meta = rollout.meta;
  if (!meta) {
    return null;
  }

  return {
    modelProviderId: meta.modelProvider || "",
    modelProviderApi: meta.modelProviderApi || "",
    model: meta.model || "",
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

