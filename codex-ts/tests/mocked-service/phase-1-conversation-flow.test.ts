import { describe, it, expect, beforeEach } from "vitest";
import { ConversationManager } from "../../src/core/conversation-manager.js";
import { SessionSource } from "../../src/core/rollout.js";
import {
  AuthManager,
  CodexAuth,
} from "../../src/core/auth/index.js";
import type { Config } from "../../src/core/config.js";
import { createMockConfig } from "../mocks/config.js";
import { createMockClient } from "../mocks/model-client.js";
import type { ResponseItem } from "../../src/protocol/models.js";
import { ConfigurationError } from "../../src/core/errors.js";
import type { ModelClientFactory } from "../../src/core/client/model-client-factory.js";
import { ConversationId } from "../../src/protocol/conversation-id/index.js";

function createAuthManager(): AuthManager {
  const auth = CodexAuth.fromApiKey("sk-test-123");
  return AuthManager.fromAuthForTesting(auth);
}

function assistantResponse(text: string): ResponseItem[] {
  return [
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text }],
    },
  ];
}

describe("Phase 1 conversation flow", () => {
  let authManager: AuthManager;
  let config: Config;

  beforeEach(() => {
    authManager = createAuthManager();
    config = createMockConfig();
  });

  it("creates and retrieves a conversation", async () => {
    const { client, sendMessage } = createMockClient([]);
    const factory: ModelClientFactory = async () => client;
    const manager = new ConversationManager(
      authManager,
      SessionSource.CLI,
      factory,
    );

    const result = await manager.newConversation(config);

    expect(result.conversationId).toBeInstanceOf(ConversationId);
    const fetched = await manager.getConversation(result.conversationId);
    expect(fetched).toBe(result.conversation);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("submits a user turn and emits assistant response", async () => {
    const mock = createMockClient([assistantResponse("Hello there!")]);
    const factory: ModelClientFactory = async () => mock.client;
    const manager = new ConversationManager(
      authManager,
      SessionSource.CLI,
      factory,
    );

    const { conversation } = await manager.newConversation(config);

    await conversation.sendMessage("Test message");
    const response = await conversation.nextEvent();
    expect(response.msg.type).toBe("agent_message");
    if (response.msg.type === "agent_message") {
      expect(response.msg.message).toContain("Hello there!");
    }
    const completion = await conversation.nextEvent();
    expect(completion.msg.type).toBe("task_complete");
  });

  it("maintains history across turns", async () => {
    const mock = createMockClient([
      assistantResponse("Turn 1 reply"),
      assistantResponse("Turn 2 reply"),
    ]);
    const manager = new ConversationManager(
      authManager,
      SessionSource.CLI,
      async () => mock.client,
    );

    const { conversation } = await manager.newConversation(config);

    await conversation.sendMessage("First");
    await conversation.nextEvent();
    await conversation.nextEvent();

    await conversation.sendMessage("Second");
    await conversation.nextEvent();
    await conversation.nextEvent();

    expect(mock.sendMessage).toHaveBeenCalledTimes(2);
    const firstPrompt = mock.sendMessage.mock.calls[0][0];
    const secondPrompt = mock.sendMessage.mock.calls[1][0];
    expect(firstPrompt.input).toHaveLength(1);
    expect(secondPrompt.input).toHaveLength(3);
    const rolesAndTexts = secondPrompt.input
      .filter((item) => item.type === "message")
      .map((item) => ({
        role: item.role,
        text: item.content
          .map((c) => {
            if (c.type === "input_text" || c.type === "output_text") {
              return c.text;
            }
            return "";
          })
          .join(""),
      }));
    expect(rolesAndTexts).toEqual([
      { role: "user", text: "First" },
      { role: "assistant", text: "Turn 1 reply" },
      { role: "user", text: "Second" },
    ]);
  });

  it("throws ConfigurationError for invalid config", async () => {
    const mock = createMockClient([]);
    const factory: ModelClientFactory = async ({ config: cfg }) => {
      if (!cfg.model) {
        throw new ConfigurationError("model is required");
      }
      return mock.client;
    };

    const manager = new ConversationManager(
      authManager,
      SessionSource.CLI,
      factory,
    );

    const badConfig = createMockConfig({ model: "" });

    await expect(manager.newConversation(badConfig)).rejects.toThrow(
      ConfigurationError,
    );
  });

  it("returns undefined for unknown conversation id", async () => {
    const mock = createMockClient([]);
    const manager = new ConversationManager(
      authManager,
      SessionSource.CLI,
      async () => mock.client,
    );

    const missing = ConversationId.new();
    const result = await manager.getConversation(missing);
    expect(result).toBeUndefined();
  });
});
