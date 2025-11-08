/**
 * Session class - main orchestration engine.
 * Port of codex-rs/core/src/codex.rs::Session
 */

import { EventEmitter } from "events";
import type { ConversationId } from "../../protocol/conversation-id/index.js";
import type {
  Event,
  EventMsg,
  ReviewDecision,
} from "../../protocol/protocol.js";
import type { RolloutItem } from "../rollout.js";
import type {
  SessionConfiguration,
  SessionState,
  SessionServices,
  SessionSettingsUpdate,
  TurnContext,
  ActiveTurn,
} from "./types.js";
import * as SessionStateHelpers from "./session-state.js";

/**
 * Internal session state and orchestration.
 * Manages conversation lifecycle, tool execution, and event emission.
 *
 * Port of codex.rs::Session
 */
export class Session {
  readonly conversationId: ConversationId;
  private readonly txEvent: EventEmitter;
  private readonly services: SessionServices;
  private _nextInternalSubId = 0;

  // Private state (unused in skeleton, will be used in later sections)
  // @ts-expect-error - unused until section 3+
  private _state: SessionState;
  // @ts-expect-error - unused until section 3+
  private _activeTurn: ActiveTurn | null = null;

  constructor(
    conversationId: ConversationId,
    sessionConfiguration: SessionConfiguration,
    services: SessionServices,
    txEvent: EventEmitter,
  ) {
    this.conversationId = conversationId;
    this.txEvent = txEvent;
    this._state = SessionStateHelpers.createSessionState(sessionConfiguration);
    this.services = services;
  }

  /**
   * Send an event to clients.
   * Persists to rollout and emits on event channel.
   */
  async sendEvent(subId: string, msg: EventMsg): Promise<void> {
    const event: Event = { id: subId, msg };
    await this.sendEventRaw(event);

    // TODO: Handle legacy events (msg.as_legacy_events)
  }

  /**
   * Send event without legacy processing.
   */
  async sendEventRaw(event: Event): Promise<void> {
    // Persist to rollout
    const rolloutItems: RolloutItem[] = [
      {
        type: "event",
        data: event.msg,
      },
    ];
    await this.persistRolloutItems(rolloutItems);

    // Emit event
    this.txEvent.emit("event", event);
  }

  /**
   * Persist rollout items to disk.
   */
  private async persistRolloutItems(items: RolloutItem[]): Promise<void> {
    const recorder = this.services.rollout.value;
    if (!recorder) {
      return;
    }

    try {
      await recorder.recordItems(items);
    } catch (err) {
      console.error("Failed to record rollout items:", err);
    }
  }

  /**
   * Get the next internal submission ID.
   */
  nextInternalSubId(): string {
    const id = this._nextInternalSubId++;
    return `auto-compact-${id}`;
  }

  /**
   * Get the event transmitter.
   */
  getTxEvent(): EventEmitter {
    return this.txEvent;
  }

  /**
   * Flush rollout writes to disk.
   */
  async flushRollout(): Promise<void> {
    const recorder = this.services.rollout.value;
    if (!recorder) {
      return;
    }

    try {
      await recorder.flush();
    } catch (err) {
      console.warn("Failed to flush rollout recorder:", err);
    }
  }

  /**
   * Get user shell from services.
   */
  userShell() {
    return this.services.userShell;
  }

  /**
   * Get show raw agent reasoning setting.
   */
  showRawAgentReasoning(): boolean {
    return this.services.showRawAgentReasoning;
  }

  /**
   * Update session settings.
   * Port of Session::update_settings
   */
  async updateSettings(updates: SessionSettingsUpdate): Promise<void> {
    // TODO: Implement state update
    console.warn("updateSettings: not yet implemented", { updates });
  }

  /**
   * Create a new turn with an auto-generated submission ID.
   * Port of Session::new_turn
   */
  async newTurn(_updates: SessionSettingsUpdate): Promise<TurnContext> {
    // TODO: Implement turn creation
    throw new Error("newTurn: not yet implemented");
  }

  /**
   * Create a new turn with a specific submission ID.
   * Port of Session::new_turn_with_sub_id
   */
  async newTurnWithSubId(
    _subId: string,
    _updates: SessionSettingsUpdate,
  ): Promise<TurnContext> {
    // TODO: Implement turn creation with sub_id
    throw new Error("newTurnWithSubId: not yet implemented");
  }

  /**
   * Interrupt the current task.
   * Port of Session::interrupt_task
   */
  async interruptTask(): Promise<void> {
    // TODO: await this.abortAllTasks(TurnAbortReason.Interrupted);
    console.warn("interruptTask: not yet implemented");
  }

