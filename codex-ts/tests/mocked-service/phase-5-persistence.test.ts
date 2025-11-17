import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { ConversationManager } from "../../src/core/conversation-manager.js";
import { SessionSource } from "../../src/core/rollout.js";
import { ConversationId } from "../../src/protocol/conversation-id/index.js";
import type { Conversation } from "../../src/core/conversation.js";
import { createMockAuthManager } from "../mocks/auth-manager.js";
import { createMockClient } from "../mocks/model-client.js";
import { createMockConfig } from "../mocks/config.js";
import {
  createMockRolloutEnvironment,
  type MockRolloutEnvironment,
} from "../mocks/rollout-recorder.js";
import { registerListCommand } from "../../src/cli/commands/list.js";
import { registerResumeCommand } from "../../src/cli/commands/resume.js";
import type { CliRuntime } from "../../src/cli/runtime.js";
import { ConversationNotFoundError } from "../../src/core/errors.js";
import * as cliState from "../../src/cli/state.js";
import type { CliConfig } from "../../src/cli/config.js";
import {
  runCompactTask,
  needsCompaction,
  collectUserMessages,
  selectRecentMessages,
  truncateMiddle,
} from "../../src/core/codex/compact.js";
import type { TurnContext } from "../../src/core/codex/types.js";
import { WireApi } from "../../src/core/client/model-provider-info.js";
import type { Session } from "../../src/core/codex/session.js";
import type { Config } from "../../src/core/config.js";
import type { ResponseItem } from "../../src/protocol/models.js";
import * as activeConversationStore from "../../src/cli/active-conversation-store.js";

vi.mock("../../src/cli/active-conversation-store.js", () => {
  return {
    readActiveConversationId: vi.fn().mockResolvedValue(undefined),
    writeActiveConversationId: vi.fn().mockResolvedValue(undefined),
    clearActiveConversationId: vi.fn().mockResolvedValue(undefined),
  };
});

function assistantResponse(text: string): ResponseItem[] {
  return [
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text }],
    },
  ];
}

function parseLines(buffer: string) {
  return buffer
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function userMessage(text: string): ResponseItem {
  return {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text }],
  };
}

function assistantMessage(text: string): ResponseItem {
  return {
    type: "message",
    role: "assistant",
    content: [{ type: "output_text", text }],
  };
}

function ghostSnapshot(label = "ghost"): ResponseItem {
  return {
    type: "ghost_snapshot",
    ghost_commit: {
      id: label,
      parent: undefined,
      preexisting_untracked_files: [],
      preexisting_untracked_dirs: [],
    },
  };
}

