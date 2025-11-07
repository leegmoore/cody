/**
 * Approval bridge - Suspends script execution for user approvals
 *
 * Manages the lifecycle of approval requests from scripts, including timeout
 * handling and response routing. Scripts pause when waiting for approval.
 */

import { ApprovalTimeoutError, ApprovalDeniedError } from "./errors.js";

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

  /** Optional context for approval UI */
  context?: string;
}

/**
 * Approval response event
 */
export interface ApprovalResponseEvent {
  /** Request ID */
  requestId: string;

  /** Tool name */
  toolName: string;

  /** Whether approved */
  approved: boolean;

  /** Optional reason for denial */
  reason?: string;
}

/**
 * Approval request event (emitted to approval system)
 */
export interface ApprovalRequestEvent {
  /** Unique request ID */
  requestId: string;

  /** Tool name */
  toolName: string;

  /** Sanitized arguments for display */
  args: unknown;

  /** Script context */
  scriptContext: {
    scriptId: string;
    toolCallId: string;
  };

  /** Optional context string */
  context?: string;
}

/**
 * Approval bridge configuration
 */
export interface ApprovalBridgeConfig {
  /** Approval timeout in milliseconds (default: 60000 / 60s) */
  approvalTimeoutMs?: number;

  /** Callback to emit approval request events */
  onApprovalRequest?: (event: ApprovalRequestEvent) => void;

  /** Callback to emit approval response events */
  onApprovalResponse?: (event: ApprovalResponseEvent) => void;
}

/**
 * Pending approval entry
 */
interface PendingApproval {
  /** Promise resolve function */
  resolve: (approved: boolean) => void;

  /** Promise reject function */
  reject: (error: Error) => void;

  /** Timeout timer */
  timer: ReturnType<typeof setTimeout>;

  /** Original request */
  request: ApprovalRequest;

  /** Timestamp when request was created */
  timestamp: number;
}

/**
 * Approval bridge statistics
 */
export interface ApprovalBridgeStats {
  /** Number of pending approvals */
  pending: number;

  /** Total approvals requested */
  total: number;

  /** Total approvals granted */
  approved: number;

  /** Total approvals denied */
  denied: number;

  /** Total approvals timed out */
  timedOut: number;
}

/**
 * Approval bridge
 *
 * Manages the suspend/resume workflow for tool approvals in scripts.
 * When a tool requires approval, the script pauses while waiting for
 * user response. The approval system calls onApprovalResponse when
 * the user approves or denies.
 *
 * @example
 * ```typescript
 * const bridge = new ApprovalBridge({
 *   approvalTimeoutMs: 60000,
 *   onApprovalRequest: (event) => {
 *     console.log(`Approval needed for ${event.toolName}`);
 *     // Show approval UI to user
 *   }
 * });
 *
 * // In tool facade:
 * const approved = await bridge.requestApproval({
 *   toolName: 'run_command',
 *   args: { command: 'rm -rf /' },
 *   scriptId: 'scr_123',
 *   toolCallId: 'tc_456'
 * });
 *
 * // Later, when user responds:
 * bridge.onApprovalResponse('req_789', false); // Denied!
 * ```
 */
export class ApprovalBridge {
  private pending = new Map<string, PendingApproval>();
  private config: Required<ApprovalBridgeConfig>;
  private stats: ApprovalBridgeStats = {
    pending: 0,
    total: 0,
    approved: 0,
    denied: 0,
    timedOut: 0,
  };
  private requestCounter = 0;

  constructor(config: ApprovalBridgeConfig = {}) {
    this.config = {
      approvalTimeoutMs: config.approvalTimeoutMs ?? 60000,
      onApprovalRequest: config.onApprovalRequest ?? (() => {}),
      onApprovalResponse: config.onApprovalResponse ?? (() => {}),
    };
  }

