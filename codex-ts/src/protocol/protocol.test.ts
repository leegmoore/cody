/**
 * Tests for protocol/protocol.ts
 */

import { describe, it, expect } from "vitest";
import {
  USER_INSTRUCTIONS_OPEN_TAG,
  USER_INSTRUCTIONS_CLOSE_TAG,
  ENVIRONMENT_CONTEXT_OPEN_TAG,
  ENVIRONMENT_CONTEXT_CLOSE_TAG,
  USER_MESSAGE_BEGIN,
  type Submission,
  type Event,
  type Op,
  type AskForApproval,
  type SandboxPolicy,
  type ReviewDecision,
  type EventMsg,
  type TokenUsage,
  type TokenUsageInfo,
  type RateLimitSnapshot,
  type McpInvocation,
  type FileChange,
  type ReviewRequest,
  type TurnAbortReason,
  createSubmission,
  createEvent,
  hasFullDiskWriteAccess,
  hasNetworkAccess,
  createReadOnlyPolicy,
  createWorkspaceWritePolicy,
  isErrorEvent,
  isTaskCompleteEvent,
  isAgentMessageEvent,
} from "./protocol.js";

describe("Constants", () => {
  it("should define user instructions tags", () => {
    expect(USER_INSTRUCTIONS_OPEN_TAG).toBe("<user_instructions>");
    expect(USER_INSTRUCTIONS_CLOSE_TAG).toBe("</user_instructions>");
  });

  it("should define environment context tags", () => {
    expect(ENVIRONMENT_CONTEXT_OPEN_TAG).toBe("<environment_context>");
    expect(ENVIRONMENT_CONTEXT_CLOSE_TAG).toBe("</environment_context>");
  });

  it("should define user message begin marker", () => {
    expect(USER_MESSAGE_BEGIN).toBe("## My request for Codex:");
  });
});

describe("Submission", () => {
  it("should create submission with id and op", () => {
    const submission: Submission = {
      id: "sub_001",
      op: { type: "interrupt" },
    };
    expect(submission.id).toBe("sub_001");
    expect(submission.op.type).toBe("interrupt");
  });

  it("should serialize submission to JSON", () => {
    const submission: Submission = {
      id: "sub_002",
      op: { type: "shutdown" },
    };
    const json = JSON.stringify(submission);
    const parsed = JSON.parse(json) as Submission;
    expect(parsed).toEqual(submission);
  });
});

describe("Event", () => {
  it("should create event with id and msg", () => {
    const event: Event = {
      id: "evt_001",
      msg: { type: "task_complete" },
    };
    expect(event.id).toBe("evt_001");
    expect(event.msg.type).toBe("task_complete");
  });

  it("should serialize event to JSON", () => {
    const event: Event = {
      id: "evt_002",
      msg: { type: "agent_message", message: "Hello!" },
    };
    const json = JSON.stringify(event);
    const parsed = JSON.parse(json) as Event;
    expect(parsed).toEqual(event);
  });
});

