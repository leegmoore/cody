/**
 * Session class - main orchestration engine.
 * Port of codex-rs/core/src/codex.rs::Session
 */

import { EventEmitter } from "events";
import { ConversationId } from "../../protocol/conversation-id/index.js";
import type {
  AskForApproval,
  Event,
  EventMsg,
  ReviewDecision,
  TurnAbortReason,
} from "../../protocol/protocol.js";
import type { UserInput } from "../../protocol/items.js";
import {
  FileRolloutStore,
  type RolloutItem,
  type RolloutRecorder,
  type RolloutRecorderParams,
  type RolloutStore,
  SessionSource,
} from "../rollout.js";
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
import { INITIAL_SUBMIT_ID } from "./types.js";
import type { AuthManager } from "../auth/index.js";
import type { ModelClient } from "../client/client.js";
import type { Config } from "../config.js";
import * as SessionStateHelpers from "./session-state.js";
import * as TurnStateHelpers from "./turn-state.js";
import { McpConnectionManager } from "../mcp/index.js";
import type { BashShell } from "../shell/index.js";
import type { Prompt } from "../client/client-common.js";
import { userInputToResponseInputItem } from "../../protocol/models.js";
import { parseTurnItem } from "../event-mapping/parse-turn-item.js";
import type { ResponseItem } from "../../protocol/models.js";
import type { ToolApprovalCallback } from "../../tools/types.js";
import { toolRegistry } from "../../tools/registry.js";
import { ToolRouter } from "../tools/tool-router.js";
import { runCompactTask } from "./compact.js";

const MAX_TOOL_ITERATIONS = 100;
const DEFAULT_CONTEXT_WINDOW = 128_000;

function systemMessage(text: string): ResponseItem {
  return {
    type: "message",
    role: "system",
    content: [{ type: "input_text", text }],
  };
}

function pinnedUserMessage(text: string): ResponseItem {
  return {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text }],
  };
}

