/**
 * Codex - main public API for the orchestration engine.
 * Port of codex-rs/core/src/codex.rs::Codex
 */

import { EventEmitter } from "events";
import type { ConversationId } from "../../protocol/conversation-id/index.js";
import type { Event, Op, Submission } from "../../protocol/protocol.js";
import type { Config } from "../config.js";
import type { AuthManager } from "../auth/index.js";
import type { SessionConfiguration } from "./types.js";
import { SUBMISSION_CHANNEL_CAPACITY } from "./types.js";
import { Session } from "./session.js";
import { submissionLoop } from "./submission-loop.js";
import {
  WireApi,
  builtInModelProviders,
  type ModelProviderInfo,
} from "../client/model-provider-info.js";
import { Features } from "../features/index.js";
import { SessionSource } from "../rollout.js";
import type { RolloutStore, RolloutRecorderParams } from "../rollout.js";
import type { ModelClientFactory } from "../client/model-client-factory.js";
import type { ToolApprovalCallback } from "../../tools/types.js";
import { ConfigurationError } from "../errors.js";
import type { ResponseItem } from "../../protocol/models.js";

export interface CodexSpawnOptions {
  approvalCallback?: ToolApprovalCallback;
  rolloutStore?: RolloutStore;
  conversationId?: ConversationId;
  rolloutParams?: RolloutRecorderParams;
}

/**
 * Error thrown when the Codex agent dies unexpectedly.
 */
export class CodexInternalAgentDiedError extends Error {
  constructor() {
    super("Internal agent died");
    this.name = "CodexInternalAgentDiedError";
  }
}

/**
 * High-level interface to the Codex system.
 * Operates as a queue pair: send submissions, receive events.
 *
 * Port of codex.rs::Codex
 */
export class Codex {
  private nextId = 0;
  private readonly txSub: EventEmitter;
  private readonly rxEvent: EventEmitter;
  private readonly submissionBuffer: Submission[] = [];
  private readonly eventBuffer: Event[] = [];
  private eventWaiters: Array<(event: Event) => void> = [];

  constructor(txSub: EventEmitter, rxEvent: EventEmitter) {
    this.txSub = txSub;
    this.rxEvent = rxEvent;

    // Set up event buffering
    this.rxEvent.on("event", (event: Event) => {
      const waiter = this.eventWaiters.shift();
      if (waiter) {
        waiter(event);
      } else {
        this.eventBuffer.push(event);
      }
    });
  }

  /**
   * Submit an operation with an auto-generated ID.
   */
  async submit(op: Op): Promise<string> {
    const id = (this.nextId++).toString();
    const sub: Submission = { id, op };
    await this.submitWithId(sub);
    return id;
  }

  /**
   * Submit an operation with a specific ID.
   * Prefer submit() for auto-generated IDs.
   */
  async submitWithId(sub: Submission): Promise<void> {
    // Check if submission channel is available
    if (this.submissionBuffer.length >= SUBMISSION_CHANNEL_CAPACITY) {
      throw new CodexInternalAgentDiedError();
    }

    this.txSub.emit("submission", sub);
  }

