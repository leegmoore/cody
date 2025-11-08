/**
 * CodexConversation - wrapper around Codex with rollout path tracking.
 * Port of codex-rs/core/src/codex_conversation.rs
 */

import type { Codex } from "./codex/codex.js";
import type { Event, Op, Submission } from "../protocol/protocol.js";

/**
 * Conduit for the bidirectional stream of messages that compose a conversation.
 * Thin wrapper around Codex that tracks the rollout path.
 */
export class CodexConversation {
  private readonly codex: Codex;
  private readonly _rolloutPath: string;

  constructor(codex: Codex, rolloutPath: string) {
    this.codex = codex;
    this._rolloutPath = rolloutPath;
  }

  /**
   * Submit an operation and get back its submission ID.
   */
  async submit(op: Op): Promise<string> {
    return this.codex.submit(op);
  }

  /**
   * Submit with a specific ID.
   * Use sparingly - intended to be removed soon.
   */
  async submitWithId(sub: Submission): Promise<void> {
    return this.codex.submitWithId(sub);
  }

  /**
   * Get the next event from the agent.
   */
  async nextEvent(): Promise<Event> {
    return this.codex.nextEvent();
  }

  /**
   * Get the rollout path for this conversation.
   */
  rolloutPath(): string {
    return this._rolloutPath;
  }
}
