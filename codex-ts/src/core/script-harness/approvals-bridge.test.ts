/**
 * Tests for approval bridge
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ApprovalBridge,
  type ApprovalRequest,
  type ApprovalBridgeConfig,
} from "./approvals-bridge.js";
import { ApprovalTimeoutError, ApprovalDeniedError } from "./errors.js";

describe("approvals-bridge.ts", () => {
  let bridge: ApprovalBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    bridge = new ApprovalBridge();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to create valid approval request
  const createRequest = (
    overrides?: Partial<ApprovalRequest>,
  ): ApprovalRequest => ({
    toolName: "test_tool",
    args: { path: "/file.txt" },
    scriptId: "scr_123",
    toolCallId: "tc_456",
    ...overrides,
  });

  describe("Basic approval flow", () => {
    it("AB1: creates approval bridge with default config", () => {
      const bridge = new ApprovalBridge();
      expect(bridge).toBeDefined();
      expect(bridge.hasPendingApprovals()).toBe(false);
    });

    it("AB2: creates approval bridge with custom config", () => {
      const onRequest = vi.fn();
      const onResponse = vi.fn();

      const bridge = new ApprovalBridge({
        approvalTimeoutMs: 30000,
        onApprovalRequest: onRequest,
        onApprovalResponse: onResponse,
      });

      expect(bridge).toBeDefined();
    });

    it("AB3: requestApproval emits event", async () => {
      const onRequest = vi.fn();
      const bridge = new ApprovalBridge({ onApprovalRequest: onRequest });

      const promise = bridge.requestApproval(createRequest());

      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.stringMatching(/^req_/),
          toolName: "test_tool",
          args: { path: "/file.txt" },
          scriptContext: {
            scriptId: "scr_123",
            toolCallId: "tc_456",
          },
        }),
      );

      // Clean up - approve to avoid unhandled rejection
      const requestId = bridge.getPendingRequests()[0].requestId;
      bridge.onUserResponse(requestId, true);
      await promise;
    });

    it("AB4: requestApproval returns promise", async () => {
      const promise = bridge.requestApproval(createRequest());
      expect(promise).toBeInstanceOf(Promise);

      // Clean up
      const requestId = bridge.getPendingRequests()[0].requestId;
      bridge.onUserResponse(requestId, true);
      await promise;
    });

    it("AB5: onUserResponse resolves approval", async () => {
      const promise = bridge.requestApproval(createRequest());

      // Get request ID from pending
      const pending = bridge.getPendingRequests();
      const requestId = pending[0].requestId;

      // Approve
      bridge.onUserResponse(requestId, true);

      const result = await promise;
      expect(result).toBe(true);
    });

    it("AB6: onUserResponse rejects denial", async () => {
      const promise = bridge.requestApproval(createRequest());

      // Get request ID
      const pending = bridge.getPendingRequests();
      const requestId = pending[0].requestId;

      // Deny
      bridge.onUserResponse(requestId, false);

      const result = await promise;
      expect(result).toBe(false);
    });

    it("AB7: approval with reason", async () => {
      const onResponse = vi.fn();
      const bridge = new ApprovalBridge({ onApprovalResponse: onResponse });

      const promise = bridge.requestApproval(createRequest());
      const pending = bridge.getPendingRequests();
      const requestId = pending[0].requestId;

      bridge.onUserResponse(requestId, false, "Security risk");

      await promise;

      expect(onResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId,
          approved: false,
          reason: "Security risk",
        }),
      );
    });
  });

  describe("Timeout handling", () => {
    it("AB8: times out after default timeout (60s)", async () => {
      const promise = bridge.requestApproval(createRequest());

      // Advance time by 60 seconds
      vi.advanceTimersByTime(60000);

      await expect(promise).rejects.toThrow(ApprovalTimeoutError);
      await expect(promise).rejects.toThrow("Approval timeout for tool: test_tool");
    });

    it("AB9: times out after custom timeout", async () => {
      const bridge = new ApprovalBridge({ approvalTimeoutMs: 5000 });
      const promise = bridge.requestApproval(createRequest());

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      await expect(promise).rejects.toThrow(ApprovalTimeoutError);
    });

    it("AB10: clears timeout on approval", async () => {
      const promise = bridge.requestApproval(createRequest());
      const pending = bridge.getPendingRequests();
      const requestId = pending[0].requestId;

      // Approve before timeout
      vi.advanceTimersByTime(1000);
      bridge.onUserResponse(requestId, true);

      const result = await promise;
      expect(result).toBe(true);

      // Advance past timeout - should not throw
      vi.advanceTimersByTime(100000);
    });

    it("AB11: updates stats on timeout", async () => {
      const promise = bridge.requestApproval(createRequest());

      vi.advanceTimersByTime(60000);

      await expect(promise).rejects.toThrow();

      const stats = bridge.getStats();
      expect(stats.timedOut).toBe(1);
      expect(stats.pending).toBe(0);
    });
  });

  describe("Pending requests", () => {
    it("AB12: tracks pending requests", () => {
      bridge.requestApproval(createRequest({ toolName: "tool1" }));
      bridge.requestApproval(createRequest({ toolName: "tool2" }));

      const pending = bridge.getPendingRequests();
      expect(pending).toHaveLength(2);
      expect(pending[0].request.toolName).toBe("tool1");
      expect(pending[1].request.toolName).toBe("tool2");
    });

    it("AB13: hasPendingApprovals returns true when pending", () => {
      expect(bridge.hasPendingApprovals()).toBe(false);

      bridge.requestApproval(createRequest());

      expect(bridge.hasPendingApprovals()).toBe(true);
    });

    it("AB14: removes from pending on approval", async () => {
      const promise = bridge.requestApproval(createRequest());
      expect(bridge.getPendingRequests()).toHaveLength(1);

      const requestId = bridge.getPendingRequests()[0].requestId;
      bridge.onUserResponse(requestId, true);

      await promise;

      expect(bridge.getPendingRequests()).toHaveLength(0);
      expect(bridge.hasPendingApprovals()).toBe(false);
    });

    it("AB15: removes from pending on denial", async () => {
      const promise = bridge.requestApproval(createRequest());
      const requestId = bridge.getPendingRequests()[0].requestId;

      bridge.onUserResponse(requestId, false);

      await promise;

      expect(bridge.hasPendingApprovals()).toBe(false);
    });

    it("AB16: getElapsedTime returns time since request", async () => {
      const promise = bridge.requestApproval(createRequest());
      const requestId = bridge.getPendingRequests()[0].requestId;

      vi.advanceTimersByTime(5000);

      const elapsed = bridge.getElapsedTime(requestId);
      expect(elapsed).toBeGreaterThanOrEqual(5000);

      // Clean up
      bridge.onUserResponse(requestId, true);
      await promise;
    });

    it("AB17: getElapsedTime returns undefined for unknown request", () => {
      const elapsed = bridge.getElapsedTime("unknown_id");
      expect(elapsed).toBeUndefined();
    });
  });

  describe("Cancellation", () => {
    it("AB18: cancelRequest cancels specific request", async () => {
      const promise = bridge.requestApproval(createRequest());
      const requestId = bridge.getPendingRequests()[0].requestId;

      bridge.cancelRequest(requestId, "User cancelled");

      await expect(promise).rejects.toThrow(ApprovalDeniedError);
      await expect(promise).rejects.toThrow("User cancelled");
    });

    it("AB19: cancelRequest with default reason", async () => {
      const promise = bridge.requestApproval(createRequest());
      const requestId = bridge.getPendingRequests()[0].requestId;

      bridge.cancelRequest(requestId);

      await expect(promise).rejects.toThrow("Request cancelled");
    });

    it("AB20: cancelAll cancels all pending", async () => {
      const p1 = bridge.requestApproval(createRequest({ toolName: "tool1" }));
      const p2 = bridge.requestApproval(createRequest({ toolName: "tool2" }));
      const p3 = bridge.requestApproval(createRequest({ toolName: "tool3" }));

      expect(bridge.getPendingRequests()).toHaveLength(3);

      bridge.cancelAll("Script terminated");

      await expect(p1).rejects.toThrow(ApprovalDeniedError);
      await expect(p2).rejects.toThrow(ApprovalDeniedError);
      await expect(p3).rejects.toThrow(ApprovalDeniedError);

      expect(bridge.hasPendingApprovals()).toBe(false);
    });

    it("AB21: cancelAll with default reason", async () => {
      const promise = bridge.requestApproval(createRequest());

      bridge.cancelAll();

      await expect(promise).rejects.toThrow("Script execution cancelled");
    });

    it("AB22: cancelRequest handles unknown ID gracefully", () => {
      expect(() => {
        bridge.cancelRequest("unknown_id");
      }).not.toThrow();
    });
  });

  describe("Statistics", () => {
    it("AB23: tracks total requests", async () => {
      const p1 = bridge.requestApproval(createRequest());
      const p2 = bridge.requestApproval(createRequest());

      const stats = bridge.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);

      bridge.cancelAll();
      await Promise.allSettled([p1, p2]);
    });

    it("AB24: tracks approved count", async () => {
      const p1 = bridge.requestApproval(createRequest());
      const p2 = bridge.requestApproval(createRequest());

      const requests = bridge.getPendingRequests();
      bridge.onUserResponse(requests[0].requestId, true);
      bridge.onUserResponse(requests[1].requestId, true);

      await Promise.all([p1, p2]);

      const stats = bridge.getStats();
      expect(stats.approved).toBe(2);
    });

    it("AB25: tracks denied count", async () => {
      const p1 = bridge.requestApproval(createRequest());
      const p2 = bridge.requestApproval(createRequest());

      const requests = bridge.getPendingRequests();
      bridge.onUserResponse(requests[0].requestId, false);
      bridge.onUserResponse(requests[1].requestId, false);

      await Promise.all([p1, p2]);

      const stats = bridge.getStats();
      expect(stats.denied).toBe(2);
    });

    it("AB26: tracks timeout count", async () => {
      const p1 = bridge.requestApproval(createRequest());
      const p2 = bridge.requestApproval(createRequest());

      vi.advanceTimersByTime(60000);

      await Promise.allSettled([p1, p2]);

      const stats = bridge.getStats();
      expect(stats.timedOut).toBe(2);
    });

    it("AB27: mixed stats tracking", async () => {
      const p1 = bridge.requestApproval(createRequest());
      const p2 = bridge.requestApproval(createRequest());
      const p3 = bridge.requestApproval(createRequest());

      const requests = bridge.getPendingRequests();

      // Approve first
      bridge.onUserResponse(requests[0].requestId, true);
      await p1;

      // Deny second
      bridge.onUserResponse(requests[1].requestId, false);
      await p2;

      // Timeout third
      vi.advanceTimersByTime(60000);
      await expect(p3).rejects.toThrow();

      const stats = bridge.getStats();
      expect(stats.total).toBe(3);
      expect(stats.approved).toBe(1);
      expect(stats.denied).toBe(1);
      expect(stats.timedOut).toBe(1);
      expect(stats.pending).toBe(0);
    });

    it("AB28: resetStats clears statistics", () => {
      bridge.requestApproval(createRequest());
      bridge.requestApproval(createRequest());

      let stats = bridge.getStats();
      expect(stats.total).toBe(2);

      bridge.resetStats();

      stats = bridge.getStats();
      expect(stats.total).toBe(0);
      expect(stats.approved).toBe(0);
      expect(stats.denied).toBe(0);
      expect(stats.timedOut).toBe(0);
    });
  });

  describe("Argument sanitization", () => {
    it("AB29: sanitizes string arguments", async () => {
      const onRequest = vi.fn();
      const bridge = new ApprovalBridge({ onApprovalRequest: onRequest });

      const longString = "x".repeat(1000);
      const promise = bridge.requestApproval(createRequest({ args: longString }));

      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.stringMatching(/^x+\.\.\.<truncated>$/),
        }),
      );

      // Clean up
      const requestId = bridge.getPendingRequests()[0].requestId;
      bridge.onUserResponse(requestId, true);
      await promise;
    });

    it("AB30: redacts password fields", async () => {
      const onRequest = vi.fn();
      const bridge = new ApprovalBridge({ onApprovalRequest: onRequest });

      const promise = bridge.requestApproval(
        createRequest({
          args: {
            username: "alice",
            password: "secret123",
            data: "public",
          },
        }),
      );

      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          args: {
            username: "alice",
            password: "<redacted>",
            data: "public",
          },
        }),
      );

      // Clean up
      const requestId = bridge.getPendingRequests()[0].requestId;
      bridge.onUserResponse(requestId, true);
      await promise;
    });

    it("AB31: redacts sensitive fields (secret, token, key, auth)", async () => {
      const onRequest = vi.fn();
      const bridge = new ApprovalBridge({ onApprovalRequest: onRequest });

      const promise = bridge.requestApproval(
        createRequest({
          args: {
            apiKey: "abc123",
            secretToken: "xyz789",
            authHeader: "Bearer token",
            publicData: "visible",
          },
        }),
      );

      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          args: {
            apiKey: "<redacted>",
            secretToken: "<redacted>",
            authHeader: "<redacted>",
            publicData: "visible",
          },
        }),
      );

      // Clean up
      const requestId = bridge.getPendingRequests()[0].requestId;
      bridge.onUserResponse(requestId, true);
      await promise;
    });

    it("AB32: sanitizes nested objects", async () => {
      const onRequest = vi.fn();
      const bridge = new ApprovalBridge({ onApprovalRequest: onRequest });

      const promise = bridge.requestApproval(
        createRequest({
          args: {
            config: {
              database: {
                password: "db_secret",
                host: "localhost",
              },
            },
          },
        }),
      );

      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          args: {
            config: {
              database: {
                password: "<redacted>",
                host: "localhost",
              },
            },
          },
        }),
      );

      // Clean up
      const requestId = bridge.getPendingRequests()[0].requestId;
      bridge.onUserResponse(requestId, true);
      await promise;
    });

    it("AB33: sanitizes arrays", async () => {
      const onRequest = vi.fn();
      const bridge = new ApprovalBridge({ onApprovalRequest: onRequest });

      const longArray = Array(20).fill("item");
      const promise = bridge.requestApproval(createRequest({ args: longArray }));

      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.arrayContaining(["item"]),
        }),
      );

      // Should be truncated to 10 items
      const sanitized = onRequest.mock.calls[0][0].args as unknown[];
      expect(sanitized.length).toBe(10);

      // Clean up
      const requestId = bridge.getPendingRequests()[0].requestId;
      bridge.onUserResponse(requestId, true);
      await promise;
    });

    it("AB34: handles null and undefined", async () => {
      const onRequest = vi.fn();
      const bridge = new ApprovalBridge({ onApprovalRequest: onRequest });

      const p1 = bridge.requestApproval(createRequest({ args: null }));
      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({ args: null }),
      );

      const p2 = bridge.requestApproval(createRequest({ args: undefined }));
      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({ args: undefined }),
      );

      // Clean up
      const requests = bridge.getPendingRequests();
      bridge.onUserResponse(requests[0].requestId, true);
      bridge.onUserResponse(requests[1].requestId, true);
      await Promise.all([p1, p2]);
    });

    it("AB35: handles primitive types", async () => {
      const onRequest = vi.fn();
      const bridge = new ApprovalBridge({ onApprovalRequest: onRequest });

      const p1 = bridge.requestApproval(createRequest({ args: 42 }));
      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({ args: 42 }),
      );

      const p2 = bridge.requestApproval(createRequest({ args: true }));
      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({ args: true }),
      );

      // Clean up
      const requests = bridge.getPendingRequests();
      bridge.onUserResponse(requests[0].requestId, true);
      bridge.onUserResponse(requests[1].requestId, true);
      await Promise.all([p1, p2]);
    });
  });

  describe("Edge cases", () => {
    it("AB36: handles duplicate response for same request", async () => {
      const promise = bridge.requestApproval(createRequest());
      const requestId = bridge.getPendingRequests()[0].requestId;

      // First response
      bridge.onUserResponse(requestId, true);
      await promise;

      // Second response should be ignored (no error)
      expect(() => {
        bridge.onUserResponse(requestId, false);
      }).not.toThrow();
    });

    it("AB37: handles response for unknown request", () => {
      expect(() => {
        bridge.onUserResponse("unknown_id", true);
      }).not.toThrow();
    });

    it("AB38: clear() cancels all and resets", async () => {
      const p1 = bridge.requestApproval(createRequest());
      const p2 = bridge.requestApproval(createRequest());

      bridge.clear();

      await expect(p1).rejects.toThrow();
      await expect(p2).rejects.toThrow();

      expect(bridge.hasPendingApprovals()).toBe(false);
      expect(bridge.getStats().total).toBe(0);
    });

    it("AB39: multiple concurrent approvals", async () => {
      const p1 = bridge.requestApproval(createRequest({ toolName: "tool1" }));
      const p2 = bridge.requestApproval(createRequest({ toolName: "tool2" }));
      const p3 = bridge.requestApproval(createRequest({ toolName: "tool3" }));

      const requests = bridge.getPendingRequests();
      expect(requests).toHaveLength(3);

      // Approve all
      bridge.onUserResponse(requests[0].requestId, true);
      bridge.onUserResponse(requests[1].requestId, true);
      bridge.onUserResponse(requests[2].requestId, true);

      const results = await Promise.all([p1, p2, p3]);
      expect(results).toEqual([true, true, true]);
    });

    it("AB40: approval with context string", async () => {
      const onRequest = vi.fn();
      const bridge = new ApprovalBridge({ onApprovalRequest: onRequest });

      const promise = bridge.requestApproval(
        createRequest({
          context: "User is trying to delete critical files",
        }),
      );

      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          context: "User is trying to delete critical files",
        }),
      );

      // Clean up
      const requestId = bridge.getPendingRequests()[0].requestId;
      bridge.onUserResponse(requestId, true);
      await promise;
    });
  });
});
