import { describe, it, expect, beforeEach, vi } from "vitest";
import { Conversation } from "../../src/core/conversation.js";
import { createDefaultConfig } from "../../src/core/config.js";
import { ConversationId } from "../../src/protocol/conversation-id/index.js";
import { ValidationError } from "../../src/core/errors.js";

class FakeCodexConversation {
  submittedOp: unknown;
  rollout = "/tmp/rollout";
  nextEventMock = vi.fn();
  constructor(private readonly submissionId = "sub-1") {}
  async submit(op: unknown): Promise<string> {
    this.submittedOp = op;
    return this.submissionId;
  }
  async nextEvent(): Promise<{ msg: { type: string } }> {
    return this.nextEventMock();
  }
  rolloutPath(): string {
    return this.rollout;
  }
}

describe("Conversation.sendMessage", () => {
  let baseConfig: ReturnType<typeof createDefaultConfig>;

  beforeEach(() => {
    baseConfig = createDefaultConfig("/tmp/codex", process.cwd());
  });

  it("throws ValidationError for blank message", async () => {
    const fake = new FakeCodexConversation();
    const convo = new Conversation(fake as never, baseConfig, ConversationId.new());
    await expect(convo.sendMessage("   ")).rejects.toThrow(ValidationError);
  });

  it("trims user message text", async () => {
    const fake = new FakeCodexConversation();
    const convo = new Conversation(fake as never, baseConfig, ConversationId.new());
    await convo.sendMessage("  hello world  ");
    const op = fake.submittedOp as { items: Array<{ text: string }> };
    expect(op.items[0].text).toBe("hello world");
  });

  it("includes cwd from config", async () => {
    baseConfig.cwd = "/custom";
    const fake = new FakeCodexConversation();
    const convo = new Conversation(fake as never, baseConfig, ConversationId.new());
    await convo.sendMessage("test");
    const op = fake.submittedOp as { cwd: string };
    expect(op.cwd).toBe("/custom");
  });

  it("includes sandbox policy", async () => {
    const fake = new FakeCodexConversation();
    const convo = new Conversation(fake as never, baseConfig, ConversationId.new());
    await convo.sendMessage("test");
    const op = fake.submittedOp as { sandbox_policy: unknown };
    expect(op.sandbox_policy).toEqual(baseConfig.sandboxPolicy);
  });

  it("includes approval policy", async () => {
    baseConfig.approvalPolicy = "never";
    const fake = new FakeCodexConversation();
    const convo = new Conversation(fake as never, baseConfig, ConversationId.new());
    await convo.sendMessage("test");
    const op = fake.submittedOp as { approval_policy: string };
    expect(op.approval_policy).toBe("never");
  });

  it("includes model identifier", async () => {
    baseConfig.model = "gpt-4o-mini";
    const fake = new FakeCodexConversation();
    const convo = new Conversation(fake as never, baseConfig, ConversationId.new());
    await convo.sendMessage("test");
    const op = fake.submittedOp as { model: string };
    expect(op.model).toBe("gpt-4o-mini");
  });

  it("includes reasoning effort when configured", async () => {
    baseConfig.modelReasoningEffort = "high";
    const fake = new FakeCodexConversation();
    const convo = new Conversation(fake as never, baseConfig, ConversationId.new());
    await convo.sendMessage("test");
    const op = fake.submittedOp as { effort?: string };
    expect(op.effort).toBe("high");
  });

  it("includes reasoning summary", async () => {
    baseConfig.modelReasoningSummary = "detailed";
    const fake = new FakeCodexConversation();
    const convo = new Conversation(fake as never, baseConfig, ConversationId.new());
    await convo.sendMessage("test");
    const op = fake.submittedOp as { summary: string };
    expect(op.summary).toBe("detailed");
  });

  it("sets final_output_json_schema to undefined", async () => {
    const fake = new FakeCodexConversation();
    const convo = new Conversation(fake as never, baseConfig, ConversationId.new());
    await convo.sendMessage("json please");
    const op = fake.submittedOp as { final_output_json_schema: unknown };
    expect(op.final_output_json_schema).toBeUndefined();
  });

  it("uses text content item type", async () => {
    const fake = new FakeCodexConversation();
    const convo = new Conversation(fake as never, baseConfig, ConversationId.new());
    await convo.sendMessage("text type check");
    const op = fake.submittedOp as { items: Array<{ type: string }> };
    expect(op.items[0].type).toBe("text");
  });

  it("returns submission id from Codex", async () => {
    const fake = new FakeCodexConversation("sub-42");
    const convo = new Conversation(fake as never, baseConfig, ConversationId.new());
    const submissionId = await convo.sendMessage("test");
    expect(submissionId).toBe("sub-42");
  });

  it("proxies nextEvent", async () => {
    const fake = new FakeCodexConversation();
    const convo = new Conversation(fake as never, baseConfig, ConversationId.new());
    fake.nextEventMock.mockResolvedValue({ msg: { type: "task_complete" } });
    const event = await convo.nextEvent();
    expect(event.msg.type).toBe("task_complete");
  });

  it("exposes rollout path", () => {
    const fake = new FakeCodexConversation();
    const convo = new Conversation(fake as never, baseConfig, ConversationId.new());
    expect(convo.rolloutPath()).toBe("/tmp/rollout");
  });
});