describe("Op", () => {
  it("should create interrupt op", () => {
    const op: Op = { type: "interrupt" };
    expect(op.type).toBe("interrupt");
  });

  it("should create user_input op", () => {
    const op: Op = {
      type: "user_input",
      items: [{ type: "text", text: "Hello" }],
    };
    expect(op.type).toBe("user_input");
    expect(op.items).toHaveLength(1);
  });

  it("should create user_turn op with all fields", () => {
    const op: Op = {
      type: "user_turn",
      items: [{ type: "text", text: "Test" }],
      cwd: "/workspace",
      approval_policy: "on-request",
      sandbox_policy: { mode: "read-only" },
      model: "claude-3-5-sonnet",
      effort: "medium",
      summary: "auto",
    };
    expect(op.type).toBe("user_turn");
    expect(op.cwd).toBe("/workspace");
    expect(op.model).toBe("claude-3-5-sonnet");
  });

  it("should create override_turn_context op", () => {
    const op: Op = {
      type: "override_turn_context",
      model: "claude-3-5-haiku",
      approval_policy: "never",
    };
    expect(op.type).toBe("override_turn_context");
    expect(op.model).toBe("claude-3-5-haiku");
  });

  it("should create exec_approval op", () => {
    const op: Op = {
      type: "exec_approval",
      id: "req_001",
      decision: "approved",
    };
    expect(op.type).toBe("exec_approval");
    expect(op.decision).toBe("approved");
  });

  it("should create patch_approval op", () => {
    const op: Op = {
      type: "patch_approval",
      id: "req_002",
      decision: "denied",
    };
    expect(op.type).toBe("patch_approval");
    expect(op.decision).toBe("denied");
  });

  it("should create add_to_history op", () => {
    const op: Op = {
      type: "add_to_history",
      text: "Important note",
    };
    expect(op.type).toBe("add_to_history");
    expect(op.text).toBe("Important note");
  });

  it("should create get_history_entry_request op", () => {
    const op: Op = {
      type: "get_history_entry_request",
      offset: 5,
      log_id: 12345,
    };
    expect(op.type).toBe("get_history_entry_request");
    expect(op.offset).toBe(5);
  });

  it("should create list_mcp_tools op", () => {
    const op: Op = { type: "list_mcp_tools" };
    expect(op.type).toBe("list_mcp_tools");
  });

  it("should create list_custom_prompts op", () => {
    const op: Op = { type: "list_custom_prompts" };
    expect(op.type).toBe("list_custom_prompts");
  });

  it("should create compact op", () => {
    const op: Op = { type: "compact" };
    expect(op.type).toBe("compact");
  });

  it("should create undo op", () => {
    const op: Op = { type: "undo" };
    expect(op.type).toBe("undo");
  });

  it("should create review op", () => {
    const op: Op = {
      type: "review",
      review_request: { mode: "full", focus_areas: ["security"] },
    };
    expect(op.type).toBe("review");
    expect(op.review_request.mode).toBe("full");
  });

  it("should create shutdown op", () => {
    const op: Op = { type: "shutdown" };
    expect(op.type).toBe("shutdown");
  });

  it("should create run_user_shell_command op", () => {
    const op: Op = {
      type: "run_user_shell_command",
      command: "ls -la",
    };
    expect(op.type).toBe("run_user_shell_command");
    expect(op.command).toBe("ls -la");
  });
});

describe("AskForApproval", () => {
  it("should accept valid approval policy values", () => {
    const policies: AskForApproval[] = [
      "untrusted",
      "on-failure",
      "on-request",
      "never",
    ];
    policies.forEach((policy) => {
      expect(["untrusted", "on-failure", "on-request", "never"]).toContain(
        policy,
      );
    });
  });
});

describe("SandboxPolicy", () => {
  it("should create danger-full-access policy", () => {
    const policy: SandboxPolicy = { mode: "danger-full-access" };
    expect(policy.mode).toBe("danger-full-access");
  });

  it("should create read-only policy", () => {
    const policy: SandboxPolicy = { mode: "read-only" };
    expect(policy.mode).toBe("read-only");
  });

  it("should create workspace-write policy with all options", () => {
    const policy: SandboxPolicy = {
      mode: "workspace-write",
      writable_roots: ["/app/data", "/tmp"],
      network_access: true,
      exclude_tmpdir_env_var: false,
      exclude_slash_tmp: false,
    };
    expect(policy.mode).toBe("workspace-write");
    expect(policy.writable_roots).toHaveLength(2);
    expect(policy.network_access).toBe(true);
  });

  it("should create workspace-write policy with minimal options", () => {
    const policy: SandboxPolicy = {
      mode: "workspace-write",
    };
    expect(policy.mode).toBe("workspace-write");
    expect(policy.writable_roots).toBeUndefined();
  });
});