  /**
   * Request approval for a tool call
   *
   * Suspends script execution until user responds or timeout occurs.
   *
   * @param request - Approval request details
   * @returns Promise that resolves to true if approved, false if denied
   * @throws ApprovalTimeoutError if user doesn't respond in time
   */
  async requestApproval(request: ApprovalRequest): Promise<boolean> {
    // Generate unique request ID
    const requestId = `req_${Date.now()}_${++this.requestCounter}`;

    // Update stats
    this.stats.total++;
    this.stats.pending++;

    // Sanitize args for display (prevent sensitive data exposure)
    const sanitizedArgs = this.sanitizeForDisplay(request.args);

    // Emit approval request event
    this.config.onApprovalRequest({
      requestId,
      toolName: request.toolName,
      args: sanitizedArgs,
      scriptContext: {
        scriptId: request.scriptId,
        toolCallId: request.toolCallId,
      },
      context: request.context,
    });

    // Create promise that resolves when user responds
    return new Promise<boolean>((resolve, reject) => {
      // Timeout after configured SLA
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        this.stats.pending--;
        this.stats.timedOut++;
        reject(new ApprovalTimeoutError(request.toolName));
      }, this.config.approvalTimeoutMs);

      // Store pending approval
      this.pending.set(requestId, {
        resolve,
        reject,
        timer,
        request,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Handle approval response from user
   *
   * Called by the approval system when user approves or denies.
   *
   * @param requestId - Request ID
   * @param approved - Whether user approved
   * @param reason - Optional reason for denial
   */
  onUserResponse(
    requestId: string,
    approved: boolean,
    reason?: string,
  ): void {
    const entry = this.pending.get(requestId);
    if (!entry) {
      // Request not found (already completed or timed out)
      return;
    }

    // Clear timeout timer
    clearTimeout(entry.timer);

    // Remove from pending
    this.pending.delete(requestId);
    this.stats.pending--;

    // Update stats
    if (approved) {
      this.stats.approved++;
    } else {
      this.stats.denied++;
    }

    // Emit response event
    this.config.onApprovalResponse({
      requestId,
      toolName: entry.request.toolName,
      approved,
      reason,
    });

    // Resolve the promise
    entry.resolve(approved);
  }

  /**
   * Cancel a pending approval request
   *
   * @param requestId - Request ID to cancel
   * @param reason - Cancellation reason
   */
  cancelRequest(requestId: string, reason = "Request cancelled"): void {
    const entry = this.pending.get(requestId);
    if (!entry) return;

    // Clear timeout timer
    clearTimeout(entry.timer);

    // Remove from pending
    this.pending.delete(requestId);
    this.stats.pending--;

    // Reject the promise
    entry.reject(new ApprovalDeniedError(entry.request.toolName, reason));
  }

  /**
   * Cancel all pending approval requests
   *
   * Used when script is cancelled or times out.
   *
   * @param reason - Cancellation reason
   */
  cancelAll(reason = "Script execution cancelled"): void {
    for (const [requestId, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new ApprovalDeniedError(entry.request.toolName, reason));
    }

    this.stats.pending = 0;
    this.pending.clear();
  }

  /**
   * Get pending approval requests
   *
   * @returns Array of request IDs and their requests
   */
  getPendingRequests(): Array<{ requestId: string; request: ApprovalRequest }> {
    return Array.from(this.pending.entries()).map(([requestId, entry]) => ({
      requestId,
      request: entry.request,
    }));
  }

  /**
   * Get approval statistics
   *
   * @returns Current statistics
   */
  getStats(): ApprovalBridgeStats {
    return { ...this.stats };
  }

  /**
   * Check if there are pending approvals
   *
   * @returns true if there are pending approvals
   */
  hasPendingApprovals(): boolean {
    return this.pending.size > 0;
  }

  /**
   * Get elapsed time for a pending request
   *
   * @param requestId - Request ID
   * @returns Elapsed time in milliseconds, or undefined if not found
   */
  getElapsedTime(requestId: string): number | undefined {
    const entry = this.pending.get(requestId);
    if (!entry) return undefined;
    return Date.now() - entry.timestamp;
  }

  /**
   * Reset statistics (for testing)
   */
  resetStats(): void {
    this.stats = {
      pending: this.pending.size,
      total: 0,
      approved: 0,
      denied: 0,
      timedOut: 0,
    };
    this.requestCounter = 0;
  }

  /**
   * Clear all state (for cleanup)
   */
  clear(): void {
    this.cancelAll("Bridge cleared");
    this.resetStats();
  }

  /**
   * Sanitize arguments for display
   *
   * Removes sensitive fields and truncates large values.
   *
   * @param args - Arguments to sanitize
   * @returns Sanitized arguments
   */
  private sanitizeForDisplay(args: unknown): unknown {
    if (args === null || args === undefined) {
      return args;
    }

    if (typeof args !== "object") {
      // Primitive values - truncate long strings
      if (typeof args === "string" && args.length > 500) {
        return args.slice(0, 500) + "...<truncated>";
      }
      return args;
    }

    if (Array.isArray(args)) {
      // Arrays - sanitize each element, limit to 10 items
      return args.slice(0, 10).map((item) => this.sanitizeForDisplay(item));
    }

    // Objects - sanitize fields and remove sensitive keys
    const sanitized: Record<string, unknown> = {};
    const obj = args as Record<string, unknown>;

    for (const [key, value] of Object.entries(obj)) {
      // Skip sensitive fields
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("key") ||
        lowerKey.includes("auth")
      ) {
        sanitized[key] = "<redacted>";
        continue;
      }

      // Recursively sanitize nested objects
      sanitized[key] = this.sanitizeForDisplay(value);
    }

    return sanitized;
  }
}
