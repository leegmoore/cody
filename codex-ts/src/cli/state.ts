import { ConversationManager } from "../core/conversation-manager.js";
import type { AuthManager } from "../core/auth/index.js";
import type { ModelClientFactory } from "../core/client/model-client-factory.js";
import { SessionSource } from "../core/rollout.js";
import type { ConversationId } from "../protocol/conversation-id/index.js";
import type { Conversation } from "../core/conversation.js";
import { NoActiveConversationError } from "../core/errors.js";
import type { ToolApprovalCallback } from "../tools/types.js";

interface ManagerDeps {
  authManager: AuthManager;
  modelClientFactory: ModelClientFactory;
  sessionSource?: SessionSource;
  approvalCallback?: ToolApprovalCallback;
}

let manager: ConversationManager | null = null;
let activeConversation: {
  id: ConversationId;
  conversation: Conversation;
} | null = null;

export function getOrCreateManager(deps: ManagerDeps): ConversationManager {
  if (!manager) {
    manager = new ConversationManager(
      deps.authManager,
      deps.sessionSource ?? SessionSource.CLI,
      deps.modelClientFactory,
      { approvalCallback: deps.approvalCallback },
    );
  }
  return manager;
}

export function setActiveConversation(
  conversationId: ConversationId,
  conversation: Conversation,
): void {
  activeConversation = { id: conversationId, conversation };
}

export function requireActiveConversation(): {
  conversationId: ConversationId;
  conversation: Conversation;
} {
  if (!activeConversation) {
    throw new NoActiveConversationError();
  }
  return {
    conversationId: activeConversation.id,
    conversation: activeConversation.conversation,
  };
}

export function clearActiveConversation(): void {
  activeConversation = null;
}

export function getActiveConversation(): {
  conversationId: ConversationId;
  conversation: Conversation;
} | null {
  if (!activeConversation) {
    return null;
  }
  return {
    conversationId: activeConversation.id,
    conversation: activeConversation.conversation,
  };
}

export function resetStateForTesting(): void {
  manager = null;
  activeConversation = null;
}