describe("ReviewDecision", () => {
  it("should accept valid review decision values", () => {
    const decisions: ReviewDecision[] = [
      "approved",
      "approved_for_session",
      "denied",
      "abort",
    ];
    decisions.forEach((decision) => {
      expect(["approved", "approved_for_session", "denied", "abort"]).toContain(
        decision,
      );
    });
  });
});

describe("EventMsg", () => {
  it("should create error event", () => {
    const msg: EventMsg = {
      type: "error",
      message: "Something went wrong",
      details: "Stack trace...",
    };
    expect(msg.type).toBe("error");
    expect(msg.message).toBe("Something went wrong");
  });

  it("should create warning event", () => {
    const msg: EventMsg = {
      type: "warning",
      message: "Potential issue detected",
    };
    expect(msg.type).toBe("warning");
  });

  it("should create task_started event", () => {
    const msg: EventMsg = {
      type: "task_started",
      model_context_window: 200000,
    };
    expect(msg.type).toBe("task_started");
    expect(msg.model_context_window).toBe(200000);
  });

  it("should create task_complete event", () => {
    const msg: EventMsg = {
      type: "task_complete",
      last_agent_message: "Task finished successfully",
    };
    expect(msg.type).toBe("task_complete");
  });

  it("should create token_count event", () => {
    const msg: EventMsg = {
      type: "token_count",
      info: {
        total_token_usage: {
          input_tokens: 1000,
          cached_input_tokens: 500,
          output_tokens: 300,
          reasoning_tokens: 100,
        },
        last_token_usage: {
          input_tokens: 100,
          cached_input_tokens: 50,
          output_tokens: 30,
          reasoning_tokens: 10,
        },
        model_context_window: 200000,
      },
    };
    expect(msg.type).toBe("token_count");
    expect(msg.info?.total_token_usage.input_tokens).toBe(1000);
  });

  it("should create agent_message event", () => {
    const msg: EventMsg = {
      type: "agent_message",
      message: "Hello, how can I help?",
    };
    expect(msg.type).toBe("agent_message");
    expect(msg.message).toBe("Hello, how can I help?");
  });

  it("should create user_message event", () => {
    const msg: EventMsg = {
      type: "user_message",
      message: "Can you help me?",
      images: ["data:image/png;base64,ABC"],
    };
    expect(msg.type).toBe("user_message");
    expect(msg.images).toHaveLength(1);
  });

  it("should create agent_message_delta event", () => {
    const msg: EventMsg = {
      type: "agent_message_delta",
      delta: "Hello",
    };
    expect(msg.type).toBe("agent_message_delta");
    expect(msg.delta).toBe("Hello");
  });

  it("should create agent_reasoning event", () => {
    const msg: EventMsg = {
      type: "agent_reasoning",
      text: "Let me think about this...",
    };
    expect(msg.type).toBe("agent_reasoning");
  });

  it("should create agent_reasoning_delta event", () => {
    const msg: EventMsg = {
      type: "agent_reasoning_delta",
      delta: "thinking...",
    };
    expect(msg.type).toBe("agent_reasoning_delta");
  });

  it("should create agent_reasoning_raw_content event", () => {
    const msg: EventMsg = {
      type: "agent_reasoning_raw_content",
      text: "Raw reasoning content",
    };
    expect(msg.type).toBe("agent_reasoning_raw_content");
  });

  it("should create agent_reasoning_section_break event", () => {
    const msg: EventMsg = {
      type: "agent_reasoning_section_break",
    };
    expect(msg.type).toBe("agent_reasoning_section_break");
  });

  it("should create session_configured event", () => {
    const msg: EventMsg = {
      type: "session_configured",
      session_id: "sess_001",
      model: "claude-3-5-sonnet",
      history_log_id: 12345,
      history_entry_count: 10,
      rollout_path: "/tmp/rollout",
    };
    expect(msg.type).toBe("session_configured");
    expect(msg.session_id).toBe("sess_001");
  });

  it("should create mcp_tool_call_begin event", () => {
    const msg: EventMsg = {
      type: "mcp_tool_call_begin",
      invocation: {
        server_name: "mcp_server",
        tool_name: "search",
        call_id: "call_001",
        arguments: '{"query":"test"}',
      },
    };
    expect(msg.type).toBe("mcp_tool_call_begin");
    expect(msg.invocation.tool_name).toBe("search");
  });

  it("should create mcp_tool_call_end event", () => {
    const msg: EventMsg = {
      type: "mcp_tool_call_end",
      invocation: {
        server_name: "mcp_server",
        tool_name: "search",
        call_id: "call_001",
        arguments: "{}",
      },
      result: { status: "success" },
    };
    expect(msg.type).toBe("mcp_tool_call_end");
  });

  it("should create web_search events", () => {
    const begin: EventMsg = {
      type: "web_search_begin",
      call_id: "ws_001",
    };
    const end: EventMsg = {
      type: "web_search_end",
      call_id: "ws_001",
    };
    expect(begin.type).toBe("web_search_begin");
    expect(end.type).toBe("web_search_end");
  });

  it("should create exec_command_begin event", () => {
    const msg: EventMsg = {
      type: "exec_command_begin",
      call_id: "exec_001",
      command: ["ls", "-la"],
      cwd: "/workspace",
      env: { PATH: "/usr/bin" },
    };
    expect(msg.type).toBe("exec_command_begin");
    expect(msg.command).toEqual(["ls", "-la"]);
  });

  it("should create exec_command_output_delta event", () => {
    const msg: EventMsg = {
      type: "exec_command_output_delta",
      call_id: "exec_001",
      stream: "stdout",
      data: "file1.txt\nfile2.txt\n",
    };
    expect(msg.type).toBe("exec_command_output_delta");
    expect(msg.stream).toBe("stdout");
  });

  it("should create exec_command_end event", () => {
    const msg: EventMsg = {
      type: "exec_command_end",
      call_id: "exec_001",
      stdout: "output",
      stderr: "",
      exit_code: 0,
      timed_out: false,
    };
    expect(msg.type).toBe("exec_command_end");
    expect(msg.exit_code).toBe(0);
  });

  it("should create exec_approval_request event", () => {
    const msg: EventMsg = {
      type: "exec_approval_request",
      id: "req_001",
      command: ["rm", "-rf", "/"],
      cwd: "/",
      risk_level: "high",
      assessment: {
        is_safe: false,
        reason: "Dangerous command",
      },
    };
    expect(msg.type).toBe("exec_approval_request");
    expect(msg.risk_level).toBe("high");
  });

  it("should create apply_patch_approval_request event", () => {
    const msg: EventMsg = {
      type: "apply_patch_approval_request",
      id: "req_002",
      file_changes: {
        "file.ts": { type: "update", unified_diff: "..." },
      },
    };
    expect(msg.type).toBe("apply_patch_approval_request");
  });

  it("should create undo events", () => {
    const started: EventMsg = { type: "undo_started" };
    const completed: EventMsg = { type: "undo_completed", success: true };
    expect(started.type).toBe("undo_started");
    expect(completed.type).toBe("undo_completed");
    if (completed.type === "undo_completed") {
      expect(completed.success).toBe(true);
    }
  });

  it("should create stream events", () => {
    const error: EventMsg = { type: "stream_error", error: "Connection lost" };
    const info: EventMsg = {
      type: "stream_info",
      message: "Reconnecting...",
    };
    expect(error.type).toBe("stream_error");
    expect(info.type).toBe("stream_info");
  });

  it("should create patch_apply events", () => {
    const begin: EventMsg = {
      type: "patch_apply_begin",
      file_path: "src/file.ts",
    };
    const end: EventMsg = {
      type: "patch_apply_end",
      file_path: "src/file.ts",
      success: true,
    };
    expect(begin.type).toBe("patch_apply_begin");
    expect(end.type).toBe("patch_apply_end");
  });

  it("should create turn_aborted event", () => {
    const msg: EventMsg = {
      type: "turn_aborted",
      reason: "user_requested",
    };
    expect(msg.type).toBe("turn_aborted");
    expect(msg.reason).toBe("user_requested");
  });

  it("should create shutdown_complete event", () => {
    const msg: EventMsg = { type: "shutdown_complete" };
    expect(msg.type).toBe("shutdown_complete");
  });
});