describe("Phase 5: persistence primitives", () => {
  let config: Config;
  let manager: ConversationManager;
  let authManager = createMockAuthManager();
  let rolloutEnv: MockRolloutEnvironment;

  beforeEach(() => {
    vi.clearAllMocks();
    rolloutEnv = createMockRolloutEnvironment();
    config = createMockConfig();
    authManager = createMockAuthManager();
  });

  function buildManager(responses: ResponseItem[][]) {
    const mock = createMockClient(responses);
    manager = new ConversationManager(
      authManager,
      SessionSource.CLI,
      async () => mock.client,
      { rolloutStore: rolloutEnv.store },
    );
    return { mock };
  }

  async function drainTurn(conversation: Conversation) {
    // Consume agent message + task complete events
    await conversation.nextEvent();
    await conversation.nextEvent();
  }

  describe("auto-save", () => {
    it("appends a turn after each completed message", async () => {
      const { mock } = buildManager([
        assistantResponse("turn-1"),
        assistantResponse("turn-2"),
      ]);
      const { conversation, conversationId } = await manager.newConversation(
        config,
      );

      await conversation.sendMessage("First");
      await drainTurn(conversation);

      await conversation.sendMessage("Second");
      await drainTurn(conversation);

      expect(mock.sendMessage).toHaveBeenCalledTimes(2);
      expect(rolloutEnv.appendTurnSpy).toHaveBeenCalledTimes(2);

      const buffer = rolloutEnv.getBuffer(conversationId.toString());
      const lines = parseLines(buffer);
      const turnLines = lines.filter((line) => line.item.type === "turn");
      expect(turnLines.length).toBeGreaterThanOrEqual(2);
    });

    it("includes provider/model metadata in each persisted turn", async () => {
      const { mock } = buildManager([
        assistantResponse("ack"),
      ]);
      const { conversation, conversationId } = await manager.newConversation(
        config,
      );

      await conversation.sendMessage("Metadata test");
      await drainTurn(conversation);
      expect(mock.sendMessage).toHaveBeenCalledTimes(1);

      const buffer = rolloutEnv.getBuffer(conversationId.toString());
      const lines = parseLines(buffer);
      const turn = lines.find((line) => line.item.type === "turn");
      expect(turn).toBeDefined();
      expect(turn?.item.data.metadata?.provider).toBe(
        config.modelProviderId,
      );
      expect(turn?.item.data.metadata?.model).toBe(config.model);
    });

    it("continues conversation when appendTurn fails", async () => {
      const { mock } = buildManager([
        assistantResponse("still works"),
      ]);
      rolloutEnv.appendTurnSpy.mockImplementationOnce(() => {
        throw new Error("append failure");
      });

      const { conversation } = await manager.newConversation(config);
      await conversation.sendMessage("Trigger failure");
      await drainTurn(conversation);

      expect(mock.sendMessage).toHaveBeenCalledTimes(1);
      // Even though append failed, the spy should have been invoked once
      expect(rolloutEnv.appendTurnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("resume", () => {
    async function seedConversation(
      responses: ResponseItem[][],
    ): Promise<{ id: string }> {
      buildManager(responses);
      const { conversation, conversationId } = await manager.newConversation(
        config,
      );
      await conversation.sendMessage("seed-1");
      await drainTurn(conversation);
      await conversation.sendMessage("seed-2");
      await drainTurn(conversation);
      return { id: conversationId.toString() };
    }

    it("reconstructs conversation history from persisted turns", async () => {
      const { id } = await seedConversation([
        assistantResponse("seed-ack"),
        assistantResponse("seed-again"),
      ]);
      const resumedMock = createMockClient([assistantResponse("resumed")]);
      const resumeManager = new ConversationManager(
        authManager,
        SessionSource.CLI,
        async () => resumedMock.client,
        { rolloutStore: rolloutEnv.store },
      );

      const resumed = await resumeManager.resumeConversation(config, id);
      await resumed.conversation.sendMessage("after resume");
      await drainTurn(resumed.conversation);

      expect(resumed.conversationId.toString()).toBe(id);
      expect(resumedMock.sendMessage).toHaveBeenCalledTimes(1);
    });

    it("throws when conversation id is missing", async () => {
      buildManager([]);
      await expect(
        manager.resumeConversation(config, "missing-id"),
      ).rejects.toThrow(/not found/i);
    });

    it("throws when rollout contents are corrupted", async () => {
      const { id } = await seedConversation([
        assistantResponse("ok"),
      ]);
      rolloutEnv.setBuffer(id, "invalid json");
      await expect(
        manager.resumeConversation(config, id),
      ).rejects.toThrow(/corrupt|parse/i);
    });

    it("throws when rollout file is empty", async () => {
      const { id } = await seedConversation([
        assistantResponse("ok"),
      ]);
      rolloutEnv.setBuffer(id, "");
      await expect(
        manager.resumeConversation(config, id),
      ).rejects.toThrow(/no turns/i);
    });

    it("resumes conversation when only metadata exists", async () => {
      buildManager([assistantResponse("first reply")]);
      const { conversationId } = await manager.newConversation(config);
      const resumedMock = createMockClient([assistantResponse("after resume")]);
      const resumeManager = new ConversationManager(
        authManager,
        SessionSource.CLI,
        async () => resumedMock.client,
        { rolloutStore: rolloutEnv.store },
      );

      const resumed = await resumeManager.resumeConversation(
        config,
        conversationId.toString(),
      );

      await resumed.conversation.sendMessage("hello after resume");
      await drainTurn(resumed.conversation);

      expect(resumed.conversationId.toString()).toBe(
        conversationId.toString(),
      );
      expect(resumedMock.sendMessage).toHaveBeenCalledTimes(1);
    });

    it("preserves provider/model metadata when resuming", async () => {
      config.modelProviderId = "anthropic";
      config.model = "claude-3-haiku";
      config.modelProviderApi = "messages";
      const { id } = await seedConversation([
        assistantResponse("anthropic"),
      ]);

      const resumeFactory = vi.fn(async () => createMockClient([]).client);
      // Override base config to OpenAI to ensure resume overrides it
      const resumeConfig = createMockConfig({ modelProviderId: "openai" });
      const resumeManager = new ConversationManager(
        authManager,
        SessionSource.CLI,
        resumeFactory,
        { rolloutStore: rolloutEnv.store },
      );

      await resumeManager.resumeConversation(resumeConfig, id);
      expect(resumeFactory).toHaveBeenCalled();
      const invokedConfig = resumeFactory.mock.calls[0][0].config;
      expect(invokedConfig.modelProviderId).toBe("anthropic");
      expect(invokedConfig.model).toBe("claude-3-haiku");
    });
  });

  describe("list", () => {
    it("returns all saved conversations", async () => {
      buildManager([
        assistantResponse("one"),
        assistantResponse("two"),
        assistantResponse("three"),
      ]);
      for (let i = 0; i < 3; i++) {
        const { conversation } = await manager.newConversation(config);
        await conversation.sendMessage(`msg-${i}`);
        await drainTurn(conversation);
      }

      const items = await manager.listConversations(config);
      expect(items).toHaveLength(3);
      const ids = items.map((item) => item.id);
      expect(new Set(ids).size).toBe(3);
    });

    it("returns empty array when store is empty", async () => {
      buildManager([]);
      const items = await manager.listConversations(config);
      expect(items).toEqual([]);
    });

    it("includes provider/model metadata", async () => {
      config.modelProviderId = "anthropic";
      config.modelProviderApi = "messages";
      config.model = "claude-3-haiku";
      const { conversationId, conversation } = await manager.newConversation(
        config,
      );
      await conversation.sendMessage("list metadata");
      await drainTurn(conversation);

      const items = await manager.listConversations(config);
      const target = items.find((item) => item.id === conversationId.toString());
      expect(target).toBeDefined();
      expect(target?.provider).toBe("anthropic");
      expect(target?.model).toBe("claude-3-haiku");
      expect(typeof target?.updatedAt).toBe("number");
    });
  });

  describe("cli commands", () => {
    function createRuntimeStub(
      manager: Partial<ConversationManager>,
    ): CliRuntime {
      const cliConfig: CliConfig = {
        provider: {
          name: "openai",
          api: "responses",
          model: "gpt-4o-mini",
        },
        auth: { method: "api-key" },
      } as CliConfig;
      const loaded = {
        cli: cliConfig,
        core: config,
        codexHome: config.codexHome,
        cwd: config.cwd,
      };
      return {
        loadConfig: vi.fn(async () => loaded),
        getManager: vi.fn(async () => manager as ConversationManager),
      } satisfies CliRuntime;
    }

    it("prints saved conversations from list command", async () => {
      const activeId = ConversationId.new();
      cliState.setActiveConversation(activeId, {} as Conversation);
      const managerStub = {
        listConversations: vi.fn(async () => [
          { id: activeId.toString(), provider: "openai", model: "gpt-4o", updatedAt: 1700000000000 },
          { id: "conv-beta", provider: "anthropic", model: "claude", updatedAt: 1690000000000 },
        ]),
      } as Partial<ConversationManager>;
      const runtime = createRuntimeStub(managerStub);
      const program = new Command();
      program.exitOverride();
      registerListCommand(program, runtime);

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await program.parseAsync(["node", "cody", "list"]);

      expect(managerStub.listConversations).toHaveBeenCalledTimes(1);
      const output = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(output).toContain(`→ ${activeId.toString()}`);
      expect(output).toContain("  conv-beta");
      logSpy.mockRestore();
      cliState.clearActiveConversation();
    });

    it("marks persisted active conversation when CLI state is empty", async () => {
      cliState.clearActiveConversation();
      const persistedId = ConversationId.new().toString();
      const readSpy = vi
        .spyOn(activeConversationStore, "readActiveConversationId")
        .mockResolvedValueOnce(persistedId);
      const managerStub = {
        listConversations: vi.fn(async () => [
          { id: persistedId, provider: "openai", model: "gpt-4o", updatedAt: 1700 },
        ]),
      } as Partial<ConversationManager>;
      const runtime = createRuntimeStub(managerStub);
      const program = new Command();
      program.exitOverride();
      registerListCommand(program, runtime);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await program.parseAsync(["node", "cody", "list"]);

      const output = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(output).toContain(`→ ${persistedId}`);
      logSpy.mockRestore();
      readSpy.mockRestore();
    });

    it("shows empty state when no conversations exist", async () => {
      const managerStub = {
        listConversations: vi.fn(async () => []),
      } as Partial<ConversationManager>;
      const runtime = createRuntimeStub(managerStub);
      const program = new Command();
      program.exitOverride();
      registerListCommand(program, runtime);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await program.parseAsync(["node", "cody", "list"]);

      const output = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(output).toMatch(/No saved conversations/i);
      logSpy.mockRestore();
    });

    it("resumes a conversation via resume command", async () => {
      const setActiveSpy = vi
        .spyOn(cliState, "setActiveConversation")
        .mockImplementation(() => {});
      const validId = ConversationId.new().toString();
      const resumedConversationId = ConversationId.new();
      const writeSpy = vi
        .spyOn(activeConversationStore, "writeActiveConversationId")
        .mockResolvedValue();
      const managerStub = {
        resumeConversation: vi.fn(async () => ({
          conversationId: resumedConversationId,
          conversation: {} as Conversation,
          sessionConfigured: {
            type: "session_configured",
            session_id: "dummy",
            model: "gpt",
            reasoning_effort: null,
            history_log_id: 0,
            history_entry_count: 0,
            rollout_path: "mock://id",
          },
        })),
      } as Partial<ConversationManager>;
      const runtime = createRuntimeStub(managerStub);
      const program = new Command();
      program.exitOverride();
      registerResumeCommand(program, runtime);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await program.parseAsync(["node", "cody", "resume", validId]);

      expect(managerStub.resumeConversation).toHaveBeenCalledWith(
        config,
        validId,
      );
      expect(setActiveSpy).toHaveBeenCalled();
      expect(writeSpy).toHaveBeenCalledWith(
        config.codexHome,
        resumedConversationId.toString(),
      );
      const output = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(output).toMatch(/Resumed conversation/i);

      logSpy.mockRestore();
      setActiveSpy.mockRestore();
      writeSpy.mockRestore();
    });

    it("prints helpful error when resume target missing", async () => {
      const managerStub = {
        resumeConversation: vi.fn(async () => {
          throw new ConversationNotFoundError("conv-missing");
        }),
      } as Partial<ConversationManager>;
      const runtime = createRuntimeStub(managerStub);
      const program = new Command();
      program.exitOverride();
      registerResumeCommand(program, runtime);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const originalExit = process.exitCode;

      const validId = ConversationId.new().toString();
      await program.parseAsync(["node", "cody", "resume", validId]);

      const output = errorSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(output).toMatch(/not found/i);
      expect(process.exitCode).toBe(1);

      errorSpy.mockRestore();
      process.exitCode = originalExit;
    });

    it("reports invalid conversation id format", async () => {
      const managerStub = {
        resumeConversation: vi.fn(),
      } as Partial<ConversationManager>;
      const runtime = createRuntimeStub(managerStub);
      const program = new Command();
      program.exitOverride();
      registerResumeCommand(program, runtime);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const originalExit = process.exitCode;

      await program.parseAsync(["node", "cody", "resume", "invalid-id"]);

      const output = errorSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(output).toMatch(/Invalid conversation ID format/i);
      expect(managerStub.resumeConversation).not.toHaveBeenCalled();
      errorSpy.mockRestore();
      process.exitCode = originalExit;
    });
  });
});

interface CompactSessionOptions {
  history: ResponseItem[];
  initialContext?: ResponseItem[];
  summary?: string;
  recorder?: { appendCompacted: ReturnType<typeof vi.fn> };
  summaryThrows?: boolean;
}

function createCompactSession(options: CompactSessionOptions) {
  const historyRef = [...options.history];
  const replaceHistory = vi.fn((items: ResponseItem[]) => {
    historyRef.length = 0;
    historyRef.push(...items);
  });
  const sendMessage = options.summaryThrows
    ? vi.fn().mockRejectedValue(new Error("summary failure"))
    : vi
        .fn()
        .mockResolvedValue(assistantResponse(options.summary ?? "summary"));
  const recorder =
    options.recorder ?? {
      appendCompacted: vi.fn().mockResolvedValue(undefined),
    };
  const session = {
    getHistory: () => [...historyRef],
    replaceHistory,
    getInitialContext: () => options.initialContext ?? [],
    getModelClient: () => ({ sendMessage }) as unknown,
    getRolloutRecorder: () => recorder,
  } as unknown as Session;

  return { session, replaceHistory, sendMessage, recorder, historyRef };
}

function makeTurnContext(window: number): TurnContext {
  return {
    modelContextWindow: window,
    client: {
      getProvider: () => ({
        name: "mock",
        wireApi: WireApi.Responses,
        requiresOpenaiAuth: false,
        streamMaxRetries: 1,
      }),
    },
  } as TurnContext;
}

describe("Compact module", () => {
  it("needsCompaction returns false when under threshold", () => {
    const history = [userMessage("hello")];
    expect(needsCompaction(history, 500)).toBe(false);
  });

  it("needsCompaction returns true when tokens exceed threshold", () => {
    const history = [userMessage("x".repeat(500))];
    expect(needsCompaction(history, 50)).toBe(true);
  });

  it("does not run when conversation fits context window", async () => {
    const { session, sendMessage } = createCompactSession({
      history: [userMessage("hi")],
    });
    await runCompactTask(session, makeTurnContext(1000));
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("rebuilds history with summary message when compacting", async () => {
    const initialContext = [assistantMessage("system prompt")];
    const { session } = createCompactSession({
      history: [
        userMessage("a".repeat(600)),
        assistantMessage("response"),
        userMessage("b".repeat(600)),
      ],
      initialContext,
      summary: "actions taken",
    });
    await runCompactTask(session, makeTurnContext(80));
    const finalHistory = session.getHistory();
    expect(finalHistory[0].role).toBe(initialContext[0].role);
    const summaryEntry = finalHistory.find((item) =>
      item.type === "message" &&
      item.role === "user" &&
      item.content.some(
        (content) =>
          content.type === "input_text" &&
          content.text.includes("Summary of earlier conversation"),
      ),
    );
    expect(summaryEntry).toBeDefined();
  });

  it("preserves ghost snapshots after compaction", async () => {
    const { session } = createCompactSession({
      history: [userMessage("x".repeat(600)), ghostSnapshot(), assistantMessage("reply")],
    });
    await runCompactTask(session, makeTurnContext(80));
    const ghosts = session
      .getHistory()
      .filter((item) => item.type === "ghost_snapshot");
    expect(ghosts.length).toBeGreaterThan(0);
  });

  it("persists compaction metadata to rollout", async () => {
    const recorder = {
      appendCompacted: vi.fn().mockResolvedValue(undefined),
    };
    const { session } = createCompactSession({
      history: [userMessage("x".repeat(600)), userMessage("y".repeat(600))],
      recorder,
    });
    await runCompactTask(session, makeTurnContext(80));
    expect(recorder.appendCompacted).toHaveBeenCalled();
  });

  it("uses fallback summary when summarization fails", async () => {
    const { session } = createCompactSession({
      history: [userMessage("x".repeat(600))],
      summaryThrows: true,
    });
    await runCompactTask(session, makeTurnContext(80));
    const fallbackSummary = session
      .getHistory()
      .find((item) =>
        item.type === "message" &&
        item.role === "user" &&
        item.content.some((content) =>
          content.type === "input_text" &&
          content.text.includes("summary unavailable"),
        ),
      );
    expect(fallbackSummary).toBeDefined();
  });

  it("triggers summarization when history exceeds threshold (condition 13)", async () => {
    const sessionData = createCompactSession({
      history: [userMessage("x".repeat(600)), userMessage("y".repeat(600))],
    });
    await runCompactTask(sessionData.session, makeTurnContext(80));
    expect(sessionData.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("collects user messages only", () => {
    const history = [assistantMessage("hello"), userMessage("one"), userMessage("two")];
    expect(collectUserMessages(history)).toEqual(["one", "two"]);
  });

  it("selectRecentMessages keeps the newest entries within budget", () => {
    const messages = ["first message", "second", "third"];
    const result = selectRecentMessages(messages, 4);
    expect(result).toContain("third");
    expect(result).toContain("second");
    expect(result).not.toContain("first message");
  });

  it("preserves the most recent user messages when compacting (condition 15)", async () => {
    const history = [
      userMessage("older context".repeat(200)),
      userMessage("still older".repeat(200)),
      userMessage("recent-1"),
      userMessage("recent-2"),
    ];
    const { session } = createCompactSession({
      history,
      initialContext: [assistantMessage("system")],
    });

    await runCompactTask(session, makeTurnContext(80));

    const userMessages = session
      .getHistory()
      .filter((item) => item.type === "message" && item.role === "user")
      .map((item) =>
        item.content
          .filter(
            (content) =>
              content.type === "input_text" || content.type === "output_text",
          )
          .map((content) => content.text)
          .join(""),
      );

    expect(userMessages.some((text) => text.includes("recent-1"))).toBe(true);
    expect(userMessages.some((text) => text.includes("recent-2"))).toBe(true);
    expect(userMessages.some((text) => text.includes("older context"))).toBe(
      false,
    );
  });

  it("retries compaction and drops oldest user messages when history stays above window (condition 18)", async () => {
    const longText = "payload".repeat(200);
    const history = [
      userMessage("oldest"),
      userMessage(longText),
      userMessage("recent"),
    ];
    const sessionData = createCompactSession({ history });
    await runCompactTask(sessionData.session, makeTurnContext(5));
    expect(sessionData.sendMessage.mock.calls.length).toBeGreaterThan(1);
  });

  it("truncateMiddle inserts placeholder", () => {
    const truncated = truncateMiddle("abcdef", 1);
    expect(truncated).toContain("truncated");
  });
});
