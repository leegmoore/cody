/**
 * Tool facade - Proxies tool calls with validation, approvals, and tracking
 *
 * Creates a Proxy object that intercepts tool calls from scripts and routes them
 * through validation, budget checking, approval workflows, and promise tracking.
 */

import { PromiseTracker } from "./runtime/promise-tracker.js";
import {
  ToolNotFoundError,
  ToolValidationError,
  ToolBudgetExceededError,
  ConcurrencyLimitError,
  ApprovalDeniedError,
  ToolExecutionError,
} from "./errors.js";

/**
 * Tool definition interface (what we expect from tool registry)
 */
export interface ToolDefinition {
  /** Tool name */
  name: string;

  /** Tool description */
  description?: string;

  /** JSON schema for arguments (optional) */
  schema?: Record<string, unknown>;

  /** Whether this tool requires approval */
  requiresApproval?: (args: unknown) => boolean;

  /** Execute the tool */
  execute: (args: unknown, options?: { signal?: AbortSignal }) => Promise<unknown>;

  /** Validate arguments (optional - if not provided, all args accepted) */
  validateArgs?: (args: unknown) => { valid: boolean; errors?: string[] };
}

/**
 * Tool registry interface
 */
export interface ToolRegistry {
  /** Get a tool by name */
  get(name: string): ToolDefinition | undefined;

  /** Check if tool exists */
  has(name: string): boolean;

  /** List all tool names */
  list(): string[];
}

/**
 * Approval request
 */
export interface ApprovalRequest {
  /** Tool being called */
  toolName: string;

  /** Tool arguments */
  args: unknown;

  /** Script ID making the request */
  scriptId: string;

  /** Tool call ID */
  toolCallId: string;
}

/**
 * Approval bridge interface
 */
export interface ApprovalBridge {
  /** Request approval for a tool call */
  requestApproval(request: ApprovalRequest): Promise<boolean>;
}

/**
 * Configuration for tool facade
 */
export interface ToolFacadeConfig {
  /** List of allowed tool names */
  allowedTools: string[];

  /** Maximum total tool invocations */
  maxToolInvocations: number;

  /** Maximum concurrent tool calls */
  maxConcurrentToolCalls: number;

  /** Script ID for this execution */
  scriptId: string;

  /** Execution mode */
  mode: "disabled" | "dry-run" | "enabled";
}

/**
 * Tool call statistics
 */
export interface ToolCallStats {
  /** Total tool calls made */
  totalCalls: number;

  /** Currently active calls */
  activeCalls: number;

  /** Tool calls by name */
  callsByTool: Record<string, number>;
}

/**
 * ScriptTools interface (what scripts see)
 */
export type ScriptTools = Record<string, (...args: any[]) => Promise<unknown>>;

/**
 * Creates a tools proxy for script execution
 *
 * The proxy intercepts all property access and validates/tracks tool calls.
 * Each tool call goes through:
 * 1. Tool existence check
 * 2. Argument validation
 * 3. Budget checking (total and concurrency)
 * 4. Promise tracking registration
 * 5. Approval workflow (if needed)
 * 6. Tool execution
 * 7. Result freezing and tracking completion
 *
 * @param registry - Tool registry
 * @param tracker - Promise tracker for managing async calls
 * @param config - Tool facade configuration
 * @param approvalBridge - Optional approval bridge for tool approvals
 * @returns Frozen proxy object exposing allowed tools
 *
 * @example
 * ```typescript
 * const tools = createToolsProxy(registry, tracker, {
 *   allowedTools: ['read_file', 'write_file'],
 *   maxToolInvocations: 32,
 *   maxConcurrentToolCalls: 4,
 *   scriptId: 'scr_123',
 *   mode: 'enabled'
 * });
 *
 * // In script:
 * const content = await tools.read_file({ path: '/file.txt' });
 * ```
 */