describe("TokenUsage", () => {
  it("should create token usage with all fields", () => {
    const usage: TokenUsage = {
      input_tokens: 1000,
      cached_input_tokens: 200,
      output_tokens: 500,
      reasoning_tokens: 50,
    };
    expect(usage.input_tokens).toBe(1000);
    expect(usage.reasoning_tokens).toBe(50);
  });
});

describe("FileChange", () => {
  it("should create add file change", () => {
    const change: FileChange = {
      type: "add",
      content: "new file content",
    };
    expect(change.type).toBe("add");
  });

  it("should create delete file change", () => {
    const change: FileChange = {
      type: "delete",
      content: "old content",
    };
    expect(change.type).toBe("delete");
  });

  it("should create update file change", () => {
    const change: FileChange = {
      type: "update",
      unified_diff: "--- a/file\n+++ b/file\n...",
    };
    expect(change.type).toBe("update");
  });
});

describe("TurnAbortReason", () => {
  it("should accept valid abort reasons", () => {
    const reasons: TurnAbortReason[] = [
      "user_requested",
      "max_turns_reached",
      "error",
      "context_overflow",
    ];
    reasons.forEach((reason) => {
      expect([
        "user_requested",
        "max_turns_reached",
        "error",
        "context_overflow",
      ]).toContain(reason);
    });
  });
});

