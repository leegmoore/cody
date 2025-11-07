/**
 * Context factory for script execution
 *
 * Creates frozen, immutable ScriptContext objects for injection into sandboxes.
 * All properties are read-only and attempts to modify throw TypeError.
 */

import { deepFreeze } from "./hardening.js";
import type {
  ScriptContext,
  ScriptExecutionLimits,
  DEFAULT_SCRIPT_LIMITS,
} from "./runtime/types.js";

/**
 * Seed data for creating script contexts
 */
export interface ContextSeed {
  // Identity
  conversationId: string;
  sessionId: string;
  turnId: string;

  // Environment
  workingDirectory: string;
  provider: string;
  model: string;

  // Tool information
  availableTools: string[];

  // Approvals
  approvalsRequired: boolean;
  lastApprovalRequestId?: string;

  // Mode
  mode: "disabled" | "dry-run" | "enabled";
}

/**
 * Options for creating script context
 */
export interface CreateContextOptions {
  /** Script ID for this execution */
  scriptId: string;

  /** Execution limits */
  limits: Partial<ScriptExecutionLimits>;

  /** Remaining tool invocations budget */
  remainingToolBudget: number;

  /** Progress callback (not frozen, provided by host) */
  onProgress?: (message: string, kind?: "info" | "warn") => void;
}

/**
 * Rate limiting state for progress events
 */
interface ProgressRateLimiter {
  lastEmitTime: number;
  eventCount: number;
  maxEvents: number;
  minIntervalMs: number;
}

/**
 * Creates a rate-limited progress emitter
 */
function createProgressEmitter(
  onProgress?: (message: string, kind?: "info" | "warn") => void,
): (message: string, kind?: "info" | "warn") => void {
  const limiter: ProgressRateLimiter = {
    lastEmitTime: 0,
    eventCount: 0,
    maxEvents: 50, // Max 50 events per script
    minIntervalMs: 500, // 1 event per 500ms
  };

  return (message: string, kind: "info" | "warn" = "info") => {
    // Validate message
    if (typeof message !== "string") {
      throw new TypeError("Progress message must be a string");
    }

    // Truncate long messages
    const truncated =
      message.length > 1000 ? message.slice(0, 1000) + "..." : message;

    // Check event count limit
    if (limiter.eventCount >= limiter.maxEvents) {
      // Silently ignore (don't throw - script shouldn't fail due to logging)
      return;
    }

    // Check rate limit
    const now = Date.now();
    const elapsed = now - limiter.lastEmitTime;
    if (elapsed < limiter.minIntervalMs && limiter.eventCount > 0) {
      // Silently ignore (don't throw)
      return;
    }

    // Emit event
    limiter.lastEmitTime = now;
    limiter.eventCount++;

    if (onProgress) {
      try {
        onProgress(truncated, kind);
      } catch (error) {
        // Host callback error - ignore to prevent script failure
        console.error("Progress callback error:", error);
      }
    }
  };
}

/**
 * Creates a frozen ScriptContext object for injection into sandbox
 *
 * The context is deeply frozen and immutable. Attempts to modify any property
 * will throw TypeError in strict mode or silently fail in non-strict mode.
 *
 * @param seed - Base context information
 * @param options - Context creation options
 * @returns Frozen ScriptContext object
 *
 * @example
 * ```typescript
 * const ctx = createScriptContext(
 *   {
 *     conversationId: "conv_123",
 *     sessionId: "sess_456",
 *     turnId: "turn_789",
 *     workingDirectory: "/workspace",
 *     provider: "anthropic",
 *     model: "claude-3-5-sonnet-20250219",
 *     availableTools: ["read_file", "write_file"],
 *     approvalsRequired: true,
 *     mode: "enabled"
 *   },
 *   {
 *     scriptId: "scr_abc",
 *     limits: { timeoutMs: 30000, memoryMb: 96 },
 *     remainingToolBudget: 32,
 *     onProgress: (msg) => console.log(msg)
 *   }
 * );
 * ```
 */
