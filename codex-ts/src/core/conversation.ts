import type { CodexConversation } from "./codex-conversation.js";
import type { Config } from "./config.js";
import type { ConversationId } from "../protocol/conversation-id/index.js";
import type { Event, Op } from "../protocol/protocol.js";
import { ValidationError } from "./errors.js";

/**
 * Public conversation wrapper that exposes high-level helpers for the CLI.
 */
export class Conversation {
  private readonly inner: CodexConversation;
  private readonly config: Config;
  private readonly conversationId: ConversationId;

  constructor(
    codexConversation: CodexConversation,
    config: Config,
    conversationId: ConversationId,
  ) {
    this.inner = codexConversation;
    this.config = config;
    this.conversationId = conversationId;
  }

  id(): ConversationId {
    return this.conversationId;
  }

  rolloutPath(): string {
    return this.inner.rolloutPath();
  }

  async sendMessage(text: string): Promise<string> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new ValidationError("Message cannot be empty");
    }

    const op: Op = {
      type: "user_turn",
      items: [{ type: "text", text: trimmed }],
      cwd: this.config.cwd,
      approval_policy: this.config.approvalPolicy,
      sandbox_policy: this.config.sandboxPolicy,
      model: this.config.model,
      effort: this.config.modelReasoningEffort ?? undefined,
      summary: this.config.modelReasoningSummary,
      final_output_json_schema: undefined,
    };

    return this.inner.submit(op);
  }

  async nextEvent(): Promise<Event> {
    return this.inner.nextEvent();
  }
}
