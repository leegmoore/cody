/**
 * Script harness orchestrator - main coordinator
 *
 * Orchestrates the full flow:
 * 1. Detect script blocks in text
 * 2. Parse and validate scripts
 * 3. Create execution context
 * 4. Execute scripts with tools
 * 5. Handle approvals
 * 6. Collect results
 *
 * Phase 4.4 - Script Harness: Orchestration
 */

import { detectScriptBlocks } from "./detector.js";
import { parseScript } from "./parser.js";
import { createScriptContext, type ContextSeed } from "./context.js";
import { createToolsProxy, type ToolRegistry, type ApprovalBridge } from "./tool-facade.js";
import { PromiseTracker } from "./runtime/promise-tracker.js";
import type {
  ScriptRuntimeAdapter,
  ScriptExecutionLimits,
  ScriptExecutionResult,
} from "./runtime/types.js";
import { HarnessInternalError } from "./errors.js";

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Runtime adapter for script execution */
  runtime: ScriptRuntimeAdapter;

  /** Tool registry for resolving tools */
  toolRegistry: ToolRegistry;

  /** Approval bridge for user approvals */
  approvalBridge: ApprovalBridge;

  /** Execution limits */
  limits: ScriptExecutionLimits;

  /** Execution mode */
  mode: "enabled" | "dry-run" | "disabled";

  /** Continue executing scripts after errors */
  continueOnError?: boolean;
}

/**
 * Result of a single script execution
 */
export interface ScriptResult extends ScriptExecutionResult {
  /** Script source code */
  sourceCode: string;

  /** Script index in the text */
  index: number;
}

/**
 * Result of orchestrated execution
 */
export interface ExecutionResult {
  /** Success flag */
  ok: boolean;

  /** Executed scripts and their results */
  scripts: ScriptResult[];

  /** Number of scripts detected (for dry-run mode) */
  scriptsDetected?: number;

  /** Error if execution failed */
  error?: {
    code: string;
    message: string;
    phase: "detection" | "parsing" | "context" | "executing";
    scriptIndex?: number;
  };

  /** Execution metadata */
  metadata: {
    totalDuration: number;
    scriptsExecuted: number;
    scriptsDetected: number;
  };
}

/**
 * Options for script execution
 */
export interface ExecuteOptions {
  /** Context seed for script execution */
  contextSeed?: ContextSeed;

  /** Cancellation signal */
  signal?: AbortSignal;
}

/**
 * Main orchestrator for script harness
 *
 * Coordinates detection, parsing, context creation, and execution.
 *
 * @example
 * ```typescript
 * const orchestrator = new Orchestrator({
 *   runtime: new QuickJSRuntime(),
 *   toolRegistry,
 *   approvalBridge,
 *   limits: DEFAULT_SCRIPT_LIMITS,
 *   mode: "enabled"
 * });
 *
 * await orchestrator.initialize();
 * const result = await orchestrator.execute(responseText);
 * ```
 */
export class Orchestrator {
  private config: OrchestratorConfig;
  private initialized = false;