  /**
   * Wait for and return the next event.
   */
  async nextEvent(): Promise<Event> {
    // Return buffered event if available
    const buffered = this.eventBuffer.shift();
    if (buffered) {
      return buffered;
    }

    // Wait for next event
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.eventWaiters.indexOf(resolve);
        if (idx >= 0) {
          this.eventWaiters.splice(idx, 1);
        }
        reject(new CodexInternalAgentDiedError());
      }, 60000); // 60 second timeout

      const wrappedResolve = (event: Event) => {
        clearTimeout(timeout);
        resolve(event);
      };

      this.eventWaiters.push(wrappedResolve);
    });
  }

  /**
   * Get all buffered events without waiting.
   */
  getBufferedEvents(): Event[] {
    return [...this.eventBuffer];
  }

  /**
   * Close the Codex instance.
   */
  close(): void {
    this.txSub.removeAllListeners();
    this.rxEvent.removeAllListeners();
    this.eventWaiters = [];
    this.eventBuffer.length = 0;
  }

  /**
   * Spawn a new Codex instance and initialize the session.
   * Port of Codex::spawn
   *
   * NOTE: Simplified version - full initialization deferred to future phases.
   */
  static async spawn(
    config: Config,
    authManager: AuthManager,
    initialHistory: ResponseItem[] | null,
    sessionSource: SessionSource | null, // TODO: Port SessionSource type
    modelClientFactory: ModelClientFactory,
    options?: CodexSpawnOptions,
  ): Promise<CodexSpawnOk> {
    // Create communication channels
    const txSub = new EventEmitter();
    const rxEvent = new EventEmitter();
    const txEvent = new EventEmitter();

    // Build session configuration
    // TODO: Get user instructions from config
    const userInstructions = null;

    const provider = resolveSessionProvider(config);

    // Create Features instance with default settings
    const features = Features.withDefaults();

    const sessionConfiguration: SessionConfiguration = {
      provider,
      model: config.model,
      modelReasoningEffort: config.modelReasoningEffort ?? null,
      modelReasoningSummary: config.modelReasoningSummary,
      modelTemperature: config.modelTemperature ?? null,
      developerInstructions: config.developerInstructions ?? null,
      userInstructions,
      baseInstructions: config.baseInstructions ?? null,
      compactPrompt: config.compactPrompt ?? null,
      approvalPolicy: config.approvalPolicy,
      sandboxPolicy: config.sandboxPolicy,
      cwd: config.cwd,
      features,
      originalConfigDoNotUse: config,
      // TODO: Pass sessionSource properly - for now default to CLI if unknown
      sessionSource: sessionSource ?? SessionSource.CLI,
    };

    // Create session
    const modelClient = await modelClientFactory({ config, authManager });

    const session = await Session.create(
      sessionConfiguration,
      config,
      authManager,
      txEvent,
      sessionSource,
      modelClient,
      options?.approvalCallback,
      {
        conversationId: options?.conversationId,
        initialHistory: initialHistory ?? undefined,
        rolloutStore: options?.rolloutStore,
        rolloutParams: options?.rolloutParams,
      },
    );

    const conversationId = session.conversationId;

    // Create Codex instance
    const codex = new Codex(txSub, rxEvent);

    // Wire up event forwarding
    txEvent.on("event", (event: Event) => {
      rxEvent.emit("event", event);
    });

    await session.emitSessionConfiguredEvent();

    // Spawn submission loop in background
    submissionLoop(session, config, txSub).catch((err) => {
      console.error("Submission loop error:", err);
    });

    return {
      codex,
      conversationId,
    };
  }
}

function resolveSessionProvider(config: Config): ModelProviderInfo {
  const providers = builtInModelProviders();
  const base = providers[config.modelProviderId];
  if (!base) {
    throw new ConfigurationError(
      `Unknown provider "${config.modelProviderId}" configured for conversation.`,
    );
  }

  const wireApi = resolveWireApiForConfig(
    config.modelProviderId,
    config.modelProviderApi,
  );

  return {
    ...base,
    wireApi,
  };
}

function resolveWireApiForConfig(providerId: string, api: string): WireApi {
  if (providerId === "openai") {
    if (api === "chat") {
      return WireApi.Chat;
    }
    return WireApi.Responses;
  }

  if (providerId === "anthropic") {
    if (api !== "messages") {
      throw new ConfigurationError(
        `Provider "anthropic" does not support API "${api}". Use "messages".`,
      );
    }
    return WireApi.Messages;
  }

  if (providerId === "openrouter") {
    if (api !== "chat") {
      throw new ConfigurationError(
        `Provider "openrouter" only supports the "chat" API.`,
      );
    }
    return WireApi.Chat;
  }

  throw new ConfigurationError(
    `Unsupported provider "${providerId}" configured for conversation.`,
  );
}

/**
 * Result of spawning a new Codex instance.
 * Port of codex.rs::CodexSpawnOk
 */
export interface CodexSpawnOk {
  codex: Codex;
  conversationId: ConversationId;
}