interface SessionCreateOptions {
  conversationId?: ConversationId;
  initialHistory?: ResponseItem[];
  rolloutStore?: RolloutStore;
  rolloutParams?: RolloutRecorderParams;
}

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
  private readonly modelClient: ModelClient;
  private readonly toolRouter: ToolRouter;
  private readonly rolloutRecorder: RolloutRecorder | null;
  private _nextInternalSubId = 0;
  private approvalPolicyOverride: AskForApproval | null = null;

  // Private state
  private _state: SessionState;
  private _activeTurn: ActiveTurn | null = null;
  private rolloutPath: string | null = null;

  constructor(
    conversationId: ConversationId,
    sessionConfiguration: SessionConfiguration,
    services: SessionServices,
    txEvent: EventEmitter,
    modelClient: ModelClient,
    approvalCallback?: ToolApprovalCallback,
  ) {
    this.conversationId = conversationId;
    this.txEvent = txEvent;
    this._state = SessionStateHelpers.createSessionState(sessionConfiguration);
    this.services = services;
    this.modelClient = modelClient;
    this.toolRouter = new ToolRouter({
      registry: toolRegistry,
      approvalCallback,
    });
    this.rolloutRecorder = this.services.rollout.value ?? null;
  }

  async emitSessionConfiguredEvent(rolloutPath?: string): Promise<void> {
    const sessionConfig = this._state.sessionConfiguration;
    const resolvedPath = rolloutPath ?? this.rolloutPath ?? "";
    const event: EventMsg = {
      type: "session_configured",
      session_id: this.conversationId.toString(),
      model: sessionConfig.model,
      reasoning_effort: sessionConfig.modelReasoningEffort ?? undefined,
      history_log_id: 0,
      history_entry_count: 0,
      rollout_path: resolvedPath,
    };
    await this.sendEvent(INITIAL_SUBMIT_ID, event);
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

  getRolloutPath(): string | null {
    return this.rolloutPath;
  }

  getHistory(): ResponseItem[] {
    return this._state.history.getHistory();
  }

  getInitialContext(): ResponseItem[] {
    const items: ResponseItem[] = [];
    const config = this._state.sessionConfiguration;
    if (config.baseInstructions) {
      items.push(systemMessage(config.baseInstructions));
    }
    if (config.developerInstructions) {
      items.push(systemMessage(config.developerInstructions));
    }
    if (config.userInstructions) {
      items.push(pinnedUserMessage(config.userInstructions));
    }
    return items;
  }

  replaceHistory(items: ResponseItem[]): void {
    SessionStateHelpers.replaceHistory(this._state, items);
  }

  getModelClient(): ModelClient {
    return this.modelClient;
  }

  getRolloutRecorder(): RolloutRecorder | null {
    return this.rolloutRecorder;
  }

  getSessionConfiguration(): SessionConfiguration {
    return this._state.sessionConfiguration;
  }

  private getHistoryLength(): number {
    return this._state.history.getHistory().length;
  }

  private resolveContextWindow(): number {
    const config = this._state.sessionConfiguration.originalConfigDoNotUse;
    if (config?.modelAutoCompactTokenLimit) {
      return config.modelAutoCompactTokenLimit;
    }
    if (config?.modelContextWindow) {
      return config.modelContextWindow;
    }
    return DEFAULT_CONTEXT_WINDOW;
  }

  private createCompactTurnContext(subId: string): TurnContext {
    const sessionConfiguration = this._state.sessionConfiguration;
    return {
      subId,
      client: this.modelClient,
      cwd: sessionConfiguration.cwd,
      developerInstructions: sessionConfiguration.developerInstructions,
      baseInstructions: sessionConfiguration.baseInstructions,
      compactPrompt: sessionConfiguration.compactPrompt,
      userInstructions: sessionConfiguration.userInstructions,
      approvalPolicy: sessionConfiguration.approvalPolicy,
      sandboxPolicy: sessionConfiguration.sandboxPolicy,
      shellEnvironmentPolicy: { mode: "default" },
      toolsConfig: {
        modelFamily: sessionConfiguration.provider.name,
        features: sessionConfiguration.features,
      },
      finalOutputJsonSchema: null,
      codexLinuxSandboxExe: null,
      toolCallGate: null,
      modelContextWindow: this.resolveContextWindow(),
    };
  }

  private async maybeCompact(turnContext: TurnContext): Promise<void> {
    try {
      await runCompactTask(this, turnContext);
    } catch (error) {
      console.warn("Failed to compact conversation history:", error);
    }
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

    const modelContextWindow = this.resolveContextWindow();

    // Create turn context
    const turnContext: TurnContext = {
      subId,
      client: this.modelClient,
      cwd: sessionConfiguration.cwd,
      developerInstructions: sessionConfiguration.developerInstructions,
      baseInstructions: sessionConfiguration.baseInstructions,
      compactPrompt: sessionConfiguration.compactPrompt,
      userInstructions: sessionConfiguration.userInstructions,
      approvalPolicy: sessionConfiguration.approvalPolicy,
      sandboxPolicy: sessionConfiguration.sandboxPolicy,
      shellEnvironmentPolicy: { mode: "default" }, // TODO: Proper policy
      toolsConfig: {
        modelFamily: sessionConfiguration.provider.name,
        features: sessionConfiguration.features,
      },
      finalOutputJsonSchema: updates.finalOutputJsonSchema ?? null,
      codexLinuxSandboxExe: null,
      toolCallGate: null as unknown, // TODO: Port ReadinessFlag
      modelContextWindow,
    };

    return turnContext;
  }

  async processUserTurn(subId: string, items: UserInput[]): Promise<void> {
    const turnContext = this.createCompactTurnContext(subId);
    const historyStartLength = this.getHistoryLength();
    this.resetApprovalPolicyOverride();
    if (items.length === 0) {
      await this.sendEvent(subId, {
        type: "error",
        message: "User message cannot be empty",
      });
      await this.sendEvent(subId, { type: "task_complete" });
      return;
    }

    const userMessage = userInputToResponseInputItem(items);
    if (userMessage.type !== "message") {
      throw new Error("Unexpected user input payload");
    }
    const userRecord: ResponseItem = {
      type: "message",
      role: userMessage.role,
      content: userMessage.content,
    };
    SessionStateHelpers.recordItems(this._state, [userRecord]);

    let responseItems: ResponseItem[] = [];
    try {
      responseItems = await this.modelClient.sendMessage(this.buildPrompt());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown model error";
      await this.sendEvent(subId, { type: "error", message });
      await this.sendEvent(subId, { type: "task_complete" });
      return;
    }

    if (responseItems.length > 0) {
      SessionStateHelpers.recordItems(this._state, responseItems);
    }

    let lastAgentMessage = await this.emitResponseItems(
      subId,
      responseItems,
      undefined,
    );

    let iteration = 0;
    while (this.hasFunctionCalls(responseItems)) {
      if (iteration++ >= MAX_TOOL_ITERATIONS) {
        await this.sendEvent(subId, {
          type: "error",
          message: "Too many tool call iterations",
        });
        break;
      }

      const toolOutputs = await this.executeFunctionCalls(responseItems);
      if (toolOutputs.length === 0) {
        break;
      }

      SessionStateHelpers.recordItems(this._state, toolOutputs);
      lastAgentMessage = await this.emitResponseItems(
        subId,
        toolOutputs,
        lastAgentMessage,
      );

      try {
        responseItems = await this.modelClient.sendMessage(this.buildPrompt());
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown model error";
        await this.sendEvent(subId, { type: "error", message });
        await this.sendEvent(subId, {
          type: "task_complete",
          last_agent_message: lastAgentMessage ?? undefined,
        });
        return;
      }

      if (responseItems.length === 0) {
        break;
      }

      SessionStateHelpers.recordItems(this._state, responseItems);
      lastAgentMessage = await this.emitResponseItems(
        subId,
        responseItems,
        lastAgentMessage,
      );
    }

    await this.sendEvent(subId, {
      type: "task_complete",
      last_agent_message: lastAgentMessage ?? undefined,
    });

    await this.persistTurn(historyStartLength);
    await this.maybeCompact(turnContext);
  }

  private buildPrompt(): Prompt {
    const prompt: Prompt = {
      input: this._state.history.getHistoryForPrompt(),
      tools: toolRegistry.getToolSpecs(),
      parallelToolCalls: false,
    };
    const temperature = this._state.sessionConfiguration.modelTemperature;
    if (temperature !== undefined && temperature !== null) {
      prompt.temperature = temperature;
    }
    return prompt;
  }

  private hasFunctionCalls(items: ResponseItem[]): boolean {
    return items.some((item) => item.type === "function_call");
  }

  private async emitResponseItems(
    subId: string,
    items: ResponseItem[],
    lastAgentMessage: string | undefined,
  ): Promise<string | undefined> {
    for (const item of items) {
      if (
        item.type === "function_call" ||
        item.type === "function_call_output"
      ) {
        await this.sendEvent(subId, { type: "raw_response_item", item });
      }

      const turnItem = parseTurnItem(item);
      if (!turnItem) {
        continue;
      }

      if (turnItem.type === "agent_message") {
        const text = turnItem.item.content.map((c) => c.text).join("");
        lastAgentMessage = text;
        await this.sendEvent(subId, {
          type: "agent_message",
          message: text,
        });
      }
    }

    return lastAgentMessage;
  }

  private async executeFunctionCalls(
    responseItems: ResponseItem[],
  ): Promise<ResponseItem[]> {
    const functionCalls = responseItems.filter(
      (item): item is Extract<ResponseItem, { type: "function_call" }> =>
        item.type === "function_call",
    );
    if (functionCalls.length === 0) {
      return [];
    }

    const policy = this.getEffectiveApprovalPolicy();

    if (policy === "never") {
      return this.toolRouter.executeFunctionCalls(functionCalls, {
        skipApproval: true,
      });
    }

    if (policy === "on-failure") {
      const outputs = await this.toolRouter.executeFunctionCalls(
        functionCalls,
        { skipApproval: true },
      );
      if (this.containsFailedToolCall(outputs)) {
        this.approvalPolicyOverride = "on-request";
      }
      return outputs;
    }

    return this.toolRouter.executeFunctionCalls(functionCalls);
  }

  private async persistTurn(historyStartLength: number): Promise<void> {
    const recorder = this.services.rollout.value;
    if (!recorder) {
      return;
    }

    const history = this._state.history.getHistory();
    if (historyStartLength >= history.length) {
      return;
    }

    const newItems = history.slice(historyStartLength);
    if (newItems.length === 0) {
      return;
    }

    try {
      const sessionConfig = this._state.sessionConfiguration;
      await recorder.appendTurn({
        timestamp: Date.now(),
        items: newItems,
        metadata: {
          provider: sessionConfig.originalConfigDoNotUse.modelProviderId,
          model: sessionConfig.model,
        },
      });
    } catch (error) {
      console.warn("Failed to append turn to rollout:", error);
    }
  }

  private getEffectiveApprovalPolicy(): AskForApproval {
    return (
      this.approvalPolicyOverride ??
      this._state.sessionConfiguration.approvalPolicy
    );
  }

  private resetApprovalPolicyOverride(): void {
    this.approvalPolicyOverride = null;
  }

  private containsFailedToolCall(items: ResponseItem[]): boolean {
    return items.some(
      (item) =>
        item.type === "function_call_output" && item.output?.success === false,
    );
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
    config: Config,
    authManager: AuthManager,
    txEvent: EventEmitter,
    sessionSource: SessionSource | null,
    modelClient: ModelClient,
    approvalCallback?: ToolApprovalCallback,
    options?: SessionCreateOptions,
  ): Promise<Session> {
    // Generate conversation ID
    const conversationId = options?.conversationId ?? ConversationId.new();

    const rolloutStore = options?.rolloutStore ?? new FileRolloutStore();
    const rolloutParams: RolloutRecorderParams = options?.rolloutParams ?? {
      type: "create",
      conversationId,
      instructions:
        sessionConfiguration.userInstructions ?? config.userInstructions,
      source: sessionSource ?? SessionSource.CLI,
    };

    const recorder = await rolloutStore.createRecorder(config, rolloutParams);

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

    services.rollout.value = recorder;

    // Create session instance
    const session = new Session(
      conversationId,
      sessionConfiguration,
      services,
      txEvent,
      modelClient,
      approvalCallback,
    );

    session.rolloutPath = recorder.getRolloutPath();

    if (options?.initialHistory && options.initialHistory.length > 0) {
      SessionStateHelpers.replaceHistory(
        session._state,
        options.initialHistory,
      );
    }

    return session;
  }

  // TODO: Port remaining Session methods in future sections:
  // - run_turn, try_run_turn, process_items (future phases)
  // - Full initialization with RolloutRecorder, MCP, etc. (future phases)
}
