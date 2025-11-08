/**
 * Session class - main orchestration engine.
 * Port of codex-rs/core/src/codex.rs::Session
 */

import { EventEmitter } from "events";
import { ConversationId } from "../../protocol/conversation-id/index.js";
import type {
  Event,
  EventMsg,
  ReviewDecision,
  TurnAbortReason,
} from "../../protocol/protocol.js";
import type { UserInput } from "../../protocol/items.js";
import type { RolloutItem } from "../rollout.js";
import type {
  SessionConfiguration,
  SessionState,
  SessionServices,
  SessionSettingsUpdate,
  TurnContext,
  ActiveTurn,
  SessionTask,
  SessionTaskContext,
  RunningTask,
} from "./types.js";
import type { AuthManager } from "../auth/index.js";
import type { ModelClient } from "../client/client.js";
import * as SessionStateHelpers from "./session-state.js";
import * as TurnStateHelpers from "./turn-state.js";
import { Features } from "../features/index.js";
import { McpConnectionManager } from "../mcp/index.js";
import type { BashShell } from "../shell/index.js";

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

  // Private state
  private _state: SessionState;
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
    this._state = SessionStateHelpers.applySessionSettings(
      this._state,
      updates,
    );
  }

  /**
   * Create a new turn with an auto-generated submission ID.
   * Port of Session::new_turn
   */
  async newTurn(updates: SessionSettingsUpdate): Promise<TurnContext> {
    const subId = this.nextInternalSubId();
    return this.newTurnWithSubId(subId, updates);
  }

  /**
   * Create a new turn with a specific submission ID.
   * Port of Session::new_turn_with_sub_id
   */
  async newTurnWithSubId(
    subId: string,
    updates: SessionSettingsUpdate,
  ): Promise<TurnContext> {
    // Apply updates to configuration
    const sessionConfiguration = SessionStateHelpers.applySessionSettings(
      this._state,
      updates,
    ).sessionConfiguration;
    this._state.sessionConfiguration = sessionConfiguration;

    // Create turn context
    // TODO: Port make_turn_context - for now return minimal stub
    const turnContext: TurnContext = {
      subId,
      client: null as unknown as ModelClient, // TODO: Create ModelClient
      cwd: sessionConfiguration.cwd,
      developerInstructions: sessionConfiguration.developerInstructions,
      baseInstructions: sessionConfiguration.baseInstructions,
      compactPrompt: sessionConfiguration.compactPrompt,
      userInstructions: sessionConfiguration.userInstructions,
      approvalPolicy: sessionConfiguration.approvalPolicy,
      sandboxPolicy: sessionConfiguration.sandboxPolicy,
      shellEnvironmentPolicy: { mode: "default" }, // TODO: Proper policy
      toolsConfig: {
        modelFamily: "unknown",
        features: Features.withDefaults(),
      },
      finalOutputJsonSchema: updates.finalOutputJsonSchema ?? null,
      codexLinuxSandboxExe: null,
      toolCallGate: null as unknown, // TODO: Port ReadinessFlag
    };

    return turnContext;
  }

  /**
   * Interrupt the current task.
   * Port of Session::interrupt_task
   */
  async interruptTask(): Promise<void> {
    console.info("Interrupt received: aborting current task");
    await this.abortAllTasks("interrupted");
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
    server: string,
    tool: string,
    args?: unknown,
  ): Promise<unknown> {
    return this.services.mcpConnectionManager.callTool(server, tool, args);
  }

  /**
   * Parse MCP tool name into (server, tool) parts.
   * Port of Session::parse_mcp_tool_name
   */
  parseMcpToolName(toolName: string): [string, string] | null {
    return this.services.mcpConnectionManager.parseToolName(toolName);
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

  /**
   * Spawn a task to handle a turn.
   * Aborts any existing tasks before starting the new one.
   * Port of Session::spawn_task
   */
  async spawnTask(
    turnContext: TurnContext,
    input: UserInput[],
    task: SessionTask,
  ): Promise<void> {
    // Abort all existing tasks
    await this.abortAllTasks("replaced");

    const taskKind = task.kind();

    // Create cancellation controller
    const cancellationToken = new AbortController();

    // Create done promise
    let doneResolve!: () => void;
    const done = new Promise<void>((resolve) => {
      doneResolve = resolve;
    });

    // Create session context for task
    const sessionCtx: SessionTaskContext = {
      session: this,
    };

    // Spawn the task
    const handle = new AbortController();
    const taskPromise = (async () => {
      try {
        const lastAgentMessage = await task.run(
          sessionCtx,
          turnContext,
          input,
          cancellationToken.signal,
        );

        await this.flushRollout();

        if (!cancellationToken.signal.aborted) {
          // Task completed successfully
          await this.onTaskFinished(turnContext, lastAgentMessage);
        }
      } catch (error) {
        console.error("Task error:", error);
      } finally {
        doneResolve();
      }
    })();

    // Store task metadata
    const runningTask: RunningTask = {
      done,
      doneResolve,
      kind: taskKind,
      task,
      cancellationToken,
      handle,
      turnContext,
    };

    this.registerNewActiveTask(runningTask);

    // Don't await - task runs in background
    taskPromise.catch((err) => {
      console.error("Background task error:", err);
    });
  }

  /**
   * Abort all running tasks.
   * Port of Session::abort_all_tasks
   */
  async abortAllTasks(reason: TurnAbortReason): Promise<void> {
    const tasks = this.takeAllRunningTasks();
    for (const task of tasks) {
      await this.handleTaskAbort(task, reason);
    }
  }

  /**
   * Handle task completion.
   * Port of Session::on_task_finished
   */
  async onTaskFinished(
    turnContext: TurnContext,
    lastAgentMessage: string | null,
  ): Promise<void> {
    // Remove task from active turn
    if (this._activeTurn) {
      const wasLast = TurnStateHelpers.removeTask(
        this._activeTurn,
        turnContext.subId,
      );
      if (wasLast) {
        this._activeTurn = null;
      }
    }

    // Send completion event
    const event: EventMsg = {
      type: "task_complete",
      last_agent_message: lastAgentMessage ?? undefined,
    };
    await this.sendEvent(turnContext.subId, event);
  }

  /**
   * Register a new active task.
   * Port of Session::register_new_active_task
   */
  private registerNewActiveTask(task: RunningTask): void {
    const turn = TurnStateHelpers.createActiveTurn();
    TurnStateHelpers.addTask(turn, task);
    this._activeTurn = turn;
  }

  /**
   * Take all running tasks from the active turn.
   * Port of Session::take_all_running_tasks
   */
  private takeAllRunningTasks(): RunningTask[] {
    if (!this._activeTurn) {
      return [];
    }

    const turn = this._activeTurn;
    this._activeTurn = null;

    // Clear pending approvals and input
    TurnStateHelpers.clearPending(turn.turnState);

    // Drain all tasks
    return TurnStateHelpers.drainTasks(turn);
  }

  /**
   * Handle task abort.
   * Port of Session::handle_task_abort
   */
  private async handleTaskAbort(
    task: RunningTask,
    reason: TurnAbortReason,
  ): Promise<void> {
    const subId = task.turnContext.subId;

    // Already cancelled?
    if (task.cancellationToken.signal.aborted) {
      return;
    }

    console.info(
      `Aborting task ${subId} (kind: ${task.kind}, reason: ${reason})`,
    );

    // Cancel the task
    task.cancellationToken.abort();

    // Wait for graceful shutdown (100ms timeout)
    const GRACEFUL_TIMEOUT_MS = 100;
    await Promise.race([
      task.done,
      new Promise((resolve) => setTimeout(resolve, GRACEFUL_TIMEOUT_MS)),
    ]);

    // Abort the handle
    task.handle.abort();

    // Call task's abort hook if it exists
    if (task.task.abort) {
      const sessionCtx: SessionTaskContext = { session: this };
      await task.task.abort(sessionCtx, task.turnContext);
    }

    // Send abort event
    const event: EventMsg = {
      type: "turn_aborted",
      reason,
    };
    await this.sendEvent(task.turnContext.subId, event);
  }

  /**
   * Create a new Session instance.
   * Port of Session::new
   *
   * NOTE: Simplified version - full async initialization deferred to future phases.
   * Full implementation would include:
   * - RolloutRecorder initialization
   * - MCP connection manager setup
   * - Shell discovery
   * - History metadata loading
   * - OTel event manager setup
   */
  static async create(
    sessionConfiguration: SessionConfiguration,
    _config: unknown, // Config type - TODO: Use for full initialization
    authManager: AuthManager,
    txEvent: EventEmitter,
    _sessionSource: unknown, // SessionSource - TODO: Use for initialization
  ): Promise<Session> {
    // Generate conversation ID
    // TODO: Handle resumed conversations
    const conversationId = ConversationId.new();

    console.info(
      `Configuring session: model=${sessionConfiguration.model}; provider=${sessionConfiguration.provider.name}`,
    );

    // Validate cwd is absolute
    // TODO: Add path validation when we have proper path handling

    // Create services
    // TODO: Initialize these properly in future phases
    const services: SessionServices = {
      mcpConnectionManager: new McpConnectionManager(),
      unifiedExecManager: null as unknown,
      notifier: null as unknown,
      rollout: { value: null }, // TODO: Initialize RolloutRecorder
      userShell: {
        type: "bash",
        shellPath: "/bin/bash",
        bashrcPath: "~/.bashrc",
      } as BashShell,
      showRawAgentReasoning: false,
      authManager,
      otelEventManager: null as unknown,
      toolApprovals: null as unknown,
    };

    // Create session instance
    return new Session(conversationId, sessionConfiguration, services, txEvent);
  }

  // TODO: Port remaining Session methods in future sections:
  // - run_turn, try_run_turn, process_items (future phases)
  // - Full initialization with RolloutRecorder, MCP, etc. (future phases)
}