  constructor(config: OrchestratorConfig) {
    this.config = config;
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(): Promise<void> {
    await this.config.runtime.initialize(this.config.limits);
    this.initialized = true;
  }

  /**
   * Execute scripts in response text
   */
  async execute(
    text: string,
    options: ExecuteOptions = {}
  ): Promise<ExecutionResult> {
    if (!this.initialized) {
      throw new HarnessInternalError("Orchestrator not initialized");
    }

    const startTime = Date.now();

    // Mode: disabled - skip everything
    if (this.config.mode === "disabled") {
      return {
        ok: true,
        scripts: [],
        metadata: {
          totalDuration: Date.now() - startTime,
          scriptsExecuted: 0,
          scriptsDetected: 0,
        },
      };
    }

    // 1. Detect script blocks
    const detected = detectScriptBlocks(text);

    // Mode: dry-run - detect but don't execute
    if (this.config.mode === "dry-run") {
      return {
        ok: true,
        scripts: [],
        scriptsDetected: detected.length,
        metadata: {
          totalDuration: Date.now() - startTime,
          scriptsExecuted: 0,
          scriptsDetected: detected.length,
        },
      };
    }

    // No scripts found
    if (detected.length === 0) {
      return {
        ok: true,
        scripts: [],
        metadata: {
          totalDuration: Date.now() - startTime,
          scriptsExecuted: 0,
          scriptsDetected: 0,
        },
      };
    }

    const results: ScriptResult[] = [];

    // Execute each script
    for (let i = 0; i < detected.length; i++) {
      const block = detected[i];

      try {
        // 2. Parse and validate script
        const parseResult = parseScript(block.code);
        if (!parseResult.success || !parseResult.script) {
          const error = {
            ok: false as const,
            sourceCode: block.code,
            index: i,
            error: {
              code: "ScriptSyntaxError",
              message: parseResult.error || "Invalid script syntax",
              phase: "parsing" as const,
            },
            metadata: {
              duration_ms: 0,
              tool_calls_made: 0,
            },
          };

          results.push(error);

          if (!this.config.continueOnError) {
            return {
              ok: false,
              scripts: results,
              error: {
                code: "ScriptSyntaxError",
                message: parseResult.error || "Invalid script syntax",
                phase: "parsing",
                scriptIndex: i,
              },
              metadata: {
                totalDuration: Date.now() - startTime,
                scriptsExecuted: results.length,
                scriptsDetected: detected.length,
              },
            };
          }
          continue;
        }

        // 3. Create execution context
        const defaultSeed: ContextSeed = {
          conversationId: "test-conv",
          sessionId: "test-session",
          turnId: "test-turn",
          workingDirectory: process.cwd(),
          provider: "anthropic",
          model: "claude-3-5-sonnet-20241022",
          availableTools: [],
          approvalsRequired: false,
          mode: this.config.mode,
        };

        const seed: ContextSeed = {
          ...defaultSeed,
          ...options.contextSeed,
        };

        const context = createScriptContext(seed, {
          scriptId: `script-${i}`,
          remainingToolBudget: this.config.limits.maxToolInvocations,
          limits: this.config.limits,
          emitProgress: (msg) => {
            // Progress emitter (can wire to event emitter later)
            console.debug("[script-progress]", msg);
          },
        });

        // 4. Create tools proxy
        const tracker = new PromiseTracker();
        const tools = createToolsProxy(
          this.config.toolRegistry,
          tracker,
          {
            allowedTools: seed.availableTools,
            maxToolInvocations: this.config.limits.maxToolInvocations,
            maxConcurrentToolCalls: this.config.limits.maxConcurrentToolCalls,
            scriptId: `script-${i}`,
            mode: this.config.mode,
          },
          this.config.approvalBridge
        );

        // 5. Execute script
        const scriptResult = await this.config.runtime.execute(
          parseResult.script.sourceCode,
          {
            context,
            tools,
          },
          this.config.limits,
          options.signal
        );

        results.push({
          ...scriptResult,
          sourceCode: block.code,
          index: i,
        });

        // Check if execution failed
        if (!scriptResult.ok && !this.config.continueOnError) {
          return {
            ok: false,
            scripts: results,
            error: {
              code: scriptResult.error?.code || "ScriptError",
              message: scriptResult.error?.message || "Script execution failed",
              phase: "executing",
              scriptIndex: i,
            },
            metadata: {
              totalDuration: Date.now() - startTime,
              scriptsExecuted: results.length,
              scriptsDetected: detected.length,
            },
          };
        }
      } catch (error: any) {
        const scriptError: ScriptResult = {
          ok: false,
          sourceCode: block.code,
          index: i,
          error: {
            code: error.name || "Error",
            message: error.message || String(error),
            phase: "executing",
          },
          metadata: {
            duration_ms: 0,
            tool_calls_made: 0,
          },
        };

        results.push(scriptError);

        if (!this.config.continueOnError) {
          return {
            ok: false,
            scripts: results,
            error: {
              code: error.name || "Error",
              message: error.message || String(error),
              phase: "executing",
              scriptIndex: i,
            },
            metadata: {
              totalDuration: Date.now() - startTime,
              scriptsExecuted: results.length,
              scriptsDetected: detected.length,
            },
          };
        }
      }
    }

    // All scripts executed successfully
    return {
      ok: true,
      scripts: results,
      metadata: {
        totalDuration: Date.now() - startTime,
        scriptsExecuted: results.length,
        scriptsDetected: detected.length,
      },
    };
  }

  /**
   * Dispose orchestrator and cleanup resources
   */
  async dispose(): Promise<void> {
    await this.config.runtime.dispose();
    this.initialized = false;
  }
}