export function createToolsProxy(
  registry: ToolRegistry,
  tracker: PromiseTracker,
  config: ToolFacadeConfig,
  approvalBridge?: ApprovalBridge,
): ScriptTools {
  const allowedTools = new Set(config.allowedTools);
  const stats: ToolCallStats = {
    totalCalls: 0,
    activeCalls: 0,
    callsByTool: {},
  };

  // Freeze the target object (empty object that serves as the proxy target)
  const target = Object.freeze({});

  const proxy = new Proxy(
    target,
    {
      get(target, prop: string | symbol) {
        // Only handle string properties (tool names)
        if (typeof prop !== "string") {
          return undefined;
        }

        // Special property for stats (for testing/debugging)
        if (prop === "__stats") {
          return { ...stats };
        }

        // Validate tool is allowed
        if (!allowedTools.has(prop)) {
          throw new ToolNotFoundError(
            prop,
            Array.from(allowedTools).slice(0, 10), // Limit to 10 for error message
          );
        }

        // Get tool from registry
        const tool = registry.get(prop);
        if (!tool) {
          throw new ToolNotFoundError(prop, Array.from(allowedTools));
        }

        // Return async function that routes through validation/approval
        return async (args: unknown) => {
          const toolName = prop;

          // In disabled mode, throw immediately
          if (config.mode === "disabled") {
            throw new ToolExecutionError(
              toolName,
              "Script tool harness is disabled",
            );
          }

          // Validate arguments
          if (tool.validateArgs) {
            const validation = tool.validateArgs(args);
            if (!validation.valid) {
              throw new ToolValidationError(
                toolName,
                validation.errors ?? ["Invalid arguments"],
              );
            }
          }

          // Check total tool budget
          if (stats.totalCalls >= config.maxToolInvocations) {
            throw new ToolBudgetExceededError(
              config.maxToolInvocations,
              toolName,
            );
          }

          // Check concurrency limit
          if (stats.activeCalls >= config.maxConcurrentToolCalls) {
            throw new ConcurrencyLimitError(
              config.maxConcurrentToolCalls,
              toolName,
            );
          }

          // Update stats
          stats.totalCalls++;
          stats.activeCalls++;
          stats.callsByTool[toolName] = (stats.callsByTool[toolName] ?? 0) + 1;

          // Create AbortController for this call
          const abort = new AbortController();

          // Create promise for tool execution
          const toolPromise = (async () => {
            try {
              // Check if approval needed
              if (
                tool.requiresApproval &&
                tool.requiresApproval(args) &&
                approvalBridge
              ) {
                const toolCallId = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

                const approved = await approvalBridge.requestApproval({
                  toolName,
                  args,
                  scriptId: config.scriptId,
                  toolCallId,
                });

                if (!approved) {
                  throw new ApprovalDeniedError(toolName);
                }
              }

              // In dry-run mode, don't actually execute
              if (config.mode === "dry-run") {
                return {
                  __dryRun: true,
                  toolName,
                  args,
                  message: "Dry-run mode: tool not executed",
                };
              }

              // Execute tool with AbortSignal
              const result = await tool.execute(args, { signal: abort.signal });

              // Return frozen result (immutable in script)
              return Object.freeze(result);
            } finally {
              // Update stats on completion
              stats.activeCalls--;
            }
          })();

          // Register promise with tracker
          const promiseId = tracker.register(toolName, toolPromise, abort);

          // Return the promise
          return toolPromise;
        };
      },

      // Prevent setting properties
      set() {
        return false;
      },

      // Prevent deleting properties
      deleteProperty() {
        return false;
      },

      // Enumerate only allowed tools
      // Note: We can't use ownKeys with a frozen empty target
      // The proxy itself is immutable via set/deleteProperty traps
    },
  );

  // Return the proxy (immutable via traps, no need to freeze)
  return proxy as ScriptTools;
}

/**
 * Simple in-memory tool registry for testing
 */
export class SimpleToolRegistry implements ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }

  clear(): void {
    this.tools.clear();
  }
}

/**
 * Simple approval bridge for testing
 */
export class SimpleApprovalBridge implements ApprovalBridge {
  private autoApprove: boolean;
  private requests: ApprovalRequest[] = [];

  constructor(autoApprove = true) {
    this.autoApprove = autoApprove;
  }

  async requestApproval(request: ApprovalRequest): Promise<boolean> {
    this.requests.push(request);
    return this.autoApprove;
  }

  getRequests(): ApprovalRequest[] {
    return [...this.requests];
  }

  setAutoApprove(value: boolean): void {
    this.autoApprove = value;
  }

  clear(): void {
    this.requests = [];
  }
}