describe("Helper Functions", () => {
  describe("createSubmission", () => {
    it("should create submission with id and op", () => {
      const submission = createSubmission("sub_123", { type: "shutdown" });
      expect(submission.id).toBe("sub_123");
      expect(submission.op.type).toBe("shutdown");
    });
  });

  describe("createEvent", () => {
    it("should create event with id and msg", () => {
      const event = createEvent("evt_456", {
        type: "agent_message",
        message: "Test",
      });
      expect(event.id).toBe("evt_456");
      expect(event.msg.type).toBe("agent_message");
    });
  });

  describe("hasFullDiskWriteAccess", () => {
    it("should return true for danger-full-access", () => {
      const policy: SandboxPolicy = { mode: "danger-full-access" };
      expect(hasFullDiskWriteAccess(policy)).toBe(true);
    });

    it("should return false for read-only", () => {
      const policy: SandboxPolicy = { mode: "read-only" };
      expect(hasFullDiskWriteAccess(policy)).toBe(false);
    });

    it("should return false for workspace-write", () => {
      const policy: SandboxPolicy = { mode: "workspace-write" };
      expect(hasFullDiskWriteAccess(policy)).toBe(false);
    });
  });

  describe("hasNetworkAccess", () => {
    it("should return true for danger-full-access", () => {
      const policy: SandboxPolicy = { mode: "danger-full-access" };
      expect(hasNetworkAccess(policy)).toBe(true);
    });

    it("should return false for read-only", () => {
      const policy: SandboxPolicy = { mode: "read-only" };
      expect(hasNetworkAccess(policy)).toBe(false);
    });

    it("should return false for workspace-write without network", () => {
      const policy: SandboxPolicy = {
        mode: "workspace-write",
        network_access: false,
      };
      expect(hasNetworkAccess(policy)).toBe(false);
    });

    it("should return true for workspace-write with network", () => {
      const policy: SandboxPolicy = {
        mode: "workspace-write",
        network_access: true,
      };
      expect(hasNetworkAccess(policy)).toBe(true);
    });
  });

  describe("createReadOnlyPolicy", () => {
    it("should create read-only policy", () => {
      const policy = createReadOnlyPolicy();
      expect(policy.mode).toBe("read-only");
    });
  });

  describe("createWorkspaceWritePolicy", () => {
    it("should create workspace-write policy with defaults", () => {
      const policy = createWorkspaceWritePolicy();
      expect(policy.mode).toBe("workspace-write");
      expect(policy.network_access).toBe(false);
      expect(policy.exclude_tmpdir_env_var).toBe(false);
    });
  });

  describe("isErrorEvent", () => {
    it("should return true for error event", () => {
      const msg: EventMsg = { type: "error", message: "Error" };
      expect(isErrorEvent(msg)).toBe(true);
    });

    it("should return false for non-error event", () => {
      const msg: EventMsg = { type: "task_complete" };
      expect(isErrorEvent(msg)).toBe(false);
    });
  });

  describe("isTaskCompleteEvent", () => {
    it("should return true for task_complete event", () => {
      const msg: EventMsg = { type: "task_complete" };
      expect(isTaskCompleteEvent(msg)).toBe(true);
    });

    it("should return false for non-task-complete event", () => {
      const msg: EventMsg = { type: "error", message: "Error" };
      expect(isTaskCompleteEvent(msg)).toBe(false);
    });
  });

  describe("isAgentMessageEvent", () => {
    it("should return true for agent_message event", () => {
      const msg: EventMsg = { type: "agent_message", message: "Hello" };
      expect(isAgentMessageEvent(msg)).toBe(true);
    });

    it("should return false for non-agent-message event", () => {
      const msg: EventMsg = { type: "task_complete" };
      expect(isAgentMessageEvent(msg)).toBe(false);
    });
  });
});

