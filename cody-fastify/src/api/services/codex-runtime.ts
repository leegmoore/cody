/**
 * Codex Runtime Service
 * 
 * Provides a shared Codex runtime for the Fastify API, managing conversations
 * and coordinating with codex-ts.
 */

import { ConversationManager } from "codex-ts/src/core/conversation-manager.ts";
import { AuthManager } from "codex-ts/src/core/auth/index.ts";
import { createDefaultConfig, type Config } from "codex-ts/src/core/config.ts";
import { SessionSource } from "codex-ts/src/core/rollout.ts";
import { ConversationId } from "codex-ts/src/protocol/conversation-id/index.ts";
import type { Conversation } from "codex-ts/src/core/conversation.ts";
import type { ConversationMetadata } from "codex-ts/src/core/conversation-manager.ts";
import type { ModelProviderApi } from "codex-ts/src/core/model-provider-types.ts";
import type { ReasoningEffort } from "codex-ts/src/protocol/config-types.ts";

export interface CreateConversationOptions {
  modelProviderId: string;
  modelProviderApi: string;
  model: string;
  title?: string;
  summary?: string;
  tags?: string[];
  agentRole?: string;
  reasoningEffort?: ReasoningEffort;
}

export interface CodexRuntimeOptions {
  codexHome: string;
  cwd: string;
}

/**
 * Codex runtime service that manages conversations using codex-ts.
 */
export class CodexRuntime {
  private readonly manager: ConversationManager;
  private readonly config: Config;
  private readonly codexHome: string;
  private readonly authManager: AuthManager;
  private readonly conversations: Map<string, Conversation> = new Map();

  constructor(options: CodexRuntimeOptions) {
    this.codexHome = options.codexHome;
    this.config = createDefaultConfig(options.codexHome, options.cwd);
    
    // Initialize auth manager
    this.authManager = new AuthManager(this.config);
    
    // Create conversation manager
    this.manager = new ConversationManager(
      this.authManager,
      SessionSource.API,
    );
  }

  /**
   * Create a new conversation with the given options.
   */
  async createConversation(
    options: CreateConversationOptions,
  ): Promise<{ conversationId: string; conversation: Conversation }> {
    await this.configureAuthForProvider(options.modelProviderId);

    // Build config overrides
    const config: Config = {
      ...this.config,
      auth: this.cloneAuthConfig(this.config),
      modelProviderId: options.modelProviderId,
      modelProviderApi: options.modelProviderApi as ModelProviderApi,
      model: options.model,
      modelReasoningEffort: options.reasoningEffort,
    };

    // Create conversation via Codex
    const result = await this.manager.newConversation(config);
    const conversationId = result.conversationId.toString();

    // Store conversation
    this.conversations.set(conversationId, result.conversation);

    return {
      conversationId,
      conversation: result.conversation,
    };
  }

  /**
   * Get an existing conversation by ID.
   */
  async getConversation(
    conversationId: string,
  ): Promise<Conversation | undefined> {
    // Check in-memory cache first
    const cached = this.conversations.get(conversationId);
    if (cached) {
      return cached;
    }

    // Try to load from manager
    const id = ConversationId.fromString(conversationId);
    let conversation = await this.manager.getConversation(id);

    // If not in memory, try to resume from disk
    if (!conversation) {
      try {
        const result = await this.manager.resumeConversation(
          this.config,
          conversationId,
        );
        conversation = result.conversation;
      } catch {
        // If resume fails (e.g. not found on disk), return undefined
        return undefined;
      }
    }

    if (conversation) {
      this.conversations.set(conversationId, conversation);
      return conversation;
    }

    return undefined;
  }

  /**
   * List conversations with pagination.
   */
  async listConversations(options?: {
    cursor?: string;
    limit?: number;
  }): Promise<{
    conversations: ConversationMetadata[];
    nextCursor: string | null;
  }> {
    const metadata = await this.manager.listConversations(this.config);

    // Apply cursor pagination
    let startIndex = 0;
    if (options?.cursor) {
      // Cursor format: timestamp:id
      const parts = options.cursor.split(":");
      if (parts.length === 2) {
        const [timestamp, id] = parts;
        const cursorIndex = metadata.findIndex(
          (m) => m.id === id && m.updatedAt.toString() === timestamp,
        );
        if (cursorIndex >= 0) {
          startIndex = cursorIndex + 1;
        }
      }
    }

    // Apply limit (default 20, max 100, min 1)
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);

    const page = metadata.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < metadata.length
        ? `${page[page.length - 1].updatedAt}:${page[page.length - 1].id}`
        : null;

    return {
      conversations: page,
      nextCursor,
    };
  }

  /**
   * Remove a conversation from the manager.
   */
  async removeConversation(conversationId: string): Promise<boolean> {
    const id = ConversationId.fromString(conversationId);
    const removed = await this.manager.removeConversation(id);
    this.conversations.delete(conversationId);
    return removed !== null;
  }

  /**
   * Get the underlying config.
   */
  getConfig(): Config {
    return this.config;
  }

  private cloneAuthConfig(config: Config): Config["auth"] {
    return {
      method: config.auth?.method ?? "openai-api-key",
      openaiApiKey: config.auth?.openaiApiKey,
      anthropicApiKey: config.auth?.anthropicApiKey,
    };
  }

  private async configureAuthForProvider(providerId: string): Promise<void> {
    if (!this.config.auth) {
      this.config.auth = {
        method: "openai-api-key",
      };
    }

    if (providerId === "anthropic") {
      const key = process.env.ANTHROPIC_API_KEY?.trim();
      if (key) {
        this.config.auth.anthropicApiKey = key;
      }
      await this.authManager.setMethod("anthropic-api-key");
    } else {
      const key = process.env.OPENAI_API_KEY?.trim();
      if (key) {
        this.config.auth.openaiApiKey = key;
      }
      await this.authManager.setMethod("openai-api-key");
    }
  }
}

