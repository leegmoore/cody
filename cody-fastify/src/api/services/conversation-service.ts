import { readFile, writeFile, unlink, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type {
  CreateConversationBody,
  ConversationResponse,
} from "../schemas/conversation.js";

const CODY_HOME = process.env.CODY_HOME || join(homedir(), ".cody");
const CONVERSATIONS_DIR = join(CODY_HOME, "conversations");

interface SessionMeta {
  id: string;
  timestamp: string;
  cwd: string;
  cliVersion: string;
  source: string;
  modelProvider?: string;
  modelProviderApi?: string;
  model?: string;
  title?: string;
  summary?: string;
  tags?: string[];
  agentRole?: string;
  parent?: string;
}

interface ConversationFileLine {
  timestamp: string;
  item: {
    type: "session_meta" | "event";
    data: SessionMeta | unknown;
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

/**
 * Generate a new conversation ID (UUID v4)
 */
function generateConversationId(): string {
  return randomUUID();
}

/**
 * Read conversation file and parse metadata
 */
async function readConversationFile(
  conversationId: string,
): Promise<SessionMeta | null> {
  const filePath = join(CONVERSATIONS_DIR, `${conversationId}.jsonl`);

  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");
    if (lines.length === 0) {
      return null;
    }

    const firstLine = JSON.parse(lines[0]) as ConversationFileLine;
    if (firstLine.item.type === "session_meta") {
      return firstLine.item.data as SessionMeta;
    }

    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Write conversation file with metadata
 */
async function writeConversationFile(
  conversationId: string,
  meta: SessionMeta,
): Promise<void> {
  const filePath = join(CONVERSATIONS_DIR, `${conversationId}.jsonl`);

  // Ensure directory exists (idempotent - safe to call multiple times)
  try {
    await mkdir(CONVERSATIONS_DIR, { recursive: true });
  } catch (mkdirError) {
    // If directory already exists, that's fine - continue
    const mkdirErr = mkdirError as NodeJS.ErrnoException;
    if (mkdirErr.code !== "EEXIST") {
      throw new Error(
        `Failed to create conversations directory at ${CONVERSATIONS_DIR}: ${mkdirErr.message}`,
      );
    }
  }

  const line: ConversationFileLine = {
    timestamp: meta.timestamp,
    item: {
      type: "session_meta",
      data: meta,
    },
  };

  try {
    await writeFile(filePath, JSON.stringify(line) + "\n", "utf-8");
  } catch (writeError) {
    const writeErr = writeError as Error;
    throw new Error(
      `Failed to write conversation file at ${filePath}: ${writeErr.message}`,
    );
  }
}

/**
 * List all conversation files
 */
async function listConversationFiles(): Promise<string[]> {
  try {
    const files = await readdir(CONVERSATIONS_DIR);
    return files
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => f.replace(".jsonl", ""));
  } catch {
    return [];
  }
}

/**
 * Create a new conversation
 */
export async function createConversation(
  body: CreateConversationBody,
): Promise<ConversationResponse> {
  try {
    // Validate provider/API combination
    const validation = validateProviderApi(
      body.modelProviderId,
      body.modelProviderApi,
    );
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const conversationId = generateConversationId();
    const now = new Date().toISOString();

    const meta: SessionMeta = {
      id: conversationId,
      timestamp: now,
      cwd: process.cwd(),
      cliVersion: "0.1.0",
      source: "api",
      modelProvider: body.modelProviderId,
      modelProviderApi: body.modelProviderApi,
      model: body.model,
      title: body.title,
      summary: body.summary,
      tags: body.tags,
      agentRole: body.agentRole,
    };

    await writeConversationFile(conversationId, meta);

    return {
      conversationId,
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
    };
  } catch (error) {
    // Re-throw validation errors as-is
    if (error instanceof Error) {
      if (error.message.includes("does not support")) {
        throw error;
      }
      if (error.message.includes("Unsupported provider")) {
        throw error;
      }
      // Re-throw the error as-is if it's already an Error
      throw error;
    }
    // Wrap non-Error values
    throw new Error(`Failed to create conversation: ${String(error)}`);
  }
}

/**
 * List conversations with pagination
 */
export async function listConversations(options?: {
  cursor?: string;
  limit?: number;
}): Promise<{
  conversations: ConversationResponse[];
  nextCursor: string | null;
}> {
  const conversationIds = await listConversationFiles();

  // Read all conversations
  const conversations: ConversationResponse[] = [];
  for (const id of conversationIds) {
    const meta = await readConversationFile(id);
    if (meta) {
      conversations.push({
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
      });
    }
  }

  // Sort by createdAt descending
  conversations.sort((a, b) => {
    return (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  // Apply cursor pagination
  let startIndex = 0;
  if (options?.cursor) {
    // Cursor format: timestamp|id (using | instead of : to avoid conflicts with ISO timestamps)
    const parts = options.cursor.split("|");
    if (parts.length === 2) {
      const [timestamp, id] = parts;
      const cursorIndex = conversations.findIndex(
        (c) =>
          c.conversationId === id &&
          new Date(c.updatedAt).getTime().toString() === timestamp,
      );
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }
  }

  // Apply limit (default 20, max 100, min 1)
  const limit = Math.min(
    Math.max(options?.limit ?? 20, 1),
    100,
  );

  const page = conversations.slice(startIndex, startIndex + limit);
  const nextCursor =
    startIndex + limit < conversations.length
      ? `${new Date(page[page.length - 1].updatedAt).getTime()}|${page[page.length - 1].conversationId}`
      : null;

  return {
    conversations: page,
    nextCursor,
  };
}

/**
 * Get a single conversation
 */
export async function getConversation(
  conversationId: string,
): Promise<ConversationResponse | null> {
  const meta = await readConversationFile(conversationId);
  if (!meta) {
    return null;
  }

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
  };
}

/**
 * Update conversation metadata
 */
export async function updateConversation(
  conversationId: string,
  updates: Partial<CreateConversationBody>,
): Promise<ConversationResponse> {
  const meta = await readConversationFile(conversationId);
  if (!meta) {
    throw new Error("Conversation not found");
  }

  // Validate provider/API combination if updating model config
  if (
    updates.modelProviderId ||
    updates.modelProviderApi ||
    updates.model
  ) {
    const providerId =
      updates.modelProviderId ?? meta.modelProvider ?? "";
    const api = updates.modelProviderApi ?? meta.modelProviderApi ?? "";

    const validation = validateProviderApi(providerId, api);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }

  // Update metadata
  const updatedMeta: SessionMeta = {
    ...meta,
    modelProvider: updates.modelProviderId ?? meta.modelProvider,
    modelProviderApi: updates.modelProviderApi ?? meta.modelProviderApi,
    model: updates.model ?? meta.model,
    title: updates.title !== undefined ? updates.title : meta.title,
    summary: updates.summary !== undefined ? updates.summary : meta.summary,
    tags: updates.tags !== undefined ? updates.tags : meta.tags,
    agentRole:
      updates.agentRole !== undefined ? updates.agentRole : meta.agentRole,
    timestamp: meta.timestamp, // Keep original timestamp
  };

  const now = new Date().toISOString();
  await writeConversationFile(conversationId, updatedMeta);

  return {
    conversationId: updatedMeta.id,
    createdAt: updatedMeta.timestamp,
    updatedAt: now,
    modelProviderId: updatedMeta.modelProvider || "",
    modelProviderApi: updatedMeta.modelProviderApi || "",
    model: updatedMeta.model || "",
    title: updatedMeta.title ?? null,
    summary: updatedMeta.summary ?? null,
    parent: updatedMeta.parent ?? null,
    tags: updatedMeta.tags ?? [],
    agentRole: updatedMeta.agentRole ?? null,
  };
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
  conversationId: string,
): Promise<boolean> {
  const filePath = join(CONVERSATIONS_DIR, `${conversationId}.jsonl`);

  try {
    await unlink(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