  /**
   * Request command execution approval from user.
   * Port of Session::request_command_approval
   */
  async requestCommandApproval(
    _turnContext: TurnContext,
    _callId: string,
    _command: string[],
    _cwd: string,
    _reason?: string,
    _risk?: unknown,
  ): Promise<ReviewDecision> {
    // TODO: Implement approval request flow
    console.warn("requestCommandApproval: not yet implemented");
    return "denied";
  }

  /**
   * Request patch approval from user.
   * Port of Session::request_patch_approval
   */
  async requestPatchApproval(
    _turnContext: TurnContext,
    _callId: string,
    _changes: unknown,
    _reason?: string,
    _grantRoot?: string,
  ): Promise<ReviewDecision> {
    // TODO: Implement patch approval request flow
    console.warn("requestPatchApproval: not yet implemented");
    return "denied";
  }

  /**
   * Notify a pending approval with a decision.
   * Port of Session::notify_approval
   */
  async notifyApproval(
    _subId: string,
    _decision: ReviewDecision,
  ): Promise<void> {
    // TODO: Implement approval notification
    console.warn("notifyApproval: not yet implemented");
  }

  /**
   * Assess a command for sandbox policy.
   * Port of Session::assess_sandbox_command
   */
  async assessSandboxCommand(
    _turnContext: TurnContext,
    _callId: string,
    _command: string[],
    _failureMessage?: string,
  ): Promise<unknown> {
    // TODO: Implement sandbox assessment
    console.warn("assessSandboxCommand: not yet implemented");
    return null;
  }

  /**
   * Emit turn item started event.
   * Port of Session::emit_turn_item_started
   */
  async emitTurnItemStarted(
    _turnContext: TurnContext,
    _item: unknown,
  ): Promise<void> {
    // TODO: Implement item started event
    console.warn("emitTurnItemStarted: not yet implemented");
  }

  /**
   * Emit turn item completed event.
   * Port of Session::emit_turn_item_completed
   */
  async emitTurnItemCompleted(
    _turnContext: TurnContext,
    _item: unknown,
  ): Promise<void> {
    // TODO: Implement item completed event
    console.warn("emitTurnItemCompleted: not yet implemented");
  }

  /**
   * Try to inject input into a running task.
   * Returns error with input if no task is running.
   * Port of Session::inject_input
   */
  async injectInput(_input: unknown[]): Promise<void> {
    // TODO: Implement input injection
    console.warn("injectInput: not yet implemented");
  }

  /**
   * Get pending input from the active turn.
   * Port of Session::get_pending_input
   */
  async getPendingInput(): Promise<unknown[]> {
    // TODO: Implement get pending input
    console.warn("getPendingInput: not yet implemented");
    return [];
  }

  /**
   * Call an MCP tool.
   * Port of Session::call_tool
   */
  async callTool(
    _server: string,
    _tool: string,
    _arguments?: unknown,
  ): Promise<unknown> {
    // TODO: Implement MCP tool call
    console.warn("callTool: not yet implemented");
    return null;
  }

  /**
   * Parse MCP tool name into (server, tool) parts.
   * Port of Session::parse_mcp_tool_name
   */
  parseMcpToolName(_toolName: string): [string, string] | null {
    // TODO: Implement tool name parsing
    console.warn("parseMcpToolName: not yet implemented");
    return null;
  }

  /**
   * Notify a background event.
   * Port of Session::notify_background_event
   */
  async notifyBackgroundEvent(
    _turnContext: TurnContext,
    _message: string,
  ): Promise<void> {
    // TODO: Implement background event notification
    console.warn("notifyBackgroundEvent: not yet implemented");
  }

  /**
   * Notify a stream error.
   * Port of Session::notify_stream_error
   */
  async notifyStreamError(
    _turnContext: TurnContext,
    _message: string,
  ): Promise<void> {
    // TODO: Implement stream error notification
    console.warn("notifyStreamError: not yet implemented");
  }

  /**
   * Record items to conversation history and persist to rollout.
   * Port of Session::record_conversation_items
   */
  async recordConversationItems(
    _turnContext: TurnContext,
    _items: unknown[],
  ): Promise<void> {
    // TODO: Implement conversation items recording
    console.warn("recordConversationItems: not yet implemented");
  }

  /**
   * Record items into history.
   * Port of Session::record_into_history
   */
  async recordIntoHistory(_items: unknown[]): Promise<void> {
    // TODO: Implement history recording
    console.warn("recordIntoHistory: not yet implemented");
  }

  // TODO: Port remaining Session methods in future sections:
  // - spawn_task, abort_all_tasks, on_task_finished (Section 4)
  // - run_turn, try_run_turn, process_items (Section 4)
  // - MCP and advanced features (Section 5)
  // - And more...
}
