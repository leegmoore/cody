/**
 * Core types for the Codex orchestration engine.
 * Port of codex-rs/core/src/codex.rs and state module types.
 */

import type { ResponseInputItem, ResponseItem } from "../../protocol/models.js";
import type {
  AskForApproval,
  SandboxPolicy,
  ReviewDecision,
} from "../../protocol/protocol.js";
import type {
  ReasoningEffort,
  ReasoningSummary,
} from "../../protocol/config-types.js";
import type {
  TokenUsageInfo,
  RateLimitSnapshot,
} from "../../protocol/protocol.js";
import type { ModelClient } from "../client/client.js";
import type { ModelProviderInfo } from "../client/model-provider-info.js";
import type { ConversationHistory } from "../conversation-history/index.js";
import type { Features } from "../features/index.js";
import type { Config } from "../config.js";
import type { McpConnectionManager } from "../mcp/index.js";
import type { RolloutRecorder, SessionSource } from "../rollout.js";
import type { AuthManager } from "../auth/index.js";
import type { Shell } from "../shell/index.js";

// TODO: Port ToolsConfig from tools/spec.rs
export interface ToolsConfig {
  modelFamily: string;
  features: Features;
}

// TODO: Port ShellEnvironmentPolicy from config types
export interface ShellEnvironmentPolicy {
  // Placeholder - port from codex-rs/protocol/src/config_types.rs
  mode: string;
}

/**
 * Session-wide mutable state.
 * Port of state/session.rs
 */
export interface SessionState {
  sessionConfiguration: SessionConfiguration;
  history: ConversationHistory;
  latestRateLimits: RateLimitSnapshot | null;
}

/**
 * Session-scoped services and dependencies.
 * Port of state/service.rs
 */
export interface SessionServices {
  mcpConnectionManager: McpConnectionManager;
  unifiedExecManager: unknown; // TODO: Port UnifiedExecSessionManager
  notifier: unknown; // TODO: Port UserNotifier
  rollout: { value: RolloutRecorder | null }; // Mutex<Option<RolloutRecorder>>
  userShell: Shell;
  showRawAgentReasoning: boolean;
  authManager: AuthManager;
  otelEventManager: unknown; // TODO: Port OtelEventManager
  toolApprovals: unknown; // TODO: Port ApprovalStore (Mutex)
}

/**
 * Task kind enum.
 * Port of state/turn.rs::TaskKind
 */
export enum TaskKind {
  Regular = "Regular",
  Review = "Review",
  Compact = "Compact",
}

/**
 * Metadata about a running task.
 * Port of state/turn.rs::RunningTask
 */
export interface RunningTask {
  done: Promise<void>; // Arc<Notify> → Promise
  kind: TaskKind;
  task: unknown; // TODO: Port SessionTask trait
  cancellationToken: AbortSignal; // CancellationToken → AbortSignal
  handle: Promise<void>; // AbortOnDropHandle<()> → Promise
  turnContext: TurnContext;
}

/**
 * Mutable state for a single turn.
 * Port of state/turn.rs::TurnState
 */
export interface TurnState {
  pendingApprovals: Map<string, (decision: ReviewDecision) => void>;
  pendingInput: ResponseInputItem[];
}

/**
 * Metadata about the currently running turn.
 * Port of state/turn.rs::ActiveTurn
 */
export interface ActiveTurn {
  tasks: Map<string, RunningTask>; // IndexMap → Map
  turnState: TurnState;
}

/**
 * Session configuration (immutable per-session settings).
 * Port of codex.rs::SessionConfiguration
 */
export interface SessionConfiguration {
  /** Provider identifier ("openai", "openrouter", etc.) */
  provider: ModelProviderInfo;

  /** Model identifier */
  model: string;

  /** Reasoning effort configuration */
  modelReasoningEffort: ReasoningEffort | null;

  /** Reasoning summary configuration */
  modelReasoningSummary: ReasoningSummary;

  /** Developer instructions that supplement the base instructions */
  developerInstructions: string | null;

  /** User instructions appended to base instructions */
  userInstructions: string | null;

  /** Base instructions override */
  baseInstructions: string | null;

  /** Compact prompt override */
  compactPrompt: string | null;

  /** Approval policy */
  approvalPolicy: AskForApproval;

  /** Sandbox policy */
  sandboxPolicy: SandboxPolicy;

  /** Working directory (root of session, all paths resolved against this) */
  cwd: string;

  /** Feature flags */
  features: Features;

  /** Original config (temporary, should be removed) */
  originalConfigDoNotUse: Config;

  /** Source of the session */
  sessionSource: SessionSource;
}

/**
 * Updates to session settings.
 * Port of codex.rs::SessionSettingsUpdate
 */
export interface SessionSettingsUpdate {
  cwd?: string;
  approvalPolicy?: AskForApproval;
  sandboxPolicy?: SandboxPolicy;
  model?: string;
  reasoningEffort?: ReasoningEffort | null;
  reasoningSummary?: ReasoningSummary;
  finalOutputJsonSchema?: unknown | null;
}

/**
 * Context for a single turn of conversation.
 * Port of codex.rs::TurnContext
 */
export interface TurnContext {
  /** Submission ID for this turn */
  subId: string;

  /** Model client for API calls */
  client: ModelClient;

  /** Working directory for this turn */
  cwd: string;

  /** Developer instructions */
  developerInstructions: string | null;

  /** Base instructions */
  baseInstructions: string | null;

  /** Compact prompt */
  compactPrompt: string | null;

  /** User instructions */
  userInstructions: string | null;

  /** Approval policy */
  approvalPolicy: AskForApproval;

  /** Sandbox policy */
  sandboxPolicy: SandboxPolicy;

  /** Shell environment policy */
  shellEnvironmentPolicy: ShellEnvironmentPolicy;

  /** Tools configuration */
  toolsConfig: ToolsConfig;

  /** Final output JSON schema */
  finalOutputJsonSchema: unknown | null;

  /** Linux sandbox executable path */
  codexLinuxSandboxExe: string | null;

  /** Tool call gate (readiness flag) */
  toolCallGate: unknown; // TODO: Port ReadinessFlag
}

/**
 * Submission constants.
 */
export const INITIAL_SUBMIT_ID = "";
export const SUBMISSION_CHANNEL_CAPACITY = 64;
