/**
 * ConversationManager - creates and manages Codex conversations.
 * Port of codex-rs/core/src/conversation_manager.rs
 */

import type { ConversationId } from "../protocol/conversation-id/index.js";
import type { Config } from "./config.js";
import type { AuthManager } from "./auth/index.js";
import type { EventMsg } from "../protocol/protocol.js";
import { Codex, type CodexSpawnOk } from "./codex/codex.js";
import { CodexConversation } from "./codex-conversation.js";
import type { ModelClientFactory } from "./client/model-client-factory.js";
import { SessionSource } from "./rollout.js";
import { Conversation } from "./conversation.js";

// Extract SessionConfigured event type from EventMsg union
type SessionConfiguredEvent = Extract<EventMsg, { type: "session_configured" }>;

/**
 * Result of creating a new conversation.
 */
export interface NewConversation {
  conversationId: ConversationId;
  conversation: Conversation;
  sessionConfigured: SessionConfiguredEvent;
}

/**
 * ConversationManager is responsible for creating conversations and
 * maintaining them in memory.
 */
export class ConversationManager {
  private readonly conversations: Map<string, Conversation> = new Map();
  private readonly authManager: AuthManager;
  private readonly sessionSource: SessionSource | null;
  private readonly modelClientFactory: ModelClientFactory;

  constructor(
    authManager: AuthManager,
    sessionSource: SessionSource | null,
    modelClientFactory: ModelClientFactory,
  ) {
    this.authManager = authManager;
    this.sessionSource = sessionSource;
    this.modelClientFactory = modelClientFactory;
  }

  /**
   * Create a new conversation with the given config.
   */
  async newConversation(config: Config): Promise<NewConversation> {
    return this.spawnConversation(config, this.authManager);
  }

  /**
   * Spawn a new conversation.
   */
  private async spawnConversation(
    config: Config,
    authManager: AuthManager,
  ): Promise<NewConversation> {
    const { codex, conversationId }: CodexSpawnOk = await Codex.spawn(
      config,
      authManager,
      null, // InitialHistory::New (TODO: proper type)
      this.sessionSource,
      this.modelClientFactory,
    );

    return this.finalizeSpawn(codex, conversationId, config);
  }

  /**
   * Finalize spawning a conversation by waiting for SessionConfigured event.
   */
  private async finalizeSpawn(
    codex: Codex,
    conversationId: ConversationId,
    config: Config,
  ): Promise<NewConversation> {
    // The first event must be SessionConfigured
    const event = await codex.nextEvent();

    if (event.msg.type !== "session_configured") {
      throw new Error(
        `Expected SessionConfigured event, got: ${event.msg.type}`,
      );
    }

    const sessionConfigured = event.msg as SessionConfiguredEvent;

    const rawConversation = new CodexConversation(
      codex,
      sessionConfigured.rollout_path,
    );

    const conversation = new Conversation(
      rawConversation,
      config,
      conversationId,
    );

    // Store in map (using conversation ID as string key)
    this.conversations.set(conversationId.toString(), conversation);

    return {
      conversationId,
      conversation,
      sessionConfigured,
    };
  }

  /**
   * Get an existing conversation by ID.
   */
  async getConversation(
    conversationId: ConversationId,
  ): Promise<Conversation | undefined> {
    return this.conversations.get(conversationId.toString());
  }

  /**
   * Resume a conversation from a rollout file.
   * TODO: Implement when RolloutRecorder is ported.
   */
  async resumeConversationFromRollout(
    _config: Config,
    _rolloutPath: string,
    _authManager: AuthManager,
  ): Promise<NewConversation> {
    throw new Error("resumeConversationFromRollout: not yet implemented");
  }

  /**
   * Resume a conversation with existing history.
   * TODO: Implement when InitialHistory is ported.
   */
  async resumeConversationWithHistory(
    _config: Config,
    _initialHistory: unknown, // InitialHistory
    _authManager: AuthManager,
  ): Promise<NewConversation> {
    throw new Error("resumeConversationWithHistory: not yet implemented");
  }

  /**
   * Remove a conversation from the manager.
   * Returns the conversation if found.
   */
  async removeConversation(
    conversationId: ConversationId,
  ): Promise<Conversation | null> {
    const conversation = this.conversations.get(conversationId.toString());
    if (conversation) {
      this.conversations.delete(conversationId.toString());
      return conversation;
    }
    return null;
  }

  /**
   * Fork an existing conversation by taking messages up to a given position.
   * TODO: Implement when RolloutRecorder and history truncation is ported.
   */
  async forkConversation(
    _nthUserMessage: number,
    _config: Config,
    _path: string,
  ): Promise<NewConversation> {
    throw new Error("forkConversation: not yet implemented");
  }
}

/**
 * Helper to create ConversationManager with auth for testing.
 * TODO: Implement when auth testing utilities are ported.
 */
export function createConversationManagerWithAuth(
  _auth: unknown, // CodexAuth
): ConversationManager {
  throw new Error("createConversationManagerWithAuth: not yet implemented");
}