describe("Integration Tests", () => {
  it("should create complete submission-event flow", () => {
    // User submits a task
    const submission = createSubmission("sub_001", {
      type: "user_input",
      items: [{ type: "text", text: "Write a function" }],
    });
    expect(submission.id).toBe("sub_001");

    // Agent starts task
    const taskStarted = createEvent(submission.id, {
      type: "task_started",
      model_context_window: 200000,
    });
    expect(taskStarted.id).toBe(submission.id);

    // Agent sends message
    const agentMsg = createEvent(submission.id, {
      type: "agent_message",
      message: "Here is your function...",
    });
    expect(agentMsg.msg.type).toBe("agent_message");

    // Task completes
    const taskComplete = createEvent(submission.id, {
      type: "task_complete",
      last_agent_message: "Done!",
    });
    expect(taskComplete.msg.type).toBe("task_complete");
  });

  it("should handle approval flow", () => {
    // Agent requests approval
    const approvalReq = createEvent("evt_001", {
      type: "exec_approval_request",
      id: "req_001",
      command: ["npm", "install"],
      cwd: "/app",
      risk_level: "low",
      assessment: { is_safe: true },
    });
    expect(approvalReq.msg.type).toBe("exec_approval_request");

    // User approves
    const approval = createSubmission("sub_002", {
      type: "exec_approval",
      id: "req_001",
      decision: "approved",
    });
    expect(approval.op.type).toBe("exec_approval");
    if (approval.op.type === "exec_approval") {
      expect(approval.op.decision).toBe("approved");
    }
  });

  it("should handle streaming response", () => {
    const events: EventMsg[] = [];

    // Start streaming
    events.push({ type: "task_started" });

    // Stream deltas
    events.push({ type: "agent_message_delta", delta: "Hello" });
    events.push({ type: "agent_message_delta", delta: " world" });
    events.push({ type: "agent_message_delta", delta: "!" });

    // Complete message
    events.push({ type: "agent_message", message: "Hello world!" });

    // Complete task
    events.push({ type: "task_complete" });

    expect(events).toHaveLength(6);
    expect(events[0].type).toBe("task_started");
    expect(events[events.length - 1].type).toBe("task_complete");
  });
});