export function createScriptContext(
  seed: ContextSeed,
  options: CreateContextOptions,
): ScriptContext {
  // Validate seed
  if (!seed.conversationId || typeof seed.conversationId !== "string") {
    throw new TypeError("conversationId must be a non-empty string");
  }
  if (!seed.sessionId || typeof seed.sessionId !== "string") {
    throw new TypeError("sessionId must be a non-empty string");
  }
  if (!seed.turnId || typeof seed.turnId !== "string") {
    throw new TypeError("turnId must be a non-empty string");
  }
  if (!seed.workingDirectory || typeof seed.workingDirectory !== "string") {
    throw new TypeError("workingDirectory must be a non-empty string");
  }
  if (!seed.provider || typeof seed.provider !== "string") {
    throw new TypeError("provider must be a non-empty string");
  }
  if (!seed.model || typeof seed.model !== "string") {
    throw new TypeError("model must be a non-empty string");
  }
  if (!Array.isArray(seed.availableTools)) {
    throw new TypeError("availableTools must be an array");
  }
  if (typeof seed.approvalsRequired !== "boolean") {
    throw new TypeError("approvalsRequired must be a boolean");
  }
  if (!["disabled", "dry-run", "enabled"].includes(seed.mode)) {
    throw new TypeError('mode must be "disabled", "dry-run", or "enabled"');
  }

  // Validate options
  if (!options.scriptId || typeof options.scriptId !== "string") {
    throw new TypeError("scriptId must be a non-empty string");
  }
  if (
    typeof options.remainingToolBudget !== "number" ||
    options.remainingToolBudget < 0
  ) {
    throw new TypeError("remainingToolBudget must be a non-negative number");
  }

  // Merge limits with defaults
  const limits = {
    timeoutMs: options.limits.timeoutMs ?? 30000,
    memoryMb: options.limits.memoryMb ?? 96,
    maxConcurrentToolCalls: options.limits.maxConcurrentToolCalls ?? 4,
  };

  // Create progress emitter (NOT frozen - it's a function)
  const emitProgress = createProgressEmitter(options.onProgress);

  // Build context object
  const context: ScriptContext = {
    // Identity
    conversationId: seed.conversationId,
    sessionId: seed.sessionId,
    turnId: seed.turnId,
    scriptId: options.scriptId,

    // Environment
    workingDirectory: seed.workingDirectory,
    provider: seed.provider,
    model: seed.model,

    // Sandbox limits
    sandbox: {
      timeoutMs: limits.timeoutMs,
      memoryMb: limits.memoryMb,
      remainingToolBudget: options.remainingToolBudget,
      maxConcurrentToolCalls: limits.maxConcurrentToolCalls,
      mode: seed.mode,
    },

    // Capabilities
    capabilities: {
      tools: [...seed.availableTools], // Clone array
    },

    // Approvals
    approvals: {
      required: seed.approvalsRequired,
      lastRequestId: seed.lastApprovalRequestId,
    },

    // Telemetry - emitProgress is NOT frozen (it's a callable function)
    telemetry: {
      emitProgress,
    },
  };

  // Deep freeze everything EXCEPT the telemetry.emitProgress function
  // We freeze the context object itself, and all nested objects, but not the function
  const frozenContext = deepFreeze(context) as ScriptContext;

  return frozenContext;
}

/**
 * Validates that a context object is properly frozen
 *
 * @param context - Context to validate
 * @returns true if context is frozen, false otherwise
 */
export function isContextFrozen(context: ScriptContext): boolean {
  if (!Object.isFrozen(context)) return false;
  if (!Object.isFrozen(context.sandbox)) return false;
  if (!Object.isFrozen(context.capabilities)) return false;
  if (!Object.isFrozen(context.capabilities.tools)) return false;
  if (!Object.isFrozen(context.approvals)) return false;
  if (!Object.isFrozen(context.telemetry)) return false;

  return true;
}

/**
 * Creates a minimal context for testing purposes
 */
export function createTestContext(
  overrides: Partial<ContextSeed & CreateContextOptions> = {},
): ScriptContext {
  const seed: ContextSeed = {
    conversationId: overrides.conversationId ?? "conv_test",
    sessionId: overrides.sessionId ?? "sess_test",
    turnId: overrides.turnId ?? "turn_test",
    workingDirectory: overrides.workingDirectory ?? "/workspace",
    provider: overrides.provider ?? "anthropic",
    model: overrides.model ?? "claude-3-5-sonnet-20250219",
    availableTools: overrides.availableTools ?? ["test_tool"],
    approvalsRequired: overrides.approvalsRequired ?? false,
    mode: overrides.mode ?? "enabled",
    lastApprovalRequestId: overrides.lastApprovalRequestId,
  };

  const options: CreateContextOptions = {
    scriptId: overrides.scriptId ?? "scr_test",
    limits: overrides.limits ?? {},
    remainingToolBudget: overrides.remainingToolBudget ?? 32,
    onProgress: overrides.onProgress,
  };

  return createScriptContext(seed, options);
}
